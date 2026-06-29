import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { EvCharger, ScoreResponse, StationViewModel } from "../types";
import { stationTimestampLine } from "../utils/decisionEvidence";
import { tomorrowPriceView } from "../utils/pricing";
import { BrandBadge } from "./BrandBadge";
import { DecisionEvidencePanel } from "./DecisionEvidencePanel";
import { StationRow } from "./StationRow";
import { openDirections } from "../screens/NearbyScreen.utils";

export function PlanRouteSheet({
  best,
  candidates,
  currentRouteSaved,
  decisionSummary,
  error,
  emptyRouteTitle,
  evFallbackChargers,
  evFallbackError,
  evFallbackLoading,
  loading,
  loadingLabel,
  onMinimise,
  onSaveCommute,
  onSelectStation,
  onShowStops,
  onRestore,
  policyActive,
  policyNotice,
  recommendationCopy,
  routeEndpointsPresent,
  routeNotice,
  routeSheetMinimised,
  routeSummary,
  selected,
  selectedCode,
  showStopsList,
  stationPanelOpen,
  stopsTitle,
  statusCapability,
}: {
  best?: StationViewModel;
  candidates: StationViewModel[];
  currentRouteSaved: boolean;
  decisionSummary?: ScoreResponse["context"]["decisionSummary"];
  error: string;
  emptyRouteTitle?: string;
  evFallbackChargers?: EvCharger[];
  evFallbackError?: string;
  evFallbackLoading?: boolean;
  loading: boolean;
  loadingLabel?: string;
  onMinimise: () => void;
  onRestore: () => void;
  onSaveCommute: () => void;
  onSelectStation: (stationCode: string) => void;
  onShowStops: () => void;
  policyActive: boolean;
  policyNotice: string;
  recommendationCopy: { title: string; reason: string } | null;
  routeEndpointsPresent: boolean;
  routeNotice: string;
  routeSheetMinimised: boolean;
  routeSummary: string;
  selected?: StationViewModel;
  selectedCode?: string;
  showStopsList?: boolean;
  stationPanelOpen: boolean;
  stopsTitle?: string;
  statusCapability?: string;
}) {
  const bestTomorrow = best ? tomorrowPriceView(best) : null;
  const selectedTomorrow = selected ? tomorrowPriceView(selected) : null;
  const routeSheetRestoreLabel = stationPanelOpen
    ? "Show station detail"
    : routeEndpointsPresent
      ? "Show suggested fuel stops"
      : "Show route panel";
  const routeSheetRestoreText = stationPanelOpen ? "Detail" : routeEndpointsPresent ? "Stops" : "Panel";

  return (
    <View
      style={[
        styles.sheet,
        routeSheetMinimised
          ? styles.sheetMinimised
          : stationPanelOpen
            ? styles.stationSheet
            : styles.resultsSheet,
      ]}
    >
      {routeSheetMinimised ? (
        <View style={styles.minimisedSheetRow}>
          <View style={styles.grabber} />
          <Text numberOfLines={1} style={styles.minimisedSheetText}>
            {stationPanelOpen && selected ? selected.station.name : routeEndpointsPresent ? routeSummary : "Route map"}
          </Text>
          <Pressable
            accessibilityLabel={routeSheetRestoreLabel}
            accessibilityRole="button"
            onPress={onRestore}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>{routeSheetRestoreText}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.sheetTopBar}>
            <View style={styles.grabber} />
            <Pressable
              accessibilityLabel="Show more map"
              accessibilityRole="button"
              onPress={onMinimise}
              style={styles.mapButton}
            >
              <Text style={styles.mapButtonText}>Map</Text>
            </Pressable>
          </View>
          {stationPanelOpen && selected ? (
            <StationDetailPanel
              onNavigate={() => openDirections(selected.station.lat, selected.station.lon, selected.station.address || selected.station.name)}
              onShowStops={onShowStops}
              selected={selected}
              selectedTomorrow={selectedTomorrow}
            />
          ) : (
            <RouteResultsPanel
              best={best}
              bestTomorrow={bestTomorrow}
              candidates={candidates}
              currentRouteSaved={currentRouteSaved}
              decisionSummary={decisionSummary}
              error={error}
              emptyRouteTitle={emptyRouteTitle}
              evFallbackChargers={evFallbackChargers}
              evFallbackError={evFallbackError}
              evFallbackLoading={evFallbackLoading}
              loading={loading}
              loadingLabel={loadingLabel}
              onSaveCommute={onSaveCommute}
              onSelectStation={onSelectStation}
              policyActive={policyActive}
              policyNotice={policyNotice}
              recommendationCopy={recommendationCopy}
              routeEndpointsPresent={routeEndpointsPresent}
              routeNotice={routeNotice}
              selectedCode={selectedCode}
              showStopsList={showStopsList}
              stopsTitle={stopsTitle}
              statusCapability={statusCapability}
            />
          )}
        </>
      )}
    </View>
  );
}

function StationDetailPanel({
  onNavigate,
  onShowStops,
  selected,
  selectedTomorrow,
}: {
  onNavigate: () => void;
  onShowStops: () => void;
  selected: StationViewModel;
  selectedTomorrow: ReturnType<typeof tomorrowPriceView>;
}) {
  return (
    <View style={styles.stationDetailPanel}>
      <View style={styles.sheetHeaderRow}>
        <View />
        <Pressable
          accessibilityLabel="Show suggested fuel stops"
          accessibilityRole="button"
          onPress={onShowStops}
          style={styles.textButton}
        >
          <Text style={styles.textButtonLabel}>Stops</Text>
        </Pressable>
      </View>
      <StationRow hideWhyLine item={selected} selected onPress={onNavigate} />
      <View style={styles.stationFacts}>
        <View style={styles.factPill}>
          <Text style={styles.factLabel}>Pump</Text>
          <Text style={styles.factValue}>{selected.pumpCpl.toFixed(1)} c/L</Text>
        </View>
        <View style={styles.factPill}>
          <Text style={styles.factLabel}>Your price</Text>
          <Text style={styles.factValue}>{selected.adjustedCpl.toFixed(1)} c/L</Text>
        </View>
        <View style={styles.factPill}>
          <Text style={styles.factLabel}>Saving</Text>
          <Text style={styles.factValue}>{priceSavingCpl(selected).toFixed(1)} c/L</Text>
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
  );
}

function RouteResultsPanel({
  best,
  bestTomorrow,
  candidates,
  currentRouteSaved,
  decisionSummary,
  error,
  emptyRouteTitle,
  evFallbackChargers = [],
  evFallbackError = "",
  evFallbackLoading = false,
  loading,
  loadingLabel,
  onSaveCommute,
  onSelectStation,
  policyActive,
  policyNotice,
  recommendationCopy,
  routeEndpointsPresent,
  routeNotice,
  selectedCode,
  showStopsList = true,
  stopsTitle = "Suggested fuel stops",
  statusCapability,
}: {
  best?: StationViewModel;
  bestTomorrow: ReturnType<typeof tomorrowPriceView>;
  candidates: StationViewModel[];
  currentRouteSaved: boolean;
  decisionSummary?: ScoreResponse["context"]["decisionSummary"];
  error: string;
  emptyRouteTitle?: string;
  evFallbackChargers?: EvCharger[];
  evFallbackError?: string;
  evFallbackLoading?: boolean;
  loading: boolean;
  loadingLabel?: string;
  onSaveCommute: () => void;
  onSelectStation: (stationCode: string) => void;
  policyActive: boolean;
  policyNotice: string;
  recommendationCopy: { title: string; reason: string } | null;
  routeEndpointsPresent: boolean;
  routeNotice: string;
  selectedCode?: string;
  showStopsList?: boolean;
  stopsTitle?: string;
  statusCapability?: string;
}) {
  const recommendationSavingCpl = best ? routeSavingCpl(best, decisionSummary) : 0;
  const recommendationDetour =
    best?.detourMinutes || decisionSummary?.economics?.detourMinutes || 0;
  const recommendationFuel = best?.fuel || "fuel";
  const routeOutcomeNotice = routeRecommendationNotice(routeNotice, recommendationSavingCpl, recommendationDetour);

  return (
    <>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.muted}>{loadingLabel || "Scoring live route prices..."}</Text>
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
              <Text style={styles.noticeText}>{routeOutcomeNotice}</Text>
            </View>
          ) : null}
          {policyNotice ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeText}>{policyNotice}</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityLabel={`Open ${best.station.name} recommendation detail`}
            accessibilityRole="button"
            onPress={() => onSelectStation(best.station.stationCode)}
            style={styles.compactRecommendation}
          >
            <View style={styles.recommendationPriceTile}>
              <Text style={styles.recommendationPriceValue}>{best.adjustedCpl.toFixed(1)}</Text>
              <Text style={styles.recommendationFuelLabel}>{recommendationFuel}</Text>
            </View>
            <View style={styles.recommendationCopy}>
              <View style={styles.recommendationStationRow}>
                <BrandBadge station={best.station} size={28} />
                <Text numberOfLines={1} style={styles.recommendationStationName}>
                  {best.station.name}
                </Text>
              </View>
              <Text numberOfLines={2} style={styles.compactDecisionTitle}>
                {recommendationTitle(recommendationCopy?.title, recommendationSavingCpl)}
              </Text>
              <Text numberOfLines={1} style={styles.compactSavingLine}>
                Best price by {recommendationSavingCpl.toFixed(1)} c/L
              </Text>
            </View>
            <View style={styles.recommendationRouteValue}>
              <Pressable
                accessibilityLabel={`Navigate to ${best.station.name}`}
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  openDirections(best.station.lat, best.station.lon, best.station.address || best.station.name);
                }}
                style={styles.recommendationNavigateButton}
              >
                <Text style={styles.recommendationNavigateText}>↗</Text>
              </Pressable>
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
          <DecisionEvidencePanel
            candidate={best}
            capability={statusCapability}
            decisionSummary={decisionSummary}
          />
        </>
      ) : null}
      {!loading && !error && routeEndpointsPresent && !best ? (
        <View style={styles.emptyRouteState}>
          <Text style={styles.decisionTitle}>{emptyRouteTitle || "No fuel stops found"}</Text>
          <Text style={styles.muted}>
            {routeNotice ||
              (policyActive
                ? "Route found, but no approved brands match this fuel, freshness and open-station settings."
                : "Route found, but no eligible stations match this fuel, freshness and open-station settings.")}
          </Text>
          {!showStopsList ? (
            <EvFallbackPanel
              chargers={evFallbackChargers}
              error={evFallbackError}
              loading={evFallbackLoading}
            />
          ) : null}
        </View>
      ) : null}
      {!loading && !error && !routeEndpointsPresent ? (
        <View style={styles.emptyRouteState}>
          <Text style={styles.decisionTitle}>Plan a regular drive</Text>
          <Text style={styles.muted}>
            Add a start and destination, or use a saved place, then Fuel Path will compare route value rather than raw cheapest price.
          </Text>
        </View>
      ) : null}

      {showStopsList ? (
        <>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.selectedTitle}>{stopsTitle}</Text>
            {routeEndpointsPresent ? (
              <Pressable
                accessibilityLabel={currentRouteSaved ? "Route already saved" : "Save commute"}
                accessibilityRole="button"
                disabled={currentRouteSaved}
                onPress={onSaveCommute}
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
                onPress={() => onSelectStation(item.station.stationCode)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}
    </>
  );
}

function priceSavingCpl(item: StationViewModel) {
  return Math.max(0, Number(item.pumpCpl || 0) - Number(item.adjustedCpl || 0));
}

function routeSavingCpl(item: StationViewModel, decisionSummary?: ScoreResponse["context"]["decisionSummary"]) {
  const routeComparisonCpl = Number(decisionSummary?.economics?.comparisonCpl);
  if (Number.isFinite(routeComparisonCpl) && routeComparisonCpl > 0) {
    return Math.max(0, routeComparisonCpl - Number(item.adjustedCpl || 0));
  }
  return priceSavingCpl(item);
}

function recommendationTitle(fallback: string | undefined, savingCpl: number) {
  if (!Number.isFinite(savingCpl) || savingCpl <= 0) return "Best route price";
  if (savingCpl < 2) return "Small savings detour";
  if (savingCpl < 5) return "Medium savings detour";
  if (savingCpl < 10) return "Good savings detour";
  if (savingCpl < 20) return "Great savings detour";
  return fallback || "Strong savings detour";
}

function routeRecommendationNotice(routeNotice: string, savingCpl: number, detourMinutes: number) {
  const routeDistance = routeNotice.match(/^Route is about [^.]+\./)?.[0] || routeNotice;
  if (!Number.isFinite(savingCpl)) return routeDistance;
  const detour = Number(detourMinutes || 0);
  const savingText = savingCpl > 0
    ? `and is best by ${savingCpl.toFixed(1)} c/L`
    : "and is the best route price found";
  if (detour > 0.05) {
    return `${routeDistance} Suggested stop adds a ${detour.toFixed(1)} min detour ${savingText}.`;
  }
  return `${routeDistance} Suggested stop is on the route ${savingText}.`;
}

function EvFallbackPanel({
  chargers,
  error,
  loading,
}: {
  chargers: EvCharger[];
  error: string;
  loading: boolean;
}) {
  if (loading) {
    return <Text style={styles.fallbackMeta}>Looking for compatible fallback chargers...</Text>;
  }
  if (error) {
    return <Text style={styles.fallbackMeta}>Fallback charger lookup failed. Use Nearby or your charging network app before driving.</Text>;
  }
  if (!chargers.length) {
    return <Text style={styles.fallbackMeta}>No compatible fallback chargers found near sampled route points in directory data.</Text>;
  }
  return (
    <View style={styles.fallbackPanel}>
      <View style={styles.sheetHeaderRow}>
        <Text style={styles.fallbackTitle}>Charging fallback</Text>
        <Text style={styles.fallbackBadge}>Directory data</Text>
      </View>
      <Text style={styles.fallbackMeta}>
        Compatible chargers near sampled route points. Detour time is route-estimated where available, otherwise a rough straight-line fallback. Confirm tariff, access and live bay status in the network app.
      </Text>
      {chargers.map((charger) => (
        <View key={charger.id} style={styles.fallbackRow}>
          <View style={styles.fallbackPowerTile}>
            {charger.maxPowerKw ? (
              <>
                <Text style={styles.fallbackPowerValue}>{Math.round(charger.maxPowerKw)}</Text>
                <Text style={styles.fallbackPowerUnit}>kW</Text>
              </>
            ) : (
              <>
                <Text style={styles.fallbackPowerUnknown}>Power</Text>
                <Text style={styles.fallbackPowerUnit}>unknown</Text>
              </>
            )}
          </View>
          <View style={styles.fallbackMain}>
            <Text numberOfLines={1} style={styles.fallbackName}>{charger.name}</Text>
            <Text numberOfLines={1} style={styles.fallbackMeta}>
              {chargerConnectorSummary(charger)} | {chargerRouteDistanceLabel(charger)}
            </Text>
            <Text numberOfLines={1} style={styles.fallbackTrust}>{charger.availabilityLabel}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function chargerConnectorSummary(charger: EvCharger) {
  if (charger.connectors.length) return charger.connectors.join(" | ");
  const labels = charger.connections
    .map((connection) => connection.connectorLabel)
    .filter(Boolean)
    .slice(0, 2);
  return labels.length ? labels.join(" | ") : "Connector unknown";
}

function chargerRouteDistanceLabel(charger: EvCharger) {
  const routeDistance = charger.routeDistanceKm;
  const detourDistance = charger.routeDetourDistanceKm;
  if (typeof routeDistance === "number" && Number.isFinite(routeDistance)) {
    const minutes = charger.routeDetourMinutes;
    const timeLabel = typeof minutes === "number" && Number.isFinite(minutes)
      ? charger.routeDetourSource === "route_engine"
        ? `, est ${minutes} min return`
        : `, rough ${minutes} min return`
      : "";
    const distanceLabel = typeof detourDistance === "number" && Number.isFinite(detourDistance)
      ? `est ${detourDistance.toFixed(1)} km detour`
      : `approx ${routeDistance.toFixed(1)} km off route`;
    return `${distanceLabel}${timeLabel}`;
  }
  return `${charger.distanceKm.toFixed(1)} km from sampled route point`;
}

const styles = StyleSheet.create({
  sheet: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    bottom: spacing.sm,
    gap: spacing.sm,
    left: spacing.md,
    padding: spacing.md,
    position: "absolute",
    right: spacing.md,
    zIndex: 6,
  },
  resultsSheet: {
    maxHeight: 430,
  },
  stationSheet: {
    maxHeight: 430,
  },
  sheetMinimised: {
    height: 74,
  },
  sheetTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 24,
  },
  minimisedSheetRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 42,
  },
  minimisedSheetText: {
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    width: 44,
  },
  mapButton: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: "absolute",
    right: 0,
  },
  mapButtonText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  compactRecommendation: {
    alignItems: "center",
    ...surfaces.softPanel,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 106,
    padding: spacing.sm,
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
    fontWeight: "500",
  },
  recommendationCopy: {
    flex: 1,
    minWidth: 0,
  },
  recommendationPriceTile: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radii.md,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 74,
    width: 80,
  },
  recommendationPriceValue: {
    color: colors.greenDark,
    fontSize: typeScale.title,
    fontWeight: "900",
    lineHeight: 28,
  },
  recommendationFuelLabel: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    lineHeight: 16,
    textTransform: "uppercase",
  },
  recommendationStationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: 2,
    minWidth: 0,
  },
  recommendationStationName: {
    ...typography.bodyStrong,
    flex: 1,
    minWidth: 0,
  },
  compactDecisionTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "700",
    marginTop: 2,
  },
  compactSavingLine: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "700",
    marginTop: 2,
  },
  emptyRouteState: {
    ...surfaces.softPanel,
    borderRadius: radii.xl,
    gap: spacing.xs,
    padding: spacing.md,
  },
  fallbackPanel: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  fallbackTitle: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  fallbackBadge: {
    backgroundColor: colors.blueSoft,
    borderRadius: radii.pill,
    color: colors.blue,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  fallbackRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.xs,
  },
  fallbackPowerTile: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.sm,
    justifyContent: "center",
    minHeight: 44,
    width: 52,
  },
  fallbackPowerValue: {
    color: colors.blue,
    fontSize: typeScale.body,
    fontWeight: "900",
    lineHeight: 18,
  },
  fallbackPowerUnknown: {
    color: colors.blue,
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 12,
    textTransform: "uppercase",
  },
  fallbackPowerUnit: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  fallbackMain: {
    flex: 1,
    minWidth: 0,
  },
  fallbackName: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  fallbackMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
    lineHeight: 17,
  },
  fallbackTrust: {
    color: colors.amber,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },
  recommendationRouteValue: {
    alignItems: "center",
    flexShrink: 0,
    gap: 3,
    minWidth: 48,
  },
  recommendationMetricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    textTransform: "uppercase",
  },
  recommendationMetricValue: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 16,
  },
  recommendationSavingSource: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
    maxWidth: 76,
    textAlign: "center",
  },
  recommendationDetourPill: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  recommendationDetourText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
  recommendationNavigateButton: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  recommendationNavigateText: {
    color: colors.white,
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 22,
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
    fontWeight: "600",
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
    backgroundColor: colors.panelStrong,
    borderRadius: radii.lg,
    flex: 1,
    padding: spacing.sm,
  },
  factLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  factValue: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "600",
    marginTop: 2,
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  decisionTitle: {
    ...typography.title,
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
  },
  selectedTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "600",
  },
  recommendationTomorrowPrice: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
    maxWidth: 96,
  },
  tomorrowPriceDown: {
    color: colors.greenDark,
  },
  tomorrowPriceUp: {
    color: colors.amber,
  },
  eyebrow: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
});
