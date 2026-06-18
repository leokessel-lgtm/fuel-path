const sample = require("./_sample");
const {
  alertStorageStatus,
  appendRouteAlertEvaluation,
  counts: alertStorageCounts,
  listPendingPushTicketEvaluations,
  listPushDevices,
  listRouteAlertEvaluations,
  listSavedRoutes,
  setAlertStorageForTests,
  updatePushDeviceStatus,
  updateRouteAlertDelivery,
  updateSavedRouteLastAlert,
  upsertPushDevice,
  upsertSavedRoute,
} = require("./_alertStorage");
const { fetchExpoPushReceipts, sendExpoPushMessages } = require("./_expoPush");
const {
  appendPredictionBacktestRecord,
  listPredictionBacktestRecords,
  predictionStorageStatus,
  setPredictionStorageForTests,
} = require("./_predictionStorage");
const { addressIndexStatus, searchAddressIndex } = require("./_addressIndex");
const { additionalLocalGeocodeHints, additionalLocalGeocodeHintStatus } = require("./_geocodeHints");
const { regionalGeocodeHintStatus, regionalLocalGeocode } = require("./_regionalGeocodeHints");

const DEFAULT_CACHE_SECONDS = 300;
const GEOCODE_CACHE_SECONDS = 60 * 60 * 6;
const GEOCODE_DEGRADED_CACHE_SECONDS = 60;
const NOMINATIM_RATE_LIMIT_BACKOFF_MS = 60 * 1000;
const DEFAULT_TOKEN_URL = "https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken";
const DEFAULT_PRICES_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v1/fuel/prices";
const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";
const SAMPLE_NOW = new Date("2026-06-13T08:00:00+10:00");
const RECOMMENDATION_MAX_PRICE_AGE_HOURS = 48;
const RECOMMENDED_GEOCODE_PROVIDER = "google_places_autocomplete_new";
const DEFAULT_QLD_FUEL_API_BASE_URL = "https://fppdirectapi-prod.fuelpricesqld.com.au";
const DEFAULT_SA_FUEL_API_BASE_URL = "https://fppdirectapi-prod.safuelpricinginformation.com.au";
const DEFAULT_WA_FUELWATCH_RSS_URL = "https://www.fuelwatch.wa.gov.au/fuelwatch/fuelWatchRSS";
const WA_DEFAULT_MAX_REGION_IDS = 18;
const WA_DEFAULT_FETCH_CONCURRENCY = 6;
const PREDICTION_BACKTEST_MAX_RECORDS = 500;
const ALERT_MAX_RECORDS = 500;
const ALERT_FRESHNESS_MAX_MINUTES = 120;
const ALERT_DUPLICATE_COOLDOWN_HOURS = 12;
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
const SA_FUEL_ID_TO_CODE = QLD_FUEL_ID_TO_CODE;
const QLD_UNAVAILABLE_PRICE = 9999;
const SA_UNAVAILABLE_PRICE = 9999;
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
const SA_BOUNDS = {
  minLat: -38.2,
  maxLat: -25.9,
  minLon: 129,
  maxLon: 141.1,
};
const TAS_BOUNDS = {
  minLat: -43.8,
  maxLat: -39,
  minLon: 143.5,
  maxLon: 148.6,
};
const NT_BOUNDS = {
  minLat: -26.1,
  maxLat: -10.8,
  minLon: 129,
  maxLon: 138.1,
};
const ACT_BOUNDS = {
  minLat: -35.95,
  maxLat: -35.1,
  minLon: 148.7,
  maxLon: 149.45,
};
const CAPABILITY_LABELS = ["live", "limited", "pending_access", "fallback", "unsupported"];
const REGION_ORDER = ["NSW", "ACT", "QLD", "WA", "VIC", "SA", "TAS", "NT"];
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
const WA_FUELWATCH_PRODUCT_BY_CODE = new Map(WA_FUELWATCH_PRODUCTS);
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

let alertRouteScorerForTests;

const qldLiveCache = {
  stations: null,
  loadedAtMs: 0,
  lastError: "",
};

const saLiveCache = {
  stations: null,
  loadedAtMs: 0,
  lastError: "",
};

const waLiveCache = {
  entries: new Map(),
  payloads: new Map(),
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

function boundedIntegerEnv(name, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function waMaxRegionIds() {
  return boundedIntegerEnv("FUEL_PATH_WA_MAX_REGION_IDS", WA_DEFAULT_MAX_REGION_IDS, { min: 3, max: 40 });
}

function waFetchConcurrency() {
  return boundedIntegerEnv("FUEL_PATH_WA_FETCH_CONCURRENCY", WA_DEFAULT_FETCH_CONCURRENCY, { min: 1, max: 12 });
}

function hasLiveCredentials() {
  return Boolean(process.env.NSW_FUEL_API_KEY && process.env.NSW_FUEL_API_SECRET);
}

function hasQldCredentials() {
  return Boolean(process.env.QLD_FUEL_API_TOKEN);
}

function hasSaCredentials() {
  return Boolean(process.env.SA_FUEL_API_TOKEN);
}

function hasWaProvider() {
  return process.env.FUEL_PATH_WA_FUELWATCH_ENABLED !== "0";
}

function hasVicCredentials() {
  return Boolean(process.env.VIC_SERVO_SAVER_API_BASE_URL && process.env.VIC_SERVO_SAVER_API_KEY);
}

function hasAnyLiveCredentials() {
  return hasLiveCredentials() || hasQldCredentials() || hasSaCredentials() || hasWaProvider() || hasVicCredentials();
}

function fuelProviderCapabilityMatrix() {
  return [
    capabilityEntry({
      region: "NSW",
      name: "New South Wales",
      provider: "api_nsw_fuelcheck",
      capability: hasLiveCredentials() ? "live" : "pending_access",
      configured: hasLiveCredentials(),
      coverage: "NSW FuelCheck live prices.",
      blocker: hasLiveCredentials() ? "" : "API.NSW FuelCheck credentials are not configured.",
    }),
    capabilityEntry({
      region: "ACT",
      name: "Australian Capital Territory",
      provider: "api_nsw_fuelcheck",
      capability: hasLiveCredentials() ? "live" : "pending_access",
      configured: hasLiveCredentials(),
      coverage: "ACT prices exposed through the API.NSW FuelCheck feed.",
      blocker: hasLiveCredentials() ? "" : "API.NSW FuelCheck credentials are not configured.",
    }),
    capabilityEntry({
      region: "QLD",
      name: "Queensland",
      provider: "api_qld_fuelprices",
      capability: hasQldCredentials() ? "live" : "pending_access",
      configured: hasQldCredentials(),
      coverage: "QLD Fuel Prices Direct Outbound API.",
      blocker: hasQldCredentials() ? "" : "QLD Fuel Prices API token is not configured.",
    }),
    capabilityEntry({
      region: "WA",
      name: "Western Australia",
      provider: "api_wa_fuelwatch",
      capability: hasWaProvider() ? "live" : "unsupported",
      configured: hasWaProvider(),
      coverage: "WA FuelWatch live prices statewide using request-budgeted RSS. Tomorrow locked prices are checked after 2:30pm AWST.",
      blocker: hasWaProvider() ? "" : "WA FuelWatch provider is disabled.",
    }),
    capabilityEntry({
      region: "VIC",
      name: "Victoria",
      provider: "api_vic_servo_saver",
      capability: "pending_access",
      configured: hasVicCredentials(),
      coverage: "VIC Servo Saver Public API planned.",
      blocker: hasVicCredentials()
        ? "VIC Servo Saver adapter needs the approved API schema before live prices can be enabled."
        : "VIC Servo Saver API access is not configured.",
    }),
    capabilityEntry({
      region: "SA",
      name: "South Australia",
      provider: "api_sa_fuel_price_reporting",
      capability: hasSaCredentials() ? "live" : "pending_access",
      configured: hasSaCredentials(),
      coverage: "SA Fuel Pricing Information Scheme Direct API live prices.",
      blocker: hasSaCredentials() ? "" : "SA Fuel Pricing Information Scheme API token is not configured.",
    }),
    capabilityEntry({
      region: "TAS",
      name: "Tasmania",
      provider: "api_tas_fuelcheck",
      capability: "pending_access",
      configured: false,
      coverage: "TAS live fuel provider access planned.",
      blocker: "TAS fuel data/API access path needs confirmation.",
    }),
    capabilityEntry({
      region: "NT",
      name: "Northern Territory",
      provider: "api_nt_myfuel",
      capability: "pending_access",
      configured: false,
      coverage: "MyFuel NT access planned.",
      blocker: "NT MyFuel data/API access path needs confirmation.",
    }),
  ];
}

function capabilityEntry({ region, name, provider, capability, configured, coverage, blocker }) {
  const safeCapability = CAPABILITY_LABELS.includes(capability) ? capability : "unsupported";
  return {
    region,
    name,
    provider,
    capability: safeCapability,
    configured: Boolean(configured),
    liveData: safeCapability === "live" || safeCapability === "limited",
    coverage,
    blocker,
  };
}

function capabilitySummary(capabilities = fuelProviderCapabilityMatrix()) {
  return capabilities.reduce((summary, item) => {
    summary[item.capability] = (summary[item.capability] || 0) + 1;
    return summary;
  }, {});
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

async function saApiGet(path, params) {
  const token = process.env.SA_FUEL_API_TOKEN;
  if (!token) throw new Error("SA fuel API token is not configured");
  const baseUrl = process.env.SA_FUEL_API_BASE_URL || DEFAULT_SA_FUEL_API_BASE_URL;
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

async function loadLiveSaStations({ forceRefresh = false } = {}) {
  const ageMs = Date.now() - saLiveCache.loadedAtMs;
  const ttlMs = Math.max(cacheSeconds(), 60) * 1000;
  if (!forceRefresh && saLiveCache.stations && ageMs < ttlMs) {
    return {
      stations: saLiveCache.stations,
      cacheHit: true,
      cacheAgeSeconds: Math.round(ageMs / 1000),
      error: "",
    };
  }

  const [brands, regions, sites, prices] = await Promise.all([
    saApiGet("/Subscriber/GetCountryBrands", { countryId: 21 }),
    saApiGet("/Subscriber/GetCountryGeographicRegions", { countryId: 21 }),
    saApiGet("/Subscriber/GetFullSiteDetails", SA_REGION_PARAMS),
    saApiGet("/Price/GetSitesPrices", SA_REGION_PARAMS),
  ]);
  const stations = normaliseSaPayload(sites, prices, brands, regions).map(stationWithDiscountRules);
  saLiveCache.stations = stations;
  saLiveCache.loadedAtMs = Date.now();
  saLiveCache.lastError = "";
  return {
    stations,
    cacheHit: false,
    cacheAgeSeconds: 0,
    error: "",
  };
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

function saPriceCpl(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price === SA_UNAVAILABLE_PRICE) return undefined;
  return Math.round(price) / 10;
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
  const text = String(address || "").replace(/\s+/g, " ").trim();
  const postcodeText = String(postcode || "").trim();
  const match = /\b([^,]+?)\s+SA\s+\d{4}\b/i.exec(text);
  if (match?.[1]) return titleCase(match[1].trim());
  if (postcodeText) {
    const beforePostcode = new RegExp(`([^,]+?)\\s+${postcodeText}\\b`, "i").exec(text);
    if (beforePostcode?.[1]) return titleCase(beforePostcode[1].replace(/\bSA$/i, "").trim());
  }
  return qldSuburbFromAddress(text, postcodeText);
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

async function loadLiveWaStations({ forceRefresh = false, points = [], radiusKm = 0, fuels = [], now = new Date() } = {}) {
  if (!hasWaProvider()) throw new Error("WA FuelWatch provider is disabled");
  const plan = waFuelWatchRequestPlan({ points, radiusKm, fuels, now });
  if (!plan.products.length) {
    return {
      stations: [],
      cacheHit: true,
      cacheAgeSeconds: 0,
      error: "",
      warning: `WA FuelWatch does not publish ${plan.requestedFuelCodes.join("/") || "the requested fuel"} in the current Fuel Path product map.`,
      metadata: plan,
    };
  }

  const cacheKey = [
    plan.regionIds.join(","),
    plan.products.map((item) => item.fuelCode).join(","),
    plan.days.join(","),
  ].join("|");
  const cached = waLiveCache.entries.get(cacheKey);
  const ageMs = Date.now() - Number(cached?.loadedAtMs || 0);
  const ttlMs = cacheSeconds() * 1000;
  if (!forceRefresh && cached?.stations && ageMs < ttlMs) {
    return {
      stations: cached.stations,
      cacheHit: true,
      cacheAgeSeconds: Math.round(ageMs / 1000),
      error: "",
      warning: cached.warning || "",
      metadata: cached.metadata || plan,
    };
  }

  const requests = plan.regionIds.flatMap((regionId) =>
    plan.products.flatMap(({ fuelCode, product }) =>
      plan.days.map((day) => ({
        day,
        fuelCode,
        product,
        regionId,
      })),
    ),
  );
  const productPayloads = (await mapWithConcurrency(requests, waFetchConcurrency(), (request) => fetchWaFuelWatchPayload(request, { forceRefresh }))).filter(
    (payload) => payload.xml,
  );
  const stations = normaliseWaFuelWatchPayloads(productPayloads).map(stationWithDiscountRules);
  const cacheHits = productPayloads.filter((payload) => payload.cacheHit).length;
  const warning = waFuelWatchPlanWarning(plan);
  waLiveCache.entries.set(cacheKey, {
    stations,
    warning,
    metadata: plan,
    loadedAtMs: Date.now(),
  });
  waLiveCache.lastError = "";
  return {
    stations,
    cacheHit: Boolean(productPayloads.length) && cacheHits === productPayloads.length,
    cacheAgeSeconds: 0,
    error: "",
    warning,
    metadata: plan,
  };
}

function waRegionIdsForArea(points = [], radiusKm = 0) {
  return waRegionPlanForArea(points, radiusKm).regionIds;
}

function waFuelWatchRequestPlan({ points = [], radiusKm = 0, fuels = [], now = new Date() } = {}) {
  const regionPlan = waRegionPlanForArea(points, radiusKm);
  const products = waFuelWatchProductsForRequest(fuels);
  const days = ["today"];
  if (waTomorrowPriceAvailable(now) && process.env.FUEL_PATH_WA_FETCH_TOMORROW !== "0") days.push("tomorrow");
  return {
    ...regionPlan,
    days,
    products,
    requestedFuelCodes: requestedFuelCodes(fuels),
    requestCount: regionPlan.regionIds.length * products.length * days.length,
    fetchConcurrency: waFetchConcurrency(),
  };
}

function waRegionPlanForArea(points = [], radiusKm = 0) {
  const waPoints = samplePointsForProvider(points.filter(pointInWa), 32);
  const maxRegionIds = waMaxRegionIds();
  if (!waPoints.length) {
    return {
      regionIds: [...WA_DEFAULT_METRO_REGION_IDS],
      capped: false,
      maxRegionIds,
      sampledPointCount: 0,
      matchedRegionCount: WA_DEFAULT_METRO_REGION_IDS.length,
      defaultedToMetro: true,
    };
  }

  const byId = new Map();
  const perth = { lat: -31.9523, lon: 115.8613 };
  const searchKm = Math.max(35, Math.min(160, Number(radiusKm || 0) * 2));
  for (let pointIndex = 0; pointIndex < waPoints.length; pointIndex += 1) {
    const point = waPoints[pointIndex];
    if (distanceKm(point, perth) <= 85) {
      for (const id of WA_DEFAULT_METRO_REGION_IDS) addWaRegionCandidate(byId, id, 0, pointIndex);
    }
    const ranked = WA_FUELWATCH_REGIONS.map((region) => ({
      region,
      distance: distanceKm(point, region),
    })).sort((left, right) => left.distance - right.distance);

    if (ranked[0]) addWaRegionCandidate(byId, ranked[0].region.id, ranked[0].distance, pointIndex);
    for (const item of ranked) {
      if (item.distance <= searchKm) addWaRegionCandidate(byId, item.region.id, item.distance, pointIndex);
    }
  }

  const rankedRegionIds = [...byId.values()]
    .sort((left, right) => left.score - right.score || left.id - right.id)
    .map((item) => item.id);
  const regionIds = rankedRegionIds.slice(0, maxRegionIds).sort((left, right) => left - right);
  return {
    regionIds,
    capped: rankedRegionIds.length > maxRegionIds,
    maxRegionIds,
    sampledPointCount: waPoints.length,
    matchedRegionCount: rankedRegionIds.length,
    defaultedToMetro: false,
  };
}

function addWaRegionCandidate(byId, id, distance, pointIndex) {
  const existing = byId.get(id);
  const score = Number(distance) + pointIndex * 0.02;
  if (!existing || score < existing.score) {
    byId.set(id, { id, score });
  }
}

function waFuelWatchProductsForRequest(fuels = []) {
  const codes = requestedFuelCodes(fuels);
  const usableCodes = codes.length ? codes : WA_FUELWATCH_PRODUCTS.map(([fuelCode]) => fuelCode);
  const products = [];
  const seen = new Set();
  for (const fuelCode of usableCodes) {
    const product = WA_FUELWATCH_PRODUCT_BY_CODE.get(fuelCode);
    if (product === undefined || seen.has(fuelCode)) continue;
    seen.add(fuelCode);
    products.push({ fuelCode, product });
  }
  return products;
}

function requestedFuelCodes(fuels = []) {
  return [...new Set((Array.isArray(fuels) ? fuels : [fuels]).map((fuel) => String(fuel || "").trim().toUpperCase()).filter(Boolean))];
}

function waTomorrowPriceAvailable(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return false;
  const awstMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + 8 * 60;
  const minutesToday = ((awstMinutes % 1440) + 1440) % 1440;
  return minutesToday >= 14 * 60 + 30;
}

function waFuelWatchPlanWarning(plan) {
  const warnings = [];
  if (plan.capped) {
    warnings.push(`WA FuelWatch request budget selected ${plan.regionIds.length} of ${plan.matchedRegionCount} matched regions.`);
  }
  if (!plan.days.includes("tomorrow")) {
    warnings.push("WA tomorrow locked prices are checked after 2:30pm AWST.");
  }
  return warnings.join(" ");
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
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

async function fetchWaFuelWatchPayload({ product, regionId, fuelCode, day = "today" }, { forceRefresh = false } = {}) {
  const cacheKey = `${regionId || "all"}:${product}:${day}`;
  const cached = waLiveCache.payloads.get(cacheKey);
  const ageMs = Date.now() - Number(cached?.loadedAtMs || 0);
  if (!forceRefresh && cached?.xml && ageMs < cacheSeconds() * 1000) {
    return {
      day,
      fuelCode,
      product,
      regionId,
      xml: cached.xml,
      cacheHit: true,
    };
  }

  const xml = await fetchWaFuelWatchRss(product, regionId, day);
  waLiveCache.payloads.set(cacheKey, {
    xml,
    loadedAtMs: Date.now(),
  });
  return {
    day,
    fuelCode,
    product,
    regionId,
    xml,
    cacheHit: false,
  };
}

async function fetchWaFuelWatchRss(product, regionId, day = "today") {
  const baseUrl = process.env.WA_FUELWATCH_RSS_URL || DEFAULT_WA_FUELWATCH_RSS_URL;
  const url = new URL(baseUrl);
  url.searchParams.set("Product", String(product));
  if (regionId) url.searchParams.set("Region", String(regionId));
  url.searchParams.set("Day", day === "tomorrow" ? "tomorrow" : "today");
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
  for (const { fuelCode, xml, day = "today" } of productPayloads) {
    for (const item of waFuelWatchItems(xml)) {
      const lat = Number(item.latitude);
      const lon = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || (!lat && !lon)) continue;
      const stationCode = waStationCode(item);
      const updatedAt = normaliseWaDate(item.date);
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
          updatedAt: day === "today" ? updatedAt : undefined,
          source: "api_wa_fuelwatch",
          prices: {},
          futurePrices: {},
          discounts: [],
        };
      const price = Number(item.price);
      if (fuelCode && Number.isFinite(price) && day === "today") existing.prices[fuelCode] = price;
      if (fuelCode && Number.isFinite(price) && day === "tomorrow") {
        existing.futurePrices.tomorrow = existing.futurePrices.tomorrow || {
          effectiveFrom: updatedAt,
          prices: {},
          label: "WA locked tomorrow price",
        };
        existing.futurePrices.tomorrow.prices[fuelCode] = price;
        if (updatedAt && (!existing.futurePrices.tomorrow.effectiveFrom || updatedAt > existing.futurePrices.tomorrow.effectiveFrom)) {
          existing.futurePrices.tomorrow.effectiveFrom = updatedAt;
        }
      }
      if (day === "today" && updatedAt && (!existing.updatedAt || updatedAt > String(existing.updatedAt))) {
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

function pointInSa(point) {
  return (
    Number(point?.lat) >= SA_BOUNDS.minLat &&
    Number(point?.lat) <= SA_BOUNDS.maxLat &&
    Number(point?.lon) >= SA_BOUNDS.minLon &&
    Number(point?.lon) <= SA_BOUNDS.maxLon
  );
}

function pointInTas(point) {
  return (
    Number(point?.lat) >= TAS_BOUNDS.minLat &&
    Number(point?.lat) <= TAS_BOUNDS.maxLat &&
    Number(point?.lon) >= TAS_BOUNDS.minLon &&
    Number(point?.lon) <= TAS_BOUNDS.maxLon
  );
}

function pointInNt(point) {
  return (
    Number(point?.lat) >= NT_BOUNDS.minLat &&
    Number(point?.lat) <= NT_BOUNDS.maxLat &&
    Number(point?.lon) >= NT_BOUNDS.minLon &&
    Number(point?.lon) <= NT_BOUNDS.maxLon
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

  const firstBorderPoint = NSW_VIC_BORDER_POINTS[0];
  const lastBorderPoint = NSW_VIC_BORDER_POINTS[NSW_VIC_BORDER_POINTS.length - 1];
  if (lon > lastBorderPoint.lon) return lat <= lastBorderPoint.lat;
  if (lon < firstBorderPoint.lon) return lat < firstBorderPoint.lat;

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
  return !pointInQld(point) && !pointInWa(point) && !pointInVic(point) && !pointInSa(point) && !pointInTas(point) && !pointInNt(point);
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
  const hasSaPoint = points.some(pointInSa);
  const hasNswPoint = points.some(pointInNswOrAct);
  if (hasWaPoint) return ["wa"];
  if (hasSaPoint) return hasSaCredentials() ? ["sa"] : [];
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

function regionCodeForPoint(point) {
  if (pointInAct(point)) return "ACT";
  if (pointInQld(point)) return "QLD";
  if (pointInWa(point)) return "WA";
  if (pointInVic(point)) return "VIC";
  if (pointInTas(point)) return "TAS";
  if (pointInNt(point)) return "NT";
  if (pointInSa(point)) return "SA";
  if (pointInNswOrAct(point)) return "NSW";
  return "UNSUPPORTED";
}

function capabilitiesForPoints(points = []) {
  const matrixByRegion = new Map(fuelProviderCapabilityMatrix().map((item) => [item.region, item]));
  const regionCodes = new Set();
  for (const point of points) regionCodes.add(regionCodeForPoint(point));
  if (!regionCodes.size) return [];

  const capabilities = REGION_ORDER.filter((region) => regionCodes.has(region)).map((region) => matrixByRegion.get(region));
  if (regionCodes.has("UNSUPPORTED")) {
    capabilities.push(
      capabilityEntry({
        region: "UNSUPPORTED",
        name: "Unsupported area",
        provider: "none",
        capability: "unsupported",
        configured: false,
        coverage: "No Australian fuel provider coverage matched this location.",
        blocker: "Fuel Path cannot identify this location as an Australian state or territory.",
      }),
    );
  }
  return capabilities.filter(Boolean);
}

function primaryCapability(capabilities = []) {
  if (!capabilities.length) return "unsupported";
  if (capabilities.some((item) => item.capability === "unsupported")) return "unsupported";
  if (capabilities.some((item) => item.capability === "fallback")) return "fallback";
  if (capabilities.some((item) => item.capability === "pending_access")) return "pending_access";
  if (capabilities.some((item) => item.capability === "limited")) return "limited";
  return "live";
}

function capabilityWarning(capabilities = []) {
  if (!capabilities.length) return "No live fuel provider covers this area yet.";
  const names = capabilities.map((item) => item.region).join("/");
  const capability = primaryCapability(capabilities);
  if (capability === "pending_access") {
    return `Fuel Path has ${names} in the national provider matrix, but live prices are not enabled for this area yet.`;
  }
  if (capability === "limited") {
    return `Fuel Path has limited live coverage for ${names}; confirm freshness before driving.`;
  }
  if (capability === "fallback") {
    return `Fuel Path is using fallback data for ${names}; do not treat this as a live price recommendation.`;
  }
  if (capability === "unsupported") {
    return "No live fuel provider covers this area yet.";
  }
  return "";
}

async function loadLiveStationsForArea({ forceRefresh = false, points = [], radiusKm = 0, providers: requestedProviders, fuels = [] } = {}) {
  const providers = requestedProviders || liveProviderKeysForArea(points, radiusKm);
  const regionCapabilities = capabilitiesForPoints(points);
  if (!providers.length) {
    return {
      stations: [],
      source: "unsupported_region",
      provider: "unsupported_region",
      capability: primaryCapability(regionCapabilities),
      regionCapabilities,
      cacheHit: false,
      cacheAgeSeconds: 0,
      warning: capabilityWarning(regionCapabilities),
    };
  }
  const stations = [];
  const loadedProviders = [];
  const errors = [];
  const warnings = [];
  for (const provider of providers) {
    try {
      if (provider === "qld") {
        const live = await loadLiveQldStations({ forceRefresh });
        stations.push(...live.stations);
        loadedProviders.push("api_qld");
      } else if (provider === "wa") {
        const live = await loadLiveWaStations({ forceRefresh, points, radiusKm, fuels });
        stations.push(...live.stations);
        loadedProviders.push("api_wa");
        if (live.warning) warnings.push(live.warning);
      } else if (provider === "vic") {
        const live = await loadLiveVicStations({ forceRefresh });
        stations.push(...live.stations);
        loadedProviders.push("api_vic");
      } else if (provider === "sa") {
        const live = await loadLiveSaStations({ forceRefresh });
        stations.push(...live.stations);
        loadedProviders.push("api_sa");
      } else if (provider === "nsw") {
        const live = await loadLiveStations({ forceRefresh });
        stations.push(...live.stations);
        loadedProviders.push("api_nsw");
      }
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!stations.length && !loadedProviders.length) throw new Error(errors.join("; ") || "No live fuel providers are configured");
  const byCode = new Map();
  for (const station of stations) byCode.set(String(station.stationCode), station);
  return {
    stations: [...byCode.values()],
    source: loadedProviders.join("+") || "live",
    provider: loadedProviders.join("+") || "live",
    capability: primaryCapability(regionCapabilities),
    regionCapabilities,
    cacheHit: false,
    cacheAgeSeconds: 0,
    warning: [...warnings, ...(errors.length ? [`Some live fuel providers unavailable: ${errors.join("; ")}`] : [])].join(" "),
  };
}

async function loadStationData({ requestedSource = "auto", forceRefresh = false, points = [], radiusKm = 0, fuels = [] } = {}) {
  const source = resolveSource(requestedSource);
  if (source === "sample") {
    const regionCapabilities = capabilitiesForPoints(points);
    return {
      source: "sample",
      provider: "public_demo_snapshot",
      capability: "fallback",
      regionCapabilities,
      stations: loadSampleStations(),
      cacheHit: true,
      cacheAgeSeconds: null,
      warning: points.length ? capabilityWarning(regionCapabilities.map((item) => ({ ...item, capability: "fallback" }))) : "",
    };
  }

  const requestedProvider = providerFromSource(source);
  if (requestedProvider && points.length && !points.some((point) => pointInProviderCoverage(requestedProvider, point))) {
    const regionCapabilities = capabilitiesForPoints(points);
    return {
      stations: [],
      source: "unsupported_region",
      provider: requestedProvider,
      capability: primaryCapability(regionCapabilities),
      regionCapabilities,
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
      fuels,
      providers: requestedProvider ? [requestedProvider] : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    liveCache.lastError = message;
    return {
      source: "sample_fallback",
      provider: "public_demo_snapshot",
      capability: "fallback",
      regionCapabilities: capabilitiesForPoints(points),
      stations: loadSampleStations(),
      cacheHit: true,
      cacheAgeSeconds: null,
      warning: `Live fuel provider unavailable: ${message}`,
    };
  }
}

function resolveSource(source) {
  const value = source === "auto" || !source ? (hasAnyLiveCredentials() ? "live" : "sample") : source;
  if (!["live", "sample", "nsw", "qld", "wa", "vic", "sa"].includes(value)) {
    throw new Error("source must be live, sample, nsw, qld, wa, vic, sa or auto");
  }
  return value;
}

function providerFromSource(source) {
  return ["nsw", "qld", "wa", "vic", "sa"].includes(source) ? source : "";
}

function pointInProviderCoverage(provider, point) {
  if (provider === "nsw") return pointInNswOrAct(point);
  if (provider === "qld") return pointInQld(point);
  if (provider === "wa") return pointInWa(point);
  if (provider === "vic") return pointInVic(point);
  if (provider === "sa") return pointInSa(point);
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
    futurePrices: station.futurePrices || undefined,
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

function isOfficialLivePriceSource(source) {
  return new Set([
    "api_nsw_fuelcheck",
    "api_qld_fuelprices",
    "api_wa_fuelwatch",
    "api_vic_servo_saver",
  ]).has(String(source || ""));
}

function freshnessPenalty(updatedAt, now, source) {
  const hours = priceAgeHours(updatedAt, now);
  if (!Number.isFinite(hours)) return [1.5, "price timestamp missing or invalid"];
  if (isOfficialLivePriceSource(source)) return [0, ""];
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
    const [freshPenalty, freshWarning] = freshnessPenalty(station.updatedAt, now, station.source);
    if (
      !isOfficialLivePriceSource(station.source) &&
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
      timingAdvice: routeTimingAdvice(candidates[0]),
    },
  };
}

function routeTimingAdvice(candidate) {
  if (!candidate) {
    return {
      action: "no_cycle_signal",
      visible: false,
      label: "",
      reason: "",
    };
  }

  const saving = Number(candidate.netSaving || 0);
  const detourMinutes = Number(candidate.detourMinutes || 0);
  if (saving >= 4 && detourMinutes <= 3) {
    return {
      action: "fill_today_on_route",
      visible: true,
      label: "Fill today on this route",
      reason: `${candidate.station?.name || "This stop"} is good value with only ${detourMinutes.toFixed(1)} min detour.`,
    };
  }
  if (saving >= 1) {
    return {
      action: "fill_today_with_detour",
      visible: true,
      label: "Fill today, but check the detour",
      reason: `${candidate.station?.name || "This stop"} saves about ${formatMoney(saving)} after ${detourMinutes.toFixed(1)} min detour.`,
    };
  }
  return {
    action: "no_cycle_signal",
    visible: false,
    label: "",
    reason: "",
  };
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Number(value) || 0).toFixed(2)}`;
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
    addressIndex: addressIndexStatus(),
    localHints: {
      builtInRecords: LOCAL_GEOCODE_HINTS.length,
      ...additionalLocalGeocodeHintStatus(),
      ...regionalGeocodeHintStatus(),
      provider: "fuel_path_hint",
    },
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

const LOCAL_GEOCODE_HINTS = [
  {
    label: "66B Easton Avenue, Sylvania NSW 2224",
    lat: -34.0114122,
    lon: 151.0993847,
    kind: "address",
    aliases: ["66b eas", "66b east", "easton", "easton ave", "easton avenue sylvania"],
  },
  {
    label: "Sydney Opera House, Bennelong Point NSW 2000",
    lat: -33.8567844,
    lon: 151.2152967,
    kind: "poi",
    aliases: ["opera", "opera house", "sydney opera"],
  },
  {
    label: "Sydney CBD, Sydney NSW",
    lat: -33.8747234,
    lon: 151.2053644,
    kind: "suburb",
    aliases: ["sydney cbd", "cbd sydney", "city sydney"],
  },
  {
    label: "Sydney Harbour Bridge, Sydney NSW",
    lat: -33.8523063,
    lon: 151.2107871,
    kind: "poi",
    aliases: ["harbour bridge", "sydney harbour bridge"],
  },
  {
    label: "Bondi Beach, Bondi NSW 2026",
    lat: -33.8914755,
    lon: 151.2766845,
    kind: "poi",
    aliases: ["bondi", "bondi beach"],
  },
  {
    label: "Sydney Airport, Mascot NSW 2020",
    lat: -33.9399228,
    lon: 151.1752764,
    kind: "airport",
    aliases: ["sydney airport", "kingsford smith airport", "mascot airport"],
  },
  {
    label: "Westfield Parramatta, Parramatta NSW 2150",
    lat: -33.817986,
    lon: 151.001057,
    kind: "poi",
    aliases: ["westfield parramatta", "parramatta westfield"],
  },
  {
    label: "Canberra ACT",
    lat: -35.2975906,
    lon: 149.1012676,
    kind: "city",
    aliases: ["canberra", "canberra act"],
  },
  {
    label: "Canberra Centre, Canberra ACT 2601",
    lat: -35.279341,
    lon: 149.133663,
    kind: "poi",
    aliases: ["canberra centre"],
  },
  {
    label: "Melbourne CBD, Melbourne VIC",
    lat: -37.8136276,
    lon: 144.9630576,
    kind: "city",
    aliases: ["melbourne", "melbourne cbd", "city melbourne"],
  },
  {
    label: "Melbourne Central, Melbourne VIC 3000",
    lat: -37.810064,
    lon: 144.962792,
    kind: "poi",
    aliases: ["melbourne central"],
  },
  {
    label: "Flinders Street Station, Melbourne VIC 3000",
    lat: -37.818305,
    lon: 144.966964,
    kind: "poi",
    aliases: ["flinders street station", "flinders st station"],
  },
  {
    label: "Queen Victoria Market, Melbourne VIC 3000",
    lat: -37.807579,
    lon: 144.956785,
    kind: "poi",
    aliases: ["queen victoria market", "qvm"],
  },
  {
    label: "Melbourne Cricket Ground, East Melbourne VIC 3002",
    lat: -37.819967,
    lon: 144.983449,
    kind: "poi",
    aliases: ["mcg", "melbourne cricket ground"],
  },
  {
    label: "Melbourne Airport, Tullamarine VIC 3045",
    lat: -37.669012,
    lon: 144.841027,
    kind: "airport",
    aliases: ["melbourne airport", "tullamarine airport"],
  },
  {
    label: "Brisbane CBD, Brisbane QLD",
    lat: -27.4697707,
    lon: 153.0251235,
    kind: "city",
    aliases: ["brisbane", "brisbane cbd", "city brisbane"],
  },
  {
    label: "South Bank, Brisbane QLD 4101",
    lat: -27.481079,
    lon: 153.023379,
    kind: "poi",
    aliases: ["south bank brisbane", "southbank brisbane"],
  },
  {
    label: "Queen Street Mall, Brisbane QLD 4000",
    lat: -27.470849,
    lon: 153.024475,
    kind: "poi",
    aliases: ["queen street mall", "queen street mall brisbane"],
  },
  {
    label: "Brisbane Airport, Brisbane Airport QLD 4008",
    lat: -27.384199,
    lon: 153.1175,
    kind: "airport",
    aliases: ["brisbane airport"],
  },
  {
    label: "Perth CBD, Perth WA",
    lat: -31.9523123,
    lon: 115.861309,
    kind: "city",
    aliases: ["perth", "perth cbd", "city perth"],
  },
  {
    label: "Elizabeth Quay, Perth WA 6000",
    lat: -31.958647,
    lon: 115.857494,
    kind: "poi",
    aliases: ["elizabeth quay", "elizabeth quay perth"],
  },
  {
    label: "Perth Airport, Perth Airport WA 6105",
    lat: -31.940299,
    lon: 115.966904,
    kind: "airport",
    aliases: ["perth airport"],
  },
  {
    label: "Adelaide CBD, Adelaide SA",
    lat: -34.9284989,
    lon: 138.6007456,
    kind: "city",
    aliases: ["adelaide", "adelaide cbd", "city adelaide"],
  },
  {
    label: "Rundle Mall, Adelaide SA 5000",
    lat: -34.922776,
    lon: 138.602686,
    kind: "poi",
    aliases: ["rundle mall", "rundle mall adelaide"],
  },
  {
    label: "Adelaide Airport, Adelaide Airport SA 5950",
    lat: -34.945,
    lon: 138.530556,
    kind: "airport",
    aliases: ["adelaide airport"],
  },
  {
    label: "Hobart CBD, Hobart TAS",
    lat: -42.8821377,
    lon: 147.3271949,
    kind: "city",
    aliases: ["hobart", "hobart cbd", "city hobart"],
  },
  {
    label: "Salamanca Market, Hobart TAS 7000",
    lat: -42.886438,
    lon: 147.33174,
    kind: "poi",
    aliases: ["salamanca market", "salamanca hobart"],
  },
  {
    label: "Hobart Airport, Cambridge TAS 7170",
    lat: -42.836111,
    lon: 147.510278,
    kind: "airport",
    aliases: ["hobart airport"],
  },
  {
    label: "Darwin CBD, Darwin NT",
    lat: -12.46344,
    lon: 130.845642,
    kind: "city",
    aliases: ["darwin", "darwin cbd", "city darwin"],
  },
  {
    label: "Darwin Waterfront, Darwin NT 0800",
    lat: -12.466762,
    lon: 130.846361,
    kind: "poi",
    aliases: ["darwin waterfront", "waterfront darwin"],
  },
  {
    label: "Darwin Airport, Eaton NT 0820",
    lat: -12.414722,
    lon: 130.876667,
    kind: "airport",
    aliases: ["darwin airport"],
  },
];

const ALL_LOCAL_GEOCODE_HINTS = [...LOCAL_GEOCODE_HINTS, ...additionalLocalGeocodeHints()];
const LIVE_GEOCODE_REGION_CODES = ["NSW", "ACT", "QLD", "WA", "SA"];
const geocodeCache = new Map();
let nominatimBlockedUntilMs = 0;

const STREET_QUERY_PATTERN = /^(.+\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|lane|ln|way|crescent|cres)\b)\b.*$/i;
const PARTIAL_STREET_QUERY_PATTERN = /^(\d+[a-z]?\s+[a-z][a-z\s'-]{2,})$/i;
const STREET_TYPE_EXPANSIONS = ["street", "road", "avenue", "drive", "parade", "place", "lane", "way"];
const STATION_QUERY_TERMS = [
  "7 eleven",
  "ampol",
  "bp",
  "caltex",
  "coles express",
  "eg",
  "fuel",
  "metro",
  "mobil",
  "petrol",
  "reddy",
  "service station",
  "servo",
  "shell",
  "united",
  "woolworths",
];

function geocodeQueryVariants(query) {
  const cleaned = String(query || "").trim().replace(/\s+/g, " ").replace(/\.+$/, "");
  const variants = [cleaned];
  const upperCleaned = cleaned.toUpperCase();
  const detectedStateCodes = LIVE_GEOCODE_REGION_CODES.filter((code) =>
    new RegExp(`\\b${code}\\b`, "i").test(upperCleaned),
  );
  const targetStateCodes = detectedStateCodes.length ? detectedStateCodes : LIVE_GEOCODE_REGION_CODES;
  let corrected = cleaned;
  for (const [typo, replacement] of Object.entries(GEOCODE_QUERY_CORRECTIONS)) {
    corrected = corrected.replace(new RegExp(`\\b${typo}\\b`, "gi"), replacement);
  }
  if (corrected !== cleaned) variants.push(corrected);
  for (const value of [...variants]) {
    const match = STREET_QUERY_PATTERN.exec(value);
    if (match) {
      const streetOnly = match[1].trim();
      variants.push(streetOnly);
      for (const code of targetStateCodes) {
        variants.push(`${streetOnly} ${code}`);
      }
    }
  }
  if (PARTIAL_STREET_QUERY_PATTERN.test(cleaned) && !STREET_QUERY_PATTERN.test(cleaned)) {
    for (const type of STREET_TYPE_EXPANSIONS) {
      for (const code of targetStateCodes) {
        variants.push(`${cleaned} ${type} ${code}`);
      }
    }
  }
  for (const code of targetStateCodes) {
    variants.push(`${cleaned} ${code}`);
  }
  variants.push(`${cleaned} Australia`);
  return [...new Set(variants.filter(Boolean).map((value) => value.trim()))].slice(0, 16);
}

function geocodeItemPayload({ label, lat, lon, provider, kind = "place", providerId = "", ...extra }) {
  return {
    label,
    lat: Number(lat),
    lon: Number(lon),
    type: kind,
    provider,
    ...(providerId ? { providerId } : {}),
    ...extra,
  };
}

async function nominatimGeocode(query, limit) {
  if (Date.now() < nominatimBlockedUntilMs) {
    throw new Error("Validation geocoder is cooling down after rate limiting");
  }
  const suggestions = [];
  const seen = new Set();
  for (const candidateQuery of geocodeQueryVariants(query)) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", candidateQuery);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("countrycodes", "au");
    url.searchParams.set("addressdetails", "1");
    let payload;
    try {
      payload = await fetchJson(url.toString(), { timeoutMs: 12000 });
    } catch (error) {
      if (isRateLimitError(error)) {
        nominatimBlockedUntilMs = Date.now() + NOMINATIM_RATE_LIMIT_BACKOFF_MS;
      }
      throw error;
    }
    if (Array.isArray(payload) && payload.length) {
      for (const item of payload) {
        const suggestion = geocodeItemPayload({
          label: String(item.display_name || item.name || candidateQuery),
          lat: item.lat,
          lon: item.lon,
          kind: String(item.type || item.class || "place"),
          provider: "nominatim",
          providerId: `${item.osm_type || ""}:${item.osm_id || ""}`,
        });
        const key = geocodeSuggestionKey(suggestion);
        if (!seen.has(key)) {
          suggestions.push(suggestion);
          seen.add(key);
        }
        if (suggestions.length >= limit) return suggestions;
      }
    }
  }
  if (!suggestions.length) throw new Error(`No location found for ${query}`);
  return suggestions;
}

async function localStationGeocode(query, limit) {
  const needle = normaliseSearchText(query);
  if (needle.length < 3) return [];
  try {
    const data = await loadStationData({ requestedSource: "auto", points: [], radiusKm: 0 });
    const scored = [];
    for (const station of data.stations || []) {
      const haystack = normaliseSearchText(
        [station.name, station.brand, station.suburb, station.address].filter(Boolean).join(" "),
      );
      if (!haystack.includes(needle)) continue;
      const name = String(station.name || station.brand || "Fuel station");
      const suburb = station.suburb ? `, ${station.suburb}` : "";
      const address = station.address ? ` - ${station.address}` : "";
      scored.push({
        score: haystack.startsWith(needle) ? 0 : haystack.indexOf(needle),
        item: geocodeItemPayload({
          label: `${name}${suburb}${address}`,
          lat: station.lat,
          lon: station.lon,
          kind: "fuel_station",
          provider: "fuel_path",
          providerId: String(station.stationCode || ""),
        }),
      });
    }
    return scored
      .sort((left, right) => left.score - right.score || left.item.label.length - right.item.label.length)
      .slice(0, limit)
      .map((row) => row.item);
  } catch {
    return [];
  }
}

function localHintGeocode(query, limit) {
  const needle = normaliseSearchText(query);
  if (needle.length < 3) return [];
  const queryStateCode = detectStateCode(query);
  const queryLocality = detectQueryLocality(query);
  return ALL_LOCAL_GEOCODE_HINTS.map((hint) => {
    if (queryStateCode && hintStateCode(hint) && hintStateCode(hint) !== queryStateCode) return null;
    if (queryLocality && hintLocality(hint) && !localityMatches(queryLocality, hintLocality(hint))) return null;
    const texts = [hint.label, ...(hint.aliases || [])].map(normaliseSearchText);
    const match = localHintMatch(needle, texts, hint.kind);
    if (!match) return null;
    const bestIndex = Math.min(...texts.map((value) => localHintBestIndex(needle, value)));
    return {
      score: match.score + bestIndex,
      item: geocodeItemPayload({
        label: hint.label,
        lat: hint.lat,
        lon: hint.lon,
        kind: hint.kind,
        provider: "fuel_path_hint",
        providerId: normaliseSearchText(hint.label),
        confidence: match.confidence,
        matchType: match.matchType,
        source: "local_geocode_hints",
      }),
    };
  })
    .filter(Boolean)
    .sort((left, right) => left.score - right.score || left.item.label.length - right.item.label.length)
    .slice(0, limit)
    .map((row) => row.item);
}

function detectStateCode(value) {
  const text = String(value || "").toUpperCase();
  return REGION_ORDER.find((code) => new RegExp(`\\b${code}\\b`).test(text)) || "";
}

function hintStateCode(hint) {
  return detectStateCode(hint?.label || "");
}

function hintLocality(hint) {
  return extractLabelLocality(hint?.label || "");
}

function detectQueryLocality(query) {
  const text = String(query || "").trim().replace(/\s+/g, " ");
  const streetMatch = /\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|terrace|highway|mall|court|close|vista|circuit|way|lane|ln)\b\s+(.+?)(?:\s+\b(NSW|ACT|QLD|WA|SA)\b|\s*$)/i.exec(text);
  if (streetMatch?.[1]) return normaliseSearchText(streetMatch[1]);
  const stateMatch = /^(.+?)\s+\b(NSW|ACT|QLD|WA|SA)\b$/i.exec(text);
  if (stateMatch?.[1]) return normaliseSearchText(stateMatch[1]);
  return "";
}

function extractLabelLocality(label) {
  const text = String(label || "").trim();
  const commaParts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const withState = commaParts.find((part) => /\b(NSW|ACT|QLD|WA|SA)\b/i.test(part));
    if (withState) return normaliseSearchText(withState.replace(/\b(NSW|ACT|QLD|WA|SA)\b.*$/i, ""));
  }
  const stateMatch = /,\s*([^,]+?)\s+\b(NSW|ACT|QLD|WA|SA)\b/i.exec(text) || /\b([A-Za-z][A-Za-z\s'.-]+?)\s+\b(NSW|ACT|QLD|WA|SA)\b/i.exec(text);
  return stateMatch?.[1] ? normaliseSearchText(stateMatch[1]) : "";
}

function localityMatches(left, right) {
  if (!left || !right) return true;
  return left === right || left.includes(right) || right.includes(left);
}

function localHintBestIndex(needle, value) {
  const directIndex = value.indexOf(needle);
  if (directIndex >= 0) return directIndex;
  const reverseIndex = needle.indexOf(value);
  return reverseIndex >= 0 ? reverseIndex : 999;
}

function localHintMatch(needle, texts, kind) {
  let best = null;
  for (const value of texts) {
    const candidate = localHintTextMatch(needle, value, kind);
    if (!candidate) continue;
    if (!best || candidate.score < best.score) best = candidate;
  }
  return best;
}

function localHintTextMatch(needle, value, kind) {
  if (!value) return null;
  if (needle === value) {
    return { matchType: "exact_hint", confidence: "medium", score: 0 };
  }
  if (value.startsWith(needle)) {
    return { matchType: "hint_prefix", confidence: "medium", score: 10 };
  }
  if (value.includes(needle)) {
    return { matchType: "hint_contains", confidence: "medium", score: 20 };
  }
  if (kind === "city") return null;
  if (value.length >= 6 && needle.includes(value)) {
    return { matchType: "fallback_area", confidence: "low", score: 40 - Math.min(value.length, 40) / 10 };
  }
  return null;
}

function hasStrongLocalSuggestion(suggestions) {
  return suggestions.some(
    (item) =>
      item.provider === "fuel_path_hint" &&
      ["exact_hint", "hint_prefix"].includes(item.matchType) &&
      !["street", "address"].includes(item.type),
  );
}

function normaliseSearchText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function geocodeSuggestionKey(item) {
  return `${Math.round(Number(item.lat) * 100000)}:${Math.round(Number(item.lon) * 100000)}:${normaliseSearchText(item.label).slice(0, 48)}`;
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
  const cacheKey = geocodeCacheKey({ provider: selectedProvider, query, limit });
  const cached = readGeocodeCache(cacheKey);
  if (cached) {
    return {
      ...cached,
      cache: "hit",
      sessionToken,
    };
  }
  const addressSuggestions = searchAddressIndex(query, limit);
  const localSuggestions = mergeGeocodeSuggestions(
    [
      ...addressSuggestions,
      ...regionalLocalGeocode(query, limit),
      ...localHintGeocode(query, limit),
      ...(selectedProvider === "nominatim" && looksLikeStationQuery(query)
        ? await localStationGeocode(query, limit)
        : []),
    ],
    limit,
  );
  let providerSuggestions = [];
  let providerWarning = "";
  if (!hasExactAddressSuggestion(addressSuggestions) && !hasStrongLocalSuggestion(localSuggestions)) {
    try {
      providerSuggestions =
        selectedProvider === "google"
          ? await googleGeocode(query, limit, sessionToken)
          : selectedProvider === "mapbox"
            ? await mapboxGeocode(query, limit)
            : selectedProvider === "here"
              ? await hereGeocode(query, limit)
              : selectedProvider === "geoapify"
                ? await geoapifyGeocode(query, limit)
                : await nominatimGeocode(query, limit);
    } catch (error) {
      providerWarning = geocodeProviderWarning(error, selectedProvider);
    }
  }
  const suggestions =
    selectedProvider === "nominatim"
      ? mergeGeocodeSuggestions([...addressSuggestions, ...localSuggestions, ...providerSuggestions], limit)
      : mergeGeocodeSuggestions([...addressSuggestions, ...providerSuggestions, ...localSuggestions], limit);
  const lookupStatus = suggestions.length
    ? providerWarning
      ? "local_fallback"
      : "ok"
    : providerWarning
      ? "degraded"
      : "no_match";
  const payload = {
    provider: selectedProvider,
    providerMode: selectedProvider === "nominatim" ? "validation" : "production_candidate",
    recommendedProductionProvider: RECOMMENDED_GEOCODE_PROVIDER,
    requestedProvider: provider || process.env.FUEL_PATH_GEOCODE_PROVIDER || "auto",
    sessionToken,
    query,
    location: suggestions[0] || null,
    suggestions,
    lookupStatus,
    ...(providerWarning ? { warning: providerWarning } : {}),
  };
  writeGeocodeCache(cacheKey, payload, lookupStatus === "ok" || lookupStatus === "local_fallback");
  return payload;
}

function geocodeCacheKey({ provider, query, limit }) {
  return `${provider}:${limit}:${normaliseSearchText(query)}`;
}

function hasExactAddressSuggestion(suggestions) {
  return suggestions.some(
    (item) => item.provider === "fuel_path_gnaf" && item.matchType === "exact_address",
  );
}

function readGeocodeCache(key) {
  const entry = geocodeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    geocodeCache.delete(key);
    return null;
  }
  return entry.payload;
}

function writeGeocodeCache(key, payload, durable) {
  geocodeCache.set(key, {
    expiresAt: Date.now() + (durable ? GEOCODE_CACHE_SECONDS : GEOCODE_DEGRADED_CACHE_SECONDS) * 1000,
    payload,
  });
}

function isRateLimitError(error) {
  return String(error?.message || error).includes("429");
}

function geocodeProviderWarning(error, provider) {
  const message = String(error?.message || error || "");
  if (isRateLimitError(error) || /cooling down|rate limit/i.test(message)) {
    return `${provider} lookup is temporarily rate-limited. Try a fuller address, suburb or postcode, or enable a production autocomplete provider.`;
  }
  if (/abort|timeout/i.test(message)) {
    return `${provider} lookup timed out. Try a fuller address, suburb or postcode.`;
  }
  if (/No location found/i.test(message)) {
    return `No strong location match found. Try a fuller address, suburb or postcode.`;
  }
  return `${provider} lookup is temporarily unavailable. Try a fuller address, suburb or postcode.`;
}

function looksLikeStationQuery(query) {
  const needle = normaliseSearchText(query);
  if (needle.length < 3) return false;
  return STATION_QUERY_TERMS.some((term) => {
    const normalisedTerm = normaliseSearchText(term);
    return needle === normalisedTerm || needle.includes(normalisedTerm);
  });
}

function mergeGeocodeSuggestions(items, limit) {
  const merged = [];
  const seen = new Set();
  for (const item of items) {
    const key = geocodeSuggestionKey(item);
    if (seen.has(key)) continue;
    merged.push(item);
    seen.add(key);
    if (merged.length >= limit) break;
  }
  return merged;
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

async function alertsStatus() {
  const storage = alertStorageStatus({ maxRecords: ALERT_MAX_RECORDS });
  const cronConfigured = Boolean(process.env.CRON_SECRET);
  const pushDeliveryEnabled = alertPushDeliveryEnabled();
  let storageCounts = {};
  let storageError = "";
  try {
    storageCounts = await alertStorageCounts();
  } catch (error) {
    storageError = error instanceof Error ? error.message : "Alert storage is unavailable";
  }
  return {
    mode: "backend_foundation",
    schedulerEnabled: cronConfigured,
    evaluatorEnabled: true,
    pushDeliveryEnabled,
    deliveryMode: pushDeliveryEnabled ? "expo_push_service" : "disabled_env_gate",
    receiptCheckingEnabled: pushDeliveryEnabled,
    storageConfigured: Boolean(storage.configured),
    storage: {
      ...storage,
      ...storageCounts,
      health: storageError ? "error" : "ok",
      lastError: storageError,
    },
    writeSecurity: alertsWriteSecurity(),
    pushProviderConfigured: pushDeliveryEnabled,
    cronConfigured,
    supportedDecisionStatuses: [
      "send_alert",
      "alert_disabled",
      "quiet_today",
      "saving_below_threshold",
      "detour_above_threshold",
      "stale_price",
      "station_closed",
      "region_unsupported",
      "provider_access_pending",
      "missing_push_token",
      "permission_missing",
      "not_evaluated",
      "failed",
    ],
    nextBuildStep: pushDeliveryEnabled
      ? "Connect scheduled evaluation to live route scoring and monitor Expo push receipts."
      : "Enable EXPO_PUSH_DELIVERY_ENABLED only after native device-token validation passes.",
  };
}

function alertPushDeliveryEnabled() {
  return process.env.EXPO_PUSH_DELIVERY_ENABLED === "1";
}

function alertsWriteSecurity() {
  const adminTokenConfigured = Boolean(process.env.ALERTS_WRITE_TOKEN);
  const clientTokenEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED === "1";
  const clientTokenConfigured = clientTokenEnabled && Boolean(process.env.ALERTS_CLIENT_WRITE_TOKEN);
  const tokenConfigured = adminTokenConfigured || clientTokenConfigured;
  const storage = alertStorageStatus({ maxRecords: ALERT_MAX_RECORDS });
  const tokenRequired = tokenConfigured || Boolean(storage.durable);
  return {
    tokenConfigured,
    adminTokenConfigured,
    clientTokenEnabled,
    clientTokenConfigured,
    tokenRequired,
    writeEnabled: !tokenRequired || tokenConfigured,
    acceptedHeaders: ["Authorization: Bearer <token>", "X-Fuel-Path-Alerts-Token"],
  };
}

function alertsWriteAuthorised(req = {}) {
  const security = alertsWriteSecurity();
  if (!security.tokenRequired) return true;
  if (!security.writeEnabled) return false;
  const headers = req.headers || {};
  const auth = headers.authorization || headers.Authorization || "";
  const direct = headers["x-fuel-path-alerts-token"] || headers["X-Fuel-Path-Alerts-Token"] || "";
  const bearer = String(auth).replace(/^Bearer\s+/i, "").trim();
  const supplied = bearer || String(direct).trim();
  if (process.env.ALERTS_WRITE_TOKEN && supplied === process.env.ALERTS_WRITE_TOKEN) return true;
  return (
    security.clientTokenConfigured &&
    Boolean(process.env.ALERTS_CLIENT_WRITE_TOKEN) &&
    supplied === process.env.ALERTS_CLIENT_WRITE_TOKEN
  );
}

function cronAuthorised(req = {}) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const headers = req.headers || {};
  const auth = headers.authorization || headers.Authorization || "";
  const bearer = String(auth).replace(/^Bearer\s+/i, "").trim();
  return bearer === expected;
}

async function registerPushDevice(input = {}) {
  const record = normalisePushDevice(input);
  await upsertPushDevice(record);
  return {
    accepted: true,
    device: record,
    alerts: await alertsStatus(),
  };
}

async function saveBackendSavedRoute(input = {}) {
  const route = normaliseBackendSavedRoute(input);
  await upsertSavedRoute(route);
  return {
    accepted: true,
    route,
    alerts: await alertsStatus(),
  };
}

async function listBackendSavedRoutes({ userId = "", enabledOnly = false, limit = 50 } = {}) {
  const routes = await listSavedRoutes({ userId, enabledOnly, limit });
  return {
    routes,
    alerts: await alertsStatus(),
  };
}

async function listBackendPushDevices({ userId = "", status = "active", limit = 50 } = {}) {
  const devices = await listPushDevices({ userId, status, limit });
  return {
    devices,
    alerts: await alertsStatus(),
  };
}

async function listBackendAlertEvaluations({ routeId = "", userId = "", limit = 50 } = {}) {
  const evaluations = await listRouteAlertEvaluations({ routeId, userId, limit });
  return {
    evaluations,
    alerts: await alertsStatus(),
  };
}

async function evaluateSavedRouteAlert(input = {}) {
  const route = normaliseBackendSavedRoute(input.route || input);
  const devices = input.devices || (await listPushDevices({ userId: route.userId, status: "active", limit: 20 }));
  const pushDeliveryEnabled = alertPushDeliveryEnabled();
  const evaluation = buildSavedRouteAlertEvaluation({
    route,
    devices,
    candidate: input.candidate || input.recommendation || {},
    notificationPermission: input.notificationPermission,
    regionCapabilities: input.regionCapabilities,
    now: input.now,
    pushDeliveryEnabled,
  });
  await appendRouteAlertEvaluation(evaluation);
  const delivery = await deliverSavedRouteAlert({ route, devices, evaluation, pushDeliveryEnabled });
  return {
    evaluation,
    pushDeliveryEnabled,
    ...delivery,
    alerts: await alertsStatus(),
  };
}

async function deliverSavedRouteAlert({ route, devices = [], evaluation, pushDeliveryEnabled } = {}) {
  if (evaluation.status !== "send_alert") return { deliveryStatus: "not_applicable" };
  if (!pushDeliveryEnabled) return { deliveryStatus: "not_sent_push_provider_disabled" };

  const activeDevices = devices.filter((device) => device.status !== "inactive" && isExpoPushToken(device.expoPushToken));
  if (!activeDevices.length) return { deliveryStatus: "not_sent_no_valid_expo_token" };

  try {
    const messages = activeDevices.map((device) => ({
      to: device.expoPushToken,
      title: evaluation.messageTitle,
      body: evaluation.messageBody,
      sound: "default",
      data: {
        type: "saved-route-alert",
        routeId: route.id,
        evaluationId: evaluation.id,
        stationCode: evaluation.stationCode,
        fuel: route.fuel,
      },
    }));
    const tickets = await sendExpoPushMessages(messages);
    const okTickets = tickets.filter((ticket) => ticket.status === "ok" && ticket.id);
    for (const ticket of tickets) {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        await updatePushDeviceStatus({
          deviceId: ticket.to,
          status: "inactive",
          invalidatedAt: evaluation.evaluatedAt,
        });
      }
    }
    if (!okTickets.length) {
      await updateRouteAlertDelivery({
        evaluationId: evaluation.id,
        pushReceiptStatus: "ticket_error",
      });
      return { deliveryStatus: "expo_ticket_error", pushTickets: tickets };
    }

    const pushTicketId = okTickets.map((ticket) => ticket.id).join(",");
    evaluation.pushTicketId = pushTicketId;
    await updateRouteAlertDelivery({ evaluationId: evaluation.id, pushTicketId });
    await updateSavedRouteLastAlert(route.id, evaluation.evaluatedAt);
    return { deliveryStatus: "sent_to_expo", pushTickets: tickets };
  } catch (error) {
    await updateRouteAlertDelivery({
      evaluationId: evaluation.id,
      pushReceiptStatus: "delivery_error",
    });
    return {
      deliveryStatus: "expo_delivery_failed",
      deliveryError: error instanceof Error ? error.message : "Expo push delivery failed",
    };
  }
}

async function runScheduledRouteAlertEvaluation({ limit = 50, now, ignoreWindow = false } = {}) {
  const evaluatedAt = validIsoDate(now) || new Date().toISOString();
  const routes = await listSavedRoutes({ enabledOnly: true, limit });
  const results = [];

  for (const route of routes) {
    if (!ignoreWindow && !routeAlertWindowDue(route, evaluatedAt)) {
      results.push({ routeId: route.id, status: "skipped", reason: "outside_alert_window" });
      continue;
    }
    const devices = await listPushDevices({ userId: route.userId, status: "active", limit: 20 });
    const scoredAlert = await scoreSavedRouteForAlert(route, evaluatedAt);
    const result = await evaluateSavedRouteAlert({
      route,
      devices,
      notificationPermission: devices.length ? "granted" : "unknown",
      candidate: scoredAlert.candidate,
      regionCapabilities: scoredAlert.regionCapabilities,
      now: evaluatedAt,
    });
    results.push({
      routeId: route.id,
      evaluationId: result.evaluation.id,
      status: result.evaluation.status,
      reason: result.evaluation.reason,
      deliveryStatus: result.deliveryStatus,
      scoringStatus: scoredAlert.status,
    });
  }

  return {
    accepted: true,
    mode: "scheduled_saved_route_alert_evaluation",
    evaluatedAt,
    routeCount: routes.length,
    evaluatedCount: results.filter((item) => item.evaluationId).length,
    skippedCount: results.filter((item) => item.status === "skipped").length,
    sentCount: results.filter((item) => item.deliveryStatus === "sent_to_expo").length,
    results,
    alerts: await alertsStatus(),
  };
}

async function scoreSavedRouteForAlert(route, evaluatedAt) {
  if (alertRouteScorerForTests) return alertRouteScorerForTests(route, evaluatedAt);

  const fallbackCapabilities = capabilitiesForPoints([route.from, route.to]);
  try {
    const plannedRoute = await buildRoute({ from: route.from, to: route.to });
    const routeForScore = {
      id: route.id,
      name: route.name,
      provider: plannedRoute.provider,
      defaultCorridorKm: 2.5,
      defaultDetourSpeedKmh: 80,
      points: plannedRoute.points || [route.from, route.to],
    };
    const data = await loadStationData({
      requestedSource: "live",
      points: routeForScore.points,
      fuels: [route.fuel],
    });
    const scored = scoreRoute({
      source: data.source,
      route: routeForScore,
      stations: data.stations,
      fuel: route.fuel,
      tankLitres: route.tankLitres || 55,
      tankPercent: route.tankPercent || 45,
      economy: route.economy || 8.2,
      reserveKm: route.reserveKm || 35,
      corridorKm: 2.5,
      eligibleDiscounts: new Set(route.eligibleDiscounts || []),
      includeMemberPrices: false,
      includeClosed: false,
    });
    const recommendation = scored.candidates[0];
    return {
      status: recommendation ? "scored" : "no_candidate",
      candidate: recommendation ? alertCandidateFromScore(recommendation, evaluatedAt) : {},
      context: scored.context,
      regionCapabilities: data.regionCapabilities || fallbackCapabilities,
    };
  } catch (error) {
    return {
      status: "failed",
      candidate: {},
      error: error instanceof Error ? error.message : "Route alert scoring failed",
      regionCapabilities: fallbackCapabilities,
    };
  }
}

function alertCandidateFromScore(recommendation, evaluatedAt) {
  const station = recommendation.station || {};
  return {
    stationCode: station.stationCode,
    stationName: station.name,
    estimatedSavingDollars: recommendation.netSaving,
    detourMinutes: recommendation.detourMinutes,
    freshnessMinutes: minutesSince(station.updatedAt, evaluatedAt),
    openNow: recommendation.openNow !== false && station.openNow !== false,
  };
}

async function checkPushReceipts({ limit = 100 } = {}) {
  const pending = await listPendingPushTicketEvaluations({ limit });
  const ids = pending.flatMap((evaluation) => String(evaluation.pushTicketId || "").split(",").map((id) => id.trim()).filter(Boolean));
  if (!ids.length) {
    return {
      accepted: true,
      checkedCount: 0,
      updatedCount: 0,
      receipts: {},
      alerts: await alertsStatus(),
    };
  }

  const receipts = await fetchExpoPushReceipts(ids);
  let updatedCount = 0;
  for (const evaluation of pending) {
    const ticketIds = String(evaluation.pushTicketId || "").split(",").map((id) => id.trim()).filter(Boolean);
    const statuses = ticketIds.map((id) => receiptStatus(receipts[id])).filter(Boolean);
    if (!statuses.length) continue;
    await updateRouteAlertDelivery({
      evaluationId: evaluation.id,
      pushReceiptStatus: [...new Set(statuses)].join(","),
    });
    updatedCount += 1;
  }

  return {
    accepted: true,
    checkedCount: ids.length,
    updatedCount,
    receipts,
    alerts: await alertsStatus(),
  };
}

function buildSavedRouteAlertEvaluation({
  route,
  devices = [],
  candidate = {},
  notificationPermission = "granted",
  regionCapabilities = [],
  now,
  pushDeliveryEnabled = false,
} = {}) {
  const evaluatedAt = validIsoDate(now) || new Date().toISOString();
  const capabilities = Array.isArray(regionCapabilities) && regionCapabilities.length
    ? regionCapabilities
    : capabilitiesForPoints([route.from, route.to]);
  const activeDevices = Array.isArray(devices) ? devices.filter((device) => device.status !== "inactive" && device.expoPushToken) : [];

  let status = "send_alert";
  let reason = "saving_above_threshold";
  if (!route.alertEnabled) [status, reason] = ["alert_disabled", "route_alert_disabled"];
  else if (route.pausedUntil && new Date(route.pausedUntil).getTime() > new Date(evaluatedAt).getTime()) [status, reason] = ["quiet_today", "route_paused"];
  else if (route.lastAlertSentAt && hoursBetween(route.lastAlertSentAt, evaluatedAt) < ALERT_DUPLICATE_COOLDOWN_HOURS) [status, reason] = ["quiet_today", "duplicate_cooldown"];
  else if (notificationPermission !== "granted") [status, reason] = ["permission_missing", "notification_permission_missing"];
  else if (!activeDevices.length) [status, reason] = ["missing_push_token", "no_active_push_device"];
  else if (capabilities.some((item) => item.capability === "unsupported")) [status, reason] = ["region_unsupported", "route_region_unsupported"];
  else if (capabilities.some((item) => item.capability === "pending_access")) [status, reason] = ["provider_access_pending", "route_provider_access_pending"];
  else if (!candidate.stationCode) [status, reason] = ["not_evaluated", "route_scoring_not_available"];
  else if (candidate.openNow === false) [status, reason] = ["station_closed", "candidate_station_closed"];
  else if (!Number.isFinite(optionalNumber(candidate.freshnessMinutes)) || optionalNumber(candidate.freshnessMinutes) > ALERT_FRESHNESS_MAX_MINUTES) [status, reason] = ["stale_price", "candidate_price_stale"];
  else if (!Number.isFinite(optionalNumber(candidate.estimatedSavingDollars)) || optionalNumber(candidate.estimatedSavingDollars) < route.minSavingDollars) [status, reason] = ["saving_below_threshold", "saving_below_route_threshold"];
  else if (Number.isFinite(optionalNumber(candidate.detourMinutes)) && optionalNumber(candidate.detourMinutes) > route.maxDetourMinutes) [status, reason] = ["detour_above_threshold", "detour_above_route_threshold"];

  return {
    id: `rae_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    routeId: route.id,
    userId: route.userId,
    status,
    reason,
    stationCode: cleanString(candidate.stationCode),
    stationName: cleanString(candidate.stationName),
    estimatedSavingDollars: optionalNumber(candidate.estimatedSavingDollars),
    detourMinutes: optionalNumber(candidate.detourMinutes),
    freshnessMinutes: optionalNumber(candidate.freshnessMinutes),
    messageTitle: status === "send_alert" ? "Fuel worth checking before your drive" : undefined,
    messageBody: status === "send_alert"
      ? `${route.fuel} is worth checking${candidate.stationName ? ` near ${candidate.stationName}` : ""} before your ${route.alertTimeLocal} drive.`
      : undefined,
    evaluatedAt,
    pushDeliveryEnabled,
    pushTicketId: undefined,
    pushReceiptStatus: undefined,
  };
}

function receiptStatus(receipt) {
  if (!receipt) return "";
  if (receipt.status === "ok") return "ok";
  if (receipt.status === "error") return receipt.details?.error || receipt.message || "error";
  return String(receipt.status || "");
}

function isExpoPushToken(value) {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(String(value || "").trim());
}

function routeAlertWindowDue(route, now) {
  const target = route.alertTimeLocal || "07:30";
  const local = localTimeParts(now, route.timezone || "Australia/Sydney");
  if (!local) return true;
  const [targetHour, targetMinute] = target.split(":").map(Number);
  const targetMinutes = targetHour * 60 + targetMinute;
  const localMinutes = local.hour * 60 + local.minute;
  const diff = Math.abs(localMinutes - targetMinutes);
  const wrappedDiff = Math.min(diff, 1440 - diff);
  const windowMinutes = boundedNumber(process.env.ALERT_SCHEDULE_WINDOW_MINUTES, 5, 720, 90);
  return wrappedDiff <= windowMinutes;
}

function localTimeParts(value, timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(value));
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { hour: hour === 24 ? 0 : hour, minute };
  } catch {
    return null;
  }
}

function normalisePushDevice(input) {
  const userId = requiredText(input.userId, "userId");
  const deviceId = requiredText(input.deviceId || input.id, "deviceId");
  const expoPushToken = requiredText(input.expoPushToken || input.pushToken, "expoPushToken");
  const platform = cleanString(input.platform || "unknown").slice(0, 30) || "unknown";
  const now = new Date().toISOString();
  return {
    id: `pd_${stableId(`${userId}:${deviceId}`)}`,
    userId,
    deviceId,
    platform,
    expoPushToken,
    appVersion: cleanString(input.appVersion).slice(0, 40),
    status: ["active", "inactive"].includes(input.status) ? input.status : "active",
    lastSeenAt: validIsoDate(input.lastSeenAt) || now,
    invalidatedAt: validIsoDate(input.invalidatedAt) || undefined,
  };
}

function normaliseBackendSavedRoute(input) {
  const userId = requiredText(input.userId, "userId");
  const id = cleanString(input.id) || `sr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const route = {
    id: id.slice(0, 80),
    userId,
    name: requiredText(input.name, "name").slice(0, 120),
    from: normaliseRoutePoint(input.from, "from"),
    to: normaliseRoutePoint(input.to, "to"),
    fuel: String(input.fuel || "").trim().toUpperCase(),
    alertEnabled: Boolean(input.alertEnabled),
    alertTimeLocal: normaliseAlertTime(input.alertTimeLocal || input.alertTime),
    timezone: cleanString(input.timezone || "Australia/Sydney").slice(0, 80),
    minSavingDollars: boundedNumber(input.minSavingDollars, 1, 100, 5),
    maxDetourMinutes: boundedNumber(input.maxDetourMinutes, 0, 60, 8),
    eligibleDiscounts: Array.isArray(input.eligibleDiscounts)
      ? input.eligibleDiscounts.map(cleanString).filter(Boolean).slice(0, 20)
      : [],
    tankLitres: boundedNumber(input.tankLitres, 20, 180, 55),
    tankPercent: boundedNumber(input.tankPercent, 1, 100, 45),
    economy: boundedNumber(input.economy, 2, 30, 8.2),
    reserveKm: boundedNumber(input.reserveKm, 0, 250, 35),
    pausedUntil: validIsoDate(input.pausedUntil) || undefined,
    lastAlertSentAt: validIsoDate(input.lastAlertSentAt) || undefined,
    createdAt: validIsoDate(input.createdAt) || now,
    updatedAt: now,
  };
  if (!["E10", "U91", "P95", "P98", "DL", "PDL", "LPG", "E85"].includes(route.fuel)) {
    throw new Error("fuel is not supported for saved-route alerts");
  }
  return route;
}

function normaliseRoutePoint(value, field) {
  const point = value || {};
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  if (!Number.isFinite(lat) || lat < -44 || lat > -9) throw new Error(`${field}.lat must be an Australian latitude`);
  if (!Number.isFinite(lon) || lon < 112 || lon > 154.5) throw new Error(`${field}.lon must be an Australian longitude`);
  return {
    lat,
    lon,
    label: cleanString(point.label || "Saved location").slice(0, 160),
  };
}

function normaliseAlertTime(value) {
  const text = cleanString(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "07:30";
}

function requiredText(value, field) {
  const text = cleanString(value);
  if (!text) throw new Error(`${field} is required`);
  return text;
}

function cleanString(value) {
  return String(value || "").trim();
}

function boundedNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function validIsoDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function hoursBetween(start, end) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return Infinity;
  return Math.abs(endMs - startMs) / 36e5;
}

function minutesSince(start, end) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

function stableId(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

async function predictionStatus() {
  const storage = predictionStorageStatus({ maxRecords: PREDICTION_BACKTEST_MAX_RECORDS });
  let records = [];
  let storageError = "";
  try {
    records = await listPredictionBacktestRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
  } catch (error) {
    storageError = error instanceof Error ? error.message : "Prediction storage is unavailable";
  }
  return {
    mode: "measurement_foundation",
    storage: {
      ...storage,
      recordCount: storageError ? storage.recordCount : records.length,
      health: storageError ? "error" : "ok",
      lastError: storageError,
    },
    writeSecurity: predictionWriteSecurity(),
    userFacingPredictionEnabled: false,
    accuracyClaimsAllowed: false,
    supportedSignalLabels: ["no_cycle_signal", "backtest_required"],
    summary: predictionBacktestSummary(records),
  };
}

function predictionSignal({ region = "", fuel = "", historyDays = 0, observedPriceCount = 0 } = {}) {
  const safeRegion = String(region || "").trim().toUpperCase();
  const safeFuel = String(fuel || "").trim().toUpperCase();
  const history = Number(historyDays || 0);
  const observed = Number(observedPriceCount || 0);
  const supportedFuel = ["E10", "U91", "P95", "P98", "DL", "PDL", "LPG", "E85"].includes(safeFuel);

  if (!REGION_ORDER.includes(safeRegion)) {
    return noCycleSignal({ region: safeRegion || "UNKNOWN", fuel: safeFuel, reason: "unsupported_region" });
  }
  if (!supportedFuel) {
    return noCycleSignal({ region: safeRegion, fuel: safeFuel || "UNKNOWN", reason: "unsupported_fuel" });
  }
  if (history < 28 || observed < 56) {
    return noCycleSignal({ region: safeRegion, fuel: safeFuel, reason: "sparse_history" });
  }

  return {
    region: safeRegion,
    fuel: safeFuel,
    signal: "backtest_required",
    confidence: "low",
    reasons: ["history threshold met, but measured back-test evidence is still required before guidance is enabled"],
    userFacingCopy: "No cycle guidance yet.",
    userFacingPredictionEnabled: false,
    accuracyClaimsAllowed: false,
  };
}

function noCycleSignal({ region, fuel, reason }) {
  const labels = {
    unsupported_region: "Fuel Path does not have cycle evidence for this region.",
    unsupported_fuel: "Fuel Path does not have cycle evidence for this fuel.",
    sparse_history: "Fuel Path needs more price history before showing cycle guidance.",
  };
  return {
    region,
    fuel,
    signal: "no_cycle_signal",
    confidence: "low",
    reasons: [labels[reason] || "Fuel Path does not have enough evidence for cycle guidance."],
    userFacingCopy: "No cycle signal.",
    userFacingPredictionEnabled: false,
    accuracyClaimsAllowed: false,
  };
}

function setAlertRouteScorerForTests(scorer) {
  alertRouteScorerForTests = typeof scorer === "function" ? scorer : null;
}

async function recordPredictionBacktest(input = {}) {
  const record = normalisePredictionBacktestRecord(input);
  await appendPredictionBacktestRecord(record, { maxRecords: PREDICTION_BACKTEST_MAX_RECORDS });
  const records = await listPredictionBacktestRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
  return {
    accepted: true,
    record,
    summary: predictionBacktestSummary(records),
    storage: (await predictionStatus()).storage,
  };
}

function normalisePredictionBacktestRecord(input) {
  const region = String(input.region || "").trim().toUpperCase();
  const fuel = String(input.fuel || "").trim().toUpperCase();
  const targetDate = normaliseDateOnly(input.targetDate);
  if (!REGION_ORDER.includes(region)) throw new Error("region must be NSW, ACT, QLD, WA, VIC, SA, TAS or NT");
  if (!["E10", "U91", "P95", "P98", "DL", "PDL", "LPG", "E85"].includes(fuel)) {
    throw new Error("fuel is not supported for prediction back-testing");
  }
  if (!targetDate) throw new Error("targetDate must be YYYY-MM-DD");

  const predictedCpl = optionalNumber(input.predictedCpl);
  const actualCpl = optionalNumber(input.actualCpl);
  const absoluteErrorCpl = Number.isFinite(predictedCpl) && Number.isFinite(actualCpl) ? round(Math.abs(predictedCpl - actualCpl), 2) : undefined;
  const predictedDirection = normaliseDirection(input.predictedDirection);
  const actualDirection = normaliseDirection(input.actualDirection);
  return {
    id: `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    region,
    fuel,
    targetDate,
    predictionDate: normaliseDateOnly(input.predictionDate) || new Date().toISOString().slice(0, 10),
    modelVersion: String(input.modelVersion || "manual-baseline").slice(0, 60),
    predictedCpl,
    actualCpl,
    absoluteErrorCpl,
    predictedDirection,
    actualDirection,
    directionMatched:
      predictedDirection !== "unknown" && actualDirection !== "unknown" ? predictedDirection === actualDirection : undefined,
    recordedAt: new Date().toISOString(),
  };
}

function predictionBacktestSummary(records = []) {
  const completed = records.filter((record) => Number.isFinite(record.absoluteErrorCpl));
  const mae =
    completed.length > 0
      ? round(
          completed.reduce((total, record) => total + Number(record.absoluteErrorCpl || 0), 0) / completed.length,
          2,
        )
      : undefined;
  const directionRecords = records.filter((record) => typeof record.directionMatched === "boolean");
  const directionAccuracy =
    directionRecords.length > 0
      ? round(directionRecords.filter((record) => record.directionMatched).length / directionRecords.length, 3)
      : undefined;
  const byRegion = {};
  for (const record of records) byRegion[record.region] = (byRegion[record.region] || 0) + 1;
  return {
    sampleSize: records.length,
    completedSampleSize: completed.length,
    meanAbsoluteErrorCpl: mae,
    directionSampleSize: directionRecords.length,
    directionAccuracy,
    byRegion,
    accuracyClaimsAllowed: false,
  };
}

async function listPredictionBacktests({ region = "", fuel = "", limit = 50 } = {}) {
  const safeRegion = String(region || "").trim().toUpperCase();
  const safeFuel = String(fuel || "").trim().toUpperCase();
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const records = await listPredictionBacktestRecords({ region: safeRegion, fuel: safeFuel, limit: safeLimit });
  return {
    records,
    summary: predictionBacktestSummary(records),
    storage: (await predictionStatus()).storage,
  };
}

function predictionWriteSecurity() {
  const tokenConfigured = Boolean(process.env.PREDICTION_BACKTEST_WRITE_TOKEN);
  const storage = predictionStorageStatus({ maxRecords: PREDICTION_BACKTEST_MAX_RECORDS });
  const tokenRequired = tokenConfigured || Boolean(storage.durable);
  return {
    tokenConfigured,
    tokenRequired,
    writeEnabled: !tokenRequired || tokenConfigured,
    acceptedHeaders: ["Authorization: Bearer <token>", "X-Fuel-Path-Prediction-Token"],
  };
}

function predictionWriteAuthorised(req = {}) {
  const security = predictionWriteSecurity();
  if (!security.tokenRequired) return true;
  if (!security.tokenConfigured) return false;
  const expected = process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
  const headers = req.headers || {};
  const auth = headers.authorization || headers.Authorization || "";
  const direct = headers["x-fuel-path-prediction-token"] || headers["X-Fuel-Path-Prediction-Token"] || "";
  const bearer = String(auth).replace(/^Bearer\s+/i, "").trim();
  return bearer === expected || String(direct).trim() === expected;
}

function normaliseDateOnly(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "" : text;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normaliseDirection(value) {
  const direction = String(value || "unknown").trim().toLowerCase();
  return ["up", "down", "flat", "unknown"].includes(direction) ? direction : "unknown";
}

module.exports = {
  alertsWriteAuthorised,
  alertsWriteSecurity,
  alertsStatus,
  boolParam,
  buildRoute,
  cacheSeconds,
  capabilitiesForPoints,
  capabilitySummary,
  checkPushReceipts,
  cronAuthorised,
  distanceKm,
  evaluateSavedRouteAlert,
  fuelProviderCapabilityMatrix,
  geocode,
  geocodeProviderStatus,
  hasAnyLiveCredentials,
  hasLiveCredentials,
  hasQldCredentials,
  hasSaCredentials,
  hasVicCredentials,
  hasWaProvider,
  loadStationData,
  loadLiveSaStations,
  loadLiveWaStations,
  liveProviderKeysForArea,
  methodAllowed,
  normaliseQldPayload,
  normaliseSaPayload,
  normaliseWaFuelWatchPayloads,
  numberParam,
  listPredictionBacktests,
  listBackendAlertEvaluations,
  listBackendPushDevices,
  listBackendSavedRoutes,
  pointInAct,
  pointFromQuery,
  pointInNt,
  pointInSa,
  pointInTas,
  pointInVic,
  predictionSignal,
  predictionStatus,
  predictionWriteAuthorised,
  predictionWriteSecurity,
  registerPushDevice,
  recordPredictionBacktest,
  routeContextStations,
  routeFromPayload,
  routeProviderStatus,
  runScheduledRouteAlertEvaluation,
  saveBackendSavedRoute,
  scoreRoute,
  sendJson,
  setAlertRouteScorerForTests,
  setAlertStorageForTests,
  setPredictionStorageForTests,
  setParam,
  stationPayload,
  stringParam,
  waFuelWatchRequestPlan,
  waRegionPlanForArea,
  waTomorrowPriceAvailable,
};
