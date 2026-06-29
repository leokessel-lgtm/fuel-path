import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typeScale } from "../theme";
import { MapPoint } from "../types";
import { locationSuggestionDisplay } from "../utils/locationSuggestionDisplay";

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

export function routeInputPrecisionHint(kind: "destination" | "start", query: string) {
  const text = query.trim();
  if (!addressLikeInput(text)) return "";
  if (addressHasNarrowingContext(text)) {
    if (kind === "start") return "Choose a start suggestion to confirm this address.";
    return "Choose a destination suggestion to confirm this address.";
  }
  if (kind === "start") {
    return "Choose a start suggestion, or add suburb or postcode before planning.";
  }
  return "Choose a destination suggestion, or add suburb or postcode before planning.";
}

function addressLocalityHint(query: string) {
  const text = query.trim();
  if (text.length < 8) return "";
  if (!addressLikeInput(text)) return "";
  if (addressHasNarrowingContext(text)) return "";
  if (/\b(street|st|road|rd|avenue|ave|drive|dr|highway|hwy|terrace|tce|circuit|cct|way|lane|ln|place|pl|court|ct|crescent|cres|boulevard|bvd|blvd|parade|pde|parkway|pkwy|pwy|esplanade|esp|square|sq)\b/i.test(text)) {
    return "Street found. Add suburb or postcode to choose the right area.";
  }
  return "Add suburb or postcode to narrow the address.";
}

function addressLikeInput(query: string) {
  const text = query.trim();
  const hasStreetType = /\b(street|st|road|rd|avenue|ave|drive|dr|highway|hwy|terrace|tce|circuit|cct|way|lane|ln|place|pl|court|ct|crescent|cres|boulevard|bvd|blvd|parade|pde|parkway|pkwy|pwy|esplanade|esp|square|sq)\b/i.test(text);
  const hasLeadingAddressToken = /^(?:unit|apt|apartment|flat|suite|townhouse)?\s*\d+[a-z]?(?:\/\d+[a-z]?)?\s+[a-z]/i.test(text);
  return hasStreetType || hasLeadingAddressToken;
}

function addressHasNarrowingContext(query: string) {
  const text = query.trim();
  if (/\b\d{4}\b/.test(text)) return true;
  return hasAddressLocalityContext(text);
}

function hasAddressLocalityContext(query: string) {
  const withoutState = query
    .replace(/\b(nsw|act|qld|vic|wa|sa|tas|nt)\b/gi, " ")
    .replace(/\b\d+[a-z]?(?:\/\d+[a-z]?)?\b/gi, " ")
    .replace(/\b(unit|apt|apartment|flat|suite|townhouse)\b/gi, " ")
    .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|highway|hwy|terrace|tce|circuit|cct|way|lane|ln|place|pl|court|ct|crescent|cres|boulevard|bvd|blvd|parade|pde|parkway|pkwy|pwy|esplanade|esp|square|sq)\b/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
  const words = withoutState.split(" ").filter((word) => word.length >= 3);
  return words.length >= 2;
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
