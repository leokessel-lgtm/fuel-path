#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const apiBase = String(process.env.FUEL_PATH_EV_MATRIX_API_BASE || "https://fuel-path.vercel.app").replace(/\/$/, "");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");
const delayMs = Number(process.env.FUEL_PATH_EV_MATRIX_DELAY_MS || 150);
const maxCases = Number(process.env.FUEL_PATH_EV_MATRIX_CASES || 12);

const cases = [
  routeCase("metro-short", "Sylvania NSW", -34.0123, 151.1047, "Sydney CBD NSW", -33.8688, 151.2093, 32, 400, ["TYPE2"]),
  routeCase("metro-regional", "Sylvania NSW", -34.0123, 151.1047, "Newcastle NSW", -32.9283, 151.7817, 178, 400, ["TYPE2"]),
  routeCase("regional-wa", "Perth WA", -31.9523, 115.8613, "Margaret River WA", -33.9537, 115.0739, 270, 400, ["TYPE2"]),
  routeCase("remote-nt", "Darwin NT", -12.4634, 130.8456, "Katherine NT", -14.4652, 132.2635, 320, 400, ["TYPE2"]),
  routeCase("tas-regional", "Hobart TAS", -42.8821, 147.3272, "Launceston TAS", -41.4332, 147.1441, 200, 400, ["TYPE2"]),
  routeCase("qld-coastal", "Brisbane QLD", -27.4698, 153.0251, "Noosa Heads QLD", -26.3973, 153.0901, 145, 400, ["TYPE2"]),
  routeCase("tight-range", "Canberra ACT", -35.2809, 149.13, "Batemans Bay NSW", -35.7083, 150.1744, 150, 155, ["TYPE2"]),
  routeCase("charging-needed", "Perth WA", -31.9523, 115.8613, "Albany WA", -35.0275, 117.884, 420, 250, ["TYPE2"]),
  routeCase("no-connectors", "Melbourne VIC", -37.8136, 144.9631, "Geelong VIC", -38.1499, 144.3617, 80, 400, []),
  routeCase("ccs2-fast", "Gold Coast QLD", -28.0167, 153.4, "Byron Bay NSW", -28.6474, 153.602, 95, 400, ["CCS2"]),
  routeCase("sa-regional", "Adelaide SA", -34.9285, 138.6007, "Victor Harbor SA", -35.55, 138.621, 85, 400, ["TYPE2"]),
  routeCase("long-east-coast", "Sydney NSW", -33.8688, 151.2093, "Port Macquarie NSW", -31.4333, 152.9, 390, 300, ["TYPE2"]),
].slice(0, Math.max(1, Math.min(casesLimit(), 24)));

const results = [];
for (const item of cases) {
  const started = Date.now();
  try {
    const response = await fetch(`${apiBase}/api/ev-chargers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "route_charging",
        connectors: item.connectors,
        radiusKm: 30,
        limit: 6,
        selectedRangeKm: item.selectedRangeKm,
        route: {
          distanceKm: item.distanceKm,
          points: [
            { lat: item.from.lat, lon: item.from.lon, label: item.from.label },
            { lat: (item.from.lat + item.to.lat) / 2, lon: (item.from.lon + item.to.lon) / 2, label: "Route midpoint" },
            { lat: item.to.lat, lon: item.to.lon, label: item.to.label },
          ],
        },
      }),
    });
    const body = await response.json();
    results.push(resultForCase(item, response, body, Date.now() - started));
  } catch (error) {
    results.push({
      id: item.id,
      status: "failed",
      failures: [error instanceof Error ? error.message : String(error)],
      ms: Date.now() - started,
    });
  }
  await sleep(delayMs);
}

const failed = results.filter((result) => result.status === "failed");
const durations = results.map((result) => result.ms || 0).sort((left, right) => left - right);
const providerBreakdown = results.reduce((acc, result) => {
  const provider = result.provider || "unknown";
  acc[provider] = (acc[provider] || 0) + 1;
  return acc;
}, {});
const summary = {
  runId,
  apiBase,
  cases: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  providerBreakdown,
  p95Ms: percentile(durations, 95),
  maxMs: durations[durations.length - 1] || 0,
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `ev-route-production-matrix-${runId}.json`);
const reportPath = path.join(outputDir, `ev-route-production-matrix-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
if (failed.length) throw new Error(`${failed.length}/${results.length} EV route matrix case(s) failed`);

function casesLimit() {
  if (!Number.isFinite(maxCases)) return 12;
  return Math.round(maxCases);
}

function routeCase(id, fromLabel, fromLat, fromLon, toLabel, toLat, toLon, distanceKm, selectedRangeKm, connectors) {
  return {
    id,
    connectors,
    distanceKm,
    selectedRangeKm,
    from: { label: fromLabel, lat: fromLat, lon: fromLon },
    to: { label: toLabel, lat: toLat, lon: toLon },
  };
}

function resultForCase(item, response, body, ms) {
  const failures = [];
  const context = body?.context || {};
  const chargers = Array.isArray(body?.chargers) ? body.chargers : [];
  const returnedConnectors = Array.isArray(context.filters?.connectors) ? context.filters.connectors : [];
  if (!response.ok) failures.push(`HTTP ${response.status}`);
  if (context.planMode !== "route_charging") failures.push("route_charging context missing");
  if (!context.provider || context.provider === "unknown") failures.push("provider trace missing");
  if (context.degraded) failures.push("route result degraded");
  if (context.routeDistanceKm <= 0) failures.push("route distance missing");
  if (JSON.stringify(returnedConnectors) !== JSON.stringify(item.connectors)) failures.push("connector filters not preserved");
  if (chargers.length < Math.min(2, Number(context.chargerCount || 0))) failures.push("charger rows inconsistent with context");
  if (chargers.length > 0 && chargers.some((charger) => /available now|guaranteed|best charger/i.test(`${charger.name} ${charger.availabilityLabel} ${charger.provenance}`))) {
    failures.push("unsafe live/best availability claim detected");
  }
  return {
    id: item.id,
    status: failures.length ? "failed" : "passed",
    failures,
    ms,
    provider: context.provider || "",
    rangeStatus: context.rangeStatus || "",
    connectors: returnedConnectors,
    chargers: chargers.length,
    topCharger: chargers[0]
      ? {
          name: chargers[0].name,
          maxPowerKw: chargers[0].maxPowerKw,
          routeSegment: chargers[0].routeSegment,
          routeDetourMinutes: chargers[0].routeDetourMinutes,
          routeScore: chargers[0].routeScore,
        }
      : null,
  };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.floor((p / 100) * values.length));
  return values[index];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderReport(summary, rows) {
  return [
    "# EV Route Production Matrix",
    "",
    `Run: ${summary.runId}`,
    `API: ${summary.apiBase}`,
    `Result: ${summary.passed}/${summary.cases} passed`,
    `P95: ${summary.p95Ms} ms`,
    "",
    "| Case | Status | Provider | Range | Chargers | Top charger |",
    "| --- | --- | --- | --- | ---: | --- |",
    ...rows.map((row) => `| ${row.id} | ${row.status} | ${row.provider || ""} | ${row.rangeStatus || ""} | ${row.chargers || 0} | ${row.topCharger?.name || ""} |`),
    "",
  ].join("\n");
}
