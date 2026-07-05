const { distanceKm } = require("./_geoMath");

const LOCAL_PROTOTYPE_CHARGERS = [
  {
    id: "LOCAL_EV_SYLVANIA_CORRIDOR",
    name: "Sylvania corridor EV charger",
    operator: "Prototype directory",
    address: "Princes Highway corridor, Sylvania NSW",
    suburb: "Sylvania",
    lat: -34.0118,
    lon: 151.1051,
    connectors: ["CCS2", "CHADEMO", "TYPE2"],
    maxPowerKw: 75,
    powerBand: "dc_fast",
  },
  {
    id: "LOCAL_EV_SYDNEY_INNER_WEST",
    name: "Inner west route EV charger",
    operator: "Prototype directory",
    address: "M4 corridor, Sydney NSW",
    suburb: "Sydney inner west",
    lat: -33.8682,
    lon: 151.0764,
    connectors: ["CCS2", "TYPE2"],
    maxPowerKw: 150,
    powerBand: "dc_fast",
  },
  {
    id: "LOCAL_EV_NORTH_SHORE_CORRIDOR",
    name: "North shore corridor EV charger",
    operator: "Prototype directory",
    address: "Pacific Highway corridor, NSW",
    suburb: "North shore",
    lat: -33.7322,
    lon: 151.0789,
    connectors: ["CCS2", "CHADEMO", "TYPE2"],
    maxPowerKw: 120,
    powerBand: "dc_fast",
  },
  {
    id: "LOCAL_EV_CENTRAL_COAST_SOUTH",
    name: "Central Coast south EV charger",
    operator: "Prototype directory",
    address: "M1 Pacific Motorway corridor, NSW",
    suburb: "Central Coast south",
    lat: -33.4247,
    lon: 151.3002,
    connectors: ["CCS2", "TYPE2"],
    maxPowerKw: 150,
    powerBand: "dc_fast",
  },
  {
    id: "LOCAL_EV_TUGGERAH_CORRIDOR",
    name: "Tuggerah route EV charger",
    operator: "Prototype directory",
    address: "M1 Pacific Motorway corridor, Tuggerah NSW",
    suburb: "Tuggerah",
    lat: -33.3082,
    lon: 151.4205,
    connectors: ["CCS2", "CHADEMO", "TYPE2"],
    maxPowerKw: 350,
    powerBand: "ultra_fast",
  },
  {
    id: "LOCAL_EV_LAKE_MACQUARIE_CORRIDOR",
    name: "Lake Macquarie corridor EV charger",
    operator: "Prototype directory",
    address: "Pacific Motorway corridor, Lake Macquarie NSW",
    suburb: "Lake Macquarie",
    lat: -32.9921,
    lon: 151.6034,
    connectors: ["CCS2", "TYPE2"],
    maxPowerKw: 150,
    powerBand: "dc_fast",
  },
  {
    id: "LOCAL_EV_NEWCASTLE_CORRIDOR",
    name: "Newcastle route EV charger",
    operator: "Prototype directory",
    address: "Newcastle NSW",
    suburb: "Newcastle",
    lat: -32.9283,
    lon: 151.7817,
    connectors: ["CCS2", "CHADEMO", "TYPE2"],
    maxPowerKw: 120,
    powerBand: "dc_fast",
  },
  {
    id: "LOCAL_EV_PERTH_CBD",
    name: "Perth CBD EV charger",
    operator: "Prototype directory",
    address: "Perth CBD WA",
    suburb: "Perth",
    lat: -31.9523,
    lon: 115.8613,
    connectors: ["CCS2", "TYPE2"],
    maxPowerKw: 150,
    powerBand: "dc_fast",
  },
  {
    id: "LOCAL_EV_MANDURAH_CORRIDOR",
    name: "Mandurah route EV charger",
    operator: "Prototype directory",
    address: "Forrest Highway corridor, Mandurah WA",
    suburb: "Mandurah",
    lat: -32.5269,
    lon: 115.7217,
    connectors: ["CCS2", "CHADEMO", "TYPE2"],
    maxPowerKw: 120,
    powerBand: "dc_fast",
  },
  {
    id: "LOCAL_EV_BUNBURY_CORRIDOR",
    name: "Bunbury route EV charger",
    operator: "Prototype directory",
    address: "Bunbury WA",
    suburb: "Bunbury",
    lat: -33.3271,
    lon: 115.6414,
    connectors: ["CCS2", "TYPE2"],
    maxPowerKw: 150,
    powerBand: "dc_fast",
  },
  {
    id: "LOCAL_EV_BUSSELTON_CORRIDOR",
    name: "Busselton route EV charger",
    operator: "Prototype directory",
    address: "Busselton WA",
    suburb: "Busselton",
    lat: -33.6525,
    lon: 115.3455,
    connectors: ["CCS2", "CHADEMO", "TYPE2"],
    maxPowerKw: 75,
    powerBand: "dc_fast",
  },
  {
    id: "LOCAL_EV_MARGARET_RIVER",
    name: "Margaret River EV charger",
    operator: "Prototype directory",
    address: "Margaret River WA",
    suburb: "Margaret River",
    lat: -33.9537,
    lon: 115.0738,
    connectors: ["CCS2", "TYPE2"],
    maxPowerKw: 75,
    powerBand: "dc_fast",
  },
];

function createLocalPrototypeEvDirectoryAdapter() {
  async function loadEvChargers({
    centre,
    radiusKm = 30,
    limit = 80,
    connectors = [],
    minPowerKw = 0,
    powerMode = "",
  } = {}) {
    const lat = Number(centre?.lat);
    const lon = Number(centre?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("centre lat/lon is required");
    const safeRadiusKm = Math.max(1, Math.min(100, Number(radiusKm) || 30));
    const safeLimit = Math.max(1, Math.min(120, Math.round(Number(limit) || 80)));
    const filters = {
      connectors: normaliseConnectors(connectors),
      minPowerKw: Math.max(0, Number(minPowerKw) || 0),
      powerMode: String(powerMode || ""),
    };
    const chargers = LOCAL_PROTOTYPE_CHARGERS
      .map((row) => normaliseLocalPrototypeCharger(row, { lat, lon }))
      .filter((charger) => charger.distanceKm <= safeRadiusKm)
      .filter((charger) => chargerMatchesFilters(charger, filters))
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, safeLimit);

    return {
      context: {
        provider: "local_prototype_directory",
        source: "local_prototype_directory",
        capability: "prototype",
        radiusKm: safeRadiusKm,
        centre: { lat, lon, label: centre?.label || "Route corridor point" },
        filters,
        chargerCount: chargers.length,
        returnedCount: chargers.length,
        generatedAt: new Date().toISOString(),
        cacheHit: false,
        cacheAgeSeconds: 0,
        cacheMode: "local_prototype",
        degraded: true,
        provenance: {
          source: "local_prototype_directory",
          label: "Local prototype EV charger directory",
          licence: "sanitised local development data",
          realTimeAvailability: false,
        },
        warning:
          "Using sanitised local prototype EV charger data because no configured EV directory provider is available. Confirm real charger details in the charging network app before driving.",
      },
      chargers,
    };
  }

  return { loadEvChargers };
}

function normaliseLocalPrototypeCharger(row, centre) {
  const distance = distanceKm(centre, row);
  const connections = row.connectors.map((connector) => ({
    connector,
    connectorLabel: connector,
    powerKw: row.maxPowerKw,
    currentType: connector === "TYPE2" ? "AC" : "DC",
    quantity: 1,
    status: "",
    operational: undefined,
  }));
  return {
    id: row.id,
    name: row.name,
    operator: row.operator,
    address: row.address,
    suburb: row.suburb,
    lat: row.lat,
    lon: row.lon,
    distanceKm: round(distance, 2),
    detourMinutes: round((distance * 2 / 45) * 60, 1),
    connectors: row.connectors,
    connections,
    maxPowerKw: row.maxPowerKw,
    powerBand: row.powerBand,
    availability: "unknown",
    availabilityLabel: "Prototype directory row, live bay status unknown",
    pricing: undefined,
    updatedAt: undefined,
    source: "local_prototype_directory",
    provenance:
      "Sanitised local prototype EV charger directory row. Confirm charger existence, access, power, tariff and live bay status in the charging network app before driving.",
  };
}

function chargerMatchesFilters(charger, filters) {
  if (filters.connectors?.length && !charger.connectors.some((item) => filters.connectors.includes(item))) return false;
  if (filters.minPowerKw && Number(charger.maxPowerKw || 0) < filters.minPowerKw) return false;
  if (filters.powerMode === "dc_fast" && !["dc_fast", "ultra_fast"].includes(charger.powerBand)) return false;
  if (filters.powerMode === "ultra_fast" && charger.powerBand !== "ultra_fast") return false;
  return true;
}

function normaliseConnectors(connectors = []) {
  const values = Array.isArray(connectors) ? connectors : String(connectors || "").split(",");
  return Array.from(new Set(values.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean)));
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

module.exports = {
  createLocalPrototypeEvDirectoryAdapter,
};
