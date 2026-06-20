#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const hostedCheckPath = args.hostedCheck || process.env.FUEL_PATH_GNAF_HOSTED_CHECK_JSON || "";
const benchmarkPath = args.benchmark || process.env.FUEL_PATH_GNAF_BENCHMARK_JSON || "";
const outputPath = args.out || "";
const format = args.format || "env";

if (!hostedCheckPath || !benchmarkPath) {
  fail({
    ok: false,
    reason: "missing_input",
    message: "Use --hosted-check <json> and --benchmark <json>.",
  });
}

if (!["env", "json"].includes(format)) {
  fail({
    ok: false,
    reason: "invalid_format",
    message: "Use --format env or --format json.",
    format,
  });
}

const hostedCheck = readJsonFile(hostedCheckPath, "hosted_check");
const benchmark = readJsonFile(benchmarkPath, "benchmark");
const evidence = buildEvidence(hostedCheck, benchmark);

if (format === "json") {
  const text = `${JSON.stringify(evidence, null, 2)}\n`;
  await writeOrPrint(text, outputPath);
} else {
  const text = `${toEnv(evidence.env)}\n`;
  await writeOrPrint(text, outputPath);
}

if (!evidence.ok) process.exit(1);

function buildEvidence(hosted, benchmarkPayload) {
  const addressRows = addressRowCount(hosted);
  const exactSmokePassed = Boolean(hosted?.api?.exactSmokePassed);
  const authReady =
    hosted?.api?.authRejectsMissingToken === true &&
    hosted?.api?.authRejectsWrongToken === true;
  const hostedReady = hosted?.ok === true && addressRows > 0 && exactSmokePassed && authReady;
  const summary = benchmarkPayload?.summary || {};
  const address = summary.byKind?.address || {};
  const poi = summary.byKind?.poi || {};
  const benchmarkCases = Number(summary.overall?.cases || 0);
  const addressTopRate = optionalNumber(address.finalTopRate);
  const poiTopRate = optionalNumber(poi.finalTopRate);
  const addressP90Chars = optionalNumber(address.p90AnyChars);
  const poiP90Chars = optionalNumber(poi.p90AnyChars);
  const benchmarkAt = benchmarkRunDate(benchmarkPayload);
  const benchmarkFutureDated = isFutureDate(benchmarkAt);
  const benchmarkReady =
    Boolean(benchmarkAt) &&
    !benchmarkFutureDated &&
    benchmarkCases >= 900 &&
    addressTopRate !== null &&
    addressTopRate >= 1 &&
    poiTopRate !== null &&
    poiTopRate >= 0.98 &&
    addressP90Chars !== null &&
    addressP90Chars <= 42 &&
    poiP90Chars !== null &&
    poiP90Chars <= 12;
  const blockers = [];
  if (!hosted?.ok) blockers.push("hosted_check_not_ok");
  if (!addressRows) blockers.push("address_row_count_missing");
  if (!exactSmokePassed) blockers.push("exact_smoke_not_passed");
  if (!authReady) blockers.push("api_auth_rejection_not_proven");
  if (!benchmarkAt) blockers.push("benchmark_run_timestamp_missing");
  if (benchmarkFutureDated) blockers.push("benchmark_run_timestamp_future_dated");
  if (!benchmarkReady) blockers.push("hosted_benchmark_thresholds_not_met");

  const env = {
    FUEL_PATH_GNAF_ADDRESS_ROWS: String(addressRows || ""),
    FUEL_PATH_GNAF_EXACT_SMOKE_STATUS: exactSmokePassed && authReady ? "passed" : "failed",
    FUEL_PATH_GNAF_BENCHMARK_STATUS: benchmarkReady ? "passed" : "failed",
    FUEL_PATH_GNAF_BENCHMARK_AT: benchmarkAt,
    FUEL_PATH_GNAF_BENCHMARK_CASES: String(benchmarkCases || ""),
    FUEL_PATH_GNAF_BENCHMARK_ADDRESS_TOP_RATE: stringNumber(addressTopRate),
    FUEL_PATH_GNAF_BENCHMARK_POI_TOP_RATE: stringNumber(poiTopRate),
    FUEL_PATH_GNAF_BENCHMARK_ADDRESS_P90_CHARS: stringNumber(addressP90Chars),
    FUEL_PATH_GNAF_BENCHMARK_POI_P90_CHARS: stringNumber(poiP90Chars),
  };

  return {
    ok: blockers.length === 0,
    blockers,
    env,
    source: {
      hostedCheckPath: path.resolve(hostedCheckPath),
      benchmarkPath: path.resolve(benchmarkPath),
      hostedCheckMode: hosted?.mode || "",
      benchmarkRunId: benchmarkPayload?.runId || "",
      benchmarkFutureDated,
    },
    metrics: {
      addressRows,
      exactSmokePassed,
      authReady,
      benchmarkCases,
      addressTopRate,
      poiTopRate,
      addressP90Chars,
      poiP90Chars,
    },
  };
}

function addressRowCount(payload) {
  return Number(
    payload?.api?.healthRows ||
      payload?.database?.addressRows ||
      payload?.api?.addressRows ||
      0,
  );
}

function benchmarkRunDate(payload) {
  const runId = String(payload?.runId || "");
  const parsedRunId = new Date(runId.replace(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    "$1T$2:$3:$4.$5Z",
  ));
  if (!Number.isNaN(parsedRunId.getTime())) return parsedRunId.toISOString();
  return "";
}

function isFutureDate(value) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() + 60 * 1000;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringNumber(value) {
  return value === null || value === undefined ? "" : String(value);
}

function readJsonFile(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail({
      ok: false,
      reason: `invalid_${label}`,
      message: error?.message || String(error),
      path: file,
    });
  }
}

function toEnv(env) {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${envValue(value)}`)
    .join("\n");
}

function envValue(value) {
  const text = String(value ?? "");
  return /^[A-Za-z0-9_.:-]*$/.test(text) ? text : JSON.stringify(text);
}

async function writeOrPrint(text, targetPath) {
  if (!targetPath) {
    process.stdout.write(text);
    return;
  }
  await fsp.mkdir(path.dirname(path.resolve(targetPath)), { recursive: true });
  await fsp.writeFile(targetPath, text);
  process.stdout.write(JSON.stringify({ ok: true, out: targetPath }, null, 2));
  process.stdout.write("\n");
}

function fail(payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(1);
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--hosted-check") {
      result.hostedCheck = values[index + 1] || "";
      index += 1;
    } else if (value === "--benchmark") {
      result.benchmark = values[index + 1] || "";
      index += 1;
    } else if (value === "--format") {
      result.format = values[index + 1] || "";
      index += 1;
    } else if (value === "--out") {
      result.out = values[index + 1] || "";
      index += 1;
    }
  }
  return result;
}
