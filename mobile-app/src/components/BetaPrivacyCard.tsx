import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";

export function BetaPrivacyCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Beta evidence</Text>
      <Text style={styles.title}>Behaviour, not tracking</Text>
      <Text style={styles.text}>
        Fuel Path may measure aggregate beta signals like repeat route plans, saved commutes, route watches and navigation opens. It does not need exact Home or Work addresses, route geometry, push tokens or provider secrets for this evidence.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.xs,
    padding: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: typeScale.lead,
    fontWeight: "800",
  },
  text: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
});
