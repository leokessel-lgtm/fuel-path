import { activeDirectDiscountPrograms } from "../../data/discountPrograms";
import { AppPreferences, NotificationPermissionState, SavedCommute } from "../../types";

export type SettingsSection = "vehicle" | "savings" | "places" | "alerts" | "privacy";

export function settingsSectionTitle(section: SettingsSection) {
  if (section === "vehicle") return "Vehicle & fuel";
  if (section === "savings") return "Savings";
  if (section === "places") return "Places & routes";
  if (section === "alerts") return "Route alerts";
  return "Privacy & support";
}

export function vehicleSettingsSummary(preferences: AppPreferences) {
  const vehicleCount = preferences.vehicles.length;
  const vehicleSuffix = vehicleCount > 1 ? ` | ${vehicleCount} vehicles` : "";
  if (preferences.vehicleEnergyType === "electric") {
    const connectorSummary = preferences.evConnectors.length
      ? `${preferences.evConnectors.length} connector${preferences.evConnectors.length === 1 ? "" : "s"}`
      : "Any connector";
    return `${preferences.evRangeKm} km range | ${connectorSummary}${vehicleSuffix}`;
  }
  return `${preferences.vehicleEnergyType === "diesel" ? "Diesel" : "Petrol"} | ${preferences.fuel}${vehicleSuffix}`;
}

export function activeDiscountSummary(preferences: AppPreferences) {
  const activeDiscountIds = new Set(activeDirectDiscountPrograms.map((program) => program.id));
  const activeDiscountCount = preferences.selectedDiscounts.filter((discountId) => activeDiscountIds.has(discountId)).length;
  return `${activeDiscountCount} discount${activeDiscountCount === 1 ? "" : "s"} active`;
}

export function placesSettingsSummary(preferences: AppPreferences, savedCommutes: SavedCommute[]) {
  return [
    preferences.homeLocation ? "Home set" : "Home not set",
    preferences.workLocation ? "Work set" : "Work not set",
    `${savedCommutes.length} saved route${savedCommutes.length === 1 ? "" : "s"}`,
  ].join(" | ");
}

export function alertSettingsSummary(
  notificationPermission: NotificationPermissionState,
  savedCommutes: SavedCommute[],
) {
  const watchedRouteCount = savedCommutes.filter((commute) => commute.alertEnabled).length;
  if (watchedRouteCount) return `${watchedRouteCount} route${watchedRouteCount === 1 ? "" : "s"} watched`;
  return notificationPermission === "granted" ? "Notifications ready" : "Alerts off";
}
