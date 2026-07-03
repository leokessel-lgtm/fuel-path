import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, surfaces, typeScale } from "../theme";
import { ScoreResponse, StationViewModel } from "../types";
import {
  stationProviderLabel,
  stationSourceLabel,
  stationTimestampLine,
  fuelProviderLabel,
} from "../utils/decisionEvidence";
import { fuelMismatchLine } from "../utils/fuelMismatch";
import {
  routeDetourEvidenceMetricLabel,
  routeDetourMinutes,
} from "../utils/routeEvidenceCopy";

export function DecisionEvidencePanel({
  candidate,
  capability,
  decisionSummary,
  resultContext,
}: {
  candidate: StationViewModel;
  capability?: string;
  decisionSummary?: ScoreResponse["context"]["decisionSummary"];
  resultContext?: ScoreResponse["context"];
}) {
  const economics = decisionSummary?.economics;
  const routeComparisonCpl = Number(economics?.comparisonCpl);
  const savingCpl = Number.isFinite(routeComparisonCpl) && routeComparisonCpl > 0
    ? Math.max(0, routeComparisonCpl - Number(candidate.adjustedCpl || 0))
    : Math.max(0, Number(candidate.pumpCpl || 0) - Number(candidate.adjustedCpl || 0));
  const detour = routeDetourMinutes(candidate, economics?.detourMinutes ?? 0);
  const capabilityLabel = capability ? capabilityLabelFor(capability) : "Live data";
  const sourceDetails = priceSourceDetails(candidate, resultContext, capability);

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
      <View style={styles.sourceDetails}>
        {sourceDetails.map((detail) => (
          <View key={detail.label} style={styles.sourceDetailRow}>
            <Text style={styles.sourceDetailLabel}>{detail.label}</Text>
            <Text numberOfLines={2} style={styles.sourceDetailValue}>{detail.value}</Text>
          </View>
        ))}
      </View>
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

function priceSourceDetails(
  candidate: StationViewModel,
  context?: ScoreResponse["context"],
  capability?: string,
) {
  const source = stationProviderLabel(candidate.station.source) ||
    fuelProviderLabel(context?.provider || context?.source) ||
    stationSourceLabel(candidate.station.source);
  return [
    { label: "Source", value: source },
    { label: "Updated", value: stationTimestampLine(candidate.station) },
    { label: "Provider state", value: providerStateLine(context, capability) },
    { label: "Price match", value: priceMatchLine(candidate, context) },
  ].filter((item) => item.value);
}

function providerStateLine(context?: ScoreResponse["context"], capability?: string) {
  const capabilityText = capabilityLabelFor(capability || context?.capability || "live");
  const cacheText = providerCacheLine(context);
  const degradedText = context?.degraded ? "Provider degraded" : "";
  return [capabilityText, degradedText, cacheText].filter(Boolean).join(" | ");
}

function providerCacheLine(context?: ScoreResponse["context"]) {
  if (!context) return "";
  const age = Number(context.cacheAgeSeconds);
  const mode = context.cacheMode ? cacheModeLabel(context.cacheMode) : "";
  if (!Number.isFinite(age) || age < 0) return mode;
  return `${mode || "Provider cache"} ${formatAge(age)}`;
}

function cacheModeLabel(cacheMode: string) {
  if (cacheMode === "fresh") return "Fresh cache";
  if (cacheMode === "stale") return "Stale cache";
  if (cacheMode === "provider_error") return "Provider error cache";
  if (cacheMode === "none") return "";
  return cacheMode.replace(/_/g, " ");
}

function priceMatchLine(candidate: StationViewModel, context?: ScoreResponse["context"]) {
  const mismatch = fuelMismatchLine(candidate, { scope: "route" });
  if (mismatch) return mismatch;
  const fuel = candidate.fuel || context?.fuel || "fuel";
  if (context?.capability === "fallback" || /fallback|sample|demo/i.test(`${context?.source || ""} ${candidate.station.source || ""}`)) {
    return `Fallback ${fuel} price.`;
  }
  return `Exact ${fuel} price.`;
}

function formatAge(seconds: number) {
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
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
  sourceDetails: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sourceDetailRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  sourceDetailLabel: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: 10,
    fontWeight: "700",
    width: 82,
  },
  sourceDetailValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 14,
  },
});
