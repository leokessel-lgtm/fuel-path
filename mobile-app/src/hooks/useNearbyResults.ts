import { useEffect, useState } from "react";

import { getNearbyEvChargers, getNearbyStations } from "../api/fuelPathApi";
import { NearbyMode } from "../components/NearbyEvControls";
import { AppPreferences, EvCharger, EvConnector, EvPowerMode, MapPoint, NearbyResponse, StationViewModel } from "../types";
import { evPowerOptions } from "../utils/evChargingDisplay";
import { stationPriceView } from "../utils/pricing";
import {
  activePreferredStationBrands,
  filterStationsByPreferredBrands,
  stationBrandFilterNotice,
} from "../utils/stationBrandPreferences";
import { userVisibleErrorMessage } from "../utils/userVisibleErrors";

const emptyMapRetryRadiusKm = 32;

export function useNearbyResults({
  centre,
  evConnectors,
  evPowerMode,
  nearbyMode,
  nearbyRadiusKm,
  preferences,
  showAllStationBrandsOnce = false,
}: {
  centre: MapPoint;
  evConnectors: EvConnector[];
  evPowerMode: EvPowerMode;
  nearbyMode: NearbyMode;
  nearbyRadiusKm: number;
  preferences: AppPreferences;
  showAllStationBrandsOnce?: boolean;
}) {
  const [stations, setStations] = useState<StationViewModel[]>([]);
  const [chargers, setChargers] = useState<EvCharger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stationNotice, setStationNotice] = useState("");
  const [stationContext, setStationContext] = useState<NearbyResponse["context"]>();
  const [evNotice, setEvNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setStationNotice("");
    setStationContext(undefined);
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
        const preferredBrands = showAllStationBrandsOnce ? [] : activePreferredStationBrands(preferences);
        const response = await getNearbyStations({
          fuel: preferences.fuel,
          centre,
          radiusKm: nearbyRadiusKm,
          limit: stationLimitForRadius(nearbyRadiusKm),
        });
        let context = response.context;
        let notice = stationContextNotice(context);
        let pricedAll = response.stations
          .map((station) => stationPriceView(station, preferences.fuel, preferences))
          .filter((item): item is StationViewModel => Boolean(item));
        let priced = filterStationsByPreferredBrands(pricedAll, preferredBrands);
        if (!pricedAll.length && nearbyRadiusKm < emptyMapRetryRadiusKm) {
          const retryResponse = await getNearbyStations({
            fuel: preferences.fuel,
            centre,
            radiusKm: emptyMapRetryRadiusKm,
            limit: stationLimitForRadius(emptyMapRetryRadiusKm),
          });
          context = retryResponse.context;
          notice = stationContextNotice(retryResponse.context) || notice;
          pricedAll = retryResponse.stations
            .map((station) => stationPriceView(station, preferences.fuel, preferences))
            .filter((item): item is StationViewModel => Boolean(item));
          priced = filterStationsByPreferredBrands(pricedAll, preferredBrands);
        }
        const hiddenCount = Math.max(0, pricedAll.length - priced.length);
        const brandNotice = stationBrandFilterNotice(preferredBrands, hiddenCount);
        if (brandNotice) notice = [brandNotice, notice].filter(Boolean).join(" ");
        if (!priced.length && preferredBrands.length) {
          notice = `No preferred brands found around ${centre.label}. Show all brands once to compare every station.`;
        } else if (!priced.length && !notice) {
          notice = `No ${preferences.fuel} prices found around ${centre.label}.`;
        }
        return { context, notice, priced };
      };

      const [stationResult, chargerResult] = await Promise.all([
        shouldLoadStations ? loadPricedStations() : Promise.resolve({ context: undefined, notice: "", priced: [] }),
        shouldLoadChargers ? loadChargers() : Promise.resolve({ notice: "", chargers: [] }),
      ]);
      return {
        context: stationResult.context,
        notice: stationResult.notice,
        priced: stationResult.priced,
        chargers: chargerResult.chargers,
        evNotice: chargerResult.notice,
      };
    }

    loadStations()
      .then(({ context, notice, priced, chargers, evNotice }) => {
        if (!active) return;
        setStations(priced);
        setChargers(chargers);
        setStationContext(context);
        setStationNotice(notice);
        setEvNotice(nearbyMode === "ev" || nearbyMode === "both" ? evNotice : "");
      })
      .catch((err: Error) => {
        if (active) setError(userVisibleErrorMessage(err, nearbyMode === "ev" ? "ev_chargers" : "nearby"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [centre, evConnectors, evPowerMode, nearbyMode, nearbyRadiusKm, preferences, showAllStationBrandsOnce]);

  return { chargers, error, evNotice, loading, stationContext, stationNotice, stations };
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
  const distanceScore = Number.isFinite(charger.distanceKm) ? charger.distanceKm : 999;
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
  if (radiusKm >= 35) return 360;
  if (radiusKm >= 15) return 320;
  return 200;
}

function stationContextNotice(context: {
  warning?: string;
  cacheAgeSeconds?: number;
  cacheMode?: string;
  capability?: string;
  degraded?: boolean;
  regionCapabilities?: Array<{ region: string; capability: string; blocker?: string }>;
}) {
  const notices = [];
  if (context.warning && shouldShowProviderWarning(context.warning)) {
    notices.push(context.warning);
  }
  if (shouldShowCacheNotice(context)) {
    const age = Number(context.cacheAgeSeconds || 0);
    const ageText = age > 0 ? ` Cached ${formatCacheAge(age)} ago.` : "";
    notices.push(`Price feed is stale.${ageText} Confirm before choosing a stop.`);
  }
  const limited = context.regionCapabilities?.find((item) =>
    ["limited", "pending_access", "fallback", "unsupported"].includes(item.capability),
  );
  if (!limited) return uniqueNotices(notices).join(" ");
  if (limited.capability === "pending_access") {
    notices.push(`${limited.region} live prices are not enabled yet. Check prices before driving.`);
    return uniqueNotices(notices).join(" ");
  }
  if (limited.capability === "limited") {
    notices.push(`${limited.region} live coverage is limited. Confirm freshness before driving.`);
    return uniqueNotices(notices).join(" ");
  }
  if (limited.capability === "fallback") {
    notices.push(`Using fallback data for ${limited.region}. Do not treat it as a live price recommendation.`);
    return uniqueNotices(notices).join(" ");
  }
  notices.push("Live prices are not available for this area yet.");
  return uniqueNotices(notices).join(" ");
}

function shouldShowProviderWarning(warning: string) {
  return !/tomorrow locked prices are checked/i.test(warning);
}

function shouldShowCacheNotice(context: { cacheAgeSeconds?: number; cacheMode?: string; degraded?: boolean }) {
  if (context.cacheMode !== "stale") return false;
  const age = Number(context.cacheAgeSeconds || 0);
  return Number.isFinite(age) && age >= 30 * 60;
}

function formatCacheAge(seconds: number) {
  if (seconds < 90) return `${Math.round(seconds)} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} minutes`;
  return `${Math.round(minutes / 60)} hours`;
}

function uniqueNotices(notices: string[]) {
  return Array.from(new Set(notices.flatMap((notice) => {
    const trimmed = notice.trim();
    return trimmed ? [trimmed] : [];
  })));
}
