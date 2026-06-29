#!/usr/bin/env node
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { EXACT_ADDRESS_CASES, toGnafCorePsv } from "./exact-address-cases.mjs";

const sqliteMode = process.env.FUEL_PATH_SMOKE_SQLITE_MODE || "fixture";
const sqlitePath =
  sqliteMode === "fixture"
    ? await buildFixtureIndex()
    : process.env.FUEL_PATH_GNAF_SQLITE_PATH || "data/gnaf/build/gnaf-addresses-smoke.sqlite";
process.env.FUEL_PATH_GNAF_SQLITE_PATH = sqlitePath;
process.env.FUEL_PATH_GNAF_API_URL = process.env.FUEL_PATH_GNAF_API_URL || "";
process.env.FUEL_PATH_GNAF_API_TOKEN = process.env.FUEL_PATH_GNAF_API_TOKEN || "";
process.env.FUEL_PATH_GNAF_DATABASE_URL = process.env.FUEL_PATH_GNAF_DATABASE_URL || "";

const require = createRequire(import.meta.url);
const {
  searchAddressIndex,
  normaliseAddressText,
} = require("../api/_addressIndex.js");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");

function normalised(value) {
  return normaliseAddressText(value || "");
}

function matchesExpectedLabel(value, expectedLabel) {
  const candidate = normalised(value);
  const expected = normalised(expectedLabel);
  if (candidate === expected) return true;
  if (candidate.includes(expected)) return true;
  if (expected.includes(candidate) && candidate.length >= 6) return true;
  return false;
}

function unitPrefixQuery(item) {
  if (!item.flatType || !item.flatNumber) return "";
  const numberSuffix = item.suffix || "";
  return `${item.flatNumber} ${item.number}${numberSuffix} ${item.streetName} ${item.streetType} ${item.locality} ${item.state} ${item.postcode}`;
}

function unitAliasPrefixQuery(item, alias) {
  if (!item.flatType || !item.flatNumber) return "";
  const numberSuffix = item.suffix || "";
  return `${alias} ${item.flatNumber} ${item.number}${numberSuffix} ${item.streetName} ${item.streetType} ${item.locality} ${item.state} ${item.postcode}`;
}
const UNIT_ALIAS_PREFIXES = ["Building", "Suite", "Bldg", "Blg", "Ste"];

function candidateLengths(query) {
  const text = String(query || "");
  const minLength = Math.min(12, text.length);
  const baseLengths = [minLength, 14, 18, 20, 24, text.length];
  const lengths = new Set(baseLengths);
  return [...lengths]
    .filter((length) => length >= minLength && length <= text.length)
    .sort((left, right) => left - right);
}

function toCase(item, kind, query) {
  return {
    id: `${item.id}-${kind}`,
    state: item.state,
    category: `${item.category}${kind === "canonical" ? "" : `-${kind}`}`,
    query,
    expectedLabel: normalised(item.label),
  };
}

const targets = EXACT_ADDRESS_CASES.filter((item) => item.category.includes("unit") || item.category.includes("remote"));
const cases = [];
for (const item of targets) {
  cases.push(toCase(item, "canonical", item.query));
  const unitPrefix = unitPrefixQuery(item);
  if (unitPrefix) cases.push(toCase(item, "leading", unitPrefix));
  if (item.category.includes("remote") && item.category.includes("unit")) {
    for (const aliasPrefix of UNIT_ALIAS_PREFIXES) {
      const aliasPrefixQuery = unitAliasPrefixQuery(item, aliasPrefix);
      if (!aliasPrefixQuery) continue;
      cases.push(toCase(item, `${aliasPrefix.toLowerCase()}-prefix`, aliasPrefixQuery));
    }
  }
}

const summary = {
  runAt: new Date().toISOString(),
  runId: RUN_ID,
  sqlitePath,
  sqliteMode,
  caseCount: cases.length,
  exactTop: 0,
  exactAny: 0,
  noSuggestion: 0,
  charsToExact: [],
  byState: {},
  byCategory: {},
  failures: [],
};

for (const item of cases) {
  const result = await assess(item);

  if (!summary.byState[item.state]) {
    summary.byState[item.state] = { total: 0, exactTop: 0 };
  }
  if (!summary.byCategory[item.category]) {
    summary.byCategory[item.category] = { total: 0, exactTop: 0 };
  }
  summary.byState[item.state].total += 1;
  summary.byCategory[item.category].total += 1;

  if (result.exactTop) {
    summary.exactTop += 1;
    summary.byState[item.state].exactTop += 1;
    summary.byCategory[item.category].exactTop += 1;
  }
  if (result.exactAny) summary.exactAny += 1;
  if (result.suggestionsCount === 0) {
    summary.noSuggestion += 1;
    summary.failures.push(result);
  }
  if (Number.isFinite(result.charsToExact)) {
    summary.charsToExact.push(result.charsToExact);
  }
}

if (summary.charsToExact.length) {
  const sorted = [...summary.charsToExact].sort((left, right) => left - right);
  summary.charsToExactStats = {
    min: sorted[0],
    median: sorted[Math.floor((sorted.length - 1) * 0.5)],
    p90: sorted[Math.floor((sorted.length - 1) * 0.9)],
    max: sorted[sorted.length - 1],
    nonExact: cases.length - summary.exactAny,
  };
}

mkdirSync("tmp", { recursive: true });
writeFileSync(`tmp/geocode-rural-unit-unit-prefix-smoke-${RUN_ID}.json`, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (sqliteMode === "fixture") cleanupFixtureSqlite(sqlitePath);
if (summary.noSuggestion > 0 || summary.exactTop < summary.caseCount) {
  throw new Error(`Expected all unit-prefix cases to resolve exactly. exactTop ${summary.exactTop}/${summary.caseCount}, noSuggestion ${summary.noSuggestion}`);
}

async function assess(item) {
  const fullSuggestions = await searchAddressIndex(item.query, 8);
  const exactAny = fullSuggestions.some((row) => matchesExpectedLabel(row.label, item.expectedLabel));
  const topSuggestion = fullSuggestions[0] || null;
  const exactTop = Boolean(topSuggestion && matchesExpectedLabel(topSuggestion.label, item.expectedLabel));

  let charsToExact = null;
  for (const length of candidateLengths(item.query)) {
    const prefix = item.query.slice(0, length);
    const prefixSuggestions = await searchAddressIndex(prefix, 8);
    if (prefixSuggestions[0] && matchesExpectedLabel(prefixSuggestions[0].label, item.expectedLabel)) {
      charsToExact = length;
      break;
    }
  }

  return {
    id: item.id,
    state: item.state,
    category: item.category,
    query: item.query,
    expectedLabel: item.expectedLabel,
    exactTop,
    exactAny,
    suggestionsCount: fullSuggestions.length,
    topSuggestion: topSuggestion
      ? {
        label: topSuggestion.label,
        provider: topSuggestion.provider,
        type: topSuggestion.type,
      }
      : null,
    charsToExact,
  };
}

async function buildFixtureIndex() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "fuel-path-unit-smoke-"));
  const inputPath = path.join(dir, "GNAF_CORE.psv");
  const fixturePath = path.join(dir, "gnaf-unit-prefix-smoke.sqlite");
  writeFileSync(inputPath, `${toGnafCorePsv(EXACT_ADDRESS_CASES)}\n`);
  execFileSync(
    process.execPath,
    [
      "scripts/build-gnaf-address-index.mjs",
      "--input",
      inputPath,
      "--output",
      fixturePath,
    ],
    { cwd: path.resolve("."), stdio: "ignore" },
  );
  return fixturePath;
}

function cleanupFixtureSqlite(sqliteFilePath) {
  const root = path.dirname(sqliteFilePath);
  rmSync(root, { recursive: true, force: true });
}
