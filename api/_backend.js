const sample = require("./_sample");
const {
  purgeAlertRetention,
  setAlertStorageForTests,
} = require("./_alertStorage");
const {
  appendPredictionBacktestRecord,
  appendPredictionMarketSnapshotRecord,
  listPredictionBacktestRecords,
  listPredictionMarketSnapshotRecords,
  predictionStorageStatus,
  purgePredictionBacktests,
  setPredictionStorageForTests,
} = require("./_predictionStorage");
const { providerHealth, singleFlight } = require("./_providerRuntime");
const {
  boolParam,
  fetchJson,
  methodAllowed,
  numberParam,
  sendJson,
  setParam,
  stringParam,
} = require("./_http");
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
  issueAlertClientCapability,
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
  predictionStatus,
  scoreRoute,
});

function productionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
}

function sampleSourceAllowed() {
  if (process.env.FUEL_PATH_ALLOW_SAMPLE_SOURCE === "1") return true;
  return !productionRuntime();
}

function cacheSeconds() {
  return Math.max(60, Number(process.env.FUEL_PATH_LIVE_CACHE_SECONDS || DEFAULT_CACHE_SECONDS));
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
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
  if (rule.nextReviewAt < todayIsoDate()) return false;
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
  if (!stations.length && !loadedProviders.length) throw new Error(errors.join("; ") || "Live prices are not available for this area yet.");
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
    warning: [...warnings, ...(errors.length ? ["Some live price sources are temporarily unavailable. Confirm prices before driving."] : [])].join(" "),
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
  let snapshots = [];
  let storageError = "";
  try {
    records = await listPredictionBacktestRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
    snapshots = await listPredictionMarketSnapshotRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
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
    snapshots: predictionSnapshotSummary(snapshots),
  };
}

function predictionSignal({ region = "", market = "", fuel = "", historyDays = 0, observedPriceCount = 0 } = {}) {
  const safeRegion = String(region || "").trim().toUpperCase();
  const safeMarket = String(market || "").trim();
  const safeFuel = String(fuel || "").trim().toUpperCase();
  const history = Number(historyDays || 0);
  const observed = Number(observedPriceCount || 0);
  const marketProfile = predictionMarketProfile({ region: safeRegion, market: safeMarket, fuel: safeFuel });

  if (!REGION_ORDER.includes(safeRegion)) {
    return noCycleSignal({ region: safeRegion || "UNKNOWN", fuel: safeFuel, reason: "unsupported_region" });
  }
  if (!marketProfile.supportedFuel) {
    return noCycleSignal({ region: safeRegion, fuel: safeFuel || "UNKNOWN", reason: "unsupported_fuel" });
  }
  if (!marketProfile.cycleSupported) {
    return noCycleSignal({
      region: safeRegion,
      fuel: safeFuel,
      reason: marketProfile.reason,
      market: marketProfile,
    });
  }
  if (history < 28 || observed < 56) {
    return noCycleSignal({ region: safeRegion, fuel: safeFuel, reason: "sparse_history", market: marketProfile });
  }

  const readiness = predictionReadiness([], { durable: false });
  return {
    region: safeRegion,
    fuel: safeFuel,
    market: marketProfile,
    signal: "backtest_required",
    confidence: "low",
    reasons: ["history threshold met, but measured back-test evidence is still required before guidance is enabled"],
    userFacingCopy: "No cycle guidance yet.",
    userFacingPredictionEnabled: readiness.userFacingPredictionEnabled,
    accuracyClaimsAllowed: readiness.accuracyClaimsAllowed,
    readiness,
  };
}

function noCycleSignal({ region, fuel, reason, market }) {
  const labels = {
    unsupported_region: "Fuel Path does not have cycle evidence for this region.",
    unsupported_fuel: "Fuel Path does not have cycle evidence for this fuel.",
    unsupported_cycle_market: "Fuel Path only treats Sydney, Melbourne, Brisbane, Adelaide and Perth/Mandurah as petrol cycle markets.",
    trend_only_market: "Fuel Path may measure local price movement here, but should not call it a petrol price cycle.",
    diesel_or_lpg_trend_only: "Diesel and LPG should use local trend or current-price comparison, not petrol cycle guidance.",
    sparse_history: "Fuel Path needs more price history before showing cycle guidance.",
  };
  return {
    region,
    fuel,
    market: market || predictionMarketProfile({ region, fuel }),
    signal: "no_cycle_signal",
    confidence: "low",
    reasons: [labels[reason] || "Fuel Path does not have enough evidence for cycle guidance."],
    userFacingCopy: "No cycle signal.",
    userFacingPredictionEnabled: false,
    accuracyClaimsAllowed: false,
    readiness: predictionReadiness([], { durable: false }),
  };
}

function predictionMarketProfile({ region = "", market = "", fuel = "" } = {}) {
  const safeRegion = String(region || "").trim().toUpperCase();
  const safeMarket = normaliseCycleMarket(market);
  const safeFuel = String(fuel || "").trim().toUpperCase();
  const unleadedPetrol = ["E10", "U91", "P95", "P98"];
  const trendOnlyFuels = ["DL", "PDL", "LPG"];
  const supportedFuel = [...unleadedPetrol, ...trendOnlyFuels].includes(safeFuel);
  const cycleMarkets = {
    NSW: { labels: ["sydney"], display: "Sydney" },
    VIC: { labels: ["melbourne"], display: "Melbourne" },
    QLD: { labels: ["brisbane"], display: "Brisbane" },
    SA: { labels: ["adelaide"], display: "Adelaide" },
    WA: { labels: ["perth", "mandurah", "perth mandurah"], display: "Perth/Mandurah" },
  };
  const nonCycleCapitals = {
    ACT: "Canberra",
    TAS: "Hobart",
    NT: "Darwin",
  };

  if (!supportedFuel) {
    return {
      region: safeRegion,
      fuel: safeFuel,
      supportedFuel: false,
      cycleSupported: false,
      timingScope: "unsupported_fuel",
      reason: "unsupported_fuel",
      marketLabel: safeMarket,
    };
  }

  if (trendOnlyFuels.includes(safeFuel)) {
    return {
      region: safeRegion,
      fuel: safeFuel,
      supportedFuel: true,
      cycleSupported: false,
      timingScope: "local_trend_only",
      reason: "diesel_or_lpg_trend_only",
      marketLabel: safeMarket || nonCycleCapitals[safeRegion] || safeRegion,
    };
  }

  const supportedMarket = cycleMarkets[safeRegion];
  if (supportedMarket?.labels.includes(safeMarket)) {
    return {
      region: safeRegion,
      fuel: safeFuel,
      supportedFuel: true,
      cycleSupported: true,
      timingScope: "supported_petrol_cycle_market",
      reason: "",
      marketLabel: supportedMarket.display,
      caution:
        safeRegion === "WA"
          ? "WA tomorrow locked prices are official FuelWatch data and must be labelled separately from prediction."
          : "Cycle timing varies and must be backed by measured city-market evidence before user-facing guidance.",
    };
  }

  return {
      region: safeRegion,
    fuel: safeFuel,
    supportedFuel: true,
    cycleSupported: false,
    timingScope: "local_trend_only",
    reason: nonCycleCapitals[safeRegion] || safeMarket ? "trend_only_market" : "unsupported_cycle_market",
    marketLabel: safeMarket || nonCycleCapitals[safeRegion] || safeRegion,
  };
}

function normaliseCycleMarket(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

async function runPredictionMarketBacktestJob({
  limit,
  now = new Date().toISOString(),
  forceRefresh = false,
  dryRun = false,
  loadStationDataFn = loadStationData,
} = {}) {
  const safeNow = isoDateTime(now);
  const today = safeNow.slice(0, 10);
  const tomorrow = dateOffset(today, 1);
  const previousDay = dateOffset(today, -1);
  const allMarkets = predictionMarketBacktestMarkets();
  const requestedLimit = limit === undefined || limit === null || limit === ""
    ? predictionBacktestDailyLimit()
    : Number(limit);
  const safeLimit = Math.max(1, Math.min(allMarkets.length, Number(requestedLimit || predictionBacktestDailyLimit())));
  const results = [];
  const existingRecords = await listPredictionBacktestRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
  const existingSnapshots = await listPredictionMarketSnapshotRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
  const dueKeys = new Set(
    existingRecords
      .filter((record) => record.targetDate === today && Number.isFinite(Number(record.predictedCpl)))
      .map((record) => marketFuelKey(record)),
  );
  const dueMarkets = allMarkets.filter((marketConfig) => dueKeys.has(marketFuelKey(marketConfig)));
  const snapshotStats = predictionSnapshotStats(existingSnapshots);
  const rotatedMarkets = rotateByDay(allMarkets, today)
    .filter((marketConfig) => !dueKeys.has(marketFuelKey(marketConfig)))
    .sort((left, right) => predictionMarketPriority(left, right, snapshotStats, today));
  const markets = selectPredictionCollectionMarkets({
    allMarkets,
    dueMarkets,
    rotatedMarkets,
    dueKeys,
    snapshotStats,
    today,
    limit: safeLimit,
  });
  const batchResult = await maybeRunPredictionMarketBatch({
    markets,
    today,
    tomorrow,
    previousDay,
    safeNow,
    forceRefresh,
    dryRun,
    loadStationDataFn,
    existingRecords,
  });
  if (batchResult) {
    results.push(...batchResult.results);
    const handledKeys = new Set(batchResult.results.map(marketFuelKey));
    markets.splice(0, markets.length, ...markets.filter((marketConfig) => !handledKeys.has(marketFuelKey(marketConfig))));
  }

  for (const marketConfig of markets) {
    try {
      const snapshot = await predictionMarketPriceSnapshot({ marketConfig, forceRefresh, loadStationDataFn });
      if (!snapshot.usable) {
        results.push({ ...marketConfigSummary(marketConfig), status: "skipped", reason: snapshot.reason, snapshot });
        continue;
      }

      results.push(await processPredictionMarketSnapshot({
        marketConfig,
        snapshot,
        today,
        tomorrow,
        previousDay,
        safeNow,
        dryRun,
        existingRecords,
      }));
    } catch (error) {
      results.push({
        ...marketConfigSummary(marketConfig),
        status: "error",
        reason: error instanceof Error ? error.message : "Market back-test failed",
      });
    }
  }

  return {
    accepted: true,
    dryRun: Boolean(dryRun),
    now: safeNow,
    today,
    tomorrow,
    modelVersion: "market-median-persistence-v1",
    results,
    summary: {
      markets: results.length,
      configuredMarkets: allMarkets.length,
      limit: safeLimit,
      ok: results.filter((result) => result.status === "ok").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      errors: results.filter((result) => result.status === "error").length,
      completed: results.filter((result) => result.completedBacktest).length,
      seeded: results.filter((result) => result.seededBacktest).length,
      snapshots: results.filter((result) => result.snapshotId).length,
      status: results.some((result) => result.status === "error")
        ? "degraded"
        : results.every((result) => result.status === "skipped")
          ? "skipped"
          : "ok",
    },
    predictions: await predictionStatus(),
  };
}

async function recordPredictionMarketObservation({
  points = [],
  fuels = [],
  data = {},
  now = new Date().toISOString(),
} = {}) {
  if (!points.length || !fuels.length || !Array.isArray(data.stations) || !data.stations.length) {
    return { accepted: false, reason: "no_reusable_market_station_data", snapshots: [] };
  }
  const safeNow = isoDateTime(now);
  const fuelSet = new Set(fuels.map((fuel) => String(fuel || "").toUpperCase()));
  const snapshots = [];
  const markets = predictionMarketBacktestMarkets().filter((marketConfig) =>
    fuelSet.has(marketConfig.fuel) &&
    points.some((point) => distanceKm(point, marketConfig) <= Math.max(12, marketConfig.radiusKm)),
  );

  for (const marketConfig of markets) {
    const snapshot = predictionMarketSnapshotFromStationData({ marketConfig, data });
    if (!snapshot.usable) continue;
    const record = {
      ...predictionMarketSnapshotRecord({ marketConfig, snapshot, observedAt: safeNow }),
      id: `passive:${marketConfig.market}:${marketConfig.fuel}:${safeNow.slice(0, 13)}`,
    };
    await appendPredictionMarketSnapshotRecord(record);
    snapshots.push(record);
  }

  return {
    accepted: snapshots.length > 0,
    reason: snapshots.length ? "" : "no_supported_market_snapshot_from_reused_data",
    snapshots,
  };
}

async function maybeRunPredictionMarketBatch({
  markets = [],
  today,
  tomorrow,
  previousDay,
  safeNow,
  forceRefresh = false,
  dryRun = false,
  loadStationDataFn = loadStationData,
  existingRecords = [],
} = {}) {
  const results = [];
  let providerCalls = 0;
  for (const group of predictionMarketBatchGroups()) {
    const groupMarkets = markets.filter((marketConfig) => batchGroupIncludesMarket(group, marketConfig));
    if (groupMarkets.length < 2) continue;
    const fuels = [...new Set(groupMarkets.map((marketConfig) => marketConfig.fuel))];
    const base = groupMarkets[0];
    const data = await loadStationDataFn({
      requestedSource: "auto",
      forceRefresh: Boolean(forceRefresh),
      points: [{ lat: base.lat, lon: base.lon, label: base.label }],
      radiusKm: base.radiusKm,
      fuels,
    });
    providerCalls += 1;
    for (const marketConfig of groupMarkets) {
      const snapshot = predictionMarketSnapshotFromStationData({ marketConfig, data });
      if (!snapshot.usable) {
        results.push({ ...marketConfigSummary(marketConfig), status: "skipped", reason: snapshot.reason, snapshot, batch: group.id });
        continue;
      }
      const processed = await processPredictionMarketSnapshot({
        marketConfig,
        snapshot: { ...snapshot, batchProvider: group.id },
        today,
        tomorrow,
        previousDay,
        safeNow,
        dryRun,
        existingRecords,
      });
      results.push({ ...processed, batch: group.id });
    }
  }
  if (!results.length) return null;
  return {
    providerCalls,
    results,
  };
}

async function processPredictionMarketSnapshot({
  marketConfig,
  snapshot,
  today,
  tomorrow,
  previousDay,
  safeNow,
  dryRun = false,
  existingRecords = [],
} = {}) {
  const snapshotRecord = predictionMarketSnapshotRecord({ marketConfig, snapshot, observedAt: safeNow });
  if (!dryRun) await appendPredictionMarketSnapshotRecord(snapshotRecord);

  const dueId = predictionMarketBacktestId({ market: marketConfig.market, fuel: marketConfig.fuel, targetDate: today });
  const due = existingRecords.find((record) => record.id === dueId);
  let completed = null;
  if (due?.predictedCpl && !dryRun) {
    completed = await recordPredictionBacktest({
      id: due.id,
      region: marketConfig.region,
      market: marketConfig.market,
      fuel: marketConfig.fuel,
      predictionDate: due.predictionDate || previousDay,
      targetDate: today,
      modelVersion: due.modelVersion || "market-median-persistence-v1",
      predictedCpl: due.predictedCpl,
      actualCpl: snapshot.medianCpl,
      predictedDirection: due.predictedDirection || "flat",
      actualDirection: directionFromDelta(snapshot.medianCpl - Number(due.predictedCpl)),
    });
  }

  const seedId = predictionMarketBacktestId({ market: marketConfig.market, fuel: marketConfig.fuel, targetDate: tomorrow });
  const alreadySeeded = existingRecords.some((record) => record.id === seedId);
  let seeded = null;
  if (!alreadySeeded && !dryRun) {
    seeded = await recordPredictionBacktest({
      id: seedId,
      region: marketConfig.region,
      market: marketConfig.market,
      fuel: marketConfig.fuel,
      predictionDate: today,
      targetDate: tomorrow,
      modelVersion: "market-median-persistence-v1",
      predictedCpl: snapshot.medianCpl,
      predictedDirection: "flat",
    });
  }

  return {
    ...marketConfigSummary(marketConfig),
    status: "ok",
    snapshot,
    completedBacktest: completed ? completed.record.id : due?.predictedCpl ? "dry_run" : "",
    seededBacktest: seeded ? seeded.record.id : alreadySeeded ? "already_seeded" : dryRun ? "dry_run" : "",
    snapshotId: dryRun ? "dry_run" : snapshotRecord.id,
  };
}

function normalisePredictionBacktestRecord(input) {
  const id = String(input.id || `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).trim();
  const region = String(input.region || "").trim().toUpperCase();
  const market = normaliseCycleMarket(input.market || "");
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
    id: /^[a-zA-Z0-9:_-]{8,120}$/.test(id) ? id : `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    region,
    market,
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

function predictionMarketBacktestMarkets() {
  return [
    market("NSW", "sydney", "Sydney", -33.8688, 151.2093),
    market("VIC", "melbourne", "Melbourne", -37.8136, 144.9631),
    market("QLD", "brisbane", "Brisbane", -27.4698, 153.0251),
    market("SA", "adelaide", "Adelaide", -34.9285, 138.6007),
    market("WA", "perth", "Perth/Mandurah", -31.9523, 115.8613),
  ].flatMap((base) => ["E10", "U91", "P95", "P98"].map((fuel) => ({ ...base, fuel })));
}

function selectPredictionCollectionMarkets({
  allMarkets = [],
  dueMarkets = [],
  rotatedMarkets = [],
  dueKeys = new Set(),
  snapshotStats = {},
  today = "",
  limit = 5,
} = {}) {
  const selected = [];
  const selectedKeys = new Set();
  const safeLimit = Math.max(1, Math.min(allMarkets.length || 1, Number(limit || 5)));

  for (const group of predictionMarketBatchGroups()) {
    const groupMarkets = allMarkets.filter((marketConfig) => batchGroupIncludesMarket(group, marketConfig));
    if (!groupMarkets.length || groupMarkets.length > safeLimit) continue;
    const groupDue = groupMarkets.some((marketConfig) => dueKeys.has(marketFuelKey(marketConfig)));
    const groupScheduled = predictionBatchGroupScheduledToday(group, today);
    const groupStale = groupMarkets.some((marketConfig) => (snapshotStats[marketFuelKey(marketConfig)] || {}).latestDate !== today);
    if ((groupDue || groupScheduled && groupStale) && selected.length + groupMarkets.length <= safeLimit) {
      for (const marketConfig of groupMarkets) {
        const key = marketFuelKey(marketConfig);
        selected.push(marketConfig);
        selectedKeys.add(key);
      }
    }
  }

  for (const marketConfig of [...dueMarkets, ...rotatedMarkets]) {
    if (selected.length >= safeLimit) break;
    const key = marketFuelKey(marketConfig);
    if (selectedKeys.has(key)) continue;
    selected.push(marketConfig);
    selectedKeys.add(key);
  }

  return selected;
}

function predictionMarketBatchGroups() {
  return [
    {
      id: "sydney_nsw_pilot",
      region: "NSW",
      market: "sydney",
      fuels: ["E10", "U91", "P95", "P98"],
      intervalDays: 4,
      offset: 0,
    },
    {
      id: "brisbane_qld_pilot",
      region: "QLD",
      market: "brisbane",
      fuels: ["E10", "U91", "P95", "P98"],
      intervalDays: 4,
      offset: 3,
    },
    {
      id: "adelaide_sa_pilot",
      region: "SA",
      market: "adelaide",
      fuels: ["E10", "U91", "P95", "P98"],
      intervalDays: 4,
      offset: 2,
    },
  ];
}

function batchGroupIncludesMarket(group, marketConfig) {
  return (
    marketConfig.region === group.region &&
    marketConfig.market === group.market &&
    group.fuels.includes(marketConfig.fuel)
  );
}

function predictionBatchGroupScheduledToday(group, today) {
  const parsed = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const dayIndex = Math.floor(parsed.getTime() / 86400000);
  return (dayIndex + Number(group.offset || 0)) % Math.max(1, Number(group.intervalDays || 1)) === 0;
}

function market(region, market, label, lat, lon) {
  return {
    region,
    market,
    label,
    lat,
    lon,
    radiusKm: region === "WA" ? 45 : 35,
  };
}

async function predictionMarketPriceSnapshot({ marketConfig, forceRefresh = false, loadStationDataFn = loadStationData }) {
  const data = await loadStationDataFn({
    requestedSource: "auto",
    forceRefresh: Boolean(forceRefresh),
    points: [{ lat: marketConfig.lat, lon: marketConfig.lon, label: marketConfig.label }],
    radiusKm: marketConfig.radiusKm,
    fuels: [marketConfig.fuel],
  });
  return predictionMarketSnapshotFromStationData({ marketConfig, data });
}

function predictionMarketSnapshotFromStationData({ marketConfig, data }) {
  const prices = (data.stations || [])
    .map((station) => Number(station?.prices?.[marketConfig.fuel]))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((left, right) => left - right);
  if (prices.length < 8) {
    return {
      usable: false,
      reason: "insufficient_exact_market_prices",
      exactPriceCount: prices.length,
      provider: data.provider || data.source || "",
      cacheMode: data.cacheMode || "",
      warning: data.warning || "",
    };
  }
  return {
    usable: true,
    exactPriceCount: prices.length,
    medianCpl: median(prices),
    lowCpl: prices[0],
    highCpl: prices[prices.length - 1],
    provider: data.provider || data.source || "",
    capability: data.capability || "",
    cacheMode: data.cacheMode || "",
    cacheAgeSeconds: Number.isFinite(Number(data.cacheAgeSeconds)) ? Number(data.cacheAgeSeconds) : null,
    warning: data.warning || "",
  };
}

function predictionMarketBacktestId({ market, fuel, targetDate }) {
  return `market:${normaliseCycleMarket(market)}:${String(fuel || "").toUpperCase()}:${targetDate}`;
}

function predictionMarketSnapshotRecord({ marketConfig, snapshot, observedAt }) {
  const observedDate = String(observedAt || new Date().toISOString()).slice(0, 10);
  return {
    id: `snapshot:${marketConfig.market}:${marketConfig.fuel}:${observedDate}`,
    region: marketConfig.region,
    market: marketConfig.market,
    fuel: marketConfig.fuel,
    observedDate,
    observedAt,
    medianCpl: snapshot.medianCpl,
    lowCpl: snapshot.lowCpl,
    highCpl: snapshot.highCpl,
    exactPriceCount: snapshot.exactPriceCount,
    provider: snapshot.provider || "",
    capability: snapshot.capability || "",
    cacheMode: snapshot.cacheMode || "",
    cacheAgeSeconds: snapshot.cacheAgeSeconds,
    warning: snapshot.warning || "",
  };
}

function predictionBacktestDailyLimit() {
  const configured = Number(process.env.FUEL_PATH_PREDICTION_BACKTEST_DAILY_LIMIT || 5);
  return Number.isFinite(configured) ? Math.max(1, Math.min(20, Math.floor(configured))) : 5;
}

function rotateByDay(items = [], dateOnlyValue = "") {
  if (!items.length) return [];
  const parsed = new Date(`${dateOnlyValue}T00:00:00Z`);
  const dayIndex = Number.isNaN(parsed.getTime()) ? 0 : Math.floor(parsed.getTime() / 86400000);
  const offset = dayIndex % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function marketConfigSummary(config) {
  return {
    region: config.region,
    market: config.market,
    label: config.label,
    fuel: config.fuel,
  };
}

function marketFuelKey(value = {}) {
  return `${normaliseCycleMarket(value.market)}:${String(value.fuel || "").toUpperCase()}`;
}

function predictionSnapshotStats(snapshots = []) {
  const stats = {};
  for (const snapshot of snapshots) {
    const key = marketFuelKey(snapshot);
    const current = stats[key] || { count: 0, latestDate: "" };
    current.count += 1;
    if (!current.latestDate || String(snapshot.observedDate || "") > current.latestDate) {
      current.latestDate = snapshot.observedDate || "";
    }
    stats[key] = current;
  }
  return stats;
}

function predictionMarketPriority(left, right, snapshotStats, today) {
  const leftStats = snapshotStats[marketFuelKey(left)] || { count: 0, latestDate: "" };
  const rightStats = snapshotStats[marketFuelKey(right)] || { count: 0, latestDate: "" };
  const leftObservedToday = leftStats.latestDate === today ? 1 : 0;
  const rightObservedToday = rightStats.latestDate === today ? 1 : 0;
  return leftObservedToday - rightObservedToday || leftStats.count - rightStats.count;
}

function median(values = []) {
  if (!values.length) return undefined;
  const midpoint = Math.floor(values.length / 2);
  const value = values.length % 2 ? values[midpoint] : (values[midpoint - 1] + values[midpoint]) / 2;
  return round(value, 2);
}

function directionFromDelta(delta) {
  if (!Number.isFinite(delta)) return "unknown";
  if (delta > 1) return "up";
  if (delta < -1) return "down";
  return "flat";
}

function dateOffset(dateOnlyValue, days) {
  const parsed = new Date(`${dateOnlyValue}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  parsed.setUTCDate(parsed.getUTCDate() + Number(days || 0));
  return parsed.toISOString().slice(0, 10);
}

function predictionBacktestSummary(records = []) {
  const completed = records.filter((record) => Number.isFinite(record.absoluteErrorCpl));
  const marketScopedCompleted = completed.filter((record) => record.market);
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
  const byMarket = {};
  for (const record of records) {
    if (record.market) byMarket[record.market] = (byMarket[record.market] || 0) + 1;
  }
  return {
    sampleSize: records.length,
    completedSampleSize: completed.length,
    marketScopedCompletedSampleSize: marketScopedCompleted.length,
    meanAbsoluteErrorCpl: mae,
    directionSampleSize: directionRecords.length,
    directionAccuracy,
    byRegion,
    byMarket,
    accuracyClaimsAllowed: predictionReadiness(records, { durable: false }).accuracyClaimsAllowed,
  };
}

function predictionSnapshotSummary(snapshots = []) {
  const byMarket = {};
  const byFuel = {};
  let latestObservedAt = "";
  for (const snapshot of snapshots) {
    const key = marketFuelKey(snapshot);
    byMarket[key] = (byMarket[key] || 0) + 1;
    byFuel[snapshot.fuel] = (byFuel[snapshot.fuel] || 0) + 1;
    if (!latestObservedAt || String(snapshot.observedAt || "") > latestObservedAt) latestObservedAt = snapshot.observedAt || "";
  }
  return {
    sampleSize: snapshots.length,
    latestObservedAt,
    byMarket,
    byFuel,
  };
}

function predictionReadiness(records = [], storage = {}) {
  const completed = records.filter((record) => Number.isFinite(record.absoluteErrorCpl));
  const directionRecords = records.filter((record) => typeof record.directionMatched === "boolean");
  const marketScopedCompleted = completed.filter((record) => record.market);
  const marketScopedDirectionRecords = directionRecords.filter((record) => record.market);
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
    ...(marketScopedCompleted.length >= thresholds.completedSampleSize &&
    marketScopedDirectionRecords.length >= thresholds.directionSampleSize
      ? []
      : ["prediction_market_scope_missing"]),
    ...(completed.length >= thresholds.completedSampleSize ? [] : ["prediction_completed_sample_below_threshold"]),
    ...(directionRecords.length >= thresholds.directionSampleSize ? [] : ["prediction_direction_sample_below_threshold"]),
    ...(Number.isFinite(meanAbsoluteErrorCpl) && meanAbsoluteErrorCpl <= thresholds.maxMeanAbsoluteErrorCpl ? [] : ["prediction_mae_above_threshold_or_missing"]),
    ...(Number.isFinite(directionAccuracy) && directionAccuracy >= thresholds.minDirectionAccuracy ? [] : ["prediction_direction_accuracy_below_threshold_or_missing"]),
  ];
  return {
    status: blockers.length ? "measurement_only" : "ready_for_limited_cycle_guidance",
    thresholds,
    completedSampleSize: completed.length,
    marketScopedCompletedSampleSize: marketScopedCompleted.length,
    directionSampleSize: directionRecords.length,
    marketScopedDirectionSampleSize: marketScopedDirectionRecords.length,
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
    "Current back-test records are state/fuel scoped. Limited cycle guidance needs market/fuel scoped evidence before launch.",
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
  issueAlertClientCapability,
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
  recordPredictionMarketObservation,
  recordPredictionBacktest,
  retentionCleanupAuthorised,
  routeContextStations,
  routeFromPayload,
  routeProviderStatus,
  runPredictionMarketBacktestJob,
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
