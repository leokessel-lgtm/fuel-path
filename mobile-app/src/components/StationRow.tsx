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
  return (
    <Pressable
      accessibilityLabel={stationRowAccessibilityLabel(item)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.row, selected && styles.selected]}
    >
      <BrandBadge station={item.station} size={34} />
      <View style={styles.main}>
        <Text numberOfLines={1} style={styles.name}>
          {item.station.name}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceBadgeText}>{item.distanceKm.toFixed(1)} km</Text>
          </View>
          <Text numberOfLines={1} style={styles.meta}>
            {item.station.brand} | {stationOpenLabel(item.station.openNow)}
          </Text>
        </View>
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
            Possible, not guaranteed: {item.possibleLowerLabel}
          </Text>
        ) : null}
      </View>
      <View style={styles.price}>
        <Text style={styles.priceValue}>{item.adjustedCpl.toFixed(1)}</Text>
        <Text style={styles.priceUnit}>
          {item.discountCpl ? "your c/L" : "pump c/L"}
        </Text>
        {item.possibleLowerCpl !== undefined ? (
          <Text numberOfLines={1} style={styles.possiblePrice}>
            possible only {item.possibleLowerCpl.toFixed(1)}
          </Text>
        ) : null}
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
    borderRadius: radii.xl,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 84,
    padding: spacing.md,
  },
  selected: {
    ...shadow.soft,
    borderColor: colors.green,
    backgroundColor: colors.panelStrong,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.bodyStrong,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: 3,
    minWidth: 0,
  },
  distanceBadge: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 24,
    minWidth: 58,
    paddingHorizontal: spacing.sm,
  },
  distanceBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  meta: {
    color: colors.muted,
    flex: 1,
    fontSize: typeScale.caption,
    fontWeight: "400",
    minWidth: 0,
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
  price: {
    alignItems: "flex-end",
    minWidth: 86,
  },
  priceValue: {
    color: colors.greenDark,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  priceUnit: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "500",
  },
  possiblePrice: {
    color: colors.amber,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: 92,
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
