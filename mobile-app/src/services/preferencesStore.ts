import AsyncStorage from "@react-native-async-storage/async-storage";

import { activeDirectDiscountPrograms } from "../data/discountPrograms";
import {
  AppPreferences,
  DiscountRedemptionState,
  EvChargingPreference,
  EvConnector,
  FuelCode,
  HomeChargingAccess,
  MapPoint,
  StationBrandMode,
  VehicleProfile,
  VehicleEnergyType,
} from "../types";
import { normalisePreferredStationBrands } from "../utils/stationBrandPreferences";

const PREFERENCES_KEY = "fuel-path:preferences:v1";
const DEFAULT_VEHICLE_ID = "vehicle-default";
const fuelCodes: FuelCode[] = ["E10", "U91", "P95", "P98", "DL", "PDL"];
const evConnectors: EvConnector[] = ["CCS2", "CHADEMO", "TYPE2", "TESLA", "NACS"];
const vehicleEnergyTypes: VehicleEnergyType[] = ["petrol", "diesel", "electric"];
const homeChargingAccessValues: HomeChargingAccess[] = ["unknown", "yes", "no"];
const evChargingPreferences: EvChargingPreference[] = ["balanced", "cheap", "fast", "reliable", "nearby"];
const stationBrandModes: StationBrandMode[] = ["all", "preferred_only"];
const discountIds = new Set(activeDirectDiscountPrograms.map((program) => program.id));

export const defaultPreferences: AppPreferences = {
  vehicleName: "",
  vehicleRego: "",
  vehicleEnergyType: "petrol",
  fuel: "U91",
  evConnectors: [],
  fuelTankLitres: 55,
  evBatteryKwh: 75,
  evRangeKm: 400,
  homeChargingAccess: "unknown",
  evChargingPreference: "balanced",
  minSavingDollars: 5,
  maxDetourMinutes: 8,
  fuelPolicyEnabled: false,
  approvedPolicyBrands: ["Ampol", "BP", "Shell"],
  stationBrandMode: "all",
  preferredStationBrands: [],
  activeVehicleId: DEFAULT_VEHICLE_ID,
  vehicles: [
    {
      id: DEFAULT_VEHICLE_ID,
      name: "",
      rego: "",
      vehicleEnergyType: "petrol",
      fuel: "U91",
      evConnectors: [],
      fuelTankLitres: 55,
      evBatteryKwh: 75,
      evRangeKm: 400,
      homeChargingAccess: "unknown",
      evChargingPreference: "balanced",
    },
  ],
  selectedDiscounts: [],
};

export async function loadPreferences(): Promise<AppPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
    if (!raw) return defaultPreferences;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultPreferences;
    return normalisePreferences(parsed as Partial<AppPreferences>);
  } catch {
    return defaultPreferences;
  }
}

export async function persistPreferences(preferences: AppPreferences) {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(normalisePreferences(preferences)));
}

function normalisePreferences(preferences: Partial<AppPreferences>): AppPreferences {
  const legacyVehicle = normaliseVehicleProfile({
    id: DEFAULT_VEHICLE_ID,
    vehicleName: String(preferences.vehicleName || defaultPreferences.vehicleName),
    vehicleRego: String(preferences.vehicleRego || defaultPreferences.vehicleRego),
    vehicleEnergyType: vehicleEnergyTypes.includes(preferences.vehicleEnergyType as VehicleEnergyType)
      ? (preferences.vehicleEnergyType as VehicleEnergyType)
      : inferVehicleEnergyType(preferences.fuel),
    fuel: fuelCodes.includes(preferences.fuel as FuelCode)
      ? (preferences.fuel as FuelCode)
      : defaultPreferences.fuel,
    evConnectors: normaliseEvConnectors(preferences.evConnectors),
    fuelTankLitres: boundedNumber(
      preferences.fuelTankLitres,
      30,
      120,
      defaultPreferences.fuelTankLitres,
    ),
    evBatteryKwh: boundedNumber(
      preferences.evBatteryKwh,
      35,
      140,
      defaultPreferences.evBatteryKwh,
    ),
    evRangeKm: boundedNumber(
      preferences.evRangeKm,
      120,
      900,
      defaultPreferences.evRangeKm,
    ),
    homeChargingAccess: homeChargingAccessValues.includes(preferences.homeChargingAccess as HomeChargingAccess)
      ? (preferences.homeChargingAccess as HomeChargingAccess)
      : defaultPreferences.homeChargingAccess,
    evChargingPreference: evChargingPreferences.includes(preferences.evChargingPreference as EvChargingPreference)
      ? (preferences.evChargingPreference as EvChargingPreference)
      : defaultPreferences.evChargingPreference,
  });
  const vehicles = normaliseVehicleProfiles(preferences.vehicles, legacyVehicle);
  const requestedVehicleId = String(preferences.activeVehicleId || "");
  const activeVehicle = vehicles.find((vehicle) => vehicle.id === requestedVehicleId) || vehicles[0];
  return {
    vehicleName: activeVehicle.name,
    vehicleRego: activeVehicle.rego,
    vehicleEnergyType: activeVehicle.vehicleEnergyType,
    fuel: activeVehicle.fuel,
    evConnectors: activeVehicle.evConnectors,
    fuelTankLitres: activeVehicle.fuelTankLitres,
    evBatteryKwh: activeVehicle.evBatteryKwh,
    evRangeKm: activeVehicle.evRangeKm,
    homeChargingAccess: activeVehicle.homeChargingAccess,
    evChargingPreference: activeVehicle.evChargingPreference,
    minSavingDollars: boundedNumber(
      preferences.minSavingDollars,
      1,
      25,
      defaultPreferences.minSavingDollars,
    ),
    maxDetourMinutes: boundedNumber(
      preferences.maxDetourMinutes,
      1,
      30,
      defaultPreferences.maxDetourMinutes,
    ),
    fuelPolicyEnabled: false,
    approvedPolicyBrands: defaultPreferences.approvedPolicyBrands,
    stationBrandMode: stationBrandModes.includes(preferences.stationBrandMode as StationBrandMode)
      ? (preferences.stationBrandMode as StationBrandMode)
      : defaultPreferences.stationBrandMode,
    preferredStationBrands: normalisePreferredStationBrands(preferences.preferredStationBrands),
    activeVehicleId: activeVehicle.id,
    vehicles,
    selectedDiscounts: normaliseSelectedDiscounts(preferences.selectedDiscounts),
    discountRedemptions: normaliseDiscountRedemptions(preferences.discountRedemptions),
    homeLocation: isMapPoint(preferences.homeLocation)
      ? normaliseMapPoint(preferences.homeLocation)
      : undefined,
    workLocation: isMapPoint(preferences.workLocation)
      ? normaliseMapPoint(preferences.workLocation)
      : undefined,
  };
}

function normaliseVehicleProfiles(value: unknown, fallback: VehicleProfile) {
  if (!Array.isArray(value)) return [fallback];
  const seen = new Set<string>();
  const vehicles = value
    .map((candidate, index) => normaliseVehicleProfile(candidate, index))
    .filter((vehicle) => {
      if (!vehicle.id || seen.has(vehicle.id)) return false;
      seen.add(vehicle.id);
      return true;
    });
  return vehicles.length ? vehicles : [fallback];
}

function normaliseVehicleProfile(value: unknown, fallbackId: string | number | VehicleProfile = DEFAULT_VEHICLE_ID): VehicleProfile {
  const fallback = typeof fallbackId === "object"
    ? fallbackId
    : {
      id: fallbackId === 0 ? DEFAULT_VEHICLE_ID : `vehicle-${fallbackId}`,
      name: "",
      rego: "",
      vehicleEnergyType: defaultPreferences.vehicleEnergyType,
      fuel: defaultPreferences.fuel,
      evConnectors: defaultPreferences.evConnectors,
      fuelTankLitres: defaultPreferences.fuelTankLitres,
      evBatteryKwh: defaultPreferences.evBatteryKwh,
      evRangeKm: defaultPreferences.evRangeKm,
      homeChargingAccess: defaultPreferences.homeChargingAccess,
      evChargingPreference: defaultPreferences.evChargingPreference,
    };
  const profile = value && typeof value === "object" ? value as Partial<VehicleProfile> & {
    vehicleName?: unknown;
    vehicleRego?: unknown;
  } : {};
  const fuel = fuelCodes.includes(profile.fuel as FuelCode)
    ? (profile.fuel as FuelCode)
    : fallback.fuel;
  return {
    id: String(profile.id || fallback.id),
    name: String(profile.name ?? profile.vehicleName ?? fallback.name),
    rego: String(profile.rego ?? profile.vehicleRego ?? fallback.rego),
    vehicleEnergyType: vehicleEnergyTypes.includes(profile.vehicleEnergyType as VehicleEnergyType)
      ? (profile.vehicleEnergyType as VehicleEnergyType)
      : inferVehicleEnergyType(fuel),
    fuel,
    evConnectors: normaliseEvConnectors(profile.evConnectors ?? fallback.evConnectors),
    fuelTankLitres: boundedNumber(profile.fuelTankLitres, 30, 120, fallback.fuelTankLitres),
    evBatteryKwh: boundedNumber(profile.evBatteryKwh, 35, 140, fallback.evBatteryKwh),
    evRangeKm: boundedNumber(profile.evRangeKm, 120, 900, fallback.evRangeKm),
    homeChargingAccess: homeChargingAccessValues.includes(profile.homeChargingAccess as HomeChargingAccess)
      ? (profile.homeChargingAccess as HomeChargingAccess)
      : fallback.homeChargingAccess,
    evChargingPreference: evChargingPreferences.includes(profile.evChargingPreference as EvChargingPreference)
      ? (profile.evChargingPreference as EvChargingPreference)
      : fallback.evChargingPreference,
  };
}

function inferVehicleEnergyType(fuel: unknown): VehicleEnergyType {
  return fuel === "DL" || fuel === "PDL" ? "diesel" : defaultPreferences.vehicleEnergyType;
}

function normaliseEvConnectors(value: unknown): EvConnector[] {
  if (!Array.isArray(value)) return defaultPreferences.evConnectors;
  const selected = new Set(value.map(String).filter((connector) => evConnectors.includes(connector as EvConnector)));
  return evConnectors.filter((connector) => selected.has(connector));
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normaliseSelectedDiscounts(value: unknown) {
  if (!Array.isArray(value)) return defaultPreferences.selectedDiscounts;
  const selected = new Set(
    value.map(String).filter((discountId) => discountIds.has(discountId)),
  );
  return activeDirectDiscountPrograms
    .map((program) => program.id)
    .filter((discountId) => selected.has(discountId));
}

function normaliseDiscountRedemptions(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const redemptions: Record<string, DiscountRedemptionState> = {};
  for (const [discountId, redemption] of Object.entries(value)) {
    if (!discountIds.has(discountId) || !redemption || typeof redemption !== "object") continue;
    const candidate = redemption as Partial<DiscountRedemptionState>;
    const updatedAt = String(candidate.updatedAt || "");
    if (
      candidate.status !== "available" &&
      candidate.status !== "redeemed_today"
    ) {
      continue;
    }
    if (Number.isNaN(new Date(updatedAt).getTime())) continue;
    redemptions[discountId] = {
      status: candidate.status,
      updatedAt,
    };
  }
  return Object.keys(redemptions).length ? redemptions : undefined;
}

function normaliseMapPoint(point: MapPoint): MapPoint {
  return {
    lat: Number(point.lat),
    lon: Number(point.lon),
    label: String(point.label || "Saved place"),
    provider: point.provider,
    matchType: point.matchType,
    confidence: point.confidence,
    type: point.type,
  };
}

function isMapPoint(value: unknown): value is MapPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<MapPoint>;
  return (
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lon) &&
    typeof point.label === "string"
  );
}
