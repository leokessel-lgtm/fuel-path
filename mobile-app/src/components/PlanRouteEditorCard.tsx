import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { EvConnector, FuelCode, MapPoint, SavedCommute, VehicleEnergyType } from "../types";
import { NearbyEnergyChoice, NearbyEnergySelector } from "./NearbyEvControls";
import { QuickPlace, QuickPlaceShortcuts } from "./QuickPlaceShortcuts";
import { AddressSuggestions } from "./RouteAddressSuggestions";
import { SavedCommuteShortcuts } from "./SavedCommuteShortcuts";

export function PlanRouteEditorCard({
  activeAddressField,
  canPlanRoute,
  evConnectors,
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
  vehicleSummary,
}: {
  activeAddressField: "from" | "to" | null;
  canPlanRoute: boolean;
  evConnectors: EvConnector[];
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
  vehicleSummary: string;
}) {
  const showFuelSelector = vehicleEnergyType !== "electric";
  const [fuelSelectorOpen, setFuelSelectorOpen] = useState(false);
  const selectedConnectors = evConnectors.length ? evConnectors.join(", ") : "connector not set";
  const handleEnergyChange = (value: NearbyEnergyChoice) => {
    setFuelSelectorOpen(false);
    if (value !== "EV") onFuelChange(value);
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
    <View style={styles.searchCard}>
      <Text style={styles.eyebrow}>Plan trip</Text>
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
          includeEv={false}
          onChange={handleEnergyChange}
          onToggleOpen={() => setFuelSelectorOpen((current) => !current)}
          open={fuelSelectorOpen}
          value={fuel}
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
  vehicleSummaryCard: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  vehicleSummaryLabel: {
    color: colors.muted,
    fontSize: typeScale.micro,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  vehicleSummaryValue: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  connectorSummary: {
    color: colors.greenDark,
    flexShrink: 1,
    fontSize: typeScale.micro,
    fontWeight: "800",
    textAlign: "right",
    textTransform: "uppercase",
  },
  routeNoticeCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
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
