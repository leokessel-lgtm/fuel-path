import {
  AppPreferences,
  EvConnector,
  FuelCode,
  HomeChargingAccess,
  MapPoint,
  NavigationAppPreference,
  NotificationPermissionState,
  SavedCommute,
  StationBrandMode,
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
  onUpdateCommuteAlertSettings: (
    commuteId: string,
    updates: Partial<Pick<SavedCommute, "alertDays" | "alertTime" | "localReminderEnabled" | "maxDetourMinutes" | "minSavingDollars" | "tankThresholdPercent" | "vehicleId">>,
  ) => void;
  onToggleDiscount: (discountId: string) => void;
  onToggleDiscountRedemption: (discountId: string) => void;
  onNavigationAppChange: (navigationApp: NavigationAppPreference) => void;
  onSetStationBrandMode: (mode: StationBrandMode) => void;
  onSetPreferredStationBrands: (brands: string[]) => void;
  onTogglePreferredStationBrand: (brand: string) => void;
};
