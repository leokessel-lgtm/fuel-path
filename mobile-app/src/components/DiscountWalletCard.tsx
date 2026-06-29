import { Pressable, StyleSheet, Text, View } from "react-native";

import { discountPrograms } from "../data/discountPrograms";
import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { AppPreferences } from "../types";
import { discountRedemptionLabel } from "../utils/discountRedemptions";

export function DiscountWalletCard({
  preferences,
  onToggleDiscount,
  onToggleDiscountRedemption,
}: {
  preferences: AppPreferences;
  onToggleDiscount: (discountId: string) => void;
  onToggleDiscountRedemption: (discountId: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Discount wallet</Text>
      <Text style={styles.title}>Your real price</Text>
      <Text style={styles.muted}>
        Select programs you actually use. The app keeps pump price, confirmed wallet price
        and possible lower offers separate.
      </Text>
      <View style={styles.discountList}>
        {discountPrograms.map((program) => {
          const selected = preferences.selectedDiscounts.includes(program.id);
          const redemptionLabel = discountRedemptionLabel(preferences, program.id);
          const redeemed = redemptionLabel === "Used today";
          return (
            <View
              key={program.id}
              style={[styles.discountRow, selected && styles.discountRowSelected]}
            >
              <Pressable
                accessibilityLabel={`${selected ? "Remove" : "Add"} ${program.shortLabel}`}
                accessibilityRole="switch"
                accessibilityState={{ checked: selected }}
                onPress={() => onToggleDiscount(program.id)}
                style={styles.discountToggleArea}
              >
                <View>
                  <Text style={styles.discountName}>{program.shortLabel}</Text>
                  <Text style={styles.muted}>{program.centsPerLitre.toFixed(0)} c/L guide</Text>
                </View>
                <Text style={[styles.discountState, selected && styles.discountStateSelected]}>
                  {selected ? "On" : "Off"}
                </Text>
              </Pressable>
              {selected ? (
                <Pressable
                  accessibilityLabel={`${program.shortLabel} redemption state ${redemptionLabel}`}
                  accessibilityRole="button"
                  onPress={() => onToggleDiscountRedemption(program.id)}
                  style={[
                    styles.redemptionButton,
                    redeemed && styles.redemptionButtonRedeemed,
                  ]}
                >
                  <Text
                    style={[
                      styles.redemptionButtonText,
                      redeemed && styles.redemptionButtonTextRedeemed,
                    ]}
                  >
                    {redemptionLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
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
    ...surfaces.softPanel,
    borderRadius: radii.xl,
    padding: spacing.md,
  },
  discountRowSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  discountToggleArea: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  discountName: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "600",
  },
  discountState: {
    color: colors.muted,
    fontSize: typeScale.body,
    fontWeight: "500",
  },
  discountStateSelected: {
    color: colors.greenDark,
    fontWeight: "700",
  },
  redemptionButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: spacing.sm,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  redemptionButtonRedeemed: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
  },
  redemptionButtonText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  redemptionButtonTextRedeemed: {
    color: colors.amber,
  },
});
