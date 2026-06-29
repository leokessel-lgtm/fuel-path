import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typeScale } from "../theme";
import { MapPoint } from "../types";

export type QuickPlace = {
  key: string;
  kind: "home" | "work" | "recent";
  label: string;
  point: MapPoint;
};

export function QuickPlaceShortcuts({
  onClearRecents,
  onRemoveRecent,
  onSelect,
  places,
  showClearRecents,
}: {
  onClearRecents?: () => void;
  onRemoveRecent?: (point: MapPoint) => void;
  onSelect: (kind: "from" | "to", point: MapPoint) => void;
  places: QuickPlace[];
  showClearRecents: boolean;
}) {
  if (!places.length) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick start</Text>
        {showClearRecents && onClearRecents ? (
          <Pressable
            accessibilityLabel="Clear recent route locations"
            accessibilityRole="button"
            onPress={onClearRecents}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Clear recents</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {places.map((place) => (
          <View key={place.key} style={styles.group}>
            <View style={styles.labelRow}>
              <Text numberOfLines={1} style={styles.label}>
                {place.label}
              </Text>
              {place.kind === "recent" && onRemoveRecent ? (
                <Pressable
                  accessibilityLabel={`Remove recent route location ${place.point.label}`}
                  accessibilityRole="button"
                  onPress={() => onRemoveRecent(place.point)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel={`Use ${place.label} as start`}
                accessibilityRole="button"
                onPress={() => onSelect("from", place.point)}
                style={styles.button}
              >
                <Text style={styles.buttonText}>From</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Use ${place.label} as destination`}
                accessibilityRole="button"
                onPress={() => onSelect("to", place.point)}
                style={styles.button}
              >
                <Text style={styles.buttonText}>To</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  title: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 30,
  },
  clearButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  clearButtonText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "500",
  },
  row: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  group: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: 136,
    padding: spacing.sm,
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
    minHeight: 30,
  },
  label: {
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.caption,
    fontWeight: "600",
    minWidth: 0,
  },
  removeButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 28,
    paddingHorizontal: spacing.sm,
  },
  removeButtonText: {
    color: colors.red,
    fontSize: 10,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  buttonText: {
    color: colors.blue,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
});
