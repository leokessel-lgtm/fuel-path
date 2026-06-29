import AsyncStorage from "@react-native-async-storage/async-storage";

import { discountPrograms } from "../data/discountPrograms";
import {
  AppPreferences,
  DiscountRedemptionState,
  EvChargingPreference,
  EvConnector,
  FuelCode,
  HomeChargingAccess,
  MapPoint,
  VehicleEnergyType,
} from "../types";

const PREFERENCES_KEY = "fuel-path:preferences:v1";
const fuelCodes: FuelCode[] = ["E10", "U91", "P95", "P98", "DL", "PDL"];
const evConnectors: EvConnector[] = ["CCS2", "CHADEMO", "TYPE2", "TESLA", "NACS"];
const vehicleEnergyTypes: VehicleEnergyType[] = ["petrol", "diesel", "hybrid", "electric"];
const homeChargingAccessValues: HomeChargingAccess[] = ["unknown", "yes", "no"];
const evChargingPreferences: EvChargingPreference[] = ["balanced", "cheap", "fast", "reliable", "nearby"];
const discountIds = new Set(discountPrograms.map((program) => program.id));
const policyBrandNames = new Set(["Ampol", "BP", "Caltex", "Shell", "7-Eleven", "United", "Metro"]);

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
  return {
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
    fuelPolicyEnabled: Boolean(preferences.fuelPolicyEnabled),
    approvedPolicyBrands: normalisePolicyBrands(preferences.approvedPolicyBrands),
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

function normalisePolicyBrands(value: unknown) {
  if (!Array.isArray(value)) return defaultPreferences.approvedPolicyBrands;
  const selected = new Set(value.map(String).filter((brand) => policyBrandNames.has(brand)));
  const brands = Array.from(policyBrandNames).filter((brand) => selected.has(brand));
  return brands.length ? brands : defaultPreferences.approvedPolicyBrands;
}

function normaliseSelectedDiscounts(value: unknown) {
  if (!Array.isArray(value)) return defaultPreferences.selectedDiscounts;
  const selected = new Set(
    value.map(String).filter((discountId) => discountIds.has(discountId)),
  );
  return discountPrograms
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
