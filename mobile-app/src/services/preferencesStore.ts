import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppPreferences, FuelCode, MapPoint } from "../types";

const PREFERENCES_KEY = "fuel-path:preferences:v1";
const fuelCodes: FuelCode[] = ["E10", "U91", "P95", "P98", "DL", "PDL"];

export const defaultPreferences: AppPreferences = {
  vehicleName: "Toyota Corolla",
  vehicleRego: "FP123",
  fuel: "U91",
  selectedDiscounts: ["fleet_card"],
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
    fuel: fuelCodes.includes(preferences.fuel as FuelCode)
      ? (preferences.fuel as FuelCode)
      : defaultPreferences.fuel,
    selectedDiscounts: Array.isArray(preferences.selectedDiscounts)
      ? preferences.selectedDiscounts.map(String)
      : defaultPreferences.selectedDiscounts,
    homeLocation: isMapPoint(preferences.homeLocation)
      ? normaliseMapPoint(preferences.homeLocation)
      : undefined,
    workLocation: isMapPoint(preferences.workLocation)
      ? normaliseMapPoint(preferences.workLocation)
      : undefined,
  };
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
