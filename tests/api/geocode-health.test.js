const assert = require("node:assert/strict");
const test = require("node:test");

const geocodeHealthHandler = require("../../api/cron/geocode-health");

test("rejects unauthorised request without CRON_SECRET", async () => {
  const original = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-secret";
  try {
    const res = await callHealth({ headers: {} });
    assert.equal(res.status, 401);
    assert.match(res.payload.error, /CRON_SECRET/);
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});

test("returns healthy when hosted mode active and probe returns exact G-NAF", async () => {
  await withHealthEnv({ hosted: true, readiness: "ready" }, async () => {
    const res = await callHealth({ headers: { authorization: "Bearer test-secret" } });
    assert.equal(res.status, 200);
    assert.equal(res.payload.healthy, true);
    assert.equal(res.payload.probe.hasLocation, true);
    assert.equal(res.payload.probe.lookupStatus, "ok");
    assert.equal(res.payload.probe.provider, "fuel_path_gnaf");
    assert.equal(res.payload.probe.matchType, "exact_address");
    assert.equal(res.payload.addressIndex.mode, "api");
  });
});

test("returns unhealthy when address index mode is not hosted", async () => {
  await withHealthEnv({ hosted: false, production: true }, async () => {
    const res = await callHealth({ headers: { authorization: "Bearer test-secret" } });
    assert.equal(res.status, 503);
    assert.equal(res.payload.healthy, false);
    assert.equal(res.payload.failureCategory, "address_index_not_hosted");
  });
});

test("returns unhealthy when probe degrades", async () => {
  await withHealthEnv({ hosted: true, readiness: "ready", probeDegraded: true }, async () => {
    const res = await callHealth({ headers: { authorization: "Bearer test-secret" } });
    assert.equal(res.status, 503);
    assert.equal(res.payload.healthy, false);
    assert.ok(res.payload.failureCategory.startsWith("probe_"));
  });
});

test("returns unhealthy when readiness has blockers", async () => {
  await withHealthEnv({ hosted: true, readiness: "not_ready" }, async () => {
    const res = await callHealth({ headers: { authorization: "Bearer test-secret" } });
    assert.equal(res.status, 503);
    assert.equal(res.payload.healthy, false);
    assert.ok(
 ["readiness_not_ready", "probe_not_exact"].includes(res.payload.failureCategory),
 "expected readiness or probe failure category, got: " + res.payload.failureCategory,
 );
  });
});

test("response does not include probe query, address label, lat/lon, session token or raw error", async () => {
  await withHealthEnv({ hosted: true, readiness: "ready" }, async () => {
    const res = await callHealth({ headers: { authorization: "Bearer test-secret" } });
    const text = JSON.stringify(res.payload);
    assert.equal(text.includes("87A Corea"), false);
    assert.equal(text.includes("Sylvania"), false);
    assert.equal(text.includes("-34.01"), false);
    assert.equal(text.includes("151.09"), false);
    assert.equal(text.includes("sessionToken"), false);
    assert.equal(res.payload.probe.query, undefined);
    assert.equal(res.payload.probe.label, undefined);
    assert.equal(res.payload.probe.lat, undefined);
    assert.equal(res.payload.probe.lon, undefined);
  });
});

// --- Helpers ---

function callHealth({ headers }) {
  return new Promise(function(resolve) {
    const req = { method: "GET", query: {}, headers: headers || {} };
    const res = {
      statusCode: 200,
      headers: {},
      status: function(code) { this.statusCode = code; return this; },
      setHeader: function(key, value) { this.headers[key.toLowerCase()] = value; },
      json: function(payload) { resolve({ status: this.statusCode, payload: payload, headers: this.headers }); },
    };
    geocodeHealthHandler(req, res);
  });
}

async function withHealthEnv({ hosted, readiness, probeDegraded, production }, callback) {
  const keys = [
    "CRON_SECRET",
    "FUEL_PATH_GEOCODE_PROVIDER",
    "FUEL_PATH_GNAF_API_URL",
    "FUEL_PATH_GNAF_API_TOKEN",
    "FUEL_PATH_GNAF_DATABASE_URL",
    "FUEL_PATH_GNAF_SQLITE_PATH",
    "FUEL_PATH_GNAF_ADDRESS_ROWS",
    "FUEL_PATH_GNAF_EXACT_SMOKE_STATUS",
    "FUEL_PATH_GNAF_BENCHMARK_STATUS",
    "FUEL_PATH_GNAF_BENCHMARK_AT",
    "FUEL_PATH_GNAF_BENCHMARK_CASES",
    "FUEL_PATH_GNAF_BENCHMARK_ADDRESS_TOP_RATE",
    "FUEL_PATH_GNAF_BENCHMARK_POI_TOP_RATE",
    "FUEL_PATH_GNAF_BENCHMARK_ADDRESS_P90_CHARS",
    "FUEL_PATH_GNAF_BENCHMARK_POI_P90_CHARS",
    "FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED",
    "FUEL_PATH_WA_FUELWATCH_ENABLED",
 "FUEL_PATH_PRODUCTION_HARDENING",
    "FUEL_PATH_DISABLE_STATION_GEOCODE",
 "FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES",
  ];
  const saved = {};
  for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
  process.env.CRON_SECRET = "test-secret";
  process.env.FUEL_PATH_WA_FUELWATCH_ENABLED = "0";
  process.env.FUEL_PATH_DISABLE_STATION_GEOCODE = "1";
 process.env.FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES = "0";
  process.env.FUEL_PATH_GEOCODE_PROVIDER = "nominatim";
 if (production) process.env.FUEL_PATH_PRODUCTION_HARDENING = "1";
  if (hosted) {
    process.env.FUEL_PATH_GNAF_API_URL = "http://localhost:19999";
    process.env.FUEL_PATH_GNAF_API_TOKEN = "a".repeat(32);
  }
  if (readiness === "ready") {
    process.env.FUEL_PATH_GNAF_ADDRESS_ROWS = "16905824";
    process.env.FUEL_PATH_GNAF_EXACT_SMOKE_STATUS = "passed";
    process.env.FUEL_PATH_GNAF_BENCHMARK_STATUS = "passed";
    process.env.FUEL_PATH_GNAF_BENCHMARK_AT = new Date(Date.now() - 86400000).toISOString();
    process.env.FUEL_PATH_GNAF_BENCHMARK_CASES = "900";
    process.env.FUEL_PATH_GNAF_BENCHMARK_ADDRESS_TOP_RATE = "1";
    process.env.FUEL_PATH_GNAF_BENCHMARK_POI_TOP_RATE = "1";
    process.env.FUEL_PATH_GNAF_BENCHMARK_ADDRESS_P90_CHARS = "18";
    process.env.FUEL_PATH_GNAF_BENCHMARK_POI_P90_CHARS = "3";
  }
  // Mock fetch to simulate hosted G-NAF API or degraded
  const origFetch = global.fetch;
  if (hosted && !probeDegraded) {
    global.fetch = async (url) => {
      if (String(url).includes("localhost:19999")) {
        return {
          ok: true,
          json: async () => ({ suggestions: [{ id: "GNAF-87A-COREA", label: "87A Corea Street, Sylvania NSW 2224", lat: -34.015, lon: 151.099, matchType: "exact_address", accuracy: "address_index", state: "NSW", postcode: "2224" }] }),
      };
      }
      return { ok: false, status: 429, json: async () => ({ error: "blocked" }), text: async () => "blocked" };
    };
  } else if (probeDegraded) {
    global.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: "down" }), text: async () => "down" });
  } else {
    global.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: "blocked" }), text: async () => "blocked" });
  }
  try {
    await callback();
  } finally {
    global.fetch = origFetch;
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}
