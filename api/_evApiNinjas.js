const { distanceKm } = require("./_geoMath");

const DEFAULT_BASE_URL = "https://api.api-ninjas.com/v1/evcharger";
const DEFAULT_CACHE_SECONDS = 900;

const CONNECTOR_ALIASES = {
  CCS2: ["ccs", "ccs type 2", "combo ccs", "iec 62196-3", "type 2 combo"],
  CHADEMO: ["chademo"],
  TYPE2: ["type 2", "iec 62196-2", "mennekes"],
  TESLA: ["tesla", "nacs", "north american charging standard"],
  NACS: ["nacs", "north american charging standard", "tesla"],
};

function createApiNinjasAdapter({ fetchJson = defaultFetchJson } = {}) {
  const cache = {
    key: "",
    chargers: null,
    loadedAtMs: 0,
  };

  async function loadEvChargers({
    centre,
    radiusKm = 8,
    limit = 80,
    connectors = [],
    minPowerKw = 0,
    powerMode = "",
    forceRefresh = false,
  } = {}) {
    const lat = Number(centre?.lat);
    const lon = Number(centre?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("centre lat/lon is required");

    const safeRadiusKm = Math.max(1, Math.min(50, Number(radiusKm) || 8));
    const safeLimit = Math.max(1, Math.min(120, Math.round(Number(limit) || 80)));
    const filters = normaliseEvFilters({ connectors, minPowerKw, powerMode });
    const cacheKey = JSON.stringify({
      lat: round(lat, 3),
      lon: round(lon, 3),
      radiusKm: safeRadiusKm,
      limit: safeLimit,
      filters,
    });
    const ageMs = Date.now() - cache.loadedAtMs;
    const ttlMs = cacheSeconds() * 1000;

    if (!forceRefresh && cache.chargers && cache.key === cacheKey && ageMs < ttlMs) {
      return apiNinjasResult({
        chargers: cache.chargers,
        centre: { lat, lon, label: centre?.label || "Map centre" },
        radiusKm: safeRadiusKm,
        filters,
        cacheHit: true,
        cacheAgeSeconds: Math.round(ageMs / 1000),
        cacheMode: "fresh",
      });
    }

    if (!process.env.API_NINJAS_API_KEY) {
      return apiNinjasResult({
        chargers: [],
        centre: { lat, lon, label: centre?.label || "Map centre" },
        radiusKm: safeRadiusKm,
        filters,
        cacheHit: false,
        cacheAgeSeconds: 0,
        cacheMode: "not_configured",
        degraded: true,
        warning:
          "API Ninjas EV Charger API key is not configured yet. EV charger search can use this cheap trial provider after server-side configuration.",
      });
    }

    const baseUrl = String(process.env.API_NINJAS_EV_CHARGER_API_BASE_URL || DEFAULT_BASE_URL);
    const url = new URL(baseUrl);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("distance", String(safeRadiusKm));

    const payload = await fetchJson(url.toString(), {
      headers: {
        "X-Api-Key": process.env.API_NINJAS_API_KEY,
      },
      timeoutMs: providerTimeoutMs(),
    });
    const chargers = normaliseApiNinjasPayload(payload, {
      centre: { lat, lon, label: centre?.label || "Map centre" },
      radiusKm: safeRadiusKm,
      filters,
    }).slice(0, safeLimit);

    cache.key = cacheKey;
    cache.chargers = chargers;
    cache.loadedAtMs = Date.now();

    return apiNinjasResult({
      chargers,
      centre: { lat, lon, label: centre?.label || "Map centre" },
      radiusKm: safeRadiusKm,
      filters,
      cacheHit: false,
      cacheAgeSeconds: 0,
      cacheMode: "refreshed",
    });
  }

  return {
    loadEvChargers,
    normaliseApiNinjasPayload,
  };
}

function apiNinjasResult({
  chargers,
  centre,
  radiusKm,
  filters,
  cacheHit,
  cacheAgeSeconds,
  cacheMode,
  degraded = false,
  warning = "",
}) {
  return {
    context: {
      provider: "api_ninjas",
      source: "api_ninjas",
      capability: "prototype",
      radiusKm,
      centre,
      filters,
      chargerCount: chargers.length,
      returnedCount: chargers.length,
      generatedAt: new Date().toISOString(),
      cacheHit,
      cacheAgeSeconds,
      cacheMode,
      degraded,
      provenance: {
        source: "api_ninjas",
        label: "Charger data from API Ninjas EV Charger API",
        licence: "API Ninjas terms",
        realTimeAvailability: false,
      },
      warning:
        warning ||
        "Prototype EV charger directory data from API Ninjas. Power, tariff and live bay availability may be incomplete; confirm in the charging network app before driving.",
    },
    chargers,
  };
}

function normaliseApiNinjasPayload(payload, { centre, radiusKm = 8, filters = {} } = {}) {
  const rows = Array.isArray(payload) ? payload : [];
  return rows
    .map((row) => normaliseApiNinjasCharger(row, centre))
    .filter(Boolean)
    .filter((charger) => charger.distanceKm <= radiusKm)
    .filter((charger) => chargerMatchesFilters(charger, filters))
    .sort((left, right) => left.distanceKm - right.distanceKm);
}

function normaliseApiNinjasCharger(row, centre) {
  const lat = Number(row?.latitude);
  const lon = Number(row?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const connections = Array.isArray(row?.connections)
    ? row.connections.map(normaliseConnection).filter(Boolean)
    : [];
  if (!connections.length) return null;

  const distance = centre ? distanceKm(centre, { lat, lon }) : 0;
  const active = row?.is_active;
  return {
    id: `API_NINJAS-${cleanText(row?.name) || `${lat},${lon}`}`,
    name: cleanText(row?.name) || "EV charger",
    operator: "Unknown operator",
    address: [row?.address, row?.city, row?.region, row?.country]
      .map((item) => cleanText(item))
      .filter(Boolean)
      .join(", "),
    suburb: cleanText(row?.city),
    lat,
    lon,
    distanceKm: round(distance, 2),
    detourMinutes: round((distance * 2 / 45) * 60, 1),
    connectors: unique(connections.flatMap((item) => item.connector && item.connector !== "UNKNOWN" ? [item.connector] : [])),
    connections,
    maxPowerKw: undefined,
    powerBand: powerBand(connections),
    availability: active === false ? "unavailable" : "unknown",
    availabilityLabel: active === false ? "Marked inactive by source" : "Listed active, live bay status unknown",
    pricing: undefined,
    updatedAt: undefined,
    source: "api_ninjas",
    provenance: "Charger data from API Ninjas EV Charger API. Confirm availability, power and pricing with the charging network before driving.",
  };
}

function normaliseConnection(connection) {
  const title = cleanText(connection?.type_name || connection?.type_official);
  const level = Number(connection?.level || 0);
  return {
    connector: canonicalConnector(`${connection?.type_name || ""} ${connection?.type_official || ""}`),
    connectorLabel: title || "Unknown connector",
    powerKw: undefined,
    currentType: level >= 3 ? "DC" : level > 0 ? "AC" : "",
    quantity: Number(connection?.num_connectors || 1),
    status: "",
    operational: undefined,
  };
}

function normaliseEvFilters({ connectors = [], minPowerKw = 0, powerMode = "" } = {}) {
  const connectorList = Array.isArray(connectors)
    ? connectors
    : String(connectors || "").split(",");
  return {
    connectors: unique(connectorList.map(canonicalConnector).filter((item) => item && item !== "UNKNOWN")),
    minPowerKw: Math.max(0, Number(minPowerKw) || 0),
    powerMode: ["ac", "dc_fast", "ultra_fast"].includes(String(powerMode || "")) ? String(powerMode) : "",
  };
}

function chargerMatchesFilters(charger, filters) {
  if (filters.connectors?.length && !charger.connectors.some((item) => filters.connectors.includes(item))) return false;
  if (filters.minPowerKw) return false;
  if (filters.powerMode === "ac" && !charger.connections.some((item) => item.currentType === "AC")) return false;
  if (filters.powerMode === "dc_fast" && !charger.connections.some((item) => item.currentType === "DC")) return false;
  if (filters.powerMode === "ultra_fast") return false;
  return true;
}

function canonicalConnector(value) {
  const text = String(value || "").toLowerCase();
  const compact = text.replace(/[^a-z0-9]/g, "");
  for (const canonical of Object.keys(CONNECTOR_ALIASES)) {
    if (compact === canonical.toLowerCase()) return canonical;
  }
  for (const [canonical, aliases] of Object.entries(CONNECTOR_ALIASES)) {
    if (aliases.some((alias) => text.includes(alias))) return canonical;
  }
  return "UNKNOWN";
}

function powerBand(connections) {
  if (connections.some((item) => item.currentType === "DC")) return "dc_fast";
  if (connections.some((item) => item.currentType === "AC")) return "ac";
  return "unknown";
}

async function defaultFetchJson(url, { headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Provider returned non-JSON response: ${text.slice(0, 120)}`);
    }
    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}: ${payload?.message || payload?.error || response.statusText}`);
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
  return Math.max(300, Number(process.env.FUEL_PATH_EV_CACHE_SECONDS || DEFAULT_CACHE_SECONDS));
}

function providerTimeoutMs() {
  return Math.max(3000, Number(process.env.FUEL_PATH_EV_PROVIDER_TIMEOUT_MS || 12000));
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

module.exports = {
  createApiNinjasAdapter,
  normaliseApiNinjasPayload,
};
