import {
  AppPreferences,
  EvConnector,
  FuelCode,
  HomeChargingAccess,
  MapPoint,
  NotificationPermissionState,
  SavedCommute,
  VehicleEnergyType,
} from "../types";

export type AccountScreenProps = {
  alertSyncingCommuteId: string | null;
  notificationMessage: string;
  notificationPermission: NotificationPermissionState;
  savedCommutes: SavedCommute[];
  preferences: AppPreferences;
  onFuelChange: (fuel: FuelCode) => void;
  onHomeChargingAccessChange: (homeChargingAccess: HomeChargingAccess) => void;
  onToggleEvConnector: (connector: EvConnector) => void;
  onVehicleProfileChange: (
    updates: Partial<Pick<AppPreferences, "evBatteryKwh" | "evRangeKm" | "fuelTankLitres" | "evChargingPreference">>,
  ) => void;
  onVehicleEnergyTypeChange: (vehicleEnergyType: VehicleEnergyType) => void;
  onClearNamedPlace: (kind: "home" | "work") => void;
  onRequestNotifications: () => void;
  onSaveNamedPlace: (kind: "home" | "work", point: MapPoint) => void;
  onRemoveCommute: (commuteId: string) => void;
  onToggleCommuteAlert: (commuteId: string) => void;
  onToggleDiscount: (discountId: string) => void;
  onToggleDiscountRedemption: (discountId: string) => void;
  onToggleFuelPolicy: () => void;
  onTogglePolicyBrand: (brand: string) => void;
};
