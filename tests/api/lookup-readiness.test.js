const assert = require("node:assert/strict");
const test = require("node:test");

const statusHandler = require("../../api/status");

test("status exposes lookup readiness as not ready for local seed fallback", async () => {
  await withEnv(clearLookupEnv(), async () => {
    const response = await callStatus();
    const readiness = response.payload.geocoding.lookupReadiness;

    assert.equal(response.status, 200);
    assert.equal(readiness.status, "not_ready");
    assert.equal(readiness.publicExactAddressClaimsAllowed, false);
    assert.equal(readiness.addressIndex.mode, "seed");
    assert.equal(readiness.blockers.includes("hosted_gnaf_index_required"), true);
    assert.equal(readiness.blockers.includes("hosted_national_benchmark_not_passed"), true);
    assert.equal(readiness.cachePolicy.ready, true);
  });
});

test("status allows exact-address launch claims only with hosted index and current evidence", async () => {
  await withEnv(
    {
      ...clearLookupEnv(),
      FUEL_PATH_GNAF_API_URL: "https://gnaf.example.test",
      FUEL_PATH_GNAF_API_TOKEN: "test-token-with-more-than-thirty-two-characters",
      FUEL_PATH_GNAF_ADDRESS_ROWS: "17000000",
      FUEL_PATH_GNAF_EXACT_SMOKE_STATUS: "passed",
      FUEL_PATH_GNAF_BENCHMARK_STATUS: "passed",
      FUEL_PATH_GNAF_BENCHMARK_AT: new Date().toISOString(),
      FUEL_PATH_GNAF_BENCHMARK_CASES: "900",
      FUEL_PATH_GNAF_BENCHMARK_ADDRESS_TOP_RATE: "1",
      FUEL_PATH_GNAF_BENCHMARK_POI_TOP_RATE: "0.99",
      FUEL_PATH_GNAF_BENCHMARK_ADDRESS_P90_CHARS: "34",
      FUEL_PATH_GNAF_BENCHMARK_POI_P90_CHARS: "9",
    },
    async () => {
      const response = await callStatus();
      const readiness = response.payload.geocoding.lookupReadiness;

      assert.equal(readiness.status, "ready");
      assert.equal(readiness.publicExactAddressClaimsAllowed, true);
      assert.deepEqual(readiness.blockers, []);
      assert.equal(readiness.addressIndex.mode, "api");
      assert.equal(readiness.addressIndex.rowCountReady, true);
      assert.equal(readiness.exactSmoke.passed, true);
      assert.equal(readiness.hostedBenchmark.passed, true);
    },
  );
});

test("status blocks billable fallback when quota storage is not durable", async () => {
  await withEnv(
    {
      ...clearLookupEnv(),
      FUEL_PATH_GNAF_API_URL: "https://gnaf.example.test",
      FUEL_PATH_GNAF_API_TOKEN: "test-token-with-more-than-thirty-two-characters",
      FUEL_PATH_GNAF_ADDRESS_ROWS: "17000000",
      FUEL_PATH_GNAF_EXACT_SMOKE_STATUS: "passed",
      FUEL_PATH_GNAF_BENCHMARK_STATUS: "passed",
      FUEL_PATH_GNAF_BENCHMARK_AT: new Date().toISOString(),
      FUEL_PATH_GNAF_BENCHMARK_CASES: "900",
      FUEL_PATH_GNAF_BENCHMARK_ADDRESS_TOP_RATE: "1",
      FUEL_PATH_GNAF_BENCHMARK_POI_TOP_RATE: "0.99",
      FUEL_PATH_GNAF_BENCHMARK_ADDRESS_P90_CHARS: "34",
      FUEL_PATH_GNAF_BENCHMARK_POI_P90_CHARS: "9",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "google-test-key",
    },
    async () => {
      const response = await callStatus();
      const readiness = response.payload.geocoding.lookupReadiness;

      assert.equal(readiness.status, "not_ready");
      assert.equal(readiness.providerFallback.billableRequestsEnabled, true);
      assert.equal(readiness.providerFallback.quotaStorageDurable, false);
      assert.equal(readiness.blockers.includes("paid_fallback_quota_storage_not_durable"), true);
      assert.equal(readiness.blockers.includes("paid_fallback_google_key_restriction_not_confirmed"), true);
      assert.equal(readiness.blockers.includes("paid_fallback_budget_alert_not_confirmed"), true);
    },
  );
});

test("status rejects future-dated hosted benchmark evidence", async () => {
  await withEnv(
    {
      ...clearLookupEnv(),
      FUEL_PATH_GNAF_API_URL: "https://gnaf.example.test",
      FUEL_PATH_GNAF_API_TOKEN: "test-token-with-more-than-thirty-two-characters",
      FUEL_PATH_GNAF_ADDRESS_ROWS: "17000000",
      FUEL_PATH_GNAF_EXACT_SMOKE_STATUS: "passed",
      FUEL_PATH_GNAF_BENCHMARK_STATUS: "passed",
      FUEL_PATH_GNAF_BENCHMARK_AT: "2099-01-01T00:00:00.000Z",
      FUEL_PATH_GNAF_BENCHMARK_CASES: "900",
      FUEL_PATH_GNAF_BENCHMARK_ADDRESS_TOP_RATE: "1",
      FUEL_PATH_GNAF_BENCHMARK_POI_TOP_RATE: "0.99",
      FUEL_PATH_GNAF_BENCHMARK_ADDRESS_P90_CHARS: "34",
      FUEL_PATH_GNAF_BENCHMARK_POI_P90_CHARS: "9",
    },
    async () => {
      const response = await callStatus();
      const readiness = response.payload.geocoding.lookupReadiness;

      assert.equal(readiness.status, "not_ready");
      assert.equal(readiness.publicExactAddressClaimsAllowed, false);
      assert.equal(readiness.hostedBenchmark.futureDated, true);
      assert.equal(readiness.hostedBenchmark.fresh, false);
      assert.equal(readiness.blockers.includes("hosted_national_benchmark_future_dated"), true);
      assert.equal(readiness.blockers.includes("hosted_national_benchmark_not_passed"), true);
    },
  );
});

test("status allows billable fallback only after quota, cap, restricted key and budget alert gates", async () => {
  await withEnv(
    {
      ...clearLookupEnv(),
      FUEL_PATH_GNAF_API_URL: "https://gnaf.example.test",
      FUEL_PATH_GNAF_API_TOKEN: "test-token-with-more-than-thirty-two-characters",
      FUEL_PATH_GNAF_ADDRESS_ROWS: "17000000",
      FUEL_PATH_GNAF_EXACT_SMOKE_STATUS: "passed",
      FUEL_PATH_GNAF_BENCHMARK_STATUS: "passed",
      FUEL_PATH_GNAF_BENCHMARK_AT: new Date().toISOString(),
      FUEL_PATH_GNAF_BENCHMARK_CASES: "900",
      FUEL_PATH_GNAF_BENCHMARK_ADDRESS_TOP_RATE: "1",
      FUEL_PATH_GNAF_BENCHMARK_POI_TOP_RATE: "0.99",
      FUEL_PATH_GNAF_BENCHMARK_ADDRESS_P90_CHARS: "34",
      FUEL_PATH_GNAF_BENCHMARK_POI_P90_CHARS: "9",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "google-test-key",
      FUEL_PATH_GOOGLE_PLACES_DAILY_CAP: "25",
      FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "1",
      FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "1",
      FUEL_PATH_GEOCODE_QUOTA_DATABASE_URL: "postgres://quota.example.test/fuel_path",
    },
    async () => {
      const response = await callStatus();
      const readiness = response.payload.geocoding.lookupReadiness;

      assert.equal(readiness.status, "ready");
      assert.equal(readiness.providerFallback.billableRequestsEnabled, true);
      assert.equal(readiness.providerFallback.quotaStorageDurable, true);
      assert.equal(readiness.providerFallback.dailyCap, 25);
      assert.equal(readiness.providerFallback.tinyDailyCapReady, true);
      assert.equal(readiness.providerFallback.googlePlacesKeyRestricted, true);
      assert.equal(readiness.providerFallback.budgetAlertConfirmed, true);
      assert.equal(readiness.providerFallback.ready, true);
      assert.deepEqual(readiness.blockers, []);
    },
  );
});

async function callStatus() {
  let status = 0;
  let payload = null;
  const req = { method: "GET", headers: {}, query: {} };
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };
  await statusHandler(req, res);
  return { status, payload };
}

function clearLookupEnv() {
  return {
    FUEL_PATH_GNAF_API_URL: "",
    FUEL_PATH_GNAF_API_TOKEN: "",
    FUEL_PATH_GNAF_SQLITE_PATH: "",
    FUEL_PATH_GNAF_DATABASE_URL: "",
    FUEL_PATH_GNAF_MIN_ADDRESS_ROWS: "",
    FUEL_PATH_GNAF_ADDRESS_ROWS: "",
    FUEL_PATH_GNAF_EXACT_SMOKE_STATUS: "",
    FUEL_PATH_GNAF_BENCHMARK_STATUS: "",
    FUEL_PATH_GNAF_BENCHMARK_AT: "",
    FUEL_PATH_GNAF_BENCHMARK_CASES: "",
    FUEL_PATH_GNAF_BENCHMARK_ADDRESS_TOP_RATE: "",
    FUEL_PATH_GNAF_BENCHMARK_POI_TOP_RATE: "",
    FUEL_PATH_GNAF_BENCHMARK_ADDRESS_P90_CHARS: "",
    FUEL_PATH_GNAF_BENCHMARK_POI_P90_CHARS: "",
    FUEL_PATH_HOSTED_BENCHMARK_REQUIRED_CASES: "",
    FUEL_PATH_HOSTED_BENCHMARK_FRESH_DAYS: "",
    FUEL_PATH_HOSTED_BENCHMARK_MIN_ADDRESS_TOP_RATE: "",
    FUEL_PATH_HOSTED_BENCHMARK_MIN_POI_TOP_RATE: "",
    FUEL_PATH_HOSTED_BENCHMARK_MAX_ADDRESS_P90_CHARS: "",
    FUEL_PATH_HOSTED_BENCHMARK_MAX_POI_P90_CHARS: "",
    FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "",
    FUEL_PATH_GOOGLE_PLACES_FALLBACK_ENABLED: "",
    FUEL_PATH_GOOGLE_PLACES_API_KEY: "",
    FUEL_PATH_GOOGLE_PLACES_DAILY_CAP: "",
    FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "",
    FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "",
    GOOGLE_MAPS_API_KEY: "",
    DATABASE_URL: "",
    FUEL_PATH_GEOCODE_QUOTA_DATABASE_URL: "",
    POSTGRES_URL: "",
    POSTGRES_PRISMA_URL: "",
    NEON_DATABASE_URL: "",
  };
}

async function withEnv(values, fn) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === "") delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
