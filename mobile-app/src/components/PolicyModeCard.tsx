import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { AppPreferences } from "../types";

const POLICY_BRAND_OPTIONS = ["Ampol", "BP", "Caltex", "Shell", "7-Eleven", "United", "Metro"];

export function PolicyModeCard({
  preferences,
  onToggleFuelPolicy,
  onTogglePolicyBrand,
}: {
  preferences: AppPreferences;
  onToggleFuelPolicy: () => void;
  onTogglePolicyBrand: (brand: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Policy mode</Text>
      <Text style={styles.title}>Approved fuel stops</Text>
      <Text style={styles.muted}>
        Filter route recommendations to the brands your work vehicle, fleet card or allowance can use.
      </Text>
      <Pressable
        accessibilityLabel={preferences.fuelPolicyEnabled ? "Turn fuel policy mode off" : "Turn fuel policy mode on"}
        accessibilityRole="switch"
        accessibilityState={{ checked: preferences.fuelPolicyEnabled }}
        onPress={onToggleFuelPolicy}
        style={[styles.policySwitch, preferences.fuelPolicyEnabled && styles.policySwitchOn]}
      >
        <View>
          <Text style={styles.policySwitchTitle}>
            {preferences.fuelPolicyEnabled ? "Policy active" : "Policy off"}
          </Text>
          <Text style={styles.muted}>
            {preferences.fuelPolicyEnabled
              ? `${preferences.approvedPolicyBrands.length} approved brands`
              : "Route scoring can use any eligible station."}
          </Text>
        </View>
        <Text style={[styles.policySwitchState, preferences.fuelPolicyEnabled && styles.policySwitchStateOn]}>
          {preferences.fuelPolicyEnabled ? "On" : "Off"}
        </Text>
      </Pressable>
      <View style={styles.policyBrandGrid}>
        {POLICY_BRAND_OPTIONS.map((brand) => {
          const selected = preferences.approvedPolicyBrands.includes(brand);
          return (
            <Pressable
              accessibilityLabel={`${selected ? "Remove" : "Approve"} ${brand}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={brand}
              onPress={() => onTogglePolicyBrand(brand)}
              style={[styles.policyBrandChip, selected && styles.policyBrandChipSelected]}
            >
              <Text style={[styles.policyBrandChipText, selected && styles.policyBrandChipTextSelected]}>
                {brand}
              </Text>
            </Pressable>
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
  policySwitch: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 62,
    padding: spacing.md,
  },
  policySwitchOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  policySwitchTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "700",
  },
  policySwitchState: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  policySwitchStateOn: {
    color: colors.greenDark,
  },
  policyBrandGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  policyBrandChip: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 82,
    paddingHorizontal: spacing.md,
  },
  policyBrandChipSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  policyBrandChipText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  policyBrandChipTextSelected: {
    color: colors.greenDark,
    fontWeight: "700",
  },
});
