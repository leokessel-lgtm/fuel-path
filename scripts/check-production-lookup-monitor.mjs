#!/usr/bin/env node
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const API_BASE = args.apiBase || process.env.FUEL_PATH_API_BASE || "https://fuel-path.vercel.app";
const RUN_ID = args.runId || process.env.FUEL_PATH_LOOKUP_MONITOR_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = args.outDir || process.env.FUEL_PATH_LOOKUP_MONITOR_OUT_DIR || "tmp";
const CHECK_FOCUSED = args.skipFocused ? false : true;
const GNAF_API_ATTEMPTS = Number(args.gnafApiAttempts || process.env.FUEL_PATH_LOOKUP_MONITOR_GNAF_ATTEMPTS || 3);
const GNAF_API_RETRY_BASE_MS = Number(args.gnafRetryBaseMs || process.env.FUEL_PATH_LOOKUP_MONITOR_GNAF_RETRY_BASE_MS || 1500);

const checks = [];
const status = await checkStatus();
checks.push(status);
if (status.details?.gnafApiUrl) checks.push(await checkGnafApiWithRetries(status.details.gnafApiUrl));
if (CHECK_FOCUSED) checks.push(await checkFocusedRegression());

const failures = checks.filter((check) => !check.ok);
const payload = {
  runId: RUN_ID,
  generatedAt: new Date().toISOString(),
  apiBase: API_BASE,
  ok: failures.length === 0,
  failures: failures.map((check) => check.id),
  checks,
};

await fsp.mkdir(path.join(ROOT, OUT_DIR), { recursive: true });
const jsonPath = path.join(OUT_DIR, `production-lookup-monitor-${RUN_ID}.json`);
await fsp.writeFile(path.join(ROOT, jsonPath), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ ok: payload.ok, runId: RUN_ID, jsonPath, failures: payload.failures }, null, 2));
if (!payload.ok) process.exit(1);

async function checkStatus() {
  try {
    const url = new URL("/api/status", API_BASE);
    const response = await fetch(url);
    const payload = await response.json();
    const readiness = payload?.geocoding?.lookupReadiness || {};
    const addressIndex = readiness.addressIndex || {};
    const benchmark = readiness.hostedBenchmark || {};
    const ok = response.ok && readiness.publicExactAddressClaimsAllowed === true && readiness.status === "ready";
    return {
      id: "status_lookup_readiness",
      ok,
      status: response.status,
      details: {
        readinessStatus: readiness.status || "unknown",
        blockers: readiness.blockers || [],
        gnafApiUrl: payload?.geocoding?.addressIndex?.source || addressIndex.source || "",
        addressRows: addressIndex.reportedAddressRows ?? null,
        benchmarkStatus: benchmark.status || "unknown",
        benchmarkCases: benchmark.cases ?? null,
        addressTopRate: benchmark.addressTopRate ?? null,
        poiTopRate: benchmark.poiTopRate ?? null,
      },
    };
  } catch (error) {
    return { id: "status_lookup_readiness", ok: false, error: error?.message || String(error) };
  }
}

async function checkGnafApi(rawUrl) {
  try {
    const base = new URL(rawUrl);
    const healthResponse = await fetch(new URL("/health", base));
    const health = await healthResponse.json();
    const searchResponse = await fetch(new URL("/search?q=1%20Adelaide%20Street%20Balgowlah%20Heights%20NSW%202093&limit=1", base));
    const wrongTokenResponse = await fetch(new URL("/search?q=1%20Adelaide%20Street%20Balgowlah%20Heights%20NSW%202093&limit=1", base), { headers: { Authorization: "Bearer wrong-token" } });
    return {
      id: "oracle_gnaf_api_health_and_auth",
      ok: healthResponse.ok && health.indexReady === true && Number(health.addressRows || 0) >= 10_000_000 && [401, 403].includes(searchResponse.status) && [401, 403].includes(wrongTokenResponse.status),
      details: {
        healthStatus: healthResponse.status,
        addressRows: Number(health.addressRows || 0),
        indexReady: health.indexReady === true,
        missingTokenStatus: searchResponse.status,
        wrongTokenStatus: wrongTokenResponse.status,
      },
    };
  } catch (error) {
    return { id: "oracle_gnaf_api_health_and_auth", ok: false, error: error?.message || String(error) };
  }
}

async function checkGnafApiWithRetries(rawUrl) {
  const attempts = [];
  const maxAttempts = Math.max(1, GNAF_API_ATTEMPTS);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await checkGnafApi(rawUrl);
    attempts.push({
      attempt,
      ok: result.ok,
      status: result.status ?? null,
      details: result.details || null,
      error: result.error || "",
    });
    if (result.ok) {
      return {
        ...result,
        details: {
          ...(result.details || {}),
          attempts,
          unstable: attempt > 1,
        },
      };
    }
    if (attempt < maxAttempts) await sleep(GNAF_API_RETRY_BASE_MS * attempt);
  }
  const last = attempts.at(-1) || {};
  return {
    id: "oracle_gnaf_api_health_and_auth",
    ok: false,
    error: last.error || "Oracle G-NAF API health/auth probe failed after retries",
    details: {
      attempts,
      unstable: true,
      finalDetails: last.details || null,
    },
  };
}

async function checkFocusedRegression() {
  try {
    const { spawn } = await import("node:child_process");
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, ["scripts/geocode-focused-regression.mjs", "--api-base", API_BASE, "--run-id", `${RUN_ID}-focused`], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
    return {
      id: "focused_lookup_regressions",
      ok: result.code === 0,
      details: { exitCode: result.code, output: safeLastJson(result.stdout), stderr: result.stderr.trim() },
    };
  } catch (error) {
    return { id: "focused_lookup_regressions", ok: false, error: error?.message || String(error) };
  }
}

function safeLastJson(value) {
  const lines = String(value || "").trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(lines[index]); } catch {}
  }
  return String(value || "").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
