const assert = require("node:assert/strict");
const test = require("node:test");

const stationsHandler = require("../../api/stations");
const { boundedNumberParam, coordinateParam } = require("../../shared/stationValidation");

test("station query domain validation preserves precise internal reasons", () => {
  const cases = [
    [() => coordinateParam(undefined, "lat", -90, 90), /lat is required/],
    [() => coordinateParam("abc", "lat", -90, 90), /lat must be a number/],
    [() => coordinateParam(91, "lat", -90, 90), /lat must be at most 90/],
    [() => coordinateParam(181, "lon", -180, 180), /lon must be at most 180/],
    [() => boundedNumberParam(0, "radiusKm", 8, { min: 0.5, max: 100 }), /radiusKm must be at least 0\.5/],
    [() => boundedNumberParam("abc", "limit", 160, { min: 1, max: 420 }), /limit must be a number/],
  ];
  for (const [operation, expected] of cases) assert.throws(operation, expected);
});

test("stations rejects missing and invalid coordinates", async () => {
  const cases = [
    { lon: 151.2 },
    { lat: -33.86 },
    { lat: "abc", lon: 151.2 },
    { lat: -33.86, lon: "abc" },
    { lat: 91, lon: 151.2 },
    { lat: -33.86, lon: 181 },
  ];

  for (const query of cases) {
    const response = await callStations({ fuel: "U91", radiusKm: 8, limit: 5, ...query });
    assert.equal(response.status, 400);
    assert.equal(response.payload.error, "Nearby prices are temporarily unavailable. Try again or search another area.");
  }
});

test("stations rejects unsafe radius and limit values", async () => {
  const cases = [
    { radiusKm: -10, limit: 5 },
    { radiusKm: 0, limit: 5 },
    { radiusKm: "abc", limit: 5 },
    { radiusKm: 8, limit: -5 },
    { radiusKm: 8, limit: 0 },
    { radiusKm: 8, limit: "abc" },
  ];

  for (const query of cases) {
    const response = await callStations({ lat: -33.86, lon: 151.2, fuel: "U91", ...query });
    assert.equal(response.status, 400);
    assert.equal(response.payload.error, "Nearby prices are temporarily unavailable. Try again or search another area.");
  }
});

test("stations clamps very large safe radius and limit values", async () => {
  const response = await callStations({
    source: "sample",
    lat: -33.86,
    lon: 151.2,
    fuel: "U91",
    radiusKm: 99999,
    limit: 100000,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.context.radiusKm, 100);
  assert.ok(response.payload.context.returnedCount <= 420);
  assert.ok(response.payload.stations.length <= 420);
});

function callStations(query) {
  return new Promise((resolve) => {
    const req = { method: "GET", query };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, payload });
      },
    };

    stationsHandler(req, res);
  });
}
