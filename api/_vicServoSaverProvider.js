const {
  providerCooldownError,
  providerCooldownWarning,
  providerResult,
  providerTimeoutMs,
  recordProviderFailure,
  recordProviderSuccess,
  singleFlight,
  staleProviderResult,
  staleRevalidatingProviderResult,
  withProviderRetries,
} = require("./_providerRuntime");

const DEFAULT_CACHE_SECONDS = 300;
const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";
const DEFAULT_BASE_URL = "https://api.fuel.service.vic.gov.au/open-data/v1";
const DEFAULT_TRANSACTION_ID = "fuel-path-vic-servo-saver";

const FUEL_TYPE_ALIASES = {
  DSL: "DL",
  PDSL: "PDL",
  DIESEL: "DL",
  "PREMIUM DIESEL": "PDL",
  PETROL: "U91",
  "UNLEADED 91": "U91",
  "UNLEADED PETROL": "U91",
  "PREMIUM UNLEADED 95": "P95",
  "PREMIUM UNLEADED 98": "P98",
  "ETHANOL 10": "E10",
  "ETHANOL 85": "E85",
  "LIQUEFIED PETROLEUM GAS": "LPG",
  LPG: "LPG",
  "LIQUEFIED NATURAL GAS": "LNG",
};

function createVicServoSaverAdapter({ decorateStation = (station) => station } = {}) {
  const vicLiveCache = emptyCache();
  const vicReferenceCache = {
    brands: new Map(),
    types: new Map(),
    loadedAtMs: 0,
    lastError: "",
  };

  async function loadReferenceData(baseUrl) {
    const ageMs = Date.now() - vicReferenceCache.loadedAtMs;
    if (vicReferenceCache.loadedAtMs && ageMs < 10 * 60 * 1000) return;

    const [brandsPayload, typesPayload, stationsPayload] = await Promise.all([
      vicApiGet(baseUrl, "/fuel/reference-data/brands"),
      vicApiGet(baseUrl, "/fuel/reference-data/types"),
      vicApiGet(baseUrl, "/fuel/reference-data/stations"),
    ]);

    vicReferenceCache.brands = buildLookup(
      brandsPayload,
      ["id", "brandId", "BrandId"],
      ["name", "brand", "brandName", "BrandName"],
    );
    vicReferenceCache.types = buildLookup(
      typesPayload,
      ["id", "fuelTypeId", "FuelTypeId", "code", "fuelCode", "FuelCode"],
      ["name", "fuelType", "type", "description"],
    );
    vicReferenceCache.stations = buildStationLookup(stationsPayload);
    vicReferenceCache.loadedAtMs = Date.now();
  }

  async function loadLiveVicStations({ forceRefresh = false } = {}) {
    const ageMs = Date.now() - vicLiveCache.loadedAtMs;
    const ttlMs = cacheSeconds() * 1000;
    const flightKey = "provider:vic";

    if (!hasVicCredentials()) {
      vicLiveCache.stations = null;
      vicLiveCache.loadedAtMs = 0;
      vicLiveCache.lastError = "VIC Servo Saver API access is not configured";
      throw new Error("VIC Servo Saver API access is not configured");
    }

    const refresh = async () =>
      withProviderRetries("vic", async () => {
        const baseUrl = (process.env.VIC_SERVO_SAVER_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
        await loadReferenceData(baseUrl);
        const prices = await vicApiGet(baseUrl, "/fuel/prices");
        const stations = normaliseVicPayload(prices, {
          brands: vicReferenceCache.brands,
          types: vicReferenceCache.types,
          stations: vicReferenceCache.stations,
        }).map(decorateStation);
        vicLiveCache.stations = stations;
        vicLiveCache.loadedAtMs = Date.now();
        vicLiveCache.lastError = "";
        return providerResult("vic", {
          stations,
          cacheHit: false,
          cacheAgeSeconds: 0,
          cacheMode: "refreshed",
          error: "",
        });
      });

    if (!forceRefresh && vicLiveCache.stations && ageMs < ttlMs) {
      return providerResult("vic", {
        stations: vicLiveCache.stations,
        cacheHit: true,
        cacheAgeSeconds: Math.round(ageMs / 1000),
        cacheMode: "fresh",
        error: "",
      });
    }

    if (!forceRefresh && vicLiveCache.stations) {
      refreshProviderCacheInBackground("vic", flightKey, refresh, vicLiveCache);
      return staleRevalidatingProviderResult("vic", vicLiveCache);
    }

    const cooldownError = providerCooldownError("vic");
    if (cooldownError) {
      if (vicLiveCache.stations?.length) {
        return staleProviderResult("vic", vicLiveCache, cooldownError, {
          warning: providerCooldownWarning("vic"),
        });
      }
      throw cooldownError;
    }

    try {
      return await singleFlight(flightKey, refresh, providerFlightHooks("vic", vicLiveCache));
    } catch (error) {
      vicLiveCache.lastError = error instanceof Error ? error.message : String(error);
      if (vicLiveCache.stations?.length) return staleProviderResult("vic", vicLiveCache, error);
      throw error;
    }
  }

  return {
    loadLiveVicStations,
    normaliseVicPayload,
  };
}

function normaliseVicPayload(payload, { brands = new Map(), types = new Map(), stations = new Map() } = {}) {
  const entries = extractVicEntries(payload);
  const byStation = new Map();

  for (const entry of entries) {
    const stationInfo = entry.fuelStation || entry.station || entry;
    const stationId = String(stationInfo.id || stationInfo.stationId || stationInfo.station || "").trim();
    if (!stationId) continue;
    const referenceStation = stations.get(stationId) || {};
    const address = normaliseVicAddress(stationInfo.address || referenceStation.address || "");
    const lat = Number(
      stationInfo.location?.latitude ||
        stationInfo.latitude ||
        stationInfo.lat ||
        referenceStation.lat ||
        0,
    );
    const lon = Number(
      stationInfo.location?.longitude ||
        stationInfo.longitude ||
        stationInfo.lon ||
        referenceStation.lon ||
        0,
    );

    const stationCode = `VIC-${stationId}`;
    const cached = byStation.get(stationCode) || {
      stationCode,
      name: String(stationInfo.name || referenceStation.name || stationId),
      brand: resolveVicBrand({ ...referenceStation, ...stationInfo }, brands),
      suburb: suburbFromVicAddress(address),
      address,
      phone: normalisePhone(
        stationInfo.contactPhone ||
          stationInfo.phone ||
          stationInfo.contactNumber ||
          referenceStation.phone,
      ),
      lat,
      lon,
      openNow: undefined,
      membershipRequired: false,
      updatedAt: normaliseVicTimestamp(stationInfo.updatedAt || referenceStation.updatedAt),
      source: "api_vic_servo_saver",
      prices: {},
      discounts: [],
    };

    const priceRows = Array.isArray(entry.fuelPrices) ? entry.fuelPrices : [];
    for (const price of priceRows) {
      const fuelType = resolveFuelType(price?.fuelType || price?.type || price?.fuelTypeCode, types);
      const priceValue = Number(price?.price);
      const isAvailable = price?.isAvailable === undefined ? true : Boolean(price.isAvailable);
      if (!fuelType || !Number.isFinite(priceValue) || !isAvailable) continue;
      cached.prices[fuelType] = priceValue;
      const latest = normaliseVicTimestamp(price?.updatedAt || price?.lastUpdated || price?.lastupdated || price?.dateTime);
      if (latest && (!cached.updatedAt || latest > cached.updatedAt)) {
        cached.updatedAt = latest;
      }
    }

    cached.updatedAt = normaliseVicTimestamp(cached.updatedAt);
    if (cached.updatedAt && stationInfo.updatedAt) {
      const stationUpdated = normaliseVicTimestamp(stationInfo.updatedAt);
      if (stationUpdated && stationUpdated > cached.updatedAt) cached.updatedAt = stationUpdated;
    }

    byStation.set(stationCode, cached);
  }

  return [...byStation.values()].filter(
    (station) =>
      Object.keys(station.prices || {}).length &&
      Number.isFinite(station.lat) &&
      Number.isFinite(station.lon) &&
      (station.lat || station.lon),
  );
}

function extractVicEntries(payload) {
  if (Array.isArray(payload?.fuelPriceDetails)) return payload.fuelPriceDetails;
  if (Array.isArray(payload?.stations)) return payload.stations;
  if (Array.isArray(payload)) return payload;
  return [];
}

function buildLookup(payload, idKeys, valueKeys) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.stations)
        ? payload.stations
        : Array.isArray(payload?.brands)
          ? payload.brands
          : Array.isArray(payload?.types)
            ? payload.types
            : Array.isArray(payload?.fuelTypes)
              ? payload.fuelTypes
              : Array.isArray(payload?.fuelBrands)
                ? payload.fuelBrands
                : [];
  const lookup = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rowId = pickString(row, idKeys);
    if (!rowId) continue;
    const value = pickString(row, valueKeys);
    if (!value) continue;
    lookup.set(rowId, value);
  }
  return lookup;
}

function buildStationLookup(payload) {
  const rows = extractLookupRows(payload);
  const lookup = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rowId = pickString(row, ["id", "stationId", "StationId", "stationCode"]);
    if (!rowId) continue;
    lookup.set(rowId, {
      id: rowId,
      name: pickString(row, ["name", "station", "stationName", "StationName"]),
      brand: pickString(row, ["brand", "brandName", "BrandName"]),
      brandId: pickString(row, ["brandId", "brand_id", "brandCode", "BrandId"]),
      address: normaliseVicAddress(pickString(row, ["address", "fullAddress", "Address"])),
      phone: pickString(row, ["contactPhone", "phone", "contactNumber", "Phone"]),
      lat: Number(row?.location?.latitude || row?.latitude || row?.lat || 0),
      lon: Number(row?.location?.longitude || row?.longitude || row?.lon || 0),
      updatedAt: normaliseVicTimestamp(row?.updatedAt || row?.lastUpdated),
    });
  }
  return lookup;
}

function extractLookupRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.stations)) return payload.stations;
  if (Array.isArray(payload?.brands)) return payload.brands;
  if (Array.isArray(payload?.types)) return payload.types;
  if (Array.isArray(payload?.fuelTypes)) return payload.fuelTypes;
  if (Array.isArray(payload?.fuelBrands)) return payload.fuelBrands;
  return [];
}

function resolveVicBrand(station, brands) {
  const brandId = String(station?.brandId || station?.brand_id || station?.brandCode || "").trim();
  if (brandId && brands.has(brandId)) return brands.get(brandId);
  return station?.brand || "Unknown";
}

function resolveFuelType(rawType, types) {
  const normalised = String(rawType || "").trim().toUpperCase();
  if (!normalised) return "";
  if (FUEL_TYPE_ALIASES[normalised]) return FUEL_TYPE_ALIASES[normalised];
  if (types.has(normalised)) return resolveFuelType(types.get(normalised), new Map());
  return normalised;
}

function normaliseVicAddress(address) {
  return String(address || "")
    .replace(/\s+/g, " ")
    .replace(/,\s*Australia$/i, "")
    .trim();
}

function suburbFromVicAddress(address) {
  const text = normaliseVicAddress(address);
  if (!text) return "";
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    for (let i = parts.length - 2; i >= 0; i -= 1) {
      const candidate = parts[i];
      if (candidate && !/^\d/.test(candidate)) return candidate;
    }
  }
  const match = /(?:^|,\s*)([^,]+?)\s+(?:VIC|VICTORIA)\s+\d{4}$/i.exec(text);
  return match?.[1]?.trim() || "";
}

function hasVicCredentials() {
  return Boolean(process.env.VIC_SERVO_SAVER_API_KEY);
}

function normalisePhone(value) {
  const text = String(value || "").trim();
  return text || undefined;
}

function normaliseVicTimestamp(value) {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function pickString(row, keys = []) {
  for (const key of keys) {
    const value = row?.[key];
    const text = value === null || value === undefined ? "" : String(value).trim();
    if (text) return text;
  }
  return "";
}

async function vicApiGet(baseUrl, path, { headers = {}, timeoutMs = null } = {}) {
  if (!process.env.VIC_SERVO_SAVER_API_KEY) {
    throw new Error("VIC Servo Saver API access is not configured");
  }

  return fetchVicJson(baseUrl, path, {
    headers: {
      "x-consumer-id": process.env.VIC_SERVO_SAVER_API_KEY,
      "x-transactionid": process.env.VIC_SERVO_SAVER_API_TRANSACTION_ID || DEFAULT_TRANSACTION_ID,
      ...headers,
    },
    timeoutMs: timeoutMs || providerTimeoutMs("vic", 30000),
  });
}

async function fetchVicJson(baseUrl, path, { headers = {}, timeoutMs = 12000 } = {}) {
  const url = `${baseUrl.replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`;
  const response = await fetchJson(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": DEFAULT_USER_AGENT,
      ...headers,
    },
    timeoutMs,
  });
  return response;
}

async function fetchJson(url, { headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        ...headers,
      },
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
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Provider request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function cacheSeconds() {
  return Math.max(60, Number(process.env.FUEL_PATH_LIVE_CACHE_SECONDS || DEFAULT_CACHE_SECONDS));
}

function emptyCache() {
  return {
    stations: null,
    loadedAtMs: 0,
    lastError: "",
  };
}

function providerFlightHooks(provider, cache) {
  return {
    onSuccess: () => recordProviderSuccess(provider),
    onFailure: (error) => {
      recordProviderFailure(provider, error);
      if (cache) cache.lastError = error instanceof Error ? error.message : String(error);
    },
  };
}

function refreshProviderCacheInBackground(provider, flightKey, refresh, cache) {
  void singleFlight(flightKey, refresh, providerFlightHooks(provider, cache)).catch((error) => {
    if (cache) cache.lastError = error instanceof Error ? error.message : String(error);
  });
}

module.exports = {
  createVicServoSaverAdapter,
  normaliseVicPayload,
};
