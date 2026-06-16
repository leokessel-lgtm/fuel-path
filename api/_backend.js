const sample = require("./_sample");

const DEFAULT_CACHE_SECONDS = 300;
const DEFAULT_TOKEN_URL = "https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken";
const DEFAULT_PRICES_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v1/fuel/prices";
const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";
const SAMPLE_NOW = new Date("2026-06-13T08:00:00+10:00");
const RECOMMENDATION_MAX_PRICE_AGE_HOURS = 48;
const RECOMMENDED_GEOCODE_PROVIDER = "google_places_autocomplete_new";
const DEFAULT_QLD_FUEL_API_BASE_URL = "https://fppdirectapi-prod.fuelpricesqld.com.au";
const DEFAULT_WA_FUELWATCH_RSS_URL = "https://www.fuelwatch.wa.gov.au/fuelwatch/fuelWatchRSS";
const QLD_REGION_PARAMS = {
  countryId: 21,
  geoRegionLevel: 3,
  geoRegionId: 1,
};
const QLD_BOUNDS = {
  minLat: -29.1,
  maxLat: -9,
  minLon: 138,
  maxLon: 154.2,
};
const QLD_FUEL_ID_TO_CODE = new Map([
  [2, "U91"],
  [3, "DL"],
  [5, "P95"],
  [8, "P98"],
  [12, "E10"],
  [14, "PDL"],
]);
const QLD_UNAVAILABLE_PRICE = 9999;
const WA_BOUNDS = {
  minLat: -36,
  maxLat: -13,
  minLon: 112,
  maxLon: 129.05,
};
const NSW_BOUNDS = {
  minLat: -37.7,
  maxLat: -28,
  minLon: 140.9,
  maxLon: 154.2,
};
const VIC_BOUNDS = {
  minLat: -39.3,
  maxLat: -33.9,
  minLon: 140.9,
  maxLon: 150.2,
};
const ACT_BOUNDS = {
  minLat: -35.95,
  maxLat: -35.1,
  minLon: 148.7,
  maxLon: 149.45,
};
const NSW_VIC_BORDER_POINTS = [
  { lon: 141.0, lat: -34.0 },
  { lon: 142.2, lat: -34.18 },
  { lon: 143.6, lat: -35.35 },
  { lon: 144.75, lat: -36.12 },
  { lon: 146.0, lat: -35.998 },
  { lon: 146.45, lat: -36.03 },
  { lon: 146.9, lat: -36.08 },
  { lon: 148.25, lat: -36.65 },
  { lon: 149.98, lat: -37.5 },
];
const WA_FUELWATCH_PRODUCTS = [
  ["U91", 1],
  ["P95", 2],
  ["DL", 4],
  ["LPG", 5],
  ["P98", 6],
  ["E85", 10],
  ["PDL", 11],
];
const WA_DEFAULT_METRO_REGION_IDS = [25, 26, 27];
const WA_FUELWATCH_REGIONS = [
  { id: 1, name: "Boulder", lat: -30.782, lon: 121.491 },
  { id: 2, name: "Broome", lat: -17.961, lon: 122.236 },
  { id: 3, name: "Busselton Townsite", lat: -33.652, lon: 115.345 },
  { id: 4, name: "Carnarvon", lat: -24.884, lon: 113.657 },
  { id: 5, name: "Collie", lat: -33.36, lon: 116.156 },
  { id: 6, name: "Dampier", lat: -20.662, lon: 116.711 },
  { id: 7, name: "Esperance", lat: -33.86, lon: 121.889 },
  { id: 8, name: "Kalgoorlie", lat: -30.749, lon: 121.466 },
  { id: 9, name: "Karratha", lat: -20.736, lon: 116.846 },
  { id: 10, name: "Kununurra", lat: -15.779, lon: 128.741 },
  { id: 11, name: "Narrogin", lat: -32.933, lon: 117.178 },
  { id: 12, name: "Northam", lat: -31.653, lon: 116.671 },
  { id: 13, name: "Port Hedland", lat: -20.312, lon: 118.61 },
  { id: 14, name: "South Hedland", lat: -20.407, lon: 118.6 },
  { id: 15, name: "Albany", lat: -35.027, lon: 117.884 },
  { id: 16, name: "Bunbury", lat: -33.327, lon: 115.641 },
  { id: 17, name: "Geraldton", lat: -28.777, lon: 114.614 },
  { id: 18, name: "Mandurah", lat: -32.536, lon: 115.743 },
  { id: 19, name: "Capel", lat: -33.558, lon: 115.562 },
  { id: 20, name: "Dardanup", lat: -33.397, lon: 115.755 },
  { id: 21, name: "Greenough", lat: -28.956, lon: 114.735 },
  { id: 22, name: "Harvey", lat: -33.08, lon: 115.893 },
  { id: 23, name: "Murray", lat: -32.629, lon: 115.874 },
  { id: 24, name: "Waroona", lat: -32.844, lon: 115.923 },
  { id: 25, name: "Metro North of River", lat: -31.89, lon: 115.84, metro: true },
  { id: 26, name: "Metro South of River", lat: -32.08, lon: 115.86, metro: true },
  { id: 27, name: "Metro East/Hills", lat: -31.98, lon: 116.03, metro: true },
  { id: 28, name: "Augusta Margaret River", lat: -33.953, lon: 115.073 },
  { id: 29, name: "Busselton Shire", lat: -33.652, lon: 115.345 },
  { id: 30, name: "Bridgetown Greenbushes", lat: -33.959, lon: 116.137 },
  { id: 31, name: "Donnybrook Balingup", lat: -33.572, lon: 115.824 },
  { id: 32, name: "Manjimup", lat: -34.241, lon: 116.146 },
  { id: 33, name: "Cataby", lat: -30.744, lon: 115.551 },
  { id: 34, name: "Coolgardie", lat: -30.954, lon: 121.163 },
  { id: 35, name: "Cunderdin", lat: -31.652, lon: 117.242 },
  { id: 36, name: "Dalwallinu", lat: -30.278, lon: 116.66 },
  { id: 37, name: "Denmark", lat: -34.961, lon: 117.353 },
  { id: 38, name: "Derby", lat: -17.303, lon: 123.629 },
  { id: 39, name: "Dongara", lat: -29.252, lon: 114.932 },
  { id: 40, name: "Exmouth", lat: -21.93, lon: 114.126 },
  { id: 41, name: "Fitzroy Crossing", lat: -18.197, lon: 125.567 },
  { id: 42, name: "Jurien", lat: -30.305, lon: 115.039 },
  { id: 43, name: "Kambalda", lat: -31.206, lon: 121.66 },
  { id: 44, name: "Kellerberrin", lat: -31.634, lon: 117.72 },
  { id: 45, name: "Kojonup", lat: -33.833, lon: 117.159 },
  { id: 46, name: "Meekatharra", lat: -26.593, lon: 118.495 },
  { id: 47, name: "Moora", lat: -30.64, lon: 116.008 },
  { id: 48, name: "Mount Barker", lat: -34.63, lon: 117.666 },
  { id: 49, name: "Newman", lat: -23.357, lon: 119.735 },
  { id: 50, name: "Norseman", lat: -32.197, lon: 121.779 },
  { id: 51, name: "Ravensthorpe", lat: -33.582, lon: 120.046 },
  { id: 53, name: "Tammin", lat: -31.641, lon: 117.484 },
  { id: 54, name: "Williams", lat: -33.027, lon: 116.88 },
  { id: 55, name: "Wubin", lat: -30.106, lon: 116.629 },
  { id: 56, name: "York", lat: -31.888, lon: 116.769 },
  { id: 57, name: "Regans Ford", lat: -30.98, lon: 115.695 },
  { id: 58, name: "Meckering", lat: -31.632, lon: 117.008 },
  { id: 59, name: "Wundowie", lat: -31.76, lon: 116.379 },
  { id: 60, name: "North Bannister", lat: -32.582, lon: 116.451 },
  { id: 61, name: "Munglinup", lat: -33.714, lon: 120.865 },
  { id: 62, name: "Northam Shire", lat: -31.653, lon: 116.671 },
  { id: 63, name: "Bodallin", lat: -31.37, lon: 118.861 },
];

const liveCache = {
  stations: null,
  loadedAtMs: 0,
  lastError: "",
};

const qldLiveCache = {
  stations: null,
  loadedAtMs: 0,
  lastError: "",
};

const waLiveCache = {
  entries: new Map(),
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

function hasQldCredentials() {
  return Boolean(process.env.QLD_FUEL_API_TOKEN);
}

function hasWaProvider() {
  return process.env.FUEL_PATH_WA_FUELWATCH_ENABLED !== "0";
}

function hasVicCredentials() {
  return Boolean(process.env.VIC_SERVO_SAVER_API_BASE_URL && process.env.VIC_SERVO_SAVER_API_KEY);
}

function hasAnyLiveCredentials() {
  return hasLiveCredentials() || hasQldCredentials() || hasWaProvider() || hasVicCredentials();
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
      phone: stationPhone(row),
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
        phone: stationPhone(row),
        lat: Number(row.latitude || row.Latitude || 0),
        lon: Number(row.longitude || row.Longitude || 0),
        openNow: true,
        membershipRequired: false,
        updatedAt: normaliseNswTimestamp(row.lastupdated || row.lastUpdated || row.LastUpdated),
        source: "api_nsw_fuelcheck",
        prices: {},
        discounts: [],
      };
    station.phone = station.phone || stationPhone(row);
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

async function qldApiGet(path, params) {
  const token = process.env.QLD_FUEL_API_TOKEN;
  if (!token) throw new Error("QLD fuel API token is not configured");
  const baseUrl = process.env.QLD_FUEL_API_BASE_URL || DEFAULT_QLD_FUEL_API_BASE_URL;
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return fetchJson(url.toString(), {
    headers: {
      Authorization: `FPDAPI SubscriberToken=${token}`,
      "Content-Type": "application/json",
    },
    timeoutMs: 60000,
  });
}

async function loadLiveQldStations({ forceRefresh = false } = {}) {
  const ageMs = Date.now() - qldLiveCache.loadedAtMs;
  const ttlMs = cacheSeconds() * 1000;
  if (!forceRefresh && qldLiveCache.stations && ageMs < ttlMs) {
    return {
      stations: qldLiveCache.stations,
      cacheHit: true,
      cacheAgeSeconds: Math.round(ageMs / 1000),
      error: "",
    };
  }

  const [brands, regions, sites, prices] = await Promise.all([
    qldApiGet("/Subscriber/GetCountryBrands", { countryId: 21 }),
    qldApiGet("/Subscriber/GetCountryGeographicRegions", { countryId: 21 }),
    qldApiGet("/Subscriber/GetFullSiteDetails", QLD_REGION_PARAMS),
    qldApiGet("/Price/GetSitesPrices", QLD_REGION_PARAMS),
  ]);
  const stations = normaliseQldPayload(sites, prices, brands, regions).map(stationWithDiscountRules);
  qldLiveCache.stations = stations;
  qldLiveCache.loadedAtMs = Date.now();
  qldLiveCache.lastError = "";
  return {
    stations,
    cacheHit: false,
    cacheAgeSeconds: 0,
    error: "",
  };
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

function qldSuburbFromAddress(address, postcode) {
  const text = String(address || "").replace(/\s+/g, " ").trim();
  const postcodeText = String(postcode || "").trim();
  const postcodePattern = postcodeText || "\\d{4}";
  const match = text.match(new RegExp(`,\\s*([^,]+?)\\s+(?:QLD|Queensland)\\s+${postcodePattern}\\b`, "i"));
  return match ? cleanQldSuburb(match[1]) : "";
}

function qldSuburbFromName(name) {
  const text = String(name || "").replace(/\s+/g, " ").trim();
  const cleaned = text
    .replace(/^(?:7-Eleven|Ampol(?: Foodary)?|BP|Caltex|Freedom Fuels|Liberty|Metro|Quill Petroleum|Shell Reddy Express|Shell|United|U-Go)\s+/i, "")
    .replace(/\s+(?:Truckstop|Truck Stop|Service Centre|Service Station)$/i, "")
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

async function loadLiveWaStations({ forceRefresh = false, points = [], radiusKm = 0 } = {}) {
  if (!hasWaProvider()) throw new Error("WA FuelWatch provider is disabled");
  const regionIds = waRegionIdsForArea(points, radiusKm);
  const cacheKey = regionIds.join(",");
  const cached = waLiveCache.entries.get(cacheKey);
  const ageMs = Date.now() - Number(cached?.loadedAtMs || 0);
  const ttlMs = cacheSeconds() * 1000;
  if (!forceRefresh && cached?.stations && ageMs < ttlMs) {
    return {
      stations: cached.stations,
      cacheHit: true,
      cacheAgeSeconds: Math.round(ageMs / 1000),
      error: "",
    };
  }

  const productPayloads = (
    await Promise.all(
      regionIds.flatMap((regionId) =>
        WA_FUELWATCH_PRODUCTS.map(async ([fuelCode, product]) => ({
          fuelCode,
          regionId,
          xml: await fetchWaFuelWatchRss(product, regionId),
        })),
      ),
    )
  ).filter((payload) => payload.xml);
  const stations = normaliseWaFuelWatchPayloads(productPayloads).map(stationWithDiscountRules);
  waLiveCache.entries.set(cacheKey, {
    stations,
    loadedAtMs: Date.now(),
  });
  waLiveCache.lastError = "";
  return {
    stations,
    cacheHit: false,
    cacheAgeSeconds: 0,
    error: "",
  };
}

function waRegionIdsForArea(points = [], radiusKm = 0) {
  const waPoints = samplePointsForProvider(points.filter(pointInWa), 28);
  if (!waPoints.length) return WA_DEFAULT_METRO_REGION_IDS;

  const ids = new Set();
  const perth = { lat: -31.9523, lon: 115.8613 };
  const searchKm = Math.max(35, Math.min(120, Number(radiusKm || 0) * 2));
  for (const point of waPoints) {
    if (distanceKm(point, perth) <= 85) {
      for (const id of WA_DEFAULT_METRO_REGION_IDS) ids.add(id);
    }
    const ranked = WA_FUELWATCH_REGIONS.map((region) => ({
      region,
      distance: distanceKm(point, region),
    })).sort((left, right) => left.distance - right.distance);

    if (ranked[0]) ids.add(ranked[0].region.id);
    for (const item of ranked) {
      if (item.distance <= searchKm) ids.add(item.region.id);
    }
  }

  return [...ids].sort((left, right) => left - right);
}

function samplePointsForProvider(points, limit) {
  if (points.length <= limit) return points;
  const sampled = [];
  let previousIndex = -1;
  for (let index = 0; index < limit; index += 1) {
    const sourceIndex = Math.round((index / (limit - 1)) * (points.length - 1));
    if (sourceIndex !== previousIndex) {
      sampled.push(points[sourceIndex]);
      previousIndex = sourceIndex;
    }
  }
  return sampled;
}

async function fetchWaFuelWatchRss(product, regionId) {
  const baseUrl = process.env.WA_FUELWATCH_RSS_URL || DEFAULT_WA_FUELWATCH_RSS_URL;
  const url = new URL(baseUrl);
  url.searchParams.set("Product", String(product));
  if (regionId) url.searchParams.set("Region", String(regionId));
  try {
    return await fetchText(url.toString(), { timeoutMs: 30000 });
  } catch (error) {
    if (!regionId) throw error;
    console.warn?.(
      `WA FuelWatch region ${regionId} product ${product} unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return "";
  }
}

async function fetchText(url, { headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": DEFAULT_USER_AGENT,
        ...headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Provider returned ${response.status}: ${text.slice(0, 120)}`);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function normaliseWaFuelWatchPayloads(productPayloads) {
  const stations = new Map();
  for (const { fuelCode, xml } of productPayloads) {
    for (const item of waFuelWatchItems(xml)) {
      const lat = Number(item.latitude);
      const lon = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || (!lat && !lon)) continue;
      const stationCode = waStationCode(item);
      const existing =
        stations.get(stationCode) ||
        {
          stationCode,
          name: item["trading-name"] || item.title?.replace(/^[0-9.]+:\s*/, "") || stationCode,
          brand: item.brand || "Unknown",
          suburb: titleCase(item.location || ""),
          address: [item.address, item.location, "WA"].filter(Boolean).join(", "),
          phone: stationPhone(item),
          lat,
          lon,
          openNow: waOpenNow(item["site-features"]),
          membershipRequired: waMembershipRequired(item.restrictions),
          updatedAt: normaliseWaDate(item.date),
          source: "api_wa_fuelwatch",
          prices: {},
          discounts: [],
        };
      const price = Number(item.price);
      if (fuelCode && Number.isFinite(price)) existing.prices[fuelCode] = price;
      const updatedAt = normaliseWaDate(item.date);
      if (updatedAt && (!existing.updatedAt || updatedAt > String(existing.updatedAt))) {
        existing.updatedAt = updatedAt;
      }
      stations.set(stationCode, existing);
    }
  }
  return [...stations.values()].filter((station) => Object.keys(station.prices || {}).length);
}

function waFuelWatchItems(xml) {
  const cleaned = String(xml || "").replace(/^\uFEFF/, "");
  const matches = cleaned.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  return [...matches].map((match) => {
    const body = match[1];
    const item = {};
    for (const tag of [
      "title",
      "description",
      "brand",
      "date",
      "price",
      "trading-name",
      "location",
      "address",
      "phone",
      "latitude",
      "longitude",
      "site-features",
      "restrictions",
    ]) {
      item[tag] = xmlDecode(firstXmlTagValue(body, tag));
    }
    return item;
  });
}

function firstXmlTagValue(xml, tag) {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = pattern.exec(xml);
  return match ? match[1] : "";
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function waStationCode(item) {
  const raw = `${item.brand || ""}|${item["trading-name"] || ""}|${item.address || ""}|${item.location || ""}`;
  const slug = raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `WA-${slug || `${item.latitude}-${item.longitude}`}`;
}

function normaliseWaDate(value) {
  if (!value) return undefined;
  const text = String(value).trim();
  const parsed = new Date(`${text}T06:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function waOpenNow(siteFeatures) {
  const text = String(siteFeatures || "");
  if (/open\s+24\s+hours/i.test(text)) return true;
  return undefined;
}

function waMembershipRequired(restrictions) {
  return /member|membership|card\s+only/i.test(String(restrictions || ""));
}

async function loadLiveVicStations() {
  if (!hasVicCredentials()) {
    throw new Error("VIC Servo Saver API access is not configured. Apply for API access before enabling live VIC prices.");
  }
  throw new Error("VIC Servo Saver API adapter needs the approved API schema before it can be enabled.");
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

function pointInQld(point) {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  if (lon < 141 && lat < -26) return false;
  return (
    lat >= QLD_BOUNDS.minLat &&
    lat <= QLD_BOUNDS.maxLat &&
    lon >= QLD_BOUNDS.minLon &&
    lon <= QLD_BOUNDS.maxLon
  );
}

function pointInWa(point) {
  return (
    Number(point?.lat) >= WA_BOUNDS.minLat &&
    Number(point?.lat) <= WA_BOUNDS.maxLat &&
    Number(point?.lon) >= WA_BOUNDS.minLon &&
    Number(point?.lon) <= WA_BOUNDS.maxLon
  );
}

function pointInAct(point) {
  return (
    Number(point?.lat) >= ACT_BOUNDS.minLat &&
    Number(point?.lat) <= ACT_BOUNDS.maxLat &&
    Number(point?.lon) >= ACT_BOUNDS.minLon &&
    Number(point?.lon) <= ACT_BOUNDS.maxLon
  );
}

function pointInVic(point) {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  if (pointInAct(point)) return false;
  if (
    !(
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= VIC_BOUNDS.minLat &&
      lat <= VIC_BOUNDS.maxLat &&
      lon >= VIC_BOUNDS.minLon &&
      lon <= VIC_BOUNDS.maxLon
    )
  ) {
    return false;
  }

  const borderLat = nswVicBorderLatAtLon(lon);
  if (borderLat !== undefined) return lat < borderLat;

  return (
    lat >= VIC_BOUNDS.minLat &&
    lat <= VIC_BOUNDS.maxLat &&
    lon >= VIC_BOUNDS.minLon &&
    lon <= VIC_BOUNDS.maxLon
  );
}

function pointInNswOrAct(point) {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  if (pointInAct(point)) return true;
  if (
    !(
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= NSW_BOUNDS.minLat &&
      lat <= NSW_BOUNDS.maxLat &&
      lon >= NSW_BOUNDS.minLon &&
      lon <= NSW_BOUNDS.maxLon
    )
  ) {
    return false;
  }
  return !pointInQld(point) && !pointInWa(point) && !pointInVic(point);
}

function nswVicBorderLatAtLon(lon) {
  const first = NSW_VIC_BORDER_POINTS[0];
  const last = NSW_VIC_BORDER_POINTS[NSW_VIC_BORDER_POINTS.length - 1];
  if (lon < first.lon || lon > last.lon) return undefined;

  for (let index = 1; index < NSW_VIC_BORDER_POINTS.length; index += 1) {
    const left = NSW_VIC_BORDER_POINTS[index - 1];
    const right = NSW_VIC_BORDER_POINTS[index];
    if (lon < left.lon || lon > right.lon) continue;
    const span = right.lon - left.lon;
    const ratio = span ? (lon - left.lon) / span : 0;
    return left.lat + (right.lat - left.lat) * ratio;
  }

  return undefined;
}

function qldNswBorderArea(point, radiusKm = 0) {
  return pointInQld(point) && Number(point.lat) <= -27.75 && Number(point.lon) >= 151 && Number(radiusKm) >= 20;
}

function liveProviderKeysForArea(points = [], radiusKm = 0) {
  if (!points.length) {
    if (hasLiveCredentials()) return ["nsw"];
    if (hasQldCredentials()) return ["qld"];
    if (hasWaProvider()) return ["wa"];
    if (hasVicCredentials()) return ["vic"];
    return ["nsw"];
  }
  const hasQldPoint = points.some(pointInQld);
  const hasWaPoint = points.some(pointInWa);
  const hasVicPoint = points.some(pointInVic);
  const hasNswPoint = points.some(pointInNswOrAct);
  if (hasWaPoint) return ["wa"];
  if (hasVicPoint) {
    const providers = ["vic"];
    if (hasNswPoint) providers.push("nsw");
    return providers;
  }
  if (hasQldPoint) {
    const providers = ["qld"];
    if (hasNswPoint || points.some((point) => qldNswBorderArea(point, radiusKm))) providers.push("nsw");
    return providers;
  }
  if (hasNswPoint) return ["nsw"];
  return [];
}

async function loadLiveStationsForArea({ forceRefresh = false, points = [], radiusKm = 0, providers: requestedProviders } = {}) {
  const providers = requestedProviders || liveProviderKeysForArea(points, radiusKm);
  if (!providers.length) {
    return {
      stations: [],
      source: "unsupported_region",
      provider: "unsupported_region",
      cacheHit: false,
      cacheAgeSeconds: 0,
      warning: "No live fuel provider covers this area yet.",
    };
  }
  const stations = [];
  const loadedProviders = [];
  const errors = [];
  for (const provider of providers) {
    try {
      if (provider === "qld") {
        const live = await loadLiveQldStations({ forceRefresh });
        stations.push(...live.stations);
        loadedProviders.push("api_qld");
      } else if (provider === "wa") {
        const live = await loadLiveWaStations({ forceRefresh, points, radiusKm });
        stations.push(...live.stations);
        loadedProviders.push("api_wa");
      } else if (provider === "vic") {
        const live = await loadLiveVicStations({ forceRefresh });
        stations.push(...live.stations);
        loadedProviders.push("api_vic");
      } else if (provider === "nsw") {
        const live = await loadLiveStations({ forceRefresh });
        stations.push(...live.stations);
        loadedProviders.push("api_nsw");
      }
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!stations.length) throw new Error(errors.join("; ") || "No live fuel providers are configured");
  const byCode = new Map();
  for (const station of stations) byCode.set(String(station.stationCode), station);
  return {
    stations: [...byCode.values()],
    source: loadedProviders.join("+") || "live",
    provider: loadedProviders.join("+") || "live",
    cacheHit: false,
    cacheAgeSeconds: 0,
    warning: errors.length ? `Some live fuel providers unavailable: ${errors.join("; ")}` : "",
  };
}

async function loadStationData({ requestedSource = "auto", forceRefresh = false, points = [], radiusKm = 0 } = {}) {
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

  const requestedProvider = providerFromSource(source);
  if (requestedProvider && points.length && !points.some((point) => pointInProviderCoverage(requestedProvider, point))) {
    return {
      stations: [],
      source: "unsupported_region",
      provider: requestedProvider,
      cacheHit: false,
      cacheAgeSeconds: 0,
      warning: `Requested ${requestedProvider.toUpperCase()} fuel provider does not cover this area.`,
    };
  }

  try {
    return await loadLiveStationsForArea({
      forceRefresh,
      points,
      radiusKm,
      providers: requestedProvider ? [requestedProvider] : undefined,
    });
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
  const value = source === "auto" || !source ? (hasAnyLiveCredentials() ? "live" : "sample") : source;
  if (!["live", "sample", "nsw", "qld", "wa", "vic"].includes(value)) {
    throw new Error("source must be live, sample, nsw, qld, wa, vic or auto");
  }
  return value;
}

function providerFromSource(source) {
  return ["nsw", "qld", "wa", "vic"].includes(source) ? source : "";
}

function pointInProviderCoverage(provider, point) {
  if (provider === "nsw") return pointInNswOrAct(point);
  if (provider === "qld") return pointInQld(point);
  if (provider === "wa") return pointInWa(point);
  if (provider === "vic") return pointInVic(point);
  return false;
}

function stationPayload(station, { fuel, distanceKm, routeDistance } = {}) {
  const prices = station.prices || {};
  const payload = {
    stationCode: station.stationCode,
    name: station.name,
    brand: station.brand || "Unknown",
    suburb: station.suburb,
    address: station.address,
    phone: station.phone,
    lat: Number(station.lat),
    lon: Number(station.lon),
    openNow: typeof station.openNow === "boolean" ? station.openNow : undefined,
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
  const now = source === "sample" || source === "public_demo_snapshot" ? SAMPLE_NOW : new Date();
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
    if (
      ["api_nsw_fuelcheck", "api_qld_fuelprices", "api_wa_fuelwatch"].includes(station.source) &&
      priceAgeHours(station.updatedAt, now) > RECOMMENDATION_MAX_PRICE_AGE_HOURS
    ) {
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
  const googlePlacesConfigured = Boolean(googlePlacesApiKey());
  const billableRequestsEnabled = activeProvider === "google" && googlePlacesConfigured;
  return {
    activeProvider,
    activeMode: activeProvider === "nominatim" ? "validation" : "production_candidate",
    costMode: billableRequestsEnabled ? "billable_provider_enabled" : "no_cost_validation",
    billableRequestsEnabled,
    recommendedProductionProvider: RECOMMENDED_GEOCODE_PROVIDER,
    requestedProvider,
    supportedProviders: ["google", "mapbox", "here", "geoapify", "nominatim"],
    fallbackProvider: "nominatim",
    backendProxyRequired: true,
    sessionTokenRequired: activeProvider === "google",
    googlePlacesConfigured,
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
  const googleRoutesConfigured = Boolean(googleRoutesApiKey());
  const billableRequestsEnabled = activeProvider === "google" && googleRoutesConfigured;
  return {
    activeProvider,
    activeMode: activeProvider === "google" ? "production_candidate" : "validation",
    costMode: billableRequestsEnabled ? "billable_provider_enabled" : "no_cost_validation",
    billableRequestsEnabled,
    requestedProvider: process.env.FUEL_PATH_ROUTE_PROVIDER || "auto",
    supportedProviders: ["google", "osrm"],
    fallbackProvider: "osrm",
    googleRoutesConfigured,
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
  hasAnyLiveCredentials,
  hasLiveCredentials,
  hasQldCredentials,
  hasVicCredentials,
  hasWaProvider,
  loadStationData,
  liveProviderKeysForArea,
  methodAllowed,
  normaliseQldPayload,
  numberParam,
  pointInAct,
  pointFromQuery,
  pointInVic,
  routeContextStations,
  routeFromPayload,
  routeProviderStatus,
  scoreRoute,
  sendJson,
  setParam,
  stationPayload,
  stringParam,
};
