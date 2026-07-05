const {
  googlePlacesEvDailyCap,
  googlePlacesEvHardStopPercent,
  googlePlacesEvSoftWarningPercent,
} = require("./_evGooglePlaces");
const {
  geocodeQuotaStorageStatus,
  getGeocodeQuotaUsage,
} = require("./_geocodeQuotaStorage");
const { evRouteChargingTelemetrySnapshot } = require("./_evProviderTelemetry");
const { supportedEvProviders } = require("./_evOpenChargeMap");
const {
  isOpenWebNinjaRateLimited,
  openWebNinjaRateLimitRemainingMs,
  openWebNinjaRateLimitUntilIso,
  openWebNinjaRateLimitReason,
} = require("./_evProviderState");

const EV_PROVIDER_IDS = [
  "google_places_ev",
  "open_charge_map",
  "openweb_ninja",
  "api_ninjas",
  "plugshare",
  "here",
  "mapbox",
  "tomtom",
  "network_partner",
  "list",
];

function defaultEvProvider() {
  const configured = String(process.env.FUEL_PATH_EV_DEFAULT_PROVIDER || "").trim().toLowerCase();
  if (configured) return normaliseEvProvider(configured);
  if (googlePlacesEvConfigured()) return "google_places_ev";
  if (process.env.OPEN_CHARGE_MAP_API_KEY) return "open_charge_map";
  if (process.env.OPENWEB_NINJA_API_KEY) return "openweb_ninja";
  if (process.env.API_NINJAS_API_KEY) return "api_ninjas";
  return "api_ninjas";
}

function normaliseEvProvider(value) {
  const provider = String(value || defaultEvProvider()).trim().toLowerCase();
  if (EV_PROVIDER_IDS.includes(provider)) return provider;
  throw new Error("provider must be google_places_ev, open_charge_map, openweb_ninja, api_ninjas, plugshare, here, mapbox, tomtom, network_partner or list");
}

function evChargingStatus() {
  const provider = defaultEvProvider();
  const apiNinjasConfigured = Boolean(process.env.API_NINJAS_API_KEY);
  const googlePlacesEvConfiguredValue = googlePlacesEvConfigured();
  const googlePlacesEvEnabled = process.env.FUEL_PATH_GOOGLE_PLACES_EV_ENABLED === "1";
  const googlePlacesEvQuotaStorage = geocodeQuotaStorageStatus();
  const googlePlacesEvCap = googlePlacesEvDailyCap();
  const googlePlacesEvBlockers = googlePlacesEvReadinessBlockers({
    configured: googlePlacesEvConfiguredValue,
    dailyCap: googlePlacesEvCap,
    enabled: googlePlacesEvEnabled,
    quotaStorage: googlePlacesEvQuotaStorage,
  });
  const openWebNinjaConfigured = Boolean(process.env.OPENWEB_NINJA_API_KEY);
  const openChargeMapConfigured = Boolean(process.env.OPEN_CHARGE_MAP_API_KEY);
  const configured = evProviderConfigured(provider);
  const openWebNinjaRateLimited = isOpenWebNinjaRateLimited();
  return {
    provider,
    configured,
    capability: configured ? "prototype_live_capable" : "prototype_not_configured",
    defaultProvider: provider,
    providerSelection: "explicit_default_else_google_places_ev_if_enabled_else_open_charge_map_if_configured_else_openweb_ninja_if_configured_else_api_ninjas_fallback; zero-result and thin-result cascade tries configured Google Places EV, Open Charge Map, OpenWeb Ninja (unless de-prioritised by rate-limit cooldown), then API Ninjas unless overridden",
    apiNinjasConfigured,
    googlePlacesEvConfigured: googlePlacesEvConfiguredValue,
    googlePlacesEvCostControls: {
      enabled: googlePlacesEvEnabled,
      billableRequestsEnabled: googlePlacesEvConfiguredValue,
      dailyCap: googlePlacesEvCap,
      quotaKey: "google_places_ev",
      quotaStorageMode: googlePlacesEvQuotaStorage.mode || "",
      quotaStorageDurable: Boolean(googlePlacesEvQuotaStorage.durable),
      keyRestrictionConfirmed: process.env.FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED === "1",
      budgetAlertConfirmed: process.env.FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED === "1",
      status: !googlePlacesEvEnabled ? "disabled" : googlePlacesEvBlockers.length ? "blocked" : "ready",
      blockers: googlePlacesEvBlockers,
      warning: googlePlacesEvQuotaStorage.warning || "",
    },
    openWebNinjaConfigured,
    openWebNinjaRateLimited,
    openWebNinjaRateLimitRemainingMs: openWebNinjaRateLimited ? openWebNinjaRateLimitRemainingMs() : 0,
    openWebNinjaRateLimitUntil: openWebNinjaRateLimited ? openWebNinjaRateLimitUntilIso() : "",
    openWebNinjaRateLimitReason: openWebNinjaRateLimited ? openWebNinjaRateLimitReason() : "",
    openChargeMapConfigured,
    realTimeAvailability: false,
    liveAvailabilityClaimsAllowed: false,
    coverage: "EV charger directory search and sampled-route fallback. No live bay availability claims.",
    warning: configured
      ? "EV charger directory data is enabled, but power, tariff and live bay availability may be incomplete. Confirm in the charging network app before driving."
      : "No EV charger provider key is configured. API Ninjas is the default prototype path; add API_NINJAS_API_KEY for live directory results.",
    providers: supportedEvProviders(),
  };
}

async function evChargingStatusWithTelemetry({ date = new Date().toISOString().slice(0, 10) } = {}) {
  const status = evChargingStatus();
  const hardStopPercent = googlePlacesEvHardStopPercent();
  const softWarningPercent = googlePlacesEvSoftWarningPercent();
  const cap = Number(status.googlePlacesEvCostControls?.dailyCap || 0);
  const usage = await safeGeocodeQuotaUsage({ quotaKey: "google_places_ev", date });
  const capUsed = Number(usage?.calls || 0);
  const capRemaining = cap > 0 ? Math.max(0, cap - capUsed) : 0;
  const capUsagePercent = cap > 0 ? Number(((capUsed / cap) * 100).toFixed(2)) : 0;
  const stopGateEnabled = hardStopPercent > 0;
  const hardStopThreshold = stopGateEnabled && cap > 0 ? Math.ceil(cap * (hardStopPercent / 100)) : 0;
  const hardStopActive = stopGateEnabled && cap > 0 && capUsed >= hardStopThreshold;
  const softWarningEnabled = softWarningPercent > 0;
  const softWarningThreshold = softWarningEnabled && cap > 0 ? Math.ceil(cap * (softWarningPercent / 100)) : 0;
  const softWarningActive = softWarningEnabled && cap > 0 && capUsed >= softWarningThreshold && !hardStopActive;
  const telemetry = evRouteChargingTelemetrySnapshot();
  const capHitLookups = telemetry.capHitLookups || 0;
  const routeSignal = googlePlacesRouteSignalHealth({
    telemetry,
    enabled: status.googlePlacesEvCostControls.enabled,
    configured: status.googlePlacesEvCostControls.billableRequestsEnabled,
  });
  const isGooglePlacesBlockedByPolicy = hardStopActive && status.googlePlacesEvCostControls.enabled && status.googlePlacesEvCostControls.billableRequestsEnabled;
  const policyBlockers = isGooglePlacesBlockedByPolicy
    ? [...new Set([...(status.googlePlacesEvCostControls.blockers || []), "google_places_ev_hard_stop_reached"])]
    : [...(status.googlePlacesEvCostControls.blockers || [])];
  for (const blocker of routeSignal.blockers) {
    if (!policyBlockers.includes(blocker)) policyBlockers.push(blocker);
  }
  const effectiveGooglePlacesStatus =
    !status.googlePlacesEvCostControls.enabled
      ? "disabled"
      : policyBlockers.length > 0
        ? "blocked"
        : "ready";
  status.googlePlacesEvCostControls = {
    ...status.googlePlacesEvCostControls,
    blockers: policyBlockers,
    status: effectiveGooglePlacesStatus,
    hardStop: {
      enabled: hardStopPercent > 0,
      thresholdPercent: hardStopPercent,
      hardStopAtCalls: hardStopThreshold,
      active: hardStopActive,
      reason: hardStopActive
        ? "google_places_ev_daily_cap_soft_threshold_reached"
        : "",
    },
    softWarning: {
      enabled: softWarningPercent > 0,
      thresholdPercent: softWarningPercent,
      warnAtCalls: softWarningThreshold,
      active: softWarningActive,
      reason: softWarningActive
        ? "google_places_ev_daily_cap_soft_warning_reached"
        : "",
    },
    date: usage?.date || date,
    capUsed,
    capRemaining,
    capUsagePercent,
    fallbackCalls: telemetry.fallbackCalls || 0,
    failedLookups: telemetry.failedLookups || 0,
    routeChargingRequestSamples: routeSignal.routeChargingRequestSamples,
    passRatePercent: routeSignal.passRatePercent,
    fallbackRatePercent: routeSignal.fallbackRatePercent,
    emptyResultRatePercent: routeSignal.emptyResultRatePercent,
    signalThresholds: routeSignal.thresholds,
    signalBlockers: routeSignal.blockers,
    capHitLookups,
    lastFailureAt: telemetry.lastFailureAt || "",
    lastFailureProvider: telemetry.lastFailureProvider || "",
    providerCalls: telemetry.providerCalls || {},
    providerSuccesses: telemetry.providerSuccesses || {},
    providerEmptyLookups: telemetry.providerEmptyLookups || {},
    providerFailures: telemetry.providerFailures || {},
    providerPolicyBlocks: telemetry.providerPolicyBlocks || {},
  };
  return status;
}

async function safeGeocodeQuotaUsage({ quotaKey, date }) {
  try {
    return await getGeocodeQuotaUsage({ quotaKey, date });
  } catch (error) {
    return {
      quotaKey,
      date,
      calls: 0,
      durable: false,
      warning: `quota_usage_unavailable:${String(error?.message || "unknown").slice(0, 120)}`,
    };
  }
}

function googlePlacesRouteSignalHealth({
  telemetry = {},
  enabled = false,
  configured = false,
} = {}) {
  const signalEnabled = String(process.env.FUEL_PATH_GOOGLE_PLACES_EV_QUALITY_GUARD_ENABLED || "1") === "1";
  const sampleMinimum = parsePositiveInteger(
    process.env.FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_SAMPLE_MIN,
    100,
  );
  const passRateMinPercent = parsePercent(
    process.env.FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_PASS_RATE_MIN_PERCENT,
    85,
  );
  const fallbackRatioMaxPercent = parsePercent(
    process.env.FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_FALLBACK_RATIO_MAX_PERCENT,
    65,
  );
  const emptyResultMaxPercent = parsePercent(
    process.env.FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_EMPTY_RESULT_MAX_PERCENT,
    60,
  );
  const routeChargingRequests = Number(telemetry.routeChargingRequests || 0);
  const fallbackCalls = Number(telemetry.fallbackCalls || 0);
  const providerCalls = Number(telemetry.providerCalls?.google_places_ev || 0);
  const providerSuccesses = Number(telemetry.providerSuccesses?.google_places_ev || 0);
  const providerFailures = Number(telemetry.providerFailures?.google_places_ev || 0);
  const emptyResultCount = Number(telemetry.providerEmptyLookups?.google_places_ev || 0);
  const passRatePercent =
    providerCalls > 0
      ? Number((((providerCalls - providerFailures) / providerCalls) * 100).toFixed(2))
      : 100;
  const fallbackRatePercent =
    routeChargingRequests > 0
      ? Number(((fallbackCalls / routeChargingRequests) * 100).toFixed(2))
      : 0;
  const emptyResultRatePercent =
    providerSuccesses > 0
      ? Number(((emptyResultCount / providerSuccesses) * 100).toFixed(2))
      : 0;
  const blockers = [];
  if (!signalEnabled || !enabled || !configured || !routeChargingRequests) return {
    enabled: signalEnabled && enabled && configured,
    sampleMinimum,
    passRateMinPercent,
    fallbackRatioMaxPercent,
    emptyResultMaxPercent,
    routeChargingRequestSamples: routeChargingRequests,
    passRatePercent,
    fallbackRatePercent,
    emptyResultRatePercent,
    blockers,
  };
  if (routeChargingRequests < sampleMinimum) return {
    enabled: signalEnabled && enabled && configured,
    sampleMinimum,
    passRateMinPercent,
    fallbackRatioMaxPercent,
    emptyResultMaxPercent,
    routeChargingRequestSamples: routeChargingRequests,
    passRatePercent,
    fallbackRatePercent,
    emptyResultRatePercent,
    blockers,
  };
  if (passRatePercent < passRateMinPercent) blockers.push("google_places_ev_pass_rate_below_threshold");
  if (fallbackRatePercent > fallbackRatioMaxPercent) blockers.push("google_places_ev_fallback_ratio_above_threshold");
  if (emptyResultRatePercent > emptyResultMaxPercent) blockers.push("google_places_ev_empty_result_ratio_above_threshold");
  return {
    enabled: true,
    sampleMinimum,
    passRateMinPercent,
    fallbackRatioMaxPercent,
    emptyResultMaxPercent,
    routeChargingRequestSamples: routeChargingRequests,
    passRatePercent,
    fallbackRatePercent,
    emptyResultRatePercent,
    blockers,
  };
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function parsePercent(value, fallback, min = 0, max = 100) {
  const parsed = Number(String(value || "").trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function canUseGooglePlacesEvForRouteCharging() {
  return googlePlacesRouteChargingDecision({ includeSignalMetrics: false }).allowed;
}

function googlePlacesRouteChargingDecision({ includeSignalMetrics = false } = {}) {
  const status = evChargingStatus();
  const qualityDecision = googlePlacesRouteSignalHealth({
    telemetry: evRouteChargingTelemetrySnapshot(),
    enabled: status.googlePlacesEvCostControls?.enabled,
    configured: status.googlePlacesEvCostControls?.billableRequestsEnabled,
  });
  const readinessBlocked = status.googlePlacesEvCostControls?.status !== "ready";
  if (readinessBlocked) {
    return {
      allowed: false,
      blockers: status.googlePlacesEvCostControls?.blockers || [],
      ...(includeSignalMetrics ? { signal: qualityDecision } : {}),
    };
  }
  if (qualityDecision.enabled && qualityDecision.blockers.length > 0) {
    return {
      allowed: false,
      blockers: [...qualityDecision.blockers],
      ...(includeSignalMetrics ? { signal: qualityDecision } : {}),
    };
  }
  return { allowed: true, blockers: [], ...(includeSignalMetrics ? { signal: qualityDecision } : {}) };
}

function googlePlacesEvReadinessBlockers({ configured, dailyCap, enabled, quotaStorage }) {
  if (!enabled) return [];
  const blockers = [];
  if (!configured) blockers.push("google_places_ev_key_not_configured");
  if (dailyCap <= 0) blockers.push("google_places_ev_daily_cap_not_set");
  if (productionRuntime() && !quotaStorage?.durable) blockers.push("google_places_ev_quota_storage_not_durable");
  if (process.env.FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED !== "1") blockers.push("google_places_ev_key_restriction_not_confirmed");
  if (process.env.FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED !== "1") blockers.push("google_places_ev_budget_alert_not_confirmed");
  return blockers;
}

function productionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
}

function evProviderConfigured(provider) {
  if (provider === "google_places_ev") return googlePlacesEvConfigured();
  if (provider === "api_ninjas") return Boolean(process.env.API_NINJAS_API_KEY);
  if (provider === "openweb_ninja") return Boolean(process.env.OPENWEB_NINJA_API_KEY) && !isOpenWebNinjaRateLimited();
  if (provider === "open_charge_map") return Boolean(process.env.OPEN_CHARGE_MAP_API_KEY);
  return false;
}

function fallbackEvProviders(provider) {
  const configured = String(process.env.FUEL_PATH_EV_CASCADE_PROVIDERS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map(normaliseEvProvider)
    .filter((item) => item !== "list");
  if (configured.length) {
    return configured
      .filter((item) => item !== provider)
      .filter((item) => item !== "openweb_ninja" || !isOpenWebNinjaRateLimited());
  }
  return ["google_places_ev", "open_charge_map", "openweb_ninja", "api_ninjas"]
    .filter((item) => item !== provider)
    .filter((item) => item !== "openweb_ninja" || !isOpenWebNinjaRateLimited());
}

function googlePlacesEvConfigured() {
  const enabled = process.env.FUEL_PATH_GOOGLE_PLACES_EV_ENABLED === "1";
  const key = process.env.FUEL_PATH_GOOGLE_PLACES_EV_API_KEY ||
    process.env.FUEL_PATH_GOOGLE_PLACES_API_KEY ||
    process.env.FUEL_PATH_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;
  return enabled && Boolean(key);
}

module.exports = {
  defaultEvProvider,
  evChargingStatus,
  evChargingStatusWithTelemetry,
  evProviderConfigured,
  fallbackEvProviders,
  googlePlacesEvConfigured,
  googlePlacesRouteChargingDecision,
  googlePlacesEvReadinessBlockers,
  canUseGooglePlacesEvForRouteCharging,
  googlePlacesRouteSignalHealth,
  normaliseEvProvider,
};
