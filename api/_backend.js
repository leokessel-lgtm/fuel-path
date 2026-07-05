const sample = require("./_sample");
const {
  purgeAlertRetention,
  setAlertStorageForTests,
} = require("./_alertStorage");
const {
  appendPredictionBacktestRecord,
  listPredictionBacktestRecords,
  predictionStorageStatus,
  purgePredictionBacktests,
  setPredictionStorageForTests,
} = require("./_predictionStorage");
const { providerHealth, singleFlight } = require("./_providerRuntime");
const {
  googleRoutesApiKey,
} = require("./_providerCredentials");
const { distanceKm } = require("./_geoMath");
const {
  routeContextStations,
  scoreRoute,
  stationPayload,
} = require("./_routeScoring");
const { createGeocoder } = require("./_geocode");
const { createAlertOrchestration } = require("./_alertOrchestration");
const DISCOUNT_RULES = require("../shared/discountRegistry.json");
const { createWaFuelWatchAdapter } = require("./_waFuelWatch");
const { createFppDirectProvider } = require("./_fppDirectProvider");
const { createNswFuelCheckAdapter } = require("./_nswFuelCheck");
const {
  REGION_ORDER,
  capabilitiesForPoints,
  capabilitySummary,
  capabilityWarning,
  fuelProviderCapabilityMatrix,
  hasAnyLiveCredentials,
  hasNswActUsageTermsConfirmed,
  hasLiveCredentials,
  hasNtCredentials,
  hasQldCredentials,
  hasQldUsageTermsConfirmed,
  hasSaCredentials,
  hasTasUsageTermsConfirmed,
  hasVicCredentials,
  hasWaProvider,
  liveProviderKeysForArea,
  pointInAct,
  pointInNt,
  pointInProviderCoverage,
  pointInQld,
  pointInSa,
  pointInTas,
  pointInVic,
  primaryCapability,
  providerPublicClaimStatus,
} = require("./_capabilities");
const { createRouting } = require("./_routing");

const DEFAULT_CACHE_SECONDS = 300;
const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";
const PREDICTION_BACKTEST_MAX_RECORDS = 500;
const RETENTION_DEFAULTS = {
  inactiveDeviceDays: 90,
  disabledRouteDays: 90,
  alertEvaluationDays: 180,
  predictionBacktestDays: 365,
};
const { buildRoute, routeProviderStatus } = createRouting({
  fetchJson,
  googleRoutesApiKey,
});
const {
  loadLiveWaStations,
  normaliseWaFuelWatchPayloads,
  waFuelWatchRequestPlan,
  waRegionPlanForArea,
  waTomorrowPriceAvailable,
} = createWaFuelWatchAdapter({ decorateStation: stationWithDiscountRules });
const { createVicServoSaverAdapter } = require("./_vicServoSaverProvider");
const {
  loadLiveQldStations,
  loadLiveSaStations,
  normaliseQldPayload,
  normaliseSaPayload,
} = createFppDirectProvider({ decorateStation: stationWithDiscountRules });
const {
  loadLiveStations,
  loadLiveTasStations,
  normaliseNswPayload,
  normaliseTasPayload,
} = createNswFuelCheckAdapter({ decorateStation: stationWithDiscountRules });
const { loadLiveVicStations } = createVicServoSaverAdapter({ decorateStation: stationWithDiscountRules });
const {
  createMyFuelNtProvider,
  normaliseNtPayload,
  normaliseNtReferencePayload,
} = require("./_ntMyFuelProvider");
const { loadLiveNtStations } = createMyFuelNtProvider({ decorateStation: stationWithDiscountRules });
const { geocode, geocodeProviderStatus } = createGeocoder({
  fetchJson,
  loadStationData,
});
const {
  alertsStatus,
  alertsWriteAuthorised,
  alertsWriteSecurity,
  checkPushReceipts,
  cronAuthorised,
  deleteBackendSavedRoute,
  evaluateSavedRouteAlert,
  listBackendAlertEvaluations,
  listBackendPushDevices,
  listBackendSavedRoutes,
  registerPushDevice,
  runScheduledRouteAlertEvaluation,
  saveBackendSavedRoute,
  setAlertRouteScorerForTests,
} = createAlertOrchestration({
  buildRoute,
  capabilitiesForPoints,
  loadStationData,
  scoreRoute,
});

function productionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
}

function sampleSourceAllowed() {
  if (process.env.FUEL_PATH_ALLOW_SAMPLE_SOURCE === "1") return true;
  return !productionRuntime();
}

function applyCors(req, res) {
  const origin = req?.headers?.origin || req?.headers?.Origin || "";
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(String(origin))) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Fuel-Path-Alerts-Token, X-Fuel-Path-Prediction-Token");
  res.setHeader("Access-Control-Max-Age", "600");
}

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function methodAllowed(req, res, methods = ["GET"]) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }
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

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
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
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Provider request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
    if (!isActiveDirectDiscountRule(rule)) continue;
    if (rule.brandIncludes.some((needle) => text.includes(needle))) {
      byId.set(rule.id, {
        id: rule.id,
        label: rule.label,
        centsPerLitre: rule.centsPerLitre,
        fuelTypeCentsPerLitre: rule.fuelTypeCentsPerLitre,
        maxLitresPerTransaction: rule.maxLitresPerTransaction,
        maxTransactionsPer24h: rule.maxTransactionsPer24h,
        excludedFuelTypes: rule.excludedFuelTypes,
        excludedStates: rule.excludedStates,
        includedStates: rule.includedStates,
        notStackableWith: rule.notStackableWith,
        requiresBarcode: rule.requiresBarcode,
        participatingStationScope: rule.participatingStationScope,
        sourceUrl: rule.sourceUrl,
        inferred: true,
      });
    }
  }
  return { ...station, discounts: [...byId.values()] };
}

function isActiveDirectDiscountRule(rule) {
  if (rule.discountType !== "direct_cpl") return false;
  if (Number(rule.centsPerLitre || 0) <= 0) return false;
  if (!rule.expiryDate) return true;
  return rule.expiryDate >= todayIsoDate();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function loadSampleStations() {
  return sample.sampleStations({ includeFixtureFallback: true }).map(stationWithDiscountRules);
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
      cacheMode: "none",
      degraded: false,
      providerHealth: {},
      warning: capabilityWarning(regionCapabilities),
    };
  }
  const stations = [];
  const loadedProviders = [];
  const errors = [];
  const warnings = [];
  const providerHealthMap = {};
  const cacheModes = new Set();
  let cacheHit = true;
  let maxCacheAgeSeconds = 0;
  let degraded = false;

  const providerResults = await Promise.all(
    providers.map(async (provider) => {
      try {
        const result = await singleFlight(liveProviderFlightKey(provider, { forceRefresh, points, radiusKm, fuels }), async () => {
          let live;
          let loadedProvider = "";
          if (provider === "qld") {
            if (productionRuntime() && !hasQldUsageTermsConfirmed()) {
              throw new Error("QLD Fuel Prices public usage, caching and attribution terms are not confirmed.");
            }
            live = await loadLiveQldStations({ forceRefresh });
            loadedProvider = "api_qld";
          } else if (provider === "wa") {
            live = await loadLiveWaStations({ forceRefresh, points, radiusKm, fuels });
            loadedProvider = "api_wa";
          } else if (provider === "vic") {
            live = await loadLiveVicStations({ forceRefresh });
            loadedProvider = "api_vic";
          } else if (provider === "sa") {
            live = await loadLiveSaStations({ forceRefresh });
            loadedProvider = "api_sa";
          } else if (provider === "nt") {
            live = await loadLiveNtStations({ forceRefresh, points, radiusKm, fuels });
            loadedProvider = "api_nt";
          } else if (provider === "nsw") {
            if (productionRuntime() && !hasNswActUsageTermsConfirmed()) {
              throw new Error("FuelCheck NSW/ACT public usage, caching and attribution terms are not confirmed.");
            }
            live = await loadLiveStations({ forceRefresh });
            loadedProvider = "api_nsw";
          } else if (provider === "tas") {
            if (productionRuntime() && !hasTasUsageTermsConfirmed()) {
              throw new Error("TAS FuelCheck public usage, caching and attribution terms are not confirmed.");
            }
            live = await loadLiveTasStations({ forceRefresh, points, radiusKm, fuels });
            loadedProvider = "api_tas";
          }
          return { loadedProvider, live };
        });
        return { provider, loadedProvider: result.loadedProvider, live: result.live, error: "" };
      } catch (error) {
        return { provider, loadedProvider: "", live: null, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );

  for (const result of providerResults) {
    const { provider, loadedProvider, live, error } = result;
    if (error) {
      errors.push(`${provider}: ${error}`);
      providerHealthMap[provider] = {
        status: "unavailable",
        cacheMode: "none",
        cacheAgeSeconds: null,
        lastError: error,
        warning: "",
      };
      cacheHit = false;
      degraded = true;
      continue;
    }
    try {
      if (!live) continue;
      if (loadedProvider) loadedProviders.push(loadedProvider);
      stations.push(...live.stations);
      Object.assign(providerHealthMap, live.providerHealth || {});
      if (live.warning) warnings.push(live.warning);
      if (live.cacheMode) cacheModes.add(live.cacheMode);
      cacheHit = cacheHit && Boolean(live.cacheHit);
      if (Number.isFinite(Number(live.cacheAgeSeconds))) {
        maxCacheAgeSeconds = Math.max(maxCacheAgeSeconds, Number(live.cacheAgeSeconds));
      }
      degraded = degraded || Boolean(live.degraded || live.error || live.warning);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider}: ${message}`);
      providerHealthMap[provider] = {
        status: "unavailable",
        cacheMode: "none",
        cacheAgeSeconds: null,
        lastError: message,
        warning: "",
      };
      cacheHit = false;
      degraded = true;
    }
  }
  if (!stations.length && !loadedProviders.length) throw new Error(errors.join("; ") || "No live fuel providers are configured");
  const byCode = new Map();
  for (const station of stations) byCode.set(String(station.stationCode), station);
  const cacheMode = cacheModes.has("stale") ? "stale" : cacheModes.has("refreshed") ? "refreshed" : cacheModes.has("fresh") ? "fresh" : "none";
  return {
    stations: [...byCode.values()],
    source: loadedProviders.join("+") || "live",
    provider: loadedProviders.join("+") || "live",
    capability: primaryCapability(regionCapabilities),
    regionCapabilities,
    cacheHit,
    cacheAgeSeconds: cacheHit ? maxCacheAgeSeconds : 0,
    cacheMode,
    degraded,
    providerHealth: providerHealthMap,
    warning: [...warnings, ...(errors.length ? [`Some live fuel providers unavailable: ${errors.join("; ")}`] : [])].join(" "),
  };
}

function liveProviderFlightKey(provider, { forceRefresh = false, points = [], radiusKm = 0, fuels = [] } = {}) {
  const pointKey = (points || [])
    .map((point) => `${Number(point.lat || 0).toFixed(2)},${Number(point.lon || 0).toFixed(2)}`)
    .join("|");
  const fuelKey = (fuels || []).map(String).sort().join(",");
  return ["live-provider", provider, forceRefresh ? "refresh" : "cached", Math.round(Number(radiusKm || 0)), fuelKey, pointKey].join(":");
}

async function loadStationData({ requestedSource = "auto", forceRefresh = false, points = [], radiusKm = 0, fuels = [] } = {}) {
  const source = resolveSource(requestedSource);
  if (source === "sample") {
    const regionCapabilities = capabilitiesForPoints(points);
    if (!sampleSourceAllowed()) {
      return {
        source: "sample_disabled",
        provider: "public_demo_snapshot",
        capability: "fallback",
        regionCapabilities,
        stations: [],
        cacheHit: false,
        cacheAgeSeconds: null,
        cacheMode: "disabled",
        degraded: true,
        providerHealth: {
          sample: {
            status: "disabled",
            cacheMode: "disabled",
            cacheAgeSeconds: null,
            lastError: "",
            warning: "Demo fallback is disabled in production.",
          },
        },
        warning: "Demo fallback is disabled in production; no sample prices were returned.",
      };
    }
    return {
      source: "sample",
      provider: "public_demo_snapshot",
      capability: "fallback",
      regionCapabilities,
      stations: loadSampleStations(),
      cacheHit: true,
      cacheAgeSeconds: null,
      cacheMode: "sample",
      degraded: true,
      providerHealth: {
        sample: {
          status: "degraded",
          cacheMode: "sample",
          cacheAgeSeconds: null,
          lastError: "",
          warning: "Demo data is not live fuel pricing.",
        },
      },
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
      cacheMode: "none",
      degraded: true,
      providerHealth: {
        [requestedProvider]: {
          status: "unsupported_region",
          cacheMode: "none",
          cacheAgeSeconds: null,
          lastError: "",
          warning: `Requested ${requestedProvider.toUpperCase()} fuel provider does not cover this area.`,
        },
      },
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
    if (!sampleSourceAllowed()) {
      return {
        source: "live_unavailable",
        provider: requestedProvider || "live",
        capability: primaryCapability(capabilitiesForPoints(points)),
        regionCapabilities: capabilitiesForPoints(points),
        stations: [],
        cacheHit: false,
        cacheAgeSeconds: 0,
        cacheMode: "none",
        degraded: true,
        providerHealth: {
          [requestedProvider || "live"]: {
            status: "unavailable",
            cacheMode: "none",
            cacheAgeSeconds: null,
            lastError: message,
            warning: "",
          },
        },
        warning: `Live fuel provider unavailable: ${message}`,
      };
    }
    return {
      source: "sample_fallback",
      provider: "public_demo_snapshot",
      capability: "fallback",
      regionCapabilities: capabilitiesForPoints(points),
      stations: loadSampleStations(),
      cacheHit: true,
      cacheAgeSeconds: null,
      cacheMode: "sample_fallback",
      degraded: true,
      providerHealth: {
        sample: {
          status: "degraded",
          cacheMode: "sample_fallback",
          cacheAgeSeconds: null,
          lastError: message,
          warning: "Live provider failed; serving demo fallback outside production.",
        },
      },
      warning: `Live fuel provider unavailable: ${message}`,
    };
  }
}

function resolveSource(source) {
  const value = source === "auto" || !source ? (hasAnyLiveCredentials() || !sampleSourceAllowed() ? "live" : "sample") : source;
  if (!["live", "sample", "nsw", "qld", "wa", "vic", "sa", "tas", "nt"].includes(value)) {
    throw new Error("source must be live, sample, nsw, qld, wa, vic, sa, tas, nt or auto");
  }
  return value;
}

function providerFromSource(source) {
  return ["nsw", "qld", "wa", "vic", "sa", "tas", "nt"].includes(source) ? source : "";
}

function pointFromQuery(req, prefix) {
  return {
    lat: numberParam(req.query[`${prefix}Lat`], 0),
    lon: numberParam(req.query[`${prefix}Lon`], 0),
    label: stringParam(req.query[`${prefix}Label`], prefix),
  };
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

async function predictionStatus() {
  const storage = predictionStorageStatus({ maxRecords: PREDICTION_BACKTEST_MAX_RECORDS });
  let records = [];
  let storageError = "";
  try {
    records = await listPredictionBacktestRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
  } catch (error) {
    storageError = error instanceof Error ? error.message : "Prediction storage is unavailable";
  }
  const readiness = predictionReadiness(records, storage);
  return {
    mode: "measurement_foundation",
    storage: {
      ...storage,
      recordCount: storageError ? storage.recordCount : records.length,
      health: storageError ? "error" : "ok",
      lastError: storageError,
    },
    writeSecurity: predictionWriteSecurity(),
    userFacingPredictionEnabled: readiness.userFacingPredictionEnabled,
    accuracyClaimsAllowed: readiness.accuracyClaimsAllowed,
    supportedSignalLabels: ["no_cycle_signal", "backtest_required", "measured_cycle_signal_ready"],
    readiness,
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

  const readiness = predictionReadiness([], { durable: false });
  return {
    region: safeRegion,
    fuel: safeFuel,
    signal: "backtest_required",
    confidence: "low",
    reasons: ["history threshold met, but measured back-test evidence is still required before guidance is enabled"],
    userFacingCopy: "No cycle guidance yet.",
    userFacingPredictionEnabled: readiness.userFacingPredictionEnabled,
    accuracyClaimsAllowed: readiness.accuracyClaimsAllowed,
    readiness,
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
    readiness: predictionReadiness([], { durable: false }),
  };
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
    accuracyClaimsAllowed: predictionReadiness(records, { durable: false }).accuracyClaimsAllowed,
  };
}

function predictionReadiness(records = [], storage = {}) {
  const completed = records.filter((record) => Number.isFinite(record.absoluteErrorCpl));
  const directionRecords = records.filter((record) => typeof record.directionMatched === "boolean");
  const meanAbsoluteErrorCpl = completed.length
    ? round(completed.reduce((total, record) => total + Number(record.absoluteErrorCpl || 0), 0) / completed.length, 2)
    : undefined;
  const directionAccuracy = directionRecords.length
    ? round(directionRecords.filter((record) => record.directionMatched).length / directionRecords.length, 3)
    : undefined;
  const thresholds = {
    completedSampleSize: 60,
    directionSampleSize: 60,
    maxMeanAbsoluteErrorCpl: 4,
    minDirectionAccuracy: 0.68,
  };
  const blockers = [
    ...(storage.durable ? [] : ["durable_prediction_storage_missing"]),
    ...(completed.length >= thresholds.completedSampleSize ? [] : ["prediction_completed_sample_below_threshold"]),
    ...(directionRecords.length >= thresholds.directionSampleSize ? [] : ["prediction_direction_sample_below_threshold"]),
    ...(Number.isFinite(meanAbsoluteErrorCpl) && meanAbsoluteErrorCpl <= thresholds.maxMeanAbsoluteErrorCpl ? [] : ["prediction_mae_above_threshold_or_missing"]),
    ...(Number.isFinite(directionAccuracy) && directionAccuracy >= thresholds.minDirectionAccuracy ? [] : ["prediction_direction_accuracy_below_threshold_or_missing"]),
  ];
  return {
    status: blockers.length ? "measurement_only" : "ready_for_limited_cycle_guidance",
    thresholds,
    completedSampleSize: completed.length,
    directionSampleSize: directionRecords.length,
    meanAbsoluteErrorCpl,
    directionAccuracy,
    blockers,
    blindSpots: predictionBlindSpots({ records, storage, meanAbsoluteErrorCpl, directionAccuracy }),
    userFacingPredictionEnabled: false,
    accuracyClaimsAllowed: blockers.length === 0,
  };
}

function predictionBlindSpots({ records = [], storage = {}, meanAbsoluteErrorCpl, directionAccuracy } = {}) {
  const regions = Array.from(new Set(records.map((record) => record.region).filter(Boolean)));
  const fuels = Array.from(new Set(records.map((record) => record.fuel).filter(Boolean)));
  const missingRegions = REGION_ORDER.filter((region) => !regions.includes(region));
  const coreFuels = ["U91", "P95", "P98", "DL", "PDL"];
  const missingCoreFuels = coreFuels.filter((fuel) => !fuels.includes(fuel));
  const blindSpots = [
    "Predictions are blocked unless durable back-test storage is configured.",
    "Directional accuracy proves only up/down/flat direction, not the exact pump price a driver will see.",
    "Station-level prices can move differently from region averages and must not be presented as guaranteed.",
    "Provider outages, stale cache, delayed official feeds or station corrections can invalidate a cycle signal.",
    "WA tomorrow locked prices are official source data, not model prediction, and should be labelled separately.",
  ];
  if (!storage.durable) blindSpots.push("Current storage is not durable enough for public accuracy claims.");
  if (missingRegions.length) blindSpots.push(`No completed back-test coverage yet for ${missingRegions.join(", ")}.`);
  if (missingCoreFuels.length) blindSpots.push(`Sparse or missing fuel-grade coverage for ${missingCoreFuels.join(", ")}.`);
  if (!Number.isFinite(meanAbsoluteErrorCpl)) blindSpots.push("Mean absolute error is not measurable until completed prediction/actual pairs exist.");
  if (!Number.isFinite(directionAccuracy)) blindSpots.push("Directional accuracy is not measurable until direction-labelled back-tests exist.");
  return Array.from(new Set(blindSpots));
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

async function runRetentionCleanup({
  now = new Date().toISOString(),
  dryRun = false,
  inactiveDeviceDays = RETENTION_DEFAULTS.inactiveDeviceDays,
  disabledRouteDays = RETENTION_DEFAULTS.disabledRouteDays,
  alertEvaluationDays = RETENTION_DEFAULTS.alertEvaluationDays,
  predictionBacktestDays = RETENTION_DEFAULTS.predictionBacktestDays,
} = {}) {
  const safeNow = isoDateTime(now);
  const policy = {
    inactiveDeviceDays: positiveInteger(inactiveDeviceDays, RETENTION_DEFAULTS.inactiveDeviceDays),
    disabledRouteDays: positiveInteger(disabledRouteDays, RETENTION_DEFAULTS.disabledRouteDays),
    alertEvaluationDays: positiveInteger(alertEvaluationDays, RETENTION_DEFAULTS.alertEvaluationDays),
    predictionBacktestDays: positiveInteger(predictionBacktestDays, RETENTION_DEFAULTS.predictionBacktestDays),
  };
  const [alerts, predictions] = await Promise.all([
    purgeAlertRetention({
      now: safeNow,
      dryRun,
      inactiveDeviceDays: policy.inactiveDeviceDays,
      disabledRouteDays: policy.disabledRouteDays,
      evaluationDays: policy.alertEvaluationDays,
    }),
    purgePredictionBacktests({
      now: safeNow,
      dryRun,
      olderThanDays: policy.predictionBacktestDays,
    }),
  ]);
  return {
    accepted: true,
    dryRun: Boolean(dryRun),
    now: safeNow,
    policy,
    alerts,
    predictions,
  };
}

function retentionCleanupAuthorised(req = {}) {
  if (cronAuthorised(req)) return true;
  if (!process.env.ALERTS_WRITE_TOKEN) return false;
  const headers = req.headers || {};
  const auth = headers.authorization || headers.Authorization || "";
  const direct = headers["x-fuel-path-alerts-token"] || headers["X-Fuel-Path-Alerts-Token"] || "";
  const bearer = String(auth).replace(/^Bearer\s+/i, "").trim();
  return (bearer || String(direct).trim()) === process.env.ALERTS_WRITE_TOKEN;
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

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function isoDateTime(value) {
  const parsed = new Date(value || new Date().toISOString());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
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
  deleteBackendSavedRoute,
  distanceKm,
  evaluateSavedRouteAlert,
  fuelProviderCapabilityMatrix,
  geocode,
  geocodeProviderStatus,
  hasAnyLiveCredentials,
  hasNswActUsageTermsConfirmed,
  hasLiveCredentials,
  hasNtCredentials,
  hasQldCredentials,
  hasQldUsageTermsConfirmed,
  hasSaCredentials,
  hasTasUsageTermsConfirmed,
  hasVicCredentials,
  hasWaProvider,
  loadStationData,
  loadLiveSaStations,
  loadLiveWaStations,
  liveProviderKeysForArea,
  methodAllowed,
  normaliseQldPayload,
  normaliseNtPayload,
  normaliseNtReferencePayload,
  normaliseSaPayload,
  normaliseTasPayload,
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
  providerPublicClaimStatus,
  registerPushDevice,
  recordPredictionBacktest,
  retentionCleanupAuthorised,
  routeContextStations,
  routeFromPayload,
  routeProviderStatus,
  runRetentionCleanup,
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
