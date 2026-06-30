import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { geocodeAddress, getRoute, getRouteEvFallbackChargers, planFuelRoute } from "../api/fuelPathApi";
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
  EvCharger,
  FuelCode,
  MapPoint,
  SavedCommute,
  ScoreResponse,
  StationViewModel,
} from "../types";
import { eligibleDiscountIds } from "../utils/discountRedemptions";
import { routeCameraInsets as resolveRouteCameraInsets } from "../utils/routeCameraInsets";
import {
  commuteName,
  displayLocationLabel,
  routeCandidateToStation,
  routeContextNotice,
  routeContextStationToView,
  routeRecommendationCopy,
  sameSavedCommuteRoute,
  shortPointName,
  uniqueStations,
  vehiclePlanNotice,
  vehiclePlanSummary,
  vehicleRouteCapacityNotice,
  vehicleRouteRangeNotice,
} from "./PlanScreen.utils";

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
  lat: -31.9523123,
  lon: 115.861309,
  label: "Perth CBD WA 6000",
};

const emptyRoute = { endpoints: undefined, points: [], distanceKm: null } as { endpoints?: { from: MapPoint; to: MapPoint }; points: MapPoint[]; distanceKm: number | null };
const emptyEvFallback = { chargers: [], loading: false, error: "" } as { chargers: EvCharger[]; loading: boolean; error: string };
const evRoutePlanningUnavailable =
  "EV route charging is not available yet. Use Nearby EV charging for compatible chargers while route charger planning is added.";

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
  const [routeData, setRouteData] = useState(emptyRoute);
  const [evFallback, setEvFallback] = useState(emptyEvFallback);
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
  const routePlanningBlocked = false;
  const vehicleSummary = vehiclePlanSummary(preferences);
  const vehicleRouteNotice = vehiclePlanNotice(preferences.vehicleEnergyType);

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
    setEvFallback(emptyEvFallback);
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
      if (preferences.vehicleEnergyType === "electric") {
        const route = await getRoute(resolvedFromPoint, resolvedToPoint);
        let fallbackChargers: EvCharger[] = [];
        let fallbackError = "";
        setEvFallback((current) => ({ ...current, loading: true, error: "" }));
        try {
          const fallbackResponse = await getRouteEvFallbackChargers({
            connectors: preferences.evConnectors,
            route,
          });
          fallbackChargers = fallbackResponse.chargers;
        } catch (fallbackErr) {
          fallbackError = fallbackErr instanceof Error
            ? fallbackErr.message
            : "Could not load EV fallback chargers.";
        } finally {
          setEvFallback((current) => ({ ...current, loading: false }));
        }
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
        setRouteData({ endpoints: { from: resolvedFromPoint, to: resolvedToPoint }, points: route.points, distanceKm: route.distanceKm });
        setEvFallback({ chargers: fallbackChargers, loading: false, error: fallbackError });
        setResult(null);
        setSelectedCode(undefined);
        onAddRecentLocation?.(resolvedFromPoint);
        onAddRecentLocation?.(resolvedToPoint);
        setStationPanelOpen(false);
        setRouteSheetMinimised(false);
        setRouteControlsCollapsed(collapseOnSuccess);
        resetAddressSessionToken("from");
        resetAddressSessionToken("to");
        return;
      }
      const planned = await planFuelRoute({
        approvedPolicyBrands,
        fuel: preferences.fuel,
        eligibleDiscounts: eligiblePreferenceDiscounts,
        from: resolvedFromPoint,
        to: resolvedToPoint,
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
      setRouteData({ endpoints: { from: resolvedFromPoint, to: resolvedToPoint }, points: planned.route.points, distanceKm: planned.route.distanceKm });
      setEvFallback(emptyEvFallback);
      setResult(planned.score);
      setSelectedCode(planned.score.recommendations[0]?.station.stationCode);
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
      setRouteData(emptyRoute);
      setEvFallback(emptyEvFallback);
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
    setRouteData(emptyRoute);
    setEvFallback(emptyEvFallback);
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
    if (!routeData.endpoints) return;
    if (routePlanningBlocked) {
      setResult(null);
      setRouteData((current) => ({ ...current, points: [] }));
      setSelectedCode(undefined);
      setStationPanelOpen(false);
      setRouteSheetMinimised(false);
      setRouteControlsCollapsed(false);
      setError(evRoutePlanningUnavailable);
      return;
    }
    loadRoute({ collapseOnSuccess: routeControlsCollapsed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    eligiblePreferenceDiscounts.join("|"),
    approvedPolicyBrands.join("|"),
    preferences.fuelPolicyEnabled,
    preferences.fuel,
    preferences.evConnectors.join("|"),
    preferences.evRangeKm,
    preferences.vehicleEnergyType,
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
  const routePrecisionHint =
    (!fromPoint && from.trim() ? routeInputPrecisionHint("start", from) : "") ||
    (!toPoint && to.trim() ? routeInputPrecisionHint("destination", to) : "");
  const canPlanRoute = Boolean(
    (fromPoint || from.trim()) &&
      (toPoint || to.trim()) &&
      !routePrecisionHint,
  );
  const showPlanningShortcuts = routeStarted;
  const quickPlaces = [
    preferences.homeLocation ? { key: "home", kind: "home", label: "Home", point: preferences.homeLocation } : null,
    preferences.workLocation ? { key: "work", kind: "work", label: "Work", point: preferences.workLocation } : null,
    ...recentLocations.slice(0, 4).map((point, index) => ({
      key: `recent-${index}-${point.lat}-${point.lon}`,
      kind: "recent",
      label: shortPointName(point),
      point,
    })),
  ].filter((item): item is QuickPlace => Boolean(item));
  const recommendationCopy = best
    ? routeRecommendationCopy(best, result?.context.timingAdvice)
    : null;
  const routeNotice = result
    ? [routeContextNotice(result.context), vehicleRouteCapacityNotice(preferences, routeData.distanceKm)]
        .filter(Boolean)
        .join(" ")
    : vehicleRouteRangeNotice(preferences, routeData.distanceKm);
  const policyNotice = preferences.fuelPolicyEnabled
    ? `Policy mode active: ${preferences.approvedPolicyBrands.join(", ")} only.`
    : "";
  const currentRouteEndpoints = routeData.endpoints;
  const currentRouteSaved = Boolean(
    currentRouteEndpoints &&
      savedCommutes.some((commute) =>
        sameSavedCommuteRoute(commute, currentRouteEndpoints, preferences.fuel),
      ),
  );
  const routeCameraInsets = resolveRouteCameraInsets({
    routeControlsCollapsed,
    routeSheetMinimised,
    stationPanelOpen,
  });
  const routeSummary = `${from} to ${to}`;
  const handleStationSelect = (stationCode: string) => {
    setSelectedCode(stationCode);
    setStationPanelOpen(true);
    setRouteSheetMinimised(false);
  };

  const handleSaveCurrentCommute = () => {
    if (!routeData.endpoints) return;
    onSaveCommute({
      from: routeData.endpoints.from,
      fuel: preferences.fuel,
      name: commuteName(routeData.endpoints.from, routeData.endpoints.to),
      to: routeData.endpoints.to,
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.mapLayer}>
        <StationMap
          centre={routeData.endpoints?.from || fromPoint || defaultPlanCentre}
          stations={mapStations}
          selectedStationCode={selectedCode}
          onSelect={handleStationSelect}
          routeEndpoints={routeData.endpoints}
          routePoints={routeData.points}
          cameraInsets={routeCameraInsets}
          chargers={preferences.vehicleEnergyType === "electric" ? evFallback.chargers : []}
          selectedChargerId={preferences.vehicleEnergyType === "electric" ? evFallback.chargers[0]?.id : undefined}
          showCentreMarker={Boolean(fromPoint)}
        />
      </View>

      <View style={[styles.topControls, !routeStarted && styles.topControlsOnly]}>
        {routeControlsCollapsed && routeData.endpoints && !error ? (
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
                {vehicleSummary}
                {preferences.fuelPolicyEnabled ? " | Policy" : ""}
              </Text>
            </View>
            <Text style={styles.editChip}>Edit</Text>
          </Pressable>
        ) : (
          <PlanRouteEditorCard
            activeAddressField={activeAddressField}
            canPlanRoute={canPlanRoute}
            evConnectors={preferences.evConnectors}
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
            routePlanningBlocked={routePlanningBlocked}
            savedCommutes={savedCommutes}
            showPlanningShortcuts={showPlanningShortcuts}
            suggestionsError={suggestionsError}
            suggestionsLoading={suggestionsLoading}
            to={to}
            toSuggestions={toSuggestions}
            vehicleEnergyType={preferences.vehicleEnergyType}
            vehicleRouteNotice={vehicleRouteNotice}
            vehicleSummary={vehicleSummary}
          />
        )}
      </View>

      {routeStarted ? (
        <PlanRouteSheet
          best={best}
          candidates={candidates}
          currentRouteSaved={currentRouteSaved}
          decisionSummary={backendDecisionSummary}
          emptyRouteTitle={preferences.vehicleEnergyType === "electric" ? "Route range check" : undefined}
          evFallbackChargers={evFallback.chargers}
          evFallbackError={evFallback.error}
          evFallbackLoading={evFallback.loading}
          error={error}
          loading={loading}
          loadingLabel={preferences.vehicleEnergyType === "electric" ? "Checking route range..." : undefined}
          onMinimise={() => setRouteSheetMinimised(true)}
          onRestore={() => setRouteSheetMinimised(false)}
          onSaveCommute={handleSaveCurrentCommute}
          onSelectStation={handleStationSelect}
          onShowStops={() => setStationPanelOpen(false)}
          policyActive={preferences.fuelPolicyEnabled}
          policyNotice={policyNotice}
          recommendationCopy={recommendationCopy}
          routeEndpointsPresent={Boolean(routeData.endpoints)}
          routeNotice={routeNotice}
          routeSheetMinimised={routeSheetMinimised}
          routeSummary={routeSummary}
          selected={selected}
          selectedCode={selectedCode}
          showStopsList={false}
          stationPanelOpen={stationPanelOpen}
          stopsTitle="Route options"
          statusCapability={result?.context.capability}
        />
      ) : null}
    </View>
  );
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
