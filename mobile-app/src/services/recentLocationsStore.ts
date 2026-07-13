import AsyncStorage from "@react-native-async-storage/async-storage";

import { MapPoint } from "../types";
import { RECENT_LOCATIONS_KEY } from "./localDataLifecycle";

export const MAX_RECENT_LOCATIONS = 8;

export async function loadRecentLocations(): Promise<MapPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_LOCATIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normaliseRecentLocations(parsed.filter(isMapPoint));
  } catch {
    return [];
  }
}

export async function persistRecentLocations(locations: MapPoint[]) {
  await AsyncStorage.setItem(
    RECENT_LOCATIONS_KEY,
    JSON.stringify(normaliseRecentLocations(locations)),
  );
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
