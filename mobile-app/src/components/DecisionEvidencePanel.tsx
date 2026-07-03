import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, surfaces, typeScale } from "../theme";
import { RouteDecisionSummary, StationViewModel } from "../types";
import {
  routeDetourEvidenceMetricLabel,
  routeDetourMinutes,
} from "../utils/routeEvidenceCopy";

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
  const detour = routeDetourMinutes(candidate, economics?.detourMinutes ?? 0);
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
        <EvidenceMetric label={routeDetourEvidenceMetricLabel(candidate)} value={`${detour.toFixed(1)} min`} />
      </View>
      <Text numberOfLines={2} style={styles.savingSourceLine}>
        {Number.isFinite(routeComparisonCpl) && routeComparisonCpl > 0
          ? `Compared with the next-best route option at ${routeComparisonCpl.toFixed(1)} c/L. Only selected eligible discounts are applied.`
          : candidate.discountCpl
            ? `Your price includes selected ${candidate.discountLabel}. Pump price is ${candidate.pumpCpl.toFixed(1)} c/L.`
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
