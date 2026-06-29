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
const DEFAULT_QLD_FUEL_API_BASE_URL = "https://fppdirectapi-prod.fuelpricesqld.com.au";
const DEFAULT_SA_FUEL_API_BASE_URL = "https://fppdirectapi-prod.safuelpricinginformation.com.au";
const QLD_REGION_PARAMS = {
  countryId: 21,
  geoRegionLevel: 3,
  geoRegionId: 1,
};
const SA_REGION_PARAMS = {
  countryId: 21,
  geoRegionLevel: 3,
  geoRegionId: 4,
};
const QLD_FUEL_ID_TO_CODE = new Map([
  [2, "U91"],
  [3, "DL"],
  [5, "P95"],
  [8, "P98"],
  [12, "E10"],
  [14, "PDL"],
]);
const SA_FUEL_ID_TO_CODE = QLD_FUEL_ID_TO_CODE;
const QLD_UNAVAILABLE_PRICE = 9999;
const SA_UNAVAILABLE_PRICE = 9999;

function createFppDirectProvider({ decorateStation = (station) => station } = {}) {
  const qldLiveCache = emptyCache();
  const saLiveCache = emptyCache();

  return {
    loadLiveQldStations: createLiveLoader({
      provider: "qld",
      tokenEnv: "QLD_FUEL_API_TOKEN",
      baseUrlEnv: "QLD_FUEL_API_BASE_URL",
      defaultBaseUrl: DEFAULT_QLD_FUEL_API_BASE_URL,
      regionParams: QLD_REGION_PARAMS,
      cache: qldLiveCache,
      normalise: normaliseQldPayload,
      decorateStation,
    }),
    loadLiveSaStations: createLiveLoader({
      provider: "sa",
      tokenEnv: "SA_FUEL_API_TOKEN",
      baseUrlEnv: "SA_FUEL_API_BASE_URL",
      defaultBaseUrl: DEFAULT_SA_FUEL_API_BASE_URL,
      regionParams: SA_REGION_PARAMS,
      cache: saLiveCache,
      normalise: normaliseSaPayload,
      decorateStation,
    }),
    normaliseQldPayload,
    normaliseSaPayload,
  };
}

function createLiveLoader({ provider, tokenEnv, baseUrlEnv, defaultBaseUrl, regionParams, cache, normalise, decorateStation }) {
  return async function loadLiveFppDirectStations({ forceRefresh = false } = {}) {
    const ageMs = Date.now() - cache.loadedAtMs;
    const ttlMs = Math.max(cacheSeconds(), 60) * 1000;
    const flightKey = `provider:${provider}`;
    const refresh = () =>
      withProviderRetries(provider, async () => {
        const apiGet = (path, params) => fppDirectApiGet({
          provider,
          tokenEnv,
          baseUrlEnv,
          defaultBaseUrl,
          path,
          params,
        });
        const [brands, regions, sites, prices] = await Promise.all([
          apiGet("/Subscriber/GetCountryBrands", { countryId: 21 }),
          apiGet("/Subscriber/GetCountryGeographicRegions", { countryId: 21 }),
          apiGet("/Subscriber/GetFullSiteDetails", regionParams),
          apiGet("/Price/GetSitesPrices", regionParams),
        ]);
        const stations = normalise(sites, prices, brands, regions).map(decorateStation);
        cache.stations = stations;
        cache.loadedAtMs = Date.now();
        cache.lastError = "";
        return providerResult(provider, {
          stations,
          cacheHit: false,
          cacheAgeSeconds: 0,
          cacheMode: "refreshed",
          error: "",
        });
      });
    if (!forceRefresh && cache.stations && ageMs < ttlMs) {
      return providerResult(provider, {
        stations: cache.stations,
        cacheHit: true,
        cacheAgeSeconds: Math.round(ageMs / 1000),
        cacheMode: "fresh",
        error: "",
      });
    }
    if (!forceRefresh && cache.stations) {
      refreshProviderCacheInBackground(provider, flightKey, refresh, cache);
      return staleRevalidatingProviderResult(provider, cache);
    }

    const cooldownError = providerCooldownError(provider);
    if (cooldownError) {
      if (cache.stations?.length) {
        return staleProviderResult(provider, cache, cooldownError, {
          warning: providerCooldownWarning(provider),
        });
      }
      throw cooldownError;
    }

    try {
      return await singleFlight(flightKey, refresh, providerFlightHooks(provider, cache));
    } catch (error) {
      cache.lastError = error instanceof Error ? error.message : String(error);
      if (cache.stations?.length) return staleProviderResult(provider, cache, error);
      throw error;
    }
  };
}

async function fppDirectApiGet({ provider, tokenEnv, baseUrlEnv, defaultBaseUrl, path, params }) {
  const token = process.env[tokenEnv];
  if (!token) throw new Error(`${provider.toUpperCase()} fuel API token is not configured`);
  const baseUrl = process.env[baseUrlEnv] || defaultBaseUrl;
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return fetchJson(url.toString(), {
    headers: {
      Authorization: `FPDAPI SubscriberToken=${token}`,
      "Content-Type": "application/json",
    },
    timeoutMs: providerTimeoutMs(provider, 60000),
  });
}

function normaliseQldPayload(sitePayload, pricePayload, brandPayload = {}, regionPayload = {}) {
  const brands = qldLookupById(brandPayload, "Brands", "BrandId");
  const regions = qldRegionLookupById(regionPayload);
  const stations = new Map();

  for (const row of sitePayload?.S || []) {
    if (!row || typeof row !== "object") continue;
    const siteId = String(row.S || "");
    if (!siteId) continue;
    const suburb = qldRegionName(row, regions);
    const brandId = String(row.B || "");
    stations.set(siteId, {
      stationCode: `QLD-${siteId}`,
      name: row.N || siteId,
      brand: brands.get(brandId) || "Unknown",
      suburb,
      address: qldAddress(row, suburb),
      phone: undefined,
      lat: Number(row.Lat || 0),
      lon: Number(row.Lng || 0),
      openNow: qldOpenNow(row),
      membershipRequired: false,
      updatedAt: normaliseQldTimestamp(row.M),
      source: "api_qld_fuelprices",
      prices: {},
      discounts: [],
    });
  }

  for (const row of pricePayload?.SitePrices || []) {
    if (!row || typeof row !== "object") continue;
    const siteId = String(row.SiteId || "");
    if (!siteId) continue;
    const fuelCode = QLD_FUEL_ID_TO_CODE.get(Number(row.FuelId || 0));
    const price = qldPriceCpl(row.Price);
    if (!fuelCode || price === undefined) continue;
    const station =
      stations.get(siteId) ||
      {
        stationCode: `QLD-${siteId}`,
        name: siteId,
        brand: "Unknown",
        suburb: "",
        address: "",
        phone: undefined,
        lat: 0,
        lon: 0,
        openNow: undefined,
        membershipRequired: false,
        updatedAt: undefined,
        source: "api_qld_fuelprices",
        prices: {},
        discounts: [],
      };
    station.prices[fuelCode] = price;
    const updatedAt = normaliseQldTimestamp(row.TransactionDateUtc);
    if (updatedAt && (!station.updatedAt || updatedAt > String(station.updatedAt))) {
      station.updatedAt = updatedAt;
    }
    stations.set(siteId, station);
  }

  return [...stations.values()].filter(
    (station) =>
      Object.keys(station.prices || {}).length &&
      Number.isFinite(station.lat) &&
      Number.isFinite(station.lon) &&
      (station.lat || station.lon),
  );
}

function normaliseSaPayload(sitePayload, pricePayload, brandPayload = {}, regionPayload = {}) {
  const brands = qldLookupById(brandPayload, "Brands", "BrandId");
  const regions = qldRegionLookupById(regionPayload);
  const stations = new Map();

  for (const row of sitePayload?.S || []) {
    if (!row || typeof row !== "object") continue;
    const siteId = String(row.S || "");
    if (!siteId) continue;
    const suburb = saRegionName(row, regions);
    const brandId = String(row.B || "");
    stations.set(siteId, {
      stationCode: `SA-${siteId}`,
      name: row.N || siteId,
      brand: brands.get(brandId) || "Unknown",
      suburb,
      address: saAddress(row, suburb),
      phone: stationPhone(row),
      lat: Number(row.Lat || 0),
      lon: Number(row.Lng || 0),
      openNow: qldOpenNow(row),
      membershipRequired: false,
      updatedAt: normaliseQldTimestamp(row.M),
      source: "api_sa_fuel_price_reporting",
      prices: {},
      discounts: [],
    });
  }

  for (const row of pricePayload?.SitePrices || []) {
    if (!row || typeof row !== "object") continue;
    const siteId = String(row.SiteId || "");
    if (!siteId) continue;
    const fuelCode = SA_FUEL_ID_TO_CODE.get(Number(row.FuelId || 0));
    const price = saPriceCpl(row.Price);
    if (!fuelCode || price === undefined) continue;
    const station =
      stations.get(siteId) ||
      {
        stationCode: `SA-${siteId}`,
        name: siteId,
        brand: "Unknown",
        suburb: "",
        address: "",
        phone: undefined,
        lat: 0,
        lon: 0,
        openNow: undefined,
        membershipRequired: false,
        updatedAt: undefined,
        source: "api_sa_fuel_price_reporting",
        prices: {},
        discounts: [],
      };
    station.prices[fuelCode] = price;
    const updatedAt = normaliseQldTimestamp(row.TransactionDateUtc);
    if (updatedAt && (!station.updatedAt || updatedAt > String(station.updatedAt))) {
      station.updatedAt = updatedAt;
    }
    stations.set(siteId, station);
  }

  return [...stations.values()].filter(
    (station) =>
      Object.keys(station.prices || {}).length &&
      Number.isFinite(station.lat) &&
      Number.isFinite(station.lon) &&
      (station.lat || station.lon),
  );
}

function qldLookupById(payload, listKey, idKey) {
  const rows = Array.isArray(payload?.[listKey]) ? payload[listKey] : [];
  const lookup = new Map();
  for (const row of rows) {
    if (row && row[idKey] !== undefined && row.Name) lookup.set(String(row[idKey]), String(row.Name));
  }
  return lookup;
}

function qldRegionLookupById(payload) {
  const rows = Array.isArray(payload?.GeographicRegions) ? payload.GeographicRegions : [];
  const lookup = new Map();
  for (const row of rows) {
    if (row && row.GeoRegionId !== undefined && row.Name) lookup.set(String(row.GeoRegionId), row);
  }
  return lookup;
}

function qldRegionName(row, regions) {
  for (const key of ["G1", "G2", "G3", "G4", "G5"]) {
    const value = row?.[key];
    const region = regions.get(String(value));
    if (region && Number(region.GeoRegionLevel) === 1 && !/^queensland$/i.test(String(region.Name))) {
      return String(region.Name);
    }
  }
  return qldSuburbFromAddress(row?.A, row?.P) || qldSuburbFromName(row?.N);
}

function qldAddress(row, suburb) {
  const address = String(row.A || "").replace(/\s+/g, " ").replace(/,\s*Australia$/i, "").trim();
  const postcode = String(row.P || "").trim();
  if (/\b(?:QLD|Queensland)\s+\d{4}\b/i.test(address)) return address;
  return [address, suburb, `QLD ${postcode}`.trim()].filter(Boolean).join(", ");
}

function saRegionName(row, regions) {
  for (const key of ["G1", "G2", "G3", "G4", "G5"]) {
    const value = row?.[key];
    const region = regions.get(String(value));
    if (region && Number(region.GeoRegionLevel) === 1 && !/^south australia$/i.test(String(region.Name))) {
      return String(region.Name);
    }
  }
  return saSuburbFromAddress(row?.A, row?.P) || qldSuburbFromName(row?.N);
}

function saAddress(row, suburb) {
  const address = String(row.A || "").replace(/\s+/g, " ").replace(/,\s*Australia$/i, "").trim();
  const postcode = String(row.P || "").trim();
  if (/\b(?:SA|South Australia)\s+\d{4}\b/i.test(address)) return address;
  return [address, suburb, `SA ${postcode}`.trim()].filter(Boolean).join(", ");
}

function saSuburbFromAddress(address, postcode) {
  const text = String(address || "");
  const postcodeText = String(postcode || "").trim();
  const postcodePattern = postcodeText ? new RegExp(`\\b${postcodeText}\\b`) : null;
  const saPattern = /\bSA\s+\d{4}\b/i;
  if (saPattern.test(text) || (postcodePattern && postcodePattern.test(text))) {
    return qldSuburbFromAddress(text, postcodeText);
  }
  return qldSuburbFromAddress(text, postcodeText);
}

function qldSuburbFromAddress(address, postcode) {
  const text = String(address || "");
  const postcodeText = String(postcode || "").trim();
  const pattern = postcodeText ? new RegExp(`,\\s*([^,]+?)\\s+(?:QLD|Queensland|SA|South Australia)?\\s*${postcodeText}\\b`, "i") : /,\s*([^,]+?)\s+(?:QLD|Queensland|SA|South Australia)\s+\d{4}\b/i;
  const match = pattern.exec(text);
  return cleanQldSuburb(match?.[1] || "");
}

function qldSuburbFromName(name) {
  const text = String(name || "").trim();
  const cleaned = text
    .replace(/\b(?:Caltex|Ampol|Shell|BP|United|Puma|Mobil|Liberty|Metro|EG|Coles Express|7-Eleven|Reddy Express)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned === text || cleaned.length > 40 || /\b(?:Cnr|Corner|Highway|Road|Street|Drive)\b/i.test(cleaned)) return "";
  return cleanQldSuburb(cleaned);
}

function cleanQldSuburb(value) {
  return String(value || "")
    .replace(/\b(?:QLD|Queensland)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function qldPriceCpl(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price >= QLD_UNAVAILABLE_PRICE) return undefined;
  return price / 10;
}

function saPriceCpl(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price === SA_UNAVAILABLE_PRICE) return undefined;
  return Math.round(price) / 10;
}

function normaliseQldTimestamp(value) {
  if (!value) return undefined;
  const text = String(value).trim().replace(/\s+/g, "");
  const parsed = new Date(text.endsWith("Z") || /[+-]\d\d:\d\d$/.test(text) ? text : `${text}Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function qldOpenNow(row) {
  const prefixByDay = ["SU", "M", "T", "W", "TH", "F", "S"];
  const prefix = prefixByDay[new Date().getDay()];
  const openMinutes = qldTimeMinutes(row?.[`${prefix}O`]);
  const closeMinutes = qldTimeMinutes(row?.[`${prefix}C`]);
  if (openMinutes === undefined || closeMinutes === undefined) return undefined;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (closeMinutes <= openMinutes) return nowMinutes >= openMinutes || nowMinutes <= closeMinutes;
  return openMinutes <= nowMinutes && nowMinutes <= closeMinutes;
}

function qldTimeMinutes(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 3) return undefined;
  const padded = digits.padStart(4, "0").slice(-4);
  let hour = Number(padded.slice(0, 2));
  const minute = Number(padded.slice(2));
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 24 || minute > 59) return undefined;
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
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

function emptyCache() {
  return {
    stations: null,
    loadedAtMs: 0,
    lastError: "",
  };
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
  createFppDirectProvider,
};
