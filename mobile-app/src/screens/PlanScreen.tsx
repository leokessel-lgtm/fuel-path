import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { geocodeAddress, getRoute, scoreRoute, searchLocations } from "../api/fuelPathApi";
import { FuelSelector } from "../components/FuelSelector";
import { StationMap } from "../components/StationMap";
import { StationRow } from "../components/StationRow";
import { getCurrentMapPoint } from "../services/currentLocation";
import { colors, radii, shadow, spacing, typeScale } from "../theme";
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
import { stationTimestampLine } from "../utils/decisionEvidence";
import { stationPriceView, tomorrowPriceView } from "../utils/pricing";

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

export function PlanScreen({
  preferences,
  onFuelChange,
  onSaveCommute,
  savedCommutes,
}: PlanScreenProps) {
  const [from, setFrom] = useState("Canberra ACT");
  const [to, setTo] = useState("Sydney CBD NSW");
  const [fromPoint, setFromPoint] = useState<MapPoint>();
  const [toPoint, setToPoint] = useState<MapPoint>();
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [routeEndpoints, setRouteEndpoints] = useState<{ from: MapPoint; to: MapPoint }>();
  const [routePoints, setRoutePoints] = useState<MapPoint[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>();
  const [activeAddressField, setActiveAddressField] = useState<"from" | "to" | null>(null);
  const [fromSuggestions, setFromSuggestions] = useState<MapPoint[]>([]);
  const [toSuggestions, setToSuggestions] = useState<MapPoint[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState<"from" | "to" | null>(null);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locatingFrom, setLocatingFrom] = useState(false);
  const [routeControlsCollapsed, setRouteControlsCollapsed] = useState(false);
  const [stationPanelOpen, setStationPanelOpen] = useState(false);
  const [error, setError] = useState("");
  const routeEditVersionRef = useRef(0);
  const routeRequestIdRef = useRef(0);
  const addressSessionTokensRef = useRef({
    from: makeLocationSessionToken(),
    to: makeLocationSessionToken(),
  });

  const loadRoute = async ({
    collapseOnSuccess = true,
    overrideFromLabel,
    overrideFromPoint,
    overrideToLabel,
    overrideToPoint,
  }: LoadRouteOptions = {}) => {
    const requestId = routeRequestIdRef.current + 1;
    const editVersionAtStart = routeEditVersionRef.current;
    routeRequestIdRef.current = requestId;
    setLoading(true);
    setError("");
    setSuggestionsError("");
    setActiveAddressField(null);
    try {
      const resolvedFromPoint =
        overrideFromPoint ||
        fromPoint ||
        (await geocodeAddress(from, addressSessionTokensRef.current.from));
      const resolvedToPoint =
        overrideToPoint ||
        toPoint ||
        (await geocodeAddress(to, addressSessionTokensRef.current.to));
      const fromLabel = overrideFromLabel || from;
      const toLabel = overrideToLabel || to;
      const route = await getRoute(resolvedFromPoint, resolvedToPoint);
      const score = await scoreRoute({
        fuel: preferences.fuel,
        route,
        eligibleDiscounts: preferences.selectedDiscounts,
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
      setStationPanelOpen(false);
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
      setError(err instanceof Error ? err.message : "Could not plan route");
    } finally {
      if (requestId === routeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const markRouteEdited = () => {
    routeEditVersionRef.current += 1;
  };

  const resetAddressSessionToken = (field: "from" | "to") => {
    addressSessionTokensRef.current[field] = makeLocationSessionToken();
  };

  const handleFromChange = (value: string) => {
    markRouteEdited();
    setFrom(value);
    setFromPoint(undefined);
    setRouteControlsCollapsed(false);
    setStationPanelOpen(false);
  };

  const handleToChange = (value: string) => {
    markRouteEdited();
    setTo(value);
    setToPoint(undefined);
    setRouteControlsCollapsed(false);
    setStationPanelOpen(false);
  };

  const selectAddressSuggestion = (field: "from" | "to", point: MapPoint) => {
    markRouteEdited();
    const label = displayLocationLabel(point, field === "from" ? from : to);
    if (field === "from") {
      setFrom(label);
      setFromPoint(point);
      setFromSuggestions([]);
    } else {
      setTo(label);
      setToPoint(point);
      setToSuggestions([]);
    }
    setActiveAddressField(null);
    setSuggestionsError("");
    setRouteControlsCollapsed(false);
    setStationPanelOpen(false);
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
      setRouteControlsCollapsed(false);
      setStationPanelOpen(false);
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
    setFromSuggestions([]);
    setToSuggestions([]);
    setSuggestionsError("");
    setRouteControlsCollapsed(false);
    setStationPanelOpen(false);
    loadRoute({
      overrideFromLabel: fromLabel,
      overrideFromPoint: commute.from,
      overrideToLabel: toLabel,
      overrideToPoint: commute.to,
    });
  };

  useEffect(() => {
    loadRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.fuel, preferences.selectedDiscounts.join("|")]);

  useEffect(() => {
    const field = activeAddressField;
    if (!field) return;

    const query = (field === "from" ? from : to).trim();
    if (query.length < 3) {
      if (field === "from") setFromSuggestions([]);
      if (field === "to") setToSuggestions([]);
      setSuggestionsLoading(null);
      setSuggestionsError("");
      return;
    }

    let active = true;
    setSuggestionsLoading(field);
    setSuggestionsError("");
    const timer = setTimeout(() => {
      searchLocations(query, 5, addressSessionTokensRef.current[field])
        .then((suggestions) => {
          if (!active) return;
          if (field === "from") setFromSuggestions(suggestions);
          if (field === "to") setToSuggestions(suggestions);
        })
        .catch((err: Error) => {
          if (!active) return;
          if (field === "from") setFromSuggestions([]);
          if (field === "to") setToSuggestions([]);
          setSuggestionsError(err.message);
        })
        .finally(() => {
          if (active) setSuggestionsLoading(null);
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [activeAddressField, from, to]);

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
  const bestTomorrow = best ? tomorrowPriceView(best) : null;
  const selectedTomorrow = selected ? tomorrowPriceView(selected) : null;
  const recommendationCopy = best
    ? routeRecommendationCopy(best, result?.context.timingAdvice)
    : null;
  const routeNotice = result ? routeContextNotice(result.context) : "";
  const currentRouteSaved = Boolean(
    routeEndpoints &&
      savedCommutes.some((commute) =>
        sameSavedCommuteRoute(commute, routeEndpoints, preferences.fuel),
      ),
  );
  const routeCameraInsets = useMemo(
    () => ({
      top: routeControlsCollapsed ? 86 : 230,
      right: 18,
      bottom: stationPanelOpen ? 260 : 255,
      left: 18,
    }),
    [routeControlsCollapsed, stationPanelOpen],
  );
  const routeSummary = `${from} to ${to}`;

  const handleStationSelect = (stationCode: string) => {
    setSelectedCode(stationCode);
    setStationPanelOpen(true);
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
          centre={routeEndpoints?.from || { lat: -35.2809, lon: 149.13, label: "Start" }}
          stations={mapStations}
          selectedStationCode={selectedCode}
          onSelect={handleStationSelect}
          routeEndpoints={routeEndpoints}
          routePoints={routePoints}
          cameraInsets={routeCameraInsets}
        />
      </View>

      <View style={styles.topControls}>
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
              </Text>
            </View>
            <Text style={styles.editChip}>Edit</Text>
          </Pressable>
        ) : (
          <View style={styles.searchCard}>
          <Text style={styles.eyebrow}>Plan trip</Text>
          {savedCommutes.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.savedCommuteRow}
            >
              {savedCommutes.map((commute) => (
                <Pressable
                  accessibilityLabel={`Use saved commute ${commute.name}`}
                  accessibilityRole="button"
                  key={commute.id}
                  onPress={() => applySavedCommute(commute)}
                  style={({ pressed }) => [
                    styles.savedCommuteChip,
                    pressed && styles.savedCommuteChipPressed,
                  ]}
                >
                  <Text numberOfLines={1} style={styles.savedCommuteName}>
                    {commute.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.savedCommuteMeta}>
                    {commute.fuel} | {commute.alertEnabled ? "Alerts on" : "No alerts"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.inputRow}>
            <View style={styles.inputShell}>
              <TextInput
                accessibilityLabel="From"
                value={from}
                onChangeText={handleFromChange}
                onFocus={() => setActiveAddressField("from")}
                onSubmitEditing={() => loadRoute()}
                placeholder="Start address, suburb or place"
                returnKeyType="search"
                style={[styles.input, styles.inputWithIcon]}
              />
              <Pressable
                accessibilityLabel="Use current location as start"
                disabled={locatingFrom}
                hitSlop={8}
                onPress={useCurrentFromLocation}
                style={({ pressed }) => [
                  styles.currentLocationButton,
                  pressed && styles.currentLocationButtonPressed,
                  locatingFrom && styles.currentLocationButtonDisabled,
                ]}
              >
                <View style={styles.currentLocationIcon}>
                  <View style={styles.currentLocationLineVertical} />
                  <View style={styles.currentLocationLineHorizontal} />
                  <View style={styles.currentLocationDot} />
                </View>
              </Pressable>
            </View>
            {activeAddressField === "from" ? (
              <AddressSuggestions
                error={suggestionsError}
                loading={suggestionsLoading === "from"}
                onSelect={(point) => selectAddressSuggestion("from", point)}
                suggestions={fromSuggestions}
              />
            ) : null}
            <TextInput
              accessibilityLabel="To"
              value={to}
              onChangeText={handleToChange}
              onFocus={() => setActiveAddressField("to")}
              onSubmitEditing={() => loadRoute()}
              placeholder="Destination address, suburb or place"
              returnKeyType="search"
              style={styles.input}
            />
            {activeAddressField === "to" ? (
              <AddressSuggestions
                error={suggestionsError}
                loading={suggestionsLoading === "to"}
                onSelect={(point) => selectAddressSuggestion("to", point)}
                suggestions={toSuggestions}
              />
            ) : null}
          </View>
          <FuelSelector value={preferences.fuel} onChange={onFuelChange} />
          <Pressable
            accessibilityLabel="Plan route"
            accessibilityRole="button"
            onPress={() => loadRoute()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Plan route</Text>
          </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.sheet, stationPanelOpen ? styles.stationSheet : styles.resultsSheet]}>
        <View style={styles.grabber} />
        {stationPanelOpen && selected ? (
          <View style={styles.stationDetailPanel}>
            <View style={styles.sheetHeaderRow}>
              <View>
                <Text style={styles.eyebrow}>Station detail</Text>
                <Text numberOfLines={1} style={styles.selectedTitle}>
                  {selected.station.name}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Show suggested fuel stops"
                accessibilityRole="button"
                onPress={() => setStationPanelOpen(false)}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Stops</Text>
              </Pressable>
            </View>
            <StationRow item={selected} selected onPress={() => {}} />
            <View style={styles.stationFacts}>
              <View style={styles.factPill}>
                <Text style={styles.factLabel}>Your price</Text>
                <Text style={styles.factValue}>{selected.adjustedCpl.toFixed(1)} c/L</Text>
              </View>
              <View style={styles.factPill}>
                <Text style={styles.factLabel}>Saving</Text>
                <Text style={styles.factValue}>{formatMoney(selected.netSaving || 0)}</Text>
              </View>
              <View style={styles.factPill}>
                <Text style={styles.factLabel}>Detour</Text>
                <Text style={styles.factValue}>{(selected.detourMinutes || 0).toFixed(1)} min</Text>
              </View>
              {selectedTomorrow ? (
                <View style={styles.factPill}>
                  <Text style={styles.factLabel}>Tomorrow</Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.factValue,
                      selectedTomorrow.direction === "down" && styles.tomorrowPriceDown,
                      selectedTomorrow.direction === "up" && styles.tomorrowPriceUp,
                    ]}
                  >
                    {selectedTomorrow.cpl.toFixed(1)} c/L
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.muted}>{stationTimestampLine(selected.station)}</Text>
          </View>
        ) : (
          <>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.green} />
                <Text style={styles.muted}>Scoring live route prices...</Text>
              </View>
            ) : null}
            {error ? (
              <>
                <Text style={styles.decisionTitle}>Route needs attention</Text>
              <Text style={styles.muted}>{error}</Text>
            </>
          ) : null}
          {!loading && !error && best ? (
            <>
              {routeNotice ? (
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeText}>{routeNotice}</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityLabel={`Open ${best.station.name} recommendation detail`}
                accessibilityRole="button"
                onPress={() => handleStationSelect(best.station.stationCode)}
                style={styles.compactRecommendation}
              >
                <View style={styles.recommendationCopy}>
                  <Text style={styles.eyebrow}>Recommendation</Text>
                  <Text numberOfLines={1} style={styles.compactDecisionTitle}>
                    {recommendationCopy?.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.compactReason}>
                    {recommendationCopy?.reason}
                  </Text>
                </View>
                <View style={styles.recommendationPrice}>
                  <Text style={styles.priceValue}>{best.adjustedCpl.toFixed(1)}</Text>
                  <Text style={styles.priceUnit}>c/L</Text>
                  {bestTomorrow ? (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.recommendationTomorrowPrice,
                        bestTomorrow.direction === "down" && styles.tomorrowPriceDown,
                        bestTomorrow.direction === "up" && styles.tomorrowPriceUp,
                      ]}
                    >
                      {bestTomorrow.shortLabel}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </>
          ) : null}
          {!loading && !error && !best ? (
            <View style={styles.emptyRouteState}>
              <Text style={styles.decisionTitle}>No fuel stops found</Text>
              <Text style={styles.muted}>
                {routeNotice ||
                  "Route found, but no eligible stations match this fuel, freshness and open-station settings."}
              </Text>
            </View>
          ) : null}

          <View style={styles.sheetHeaderRow}>
            <Text style={styles.selectedTitle}>Suggested fuel stops</Text>
            {routeEndpoints ? (
              <Pressable
                accessibilityLabel={currentRouteSaved ? "Route already saved" : "Save commute"}
                accessibilityRole="button"
                disabled={currentRouteSaved}
                onPress={handleSaveCurrentCommute}
                style={[
                  styles.textButton,
                  currentRouteSaved && styles.textButtonDisabled,
                ]}
              >
                <Text style={styles.textButtonLabel}>
                  {currentRouteSaved ? "Saved" : "Save"}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.muted}>Tap for detail</Text>
            )}
          </View>
          <ScrollView
            contentContainerStyle={styles.stopsListContent}
            showsVerticalScrollIndicator
            style={styles.stopsList}
          >
            {candidates.map((item) => (
              <StationRow
                item={item}
                key={item.station.stationCode}
                selected={item.station.stationCode === selectedCode}
                onPress={() => handleStationSelect(item.station.stationCode)}
              />
            ))}
          </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

function AddressSuggestions({
  error,
  loading,
  onSelect,
  suggestions,
}: {
  error: string;
  loading: boolean;
  onSelect: (point: MapPoint) => void;
  suggestions: MapPoint[];
}) {
  if (!loading && !error && !suggestions.length) return null;

  return (
    <View style={styles.suggestionPanel}>
      {loading ? <Text style={styles.suggestionStatus}>Searching locations...</Text> : null}
      {!loading && error ? <Text style={styles.suggestionError}>{error}</Text> : null}
      {!loading
        ? suggestions.map((point) => (
            <Pressable
              accessibilityLabel={`Use ${point.label}`}
              accessibilityRole="button"
              key={`${point.lat}:${point.lon}:${point.label}`}
              onPress={() => onSelect(point)}
              style={({ pressed }) => [
                styles.suggestionItem,
                pressed && styles.suggestionItemPressed,
              ]}
            >
              <Text numberOfLines={1} style={styles.suggestionTitle}>
                {suggestionTitle(point)}
              </Text>
              <Text numberOfLines={1} style={styles.suggestionMeta}>
                {suggestionMeta(point)}
              </Text>
            </Pressable>
          ))
        : null}
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
    distanceKm: Number(candidate.distanceToRouteKm || candidate.distanceKm || 0),
    fuel: candidate.fuel,
    netSaving: Number(candidate.netSaving || 0),
    detourMinutes: Number(candidate.detourMinutes || 0),
    rank: index + 1,
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
  return ["fill_today_on_route", "fill_today_with_detour", "wait_if_can"].includes(
    timingAdvice.action,
  );
}

function timingAdviceLabel(action: RouteTimingAdvice["action"]) {
  if (action === "fill_today_on_route") return "Fill today on this route";
  if (action === "fill_today_with_detour") return "Fill today, but check the detour";
  if (action === "wait_if_can") return "Wait if you can";
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

function makeLocationSessionToken() {
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

function suggestionTitle(point: MapPoint) {
  return point.label.split(",")[0]?.trim() || point.label;
}

function suggestionMeta(point: MapPoint) {
  const parts = point.label.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(1, 4).join(", ") || "Australia";
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
    top: spacing.md,
    zIndex: 5,
  },
  searchCard: {
    ...shadow.soft,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    gap: spacing.md,
    padding: spacing.md,
  },
  routeSummaryCard: {
    ...shadow.soft,
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.xl,
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
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
    marginTop: 2,
  },
  routeSummaryMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    marginTop: 2,
  },
  editChip: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  eyebrow: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  savedCommuteRow: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  savedCommuteChip: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: 156,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  savedCommuteChipPressed: {
    backgroundColor: colors.white,
  },
  savedCommuteName: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  savedCommuteMeta: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  inputRow: {
    gap: spacing.sm,
  },
  inputShell: {
    justifyContent: "center",
    position: "relative",
  },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "800",
    padding: spacing.md,
  },
  inputWithIcon: {
    paddingRight: 52,
  },
  suggestionPanel: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 1,
    overflow: "hidden",
  },
  suggestionItem: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionItemPressed: {
    backgroundColor: colors.greenSoft,
  },
  suggestionTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  suggestionMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    marginTop: 2,
  },
  suggestionStatus: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    padding: spacing.md,
  },
  suggestionError: {
    color: colors.red,
    fontSize: typeScale.caption,
    fontWeight: "800",
    padding: spacing.md,
  },
  currentLocationButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    bottom: 7,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: spacing.sm,
    top: 7,
    width: 34,
  },
  currentLocationButtonPressed: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  currentLocationButtonDisabled: {
    opacity: 0.55,
  },
  currentLocationIcon: {
    alignItems: "center",
    borderColor: colors.green,
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  currentLocationLineVertical: {
    backgroundColor: colors.green,
    height: 24,
    position: "absolute",
    width: 2,
  },
  currentLocationLineHorizontal: {
    backgroundColor: colors.green,
    height: 2,
    position: "absolute",
    width: 24,
  },
  currentLocationDot: {
    backgroundColor: colors.green,
    borderColor: colors.white,
    borderRadius: 4,
    borderWidth: 1,
    height: 8,
    width: 8,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  sheet: {
    ...shadow.soft,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    bottom: spacing.sm,
    gap: spacing.sm,
    left: spacing.md,
    padding: spacing.md,
    position: "absolute",
    right: spacing.md,
    zIndex: 6,
  },
  resultsSheet: {
    height: 280,
  },
  stationSheet: {
    height: 260,
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    width: 44,
  },
  compactRecommendation: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  noticeCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeText: {
    color: colors.amber,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  recommendationCopy: {
    flex: 1,
    minWidth: 0,
  },
  compactDecisionTitle: {
    color: colors.ink,
    fontSize: typeScale.lead,
    fontWeight: "900",
    marginTop: 2,
  },
  compactReason: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "800",
    marginTop: 2,
  },
  emptyRouteState: {
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  recommendationPrice: {
    alignItems: "flex-end",
    minWidth: 78,
  },
  sheetHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  textButton: {
    backgroundColor: colors.panel,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  textButtonDisabled: {
    opacity: 0.58,
  },
  textButtonLabel: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  stopsList: {
    flex: 1,
  },
  stopsListContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  stationDetailPanel: {
    gap: spacing.sm,
  },
  stationFacts: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  factPill: {
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    flex: 1,
    padding: spacing.sm,
  },
  factLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  factValue: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
    marginTop: 2,
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  decisionTitle: {
    color: colors.ink,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  reason: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "700",
    lineHeight: 20,
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  selectedTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  priceValue: {
    color: colors.greenDark,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  priceUnit: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
  },
  recommendationTomorrowPrice: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2,
    maxWidth: 96,
  },
  tomorrowPriceDown: {
    color: colors.greenDark,
  },
  tomorrowPriceUp: {
    color: colors.amber,
  },
});
