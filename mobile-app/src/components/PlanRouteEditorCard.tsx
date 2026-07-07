import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale } from "../theme";
import { FuelCode, MapPoint, SavedCommute, VehicleEnergyType } from "../types";
import { CurrentLocationFieldButton, currentLocationFieldInset } from "./CurrentLocationFieldButton";
import { NearbyEnergyChoice, NearbyEnergySelector } from "./NearbyEvControls";
import { QuickPlace, QuickPlaceShortcuts } from "./QuickPlaceShortcuts";
import { AddressSuggestions } from "./RouteAddressSuggestions";
import { SavedCommuteShortcuts } from "./SavedCommuteShortcuts";

export function PlanRouteEditorCard({
  activeAddressField,
  canPlanRoute,
  maxHeight,
  fuel,
  from,
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
  onVehicleEnergyTypeChange,
  quickPlaces,
  recentLocationsCount,
  routePrecisionHint,
  routeError,
  routePlanningBlocked,
  savedCommutes,
  showPlanningShortcuts,
  suggestionsError,
  suggestionsLoading,
  to,
  toSuggestions,
  vehicleEnergyType,
  vehicleRouteNotice,
}: {
  activeAddressField: "from" | "to" | null;
  canPlanRoute: boolean;
  maxHeight?: number;
  fuel: FuelCode;
  from: string;
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
  onVehicleEnergyTypeChange: (vehicleEnergyType: VehicleEnergyType) => void;
  quickPlaces: QuickPlace[];
  recentLocationsCount: number;
  routePrecisionHint: string;
  routeError: string;
  routePlanningBlocked: boolean;
  savedCommutes: SavedCommute[];
  showPlanningShortcuts: boolean;
  suggestionsError: string;
  suggestionsLoading: "from" | "to" | null;
  to: string;
  toSuggestions: MapPoint[];
  vehicleEnergyType: VehicleEnergyType;
  vehicleRouteNotice: string;
}) {
  const showFuelSelector = true;
  const [fuelSelectorOpen, setFuelSelectorOpen] = useState(false);
  const handleEnergyChange = (value: NearbyEnergyChoice) => {
    setFuelSelectorOpen(false);
    if (value === "EV") {
      onVehicleEnergyTypeChange("electric");
      return;
    }
    onVehicleEnergyTypeChange(value === "DL" || value === "PDL" ? "diesel" : "petrol");
    onFuelChange(value);
  };
  const primaryLabel =
    vehicleEnergyType === "electric"
      ? loading
        ? "Checking..."
        : "Check route range"
      : loading
        ? "Planning..."
        : "Plan route";

  return (
    <View style={[styles.searchCard, maxHeight ? { maxHeight } : null]}>
      <ScrollView
        contentContainerStyle={styles.searchCardContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {vehicleRouteNotice ? (
          <View style={styles.routeNoticeCard}>
            <Text style={styles.routeNoticeText}>{vehicleRouteNotice}</Text>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <View style={styles.inputShell}>
            <TextInput
              accessibilityLabel="From"
              value={from}
              onChangeText={onFromChange}
              onFocus={onFromFocus}
              onPressIn={onFromFocus}
              onSubmitEditing={onPlanRoute}
              placeholder="Start address, suburb or place"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={[styles.input, styles.inputWithIcon]}
            />
            <CurrentLocationFieldButton
              accessibilityLabel="Use current location as start"
              disabled={locatingFrom}
              onPress={onUseCurrentFromLocation}
            />
          </View>
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
            onPressIn={onToFocus}
            onSubmitEditing={onPlanRoute}
            placeholder="Destination address, suburb or place"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.input}
          />
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
        {showFuelSelector ? (
          <NearbyEnergySelector
            eyebrow="Plan with"
            includeEv
            onChange={handleEnergyChange}
            onToggleOpen={() => setFuelSelectorOpen((current) => !current)}
            open={fuelSelectorOpen}
            value={vehicleEnergyType === "electric" ? "EV" : fuel}
          />
        ) : null}
        {routePrecisionHint ? (
          <Text style={styles.routePrecisionHint}>{routePrecisionHint}</Text>
        ) : null}
        {routeError ? (
          <Text accessibilityRole="alert" style={styles.routeError}>
            {routeError}
          </Text>
        ) : null}
        <Pressable
          accessibilityLabel="Plan route"
          accessibilityRole="button"
          disabled={!canPlanRoute || loading || routePlanningBlocked}
          onPress={onPlanRoute}
          style={[
            styles.primaryButton,
            (!canPlanRoute || loading || routePlanningBlocked) && styles.primaryButtonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>{routePlanningBlocked ? "Route charging coming soon" : primaryLabel}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.control,
    overflow: "hidden",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  searchCardContent: {
    gap: spacing.xs,
  },
  routeNoticeCard: {
    ...surfaces.field,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  routeNoticeText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "600",
    lineHeight: 18,
  },
  inputRow: {
    gap: spacing.sm,
  },
  inputShell: {
    justifyContent: "center",
    position: "relative",
  },
  input: {
    ...surfaces.field,
    borderRadius: radii.control,
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "500",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  inputWithIcon: {
    paddingRight: currentLocationFieldInset,
  },
  routePrecisionHint: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    paddingHorizontal: spacing.sm,
  },
  routeError: {
    color: colors.red,
    fontSize: typeScale.caption,
    fontWeight: "600",
    paddingHorizontal: spacing.sm,
  },
  primaryButton: {
    ...surfaces.darkAction,
    alignItems: "center",
    borderRadius: radii.control,
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
