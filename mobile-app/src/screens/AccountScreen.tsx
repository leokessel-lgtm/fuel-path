import { ScrollView, StyleSheet } from "react-native";

import { AccountIntroCard } from "../components/AccountIntroCard";
import { BetaPrivacyCard } from "../components/BetaPrivacyCard";
import { DiscountWalletCard } from "../components/DiscountWalletCard";
import { PolicyModeCard } from "../components/PolicyModeCard";
import { SavedPlacesCard } from "../components/SavedPlacesCard";
import { SavedRouteAlertsCard } from "../components/SavedRouteAlertsCard";
import { VehicleFuelCard } from "../components/VehicleFuelCard";
import { WeeklyReportCard } from "../components/WeeklyReportCard";
import { spacing } from "../theme";
import { AccountScreenProps } from "./AccountScreen.types";

export function AccountScreen({
  alertSyncingCommuteId,
  notificationMessage,
  notificationPermission,
  savedCommutes,
  preferences,
  onFuelChange,
  onHomeChargingAccessChange,
  onToggleEvConnector,
  onVehicleProfileChange,
  onVehicleEnergyTypeChange,
  onClearNamedPlace,
  onRequestNotifications,
  onSaveNamedPlace,
  onRemoveCommute,
  onToggleCommuteAlert,
  onToggleDiscount,
  onToggleDiscountRedemption,
  onToggleFuelPolicy,
  onTogglePolicyBrand,
}: AccountScreenProps) {
  const firstRun = !preferences.vehicleName && !preferences.vehicleRego && !preferences.homeLocation && !preferences.workLocation && !savedCommutes.length;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AccountIntroCard firstRun={firstRun} />

      <VehicleFuelCard
        preferences={preferences}
        onFuelChange={onFuelChange}
        onHomeChargingAccessChange={onHomeChargingAccessChange}
        onToggleEvConnector={onToggleEvConnector}
        onVehicleProfileChange={onVehicleProfileChange}
        onVehicleEnergyTypeChange={onVehicleEnergyTypeChange}
      />

      <BetaPrivacyCard />

      <SavedPlacesCard
        homeLocation={preferences.homeLocation}
        savedCommutes={savedCommutes}
        workLocation={preferences.workLocation}
        onClearNamedPlace={onClearNamedPlace}
        onSaveNamedPlace={onSaveNamedPlace}
      />

      <DiscountWalletCard
        preferences={preferences}
        onToggleDiscount={onToggleDiscount}
        onToggleDiscountRedemption={onToggleDiscountRedemption}
      />

      <PolicyModeCard
        preferences={preferences}
        onToggleFuelPolicy={onToggleFuelPolicy}
        onTogglePolicyBrand={onTogglePolicyBrand}
      />

      <SavedRouteAlertsCard
        alertSyncingCommuteId={alertSyncingCommuteId}
        notificationMessage={notificationMessage}
        notificationPermission={notificationPermission}
        savedCommutes={savedCommutes}
        onRemoveCommute={onRemoveCommute}
        onRequestNotifications={onRequestNotifications}
        onToggleCommuteAlert={onToggleCommuteAlert}
      />

      <WeeklyReportCard preferences={preferences} savedCommutes={savedCommutes} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
});
