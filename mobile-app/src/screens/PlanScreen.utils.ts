import {
  AppPreferences,
  FuelCode,
  MapPoint,
  SavedCommute,
  ScoreCandidate,
  ScoreResponse,
  StationViewModel,
  RouteTimingAdvice,
  VehicleEnergyType,
} from "../types";
import { stationPriceView } from "../utils/pricing";

export function routeCandidateToStation(candidate: ScoreCandidate, index: number): StationViewModel {
  return {
    station: candidate.station,
    pumpCpl: Number(candidate.pumpCpl),
    adjustedCpl: Number(candidate.adjustedCpl),
    discountCpl: Number(candidate.discountCpl || 0),
    discountLabel: candidate.discountLabel || candidate.discountLabels?.join(", "),
    possibleLowerCpl: candidate.possibleLowerCpl,
    possibleLowerLabel: candidate.possibleLowerLabel,
    possibleLowerDisclosure: candidate.possibleLowerDisclosure,
    possibleDiscountCpl: candidate.possibleDiscountCpl,
    distanceKm: Number(candidate.distanceToRouteKm || candidate.distanceKm || 0),
    fuel: candidate.fuel,
    netSaving: Number(candidate.netSaving || 0),
    detourMinutes: Number(candidate.detourMinutes || 0),
    detourFuelLitres: Number(candidate.detourFuelLitres || 0),
    detourCost: Number(candidate.detourCost || 0),
    timeCost: Number(candidate.timeCost || 0),
    netAfterDetourAndTimeCost: Number(candidate.netAfterDetourAndTimeCost || 0),
    rank: index + 1,
    reachable: candidate.reachable,
    warnings: candidate.warnings || [],
    matchesDecisionRule: candidate.matchesDecisionRule,
  };
}

export function routeContextStationToView(
  station: ScoreResponse["contextStations"][number],
  preferences: AppPreferences,
): StationViewModel | null {
  const view = stationPriceView(station, preferences.fuel, preferences);
  if (!view) return null;
  const contextStation = station as typeof station & {
    distanceToRouteKm?: number;
    distanceAlongRouteKm?: number;
  };
  return {
    ...view,
    distanceKm: Number(contextStation.distanceToRouteKm || view.distanceKm || 0),
  };
}

export function vehiclePlanSummary(preferences: AppPreferences) {
  const vehicle = preferences.vehicleName || preferences.vehicleRego || "Vehicle";
  if (preferences.vehicleEnergyType === "electric") return `${vehicle} | EV | ${preferences.evRangeKm} km`;
  if (preferences.vehicleEnergyType === "hybrid") return `${vehicle} | Hybrid | ${preferences.fuel} | ${preferences.evRangeKm} km EV`;
  if (preferences.vehicleEnergyType === "diesel") return `${vehicle} | Diesel | ${preferences.fuel}`;
  return `${vehicle} | Petrol | ${preferences.fuel}`;
}

export function vehiclePlanNotice(vehicleEnergyType: VehicleEnergyType) {
  if (vehicleEnergyType === "electric") {
    return "Plan can check route distance against your EV range. Charger-stop optimisation is not available yet; use Nearby or your charging network app for stops.";
  }
  if (vehicleEnergyType === "hybrid") {
    return "Hybrid trip planning currently scores fuel stops only. Charger stops stay in Nearby until EV route planning is ready.";
  }
  return "";
}

export function vehicleRouteRangeNotice(preferences: AppPreferences, routeDistanceKm: number | null) {
  if (preferences.vehicleEnergyType !== "electric" || !routeDistanceKm) return "";
  const routeKm = Math.round(routeDistanceKm);
  const rangeKm = preferences.evRangeKm;
  const marginKm = rangeKm - routeKm;
  if (marginKm >= 80) {
    return `Route is about ${routeKm} km. Your selected EV range is ${rangeKm} km, so the trip looks comfortable before weather, speed, load and detours. Charger-stop optimisation is not live yet.`;
  }
  if (marginKm >= 0) {
    return `Route is about ${routeKm} km against your selected ${rangeKm} km EV range. This is tight; plan a charging fallback before driving. Charger availability is not guaranteed here.`;
  }
  return `Route is about ${routeKm} km, which is above your selected ${rangeKm} km EV range. Plan at least one charging stop in Nearby or your charging network app before driving.`;
}

export function vehicleRouteCapacityNotice(preferences: AppPreferences, routeDistanceKm: number | null) {
  if (!routeDistanceKm || preferences.vehicleEnergyType === "electric") return "";
  const routeKm = Math.round(routeDistanceKm);
  if (preferences.vehicleEnergyType === "hybrid") {
    return `Route is about ${routeKm} km. Fuel scoring uses smart detour rules; EV charger stops are not scored yet.`;
  }
  return `Route is about ${routeKm} km. Fuel scoring uses smart detour rules and a standard fill estimate.`;
}

export function uniqueStations(stations: StationViewModel[]) {
  const seen = new Set<string>();
  return stations.filter((item) => {
    const code = item.station.stationCode;
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

export function routeRecommendationCopy(
  best: StationViewModel,
  timingAdvice?: RouteTimingAdvice,
) {
  if (timingAdvice?.visible && usefulTimingAdvice(timingAdvice)) {
    return {
      title: timingAdvice.label || timingAdviceLabel(timingAdvice.action),
      reason: timingAdvice.reason || routeValueReason(best),
    };
  }

  const saving = Number(best.netSaving || 0);
  if (saving >= 1) {
    return {
      title: savingsDetourLabel(saving),
      reason: routeValueReason(best),
    };
  }
  return {
    title: "Small savings detour",
    reason: `Probably not worth it: saves ${formatMoney(saving)} after ${Number(best.detourMinutes || 0).toFixed(1)} min.`,
  };
}

function usefulTimingAdvice(timingAdvice: RouteTimingAdvice) {
  return [
    "fill_today_on_route",
    "fill_today_with_detour",
    "wait_if_can",
    "range_first",
    "skip_detour",
  ].includes(timingAdvice.action);
}

function timingAdviceLabel(action: RouteTimingAdvice["action"]) {
  if (action === "fill_today_on_route") return "Good savings detour";
  if (action === "fill_today_with_detour") return "Good savings detour";
  if (action === "wait_if_can") return "Wait if you can";
  if (action === "range_first") return "Range-first";
  if (action === "skip_detour") return "Small savings detour";
  return "";
}

function routeValueReason(best: StationViewModel) {
  const saving = Number(best.netSaving || 0);
  const detourMinutes = Number(best.detourMinutes || 0);
  if (detourMinutes > 0.05) {
    return `Suggested detour adds ${detourMinutes.toFixed(1)} min and saves about ${formatMoney(saving)}.`;
  }
  return `Suggested stop is on the route and saves about ${formatMoney(saving)}.`;
}
function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function savingsDetourLabel(saving: number) {
  if (saving < 2) return "Small savings detour";
  if (saving < 5) return "Medium savings detour";
  if (saving < 10) return "Good savings detour";
  if (saving < 20) return "Great savings detour";
  return "Strong savings detour";
}

export function routeContextNotice(context: ScoreResponse["context"]) {
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
  return "No live fuel provider covers this route yet.";
}

export function displayLocationLabel(point: MapPoint, fallback: string) {
  const label = point.label || fallback;
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 3).join(", ") || fallback;
}

export function commuteName(from: MapPoint, to: MapPoint) {
  return `${shortPointName(from)} to ${shortPointName(to)}`;
}

export function shortPointName(point: MapPoint) {
  return point.label.split(",")[0]?.trim() || point.label;
}

export function sameSavedCommuteRoute(
  commute: SavedCommute,
  endpoints: { from: MapPoint; to: MapPoint },
  fuel: FuelCode,
) {
  return (
    commute.fuel === fuel &&
    closeCoordinate(commute.from.lat, endpoints.from.lat) &&
    closeCoordinate(commute.from.lon, endpoints.from.lon) &&
    closeCoordinate(commute.to.lat, endpoints.to.lat) &&
    closeCoordinate(commute.to.lon, endpoints.to.lon)
  );
}

function closeCoordinate(left: number, right: number) {
  return Math.abs(left - right) < 0.0002;
}
