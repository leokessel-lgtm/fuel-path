import { Pressable, StyleSheet, Text } from "react-native";

import { colors, spacing } from "../theme";

export function StationBrandFilterPill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={active ? "Show all station brands once" : "Use preferred station brands"}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.brandFilterPill, active && styles.brandFilterPillActive]}
    >
      <Text style={[styles.brandFilterText, active && styles.brandFilterTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brandFilterPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  brandFilterPillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  brandFilterText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  brandFilterTextActive: {
    color: colors.white,
  },
});
