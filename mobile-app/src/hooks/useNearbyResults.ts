import { useEffect, useState } from "react";

import { getNearbyEvChargers, getNearbyStations } from "../api/fuelPathApi";
import { evPowerOptions, NearbyMode } from "../components/NearbyEvControls";
import { AppPreferences, EvCharger, EvConnector, EvPowerMode, MapPoint, StationViewModel } from "../types";
import { stationPriceView } from "../utils/pricing";

const emptyMapRetryRadiusKm = 32;

export function useNearbyResults({
  centre,
  evConnectors,
  evPowerMode,
  nearbyMode,
  nearbyRadiusKm,
  preferences,
}: {
  centre: MapPoint;
  evConnectors: EvConnector[];
  evPowerMode: EvPowerMode;
  nearbyMode: NearbyMode;
  nearbyRadiusKm: number;
  preferences: AppPreferences;
}) {
  const [stations, setStations] = useState<StationViewModel[]>([]);
  const [chargers, setChargers] = useState<EvCharger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stationNotice, setStationNotice] = useState("");
  const [evNotice, setEvNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setStationNotice("");
    setEvNotice("");
    async function loadStations() {
      const shouldLoadChargers = nearbyMode === "ev" || nearbyMode === "both";
      const shouldLoadStations = nearbyMode === "fuel" || nearbyMode === "both";
      const loadChargers = async () => {
        const power = evPowerOptions.find((item) => item.value === evPowerMode) || evPowerOptions[0];
        const response = await getNearbyEvChargers({
          centre,
          radiusKm: Math.max(nearbyRadiusKm, 12),
          limit: 80,
          connectors: evConnectors,
          powerMode: evPowerMode,
          minPowerKw: power.minPowerKw,
        });
        const notice = response.context.warning || "Charger directory data. Confirm availability before driving.";
        return { notice, chargers: sortChargersForPreference(response.chargers, preferences.evChargingPreference) };
      };
      const loadPricedStations = async () => {
        const response = await getNearbyStations({
          fuel: preferences.fuel,
          centre,
          radiusKm: nearbyRadiusKm,
          limit: stationLimitForRadius(nearbyRadiusKm),
        });
        let notice = stationContextNotice(response.context);
        let priced = response.stations
          .map((station) => stationPriceView(station, preferences.fuel, preferences))
          .filter((item): item is StationViewModel => Boolean(item));
        if (!priced.length && nearbyRadiusKm < emptyMapRetryRadiusKm) {
          const retryResponse = await getNearbyStations({
            fuel: preferences.fuel,
            centre,
            radiusKm: emptyMapRetryRadiusKm,
            limit: stationLimitForRadius(emptyMapRetryRadiusKm),
          });
          notice = stationContextNotice(retryResponse.context) || notice;
          priced = retryResponse.stations
            .map((station) => stationPriceView(station, preferences.fuel, preferences))
            .filter((item): item is StationViewModel => Boolean(item));
        }
        if (!priced.length && !notice) {
          notice = `No ${preferences.fuel} prices found around ${centre.label}.`;
        }
        return { notice, priced };
      };

      const [stationResult, chargerResult] = await Promise.all([
        shouldLoadStations ? loadPricedStations() : Promise.resolve({ notice: "", priced: [] }),
        shouldLoadChargers ? loadChargers() : Promise.resolve({ notice: "", chargers: [] }),
      ]);
      return {
        notice: stationResult.notice,
        priced: stationResult.priced,
        chargers: chargerResult.chargers,
        evNotice: chargerResult.notice,
      };
    }

    loadStations()
      .then(({ notice, priced, chargers, evNotice }) => {
        if (!active) return;
        setStations(priced);
        setChargers(chargers);
        setStationNotice(notice);
        setEvNotice(nearbyMode === "ev" || nearbyMode === "both" ? evNotice : "");
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [centre, evConnectors, evPowerMode, nearbyMode, nearbyRadiusKm, preferences]);

  return { chargers, error, evNotice, loading, stationNotice, stations };
}

function sortChargersForPreference(
  chargers: EvCharger[],
  chargingPreference: AppPreferences["evChargingPreference"],
) {
  return [...chargers].sort((left, right) =>
    chargerPreferenceScore(left, chargingPreference) - chargerPreferenceScore(right, chargingPreference),
  );
}

function chargerPreferenceScore(
  charger: EvCharger,
  chargingPreference: AppPreferences["evChargingPreference"],
) {
  const distanceScore = charger.distanceKm;
  const powerPenalty = charger.powerBand === "ultra_fast"
    ? -2.6
    : charger.powerBand === "dc_fast"
      ? -1.5
      : charger.powerBand === "ac"
        ? -0.2
        : 0;
  if (chargingPreference === "nearby") return distanceScore;
  if (chargingPreference === "fast") return distanceScore + powerPenalty * 1.8;
  if (chargingPreference === "reliable") {
    const operatorPenalty = charger.operator && charger.operator !== "Unknown operator" ? -0.8 : 0.6;
    return distanceScore + powerPenalty * 0.6 + operatorPenalty;
  }
  if (chargingPreference === "cheap") {
    const pricingPenalty = charger.pricing && !/unknown|unconfirmed/i.test(charger.pricing) ? -0.8 : 0.4;
    return distanceScore + pricingPenalty;
  }
  return distanceScore + powerPenalty;
}

function stationLimitForRadius(radiusKm: number) {
  if (radiusKm >= 60) return 420;
  if (radiusKm >= 35) return 320;
  if (radiusKm >= 20) return 240;
  return 160;
}

function stationContextNotice(context: {
  warning?: string;
  capability?: string;
  regionCapabilities?: Array<{ region: string; capability: string; blocker?: string }>;
}) {
  if (context.warning) return context.warning;
  const limited = context.regionCapabilities?.find((item) =>
    ["limited", "pending_access", "fallback", "unsupported"].includes(item.capability),
  );
  if (!limited) return "";
  if (limited.capability === "pending_access") {
    return `${limited.region} live prices are not enabled yet. ${limited.blocker || ""}`.trim();
  }
  if (limited.capability === "limited") {
    return `${limited.region} live coverage is limited. Confirm freshness before driving.`;
  }
  if (limited.capability === "fallback") {
    return `Using fallback data for ${limited.region}. Do not treat it as a live price recommendation.`;
  }
  return "No live fuel provider covers this area yet.";
}
