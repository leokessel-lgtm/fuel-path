import { API_BASE_URL } from "../config";
import {
  FuelCode,
  MapPoint,
  NearbyResponse,
  ScoreResponse,
  Station,
} from "../types";

type GeocodeResponse = {
  provider?: string;
  providerMode?: string;
  recommendedProductionProvider?: string;
  sessionToken?: string;
  location: MapPoint;
  suggestions: MapPoint[];
};

type RouteResponse = {
  provider: string;
  distanceKm: number;
  durationMin: number;
  points: MapPoint[];
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `Fuel Path API returned ${response.status}`);
  }
  return payload as T;
}

function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  return search.toString();
}

export async function getApiStatus() {
  return fetchJson<{
    defaultSource: "live" | "sample";
    credentialsConfigured: boolean;
    cacheSeconds: number;
    geocoding?: {
      activeProvider: string;
      activeMode: string;
      recommendedProductionProvider: string;
      requestedProvider: string;
      backendProxyRequired: boolean;
      sessionTokenRequired: boolean;
      googlePlacesConfigured: boolean;
      mapboxConfigured: boolean;
    };
  }>("/api/status");
}

export async function getNearbyStations({
  fuel,
  centre,
  radiusKm = 8,
  limit = 160,
}: {
  fuel: FuelCode;
  centre: MapPoint;
  radiusKm?: number;
  limit?: number;
}) {
  return fetchJson<NearbyResponse>(
    `/api/stations?${query({
      source: "live",
      fuel,
      lat: centre.lat,
      lon: centre.lon,
      label: centre.label,
      radiusKm,
      includeMemberPrices: 0,
      includeClosed: 0,
      limit,
    })}`,
  );
}

export async function geocodeAddress(label: string, sessionToken?: string) {
  const suggestions = await searchLocations(label, 1, sessionToken);
  if (!suggestions[0]) throw new Error(`No location found for ${label}`);
  return suggestions[0];
}

export async function searchLocations(label: string, limit = 5, sessionToken?: string) {
  const payload = await fetchJson<GeocodeResponse>(
    `/api/geocode?${query({ q: label, limit, sessionToken })}`,
  );
  return payload.suggestions?.length ? payload.suggestions : [payload.location];
}

export async function getRoute(from: MapPoint, to: MapPoint) {
  return fetchJson<RouteResponse>(
    `/api/route?${query({
      fromLat: from.lat,
      fromLon: from.lon,
      toLat: to.lat,
      toLon: to.lon,
      fromLabel: from.label,
      toLabel: to.label,
    })}`,
  );
}

export async function scoreRoute({
  fuel,
  route,
  eligibleDiscounts,
}: {
  fuel: FuelCode;
  route: RouteResponse;
  eligibleDiscounts: string[];
}) {
  return fetchJson<ScoreResponse>("/api/score", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "live",
      route: {
        id: "native-route",
        name: "Native planned route",
        provider: route.provider,
        defaultCorridorKm: 2.5,
        defaultDetourSpeedKmh: 80,
        points: compactPoints(route.points),
      },
      fuel,
      tankLitres: 55,
      tankPercent: 45,
      economy: 8.2,
      reserveKm: 35,
      corridorKm: 2.5,
      eligibleDiscounts,
      includeMemberPrices: false,
      includeClosed: false,
    }),
  });
}

function compactPoints(points: MapPoint[], maxPoints = 180) {
  if (points.length <= maxPoints) return points;
  const compacted: MapPoint[] = [];
  let previousIndex = -1;
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * (points.length - 1));
    if (sourceIndex !== previousIndex) {
      compacted.push(points[sourceIndex]);
      previousIndex = sourceIndex;
    }
  }
  return compacted;
}

export function stationPoint(station: Station): MapPoint {
  return {
    lat: station.lat,
    lon: station.lon,
    label: station.name,
  };
}
