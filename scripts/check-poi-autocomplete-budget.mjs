#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const TOTAL = Number(process.env.FUEL_PATH_POI_BUDGET_TOTAL || 500);
const LIMIT = Number(process.env.FUEL_PATH_POI_BUDGET_LIMIT || 5);
const P90_BUDGET_MS = Number(process.env.FUEL_PATH_POI_BUDGET_P90_MS || 800);
const P95_BUDGET_MS = Number(process.env.FUEL_PATH_POI_BUDGET_P95_MS || 1500);
const STATION_P90_BUDGET_MS = Number(process.env.FUEL_PATH_POI_STATION_BUDGET_P90_MS || 800);
const MAX_PROVIDER_CALLS = Number(process.env.FUEL_PATH_POI_BUDGET_MAX_PROVIDER_CALLS || 0);
const POI_TYPES = new Set(["poi", "regional_poi", "airport", "venue", "university", "hospital", "beach", "station", "ferry_wharf", "park"]);
const STATE_ORDER = ["NSW", "ACT", "VIC", "QLD", "WA", "SA", "TAS", "NT"];

process.env.FUEL_PATH_GEOCODE_PROVIDER = process.env.FUEL_PATH_GEOCODE_PROVIDER || "nominatim";
process.env.FUEL_PATH_GNAF_API_URL = process.env.FUEL_PATH_GNAF_API_URL || "https://gnaf-budget.example.test";
process.env.FUEL_PATH_GNAF_API_TOKEN = process.env.FUEL_PATH_GNAF_API_TOKEN || "budget-token";
process.env.FUEL_PATH_WA_FUELWATCH_ENABLED = "0";

let providerCalls = 0;
global.fetch = async () => {
  providerCalls += 1;
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return {
    ok: false,
    status: 503,
    statusText: "Budget harness provider should not be called",
    async text() { return JSON.stringify({ error: { message: "provider call blocks fast path budget" } }); },
    async json() { return { error: { message: "provider call blocks fast path budget" } }; },
  };
};

const { geocode } = require("../api/_backend");
const cases = buildCases(loadRecords(), TOTAL);
const rows = [];
for (const [index, testCase] of cases.entries()) {
  const started = performance.now();
  const result = await geocode({ query: testCase.query, limit: LIMIT, sessionToken: `poi-budget-${RUN_ID}-${index}` });
  const elapsedMs = Math.round(performance.now() - started);
  const top = result.suggestions?.[0] || null;
  const topMatch = matchSuggestion(testCase, top);
  rows.push({
    ...testCase,
    elapsedMs,
    lookupStatus: result.lookupStatus || "unknown",
    fastPath: result.fastPath || "",
    topMatch,
    topLabel: top?.label || "",
    topProvider: top?.provider || "",
    topType: top?.type || "",
  });
}

const summary = summarise(rows);
const payload = { runId: RUN_ID, budgets: { p90Ms: P90_BUDGET_MS, p95Ms: P95_BUDGET_MS, stationP90Ms: STATION_P90_BUDGET_MS, maxProviderCalls: MAX_PROVIDER_CALLS }, providerCalls, summary, weakest: weakest(rows), rows };
fs.mkdirSync(path.join(ROOT, "tmp"), { recursive: true });
const jsonPath = path.join(ROOT, "tmp", `poi-autocomplete-budget-${RUN_ID}.json`);
const mdPath = path.join(ROOT, "tmp", `poi-autocomplete-budget-${RUN_ID}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(mdPath, renderReport(payload));
console.log(JSON.stringify({ ok: pass(summary, providerCalls), jsonPath, mdPath, providerCalls, summary }, null, 2));
if (!pass(summary, providerCalls)) process.exit(1);

function pass(summary, calls) {
  return summary.topMatch === summary.cases &&
    calls <= MAX_PROVIDER_CALLS &&
    summary.p90Ms <= P90_BUDGET_MS &&
    summary.p95Ms <= P95_BUDGET_MS &&
    Number(summary.byType?.station?.p90Ms || 0) <= STATION_P90_BUDGET_MS;
}

function loadRecords() {
  const files = ["api/_geocodeHints.js", "api/_regionalGeocodeHints.js"];
  const rows = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const match of source.matchAll(/\bhint\("([^"]+)",\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*"([^"]+)"/g)) {
      const [, label, lat, lon, type] = match;
      if (!POI_TYPES.has(type)) continue;
      rows.push(record(file, label, Number(lat), Number(lon), type));
    }
    for (const match of source.matchAll(/\bpoi\("([^"]+)",\s*"([A-Z]{2,3})",\s*"([^"]+)"/g)) {
      const [, label, state] = match;
      rows.push(record(file, label, null, null, "regional_poi", state));
    }
  }
  const seen = new Set();
  return rows.filter((row) => {
    const key = normalise(row.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function record(source, label, lat, lon, type, forcedState = "") {
  return { source, label, lat, lon, type, state: forcedState || stateFromLabel(label), locality: localityFromLabel(label), primary: label.split(",")[0].trim() };
}

function buildCases(records, total) {
  const byState = Object.fromEntries(STATE_ORDER.map((state) => [state, records.filter((record) => record.state === state)]));
  const representedStates = STATE_ORDER.filter((state) => byState[state]?.length);
  const perState = distribute(total, representedStates);
  const cases = [];
  for (const state of representedStates) {
    const stateRecords = byState[state];
    for (let index = 0; index < perState[state]; index += 1) {
      const rec = stateRecords[index % stateRecords.length];
      cases.push({ id: `${state}-${index + 1}`, state, expectedLabel: rec.label, expectedPrimary: rec.primary, expectedType: rec.type, query: variant(rec, index), source: rec.source });
    }
  }
  return cases.slice(0, total);
}

function variant(rec, index) {
  const variants = [rec.label, `${rec.primary} ${rec.state}`, `${rec.primary} Australia`, `${rec.primary} near ${rec.locality || rec.state}`, rec.primary, `${rec.primary.replace(/\bStation\b/i, "railway station")} ${rec.state}`];
  return variants[index % variants.length].replace(/\s+/g, " ").trim();
}

function matchSuggestion(testCase, suggestion) {
  if (!suggestion) return false;
  const label = normalise(suggestion.label || "");
  const expected = normalise(testCase.expectedLabel);
  const primary = normalise(testCase.expectedPrimary);
  const stateOk = testCase.state ? label.includes(normalise(testCase.state)) : true;
  return label === expected || (primary.length >= 5 && label.includes(primary) && stateOk);
}

function summarise(rows) {
  const elapsed = rows.map((row) => row.elapsedMs).filter(Number.isFinite).sort((left, right) => left - right);
  return {
    cases: rows.length,
    topMatch: rows.filter((row) => row.topMatch).length,
    fastPath: rows.filter((row) => row.fastPath === "local_autocomplete").length,
    p50Ms: percentile(elapsed, 50),
    p90Ms: percentile(elapsed, 90),
    p95Ms: percentile(elapsed, 95),
    maxMs: elapsed.at(-1) || null,
    byState: group(rows, "state"),
    byType: group(rows, "expectedType"),
  };
}

function group(rows, field) {
  return Object.fromEntries([...new Set(rows.map((row) => row[field] || "unknown"))].sort().map((key) => {
    const subset = rows.filter((row) => (row[field] || "unknown") === key);
    const elapsed = subset.map((row) => row.elapsedMs).sort((left, right) => left - right);
    return [key, { cases: subset.length, topMatch: subset.filter((row) => row.topMatch).length, p90Ms: percentile(elapsed, 90) }];
  }));
}

function weakest(rows) {
  return rows.filter((row) => !row.topMatch || row.fastPath !== "local_autocomplete" || row.elapsedMs > P90_BUDGET_MS)
    .sort((left, right) => Number(left.topMatch) - Number(right.topMatch) || right.elapsedMs - left.elapsedMs)
    .slice(0, 50)
    .map(({ id, state, expectedType, query, expectedLabel, elapsedMs, fastPath, topLabel, topProvider, topType }) => ({ id, state, expectedType, query, expectedLabel, elapsedMs, fastPath, topLabel, topProvider, topType }));
}

function renderReport(payload) {
  const s = payload.summary;
  return `# POI autocomplete latency budget\n\nRun: ${payload.runId}\n\n## Summary\n\n- Cases: ${s.cases}\n- Top match: ${s.topMatch}/${s.cases}\n- Local fast path: ${s.fastPath}/${s.cases}\n- Provider calls: ${payload.providerCalls}\n- Latency p50/p90/p95/max: ${s.p50Ms}/${s.p90Ms}/${s.p95Ms}/${s.maxMs} ms\n- Station p90: ${s.byType?.station?.p90Ms ?? "n/a"} ms\n- Budgets p90/p95/station p90/provider calls: ${payload.budgets.p90Ms}/${payload.budgets.p95Ms}/${payload.budgets.stationP90Ms}/${payload.budgets.maxProviderCalls}\n\n## Weakest rows\n\n| id | state | type | query | expected | ms | fast path | top | provider |\n| --- | --- | --- | --- | --- | ---: | --- | --- | --- |\n${payload.weakest.map((row) => `| ${esc(row.id)} | ${esc(row.state)} | ${esc(row.expectedType)} | ${esc(row.query)} | ${esc(row.expectedLabel)} | ${row.elapsedMs} | ${esc(row.fastPath)} | ${esc(row.topLabel)} | ${esc(row.topProvider)} |`).join("\n") || "| | | | | | | | |"}\n`;
}

function distribute(total, states) { const base = Math.floor(total / states.length); let rem = total % states.length; return Object.fromEntries(states.map((state) => [state, base + (rem-- > 0 ? 1 : 0)])); }
function stateFromLabel(label) { return (String(label).match(/\b(NSW|ACT|VIC|QLD|WA|SA|TAS|NT)\b/) || [])[1] || "unknown"; }
function localityFromLabel(label) { const parts = String(label).split(",").map((part) => part.trim()); return parts.length > 1 ? parts.at(-1).replace(/\b(NSW|ACT|VIC|QLD|WA|SA|TAS|NT)\b.*$/, "").trim() : stateFromLabel(label); }
function normalise(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function percentile(sorted, p) { if (!sorted.length) return null; const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)); return sorted[index]; }
function esc(value) { return String(value ?? "").replace(/\|/g, "\\|"); }
