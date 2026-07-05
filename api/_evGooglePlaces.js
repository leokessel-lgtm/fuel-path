const { distanceKm } = require("./_geoMath");
const {
  geocodeQuotaStorageStatus,
  reserveGeocodeQuota,
  getGeocodeQuotaUsage,
} = require("./_geocodeQuotaStorage");
const { googlePlacesApiKey } = require("./_providerCredentials");

const DEFAULT_BASE_URL = "https://places.googleapis.com/v1";
const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";

const CONNECTOR_MAP = {
  EV_CONNECTOR_TYPE_CCS_COMBO_2: "CCS2",
  EV_CONNECTOR_TYPE_CHADEMO: "CHADEMO",
  EV_CONNECTOR_TYPE_TYPE_2: "TYPE2",
  EV_CONNECTOR_TYPE_TESLA: "TESLA",
  EV_CONNECTOR_TYPE_NACS: "NACS",
};

function createGooglePlacesEvAdapter({ fetchJson = defaultFetchJson } = {}) {
  async function loadEvChargers({
    centre,
    radiusKm = 8,
    limit = 80,
    connectors = [],
    minPowerKw = 0,
    powerMode = "",
  } = {}) {
    const lat = Number(centre?.lat);
    const lon = Number(centre?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("centre lat/lon is required");
    if (process.env.FUEL_PATH_GOOGLE_PLACES_EV_ENABLED !== "1" || !googlePlacesEvApiKey()) {
      return googlePlacesEvResult({
        chargers: [],
        centre: { lat, lon, label: centre?.label || "Map centre" },
        radiusKm,
        filters: { connectors, minPowerKw, powerMode },
        cacheMode: "not_configured",
        degraded: true,
        warning:
          "Google Places EV charging is a trial candidate but is disabled until terms, budget controls and server-side key use are approved.",
      });
    }

    const safeRadiusKm = Math.max(1, Math.min(50, Number(radiusKm) || 8));
    const safeLimit = Math.max(1, Math.min(80, Math.round(Number(limit) || 80)));
    const filters = { connectors, minPowerKw, powerMode };
    await assertGooglePlacesEvAllowed();
    const baseUrl = String(process.env.GOOGLE_PLACES_EV_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    const payload = await fetchJson(`${baseUrl}/places:searchNearby`, {
      body: {
        includedTypes: ["electric_vehicle_charging_station"],
        maxResultCount: Math.min(safeLimit, 20),
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius: safeRadiusKm * 1000,
          },
        },
      },
      headers: {
        "X-Goog-Api-Key": googlePlacesEvApiKey(),
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.businessStatus",
          "places.evChargeOptions",
        ].join(","),
      },
      timeoutMs: providerTimeoutMs(),
    });
    const chargers = normaliseGooglePlacesEvPayload(payload, {
      centre: { lat, lon, label: centre?.label || "Map centre" },
      radiusKm: safeRadiusKm,
      filters,
    }).slice(0, safeLimit);
    return googlePlacesEvResult({
      chargers,
      centre: { lat, lon, label: centre?.label || "Map centre" },
      radiusKm: safeRadiusKm,
      filters,
      cacheMode: "refreshed",
    });
  }

  return { loadEvChargers };
}

function normaliseGooglePlacesEvPayload(payload, { centre, radiusKm = 8, filters = {} } = {}) {
  const rows = Array.isArray(payload?.places) ? payload.places : [];
  const normalisedFilters = {
    connectors: Array.isArray(filters.connectors) ? filters.connectors : [],
    minPowerKw: Math.max(0, Number(filters.minPowerKw) || 0),
    powerMode: String(filters.powerMode || ""),
  };
  return rows
    .map((row) => normaliseGooglePlace(row, centre))
    .filter(Boolean)
    .filter((charger) => charger.distanceKm <= radiusKm)
    .filter((charger) => chargerMatchesFilters(charger, normalisedFilters))
    .sort((left, right) => {
      const leftAvailable = Number(left.availableConnectorCount || 0);
      const rightAvailable = Number(right.availableConnectorCount || 0);
      const leftPower = Number(left.maxPowerKw || 0);
      const rightPower = Number(right.maxPowerKw || 0);
      return rightAvailable - leftAvailable || rightPower - leftPower || left.distanceKm - right.distanceKm;
    });
}

function normaliseGooglePlace(row, centre) {
  const lat = Number(row?.location?.latitude);
  const lon = Number(row?.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const aggregations = Array.isArray(row?.evChargeOptions?.connectorAggregation)
    ? row.evChargeOptions.connectorAggregation
    : [];
  const connections = aggregations.map(normaliseAggregation).filter(Boolean);
  if (!connections.length) return null;
  const maxPowerKw = connections.reduce((max, item) => Math.max(max, Number(item.powerKw || 0)), 0);
  const availableConnectorCount = connections.reduce((sum, item) => sum + Number(item.availableCount || 0), 0);
  const outOfServiceConnectorCount = connections.reduce((sum, item) => sum + Number(item.outOfServiceCount || 0), 0);
  const connectorCount = Number(row?.evChargeOptions?.connectorCount || 0);
  return {
    id: `GOOGLE_PLACES_EV-${row.id || `${lat},${lon}`}`,
    name: cleanText(row?.displayName?.text) || "EV charger",
    operator: "Google Places",
    address: cleanText(row?.formattedAddress),
    lat,
    lon,
    distanceKm: round(centre ? distanceKm(centre, { lat, lon }) : 0, 2),
    detourMinutes: undefined,
    connectors: unique(connections.map((item) => item.connector)),
    connections,
    maxPowerKw: maxPowerKw || undefined,
    powerBand: powerBand(maxPowerKw),
    availability: outOfServiceConnectorCount > 0 && availableConnectorCount === 0 ? "unavailable" : "unknown",
    availabilityLabel: availableConnectorCount > 0
      ? `${availableConnectorCount} connector${availableConnectorCount === 1 ? "" : "s"} reported by provider; confirm in the network app`
      : "Live bay status not confirmed here",
    availableConnectorCount,
    connectorCount: connectorCount || undefined,
    source: "google_places_ev",
    provenance: "Charger data from Google Places EV fields. Confirm tariff, access and live bay status with the charging network before driving.",
  };
}

function normaliseAggregation(item) {
  const connector = CONNECTOR_MAP[item?.type] || cleanText(item?.type).replace(/^EV_CONNECTOR_TYPE_/, "");
  const powerKw = Number(item?.maxChargeRateKw || 0);
  return {
    connector,
    connectorLabel: connector,
    powerKw: Number.isFinite(powerKw) && powerKw > 0 ? powerKw : undefined,
    quantity: Number(item?.count || 0) || undefined,
    availableCount: Number(item?.availableCount || 0) || undefined,
    outOfServiceCount: Number(item?.outOfServiceCount || 0) || undefined,
    status: item?.availabilityLastUpdateTime ? `Updated ${item.availabilityLastUpdateTime}` : undefined,
  };
}

function googlePlacesEvResult({
  chargers,
  centre,
  radiusKm,
  filters,
  cacheMode,
  degraded = false,
  warning = "",
}) {
  return {
    context: {
      provider: "google_places_ev",
      source: "google_places_ev",
      capability: "prototype",
      radiusKm,
      centre,
      filters,
      chargerCount: chargers.length,
      returnedCount: chargers.length,
      generatedAt: new Date().toISOString(),
      cacheHit: false,
      cacheAgeSeconds: 0,
      cacheMode,
      degraded,
      provenance: {
        source: "google_places_ev",
        label: "Google Places EV charging data",
        licence: "Google Maps Platform terms",
        realTimeAvailability: process.env.FUEL_PATH_GOOGLE_PLACES_EV_LIVE_AVAILABILITY_CLAIMS_ALLOWED === "1",
      },
      warning:
        warning ||
        "Google Places EV charging is a trial data path. Confirm tariff, access and live bay status with the charging network before driving.",
    },
    chargers,
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

function googlePlacesEvApiKey() {
  return process.env.FUEL_PATH_GOOGLE_PLACES_EV_API_KEY || googlePlacesApiKey();
}

async function assertGooglePlacesEvAllowed() {
  const cap = googlePlacesEvDailyCap();
  await assertGooglePlacesEvHardStop(cap);
  if (productionRuntime() && !geocodeQuotaStorageStatus().durable) {
    throw new Error("Google Places EV charging requires durable quota storage in production");
  }
  const quota = await reserveGeocodeQuota({
    quotaKey: "google_places_ev",
    date: new Date().toISOString().slice(0, 10),
    cap,
  });
  if (!quota.allowed) {
    throw new Error("Google Places EV daily cap reached");
  }
}

async function assertGooglePlacesEvHardStop(cap) {
  const hardStopPercent = googlePlacesEvHardStopPercent();
  if (cap <= 0 || hardStopPercent <= 0) return;
  const usage = await getGeocodeQuotaUsage({
    quotaKey: "google_places_ev",
    date: new Date().toISOString().slice(0, 10),
  });
  const used = Number(usage?.calls || 0);
  const threshold = Math.ceil(cap * (hardStopPercent / 100));
  if (used >= threshold) {
    throw new Error("Google Places EV daily cap reached");
  }
}

function googlePlacesEvDailyCap() {
  const value = Number(process.env.FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP || 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function googlePlacesEvHardStopPercent() {
  return parsePercent(process.env.FUEL_PATH_GOOGLE_PLACES_EV_HARD_STOP_PERCENT, 95);
}

function googlePlacesEvSoftWarningPercent() {
  return parsePercent(process.env.FUEL_PATH_GOOGLE_PLACES_EV_SOFT_WARNING_PERCENT, 80);
}

function parsePercent(value, fallback) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, parsed));
}

function productionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
}

async function defaultFetchJson(url, { body, headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
        ...headers,
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(`Provider returned ${response.status}: ${payload?.error?.message || response.statusText}`);
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Provider request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function providerTimeoutMs() {
  return Math.max(3000, Number(process.env.FUEL_PATH_EV_PROVIDER_TIMEOUT_MS || 12000));
}

function powerBand(powerKw) {
  const power = Number(powerKw || 0);
  if (power >= 150) return "ultra_fast";
  if (power >= 50) return "dc_fast";
  if (power > 0) return "ac";
  return "unknown";
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
  createGooglePlacesEvAdapter,
  googlePlacesEvDailyCap,
  googlePlacesEvHardStopPercent,
  googlePlacesEvSoftWarningPercent,
  normaliseGooglePlacesEvPayload,
};
