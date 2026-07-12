import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { MapPoint, SavedCommute, VehicleEnergyType } from "../types";
import { CurrentLocationFieldButton, currentLocationFieldInset } from "./CurrentLocationFieldButton";
import { QuickPlace, QuickPlaceShortcuts } from "./QuickPlaceShortcuts";
import { AddressSuggestions } from "./RouteAddressSuggestions";

export function PlanRouteEditorCard({
  activeAddressField,
  canPlanRoute,
  maxHeight,
  from,
  fromSuggestions,
  loading,
  locatingFrom,
  onFromChange,
  onFromFocus,
  onFromBlur,
  onFromSelectionStart,
  onPlanRoute,
  onSelectAddressSuggestion,
  onSelectQuickPlace,
  onRemoveRecent,
  onSelectSavedCommute,
  onToChange,
  onToFocus,
  onToBlur,
  onToSelectionStart,
  onUseCurrentFromLocation,
  quickPlaces,
  routePrecisionHint,
  routeError,
  routePlanningBlocked,
  savedCommutes,
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
  from: string;
  fromSuggestions: MapPoint[];
  loading: boolean;
  locatingFrom: boolean;
  onFromChange: (value: string) => void;
  onFromFocus: () => void;
  onFromBlur: () => void;
  onFromSelectionStart: () => void;
  onPlanRoute: () => void;
  onSelectAddressSuggestion: (field: "from" | "to", point: MapPoint) => void;
  onSelectQuickPlace: (field: "from" | "to", point: MapPoint) => void;
  onRemoveRecent?: (point: MapPoint) => void;
  onSelectSavedCommute: (commute: SavedCommute) => void;
  onToChange: (value: string) => void;
  onToFocus: () => void;
  onToBlur: () => void;
  onToSelectionStart: () => void;
  onUseCurrentFromLocation: () => void;
  quickPlaces: QuickPlace[];
  routePrecisionHint: string;
  routeError: string;
  routePlanningBlocked: boolean;
  savedCommutes: SavedCommute[];
  suggestionsError: string;
  suggestionsLoading: "from" | "to" | null;
  to: string;
  toSuggestions: MapPoint[];
  vehicleEnergyType: VehicleEnergyType;
  vehicleRouteNotice: string;
}) {
  const fromLookupActive = suggestionsLoading === "from" || Boolean(suggestionsError) || fromSuggestions.length > 0;
  const toLookupActive = suggestionsLoading === "to" || Boolean(suggestionsError) || toSuggestions.length > 0;
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
        keyboardShouldPersistTaps="always"
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
              onBlur={onFromBlur}
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
          {activeAddressField === "from" && quickPlaces.length && !fromLookupActive ? (
            <QuickPlaceShortcuts
              onSelectStart={onFromSelectionStart}
              onSelect={onSelectQuickPlace}
              onRemoveRecent={onRemoveRecent}
              places={quickPlaces}
              targetField="from"
            />
          ) : null}
          {activeAddressField === "from" ? (
            <AddressSuggestions
              error={suggestionsError}
              loading={suggestionsLoading === "from"}
              onSelectStart={onFromSelectionStart}
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
            onBlur={onToBlur}
            onPressIn={onToFocus}
            onSubmitEditing={onPlanRoute}
            placeholder="Destination address, suburb or place"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.input}
          />
          {activeAddressField === "to" && quickPlaces.length && !toLookupActive ? (
            <QuickPlaceShortcuts
              onSelectStart={onToSelectionStart}
              onSelect={onSelectQuickPlace}
              onRemoveRecent={onRemoveRecent}
              places={quickPlaces}
              targetField="to"
            />
          ) : null}
          {activeAddressField === "to" ? (
            <AddressSuggestions
              error={suggestionsError}
              loading={suggestionsLoading === "to"}
              onSelectStart={onToSelectionStart}
              onSelect={(point) => onSelectAddressSuggestion("to", point)}
              query={to}
              suggestions={toSuggestions}
            />
          ) : null}
        </View>
        {routePrecisionHint ? (
          <Text style={styles.routePrecisionHint}>{routePrecisionHint}</Text>
        ) : null}
        {routeError ? (
          <Text accessibilityRole="alert" style={styles.routeError}>
            {routeError}
          </Text>
        ) : null}
        {canPlanRoute ? (
          <Pressable
            accessibilityLabel="Plan route"
            accessibilityRole="button"
            disabled={loading || routePlanningBlocked}
            onPress={onPlanRoute}
            style={[
              styles.primaryButton,
              (loading || routePlanningBlocked) && styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>{routePlanningBlocked ? "Route charging coming soon" : primaryLabel}</Text>
          </Pressable>
        ) : null}
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
    ...typography.metadataStrong,
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
    ...typography.fieldText,
    borderRadius: radii.control,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  inputWithIcon: {
    paddingRight: currentLocationFieldInset,
  },
  routePrecisionHint: {
    ...typography.metadata,
    paddingHorizontal: spacing.sm,
  },
  routeError: {
    color: colors.red,
    fontSize: typography.metadataStrong.fontSize,
    fontWeight: typography.metadataStrong.fontWeight,
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
    ...typography.buttonLabel,
    color: colors.white,
  },
});
