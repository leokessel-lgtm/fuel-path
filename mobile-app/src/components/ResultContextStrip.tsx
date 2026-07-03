import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typeScale } from "../theme";
import { FuelCode, StationViewModel } from "../types";
import { fuelProviderLabel } from "../utils/decisionEvidence";

type ResultContext = {
  alternativeFuelCodes?: FuelCode[];
  cacheAgeSeconds?: number;
  capability?: string;
  degraded?: boolean;
  eligibleCandidates?: number;
  exactFuelMatch?: boolean;
  exactStationCount?: number;
  fuel?: FuelCode;
  generatedAt?: string;
  provider?: string;
  requestedFuel?: FuelCode;
  requestedFuelUnavailable?: boolean;
  returnedCount?: number;
  source?: string;
  stationCount?: number;
};

export function ResultContextStrip({
  context,
  label = "Result context",
  stations,
}: {
  context?: ResultContext;
  label?: string;
  stations: StationViewModel[];
}) {
  const metrics = resultContextMetrics(stations, context);
  if (!metrics.length) return null;

  return (
    <View style={styles.strip} accessibilityLabel={label}>
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.metric}>
          <Text numberOfLines={1} style={styles.metricLabel}>{metric.label}</Text>
          <Text numberOfLines={1} style={styles.metricValue}>{metric.value}</Text>
        </View>
      ))}
    </View>
  );
}

function resultContextMetrics(stations: StationViewModel[], context?: ResultContext) {
  const fuelContext = resultFuelContext(stations, context);
  const prices = stations
    .map((station) => Number(station.adjustedCpl))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const metrics: Array<{ label: string; value: string }> = [];
  if (prices.length) {
    const cheapest = prices[0];
    const highest = prices[prices.length - 1];
    metrics.push({ label: fuelPriceLabel("Cheapest", fuelContext), value: `${cheapest.toFixed(1)} c/L` });
    metrics.push({ label: fuelPriceLabel("Typical", fuelContext), value: `${median(prices).toFixed(1)} c/L` });
    metrics.push({ label: "Spread", value: `${Math.max(0, highest - cheapest).toFixed(1)} c/L` });
  }
  const count = stationCount(stations, context, fuelContext.isFallback);
  if (count > 0) metrics.push({ label: "Stations", value: String(Math.round(count)) });
  const provider = fuelProviderLabel(context?.provider || context?.source) || providerFallbackLabel(context?.provider || context?.source);
  if (provider) metrics.push({ label: "Source", value: provider });
  const freshness = freshnessLabel(context);
  if (freshness) metrics.push({ label: "Freshness", value: freshness });
  return metrics.slice(0, 6);
}

function resultFuelContext(stations: StationViewModel[], context?: ResultContext) {
  const isFallback = context?.requestedFuelUnavailable === true || context?.exactFuelMatch === false;
  const shownCodes = [
    ...(Array.isArray(context?.alternativeFuelCodes) ? context?.alternativeFuelCodes || [] : []),
    ...stations.map((station) => station.fuel || station.station.matchedFuel),
  ]
    .map((fuel) => String(fuel || "").trim().toUpperCase())
    .filter(Boolean);
  const uniqueShown = [...new Set(shownCodes)];
  return {
    isFallback,
    requestedFuel: String(context?.requestedFuel || context?.fuel || "").toUpperCase(),
    shownFuel: uniqueShown.length === 1 ? uniqueShown[0] : "",
  };
}

function fuelPriceLabel(label: string, fuelContext: ReturnType<typeof resultFuelContext>) {
  if (!fuelContext.isFallback) return label;
  if (fuelContext.shownFuel) return `${label} ${fuelContext.shownFuel}`;
  return `${label} alt`;
}

function stationCount(stations: StationViewModel[], context: ResultContext | undefined, isFallback: boolean) {
  if (isFallback) {
    return firstFinite(context?.returnedCount, context?.stationCount, stations.length);
  }
  return firstFinite(
    context?.exactStationCount,
    context?.eligibleCandidates,
    context?.stationCount,
    context?.returnedCount,
    stations.length,
  );
}

function median(values: number[]) {
  const middle = Math.floor(values.length / 2);
  if (values.length % 2) return values[middle];
  return (values[middle - 1] + values[middle]) / 2;
}

function firstFinite(...values: Array<number | undefined>) {
  const match = values.find((value) => Number.isFinite(Number(value)));
  return Number(match || 0);
}

function providerFallbackLabel(provider?: string): string {
  const value = String(provider || "").toLowerCase();
  if (!value) return "";
  const parts = value.split("+");
  if (parts.length > 1) return parts.map(providerFallbackLabel).filter(Boolean).join(" + ");
  return value
    .replace(/^api_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function freshnessLabel(context?: ResultContext) {
  if (!context) return "";
  const age = Number(context.cacheAgeSeconds);
  if (Number.isFinite(age) && age >= 0) {
    const cacheLabel = context.degraded || context.capability !== "live";
    return `${cacheLabel ? "Cache" : "Fresh"} ${formatAge(age)}`;
  }
  if (!context.generatedAt) return "";
  const generatedAt = new Date(context.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) return "";
  const seconds = Math.max(0, Math.round((Date.now() - generatedAt.getTime()) / 1000));
  return `Checked ${formatAge(seconds)}`;
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
  strip: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  metric: {
    backgroundColor: colors.panelStrong,
    borderRadius: radii.md,
    minWidth: 74,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: typeScale.micro,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1,
  },
});
