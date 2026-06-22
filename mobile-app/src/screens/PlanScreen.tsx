import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { geocodeAddress, getRoute, scoreRoute } from "../api/fuelPathApi";
import {
  cheapestTradeOffExplanation,
  routeDecisionAlternatives,
} from "../components/DecisionEvidencePanel";
import { PlanRouteEditorCard } from "../components/PlanRouteEditorCard";
import { PlanRouteSheet } from "../components/PlanRouteSheet";
import { QuickPlace } from "../components/QuickPlaceShortcuts";
import { routeInputPrecisionHint } from "../components/RouteAddressSuggestions";
import { StationMap } from "../components/StationMap";
import { useRouteAddressSuggestions } from "../hooks/useRouteAddressSuggestions";
import { getCurrentMapPoint } from "../services/currentLocation";
import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import {
  AppPreferences,
  FuelCode,
  MapPoint,
  SavedCommute,
  ScoreCandidate,
  ScoreResponse,
  StationViewModel,
  RouteTimingAdvice,
} from "../types";
import { eligibleDiscountIds } from "../utils/discountRedemptions";
import { stationPriceView } from "../utils/pricing";
import { routeCameraInsets as resolveRouteCameraInsets } from "../utils/routeCameraInsets";

type PlanScreenProps = {
  preferences: AppPreferences;
  onFuelChange: (fuel: FuelCode) => void;
  onAddRecentLocation?: (point: MapPoint) => void;
  onClearRecentLocations?: () => void;
  onRemoveRecentLocation?: (point: MapPoint) => void;
  onSaveNamedPlace?: (kind: "home" | "work", point: MapPoint) => void;
  onSaveCommute: (commute: Pick<SavedCommute, "from" | "fuel" | "name" | "to">) => void;
  recentLocations?: MapPoint[];
  savedCommutes: SavedCommute[];
};

type LoadRouteOptions = {
  collapseOnSuccess?: boolean;
  overrideFromLabel?: string;
  overrideFromPoint?: MapPoint;
  overrideToLabel?: string;
  overrideToPoint?: MapPoint;
};

const defaultPlanCentre: MapPoint = {
  lat: -34.0158,
  lon: 151.1054,
  label: "Sylvania NSW 2224",
};

export function PlanScreen({
  recentLocations = [],
  preferences,
  onAddRecentLocation,
  onClearRecentLocations,
  onFuelChange,
  onRemoveRecentLocation,
  onSaveCommute,
  savedCommutes,
}: PlanScreenProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromPoint, setFromPoint] = useState<MapPoint>();
  const [toPoint, setToPoint] = useState<MapPoint>();
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [routeStarted, setRouteStarted] = useState(false);
  const [routeEndpoints, setRouteEndpoints] = useState<{ from: MapPoint; to: MapPoint }>();
  const [routePoints, setRoutePoints] = useState<MapPoint[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [locatingFrom, setLocatingFrom] = useState(false);
  const [routeControlsCollapsed, setRouteControlsCollapsed] = useState(false);
  const [stationPanelOpen, setStationPanelOpen] = useState(false);
  const [routeSheetMinimised, setRouteSheetMinimised] = useState(false);
  const [error, setError] = useState("");
  const routeEditVersionRef = useRef(0);
  const routeRequestIdRef = useRef(0);
  const fromSearchContext = useMemo(
    () => (toPoint ? { near: toPoint, nearRadiusKm: 80 } : undefined),
    [toPoint],
  );
  const toSearchContext = useMemo(
    () => (fromPoint ? { near: fromPoint, nearRadiusKm: 80 } : undefined),
    [fromPoint],
  );
  const {
    activeAddressField,
    clearAddressSuggestionError,
    clearAddressSuggestions,
    fromSuggestions,
    getAddressSessionToken,
    resetAddressSessionToken,
    setActiveAddressField,
    suggestionsError,
    suggestionsLoading,
    toSuggestions,
  } = useRouteAddressSuggestions({
    from,
    fromContext: fromSearchContext,
    to,
    toContext: toSearchContext,
  });
  const eligiblePreferenceDiscounts = eligibleDiscountIds(preferences);
  const approvedPolicyBrands = preferences.fuelPolicyEnabled
    ? preferences.approvedPolicyBrands
    : [];

  const loadRoute = async ({
    collapseOnSuccess = true,
    overrideFromLabel,
    overrideFromPoint,
    overrideToLabel,
    overrideToPoint,
  }: LoadRouteOptions = {}) => {
    const fromLabel = (overrideFromLabel || from).trim();
    const toLabel = (overrideToLabel || to).trim();
    if (!overrideFromPoint && !fromPoint && !fromLabel) {
      setError("Add a start location before planning this route.");
      setRouteControlsCollapsed(false);
      return;
    }
    if (!overrideToPoint && !toPoint && !toLabel) {
      setError("Add a destination before planning this route.");
      setRouteControlsCollapsed(false);
      return;
    }
    const precisionHint =
      selectedRoutePointPrecisionHint("start", overrideFromPoint || fromPoint) ||
      selectedRoutePointPrecisionHint("destination", overrideToPoint || toPoint) ||
      (!overrideFromPoint && !fromPoint ? routeInputPrecisionHint("start", fromLabel) : "") ||
      (!overrideToPoint && !toPoint ? routeInputPrecisionHint("destination", toLabel) : "");
    if (precisionHint) {
      setError(precisionHint);
      setRouteControlsCollapsed(false);
      return;
    }

    const requestId = routeRequestIdRef.current + 1;
    const editVersionAtStart = routeEditVersionRef.current;
    routeRequestIdRef.current = requestId;
    setRouteStarted(true);
    setLoading(true);
    setError("");
    clearAddressSuggestionError();
    setActiveAddressField(null);
    try {
      const resolvedFromPoint =
        overrideFromPoint ||
        fromPoint ||
        (await geocodeAddress(from, getAddressSessionToken("from"), fromSearchContext));
      const resolvedToPoint =
        overrideToPoint ||
        toPoint ||
        (await geocodeAddress(to, getAddressSessionToken("to"), {
          near: resolvedFromPoint,
          nearRadiusKm: 80,
        }));
      const route = await getRoute(resolvedFromPoint, resolvedToPoint);
      const score = await scoreRoute({
        approvedPolicyBrands,
        fuel: preferences.fuel,
        eligibleDiscounts: eligiblePreferenceDiscounts,
        maxDetourMinutes: preferences.maxDetourMinutes,
        minSavingDollars: preferences.minSavingDollars,
        route,
      });
      if (
        requestId !== routeRequestIdRef.current ||
        editVersionAtStart !== routeEditVersionRef.current
      ) {
        return;
      }
      setFromPoint(resolvedFromPoint);
      setToPoint(resolvedToPoint);
      setFrom(displayLocationLabel(resolvedFromPoint, fromLabel));
      setTo(displayLocationLabel(resolvedToPoint, toLabel));
      setRouteEndpoints({ from: resolvedFromPoint, to: resolvedToPoint });
      setRoutePoints(route.points);
      setResult(score);
      setSelectedCode(score.recommendations[0]?.station.stationCode);
      onAddRecentLocation?.(resolvedFromPoint);
      onAddRecentLocation?.(resolvedToPoint);
      setStationPanelOpen(false);
      setRouteSheetMinimised(false);
      setRouteControlsCollapsed(collapseOnSuccess);
      resetAddressSessionToken("from");
      resetAddressSessionToken("to");
    } catch (err) {
      if (
        requestId !== routeRequestIdRef.current ||
        editVersionAtStart !== routeEditVersionRef.current
      ) {
        return;
      }
      setRouteEndpoints(undefined);
      setRoutePoints([]);
      setResult(null);
      setRouteControlsCollapsed(false);
      setStationPanelOpen(false);
      setRouteSheetMinimised(false);
      setError(err instanceof Error ? err.message : "Could not plan route");
    } finally {
      if (requestId === routeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const markRouteEdited = () => {
    routeEditVersionRef.current += 1;
    setRouteStarted(false);
    setRouteEndpoints(undefined);
    setRoutePoints([]);
    setResult(null);
    setSelectedCode(undefined);
    setError("");
  };

  const reopenRouteEditor = () => {
    setRouteControlsCollapsed(false);
    setStationPanelOpen(false);
    setRouteSheetMinimised(false);
  };

  const handleFromChange = (value: string) => {
    markRouteEdited();
    setFrom(value);
    setFromPoint(undefined);
    reopenRouteEditor();
  };

  const handleToChange = (value: string) => {
    markRouteEdited();
    setTo(value);
    setToPoint(undefined);
    reopenRouteEditor();
  };

  const selectAddressSuggestion = (field: "from" | "to", point: MapPoint) => {
    markRouteEdited();
    const label = displayLocationLabel(point, field === "from" ? from : to);
    if (field === "from") {
      setFrom(label);
      setFromPoint(point);
    } else {
      setTo(label);
      setToPoint(point);
    }
    clearAddressSuggestions(field);
    setActiveAddressField(null);
    clearAddressSuggestionError();
    reopenRouteEditor();
    resetAddressSessionToken(field);
  };

  const useCurrentFromLocation = async () => {
    setLocatingFrom(true);
    setError("");
    try {
      const nextFromPoint = await getCurrentMapPoint();
      markRouteEdited();
      setFromPoint(nextFromPoint);
      setFrom(nextFromPoint.label);
      reopenRouteEditor();
      setActiveAddressField(null);
      resetAddressSessionToken("from");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Current location is not available.");
    } finally {
      setLocatingFrom(false);
    }
  };

  const applySavedCommute = (commute: SavedCommute) => {
    markRouteEdited();
    const fromLabel = displayLocationLabel(commute.from, commute.from.label);
    const toLabel = displayLocationLabel(commute.to, commute.to.label);
    setFrom(fromLabel);
    setTo(toLabel);
    setFromPoint(commute.from);
    setToPoint(commute.to);
    setActiveAddressField(null);
    clearAddressSuggestions("from");
    clearAddressSuggestions("to");
    clearAddressSuggestionError();
    reopenRouteEditor();
    loadRoute({
      overrideFromLabel: fromLabel,
      overrideFromPoint: commute.from,
      overrideToLabel: toLabel,
      overrideToPoint: commute.to,
    });
  };

  const applyQuickPlace = (field: "from" | "to", point: MapPoint) => {
    markRouteEdited();
    const label = displayLocationLabel(point, point.label);
    if (field === "from") {
      setFrom(label);
      setFromPoint(point);
    } else {
      setTo(label);
      setToPoint(point);
    }
    clearAddressSuggestions(field);
    setActiveAddressField(null);
    clearAddressSuggestionError();
    reopenRouteEditor();
    resetAddressSessionToken(field);
  };

  useEffect(() => {
    if (!routeEndpoints) return;
    loadRoute({ collapseOnSuccess: routeControlsCollapsed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    eligiblePreferenceDiscounts.join("|"),
    approvedPolicyBrands.join("|"),
    preferences.fuelPolicyEnabled,
    preferences.fuel,
    preferences.maxDetourMinutes,
    preferences.minSavingDollars,
  ]);

  const routeRecommendations = useMemo(
    () => (result?.recommendations || []).map(routeCandidateToStation),
    [result],
  );
  const candidates = useMemo(() => routeRecommendations.slice(0, 10), [routeRecommendations]);
  const contextStations = useMemo(
    () =>
      (result?.contextStations || [])
        .map((station) => routeContextStationToView(station, preferences))
        .filter((item): item is StationViewModel => Boolean(item)),
    [preferences, result],
  );
  const mapStations = useMemo(
    () => uniqueStations([...routeRecommendations, ...contextStations]),
    [contextStations, routeRecommendations],
  );
  const best = candidates[0];
  const selected = mapStations.find((item) => item.station.stationCode === selectedCode) || best;
  const backendDecisionSummary = result?.context.decisionSummary;
  const decisionAlternatives = useMemo(
    () => routeDecisionAlternatives(candidates, backendDecisionSummary),
    [backendDecisionSummary, candidates],
  );
  const cheapestExplanation = useMemo(
    () => backendDecisionSummary?.whyNotCheapest || cheapestTradeOffExplanation(candidates),
    [backendDecisionSummary?.whyNotCheapest, candidates],
  );
  const routePrecisionHint =
    selectedRoutePointPrecisionHint("start", fromPoint) ||
    selectedRoutePointPrecisionHint("destination", toPoint) ||
    (!fromPoint && from.trim() ? routeInputPrecisionHint("start", from) : "") ||
    (!toPoint && to.trim() ? routeInputPrecisionHint("destination", to) : "");
  const canPlanRoute = Boolean((fromPoint || from.trim()) && (toPoint || to.trim()) && !routePrecisionHint);
  const showPlanningShortcuts = routeStarted;
  const quickPlaces = useMemo(
    () =>
      [
        preferences.homeLocation
          ? { key: "home", kind: "home", label: "Home", point: preferences.homeLocation }
          : null,
        preferences.workLocation
          ? { key: "work", kind: "work", label: "Work", point: preferences.workLocation }
          : null,
        ...recentLocations.slice(0, 4).map((point, index) => ({
          key: `recent-${index}-${point.lat}-${point.lon}`,
          kind: "recent",
          label: shortPointName(point),
          point,
        })),
      ].filter((item): item is QuickPlace => Boolean(item)),
    [preferences.homeLocation, preferences.workLocation, recentLocations],
  );
  const recommendationCopy = best
    ? routeRecommendationCopy(best, result?.context.timingAdvice)
    : null;
  const routeNotice = result ? routeContextNotice(result.context) : "";
  const policyNotice = preferences.fuelPolicyEnabled
    ? `Policy mode active: ${preferences.approvedPolicyBrands.join(", ")} only.`
    : "";
  const currentRouteSaved = Boolean(
    routeEndpoints &&
      savedCommutes.some((commute) =>
        sameSavedCommuteRoute(commute, routeEndpoints, preferences.fuel),
      ),
  );
  const routeCameraInsets = useMemo(
    () =>
      resolveRouteCameraInsets({
        routeControlsCollapsed,
        routeSheetMinimised,
        stationPanelOpen,
      }),
    [routeControlsCollapsed, routeSheetMinimised, stationPanelOpen],
  );
  const routeSummary = `${from} to ${to}`;
  const handleStationSelect = (stationCode: string) => {
    setSelectedCode(stationCode);
    setStationPanelOpen(true);
    setRouteSheetMinimised(false);
  };

  const handleSaveCurrentCommute = () => {
    if (!routeEndpoints) return;
    onSaveCommute({
      from: routeEndpoints.from,
      fuel: preferences.fuel,
      name: commuteName(routeEndpoints.from, routeEndpoints.to),
      to: routeEndpoints.to,
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.mapLayer}>
        <StationMap
          centre={routeEndpoints?.from || fromPoint || defaultPlanCentre}
          stations={mapStations}
          selectedStationCode={selectedCode}
          onSelect={handleStationSelect}
          routeEndpoints={routeEndpoints}
          routePoints={routePoints}
          cameraInsets={routeCameraInsets}
          showCentreMarker={Boolean(fromPoint)}
        />
      </View>

      <View style={[styles.topControls, !routeStarted && styles.topControlsOnly]}>
        {routeControlsCollapsed && routeEndpoints && !error ? (
          <Pressable
            accessibilityLabel="Edit planned route"
            accessibilityRole="button"
            onPress={() => setRouteControlsCollapsed(false)}
            style={styles.routeSummaryCard}
          >
            <View style={styles.routeSummaryMain}>
              <Text style={styles.eyebrow}>Plan trip</Text>
              <Text numberOfLines={1} style={styles.routeSummaryTitle}>
                {routeSummary}
              </Text>
              <Text numberOfLines={1} style={styles.routeSummaryMeta}>
                {preferences.vehicleName || preferences.vehicleRego || "Vehicle"} | {preferences.fuel}
                {preferences.fuelPolicyEnabled ? " | Policy" : ""}
              </Text>
            </View>
            <Text style={styles.editChip}>Edit</Text>
          </Pressable>
        ) : (
          <PlanRouteEditorCard
            activeAddressField={activeAddressField}
            canPlanRoute={canPlanRoute}
            fuel={preferences.fuel}
            from={from}
            fromSuggestions={fromSuggestions}
            loading={loading}
            locatingFrom={locatingFrom}
            onClearRecentLocations={onClearRecentLocations}
            onFromChange={handleFromChange}
            onFromFocus={() => setActiveAddressField("from")}
            onFuelChange={onFuelChange}
            onPlanRoute={() => loadRoute()}
            onRemoveRecentLocation={onRemoveRecentLocation}
            onSelectAddressSuggestion={selectAddressSuggestion}
            onSelectQuickPlace={applyQuickPlace}
            onSelectSavedCommute={applySavedCommute}
            onToChange={handleToChange}
            onToFocus={() => setActiveAddressField("to")}
            onUseCurrentFromLocation={useCurrentFromLocation}
            quickPlaces={quickPlaces}
            recentLocationsCount={recentLocations.length}
            routePrecisionHint={routePrecisionHint}
            routeError={!routeStarted ? error : ""}
            savedCommutes={savedCommutes}
            showPlanningShortcuts={showPlanningShortcuts}
            suggestionsError={suggestionsError}
            suggestionsLoading={suggestionsLoading}
            to={to}
            toSuggestions={toSuggestions}
          />
        )}
      </View>

      {routeStarted ? (
        <PlanRouteSheet
          best={best}
          candidates={candidates}
          cheapestExplanation={cheapestExplanation}
          currentRouteSaved={currentRouteSaved}
          decisionAlternatives={decisionAlternatives}
          decisionSummary={backendDecisionSummary}
          error={error}
          loading={loading}
          onMinimise={() => setRouteSheetMinimised(true)}
          onRestore={() => setRouteSheetMinimised(false)}
          onSaveCommute={handleSaveCurrentCommute}
          onSelectStation={handleStationSelect}
          onShowStops={() => setStationPanelOpen(false)}
          policyActive={preferences.fuelPolicyEnabled}
          policyNotice={policyNotice}
          recommendationCopy={recommendationCopy}
          routeEndpointsPresent={Boolean(routeEndpoints)}
          routeNotice={routeNotice}
          routeSheetMinimised={routeSheetMinimised}
          routeSummary={routeSummary}
          selected={selected}
          selectedCode={selectedCode}
          stationPanelOpen={stationPanelOpen}
          statusCapability={result?.context.capability}
        />
      ) : null}
    </View>
  );
}

function routeCandidateToStation(candidate: ScoreCandidate, index: number): StationViewModel {
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

function routeContextStationToView(
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

function uniqueStations(stations: StationViewModel[]) {
  const seen = new Set<string>();
  return stations.filter((item) => {
    const code = item.station.stationCode;
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function routeRecommendationCopy(
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
      title: "Best value stop",
      reason: routeValueReason(best),
    };
  }
  return {
    title: "Not worth detour",
    reason: `Best value is ${best.station.name}, but the detour is unlikely to save money.`,
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
  if (action === "fill_today_on_route") return "Fill today on this route";
  if (action === "fill_today_with_detour") return "Fill today, but check the detour";
  if (action === "wait_if_can") return "Wait if you can";
  if (action === "range_first") return "Range-first";
  if (action === "skip_detour") return "Skip this detour";
  return "";
}

function routeValueReason(best: StationViewModel) {
  const saving = Number(best.netSaving || 0);
  const detourMinutes = Number(best.detourMinutes || 0);
  if (detourMinutes > 0.05) {
    return `${best.station.name} saves about ${formatMoney(saving)} after ${detourMinutes.toFixed(1)} min detour.`;
  }
  return `${best.station.name} saves about ${formatMoney(saving)} on this route.`;
}
function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function routeContextNotice(context: ScoreResponse["context"]) {
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

function selectedRoutePointPrecisionHint(kind: "destination" | "start", point?: MapPoint) {
  if (!point) return "";
  const needsRefinement =
    point.refineRequired ||
    point.type === "building" ||
    point.suggestionType === "base_address";
  if (!needsRefinement) return "";
  if (kind === "start") return "Choose or type the exact start unit before planning.";
  return "Choose or type the exact destination unit before planning.";
}

function displayLocationLabel(point: MapPoint, fallback: string) {
  const label = point.label || fallback;
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 3).join(", ") || fallback;
}

function commuteName(from: MapPoint, to: MapPoint) {
  return `${shortPointName(from)} to ${shortPointName(to)}`;
}

function shortPointName(point: MapPoint) {
  return point.label.split(",")[0]?.trim() || point.label;
}

function sameSavedCommuteRoute(
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
  },
  mapLayer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  topControls: {
    left: spacing.md,
    position: "absolute",
    right: spacing.md,
    top: spacing.sm,
    zIndex: 5,
  },
  topControlsOnly: {
    top: spacing.lg,
  },
  routeSummaryCard: {
    ...shadow.float,
    ...surfaces.floating,
    alignItems: "center",
    borderRadius: radii.xxl,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 66,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  routeSummaryMain: {
    flex: 1,
    minWidth: 0,
  },
  routeSummaryTitle: {
    ...typography.bodyStrong,
    marginTop: 2,
  },
  routeSummaryMeta: {
    ...typography.bodyMuted,
    marginTop: 2,
  },
  editChip: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  eyebrow: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
});
