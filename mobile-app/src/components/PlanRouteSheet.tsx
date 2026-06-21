import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { ScoreResponse, StationViewModel } from "../types";
import { stationTimestampLine } from "../utils/decisionEvidence";
import { tomorrowPriceView } from "../utils/pricing";
import { BrandBadge } from "./BrandBadge";
import {
  DecisionAlternative,
  DecisionEvidencePanel,
} from "./DecisionEvidencePanel";
import { StationRow } from "./StationRow";

export function PlanRouteSheet({
  best,
  candidates,
  cheapestExplanation,
  currentRouteSaved,
  decisionAlternatives,
  decisionSummary,
  error,
  loading,
  maxDetourMinutes,
  minSavingDollars,
  onMinimise,
  onSaveCommute,
  onSelectStation,
  onShowStops,
  onRestore,
  policyActive,
  policyBrands,
  policyNotice,
  recommendationCopy,
  routeEndpointsPresent,
  routeNotice,
  routeSheetMinimised,
  routeSummary,
  selected,
  selectedCode,
  stationPanelOpen,
  statusCapability,
}: {
  best?: StationViewModel;
  candidates: StationViewModel[];
  cheapestExplanation: string;
  currentRouteSaved: boolean;
  decisionAlternatives: DecisionAlternative[];
  decisionSummary?: ScoreResponse["context"]["decisionSummary"];
  error: string;
  loading: boolean;
  maxDetourMinutes: number;
  minSavingDollars: number;
  onMinimise: () => void;
  onRestore: () => void;
  onSaveCommute: () => void;
  onSelectStation: (stationCode: string) => void;
  onShowStops: () => void;
  policyActive: boolean;
  policyBrands: string[];
  policyNotice: string;
  recommendationCopy: { title: string; reason: string } | null;
  routeEndpointsPresent: boolean;
  routeNotice: string;
  routeSheetMinimised: boolean;
  routeSummary: string;
  selected?: StationViewModel;
  selectedCode?: string;
  stationPanelOpen: boolean;
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
              onShowStops={onShowStops}
              selected={selected}
              selectedTomorrow={selectedTomorrow}
            />
          ) : (
            <RouteResultsPanel
              best={best}
              bestTomorrow={bestTomorrow}
              candidates={candidates}
              cheapestExplanation={cheapestExplanation}
              currentRouteSaved={currentRouteSaved}
              decisionAlternatives={decisionAlternatives}
              decisionSummary={decisionSummary}
              error={error}
              loading={loading}
              maxDetourMinutes={maxDetourMinutes}
              minSavingDollars={minSavingDollars}
              onSaveCommute={onSaveCommute}
              onSelectStation={onSelectStation}
              policyActive={policyActive}
              policyBrands={policyBrands}
              policyNotice={policyNotice}
              recommendationCopy={recommendationCopy}
              routeEndpointsPresent={routeEndpointsPresent}
              routeNotice={routeNotice}
              selectedCode={selectedCode}
              statusCapability={statusCapability}
            />
          )}
        </>
      )}
    </View>
  );
}

function StationDetailPanel({
  onShowStops,
  selected,
  selectedTomorrow,
}: {
  onShowStops: () => void;
  selected: StationViewModel;
  selectedTomorrow: ReturnType<typeof tomorrowPriceView>;
}) {
  return (
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
          onPress={onShowStops}
          style={styles.textButton}
        >
          <Text style={styles.textButtonLabel}>Stops</Text>
        </Pressable>
      </View>
      <StationRow item={selected} selected onPress={() => {}} />
      <View style={styles.stationFacts}>
        <View style={styles.factPill}>
          <Text style={styles.factLabel}>Pump</Text>
          <Text style={styles.factValue}>{selected.pumpCpl.toFixed(1)} c/L</Text>
        </View>
        <View style={styles.factPill}>
          <Text style={styles.factLabel}>Your price</Text>
          <Text style={styles.factValue}>{selected.adjustedCpl.toFixed(1)} c/L</Text>
        </View>
        {selected.possibleLowerCpl !== undefined ? (
          <View style={styles.factPill}>
            <Text style={styles.factLabel}>Possible only</Text>
            <Text style={styles.factValue}>{selected.possibleLowerCpl.toFixed(1)} c/L</Text>
          </View>
        ) : null}
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
  );
}

function RouteResultsPanel({
  best,
  bestTomorrow,
  candidates,
  cheapestExplanation,
  currentRouteSaved,
  decisionAlternatives,
  decisionSummary,
  error,
  loading,
  maxDetourMinutes,
  minSavingDollars,
  onSaveCommute,
  onSelectStation,
  policyActive,
  policyBrands,
  policyNotice,
  recommendationCopy,
  routeEndpointsPresent,
  routeNotice,
  selectedCode,
  statusCapability,
}: {
  best?: StationViewModel;
  bestTomorrow: ReturnType<typeof tomorrowPriceView>;
  candidates: StationViewModel[];
  cheapestExplanation: string;
  currentRouteSaved: boolean;
  decisionAlternatives: DecisionAlternative[];
  decisionSummary?: ScoreResponse["context"]["decisionSummary"];
  error: string;
  loading: boolean;
  maxDetourMinutes: number;
  minSavingDollars: number;
  onSaveCommute: () => void;
  onSelectStation: (stationCode: string) => void;
  policyActive: boolean;
  policyBrands: string[];
  policyNotice: string;
  recommendationCopy: { title: string; reason: string } | null;
  routeEndpointsPresent: boolean;
  routeNotice: string;
  selectedCode?: string;
  statusCapability?: string;
}) {
  const recommendationSaving =
    best?.netSaving || decisionSummary?.economics?.netSavingAfterDetourFuel || 0;
  const recommendationDetour =
    best?.detourMinutes || decisionSummary?.economics?.detourMinutes || 0;
  const recommendationFuel = best?.fuel || "fuel";

  return (
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
              <Text style={styles.eyebrow}>Recommendation</Text>
              <Text numberOfLines={2} style={styles.compactDecisionTitle}>
                {recommendationCopy?.title}
              </Text>
              <Text numberOfLines={1} style={styles.compactReason}>
                {recommendationCopy?.reason}
              </Text>
            </View>
            <View style={styles.recommendationRouteValue}>
              <Text style={styles.recommendationMetricLabel}>Saving</Text>
              <Text style={styles.recommendationMetricValue}>
                {formatMoney(recommendationSaving)}
              </Text>
              <View style={styles.recommendationDetourPill}>
                <Text style={styles.recommendationDetourText}>
                  {recommendationDetour.toFixed(1)} min
                </Text>
              </View>
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
            alternatives={decisionAlternatives}
            candidate={best}
            capability={statusCapability}
            cheapestExplanation={cheapestExplanation}
            decisionSummary={decisionSummary}
            maxDetourMinutes={maxDetourMinutes}
            minSavingDollars={minSavingDollars}
            policyActive={policyActive}
            policyBrands={policyBrands}
          />
        </>
      ) : null}
      {!loading && !error && routeEndpointsPresent && !best ? (
        <View style={styles.emptyRouteState}>
          <Text style={styles.decisionTitle}>No fuel stops found</Text>
          <Text style={styles.muted}>
            {routeNotice ||
              (policyActive
                ? "Route found, but no approved brands match this fuel, freshness and open-station settings."
                : "Route found, but no eligible stations match this fuel, freshness and open-station settings.")}
          </Text>
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

      <View style={styles.sheetHeaderRow}>
        <Text style={styles.selectedTitle}>Suggested fuel stops</Text>
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
  );
}

function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
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
    height: 280,
  },
  stationSheet: {
    height: 260,
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
  compactReason: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "500",
    marginTop: 2,
  },
  emptyRouteState: {
    ...surfaces.softPanel,
    borderRadius: radii.xl,
    gap: spacing.xs,
    padding: spacing.md,
  },
  recommendationRouteValue: {
    alignItems: "center",
    flexShrink: 0,
    gap: 3,
    minWidth: 58,
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
