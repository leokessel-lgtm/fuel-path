import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { FuelCode, MapPoint, SavedCommute } from "../types";
import { FuelSelector } from "./FuelSelector";
import { LocationEvidenceChip } from "./LocationEvidenceChip";
import { QuickPlace, QuickPlaceShortcuts } from "./QuickPlaceShortcuts";
import { AddressSuggestions } from "./RouteAddressSuggestions";
import { SavedCommuteShortcuts } from "./SavedCommuteShortcuts";

export function PlanRouteEditorCard({
  activeAddressField,
  canPlanRoute,
  fuel,
  from,
  fromPoint,
  fromSuggestions,
  loading,
  locatingFrom,
  onClearRecentLocations,
  onFromChange,
  onFromFocus,
  onFuelChange,
  onPlanRoute,
  onRemoveRecentLocation,
  onSelectAddressSuggestion,
  onSelectQuickPlace,
  onSelectSavedCommute,
  onToChange,
  onToFocus,
  onUseCurrentFromLocation,
  quickPlaces,
  recentLocationsCount,
  routePrecisionHint,
  savedCommutes,
  showPlanningShortcuts,
  suggestionsError,
  suggestionsLoading,
  to,
  toPoint,
  toSuggestions,
}: {
  activeAddressField: "from" | "to" | null;
  canPlanRoute: boolean;
  fuel: FuelCode;
  from: string;
  fromPoint?: MapPoint;
  fromSuggestions: MapPoint[];
  loading: boolean;
  locatingFrom: boolean;
  onClearRecentLocations?: () => void;
  onFromChange: (value: string) => void;
  onFromFocus: () => void;
  onFuelChange: (fuel: FuelCode) => void;
  onPlanRoute: () => void;
  onRemoveRecentLocation?: (point: MapPoint) => void;
  onSelectAddressSuggestion: (field: "from" | "to", point: MapPoint) => void;
  onSelectQuickPlace: (field: "from" | "to", point: MapPoint) => void;
  onSelectSavedCommute: (commute: SavedCommute) => void;
  onToChange: (value: string) => void;
  onToFocus: () => void;
  onUseCurrentFromLocation: () => void;
  quickPlaces: QuickPlace[];
  recentLocationsCount: number;
  routePrecisionHint: string;
  savedCommutes: SavedCommute[];
  showPlanningShortcuts: boolean;
  suggestionsError: string;
  suggestionsLoading: "from" | "to" | null;
  to: string;
  toPoint?: MapPoint;
  toSuggestions: MapPoint[];
}) {
  return (
    <View style={styles.searchCard}>
      <Text style={styles.eyebrow}>Plan trip</Text>
      {showPlanningShortcuts ? (
        <SavedCommuteShortcuts savedCommutes={savedCommutes} onSelect={onSelectSavedCommute} />
      ) : null}
      {showPlanningShortcuts ? (
        <QuickPlaceShortcuts
          places={quickPlaces}
          onClearRecents={onClearRecentLocations}
          onRemoveRecent={onRemoveRecentLocation}
          onSelect={onSelectQuickPlace}
          showClearRecents={Boolean(recentLocationsCount)}
        />
      ) : null}
      <View style={styles.inputRow}>
        <View style={styles.inputShell}>
          <TextInput
            accessibilityLabel="From"
            value={from}
            onChangeText={onFromChange}
            onFocus={onFromFocus}
            onSubmitEditing={onPlanRoute}
            placeholder="Start address, suburb or place"
            returnKeyType="search"
            style={[styles.input, styles.inputWithIcon]}
          />
          <Pressable
            accessibilityLabel="Use current location as start"
            disabled={locatingFrom}
            hitSlop={8}
            onPress={onUseCurrentFromLocation}
            style={({ pressed }) => [
              styles.currentLocationButton,
              pressed && styles.currentLocationButtonPressed,
              locatingFrom && styles.currentLocationButtonDisabled,
            ]}
          >
            <View style={styles.currentLocationIcon}>
              <View style={styles.currentLocationLineVertical} />
              <View style={styles.currentLocationLineHorizontal} />
              <View style={styles.currentLocationDot} />
            </View>
          </Pressable>
        </View>
        {fromPoint ? (
          <View style={styles.selectedLocationEvidence}>
            <LocationEvidenceChip point={fromPoint} showDetail />
          </View>
        ) : null}
        {activeAddressField === "from" ? (
          <AddressSuggestions
            error={suggestionsError}
            loading={suggestionsLoading === "from"}
            onSelect={(point) => onSelectAddressSuggestion("from", point)}
            query={from}
            suggestions={fromSuggestions}
          />
        ) : null}
        <TextInput
          accessibilityLabel="To"
          value={to}
          onChangeText={onToChange}
          onFocus={onToFocus}
          onSubmitEditing={onPlanRoute}
          placeholder="Destination address, suburb or place"
          returnKeyType="search"
          style={styles.input}
        />
        {toPoint ? (
          <View style={styles.selectedLocationEvidence}>
            <LocationEvidenceChip point={toPoint} showDetail />
          </View>
        ) : null}
        {activeAddressField === "to" ? (
          <AddressSuggestions
            error={suggestionsError}
            loading={suggestionsLoading === "to"}
            onSelect={(point) => onSelectAddressSuggestion("to", point)}
            query={to}
            suggestions={toSuggestions}
          />
        ) : null}
      </View>
      <FuelSelector value={fuel} onChange={onFuelChange} />
      {routePrecisionHint ? (
        <Text style={styles.routePrecisionHint}>{routePrecisionHint}</Text>
      ) : null}
      <Pressable
        accessibilityLabel="Plan route"
        accessibilityRole="button"
        disabled={!canPlanRoute || loading}
        onPress={onPlanRoute}
        style={[
          styles.primaryButton,
          (!canPlanRoute || loading) && styles.primaryButtonDisabled,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {loading ? "Planning..." : "Plan route"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.sm,
    padding: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
  inputRow: {
    gap: spacing.sm,
  },
  inputShell: {
    justifyContent: "center",
    position: "relative",
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "500",
    minHeight: 48,
    padding: spacing.md,
  },
  inputWithIcon: {
    paddingRight: 52,
  },
  selectedLocationEvidence: {
    paddingHorizontal: spacing.xs,
  },
  routePrecisionHint: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    paddingHorizontal: spacing.sm,
  },
  currentLocationButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    bottom: 7,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: spacing.sm,
    top: 7,
    width: 34,
  },
  currentLocationButtonPressed: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  currentLocationButtonDisabled: {
    opacity: 0.55,
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
  primaryButton: {
    ...surfaces.darkAction,
    alignItems: "center",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  primaryButtonDisabled: {
    backgroundColor: "#aeb8b2",
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typeScale.body,
    fontWeight: "700",
  },
});
