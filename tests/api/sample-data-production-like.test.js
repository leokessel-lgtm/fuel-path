const assert = require("node:assert/strict");
const test = require("node:test");

const sample = require("../../api/_sample");
const { loadStationData } = require("../../api/_backend");

test("sample loader scales, sanitises and preserves deterministic synthetic rows in local mode", () => {
  const withLocalScale = withEnv({
    FUEL_PATH_SAMPLE_SCALE: "4",
    FUEL_PATH_SAMPLE_SEED: "4321",
    FUEL_PATH_SAMPLE_JITTER_KM: "0.8",
  }, () => {
    const stations = sample.sampleStations();
    const base = sample.sampleStations({ scale: 1, seed: 4321, jitterKm: 0.8 });
    return { stations, base };
  });

  assert.equal(withLocalScale.stations.length, withLocalScale.base.length * 4);
  assert.equal(new Set(withLocalScale.stations.map((station) => station.stationCode)).size, withLocalScale.stations.length);
  assert.equal(withLocalScale.stations.filter((station) => station.source === "public_demo_snapshot.synthetic").length > 0, true);

  const scaledSample = sample.sampleStations({ scale: 4, seed: 4321, jitterKm: 0.8 });
  const rerun = sample.sampleStations({ scale: 4, seed: 4321, jitterKm: 0.8 });
  assert.deepEqual(
    scaledSample.slice(0, 12).map((station) => station.stationCode),
    rerun.slice(0, 12).map((station) => station.stationCode),
  );

  assert.equal(withLocalScale.stations.every((station) => Number.isFinite(station.lat) && Number.isFinite(station.lon)), true);
  assert.equal(withLocalScale.stations.every((station) => Math.abs(station.lat) <= 90 && Math.abs(station.lon) <= 180), true);
  assert.equal(withLocalScale.stations.every((station) => {
    return Object.values(station.prices).every((price) => {
      const value = Number(price);
      return Number.isFinite(value) && value > 0 && value < 500;
    });
  }), true);
  const allowedStates = new Set(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);
  assert.equal(withLocalScale.stations.every((station) => station.state && allowedStates.has(station.state)), true);
  assert.equal(withLocalScale.stations.some((station) => station.synthetic), true);
});

test("production-like hardening disables sample unless explicitly allowed", async () => {
  const base = withEnv({
    FUEL_PATH_PRODUCTION_HARDENING: "1",
    FUEL_PATH_ALLOW_SAMPLE_SOURCE: "",
    FUEL_PATH_SAMPLE_SCALE: "3",
    FUEL_PATH_SAMPLE_SEED: "2026",
  }, () => sample.sampleStations({ scale: 3, seed: 2026, jitterKm: 0.25 }).length);

  const blocked = await withEnv({
    FUEL_PATH_PRODUCTION_HARDENING: "1",
    FUEL_PATH_ALLOW_SAMPLE_SOURCE: "",
    FUEL_PATH_SAMPLE_SCALE: "3",
  }, async () =>
    loadStationData({
      requestedSource: "sample",
      points: [{ lat: -33.8688, lon: 151.2093 }],
      radiusKm: 8,
    })
  );

  assert.equal(blocked.source, "sample_disabled");
  assert.equal(blocked.stations.length, 0);
  assert.equal(blocked.degraded, true);

  const enabled = await withEnv({
    FUEL_PATH_PRODUCTION_HARDENING: "1",
    FUEL_PATH_ALLOW_SAMPLE_SOURCE: "1",
    FUEL_PATH_SAMPLE_SCALE: "3",
    FUEL_PATH_SAMPLE_SEED: "2026",
    FUEL_PATH_SAMPLE_JITTER_KM: "0.25",
  }, async () =>
    loadStationData({
      requestedSource: "sample",
      points: [{ lat: -33.8688, lon: 151.2093 }],
      radiusKm: 8,
    })
  );
  assert.equal(enabled.source, "sample");
  assert.equal(enabled.stations.length, base);
  assert.equal(enabled.stations.every((station) => station.stationCode), true);
});

function withEnv(overrides, action) {
  const previous = {};
  const keys = Object.keys(overrides);
  keys.forEach((key) => {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  });

  const restore = () =>
    keys.forEach((key) => {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    });

  if (typeof action === "function") {
    try {
      const result = action();
      if (result && typeof result.then === "function") {
        return result.finally(restore);
      }
      restore();
      return result;
    } catch (error) {
      restore();
      throw error;
    }
  }
  restore();
  return undefined;
}
