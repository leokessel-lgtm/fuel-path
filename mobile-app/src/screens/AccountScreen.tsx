import { ScrollView, StyleSheet } from "react-native";

import { DecisionRuleCard } from "../components/DecisionRuleCard";
import { DiscountWalletCard } from "../components/DiscountWalletCard";
import { PolicyModeCard } from "../components/PolicyModeCard";
import { SavedPlacesCard } from "../components/SavedPlacesCard";
import { SavedRouteAlertsCard } from "../components/SavedRouteAlertsCard";
import { VehicleFuelCard } from "../components/VehicleFuelCard";
import { WeeklyReportCard } from "../components/WeeklyReportCard";
import { spacing } from "../theme";
import {
  AppPreferences,
  FuelCode,
  MapPoint,
  NotificationPermissionState,
  SavedCommute,
} from "../types";

export function AccountScreen({
  alertSyncingCommuteId,
  notificationMessage,
  notificationPermission,
  savedCommutes,
  preferences,
  onFuelChange,
  onClearNamedPlace,
  onRequestNotifications,
  onSaveNamedPlace,
  onRemoveCommute,
  onToggleCommuteAlert,
  onToggleDiscount,
  onToggleDiscountRedemption,
  onToggleFuelPolicy,
  onTogglePolicyBrand,
  onUpdateCommuteAlertRule,
  onUpdateDecisionRule,
}: {
  alertSyncingCommuteId: string | null;
  notificationMessage: string;
  notificationPermission: NotificationPermissionState;
  savedCommutes: SavedCommute[];
  preferences: AppPreferences;
  onFuelChange: (fuel: FuelCode) => void;
  onClearNamedPlace: (kind: "home" | "work") => void;
  onRequestNotifications: () => void;
  onSaveNamedPlace: (kind: "home" | "work", point: MapPoint) => void;
  onRemoveCommute: (commuteId: string) => void;
  onToggleCommuteAlert: (commuteId: string) => void;
  onToggleDiscount: (discountId: string) => void;
  onToggleDiscountRedemption: (discountId: string) => void;
  onToggleFuelPolicy: () => void;
  onTogglePolicyBrand: (brand: string) => void;
  onUpdateCommuteAlertRule: (
    commuteId: string,
    key: "minSavingDollars" | "maxDetourMinutes" | "tankThresholdPercent",
    value: number,
  ) => void;
  onUpdateDecisionRule: (key: "minSavingDollars" | "maxDetourMinutes", value: number) => void;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <VehicleFuelCard preferences={preferences} onFuelChange={onFuelChange} />

      <DecisionRuleCard
        maxDetourMinutes={preferences.maxDetourMinutes}
        minSavingDollars={preferences.minSavingDollars}
        onUpdateDecisionRule={onUpdateDecisionRule}
      />

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
        onUpdateCommuteAlertRule={onUpdateCommuteAlertRule}
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
