const {
  googlePlacesDailyCap,
  googlePlacesBudgetAlertConfirmed,
  googlePlacesKeyRestricted,
} = require("./_geocodeProviders");
const {
  geocodeQuotaStorageStatus,
  getGeocodeQuotaUsage,
} = require("./_geocodeQuotaStorage");

async function providerObservabilityStatus({
  date = new Date().toISOString().slice(0, 10),
  evCharging = {},
  geocoding = {},
} = {}) {
  const quotaStorage = geocodeQuotaStorageStatus();
  const geocodeCap = googlePlacesDailyCap();
  const geocodeUsage = await safeQuotaUsage({ quotaKey: "google_places_fallback", date });
  const evControls = evCharging.googlePlacesEvCostControls || {};
  const paidLookups = [
    lookupBudget({
      cap: geocodeCap,
      configured: Boolean(geocoding.googlePlacesConfigured),
      enabled: Boolean(geocoding.paidFallbackEnabled && geocoding.googlePlacesConfigured),
      key: "google_places_fallback",
      label: "Google Places geocode fallback",
      quotaStorage,
      statusBlockers: geocodeBlockers({ geocoding, quotaStorage, cap: geocodeCap }),
      used: Number(geocodeUsage?.calls || 0),
    }),
    lookupBudget({
      cap: Number(evControls.dailyCap || 0),
      configured: Boolean(evControls.billableRequestsEnabled),
      enabled: Boolean(evControls.enabled && evControls.billableRequestsEnabled),
      key: "google_places_ev",
      label: "Google Places EV charging",
      quotaStorage,
      statusBlockers: evControls.blockers || [],
      used: Number(evControls.capUsed || 0),
      providerSignal: {
        routeChargingRequests: Number(evControls.routeChargingRequestSamples || 0),
        passRatePercent: Number(evControls.passRatePercent || 0),
        fallbackRatePercent: Number(evControls.fallbackRatePercent || 0),
        emptyResultRatePercent: Number(evControls.emptyResultRatePercent || 0),
        failedLookups: Number(evControls.failedLookups || 0),
        capHitLookups: Number(evControls.capHitLookups || 0),
        lastFailureAt: evControls.lastFailureAt || "",
        lastFailureProvider: evControls.lastFailureProvider || "",
      },
    }),
  ];
  const blockers = Array.from(new Set(paidLookups.flatMap((item) => item.blockers)));
  const warnings = Array.from(new Set(paidLookups.flatMap((item) => item.warnings)));
  if (geocodeUsage.warning) warnings.push("google_places_fallback_quota_usage_unavailable");
  const hardStopped = paidLookups.some((item) => item.status === "stopped");
  const watch = !hardStopped && paidLookups.some((item) => item.status === "watch");
  return {
    status: hardStopped ? "stopped" : watch ? "watch" : "normal",
    summary: hardStopped
      ? "At least one paid provider path is stopped by cap, quality or readiness controls."
      : watch
        ? "Paid provider usage is inside hard limits but needs monitoring."
        : "Paid provider usage is inside configured limits.",
    date,
    quotaStorage: {
      mode: quotaStorage.mode || "",
      durable: Boolean(quotaStorage.durable),
      warning: quotaStorage.warning || "",
    },
    confirmations: {
      googlePlacesKeyRestricted: googlePlacesKeyRestricted(),
      googlePlacesBudgetAlertConfirmed: googlePlacesBudgetAlertConfirmed(),
    },
    activePaidLookupCount: paidLookups.filter((item) => item.enabled).length,
    paidLookups,
    blockers,
    warnings,
  };
}

async function safeQuotaUsage({ quotaKey, date }) {
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

function lookupBudget({
  cap = 0,
  configured = false,
  enabled = false,
  key,
  label,
  quotaStorage,
  statusBlockers = [],
  used = 0,
  providerSignal = null,
}) {
  const safeCap = Math.max(0, Number(cap || 0));
  const safeUsed = Math.max(0, Number(used || 0));
  const remaining = safeCap > 0 ? Math.max(0, safeCap - safeUsed) : 0;
  const usagePercent = safeCap > 0 ? Number(((safeUsed / safeCap) * 100).toFixed(2)) : 0;
  const blockers = Array.from(new Set((statusBlockers || []).filter(Boolean)));
  const warnings = [];
  if (enabled && !quotaStorage?.durable) warnings.push(`${key}_quota_storage_not_durable`);
  if (enabled && usagePercent >= 80 && usagePercent < 95) warnings.push(`${key}_usage_above_80_percent`);
  if (enabled && safeCap <= 0) blockers.push(`${key}_daily_cap_not_set`);
  if (enabled && safeCap > 0 && usagePercent >= 95) blockers.push(`${key}_usage_above_95_percent`);
  const status = !enabled
    ? configured
      ? "configured_off"
      : "not_configured"
    : blockers.length
      ? "stopped"
      : warnings.length
        ? "watch"
        : "normal";
  return {
    key,
    label,
    enabled,
    configured,
    status,
    cap: safeCap,
    used: safeUsed,
    remaining,
    usagePercent,
    blockers,
    warnings,
    providerSignal,
  };
}

function geocodeBlockers({ geocoding = {}, quotaStorage = {}, cap = 0 }) {
  const blockers = [];
  if (!geocoding.paidFallbackEnabled) return blockers;
  if (!geocoding.googlePlacesConfigured) blockers.push("google_places_fallback_key_not_configured");
  if (cap <= 0) blockers.push("google_places_fallback_daily_cap_not_set");
  if (!googlePlacesKeyRestricted()) blockers.push("google_places_fallback_key_restriction_not_confirmed");
  if (!googlePlacesBudgetAlertConfirmed()) blockers.push("google_places_fallback_budget_alert_not_confirmed");
  if (productionRuntime() && !quotaStorage?.durable) blockers.push("google_places_fallback_quota_storage_not_durable");
  return blockers;
}

function productionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
}

module.exports = {
  providerObservabilityStatus,
};
