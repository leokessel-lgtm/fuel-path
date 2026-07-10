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
    providerSourceIds: { qld: "api_qld", wa: "api_wa", vic: "api_vic", sa: "api_sa", nt: "api_nt", nsw: "api_nsw", tas: "api_tas" },
    sampleSourceAllowed: () => true,
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

test("provider service enforces every production terms gate before loading", async () => {
  const cases = [
    ["qld", { qld: () => false, nswAct: () => true, tas: () => true }],
    ["nsw", { qld: () => true, nswAct: () => false, tas: () => true }],
    ["tas", { qld: () => true, nswAct: () => true, tas: () => false }],
  ];

  for (const [provider, termsConfirmed] of cases) {
    let loaded = false;
    const service = createService({
      productionRuntime: () => true,
      sampleSourceAllowed: () => false,
      termsConfirmed,
      providerLoaders: { [provider]: async () => { loaded = true; return { stations: [] }; } },
    });
    const result = await service.loadStationData({ requestedSource: provider });
    assert.equal(loaded, false, provider);
    assert.equal(result.source, "live_unavailable", provider);
    assert.match(result.warning, /usage, caching and attribution terms are not confirmed/, provider);
  }
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

  const disabled = await createService({ sampleSourceAllowed: () => false }).loadStationData({ requestedSource: "sample" });
  assert.equal(disabled.source, "sample_disabled");
  assert.deepEqual(disabled.stations, []);
});

test("provider service keeps healthy data and reports a partial provider outage", async () => {
  const service = createService({
    providerLoaders: {
      wa: async () => ({ stations: [{ stationCode: "wa-1" }], cacheHit: true, cacheAgeSeconds: 5, cacheMode: "fresh", providerHealth: { wa: { status: "ok" } } }),
      nsw: async () => { throw new Error("provider down"); },
    },
  });

  const result = await service.loadStationData({ requestedSource: "live" });
  assert.deepEqual(result.stations.map((station) => station.stationCode), ["wa-1"]);
  assert.equal(result.source, "api_wa");
  assert.equal(result.cacheHit, false);
  assert.equal(result.cacheAgeSeconds, 0);
  assert.equal(result.degraded, true);
  assert.equal(result.providerHealth.nsw.lastError, "provider down");
  assert.equal(result.warning, "Some live price sources are temporarily unavailable. Confirm prices before driving.");
});

test("provider service preserves total-outage responses with and without fallback", async () => {
  const providerLoaders = { wa: async () => { throw new Error("all down"); } };
  const liveProviderKeysForArea = () => ["wa"];
  const fallback = await createService({ providerLoaders, liveProviderKeysForArea }).loadStationData({ requestedSource: "live" });
  assert.equal(fallback.source, "sample_fallback");
  assert.equal(fallback.stations[0].decorated, true);
  assert.equal(fallback.providerHealth.sample.lastError, "wa: all down");

  const unavailable = await createService({ providerLoaders, liveProviderKeysForArea, sampleSourceAllowed: () => false }).loadStationData({ requestedSource: "live" });
  assert.equal(unavailable.source, "live_unavailable");
  assert.equal(unavailable.providerHealth.live.lastError, "wa: all down");
});

test("provider service auto-selects sample or live from injected policy", async () => {
  const sample = await createService({ hasAnyLiveCredentials: () => false }).loadStationData({ requestedSource: "auto" });
  assert.equal(sample.source, "sample");

  const live = await createService({
    hasAnyLiveCredentials: () => true,
    liveProviderKeysForArea: () => ["wa"],
    providerLoaders: { wa: async () => ({ stations: [{ stationCode: "wa" }], cacheHit: false, cacheMode: "refreshed" }) },
  }).loadStationData({ requestedSource: "auto" });
  assert.equal(live.source, "api_wa");
});

test("provider service forwards the complete loader contract to every provider", async () => {
  const calls = [];
  const providerLoaders = Object.fromEntries(["qld", "wa", "vic", "sa", "nt", "nsw", "tas"].map((provider) => [provider, async (options) => {
    calls.push([provider, options]);
    return { stations: [{ stationCode: provider }], cacheHit: true, cacheAgeSeconds: 1, cacheMode: "fresh" };
  }]));
  const service = createService({
    liveProviderKeysForArea: () => ["qld", "wa", "vic", "sa", "nt", "nsw", "tas"],
    providerLoaders,
  });
  const options = { requestedSource: "live", forceRefresh: true, points: [{ lat: -30, lon: 140 }], radiusKm: 17, fuels: ["U91"] };

  const result = await service.loadStationData(options);
  assert.deepEqual(calls.map(([provider]) => provider), ["qld", "wa", "vic", "sa", "nt", "nsw", "tas"]);
  for (const [, forwarded] of calls) assert.deepEqual(forwarded, { forceRefresh: true, points: options.points, radiusKm: 17, fuels: ["U91"] });
  assert.equal(result.source, "api_qld+api_wa+api_vic+api_sa+api_nt+api_nsw+api_tas");
});
