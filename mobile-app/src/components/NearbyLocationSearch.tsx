import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale } from "../theme";
import { MapPoint } from "../types";
import { locationSuggestionDisplay } from "../utils/locationSuggestionDisplay";
import { CurrentLocationFieldButton, currentLocationFieldInset } from "./CurrentLocationFieldButton";

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
          <CurrentLocationFieldButton
            accessibilityLabel="Use current location"
            disabled={resolvingLocation}
            onPress={onUseCurrentLocation}
          />
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
  const display = locationSuggestionDisplay(location);
  return (
    <Pressable
      accessibilityLabel={recent ? `Use recent search ${location.label}` : `Use suggested location ${location.label}`}
      onPress={onPress}
      style={styles.lookupResultRow}
    >
      <View style={recent ? styles.recentSearchDot : styles.lookupResultPin} />
      <View style={styles.lookupResultCopy}>
        <Text numberOfLines={1} style={styles.lookupResultTitle}>
          {display.title}
        </Text>
        {display.badge ? (
          <Text numberOfLines={1} style={styles.lookupResultBadge}>
            {display.badge}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={styles.lookupResultMeta}>
          {display.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  locationCard: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.xs,
    padding: spacing.xs,
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
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  locationInputWithIcon: {
    paddingRight: currentLocationFieldInset,
  },
  locationButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 44,
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
  lookupResultBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.greenSoft,
    borderRadius: radii.sm,
    color: colors.greenDark,
    fontSize: typeScale.micro,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: 112,
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  lookupResultMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "400",
    marginTop: 1,
  },
  locationError: {
    color: colors.red,
    fontSize: 11,
    fontWeight: "500",
  },
});
