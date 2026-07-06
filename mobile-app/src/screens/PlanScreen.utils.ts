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
    distanceAlongRouteKm: Number(candidate.distanceAlongRouteKm || 0),
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
    actualDetour: candidate.actualDetour,
    routePosition: candidate.routePosition,
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
    distanceAlongRouteKm: Number(contextStation.distanceAlongRouteKm || 0),
  };
}

function vehiclePlanSummary(preferences: AppPreferences) {
  const vehicle = preferences.vehicleName || preferences.vehicleRego || "Vehicle";
  if (preferences.vehicleEnergyType === "electric") return `${vehicle} | EV | ${preferences.evRangeKm} km`;
  if (preferences.vehicleEnergyType === "diesel") return `${vehicle} | Diesel | ${preferences.fuel}`;
  return `${vehicle} | Petrol | ${preferences.fuel}`;
}

export function vehiclePlanNotice(vehicleEnergyType: VehicleEnergyType) {
  if (vehicleEnergyType === "electric") {
    return "";
  }
  return "";
}

export function vehicleRouteRangeNotice(preferences: AppPreferences, routeDistanceKm: number | null) {
  if (preferences.vehicleEnergyType !== "electric" || !routeDistanceKm) return "";
  const routeKm = Math.round(routeDistanceKm);
  const rangeKm = preferences.evRangeKm;
  const marginKm = rangeKm - routeKm;
  if (marginKm < 0) {
    return `Route is about ${routeKm} km. Selected EV range is ${rangeKm} km, so include a charging stop while reviewing route charger options.`;
  }
  if (marginKm < 80) {
    return `Route is about ${routeKm} km. Selected EV range is ${rangeKm} km, so keep a charging option in view before driving.`;
  }
  return `Route is about ${routeKm} km. Showing route charger options along the trip.`;
}

export function vehicleRouteCapacityNotice(preferences: AppPreferences, routeDistanceKm: number | null) {
  if (!routeDistanceKm || preferences.vehicleEnergyType === "electric") return "";
  const routeKm = Math.round(routeDistanceKm);
  return `Route is about ${routeKm} km.`;
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

export function routeMapStations(stations: StationViewModel[], selectedStationCode?: string) {
  const selected = selectedStationCode
    ? stations.find((item) => item.station.stationCode === selectedStationCode)
    : undefined;
  const remaining = selected
    ? stations.filter((item) => item.station.stationCode !== selected.station.stationCode)
    : stations;
  const maxAlong = remaining.reduce(
    (max, item) => Math.max(max, Number(item.distanceAlongRouteKm || 0)),
    Number(selected?.distanceAlongRouteKm || 0),
  );
  const buckets = Array.from({ length: 12 }, () => [] as StationViewModel[]);
  const unpositioned: StationViewModel[] = [];
  for (const item of remaining) {
    const progress = routeMarkerProgress(item, maxAlong);
    if (!Number.isFinite(progress)) {
      unpositioned.push(item);
      continue;
    }
    const index = Math.max(0, Math.min(buckets.length - 1, Math.floor(progress * buckets.length)));
    buckets[index].push(item);
  }
  for (const bucket of buckets) {
    bucket.sort(routeMarkerDisplayOrder);
  }
  unpositioned.sort(routeMarkerDisplayOrder);
  const ordered: StationViewModel[] = selected ? [selected] : [];
  let added = true;
  while (added) {
    added = false;
    for (const bucket of buckets) {
      const next = bucket.shift();
      if (!next) continue;
      ordered.push(next);
      added = true;
    }
  }
  ordered.push(...unpositioned);
  return ordered;
}

function routeMarkerProgress(item: StationViewModel, maxAlong: number) {
  if (Number.isFinite(item.routePosition?.progressRatio)) return Number(item.routePosition?.progressRatio);
  const along = Number(item.distanceAlongRouteKm);
  if (Number.isFinite(along) && Number.isFinite(maxAlong) && maxAlong > 0) {
    return along / maxAlong;
  }
  return Number.NaN;
}

function routeMarkerDisplayOrder(left: StationViewModel, right: StationViewModel) {
  return (
    Number(left.adjustedCpl || left.pumpCpl || Number.POSITIVE_INFINITY) -
      Number(right.adjustedCpl || right.pumpCpl || Number.POSITIVE_INFINITY) ||
    Number(left.distanceKm || Number.POSITIVE_INFINITY) -
      Number(right.distanceKm || Number.POSITIVE_INFINITY)
  );
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
    reason: `Probably not worth it for this ${Number(best.detourMinutes || 0).toFixed(1)} min detour.`,
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
  const detourKind = best.actualDetour?.source === "route_engine_via_station" ? "Checked detour" : "Estimated detour";
  if (detourMinutes > 0.05) {
    return `${detourKind} adds about ${detourMinutes.toFixed(1)} min for a better route price.`;
  }
  return best.actualDetour?.source === "route_engine_via_station"
    ? "Checked stop is on the route with the best route price found."
    : "Suggested stop is estimated on the route with the best route price found.";
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
  if (context.brandFilter && context.brands?.length) {
    const brandText = context.brands.length <= 3
      ? context.brands.join(", ")
      : `${context.brands.length} preferred brands`;
    if (context.eligibleCandidates === 0) {
      return `No preferred station brands found on this route. Show all brands in Settings to compare every station.`;
    }
    return `Filtered to ${brandText}.`;
  }
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
  const parts = label.split(",").flatMap((part) => {
    const trimmed = part.trim();
    return trimmed ? [trimmed] : [];
  });
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
