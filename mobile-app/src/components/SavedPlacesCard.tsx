import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { MapPoint, SavedCommute } from "../types";
import { SavedPlaceEditor } from "./SavedPlaceEditor";

export function SavedPlacesCard({
  homeLocation,
  savedCommutes,
  workLocation,
  onClearNamedPlace,
  onSaveNamedPlace,
}: {
  homeLocation?: MapPoint;
  savedCommutes: SavedCommute[];
  workLocation?: MapPoint;
  onClearNamedPlace: (kind: "home" | "work") => void;
  onSaveNamedPlace: (kind: "home" | "work", point: MapPoint) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Saved places</Text>
      <Text style={styles.title}>Home and work</Text>
      <Text style={styles.muted}>
        Set these once, then use them as shortcuts in Plan Trip.
      </Text>
      <SavedPlaceEditor
        kind="home"
        label="Home"
        onClear={() => onClearNamedPlace("home")}
        onSave={(point) => onSaveNamedPlace("home", point)}
        point={homeLocation}
      />
      <SavedPlaceEditor
        kind="work"
        label="Work"
        onClear={() => onClearNamedPlace("work")}
        onSave={(point) => onSaveNamedPlace("work", point)}
        point={workLocation}
      />
      {savedCommutes.length ? (
        <View style={styles.savedPlaceActions}>
          {savedCommutes.slice(0, 3).map((commute) => (
            <View key={commute.id} style={styles.savedPlaceCommute}>
              <Text numberOfLines={1} style={styles.savedPlaceCommuteTitle}>
                {commute.name}
              </Text>
              <View style={styles.savedPlaceButtonRow}>
                <Pressable
                  accessibilityLabel={`Save ${commute.from.label} as home`}
                  accessibilityRole="button"
                  onPress={() => onSaveNamedPlace("home", commute.from)}
                  style={styles.savedPlaceMiniButton}
                >
                  <Text style={styles.savedPlaceMiniButtonText}>Home</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Save ${commute.to.label} as work`}
                  accessibilityRole="button"
                  onPress={() => onSaveNamedPlace("work", commute.to)}
                  style={styles.savedPlaceMiniButton}
                >
                  <Text style={styles.savedPlaceMiniButtonText}>Work</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}
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
  savedPlaceActions: {
    gap: spacing.sm,
  },
  savedPlaceCommute: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  savedPlaceCommuteTitle: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  savedPlaceButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  savedPlaceMiniButton: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  savedPlaceMiniButtonText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
});
