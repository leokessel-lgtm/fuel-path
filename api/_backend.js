const sample = require("./_sample");

const DEFAULT_CACHE_SECONDS = 300;
const DEFAULT_TOKEN_URL = "https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken";
const DEFAULT_PRICES_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v1/fuel/prices";
const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";
const SAMPLE_NOW = new Date("2026-06-13T08:00:00+10:00");
const RECOMMENDATION_MAX_PRICE_AGE_HOURS = 48;
const RECOMMENDED_GEOCODE_PROVIDER = "google_places_autocomplete_new";

const liveCache = {
  stations: null,
  loadedAtMs: 0,
  lastError: "",
};

const tokenCache = {
  accessToken: "",
  loadedAtMs: 0,
};

const DISCOUNT_RULES = [
  {
    id: "everyday_rewards",
    label: "Everyday Rewards",
    centsPerLitre: 4,
    brandIncludes: ["eg ampol", "ampol", "caltex"],
  },
  {
    id: "flybuys",
    label: "Flybuys docket",
    centsPerLitre: 4,
    brandIncludes: ["shell", "reddy", "coles express"],
  },
  {
    id: "nrma_ampol",
    label: "NRMA / Ampol",
    centsPerLitre: 5,
    brandIncludes: ["ampol", "caltex"],
  },
  {
    id: "fleet_card",
    label: "Fleet card",
    centsPerLitre: 3,
    brandIncludes: ["ampol", "caltex", "bp", "shell", "reddy", "united", "metro", "mobil"],
  },
  {
    id: "linkt_rewards",
    label: "Linkt Rewards",
    centsPerLitre: 6,
    brandIncludes: ["7-eleven"],
  },
  {
    id: "linkt_bonus",
    label: "Linkt toll-trip bonus",
    centsPerLitre: 26,
    brandIncludes: ["7-eleven"],
  },
];

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function methodAllowed(req, res, methods = ["GET"]) {
  if (methods.includes(req.method)) return true;
  sendJson(res, 405, { error: "Method not allowed" });
  return false;
}

function numberParam(value, fallback) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringParam(value, fallback = "") {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

function boolParam(value, fallback = false) {
  const text = String(Array.isArray(value) ? value[0] : value ?? (fallback ? "1" : "0")).toLowerCase();
  return ["1", "true", "yes", "on"].includes(text);
}

function setParam(value) {
  return new Set(
    stringParam(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function cacheSeconds() {
  return Math.max(60, Number(process.env.FUEL_PATH_LIVE_CACHE_SECONDS || DEFAULT_CACHE_SECONDS));
}

function hasLiveCredentials() {
  return Boolean(process.env.NSW_FUEL_API_KEY && process.env.NSW_FUEL_API_SECRET);
}

function googleMapsApiKey() {
  return process.env.FUEL_PATH_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
}

function googlePlacesApiKey() {
  return process.env.FUEL_PATH_GOOGLE_PLACES_API_KEY || googleMapsApiKey();
}

function googleRoutesApiKey() {
  return process.env.FUEL_PATH_GOOGLE_ROUTES_API_KEY || googleMapsApiKey();
}

function mapboxAccessToken() {
  return process.env.FUEL_PATH_MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || "";
}

function hereApiKey() {
  return process.env.FUEL_PATH_HERE_API_KEY || process.env.HERE_API_KEY || "";
}

function geoapifyApiKey() {
  return process.env.FUEL_PATH_GEOAPIFY_API_KEY || process.env.GEOAPIFY_API_KEY || "";
}

async function fetchJson(url, { data, headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`Provider returned non-JSON response: ${text.slice(0, 120)}`);
    }
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || response.statusText;
      throw new Error(`Provider returned ${response.status}: ${message}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function getNswAccessToken() {
  const ageMs = Date.now() - tokenCache.loadedAtMs;
  if (tokenCache.accessToken && ageMs < 11 * 60 * 60 * 1000) return tokenCache.accessToken;

  const apiKey = process.env.NSW_FUEL_API_KEY;
  const apiSecret = process.env.NSW_FUEL_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("API.NSW credentials are not configured");

  const tokenUrl = process.env.NSW_FUEL_TOKEN_URL || DEFAULT_TOKEN_URL;
  const url = new URL(tokenUrl);
  url.searchParams.set("grant_type", "client_credentials");
  const credential = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const payload = await fetchJson(url.toString(), {
    headers: {
      Authorization: `Basic ${credential}`,
    },
    timeoutMs: 30000,
  });
  const accessToken = payload.access_token || payload.accessToken;
  if (!accessToken) throw new Error("OAuth response did not include an access token");
  tokenCache.accessToken = String(accessToken);
  tokenCache.loadedAtMs = Date.now();
  return tokenCache.accessToken;
}

async function loadLiveStations({ forceRefresh = false } = {}) {
  if (!hasLiveCredentials()) throw new Error("API.NSW credentials are not configured");

  const ageMs = Date.now() - liveCache.loadedAtMs;
  const ttlMs = cacheSeconds() * 1000;
  if (!forceRefresh && liveCache.stations && ageMs < ttlMs) {
    return {
      stations: liveCache.stations,
      cacheHit: true,
      cacheAgeSeconds: Math.round(ageMs / 1000),
      error: "",
    };
  }

  const apiKey = process.env.NSW_FUEL_API_KEY;
  const pricesUrl = process.env.NSW_FUEL_PRICES_URL || DEFAULT_PRICES_URL;
  const token = await getNswAccessToken();
  const payload = await fetchJson(pricesUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      apikey: apiKey,
      transactionid: "fuel-path-hosted-backend",
      requesttimestamp: new Date().toISOString(),
    },
    timeoutMs: 60000,
  });
  const stations = normaliseNswPayload(payload).map(stationWithDiscountRules);
  liveCache.stations = stations;
  liveCache.loadedAtMs = Date.now();
  liveCache.lastError = "";
  return {
    stations,
    cacheHit: false,
    cacheAgeSeconds: 0,
    error: "",
  };
}

function normaliseNswPayload(payload) {
  const rawStations = payload?.stations || [];
  const rawPrices = payload?.prices || payload?.fuelPrices || payload?.FuelPrice || [];
  const stations = new Map();

  for (const row of rawStations) {
    if (!row || typeof row !== "object") continue;
    const stationCode = String(
      row.code || row.stationcode || row.stationCode || row.stationid || row.stationId || "",
    );
    if (!stationCode) continue;
    const location = typeof row.location === "object" && row.location ? row.location : {};
    const address = String(row.address || "");
    stations.set(stationCode, {
      stationCode,
      name: row.name || stationCode,
      brand: row.brand || "Unknown",
      suburb: suburbFromAddress(address),
      address,
      lat: Number(location.latitude || row.latitude || 0),
      lon: Number(location.longitude || row.longitude || 0),
      openNow: true,
      membershipRequired: false,
      updatedAt: undefined,
      source: "api_nsw_fuelcheck",
      prices: {},
      discounts: [],
    });
  }

  for (const row of rawPrices) {
    if (!row || typeof row !== "object") continue;
    const stationCode = String(
      row.stationcode ||
        row.stationCode ||
        row.serviceStationCode ||
        row.ServiceStationCode ||
        row.ServiceStationID ||
        row.stationid ||
        "",
    );
    if (!stationCode) continue;
    const station =
      stations.get(stationCode) ||
      {
        stationCode,
        name: row.stationname || row.stationName || row.ServiceStationName || stationCode,
        brand: row.brand || row.Brand || "Unknown",
        suburb: row.suburb || row.Suburb || "",
        address: row.address || row.Address || "",
        lat: Number(row.latitude || row.Latitude || 0),
        lon: Number(row.longitude || row.Longitude || 0),
        openNow: true,
        membershipRequired: false,
        updatedAt: normaliseNswTimestamp(row.lastupdated || row.lastUpdated || row.LastUpdated),
        source: "api_nsw_fuelcheck",
        prices: {},
        discounts: [],
      };
    const fuelCode = String(row.fueltype || row.fuelType || row.FuelCode || "").toUpperCase();
    const price = row.price ?? row.Price ?? row.fuelprice;
    if (fuelCode && price !== undefined && price !== null) {
      station.prices[fuelCode] = Number(price);
    }
    const updatedAt = normaliseNswTimestamp(row.lastupdated || row.lastUpdated || row.LastUpdated);
    if (updatedAt && (!station.updatedAt || updatedAt > String(station.updatedAt))) {
      station.updatedAt = updatedAt;
    }
    stations.set(stationCode, station);
  }

  return [...stations.values()].filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lon));
}

function suburbFromAddress(address) {
  if (!address || !address.includes(",")) return "";
  const tail = address.split(",").pop().trim();
  if (tail.includes(" NSW ")) return titleCase(tail.split(" NSW ")[0]);
  if (tail.includes(" ACT ")) return titleCase(tail.split(" ACT ")[0]);
  return titleCase(tail);
}

function titleCase(value) {
  return String(value).toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

function normaliseNswTimestamp(value) {
  if (!value) return undefined;
  const text = String(value);
  const auMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(text);
  if (auMatch) {
    const [, day, month, year, hour, minute, second] = auMatch;
    const utcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 10, Number(minute), Number(second));
    return new Date(utcMs).toISOString();
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return text;
}

function stationBrandText(station) {
  return `${station.brand || ""} ${station.name || ""}`.toLowerCase();
}

function stationWithDiscountRules(station) {
  const byId = new Map();
  for (const item of station.discounts || []) {
    if (item?.id) byId.set(String(item.id), { ...item });
  }
  const text = stationBrandText(station);
  for (const rule of DISCOUNT_RULES) {
    if (rule.brandIncludes.some((needle) => text.includes(needle))) {
      byId.set(rule.id, {
        id: rule.id,
        label: rule.label,
        centsPerLitre: rule.centsPerLitre,
        inferred: true,
      });
    }
  }
  return { ...station, discounts: [...byId.values()] };
}

function loadSampleStations() {
  return sample.sampleStations({ includeFixtureFallback: true }).map(stationWithDiscountRules);
}

async function loadStationData({ requestedSource = "auto", forceRefresh = false } = {}) {
  const source = resolveSource(requestedSource);
  if (source === "sample") {
    return {
      source: "sample",
      provider: "public_demo_snapshot",
      stations: loadSampleStations(),
      cacheHit: true,
      cacheAgeSeconds: null,
      warning: "",
    };
  }

  try {
    const live = await loadLiveStations({ forceRefresh });
    return {
      source: "api_nsw",
      provider: "api_nsw_fuelcheck",
      stations: live.stations,
      cacheHit: live.cacheHit,
      cacheAgeSeconds: live.cacheAgeSeconds,
      warning: "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    liveCache.lastError = message;
    return {
      source: "sample_fallback",
      provider: "public_demo_snapshot",
      stations: loadSampleStations(),
      cacheHit: true,
      cacheAgeSeconds: null,
      warning: `Live fuel provider unavailable: ${message}`,
    };
  }
}

function resolveSource(source) {
  const value = source === "auto" || !source ? (hasLiveCredentials() ? "live" : "sample") : source;
  if (!["live", "sample"].includes(value)) throw new Error("source must be live, sample or auto");
  return value;
}

function stationPayload(station, { fuel, distanceKm, routeDistance } = {}) {
  const prices = station.prices || {};
  const payload = {
    stationCode: station.stationCode,
    name: station.name,
    brand: station.brand || "Unknown",
    suburb: station.suburb,
    address: station.address,
    lat: Number(station.lat),
    lon: Number(station.lon),
    openNow: station.openNow !== false,
    membershipRequired: Boolean(station.membershipRequired),
    updatedAt: station.updatedAt,
    source: station.source,
    prices,
    discounts: station.discounts || [],
  };
  if (fuel && prices[fuel] !== undefined) payload.pumpCpl = round(Number(prices[fuel]), 1);
  if (distanceKm !== undefined) payload.distanceKm = round(distanceKm, 2);
  if (routeDistance) Object.assign(payload, routeDistance);
  return payload;
}

function pointFromQuery(req, prefix) {
  return {
    lat: numberParam(req.query[`${prefix}Lat`], 0),
    lon: numberParam(req.query[`${prefix}Lon`], 0),
    label: stringParam(req.query[`${prefix}Label`], prefix),
  };
}

function distanceKm(a, b) {
  const radiusKm = 6371;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLon = toRad(Number(b.lon) - Number(a.lon));
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(hav));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function routeDistance(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceKm(points[index - 1], points[index]);
  }
  return total;
}

function totalRouteKm(points) {
  return routeDistance(points);
}

function toLocalXYKm(point, origin) {
  const latKm = 110.574;
  const lonKm = 111.32 * Math.cos(toRad(origin.lat));
  return {
    x: (point.lon - origin.lon) * lonKm,
    y: (point.lat - origin.lat) * latKm,
  };
}

function nearestRoutePosition(station, points) {
  if (!points.length) return [0, 0];
  if (points.length === 1) return [distanceKm(station, points[0]), 0];

  let bestDistance = Infinity;
  let bestAlong = 0;
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentKm = distanceKm(start, end);
    if (segmentKm <= 0) continue;
    const localStation = toLocalXYKm(station, start);
    const localEnd = toLocalXYKm(end, start);
    const lengthSquared = localEnd.x ** 2 + localEnd.y ** 2;
    const t = Math.max(0, Math.min(1, (localStation.x * localEnd.x + localStation.y * localEnd.y) / lengthSquared));
    const projected = { x: localEnd.x * t, y: localEnd.y * t };
    const localDistance = Math.hypot(localStation.x - projected.x, localStation.y - projected.y);
    if (localDistance < bestDistance) {
      bestDistance = localDistance;
      bestAlong = travelled + segmentKm * t;
    }
    travelled += segmentKm;
  }
  return [bestDistance, bestAlong];
}

function routeFromPayload(payload) {
  const points = Array.isArray(payload?.points) ? payload.points : [];
  const cleaned = points
    .map((point) => ({
      lat: Number(point?.lat),
      lon: Number(point?.lon),
      label: String(point?.label || ""),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (cleaned.length < 2) throw new Error("Route payload needs at least two valid points");
  return {
    id: String(payload.id || "custom-route"),
    name: String(payload.name || "Custom route"),
    provider: String(payload.provider || "open"),
    points: cleaned,
    defaultCorridorKm: Number(payload.defaultCorridorKm || 2.5),
    defaultDetourSpeedKmh: Number(payload.defaultDetourSpeedKmh || 45),
  };
}

function priceAgeHours(updatedAt, now = new Date()) {
  if (!updatedAt) return Infinity;
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) return Infinity;
  return (now.getTime() - parsed.getTime()) / 3600000;
}

function freshnessPenalty(updatedAt, now) {
  const hours = priceAgeHours(updatedAt, now);
  if (!Number.isFinite(hours)) return [1.5, "price timestamp missing or invalid"];
  if (hours <= 6) return [0, ""];
  if (hours <= 24) return [0.5, `price is ${hours.toFixed(1)} hours old`];
  if (hours <= 48) return [1, `price is ${hours.toFixed(1)} hours old`];
  return [2, `price is ${hours.toFixed(1)} hours old`];
}

function median(values) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return 205;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function bestDiscount(station, eligibleDiscounts) {
  const eligible = (station.discounts || []).filter((discount) => eligibleDiscounts.has(discount.id));
  return eligible.sort((a, b) => Number(b.centsPerLitre) - Number(a.centsPerLitre))[0];
}

function adaptiveCorridorAttempts(routeDistanceKm, requestedCorridorKm) {
  const attempts = [requestedCorridorKm];
  if (routeDistanceKm >= 150) attempts.push(5, 8, 12, 20);
  else if (routeDistanceKm >= 50) attempts.push(4, 6, 10);
  else attempts.push(3.5, 5);
  return [...new Set(attempts.map((value) => round(Math.max(requestedCorridorKm, value), 1)))];
}

function scoreRoute({ source, route, stations, fuel, tankLitres, tankPercent, economy, reserveKm, corridorKm, eligibleDiscounts, includeMemberPrices, includeClosed }) {
  const points = route.points || [];
  const routeKm = totalRouteKm(points);
  const attempts = adaptiveCorridorAttempts(routeKm, corridorKm || route.defaultCorridorKm || 2.5);
  let scored = null;
  for (const attempt of attempts) {
    scored = scoreRouteForCorridor({
      source,
      route,
      stations,
      fuel,
      tankLitres,
      tankPercent,
      economy,
      reserveKm,
      corridorKm: attempt,
      eligibleDiscounts,
      includeMemberPrices,
      includeClosed,
    });
    if (scored.candidates.length || attempt === attempts[attempts.length - 1]) break;
  }
  return scored;
}

function scoreRouteForCorridor({ source, route, stations, fuel, tankLitres, tankPercent, economy, reserveKm, corridorKm, eligibleDiscounts, includeMemberPrices, includeClosed }) {
  const points = route.points || [];
  const now = source === "api_nsw" ? new Date() : SAMPLE_NOW;
  const routePositions = new Map();
  const inCorridor = [];
  for (const station of stations) {
    if (station.prices?.[fuel] === undefined) continue;
    const point = { lat: Number(station.lat), lon: Number(station.lon) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const [distanceToRouteKm, distanceAlongRouteKm] = nearestRoutePosition(point, points);
    if (distanceToRouteKm <= corridorKm) {
      inCorridor.push(station);
      routePositions.set(String(station.stationCode), { distanceToRouteKm, distanceAlongRouteKm });
    }
  }

  const availablePrices = inCorridor
    .filter((station) => station.openNow !== false && (includeMemberPrices || !station.membershipRequired))
    .map((station) => Number(station.prices?.[fuel]))
    .filter(Number.isFinite);
  const baselineCpl = median(availablePrices);
  const fillLitres = Math.max(5, tankLitres * (1 - tankPercent / 100));
  const tankRangeKm = ((tankLitres * (tankPercent / 100)) / economy) * 100;
  let staleExcludedCandidates = 0;

  const candidates = [];
  for (const station of inCorridor) {
    const routeDistanceInfo = routePositions.get(String(station.stationCode));
    if (!routeDistanceInfo) continue;
    if (!includeClosed && station.openNow === false) continue;
    if (!includeMemberPrices && station.membershipRequired) continue;

    const pumpCpl = Number(station.prices[fuel]);
    const discount = bestDiscount(station, eligibleDiscounts);
    const discountCpl = Number(discount?.centsPerLitre || 0);
    const adjustedCpl = Math.max(0, pumpCpl - discountCpl);
    const detourKm = routeDistanceInfo.distanceToRouteKm * 2 * 1.35;
    const detourMinutes = (detourKm / Number(route.defaultDetourSpeedKmh || 45)) * 60;
    const detourFuelLitres = (detourKm * economy) / 100;
    const detourCost = detourFuelLitres * (adjustedCpl / 100);
    const netSaving = fillLitres * ((baselineCpl - adjustedCpl) / 100) - detourCost;
    const reachable = tankRangeKm >= routeDistanceInfo.distanceAlongRouteKm + routeDistanceInfo.distanceToRouteKm + reserveKm;
    const [freshPenalty, freshWarning] = freshnessPenalty(station.updatedAt, now);
    if (station.source === "api_nsw_fuelcheck" && priceAgeHours(station.updatedAt, now) > RECOMMENDATION_MAX_PRICE_AGE_HOURS) {
      staleExcludedCandidates += 1;
      continue;
    }

    const warnings = [];
    if (discount) warnings.push(`discount applied: ${discount.label}`);
    if (station.membershipRequired) warnings.push("membership-only price included");
    if (station.openNow === false) warnings.push("station marked closed");
    if (!reachable) warnings.push(`range risk: needs ${(routeDistanceInfo.distanceAlongRouteKm + routeDistanceInfo.distanceToRouteKm + reserveKm).toFixed(1)} km including reserve`);
    if (freshWarning) warnings.push(freshWarning);

    const score = netSaving - detourMinutes * 0.08 - freshPenalty - (reachable ? 0 : 100) - (station.openNow === false ? 100 : 0);
    candidates.push({
      station: stationPayload(station, { fuel }),
      fuel,
      pumpCpl: round(pumpCpl, 1),
      adjustedCpl: round(adjustedCpl, 1),
      discountCpl: round(discountCpl, 1),
      discountLabel: discount?.label,
      discountLabels: discount ? [discount.label] : [],
      detourKm: round(detourKm, 2),
      detourMinutes: round(detourMinutes, 1),
      detourCost: round(detourCost, 2),
      fillLitres: round(fillLitres, 1),
      netSaving: round(netSaving, 2),
      reachable,
      openNow: station.openNow !== false,
      eligible: true,
      score: round(score, 2),
      warnings,
      distanceKm: round(routeDistanceInfo.distanceToRouteKm, 2),
      distanceToRouteKm: round(routeDistanceInfo.distanceToRouteKm, 2),
      distanceAlongRouteKm: round(routeDistanceInfo.distanceAlongRouteKm, 1),
    });
  }

  candidates.sort((left, right) => right.score - left.score);
  return {
    candidates,
    context: {
      routeId: route.id,
      routeName: route.name,
      fuel,
      routeDistanceKm: round(totalRouteKm(points), 2),
      corridorKm,
      baselineCpl: round(baselineCpl, 1),
      tankRangeKm: round(tankRangeKm, 1),
      reserveKm,
      fillLitres: round(fillLitres, 1),
      stationsInCorridor: inCorridor.length,
      eligibleCandidates: candidates.length,
      freshnessCutoffHours: RECOMMENDATION_MAX_PRICE_AGE_HOURS,
      staleExcludedCandidates,
    },
  };
}

function routeContextStations({ route, stations, fuel, excludedCodes, corridorKm, includeMemberPrices, includeClosed, limit = 40 }) {
  const contextCorridorKm = Math.min(24, Math.max(8, corridorKm + 4, corridorKm * 1.8));
  const rows = [];
  for (const station of stations) {
    const stationCode = String(station.stationCode);
    if (excludedCodes.has(stationCode) || station.prices?.[fuel] === undefined) continue;
    if (!includeClosed && station.openNow === false) continue;
    if (!includeMemberPrices && station.membershipRequired) continue;
    const [distanceToRouteKm, distanceAlongRouteKm] = nearestRoutePosition(station, route.points);
    if (distanceToRouteKm > contextCorridorKm) continue;
    rows.push({
      distanceToRouteKm,
      distanceAlongRouteKm,
      price: Number(station.prices[fuel]),
      station,
    });
  }
  rows.sort((left, right) => left.distanceToRouteKm - right.distanceToRouteKm || left.price - right.price || left.distanceAlongRouteKm - right.distanceAlongRouteKm);
  return rows.slice(0, limit).map((row) =>
    stationPayload(row.station, {
      fuel,
      routeDistance: {
        distanceToRouteKm: round(row.distanceToRouteKm, 2),
        distanceAlongRouteKm: round(row.distanceAlongRouteKm, 1),
      },
    }),
  );
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

const GEOCODE_PROVIDER_ALIASES = {
  auto: "auto",
  google: "google",
  google_places: "google",
  google_places_autocomplete_new: "google",
  mapbox: "mapbox",
  here: "here",
  geoapify: "geoapify",
  nominatim: "nominatim",
};

function normaliseGeocodeProvider(value) {
  const provider = GEOCODE_PROVIDER_ALIASES[String(value || "auto").trim().toLowerCase()];
  if (!provider) throw new Error("provider must be auto, google, mapbox, here, geoapify or nominatim");
  return provider;
}

function geocodeProviderConfigured(provider) {
  if (provider === "google") return Boolean(googlePlacesApiKey());
  if (provider === "mapbox") return Boolean(mapboxAccessToken());
  if (provider === "here") return Boolean(hereApiKey());
  if (provider === "geoapify") return Boolean(geoapifyApiKey());
  return provider === "nominatim";
}

function selectGeocodeProvider(value, { allowFallback = false } = {}) {
  const provider = normaliseGeocodeProvider(value);
  if (provider === "auto") {
    for (const candidate of ["google", "mapbox", "here", "geoapify"]) {
      if (geocodeProviderConfigured(candidate)) return candidate;
    }
    return "nominatim";
  }
  if (geocodeProviderConfigured(provider)) return provider;
  if (allowFallback) return "nominatim";
  throw new Error(`${provider} geocoding is not configured`);
}

function geocodeProviderStatus() {
  const requestedProvider = process.env.FUEL_PATH_GEOCODE_PROVIDER || "auto";
  const activeProvider = selectGeocodeProvider(requestedProvider, { allowFallback: true });
  return {
    activeProvider,
    activeMode: activeProvider === "nominatim" ? "validation" : "production_candidate",
    recommendedProductionProvider: RECOMMENDED_GEOCODE_PROVIDER,
    requestedProvider,
    supportedProviders: ["google", "mapbox", "here", "geoapify", "nominatim"],
    fallbackProvider: "nominatim",
    backendProxyRequired: true,
    sessionTokenRequired: activeProvider === "google",
    googlePlacesConfigured: Boolean(googlePlacesApiKey()),
    mapboxConfigured: Boolean(mapboxAccessToken()),
    hereConfigured: Boolean(hereApiKey()),
    geoapifyConfigured: Boolean(geoapifyApiKey()),
  };
}

const GEOCODE_QUERY_CORRECTIONS = {
  artamon: "artarmon",
};

const STREET_QUERY_PATTERN = /^(.+\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|lane|ln|way|crescent|cres)\b)\b.*$/i;

function geocodeQueryVariants(query) {
  const cleaned = String(query || "").trim().replace(/\s+/g, " ").replace(/\.+$/, "");
  const variants = [cleaned];
  let corrected = cleaned;
  for (const [typo, replacement] of Object.entries(GEOCODE_QUERY_CORRECTIONS)) {
    corrected = corrected.replace(new RegExp(`\\b${typo}\\b`, "gi"), replacement);
  }
  if (corrected !== cleaned) variants.push(corrected);
  for (const value of [...variants]) {
    const match = STREET_QUERY_PATTERN.exec(value);
    if (match) {
      const streetOnly = match[1].trim();
      variants.push(streetOnly, `${streetOnly} Sydney`, `${streetOnly} NSW`);
    }
  }
  return [...new Set(variants.filter(Boolean).map((value) => value.trim()))];
}

function geocodeItemPayload({ label, lat, lon, provider, kind = "place", providerId = "" }) {
  return {
    label,
    lat: Number(lat),
    lon: Number(lon),
    type: kind,
    provider,
    ...(providerId ? { providerId } : {}),
  };
}

async function nominatimGeocode(query, limit) {
  for (const candidateQuery of geocodeQueryVariants(query)) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", candidateQuery);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("countrycodes", "au");
    url.searchParams.set("addressdetails", "1");
    const payload = await fetchJson(url.toString(), { timeoutMs: 12000 });
    if (Array.isArray(payload) && payload.length) {
      return payload.map((item) =>
        geocodeItemPayload({
          label: String(item.display_name || item.name || candidateQuery),
          lat: item.lat,
          lon: item.lon,
          kind: String(item.type || item.class || "place"),
          provider: "nominatim",
          providerId: `${item.osm_type || ""}:${item.osm_id || ""}`,
        }),
      );
    }
  }
  throw new Error(`No location found for ${query}`);
}

async function googlePlaceDetails(placeId, sessionToken) {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
  const payload = await fetchJson(url.toString(), {
    headers: {
      "X-Goog-Api-Key": googlePlacesApiKey(),
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location,types",
    },
  });
  const location = payload?.location || {};
  if (location.latitude === undefined || location.longitude === undefined) return null;
  return geocodeItemPayload({
    label: String(payload.formattedAddress || payload.displayName?.text || placeId),
    lat: location.latitude,
    lon: location.longitude,
    kind: (payload.types || []).join(",") || "place",
    provider: "google",
    providerId: String(payload.id || placeId),
  });
}

async function googleGeocode(query, limit, sessionToken) {
  const payload = await fetchJson("https://places.googleapis.com/v1/places:autocomplete", {
    data: {
      input: query,
      sessionToken,
      includedRegionCodes: ["au"],
      languageCode: "en-AU",
    },
    headers: {
      "X-Goog-Api-Key": googlePlacesApiKey(),
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.types",
    },
  });
  const suggestions = [];
  for (const item of payload?.suggestions || []) {
    const placeId = item?.placePrediction?.placeId;
    if (!placeId) continue;
    const details = await googlePlaceDetails(String(placeId), sessionToken);
    if (details) suggestions.push(details);
    if (suggestions.length >= limit) break;
  }
  if (!suggestions.length) throw new Error(`No location found for ${query}`);
  return suggestions;
}

async function mapboxGeocode(query, limit) {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", query);
  url.searchParams.set("country", "au");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("access_token", mapboxAccessToken());
  const payload = await fetchJson(url.toString());
  const suggestions = [];
  for (const feature of payload?.features || []) {
    const coordinates = feature?.geometry?.coordinates || [];
    if (coordinates.length < 2) continue;
    const properties = feature.properties || {};
    suggestions.push(
      geocodeItemPayload({
        label: String(properties.full_address || properties.name_preferred || properties.name || feature.place_name || query),
        lat: coordinates[1],
        lon: coordinates[0],
        kind: String(properties.feature_type || "place"),
        provider: "mapbox",
        providerId: String(properties.mapbox_id || feature.id || ""),
      }),
    );
  }
  if (!suggestions.length) throw new Error(`No location found for ${query}`);
  return suggestions;
}

async function hereGeocode(query, limit) {
  const url = new URL("https://autosuggest.search.hereapi.com/v1/autosuggest");
  url.searchParams.set("q", query);
  url.searchParams.set("at", "-33.8688,151.2093");
  url.searchParams.set("in", "countryCode:AUS");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apiKey", hereApiKey());
  const payload = await fetchJson(url.toString());
  const suggestions = [];
  for (const item of payload?.items || []) {
    const position = item.position || {};
    if (position.lat === undefined || position.lng === undefined) continue;
    suggestions.push(
      geocodeItemPayload({
        label: String(item.title || item.address?.label || query),
        lat: position.lat,
        lon: position.lng,
        kind: String(item.resultType || "place"),
        provider: "here",
        providerId: String(item.id || ""),
      }),
    );
  }
  if (!suggestions.length) throw new Error(`No location found for ${query}`);
  return suggestions;
}

async function geoapifyGeocode(query, limit) {
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("text", query);
  url.searchParams.set("filter", "countrycode:au");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apiKey", geoapifyApiKey());
  const payload = await fetchJson(url.toString());
  const items = Array.isArray(payload?.features) ? payload.features : Array.isArray(payload?.results) ? payload.results : [];
  const suggestions = [];
  for (const item of items) {
    const properties = item.properties || item;
    const coordinates = item.geometry?.coordinates || [];
    const lat = properties.lat ?? coordinates[1];
    const lon = properties.lon ?? coordinates[0];
    if (lat === undefined || lon === undefined) continue;
    suggestions.push(
      geocodeItemPayload({
        label: String(properties.formatted || properties.address_line1 || query),
        lat,
        lon,
        kind: String(properties.result_type || "place"),
        provider: "geoapify",
        providerId: String(properties.place_id || ""),
      }),
    );
  }
  if (!suggestions.length) throw new Error(`No location found for ${query}`);
  return suggestions;
}

async function geocode({ query, limit, sessionToken, provider }) {
  const selectedProvider = selectGeocodeProvider(provider || process.env.FUEL_PATH_GEOCODE_PROVIDER || "auto");
  const suggestions =
    selectedProvider === "google"
      ? await googleGeocode(query, limit, sessionToken)
      : selectedProvider === "mapbox"
        ? await mapboxGeocode(query, limit)
        : selectedProvider === "here"
          ? await hereGeocode(query, limit)
          : selectedProvider === "geoapify"
            ? await geoapifyGeocode(query, limit)
            : await nominatimGeocode(query, limit);
  return {
    provider: selectedProvider,
    providerMode: selectedProvider === "nominatim" ? "validation" : "production_candidate",
    recommendedProductionProvider: RECOMMENDED_GEOCODE_PROVIDER,
    requestedProvider: provider || process.env.FUEL_PATH_GEOCODE_PROVIDER || "auto",
    sessionToken,
    query,
    location: suggestions[0],
    suggestions,
  };
}

function activeRouteProvider() {
  const requested = String(process.env.FUEL_PATH_ROUTE_PROVIDER || "auto").toLowerCase();
  if (requested === "google") return googleRoutesApiKey() ? "google" : "osrm";
  if (requested === "osrm") return "osrm";
  return googleRoutesApiKey() ? "google" : "osrm";
}

function routeProviderStatus() {
  const activeProvider = activeRouteProvider();
  return {
    activeProvider,
    activeMode: activeProvider === "google" ? "production_candidate" : "validation",
    requestedProvider: process.env.FUEL_PATH_ROUTE_PROVIDER || "auto",
    supportedProviders: ["google", "osrm"],
    fallbackProvider: "osrm",
    googleRoutesConfigured: Boolean(googleRoutesApiKey()),
  };
}

async function buildRoute({ from, to }) {
  const provider = activeRouteProvider();
  if (provider === "google") {
    try {
      return await googleRoute(from, to);
    } catch (error) {
      return await osrmRoute(from, to, {
        providerWarning: `Google Routes unavailable: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  return osrmRoute(from, to);
}

async function googleRoute(from, to) {
  const payload = await fetchJson("https://routes.googleapis.com/directions/v2:computeRoutes", {
    data: {
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lon } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lon } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      units: "METRIC",
      languageCode: "en-AU",
    },
    headers: {
      "X-Goog-Api-Key": googleRoutesApiKey(),
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    timeoutMs: 15000,
  });
  const route = payload?.routes?.[0];
  const points = decodePolyline(route?.polyline?.encodedPolyline || "");
  if (!route || points.length < 2) throw new Error("Google route returned no geometry");
  points[0].label = from.label;
  points[points.length - 1].label = to.label;
  return {
    provider: "google_routes",
    distanceKm: round(Number(route.distanceMeters || 0) / 1000, 2),
    durationMin: round(parseDurationSeconds(route.duration) / 60, 1),
    points,
  };
}

async function osrmRoute(from, to, extra = {}) {
  if (!from.lat || !from.lon || !to.lat || !to.lon) {
    throw new Error("fromLat, fromLon, toLat and toLon are required");
  }
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(coords).replace(/%3B/g, ";").replace(/%2C/g, ",")}?overview=full&geometries=geojson`;
  const payload = await fetchJson(url, { timeoutMs: 20000 });
  const route = payload?.routes?.[0];
  const coordinates = route?.geometry?.coordinates || [];
  if (payload?.code !== "Ok" || coordinates.length < 2) throw new Error(payload?.message || "Route not found");
  const points = coordinates.map(([lon, lat]) => ({ lat: Number(lat), lon: Number(lon) }));
  points[0].label = from.label;
  points[points.length - 1].label = to.label;
  return {
    provider: "osrm",
    providerMode: "validation",
    distanceKm: round(Number(route.distance || 0) / 1000, 2),
    durationMin: round(Number(route.duration || 0) / 60, 1),
    points,
    ...extra,
  };
}

function parseDurationSeconds(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const match = /^([0-9.]+)s$/.exec(String(value));
  return match ? Number(match[1]) : 0;
}

function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    const latitudeResult = decodePolylineChunk(encoded, index);
    lat += latitudeResult.delta;
    index = latitudeResult.index;
    const longitudeResult = decodePolylineChunk(encoded, index);
    lon += longitudeResult.delta;
    index = longitudeResult.index;
    points.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return points;
}

function decodePolylineChunk(encoded, startIndex) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte;
  do {
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20 && index < encoded.length);
  const delta = result & 1 ? ~(result >> 1) : result >> 1;
  return { delta, index };
}

function alertsStatus() {
  return {
    mode: "contract_only",
    schedulerEnabled: false,
    storageConfigured: false,
    pushProviderConfigured: false,
    cronConfigured: false,
    nextBuildStep: "Add saved-route storage and a scheduled backend evaluator before enabling smart push alerts.",
  };
}

module.exports = {
  alertsStatus,
  boolParam,
  buildRoute,
  cacheSeconds,
  distanceKm,
  geocode,
  geocodeProviderStatus,
  hasLiveCredentials,
  loadStationData,
  methodAllowed,
  numberParam,
  pointFromQuery,
  routeContextStations,
  routeFromPayload,
  routeProviderStatus,
  scoreRoute,
  sendJson,
  setParam,
  stationPayload,
  stringParam,
};
