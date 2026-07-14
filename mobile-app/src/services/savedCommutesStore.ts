import { FuelCode, MapPoint, SavedCommute, Weekday } from "../types";
import { SAVED_COMMUTES_BACKUP_KEY, SAVED_COMMUTES_KEY } from "./localDataLifecycle";
import { loadRecoverableJson, persistRecoverableJson } from "./recoverableLocalStore";

const MAX_SAVED_COMMUTES = 20;
const fuelCodes: FuelCode[] = ["E10", "U91", "P95", "P98", "DL", "PDL", "LPG"];
const weekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const defaultCommuteAlertDays: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];
export const migratedCommuteAlertDays: Weekday[] = weekdays;

export async function loadSavedCommutes(): Promise<SavedCommute[]> {
  return (await loadSavedCommutesWithStatus()).value;
}

export function loadSavedCommutesWithStatus() {
  return loadRecoverableJson({
    primaryKey: SAVED_COMMUTES_KEY,
    backupKey: SAVED_COMMUTES_BACKUP_KEY,
    fallback: [] as SavedCommute[],
    normalise: (value) => {
      if (!Array.isArray(value)) throw new Error("Saved routes payload is invalid");
      return value.filter(isSavedCommute).map(normaliseSavedCommute).slice(0, MAX_SAVED_COMMUTES);
    },
  });
}

export async function persistSavedCommutes(commutes: SavedCommute[]) {
  const compactCommutes = commutes.slice(0, MAX_SAVED_COMMUTES).map(normaliseSavedCommute);
  await persistRecoverableJson({
    primaryKey: SAVED_COMMUTES_KEY,
    backupKey: SAVED_COMMUTES_BACKUP_KEY,
    value: compactCommutes,
  });
}

function normaliseSavedCommute(commute: SavedCommute): SavedCommute {
  const now = new Date().toISOString();
  return {
    id: commute.id,
    name: commute.name,
    from: normaliseMapPoint(commute.from),
    to: normaliseMapPoint(commute.to),
    fuel: commute.fuel,
    vehicleId: typeof commute.vehicleId === "string" ? commute.vehicleId : undefined,
    alertEnabled: Boolean(commute.alertEnabled),
    alertTime: normaliseAlertTime(commute.alertTime),
    alertDays: normaliseAlertDays(commute.alertDays, migratedCommuteAlertDays),
    localReminderEnabled: commute.localReminderEnabled ?? false,
    minSavingDollars: boundedNumber(commute.minSavingDollars, 1, 25, 5),
    maxDetourMinutes: boundedNumber(commute.maxDetourMinutes, 1, 30, 8),
    tankThresholdPercent: boundedNumber(commute.tankThresholdPercent, 5, 95, 45),
    alertStatus: commute.alertStatus || (commute.alertEnabled ? "scheduled" : "off"),
    alertStatusMessage: commute.alertStatusMessage,
    backendSyncedAt: commute.backendSyncedAt,
    createdAt: commute.createdAt || now,
    nextAlertAt: commute.nextAlertAt,
    scheduledNotificationId: commute.scheduledNotificationId,
    scheduledNotificationIds: Array.isArray(commute.scheduledNotificationIds)
      ? commute.scheduledNotificationIds.filter((id) => typeof id === "string")
      : undefined,
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

function normaliseAlertDays(value: unknown, fallback: Weekday[]) {
  if (!Array.isArray(value)) return fallback;
  const selected = new Set(value.filter((day): day is Weekday => weekdays.includes(day)));
  const days = weekdays.filter((day) => selected.has(day));
  return days.length ? days : fallback;
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
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    typeof point.label === "string"
  );
}
