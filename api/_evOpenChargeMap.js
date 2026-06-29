const { distanceKm } = require("./_geoMath");

const DEFAULT_BASE_URL = "https://api.openchargemap.io/v3";
const DEFAULT_CACHE_SECONDS = 900;
const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";

const CONNECTOR_ALIASES = {
  CCS2: ["ccs", "ccs type 2", "combo ccs", "iec 62196-3", "type 2 combo"],
  CHADEMO: ["chademo"],
  TYPE2: ["type 2", "iec 62196-2", "mennekes"],
  TESLA: ["tesla", "nacs", "north american charging standard"],
  NACS: ["nacs", "north american charging standard", "tesla"],
};

function createOpenChargeMapAdapter({ fetchJson = defaultFetchJson } = {}) {
  const cache = {
    key: "",
    chargers: null,
    loadedAtMs: 0,
    lastError: "",
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
      return evProviderResult({
        chargers: cache.chargers,
        centre: { lat, lon, label: centre?.label || "Map centre" },
        radiusKm: safeRadiusKm,
        filters,
        cacheHit: true,
        cacheAgeSeconds: Math.round(ageMs / 1000),
        cacheMode: "fresh",
      });
    }

    const baseUrl = String(process.env.OPEN_CHARGE_MAP_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    if (!process.env.OPEN_CHARGE_MAP_API_KEY) {
      return evProviderResult({
        chargers: [],
        centre: { lat, lon, label: centre?.label || "Map centre" },
        radiusKm: safeRadiusKm,
        filters,
        cacheHit: false,
        cacheAgeSeconds: 0,
        cacheMode: "not_configured",
        degraded: true,
        warning:
          "Open Charge Map API key is not configured yet. EV charger search is wired for prototype use, but live charger data is disabled until the server key is added.",
      });
    }
    const providerLimit = Math.max(safeLimit * 3, 60);
    const url = `${baseUrl}/poi/?${new URLSearchParams({
      output: "json",
      countrycode: "AU",
      latitude: String(lat),
      longitude: String(lon),
      distance: String(safeRadiusKm),
      distanceunit: "KM",
      maxresults: String(Math.min(providerLimit, 300)),
      compact: "true",
      verbose: "false",
    }).toString()}`;

    const payload = await fetchJson(url, {
      headers: providerHeaders(),
      timeoutMs: providerTimeoutMs(),
    });
    const chargers = normaliseOpenChargeMapPayload(payload, {
      centre: { lat, lon, label: centre?.label || "Map centre" },
      radiusKm: safeRadiusKm,
      filters,
    }).slice(0, safeLimit);

    cache.key = cacheKey;
    cache.chargers = chargers;
    cache.loadedAtMs = Date.now();
    cache.lastError = "";

    return evProviderResult({
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
    normaliseOpenChargeMapPayload,
  };
}

function unsupportedEvProviderResult({ provider, centre, radiusKm = 8, filters = {} } = {}) {
  const providerLabel = evProviderLabel(provider);
  return {
    context: {
      provider,
      source: provider,
      capability: "pending_commercial_access",
      radiusKm,
      centre,
      filters,
      chargerCount: 0,
      returnedCount: 0,
      generatedAt: new Date().toISOString(),
      cacheHit: false,
      cacheAgeSeconds: 0,
      cacheMode: "not_configured",
      degraded: true,
      provenance: {
        source: provider,
        label: `${providerLabel} EV charger data`,
        licence: "commercial terms required",
        realTimeAvailability: false,
      },
      warning: `${providerLabel} is a candidate EV provider, but commercial access, pricing, licence terms and schema are not approved yet.`,
    },
    chargers: [],
  };
}

function supportedEvProviders() {
  return [
    {
      id: "open_charge_map",
      label: "Open Charge Map",
      status: "prototype_not_configured",
      pricing: "open/free API path, API key required",
      nextAction: "Create an Open Charge Map API key if the service recovers, or use only as a fallback prototype source.",
    },
    {
      id: "openweb_ninja",
      label: "OpenWeb Ninja EV Charge Finder",
      status: "wired_trial_candidate",
      pricing: "visible free tier and low-cost monthly plans; live Australian coverage still needs recheck",
      nextAction: "Configure OPENWEB_NINJA_API_KEY in a non-production trial or production enrichment slot, then rerun AU/NT rural coverage smoke.",
    },
    {
      id: "api_ninjas",
      label: "API Ninjas EV Charger API",
      status: "cheap_trial_candidate",
      pricing: "free key path with paid tiers for higher usage/features, coverage still unverified",
      nextAction: "Create a trial key, test AU/NT radius search quality and confirm availability/pricing field meanings.",
    },
    {
      id: "plugshare",
      label: "PlugShare",
      status: "pricing_required",
      pricing: "sales/contact-gated commercial API pricing",
      nextAction: "Request quote, Australia/NT coverage, live status terms, cache/rate limits and route-recommendation rights.",
    },
    {
      id: "here",
      label: "HERE EV Charge Points",
      status: "pricing_required",
      pricing: "HERE platform pricing/sales-gated for EV charge-point product usage",
      nextAction: "Request EV charge-point API pricing and Australian EVSE/status coverage.",
    },
    {
      id: "mapbox",
      label: "Mapbox Charge Finder",
      status: "pricing_required",
      pricing: "commercial/private-preview style product access, pricing requires confirmation",
      nextAction: "Confirm access, Australian coverage, EVSE/status fields, cache terms and route-recommendation rights.",
    },
    {
      id: "tomtom",
      label: "TomTom EV Charging Stations Availability",
      status: "pricing_required",
      pricing: "public developer pricing exists, EV availability usage needs plan confirmation",
      nextAction: "Confirm EV availability API pricing, connector/power fields and whether station directory data is included.",
    },
    {
      id: "network_partner",
      label: "Chargefox/Evie network partner",
      status: "partnership_required",
      pricing: "network-specific partnership or fleet/customer API access",
      nextAction: "Pursue only after national provider choice, or for direct network status enrichment.",
    },
  ];
}

function evProviderResult({
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
      provider: "open_charge_map",
      source: "open_charge_map",
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
        source: "open_charge_map",
        label: "Charger data from Open Charge Map",
        licence: "CC BY 4.0",
        realTimeAvailability: false,
      },
      warning:
        warning ||
        "Prototype EV charger data from Open Charge Map. Availability and pricing may be incomplete; confirm in the charging network app before driving.",
    },
    chargers,
  };
}

function evProviderLabel(provider) {
  if (provider === "openweb_ninja") return "OpenWeb Ninja EV Charge Finder";
  if (provider === "api_ninjas") return "API Ninjas EV Charger API";
  if (provider === "plugshare") return "PlugShare";
  if (provider === "here") return "HERE EV Charge Points";
  if (provider === "mapbox") return "Mapbox Charge Finder";
  if (provider === "tomtom") return "TomTom EV Charging Stations Availability";
  if (provider === "network_partner") return "Chargefox/Evie network partner";
  return "Open Charge Map";
}

function normaliseOpenChargeMapPayload(payload, { centre, radiusKm = 8, filters = {} } = {}) {
  const rows = Array.isArray(payload) ? payload : [];
  return rows
    .map((row) => normaliseOpenChargeMapCharger(row, centre))
    .filter(Boolean)
    .filter((charger) => charger.distanceKm <= radiusKm)
    .filter((charger) => chargerMatchesFilters(charger, filters))
    .sort((left, right) => {
      const leftPower = Number(left.maxPowerKw || 0);
      const rightPower = Number(right.maxPowerKw || 0);
      return rightPower - leftPower || left.distanceKm - right.distanceKm;
    });
}

function normaliseOpenChargeMapCharger(row, centre) {
  const address = row?.AddressInfo || {};
  const lat = Number(address.Latitude);
  const lon = Number(address.Longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const connections = Array.isArray(row?.Connections)
    ? row.Connections.map(normaliseConnection).filter(Boolean)
    : [];
  if (!connections.length) return null;
  const maxPowerKw = connections.reduce((max, item) => Math.max(max, Number(item.powerKw || 0)), 0);
  const status = availabilityStatus(row, connections);
  const distance = centre ? distanceKm(centre, { lat, lon }) : Number(address.Distance || 0);
  return {
    id: `OCM-${row.ID || address.ID || `${lat},${lon}`}`,
    name: String(address.Title || row?.OperatorInfo?.Title || "EV charger"),
    operator: String(row?.OperatorInfo?.Title || "Unknown operator"),
    address: [address.AddressLine1, address.Town, address.StateOrProvince, address.Postcode]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(", "),
    suburb: String(address.Town || ""),
    lat,
    lon,
    distanceKm: round(distance, 2),
    detourMinutes: round((distance * 2 / 45) * 60, 1),
    connectors: unique(connections.flatMap((item) => item.connector ? [item.connector] : [])),
    connections,
    maxPowerKw: maxPowerKw || undefined,
    powerBand: powerBand(maxPowerKw),
    availability: status.availability,
    availabilityLabel: status.label,
    pricing: cleanText(row?.UsageCost),
    updatedAt: normaliseTimestamp(row?.DateLastStatusUpdate || row?.DateLastVerified),
    source: "open_charge_map",
    provenance: "Charger data from Open Charge Map (CC BY 4.0). Confirm availability and pricing with the charging network before driving.",
  };
}

function normaliseConnection(connection) {
  const title = cleanText(connection?.ConnectionType?.Title || connection?.ConnectionType?.FormalName);
  const powerKw = Number(connection?.PowerKW || 0);
  const currentType = cleanText(connection?.CurrentType?.Title);
  const statusTitle = cleanText(connection?.StatusType?.Title);
  const operational = connection?.StatusType?.IsOperational;
  return {
    connector: canonicalConnector(title),
    connectorLabel: title || "Unknown connector",
    powerKw: Number.isFinite(powerKw) && powerKw > 0 ? powerKw : undefined,
    currentType,
    quantity: Number(connection?.Quantity || 1),
    status: statusTitle,
    operational: typeof operational === "boolean" ? operational : undefined,
  };
}

function availabilityStatus(row, connections) {
  const rowStatus = cleanText(row?.StatusType?.Title);
  const operationalFlags = connections
    .map((item) => item.operational)
    .filter((item) => typeof item === "boolean");
  if (operationalFlags.length && operationalFlags.every(Boolean)) {
    return { availability: "unknown", label: "Listed operational, live bay status unknown" };
  }
  if (operationalFlags.length && operationalFlags.every((item) => !item)) {
    return { availability: "unavailable", label: "Marked unavailable by source" };
  }
  if (/operational/i.test(rowStatus)) return { availability: "unknown", label: "Listed operational, live bay status unknown" };
  return { availability: "unknown", label: "Live bay status unknown" };
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

function powerBand(powerKw) {
  const power = Number(powerKw || 0);
  if (power >= 150) return "ultra_fast";
  if (power >= 50) return "dc_fast";
  if (power > 0) return "ac";
  return "unknown";
}

function providerHeaders() {
  return {
    ...(process.env.OPEN_CHARGE_MAP_API_KEY ? { "X-API-Key": process.env.OPEN_CHARGE_MAP_API_KEY } : {}),
  };
}

async function defaultFetchJson(url, { headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
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
      throw new Error(`Provider returned ${response.status}: ${payload?.message || response.statusText}`);
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

function normaliseTimestamp(value) {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

module.exports = {
  createOpenChargeMapAdapter,
  normaliseOpenChargeMapPayload,
  supportedEvProviders,
  unsupportedEvProviderResult,
};
