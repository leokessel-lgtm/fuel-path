import { Pressable, StyleSheet, Text, View } from "react-native";

import { activeDirectDiscountPrograms } from "../data/discountPrograms";
import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { AppPreferences } from "../types";

export function DiscountWalletCard({
  preferences,
  onToggleDiscount,
  onToggleDiscountRedemption: _onToggleDiscountRedemption,
}: {
  preferences: AppPreferences;
  onToggleDiscount: (discountId: string) => void;
  onToggleDiscountRedemption: (discountId: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Discount wallet</Text>
      <Text style={styles.title}>Eligible discounts</Text>
      <Text style={styles.muted}>
        Turn on the offers you can actually use. Fuel Path applies them only at matching station brands.
      </Text>
      <View style={styles.discountList}>
        {activeDirectDiscountPrograms.map((program) => {
          const selected = preferences.selectedDiscounts.includes(program.id);
          return (
            <Pressable
              accessibilityLabel={`${selected ? "Disable" : "Enable"} ${program.shortLabel}. Applies at ${discountBrandSummary(program.stationBrands)}.`}
              accessibilityRole="switch"
              accessibilityState={{ checked: selected }}
              key={program.id}
              onPress={() => onToggleDiscount(program.id)}
              style={[styles.discountRow, selected && styles.discountRowSelected]}
            >
              <View style={styles.discountMain}>
                <View style={styles.discountTitleRow}>
                  <Text style={styles.discountName}>{program.shortLabel}</Text>
                  <Text style={styles.discountValue}>{program.centsPerLitre.toFixed(0)} c/L</Text>
                </View>
                <Text numberOfLines={2} style={styles.discountBrands}>
                  {discountBrandSummary(program.stationBrands)}
                </Text>
              </View>
              <View style={[styles.switchTrack, selected && styles.switchTrackOn]}>
                <View style={[styles.switchKnob, selected && styles.switchKnobOn]} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function discountBrandSummary(brands?: string[]) {
  if (!brands?.length) return "Matching stations only";
  return brands.join(", ");
}

const styles = StyleSheet.create({
  card: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.md,
    padding: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
  title: {
    ...typography.title,
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
  discountList: {
    gap: spacing.sm,
  },
  discountRow: {
    alignItems: "center",
    ...surfaces.softPanel,
    borderRadius: radii.xl,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  discountRowSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  discountMain: {
    flex: 1,
    minWidth: 0,
  },
  discountTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  discountName: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "800",
  },
  discountValue: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  discountBrands: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 2,
  },
  switchTrack: {
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 3,
    width: 52,
  },
  switchTrackOn: {
    backgroundColor: colors.green,
  },
  switchKnob: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 24,
    width: 24,
  },
  switchKnobOn: {
    transform: [{ translateX: 22 }],
  },
});
