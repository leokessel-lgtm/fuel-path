import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale } from "../theme";
import { MapPoint } from "../types";
import { LocationEvidenceChip } from "./LocationEvidenceChip";

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
    <View style={styles.searchControlRow}>
      <View style={styles.locationCard}>
        <View style={styles.locationInputRow}>
          <TextInput
            accessibilityLabel="Nearby location"
            value={locationQuery}
            onChangeText={onQueryChange}
            onFocus={() => onQueryChange(locationQuery)}
            onSubmitEditing={onApplyLocationSearch}
            placeholder="Search address, suburb or place"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.locationInput}
          />
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
      <Pressable
        accessibilityLabel="Use current location"
        onPress={onUseCurrentLocation}
        disabled={resolvingLocation}
        style={({ pressed }) => [
          styles.currentLocationPill,
          pressed && styles.currentLocationPillPressed,
          resolvingLocation && styles.buttonDisabled,
        ]}
      >
        <View style={styles.currentLocationIcon}>
          <View style={styles.currentLocationCrossVertical} />
          <View style={styles.currentLocationCrossHorizontal} />
          <View style={styles.currentLocationRing} />
          <View style={styles.currentLocationDot} />
        </View>
      </Pressable>
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
        <View style={styles.lookupResultEvidence}>
          <LocationEvidenceChip point={location} showDetail={!recent && suggestionNeedsPrecisionDetail(location)} />
        </View>
      </View>
    </Pressable>
  );
}

function suggestionTitle(point: MapPoint) {
  return point.label.split(",")[0]?.trim() || point.label;
}

function suggestionMeta(point: MapPoint) {
  const parts = point.label.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(1, 4).join(", ") || "Australia";
}

function suggestionNeedsPrecisionDetail(point: MapPoint) {
  return point.sourceLabel === "Needs confirmation" || point.sourceLabel === "Street/area only";
}

const styles = StyleSheet.create({
  searchControlRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  locationCard: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    flex: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  locationInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
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
  lookupResultEvidence: {
    marginTop: spacing.xs,
  },
  currentLocationPill: {
    ...shadow.float,
    ...surfaces.floating,
    alignItems: "center",
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 50,
  },
  currentLocationPillPressed: {
    opacity: 0.82,
  },
  currentLocationIcon: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    position: "relative",
    width: 24,
  },
  currentLocationCrossVertical: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: 24,
    position: "absolute",
    width: 2,
  },
  currentLocationCrossHorizontal: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: 2,
    position: "absolute",
    width: 24,
  },
  currentLocationRing: {
    backgroundColor: colors.white,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 16,
    position: "absolute",
    width: 16,
  },
  currentLocationDot: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: 6,
    position: "absolute",
    width: 6,
  },
  locationError: {
    color: colors.red,
    fontSize: 11,
    fontWeight: "500",
  },
});
