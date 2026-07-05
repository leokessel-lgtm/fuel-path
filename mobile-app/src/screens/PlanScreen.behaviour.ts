import { planFuelRoute } from "../api/fuelPathApi";
import { AppPreferences, SavedCommute, ScoreResponse, StationViewModel } from "../types";
import {
  countBand,
  cplBand,
  distanceBand,
  dollarsBand,
  freshnessBandFromUpdatedAt,
  minutesBand,
  recordMonetisationBehaviourEvent,
} from "../services/monetisationBehaviour";
import { routeCandidateToStation } from "./PlanScreen.utils";

type PlannedFuelRoute = Awaited<ReturnType<typeof planFuelRoute>>;

export function recordRoutePlanCompletedEvidence(planned: PlannedFuelRoute, preferences: AppPreferences) {
  const plannedBest = planned.score.recommendations[0]
    ? routeCandidateToStation(planned.score.recommendations[0], 0)
    : undefined;
  void recordMonetisationBehaviourEvent({
    bestPriceByCplBand: cplBand(routeSavingCplForEvent(plannedBest, planned.score.context.decisionSummary)),
    detourMinutesBand: minutesBand(
      planned.score.context.decisionSummary?.economics?.detourMinutes ?? plannedBest?.detourMinutes,
    ),
    eventName: "route_plan_completed",
    fuel: preferences.fuel,
    regionSet: routeRegionSet(planned.score.context.regionCapabilities),
    resultStatus: plannedBest ? "recommendation" : "no_recommendation",
    routeDistanceKmBand: distanceBand(planned.route.distanceKm),
    topRecommendationSourceType: planned.score.context.decisionSummary?.trust?.sourceType,
  });
}

export function recordSavedCommuteCreatedEvidence({
  best,
  decisionSummary,
  distanceKm,
  preferences,
  result,
  savedCommutes,
}: {
  best?: StationViewModel;
  decisionSummary?: ScoreResponse["context"]["decisionSummary"];
  distanceKm: number | null;
  preferences: AppPreferences;
  result: ScoreResponse | null;
  savedCommutes: SavedCommute[];
}) {
  void recordMonetisationBehaviourEvent({
    alertUseCase: preferences.fuelPolicyEnabled ? "fleet_lite" : "commute",
    bestPriceByCplBand: cplBand(routeSavingCplForEvent(best, decisionSummary)),
    detourMinutesBand: minutesBand(decisionSummary?.economics?.detourMinutes ?? best?.detourMinutes),
    eventName: "saved_commute_created",
    fuel: preferences.fuel,
    regionSet: routeRegionSet(result?.context.regionCapabilities),
    routeDistanceKmBand: distanceBand(distanceKm),
    savedRouteCountBand: countBand(savedCommutes.length + 1),
  });
}

export function recordRouteAlertOptInEvidence({
  distanceKm,
  preferences,
  result,
  savedCommutes,
}: {
  distanceKm: number | null;
  preferences: AppPreferences;
  result: ScoreResponse | null;
  savedCommutes: SavedCommute[];
}) {
  void recordMonetisationBehaviourEvent({
    alertUseCase: preferences.fuelPolicyEnabled ? "fleet_lite" : "commute",
    detourThresholdBand: minutesBand(preferences.maxDetourMinutes),
    eventName: "route_alert_opt_in",
    fuel: preferences.fuel,
    regionSet: routeRegionSet(result?.context.regionCapabilities),
    routeDistanceKmBand: distanceBand(distanceKm),
    savedRouteCountBand: countBand(savedCommutes.length),
    savingThresholdBand: dollarsBand(preferences.minSavingDollars),
  });
}

export function recordNavigationOpenedEvidence({
  decisionSummary,
  distanceKm,
  preferences,
  result,
  station,
}: {
  decisionSummary?: ScoreResponse["context"]["decisionSummary"];
  distanceKm: number | null;
  preferences: AppPreferences;
  result: ScoreResponse | null;
  station: StationViewModel;
}) {
  void recordMonetisationBehaviourEvent({
    bestPriceByCplBand: cplBand(routeSavingCplForEvent(station, decisionSummary)),
    detourMinutesBand: minutesBand(decisionSummary?.economics?.detourMinutes ?? station.detourMinutes),
    eventName: "navigation_opened",
    fuel: preferences.fuel,
    regionSet: routeRegionSet(result?.context.regionCapabilities),
    routeDistanceKmBand: distanceBand(distanceKm),
    stationFreshnessBand: freshnessBandFromUpdatedAt(station.station.updatedAt),
    stationSource: station.station.source,
  });
}

function routeSavingCplForEvent(
  item?: StationViewModel,
  decisionSummary?: ScoreResponse["context"]["decisionSummary"],
) {
  if (!item) return undefined;
  const routeComparisonCpl = Number(decisionSummary?.economics?.comparisonCpl);
  if (Number.isFinite(routeComparisonCpl) && routeComparisonCpl > 0) {
    return Math.max(0, routeComparisonCpl - Number(item.adjustedCpl || 0));
  }
  return Math.max(0, Number(item.pumpCpl || 0) - Number(item.adjustedCpl || 0));
}

function routeRegionSet(regionCapabilities?: ScoreResponse["context"]["regionCapabilities"]) {
  return (regionCapabilities || [])
    .map((capability) => capability.region)
    .filter(Boolean)
    .sort();
}
