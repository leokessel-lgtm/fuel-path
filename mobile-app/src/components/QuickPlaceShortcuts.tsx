import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, surfaces, typography } from "../theme";
import { MapPoint } from "../types";
import { locationSuggestionDisplay } from "../utils/locationSuggestionDisplay";

export type QuickPlace = {
  key: string;
  kind: "home" | "work" | "recent";
  label: string;
  point: MapPoint;
};

export function QuickPlaceShortcuts({
  onSelect,
  onSelectStart,
  onRemoveRecent,
  targetField,
  places,
}: {
  onSelect: (kind: "from" | "to", point: MapPoint) => void;
  onSelectStart?: () => void;
  onRemoveRecent?: (point: MapPoint) => void;
  targetField?: "from" | "to";
  places: QuickPlace[];
}) {
  if (!places.length) return null;
  const targetLabel = targetField === "to" ? "destination" : "start";

  return (
    <View style={styles.panel}>
      <View style={styles.list}>
        {places.map((place, index) => {
          const display = locationSuggestionDisplay(place.point);
          return (
            <View key={place.key}>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${targetLabel} ${place.label}`}
                  onPressIn={onSelectStart}
                  onPress={() => onSelect(targetField || "from", place.point)}
                  style={styles.placeButton}
                >
                  <View style={place.kind === "home" || place.kind === "work" ? styles.pin : styles.dot} />
                  <View style={styles.texts}>
                    <Text numberOfLines={1} style={styles.titleText}>
                      {display.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.metaText}>
                      {display.subtitle}
                    </Text>
                  </View>
                </Pressable>
                {place.kind === "recent" && onRemoveRecent ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear recent route locations"
                    onPress={() => onRemoveRecent(place.point)}
                    style={styles.recentClearButton}
                  >
                    <Text numberOfLines={1} style={styles.recentClearText}>
                      Clear
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {index < places.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  list: {
    backgroundColor: colors.white,
  },
  row: {
    alignItems: "center",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingRight: spacing.xs,
    gap: spacing.sm,
  },
  placeButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  recentClearButton: {
    alignItems: "center",
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  divider: {
    backgroundColor: colors.line,
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md,
  },
  texts: {
    flex: 1,
    minWidth: 0,
  },
  titleText: {
    ...typography.bodyStrong,
    minWidth: 0,
  },
  metaText: {
    ...typography.metadata,
    marginTop: 2,
  },
  pin: {
    ...surfaces.secondaryAction,
    backgroundColor: colors.green,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderBottomLeftRadius: 3,
    borderWidth: 2,
    height: 15,
    transform: [{ rotate: "-45deg" }],
    width: 15,
  },
  dot: {
    ...surfaces.secondaryAction,
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 12,
    width: 12,
  },
  recentClearText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
  },
});
