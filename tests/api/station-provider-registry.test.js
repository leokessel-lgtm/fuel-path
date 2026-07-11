const assert = require("node:assert/strict");
const test = require("node:test");

const { PROVIDER_ORDER, createStationProviderRegistry } = require("../../api/_stationProviderRegistry");

test("composition-root provider wrappers preserve each real adapter argument shape", async () => {
  const calls = [];
  const dependencies = Object.fromEntries([
    ["loadLiveQldStations", "qld"], ["loadLiveWaStations", "wa"],
    ["loadLiveVicStations", "vic"], ["loadLiveSaStations", "sa"],
    ["loadLiveNtStations", "nt"], ["loadLiveStations", "nsw"],
    ["loadLiveTasStations", "tas"],
  ].map(([name, provider]) => [name, async (options) => { calls.push([provider, options]); return provider; }]));
  const registry = createStationProviderRegistry(dependencies);
  const options = { forceRefresh: true, points: [{ lat: -30, lon: 140 }], radiusKm: 17, fuels: ["U91"] };

  for (const provider of PROVIDER_ORDER) await registry[provider].load(options);

  assert.deepEqual(Object.keys(registry), PROVIDER_ORDER);
  assert.deepEqual(PROVIDER_ORDER.map((provider) => registry[provider].sourceId), ["api_qld", "api_wa", "api_vic", "api_sa", "api_nt", "api_nsw", "api_tas"]);
  assert.deepEqual(calls, [
    ["qld", { forceRefresh: true }],
    ["wa", options],
    ["vic", { forceRefresh: true }],
    ["sa", { forceRefresh: true }],
    ["nt", options],
    ["nsw", { forceRefresh: true }],
    ["tas", options],
  ]);
});
