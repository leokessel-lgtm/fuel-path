const TELEMETRY_SINGLETON_KEY = "__fuel_path_ev_route_charging_telemetry__";

function createMetricsState() {
  return {
    routeChargingRequests: 0,
    fallbackCalls: 0,
    failedLookups: 0,
    capHitLookups: 0,
    providerCalls: {},
    providerSuccesses: {},
    providerEmptyLookups: {},
    providerFailures: {},
  providerPolicyBlocks: {},
  lastFailureAt: "",
  lastFailureProvider: "",
  lastFailureReason: "",
  startedAt: new Date().toISOString(),
};
}

const METRICS = globalThis[TELEMETRY_SINGLETON_KEY] || createMetricsState();
globalThis[TELEMETRY_SINGLETON_KEY] = METRICS;

function resetEvRouteChargingTelemetry() {
  const fresh = createMetricsState();
  METRICS.routeChargingRequests = fresh.routeChargingRequests;
  METRICS.fallbackCalls = fresh.fallbackCalls;
  METRICS.failedLookups = fresh.failedLookups;
  METRICS.capHitLookups = fresh.capHitLookups;
  METRICS.providerCalls = fresh.providerCalls;
  METRICS.providerSuccesses = fresh.providerSuccesses;
  METRICS.providerEmptyLookups = fresh.providerEmptyLookups;
  METRICS.providerFailures = fresh.providerFailures;
  METRICS.providerPolicyBlocks = fresh.providerPolicyBlocks;
  METRICS.lastFailureAt = fresh.lastFailureAt;
  METRICS.lastFailureProvider = fresh.lastFailureProvider;
  METRICS.lastFailureReason = fresh.lastFailureReason;
  METRICS.startedAt = fresh.startedAt;
}

function incrementRouteChargingRequest() {
  METRICS.routeChargingRequests += 1;
}

function recordEvRouteChargingAttempt({ provider, isFallback = false }) {
  const key = String(provider || "").trim();
  if (!key) return;
  METRICS.providerCalls[key] = (METRICS.providerCalls[key] || 0) + 1;
  if (isFallback) METRICS.fallbackCalls += 1;
}

function recordEvRouteChargingFailure({ provider = "", reason = "", isCapHit = false }) {
  METRICS.failedLookups += 1;
  if (isCapHit) METRICS.capHitLookups += 1;
  const providerName = String(provider || "").trim();
  if (providerName) {
    METRICS.providerFailures[providerName] = (METRICS.providerFailures[providerName] || 0) + 1;
  }
  if (providerName) METRICS.lastFailureProvider = providerName;
  METRICS.lastFailureAt = new Date().toISOString();
  METRICS.lastFailureReason = String(reason || "").slice(0, 200);
}

function recordEvRouteChargingResult({
  provider = "",
  chargersCount = 0,
  cacheMode = "",
}) {
  const providerName = String(provider || "").trim();
  if (!providerName) return;
  const normalisedMode = String(cacheMode || "").trim().toLowerCase();
  if (normalisedMode === "provider_error" || normalisedMode === "rate_limited") return;
  METRICS.providerSuccesses[providerName] = (METRICS.providerSuccesses[providerName] || 0) + 1;
  if (Number(chargersCount || 0) <= 0) {
    METRICS.providerEmptyLookups[providerName] = (METRICS.providerEmptyLookups[providerName] || 0) + 1;
  }
}

function recordEvRouteChargingPolicyBlock({ provider = "", reason = "" }) {
  const providerName = String(provider || "").trim();
  if (!providerName) return;
  METRICS.providerPolicyBlocks[providerName] = (METRICS.providerPolicyBlocks[providerName] || 0) + 1;
  METRICS.lastFailureProvider = providerName;
  METRICS.lastFailureAt = new Date().toISOString();
  METRICS.lastFailureReason = String(reason || "provider lookup paused by route quality guard").slice(0, 200);
}

function evRouteChargingTelemetrySnapshot() {
  return {
    startedAt: METRICS.startedAt,
    routeChargingRequests: METRICS.routeChargingRequests,
    fallbackCalls: METRICS.fallbackCalls,
    failedLookups: METRICS.failedLookups,
    capHitLookups: METRICS.capHitLookups,
    providerCalls: { ...METRICS.providerCalls },
    providerSuccesses: { ...METRICS.providerSuccesses },
    providerEmptyLookups: { ...METRICS.providerEmptyLookups },
    providerFailures: { ...METRICS.providerFailures },
    providerPolicyBlocks: { ...METRICS.providerPolicyBlocks },
    lastFailureAt: METRICS.lastFailureAt,
    lastFailureProvider: METRICS.lastFailureProvider,
    lastFailureReason: METRICS.lastFailureReason || "",
};
}

module.exports = {
  incrementRouteChargingRequest,
  recordEvRouteChargingAttempt,
  recordEvRouteChargingFailure,
  recordEvRouteChargingResult,
  recordEvRouteChargingPolicyBlock,
  evRouteChargingTelemetrySnapshot,
  resetEvRouteChargingTelemetry,
};
