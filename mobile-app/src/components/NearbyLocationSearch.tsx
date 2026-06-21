import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale } from "../theme";
import { MapPoint } from "../types";

export function NearbyLocationSearch({
  locationError,
  locationQuery,
  locationSearchActive,
  locationSuggestions,
  onApplyLocationSearch,
  onQueryChange,
  onSelectRecentLocation,
  onSelectSuggestion,
  onUseCurrentLocation,
  recentLocations,
  resolvingLocation,
  suggestionsLoading,
}: {
  locationError: string;
  locationQuery: string;
  locationSearchActive: boolean;
  locationSuggestions: MapPoint[];
  onApplyLocationSearch: () => void;
  onQueryChange: (value: string) => void;
  onSelectRecentLocation: (location: MapPoint) => void;
  onSelectSuggestion: (location: MapPoint) => void;
  onUseCurrentLocation: () => void;
  recentLocations: MapPoint[];
  resolvingLocation: boolean;
  suggestionsLoading: boolean;
}) {
  return (
    <View style={styles.locationCard}>
      <View style={styles.locationInputRow}>
        <View style={styles.inputShell}>
          <TextInput
            accessibilityLabel="Nearby location"
            value={locationQuery}
            onChangeText={onQueryChange}
            onFocus={() => onQueryChange(locationQuery)}
            onSubmitEditing={onApplyLocationSearch}
            placeholder="Search address, suburb or place"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={[styles.locationInput, styles.locationInputWithIcon]}
          />
          <Pressable
            accessibilityLabel="Use current location"
            onPress={onUseCurrentLocation}
            disabled={resolvingLocation}
            hitSlop={8}
            style={({ pressed }) => [
              styles.currentLocationButton,
              pressed && styles.currentLocationButtonPressed,
              resolvingLocation && styles.buttonDisabled,
            ]}
          >
            <View style={styles.currentLocationIcon}>
              <View style={styles.currentLocationLineVertical} />
              <View style={styles.currentLocationLineHorizontal} />
              <View style={styles.currentLocationDot} />
            </View>
          </Pressable>
        </View>
        {locationQuery.trim() || resolvingLocation ? (
          <Pressable
            accessibilityLabel="Find nearby location"
            onPress={onApplyLocationSearch}
            disabled={resolvingLocation}
            style={[styles.locationButton, resolvingLocation && styles.buttonDisabled]}
          >
            <Text style={styles.locationButtonText}>
              {resolvingLocation ? "..." : "Find"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {locationSearchActive && locationQuery.trim().length >= 3 ? (
        <View style={styles.lookupResults}>
          {suggestionsLoading ? (
            <Text style={styles.lookupLoading}>Searching...</Text>
          ) : null}
          {locationSuggestions.map((location) => (
            <LocationResultRow
              key={`${location.lat}:${location.lon}:${location.label}`}
              location={location}
              onPress={() => onSelectSuggestion(location)}
              recent={false}
            />
          ))}
        </View>
      ) : null}
      {locationSearchActive && !locationQuery.trim() && recentLocations.length ? (
        <View style={styles.lookupResults}>
          {recentLocations.map((location) => (
            <LocationResultRow
              key={`${location.lat}:${location.lon}:${location.label}`}
              location={location}
              onPress={() => onSelectRecentLocation(location)}
              recent
            />
          ))}
        </View>
      ) : null}
      {locationError ? <Text style={styles.locationError}>{locationError}</Text> : null}
    </View>
  );
}

function LocationResultRow({
  location,
  onPress,
  recent,
}: {
  location: MapPoint;
  onPress: () => void;
  recent: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={recent ? `Use recent search ${location.label}` : `Use suggested location ${location.label}`}
      onPress={onPress}
      style={styles.lookupResultRow}
    >
      <View style={recent ? styles.recentSearchDot : styles.lookupResultPin} />
      <View style={styles.lookupResultCopy}>
        <Text numberOfLines={1} style={styles.lookupResultTitle}>
          {suggestionTitle(location)}
        </Text>
        <Text numberOfLines={1} style={styles.lookupResultMeta}>
          {suggestionMeta(location)}
        </Text>
      </View>
    </Pressable>
  );
}

function suggestionTitle(point: MapPoint) {
  const parts = suggestionParts(point);
  if (titleConsumesStreetNumber(parts)) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] || point.label;
}

function suggestionMeta(point: MapPoint) {
  const parts = suggestionParts(point);
  const startIndex = titleConsumesStreetNumber(parts) ? 2 : 1;
  return parts.slice(startIndex, startIndex + 3).join(", ") || "Australia";
}

function suggestionParts(point: MapPoint) {
  return point.label.split(",").map((part) => part.trim()).filter(Boolean);
}

function titleConsumesStreetNumber(parts: string[]) {
  return Boolean(parts[1] && isStreetNumberFragment(parts[0]));
}

function isStreetNumberFragment(value: string) {
  return /^\d+[a-z]?(?:[/-]\d+[a-z]?)?$/i.test(value.trim());
}

const styles = StyleSheet.create({
  locationCard: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  locationInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  inputShell: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
    position: "relative",
  },
  locationInput: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.body,
    fontWeight: "500",
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  locationInputWithIcon: {
    paddingRight: 52,
  },
  locationButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  locationButtonText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  lookupResults: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  lookupLoading: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  lookupResultRow: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recentSearchDot: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 12,
    width: 12,
  },
  lookupResultPin: {
    backgroundColor: colors.green,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderBottomLeftRadius: 3,
    borderWidth: 2,
    height: 15,
    transform: [{ rotate: "-45deg" }],
    width: 15,
  },
  lookupResultCopy: {
    flex: 1,
    minWidth: 0,
  },
  lookupResultTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  lookupResultMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "400",
    marginTop: 1,
  },
  currentLocationButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    bottom: 4,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: spacing.xs,
    top: 4,
    width: 34,
  },
  currentLocationButtonPressed: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  currentLocationIcon: {
    alignItems: "center",
    borderColor: colors.green,
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  currentLocationLineVertical: {
    backgroundColor: colors.green,
    height: 24,
    position: "absolute",
    width: 2,
  },
  currentLocationLineHorizontal: {
    backgroundColor: colors.green,
    height: 2,
    position: "absolute",
    width: 24,
  },
  currentLocationDot: {
    backgroundColor: colors.green,
    borderColor: colors.white,
    borderRadius: 4,
    borderWidth: 1,
    height: 8,
    width: 8,
  },
  locationError: {
    color: colors.red,
    fontSize: 11,
    fontWeight: "500",
  },
});
