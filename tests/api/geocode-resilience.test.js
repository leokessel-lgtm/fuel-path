const assert = require("node:assert/strict");
const test = require("node:test");

const { geocode } = require("../../api/_backend");

test("validation geocode rate limits degrade without throwing", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Too many requests" } }, 429),
    );

    const result = await geocode({
      query: `13 Example Failure Street ${Date.now()}`,
      limit: 5,
      sessionToken: "rate-limit-session",
    });

    assert.equal(result.provider, "nominatim");
    assert.equal(result.providerMode, "validation");
    assert.equal(result.lookupStatus, "degraded");
    assert.equal(result.location, null);
    assert.deepEqual(result.suggestions, []);
    assert.match(result.warning, /rate-limited/i);
    assert.equal(mockFetch.calls.length, 1);

    mockFetch.restore();
  });
});

test("local geocode hints survive provider rate limiting", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Too many requests" } }, 429),
    );

    const result = await geocode({
      query: "Melbourne Central",
      limit: 5,
      sessionToken: "local-fallback-session",
    });

    assert.equal(result.lookupStatus, "local_fallback");
    assert.equal(result.location.label, "Melbourne Central, Melbourne VIC 3000");
    assert.equal(result.suggestions[0].provider, "fuel_path_hint");
    assert.match(result.warning, /rate-limited|cooling down/i);

    mockFetch.restore();
  });
});

test("geocode cache avoids repeated provider calls for the same query", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "geoapify",
      FUEL_PATH_GEOAPIFY_API_KEY: "test-geoapify-key",
    },
    async () => {
    const query = `Cacheable Place ${Date.now()}`;
    const mockFetch = installFetchMock(() =>
      jsonResponse({
        features: [
          {
            properties: {
              formatted: "Cacheable Place, Sydney NSW, Australia",
              lat: -33.86,
              lon: 151.21,
              result_type: "amenity",
              place_id: "cacheable-place",
            },
          },
        ],
      }),
    );

    const first = await geocode({ query, limit: 5, sessionToken: "first" });
    const second = await geocode({ query, limit: 5, sessionToken: "second" });

    assert.equal(first.lookupStatus, "ok");
    assert.equal(second.cache, "hit");
    assert.equal(second.sessionToken, "second");
    assert.equal(second.location.label, first.location.label);
    assert.equal(mockFetch.calls.length, 1);

    mockFetch.restore();
    },
  );
});

function installFetchMock(handler) {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (input, options = {}) => {
    calls.push({ input: String(input), options });
    return handler(input, options);
  };
  return {
    calls,
    restore() {
      global.fetch = originalFetch;
    },
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    async text() {
      return JSON.stringify(payload);
    },
  };
}

async function withGeocodeEnv(overrides, callback) {
  const keys = [
    "FUEL_PATH_GEOCODE_PROVIDER",
    "FUEL_PATH_GOOGLE_MAPS_API_KEY",
    "GOOGLE_MAPS_API_KEY",
    "FUEL_PATH_GOOGLE_PLACES_API_KEY",
    "FUEL_PATH_MAPBOX_ACCESS_TOKEN",
    "MAPBOX_ACCESS_TOKEN",
    "FUEL_PATH_HERE_API_KEY",
    "HERE_API_KEY",
    "FUEL_PATH_GEOAPIFY_API_KEY",
    "GEOAPIFY_API_KEY",
  ];
  const originalEnv = {};
  for (const key of keys) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
}
