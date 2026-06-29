import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { EXACT_ADDRESS_CASES, STATE_ORDER, toGnafCorePsv } from "./exact-address-cases.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RUN_ID = process.env.FUEL_PATH_EXACT_ADDRESS_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const LIMIT = Number(process.env.FUEL_PATH_EXACT_ADDRESS_LIMIT || 5);
const MIN_PREFIX_CHARS = Number(process.env.FUEL_PATH_EXACT_ADDRESS_MIN_PREFIX || 3);
const REQUIRE_CURRENT = process.env.FUEL_PATH_EXACT_ADDRESS_REQUIRE_CURRENT === "1";
const providerFetchCalls = [];

installProviderFailure();

const { geocode } = require("../api/_backend");
const { addressIndexStatus } = require("../api/_addressIndex");

const cases = EXACT_ADDRESS_CASES;
const fixture = await buildFixtureIndex(cases);

const baseline = await withEnv(
  {
    FUEL_PATH_GNAF_API_URL: "",
    FUEL_PATH_GNAF_API_TOKEN: "",
    FUEL_PATH_GNAF_SQLITE_PATH: "",
    FUEL_PATH_GNAF_DATABASE_URL: "",
  },
  async () => runPass("current_seed_only", cases, LIMIT),
);

const fixtureIndexed = await withEnv(
  {
    FUEL_PATH_GNAF_API_URL: "",
    FUEL_PATH_GNAF_API_TOKEN: "",
    FUEL_PATH_GNAF_SQLITE_PATH: fixture.sqlitePath,
    FUEL_PATH_GNAF_DATABASE_URL: "",
  },
  async () => runPass("fixture_gnaf_sqlite", cases, LIMIT + 1),
);

const currentConfigured = await runPass("current_configured", cases, LIMIT + 2);
const summary = {
  runId: RUN_ID,
  caseCount: cases.length,
  states: STATE_ORDER,
  baseline: baseline.summary,
  fixtureIndexed: fixtureIndexed.summary,
  currentConfigured: currentConfigured.summary,
  launchReadiness: readiness(currentConfigured.summary),
  interpretation: {
    baseline:
      "Seed-only mode proves local fallback behaviour but is not national exact-address coverage.",
    fixtureIndexed:
      "Temporary all-jurisdiction G-NAF fixture proves the exact-address index path can resolve unit, slash, suffix, townhouse, rural and remote addresses without external provider calls.",
    currentConfigured:
      "This is the current runtime address-index mode. It is launch-ready only when every exact-address case resolves from fuel_path_gnaf with no provider calls.",
  },
};

await fs.mkdir("tmp", { recursive: true });
const jsonPath = `tmp/geocode-exact-address-readiness-${RUN_ID}.json`;
const csvPath = `tmp/geocode-exact-address-readiness-${RUN_ID}.csv`;
await fs.writeFile(jsonPath, JSON.stringify({ ...summary, rows: { baseline: baseline.rows, fixtureIndexed: fixtureIndexed.rows, currentConfigured: currentConfigured.rows } }, null, 2));
await fs.writeFile(csvPath, `${toCsv([...baseline.rows, ...fixtureIndexed.rows, ...currentConfigured.rows])}\n`);

console.log(JSON.stringify({ ...summary, jsonPath, csvPath }, null, 2));
assertReadiness(summary, fixtureIndexed.rows, currentConfigured.rows);

async function runPass(passName, items, passLimit) {
  const status = addressIndexStatus();
  const rows = [];
  const beforeFetchCalls = providerFetchCalls.length;
  for (const item of items) {
    rows.push(await runCase(passName, status, item, passLimit));
  }
  const afterFetchCalls = providerFetchCalls.length;
  return {
    rows,
    summary: {
      passName,
      addressIndexMode: status.mode,
      addressIndexSource: status.source,
      cases: rows.length,
      exactTop: rows.filter((row) => row.result === "exact_top").length,
      exactAny: rows.filter((row) => row.exactRank).length,
      localityFallback: rows.filter((row) => row.result === "locality_fallback").length,
      wrongSuggestion: rows.filter((row) => row.result === "wrong_suggestion").length,
      noSuggestion: rows.filter((row) => row.result === "no_suggestion").length,
      providerCalls: afterFetchCalls - beforeFetchCalls,
      limit: passLimit,
      byState: groupSummary(rows, "state"),
      byCategory: groupSummary(rows, "category"),
      charsToExact: charSummary(rows.map((row) => row.firstExactChars).filter(Number.isFinite)),
    },
  };
}

async function runCase(passName, status, item, passLimit) {
  let firstExactChars = null;
  let finalPayload = null;
  let finalSuggestions = [];
  let calls = 0;
  let elapsedMs = 0;
  for (const prefix of prefixesFor(item.query)) {
    const started = Date.now();
    const payload = await geocode({
      query: prefix,
      limit: passLimit,
      sessionToken: `${passName}-${RUN_ID}-${item.id}`,
      provider: "nominatim",
    });
    elapsedMs += Date.now() - started;
    calls += 1;
    const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    const exactIndex = suggestions.findIndex((suggestion) => exactSuggestionMatch(item, suggestion));
    if (exactIndex >= 0 && firstExactChars === null) firstExactChars = prefix.length;
    finalPayload = payload;
    finalSuggestions = suggestions;
  }

  const finalTop = finalSuggestions[0] || null;
  const exactRank = finalSuggestions.findIndex((suggestion) => exactSuggestionMatch(item, suggestion)) + 1 || null;
  const localityRank = finalSuggestions.findIndex((suggestion) => localityMatch(item, suggestion)) + 1 || null;
  const result = exactRank === 1
    ? "exact_top"
    : exactRank
      ? "exact_ranked"
      : localityRank
        ? "locality_fallback"
        : finalSuggestions.length
          ? "wrong_suggestion"
          : "no_suggestion";

  return {
    passName,
    id: item.id,
    state: item.state,
    category: item.category,
    query: item.query,
    expectedLabel: item.label,
    expectedLocality: item.locality,
    addressIndexMode: status.mode,
    addressIndexSource: status.source,
    prefixesTested: calls,
    firstExactChars,
    finalSuggestionCount: finalSuggestions.length,
    exactRank,
    localityRank,
    finalTopLabel: finalTop?.label || "",
    finalTopProvider: finalTop?.provider || "",
    finalTopType: finalTop?.type || "",
    finalLookupStatus: finalPayload?.lookupStatus || "",
    result,
    elapsedMs,
  };
}

function exactSuggestionMatch(item, suggestion) {
  if (suggestion?.provider !== "fuel_path_gnaf" || suggestion?.type !== "address") return false;
  return normalise(suggestion?.label) === normalise(item.label);
}

function localityMatch(item, suggestion) {
  const label = normalise(suggestion?.label);
  return label.includes(normalise(item.locality)) && label.includes(normalise(item.state));
}

function readiness(summary) {
  const ready = summary.exactTop === summary.cases && summary.providerCalls === 0 && ["api", "postgres", "sqlite"].includes(summary.addressIndexMode);
  return {
    ready,
    status: ready ? "ready_for_exact_address_smoke" : "not_ready_for_public_exact_address_claim",
    reason: ready
      ? "Every exact-address case resolved from the configured G-NAF index without external provider calls."
      : "The current configured address-index mode does not prove full exact-address coverage.",
  };
}

function assertReadiness(summary, fixtureRows, currentRows) {
  const failures = [];
  if (summary.fixtureIndexed.exactTop !== summary.caseCount) {
    failures.push(`Expected fixture G-NAF to top-match ${summary.caseCount}/${summary.caseCount}, got ${summary.fixtureIndexed.exactTop}`);
  }
  if (summary.fixtureIndexed.providerCalls !== 0) {
    failures.push(`Expected fixture G-NAF pass to avoid provider calls, got ${summary.fixtureIndexed.providerCalls}`);
  }
  if (summary.fixtureIndexed.charsToExact.p90 > 34) {
    failures.push(`Expected fixture G-NAF p90 chars <= 34, got ${summary.fixtureIndexed.charsToExact.p90}`);
  }
  if (REQUIRE_CURRENT && !summary.launchReadiness.ready) {
    const examples = currentRows
      .filter((row) => row.result !== "exact_top")
      .slice(0, 10)
      .map((row) => `${row.id} ${row.query} -> ${row.result}`);
    failures.push(`Current configured address index is not launch-ready. Examples: ${examples.join(" | ")}`);
  }
  if (failures.length) {
    const fixtureExamples = fixtureRows
      .filter((row) => row.result !== "exact_top")
      .slice(0, 10)
      .map((row) => `${row.id} ${row.query} -> ${row.result}`);
    throw new Error(`${failures.join("; ")}${fixtureExamples.length ? `; fixture examples: ${fixtureExamples.join(" | ")}` : ""}`);
  }
}

async function buildFixtureIndex(items) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fuel-path-exact-address-"));
  const inputPath = path.join(dir, "GNAF_CORE.psv");
  const sqlitePath = path.join(dir, "gnaf-exact-address.sqlite");
  await fs.writeFile(inputPath, toGnafCorePsv(items));
  execFileSync(
    "node",
    [
      "scripts/build-gnaf-address-index.mjs",
      "--input",
      inputPath,
      "--output",
      sqlitePath,
    ],
    { cwd: ROOT, stdio: "ignore" },
  );
  return { dir, inputPath, sqlitePath };
}

function prefixesFor(query) {
  const text = String(query || "").trim();
  const prefixes = [];
  for (let length = MIN_PREFIX_CHARS; length <= text.length; length += 1) {
    prefixes.push(text.slice(0, length));
  }
  return prefixes;
}

function groupSummary(rows, field) {
  return Object.fromEntries(
    [...new Set(rows.map((row) => row[field]))]
      .sort()
      .map((key) => {
        const items = rows.filter((row) => row[field] === key);
        return [key, {
          cases: items.length,
          exactTop: items.filter((row) => row.result === "exact_top").length,
          exactAny: items.filter((row) => row.exactRank).length,
          localityFallback: items.filter((row) => row.result === "locality_fallback").length,
          wrongSuggestion: items.filter((row) => row.result === "wrong_suggestion").length,
          noSuggestion: items.filter((row) => row.result === "no_suggestion").length,
        }];
      }),
  );
}

function charSummary(values) {
  return {
    min: values.length ? Math.min(...values) : null,
    median: percentile(values, 50),
    p90: percentile(values, 90),
    max: values.length ? Math.max(...values) : null,
    average: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : null,
  };
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

async function withEnv(env, callback) {
  const previous = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function toCsv(rows) {
  const headers = [
    "passName",
    "id",
    "state",
    "category",
    "query",
    "expectedLabel",
    "addressIndexMode",
    "firstExactChars",
    "exactRank",
    "localityRank",
    "result",
    "finalTopLabel",
    "finalTopProvider",
    "finalLookupStatus",
    "elapsedMs",
  ];
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function installProviderFailure() {
  global.fetch = async (input) => {
    providerFetchCalls.push(String(input));
    return {
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      async text() {
        return JSON.stringify({ error: { message: "Too many requests" } });
      },
    };
  };
}
