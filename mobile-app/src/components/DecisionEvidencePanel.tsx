import { StyleSheet, Text, View } from "react-native";

import { stationTimestampLine } from "../utils/decisionEvidence";
import { colors, radii, spacing, surfaces, typeScale } from "../theme";
import { RouteDecisionSummary, StationViewModel } from "../types";

export type DecisionAlternative = {
  label: string;
  note: string;
  stationCode: string;
  stationName: string;
  selected?: boolean;
};

export function routeDecisionAlternatives(
  candidates: StationViewModel[],
  summary?: RouteDecisionSummary,
): DecisionAlternative[] {
  if (summary?.alternatives?.length) {
    return summary.alternatives.map((item) => ({
      label: decisionAlternativeLabel(item.kind, item.label),
      note: item.note,
      selected: item.selected,
      stationCode: item.stationCode,
      stationName: item.stationName,
    }));
  }
  if (!candidates.length) return [];
  const bestValue = candidates[0];
  const cheapest = minBy(candidates, (item) => item.adjustedCpl);
  const closest = minBy(candidates, (item) => Number(item.detourMinutes ?? item.distanceKm ?? 0));
  const safest = safestCandidate(candidates);

  return [
    decisionAlternative("Best value", bestValue, routeValueSummary(bestValue)),
    decisionAlternative("Cheapest", cheapest, `${cheapest.adjustedCpl.toFixed(1)} c/L after wallet`),
    decisionAlternative("Closest", closest, `${Number(closest.detourMinutes || 0).toFixed(1)} min detour`),
    decisionAlternative("Safest", safest, safetySummary(safest)),
  ];
}

export function cheapestTradeOffExplanation(candidates: StationViewModel[]) {
  if (!candidates.length) return "";
  const best = candidates[0];
  const cheapest = minBy(candidates, (item) => item.adjustedCpl);
  const cheapestDetour = Number(cheapest.detourMinutes || 0);
  const cheapestSaving = Number(cheapest.netSaving || 0);
  const cheapestFuel = Number(cheapest.detourFuelLitres || 0);

  if (cheapest.station.stationCode === best.station.stationCode) {
    return "Cheapest also wins because the route saving stays ahead after detour time and fuel used.";
  }

  return `${cheapest.station.name} is cheapest at ${cheapest.adjustedCpl.toFixed(1)} c/L, but nets ${formatMoney(cheapestSaving)} after ${cheapestDetour.toFixed(1)} min and ${cheapestFuel.toFixed(1)} L detour fuel.`;
}

export function DecisionEvidencePanel({
  candidate,
  capability,
  decisionSummary,
}: {
  candidate: StationViewModel;
  capability?: string;
  decisionSummary?: RouteDecisionSummary;
}) {
  const economics = decisionSummary?.economics;
  const routeComparisonCpl = Number(economics?.comparisonCpl);
  const savingCpl = Number.isFinite(routeComparisonCpl) && routeComparisonCpl > 0
    ? Math.max(0, routeComparisonCpl - Number(candidate.adjustedCpl || 0))
    : Math.max(0, Number(candidate.pumpCpl || 0) - Number(candidate.adjustedCpl || 0));
  const detour = Number(economics?.detourMinutes ?? candidate.detourMinutes ?? 0);
  const capabilityLabel = capability ? capabilityLabelFor(capability) : "Live data";

  return (
    <View style={styles.evidencePanel}>
      <View style={styles.evidencePanelHeader}>
        <Text style={styles.evidencePanelTitle}>Why this stop</Text>
        <Text
          style={[
            styles.capabilityChip,
            capability && capability !== "live" ? styles.capabilityChipCaution : null,
          ]}
        >
          {capabilityLabel}
        </Text>
      </View>
      <View style={styles.evidenceGrid}>
        <EvidenceMetric label="Pump" value={`${candidate.pumpCpl.toFixed(1)} c/L`} />
        <EvidenceMetric label="Your price" value={`${candidate.adjustedCpl.toFixed(1)} c/L`} />
        <EvidenceMetric label="Best price by" value={`${savingCpl.toFixed(1)} c/L`} />
        <EvidenceMetric label="Detour" value={`${detour.toFixed(1)} min`} />
      </View>
      <Text numberOfLines={2} style={styles.savingSourceLine}>
        {Number.isFinite(routeComparisonCpl) && routeComparisonCpl > 0
          ? `Compared with the next-best route option at ${routeComparisonCpl.toFixed(1)} c/L. Your price includes eligible discounts.`
          : candidate.discountCpl
            ? `Your price includes ${candidate.discountLabel}. Pump price is ${candidate.pumpCpl.toFixed(1)} c/L.`
            : "Your price is the current pump price."}
      </Text>
    </View>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.evidenceMetric}>
      <Text style={styles.evidenceMetricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.evidenceMetricValue}>
        {value}
      </Text>
    </View>
  );
}

function decisionAlternative(
  label: string,
  candidate: StationViewModel,
  note: string,
): DecisionAlternative {
  return {
    label,
    note,
    stationCode: candidate.station.stationCode,
    stationName: candidate.station.name,
  };
}

function decisionAlternativeLabel(
  kind: RouteDecisionSummary["alternatives"][number]["kind"],
  fallback: string,
) {
  if (kind === "best_value") return "Best value";
  if (kind === "cheapest") return "Cheapest";
  if (kind === "closest") return "Closest";
  if (kind === "safest") return "Safest";
  return fallback;
}

function safestCandidate(candidates: StationViewModel[]) {
  const safe = candidates.filter((item) => {
    const warnings = (item.warnings || []).join(" ").toLowerCase();
    return (
      item.reachable !== false &&
      item.station.openNow !== false &&
      !/range|closed|unavailable|out of fuel|stale|fallback/i.test(warnings)
    );
  });
  return minBy(safe.length ? safe : candidates, (item) =>
    Number(item.detourMinutes ?? item.distanceKm ?? 0) + (item.station.openNow === false ? 1000 : 0),
  );
}

function routeValueSummary(candidate: StationViewModel) {
  return `${candidate.adjustedCpl.toFixed(1)} c/L, ${Number(candidate.detourMinutes || 0).toFixed(1)} min detour`;
}

function safetySummary(candidate: StationViewModel) {
  if (candidate.reachable === false) return "Range risk";
  if (candidate.station.openNow === false) return "Closed";
  if ((candidate.warnings || []).length) return "Check warning";
  return "No range/open warning";
}

function minBy<T>(items: T[], score: (item: T) => number): T {
  return items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0]);
}

function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function capabilityLabelFor(capability: string) {
  if (capability === "live") return "Live data";
  if (capability === "limited") return "Limited";
  if (capability === "pending_access") return "Pending access";
  if (capability === "fallback") return "Fallback";
  if (capability === "unsupported") return "Unsupported";
  return "Data check";
}

const styles = StyleSheet.create({
  evidencePanel: {
    ...surfaces.softPanel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  evidencePanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  evidencePanelTitle: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  capabilityChip: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  capabilityChipCaution: {
    backgroundColor: colors.amberSoft,
    color: colors.amber,
  },
  evidenceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  evidenceMetric: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexBasis: "23%",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.xs,
  },
  evidenceMetricLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "500",
    textAlign: "center",
    textTransform: "uppercase",
  },
  evidenceMetricValue: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  savingSourceLine: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14,
  },
});
