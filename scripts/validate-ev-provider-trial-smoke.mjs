#!/usr/bin/env node

const PROVIDERS = {
  open_charge_map: {
    label: "Open Charge Map",
    env: "OPEN_CHARGE_MAP_API_KEY",
    header: "X-API-Key",
    url: "https://api.openchargemap.io/v3/poi",
    buildUrl: (location) => {
      const url = new URL("https://api.openchargemap.io/v3/poi");
      url.searchParams.set("latitude", String(location.lat));
      url.searchParams.set("longitude", String(location.lon));
      url.searchParams.set("distance", String(Math.min(location.radiusKm || 25, 100)));
      url.searchParams.set("distanceunit", "KM");
      url.searchParams.set("maxresults", "40");
      return url;
    },
    countRows: (payload) => Array.isArray(payload) ? payload.length : 0,
    firstRow: (payload) => Array.isArray(payload) ? payload[0] : undefined,
  },
  openweb_ninja: {
    label: "OpenWeb Ninja",
    env: "OPENWEB_NINJA_API_KEY",
    header: "x-api-key",
    url: "https://api.openwebninja.com/ev-charge-finder/search-by-location",
    buildUrl: (location) => {
      const url = new URL("https://api.openwebninja.com/ev-charge-finder/search-by-location");
      url.searchParams.set("near", `${location.label}, Australia`);
      return url;
    },
    countRows: (payload) => Array.isArray(payload) ? payload.length : Array.isArray(payload?.data) ? payload.data.length : 0,
    firstRow: (payload) => Array.isArray(payload) ? payload[0] : Array.isArray(payload?.data) ? payload.data[0] : undefined,
  },
  api_ninjas: {
    label: "API Ninjas",
    env: "API_NINJAS_API_KEY",
    header: "X-Api-Key",
    url: "https://api.api-ninjas.com/v1/evcharger",
    buildUrl: (location) => {
      const url = new URL("https://api.api-ninjas.com/v1/evcharger");
      url.searchParams.set("lat", String(location.lat));
      url.searchParams.set("lon", String(location.lon));
      url.searchParams.set("distance", String(Math.min(location.radiusKm || 25, 50)));
      return url;
    },
    countRows: (payload) => Array.isArray(payload) ? payload.length : 0,
    firstRow: (payload) => Array.isArray(payload) ? payload[0] : undefined,
  },
};

const LOCATIONS = [
  { label: "Darwin NT", lat: -12.4634, lon: 130.8456, radiusKm: 25, cohort: "nt_metro" },
  { label: "Palmerston NT", lat: -12.486, lon: 130.9833, radiusKm: 20, cohort: "nt_metro" },
  { label: "Katherine NT", lat: -14.4652, lon: 132.2635, radiusKm: 30, cohort: "nt_regional" },
  { label: "Alice Springs NT", lat: -23.698, lon: 133.8807, radiusKm: 30, cohort: "nt_remote" },
  { label: "Tennant Creek NT", lat: -19.6464, lon: 134.1919, radiusKm: 35, cohort: "nt_remote" },
  { label: "Melbourne VIC", lat: -37.8136, lon: 144.9631, radiusKm: 15, cohort: "metro_benchmark" },
  { label: "Bendigo VIC", lat: -36.757, lon: 144.2794, radiusKm: 20, cohort: "regional_benchmark" },
  { label: "Horsham VIC", lat: -36.7189, lon: 142.1961, radiusKm: 25, cohort: "rural_benchmark" },
];

const providerArg = process.argv.find((item) => item.startsWith("--provider="))?.split("=")[1] || "all";
const providers = providerArg === "all" ? Object.keys(PROVIDERS) : providerArg.split(",").map((item) => item.trim()).filter(Boolean);
const limitArg = Number(process.argv.find((item) => item.startsWith("--limit="))?.split("=")[1] || LOCATIONS.length);
const locations = LOCATIONS.slice(0, Math.max(1, Math.min(LOCATIONS.length, limitArg)));
const proxyBase = (process.env.FUEL_PATH_API_BASE || "https://fuel-path.vercel.app").replace(/\/$/, "");
const proxyMode = process.argv.includes("--proxy") || process.env.FUEL_PATH_EV_PROVIDER_PROXY_SMOKE === "1";

let failures = 0;

for (const providerId of providers) {
  const provider = PROVIDERS[providerId];
  if (!provider) {
    console.error(`Unknown provider: ${providerId}`);
    failures += 1;
    continue;
  }

  const key = process.env[provider.env];
  if (!key && !proxyMode) {
    console.log(`SKIP ${provider.label}: ${provider.env} is not set. Re-run with --proxy to validate through ${proxyBase}/api/ev-chargers using deployed server credentials.`);
    continue;
  }

  console.log(`\n${provider.label} ${proxyMode && !key ? "proxy " : ""}smoke (${locations.length} locations)`);
  const results = [];
  for (const location of locations) {
    const started = Date.now();
    const url = key ? provider.buildUrl(location) : proxyUrl(providerId, location);
    let status = 0;
    let rowCount = 0;
    let sampleFields = [];
    let error = "";
    try {
      const response = await fetch(url, { headers: key ? { Accept: "application/json", [provider.header]: key } : { Accept: "application/json" } });
      status = response.status;
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(payload?.message || payload?.error || response.statusText);
      rowCount = key ? provider.countRows(payload) : Array.isArray(payload?.chargers) ? payload.chargers.length : 0;
      sampleFields = Object.keys((key ? provider.firstRow(payload) : payload?.chargers?.[0]) || {}).slice(0, 12);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      failures += 1;
    }
    results.push({
      provider: providerId,
      location: location.label,
      cohort: location.cohort,
      status,
      rowCount,
      latencyMs: Date.now() - started,
      sampleFields,
      error,
    });
    console.log(`${location.label}: status=${status} rows=${rowCount} latencyMs=${Date.now() - started}${error ? ` error=${error}` : ""}`);
    await delay(1100);
  }

  const covered = results.filter((item) => item.rowCount > 0).length;
  const ntCovered = results.filter((item) => item.location.endsWith("NT") && item.rowCount > 0).length;
  const latencies = results.map((item) => item.latencyMs).sort((a, b) => a - b);
  const p90 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.9) - 1)] : 0;
  console.log(`SUMMARY ${provider.label}: covered=${covered}/${results.length} ntCovered=${ntCovered}/5 p90Ms=${p90}`);
}

if (failures) {
  console.error(`\nFAIL ${failures} provider/location request(s) failed`);
  process.exit(1);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function proxyUrl(providerId, location) {
  const url = new URL(`${proxyBase}/api/ev-chargers`);
  url.searchParams.set("provider", providerId);
  url.searchParams.set("lat", String(location.lat));
  url.searchParams.set("lon", String(location.lon));
  url.searchParams.set("label", location.label);
  url.searchParams.set("radiusKm", String(location.radiusKm || 25));
  url.searchParams.set("limit", "40");
  return url;
}
