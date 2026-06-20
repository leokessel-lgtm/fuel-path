const DEFAULT_MIN_ADDRESS_ROWS = 10_000_000;
const DEFAULT_BENCHMARK_CASES = 900;
const DEFAULT_BENCHMARK_FRESH_DAYS = 30;
const DEFAULT_MIN_ADDRESS_TOP_RATE = 1;
const DEFAULT_MIN_POI_TOP_RATE = 0.98;
const DEFAULT_MAX_ADDRESS_P90_CHARS = 42;
const DEFAULT_MAX_POI_P90_CHARS = 12;

function createLookupReadiness(geocodingStatus = {}) {
  const addressIndex = geocodingStatus.addressIndex || {};
  const minAddressRows = positiveInteger(
    process.env.FUEL_PATH_GNAF_MIN_ADDRESS_ROWS,
    DEFAULT_MIN_ADDRESS_ROWS,
  );
  const requiredBenchmarkCases = positiveInteger(
    process.env.FUEL_PATH_HOSTED_BENCHMARK_REQUIRED_CASES,
    DEFAULT_BENCHMARK_CASES,
  );
  const staleAfterDays = positiveInteger(
    process.env.FUEL_PATH_HOSTED_BENCHMARK_FRESH_DAYS,
    DEFAULT_BENCHMARK_FRESH_DAYS,
  );
  const thresholds = {
    minAddressTopRate: numberValue(
      process.env.FUEL_PATH_HOSTED_BENCHMARK_MIN_ADDRESS_TOP_RATE,
      DEFAULT_MIN_ADDRESS_TOP_RATE,
    ),
    minPoiTopRate: numberValue(
      process.env.FUEL_PATH_HOSTED_BENCHMARK_MIN_POI_TOP_RATE,
      DEFAULT_MIN_POI_TOP_RATE,
    ),
    maxAddressP90Chars: positiveInteger(
      process.env.FUEL_PATH_HOSTED_BENCHMARK_MAX_ADDRESS_P90_CHARS,
      DEFAULT_MAX_ADDRESS_P90_CHARS,
    ),
    maxPoiP90Chars: positiveInteger(
      process.env.FUEL_PATH_HOSTED_BENCHMARK_MAX_POI_P90_CHARS,
      DEFAULT_MAX_POI_P90_CHARS,
    ),
  };
  const reportedAddressRows = optionalInteger(process.env.FUEL_PATH_GNAF_ADDRESS_ROWS);
  const mode = String(addressIndex.mode || "disabled");
  const hosted = mode === "api" || mode === "postgres";
  const apiTokenReady =
    !addressIndex.apiConfigured || String(process.env.FUEL_PATH_GNAF_API_TOKEN || "").trim().length >= 32;
  const rowCountReady = reportedAddressRows === null ? null : reportedAddressRows >= minAddressRows;
  const exactSmokeStatus = normaliseStatus(process.env.FUEL_PATH_GNAF_EXACT_SMOKE_STATUS);
  const benchmarkStatus = normaliseStatus(process.env.FUEL_PATH_GNAF_BENCHMARK_STATUS);
  const benchmarkAt = normaliseIsoDate(process.env.FUEL_PATH_GNAF_BENCHMARK_AT);
  const benchmarkAgeDays = benchmarkAt ? ageDays(benchmarkAt) : null;
  const benchmarkFutureDated = benchmarkAt ? isFutureDate(benchmarkAt) : false;
  const benchmarkFresh =
    benchmarkAgeDays !== null && !benchmarkFutureDated ? benchmarkAgeDays <= staleAfterDays : false;
  const benchmarkCases = optionalInteger(process.env.FUEL_PATH_GNAF_BENCHMARK_CASES);
  const addressTopRate = optionalRate(process.env.FUEL_PATH_GNAF_BENCHMARK_ADDRESS_TOP_RATE);
  const poiTopRate = optionalRate(process.env.FUEL_PATH_GNAF_BENCHMARK_POI_TOP_RATE);
  const addressP90Chars = optionalInteger(process.env.FUEL_PATH_GNAF_BENCHMARK_ADDRESS_P90_CHARS);
  const poiP90Chars = optionalInteger(process.env.FUEL_PATH_GNAF_BENCHMARK_POI_P90_CHARS);
  const cachePolicy = geocodingStatus.cachePolicy || {};
  const quotaStorage = geocodingStatus.googlePlacesQuotaStorage || {};
  const paidFallbackEnabled = Boolean(geocodingStatus.billableRequestsEnabled);
  const paidFallbackCap = optionalInteger(geocodingStatus.googlePlacesDailyCap);
  const paidFallbackTinyCapReady = paidFallbackCap !== null && paidFallbackCap > 0 && paidFallbackCap <= 25;
  const googlePlacesKeyRestricted = Boolean(geocodingStatus.googlePlacesKeyRestricted);
  const googlePlacesBudgetAlertConfirmed = Boolean(geocodingStatus.googlePlacesBudgetAlertConfirmed);

  const benchmarkReady =
    benchmarkStatus === "passed" &&
    !benchmarkFutureDated &&
    benchmarkFresh &&
    benchmarkCases !== null &&
    benchmarkCases >= requiredBenchmarkCases &&
    addressTopRate !== null &&
    addressTopRate >= thresholds.minAddressTopRate &&
    poiTopRate !== null &&
    poiTopRate >= thresholds.minPoiTopRate &&
    addressP90Chars !== null &&
    addressP90Chars <= thresholds.maxAddressP90Chars &&
    poiP90Chars !== null &&
    poiP90Chars <= thresholds.maxPoiP90Chars;
  const exactSmokeReady = exactSmokeStatus === "passed";
  const cachePolicyReady =
    cachePolicy.exactAddressSkipsExternalProviders === true &&
    cachePolicy.paidFallbackFailClosed === true &&
    Number(cachePolicy.successfulLookupTtlSeconds || 0) > 0 &&
    Number(cachePolicy.degradedLookupTtlSeconds || 0) > 0;
  const providerFallbackReady =
    !paidFallbackEnabled ||
    (
      Boolean(quotaStorage.durable) &&
      paidFallbackTinyCapReady &&
      googlePlacesKeyRestricted &&
      googlePlacesBudgetAlertConfirmed
    );

  const blockers = [];
  if (!hosted) blockers.push("hosted_gnaf_index_required");
  if (!apiTokenReady) blockers.push("hosted_gnaf_api_token_required");
  if (reportedAddressRows === null) blockers.push("gnaf_address_row_count_not_reported");
  else if (!rowCountReady) blockers.push("gnaf_address_row_count_below_threshold");
  if (!exactSmokeReady) blockers.push("hosted_exact_smoke_not_passed");
  if (benchmarkFutureDated) blockers.push("hosted_national_benchmark_future_dated");
  if (!benchmarkReady) blockers.push("hosted_national_benchmark_not_passed");
  if (!cachePolicyReady) blockers.push("lookup_cache_policy_incomplete");
  if (paidFallbackEnabled && !quotaStorage.durable) blockers.push("paid_fallback_quota_storage_not_durable");
  if (paidFallbackEnabled && !paidFallbackTinyCapReady) blockers.push("paid_fallback_tiny_daily_cap_not_confirmed");
  if (paidFallbackEnabled && !googlePlacesKeyRestricted) blockers.push("paid_fallback_google_key_restriction_not_confirmed");
  if (paidFallbackEnabled && !googlePlacesBudgetAlertConfirmed) blockers.push("paid_fallback_budget_alert_not_confirmed");

  const publicExactAddressClaimsAllowed = blockers.length === 0;
  return {
    status: publicExactAddressClaimsAllowed ? "ready" : "not_ready",
    publicExactAddressClaimsAllowed,
    launchClaim: publicExactAddressClaimsAllowed
      ? "Hosted national exact-address lookup has current evidence."
      : "Do not claim national exact-address coverage yet.",
    blockers,
    nextAction: blockers[0] ? nextActionForBlocker(blockers[0]) : "Keep benchmark evidence current.",
    addressIndex: {
      mode,
      hosted,
      configured: Boolean(addressIndex.configured),
      apiConfigured: Boolean(addressIndex.apiConfigured),
      postgresConfigured: Boolean(addressIndex.postgresConfigured),
      sqliteConfigured: Boolean(addressIndex.sqliteConfigured),
      seedRecords: Number(addressIndex.seedRecords || 0),
      reportedAddressRows,
      minAddressRows,
      rowCountReady,
      attribution: addressIndex.attribution || "",
    },
    exactSmoke: {
      status: exactSmokeStatus,
      passed: exactSmokeReady,
    },
    hostedBenchmark: {
      status: benchmarkStatus,
      passed: benchmarkReady,
      lastRunAt: benchmarkAt,
      ageDays: benchmarkAgeDays,
      futureDated: benchmarkFutureDated,
      staleAfterDays,
      fresh: benchmarkFresh,
      cases: benchmarkCases,
      requiredCases: requiredBenchmarkCases,
      addressTopRate,
      poiTopRate,
      addressP90Chars,
      poiP90Chars,
      thresholds,
    },
    providerFallback: {
      activeProvider: geocodingStatus.activeProvider || "",
      activeMode: geocodingStatus.activeMode || "",
      paidFallbackEnabled: Boolean(geocodingStatus.paidFallbackEnabled),
      billableRequestsEnabled: paidFallbackEnabled,
      quotaStorageMode: quotaStorage.mode || "",
      quotaStorageDurable: Boolean(quotaStorage.durable),
      dailyCap: paidFallbackCap,
      tinyDailyCapReady: paidFallbackTinyCapReady,
      googlePlacesKeyRestricted,
      budgetAlertConfirmed: googlePlacesBudgetAlertConfirmed,
      ready: providerFallbackReady,
    },
    cachePolicy: {
      ...cachePolicy,
      ready: cachePolicyReady,
    },
  };
}

function nextActionForBlocker(blocker) {
  if (blocker === "hosted_gnaf_index_required") {
    return "Configure hosted G-NAF through FUEL_PATH_GNAF_API_URL or FUEL_PATH_GNAF_DATABASE_URL.";
  }
  if (blocker === "gnaf_address_row_count_not_reported") {
    return "Publish FUEL_PATH_GNAF_ADDRESS_ROWS from the hosted readiness check.";
  }
  if (blocker === "hosted_gnaf_api_token_required") {
    return "Set a long FUEL_PATH_GNAF_API_TOKEN and verify missing-token requests are rejected.";
  }
  if (blocker === "gnaf_address_row_count_below_threshold") {
    return "Load the full national G-NAF address index before launch claims.";
  }
  if (blocker === "hosted_exact_smoke_not_passed") {
    return "Run the exact-address hosted smoke gate and publish FUEL_PATH_GNAF_EXACT_SMOKE_STATUS=passed.";
  }
  if (blocker === "hosted_national_benchmark_not_passed") {
    return "Run the hosted 600-address plus 300-POI benchmark and publish its pass metrics.";
  }
  if (blocker === "hosted_national_benchmark_future_dated") {
    return "Republish hosted benchmark evidence with a non-future run timestamp.";
  }
  if (blocker === "paid_fallback_quota_storage_not_durable") {
    return "Configure durable quota storage before enabling billable fallback.";
  }
  if (blocker === "paid_fallback_tiny_daily_cap_not_confirmed") {
    return "Set a tiny daily Google Places fallback cap before enabling billable fallback.";
  }
  if (blocker === "paid_fallback_google_key_restriction_not_confirmed") {
    return "Confirm Google Places key restrictions before enabling billable fallback.";
  }
  if (blocker === "paid_fallback_budget_alert_not_confirmed") {
    return "Confirm a budget alert before enabling billable fallback.";
  }
  return "Review lookup readiness configuration.";
}

function normaliseStatus(value) {
  const text = String(value || "").trim().toLowerCase();
  if (["pass", "passed", "ready", "ok", "true", "1"].includes(text)) return "passed";
  if (["fail", "failed", "not_ready", "false", "0"].includes(text)) return "failed";
  return "unknown";
}

function optionalInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
}

function positiveInteger(value, fallback) {
  const parsed = optionalInteger(value);
  return parsed !== null && parsed > 0 ? parsed : fallback;
}

function numberValue(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalRate(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

function normaliseIsoDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function ageDays(value) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000)));
}

function isFutureDate(value) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() + 60 * 1000;
}

module.exports = {
  createLookupReadiness,
};
