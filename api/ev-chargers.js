const {
  boolParam,
  buildRoute,
  methodAllowed,
  numberParam,
  sendJson,
  stringParam,
} = require("./_backend");
const { createApiNinjasAdapter } = require("./_evApiNinjas");
const { defaultEvProvider, evProviderConfigured, fallbackEvProviders, normaliseEvProvider } = require("./_evProviderPolicy");
const { createOpenWebNinjaAdapter } = require("./_evOpenWebNinja");
const { routeFromPayload } = require("./_backend");
const { createEvRouteFallbackScorer } = require("./_evRouteFallback");
const {
  createOpenChargeMapAdapter,
  supportedEvProviders,
  unsupportedEvProviderResult,
} = require("./_evOpenChargeMap");

const { loadEvChargers: loadOpenChargeMapEvChargers } = createOpenChargeMapAdapter();
const { loadEvChargers: loadApiNinjasEvChargers } = createApiNinjasAdapter();
const { loadEvChargers: loadOpenWebNinjaEvChargers } = createOpenWebNinjaAdapter();
const { scoreEvRouteFallback } = createEvRouteFallbackScorer({
  buildRoute,
  loadEvChargers: loadApiNinjasEvChargers,
});

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;
  try {
    if (req.method === "POST") {
      const body = req.body || {};
      if (body.mode !== "route_fallback") throw new Error("mode must be route_fallback for POST");
      const route = routeFromPayload(body.route || {});
      const connectors = Array.isArray(body.connectors)
        ? body.connectors.map(String).filter(Boolean)
        : [];
      const radiusKm = Math.max(1, Math.min(50, Number(body.radiusKm) || 18));
      const limit = Math.max(1, Math.min(8, Math.round(Number(body.limit) || 3)));
      sendJson(res, 200, await scoreEvRouteFallback({
        connectors,
        limit,
        radiusKm,
        route,
      }));
      return;
    }

    const requestedProvider = stringParam(req.query.provider, "");
    const provider = normaliseEvProvider(requestedProvider || defaultEvProvider());
    if (provider === "list") {
      sendJson(res, 200, { providers: supportedEvProviders() });
      return;
    }
    const centre = {
      lat: coordinateParam(req.query.lat, "lat", -90, 90),
      lon: coordinateParam(req.query.lon, "lon", -180, 180),
      label: stringParam(req.query.label, "Map centre"),
    };
    const radiusKm = boundedNumberParam(req.query.radiusKm, "radiusKm", 8, { min: 1, max: 100 });
    const limit = Math.round(boundedNumberParam(req.query.limit, "limit", 80, { min: 1, max: 120 }));
    const connectors = stringParam(req.query.connectors, "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const minPowerKw = numberParam(req.query.minPowerKw, 0);
    const powerMode = stringParam(req.query.powerMode, "");
    const request = {
      centre,
      radiusKm,
      limit,
      connectors,
      minPowerKw,
      powerMode,
      forceRefresh: boolParam(req.query.forceRefresh),
    };
    const payload = requestedProvider
      ? await loadSingleProvider(provider, request)
      : await loadDefaultProviderCascade(provider, request);
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Invalid EV charger query",
    });
  }
};

function coordinateParam(value, name, min, max) {
  if (value === undefined || value === null || value === "") throw new Error(`${name} is required`);
  return boundedNumberParam(value, name, undefined, { min, max, clampMax: false });
}

async function loadSingleProvider(provider, request) {
  if (provider === "open_charge_map") return loadOpenChargeMapEvChargers(request);
  if (provider === "openweb_ninja") return loadOpenWebNinjaEvChargers(request);
  if (provider === "api_ninjas") return loadApiNinjasEvChargers(request);
  return unsupportedEvProviderResult({
    provider,
    centre: request.centre,
    radiusKm: request.radiusKm,
    filters: {
      connectors: request.connectors,
      minPowerKw: request.minPowerKw,
      powerMode: request.powerMode,
    },
  });
}

async function loadDefaultProviderCascade(provider, request) {
  const providers = [provider, ...fallbackEvProviders(provider)].filter((item, index, list) => list.indexOf(item) === index);
  const results = [];
  for (const candidate of providers) {
    if (!evProviderConfigured(candidate)) continue;
    try {
      const result = await loadSingleProvider(candidate, request);
      results.push(result);
      if (result.chargers?.length) break;
    } catch (error) {
      results.push(providerErrorResult({ error, provider: candidate, request }));
    }
  }
  if (!results.length) return loadSingleProvider(provider, request);
  if (results.length === 1) return results[0];
  return mergeProviderResults(results, request);
}

function providerErrorResult({ error, provider, request }) {
  return {
    context: {
      provider,
      source: provider,
      capability: "prototype",
      radiusKm: request.radiusKm,
      centre: request.centre,
      filters: {
        connectors: request.connectors,
        minPowerKw: request.minPowerKw,
        powerMode: request.powerMode,
      },
      chargerCount: 0,
      returnedCount: 0,
      generatedAt: new Date().toISOString(),
      cacheHit: false,
      cacheAgeSeconds: 0,
      cacheMode: "provider_error",
      degraded: true,
      provenance: {
        source: provider,
        label: `${provider} EV charger data`,
        licence: "provider terms",
        realTimeAvailability: false,
      },
      warning: `${provider} EV provider unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
    },
    chargers: [],
  };
}

function mergeProviderResults(results, request) {
  const chargers = [];
  const seen = new Set();
  for (const result of results) {
    for (const charger of result.chargers || []) {
      const key = `${Number(charger.lat).toFixed(4)}|${Number(charger.lon).toFixed(4)}|${String(charger.name || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chargers.push(charger);
    }
  }
  chargers.sort((left, right) => Number(left.distanceKm || 0) - Number(right.distanceKm || 0));
  const providers = results.map((result) => result.context?.provider).filter(Boolean);
  const warnings = results.map((result) => result.context?.warning).filter(Boolean);
  return {
    context: {
      provider: providers.join("+"),
      source: "ev_provider_cascade",
      capability: "prototype",
      radiusKm: request.radiusKm,
      centre: request.centre,
      filters: {
        connectors: request.connectors,
        minPowerKw: request.minPowerKw,
        powerMode: request.powerMode,
      },
      chargerCount: chargers.length,
      returnedCount: chargers.length,
      generatedAt: new Date().toISOString(),
      cacheHit: results.every((result) => result.context?.cacheHit),
      cacheAgeSeconds: Math.max(...results.map((result) => Number(result.context?.cacheAgeSeconds || 0))),
      cacheMode: "cascade",
      degraded: results.some((result) => result.context?.degraded),
      provenance: {
        source: providers.join("+"),
        label: `Charger data from ${providers.join(" and ")}`,
        licence: "provider terms",
        realTimeAvailability: false,
      },
      warning: `EV charger directory cascade used ${providers.join(", ")}. ${warnings.join(" ")}`.trim(),
    },
    chargers,
  };
}

function boundedNumberParam(value, name, fallback, { min, max, clampMax = true }) {
  const raw = Array.isArray(value) ? value[0] : value;
  if ((raw === undefined || raw === null || raw === "") && fallback !== undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  if (parsed < min) throw new Error(`${name} must be at least ${min}`);
  if (!clampMax && parsed > max) throw new Error(`${name} must be at most ${max}`);
  return Math.min(parsed, max);
}
