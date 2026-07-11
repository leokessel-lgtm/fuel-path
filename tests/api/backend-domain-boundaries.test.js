const assert = require("node:assert/strict");
const test = require("node:test");

const { createAddressStorageAdapters } = require("../../api/_addressStorageAdapters");
const { normaliseAddressText, normaliseSearchContext } = require("../../api/_addressQuery");
const {
  geocodeCacheMode,
  geocodeProviderWarning,
  isRetriableGeocodeError,
  productionRuntime,
} = require("../../api/_geocodePolicy");
const { createPredictionReadiness } = require("../../api/_predictionReadiness");
const { createPredictionSecurity } = require("../../api/_predictionSecurity");

test("address query normalisation preserves its public contract", () => {
  assert.equal(normaliseAddressText("10 Smith Cct, Bruce ACT"), "10 smith circuit bruce act");
  assert.deepEqual(normaliseSearchContext({ nearLat: "-33.86", nearLon: "151.20" }), {
    nearLat: -33.86,
    nearLon: 151.2,
  });
  assert.equal(normaliseSearchContext({ nearLat: "invalid", nearLon: 151.2 }), null);
});

test("geocode policy distinguishes retries and stable public warnings", () => {
  assert.equal(isRetriableGeocodeError(new Error("Provider returned 503"), "google"), true);
  assert.equal(isRetriableGeocodeError(new Error("Provider returned 429"), "nominatim"), false);
  assert.equal(isRetriableGeocodeError(new Error("fetch failed: ETIMEDOUT"), "google"), true);
  assert.equal(isRetriableGeocodeError(new Error("daily fallback cap reached"), "google"), false);
  assert.equal(geocodeProviderWarning(new Error("Provider returned 429")), "Address lookup is temporarily busy. Try a fuller address, suburb or postcode.");
  assert.equal(geocodeCacheMode("local_fallback"), "local_fallback");
});

test("production runtime policy recognises each hardening signal", () => {
  const previous = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
    FUEL_PATH_PRODUCTION_HARDENING: process.env.FUEL_PATH_PRODUCTION_HARDENING,
  };
  try {
    delete process.env.VERCEL_ENV;
    delete process.env.NODE_ENV;
    delete process.env.FUEL_PATH_PRODUCTION_HARDENING;
    assert.equal(productionRuntime(), false);
    process.env.VERCEL_ENV = "production";
    assert.equal(productionRuntime(), true);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("prediction readiness requires durable market-scoped evidence", () => {
  const readiness = createPredictionReadiness({
    REGION_ORDER: ["NSW"],
    marketFuelKey: (record) => `${record.market}:${record.fuel}`,
    round: (value, decimals) => Number(Number(value).toFixed(decimals)),
  });
  const records = Array.from({ length: 60 }, (_, index) => ({
    region: "NSW",
    market: "sydney",
    fuel: "U91",
    absoluteErrorCpl: 2,
    directionMatched: index < 50,
  }));
  const result = readiness.predictionReadiness(records, { durable: true });
  assert.equal(result.status, "ready_for_limited_cycle_guidance");
  assert.equal(result.accuracyClaimsAllowed, true);
  assert.equal(result.userFacingPredictionEnabled, false);
});

test("prediction write security is isolated and denies missing durable tokens", () => {
  const previous = process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
  delete process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
  const security = createPredictionSecurity({
    predictionStorageStatus: () => ({ durable: true }),
    tokenSecurity: ({ expected, storageDurable }) => ({
      tokenRequired: storageDurable,
      tokenConfigured: Boolean(expected),
    }),
    tokenAuthorised: () => true,
  });
  try {
    assert.equal(security.predictionWriteSecurity().tokenRequired, true);
    assert.equal(security.predictionWriteAuthorised({}), false);
  } finally {
    if (previous === undefined) delete process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
    else process.env.PREDICTION_BACKTEST_WRITE_TOKEN = previous;
  }
});

test("address API adapter clamps limits and never leaks its token into output", async () => {
  const previous = {
    url: process.env.FUEL_PATH_GNAF_API_URL,
    token: process.env.FUEL_PATH_GNAF_API_TOKEN,
  };
  process.env.FUEL_PATH_GNAF_API_URL = "https://address.example.test";
  process.env.FUEL_PATH_GNAF_API_TOKEN = "secret-test-token";
  let request;
  const adapters = createAddressStorageAdapters({
    fetchFn: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ suggestions: [{ label: "Sydney NSW" }] }) };
    },
  });
  try {
    assert.deepEqual(await adapters.fetchApiSuggestions("Sydney", 99), [{ label: "Sydney NSW" }]);
    assert.equal(new URL(request.url).searchParams.get("limit"), "20");
    assert.equal(request.options.headers.Authorization, "Bearer secret-test-token");
  } finally {
    if (previous.url === undefined) delete process.env.FUEL_PATH_GNAF_API_URL;
    else process.env.FUEL_PATH_GNAF_API_URL = previous.url;
    if (previous.token === undefined) delete process.env.FUEL_PATH_GNAF_API_TOKEN;
    else process.env.FUEL_PATH_GNAF_API_TOKEN = previous.token;
  }
});
