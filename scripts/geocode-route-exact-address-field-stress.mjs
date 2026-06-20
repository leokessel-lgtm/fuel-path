import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { EXACT_ADDRESS_CASES, toGnafCorePsv } from "./exact-address-cases.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

process.env.FUEL_PATH_GEOCODE_PROVIDER = process.env.FUEL_PATH_GEOCODE_PROVIDER || "nominatim";

const RUN_ID = process.env.FUEL_PATH_ROUTE_EXACT_ADDRESS_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const LIMIT = Number(process.env.FUEL_PATH_ROUTE_EXACT_ADDRESS_LIMIT || 5);
const MIN_PREFIX_CHARS = Number(process.env.FUEL_PATH_ROUTE_EXACT_ADDRESS_MIN_PREFIX || 3);
const ROUTE_PAIR_COUNT = Number(process.env.FUEL_PATH_ROUTE_EXACT_ADDRESS_PAIRS || 100);
const MAX_FIXTURE_P90_CHARS = Number(process.env.FUEL_PATH_ROUTE_EXACT_ADDRESS_MAX_P90 || 34);
const providerFetchCalls = [];

installProviderFailure();

const { geocode } = require("../api/_backend");

const fixture = await buildFixtureIndex(EXACT_ADDRESS_CASES);
const currentConfigured = await runPass("current_configured", {});
const fixtureGnaf = await withEnv(
  {
    FUEL_PATH_GNAF_API_URL: "",
    FUEL_PATH_GNAF_API_TOKEN: "",
    FUEL_PATH_GNAF_SQLITE_PATH: fixture.sqlitePath,
    FUEL_PATH_GNAF_DATABASE_URL: "",
  },
  async () => runPass("fixture_gnaf_route_fields", { requireExact: true }),
);

const summary = {
  runId: RUN_ID,
  caseCount: EXACT_ADDRESS_CASES.length,
  routePairCount: ROUTE_PAIR_COUNT,
  currentConfigured: currentConfigured.summary,
  fixtureGnaf: fixtureGnaf.summary,
  interpretation: {
    currentConfigured:
      "Current runtime lookup coverage. This may pass suburb/POI routing while still being unsafe for public exact-address claims.",
    fixtureGnaf:
      "Temporary all-jurisdiction G-NAF fixture. This proves From/To route-field behaviour once national exact-address data is available.",
    fixtureCharacterCounts:
      "The fixture is intentionally tiny, so characters-to-exact proves matching mechanics only. Real production suggestion effort must come from the hosted national benchmark.",
  },
};

await fs.mkdir("tmp", { recursive: true });
const jsonPath = `tmp/geocode-route-exact-address-field-stress-${RUN_ID}.json`;
const reportPath = `tmp/geocode-route-exact-address-field-stress-${RUN_ID}.md`;
await fs.writeFile(
  jsonPath,
  `${JSON.stringify({ summary, passes: { currentConfigured, fixtureGnaf } }, null, 2)}\n`,
);
await fs.writeFile(reportPath, renderReport(summary, currentConfigured, fixtureGnaf));

console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
assertPass(summary);

async function runPass(passName, options = {}) {
  const beforeFetchCalls = providerFetchCalls.length;
  const endpoints = [];
  for (const item of EXACT_ADDRESS_CASES) {
    endpoints.push(await assessEndpoint(passName, item));
  }
  const afterFetchCalls = providerFetchCalls.length;
  const routePairs = buildRoutePairs(endpoints, ROUTE_PAIR_COUNT);
  const charValues = endpoints.map((row) => row.firstExactChars).filter(Number.isFinite);
  const pairCharValues = routePairs.map((pair) => pair.totalChars).filter(Number.isFinite);
  const exactTop = endpoints.filter((row) => row.finalExactRank === 1).length;
  const exactAny = endpoints.filter((row) => row.finalExactRank).length;
  const summary = {
    passName,
    endpoints: endpoints.length,
    routePairs: routePairs.length,
    exactPrefixReady: endpoints.filter((row) => row.firstExactChars).length,
    exactFinalTop: exactTop,
    exactFinalAny: exactAny,
    providerCalls: afterFetchCalls - beforeFetchCalls,
    charsNeeded: {
      min: charValues.length ? Math.min(...charValues) : null,
      median: percentile(charValues, 50),
      p90: percentile(charValues, 90),
      max: charValues.length ? Math.max(...charValues) : null,
      average: charValues.length ? Number((charValues.reduce((sum, value) => sum + value, 0) / charValues.length).toFixed(1)) : null,
      nonExact: endpoints.filter((row) => !row.firstExactChars).length,
    },
    routePairs: {
      uniquePairs: new Set(routePairs.map((pair) => `${pair.from}->${pair.to}`)).size,
      bothExactPrefixReady: routePairs.filter((pair) => pair.ready).length,
      bothExactFullReady: routePairs.filter((pair) => pair.fullReady).length,
      oneOrMoreMissingExact: routePairs.filter((pair) => !pair.ready).length,
      totalCharsMedian: percentile(pairCharValues, 50),
      totalCharsP90: percentile(pairCharValues, 90),
      totalCharsMax: pairCharValues.length ? Math.max(...pairCharValues) : null,
    },
    byState: groupSummary(endpoints, "state"),
    byCategory: groupSummary(endpoints, "category"),
    weakestEndpoints: endpoints
      .slice()
      .sort((left, right) => (right.firstExactChars || 999) - (left.firstExactChars || 999) || left.id.localeCompare(right.id))
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        state: row.state,
        category: row.category,
        query: row.query,
        firstExactChars: row.firstExactChars,
        finalExactRank: row.finalExactRank,
        finalTopLabel: row.finalTopLabel,
        finalTopProvider: row.finalTopProvider,
      })),
    requireExact: Boolean(options.requireExact),
  };
  return { summary, endpoints, routePairs };
}

async function assessEndpoint(passName, item) {
  let firstExactChars = null;
  let firstExactRank = null;
  let finalPayload = null;
  let finalSuggestions = [];
  let prefixesTested = 0;
  let elapsedMs = 0;

  for (const prefix of prefixesFor(item.query)) {
    const started = Date.now();
    const payload = await geocode({
      query: prefix,
      limit: LIMIT,
      sessionToken: `${passName}-${RUN_ID}-${item.id}`,
      provider: "nominatim",
    });
    elapsedMs += Date.now() - started;
    prefixesTested += 1;
    const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    const exactIndex = suggestions.findIndex((suggestion) => exactSuggestionMatch(item, suggestion));
    if (exactIndex >= 0) {
      firstExactChars = prefix.length;
      firstExactRank = exactIndex + 1;
      break;
    }
  }

  const started = Date.now();
  finalPayload = await geocode({
    query: item.query,
    limit: LIMIT,
    sessionToken: `${passName}-${RUN_ID}-${item.id}-full`,
    provider: "nominatim",
  });
  elapsedMs += Date.now() - started;
  finalSuggestions = Array.isArray(finalPayload?.suggestions) ? finalPayload.suggestions : [];
  const finalExactRank = finalSuggestions.findIndex((suggestion) => exactSuggestionMatch(item, suggestion)) + 1 || null;
  const finalTop = finalSuggestions[0] || null;

  return {
    id: item.id,
    state: item.state,
    category: item.category,
    query: item.query,
    expectedLabel: item.label,
    firstExactChars,
    firstExactRank,
    prefixesTested,
    finalExactRank,
    finalSuggestionCount: finalSuggestions.length,
    finalTopLabel: finalTop?.label || "",
    finalTopProvider: finalTop?.provider || "",
    finalTopType: finalTop?.type || "",
    lookupStatus: finalPayload?.lookupStatus || "",
    elapsedMs,
  };
}

function exactSuggestionMatch(item, suggestion) {
  if (suggestion?.provider !== "fuel_path_gnaf" || suggestion?.type !== "address") return false;
  return normalise(suggestion?.label) === normalise(item.label);
}

function prefixesFor(query) {
  const text = String(query || "").trim();
  const prefixes = [];
  for (let length = MIN_PREFIX_CHARS; length <= text.length; length += 1) {
    prefixes.push(text.slice(0, length));
  }
  return prefixes;
}

function buildRoutePairs(items, count) {
  const pairs = [];
  const seen = new Set();
  const offsets = [7, 5, 11, 3, 13, 2, 9, 15];
  for (const offset of offsets) {
    for (let index = 0; index < items.length && pairs.length < count; index += 1) {
      const from = items[index];
      const to = items[(index + offset) % items.length];
      const key = `${from.id}->${to.id}`;
      if (from.id === to.id || seen.has(key)) continue;
      seen.add(key);
      pairs.push({
        from: from.id,
        to: to.id,
        ready: Boolean(from.firstExactChars && to.firstExactChars),
        fullReady: Boolean(from.finalExactRank && to.finalExactRank),
        totalChars: from.firstExactChars && to.firstExactChars ? from.firstExactChars + to.firstExactChars : null,
      });
    }
  }
  if (pairs.length < count) {
    throw new Error(`Only built ${pairs.length}/${count} unique exact-address route pairs`);
  }
  return pairs;
}

async function buildFixtureIndex(items) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fuel-path-route-exact-address-"));
  const inputPath = path.join(dir, "GNAF_CORE.psv");
  const sqlitePath = path.join(dir, "gnaf-route-exact-address.sqlite");
  await fs.writeFile(inputPath, toGnafCorePsv(items));
  execFileSync(
    process.execPath,
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

function groupSummary(rows, field) {
  return Object.fromEntries(
    [...new Set(rows.map((row) => row[field]))]
      .sort()
      .map((key) => {
        const items = rows.filter((row) => row[field] === key);
        const charValues = items.map((row) => row.firstExactChars).filter(Number.isFinite);
        return [key, {
          cases: items.length,
          exactPrefixReady: items.filter((row) => row.firstExactChars).length,
          exactFinalTop: items.filter((row) => row.finalExactRank === 1).length,
          p90Chars: percentile(charValues, 90),
          maxChars: charValues.length ? Math.max(...charValues) : null,
        }];
      }),
  );
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function renderReport(summary, currentConfigured, fixtureGnaf) {
  return `# Fuel Path Exact-Address Route Field Stress Report

Run ID: ${summary.runId}

## Summary

Current configured exact-address top matches: ${currentConfigured.summary.exactFinalTop}/${currentConfigured.summary.endpoints}

Fixture G-NAF exact-address top matches: ${fixtureGnaf.summary.exactFinalTop}/${fixtureGnaf.summary.endpoints}

Fixture route pairs exact-prefix ready: ${fixtureGnaf.summary.routePairs.bothExactPrefixReady}/${summary.routePairCount}

Fixture unique route pairs: ${fixtureGnaf.summary.routePairs.uniquePairs}/${summary.routePairCount}

Fixture characters to exact address: min ${fixtureGnaf.summary.charsNeeded.min}, median ${fixtureGnaf.summary.charsNeeded.median}, p90 ${fixtureGnaf.summary.charsNeeded.p90}, max ${fixtureGnaf.summary.charsNeeded.max}, average ${fixtureGnaf.summary.charsNeeded.average}

Fixture from + to characters: median ${fixtureGnaf.summary.routePairs.totalCharsMedian}, p90 ${fixtureGnaf.summary.routePairs.totalCharsP90}, max ${fixtureGnaf.summary.routePairs.totalCharsMax}

## Current Configured By State

${stateTable(currentConfigured.summary.byState)}

## Fixture G-NAF By State

${stateTable(fixtureGnaf.summary.byState)}

## Fixture Weakest Cases

id | state | category | firstExactChars | finalExactRank | topProvider | query
--- | --- | --- | ---: | ---: | --- | ---
${fixtureGnaf.summary.weakestEndpoints.map((row) => [row.id, row.state, row.category, row.firstExactChars, row.finalExactRank, row.finalTopProvider, row.query].map(markdownCell).join(" | ")).join("\n")}

## Interpretation

- Current configured mode is evidence of the launch gap, not a pass for exact-address claims.
- Fixture mode proves the route fields can handle national exact-address suggestions when G-NAF coverage is populated.
- The fixture character counts are not production autocomplete precision estimates because the fixture has only 16 address records.
- Any public exact-address claim still depends on hosted national G-NAF passing the readiness and hosted benchmark gates.
`;
}

function stateTable(groups) {
  return `state | cases | exactPrefixReady | exactFinalTop | p90Chars | maxChars
--- | ---: | ---: | ---: | ---: | ---:
${Object.entries(groups)
  .map(([state, values]) => [state, values.cases, values.exactPrefixReady, values.exactFinalTop, values.p90Chars, values.maxChars].map(markdownCell).join(" | "))
  .join("\n")}`;
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

function assertPass(summary) {
  const failures = [];
  if (summary.fixtureGnaf.exactPrefixReady !== summary.caseCount) {
    failures.push(`Expected ${summary.caseCount}/${summary.caseCount} fixture exact prefixes, got ${summary.fixtureGnaf.exactPrefixReady}`);
  }
  if (summary.fixtureGnaf.exactFinalTop !== summary.caseCount) {
    failures.push(`Expected ${summary.caseCount}/${summary.caseCount} fixture final top exact matches, got ${summary.fixtureGnaf.exactFinalTop}`);
  }
  if (summary.fixtureGnaf.providerCalls !== 0) {
    failures.push(`Expected fixture route field pass to avoid provider calls, got ${summary.fixtureGnaf.providerCalls}`);
  }
  if (summary.fixtureGnaf.charsNeeded.p90 > MAX_FIXTURE_P90_CHARS) {
    failures.push(`Expected fixture exact-address p90 chars <= ${MAX_FIXTURE_P90_CHARS}, got ${summary.fixtureGnaf.charsNeeded.p90}`);
  }
  if (summary.fixtureGnaf.routePairs.bothExactPrefixReady !== summary.routePairCount) {
    failures.push(`Expected ${summary.routePairCount}/${summary.routePairCount} fixture route pairs exact-prefix ready, got ${summary.fixtureGnaf.routePairs.bothExactPrefixReady}`);
  }
  if (summary.fixtureGnaf.routePairs.uniquePairs !== summary.routePairCount) {
    failures.push(`Expected ${summary.routePairCount}/${summary.routePairCount} unique fixture route pairs, got ${summary.fixtureGnaf.routePairs.uniquePairs}`);
  }
  if (failures.length) throw new Error(failures.join("; "));
}

function installProviderFailure() {
  global.fetch = async () => {
    providerFetchCalls.push({ at: Date.now() });
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
