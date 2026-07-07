import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

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
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const economics = decisionSummary?.economics;
  const routeComparisonCpl = Number(economics?.comparisonCpl);
  const savingCpl = Number.isFinite(routeComparisonCpl) && routeComparisonCpl > 0
    ? Math.max(0, routeComparisonCpl - Number(candidate.adjustedCpl || 0))
    : Math.max(0, Number(candidate.pumpCpl || 0) - Number(candidate.adjustedCpl || 0));
  const detour = routeDetourMinutes(candidate, economics?.detourMinutes ?? 0);
  const capabilityLabel = capability ? capabilityLabelFor(capability) : "Live data";
  const sourceDetails = priceSourceDetails(candidate, resultContext, capability);
  const hasAppliedDiscount = Number(candidate.discountCpl || 0) > 0 &&
    Number(candidate.adjustedCpl || 0) !== Number(candidate.pumpCpl || 0);
  const showSavingMetric = savingCpl > 0.05;
  const showCapabilityChip = capability && capability !== "live";

  return (
    <View style={styles.evidencePanel}>
      <View style={styles.evidencePanelHeader}>
        <Text style={styles.evidencePanelTitle}>Why this stop</Text>
        {showCapabilityChip ? (
          <Text style={[styles.capabilityChip, styles.capabilityChipCaution]}>
            {capabilityLabel}
          </Text>
        ) : null}
      </View>
      <View style={styles.evidenceGrid}>
        {hasAppliedDiscount ? (
          <>
            <EvidenceMetric label="Pump" value={`${candidate.pumpCpl.toFixed(1)} c/L`} />
            <EvidenceMetric label="Your price" value={`${candidate.adjustedCpl.toFixed(1)} c/L`} />
          </>
        ) : (
          <EvidenceMetric label="Pump price" value={`${candidate.pumpCpl.toFixed(1)} c/L`} />
        )}
        {showSavingMetric ? <EvidenceMetric label="Best price by" value={`${savingCpl.toFixed(1)} c/L`} /> : null}
        <EvidenceMetric label={routeDetourEvidenceMetricLabel(candidate)} value={`${detour.toFixed(1)} min`} />
      </View>
      <Text numberOfLines={2} style={styles.savingSourceLine}>
        {showSavingMetric && Number.isFinite(routeComparisonCpl) && routeComparisonCpl > 0
          ? `Compared with the next-best route option at ${routeComparisonCpl.toFixed(1)} c/L. Only selected eligible discounts are applied.`
          : candidate.discountCpl
            ? `Your price includes selected ${candidate.discountLabel}. Pump price is ${candidate.pumpCpl.toFixed(1)} c/L.`
            : "Your price is the current pump price."}
      </Text>
      {sourceDetails.length ? (
        <Pressable
          accessibilityLabel={detailsExpanded ? "Hide price source details" : "Show price source details"}
          accessibilityRole="button"
          onPress={() => setDetailsExpanded((value) => !value)}
          style={styles.detailsToggle}
        >
          <Text style={styles.detailsToggleText}>{detailsExpanded ? "Hide source details" : "Source details"}</Text>
        </Pressable>
      ) : null}
      {detailsExpanded ? (
        <View style={styles.sourceDetails}>
          {sourceDetails.map((detail) => (
            <View key={detail.label} style={styles.sourceDetailRow}>
              <Text style={styles.sourceDetailLabel}>{detail.label}</Text>
              <Text numberOfLines={2} style={styles.sourceDetailValue}>{detail.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
  if (capability === "unsupported") return "Not covered yet";
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
  const details = [
    { label: "Source", value: source },
    { label: "Updated", value: stationTimestampLine(candidate.station) },
    { label: "Price match", value: priceMatchLine(candidate, context) },
  ];
  const providerState = providerStateLine(context, capability);
  if (shouldShowProviderState(context, capability, providerState)) {
    details.splice(2, 0, { label: "Data state", value: providerState });
  }
  return details.filter((item) => item.value);
}

function shouldShowProviderState(
  context: ScoreResponse["context"] | undefined,
  capability: string | undefined,
  providerState: string,
) {
  const activeCapability = capability || context?.capability || "live";
  if (!providerState) return false;
  if (context?.degraded) return true;
  if (activeCapability && activeCapability !== "live") return true;
  if (/stale|error|fallback|pending|unsupported|limited/i.test(providerState)) return true;
  return false;
}

function providerStateLine(context?: ScoreResponse["context"], capability?: string) {
  const capabilityText = capabilityLabelFor(capability || context?.capability || "live");
  const cacheText = providerCacheLine(context);
  const degradedText = context?.degraded ? "Data source limited" : "";
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
  if (cacheMode === "provider_error") return "Saved price data";
  if (cacheMode === "none") return "";
  return "Data source limited";
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
  detailsToggle: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  detailsToggleText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: "800",
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
