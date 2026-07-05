const assert = require("node:assert/strict");
const test = require("node:test");

const {
  setGeocodeQuotaStorageForTests,
  resetMemoryGeocodeQuotaForTests,
} = require("../../api/_geocodeQuotaStorage");
const {
  canUseGooglePlacesEvForRouteCharging,
  evChargingStatusWithTelemetry,
  googlePlacesRouteChargingDecision,
} = require("../../api/_evProviderPolicy");
const {
  incrementRouteChargingRequest,
  recordEvRouteChargingAttempt,
  recordEvRouteChargingFailure,
  recordEvRouteChargingResult,
  resetEvRouteChargingTelemetry,
} = require("../../api/_evProviderTelemetry");

async function withEnv(overrides, callback) {
  const originalEnv = {};
  const keys = Object.keys(overrides);
  for (const key of keys) {
    originalEnv[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(overrides[key]);
    }
  }

  resetEvRouteChargingTelemetry();
  resetMemoryGeocodeQuotaForTests();
  setGeocodeQuotaStorageForTests(durableGeocodeQuotaStore());

  try {
    return await callback();
  } finally {
    resetEvRouteChargingTelemetry();
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    setGeocodeQuotaStorageForTests(null);
    resetMemoryGeocodeQuotaForTests();
  }
}

function durableGeocodeQuotaStore() {
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
    async usage() {
      return {
        quotaKey: "google_places_ev",
        date: new Date().toISOString().slice(0, 10),
        calls: 0,
        durable: true,
      };
    },
  };
}

test("Google Places EV route stop-signal blocks when pass rate degrades", { concurrency: 1 }, async () => {
  await withEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
      FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "250",
      FUEL_PATH_GOOGLE_PLACES_EV_HARD_STOP_PERCENT: "0",
      FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "1",
      FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_QUALITY_GUARD_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_SAMPLE_MIN: "8",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_PASS_RATE_MIN_PERCENT: "90",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_FALLBACK_RATIO_MAX_PERCENT: "60",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_EMPTY_RESULT_MAX_PERCENT: "70",
    },
    async () => {
      for (let index = 0; index < 10; index += 1) {
        incrementRouteChargingRequest();
        recordEvRouteChargingAttempt({ provider: "google_places_ev" });
        if (index < 3) {
          recordEvRouteChargingFailure({ provider: "google_places_ev", reason: "timeout" });
          continue;
        }
        recordEvRouteChargingResult({ provider: "google_places_ev", chargersCount: 1 });
      }
      const status = await evChargingStatusWithTelemetry();
      assert.equal(status.googlePlacesEvCostControls.signalBlockers.includes("google_places_ev_pass_rate_below_threshold"), true);
      assert.equal(canUseGooglePlacesEvForRouteCharging(), false);
    },
  );
});

test("Google Places EV route stop-signal blocks on fallback ratio breach", { concurrency: 1 }, async () => {
  await withEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
      FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "250",
      FUEL_PATH_GOOGLE_PLACES_EV_HARD_STOP_PERCENT: "0",
      FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "1",
      FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_QUALITY_GUARD_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_SAMPLE_MIN: "10",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_PASS_RATE_MIN_PERCENT: "95",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_FALLBACK_RATIO_MAX_PERCENT: "40",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_EMPTY_RESULT_MAX_PERCENT: "80",
    },
    async () => {
      for (let index = 0; index < 10; index += 1) {
        incrementRouteChargingRequest();
        recordEvRouteChargingAttempt({ provider: "google_places_ev" });
        recordEvRouteChargingResult({ provider: "google_places_ev", chargersCount: 1 });
        if (index >= 5) {
          recordEvRouteChargingAttempt({ provider: "open_charge_map", isFallback: true });
          recordEvRouteChargingResult({ provider: "open_charge_map", chargersCount: 1 });
        }
      }

      const status = await evChargingStatusWithTelemetry();
      assert.equal(status.googlePlacesEvCostControls.signalBlockers.includes("google_places_ev_fallback_ratio_above_threshold"), true);
      assert.equal(canUseGooglePlacesEvForRouteCharging(), false);
    },
  );
});

test("Google Places EV route stop-signal allows when quality is healthy", { concurrency: 1 }, async () => {
  await withEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
      FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "250",
      FUEL_PATH_GOOGLE_PLACES_EV_HARD_STOP_PERCENT: "0",
      FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "1",
      FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_QUALITY_GUARD_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_SAMPLE_MIN: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_PASS_RATE_MIN_PERCENT: "90",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_FALLBACK_RATIO_MAX_PERCENT: "40",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_EMPTY_RESULT_MAX_PERCENT: "50",
    },
    async () => {
      for (let index = 0; index < 10; index += 1) {
        incrementRouteChargingRequest();
        recordEvRouteChargingAttempt({ provider: "google_places_ev" });
        recordEvRouteChargingResult({ provider: "google_places_ev", chargersCount: 1 });
      }
      for (let index = 0; index < 2; index += 1) {
        recordEvRouteChargingAttempt({ provider: "open_charge_map", isFallback: true });
        recordEvRouteChargingResult({ provider: "open_charge_map", chargersCount: 1 });
      }

      const status = await evChargingStatusWithTelemetry();
      assert.equal(status.googlePlacesEvCostControls.signalBlockers.length, 0);
      assert.equal(canUseGooglePlacesEvForRouteCharging(), true);
      assert.equal(status.googlePlacesEvCostControls.passRatePercent >= 90, true);
      assert.equal(status.googlePlacesEvCostControls.fallbackRatePercent <= 40, true);
    },
  );
});

test("Google Places EV cap status surfaces soft warning before hard stop", { concurrency: 1 }, async () => {
  await withEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
      FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "100",
      FUEL_PATH_GOOGLE_PLACES_EV_SOFT_WARNING_PERCENT: "80",
      FUEL_PATH_GOOGLE_PLACES_EV_HARD_STOP_PERCENT: "95",
      FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "1",
      FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_QUALITY_GUARD_ENABLED: "1",
    },
    async () => {
      setGeocodeQuotaStorageForTests({
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
          return { quotaKey, date, calls: 80, durable: true };
        },
      });

      const status = await evChargingStatusWithTelemetry();
      assert.equal(status.googlePlacesEvCostControls.status, "ready");
      assert.equal(status.googlePlacesEvCostControls.capUsagePercent, 80);
      assert.equal(status.googlePlacesEvCostControls.softWarning.active, true);
      assert.equal(status.googlePlacesEvCostControls.softWarning.warnAtCalls, 80);
      assert.equal(status.googlePlacesEvCostControls.hardStop.active, false);
      assert.equal(canUseGooglePlacesEvForRouteCharging(), true);
    },
  );
});

test("Google Places EV route stop-signal surfaces blocker details", { concurrency: 1 }, async () => {
  await withEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
      FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "250",
      FUEL_PATH_GOOGLE_PLACES_EV_HARD_STOP_PERCENT: "0",
      FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "1",
      FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_QUALITY_GUARD_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_SAMPLE_MIN: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_PASS_RATE_MIN_PERCENT: "95",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_FALLBACK_RATIO_MAX_PERCENT: "90",
      FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_EMPTY_RESULT_MAX_PERCENT: "90",
    },
    async () => {
      incrementRouteChargingRequest();
      recordEvRouteChargingAttempt({ provider: "google_places_ev" });
      recordEvRouteChargingFailure({ provider: "google_places_ev", reason: "downstream timeout" });

      const decision = googlePlacesRouteChargingDecision();
      assert.equal(decision.allowed, false);
      assert.equal(decision.blockers.includes("google_places_ev_pass_rate_below_threshold"), true);
      const status = await evChargingStatusWithTelemetry();
      assert.equal(status.googlePlacesEvCostControls.blockers.includes("google_places_ev_pass_rate_below_threshold"), true);
    },
  );
});
