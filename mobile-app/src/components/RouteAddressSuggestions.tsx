import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typeScale } from "../theme";
import { MapPoint } from "../types";
import { locationSuggestionDisplay } from "../utils/locationSuggestionDisplay";
import { addressLocalityHint } from "../utils/routeInputPrecision";

export function AddressSuggestions({
  error,
  loading,
  onSelect,
  query,
  suggestions,
}: {
  error: string;
  loading: boolean;
  onSelect: (point: MapPoint) => void;
  query: string;
  suggestions: MapPoint[];
}) {
  const localityHint = !loading && !error && !suggestions.length ? addressLocalityHint(query) : "";
  if (!loading && !error && !suggestions.length && !localityHint) return null;

  return (
    <View style={styles.suggestionPanel}>
      {loading ? <Text style={styles.suggestionStatus}>Searching locations...</Text> : null}
      {!loading && error ? <Text style={styles.suggestionError}>{error}</Text> : null}
      {localityHint ? <Text style={styles.suggestionStatus}>{localityHint}</Text> : null}
      {!loading
        ? suggestions.map((point) => {
            const display = locationSuggestionDisplay(point);
            return (
              <Pressable
                accessibilityLabel={`Use ${point.label}`}
                accessibilityRole="button"
                key={`${point.lat}:${point.lon}:${point.label}`}
                onPress={() => onSelect(point)}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  pressed && styles.suggestionItemPressed,
                ]}
              >
                <View style={styles.suggestionTitleRow}>
                  <Text numberOfLines={1} style={styles.suggestionTitle}>
                    {display.title}
                  </Text>
                  {display.badge ? (
                    <Text numberOfLines={1} style={styles.suggestionBadge}>
                      {display.badge}
                    </Text>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={styles.suggestionMeta}>
                  {display.subtitle}
                </Text>
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestionPanel: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 1,
    overflow: "hidden",
  },
  suggestionItem: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionItemPressed: {
    backgroundColor: colors.greenSoft,
  },
  suggestionTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.body,
    fontWeight: "600",
    minWidth: 0,
  },
  suggestionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minWidth: 0,
  },
  suggestionBadge: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.sm,
    color: colors.greenDark,
    flexShrink: 0,
    fontSize: typeScale.micro,
    fontWeight: "700",
    maxWidth: 112,
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  suggestionMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    marginTop: 2,
  },
  suggestionStatus: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    padding: spacing.md,
  },
  suggestionError: {
    color: colors.red,
    fontSize: typeScale.caption,
    fontWeight: "500",
    padding: spacing.md,
  },
});
