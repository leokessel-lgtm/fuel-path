import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typeScale } from "../theme";
import { StationViewModel } from "../types";
import {
  priceBasisLine,
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
    <Pressable onPress={onPress} style={[styles.row, selected && styles.selected]}>
      <BrandBadge station={item.station} size={34} />
      <View style={styles.main}>
        <Text numberOfLines={1} style={styles.name}>
          {item.station.name}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {item.station.brand} | {item.distanceKm.toFixed(1)} km | {stationOpenLabel(item.station.openNow)}
        </Text>
        <Text numberOfLines={1} style={styles.evidence}>
          {stationEvidenceLine(item)}
        </Text>
        {item.discountCpl ? (
          <Text numberOfLines={1} style={styles.discount}>
            {item.discountLabel} applied
          </Text>
        ) : null}
      </View>
      <View style={styles.price}>
        <Text style={styles.priceBasis}>{priceBasisLine(item)}</Text>
        <Text style={styles.priceValue}>{item.adjustedCpl.toFixed(1)}</Text>
        <Text style={styles.priceUnit}>c/L</Text>
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

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  selected: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  meta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    marginTop: 2,
  },
  evidence: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  discount: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "800",
    marginTop: 2,
  },
  price: {
    alignItems: "flex-end",
    minWidth: 86,
  },
  priceBasis: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
  },
  priceValue: {
    color: colors.greenDark,
    fontSize: typeScale.lead,
    fontWeight: "900",
  },
  priceUnit: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
  },
  confidence: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: "900",
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
    fontWeight: "900",
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
