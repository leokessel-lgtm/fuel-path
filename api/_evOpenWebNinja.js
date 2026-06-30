const { distanceKm } = require("./_geoMath");

const DEFAULT_BASE_URL = "https://api.openwebninja.com/ev-charge-finder/search-by-location";
const DEFAULT_CACHE_SECONDS = 900;

const CONNECTOR_ALIASES = {
  CCS2: ["ccs", "ccs type 2", "combo ccs", "iec 62196-3", "type 2 combo"],
  CHADEMO: ["chademo"],
  TYPE2: ["type 2", "iec 62196-2", "mennekes"],
  TESLA: ["tesla", "nacs", "north american charging standard"],
  NACS: ["nacs", "north american charging standard", "tesla"],
};

function createOpenWebNinjaAdapter({ fetchJson = defaultFetchJson } = {}) {
  const cache = {
    chargers: null,
    key: "",
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

    const safeRadiusKm = Math.max(1, Math.min(100, Number(radiusKm) || 8));
    const safeLimit = Math.max(1, Math.min(120, Math.round(Number(limit) || 80)));
    const filters = normaliseEvFilters({ connectors, minPowerKw, powerMode });
    const searchText = centre?.label || `${lat},${lon}`;
    const cacheKey = JSON.stringify({
      filters,
      limit: safeLimit,
      near: searchText.toLowerCase(),
      radiusKm: safeRadiusKm,
    });
    const ageMs = Date.now() - cache.loadedAtMs;
    const ttlMs = cacheSeconds() * 1000;

    if (!forceRefresh && cache.chargers && cache.key === cacheKey && ageMs < ttlMs) {
      return openWebNinjaResult({
        cacheAgeSeconds: Math.round(ageMs / 1000),
        cacheHit: true,
        cacheMode: "fresh",
        centre: { lat, lon, label: centre?.label || "Map centre" },
        chargers: cache.chargers,
        filters,
        radiusKm: safeRadiusKm,
      });
    }

    if (!process.env.OPENWEB_NINJA_API_KEY) {
      return openWebNinjaResult({
        cacheAgeSeconds: 0,
        cacheHit: false,
        cacheMode: "not_configured",
        centre: { lat, lon, label: centre?.label || "Map centre" },
        chargers: [],
        degraded: true,
        filters,
        radiusKm: safeRadiusKm,
        warning:
          "OpenWeb Ninja EV Charge Finder key is not configured. Add OPENWEB_NINJA_API_KEY to trial this enrichment source.",
      });
    }

    const url = new URL(String(process.env.OPENWEB_NINJA_EV_CHARGE_API_BASE_URL || DEFAULT_BASE_URL));
    url.searchParams.set("near", searchText);

    const payload = await fetchJson(url.toString(), {
      headers: {
        "X-API-Key": process.env.OPENWEB_NINJA_API_KEY,
      },
      timeoutMs: providerTimeoutMs(),
    });
    const chargers = normaliseOpenWebNinjaPayload(payload, {
      centre: { lat, lon, label: centre?.label || "Map centre" },
      filters,
      radiusKm: safeRadiusKm,
    }).slice(0, safeLimit);

    cache.chargers = chargers;
    cache.key = cacheKey;
    cache.loadedAtMs = Date.now();

    return openWebNinjaResult({
      cacheAgeSeconds: 0,
      cacheHit: false,
      cacheMode: "refreshed",
      centre: { lat, lon, label: centre?.label || "Map centre" },
      chargers,
      filters,
      radiusKm: safeRadiusKm,
    });
  }

  return { loadEvChargers, normaliseOpenWebNinjaPayload };
}

function openWebNinjaResult({
  cacheAgeSeconds,
  cacheHit,
  cacheMode,
  centre,
  chargers,
  degraded = false,
  filters,
  radiusKm,
  warning = "",
}) {
  return {
    context: {
      provider: "openweb_ninja",
      source: "openweb_ninja",
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
        source: "openweb_ninja",
        label: "Charger data from OpenWeb Ninja EV Charge Finder",
        licence: "OpenWeb Ninja terms",
        realTimeAvailability: false,
      },
      warning:
        warning ||
        "Prototype EV charger directory data from OpenWeb Ninja. Power, tariff and live bay availability may be incomplete; confirm in the charging network app before driving.",
    },
    chargers,
  };
}

function normaliseOpenWebNinjaPayload(payload, { centre, radiusKm = 8, filters = {} } = {}) {
  const rows = extractRows(payload);
  return rows
    .map((row) => normaliseOpenWebNinjaCharger(row, centre))
    .filter(Boolean)
    .filter((charger) => charger.distanceKm <= radiusKm)
    .filter((charger) => chargerMatchesFilters(charger, filters))
    .sort((left, right) => left.distanceKm - right.distanceKm);
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.charging_stations)) return payload.charging_stations;
  if (Array.isArray(payload?.stations)) return payload.stations;
  return [];
}

function normaliseOpenWebNinjaCharger(row, centre) {
  const lat = firstNumber(row?.latitude, row?.lat, row?.location?.lat, row?.location?.latitude, row?.coordinates?.lat);
  const lon = firstNumber(row?.longitude, row?.lon, row?.lng, row?.location?.lon, row?.location?.lng, row?.location?.longitude, row?.coordinates?.lon, row?.coordinates?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const connections = normaliseConnections(row);
  const distance = centre ? distanceKm(centre, { lat, lon }) : Number(row?.distance_km || row?.distance || 0);
  const maxPowerKw = connections.reduce((max, item) => Math.max(max, Number(item.powerKw || 0)), 0);
  return {
    id: `OPENWEB_NINJA-${cleanText(row?.id || row?.place_id || row?.name || row?.title) || `${lat},${lon}`}`,
    name: cleanText(row?.name || row?.title || row?.station_name) || "EV charger",
    operator: cleanText(row?.operator || row?.network || row?.provider) || "Unknown operator",
    address: cleanAddress(row),
    suburb: cleanText(row?.city || row?.suburb || row?.town),
    lat,
    lon,
    distanceKm: round(distance, 2),
    detourMinutes: round((distance * 2 / 45) * 60, 1),
    connectors: unique(connections.flatMap((item) => item.connector && item.connector !== "UNKNOWN" ? [item.connector] : [])),
    connections,
    maxPowerKw: maxPowerKw || undefined,
    powerBand: powerBand(maxPowerKw, connections),
    availability: "unknown",
    availabilityLabel: "Listed by source, live bay status unknown",
    pricing: cleanText(row?.pricing || row?.usage_cost || row?.cost),
    updatedAt: cleanText(row?.updated_at || row?.last_updated),
    source: "openweb_ninja",
    provenance: "Charger data from OpenWeb Ninja EV Charge Finder. Confirm availability, power and pricing with the charging network before driving.",
  };
}

function normaliseConnections(row) {
  const rawConnections = Array.isArray(row?.connections)
    ? row.connections
    : Array.isArray(row?.connectors)
      ? row.connectors
      : Array.isArray(row?.ports)
        ? row.ports
        : [];
  const connections = rawConnections.map(normaliseConnection).filter(Boolean);
  if (connections.length) return connections;
  const connector = canonicalConnector(row?.connector || row?.connector_type || row?.plug_type);
  if (!connector || connector === "UNKNOWN") return [];
  return [{
    connector,
    connectorLabel: cleanText(row?.connector || row?.connector_type || row?.plug_type) || connector,
    currentType: "",
    powerKw: firstNumber(row?.power_kw, row?.power, row?.kw),
    quantity: 1,
    status: "",
    operational: undefined,
  }];
}

function normaliseConnection(connection) {
  const label = cleanText(connection?.type || connection?.name || connection?.connector || connection?.connector_type || connection?.plug_type);
  const powerKw = firstNumber(connection?.power_kw, connection?.powerKw, connection?.power, connection?.kw);
  return {
    connector: canonicalConnector(label),
    connectorLabel: label || "Unknown connector",
    currentType: cleanText(connection?.current_type || connection?.currentType),
    powerKw: Number.isFinite(powerKw) && powerKw > 0 ? powerKw : undefined,
    quantity: Number(connection?.quantity || connection?.count || connection?.num_connectors || 1),
    status: cleanText(connection?.status),
    operational: typeof connection?.operational === "boolean" ? connection.operational : undefined,
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
  if (filters.minPowerKw && Number(charger.maxPowerKw || 0) < filters.minPowerKw) return false;
  if (filters.powerMode === "ac" && Number(charger.maxPowerKw || 0) >= 50) return false;
  if (filters.powerMode === "dc_fast" && Number(charger.maxPowerKw || 0) < 50) return false;
  if (filters.powerMode === "ultra_fast" && Number(charger.maxPowerKw || 0) < 150) return false;
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
  return cleanText(value).toUpperCase() || "UNKNOWN";
}

function powerBand(powerKw, connections = []) {
  const power = Number(powerKw || 0);
  if (power >= 150) return "ultra_fast";
  if (power >= 50) return "dc_fast";
  if (power > 0) return "ac";
  if (connections.some((item) => /dc/i.test(item.currentType))) return "dc_fast";
  if (connections.some((item) => /ac/i.test(item.currentType))) return "ac";
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
      throw new Error(`Provider returned ${response.status}: ${providerErrorMessage(payload, response.statusText)}`);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Provider request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function providerErrorMessage(payload, fallback = "Unknown error") {
  const raw = payload?.message || payload?.error || payload?.detail || fallback;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    return raw.message || raw.detail || raw.code || JSON.stringify(raw).slice(0, 160);
  }
  return String(raw || fallback);
}

function cacheSeconds() {
  return Math.max(300, Number(process.env.FUEL_PATH_EV_CACHE_SECONDS || DEFAULT_CACHE_SECONDS));
}

function providerTimeoutMs() {
  return Math.max(3000, Number(process.env.FUEL_PATH_EV_PROVIDER_TIMEOUT_MS || 12000));
}

function cleanAddress(row) {
  const structured = [row?.address, row?.street, row?.city || row?.suburb || row?.town, row?.state || row?.region, row?.postcode || row?.postal_code]
    .map((item) => cleanText(item))
    .filter(Boolean)
    .join(", ");
  return structured || cleanText(row?.formatted_address || row?.vicinity);
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
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
  createOpenWebNinjaAdapter,
  normaliseOpenWebNinjaPayload,
};
