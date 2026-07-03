const { distanceKm } = require("./_geoMath");
const {
  providerCooldownError,
  providerCooldownWarning,
  providerResult,
  providerTimeoutMs,
  recordProviderFailure,
  recordProviderSuccess,
  singleFlight,
  staleProviderResult,
  staleRevalidatingProviderResult,
  withProviderRetries,
} = require("./_providerRuntime");

const DEFAULT_CACHE_SECONDS = 300;
const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";
const DEFAULT_BASE_URL = "https://myfuelnt.nt.gov.au";
const DEFAULT_TOKEN_PATH = "/api/token";
const DEFAULT_REFERENCE_PATH = "/api/v1/getReferenceData";
const DEFAULT_POSTCODE_PATH = "/api/v1/getFuelPrice/postCode";
const DEFAULT_OUTLET_PATH = "/api/v1/getFuelPrice/fuelOutletIdentifier";
const NT_DEFAULT_POINTS = [
  { lat: -12.4634, lon: 130.8456 },
  { lat: -12.486, lon: 130.9833 },
  { lat: -14.4652, lon: 132.2635 },
  { lat: -19.648, lon: 134.191 },
  { lat: -23.698, lon: 133.8807 },
  { lat: -25.242, lon: 130.9849 },
  { lat: -12.1884, lon: 136.782 },
];

const FUEL_ALIASES = new Map([
  ["UNLEADED", "U91"],
  ["UNLEADED 91", "U91"],
  ["ULP", "U91"],
  ["U91", "U91"],
  ["E10", "E10"],
  ["ETHANOL 10", "E10"],
  ["UNLEADED 95", "P95"],
  ["P95", "P95"],
  ["PREMIUM 95", "P95"],
  ["UNLEADED 98", "P98"],
  ["P98", "P98"],
  ["PREMIUM 98", "P98"],
  ["DIESEL", "DL"],
  ["DSL", "DL"],
  ["DL", "DL"],
  ["PREMIUM DIESEL", "PDL"],
  ["PDL", "PDL"],
  ["LPG", "LPG"],
  ["E85", "E85"],
]);

function createMyFuelNtProvider({ decorateStation = (station) => station } = {}) {
  const tokenCache = {
    value: "",
    expiresAtMs: 0,
  };
  const referenceCache = {
    stations: [],
    loadedAtMs: 0,
    lastError: "",
  };
  const snapshotCache = {
    stations: null,
    loadedAtMs: 0,
    lastError: "",
  };
  const postcodeCaches = new Map();

  async function getAccessToken() {
    if (tokenCache.value && Date.now() < tokenCache.expiresAtMs) return tokenCache.value;
    if (!hasNtCredentials()) throw new Error("MyFuel NT credentials are not configured");

    const payload = await fetchJson(ntUrl("NT_MYFUEL_TOKEN_URL", DEFAULT_TOKEN_PATH), {
      data: new URLSearchParams({
        grant_type: "password",
        username: process.env.NT_MYFUEL_USERNAME,
        password: process.env.NT_MYFUEL_PASSWORD,
      }).toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeoutMs: providerTimeoutMs("nt_token", 30000),
    });
    const accessToken = payload?.access_token || payload?.accessToken || payload?.token;
    if (!accessToken) throw new Error("MyFuel NT token response did not include an access token");
    const tokenType = normaliseTokenType(payload?.token_type || payload?.tokenType || payload?.Token_type || "Bearer");
    const expiresIn = Math.max(60, Number(payload?.expires_in || payload?.expiresIn || 3600));
    tokenCache.value = `${tokenType} ${accessToken}`;
    tokenCache.expiresAtMs = Date.now() + expiresIn * 1000;
    return tokenCache.value;
  }

  async function loadReferenceData({ forceRefresh = false } = {}) {
    const ageMs = Date.now() - referenceCache.loadedAtMs;
    if (!forceRefresh && referenceCache.stations.length && ageMs < cacheSeconds() * 1000) {
      return referenceCache.stations;
    }
    const token = await getAccessToken();
    const payload = await fetchJson(ntUrl("NT_MYFUEL_REFERENCE_URL", DEFAULT_REFERENCE_PATH), {
      headers: { Authorization: token },
      timeoutMs: providerTimeoutMs("nt", 60000),
    });
    referenceCache.stations = normaliseNtReferencePayload(payload);
    referenceCache.loadedAtMs = Date.now();
    referenceCache.lastError = "";
    return referenceCache.stations;
  }

  async function loadPostcode(postcode, { forceRefresh = false } = {}) {
    const key = normalisePostcode(postcode);
    if (!key) return [];
    const cached = postcodeCaches.get(key);
    const ageMs = Date.now() - Number(cached?.loadedAtMs || 0);
    if (!forceRefresh && cached?.stations && ageMs < cacheSeconds() * 1000) return cached.stations;

    const token = await getAccessToken();
    const payload = await fetchJson(ntUrl("NT_MYFUEL_POSTCODE_URL", DEFAULT_POSTCODE_PATH), {
      data: { postCode: key },
      headers: { Authorization: token },
      timeoutMs: providerTimeoutMs("nt", 60000),
    });
    const stations = normaliseNtPayload(payload, { requireCoordinates: false });
    postcodeCaches.set(key, { stations, loadedAtMs: Date.now() });
    return stations;
  }

  async function loadOutlet(identifier) {
    const ids = (Array.isArray(identifier) ? identifier : [identifier]).map((value) => String(value || "").trim()).filter(Boolean).slice(0, 10);
    if (!ids.length) return [];
    const token = await getAccessToken();
    const payload = await fetchJson(ntUrl("NT_MYFUEL_OUTLET_URL", DEFAULT_OUTLET_PATH), {
      data: { FuelOutletIdentifier: ids },
      headers: { Authorization: token },
      timeoutMs: providerTimeoutMs("nt", 60000),
    });
    return normaliseNtPayload(payload, { requireCoordinates: false });
  }

  async function loadPricedTerritorySnapshot({ forceRefresh = false } = {}) {
    const referenceStations = await loadReferenceData({ forceRefresh });
    const byCode = new Map(referenceStations.map((station) => [station.stationCode, { ...station, prices: { ...(station.prices || {}) } }]));
    const postcodes = [...new Set(referenceStations.map((station) => station.postcode).filter(Boolean))];
    const postcodeResults = await mapWithConcurrency(postcodes, ntPostcodeConcurrency(), (postcode) => loadPostcode(postcode, { forceRefresh }));

    for (const stations of postcodeResults) {
      for (const station of stations || []) mergeStation(byCode, station, new Set());
    }

    const stationsMissingPrices = [...byCode.values()].filter((station) => !Object.keys(station.prices || {}).length);
    const outletBatches = [];
    for (let index = 0; index < stationsMissingPrices.length; index += 10) {
      outletBatches.push(stationsMissingPrices.slice(index, index + 10).map((station) => station.rawIdentifier || station.stationCode.replace(/^NT-/, "")));
    }
    const outletResults = await mapWithConcurrency(outletBatches, ntOutletConcurrency(), (identifiers) => loadOutlet(identifiers));
    for (const stations of outletResults) {
      for (const station of stations || []) mergeStation(byCode, station, new Set());
    }

    return [...byCode.values()]
      .filter((station) => validCoordinates(station))
      .filter((station) => Object.keys(station.prices || {}).length)
      .sort((left, right) => String(left.stationCode).localeCompare(String(right.stationCode)));
  }

  async function loadLiveNtStations({ forceRefresh = false, points = [], radiusKm = 0, fuels = [] } = {}) {
    if (!hasNtCredentials()) throw new Error("MyFuel NT credentials are not configured");
    const requestedFuels = fuelFilter(fuels);
    const ageMs = Date.now() - snapshotCache.loadedAtMs;
    const ttlMs = cacheSeconds() * 1000;
    const flightKey = "provider:nt:snapshot";
    const refresh = () =>
      withProviderRetries("nt", async () => {
        const stations = await loadPricedTerritorySnapshot({ forceRefresh });
        snapshotCache.stations = stations;
        snapshotCache.loadedAtMs = Date.now();
        snapshotCache.lastError = "";
        return providerResult("nt", {
          stations: filterNtSnapshot(stations, { points, radiusKm, requestedFuels, decorateStation }),
          cacheHit: false,
          cacheAgeSeconds: 0,
          cacheMode: "refreshed",
          error: "",
        });
      });

    if (!forceRefresh && snapshotCache.stations && ageMs < ttlMs) {
      return providerResult("nt", {
        stations: filterNtSnapshot(snapshotCache.stations, { points, radiusKm, requestedFuels, decorateStation }),
        cacheHit: true,
        cacheAgeSeconds: Math.round(ageMs / 1000),
        cacheMode: "fresh",
        error: "",
      });
    }
    if (!forceRefresh && snapshotCache.stations?.length) {
      refreshProviderCacheInBackground("nt", flightKey, refresh, snapshotCache);
      return staleRevalidatingProviderResult("nt", filteredSnapshotCache(snapshotCache, { points, radiusKm, requestedFuels, decorateStation }));
    }

    const cooldownError = providerCooldownError("nt");
    if (cooldownError) {
      if (snapshotCache.stations?.length) {
        return staleProviderResult("nt", filteredSnapshotCache(snapshotCache, { points, radiusKm, requestedFuels, decorateStation }), cooldownError, {
          warning: providerCooldownWarning("nt"),
        });
      }
      throw cooldownError;
    }

    try {
      return await singleFlight(flightKey, refresh, providerFlightHooks("nt", snapshotCache));
    } catch (error) {
      snapshotCache.lastError = error instanceof Error ? error.message : String(error);
      if (snapshotCache.stations?.length) {
        return staleProviderResult("nt", filteredSnapshotCache(snapshotCache, { points, radiusKm, requestedFuels, decorateStation }), error);
      }
      throw error;
    }
  }

  return {
    loadLiveNtStations,
    normaliseNtPayload,
    normaliseNtReferencePayload,
  };
}

function normaliseTokenType(value) {
  const text = String(value || "").trim();
  if (!text) return "Bearer";
  return /^bearer\b/i.test(text) ? "Bearer" : text;
}

function hasNtCredentials() {
  return Boolean(process.env.NT_MYFUEL_USERNAME && process.env.NT_MYFUEL_PASSWORD);
}

function normaliseNtPayload(payload, { requireCoordinates = true } = {}) {
  const stations = new Map();
  for (const row of extractRows(payload)) {
    const station = stationFromRow(row);
    if (!station.stationCode) continue;
    mergePrices(station, row);
    const existing = stations.get(station.stationCode);
    stations.set(station.stationCode, existing ? combineStations(existing, station) : station);
  }
  return [...stations.values()].filter((station) => (!requireCoordinates || validCoordinates(station)) && Object.keys(station.prices || {}).length);
}

function normaliseNtReferencePayload(payload) {
  const rows = extractRows(payload);
  return rows
    .map((row) => {
      const station = stationFromRow(row);
      mergePrices(station, row);
      return station;
    })
    .filter((station) => station.stationCode && validCoordinates(station));
}

function stationFromRow(row) {
  const identifier = stringValue(row, [
    "FuelOutletIdentifier",
    "fuelOutletIdentifier",
    "FuelOutletId",
    "fuelOutletId",
    "OutletIdentifier",
    "outletIdentifier",
    "OutletId",
    "outletId",
    "SiteId",
    "siteId",
    "StationId",
    "stationId",
    "Id",
    "id",
    "Code",
    "code",
  ]);
  const stationCode = identifier ? `NT-${identifier}` : "";
  const address = stringValue(row, ["Address", "address", "AddressLine", "addressLine", "AddressLine1", "addressLine1", "FullAddress", "fullAddress", "FormattedAddress", "formattedAddress"]);
  const location = row?.Location || row?.location || {};
  return {
    rawIdentifier: identifier,
    stationCode,
    name: stringValue(row, ["FuelOutletName", "fuelOutletName", "OutletName", "outletName", "StationName", "stationName", "Name", "name", "TradingName", "tradingName"]) || stationCode,
    brand: stringValue(row, ["BrandName", "brandName", "Brand", "brand", "BrandIdentifier", "brandIdentifier", "CompanyName", "companyName", "Retailer", "retailer", "Operator", "operator"]) || "Unknown",
    suburb: stringValue(row, ["Suburb", "suburb", "Locality", "locality", "Town", "town", "City", "city"]) || suburbFromAddress(address),
    address,
    postcode: normalisePostcode(stringValue(row, ["PostCode", "postCode", "Postcode", "postcode", "PostalCode", "postalCode"])),
    phone: stringValue(row, ["Phone", "phone", "Telephone", "telephone", "ContactNumber", "contactNumber", "PhoneNumber", "phoneNumber"]) || undefined,
    lat: numberValue(row, ["Latitude", "latitude", "Lat", "lat", "Y", "y"]) || numberValue(location, ["Latitude", "latitude", "Lat", "lat", "Y", "y"]),
    lon: numberValue(row, ["Longitude", "longitude", "Lon", "lon", "Lng", "lng", "Long", "long", "X", "x"]) || numberValue(location, ["Longitude", "longitude", "Lon", "lon", "Lng", "lng", "Long", "long", "X", "x"]),
    openNow: booleanValue(row, ["OpenNow", "openNow", "IsOpen", "isOpen", "Open", "open", "CurrentlyOpen", "currentlyOpen"]),
    membershipRequired: false,
    updatedAt: dateValue(row, ["LastUpdated", "lastUpdated", "lastupdated", "UpdatedAt", "updatedAt", "updated_at", "LastModified", "lastModified"]),
    source: "api_nt_myfuel",
    prices: {},
    discounts: [],
  };
}

function mergeStation(stations, incoming, requestedFuels) {
  const station = { ...incoming, prices: {} };
  if (!validCoordinates(station)) {
    delete station.lat;
    delete station.lon;
  }
  for (const [fuel, price] of Object.entries(incoming.prices || {})) {
    if (!requestedFuels.size || requestedFuels.has(fuel)) station.prices[fuel] = price;
  }
  const existing = stations.get(station.stationCode);
  stations.set(station.stationCode, existing ? combineStations(existing, station) : station);
}

function combineStations(existing, incoming) {
  return {
    ...existing,
    ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== undefined && value !== "" && value !== null)),
    stationCode: existing.stationCode || incoming.stationCode,
    rawIdentifier: existing.rawIdentifier || incoming.rawIdentifier,
    prices: { ...(existing.prices || {}), ...(incoming.prices || {}) },
    discounts: existing.discounts || incoming.discounts || [],
    updatedAt: latestDate(existing.updatedAt, incoming.updatedAt),
  };
}

function mergePrices(station, row) {
  for (const priceRow of priceRows(row)) {
    if (booleanValue(priceRow, ["Available", "available", "IsAvailable", "isAvailable"]) === false) continue;
    const fuel = normaliseFuelCode(stringValue(priceRow, ["FuelType", "fuelType", "fueltype", "FuelCode", "fuelCode", "Product", "product", "ProductCode", "productCode", "Name", "name", "Code", "code"]));
    const price = priceValue(priceRow.Price ?? priceRow.price ?? priceRow.FuelPrice ?? priceRow.fuelPrice ?? priceRow.Amount ?? priceRow.amount ?? priceRow.Value ?? priceRow.value);
    if (!fuel || !Number.isFinite(price)) continue;
    station.prices[fuel] = price;
    station.updatedAt = latestDate(station.updatedAt, dateValue(priceRow, ["LastUpdated", "lastUpdated", "lastupdated", "UpdatedAt", "updatedAt", "EffectiveDate", "effectiveDate"]));
  }

  const directFuel = normaliseFuelCode(stringValue(row, ["FuelType", "fuelType", "fueltype", "FuelCode", "fuelCode", "Product", "product", "ProductCode", "productCode"]));
  const directPrice = priceValue(row.Price ?? row.price ?? row.FuelPrice ?? row.fuelPrice ?? row.Amount ?? row.amount ?? row.Value ?? row.value);
  if (directFuel && Number.isFinite(directPrice)) station.prices[directFuel] = directPrice;

  if (row.prices && typeof row.prices === "object" && !Array.isArray(row.prices)) {
    for (const [fuel, price] of Object.entries(row.prices)) {
      const fuelCode = normaliseFuelCode(fuel);
      const value = priceValue(price);
      if (fuelCode && Number.isFinite(value)) station.prices[fuelCode] = value;
    }
  }
}

function priceRows(row) {
  for (const key of ["AvailableFuel", "availableFuel", "availableFuels", "FuelPrices", "fuelPrices", "Prices", "prices", "PriceList", "priceList", "FuelPriceList", "fuelPriceList", "Data", "data"]) {
    if (Array.isArray(row?.[key])) return row[key];
  }
  return [];
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["Outlets", "outlets", "Data", "data", "FuelOutlets", "fuelOutlets", "Stations", "stations", "FuelPrices", "fuelPrices", "Result", "result", "Results", "results"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (payload && typeof payload === "object") return [payload];
  return [];
}

function selectStations(stations, points = [], radiusKm = 0) {
  const validPoints = points
    .map((point) => ({ lat: Number(point?.lat), lon: Number(point?.lon) }))
    .filter(validCoordinates);
  const anchors = validPoints.length ? validPoints : NT_DEFAULT_POINTS;
  const searchKm = Math.max(15, Math.min(800, Number(radiusKm || 0) + 90));
  const selected = [];
  for (const station of stations) {
    if (!validCoordinates(station)) continue;
    if (!validPoints.length || anchors.some((point) => distanceKm(point, station) <= searchKm)) selected.push(station);
  }
  return selected.length ? selected : stations.filter(validCoordinates);
}

function filterNtSnapshot(stations = [], { points = [], radiusKm = 0, requestedFuels = new Set(), decorateStation = (station) => station } = {}) {
  return selectStations(stations, points, radiusKm)
    .filter((station) => validCoordinates(station))
    .filter((station) => Object.keys(station.prices || {}).length)
    .filter((station) => !requestedFuels.size || Object.keys(station.prices || {}).some((fuel) => requestedFuels.has(fuel)))
    .sort((left, right) => String(left.stationCode).localeCompare(String(right.stationCode)))
    .map((station) => decorateStation({ ...station, prices: { ...(station.prices || {}) }, source: "api_nt_myfuel" }));
}

function filteredSnapshotCache(cache, filterOptions) {
  return {
    ...cache,
    stations: filterNtSnapshot(cache.stations || [], filterOptions),
  };
}

function fuelFilter(fuels = []) {
  return new Set((Array.isArray(fuels) ? fuels : [fuels]).map(normaliseFuelCode).filter(Boolean));
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(items.length || 1, concurrency)) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

function ntPostcodeConcurrency() {
  const parsed = Number(process.env.NT_MYFUEL_POSTCODE_CONCURRENCY || 6);
  return Math.max(1, Math.min(12, Math.round(Number.isFinite(parsed) ? parsed : 6)));
}

function ntOutletConcurrency() {
  const parsed = Number(process.env.NT_MYFUEL_OUTLET_CONCURRENCY || 3);
  return Math.max(1, Math.min(8, Math.round(Number.isFinite(parsed) ? parsed : 3)));
}

function normaliseFuelCode(value) {
  const text = String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
  return FUEL_ALIASES.get(text) || (["U91", "E10", "P95", "P98", "DL", "PDL", "LPG", "E85", "LNG"].includes(text) ? text : "");
}

function priceValue(value) {
  const parsed = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  const centsPerLitre = parsed >= 1000 && parsed < 10000 ? parsed / 10 : parsed;
  if (centsPerLitre >= 1000) return undefined;
  return Math.round(centsPerLitre * 10) / 10;
}

function ntUrl(envName, fallbackPath) {
  const configured = process.env[envName];
  if (configured) return configured;
  const base = (process.env.NT_MYFUEL_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  return `${base}${fallbackPath}`;
}

async function fetchJson(url, { data, headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: data === undefined ? undefined : typeof data === "string" ? data : JSON.stringify(data),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Provider returned non-JSON response: ${text.slice(0, 120)}`);
    }
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || response.statusText;
      throw new Error(`Provider returned ${response.status}: ${message}`);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Provider request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function cacheSeconds() {
  return Math.max(60, Number(process.env.FUEL_PATH_LIVE_CACHE_SECONDS || DEFAULT_CACHE_SECONDS));
}

function providerFlightHooks(provider, cache) {
  return {
    onSuccess: () => recordProviderSuccess(provider),
    onFailure: (error) => {
      recordProviderFailure(provider, error);
      if (cache) cache.lastError = error instanceof Error ? error.message : String(error);
    },
  };
}

function refreshProviderCacheInBackground(provider, flightKey, refresh, cache) {
  void singleFlight(flightKey, refresh, providerFlightHooks(provider, cache)).catch((error) => {
    if (cache) cache.lastError = error instanceof Error ? error.message : String(error);
  });
}

function stringValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function numberValue(row, keys) {
  for (const key of keys) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function booleanValue(row, keys) {
  for (const key of keys) {
    if (row?.[key] === undefined) continue;
    if (typeof row[key] === "boolean") return row[key];
    const text = String(row[key]).trim().toLowerCase();
    if (["true", "1", "yes", "open"].includes(text)) return true;
    if (["false", "0", "no", "closed"].includes(text)) return false;
  }
  return undefined;
}

function dateValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    const parsed = parseDate(value);
    if (parsed) return parsed;
  }
  return undefined;
}

function parseDate(value) {
  const text = String(value || "").trim();
  if (!text) return undefined;
  const auMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (auMatch) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = auMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 9, Number(minute) - 30, Number(second))).toISOString();
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function latestDate(left, right) {
  if (!left) return right;
  if (!right) return left;
  return new Date(right).getTime() > new Date(left).getTime() ? right : left;
}

function normalisePostcode(value) {
  const match = /\b(\d{4})\b/.exec(String(value || ""));
  return match ? match[1] : "";
}

function suburbFromAddress(address) {
  const parts = String(address || "").split(",").map((item) => item.trim()).filter(Boolean);
  const tail = parts[parts.length - 1] || "";
  return tail.replace(/\bNT\b.*$/i, "").replace(/\d{4}/g, "").trim();
}

function validCoordinates(point) {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && Boolean(lat || lon);
}

module.exports = {
  createMyFuelNtProvider,
  hasNtCredentials,
  normaliseNtPayload,
  normaliseNtReferencePayload,
};
