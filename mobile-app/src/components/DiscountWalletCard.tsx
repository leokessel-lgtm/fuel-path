import { Pressable, StyleSheet, Text, View } from "react-native";

import { activeDirectDiscountPrograms } from "../data/discountPrograms";
import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { AppPreferences } from "../types";
import { DiscountProgramBadge } from "./DiscountProgramBadge";

export function DiscountWalletCard({
  preferences,
  onToggleDiscount,
  onToggleDiscountRedemption: _onToggleDiscountRedemption,
}: {
  preferences: AppPreferences;
  onToggleDiscount: (discountId: string) => void;
  onToggleDiscountRedemption: (discountId: string) => void;
}) {
  const programs = activeDirectDiscountPrograms;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Discount wallet</Text>
      <Text style={styles.title}>Eligible discounts</Text>
      <Text style={styles.muted}>
        Turn on the offers you can actually use. Fuel Path applies them only at matching station brands.
      </Text>

      {!programs.length ? (
        <Text style={styles.muted}>No discounts available right now.</Text>
      ) : (
        <View style={styles.discountList}>
          {programs.map((program) => {
            const selected = preferences.selectedDiscounts.includes(program.id);
            return (
              <Pressable
                accessibilityLabel={`${selected ? "Disable" : "Enable"} ${program.shortLabel}. Applies at ${discountBrandSummary(program.stationBrands)}.`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={program.id}
                onPress={() => onToggleDiscount(program.id)}
                style={[styles.discountRow, selected && styles.discountRowSelected]}
              >
                <DiscountProgramBadge program={program} size={28} />
                <View style={styles.discountMain}>
                  <View style={styles.discountTitleRow}>
                    <Text style={styles.discountName}>{program.shortLabel}</Text>
                    <Text style={styles.discountValue}>{program.centsPerLitre.toFixed(0)} c/L</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.discountBrands}>
                    {discountBrandSummary(program.stationBrands)}
                  </Text>
                </View>
                <Text style={[styles.discountState, selected && styles.discountStateActive]}>
                  {selected ? "On" : "Off"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
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
    ...surfaces.field,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 52,
    padding: spacing.sm,
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
  discountState: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  discountStateActive: {
    color: colors.green,
  },
});
