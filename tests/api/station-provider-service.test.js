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
    providerRegistry: {},
    sampleSourceAllowed: () => true,
    productionRuntime: () => false,
    ...overrides,
  });
}

test("provider service preserves provider order, single-flight key and aggregation semantics", async () => {
  const keys = [];
  const service = createService({
    singleFlight: async (key, loader) => { keys.push(key); return loader(); },
    providerRegistry: {
      wa: { sourceId: "api_wa", load: async () => ({ stations: [{ stationCode: "same", name: "WA" }], cacheHit: true, cacheAgeSeconds: 4, cacheMode: "fresh", providerHealth: { wa: { status: "ok" } } }) },
      nsw: { sourceId: "api_nsw", load: async () => ({ stations: [{ stationCode: "same", name: "NSW" }, { stationCode: "two" }], cacheHit: true, cacheAgeSeconds: 9, cacheMode: "stale", providerHealth: { nsw: { status: "ok" } } }) },
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
    ["qld", "QLD Fuel Prices public usage, caching and attribution terms are not confirmed.", { qld: () => false, nswAct: () => true, tas: () => true }],
    ["nsw", "FuelCheck NSW/ACT public usage, caching and attribution terms are not confirmed.", { qld: () => true, nswAct: () => false, tas: () => true }],
    ["tas", "TAS FuelCheck public usage, caching and attribution terms are not confirmed.", { qld: () => true, nswAct: () => true, tas: () => false }],
  ];

  for (const [provider, termsMessage, termsConfirmed] of cases) {
    let loaded = false;
    const service = createService({
      productionRuntime: () => true,
      sampleSourceAllowed: () => false,
      termsConfirmed,
      providerRegistry: { [provider]: { sourceId: `api_${provider}`, load: async () => { loaded = true; return { stations: [] }; } } },
    });
    const result = await service.loadStationData({ requestedSource: provider });
    const message = `${provider}: ${termsMessage}`;
    assert.equal(loaded, false, provider);
    assert.deepEqual(result, {
      source: "live_unavailable", provider, capability: "live",
      regionCapabilities: [{ region: "WA", capability: "live" }], stations: [],
      cacheHit: false, cacheAgeSeconds: 0, cacheMode: "none", degraded: true,
      providerHealth: { [provider]: { status: "unavailable", cacheMode: "none", cacheAgeSeconds: null, lastError: message, warning: "" } },
      warning: `Live fuel provider unavailable: ${message}`,
    }, provider);
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
    providerRegistry: {
      wa: { sourceId: "api_wa", load: async () => ({ stations: [{ stationCode: "wa-1" }], cacheHit: true, cacheAgeSeconds: 5, cacheMode: "fresh", providerHealth: { wa: { status: "ok" } } }) },
      nsw: { sourceId: "api_nsw", load: async () => { throw new Error("provider down"); } },
    },
  });

  const result = await service.loadStationData({ requestedSource: "live" });
  assert.deepEqual(result, {
    stations: [{ stationCode: "wa-1" }], source: "api_wa", provider: "api_wa", capability: "live",
    regionCapabilities: [{ region: "WA", capability: "live" }], cacheHit: false, cacheAgeSeconds: 0,
    cacheMode: "fresh", degraded: true,
    providerHealth: { wa: { status: "ok" }, nsw: { status: "unavailable", cacheMode: "none", cacheAgeSeconds: null, lastError: "provider down", warning: "" } },
    warning: "Some live price sources are temporarily unavailable. Confirm prices before driving.",
  });
});

test("provider service preserves total-outage responses with and without fallback", async () => {
  const providerRegistry = { wa: { sourceId: "api_wa", load: async () => { throw new Error("all down"); } } };
  const liveProviderKeysForArea = () => ["wa"];
  const fallback = await createService({ providerRegistry, liveProviderKeysForArea }).loadStationData({ requestedSource: "live" });
  assert.deepEqual(fallback, {
    source: "sample_fallback", provider: "public_demo_snapshot", capability: "fallback",
    regionCapabilities: [{ region: "WA", capability: "live" }], stations: [{ stationCode: "sample", decorated: true }],
    cacheHit: true, cacheAgeSeconds: null, cacheMode: "sample_fallback", degraded: true,
    providerHealth: { sample: { status: "degraded", cacheMode: "sample_fallback", cacheAgeSeconds: null, lastError: "wa: all down", warning: "Live provider failed; serving demo fallback outside production." } },
    warning: "Live fuel provider unavailable: wa: all down",
  });

  const unavailable = await createService({ providerRegistry, liveProviderKeysForArea, sampleSourceAllowed: () => false }).loadStationData({ requestedSource: "live" });
  assert.deepEqual(unavailable, {
    source: "live_unavailable", provider: "live", capability: "live",
    regionCapabilities: [{ region: "WA", capability: "live" }], stations: [], cacheHit: false,
    cacheAgeSeconds: 0, cacheMode: "none", degraded: true,
    providerHealth: { live: { status: "unavailable", cacheMode: "none", cacheAgeSeconds: null, lastError: "wa: all down", warning: "" } },
    warning: "Live fuel provider unavailable: wa: all down",
  });
});

test("provider service rejects invalid sources directly", async () => {
  await assert.rejects(() => createService().loadStationData({ requestedSource: "invalid" }), {
    message: "source must be live, sample, nsw, qld, wa, vic, sa, tas, nt or auto",
  });
});

test("provider service fails explicitly for missing provider configuration", async () => {
  const noLoader = createService({ liveProviderKeysForArea: () => ["wa"], providerRegistry: { wa: { sourceId: "api_wa" } } });
  await assert.rejects(() => noLoader.loadStationData({ requestedSource: "live" }), { message: "Selected provider wa has no configured loader." });

  const noSource = createService({ liveProviderKeysForArea: () => ["wa"], providerRegistry: { wa: { sourceId: "", load: async () => ({ stations: [] }) } } });
  await assert.rejects(() => noSource.loadStationData({ requestedSource: "live" }), { message: "Selected provider wa has no configured source ID." });
});

test("provider service auto-selects sample or live from injected policy", async () => {
  const sample = await createService({ hasAnyLiveCredentials: () => false }).loadStationData({ requestedSource: "auto" });
  assert.equal(sample.source, "sample");

  const live = await createService({
    hasAnyLiveCredentials: () => true,
    liveProviderKeysForArea: () => ["wa"],
    providerRegistry: { wa: { sourceId: "api_wa", load: async () => ({ stations: [{ stationCode: "wa" }], cacheHit: false, cacheMode: "refreshed" }) } },
  }).loadStationData({ requestedSource: "auto" });
  assert.equal(live.source, "api_wa");
});

test("provider service forwards the complete loader contract to every provider", async () => {
  const calls = [];
  const providerRegistry = Object.fromEntries(["qld", "wa", "vic", "sa", "nt", "nsw", "tas"].map((provider) => [provider, { sourceId: `api_${provider}`, load: async (options) => {
    calls.push([provider, options]);
    return { stations: [{ stationCode: provider }], cacheHit: true, cacheAgeSeconds: 1, cacheMode: "fresh" };
  } }]));
  const service = createService({
    liveProviderKeysForArea: () => ["qld", "wa", "vic", "sa", "nt", "nsw", "tas"],
    providerRegistry,
  });
  const options = { requestedSource: "live", forceRefresh: true, points: [{ lat: -30, lon: 140 }], radiusKm: 17, fuels: ["U91"] };

  const result = await service.loadStationData(options);
  assert.deepEqual(calls.map(([provider]) => provider), ["qld", "wa", "vic", "sa", "nt", "nsw", "tas"]);
  for (const [, forwarded] of calls) assert.deepEqual(forwarded, { forceRefresh: true, points: options.points, radiusKm: 17, fuels: ["U91"] });
  assert.equal(result.source, "api_qld+api_wa+api_vic+api_sa+api_nt+api_nsw+api_tas");
});
