import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { DiscountWalletCard } from "../DiscountWalletCard";
import { SavedPlacesCard } from "../SavedPlacesCard";
import { SavedRouteAlertsCard } from "../SavedRouteAlertsCard";
import { StationBrandsCard } from "../StationBrandsCard";
import { VehicleFuelCard } from "../VehicleFuelCard";
import { NavigationAppPreference } from "../../types";
import { AccountScreenProps } from "../../screens/AccountScreen.types";
import { SettingsSection, settingsSectionTitle } from "./settingsSections";
import { styles } from "./settingsStyles";

export function AccountDetailScreen({
  activeSection,
  alertSyncingCommuteId,
  notificationMessage,
  notificationPermission,
  onBack,
  onClearNamedPlace,
  onFuelChange,
  onHomeChargingAccessChange,
  onRemoveCommute,
  onRequestNotifications,
  onRenameCommute,
  onSaveNamedPlace,
  onNavigationAppChange,
  onSetPreferredStationBrands,
  onSetStationBrandMode,
  onToggleCommuteAlert,
  onToggleDiscount,
  onToggleDiscountRedemption,
  onToggleEvConnector,
  onTogglePreferredStationBrand,
  onAddVehicle,
  onRemoveVehicle,
  onSelectVehicle,
  onVehicleEnergyTypeChange,
  onVehicleProfileChange,
  onUpdateCommuteAlertSettings,
  preferences,
  savedCommutes,
}: AccountScreenProps & {
  activeSection: SettingsSection;
  onBack: () => void;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.detailHeader}>
        <Pressable
          accessibilityLabel="Back to settings"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.headerBackButton}
        >
          <Text style={styles.headerBackText}>{Platform.OS === "ios" ? "‹ Settings" : "← Settings"}</Text>
        </Pressable>
        <Text style={styles.detailTitle}>{settingsSectionTitle(activeSection)}</Text>
      </View>

      {activeSection === "vehicle" ? (
        <VehicleFuelCard
          preferences={preferences}
          onAddVehicle={onAddVehicle}
          onFuelChange={onFuelChange}
          onHomeChargingAccessChange={onHomeChargingAccessChange}
          onRemoveVehicle={onRemoveVehicle}
          onSelectVehicle={onSelectVehicle}
          onToggleEvConnector={onToggleEvConnector}
          onVehicleProfileChange={onVehicleProfileChange}
          onVehicleEnergyTypeChange={onVehicleEnergyTypeChange}
        />
      ) : null}

      {activeSection === "savings" ? (
        <DiscountWalletCard
          preferences={preferences}
          onToggleDiscount={onToggleDiscount}
          onToggleDiscountRedemption={onToggleDiscountRedemption}
        />
      ) : null}

      {activeSection === "stations" ? (
        <StationBrandsCard
          preferences={preferences}
          onSetMode={onSetStationBrandMode}
          onSetPreferredBrands={onSetPreferredStationBrands}
          onToggleBrand={onTogglePreferredStationBrand}
        />
      ) : null}

      {activeSection === "places" ? (
        <SavedPlacesCard
          homeLocation={preferences.homeLocation}
          savedCommutes={savedCommutes}
          workLocation={preferences.workLocation}
          onClearNamedPlace={onClearNamedPlace}
          onRemoveCommute={onRemoveCommute}
          onRenameCommute={onRenameCommute}
          onSaveNamedPlace={onSaveNamedPlace}
        />
      ) : null}

      {activeSection === "alerts" ? (
        <SavedRouteAlertsCard
          alertSyncingCommuteId={alertSyncingCommuteId}
          notificationMessage={notificationMessage}
          notificationPermission={notificationPermission}
          preferences={preferences}
          savedCommutes={savedCommutes}
          onRemoveCommute={onRemoveCommute}
          onRequestNotifications={onRequestNotifications}
          onToggleCommuteAlert={onToggleCommuteAlert}
          onUpdateCommuteAlertSettings={onUpdateCommuteAlertSettings}
        />
      ) : null}

      {activeSection === "privacy" ? (
        <View style={styles.supportCard}>
          <Text style={styles.eyebrow}>Privacy & support</Text>
          <Text style={styles.title}>Data used for better route decisions</Text>
          <Text style={styles.muted}>
            Fuel Path stores your preferences locally and may use aggregate product signals like saved routes, route watches and navigation opens. Provider diagnostics and beta evidence stay out of the main settings flow unless they need action.
          </Text>
          <NavigationPreference
            value={preferences.navigationApp}
            onChange={onNavigationAppChange}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const navigationOptions: Array<{ label: string; summary: string; value: NavigationAppPreference }> = [
  {
    label: "Device maps",
    summary: "Apple Maps on iPhone/iPad, Maps on Android.",
    value: "device_maps",
  },
  {
    label: "Ask every time",
    summary: "Show available apps before opening navigation.",
    value: "ask",
  },
  {
    label: "Apple Maps",
    summary: "Apple devices only. Falls back to device maps elsewhere.",
    value: "apple_maps",
  },
  {
    label: "Google Maps",
    summary: "Best full route handoff with the fuel stop included.",
    value: "google_maps",
  },
  {
    label: "Waze",
    summary: "Great for driving alerts. Route plans open to the fuel stop.",
    value: "waze",
  },
];

function NavigationPreference({
  onChange,
  value,
}: {
  onChange: (value: NavigationAppPreference) => void;
  value: NavigationAppPreference;
}) {
  return (
    <View style={styles.preferenceGroup}>
      <Text style={styles.sectionLabel}>Navigation app</Text>
      {navigationOptions.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            accessibilityLabel={`${option.label}. ${option.summary}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.preferenceRow, selected && styles.preferenceRowSelected]}
          >
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>{option.label}</Text>
              <Text style={styles.preferenceSummary}>{option.summary}</Text>
            </View>
            <Text style={[styles.preferenceState, selected && styles.preferenceStateSelected]}>
              {selected ? "Selected" : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
