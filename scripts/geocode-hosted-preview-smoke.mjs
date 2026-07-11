#!/usr/bin/env node
import fsp from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const RUN_ID = args.runId || process.env.FUEL_PATH_HOSTED_PREVIEW_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const API_BASE = args.apiBase || process.env.FUEL_PATH_API_BASE || "";
const VERCEL_DEPLOYMENT = args.vercelDeployment || process.env.FUEL_PATH_VERCEL_DEPLOYMENT || "";
const TARGET = VERCEL_DEPLOYMENT || API_BASE;
const TRANSPORT = VERCEL_DEPLOYMENT ? "authenticated_vercel_cli" : "direct_http";
const PERFORMANCE_EVIDENCE = VERCEL_DEPLOYMENT ? "invalid_cli_transport_overhead" : "request_elapsed_only";
const LIMIT = Number(args.limit || process.env.FUEL_PATH_HOSTED_PREVIEW_LIMIT || 5);
const PROVIDER = args.provider || process.env.FUEL_PATH_GEOCODE_PROVIDER || "nominatim";
const DELAY_MS = Number(args.delayMs || process.env.FUEL_PATH_HOSTED_PREVIEW_DELAY_MS || 0);

async function main() {
  if (!TARGET) {
    throw new Error("Set --api-base, --vercel-deployment, FUEL_PATH_API_BASE or FUEL_PATH_VERCEL_DEPLOYMENT for hosted geocode preview smoke.");
  }

  const rows = [];
  for (let index = 0; index < CASES.length; index += 1) {
    rows.push(await runCase(CASES[index], index + 1));
    if (DELAY_MS) await sleep(DELAY_MS);
  }

  const summary = summarise(rows);
  const diagnostics = diagnose(rows);
  const payload = {
    runId: RUN_ID,
    target: TARGET,
    transport: TRANSPORT,
    performanceEvidence: PERFORMANCE_EVIDENCE,
    limit: LIMIT,
    provider: PROVIDER,
    caseCount: CASES.length,
    summary,
    diagnostics,
    rows,
  };

  await fsp.mkdir(path.join(ROOT, "tmp"), { recursive: true });
  const jsonPath = `tmp/geocode-hosted-preview-smoke-${RUN_ID}.json`;
  const reportPath = `tmp/geocode-hosted-preview-smoke-${RUN_ID}.md`;
  await fsp.writeFile(path.join(ROOT, jsonPath), `${JSON.stringify(payload, null, 2)}\n`);
  await fsp.writeFile(path.join(ROOT, reportPath), renderReport(payload));

  console.log(JSON.stringify({ runId: RUN_ID, jsonPath, reportPath, summary }, null, 2));
  assertSmoke(summary, rows);
}

async function runCase(testCase, index) {
  const started = Date.now();
  const payload = await geocodeQuery(testCase.query, index);
  const elapsedMs = Date.now() - started;
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
  const top = suggestions[0] || null;
  const matchIndex = suggestions.findIndex((suggestion) => suggestionMatches(testCase, suggestion));
  const topMatch = matchIndex === 0;
  const anyMatch = matchIndex >= 0;
  const result = topMatch ? "top_match" : anyMatch ? "ranked_match" : suggestions.length ? "suggestions_but_not_expected" : "no_suggestion";
  return {
    id: testCase.id,
    kind: testCase.kind,
    category: testCase.category,
    state: testCase.state,
    query: testCase.query,
    expectedLabel: testCase.expectedLabel || "",
    expectedTerms: testCase.expectedTerms || [],
    suggestionCount: suggestions.length,
    result,
    topMatch,
    anyMatch,
    topLabel: top?.label || "",
    topProvider: top?.provider || "",
    topType: top?.type || "",
    topState: top?.state || "",
    lookupStatus: payload?.lookupStatus || "",
    warning: payload?.warning || "",
    elapsedMs,
  };
}

async function geocodeQuery(query, index) {
  const url = new URL("/api/geocode", TARGET);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("provider", PROVIDER);
  url.searchParams.set("sessionToken", `hosted-preview-${RUN_ID}-${index}`);
  if (VERCEL_DEPLOYMENT) {
    try {
      const output = execFileSync(
        "npx",
        ["vercel", "curl", `${url.pathname}${url.search}`, "--deployment", VERCEL_DEPLOYMENT, "--", "--silent", "--show-error"],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { ...process.env, NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || path.join(ROOT, ".npm-cache") },
          maxBuffer: 1024 * 1024,
        },
      );
      return JSON.parse(output);
    } catch {
      return { suggestions: [], lookupStatus: "http_error", warning: "Authenticated Vercel preview request failed" };
    }
  }
  const response = await fetch(url);
  if (!response.ok) return { suggestions: [], lookupStatus: "http_error", warning: `HTTP ${response.status}` };
  return response.json();
}

function suggestionMatches(testCase, suggestion) {
  const label = normalise(suggestion?.label);
  if (!label) return false;
  if (testCase.kind === "address") {
    return suggestion?.provider === "fuel_path_gnaf" && label === normalise(testCase.expectedLabel);
  }
  const state = normalise(testCase.state);
  const stateOk = suggestion?.state === testCase.state || label.includes(` ${state} `) || label.endsWith(` ${state}`);
  const terms = testCase.expectedTerms || [];
  const termOk = terms.some((term) => {
    const needle = normalise(term);
    return needle.length >= 4 && label.includes(needle);
  });
  return Boolean(stateOk && termOk);
}

function summarise(rows) {
  return {
    cases: rows.length,
    topMatch: rows.filter((row) => row.topMatch).length,
    rankedMatch: rows.filter((row) => row.result === "ranked_match").length,
    failures: rows.filter((row) => !row.anyMatch).length,
    addressTopMatch: rows.filter((row) => row.kind === "address" && row.topMatch).length,
    addressCases: rows.filter((row) => row.kind === "address").length,
    poiTopMatch: rows.filter((row) => row.kind === "poi" && row.topMatch).length,
    poiCases: rows.filter((row) => row.kind === "poi").length,
    byState: groupSummary(rows, "state"),
    byCategory: groupSummary(rows, "category"),
  };
}

function diagnose(rows) {
  const addressRows = rows.filter((row) => row.kind === "address");
  const nonGnafAddressRows = addressRows.filter((row) => row.topProvider && row.topProvider !== "fuel_path_gnaf");
  const noProviderAddressRows = addressRows.filter((row) => !row.topProvider);
  const httpErrorRows = rows.filter((row) => row.lookupStatus === "http_error");
  const noSuggestionRows = rows.filter((row) => row.result === "no_suggestion");
  const rankedButNotTopRows = rows.filter((row) => row.result === "ranked_match");
  const wrongSuggestionRows = rows.filter((row) => row.result === "suggestions_but_not_expected");
  const likelyBlockers = [];

  if (httpErrorRows.length) likelyBlockers.push("hosted_preview_api_http_errors");
  if (noProviderAddressRows.length) likelyBlockers.push("hosted_preview_address_provider_missing");
  if (nonGnafAddressRows.length) likelyBlockers.push("hosted_preview_address_provider_not_gnaf");
  if (noSuggestionRows.length) likelyBlockers.push("hosted_preview_no_suggestions");
  if (rankedButNotTopRows.length) likelyBlockers.push("hosted_preview_expected_result_not_top_ranked");
  if (wrongSuggestionRows.length) likelyBlockers.push("hosted_preview_wrong_suggestions_returned");

  return {
    likelyBlockers,
    topProviderCounts: countBy(rows.map((row) => row.topProvider || "none")),
    addressTopProviderCounts: countBy(addressRows.map((row) => row.topProvider || "none")),
    lookupStatusCounts: countBy(rows.map((row) => row.lookupStatus || "unknown")),
    nonGnafAddressRows: nonGnafAddressRows.map(compactRow),
    noProviderAddressRows: noProviderAddressRows.map(compactRow),
    httpErrorRows: httpErrorRows.map(compactRow),
    noSuggestionRows: noSuggestionRows.map(compactRow),
    rankedButNotTopRows: rankedButNotTopRows.map(compactRow),
    wrongSuggestionRows: wrongSuggestionRows.map(compactRow),
  };
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function compactRow(row) {
  return {
    id: row.id,
    query: row.query,
    result: row.result,
    topProvider: row.topProvider,
    lookupStatus: row.lookupStatus,
    topLabel: row.topLabel,
    warning: row.warning,
  };
}

function groupSummary(rows, field) {
  return Object.fromEntries(
    [...new Set(rows.map((row) => row[field]))]
      .sort()
      .map((key) => {
        const items = rows.filter((row) => row[field] === key);
        return [key, {
          cases: items.length,
          topMatch: items.filter((row) => row.topMatch).length,
          rankedMatch: items.filter((row) => row.result === "ranked_match").length,
          failures: items.filter((row) => !row.anyMatch).length,
        }];
      }),
  );
}

function assertSmoke(summary, rows) {
  const failures = [];
  if (summary.addressTopMatch !== summary.addressCases) {
    failures.push(`Expected ${summary.addressCases}/${summary.addressCases} address top matches, got ${summary.addressTopMatch}.`);
  }
  if (summary.poiTopMatch !== summary.poiCases) {
    failures.push(`Expected ${summary.poiCases}/${summary.poiCases} POI top matches, got ${summary.poiTopMatch}.`);
  }
  if (summary.failures) {
    failures.push(`Expected 0 no-match cases, got ${summary.failures}.`);
  }
  if (failures.length) {
    const examples = rows
      .filter((row) => !row.topMatch)
      .slice(0, 8)
      .map((row) => `${row.id}: ${row.query} -> ${row.topLabel || row.result}`);
    throw new Error(`${failures.join(" ")} Examples: ${examples.join(" | ")}`);
  }
}

function renderReport(payload) {
  const rows = payload.rows.map((row) =>
    [
      row.id,
      row.kind,
      row.state,
      row.result,
      row.topProvider,
      row.lookupStatus,
      row.elapsedMs,
      row.query,
      row.topLabel,
    ]
      .map(markdownCell)
      .join(" | "),
  ).join("\n");
  const failures = payload.rows.filter((row) => !row.topMatch);
  const failureRows = failures.length
    ? failures.map((row) => [row.id, row.query, row.result, row.topLabel, row.warning].map(markdownCell).join(" | ")).join("\n")
    : "none | none | none | none | none";

  return `# Fuel Path Hosted Geocode Preview Smoke

Run ID: ${payload.runId}

Target: ${payload.target}

Transport: ${payload.transport}

Performance evidence: ${payload.performanceEvidence}

${payload.performanceEvidence === "invalid_cli_transport_overhead" ? "Elapsed times include Vercel CLI authentication and startup overhead. Do not use this run for latency or performance claims." : "Elapsed times are request-level observations only and are not a load benchmark."}

## Summary

- Cases: ${payload.summary.cases}
- Top matches: ${payload.summary.topMatch}/${payload.summary.cases}
- Address top matches: ${payload.summary.addressTopMatch}/${payload.summary.addressCases}
- POI top matches: ${payload.summary.poiTopMatch}/${payload.summary.poiCases}
- Ranked-but-not-top matches: ${payload.summary.rankedMatch}
- Failures: ${payload.summary.failures}

## Diagnostics

- Likely blockers: ${payload.diagnostics.likelyBlockers.length ? payload.diagnostics.likelyBlockers.join(", ") : "none"}
- Top providers: ${formatCounts(payload.diagnostics.topProviderCounts)}
- Address top providers: ${formatCounts(payload.diagnostics.addressTopProviderCounts)}
- Lookup statuses: ${formatCounts(payload.diagnostics.lookupStatusCounts)}

## Failures Or Ranked Matches

id | query | result | topLabel | warning
--- | --- | --- | --- | ---
${failureRows}

## Cases

id | kind | state | result | topProvider | lookupStatus | elapsedMs | query | topLabel
--- | --- | --- | --- | --- | --- | ---: | --- | ---
${rows}
`;
}

function formatCounts(counts) {
  const entries = Object.entries(counts || {});
  return entries.length ? entries.map(([key, value]) => `${key} ${value}`).join(", ") : "none";
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    parsed[key] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CASES = [
  address("addr-nsw", "NSW", "1 Adelaide Street Balgowlah Heights NSW 2093", "1 Adelaide Street, Balgowlah Heights NSW 2093", "exact"),
  address("addr-act", "ACT", "1 Abercorn Crescent Isabella Plains ACT 2905", "1 Abercorn Crescent, Isabella Plains ACT 2905", "exact"),
  address("addr-vic", "VIC", "1 Abbotswood Drive Hoppers Crossing VIC 3029", "1 Abbotswood Drive, Hoppers Crossing VIC 3029", "exact"),
  address("addr-qld", "QLD", "1 Abel Smith Crescent Mount Ommaney QLD 4074", "1 Abel Smith Crescent, Mount Ommaney QLD 4074", "exact"),
  address("addr-wa", "WA", "1 Abbotsford Street West Leederville WA 6007", "1 Abbotsford Street, West Leederville WA 6007", "exact"),
  address("addr-sa", "SA", "1 Abercrombie Court Clarence Gardens SA 5039", "1 Abercrombie Court, Clarence Gardens SA 5039", "exact"),
  address("addr-tas", "TAS", "1 Baltonsborough Road Austins Ferry TAS 7011", "1 Baltonsborough Road, Austins Ferry TAS 7011", "exact"),
  address("addr-nt", "NT", "1 Palmerston Circuit Palmerston City NT 0830", "1 Palmerston Circuit, Palmerston City NT 0830", "exact"),
  address("addr-wa-unit", "WA", "Unit 8 Fl 5 51 Mill Point Road South Perth WA 6151", "Unit 8, Fl 5, 51 Mill Point Road, South Perth WA 6151", "unit_address"),
  address("addr-act-unit", "ACT", "Unit 9 131 Canberra Avenue Griffith ACT 2603", "Unit 9, 131 Canberra Avenue, Griffith ACT 2603", "unit_address"),
  address("addr-nsw-suffix", "NSW", "87A Corea Street Sylvania NSW 2224", "87A Corea Street, Sylvania NSW 2224", "suffix"),
  address("addr-nt-lot", "NT", "Lot 9138 Stuart Highway Alice Springs NT 0870", "Lot 9138, Stuart Highway, Alice Springs NT 0870", "lot_rural"),
  poi("poi-sydney-airport", "NSW", "Sydney Airport NSW", ["sydney airport", "nsw"], "airport"),
  poi("poi-canberra-airport", "ACT", "Canberra Airport ACT", ["canberra airport", "act"], "airport"),
  poi("poi-cataract-gorge", "TAS", "Cataract Gorge TAS", ["cataract", "tas"], "landmark"),
  poi("poi-rottnest", "WA", "Rottnest Island WA", ["rottnest", "wa"], "island"),
  poi("poi-coober-pedy", "SA", "Coober Pedy SA", ["coober pedy", "sa"], "remote"),
  poi("poi-thursday-island", "QLD", "Thursday Island QLD", ["thursday island", "qld"], "island"),
  poi("poi-uluru", "NT", "Uluru NT", ["uluru", "nt"], "remote_landmark"),
  poi("poi-wilsons-prom", "VIC", "Wilsons Promontory VIC", ["wilsons", "vic"], "remote_landmark"),
];

function address(id, state, query, expectedLabel, category) {
  return { id, kind: "address", category, state, query, expectedLabel };
}

function poi(id, state, query, expectedTerms, category) {
  return { id, kind: "poi", category, state, query, expectedTerms };
}

await main();
