const assert = require("node:assert/strict");
const test = require("node:test");

const { createStationProviderService } = require("../../api/_stationProviderService");

function createService(overrides = {}) {
  return createStationProviderService({
    sampleStations: () => [{ stationCode: "sample" }],
    decorateStation: (station) => ({ ...station, decorated: true }),
    singleFlight: async (_key, loader) => loader(),
    liveProviderKeysForArea: () => ["wa", "nsw"],
    capabilitiesForPoints: () => [{ region: "WA", capability: "live" }],
    capabilityWarning: () => "capability warning",
    primaryCapability: () => "live",
    pointInProviderCoverage: () => true,
    hasAnyLiveCredentials: () => true,
    termsConfirmed: { qld: () => true, nswAct: () => true, tas: () => true },
    providerLoaders: {},
    productionRuntime: () => false,
    ...overrides,
  });
}

test("provider service preserves provider order, single-flight key and aggregation semantics", async () => {
  const keys = [];
  const service = createService({
    singleFlight: async (key, loader) => { keys.push(key); return loader(); },
    providerLoaders: {
      wa: async () => ({ stations: [{ stationCode: "same", name: "WA" }], cacheHit: true, cacheAgeSeconds: 4, cacheMode: "fresh", providerHealth: { wa: { status: "ok" } } }),
      nsw: async () => ({ stations: [{ stationCode: "same", name: "NSW" }, { stationCode: "two" }], cacheHit: true, cacheAgeSeconds: 9, cacheMode: "stale", providerHealth: { nsw: { status: "ok" } } }),
    },
  });

  const result = await service.loadStationData({
    requestedSource: "live", forceRefresh: true,
    points: [{ lat: -31.95, lon: 115.86 }], radiusKm: 8.6, fuels: ["E10", "U91"],
  });

  assert.deepEqual(keys, [
    "live-provider:wa:refresh:9:E10,U91:-31.95,115.86",
    "live-provider:nsw:refresh:9:E10,U91:-31.95,115.86",
  ]);
  assert.equal(result.source, "api_wa+api_nsw");
  assert.deepEqual(result.stations.map((station) => station.name || station.stationCode), ["NSW", "two"]);
  assert.equal(result.cacheMode, "stale");
  assert.equal(result.cacheAgeSeconds, 9);
});

test("provider service enforces production terms before loading", async () => {
  let loaded = false;
  const service = createService({
    productionRuntime: () => true,
    termsConfirmed: { qld: () => false, nswAct: () => true, tas: () => true },
    providerLoaders: { qld: async () => { loaded = true; return { stations: [] }; } },
  });

  const result = await service.loadStationData({ requestedSource: "qld" });
  assert.equal(loaded, false);
  assert.equal(result.source, "live_unavailable");
  assert.match(result.warning, /usage, caching and attribution terms are not confirmed/);
});

test("provider service preserves unsupported explicit-provider response", async () => {
  const service = createService({ pointInProviderCoverage: () => false });
  const result = await service.loadStationData({ requestedSource: "vic", points: [{ lat: -31.95, lon: 115.86 }] });

  assert.equal(result.source, "unsupported_region");
  assert.equal(result.provider, "vic");
  assert.equal(result.providerHealth.vic.status, "unsupported_region");
  assert.equal(result.warning, "Requested VIC fuel provider does not cover this area.");
});

test("provider service decorates sample data and disables it in production", async () => {
  const sample = await createService({ hasAnyLiveCredentials: () => false }).loadStationData({ requestedSource: "sample" });
  assert.equal(sample.stations[0].decorated, true);
  assert.equal(sample.cacheMode, "sample");

  const disabled = await createService({ productionRuntime: () => true }).loadStationData({ requestedSource: "sample" });
  assert.equal(disabled.source, "sample_disabled");
  assert.deepEqual(disabled.stations, []);
});
