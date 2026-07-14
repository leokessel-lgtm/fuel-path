import { MapPoint } from "../types";
import { RECENT_LOCATIONS_BACKUP_KEY, RECENT_LOCATIONS_KEY } from "./localDataLifecycle";
import { loadRecoverableJson, persistRecoverableJson } from "./recoverableLocalStore";

export const MAX_RECENT_LOCATIONS = 8;

export async function loadRecentLocations(): Promise<MapPoint[]> {
  return (await loadRecentLocationsWithStatus()).value;
}

export function loadRecentLocationsWithStatus() {
  return loadRecoverableJson({
    primaryKey: RECENT_LOCATIONS_KEY,
    backupKey: RECENT_LOCATIONS_BACKUP_KEY,
    fallback: [] as MapPoint[],
    normalise: (value) => {
      if (!Array.isArray(value)) throw new Error("Recent locations payload is invalid");
      return normaliseRecentLocations(value.filter(isMapPoint));
    },
  });
}

export async function persistRecentLocations(locations: MapPoint[]) {
  await persistRecoverableJson({
    primaryKey: RECENT_LOCATIONS_KEY,
    backupKey: RECENT_LOCATIONS_BACKUP_KEY,
    value: normaliseRecentLocations(locations),
  });
}

export function normaliseRecentLocations(locations: MapPoint[]) {
  const seen = new Set<string>();
  const compact: MapPoint[] = [];
  locations.forEach((location) => {
    const point = normaliseMapPoint(location);
    const key = `${point.lat.toFixed(5)}:${point.lon.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    compact.push(point);
  });
  return compact.slice(0, MAX_RECENT_LOCATIONS);
}

function normaliseMapPoint(point: MapPoint): MapPoint {
  return {
    lat: Number(point.lat),
    lon: Number(point.lon),
    label: String(point.label || "Recent location"),
    provider: point.provider,
    matchType: point.matchType,
    confidence: point.confidence,
    type: point.type,
  };
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
