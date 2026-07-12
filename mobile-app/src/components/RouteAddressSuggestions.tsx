import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, surfaces, typography } from "../theme";
import { MapPoint } from "../types";
import { locationSuggestionDisplay } from "../utils/locationSuggestionDisplay";
import { addressLocalityHint } from "../utils/routeInputPrecision";

export function AddressSuggestions({
  error,
  loading,
  onSelect,
  onSelectStart,
  query,
  suggestions,
}: {
  error: string;
  loading: boolean;
  onSelect: (point: MapPoint) => void;
  onSelectStart?: () => void;
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
        ? (
          <ScrollView
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            showsVerticalScrollIndicator={suggestions.length > 3}
            style={styles.suggestionScroll}
          >
            {suggestions.map((point) => {
              const display = locationSuggestionDisplay(point);
              return (
                <View key={`${point.lat}:${point.lon}:${point.label}`}>
                  <Pressable
                    accessibilityLabel={`Use ${point.label}`}
                    accessibilityRole="button"
                    onPressIn={onSelectStart}
                    onPress={() => onSelect(point)}
                    style={styles.suggestionRow}
                  >
                    <View style={styles.lookupResultPin} />
                    <View style={styles.suggestionCopy}>
                      <Text numberOfLines={1} style={styles.suggestionTitle}>
                        {display.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.suggestionMeta}>
                        {display.subtitle}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.suggestionDivider} />
                </View>
              );
            })}
          </ScrollView>
        )
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
  suggestionScroll: {
    maxHeight: 204,
  },
  suggestionItem: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionItemPressed: {
    backgroundColor: colors.greenSoft,
  },
  suggestionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  suggestionCopy: {
    flex: 1,
    minWidth: 0,
  },
  suggestionTitle: {
    ...typography.bodyStrong,
    minWidth: 0,
  },
  suggestionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minWidth: 0,
  },
  suggestionMeta: {
    ...typography.metadata,
    marginTop: 2,
  },
  suggestionDivider: {
    backgroundColor: colors.line,
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md,
  },
  suggestionStatus: {
    ...typography.metadata,
    padding: spacing.sm,
  },
  suggestionError: {
    ...typography.metadata,
    color: colors.red,
    padding: spacing.sm,
  },
  lookupResultPin: {
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
});
