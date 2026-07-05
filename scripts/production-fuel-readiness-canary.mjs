#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const API_BASE = (args.apiBase || process.env.FUEL_PATH_API_BASE || "https://fuel-path.vercel.app").replace(/\/$/, "");
const OUTPUT_DIR = path.resolve(args.outDir || process.env.FUEL_PATH_READINESS_OUT_DIR || "tmp");
const RUN_ID = args.runId || new Date().toISOString().replace(/[:.]/g, "-");

const REQUIRED_REGIONS = ["NSW", "ACT", "QLD", "WA", "VIC", "SA", "TAS", "NT"];
const EXPECTED_PROVIDERS = {
  NSW: "api_nsw",
  ACT: "api_nsw",
  QLD: "api_qld",
  WA: "api_wa",
  VIC: "api_vic",
  SA: "api_sa",
  TAS: "api_tas",
  NT: "api_nt",
};
const LIVE_LIKE_CAPABILITIES = new Set(["live", "limited"]);
const CLOSED_CAPABILITIES = new Set(["pending_access", "unsupported", "fallback"]);
const CLOSED_SOURCES = new Set([
  "unsupported_region",
  "live_unavailable",
  "sample_disabled",
  "sample_fallback",
  "public_demo_snapshot",
]);
const CLOSED_PROVIDERS = new Set([
  "unsupported_region",
  "unsupported",
  "public_demo_snapshot",
  "sample",
  "sample_disabled",
]);
const REGIONAL_POINTS = {
  NSW: { label: "Sydney CBD NSW", lat: -33.8688, lon: 151.2093 },
  ACT: { label: "Canberra ACT", lat: -35.2809, lon: 149.13 },
  QLD: { label: "Brisbane CBD QLD", lat: -27.4698, lon: 153.0251 },
  WA: { label: "Perth CBD WA", lat: -31.9523, lon: 115.8613 },
  VIC: { label: "Melbourne CBD VIC", lat: -37.8136, lon: 144.9631 },
  SA: { label: "Adelaide CBD SA", lat: -34.9285, lon: 138.6007 },
  TAS: { label: "Hobart TAS", lat: -42.8821, lon: 147.3272 },
  NT: { label: "Darwin NT", lat: -12.4634, lon: 130.8456 },
};
const NT_REGIONAL_POINT = { label: "Alice Springs NT", lat: -23.698, lon: 133.8807 };
const NT_STATION_POINTS = [
  { label: "Darwin CBD NT", lat: -12.4634, lon: 130.8456 },
  { label: "Palmerston NT", lat: -12.486, lon: 130.9833 },
  { label: "Katherine NT", lat: -14.4652, lon: 132.2635 },
  { label: "Tennant Creek NT", lat: -19.648, lon: 134.191 },
  { label: "Alice Springs NT", lat: -23.698, lon: 133.8807 },
  { label: "Nhulunbuy NT", lat: -12.1884, lon: 136.782 },
];
const NT_STATION_FUELS = ["U91", "DL", "P95", "P98"];

const statusPayload = await readStatus();
const statusCapabilities = Array.isArray(statusPayload?.fuelProviders?.capabilities)
  ? statusPayload.fuelProviders.capabilities
  : [];
const capabilitiesByRegion = new Map(statusCapabilities.map((entry) => [String(entry.region || "").trim().toUpperCase(), entry]));

const regionChecks = await Promise.all(
  REQUIRED_REGIONS.map((region) =>
    checkRegionContract(region, capabilitiesByRegion.get(region), REGIONAL_POINTS[region]),
  ),
);
const ntRouteCheck = await checkNtRouteReadiness(capabilitiesByRegion.get("NT"));

const allFailures = [
  ...regionChecks.flatMap((item) => item.failures || []),
  ...(ntRouteCheck.failures || []),
];

const summary = {
  runId: RUN_ID,
  generatedAt: new Date().toISOString(),
  apiBase: API_BASE,
  requiredRegions: REQUIRED_REGIONS,
  statusSnapshotPath: path.join(OUTPUT_DIR, `production-readiness-status-${RUN_ID}.json`),
  regionChecks,
  ntRouteCheck,
  failed: allFailures.length,
  failures: allFailures,
  ok: allFailures.length === 0,
  releaseGate: {
    name: "NT live route recommendations readiness",
    status: ntRouteCheck.expectedLive ? (ntRouteCheck.ok ? "pass" : "fail") : "blocked",
    decision:
      ntRouteCheck.expectedLive
        ? "NT live and returning recommendations in both capital and regional route checks."
        : "NT is not live in /api/status. Production release remains blocked until both live route checks return live recommendations.",
  },
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(summary.statusSnapshotPath, `${JSON.stringify(statusPayload, null, 2)}\n`);
const jsonPath = path.join(OUTPUT_DIR, `production-fuel-readiness-canary-${RUN_ID}.json`);
const reportPath = path.join(OUTPUT_DIR, `production-fuel-readiness-canary-${RUN_ID}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary));

console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
if (!summary.ok) process.exit(1);

async function readStatus() {
  const response = await fetchWithTimeout(`${API_BASE}/api/status`, "GET", null, 15000);
  if (!response.ok) {
    const body = await response.text();
    fail(`status request failed HTTP ${response.status}: ${body}`);
  }
  const payload = await safeJson(response);
  if (!payload?.fuelProviders) fail("status payload missing fuelProviders block");
  if (!Array.isArray(payload?.fuelProviders?.capabilities)) fail("status payload missing fuelProviders.capabilities");
  return payload;
}

async function checkRegionContract(region, capabilityEntry, point) {
  if (!point) {
    return {
      id: `fuel-contract-${String(region || "unknown").toLowerCase()}`,
      region,
      status: "failed",
      failures: [`missing point metadata for ${region}`],
      observations: { region },
    };
  }
  if (!capabilityEntry) {
    return {
      id: `fuel-contract-${String(region || "unknown").toLowerCase()}`,
      region,
      status: "failed",
      failures: [`missing /api/status capability for ${region}`],
      observations: { region },
    };
  }

  const id = `fuel-contract-${region.toLowerCase()}`;
  const expectedCapability = String(capabilityEntry?.capability || "").trim() || "unsupported";
  const expectedProvider = EXPECTED_PROVIDERS[region];
  const liveLikeExpected = isLiveLikeCapability(expectedCapability);
  const url = new URL(`${API_BASE}/api/stations`);
  url.searchParams.set("source", "live");
  url.searchParams.set("lat", String(point.lat));
  url.searchParams.set("lon", String(point.lon));
  url.searchParams.set("label", point.label);
  url.searchParams.set("fuel", "U91");
  url.searchParams.set("radiusKm", "35");
  url.searchParams.set("limit", "20");

  return runCheck(async () => {
    const response = await fetchWithTimeout(url, "GET", null, 25000);
    const payload = await safeJson(response);
    if (payload?.__parseError) {
      return {
        id,
        region,
        status: "failed",
        capability: expectedCapability,
        expectedProvider,
        failures: [`${region} stations response JSON failed: ${payload.text}`],
        observations: {},
      };
    }

    const context = payload.context || {};
    const returnedCapability = String(context.capability || "").trim();
    const returnedSource = String(context.source || "").trim();
    const returnedProvider = String(context.provider || "").trim();
    const warning = String(context.warning || "").trim();
    const stations = Array.isArray(payload.stations) ? payload.stations : [];
    const stationCount = Array.isArray(stations) ? stations.length : 0;
    const responseClosed = isClosedResponse(context);

    const failures = [];
    failures.push(...checks([
      [response.ok, `HTTP ${response.status} for ${region} station request`],
      [Array.isArray(payload.stations), `${region} stations payload is not an array`],
      [returnedCapability.length > 0, `${region} context.capability missing`],
    ]));

  if (liveLikeExpected) {
    failures.push(...checks([
      [isLiveLikeCapability(returnedCapability), `${region} returned non-live capability ${returnedCapability || "missing"}`],
      [matchesExpectedProvider(returnedProvider, expectedProvider) || matchesExpectedProvider(returnedSource, expectedProvider),
        `${region} provider/source ${returnedProvider || returnedSource || "missing"} does not map to expected ${expectedProvider}`],
      [!responseClosed, `${region} station response is marked closed while status says ${expectedCapability}`],
    ]));
  } else {
    const expectedClosed = !isLiveLikeCapability(returnedCapability);
    const explicitClosed = isClosedResponse(context);
    failures.push(...checks([
      [expectedClosed, `${region} returned live-like capability ${returnedCapability || "missing"} while /api/status says ${expectedCapability}`],
      [explicitClosed, `${region} should return closed context while /api/status says ${expectedCapability} (${returnedCapability || "missing"})`],
      [!matchesExpectedProvider(returnedProvider, expectedProvider), `${region} returned live provider ${returnedProvider || "missing"} while expected closed state ${expectedCapability}`],
    ]));
  }

    if (!liveLikeExpected && stationCount > 0) {
      const allStationsClosedSource = stations.every((station) => CLOSED_SOURCES.has(String(station.source || "").trim()) || station.source === "public_demo_snapshot");
      if (!allStationsClosedSource && !stations.every((station) => station.source === returnedProvider)) {
        failures.push(`expected closed feed for ${region}, but live-station sources were returned`);
      }
    }

    return {
      id,
      region,
      capability: expectedCapability,
      expectedProvider,
      status: failures.length ? "failed" : "passed",
      ok: failures.length === 0,
      failures,
      observations: {
        source: returnedSource,
        provider: returnedProvider,
        responseCapability: returnedCapability,
        stationCount,
        warning,
      },
    };
  }, [`region contract check for ${region} failed unexpectedly`]);
}

async function checkNtRouteReadiness(ntCapabilityEntry) {
  const ntCapability = String(ntCapabilityEntry?.capability || "").trim() || "unsupported";
  const expectedLive = isLiveLikeCapability(ntCapability);
  const capital = REGIONAL_POINTS.NT;
  const ntExpectedProvider = EXPECTED_PROVIDERS.NT;
  const expectedStationSource = "api_nt_myfuel";
  const routes = [
    { id: "nt-capital-to-regional", from: capital, to: NT_REGIONAL_POINT },
    { id: "nt-regional-to-capital", from: NT_REGIONAL_POINT, to: capital },
  ];
  const stationChecks = [];

  const routeResults = [];
  const failures = [];

  for (const route of routes) {
    const result = await runCheck(async () => {
      const response = await fetchWithTimeout(`${API_BASE}/api/score`, "POST", {
        source: "live",
        from: route.from,
        to: route.to,
        fuel: "U91",
        eligibleDiscounts: ["fleet-card", "everyday-rewards"],
      }, 70000);
      const payload = await safeJson(response);
      const scorePayload = payload?.score || payload;
      if (payload?.__parseError) {
        return {
          id: route.id,
          status: "failed",
          failures: [`${route.id} score response JSON failed: ${payload.text}`],
          observations: {
            source: "",
            provider: "",
            capability: "",
            recommendationCount: 0,
            warning: "",
          },
        };
      }

      const context = scorePayload.context || {};
      const recommendations = Array.isArray(scorePayload.recommendations) ? scorePayload.recommendations : [];

      const routeFailures = checks([
        [response.ok, `NT route request failed HTTP ${response.status}`],
        [expectedLive
          ? recommendations.length > 0
          : recommendations.length === 0, expectedLive
            ? `${route.id} should return recommendations for live NT`
            : `${route.id} should not return recommendations while NT is not live`],
      ]);

      if (expectedLive) {
        routeFailures.push(...checks([
          [isLiveLikeCapability(String(context.capability || "")), `${route.id} should report live/limited capability while NT is live`],
          [matchesExpectedProvider(context.provider, ntExpectedProvider) || matchesExpectedProvider(context.source, ntExpectedProvider), `${route.id} should use provider ${ntExpectedProvider} while NT is live`],
          [!isClosedResponse(context), `${route.id} should not be marked closed while NT route recommendations are live`],
        ]));
      } else {
        routeFailures.push(...checks([
          [!isLiveLikeCapability(String(context.capability || "")), `${route.id} capability ${String(context.capability || "missing")} is not closed for NT`],
          [recommendations.length === 0, `${route.id} should return no recommendations while NT is not live`],
          [isClosedResponse(context), `${route.id} should be marked closed while NT is not live`],
        ]));
      }

      return {
        id: route.id,
        status: routeFailures.length ? "failed" : "passed",
        failures: routeFailures,
        observations: {
          source: String(context.source || ""),
          provider: String(context.provider || ""),
          capability: String(context.capability || ""),
          recommendationCount: recommendations.length,
          warning: String(context.warning || ""),
        status: response.ok ? "ok" : `HTTP ${response.status}`,
        },
      };
    }, [`NT route check failed for ${route.id}`]);

    routeResults.push(result);
    failures.push(...result.failures);
  }
  if (!expectedLive) {
    failures.push("NT is not live in /api/status; production release blocked until /api/score returns live NT recommendations in both capital and regional route checks.");
  }

  for (const point of NT_STATION_POINTS) {
    const stationResult = await runCheck(async () => {
      const fuelResults = [];
      for (const fuel of NT_STATION_FUELS) {
        const stationUrl = new URL(`${API_BASE}/api/stations`);
        stationUrl.searchParams.set("source", "live");
        stationUrl.searchParams.set("lat", String(point.lat));
        stationUrl.searchParams.set("lon", String(point.lon));
        stationUrl.searchParams.set("label", point.label);
        stationUrl.searchParams.set("fuel", fuel);
        stationUrl.searchParams.set("radiusKm", "80");
        stationUrl.searchParams.set("limit", "20");
        stationUrl.searchParams.set("forceRefresh", "1");

        const stationResponse = await fetchWithTimeout(stationUrl, "GET", null, 45000);
        const stationPayload = await safeJson(stationResponse);
        if (stationPayload?.__parseError) {
          fuelResults.push({
            fuel,
            responseOk: false,
            parseError: stationPayload.text,
            context: {},
            rows: [],
          });
          continue;
        }
        fuelResults.push({
          fuel,
          responseOk: stationResponse.ok,
          status: stationResponse.status,
          context: stationPayload.context || {},
          rows: Array.isArray(stationPayload.stations) ? stationPayload.stations : [],
        });
      }

      const bestResult = fuelResults.find((result) => result.rows.length > 0) || fuelResults[0] || { context: {}, rows: [] };
      const stationContext = bestResult.context || {};
      const stationRows = bestResult.rows || [];
      const stationSource = String(stationContext.source || "").trim();
      const stationProvider = String(stationContext.provider || "").trim();
      const stationCapability = String(stationContext.capability || "").trim();
      const stationFailures = [];
      const liveFuelResults = fuelResults.filter((result) => result.rows.length > 0);
      const parseFailure = fuelResults.find((result) => result.parseError);

      if (expectedLive) {
        stationFailures.push(...checks([
          [!parseFailure, `NT station check ${point.label} payload JSON failed: ${parseFailure?.parseError || ""}`],
          [fuelResults.some((result) => result.responseOk), `NT station request failed for all checked fuels at ${point.label}`],
          [isLiveLikeCapability(stationCapability), `${point.label} station context capability should be live/limited while NT is live`],
          [liveFuelResults.length > 0, `${point.label} station request returned no stations for checked fuels while NT is live`],
          [matchesExpectedProvider(stationProvider, ntExpectedProvider) || matchesExpectedProvider(stationSource, ntExpectedProvider), `${point.label} station request should use provider ${ntExpectedProvider} while NT is live`],
          [liveFuelResults.some((result) => result.rows.some((station) => String(station?.source || "").trim() === expectedStationSource)), `${point.label} station rows should include ${expectedStationSource} source records while NT is live`],
          [!isClosedResponse(stationContext), `${point.label} station context should not be marked closed while NT is live`],
        ]));
      } else {
        stationFailures.push(...checks([
          [!isLiveLikeCapability(stationCapability), `${point.label} station context capability ${stationCapability || "missing"} is not closed while NT is not live`],
          [isClosedResponse(stationContext), `${point.label} station response should remain closed while NT is not live`],
          [stationRows.every((station) => CLOSED_SOURCES.has(String(station?.source || "").trim())), `${point.label} station rows should be closed-source while NT is not live`],
        ]));
      }

      return {
        id: `nt-stations-${point.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        point: point.label,
        status: stationFailures.length ? "failed" : "passed",
        failures: stationFailures,
        observations: {
          source: stationSource,
          provider: stationProvider,
          capability: stationCapability,
          stationCount: stationRows.length,
          checkedFuels: fuelResults.map((result) => ({ fuel: result.fuel, count: result.rows.length })),
          matchedFuels: liveFuelResults.map((result) => result.fuel),
          warning: String(stationContext.warning || ""),
        },
      };
    }, [`NT station check failed for ${point.label}`]);

    stationChecks.push(stationResult);
    failures.push(...stationResult.failures);
  }

  return {
    id: "nt-route-readiness",
    status: failures.length ? "failed" : "passed",
    ok: failures.length === 0,
    capability: ntCapability,
    expectedLive,
    failures: [...new Set(failures)],
    observations: {
      routeCount: routes.length,
      liveRecommended: expectedLive,
      releaseSignal: expectedLive && failures.length === 0 ? "unblocked" : "blocked",
    },
    routes: routeResults,
    stationChecks,
  };
}

function runCheck(executor, fallbackMessages) {
  try {
    const result = executor();
    return Promise.resolve(result).catch((error) => ({
      id: "unknown",
      status: "failed",
      failures: [...fallbackMessages, error?.message || String(error)],
      observations: {},
    }));
  } catch (error) {
    return Promise.resolve({
      id: "unknown",
      status: "failed",
      failures: [...fallbackMessages, error?.message || String(error)],
      observations: {},
    });
  }
}

async function fetchWithTimeout(url, method, body, timeoutMs = 15000) {
  const options = {
    method,
    headers: method === "POST" ? { accept: "application/json", "content-type": "application/json" } : { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body !== null && body !== undefined) options.body = JSON.stringify(body);
  return fetch(url, options);
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { __parseError: true, text: String(text || "").slice(0, 500) };
  }
}

function isClosedResponse(context) {
  const source = String(context?.source || "").trim();
  const provider = String(context?.provider || "").trim();
  const warning = String(context?.warning || "").toLowerCase();
  const capability = String(context?.capability || "").trim();
  const closedBySource = CLOSED_SOURCES.has(source);
  const closedByProvider = CLOSED_PROVIDERS.has(provider);
  const closedByCapability = CLOSED_CAPABILITIES.has(capability);
  const closedByWarning = /not enabled|not available|unavailable|live provider unavailable|sample data|not configured|not active|no access/i.test(warning);
  return closedBySource || closedByProvider || closedByCapability || closedByWarning;
}

function isLiveLikeCapability(value) {
  return LIVE_LIKE_CAPABILITIES.has(String(value || "").trim());
}

function matchesExpectedProvider(value, expected) {
  if (!expected) return false;
  const text = String(value || "").trim();
  return text === expected || text.startsWith(`${expected}_`) || text.includes(`+${expected}`) || text.split("+").includes(expected);
}

function checks(items) {
  return items
    .filter((item) => item[0] === false)
    .map((item) => item[1])
    .filter(Boolean);
}

function fail(message) {
  console.log(JSON.stringify({ ok: false, reason: message }, null, 2));
  process.exit(1);
}

function renderReport(summary) {
  const allOk = summary.ok ? "PASS" : "FAIL";
  const ntSummary = summary.ntRouteCheck;
  const canaryLine = ntSummary.expectedLive
    ? "NT live route checks are returning recommendations in capital and regional cases."
    : "NT route recommendation checks are blocked because /api/status shows NT as non-live.";

  return `# Production fuel readiness canary\n\nRun: ${summary.runId}\n\n- Status: ${allOk}\n- API base: ${summary.apiBase}\n- Failure count: ${summary.failed}\n- Scope: ${summary.requiredRegions.join(", ")}\n- NT route status: ${canaryLine}\n\n## Status snapshot\n\n- File: ${summary.statusSnapshotPath}\n\n## Region contract checks\n\n${summary.regionChecks.map((item) => `- ${item.id}: ${item.status} (${item.capability || "missing"})${item.failures.length ? `\n  - Failures: ${item.failures.join("; ")}` : ""}`).join("\n")}\n\n## NT route checks\n\n- Capability: ${ntSummary.capability || "missing"}\n- Expected live route behaviour: ${ntSummary.expectedLive ? "yes" : "no"}\n- Route gate: ${ntSummary.observations?.releaseSignal || "unknown"}\n- Status: ${ntSummary.status}\n${ntSummary.status === "failed" ? `- Failures: ${ntSummary.failures.join("; ")}` : "- Failures: none"}\n\n## NT station checks\n\n${ntSummary.stationChecks?.length ? ntSummary.stationChecks.map((check) => `- ${check.point}: ${check.status} (${check.observations?.stationCount || 0} stations)${check.failures.length ? `\n  - Failures: ${check.failures.join("; ")}` : ""}`).join("\n") : "- none"}\n\n## Failure list\n\n${summary.failures.length ? summary.failures.map((item) => `- ${item}`).join("\n") : "- none"}\n\n## Release gate\n\n${summary.releaseGate.status === "pass" ? "NT route recommendations are live. Ready for release consideration." : "Hold release. NT route recommendation path is blocked in the production readiness gate."}\n`;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;

    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[camelCase(key)] = next;
      index += 1;
    } else {
      parsed[camelCase(key)] = true;
    }
  }
  return parsed;
}

function camelCase(value) {
  return value.replace(/-([a-z])/g, (_, match) => match.toUpperCase());
}
