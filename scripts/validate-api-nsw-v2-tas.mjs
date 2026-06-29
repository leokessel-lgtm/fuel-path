#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_TOKEN_URL = "https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken";
const DEFAULT_REF_URL = "https://api.onegov.nsw.gov.au/FuelCheckRefData/v2/fuel/lovs";
const DEFAULT_PRICES_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v2/fuel/prices";
const DEFAULT_NEW_PRICES_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v2/fuel/prices/new";
const DEFAULT_NEARBY_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v2/fuel/prices/nearby";
const DEFAULT_NEARBY_BODY = {
  fueltype: "U91",
  brand: [],
  namedlocation: "",
  latitude: "-42.8821",
  longitude: "147.3272",
  radius: "5",
  sortby: "price",
  sortascending: "true",
};
const USER_AGENT = "FuelPathTasV2SchemaValidation/0.1";

const args = parseArgs(process.argv.slice(2));

if (args["dry-run"]) {
  printDryRun();
  process.exit(0);
}

main().catch((error) => {
  console.error(`TAS v2 validation blocked: ${error.message}`);
  process.exit(1);
});

async function main() {
  if (args.env) loadEnvFile(resolve(args.env));

  const apiKey = requiredEnv("NSW_FUEL_API_KEY");
  const apiSecret = requiredEnv("NSW_FUEL_API_SECRET");
  const tokenUrl = valueOrDefault("NSW_FUEL_TOKEN_URL", DEFAULT_TOKEN_URL);
  const probes = [
    {
      name: "reference",
      method: "GET",
      url: valueOrDefault("NSW_FUEL_V2_REF_URL", DEFAULT_REF_URL),
    },
    {
      name: "prices",
      method: "GET",
      url: valueOrDefault("NSW_FUEL_V2_PRICES_URL", DEFAULT_PRICES_URL),
    },
    {
      name: "new-prices",
      method: "GET",
      url: valueOrDefault("NSW_FUEL_V2_NEW_PRICES_URL", DEFAULT_NEW_PRICES_URL),
    },
    {
      name: "nearby-hobart",
      method: "POST",
      url: valueOrDefault("NSW_FUEL_V2_NEARBY_URL", DEFAULT_NEARBY_URL),
      body: nearbyBody(),
    },
  ];

  console.log("Fuel Path TAS API.NSW v2 schema validation");
  console.log(`Token URL: ${tokenUrl}`);
  console.log(`API key: ${redact(apiKey)}`);

  const token = await getToken(apiKey, apiSecret, tokenUrl);
  console.log("OAuth: OK");

  const results = [];
  for (const probe of probes) {
    const payload = await requestJson(probe.url, {
      method: probe.method,
      apiKey,
      token,
      body: probe.body,
    });
    const summary = summarisePayload(payload);
    results.push({
      probe: probe.name,
      method: probe.method,
      url: probe.url,
      summary,
    });
    console.log(
      `${probe.name}: OK, records=${summary.recordCount}, tasHints=${summary.tasHintCount}, topLevel=${summary.topLevelKeys.join(",") || summary.payloadType}`,
    );
    if (args["save-dir"]) savePayload(args["save-dir"], probe.name, payload);
  }

  const tasEvidence = results.reduce((total, item) => total + item.summary.tasHintCount, 0);
  if (!tasEvidence) {
    console.warn("No obvious TAS record hints were detected. Inspect saved samples before implementing a TAS adapter.");
  }

  if (args["save-dir"]) {
    const summaryPath = resolve(args["save-dir"], "summary.json");
    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, `${JSON.stringify(results, null, 2)}\n`);
    console.log(`Saved redacted summary: ${summaryPath}`);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith("--")) continue;
    const [rawKey, inlineValue] = part.slice(2).split("=");
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue || true;
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      parsed[rawKey] = argv[index + 1];
      index += 1;
    } else {
      parsed[rawKey] = true;
    }
  }
  return parsed;
}

function loadEnvFile(path) {
  if (!existsSync(path)) throw new Error(`Env file not found: ${path}`);
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) {
      process.env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function valueOrDefault(envName, fallback) {
  return process.env[envName]?.trim() || fallback;
}

function nearbyBody() {
  if (!args["nearby-body"]) return DEFAULT_NEARBY_BODY;
  return JSON.parse(readFileSync(resolve(args["nearby-body"]), "utf8"));
}

async function getToken(apiKey, apiSecret, tokenUrl) {
  const credential = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const url = new URL(tokenUrl);
  url.searchParams.set("grant_type", "client_credentials");
  const payload = await requestJson(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Basic ${credential}`,
    },
  });
  const token = payload.access_token || payload.accessToken;
  if (!token) throw new Error(`OAuth response did not include an access token. Keys: ${Object.keys(payload).join(",")}`);
  return token;
}

async function requestJson(url, { method = "GET", apiKey = "", token = "", body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": USER_AGENT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(apiKey ? { apikey: apiKey } : {}),
      ...(apiKey
        ? {
            transactionid: `fuel-path-tas-v2-${Date.now()}`,
            requesttimestamp: new Date().toISOString(),
          }
        : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${method} ${url} returned non-JSON HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`${method} ${url} returned HTTP ${response.status}: ${JSON.stringify(redactPayload(payload)).slice(0, 500)}`);
  }
  return payload;
}

function summarisePayload(payload) {
  const records = findRecords(payload);
  const tasHints = records.filter((record) => textOf(record).match(/\bTAS\b|tasmania|hobart|launceston/i));
  return {
    payloadType: Array.isArray(payload) ? "array" : typeof payload,
    topLevelKeys: payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload).sort() : [],
    recordCount: records.length,
    tasHintCount: tasHints.length,
    sampleKeys: records[0] ? Object.keys(records[0]).sort() : [],
    tasSampleNames: [...new Set(tasHints.map(recordName).filter(Boolean))].slice(0, 10),
  };
}

function findRecords(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => (looksLikeRecord(item) ? [item] : findRecords(item)));
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(findRecords);
  }
  return [];
}

function looksLikeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = new Set(Object.keys(value).map((key) => key.toLowerCase()));
  return [
    "address",
    "brand",
    "code",
    "fueltype",
    "latitude",
    "location",
    "longitude",
    "name",
    "price",
    "servicestationname",
    "state",
    "stationcode",
    "stationname",
  ].some((key) => keys.has(key));
}

function textOf(record) {
  return Object.values(record)
    .map((value) => (value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "")))
    .join(" ");
}

function recordName(record) {
  return String(
    record.ServiceStationName ||
      record.stationName ||
      record.stationname ||
      record.name ||
      record.Name ||
      record.code ||
      record.stationCode ||
      "",
  ).trim();
}

function savePayload(directory, name, payload) {
  const path = resolve(directory, `${name}.redacted.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(redactPayload(payload), null, 2)}\n`);
  console.log(`Saved ${name} sample: ${path}`);
}

function redactPayload(value) {
  if (Array.isArray(value)) return value.slice(0, 50).map(redactPayload);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (["access_token", "accesstoken", "token", "apikey", "api_key", "secret"].includes(key.toLowerCase())) {
        return [key, "<redacted>"];
      }
      return [key, redactPayload(child)];
    }),
  );
}

function redact(value) {
  return value ? `<set, ${value.length} chars>` : "<missing>";
}

function printDryRun() {
  console.log("Fuel Path TAS API.NSW v2 schema validation dry run");
  console.log(`Token: ${DEFAULT_TOKEN_URL}`);
  console.log(`Reference: GET ${DEFAULT_REF_URL}`);
  console.log(`Prices: GET ${DEFAULT_PRICES_URL}`);
  console.log(`New prices: GET ${DEFAULT_NEW_PRICES_URL}`);
  console.log(`Nearby: POST ${DEFAULT_NEARBY_URL}`);
  console.log(`Nearby body: ${JSON.stringify(DEFAULT_NEARBY_BODY)}`);
  console.log("Set NSW_FUEL_API_KEY and NSW_FUEL_API_SECRET, or pass --env prototype/.env, before live validation.");
}
