import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";

export function PlanRouteSummaryCard({
  policyActive,
  routeSummary,
  onPress,
}: {
  policyActive: boolean;
  routeSummary: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel="Edit planned route"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.routeSummaryCard}
    >
      <View style={styles.routeSummaryMain}>
        <Text numberOfLines={1} style={styles.routeSummaryTitle}>
          {routeSummary}
        </Text>
        {policyActive ? (
          <Text numberOfLines={1} style={styles.routeSummaryMeta}>
            Policy applies
          </Text>
        ) : null}
      </View>
      <Text style={styles.editChip}>Edit</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  routeSummaryCard: {
    ...shadow.float,
    ...surfaces.floating,
    alignItems: "center",
    borderRadius: radii.xxl,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 66,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  routeSummaryMain: {
    flex: 1,
    minWidth: 0,
  },
  routeSummaryTitle: {
    ...typography.bodyStrong,
  },
  routeSummaryMeta: {
    ...typography.bodyMuted,
    marginTop: 2,
  },
  editChip: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
