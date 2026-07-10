const assert = require("node:assert/strict");
const test = require("node:test");

const { buildRoute, geocode, geocodeProviderStatus, routeProviderStatus } = require("../../api/_backend");
const {
  resetMemoryGeocodeQuotaForTests,
  setGeocodeQuotaStorageForTests,
} = require("../../api/_geocodeQuotaStorage");

const activeFetchMockRestorers = new Set();
test.afterEach(() => {
  for (const restore of [...activeFetchMockRestorers]) restore();
});

const GOOGLE_ENV_KEYS = [
  "FUEL_PATH_GOOGLE_MAPS_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "FUEL_PATH_GOOGLE_PLACES_API_KEY",
  "FUEL_PATH_GOOGLE_ROUTES_API_KEY",
  "FUEL_PATH_ADDRESSR_BASE_URL",
  "FUEL_PATH_ADDRESSR_RAPIDAPI_KEY",
  "FUEL_PATH_ADDRESSR_RAPIDAPI_HOST",
  "ADDRESSR_BASE_URL",
  "ADDRESSR_RAPIDAPI_KEY",
  "FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED",
  "FUEL_PATH_GOOGLE_PLACES_FALLBACK_ENABLED",
  "FUEL_PATH_PAID_GEOCODE_FALLBACK_PROVIDER",
  "FUEL_PATH_GOOGLE_PLACES_DAILY_CAP",
  "FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED",
  "FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED",
  "FUEL_PATH_GEOCODE_QUOTA_DATABASE_URL",
  "FUEL_PATH_GOOGLE_PLACES_MIN_QUERY_LENGTH",
  "FUEL_PATH_HERE_API_KEY",
  "FUEL_PATH_PLAN_AUTOCOMPLETE_PROVIDER_CASCADE_ENABLED",
  "FUEL_PATH_GEOCODE_PROVIDER",
  "FUEL_PATH_ROUTE_PROVIDER",
  "FUEL_PATH_PRODUCTION_HARDENING",
  "NODE_ENV",
  "VERCEL_ENV",
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
    assert.equal(geocoding.paidFallbackEnabled, false);
    assert.equal(geocoding.addressrConfigured, false);
    assert.equal(geocoding.supportedProviders.includes("addressr"), true);

    assert.equal(routing.activeProvider, "osrm");
    assert.equal(routing.activeMode, "validation");
    assert.equal(routing.costMode, "no_cost_validation");
    assert.equal(routing.billableRequestsEnabled, false);
    assert.equal(routing.googleRoutesConfigured, false);
  });
});

test("Google Places key alone does not enable paid autocomplete fallback", () => {
  withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "auto",
    },
    () => {
      const geocoding = geocodeProviderStatus();

      assert.equal(geocoding.primaryProvider, "fuel_path_gnaf");
      assert.equal(geocoding.strategy, "gnaf_first_local_then_controlled_external_fallback");
      assert.equal(geocoding.googlePlacesConfigured, true);
      assert.equal(geocoding.paidFallbackEnabled, false);
      assert.equal(geocoding.activeProvider, "nominatim");
      assert.equal(geocoding.billableRequestsEnabled, false);
      assert.equal(geocoding.costMode, "no_cost_validation");
      assert.equal(geocoding.googlePlacesQuotaStorage.durable, false);
    },
  );
});

test("auto geocoding can select Google only after explicit paid fallback enablement", () => {
  withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "auto",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_DAILY_CAP: "25",
    },
    () => {
      const geocoding = geocodeProviderStatus();

      assert.equal(geocoding.activeProvider, "google");
      assert.equal(geocoding.paidFallbackEnabled, true);
      assert.equal(geocoding.billableRequestsEnabled, true);
      assert.equal(geocoding.googlePlacesDailyCap, 25);
      assert.equal(geocoding.googlePlacesQuotaStorage.mode, "memory_ephemeral");
      assert.equal(geocoding.sessionTokenRequired, true);
    },
  );
});

test("auto geocoding with Google key but disabled paid fallback does not call Google", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "auto",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();

      const payload = await geocode({
        query: `Disabled Google Fallback Place ${Date.now()}`,
        limit: 2,
        sessionToken: "session-disabled",
      });

      assert.equal(payload.provider, "nominatim");
      assert.equal(payload.lookupStatus, "degraded");
      assert.equal(mockFetch.calls.some((call) => call.host === "places.googleapis.com"), false);

      mockFetch.restore();
    },
  );
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

test("Addressr geocoding is configured behind backend env gates", () => {
  withGoogleEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "addressr",
      FUEL_PATH_ADDRESSR_BASE_URL: "https://addressr.test",
    },
    () => {
      const geocoding = geocodeProviderStatus();

      assert.equal(geocoding.requestedProvider, "addressr");
      assert.equal(geocoding.activeProvider, "addressr");
      assert.equal(geocoding.activeMode, "production_candidate");
      assert.equal(geocoding.addressrConfigured, true);
      assert.equal(geocoding.addressrMode, "self_hosted");
    },
  );
});

test("Addressr geocoding uses mocked search and detail API calls only", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "addressr",
      FUEL_PATH_ADDRESSR_RAPIDAPI_KEY: "test-addressr-key",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();

      const payload = await geocode({
        query: "11 Imaginary Road Testville NSW",
        limit: 2,
        sessionToken: "addressr-session",
      });

      assert.equal(payload.provider, "addressr");
      assert.equal(payload.providerMode, "production_candidate");
      assert.equal(payload.sessionToken, "addressr-session");
      assert.deepEqual(
        payload.suggestions.map((item) => item.label),
        ["11 Imaginary Road, Testville NSW 2000", "Unit 2, 11 Imaginary Road, Testville NSW 2000"],
      );
      assert.deepEqual(
        payload.suggestions.map((item) => item.providerId),
        ["GANSW_1", "GANSW_2"],
      );
      assert.equal(payload.location.lat, -33.861);
      assert.equal(payload.location.lon, 151.2);
      assert.equal(mockFetch.calls.length, 3);
      assert.equal(mockFetch.calls.every((call) => call.host === "addressr.p.rapidapi.com"), true);
      assert.equal(mockFetch.calls.every((call) => call.rapidApiKey === "test-addressr-key"), true);
      assert.equal(mockFetch.unexpectedCalls.length, 0);

      mockFetch.restore();
    },
  );
});

test("Google Places geocoding is exercised through mocked API calls only", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
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

test("Plan autocomplete uses Google predictions without Place Details", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
      FUEL_PATH_PLAN_AUTOCOMPLETE_PROVIDER_CASCADE_ENABLED: "1",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();

      const payload = await geocode({
        query: "Sydney Town Hall",
        limit: 2,
        purpose: "plan_autocomplete",
        sessionToken: "session-plan-autocomplete",
        searchContext: {
          nearLat: -33.873,
          nearLon: 151.207,
          nearRadiusKm: 25,
        },
      });

      assert.equal(payload.provider, "google");
      assert.equal(payload.lookupStatus, "ok");
      assert.deepEqual(
        payload.suggestions.map((item) => item.label),
        ["Sydney Town Hall", "Town Hall Station"],
      );
      assert.deepEqual(
        payload.suggestions.map((item) => item.refineRequired),
        [true, true],
      );
      assert.deepEqual(
        payload.suggestions.map((item) => item.providerId),
        ["places/sydney-town-hall", "places/town-hall-station"],
      );
      assert.equal(mockFetch.calls.length, 1);
      assert.equal(mockFetch.calls[0].host, "places.googleapis.com");
      assert.equal(mockFetch.calls[0].path, "/v1/places:autocomplete");
      assert.equal(mockFetch.calls[0].body.input, "Sydney Town Hall");
      assert.equal(mockFetch.calls[0].body.sessionToken, "session-plan-autocomplete");
      assert.deepEqual(mockFetch.calls[0].body.includedRegionCodes, ["au"]);
      assert.equal(mockFetch.calls[0].body.languageCode, "en-AU");
      assert.deepEqual(mockFetch.calls[0].body.locationBias, {
        circle: {
          center: { latitude: -33.873, longitude: 151.207 },
          radius: 25000,
        },
      });
      assert.equal(
        mockFetch.calls[0].fieldMask,
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.types",
      );

      mockFetch.restore();
    },
  );
});

test("selected Google autocomplete suggestion resolves with Place Details", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
      FUEL_PATH_PLAN_AUTOCOMPLETE_PROVIDER_CASCADE_ENABLED: "1",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();

      const payload = await geocode({
        query: "Sydney Town Hall",
        limit: 1,
        provider: "google",
        providerPlaceId: "places/sydney-town-hall",
        sessionToken: "session-plan-select",
      });

      assert.equal(payload.lookupStatus, "ok");
      assert.equal(payload.location.label, "Sydney Town Hall, 483 George St, Sydney NSW 2000, Australia");
      assert.equal(payload.location.lat, -33.8732);
      assert.equal(payload.location.lon, 151.2067);
      assert.equal(mockFetch.calls.length, 1);
      assert.equal(mockFetch.calls[0].path, "/v1/places/places%2Fsydney-town-hall");

      mockFetch.restore();
    },
  );
});

test("Plan autocomplete falls back to HERE when Google predictions are empty", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_HERE_API_KEY: "test-here-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
      FUEL_PATH_PLAN_AUTOCOMPLETE_PROVIDER_CASCADE_ENABLED: "1",
    },
    async () => {
      const mockFetch = installGoogleEmptyHereMockFetch();

      const payload = await geocode({
        query: "Sylvania Heights Public School",
        limit: 2,
        purpose: "plan_autocomplete",
        sessionToken: "session-plan-here",
      });

      assert.equal(payload.provider, "google");
      assert.equal(payload.lookupStatus, "local_fallback");
      assert.match(payload.warning, /backup match/i);
      assert.equal(payload.location.label, "Sylvania Heights Public School");
      assert.equal(payload.location.provider, "here");
      assert.equal(mockFetch.calls.length, 2);
      assert.deepEqual(mockFetch.calls.map((call) => call.host), ["places.googleapis.com", "autosuggest.search.hereapi.com"]);

      mockFetch.restore();
    },
  );
});

test("exact G-NAF address skips Google even when paid fallback is enabled", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();

      const payload = await geocode({
        query: "87a corea street sylvania nsw 2224",
        limit: 2,
        sessionToken: "session-gnaf-first",
      });

      assert.equal(payload.lookupStatus, "ok");
      assert.equal(payload.location.label, "87A Corea Street, Sylvania NSW 2224");
      assert.equal(payload.location.provider, "fuel_path_gnaf");
      assert.equal(payload.location.matchType, "exact_address");
      assert.equal(mockFetch.calls.length, 0);

      mockFetch.restore();
    },
  );
});

test("Google Places fallback is fail-closed when daily cap is exhausted", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_DAILY_CAP: "0",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();

      const payload = await geocode({
        query: `Uncached Google Only Place ${Date.now()}`,
        limit: 2,
        sessionToken: "session-cap",
      });

      assert.equal(payload.provider, "google");
      assert.equal(payload.lookupStatus, "degraded");
      assert.equal(payload.location, null);
      assert.match(payload.warning, /Address lookup is paused for now/i);
      assert.equal(mockFetch.calls.length, 0);

      mockFetch.restore();
    },
  );
});

test("Google Places fallback uses durable quota storage before provider calls", async () => {
  const quotaStore = durableQuotaStore();
  setGeocodeQuotaStorageForTests(quotaStore);
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_DAILY_CAP: "1",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();
      const first = await geocode({
        query: `Uncached Google Durable Place A ${Date.now()}`,
        limit: 1,
        sessionToken: "session-durable-a",
      });
      const second = await geocode({
        query: `Uncached Google Durable Place B ${Date.now()}`,
        limit: 1,
        sessionToken: "session-durable-b",
      });

      assert.equal(first.lookupStatus, "ok");
      assert.equal(second.lookupStatus, "degraded");
      assert.match(second.warning, /Address lookup is paused for now/i);
      assert.equal(quotaStore.calls, 1);
      assert.equal(quotaStore.denied, 1);
      assert.equal(mockFetch.calls.length, 2);

      mockFetch.restore();
    },
  );
  setGeocodeQuotaStorageForTests(null);
});

test("production Google Places fallback fails closed without durable quota storage", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_DAILY_CAP: "10",
      FUEL_PATH_PRODUCTION_HARDENING: "1",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();
      const payload = await geocode({
        query: `Uncached Google Production Quota ${Date.now()}`,
        limit: 1,
        sessionToken: "session-production-quota",
      });

      assert.equal(payload.lookupStatus, "degraded");
      assert.equal(payload.location, null);
      assert.match(payload.warning, /Address lookup is limited right now/i);
      assert.equal(mockFetch.calls.length, 0);

      mockFetch.restore();
    },
  );
});

test("Google Places fallback requires a session token before any paid request", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();

      const payload = await geocode({
        query: `Missing Session Google Place ${Date.now()}`,
        limit: 2,
        sessionToken: "",
      });

      assert.equal(payload.provider, "google");
      assert.equal(payload.lookupStatus, "degraded");
      assert.match(payload.warning, /Address lookup needs a new search session/i);
      assert.equal(mockFetch.calls.length, 0);

      mockFetch.restore();
    },
  );
});

test("malformed Google Places payload degrades without leaking a false suggestion", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
    },
    async () => {
      const mockFetch = installMalformedGoogleFetch();

      const payload = await geocode({
        query: `Malformed Google Place ${Date.now()}`,
        limit: 2,
        sessionToken: "session-malformed",
      });

      assert.equal(payload.provider, "google");
      assert.equal(payload.lookupStatus, "degraded");
      assert.equal(payload.location, null);
      assert.deepEqual(payload.suggestions, []);
      assert.match(payload.warning, /No strong location match/i);
      assert.equal(mockFetch.calls.length, 1);

      mockFetch.restore();
    },
  );
});

test("cached Google fallback result avoids repeated paid provider calls", async () => {
  await withGoogleEnv(
    {
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "test-google-places-key",
      FUEL_PATH_GEOCODE_PROVIDER: "google",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
    },
    async () => {
      const mockFetch = installGoogleMockFetch();
      const query = `Sydney Town Hall Cache ${Date.now()}`;

      const first = await geocode({ query, limit: 2, sessionToken: "session-cache-1" });
      const second = await geocode({ query, limit: 2, sessionToken: "session-cache-2" });

      assert.equal(first.lookupStatus, "ok");
      assert.equal(second.cache, "hit");
      assert.equal(second.cacheMode, "fresh");
      assert.equal(second.sessionToken, "session-cache-2");
      assert.equal(mockFetch.calls.length, 3);

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
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "1",
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

  const mockedFetch = async (input, options = {}) => {
    const url = new URL(String(input));
    const call = {
      host: url.hostname,
      path: url.pathname,
      search: url.search,
      rapidApiKey: options.headers?.["x-rapidapi-key"] || "",
      body: options.body ? JSON.parse(options.body) : null,
      fieldMask: options.headers?.["X-Goog-FieldMask"] || "",
      mocked: true,
    };
    calls.push(call);

    if (url.hostname === "places.googleapis.com" && url.pathname === "/v1/places:autocomplete") {
      return jsonResponse({
        suggestions: [
          { placePrediction: { placeId: "places/sydney-town-hall", text: { text: "Sydney Town Hall" }, types: ["point_of_interest"] } },
          { placePrediction: { placeId: "places/town-hall-station", text: { text: "Town Hall Station" }, types: ["transit_station"] } },
        ],
      });
    }

    if (url.hostname === "addressr.p.rapidapi.com" && url.pathname === "/addresses") {
      return jsonResponse([
        {
          sla: "11 IMAGINARY RD, TESTVILLE NSW 2000",
          score: 1,
          links: { self: { href: "/addresses/GANSW_1" } },
        },
        {
          sla: "UNIT 2, 11 IMAGINARY RD, TESTVILLE NSW 2000",
          score: 0.98,
          links: { self: { href: "/addresses/GANSW_2" } },
        },
      ]);
    }

    if (url.hostname === "addressr.p.rapidapi.com" && url.pathname === "/addresses/GANSW_1") {
      return jsonResponse({
        pid: "GANSW_1",
        sla: "11 IMAGINARY ROAD, TESTVILLE NSW 2000",
        structured: {
          state: { abbreviation: "NSW" },
          postcode: "2000",
        },
        geo: {
          geocodes: [
            {
              default: true,
              latitude: -33.861,
              longitude: 151.2,
              reliability: { name: "WITHIN ADDRESS SITE BOUNDARY OR ACCESS POINT" },
            },
          ],
        },
      });
    }

    if (url.hostname === "addressr.p.rapidapi.com" && url.pathname === "/addresses/GANSW_2") {
      return jsonResponse({
        pid: "GANSW_2",
        sla: "UNIT 2, 11 IMAGINARY ROAD, TESTVILLE NSW 2000",
        structured: {
          state: { abbreviation: "NSW" },
          postcode: "2000",
        },
        geo: {
          geocodes: [
            {
              default: true,
              latitude: -33.8612,
              longitude: 151.2002,
              reliability: { name: "WITHIN ADDRESS SITE BOUNDARY OR ACCESS POINT" },
            },
          ],
        },
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
  global.fetch = mockedFetch;

  return trackedFetchMock(originalFetch, mockedFetch, {
    calls,
    unexpectedCalls,
  });
}

function installGoogleEmptyHereMockFetch() {
  const originalFetch = global.fetch;
  const calls = [];
  const mockedFetch = async (input, options = {}) => {
    const url = new URL(String(input));
    const call = {
      host: url.hostname,
      path: url.pathname,
      search: url.search,
      body: options.body ? JSON.parse(options.body) : null,
      mocked: true,
    };
    calls.push(call);
    if (url.hostname === "places.googleapis.com" && url.pathname === "/v1/places:autocomplete") {
      return jsonResponse({ suggestions: [] });
    }
    if (url.hostname === "autosuggest.search.hereapi.com" && url.pathname === "/v1/autosuggest") {
      return jsonResponse({
        items: [
          {
            title: "Sylvania Heights Public School",
            id: "here:school:sylvania-heights",
            resultType: "place",
            position: { lat: -34.014, lng: 151.104 },
          },
        ],
      });
    }
    return jsonResponse({ error: { message: `Unexpected mocked URL ${url.href}` } }, 500);
  };
  global.fetch = mockedFetch;
  return trackedFetchMock(originalFetch, mockedFetch, {
    calls,
  });
}

function installMalformedGoogleFetch() {
  const originalFetch = global.fetch;
  const calls = [];
  const mockedFetch = async (input, options = {}) => {
    const url = new URL(String(input));
    calls.push({
      host: url.hostname,
      path: url.pathname,
      body: options.body ? JSON.parse(options.body) : null,
    });
    return jsonResponse({ suggestions: [{ placePrediction: {} }, { bad: "shape" }] });
  };
  global.fetch = mockedFetch;
  return trackedFetchMock(originalFetch, mockedFetch, {
    calls,
  });
}

function trackedFetchMock(originalFetch, mockedFetch, details) {
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (global.fetch === mockedFetch) global.fetch = originalFetch;
    activeFetchMockRestorers.delete(restore);
  };
  activeFetchMockRestorers.add(restore);
  return { ...details, restore };
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
    resetMemoryGeocodeQuotaForTests();
    setGeocodeQuotaStorageForTests(null);
    for (const key of GOOGLE_ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
}

function durableQuotaStore() {
  return {
    calls: 0,
    denied: 0,
    status() {
      return {
        mode: "postgres_neon",
        configured: true,
        durable: true,
        table: "fuel_path_geocode_quotas",
        warning: "",
      };
    },
    async reserve({ cap, date }) {
      if (this.calls >= cap) {
        this.denied += 1;
        return { allowed: false, calls: this.calls, cap, date, durable: true };
      }
      this.calls += 1;
      return { allowed: true, calls: this.calls, cap, date, durable: true };
    },
  };
}
