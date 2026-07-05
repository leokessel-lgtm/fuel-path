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
    updates: Partial<Pick<AppPreferences, "evBatteryKwh" | "evRangeKm" | "fuelTankLitres" | "homeChargingAccess" | "evChargingPreference" | "vehicleName" | "vehicleRego">>,
  ) => void;
  onVehicleEnergyTypeChange: (vehicleEnergyType: VehicleEnergyType) => void;
  onAddVehicle: (vehicleEnergyType?: VehicleEnergyType) => void;
  onRemoveVehicle: (vehicleId: string) => void;
  onSelectVehicle: (vehicleId: string) => void;
  onClearNamedPlace: (kind: "home" | "work") => void;
  onRequestNotifications: () => void;
  onSaveNamedPlace: (kind: "home" | "work", point: MapPoint) => void;
  onRenameCommute: (commuteId: string, name: string) => void;
  onRemoveCommute: (commuteId: string) => void;
  onToggleCommuteAlert: (commuteId: string) => void;
  onToggleDiscount: (discountId: string) => void;
  onToggleDiscountRedemption: (discountId: string) => void;
};
