const assert = require("node:assert/strict");
const test = require("node:test");

const { liveProviderKeysForArea, loadStationData, pointInAct, pointInVic } = require("../../api/_backend");
const stationsHandler = require("../../api/stations");

test("ACT coordinates are treated as NSW provider coverage", () => {
  const canberra = { lat: -35.2809, lon: 149.13 };

  assert.equal(pointInAct(canberra), true);
  assert.equal(pointInVic(canberra), false);
  assert.deepEqual(liveProviderKeysForArea([canberra], 8), ["nsw"]);
});

test("NSW side of the VIC border remains on NSW provider coverage", () => {
  const albury = { lat: -36.0737, lon: 146.9135 };
  const moama = { lat: -36.1129, lon: 144.7605 };

  assert.equal(pointInVic(albury), false);
  assert.equal(pointInVic(moama), false);
  assert.deepEqual(liveProviderKeysForArea([albury], 8), ["nsw"]);
  assert.deepEqual(liveProviderKeysForArea([moama], 8), ["nsw"]);
});

test("VIC side of the border remains on VIC provider coverage", () => {
  const wodonga = { lat: -36.1241, lon: 146.8818 };
  const echuca = { lat: -36.1418, lon: 144.7511 };
  const melbourne = { lat: -37.8136, lon: 144.9631 };

  assert.equal(pointInVic(wodonga), true);
  assert.equal(pointInVic(echuca), true);
  assert.equal(pointInVic(melbourne), true);
  assert.deepEqual(liveProviderKeysForArea([wodonga], 8), ["vic"]);
  assert.deepEqual(liveProviderKeysForArea([echuca], 8), ["vic"]);
  assert.deepEqual(liveProviderKeysForArea([melbourne], 8), ["vic"]);
});

test("multi-point NSW/VIC routes include the correct live provider order", () => {
  const albury = { lat: -36.0737, lon: 146.9135 };
  const wodonga = { lat: -36.1241, lon: 146.8818 };

  assert.deepEqual(liveProviderKeysForArea([albury, wodonga], 8), ["vic", "nsw"]);
});

test("unsupported geographies do not fall through to NSW", () => {
  const unsupported = [
    { name: "Adelaide SA", point: { lat: -34.9285, lon: 138.6007 } },
    { name: "Darwin NT", point: { lat: -12.4634, lon: 130.8456 } },
    { name: "Alice Springs NT", point: { lat: -23.698, lon: 133.8807 } },
    { name: "Hobart TAS", point: { lat: -42.8821, lon: 147.3272 } },
    { name: "Null Island", point: { lat: 0, lon: 0 } },
    { name: "Pacific Ocean east of NSW", point: { lat: -34, lon: 154.5 } },
  ];

  for (const { name, point } of unsupported) {
    assert.deepEqual(liveProviderKeysForArea([point], 8), [], name);
  }
});

test("unsupported station loads return explicit empty unsupported context", async () => {
  const data = await loadStationData({
    requestedSource: "auto",
    points: [{ lat: -34.9285, lon: 138.6007 }],
    radiusKm: 8,
  });

  assert.equal(data.source, "unsupported_region");
  assert.equal(data.provider, "unsupported_region");
  assert.equal(data.stations.length, 0);
  assert.match(data.warning, /No live fuel provider covers this area yet/);
});

test("unsupported station handler response stays explicit", async () => {
  const response = await callStations({
    lat: -12.4634,
    lon: 130.8456,
    label: "Darwin NT",
    fuel: "U91",
    radiusKm: 8,
    limit: 5,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.context.source, "unsupported_region");
  assert.equal(response.payload.context.provider, "unsupported_region");
  assert.equal(response.payload.context.stationCount, 0);
  assert.equal(response.payload.context.returnedCount, 0);
  assert.equal(response.payload.stations.length, 0);
  assert.match(response.payload.context.warning, /No live fuel provider covers this area yet/);
});

test("forced provider outside coverage returns explicit JSON instead of throwing", async () => {
  const forcedOutsideCoverage = [
    { source: "qld", lat: -33.86, lon: 151.2, expectedProvider: "qld" },
    { source: "wa", lat: -33.86, lon: 151.2, expectedProvider: "wa" },
    { source: "nsw", lat: -27.4698, lon: 153.0251, expectedProvider: "nsw" },
  ];

  for (const item of forcedOutsideCoverage) {
    const response = await callStations({
      source: item.source,
      lat: item.lat,
      lon: item.lon,
      fuel: "U91",
      radiusKm: 8,
      limit: 5,
    });

    assert.equal(response.status, 200, item.source);
    assert.equal(response.payload.context.source, "unsupported_region", item.source);
    assert.equal(response.payload.context.provider, item.expectedProvider, item.source);
    assert.equal(response.payload.context.stationCount, 0, item.source);
    assert.equal(response.payload.stations.length, 0, item.source);
    assert.match(response.payload.context.warning, /does not cover this area/, item.source);
  }
});

test("forced VIC provider failure returns fallback JSON instead of throwing", async () => {
  const response = await callStations({
    source: "vic",
    lat: -37.8136,
    lon: 144.9631,
    fuel: "U91",
    radiusKm: 8,
    limit: 5,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.context.source, "sample_fallback");
  assert.equal(response.payload.context.provider, "public_demo_snapshot");
  assert.match(response.payload.context.warning, /VIC Servo Saver API access is not configured/);
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
