#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const RUN_ID = args.runId || process.env.FUEL_PATH_GEOCODE_QUALITY_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const API_BASE = args.apiBase || process.env.FUEL_PATH_API_BASE || "";
const FIXTURE_PATH = path.resolve(ROOT, args.fixture || "tests/fixtures/geocode-quality-regression.json");
const LIMIT = Number(args.limit || process.env.FUEL_PATH_GEOCODE_QUALITY_LIMIT || 5);
const PROVIDER = args.provider || process.env.FUEL_PATH_GEOCODE_QUALITY_PROVIDER || process.env.FUEL_PATH_GEOCODE_PROVIDER || "nominatim";
const OUT_DIR = args.outDir || process.env.FUEL_PATH_GEOCODE_QUALITY_OUT_DIR || "tmp";
const NO_EXTERNAL = args.external ? false : String(process.env.FUEL_PATH_GEOCODE_QUALITY_ALLOW_EXTERNAL || "") !== "1";
const MIN_TOP_RATE = Number(args.minTopRate || process.env.FUEL_PATH_GEOCODE_QUALITY_MIN_TOP_RATE || 0.8);
const MIN_TOP5_RATE = Number(args.minTop5Rate || process.env.FUEL_PATH_GEOCODE_QUALITY_MIN_TOP5_RATE || 0.95);
const MAX_WRONG_STATE = Number(args.maxWrongState || process.env.FUEL_PATH_GEOCODE_QUALITY_MAX_WRONG_STATE || 0);

if (!API_BASE) loadLocalEnv();
if (!API_BASE && NO_EXTERNAL) {
  globalThis.fetch = async () => {
    throw new Error("External provider calls are disabled for local geocode quality regression");
  };
}

const cases = JSON.parse(await fsp.readFile(FIXTURE_PATH, "utf8"));
const rows = [];
for (let index = 0; index < cases.length; index += 1) {
  rows.push(await runCase(cases[index], index + 1));
}

const summary = summarise(rows);
const ok =
  summary.topRate >= MIN_TOP_RATE &&
  summary.top5Rate >= MIN_TOP5_RATE &&
  summary.wrongStateCount <= MAX_WRONG_STATE;
const payload = {
  runId: RUN_ID,
  generatedAt: new Date().toISOString(),
  mode: API_BASE ? "http" : "module",
  apiBase: API_BASE,
  provider: PROVIDER,
  noExternal: !API_BASE && NO_EXTERNAL,
  fixturePath: path.relative(ROOT, FIXTURE_PATH),
  thresholds: {
    minTopRate: MIN_TOP_RATE,
    minTop5Rate: MIN_TOP5_RATE,
    maxWrongState: MAX_WRONG_STATE,
  },
  ok,
  summary,
  rows,
};

await fsp.mkdir(path.join(ROOT, OUT_DIR), { recursive: true });
const jsonPath = path.join(OUT_DIR, `geocode-quality-regression-${RUN_ID}.json`);
const mdPath = path.join(OUT_DIR, `geocode-quality-regression-${RUN_ID}.md`);
await fsp.writeFile(path.join(ROOT, jsonPath), `${JSON.stringify(payload, null, 2)}\n`);
await fsp.writeFile(path.join(ROOT, mdPath), renderMarkdown(payload));
console.log(JSON.stringify({ ok, runId: RUN_ID, jsonPath, mdPath, summary }, null, 2));
if (!ok) process.exit(1);

async function runCase(testCase, index) {
  const started = Date.now();
  let payload;
  let error = "";
  try {
    payload = API_BASE ? await hostedGeocode(testCase, index) : await moduleGeocode(testCase, index);
  } catch (caught) {
    payload = { suggestions: [], lookupStatus: "error" };
    error = String(caught?.message || caught || "unknown");
  }
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions.slice(0, LIMIT) : [];
  const top = suggestions[0] || null;
  const topResult = classifySuggestion(testCase, top);
  const top5 = suggestions.find((suggestion) => classifySuggestion(testCase, suggestion).accepted);
  const top5Result = classifySuggestion(testCase, top5 || null);
  return {
    id: testCase.id,
    category: testCase.category,
    query: testCase.query,
    expectedState: testCase.expectedState || "",
    elapsedMs: Date.now() - started,
    lookupStatus: payload?.lookupStatus || "",
    warning: payload?.warning || "",
    error,
    topAccepted: topResult.accepted,
    top5Accepted: top5Result.accepted,
    topOutcome: topResult.outcome,
    top5Outcome: top5Result.outcome,
    wrongState: topResult.wrongState,
    topProvider: top?.provider || "",
    topLabel: top?.label || "",
    topState: top?.state || stateFromLabel(top?.label || ""),
    topMatchType: top?.matchType || "",
    top5Label: top5?.label || "",
  };
}

async function hostedGeocode(testCase, index) {
  const url = new URL("/api/geocode", API_BASE);
  url.searchParams.set("q", testCase.query);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("provider", PROVIDER);
  url.searchParams.set("sessionToken", `geocode-quality-${RUN_ID}-${index}`);
  url.searchParams.set("purpose", "plan_autocomplete");
  const response = await fetch(url);
  if (!response.ok) return { suggestions: [], lookupStatus: "http_error", warning: `HTTP ${response.status}` };
  return response.json();
}

async function moduleGeocode(testCase, index) {
  const { geocode } = require("../api/_backend");
  return geocode({
    query: testCase.query,
    limit: LIMIT,
    provider: PROVIDER,
    sessionToken: `geocode-quality-${RUN_ID}-${index}`,
    purpose: "plan_autocomplete",
  });
}

function classifySuggestion(testCase, suggestion) {
  if (!suggestion) return { accepted: false, outcome: "missing", wrongState: false };
  const label = normalise(suggestion.label);
  const expectedState = String(testCase.expectedState || "").toUpperCase();
  const actualState = String(suggestion.state || stateFromLabel(suggestion.label)).toUpperCase();
  const wrongState = Boolean(expectedState && actualState && actualState !== expectedState);
  const expectedTerms = [...(testCase.expectedTerms || []), ...(testCase.acceptedAliases || [])];
  const termMatched = expectedTerms.some((term) => label.includes(normalise(term)));
  const accepted = termMatched && !wrongState;
  const aliasOnly = !((testCase.expectedTerms || []).some((term) => label.includes(normalise(term)))) &&
    (testCase.acceptedAliases || []).some((term) => label.includes(normalise(term)));
  return {
    accepted,
    outcome: accepted ? (aliasOnly ? "accepted_alias" : "accepted") : wrongState ? "wrong_state" : "wrong_place",
    wrongState,
  };
}

function summarise(rows) {
  const total = rows.length;
  const categorySummary = {};
  for (const row of rows) {
    const entry = categorySummary[row.category] || { total: 0, top: 0, top5: 0, wrongState: 0 };
    entry.total += 1;
    if (row.topAccepted) entry.top += 1;
    if (row.top5Accepted) entry.top5 += 1;
    if (row.wrongState) entry.wrongState += 1;
    categorySummary[row.category] = entry;
  }
  return {
    total,
    topPassCount: rows.filter((row) => row.topAccepted).length,
    top5PassCount: rows.filter((row) => row.top5Accepted).length,
    wrongStateCount: rows.filter((row) => row.wrongState).length,
    topRate: rate(rows.filter((row) => row.topAccepted).length, total),
    top5Rate: rate(rows.filter((row) => row.top5Accepted).length, total),
    categories: categorySummary,
  };
}

function renderMarkdown(payload) {
  const lines = [
    `# Geocode quality regression - ${payload.generatedAt}`,
    "",
    `Status: ${payload.ok ? "passed" : "failed"}`,
    `Mode: ${payload.mode}`,
    `Provider: ${payload.provider}`,
    `No external provider calls: ${payload.noExternal}`,
    `Fixture: ${payload.fixturePath}`,
    "",
    "## Summary",
    "",
    `- Cases: ${payload.summary.total}`,
    `- Top pass: ${payload.summary.topPassCount} (${percent(payload.summary.topRate)})`,
    `- Top 5 pass: ${payload.summary.top5PassCount} (${percent(payload.summary.top5Rate)})`,
    `- Wrong-state top results: ${payload.summary.wrongStateCount}`,
    "",
    "## Failed or degraded rows",
    "",
  ];
  const failed = payload.rows.filter((row) => !row.top5Accepted || row.wrongState || row.error);
  if (!failed.length) lines.push("- None");
  for (const row of failed) {
    lines.push(`- ${row.id}: ${row.topOutcome}; top=${row.topLabel || "none"}; warning=${row.warning || row.error || "none"}`);
  }
  return `${lines.join("\n")}\n`;
}

function rate(count, total) {
  return total ? Number((count / total).toFixed(4)) : 0;
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function stateFromLabel(label) {
  const match = String(label || "").match(/\b(NSW|ACT|QLD|WA|SA|TAS|VIC|NT)\b/i);
  return match ? match[1].toUpperCase() : "";
}

function loadLocalEnv(file = ".env.local") {
  const envPath = path.resolve(ROOT, file);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
  }
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2).replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
    const next = values[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}
