const assert = require("node:assert/strict");
const test = require("node:test");

const backendPath = require.resolve("../../api/_backend");
const scorePath = require.resolve("../../api/score");

test("score endpoint filters route recommendations to approved policy brands", async () => {
  const backend = require(backendPath);
  const originalExports = require.cache[backendPath].exports;

  delete require.cache[scorePath];
  require.cache[backendPath].exports = {
    ...backend,
    loadStationData: async () => ({
      source: "sample",
      provider: "sample",
      capability: "live",
      stations: [
        station("cheap-out", "Metro Sylvania", "Metro", 145),
        station("approved-mid", "BP Miranda", "BP", 175),
        station("approved-high", "Shell Kirrawee", "Shell", 185),
      ],
    }),
  };

  try {
    const handler = require(scorePath);
    const payload = await callScore(handler, {
      source: "sample",
      fuel: "U91",
      brandFilter: true,
      brands: ["BP", "Shell"],
      route: routeFixture(),
    });

    assert.equal(payload.context.brandFilter, true);
    assert.deepEqual(payload.context.brands, ["BP", "Shell"]);
    assert.equal(payload.recommendations.length, 2);
    assert.equal(
      payload.recommendations.some((candidate) => candidate.station.brand === "Metro"),
      false,
    );
    assert.equal(
      payload.recommendations.every((candidate) => ["BP", "Shell"].includes(candidate.station.brand)),
      true,
    );
  } finally {
    delete require.cache[scorePath];
    require.cache[backendPath].exports = originalExports;
  }
});

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

function routeFixture() {
  return {
    id: "policy-route",
    name: "Policy Route",
    defaultCorridorKm: 3,
    defaultDetourSpeedKmh: 80,
    points: [
      { lat: 0, lon: 0, label: "Start" },
      { lat: 0, lon: 0.1, label: "End" },
    ],
  };
}

function station(stationCode, name, brand, price) {
  return {
    stationCode,
    name,
    brand,
    lat: 0,
    lon: 0.05,
    openNow: true,
    source: "sample",
    updatedAt: "2026-06-17T00:00:00.000Z",
    prices: {
      U91: Number(price),
    },
  };
}
