#!/usr/bin/env node

const API_BASE = (process.env.FUEL_PATH_API_BASE || "https://fuel-path.vercel.app").replace(/\/$/, "");
const fuel = process.env.FUEL_PATH_SMOKE_FUEL || "U91";
const radiusKm = Number(process.env.FUEL_PATH_SMOKE_RADIUS_KM || 35);
const limit = Number(process.env.FUEL_PATH_SMOKE_LIMIT || 20);

const cases = [
  c("wa-broome", "Broome WA 6725", -17.9614, 122.2359, "regional_remote"),
  c("wa-karratha", "Karratha WA 6714", -20.7364, 116.8463, "regional_remote"),
  c("wa-kununurra", "Kununurra WA 6743", -15.7781, 128.7417, "regional_remote"),
  c("wa-exmouth", "Exmouth WA 6707", -21.9306, 114.1265, "regional_remote"),
  c("qld-longreach", "Longreach QLD 4730", -23.44, 144.25, "regional_remote"),
  c("qld-mount-isa", "Mount Isa QLD 4825", -20.7256, 139.4927, "regional_remote"),
  c("sa-coober-pedy", "Coober Pedy SA 5723", -29.013, 134.754, "remote_town"),
  c("sa-ceduna", "Ceduna SA 5690", -32.1266, 133.6727, "regional_remote"),
  c("nt-alice-springs", "Alice Springs NT 0870", -23.698, 133.8807, "regional_remote"),
  c("nt-tennant-creek", "Tennant Creek NT 0860", -19.648, 134.191, "remote_town"),
  c("nsw-broken-hill", "Broken Hill NSW 2880", -31.9539, 141.4539, "regional_remote"),
  c("tas-queenstown", "Queenstown TAS 7467", -42.0805, 145.5565, "remote_town"),
];

const results = [];
for (const item of cases) {
  const [stations, chargers] = await Promise.all([
    fetchStations(item),
    fetchChargers(item),
  ]);
  const combinedCount = stations.returned + chargers.returned;
  const chargerMetadata = chargerMetadataSummary(chargers.items);
  results.push({
    id: item.id,
    label: item.label,
    category: item.category,
    status: stations.status === 200 && chargers.status === 200 && combinedCount > 0 ? "pass" : "fail",
    stations: {
      status: stations.status,
      returned: stations.returned,
      warning: stations.warning,
    },
    chargers: {
      status: chargers.status,
      returned: chargers.returned,
      provider: chargers.provider,
      warning: chargers.warning,
      connectorKnown: chargerMetadata.connectorKnown,
      powerKnown: chargerMetadata.powerKnown,
      metadataQuality: chargerMetadata.quality,
    },
    combinedCount,
    topUsefulnessPreview: usefulnessPreview(stations.items, chargers.items),
  });
}

const summary = summarise(results);
console.log(JSON.stringify({ apiBase: API_BASE, fuel, radiusKm, limit, summary, results }, null, 2));

if (summary.failed > 0) {
  throw new Error(`${summary.failed}/${summary.cases} rural/remote combined nearby cases failed`);
}

function c(id, label, lat, lon, category) {
  return { id, label, lat, lon, category };
}

async function fetchStations(item) {
  const params = new URLSearchParams({
    source: "live",
    fuel,
    lat: String(item.lat),
    lon: String(item.lon),
    label: item.label,
    radiusKm: String(radiusKm),
    limit: String(limit),
  });
  const response = await fetch(`${API_BASE}/api/stations?${params}`, { headers: { Accept: "application/json" } });
  const body = await safeJson(response);
  return {
    status: response.status,
    returned: Array.isArray(body.stations) ? body.stations.length : 0,
    warning: body.context?.warning || "",
    items: Array.isArray(body.stations) ? body.stations : [],
  };
}

async function fetchChargers(item) {
  const params = new URLSearchParams({
    provider: "api_ninjas",
    lat: String(item.lat),
    lon: String(item.lon),
    label: item.label,
    radiusKm: String(radiusKm),
    limit: String(limit),
  });
  const response = await fetch(`${API_BASE}/api/ev-chargers?${params}`, { headers: { Accept: "application/json" } });
  const body = await safeJson(response);
  return {
    status: response.status,
    returned: Array.isArray(body.chargers) ? body.chargers.length : 0,
    provider: body.context?.provider || "",
    warning: body.context?.warning || "",
    items: Array.isArray(body.chargers) ? body.chargers : [],
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function chargerMetadataSummary(chargers) {
  if (!chargers.length) return { connectorKnown: 0, powerKnown: 0, quality: "none" };
  const connectorKnown = chargers.filter((charger) => Array.isArray(charger.connectors) && charger.connectors.length > 0).length;
  const powerKnown = chargers.filter((charger) => Number(charger.maxPowerKw || 0) > 0).length;
  const rate = (connectorKnown + powerKnown) / (chargers.length * 2);
  return {
    connectorKnown,
    powerKnown,
    quality: rate >= 0.6 ? "useful" : rate >= 0.25 ? "thin" : "poor",
  };
}

function usefulnessPreview(stations, chargers) {
  const stationRows = stations.slice(0, 3).map((station) => ({
    type: "fuel",
    name: station.name,
    distanceKm: Number(station.distanceKm || 0),
    value: Number(station.prices?.[fuel] || station.pumpCpl || 0),
  }));
  const chargerRows = chargers.slice(0, 3).map((charger) => ({
    type: "charger",
    name: charger.name,
    distanceKm: Number(charger.distanceKm || 0),
    connectors: charger.connectors || [],
    powerKw: charger.maxPowerKw || null,
  }));
  return [...stationRows, ...chargerRows]
    .sort((left, right) => Number(left.distanceKm || 0) - Number(right.distanceKm || 0))
    .slice(0, 4);
}

function summarise(rows) {
  const failedRows = rows.filter((row) => row.status !== "pass");
  const chargerLocations = rows.filter((row) => row.chargers.returned > 0);
  const poorMetadata = rows.filter((row) => row.chargers.returned > 0 && row.chargers.metadataQuality === "poor");
  return {
    cases: rows.length,
    passed: rows.length - failedRows.length,
    failed: failedRows.length,
    chargerLocations: chargerLocations.length,
    noChargerLocations: rows.length - chargerLocations.length,
    poorEvMetadataLocations: poorMetadata.length,
    stationResultTotal: rows.reduce((total, row) => total + row.stations.returned, 0),
    chargerResultTotal: rows.reduce((total, row) => total + row.chargers.returned, 0),
    failures: failedRows.map((row) => row.id),
  };
}
