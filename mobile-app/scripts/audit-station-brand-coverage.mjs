import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const { loadStationData } = require(path.join(root, "api/_backend.js"));
const strict = process.argv.includes("--strict");
const includeOpenData = process.argv.includes("--include-open-data");
const includeFuelRadar = process.argv.includes("--include-fuelradar");
const apiBase = readArg("--api-base");
const qldOpenDataUrl =
  "https://www.data.qld.gov.au/dataset/0dfad294-f852-45a5-b86f-986773745fe2/resource/b4369776-476e-444a-b8a7-e354e18e48b0/download/fuel-prices-2026-03-changes-only.csv";
const fuelRadarBrandUrl = "https://fuelradar.com.au/brand";

const probes = [
  { name: "Perth WA", source: "wa", point: { lat: -31.9523, lon: 115.8613, label: "Perth" }, radiusKm: 35 },
  { name: "Sydney NSW", source: "nsw", point: { lat: -33.8688, lon: 151.2093, label: "Sydney" }, radiusKm: 35 },
  { name: "Canberra ACT", source: "nsw", point: { lat: -35.2809, lon: 149.13, label: "Canberra" }, radiusKm: 35 },
  { name: "Brisbane QLD", source: "qld", point: { lat: -27.4698, lon: 153.0251, label: "Brisbane" }, radiusKm: 35 },
  { name: "Melbourne VIC", source: "vic", point: { lat: -37.8136, lon: 144.9631, label: "Melbourne" }, radiusKm: 35 },
  { name: "Adelaide SA", source: "sa", point: { lat: -34.9285, lon: 138.6007, label: "Adelaide" }, radiusKm: 35 },
  { name: "Hobart TAS", source: "tas", point: { lat: -42.8821, lon: 147.3272, label: "Hobart" }, radiusKm: 35 },
  { name: "Darwin NT", source: "nt", point: { lat: -12.4634, lon: 130.8456, label: "Darwin" }, radiusKm: 60 },
];

const brandRegistry = parseBrandRegistry(
  fs.readFileSync(path.join(root, "mobile-app/src/data/brandAssets.ts"), "utf8"),
);
const results = [];

for (const probe of probes) {
  try {
    const data = apiBase
      ? await loadStationDataFromApi({ apiBase, probe })
      : await loadStationData({
          requestedSource: probe.source,
          forceRefresh: false,
          points: [probe.point],
          radiusKm: probe.radiusKm,
          fuels: ["U91"],
        });
    const brands = new Map();
    for (const station of data.stations || []) {
      const raw = String(station.brand || "").trim() || "(blank)";
      const current = brands.get(raw) || { count: 0, examples: [], matched: "" };
      current.count += 1;
      current.matched ||= matchBrand(station);
      if (current.examples.length < 3) current.examples.push(station.name || station.address || station.stationCode || "station");
      brands.set(raw, current);
    }
    const unmatched = Array.from(brands.entries())
      .filter(([, value]) => !value.matched)
      .map(([brand, value]) => ({ brand, ...value }))
      .sort((left, right) => right.count - left.count);
    results.push({
      name: probe.name,
      requestedSource: probe.source,
      provider: data.provider,
      source: data.source,
      warning: data.warning || "",
      stationCount: data.stations?.length || 0,
      uniqueBrandCount: brands.size,
      unmatchedCount: unmatched.length,
      unmatched,
    });
  } catch (error) {
    results.push({
      name: probe.name,
      requestedSource: probe.source,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const providerFallbacks = results.filter((result) =>
  result.error ||
  result.provider === "public_demo_snapshot" ||
  result.source === "sample_fallback" ||
  result.source === "live_unavailable" ||
  (strict && !result.stationCount && result.warning),
);
const unmatchedLive = results.filter((result) =>
  !result.error &&
  result.provider !== "public_demo_snapshot" &&
  result.source !== "sample_fallback" &&
  result.unmatchedCount > 0,
);
const openData = includeOpenData ? [await auditCsvBrandColumn({
  brandColumn: "Site Brand",
  name: "QLD open data March 2026",
  url: qldOpenDataUrl,
})] : [];
const unmatchedOpenData = openData.filter((result) => result.unmatchedCount > 0);
const thirdPartyIndexes = includeFuelRadar ? [await auditFuelRadarBrandPage()] : [];
const unmatchedThirdPartyIndexes = thirdPartyIndexes.filter((result) => result.unmatchedCount > 0);
const summary = {
  ok:
    unmatchedLive.length === 0 &&
    unmatchedOpenData.length === 0 &&
    unmatchedThirdPartyIndexes.length === 0 &&
    (!strict || providerFallbacks.length === 0),
  strict,
  includeOpenData,
  includeFuelRadar,
  auditedAt: new Date().toISOString(),
  firstClassBrandCount: brandRegistry.length,
  providerFallbackCount: providerFallbacks.length,
  unmatchedLiveProviderCount: unmatchedLive.length,
  unmatchedOpenDataCount: unmatchedOpenData.length,
  unmatchedThirdPartyIndexCount: unmatchedThirdPartyIndexes.length,
  results,
  openData,
  thirdPartyIndexes,
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exitCode = 1;
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return String(process.argv[index + 1] || "").trim();
  const prefix = `${name}=`;
  const match = process.argv.find((value) => String(value).startsWith(prefix));
  return match ? String(match).slice(prefix.length).trim() : "";
}

async function loadStationDataFromApi({ apiBase, probe }) {
  const url = new URL("/api/stations", apiBase.replace(/\/$/, ""));
  url.searchParams.set("lat", String(probe.point.lat));
  url.searchParams.set("lon", String(probe.point.lon));
  url.searchParams.set("radiusKm", String(probe.radiusKm));
  url.searchParams.set("fuel", "U91");
  url.searchParams.set("source", probe.source);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "FuelPathBrandCoverageAudit/0.1",
    },
  });
  if (!response.ok) throw new Error(`Station request failed ${response.status}: ${url.href}`);
  const payload = await response.json();
  return {
    provider: payload.provider,
    source: payload.source,
    warning: payload.context?.warning || payload.warning || "",
    stations: payload.stations || [],
  };
}

function parseBrandRegistry(source) {
  return Array.from(source.matchAll(/\{\n\s*label: "([^"]+)"[\s\S]*?aliases: \[([\s\S]*?)\][\s\S]*?\n\s*\}/g)).map((match) => ({
    label: match[1],
    aliases: Array.from(match[2].matchAll(/"([^"]+)"/g)).map((item) => item[1]),
  }));
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

function matchBrand(station) {
  const text = normalise(`${station.brand || ""} ${station.name || ""}`);
  const match = brandRegistry.find((brand) =>
    brand.aliases.some((alias) => text.includes(normalise(alias))),
  );
  return match?.label || "";
}

async function auditCsvBrandColumn({ brandColumn, name, url }) {
  const csv = await fetchText(url);
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines.shift() || "").map((value) => value.replace(/^\uFEFF/, ""));
  const brandIndex = header.indexOf(brandColumn);
  if (brandIndex < 0) {
    return { name, url, error: `CSV brand column not found: ${brandColumn}` };
  }
  const brands = new Map();
  for (const line of lines) {
    const row = parseCsvLine(line);
    const brand = String(row[brandIndex] || "").trim() || "(blank)";
    brands.set(brand, (brands.get(brand) || 0) + 1);
  }
  const unmatched = Array.from(brands.entries())
    .filter(([brand]) => !matchBrandText(brand))
    .map(([brand, count]) => ({ brand, count }))
    .sort((left, right) => right.count - left.count);
  return {
    name,
    url,
    rowCount: lines.length,
    uniqueBrandCount: brands.size,
    unmatchedCount: unmatched.length,
    unmatched,
  };
}

function matchBrandText(text) {
  const value = normalise(text);
  const match = brandRegistry.find((brand) =>
    brand.aliases.some((alias) => value.includes(normalise(alias))),
  );
  return match?.label || "";
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "FuelPathBrandCoverageAudit/0.1",
    },
  });
  if (!response.ok) throw new Error(`Open data request failed ${response.status}: ${url}`);
  return response.text();
}

async function auditFuelRadarBrandPage() {
  const html = await fetchText(fuelRadarBrandUrl);
  const observed = new Set();
  for (const match of html.matchAll(/storage\/resources\/logo\/([^"\\?]+?)(?:\.webp)/g)) {
    observed.add(fuelRadarLogoName(match[1]));
  }
  const names = Array.from(observed).filter((name) => !/^tesla$/i.test(name));
  const unmatched = names
    .filter((name) => !matchBrandText(name))
    .sort()
    .map((brand) => ({ brand }));
  return {
    name: "FuelRadar brand-page logo references",
    url: fuelRadarBrandUrl,
    observedBrandCount: names.length,
    unmatchedCount: unmatched.length,
    unmatched,
  };
}

function fuelRadarLogoName(value) {
  return decodeURIComponent(String(value || ""))
    .replace(/_logo$/i, "")
    .replace(/logo$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/7Eleven/i, "7-Eleven")
    .replace(/Metro Fuel/i, "Metro")
    .replace(/OTR/i, "On the Run")
    .replace(/ReddyExpress/i, "Reddy Express")
    .replace(/PearlEnergy/i, "Pearl Energy")
    .replace(/X Convenience/i, "X Convenience")
    .trim();
}
