#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const RUN_ID = args.runId || process.env.FUEL_PATH_FOCUSED_REGRESSION_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const API_BASE = args.apiBase || process.env.FUEL_PATH_API_BASE || "";
const LIMIT = Number(args.limit || process.env.FUEL_PATH_FOCUSED_REGRESSION_LIMIT || 5);
const PROVIDER = args.provider || process.env.FUEL_PATH_GEOCODE_PROVIDER || "nominatim";
const OUT_DIR = args.outDir || process.env.FUEL_PATH_FOCUSED_REGRESSION_OUT_DIR || "tmp";

const CASES = [
  {
    id: "wodonga_shop_boulevard_range",
    kind: "address",
    query: "Shop 45 55-71 Elgin Boulevard Wodonga VIC 3690",
    expectedLabel: "Shop 45, 55-71 Elgin Boulevard, Wodonga VIC 3690",
    expectedProvider: "fuel_path_gnaf",
  },
  {
    id: "coober_pedy_lot_address",
    kind: "address",
    query: "Lot 1620 Brady Street Coober Pedy SA 5723",
    expectedLabel: "Lot 1620, Brady Street, Coober Pedy SA 5723",
    expectedProvider: "fuel_path_gnaf",
  },
  { id: "monarto_safari_park", kind: "poi", query: "Monarto Safari Park", expectedTerms: ["Monarto Safari Park"], expectedProvider: "fuel_path_regional_gazetteer" },
  { id: "clare_valley_tourism", kind: "poi", query: "Clare Valley Wine Food Tourism Centre SA", expectedTerms: ["Clare Valley Wine Food Tourism Centre"], expectedProvider: "fuel_path_regional_gazetteer" },
  { id: "mount_gambier_airport", kind: "poi", query: "Mount Gambier Airport", expectedTerms: ["Mount Gambier Airport"], expectedProvider: "fuel_path_regional_gazetteer" },
  { id: "unisa_whyalla", kind: "poi", query: "University of South Australia Whyalla Campus SA", expectedTerms: ["University of South Australia Whyalla Campus"], expectedProvider: "fuel_path_regional_gazetteer" },
  { id: "murray_bridge_marketplace", kind: "poi", query: "Murray Bridge Marketplace Australia", expectedTerms: ["Murray Bridge Marketplace"], expectedProvider: "fuel_path_regional_gazetteer" },
  { id: "kingston_town_shopping", kind: "poi", query: "Kingston Town Shopping Centre near Kingston", expectedTerms: ["Kingston Town Shopping Centre"], expectedProvider: "fuel_path_regional_gazetteer" },
  { id: "kakadu_visitor_centre", kind: "poi", query: "Kakadu Visitor Centre Australia", expectedTerms: ["Kakadu Visitor Centre"], expectedProvider: "fuel_path_regional_gazetteer" },
  { id: "litchfield_national_park", kind: "poi", query: "Litchfield National Park near Litchfield National Park", expectedTerms: ["Litchfield National Park"], expectedProvider: "fuel_path_regional_gazetteer" },
];

if (!API_BASE) loadLocalEnv();

const rows = [];
for (let index = 0; index < CASES.length; index += 1) {
  rows.push(await runCase(CASES[index], index + 1));
}

const failures = rows.filter((row) => !row.ok);
const payload = {
  runId: RUN_ID,
  generatedAt: new Date().toISOString(),
  mode: API_BASE ? "http" : "module",
  apiBase: API_BASE,
  provider: PROVIDER,
  total: rows.length,
  passed: rows.length - failures.length,
  failed: failures.length,
  ok: failures.length === 0,
  rows,
};

await fsp.mkdir(path.join(ROOT, OUT_DIR), { recursive: true });
const jsonPath = path.join(OUT_DIR, `geocode-focused-regression-${RUN_ID}.json`);
await fsp.writeFile(path.join(ROOT, jsonPath), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ ok: payload.ok, runId: RUN_ID, jsonPath, passed: payload.passed, failed: payload.failed }, null, 2));
if (!payload.ok) process.exit(1);

async function runCase(testCase, index) {
  const started = Date.now();
  const payload = API_BASE ? await hostedGeocode(testCase.query, index) : await moduleGeocode(testCase.query, index);
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
  const top = suggestions[0] || null;
  const ok = matches(testCase, top);
  return {
    id: testCase.id,
    kind: testCase.kind,
    query: testCase.query,
    ok,
    elapsedMs: Date.now() - started,
    lookupStatus: payload?.lookupStatus || "",
    warning: payload?.warning || "",
    topProvider: top?.provider || "",
    topLabel: top?.label || "",
    topMatchType: top?.matchType || "",
  };
}

async function hostedGeocode(query, index) {
  const url = new URL("/api/geocode", API_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("provider", PROVIDER);
  url.searchParams.set("sessionToken", `focused-regression-${RUN_ID}-${index}`);
  const response = await fetch(url);
  if (!response.ok) return { suggestions: [], lookupStatus: "http_error", warning: `HTTP ${response.status}` };
  return response.json();
}

async function moduleGeocode(query, index) {
  const { geocode } = require("../api/_backend");
  return geocode({ query, limit: LIMIT, provider: PROVIDER, sessionToken: `focused-regression-${RUN_ID}-${index}` });
}

function matches(testCase, suggestion) {
  if (!suggestion) return false;
  if (testCase.expectedProvider && suggestion.provider !== testCase.expectedProvider) return false;
  const label = normalise(suggestion.label);
  if (testCase.expectedLabel) return label === normalise(testCase.expectedLabel);
  return (testCase.expectedTerms || []).some((term) => label.includes(normalise(term)));
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function loadLocalEnv(file = ".env.local") {
  const envPath = path.resolve(file);
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
