import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { StationViewModel } from "../types";
import {
  stationAttentionCue,
  stationEvidenceLine,
  stationOpenLabel,
} from "../utils/decisionEvidence";
import { tomorrowPriceView } from "../utils/pricing";
import { BrandBadge } from "./BrandBadge";

export function StationRow({
  item,
  selected,
  onPress,
}: {
  item: StationViewModel;
  selected: boolean;
  onPress: () => void;
}) {
  const tomorrow = tomorrowPriceView(item);
  const attentionCue = stationAttentionCue(item);
  const fuelLabel = item.fuel || "fuel";
  return (
    <Pressable
      accessibilityLabel={stationRowAccessibilityLabel(item)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.row, selected && styles.selected]}
    >
      <View style={styles.priceTile}>
        <Text style={styles.priceValue}>{item.adjustedCpl.toFixed(1)}</Text>
        <Text style={styles.fuelLabel}>{fuelLabel}</Text>
      </View>
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <BrandBadge station={item.station} size={28} />
          <Text numberOfLines={1} style={styles.name}>
            {item.station.name}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={styles.meta}>
            {item.station.address || item.station.brand}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.distanceText}>
          {item.distanceKm.toFixed(1)} km
          <Text style={styles.statusText}> | {stationOpenLabel(item.station.openNow)}</Text>
        </Text>
        <Text numberOfLines={1} style={styles.evidence}>
          {stationEvidenceLine(item)}
        </Text>
        {item.discountCpl ? (
          <Text numberOfLines={1} style={styles.discount}>
            Confirmed: {item.discountLabel}
          </Text>
        ) : null}
        {item.possibleLowerCpl !== undefined ? (
          <Text numberOfLines={1} style={styles.possibleDiscount}>
            Possible, not guaranteed: possible only {item.possibleLowerCpl.toFixed(1)}
          </Text>
        ) : null}
      </View>
      <View style={styles.mapAction}>
        <View style={styles.mapActionCircle}>
          <Text style={styles.mapActionIcon}>↗</Text>
        </View>
        {attentionCue ? (
          <Text
            numberOfLines={1}
            style={[
              styles.confidence,
              attentionCue.level === "low" && styles.confidenceLow,
              attentionCue.level === "medium" && styles.confidenceMedium,
            ]}
          >
            {attentionCue.label}
          </Text>
        ) : null}
        {tomorrow ? (
          <Text
            numberOfLines={1}
            style={[
              styles.tomorrowPrice,
              tomorrow.direction === "down" && styles.tomorrowPriceDown,
              tomorrow.direction === "up" && styles.tomorrowPriceUp,
            ]}
          >
            {tomorrow.shortLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function stationRowAccessibilityLabel(item: StationViewModel) {
  const priceKind = item.discountCpl ? "your price" : "pump price";
  const parts = [
    item.station.name,
    item.station.brand,
    stationOpenLabel(item.station.openNow),
    `${item.distanceKm.toFixed(1)} kilometres away`,
    `${item.adjustedCpl.toFixed(1)} cents per litre ${priceKind}`,
    stationEvidenceLine(item),
  ];
  if (item.discountCpl) parts.push(`Confirmed discount: ${item.discountLabel}`);
  if (item.possibleLowerCpl !== undefined) {
    parts.push(`Possible lower price, not guaranteed: ${item.possibleLowerLabel}`);
  }
  const attentionCue = stationAttentionCue(item);
  if (attentionCue) parts.push(attentionCue.label);
  const tomorrow = tomorrowPriceView(item);
  if (tomorrow) parts.push(tomorrow.shortLabel);
  return parts.filter(Boolean).join(". ");
}

const styles = StyleSheet.create({
  row: {
    ...surfaces.floating,
    alignItems: "center",
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 92,
    padding: spacing.sm,
  },
  selected: {
    ...shadow.soft,
    borderColor: colors.black,
    backgroundColor: colors.panelStrong,
  },
  priceTile: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radii.md,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 66,
    width: 76,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    minWidth: 0,
  },
  name: {
    ...typography.bodyStrong,
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 2,
    minWidth: 0,
  },
  meta: {
    color: colors.muted,
    flex: 1,
    fontSize: typeScale.caption,
    fontWeight: "400",
    minWidth: 0,
  },
  distanceText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "700",
    marginTop: 2,
  },
  statusText: {
    color: colors.muted,
    fontWeight: "400",
  },
  evidence: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "400",
    marginTop: 2,
  },
  discount: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "500",
    marginTop: 2,
  },
  possibleDiscount: {
    color: colors.amber,
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  priceValue: {
    color: colors.greenDark,
    fontSize: typeScale.title,
    fontWeight: "900",
    lineHeight: 26,
  },
  fuelLabel: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    lineHeight: 16,
    textTransform: "uppercase",
  },
  mapAction: {
    alignItems: "center",
    flexShrink: 0,
    gap: 2,
    minWidth: 42,
  },
  mapActionCircle: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  mapActionIcon: {
    color: colors.white,
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 22,
  },
  confidence: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  confidenceLow: {
    backgroundColor: "#fee2e2",
    color: colors.red,
  },
  confidenceMedium: {
    backgroundColor: "#fff7ed",
    color: colors.amber,
  },
  tomorrowPrice: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: 92,
  },
  tomorrowPriceDown: {
    color: colors.greenDark,
  },
  tomorrowPriceUp: {
    color: colors.amber,
  },
});
