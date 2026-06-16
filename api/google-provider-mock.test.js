const assert = require("node:assert/strict");
const test = require("node:test");

const { buildRoute, geocode, geocodeProviderStatus, routeProviderStatus } = require("./_backend");

const GOOGLE_ENV_KEYS = [
  "FUEL_PATH_GOOGLE_MAPS_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "FUEL_PATH_GOOGLE_PLACES_API_KEY",
  "FUEL_PATH_GOOGLE_ROUTES_API_KEY",
  "FUEL_PATH_GEOCODE_PROVIDER",
  "FUEL_PATH_ROUTE_PROVIDER",
];

test("default provider status stays in no-cost validation mode when Google keys are absent", () => {
  withGoogleEnv({}, () => {
    const geocoding = geocodeProviderStatus();
    const routing = routeProviderStatus();

    assert.equal(geocoding.activeProvider, "nominatim");
    assert.equal(geocoding.activeMode, "validation");
    assert.equal(geocoding.costMode, "no_cost_validation");
    assert.equal(geocoding.billableRequestsEnabled, false);
    assert.equal(geocoding.googlePlacesConfigured, false);

    assert.equal(routing.activeProvider, "osrm");
    assert.equal(routing.activeMode, "validation");
    assert.equal(routing.costMode, "no_cost_validation");
    assert.equal(routing.billableRequestsEnabled, false);
    assert.equal(routing.googleRoutesConfigured, false);
  });
});

test("requesting Google routing without a key falls back to no-cost OSRM status", () => {
  withGoogleEnv({ FUEL_PATH_ROUTE_PROVIDER: "google" }, () => {
    const routing = routeProviderStatus();

    assert.equal(routing.requestedProvider, "google");
    assert.equal(routing.activeProvider, "osrm");
    assert.equal(routing.costMode, "no_cost_validation");
    assert.equal(routing.billableRequestsEnabled, false);
    assert.equal(routing.googleRoutesConfigured, false);
  });
});

test("Google Places geocoding is exercised through mocked API calls only", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();

      const payload = await geocode({
        query: "Sydney Town Hall",
        limit: 2,
        sessionToken: "session-123",
      });

      assert.equal(payload.provider, "google");
      assert.equal(payload.providerMode, "production_candidate");
      assert.equal(payload.sessionToken, "session-123");
      assert.deepEqual(
        payload.suggestions.map((item) => item.label),
        ["Sydney Town Hall, 483 George St, Sydney NSW 2000, Australia", "Town Hall Station, Sydney NSW 2000, Australia"],
      );
      assert.deepEqual(
        payload.suggestions.map((item) => item.providerId),
        ["places/sydney-town-hall", "places/town-hall-station"],
      );
      assert.equal(payload.location.lat, -33.8732);
      assert.equal(payload.location.lon, 151.2067);
      assert.equal(mockFetch.calls.length, 3);
      assert.equal(mockFetch.calls[0].body.sessionToken, "session-123");
      assert.equal(mockFetch.calls[0].body.includedRegionCodes[0], "au");
      assert.equal(mockFetch.calls.every((call) => call.host === "places.googleapis.com"), true);
      assert.equal(mockFetch.unexpectedCalls.length, 0);

      mockFetch.restore();
    },
  );
});

test("Google Routes is exercised through mocked API calls only", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_ROUTES_API_KEY: "test-google-routes-key",
      FUEL_PATH_ROUTE_PROVIDER: "google",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();

      const payload = await buildRoute({
        from: { label: "Sydney", lat: -33.8688, lon: 151.2093 },
        to: { label: "Parramatta", lat: -33.8136, lon: 151.0034 },
      });

      assert.equal(payload.provider, "google_routes");
      assert.equal(payload.distanceKm, 24.7);
      assert.equal(payload.durationMin, 32.5);
      assert.equal(payload.points.length, 3);
      assert.equal(payload.points[0].label, "Sydney");
      assert.equal(payload.points.at(-1).label, "Parramatta");
      assert.equal(mockFetch.calls.length, 1);
      assert.equal(mockFetch.calls[0].host, "routes.googleapis.com");
      assert.equal(mockFetch.calls[0].body.travelMode, "DRIVE");
      assert.equal(mockFetch.calls[0].body.languageCode, "en-AU");
      assert.equal(mockFetch.unexpectedCalls.length, 0);

      mockFetch.restore();
    },
  );
});

test("mocked Google provider stress run does not escape to live network", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GOOGLE_ROUTES_API_KEY: "test-google-routes-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_ROUTE_PROVIDER: "google",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();
      const suburbs = ["Sydney", "Parramatta", "Penrith", "Gosford", "Wollongong", "Newcastle", "Geelong", "Brisbane"];

      for (let index = 0; index < 40; index += 1) {
        const query = `${suburbs[index % suburbs.length]} fuel ${index}`;
        const result = await geocode({ query, limit: 1, sessionToken: `stress-${index}` });
        assert.equal(result.provider, "google", query);
      }

      for (let index = 0; index < 25; index += 1) {
        const route = await buildRoute({
          from: { label: `Origin ${index}`, lat: -33.9 + index / 1000, lon: 151.1 },
          to: { label: `Destination ${index}`, lat: -33.8, lon: 151.2 - index / 1000 },
        });
        assert.equal(route.provider, "google_routes", String(index));
      }

      assert.equal(mockFetch.unexpectedCalls.length, 0);
      assert.equal(mockFetch.calls.every((call) => call.mocked === true), true);
      assert.equal(mockFetch.calls.length, 105);

      mockFetch.restore();
    },
  );
});

function installGoogleMockFetch() {
  const originalFetch = global.fetch;
  const calls = [];
  const unexpectedCalls = [];

  global.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    const call = {
      host: url.hostname,
      path: url.pathname,
      body: options.body ? JSON.parse(options.body) : null,
      mocked: true,
    };
    calls.push(call);

    if (url.hostname === "places.googleapis.com" && url.pathname === "/v1/places:autocomplete") {
      return jsonResponse({
        suggestions: [
          { placePrediction: { placeId: "places/sydney-town-hall" } },
          { placePrediction: { placeId: "places/town-hall-station" } },
        ],
      });
    }

    if (url.hostname === "places.googleapis.com" && url.pathname === "/v1/places/places%2Fsydney-town-hall") {
      return jsonResponse({
        id: "places/sydney-town-hall",
        formattedAddress: "Sydney Town Hall, 483 George St, Sydney NSW 2000, Australia",
        location: { latitude: -33.8732, longitude: 151.2067 },
        types: ["local_government_office", "point_of_interest"],
      });
    }

    if (url.hostname === "places.googleapis.com" && url.pathname === "/v1/places/places%2Ftown-hall-station") {
      return jsonResponse({
        id: "places/town-hall-station",
        formattedAddress: "Town Hall Station, Sydney NSW 2000, Australia",
        location: { latitude: -33.8736, longitude: 151.2069 },
        types: ["transit_station", "point_of_interest"],
      });
    }

    if (url.hostname === "routes.googleapis.com" && url.pathname === "/directions/v2:computeRoutes") {
      return jsonResponse({
        routes: [
          {
            distanceMeters: 24700,
            duration: "1950s",
            polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
          },
        ],
      });
    }

    unexpectedCalls.push(call);
    return jsonResponse({ error: { message: `Unexpected mocked URL ${url.href}` } }, 500);
  };

  return {
    calls,
    unexpectedCalls,
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

async function withGoogleEnv(overrides, callback) {
  const originalEnv = {};
  for (const key of GOOGLE_ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }

  try {
    return await callback();
  } finally {
    for (const key of GOOGLE_ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
}
