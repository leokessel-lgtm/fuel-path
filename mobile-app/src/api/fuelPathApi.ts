import { API_BASE_URL } from "../config";
import {
  FuelCode,
  MapPoint,
  NearbyResponse,
  RegionCapability,
  RegionCapabilityStatus,
  ScoreResponse,
  Station,
} from "../types";

type GeocodeResponse = {
  provider?: string;
  providerMode?: string;
  recommendedProductionProvider?: string;
  sessionToken?: string;
  location?: MapPoint | null;
  suggestions: MapPoint[];
  lookupStatus?: "ok" | "local_fallback" | "degraded" | "no_match";
  warning?: string;
};

export type LocationSearchContext = {
  near?: MapPoint;
  nearRadiusKm?: number;
};

type RouteResponse = {
  provider: string;
  distanceKm: number;
  durationMin: number;
  points: MapPoint[];
};

type LookupReadiness = {
  status: "ready" | "not_ready";
  publicExactAddressClaimsAllowed: boolean;
  blockers: string[];
  nextAction: string;
  addressIndex: {
    mode: string;
    hosted: boolean;
    reportedAddressRows: number | null;
    minAddressRows: number;
    rowCountReady: boolean | null;
  };
  exactSmoke: {
    status: string;
    passed: boolean;
  };
  hostedBenchmark: {
    status: string;
    passed: boolean;
    lastRunAt: string;
    cases: number | null;
    requiredCases: number;
    addressTopRate: number | null;
    poiTopRate: number | null;
    addressP90Chars: number | null;
    poiP90Chars: number | null;
  };
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
    fuelProviders?: {
      selection: string;
      capabilityLabels: RegionCapabilityStatus[];
      capabilitySummary: Partial<Record<RegionCapabilityStatus, number>>;
      capabilities: RegionCapability[];
    };
    geocoding?: {
      activeProvider: string;
      activeMode: string;
      recommendedProductionProvider: string;
      requestedProvider: string;
      backendProxyRequired: boolean;
      sessionTokenRequired: boolean;
      googlePlacesConfigured: boolean;
      mapboxConfigured: boolean;
      lookupReadiness?: LookupReadiness;
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

export async function geocodeAddress(label: string, sessionToken?: string, context?: LocationSearchContext) {
  const suggestions = await searchLocations(label, 1, sessionToken, context);
  if (!suggestions[0]) {
    throw new Error("We couldn't find that address. Try a fuller address, suburb or postcode.");
  }
  if (addressLikeQuery(label) && weakAutoRouteLocation(suggestions[0])) {
    throw new Error("Choose a suggestion to confirm this address, or add suburb or postcode.");
  }
  return suggestions[0];
}

const locationSearchCache = new Map<string, { expiresAt: number; suggestions: MapPoint[] }>();
const LOCATION_SEARCH_CACHE_MS = 5 * 60 * 1000;

export async function searchLocations(label: string, limit = 5, sessionToken?: string, context?: LocationSearchContext) {
  const cacheKey = `${limit}:${locationSearchContextKey(context)}:${label.trim().toLowerCase().replace(/\s+/g, " ")}`;
  const cached = locationSearchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.suggestions;
  if (cached) locationSearchCache.delete(cacheKey);

  let payload: GeocodeResponse;
  try {
    payload = await fetchJson<GeocodeResponse>(
      `/api/geocode?${query({
        q: label,
        limit,
        sessionToken,
        nearLat: context?.near?.lat,
        nearLon: context?.near?.lon,
        nearRadiusKm: context?.nearRadiusKm,
      })}`,
    );
  } catch (error) {
    throw new Error(locationLookupErrorMessage(error));
  }
  const suggestions = payload.suggestions?.length
    ? payload.suggestions
    : payload.location
      ? [payload.location]
      : [];
  const rankedSuggestions = rankLocationSuggestions(suggestions, label);
  const decoratedSuggestions = rankedSuggestions.map((suggestion) => ({
    ...suggestion,
    lookupStatus: payload.lookupStatus,
    sourceLabel:
      suggestion.sourceLabel ||
      lookupSourceLabel(suggestion.provider, suggestion.matchType, payload.lookupStatus, suggestion.type, label),
  }));
  locationSearchCache.set(cacheKey, {
    expiresAt: Date.now() + LOCATION_SEARCH_CACHE_MS,
    suggestions: decoratedSuggestions,
  });
  return decoratedSuggestions;
}

function locationSearchContextKey(context?: LocationSearchContext) {
  if (!context?.near) return "none";
  return [
    context.near.lat.toFixed(3),
    context.near.lon.toFixed(3),
    Math.round(context.nearRadiusKm || 40),
  ].join(":");
}

function locationLookupErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/rate.?limited|cooling down|temporarily unavailable|provider|nominatim|google|mapbox|here|geoapify|addressr/i.test(message)) {
    return "We couldn't check that address right now. Add suburb or postcode, or try again shortly.";
  }
  return "We couldn't find that address. Try a fuller address, suburb or postcode.";
}

function rankLocationSuggestions(suggestions: MapPoint[], queryText: string) {
  if (!addressLikeQuery(queryText)) return suggestions;
  const expected = addressQueryParts(queryText);
  if (!expected) return suggestions;
  return suggestions
    .map((suggestion, index) => ({
      index,
      score: addressSuggestionScore(suggestion, expected),
      suggestion,
    }))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((item) => item.suggestion);
}

function addressQueryParts(value: string) {
  const match = value
    .trim()
    .match(/(?:unit|apt|apartment|flat|suite|townhouse)?\s*(?:\d+[a-z]?\/)?(\d+[a-z]?)\s+([a-z][a-z\s'-]*?)\s+\b(?:street|st|road|rd|avenue|ave|drive|dr|highway|hwy|terrace|tce|circuit|cct|way|lane|ln|place|pl|court|ct|crescent|cres|boulevard|bvd|blvd|parade|pde|parkway|pkwy|pwy|esplanade|esp|square|sq)\b/i);
  if (!match) return null;
  return {
    houseNumber: match[1].toLowerCase(),
    streetWords: match[2].trim().toLowerCase().split(/\s+/).filter(Boolean),
  };
}

function addressSuggestionScore(point: MapPoint, expected: { houseNumber: string; streetWords: string[] }) {
  const label = point.label.toLowerCase();
  const title = point.label.split(",")[0]?.trim().toLowerCase() || "";
  let score = 0;
  if (!title.startsWith(expected.houseNumber)) score += 100;
  if (!label.includes(expected.houseNumber)) score += 30;
  for (const word of expected.streetWords) {
    if (!label.includes(word)) score += 20;
  }
  if (point.type && !["address", "house", "residential", "road"].includes(point.type)) score += 25;
  return score;
}

function lookupSourceLabel(provider?: string, matchType?: string, lookupStatus?: string, type?: string, queryText = "") {
  if (lookupStatus === "degraded") return "Lookup limited";
  const addressLike = addressLikeQuery(queryText);
  if (provider === "fuel_path_gnaf") {
    if (matchType === "exact_address") return "Exact address";
    return "Address match";
  }
  if (provider === "fuel_path_hint" || provider === "fuel_path_regional_gazetteer") {
    if (type === "street" || addressLike) return "Street/road";
    if (["poi", "regional_poi", "airport"].includes(String(type || ""))) return "Place/landmark";
    return "Suburb/area";
  }
  if (provider === "fuel_path") return "Fuel station";
  if (provider === "google" || provider === "addressr") return "External lookup";
  if (provider === "nominatim") {
    if (addressLikeQuery(queryText)) return "Needs confirmation";
    return "Validation lookup";
  }
  return "";
}

function addressLikeQuery(value: string) {
  const text = value.trim();
  if (text.length < 8) return false;
  const hasStreetType = /\b(street|st|road|rd|avenue|ave|drive|dr|highway|hwy|terrace|tce|circuit|cct|way|lane|ln|place|pl|court|ct|crescent|cres|boulevard|bvd|blvd|parade|pde|parkway|pkwy|pwy|esplanade|esp|square|sq)\b/i.test(text);
  const hasLeadingAddressToken = /^(?:unit|apt|apartment|flat|suite|townhouse)?\s*\d+[a-z]?(?:\/\d+[a-z]?)?\s+[a-z]/i.test(text);
  return hasStreetType || hasLeadingAddressToken;
}

function weakAutoRouteLocation(point: MapPoint) {
  if (point.refineRequired || point.type === "building") return true;
  if (point.provider === "fuel_path_gnaf" && point.type === "address") return false;
  if (point.sourceLabel === "Needs confirmation") return true;
  if (point.sourceLabel === "Street/road") return true;
  if (point.provider === "google" || point.provider === "addressr" || point.provider === "nominatim") return false;
  if (point.confidence === "low") return true;
  return point.sourceLabel === "Suburb/area";
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
  approvedPolicyBrands = [],
  fuel,
  eligibleDiscounts,
  maxDetourMinutes,
  minSavingDollars,
  route,
}: {
  approvedPolicyBrands?: string[];
  fuel: FuelCode;
  eligibleDiscounts: string[];
  maxDetourMinutes: number;
  minSavingDollars: number;
  route: RouteResponse;
}) {
  const policyBrands = approvedPolicyBrands.map((brand) => brand.trim()).filter(Boolean);
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
      minSavingDollars,
      maxDetourMinutes,
      tankLitres: 55,
      tankPercent: 45,
      economy: 8.2,
      reserveKm: 35,
      corridorKm: 2.5,
      eligibleDiscounts,
      brandFilter: policyBrands.length > 0,
      brands: policyBrands,
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
