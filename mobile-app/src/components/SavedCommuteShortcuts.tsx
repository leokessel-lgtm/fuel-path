import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { colors, radii, spacing, typeScale } from "../theme";
import { SavedCommute } from "../types";

export function SavedCommuteShortcuts({
  onSelect,
  savedCommutes,
}: {
  onSelect: (commute: SavedCommute) => void;
  savedCommutes: SavedCommute[];
}) {
  if (!savedCommutes.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {savedCommutes.map((commute) => (
        <Pressable
          accessibilityLabel={`Use saved commute ${commute.name}`}
          accessibilityRole="button"
          key={commute.id}
          onPress={() => onSelect(commute)}
          style={({ pressed }) => [
            styles.chip,
            pressed && styles.chipPressed,
          ]}
        >
          <Text numberOfLines={1} style={styles.name}>
            {commute.name}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {commute.fuel} | {commute.alertEnabled ? "Watching route" : "Not watching"}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  chip: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: 156,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipPressed: {
    backgroundColor: colors.white,
  },
  name: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  meta: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: "400",
    marginTop: 2,
  },
});
