#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const API_BASE = (process.env.FUEL_PATH_API_BASE || "https://fuel-path.vercel.app").replace(/\/$/, "");
const require = createRequire(import.meta.url);
const { createApiNinjasAdapter, normaliseApiNinjasPayload } = require("../api/_evApiNinjas");
const { createOpenChargeMapAdapter, normaliseOpenChargeMapPayload } = require("../api/_evOpenChargeMap");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");

const route = {
  id: "chaos-route-syd-mel",
  name: "Sydney to Melbourne chaos route",
  provider: "chaos_static",
  distanceKm: 859,
  durationMinutes: 540,
  defaultCorridorKm: 2.5,
  defaultDetourSpeedKmh: 45,
  points: [
    { lat: -33.8688, lon: 151.2093, label: "Sydney CBD NSW" },
    { lat: -35.2809, lon: 149.13, label: "Canberra ACT" },
    { lat: -37.8136, lon: 144.9631, label: "Melbourne CBD VIC" },
  ],
};

const cases = [
  testCase("status-lookup-ready", "GET", "/api/status", assertStatusReady),
  testCase("stations-invalid-lat", "GET", "/api/stations?lat=abc&lon=151.2&fuel=U91", assertCleanClientError),
  testCase("stations-unsupported-nt-coverage-gap", "GET", "/api/stations?source=live&lat=-19.648&lon=134.191&label=Tennant%20Creek%20NT%200860&fuel=U91&radiusKm=35&limit=20", assertUnsupportedFuelRegion),
  testCase("stations-sample-disabled-or-explicit", "GET", "/api/stations?source=sample&lat=-33.8688&lon=151.2093&label=Sydney%20CBD%20NSW&fuel=U91&radiusKm=8&limit=5", assertSampleIsExplicit),
  testCase("ev-provider-list", "GET", "/api/ev-chargers?provider=list", assertEvProviderList),
  testCase("ev-unsupported-commercial-provider", "GET", "/api/ev-chargers?provider=plugshare&lat=-33.8688&lon=151.2093&label=Sydney%20CBD%20NSW&radiusKm=10&limit=5", assertUnsupportedEvProvider),
  testCase("ev-invalid-provider", "GET", "/api/ev-chargers?provider=madeup&lat=-33.8688&lon=151.2093", assertCleanClientError),
  testCase("ev-open-charge-map-not-configured-or-live", "GET", "/api/ev-chargers?provider=open_charge_map&lat=-23.698&lon=133.8807&label=Alice%20Springs%20NT&radiusKm=30&limit=5", assertEvProviderContract),
  testCase("geocode-empty-query", "GET", "/api/geocode?q=", assertCleanNotFound),
  testCase("geocode-gnaf-exact-address", "GET", "/api/geocode?q=1%20Adelaide%20Street%20Balgowlah%20Heights%20NSW%202093&limit=3", assertGnafGeocode),
  testCase("route-missing-destination", "GET", "/api/route?fromLat=-33.8688&fromLon=151.2093&fromLabel=Sydney", assertCleanClientError),
  testCase("score-empty-brand-filter", "POST", "/api/score", assertScoreEmptyBrandFilter, {
    source: "live",
    fuel: "PDL",
    route,
    brandFilter: true,
    brands: ["NoSuchFuelBrand"],
    eligibleDiscounts: [],
  }),
];

const results = [];
for (const entry of cases) {
  const result = await runCase(entry);
  results.push(result);
  console.log(`${result.status === "passed" ? "OK" : "FAIL"} ${entry.id}`);
}
for (const result of await runLocalAdapterChaosCases()) {
  results.push(result);
  console.log(`${result.status === "passed" ? "OK" : "FAIL"} ${result.id}`);
}

const failed = results.filter((result) => result.status === "failed");
const summary = {
  runId,
  apiBase: API_BASE,
  cases: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed.map((result) => result.id),
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `provider-integration-chaos-stress-${runId}.json`);
const reportPath = path.join(outputDir, `provider-integration-chaos-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));

if (failed.length) throw new Error(`${failed.length}/${results.length} provider chaos cases failed`);

function testCase(id, method, url, assert, body) {
  return { id, method, url, assert, body };
}

async function runCase(entry) {
  const started = Date.now();
  const response = await fetch(`${API_BASE}${entry.url}`, {
    method: entry.method,
    headers: entry.method === "POST" ? { "content-type": "application/json", accept: "application/json" } : { accept: "application/json" },
    body: entry.method === "POST" ? JSON.stringify(entry.body || {}) : undefined,
    signal: AbortSignal.timeout(25000),
  }).catch((error) => ({ networkError: error }));

  if (response.networkError) {
    return {
      id: entry.id,
      status: "failed",
      latencyMs: Date.now() - started,
      httpStatus: 0,
      failures: [`network error: ${response.networkError.message || response.networkError}`],
      observations: {},
    };
  }

  const text = await response.text();
  const payload = parseJson(text);
  const failures = entry.assert({ response, payload, text });
  return {
    id: entry.id,
    status: failures.length ? "failed" : "passed",
    latencyMs: Date.now() - started,
    httpStatus: response.status,
    failures,
    observations: observations(entry.id, payload),
  };
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { __parseError: true, text: String(text || "").slice(0, 500) };
  }
}

function assertStatusReady({ response, payload }) {
  const readiness = payload?.geocoding?.lookupReadiness || {};
  return checks([
    [response.ok, `/api/status HTTP ${response.status}`],
    [readiness.status === "ready", `lookup readiness ${readiness.status || "missing"}`],
    [readiness.publicExactAddressClaimsAllowed === true, "public exact-address claims not allowed"],
    [Array.isArray(readiness.blockers) && readiness.blockers.length === 0, `lookup blockers present: ${(readiness.blockers || []).join(", ")}`],
  ]);
}

function assertCleanClientError({ response, payload, text }) {
  return checks([
    [[400, 404].includes(response.status), `expected 400/404, got HTTP ${response.status}`],
    [typeof payload.error === "string" && payload.error.length > 0, "missing error message"],
    [!leaksStack(text), "response appears to leak stack/internal source"],
  ]);
}

function assertCleanNotFound({ response, payload, text }) {
  return checks([
    [response.status === 404, `expected 404, got HTTP ${response.status}`],
    [typeof payload.error === "string" && payload.error.length > 0, "missing error message"],
    [!leaksStack(text), "response appears to leak stack/internal source"],
  ]);
}

function assertUnsupportedFuelRegion({ response, payload }) {
  const context = payload.context || {};
  return checks([
    [response.ok, `HTTP ${response.status}`],
    [Array.isArray(payload.stations), "stations array missing"],
    [payload.stations.length === 0, `expected no NT live stations, got ${payload.stations.length}`],
    [context.provider === "unsupported_region", `provider ${context.provider || "missing"}`],
    [/NT|live prices are not enabled|unsupported/i.test(context.warning || ""), "missing clear unsupported-region warning"],
  ]);
}

function assertSampleIsExplicit({ response, payload }) {
  const context = payload.context || {};
  return checks([
    [response.ok, `HTTP ${response.status}`],
    [Array.isArray(payload.stations), "stations array missing"],
    [["sample", "sample_disabled"].includes(context.source), `unexpected source ${context.source || "missing"}`],
    [context.source !== "sample_disabled" || payload.stations.length === 0, "sample-disabled response returned stations"],
    [context.source !== "sample" || context.provider === "public_demo_snapshot", "sample response missing explicit demo provider"],
  ]);
}

function assertEvProviderList({ response, payload }) {
  return checks([
    [response.ok, `HTTP ${response.status}`],
    [Array.isArray(payload.providers) && payload.providers.length >= 6, "provider list missing candidates"],
    [payload.providers.some((item) => item.id === "api_ninjas"), "api_ninjas missing from provider list"],
    [payload.providers.some((item) => item.id === "plugshare"), "plugshare missing from provider list"],
  ]);
}

function assertUnsupportedEvProvider({ response, payload }) {
  const context = payload.context || {};
  return checks([
    [response.ok, `HTTP ${response.status}`],
    [context.provider === "plugshare", `provider ${context.provider || "missing"}`],
    [context.capability === "pending_commercial_access", `capability ${context.capability || "missing"}`],
    [context.degraded === true, "unsupported commercial provider should be degraded"],
    [payload.chargers?.length === 0, "unsupported provider returned chargers"],
    [/commercial access|pricing|licence|schema/i.test(context.warning || ""), "missing commercial-access warning"],
    [context.provenance?.realTimeAvailability === false, "unsupported provider must not claim live availability"],
  ]);
}

function assertEvProviderContract({ response, payload }) {
  const context = payload.context || {};
  return checks([
    [response.ok, `HTTP ${response.status}`],
    [context.provider === "open_charge_map", `provider ${context.provider || "missing"}`],
    [context.provenance?.realTimeAvailability === false, "EV provider must not claim live bay availability"],
    [Array.isArray(payload.chargers), "chargers array missing"],
    [context.degraded === true || context.cacheMode === "refreshed" || context.cacheMode === "fresh", `unexpected cache/degraded state ${context.cacheMode}`],
  ]);
}

function assertGnafGeocode({ response, payload }) {
  const top = payload.location || payload.suggestions?.[0] || {};
  return checks([
    [response.ok, `HTTP ${response.status}`],
    [payload.lookupStatus === "ok", `lookup status ${payload.lookupStatus || "missing"}`],
    [top.provider === "fuel_path_gnaf", `top provider ${top.provider || "missing"}`],
    [top.matchType === "exact_address", `top matchType ${top.matchType || "missing"}`],
  ]);
}

function assertScoreEmptyBrandFilter({ response, payload }) {
  const context = payload.context || {};
  return checks([
    [response.ok, `HTTP ${response.status}`],
    [Array.isArray(payload.recommendations), "recommendations array missing"],
    [payload.recommendations.length === 0, `expected no recommendations for impossible brand, got ${payload.recommendations.length}`],
    [context.brandFilter === true, "brandFilter context not preserved"],
    [Array.isArray(context.brands) && context.brands.includes("NoSuchFuelBrand"), "requested brand not echoed in context"],
    [typeof context.warning === "string", "warning context missing"],
  ]);
}

function checks(items) {
  return items.filter(([ok]) => !ok).map(([, message]) => message);
}

function leaksStack(text) {
  return /\n\s*at\s+|file:\/\/|node:internal|webpack|\/api\//i.test(String(text || ""));
}

function observations(id, payload) {
  if (id.startsWith("stations")) {
    return {
      source: payload.context?.source || "",
      provider: payload.context?.provider || "",
      stationCount: payload.context?.stationCount ?? payload.stations?.length ?? null,
      warning: payload.context?.warning || "",
      degraded: payload.context?.degraded ?? null,
    };
  }
  if (id.startsWith("ev")) {
    return {
      provider: payload.context?.provider || "",
      capability: payload.context?.capability || "",
      cacheMode: payload.context?.cacheMode || "",
      returnedCount: payload.context?.returnedCount ?? payload.chargers?.length ?? null,
      warning: payload.context?.warning || "",
      realTimeAvailability: payload.context?.provenance?.realTimeAvailability ?? null,
    };
  }
  if (id.startsWith("geocode")) {
    return {
      provider: payload.location?.provider || payload.suggestions?.[0]?.provider || "",
      lookupStatus: payload.lookupStatus || "",
      matchType: payload.location?.matchType || payload.suggestions?.[0]?.matchType || "",
      suggestions: payload.suggestions?.length ?? null,
    };
  }
  if (id.startsWith("score")) {
    return {
      recommendations: payload.recommendations?.length ?? null,
      source: payload.context?.source || "",
      provider: payload.context?.provider || "",
      warning: payload.context?.warning || "",
      brandFilter: payload.context?.brandFilter ?? null,
    };
  }
  if (id.startsWith("status")) {
    return {
      lookupReadiness: payload.geocoding?.lookupReadiness?.status || "",
      publicExactAddressClaimsAllowed: payload.geocoding?.lookupReadiness?.publicExactAddressClaimsAllowed ?? null,
      blockers: payload.geocoding?.lookupReadiness?.blockers || [],
    };
  }
  return {};
}

async function runLocalAdapterChaosCases() {
  const localResults = [];
  localResults.push(localResult(
    "local-api-ninjas-malformed-payload",
    assertApiNinjasMalformedPayload(),
    { scope: "adapter_normalisation", provider: "api_ninjas" },
  ));
  localResults.push(localResult(
    "local-open-charge-map-malformed-payload",
    assertOpenChargeMapMalformedPayload(),
    { scope: "adapter_normalisation", provider: "open_charge_map" },
  ));
  localResults.push(await localAsyncResult(
    "local-api-ninjas-timeout-error",
    assertApiNinjasProviderError,
    { scope: "adapter_fetch_error", provider: "api_ninjas" },
  ));
  return localResults;
}

function localResult(id, failures, observations = {}) {
  return {
    id,
    status: failures.length ? "failed" : "passed",
    latencyMs: 0,
    httpStatus: null,
    failures,
    observations,
  };
}

async function localAsyncResult(id, assert, observations = {}) {
  const started = Date.now();
  const failures = await assert();
  return {
    id,
    status: failures.length ? "failed" : "passed",
    latencyMs: Date.now() - started,
    httpStatus: null,
    failures,
    observations,
  };
}

function assertApiNinjasMalformedPayload() {
  const chargers = normaliseApiNinjasPayload([
    { name: "Missing coords", connections: [{ type_name: "Type 2", level: 2 }] },
    { name: "Missing connector", latitude: -33.86, longitude: 151.2, connections: [] },
    {
      name: "Valid AC charger",
      latitude: -33.86,
      longitude: 151.2,
      city: "Sydney",
      region: "NSW",
      country: "AU",
      is_active: true,
      connections: [{ type_name: "Type 2", type_official: "IEC 62196-2", level: 2, num_connectors: 2 }],
    },
  ], {
    centre: { lat: -33.8688, lon: 151.2093, label: "Sydney CBD" },
    radiusKm: 10,
    filters: {},
  });
  return checks([
    [chargers.length === 1, `expected one valid charger, got ${chargers.length}`],
    [chargers[0]?.connectors?.includes("TYPE2"), "valid Type 2 connector not normalised"],
    [chargers[0]?.availabilityLabel === "Listed active, live bay status unknown", "active row overclaimed live bay status"],
    [chargers[0]?.maxPowerKw === undefined, "API Ninjas should not invent unknown power"],
  ]);
}

function assertOpenChargeMapMalformedPayload() {
  const chargers = normaliseOpenChargeMapPayload([
    { AddressInfo: { Title: "Missing coords" }, Connections: [{ ConnectionType: { Title: "CCS" }, PowerKW: 50 }] },
    {
      ID: 123,
      AddressInfo: {
        Title: "Valid DC charger",
        AddressLine1: "1 Test Street",
        Town: "Sydney",
        StateOrProvince: "NSW",
        Country: { ISOCode: "AU" },
        Latitude: -33.86,
        Longitude: 151.2,
      },
      StatusType: { IsOperational: true, Title: "Operational" },
      Connections: [{ ConnectionType: { Title: "CCS Type 2" }, PowerKW: 150, CurrentType: { Title: "DC" }, Quantity: 1 }],
    },
  ], {
    centre: { lat: -33.8688, lon: 151.2093, label: "Sydney CBD" },
    radiusKm: 10,
    filters: { minPowerKw: 50 },
  });
  return checks([
    [chargers.length === 1, `expected one valid OCM charger, got ${chargers.length}`],
    [chargers[0]?.connectors?.includes("CCS2"), "valid CCS2 connector not normalised"],
    [chargers[0]?.maxPowerKw === 150, `expected 150kW, got ${chargers[0]?.maxPowerKw}`],
    [chargers[0]?.availabilityLabel === "Listed operational, live bay status unknown", "operational row overclaimed live bay status"],
  ]);
}

async function assertApiNinjasProviderError() {
  const previousKey = process.env.API_NINJAS_API_KEY;
  process.env.API_NINJAS_API_KEY = "chaos-test-key";
  const adapter = createApiNinjasAdapter({
    fetchJson: async () => {
      throw new Error("Provider request timed out after 3000ms");
    },
  });
  try {
    await adapter.loadEvChargers({
      centre: { lat: -33.8688, lon: 151.2093, label: "Sydney CBD" },
      radiusKm: 10,
      limit: 5,
      forceRefresh: true,
    });
    return ["expected provider timeout to throw"];
  } catch (error) {
    return checks([
      [/timed out/i.test(error?.message || ""), `unexpected error: ${error?.message || error}`],
    ]);
  } finally {
    if (previousKey === undefined) delete process.env.API_NINJAS_API_KEY;
    else process.env.API_NINJAS_API_KEY = previousKey;
  }
}

function renderReport(summary, results) {
  return `# Provider integration chaos stress

Run: ${summary.runId}

## Summary

- API base: ${summary.apiBase}
- Cases: ${summary.cases}
- Passed: ${summary.passed}
- Failed: ${summary.failed}

## Failures

${results.filter((result) => result.failures.length).map((result) => `- ${result.id}: ${result.failures.join("; ")}`).join("\n") || "- None"}

## Observations

${results.map((result) => `- ${result.id}: HTTP ${result.httpStatus}; ${JSON.stringify(result.observations)}`).join("\n")}

## Brutal read

${summary.failed ? "Provider chaos found failing degradation contracts. Fix before relying on provider resilience claims." : "Provider chaos contracts held for this run. Remaining risk is deeper provider-specific malformed payload simulation, not covered by this live-safe suite."}
`;
}
