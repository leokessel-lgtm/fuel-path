const assert = require("node:assert/strict");
const test = require("node:test");

const { createRouting } = require("../../api/_routing");
const { scoreRoute } = require("../../api/_routeScoring");

const backendPath = require.resolve("../../api/_backend");
const scorePath = require.resolve("../../api/score");

test("Google route requests pass avoid-tolls and traffic preference into route quality", async () => {
  let routeRequest = null;
  const routing = createRouting({
    googleRoutesApiKey: () => "test-google-key",
    fetchJson: async (_url, options = {}) => {
      routeRequest = options.data;
      return {
        routes: [
          {
            distanceMeters: 100000,
            duration: "3600s",
            polyline: {
              encodedPolyline: encodePolyline([
                { lat: 0, lon: 0 },
                { lat: 0, lon: 1 },
              ]),
            },
            travelAdvisory: {
              tollInfo: {
                estimatedPrice: [{ currencyCode: "AUD", units: 7, nanos: 500000000 }],
              },
            },
          },
        ],
      };
    },
  });

  const route = await routing.buildRoute({
    from: { lat: 0, lon: 0, label: "Start" },
    to: { lat: 0, lon: 1, label: "End" },
    trafficPreference: "aware",
    tollPreference: "avoid",
  });

  assert.equal(routeRequest.routeModifiers.avoidTolls, true);
  assert.equal(routeRequest.routingPreference, "TRAFFIC_AWARE");
  assert.equal(route.provider, "google_routes");
  assert.equal(route.tollCostDollars, 7.5);
  assert.equal(route.routeQuality.level, "high");
  assert.equal(route.routeQuality.traffic, "traffic_aware");
  assert.equal(route.routeQuality.tolls, "avoid_tolls_requested");
  assert.equal(route.routeQuality.tollPreference, "avoid");
});

test("score endpoint exposes route quality and keeps actual detours off by default", async () => {
  const calls = [];
  const payload = await withMockedScoreBackend(calls, async (handler) =>
    callScore(handler, {
      from: { lat: 0, lon: 0, label: "Start" },
      to: { lat: 0, lon: 1, label: "End" },
      fuel: "U91",
      source: "sample",
      trafficPreference: "aware",
      tollPreference: "avoid",
    }),
  );

  const score = payload.score;
  assert.equal(score.context.tollPreference, "avoid");
  assert.equal(score.context.trafficPreference, "aware");
  assert.equal(score.context.routeQuality.level, "high");
  assert.equal(score.context.routeQuality.traffic, "traffic_aware");
  assert.equal(score.context.routeQuality.tolls, "avoid_tolls_requested");
  assert.equal(score.context.actualDetours.enabled, false);
  assert.equal(score.recommendations[0].actualDetour, undefined);
  assert.deepEqual(calls.map((call) => call.tollPreference), ["avoid"]);
  assert.deepEqual(calls.map((call) => call.trafficPreference), ["aware"]);
});

test("score endpoint can refine top candidate detour through route engine behind flag", async () => {
  const calls = [];
  const payload = await withMockedScoreBackend(calls, async (handler) =>
    callScore(handler, {
      from: { lat: 0, lon: 0, label: "Start" },
      to: { lat: 0, lon: 1, label: "End" },
      fuel: "U91",
      source: "sample",
      trafficPreference: "aware",
      tollPreference: "avoid",
      actualDetours: true,
    }),
  );

  const score = payload.score;
  assert.equal(score.context.actualDetours.enabled, true);
  assert.equal(score.context.actualDetours.routeEstimatedCount, 1);
  assert.equal(score.recommendations[0].actualDetour.source, "route_engine_via_station");
  assert.equal(score.recommendations[0].actualDetour.provider, "mock_routes");
  assert.equal(score.recommendations[0].actualDetour.detourKm, 10);
  assert.equal(score.recommendations[0].actualDetour.detourMinutes, 6);
  assert.equal(score.recommendations[0].actualDetour.tollCostDollars, 3);
  assert.equal(score.recommendations[0].actualDetour.trafficPreference, "aware");
  assert.equal(score.recommendations[0].detourKm, 10);
  assert.equal(score.recommendations[0].detourMinutes, 6);
  assert.deepEqual(calls.map((call) => call.tollPreference), ["avoid", "avoid", "avoid"]);
  assert.deepEqual(calls.map((call) => call.trafficPreference), ["aware", "aware", "aware"]);
});

test("route scoring records dynamic corridor and candidate route-position metadata", () => {
  const scored = scoreRoute({
    source: "sample",
    route: {
      id: "route-quality",
      name: "Route quality",
      defaultCorridorKm: 2.5,
      defaultDetourSpeedKmh: 80,
      points: [
        { lat: 0, lon: 0, label: "Start" },
        { lat: 0, lon: 1, label: "End" },
      ],
    },
    stations: [
      station("POS-1", "Origin side", "Metro", 160, 0.01, 0.02),
      station("POS-2", "Mid route", "Metro", 162, 0.01, 0.5),
      station("POS-3", "Destination side", "Metro", 164, 0.01, 0.98),
    ],
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 2.5,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(scored.context.corridorProfile.id, "regional");
  assert.deepEqual(scored.context.corridorAttemptsKm, [2.5, 4, 6, 10, 14]);
  const byCode = new Map(scored.candidates.map((candidate) => [candidate.station.stationCode, candidate]));
  assert.equal(byCode.get("POS-1").routePosition.segment, "near_origin");
  assert.equal(byCode.get("POS-2").routePosition.segment, "mid_route");
  assert.equal(byCode.get("POS-3").routePosition.segment, "near_destination");
  assert.equal(byCode.get("POS-2").routePosition.geometrySignal, "approximate_route_segment");
  assert.ok(["left", "right", "on_route"].includes(byCode.get("POS-2").routePosition.roadSide));
  assert.ok(["low", "medium", "high"].includes(byCode.get("POS-2").routePosition.turnFriction));
});

test("actual detour mode uses provider toll delta to break equal-price ties only after refinement", async () => {
  const calls = [];
  const payload = await withMockedScoreBackend(calls, async (handler) =>
    callScore(handler, {
      from: { lat: 0, lon: 0, label: "Start" },
      to: { lat: 0, lon: 1, label: "End" },
      fuel: "U91",
      source: "sample",
      tollPreference: "avoid",
      actualDetours: true,
    }),
    {
      stations: [
        station("TOLL-1", "Toll Servo", "Metro", 160, 0.01, 0.45),
        station("FREE-1", "Free Servo", "Metro", 160, 0.02, 0.5),
      ],
      routeFor: ({ from, to, trafficPreference, tollPreference }) => {
        if (from.label === "Start" && to.label === "End") return route(100, 60, 5, trafficPreference, tollPreference);
        const stationName = from.label === "Start" ? to.label : from.label;
        const tollCost = stationName === "Toll Servo" ? 8 : 0;
        return route(50, 30, tollCost, trafficPreference, tollPreference);
      },
    },
  );

  const score = payload.score;
  assert.equal(score.context.actualDetours.routeEstimatedCount, 2);
  assert.equal(score.recommendations[0].station.stationCode, "FREE-1");
  assert.equal(score.recommendations[0].actualDetour.tollRankingApplied, undefined);
  assert.equal(score.recommendations[1].station.stationCode, "TOLL-1");
  assert.equal(score.recommendations[1].actualDetour.tollCostDollars, 11);
  assert.equal(score.recommendations[1].actualDetour.tollRankingApplied, true);
});

async function withMockedScoreBackend(calls, run, options = {}) {
  const backend = require(backendPath);
  const originalExports = require.cache[backendPath].exports;
  delete require.cache[scorePath];
  require.cache[backendPath].exports = {
    ...backend,
    buildRoute: async ({ from, to, trafficPreference, tollPreference }) => {
      calls.push({ from: from.label, to: to.label, trafficPreference, tollPreference });
      if (typeof options.routeFor === "function") return options.routeFor({ from, to, trafficPreference, tollPreference });
      if (from.label === "Start" && to.label === "End") return route(100, 60, 5, trafficPreference, tollPreference);
      if (from.label === "Start") return route(40, 24, 3, trafficPreference, tollPreference);
      if (to.label === "End") return route(70, 42, 5, trafficPreference, tollPreference);
      return route(70, 42, 0, trafficPreference, tollPreference);
    },
    loadStationData: async () => ({
      source: "sample",
      provider: "sample",
      capability: "live",
      stations: options.stations || [station("NOW-1", "Route Servo", "Metro", 160, 0.01, 0.5)],
    }),
  };

  try {
    return await run(require(scorePath));
  } finally {
    delete require.cache[scorePath];
    require.cache[backendPath].exports = originalExports;
  }
}

function callScore(handler, body) {
  return new Promise((resolve, reject) => {
    const req = {
      body,
      method: "POST",
      query: {},
    };
    const res = {
      statusCode: 200,
      status(status) {
        this.statusCode = status;
        return this;
      },
      json(payload) {
        if (this.statusCode >= 400) {
          reject(new Error(payload.error || `HTTP ${this.statusCode}`));
          return;
        }
        resolve(payload);
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

function route(distanceKm, durationMin, tollCostDollars, trafficPreference, tollPreference) {
  const trafficAware = trafficPreference === "aware";
  return {
    provider: "mock_routes",
    distanceKm,
    durationMin,
    tollCostDollars,
    points: [
      { lat: 0, lon: 0, label: "Start" },
      { lat: 0, lon: 1, label: "End" },
    ],
    routeQuality: {
      level: trafficAware ? "high" : "medium",
      provider: "mock_routes",
      geometry: "provider_road_route",
      traffic: trafficAware ? "traffic_aware" : "traffic_unaware",
      tolls: "avoid_tolls_requested",
      tollPreference,
    },
  };
}

function station(stationCode, name, brand, price, lat, lon) {
  return {
    stationCode,
    name,
    brand,
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

function encodePolyline(points) {
  let previousLat = 0;
  let previousLon = 0;
  let encoded = "";
  for (const point of points) {
    const lat = Math.round(Number(point.lat) * 1e5);
    const lon = Math.round(Number(point.lon) * 1e5);
    encoded += encodePolylineValue(lat - previousLat);
    encoded += encodePolylineValue(lon - previousLon);
    previousLat = lat;
    previousLon = lon;
  }
  return encoded;
}

function encodePolylineValue(value) {
  let encoded = "";
  let transformed = value < 0 ? ~(value << 1) : value << 1;
  while (transformed >= 0x20) {
    encoded += String.fromCharCode((0x20 | (transformed & 0x1f)) + 63);
    transformed >>= 5;
  }
  return encoded + String.fromCharCode(transformed + 63);
}
