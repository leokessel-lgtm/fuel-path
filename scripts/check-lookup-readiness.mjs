#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const apiBase = args.apiBase || process.env.FUEL_PATH_API_BASE || "";
const allowNotReady = args.allowNotReady === "1" || process.env.FUEL_PATH_LOOKUP_READINESS_ALLOW_NOT_READY === "1";
const statusPayload = apiBase ? await fetchHostedStatus(apiBase) : await localStatus();
const readiness = statusPayload?.geocoding?.lookupReadiness || null;

if (!readiness) {
  fail({
    ok: false,
    reason: "lookup_readiness_missing",
    message: "/api/status does not expose geocoding.lookupReadiness.",
  });
}

const ok = Boolean(readiness.publicExactAddressClaimsAllowed);
const payload = {
  ok,
  mode: apiBase ? "http" : "module",
  source: apiBase || "local_backend_module",
  status: readiness.status,
  publicExactAddressClaimsAllowed: Boolean(readiness.publicExactAddressClaimsAllowed),
  blockers: readiness.blockers || [],
  nextAction: readiness.nextAction || "",
  addressIndex: readiness.addressIndex,
  exactSmoke: readiness.exactSmoke,
  hostedBenchmark: readiness.hostedBenchmark,
  providerFallback: readiness.providerFallback,
};

console.log(JSON.stringify(payload, null, 2));
if (!ok && !allowNotReady) process.exit(1);

async function fetchHostedStatus(rawBase) {
  const url = new URL("/api/status", rawBase);
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    fail({
      ok: false,
      reason: "status_request_failed",
      status: response.status,
      message: payload?.error || `Status endpoint returned HTTP ${response.status}.`,
    });
  }
  return payload;
}

async function localStatus() {
  const handler = require("../api/status");
  let status = 0;
  let payload = null;
  const req = { method: "GET", headers: {}, query: {} };
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };
  await handler(req, res);
  if (status >= 400) {
    fail({
      ok: false,
      reason: "local_status_failed",
      status,
      message: payload?.error || `Local status handler returned ${status}.`,
    });
  }
  return payload;
}

function fail(payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(1);
}

function loadLocalEnv(file = ".env.local") {
  const envPath = path.resolve(file);
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (process.env[key] !== undefined) continue;
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--api-base") {
      result.apiBase = values[index + 1] || "";
      index += 1;
    } else if (value === "--allow-not-ready") {
      result.allowNotReady = "1";
    }
  }
  return result;
}
