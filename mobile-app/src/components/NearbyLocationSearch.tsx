import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { MapPoint } from "../types";
import { locationSuggestionDisplay } from "../utils/locationSuggestionDisplay";
import { CurrentLocationFieldButton, currentLocationFieldInset } from "./CurrentLocationFieldButton";

export function NearbyLocationSearch({
  locationError,
  onActivateSearch,
  onBeginSelection,
  onBlur,
  locationQuery,
  locationSearchActive,
  locationSuggestions,
  onSelectQuickLocation,
  onApplyLocationSearch,
  onQueryChange,
  onSelectSuggestion,
  onUseCurrentLocation,
  quickLocations,
  resolvingLocation,
  suggestionsLoading,
}: {
  locationError: string;
  onActivateSearch: () => void;
  onBeginSelection: () => void;
  onBlur: () => void;
  locationQuery: string;
  locationSearchActive: boolean;
  locationSuggestions: MapPoint[];
  onSelectQuickLocation: (location: MapPoint) => void;
  onApplyLocationSearch: () => void;
  onQueryChange: (value: string) => void;
  onSelectSuggestion: (location: MapPoint) => void;
  onUseCurrentLocation: () => void;
  quickLocations: Array<MapPoint & { kind: "home" | "work" | "recent" }>;
  resolvingLocation: boolean;
  suggestionsLoading: boolean;
}) {
  const lookupActive = suggestionsLoading || locationSuggestions.length > 0;
  return (
    <View style={styles.locationCard}>
      <View style={styles.locationInputRow}>
        <View style={styles.inputShell}>
          <TextInput
            accessibilityLabel="Nearby location"
            value={locationQuery}
            onChangeText={onQueryChange}
            onFocus={onActivateSearch}
            onBlur={onBlur}
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
        {locationQuery.trim() ? (
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
      {locationSearchActive && locationSuggestions.length > 0 ? (
        <View style={styles.lookupResults}>
          {suggestionsLoading ? (
            <Text style={styles.lookupLoading}>Searching...</Text>
          ) : null}
          {locationSuggestions.map((location) => (
            <LocationResultRow
              key={`${location.lat}:${location.lon}:${location.label}`}
              location={location}
              onPressIn={onBeginSelection}
              onPress={() => onSelectSuggestion(location)}
              kind="suggestion"
            />
          ))}
        </View>
      ) : null}
          {locationSearchActive && quickLocations.length && !lookupActive ? (
            <View style={styles.lookupResults}>
              {suggestionsLoading ? (
                <Text style={styles.lookupLoading}>Searching...</Text>
              ) : null}
              {quickLocations.map((location) => (
            <LocationResultRow
              key={`${location.lat}:${location.lon}:${location.label}`}
              location={location}
              onPressIn={onBeginSelection}
              onPress={() => onSelectQuickLocation(location)}
              kind={location.kind}
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
  onPressIn,
  onPress,
  kind,
}: {
  location: MapPoint;
  onPressIn: () => void;
  onPress: () => void;
  kind: "home" | "work" | "recent" | "suggestion";
}) {
  const display = locationSuggestionDisplay(location);
  const iconStyle = kind === "suggestion" ? styles.lookupResultPin : styles.recentSearchDot;
  const label = kind === "home" ? "Home" : kind === "work" ? "Work" : kind === "recent" ? "Recent" : "Search";
  return (
    <Pressable
      accessibilityLabel={`Use ${label.toLowerCase()} location ${location.label}`}
      onPressIn={onPressIn}
      onPress={onPress}
      style={styles.lookupResultRow}
    >
      <View style={iconStyle} />
      <View style={styles.lookupResultCopy}>
        <Text numberOfLines={1} style={styles.lookupResultTitle}>
          {display.title}
        </Text>
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
    borderRadius: radii.control,
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
    ...surfaces.field,
    ...typography.fieldText,
    borderRadius: radii.control,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  locationInputWithIcon: {
    paddingRight: currentLocationFieldInset,
  },
  locationButton: {
    ...surfaces.secondaryAction,
    alignItems: "center",
    borderRadius: radii.control,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  locationButtonText: {
    ...typography.compactButtonLabel,
    color: colors.greenDark,
  },
  lookupResults: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  lookupLoading: {
    ...typography.metadata,
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
    ...typography.bodyStrong,
    flex: 1,
  },
  lookupResultMeta: {
    ...typography.metadata,
    fontSize: 11,
    marginTop: 1,
  },
  locationError: {
    color: colors.red,
    fontSize: 11,
    fontWeight: typography.metadataStrong.fontWeight,
  },
});
