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
const DEFAULT_TOKEN_URL = "https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken";
const DEFAULT_PRICES_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v1/fuel/prices";
const DEFAULT_TAS_NEARBY_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v2/fuel/prices/nearby";

function createNswFuelCheckAdapter({ decorateStation = (station) => station } = {}) {
  const liveCache = {
    stations: null,
    loadedAtMs: 0,
    lastError: "",
  };
  const tasNearbyCaches = new Map();
  const tokenCache = {
    accessToken: "",
    loadedAtMs: 0,
  };

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
      timeoutMs: providerTimeoutMs("nsw_token", 30000),
    });
    const accessToken = payload.access_token || payload.accessToken;
    if (!accessToken) throw new Error("OAuth response did not include an access token");
    tokenCache.accessToken = String(accessToken);
    tokenCache.loadedAtMs = Date.now();
    return tokenCache.accessToken;
  }

  async function loadLiveStations({ forceRefresh = false } = {}) {
    if (!process.env.NSW_FUEL_API_KEY || !process.env.NSW_FUEL_API_SECRET) {
      throw new Error("API.NSW credentials are not configured");
    }

    const ageMs = Date.now() - liveCache.loadedAtMs;
    const ttlMs = cacheSeconds() * 1000;
    const flightKey = "provider:nsw";
    const refresh = () =>
      withProviderRetries("nsw", async () => {
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
          timeoutMs: providerTimeoutMs("nsw", 60000),
        });
        const stations = normaliseNswPayload(payload).map(decorateStation);
        liveCache.stations = stations;
        liveCache.loadedAtMs = Date.now();
        liveCache.lastError = "";
        return providerResult("nsw", {
          stations,
          cacheHit: false,
          cacheAgeSeconds: 0,
          cacheMode: "refreshed",
          error: "",
        });
      });
    if (!forceRefresh && liveCache.stations && ageMs < ttlMs) {
      return providerResult("nsw", {
        stations: liveCache.stations,
        cacheHit: true,
        cacheAgeSeconds: Math.round(ageMs / 1000),
        cacheMode: "fresh",
        error: "",
      });
    }
    if (!forceRefresh && liveCache.stations) {
      refreshProviderCacheInBackground("nsw", flightKey, refresh, liveCache);
      return staleRevalidatingProviderResult("nsw", liveCache);
    }

    const cooldownError = providerCooldownError("nsw");
    if (cooldownError) {
      if (liveCache.stations?.length) {
        return staleProviderResult("nsw", liveCache, cooldownError, {
          warning: providerCooldownWarning("nsw"),
        });
      }
      throw cooldownError;
    }

    try {
      return await singleFlight(flightKey, refresh, providerFlightHooks("nsw", liveCache));
    } catch (error) {
      liveCache.lastError = error instanceof Error ? error.message : String(error);
      if (liveCache.stations?.length) return staleProviderResult("nsw", liveCache, error);
      throw error;
    }
  }

  async function loadLiveTasStations({ forceRefresh = false, points = [], radiusKm = 0, fuels = [] } = {}) {
    if (!process.env.NSW_FUEL_API_KEY || !process.env.NSW_FUEL_API_SECRET) {
      throw new Error("API.NSW credentials are not configured");
    }

    const requests = tasNearbyRequests({ points, radiusKm, fuels });
    const results = [];
    for (const request of requests) {
      results.push(await loadTasNearbyRequest(request, { forceRefresh }));
    }

    const stations = [];
    const warnings = [];
    const providerHealthMap = {};
    const cacheModes = new Set();
    let cacheHit = true;
    let maxCacheAgeSeconds = 0;
    let degraded = false;

    for (const result of results) {
      stations.push(...result.stations);
      Object.assign(providerHealthMap, result.providerHealth || {});
      if (result.warning) warnings.push(result.warning);
      if (result.cacheMode) cacheModes.add(result.cacheMode);
      cacheHit = cacheHit && Boolean(result.cacheHit);
      if (Number.isFinite(Number(result.cacheAgeSeconds))) {
        maxCacheAgeSeconds = Math.max(maxCacheAgeSeconds, Number(result.cacheAgeSeconds));
      }
      degraded = degraded || Boolean(result.degraded || result.error || result.warning);
    }

    const byCode = new Map();
    for (const station of stations) byCode.set(String(station.stationCode), station);
    const cacheMode = cacheModes.has("stale") ? "stale" : cacheModes.has("refreshed") ? "refreshed" : cacheModes.has("fresh") ? "fresh" : "none";
    return providerResult("tas", {
      stations: [...byCode.values()],
      cacheHit,
      cacheAgeSeconds: cacheHit ? maxCacheAgeSeconds : 0,
      cacheMode,
      degraded,
      providerHealth: providerHealthMap,
      warning: warnings.join(" "),
    });
  }

  async function loadTasNearbyRequest(request, { forceRefresh = false } = {}) {
    const cache = tasCacheForKey(tasNearbyCaches, request.cacheKey);
    const ageMs = Date.now() - cache.loadedAtMs;
    const ttlMs = cacheSeconds() * 1000;
    const flightKey = `provider:tas:${request.cacheKey}`;
    const refresh = () =>
      withProviderRetries("tas", async () => {
        const apiKey = process.env.NSW_FUEL_API_KEY;
        const nearbyUrl = process.env.NSW_FUEL_TAS_NEARBY_URL || DEFAULT_TAS_NEARBY_URL;
        const token = await getNswAccessToken();
        const payload = await fetchJson(nearbyUrl, {
          data: request.body,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
            apikey: apiKey,
            transactionid: "fuel-path-tas-nearby",
            requesttimestamp: new Date().toISOString(),
          },
          timeoutMs: providerTimeoutMs("tas", 60000),
        });
        const stations = normaliseTasPayload(payload).map(decorateStation);
        cache.stations = stations;
        cache.loadedAtMs = Date.now();
        cache.lastError = "";
        return providerResult("tas", {
          stations,
          cacheHit: false,
          cacheAgeSeconds: 0,
          cacheMode: "refreshed",
          error: "",
        });
      });

    if (!forceRefresh && cache.stations && ageMs < ttlMs) {
      return providerResult("tas", {
        stations: cache.stations,
        cacheHit: true,
        cacheAgeSeconds: Math.round(ageMs / 1000),
        cacheMode: "fresh",
        error: "",
      });
    }
    if (!forceRefresh && cache.stations) {
      refreshProviderCacheInBackground("tas", flightKey, refresh, cache);
      return staleRevalidatingProviderResult("tas", cache);
    }

    const cooldownError = providerCooldownError("tas");
    if (cooldownError) {
      if (cache.stations?.length) {
        return staleProviderResult("tas", cache, cooldownError, {
          warning: providerCooldownWarning("tas"),
        });
      }
      throw cooldownError;
    }

    try {
      return await singleFlight(flightKey, refresh, providerFlightHooks("tas", cache));
    } catch (error) {
      cache.lastError = error instanceof Error ? error.message : String(error);
      if (cache.stations?.length) return staleProviderResult("tas", cache, error);
      throw error;
    }
  }

  return {
    loadLiveStations,
    loadLiveTasStations,
    normaliseNswPayload,
    normaliseTasPayload,
  };
}

function normaliseNswPayload(payload) {
  return normaliseFuelCheckPayload(payload, {
    source: "api_nsw_fuelcheck",
    stationCodePrefix: "",
    stateFilter: "",
  });
}

function normaliseTasPayload(payload) {
  return normaliseFuelCheckPayload(payload, {
    source: "api_tas_fuelcheck",
    stationCodePrefix: "TAS-",
    stateFilter: "TAS",
  });
}

function normaliseFuelCheckPayload(payload, { source, stationCodePrefix, stateFilter }) {
  const rawStations = payload?.stations || [];
  const rawPrices = payload?.prices || payload?.fuelPrices || payload?.FuelPrice || [];
  const stations = new Map();

  for (const row of rawStations) {
    if (!row || typeof row !== "object") continue;
    if (stateFilter && String(row.state || row.State || "").toUpperCase() !== stateFilter) continue;
    const stationCode = String(
      row.code || row.stationcode || row.stationCode || row.stationid || row.stationId || row.stationID || "",
    );
    if (!stationCode) continue;
    const location = typeof row.location === "object" && row.location ? row.location : {};
    const address = String(row.address || "");
    stations.set(stationCode, {
      stationCode: `${stationCodePrefix}${stationCode}`,
      name: row.name || stationCode,
      brand: row.brand || "Unknown",
      suburb: suburbFromAddress(address),
      address,
      phone: stationPhone(row),
      lat: Number(location.latitude || row.latitude || 0),
      lon: Number(location.longitude || row.longitude || 0),
      openNow: true,
      membershipRequired: false,
      updatedAt: undefined,
      source,
      prices: {},
      discounts: [],
    });
  }

  for (const row of rawPrices) {
    if (!row || typeof row !== "object") continue;
    if (stateFilter && String(row.state || row.State || "").toUpperCase() !== stateFilter) continue;
    const stationCode = String(
      row.stationcode ||
        row.stationCode ||
        row.serviceStationCode ||
        row.ServiceStationCode ||
        row.ServiceStationID ||
        row.stationid ||
        row.stationId ||
        "",
    );
    if (!stationCode) continue;
    const station =
      stations.get(stationCode) ||
      {
        stationCode: `${stationCodePrefix}${stationCode}`,
        name: row.stationname || row.stationName || row.ServiceStationName || stationCode,
        brand: row.brand || row.Brand || "Unknown",
        suburb: row.suburb || row.Suburb || "",
        address: row.address || row.Address || "",
        phone: stationPhone(row),
        lat: Number(row.latitude || row.Latitude || 0),
        lon: Number(row.longitude || row.Longitude || 0),
        openNow: true,
        membershipRequired: false,
        updatedAt: normaliseFuelCheckTimestamp(row.lastupdated || row.lastUpdated || row.LastUpdated),
        source,
        prices: {},
        discounts: [],
      };
    station.phone = station.phone || stationPhone(row);
    const fuelCode = String(row.fueltype || row.fuelType || row.FuelCode || "").toUpperCase();
    const price = row.price ?? row.Price ?? row.fuelprice;
    if (fuelCode && price !== undefined && price !== null) {
      station.prices[fuelCode] = Number(price);
    }
    const updatedAt = normaliseFuelCheckTimestamp(row.lastupdated || row.lastUpdated || row.LastUpdated);
    if (updatedAt && (!station.updatedAt || updatedAt > String(station.updatedAt))) {
      station.updatedAt = updatedAt;
    }
    stations.set(stationCode, station);
  }

  return [...stations.values()].filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lon));
}

function tasNearbyRequests({ points = [], radiusKm = 0, fuels = [] } = {}) {
  const selectedPoints = representativePoints(points);
  const selectedFuels = fuels.length ? fuels : ["U91"];
  const radius = String(Math.max(1, Math.min(30, Math.round(Number(radiusKm || 8)))));
  const requests = [];
  for (const point of selectedPoints) {
    for (const fuel of selectedFuels) {
      const body = {
        fueltype: String(fuel || "U91").toUpperCase(),
        brand: [],
        namedlocation: "",
        latitude: String(Number(point.lat)),
        longitude: String(Number(point.lon)),
        radius,
        sortby: "price",
        sortascending: "true",
      };
      requests.push({
        body,
        cacheKey: [
          body.fueltype,
          Number(point.lat).toFixed(3),
          Number(point.lon).toFixed(3),
          radius,
        ].join(":"),
      });
    }
  }
  return requests;
}

function representativePoints(points = []) {
  const valid = points
    .map((point) => ({ lat: Number(point?.lat), lon: Number(point?.lon) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (!valid.length) return [{ lat: -42.8821, lon: 147.3272 }];
  if (valid.length <= 6) return valid;
  const indexes = new Set([0, valid.length - 1]);
  for (let step = 1; step < 5; step += 1) indexes.add(Math.round((step / 5) * (valid.length - 1)));
  return [...indexes].sort((left, right) => left - right).map((index) => valid[index]);
}

function tasCacheForKey(caches, key) {
  if (!caches.has(key)) {
    caches.set(key, {
      stations: null,
      loadedAtMs: 0,
      lastError: "",
    });
  }
  return caches.get(key);
}

function stationPhone(row) {
  const value =
    row.phone ||
    row.Phone ||
    row.telephone ||
    row.Telephone ||
    row.contactNumber ||
    row.ContactNumber ||
    row.phoneNumber ||
    row.PhoneNumber ||
    row.contact ||
    row.Contact;
  const phone = String(value || "").trim();
  return phone || undefined;
}

function suburbFromAddress(address) {
  if (!address || !address.includes(",")) return "";
  const tail = address.split(",").pop().trim();
  if (tail.includes(" NSW ")) return titleCase(tail.split(" NSW ")[0]);
  if (tail.includes(" ACT ")) return titleCase(tail.split(" ACT ")[0]);
  if (tail.includes(" TAS ")) return titleCase(tail.split(" TAS ")[0]);
  return titleCase(tail);
}

function titleCase(value) {
  return String(value).toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

function normaliseFuelCheckTimestamp(value) {
  if (!value) return undefined;
  const text = String(value);
  const auMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(text);
  if (auMatch) {
    const [, day, month, year, hour, minute, second] = auMatch;
    const utcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 10, Number(minute), Number(second));
    return new Date(utcMs).toISOString();
  }
  const isoLikeLocalMatch = /^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(text);
  if (isoLikeLocalMatch) {
    const [, year, month, day, hour, minute, second] = isoLikeLocalMatch;
    const utcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 10, Number(minute), Number(second));
    return new Date(utcMs).toISOString();
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return text;
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
    const payload = text ? JSON.parse(text) : {};
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
  createNswFuelCheckAdapter,
};
