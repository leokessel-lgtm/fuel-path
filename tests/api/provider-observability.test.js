const assert = require("node:assert/strict");
const test = require("node:test");

const statusHandler = require("../../api/status");
const {
  setGeocodeQuotaStorageForTests,
  resetMemoryGeocodeQuotaForTests,
} = require("../../api/_geocodeQuotaStorage");
const {
  incrementRouteChargingRequest,
  recordEvRouteChargingAttempt,
  recordEvRouteChargingFailure,
  recordEvRouteChargingResult,
  resetEvRouteChargingTelemetry,
} = require("../../api/_evProviderTelemetry");

test("provider observability exposes paid lookup caps without leaking keys", { concurrency: 1 }, async () => {
  await withEnv({
    FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
    FUEL_PATH_GOOGLE_PLACES_API_KEY: "secret-google-key",
    FUEL_PATH_GOOGLE_PLACES_DAILY_CAP: "100",
    FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
    FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "secret-google-ev-key",
    FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "50",
    FUEL_PATH_GOOGLE_PLACES_EV_HARD_STOP_PERCENT: "95",
    FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "1",
    FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "1",
  }, async () => {
    setGeocodeQuotaStorageForTests(quotaStore({
      google_places_fallback: 12,
      google_places_ev: 4,
    }));
    const response = await callStatus();
    const observability = response.payload.providerObservability;

    assert.equal(response.status, 200);
    assert.equal(observability.status, "normal");
    assert.equal(observability.activePaidLookupCount, 2);
    assert.equal(observability.paidLookups.find((item) => item.key === "google_places_fallback").used, 12);
    assert.equal(observability.paidLookups.find((item) => item.key === "google_places_ev").remaining, 46);
    assert.doesNotMatch(JSON.stringify(response.payload), /secret-google/);
  });
});

test("provider observability stops when EV quality guard blocks Google EV", { concurrency: 1 }, async () => {
  await withEnv({
    FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
    FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "secret-google-ev-key",
    FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "250",
    FUEL_PATH_GOOGLE_PLACES_EV_HARD_STOP_PERCENT: "0",
    FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "1",
    FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "1",
    FUEL_PATH_GOOGLE_PLACES_EV_QUALITY_GUARD_ENABLED: "1",
    FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_SAMPLE_MIN: "4",
    FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_PASS_RATE_MIN_PERCENT: "90",
  }, async () => {
    setGeocodeQuotaStorageForTests(quotaStore({ google_places_ev: 6 }));
    for (let index = 0; index < 4; index += 1) {
      incrementRouteChargingRequest();
      recordEvRouteChargingAttempt({ provider: "google_places_ev" });
      if (index < 2) recordEvRouteChargingFailure({ provider: "google_places_ev", reason: "timeout" });
      else recordEvRouteChargingResult({ provider: "google_places_ev", chargersCount: 2 });
    }

    const response = await callStatus();
    const evLookup = response.payload.providerObservability.paidLookups.find((item) => item.key === "google_places_ev");

    assert.equal(response.payload.providerObservability.status, "stopped");
    assert.equal(evLookup.status, "stopped");
    assert.equal(evLookup.blockers.includes("google_places_ev_pass_rate_below_threshold"), true);
    assert.equal(evLookup.providerSignal.passRatePercent, 50);
  });
});

test("provider observability warns before cap stop", { concurrency: 1 }, async () => {
  await withEnv({
    FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
    FUEL_PATH_GOOGLE_PLACES_API_KEY: "secret-google-key",
    FUEL_PATH_GOOGLE_PLACES_DAILY_CAP: "100",
    FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "1",
    FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "1",
  }, async () => {
    setGeocodeQuotaStorageForTests(quotaStore({ google_places_fallback: 82 }));
    const response = await callStatus();
    const geocodeLookup = response.payload.providerObservability.paidLookups.find((item) => item.key === "google_places_fallback");

    assert.equal(response.payload.providerObservability.status, "watch");
    assert.equal(geocodeLookup.status, "watch");
    assert.equal(geocodeLookup.usagePercent, 82);
    assert.equal(geocodeLookup.warnings.includes("google_places_fallback_usage_above_80_percent"), true);
  });
});

function quotaStore(callsByKey) {
  return {
    status() {
      return {
        mode: "postgres_neon",
        configured: true,
        durable: true,
        table: "fuel_path_geocode_quotas",
        warning: "",
      };
    },
    async usage({ quotaKey, date }) {
      return {
        quotaKey,
        date,
        calls: Number(callsByKey[quotaKey] || 0),
        durable: true,
      };
    },
  };
}

async function withEnv(overrides, callback) {
  const originalEnv = {};
  for (const key of Object.keys(overrides)) {
    originalEnv[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = String(overrides[key]);
  }
  resetEvRouteChargingTelemetry();
  resetMemoryGeocodeQuotaForTests();
  try {
    await callback();
  } finally {
    resetEvRouteChargingTelemetry();
    resetMemoryGeocodeQuotaForTests();
    setGeocodeQuotaStorageForTests(null);
    for (const key of Object.keys(overrides)) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
}

function callStatus() {
  return new Promise((resolve) => {
    const req = { method: "GET", query: {} };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, payload });
      },
    };

    statusHandler(req, res);
  });
}
