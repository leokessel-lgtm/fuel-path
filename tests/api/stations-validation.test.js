const assert = require("node:assert/strict");
const test = require("node:test");

const stationsHandler = require("../../api/stations");

test("stations rejects missing and invalid coordinates", async () => {
  const cases = [
    [{ lon: 151.2 }, /lat is required/],
    [{ lat: -33.86 }, /lon is required/],
    [{ lat: "abc", lon: 151.2 }, /lat must be a number/],
    [{ lat: -33.86, lon: "abc" }, /lon must be a number/],
    [{ lat: 91, lon: 151.2 }, /lat must be at most 90/],
    [{ lat: -33.86, lon: 181 }, /lon must be at most 180/],
  ];

  for (const [query, pattern] of cases) {
    const response = await callStations({ fuel: "U91", radiusKm: 8, limit: 5, ...query });
    assert.equal(response.status, 400);
    assert.match(response.payload.error, pattern);
  }
});

test("stations rejects unsafe radius and limit values", async () => {
  const cases = [
    [{ radiusKm: -10, limit: 5 }, /radiusKm must be at least 0.5/],
    [{ radiusKm: 0, limit: 5 }, /radiusKm must be at least 0.5/],
    [{ radiusKm: "abc", limit: 5 }, /radiusKm must be a number/],
    [{ radiusKm: 8, limit: -5 }, /limit must be at least 1/],
    [{ radiusKm: 8, limit: 0 }, /limit must be at least 1/],
    [{ radiusKm: 8, limit: "abc" }, /limit must be a number/],
  ];

  for (const [query, pattern] of cases) {
    const response = await callStations({ lat: -33.86, lon: 151.2, fuel: "U91", ...query });
    assert.equal(response.status, 400);
    assert.match(response.payload.error, pattern);
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
  assert.ok(response.payload.context.returnedCount <= 120);
  assert.ok(response.payload.stations.length <= 120);
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
