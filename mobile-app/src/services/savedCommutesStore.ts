import AsyncStorage from "@react-native-async-storage/async-storage";

import { FuelCode, MapPoint, SavedCommute } from "../types";

const SAVED_COMMUTES_KEY = "fuel-path:saved-commutes:v1";
const MAX_SAVED_COMMUTES = 20;
const fuelCodes: FuelCode[] = ["E10", "U91", "P95", "P98", "DL", "PDL"];

export async function loadSavedCommutes(): Promise<SavedCommute[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_COMMUTES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedCommute)
      .map(normaliseSavedCommute)
      .slice(0, MAX_SAVED_COMMUTES);
  } catch {
    return [];
  }
}

export async function persistSavedCommutes(commutes: SavedCommute[]) {
  const compactCommutes = commutes.slice(0, MAX_SAVED_COMMUTES).map(normaliseSavedCommute);
  await AsyncStorage.setItem(SAVED_COMMUTES_KEY, JSON.stringify(compactCommutes));
}

function normaliseSavedCommute(commute: SavedCommute): SavedCommute {
  const now = new Date().toISOString();
  return {
    id: commute.id,
    name: commute.name,
    from: normaliseMapPoint(commute.from),
    to: normaliseMapPoint(commute.to),
    fuel: commute.fuel,
    alertEnabled: Boolean(commute.alertEnabled),
    alertTime: normaliseAlertTime(commute.alertTime),
    minSavingDollars: boundedNumber(commute.minSavingDollars, 1, 25, 5),
    maxDetourMinutes: boundedNumber(commute.maxDetourMinutes, 1, 30, 8),
    tankThresholdPercent: boundedNumber(commute.tankThresholdPercent, 5, 95, 45),
    alertStatus: commute.alertStatus || (commute.alertEnabled ? "scheduled" : "off"),
    alertStatusMessage: commute.alertStatusMessage,
    backendSyncedAt: commute.backendSyncedAt,
    createdAt: commute.createdAt || now,
    nextAlertAt: commute.nextAlertAt,
    scheduledNotificationId: commute.scheduledNotificationId,
    updatedAt: commute.updatedAt || commute.createdAt || now,
  };
}

function normaliseMapPoint(point: MapPoint): MapPoint {
  return {
    lat: Number(point.lat),
    lon: Number(point.lon),
    label: String(point.label || "Saved location"),
  };
}

function normaliseAlertTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "07:30";
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function isSavedCommute(value: unknown): value is SavedCommute {
  if (!value || typeof value !== "object") return false;
  const commute = value as Partial<SavedCommute>;
  return (
    typeof commute.id === "string" &&
    typeof commute.name === "string" &&
    isMapPoint(commute.from) &&
    isMapPoint(commute.to) &&
    typeof commute.fuel === "string" &&
    fuelCodes.includes(commute.fuel as FuelCode)
  );
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
