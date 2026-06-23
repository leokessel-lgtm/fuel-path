import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const casesPath = path.join(__dirname, "geocode-benchmark-cases.json");
const outputDir = path.join(__dirname, "output");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const allowExternal = process.env.FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL === "1";

const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));

const credentialEnvKeys = [
  "FUEL_PATH_GOOGLE_MAPS_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "FUEL_PATH_GOOGLE_PLACES_API_KEY",
  "FUEL_PATH_MAPBOX_ACCESS_TOKEN",
  "MAPBOX_ACCESS_TOKEN",
  "FUEL_PATH_HERE_API_KEY",
  "HERE_API_KEY",
  "FUEL_PATH_GEOAPIFY_API_KEY",
  "GEOAPIFY_API_KEY",
  "FUEL_PATH_ADDRESSR_RAPIDAPI_KEY",
  "ADDRESSR_RAPIDAPI_KEY",
];

const controlledEnvKeys = [
  "FUEL_PATH_GEOCODE_PROVIDER",
  "FUEL_PATH_DISABLE_STATION_GEOCODE",
  "FUEL_PATH_WA_FUELWATCH_ENABLED",
  "FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES",
];

function envPresence() {
  return Object.fromEntries(credentialEnvKeys.map((key) => [key, Boolean(process.env[key])]));
}

function hasAnyProviderCredential() {
  return credentialEnvKeys.some((key) => Boolean(process.env[key]));
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const localResults = await runMode({
    mode: "local_only_provider_blocked",
    provider: "nominatim",
    externalPolicy: "blocked",
  });

  const normalResults = allowExternal && hasAnyProviderCredential()
    ? await runMode({
        mode: "normal_fallback_external_allowed",
        provider: process.env.FUEL_PATH_GEOCODE_PROVIDER || "auto",
        externalPolicy: "allowed",
      })
    : [];

  const results = [...localResults, ...normalResults];
  const summary = buildSummary({
    results,
    normalFallbackSkipped: normalResults.length === 0,
  });

  const jsonPath = path.join(outputDir, `geocode-benchmark-${runId}.json`);
  const csvPath = path.join(outputDir, `geocode-benchmark-${runId}.csv`);
  const reportPath = path.join(outputDir, `geocode-benchmark-${runId}.md`);

  fs.writeFileSync(jsonPath, `${JSON.stringify({ runId, summary, results }, null, 2)}\n`);
  fs.writeFileSync(csvPath, toCsv(results));
  fs.writeFileSync(reportPath, toReport(summary, results));

  console.log(`Benchmark complete: ${results.length} rows`);
  console.log(`JSON: ${path.relative(repoRoot, jsonPath)}`);
  console.log(`CSV: ${path.relative(repoRoot, csvPath)}`);
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  if (summary.normalFallbackSkipped) {
    console.log("Normal fallback mode skipped. Set FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL=1 to allow configured external providers.");
  }
}

async function runMode({ mode, provider, externalPolicy }) {
  const originalEnv = snapshotEnv([...controlledEnvKeys, ...credentialEnvKeys]);
  const originalFetch = global.fetch;

  const fetchCalls = [];
  global.fetch = async (input) => {
    const host = safeHost(input);
    fetchCalls.push({ host });

    if (externalPolicy === "blocked") {
      return jsonResponse({ error: { message: "Benchmark blocked external provider call" } }, 503);
    }

    return originalFetch(input);
  };

  process.env.FUEL_PATH_GEOCODE_PROVIDER = provider;
  process.env.FUEL_PATH_DISABLE_STATION_GEOCODE = "1";
  process.env.FUEL_PATH_WA_FUELWATCH_ENABLED = "0";
  process.env.FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES = "1";

  try {
    const { geocode } = await import("../../api/_backend.js");
    const rows = [];

    for (const testCase of cases) {
      const fetchStart = fetchCalls.length;
      const started = performance.now();
      let result;
      let error = "";

      try {
        result = await geocode({
          query: testCase.query,
          limit: 5,
          sessionToken: `benchmark-${mode}-${testCase.id}-${runId}`,
        });
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }

      const latencyMs = Math.round((performance.now() - started) * 10) / 10;
      const externalHosts = fetchCalls.slice(fetchStart).map((call) => call.host).filter(Boolean);
      const uniqueExternalHosts = [...new Set(externalHosts)];
      const suggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];

      rows.push({
        runId,
        mode,
        id: testCase.id,
        category: testCase.category,
        query: testCase.query,
        expected: testCase.expected,
        lookupStatus: result?.lookupStatus || (error ? "error" : ""),
        topResultLabel: result?.location?.label || "",
        topResultProvider: result?.location?.provider || "",
        suggestionProviders: [...new Set(suggestions.map((item) => item.provider).filter(Boolean))].join("|"),
        suggestionCount: suggestions.length,
        externalFetchAttempted: uniqueExternalHosts.length > 0,
        externalHosts: uniqueExternalHosts.join("|"),
        externalFetchCount: externalHosts.length,
        latencyMs,
        warning: result?.warning || "",
        degraded: Boolean(result?.degraded),
        score: "",
        notes: "",
        error,
      });
    }

    return rows;
  } finally {
    restoreEnv(originalEnv);
    global.fetch = originalFetch;
  }
}

function buildSummary({ results, normalFallbackSkipped }) {
  const byMode = {};
  for (const row of results) {
    byMode[row.mode] ||= {
      cases: 0,
      ok: 0,
      localFallback: 0,
      degraded: 0,
      noMatch: 0,
      externalAttempted: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
    };
    const bucket = byMode[row.mode];
    bucket.cases += 1;
    if (row.lookupStatus === "ok") bucket.ok += 1;
    if (row.lookupStatus === "local_fallback") bucket.localFallback += 1;
    if (row.lookupStatus === "degraded") bucket.degraded += 1;
    if (row.lookupStatus === "no_match") bucket.noMatch += 1;
    if (row.externalFetchAttempted) bucket.externalAttempted += 1;
  }

  for (const [mode, bucket] of Object.entries(byMode)) {
    const latencies = results
      .filter((row) => row.mode === mode)
      .map((row) => row.latencyMs)
      .sort((left, right) => left - right);
    bucket.p50LatencyMs = percentile(latencies, 0.5);
    bucket.p95LatencyMs = percentile(latencies, 0.95);
  }

  return {
    generatedAt: new Date().toISOString(),
    caseCount: cases.length,
    modes: Object.keys(byMode),
    byMode,
    normalFallbackSkipped,
    credentialPresence: envPresence(),
    privacyNote: "Benchmark outputs include input queries by design, but external fetch instrumentation records host names only, never full URLs.",
  };
}

function toCsv(rows) {
  const headers = [
    "runId",
    "mode",
    "id",
    "category",
    "query",
    "expected",
    "lookupStatus",
    "topResultLabel",
    "topResultProvider",
    "suggestionProviders",
    "suggestionCount",
    "externalFetchAttempted",
    "externalHosts",
    "externalFetchCount",
    "latencyMs",
    "warning",
    "degraded",
    "score",
    "notes",
    "error",
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n") + "\n";
}

function toReport(summary, results) {
  const lines = [
    "# Fuel Path Geocode Benchmark",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Scope",
    "",
    "- Read-only benchmark of current geocode behaviour.",
    "- Local-only/provider-blocked mode blocks external provider fetches and records host names only.",
    "- Normal fallback mode is skipped unless `FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL=1` is set and provider credentials are present.",
    "- Score and notes columns are intentionally blank for manual review.",
    "",
    "## Summary",
    "",
    "| Mode | Cases | OK | Local fallback | Degraded | No match | External attempted | p50 ms | p95 ms |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];

  for (const [mode, bucket] of Object.entries(summary.byMode)) {
    lines.push([
      mode,
      bucket.cases,
      bucket.ok,
      bucket.localFallback,
      bucket.degraded,
      bucket.noMatch,
      bucket.externalAttempted,
      bucket.p50LatencyMs,
      bucket.p95LatencyMs,
    ].join(" | ").replace(/^/, "| ").replace(/$/g, " |"));
  }

  lines.push(
    "",
    "## Case Results",
    "",
    "| ID | Category | Status | Top provider | Top result | External hosts | Latency ms |",
    "|---|---|---|---|---|---|---:|",
  );

  for (const row of results) {
    lines.push(`| ${escapeMarkdown(row.id)} | ${escapeMarkdown(row.category)} | ${escapeMarkdown(row.lookupStatus)} | ${escapeMarkdown(row.topResultProvider)} | ${escapeMarkdown(row.topResultLabel)} | ${escapeMarkdown(row.externalHosts)} | ${row.latencyMs} |`);
  }

  lines.push(
    "",
    "## Privacy Note",
    "",
    summary.privacyNote,
    "",
  );

  if (summary.normalFallbackSkipped) {
    lines.push(
      "## Skipped Work",
      "",
      "Normal fallback mode was skipped. This avoids accidental paid or third-party API calls. Re-run with `FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL=1` only after confirming provider credentials and cost posture.",
      "",
    );
  }

  return lines.join("\n");
}

function snapshotEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function jsonResponse(payload, status = 503) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Benchmark Blocked",
    async text() {
      return JSON.stringify(payload);
    },
    async json() {
      return payload;
    },
  };
}

function safeHost(input) {
  try {
    return new URL(String(input)).host;
  } catch {
    return "";
  }
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * fraction) - 1));
  return values[index];
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdown(value) {
  return String(value || "").replace(/\|/g, "\\|");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
