const assert = require("node:assert/strict");
const test = require("node:test");

const { buildRoute, loadStationData, scoreRoute } = require("../../api/_backend");
const { providerTimeoutMs } = require("../../api/_providerRuntime");

test("provider timeout defaults use fallback values when env is unset", async () => {
  await withEnv(
    {
      FUEL_PATH_PROVIDER_TIMEOUT_MS: "",
      FUEL_PATH_TAS_TIMEOUT_MS: "",
    },
    async () => {
      assert.equal(providerTimeoutMs("tas", 60000), 60000);
    },
  );
});

test("Google Routes timeout falls back to OSRM with an explicit provider warning", async () => {
  await withEnv(
    {
      FUEL_PATH_ROUTE_PROVIDER: "google",
      FUEL_PATH_GOOGLE_ROUTES_API_KEY: "test-google-routes-key",
      FUEL_PATH_GOOGLE_ROUTES_TIMEOUT_MS: "25",
      FUEL_PATH_OSRM_TIMEOUT_MS: "1000",
    },
    async () => {
      const mockFetch = installFetchMock(async (url, options = {}) => {
        const parsed = new URL(String(url));
        if (parsed.hostname === "routes.googleapis.com") return abortableProviderCall(options.signal);
        if (parsed.hostname === "router.project-osrm.org") {
          return jsonResponse({
            code: "Ok",
            routes: [
              {
                distance: 24700,
                duration: 1950,
                geometry: {
                  coordinates: [
                    [151.2093, -33.8688],
                    [151.12, -33.84],
                    [151.0034, -33.8136],
                  ],
                },
              },
            ],
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

      try {
        const route = await buildRoute({
          from: { label: "Sydney", lat: -33.8688, lon: 151.2093 },
          to: { label: "Parramatta", lat: -33.8136, lon: 151.0034 },
        });

        assert.equal(route.provider, "osrm");
        assert.equal(route.providerMode, "validation");
        assert.match(route.providerWarning, /Google Routes unavailable: Provider request timed out after 25ms/);
        assert.equal(mockFetch.calls.length, 2);
      } finally {
        mockFetch.restore();
      }
    },
  );
});

test("cold-cache live provider timeout returns explicit degraded production state", async () => {
  await withEnv(
    {
      FUEL_PATH_PRODUCTION_HARDENING: "1",
      QLD_FUEL_API_TOKEN: "test-qld-token",
      FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
      FUEL_PATH_QLD_TIMEOUT_MS: "25",
    },
    async () => {
      const mockFetch = installFetchMock(async (_url, options = {}) => abortableProviderCall(options.signal));

      try {
        const data = await loadStationData({
          requestedSource: "qld",
          forceRefresh: true,
          points: [{ lat: -27.4698, lon: 153.0251 }],
          radiusKm: 8,
          fuels: ["U91"],
        });

        assert.equal(data.source, "live_unavailable");
        assert.equal(data.provider, "qld");
        assert.equal(data.degraded, true);
        assert.equal(data.stations.length, 0);
        assert.equal(data.cacheMode, "none");
        assert.equal(data.providerHealth.qld.status, "unavailable");
        assert.match(data.warning, /Provider request timed out after 25ms/);
      } finally {
        mockFetch.restore();
      }
    },
  );
});

test("mixed provider outage keeps healthy provider data and reports degraded state", async () => {
  await withEnv(
    {
      NSW_FUEL_API_KEY: "test-nsw-key",
      NSW_FUEL_API_SECRET: "test-nsw-secret",
      QLD_FUEL_API_TOKEN: "test-qld-token",
      QLD_FUEL_API_BASE_URL: "https://example-qld.test",
      FUEL_PATH_QLD_TIMEOUT_MS: "25",
    },
    async () => {
      const mockFetch = installFetchMock(async (url, options = {}) => {
        const parsed = new URL(String(url));
        if (parsed.hostname.includes("example-qld.test")) return abortableProviderCall(options.signal);
        if (parsed.searchParams.get("grant_type") === "client_credentials") return jsonResponse({ access_token: "token" });
        return jsonResponse({
          stations: [
            {
              code: "NSW-1",
              name: "Sydney Reliable Fuel",
              brand: "Metro",
              address: "1 George St, Sydney NSW 2000",
              location: { latitude: -33.8688, longitude: 151.2093 },
            },
          ],
          prices: [
            {
              stationcode: "NSW-1",
              fueltype: "U91",
              price: 181.9,
              lastupdated: "2026-06-17T00:00:00.000Z",
            },
          ],
        });
      });

      try {
        const data = await loadStationData({
          requestedSource: "live",
          forceRefresh: true,
          points: [
            { lat: -27.4698, lon: 153.0251 },
            { lat: -33.8688, lon: 151.2093 },
          ],
          radiusKm: 8,
          fuels: ["U91"],
        });

        assert.equal(data.source.includes("api_nsw"), true);
        assert.equal(data.stations.length, 1);
        assert.equal(data.degraded, true);
        assert.equal(data.providerHealth.nsw.status, "ok");
        assert.equal(data.providerHealth.qld.status, "unavailable");
        assert.match(data.warning, /Some live price sources are temporarily unavailable/);
      } finally {
        mockFetch.restore();
      }
    },
  );
});

test("transient NSW provider failure retries before returning a degraded response", async () => {
  await withEnv(
    {
      NSW_FUEL_API_KEY: "test-nsw-key",
      NSW_FUEL_API_SECRET: "test-nsw-secret",
      FUEL_PATH_NSW_RETRY_ATTEMPTS: "1",
      FUEL_PATH_NSW_RETRY_DELAY_MS: "0",
    },
    async () => {
      let priceAttempts = 0;
      const mockFetch = installFetchMock(async (url) => {
        const parsed = new URL(String(url));
        if (parsed.searchParams.get("grant_type") === "client_credentials") return jsonResponse({ access_token: "token" });
        priceAttempts += 1;
        if (priceAttempts === 1) return jsonResponse({ message: "temporary upstream fault" }, 500);
        return jsonResponse({
          stations: [
            {
              code: "NSW-RETRY-1",
              name: "Retry Reliable Fuel",
              brand: "Metro",
              address: "1 George St, Sydney NSW 2000",
              location: { latitude: -33.8688, longitude: 151.2093 },
            },
          ],
          prices: [
            {
              stationcode: "NSW-RETRY-1",
              fueltype: "U91",
              price: 181.9,
              lastupdated: "2026-06-17T00:00:00.000Z",
            },
          ],
        });
      });

      try {
        const data = await loadStationData({
          requestedSource: "nsw",
          forceRefresh: true,
          points: [{ lat: -33.8688, lon: 151.2093 }],
          radiusKm: 8,
          fuels: ["U91"],
        });

        assert.equal(data.source, "api_nsw");
        assert.equal(data.degraded, false);
        assert.equal(data.cacheMode, "refreshed");
        assert.equal(data.providerHealth.nsw.status, "ok");
        assert.equal(data.stations.length, 1);
        assert.equal(priceAttempts, 2);
      } finally {
        mockFetch.restore();
      }
    },
  );
});

test("stale NSW cache is returned immediately while a single background refresh revalidates", async () => {
  await withEnv(
    {
      NSW_FUEL_API_KEY: "test-nsw-key",
      NSW_FUEL_API_SECRET: "test-nsw-secret",
      FUEL_PATH_LIVE_CACHE_SECONDS: "60",
      FUEL_PATH_NSW_RETRY_DELAY_MS: "0",
    },
    async () => {
      const originalNow = Date.now;
      const startedAt = originalNow();
      let priceAttempts = 0;
      const mockFetch = installFetchMock(async (url) => {
        const parsed = new URL(String(url));
        if (parsed.searchParams.get("grant_type") === "client_credentials") return jsonResponse({ access_token: "token" });
        priceAttempts += 1;
        return jsonResponse(nswFuelPayload(priceAttempts === 1 ? 181.9 : 171.9));
      });

      try {
        Date.now = () => startedAt;
        const fresh = await loadStationData({
          requestedSource: "nsw",
          forceRefresh: true,
          points: [{ lat: -33.8688, lon: 151.2093 }],
          radiusKm: 8,
          fuels: ["U91"],
        });
        assert.equal(fresh.cacheMode, "refreshed");
        assert.equal(fresh.stations[0].prices.U91, 181.9);

        Date.now = () => startedAt + 61 * 1000;
        const stale = await loadStationData({
          requestedSource: "nsw",
          forceRefresh: false,
          points: [{ lat: -33.8688, lon: 151.2093 }],
          radiusKm: 8,
          fuels: ["U91"],
        });
        assert.equal(stale.cacheMode, "stale");
        assert.equal(stale.degraded, true);
        assert.equal(stale.providerHealth.nsw.status, "degraded");
        assert.match(stale.warning, /refreshing in background/i);
        assert.equal(stale.stations[0].prices.U91, 181.9);

        let refreshed = stale;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          await delay(5);
          refreshed = await loadStationData({
            requestedSource: "nsw",
            forceRefresh: false,
            points: [{ lat: -33.8688, lon: 151.2093 }],
            radiusKm: 8,
            fuels: ["U91"],
          });
          if (refreshed.cacheMode === "fresh" && refreshed.stations[0]?.prices?.U91 === 171.9) break;
        }

        assert.equal(refreshed.cacheMode, "fresh");
        assert.equal(refreshed.degraded, false);
        assert.equal(refreshed.stations[0].prices.U91, 171.9);
        assert.equal(priceAttempts, 2);
      } finally {
        Date.now = originalNow;
        mockFetch.restore();
      }
    },
  );
});

test("OSRM route provider handles long geometry payloads within the backend budget", async () => {
  await withEnv(
    {
      FUEL_PATH_ROUTE_PROVIDER: "osrm",
      FUEL_PATH_OSRM_TIMEOUT_MS: "1000",
    },
    async () => {
      const coordinates = Array.from({ length: 1500 }, (_, index) => [
        151.0 + index * 0.0001,
        -34.0 + Math.sin(index / 80) * 0.01,
      ]);
      const mockFetch = installFetchMock(async () =>
        jsonResponse({
          code: "Ok",
          routes: [
            {
              distance: 285000,
              duration: 12600,
              geometry: { coordinates },
            },
          ],
        }),
      );
      const startedAt = Date.now();

      try {
        const route = await buildRoute({
          from: { label: "Long Start", lat: -34, lon: 151 },
          to: { label: "Long End", lat: -33.9, lon: 151.15 },
        });
        const elapsedMs = Date.now() - startedAt;

        assert.equal(route.provider, "osrm");
        assert.equal(route.providerMode, "validation");
        assert.equal(route.points.length, 1500);
        assert.equal(route.points[0].label, "Long Start");
        assert.equal(route.points.at(-1).label, "Long End");
        assert.equal(mockFetch.calls.length, 1);
        assert.equal(elapsedMs < 1000, true, `long route parsing took ${elapsedMs}ms`);
      } finally {
        mockFetch.restore();
      }
    },
  );
});

test("identical concurrent route builds share a single in-flight provider request", async () => {
  await withEnv(
    {
      FUEL_PATH_ROUTE_PROVIDER: "osrm",
      FUEL_PATH_OSRM_TIMEOUT_MS: "1000",
    },
    async () => {
      const mockFetch = installFetchMock(async () => {
        await delay(20);
        return jsonResponse({
          code: "Ok",
          routes: [
            {
              distance: 24700,
              duration: 1950,
              geometry: {
                coordinates: [
                  [151.2093, -33.8688],
                  [151.12, -33.84],
                  [151.0034, -33.8136],
                ],
              },
            },
          ],
        });
      });

      try {
        const routes = await Promise.all(
          Array.from({ length: 50 }, () =>
            buildRoute({
              from: { label: "Sydney", lat: -33.8688, lon: 151.2093 },
              to: { label: "Parramatta", lat: -33.8136, lon: 151.0034 },
            }),
          ),
        );

        assert.equal(routes.length, 50);
        assert.equal(routes.every((route) => route.provider === "osrm"), true);
        assert.equal(routes.every((route) => route.points.length === 3), true);
        assert.equal(mockFetch.calls.length, 1);
      } finally {
        mockFetch.restore();
      }
    },
  );
});

test("route scoring handles high station counts through the route envelope prefilter", () => {
  const route = highPointRoute(80);
  const stations = [
    routeStation("near-cheap", "Near Cheap Fuel", 150, 0.001, 0.4),
    routeStation("near-mid", "Near Mid Fuel", 180, -0.001, 0.5),
    ...Array.from({ length: 60000 }, (_, index) =>
      routeStation(`far-${index}`, `Far Fuel ${index}`, 100, -35 - (index % 10) / 100, 150 + (index % 20) / 100),
    ),
  ];
  const startedAt = Date.now();

  const scored = scoreRoute({
    source: "sample",
    route,
    stations,
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  const elapsedMs = Date.now() - startedAt;
  assert.equal(scored.context.routePrefilteredStations, 60000);
  assert.equal(scored.candidates.some((candidate) => String(candidate.station.stationCode).startsWith("far-")), false);
  assert.equal(scored.candidates.length >= 1, true);
  assert.equal(elapsedMs < 3000, true, `route scoring took ${elapsedMs}ms`);
});

function highPointRoute(count) {
  return {
    id: "high-load-route",
    name: "High Load Route",
    defaultCorridorKm: 3,
    defaultDetourSpeedKmh: 80,
    points: Array.from({ length: count }, (_, index) => ({
      lat: 0,
      lon: index / (count - 1),
      label: index === 0 ? "Start" : index === count - 1 ? "End" : "",
    })),
  };
}

function routeStation(stationCode, name, price, lat, lon) {
  return {
    stationCode,
    name,
    brand: name.split(" ")[0],
    lat,
    lon,
    openNow: true,
    source: "sample",
    updatedAt: "2026-06-17T00:00:00.000Z",
    prices: {
      U91: Number(price),
    },
  };
}

function nswFuelPayload(price) {
  return {
    stations: [
      {
        code: "NSW-SWR-1",
        name: "SWR Reliable Fuel",
        brand: "Metro",
        address: "1 George St, Sydney NSW 2000",
        location: { latitude: -33.8688, longitude: 151.2093 },
      },
    ],
    prices: [
      {
        stationcode: "NSW-SWR-1",
        fueltype: "U91",
        price,
        lastupdated: "2026-06-17T00:00:00.000Z",
      },
    ],
  };
}

function abortableProviderCall(signal) {
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    signal?.addEventListener("abort", () => reject(abortError()), { once: true });
  });
}

function abortError() {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    text: async () => JSON.stringify(payload),
  };
}

function installFetchMock(handler) {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return handler(url, options);
  };
  return {
    calls,
    restore() {
      global.fetch = originalFetch;
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
