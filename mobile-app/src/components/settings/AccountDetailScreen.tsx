import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { DiscountWalletCard } from "../DiscountWalletCard";
import { SavedPlacesCard } from "../SavedPlacesCard";
import { SavedRouteAlertsCard } from "../SavedRouteAlertsCard";
import { StationBrandsCard } from "../StationBrandsCard";
import { VehicleFuelCard } from "../VehicleFuelCard";
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
        </View>
      ) : null}
    </ScrollView>
  );
}
