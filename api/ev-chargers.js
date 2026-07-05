const {
  boolParam,
  routeFromPayload,
  buildRoute,
  methodAllowed,
  numberParam,
  sendJson,
  stringParam,
} = require("./_backend");
const { createApiNinjasAdapter } = require("./_evApiNinjas");
const { createGooglePlacesEvAdapter } = require("./_evGooglePlaces");
const { createLocalPrototypeEvDirectoryAdapter } = require("./_evLocalPrototypeDirectory");
const {
  googlePlacesRouteChargingDecision,
  defaultEvProvider,
  evProviderConfigured,
  fallbackEvProviders,
  normaliseEvProvider,
} = require("./_evProviderPolicy");
const {
  isOpenWebNinjaRateLimited,
  markOpenWebNinjaRateLimit,
} = require("./_evProviderState");
const { createOpenWebNinjaAdapter } = require("./_evOpenWebNinja");
const { createEvRouteFallbackScorer } = require("./_evRouteFallback");
const {
  createOpenChargeMapAdapter,
  supportedEvProviders,
  unsupportedEvProviderResult,
} = require("./_evOpenChargeMap");

const { loadEvChargers: loadOpenChargeMapEvChargers } = createOpenChargeMapAdapter();
const { loadEvChargers: loadApiNinjasEvChargers } = createApiNinjasAdapter();
const { loadEvChargers: loadGooglePlacesEvChargers } = createGooglePlacesEvAdapter();
const { loadEvChargers: loadLocalPrototypeEvChargers } = createLocalPrototypeEvDirectoryAdapter();
const { loadEvChargers: loadOpenWebNinjaEvChargers } = createOpenWebNinjaAdapter();
const { scoreEvRouteFallback } = createEvRouteFallbackScorer({
  buildRoute,
  loadEvChargers: (request) => loadDefaultProviderCascade(defaultEvProvider(), request),
});
const {
  incrementRouteChargingRequest,
  recordEvRouteChargingAttempt,
  recordEvRouteChargingFailure,
  recordEvRouteChargingPolicyBlock,
  recordEvRouteChargingResult,
} = require("./_evProviderTelemetry");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;
  try {
    if (req.method === "POST") {
      const body = req.body || {};
      if (!["route_fallback", "route_charging"].includes(body.mode)) throw new Error("mode must be route_charging for POST");
      const route = routeFromPayload(body.route || {});
      route.distanceKm = Number(body.route?.distanceKm || body.route?.routeDistanceKm || 0) || route.distanceKm;
      const connectors = Array.isArray(body.connectors)
        ? body.connectors.map(String).filter(Boolean)
        : [];
      const radiusKm = Math.max(1, Math.min(50, Number(body.radiusKm) || 30));
      const limit = Math.max(1, Math.min(12, Math.round(Number(body.limit) || 10)));
      incrementRouteChargingRequest();
      sendJson(res, 200, await scoreEvRouteFallback({
        connectors,
        limit,
        radiusKm,
        route,
        selectedRangeKm: Number(body.selectedRangeKm || 0),
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

    let payload;
    if (requestedProvider) {
      if (provider === "google_places_ev") {
        const decision = googlePlacesRouteChargingDecision();
        if (!decision.allowed) {
          payload = providerSignalHoldoffResult({
            provider,
            request,
            reason: `${googlePlacesHoldoffReason(decision)} Route lookup is temporarily paused.`,
          });
        } else {
          payload = await loadSingleProvider(provider, request);
        }
      } else if (provider === "openweb_ninja" && isOpenWebNinjaRateLimited()) {
        payload = providerRateLimitResult({ provider: "openweb_ninja", request });
      } else {
        payload = await loadSingleProvider(provider, request);
      }
    } else {
      payload = await loadDefaultProviderCascade(provider, request);
    }

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
  if (provider === "google_places_ev") return loadGooglePlacesEvChargers(request);
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
    const isFallback = candidate !== provider;
    if (candidate === "google_places_ev") {
      const decision = googlePlacesRouteChargingDecision();
      if (!decision.allowed) {
        const blockerText = googlePlacesHoldoffReason(decision);
        recordEvRouteChargingPolicyBlock({ provider: candidate, reason: "google_places_ev_route_guard_blocked" });
        results.push(providerSignalHoldoffResult({
          provider: candidate,
          request,
          reason: `${blockerText} Route lookup is temporarily paused.`,
        }));
        continue;
      }
    }
    recordEvRouteChargingAttempt({ provider: candidate, isFallback });
    try {
      if (candidate === "openweb_ninja" && isOpenWebNinjaRateLimited()) {
        recordEvRouteChargingPolicyBlock({ provider: candidate, reason: "openweb_ninja_rate_limited" });
        results.push(providerRateLimitResult({ provider: candidate, request }));
        continue;
      }
      const result = await loadSingleProvider(candidate, request);
      results.push(result);
      recordEvRouteChargingResult({
        provider: candidate,
        chargersCount: Number(Array.isArray(result?.chargers) ? result.chargers.length : 0),
        cacheMode: result?.context?.cacheMode,
      });
      if (result.chargers?.length && !evResultNeedsEnrichment(result, request)) break;
    } catch (error) {
      const message = String(error?.message || "");
      const isRateLimit = isRateLimitError(error);
      recordEvRouteChargingFailure({ provider: candidate, isFallback, isCapHit: String(error?.message || "").toLowerCase().includes("daily cap reached"), reason: message });
      if (candidate === "openweb_ninja" && isRateLimit) {
        markOpenWebNinjaRateLimit(message);
        results.push(providerRateLimitResult({ provider: candidate, request, reason: message }));
        continue;
      }
      results.push(providerErrorResult({ error, provider: candidate, request }));
    }
  }
  if (!results.length) return loadLocalPrototypeEvChargers(request);
  if (results.length === 1 && results[0].chargers?.length) return results[0];
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

function providerRateLimitResult({ provider, request, reason = "" }) {
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
      cacheMode: "rate_limited",
      degraded: false,
      provenance: {
        source: provider,
        label: `${provider} EV charger data`,
        licence: "provider terms",
        realTimeAvailability: false,
      },
      warning: `${provider} is temporarily rate-limited. ${reason ? reason + ". " : ""}Skipping this enrichment source and keeping route result.`,
    },
    chargers: [],
  };
}

function providerSignalHoldoffResult({ provider, request, reason = "" }) {
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
      cacheMode: "policy_blocked",
      degraded: true,
      provenance: {
        source: provider,
        label: `${provider} EV charger data`,
        licence: "provider terms",
        realTimeAvailability: false,
      },
      warning: `${provider} route lookup is currently paused by route-quality guard. ${reason ? reason : "Quality signal limits reached."}`,
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
  const warnings = results.map((result) => cascadeWarning(result, chargers.length > 0)).filter(Boolean);
  const emptyProviders = results
    .filter((result) => !result.chargers?.length && result.context?.cacheMode !== "provider_error")
    .map((result) => result.context?.provider)
    .filter(Boolean);
  const degraded = chargers.length
    ? results.some((result) => result.context?.degraded && result.context?.cacheMode !== "provider_error")
    : results.some((result) => result.context?.degraded);
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
      degraded,
      provenance: {
        source: providers.join("+"),
        label: `Charger data from ${providers.join(" and ")}`,
        licence: "provider terms",
        realTimeAvailability: false,
      },
      warning: [
        `EV charger directory cascade used ${providers.join(", ")}.`,
        emptyProviders.length ? `No usable charger rows returned from ${emptyProviders.join(", ")}.` : "",
        warnings.join(" "),
      ].filter(Boolean).join(" ").trim(),
    },
    chargers,
  };
}

  function cascadeWarning(result, hasUsableRows) {
  const warning = result?.context?.warning;
  if (!warning) return "";
  if (hasUsableRows && result?.context?.cacheMode === "provider_error") {
    return `Optional ${result.context.provider} enrichment unavailable.`;
  }
  return warning;
}

function googlePlacesHoldoffReason(decision = {}) {
  const blockers = Array.from(new Set(Array.isArray(decision.blockers) ? decision.blockers : []));
  return blockers.length
    ? `Quality blockers: ${blockers.join(", ")}.`
    : "Google Places EV cost controls or readiness blockers are active.";
}

function evResultNeedsEnrichment(result, request) {
  const chargers = result?.chargers || [];
  if (!chargers.length) return false;
  if (request.minPowerKw || request.powerMode) return true;
  const withPower = chargers.filter((charger) => Number.isFinite(Number(charger.maxPowerKw)) && Number(charger.maxPowerKw) > 0).length;
  const withOperator = chargers.filter((charger) => charger.operator && charger.operator !== "Unknown operator").length;
  const powerCoverage = withPower / chargers.length;
  const operatorCoverage = withOperator / chargers.length;
  return powerCoverage < 0.5 || operatorCoverage < 0.5;
}

function isRateLimitError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("429") || /rate limit|rate-limited|ratelimit|too many requests/.test(message);
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
