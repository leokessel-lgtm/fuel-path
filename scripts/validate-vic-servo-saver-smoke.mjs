#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { loadStationData } = require("../api/_backend");

const args = parseArgs(process.argv.slice(2));
if (args.env) loadEnvFile(resolve(args.env));

const lat = numberArg("lat", -37.8136);
const lon = numberArg("lon", 144.9631);
const radiusKm = numberArg("radius-km", 8);
const limit = Math.max(1, Math.min(50, numberArg("limit", 5)));
const fuel = String(args.fuel || "U91").trim().toUpperCase();
const outputPath = args.output || "";
const matrix = Boolean(args.matrix);

const DEFAULT_MATRIX_CASES = [
  { id: "melbourne-cbd-u91", label: "Melbourne CBD", lat: -37.8136, lon: 144.9631, radiusKm: 8, fuel: "U91", minPricedStations: 1 },
  { id: "geelong-u91", label: "Geelong", lat: -38.1499, lon: 144.3617, radiusKm: 12, fuel: "U91", minPricedStations: 1 },
  { id: "ballarat-dl", label: "Ballarat", lat: -37.5622, lon: 143.8503, radiusKm: 15, fuel: "DL", minPricedStations: 1 },
  { id: "mildura-u91", label: "Mildura", lat: -34.208, lon: 142.1246, radiusKm: 25, fuel: "U91", minPricedStations: 1 },
  { id: "mallacoota-u91", label: "Mallacoota", lat: -37.5583, lon: 149.7539, radiusKm: 35, fuel: "U91", minPricedStations: 1 },
  { id: "melbourne-cbd-p95", label: "Melbourne CBD P95", lat: -37.8136, lon: 144.9631, radiusKm: 8, fuel: "P95", minPricedStations: 1 },
  { id: "melbourne-cbd-p98", label: "Melbourne CBD P98", lat: -37.8136, lon: 144.9631, radiusKm: 8, fuel: "P98", minPricedStations: 1 },
];

main().catch((error) => {
  console.error(`VIC Servo Saver smoke failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  if (!process.env.VIC_SERVO_SAVER_API_KEY) {
    throw new Error("Missing required environment variable: VIC_SERVO_SAVER_API_KEY");
  }

  if (matrix) {
    await runMatrix();
    return;
  }

  const result = await loadStationData({
    requestedSource: "vic",
    forceRefresh: true,
    points: [{ lat, lon, label: "VIC smoke centre" }],
    radiusKm,
    fuels: [fuel],
  });

  const stations = result.stations || [];
  const priced = stations.filter((station) => Number.isFinite(Number(station.prices?.[fuel])));
  const payload = {
    ok: result.source === "api_vic" && result.capability === "live" && !result.degraded && priced.length > 0,
    checkedAt: new Date().toISOString(),
    source: result.source,
    provider: result.provider,
    capability: result.capability,
    degraded: Boolean(result.degraded),
    cacheMode: result.cacheMode || "",
    warning: result.warning || "",
    centre: { lat, lon, radiusKm },
    fuel,
    stationCount: stations.length,
    pricedStationCount: priced.length,
    providerHealth: result.providerHealth || {},
    sample: priced.slice(0, limit).map((station) => ({
      stationCode: station.stationCode,
      name: station.name,
      brand: station.brand,
      suburb: station.suburb,
      price: station.prices[fuel],
      updatedAt: station.updatedAt,
      source: station.source,
    })),
  };

  if (outputPath) {
    const resolved = resolve(outputPath);
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`);
  }
  console.log(JSON.stringify(payload, null, 2));

  if (!payload.ok) {
    throw new Error(
      `Expected live VIC ${fuel} prices. source=${payload.source}, capability=${payload.capability}, degraded=${payload.degraded}, priced=${payload.pricedStationCount}`,
    );
  }
}

async function runMatrix() {
  const cases = matrixCases();
  const results = [];
  for (const testCase of cases) {
    const result = await loadStationData({
      requestedSource: "vic",
      forceRefresh: true,
      points: [{ lat: testCase.lat, lon: testCase.lon, label: testCase.label }],
      radiusKm: testCase.radiusKm,
      fuels: [testCase.fuel],
    });
    const stations = result.stations || [];
    const priced = stations.filter((station) => Number.isFinite(Number(station.prices?.[testCase.fuel])));
    results.push({
      id: testCase.id,
      label: testCase.label,
      ok:
        result.source === "api_vic" &&
        result.capability === "live" &&
        !result.degraded &&
        priced.length >= testCase.minPricedStations,
      source: result.source,
      provider: result.provider,
      capability: result.capability,
      degraded: Boolean(result.degraded),
      cacheMode: result.cacheMode || "",
      warning: result.warning || "",
      centre: { lat: testCase.lat, lon: testCase.lon, radiusKm: testCase.radiusKm },
      fuel: testCase.fuel,
      stationCount: stations.length,
      pricedStationCount: priced.length,
      minPricedStations: testCase.minPricedStations,
      sample: priced.slice(0, limit).map((station) => ({
        stationCode: station.stationCode,
        name: station.name,
        brand: station.brand,
        suburb: station.suburb,
        price: station.prices[testCase.fuel],
        updatedAt: station.updatedAt,
        source: station.source,
      })),
    });
  }

  const payload = {
    ok: results.every((item) => item.ok),
    checkedAt: new Date().toISOString(),
    caseCount: results.length,
    passed: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };

  if (outputPath) {
    const resolved = resolve(outputPath);
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`);
  }
  console.log(JSON.stringify(payload, null, 2));

  if (!payload.ok) {
    const failed = results.filter((item) => !item.ok).map((item) => `${item.id}:${item.pricedStationCount}`).join(", ");
    throw new Error(`Expected all VIC matrix cases to return live priced stations. Failed: ${failed}`);
  }
}

function matrixCases() {
  if (!args.cases) return DEFAULT_MATRIX_CASES;
  const resolved = resolve(String(args.cases));
  if (!existsSync(resolved)) throw new Error(`Matrix cases file not found: ${args.cases}`);
  const payload = JSON.parse(readFileSync(resolved, "utf8"));
  const cases = Array.isArray(payload) ? payload : payload.cases;
  if (!Array.isArray(cases) || !cases.length) throw new Error("Matrix cases file must contain a non-empty cases array");
  return cases.map((entry, index) => ({
    id: String(entry.id || `case-${index + 1}`),
    label: String(entry.label || entry.id || `VIC matrix case ${index + 1}`),
    lat: Number(entry.lat),
    lon: Number(entry.lon),
    radiusKm: Number(entry.radiusKm || entry["radius-km"] || 15),
    fuel: String(entry.fuel || "U91").trim().toUpperCase(),
    minPricedStations: Math.max(1, Number(entry.minPricedStations || 1)),
  })).filter((entry) =>
    Number.isFinite(entry.lat) &&
    Number.isFinite(entry.lon) &&
    Number.isFinite(entry.radiusKm) &&
    entry.fuel,
  );
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

function numberArg(name, fallback) {
  const value = Number(args[name]);
  return Number.isFinite(value) ? value : fallback;
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
