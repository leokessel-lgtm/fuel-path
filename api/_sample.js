const stationsPayload = require("../prototype/data/sample-stations.json");
const demoStationsPayload = require("../prototype/data/vercel-demo-stations.json");
const routesPayload = require("../prototype/data/routes.json");

function parseSampleScale(value = process.env.FUEL_PATH_SAMPLE_SCALE) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.max(1, Math.min(parsed, 200));
}

function parseSampleSeed(value = process.env.FUEL_PATH_SAMPLE_SEED) {
  if (!value && value !== "0") return 1729;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1729;
  return parsed;
}

function parseSampleJitterKm(value = process.env.FUEL_PATH_SAMPLE_JITTER_KM) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0.25;
  return Math.max(0.05, Math.min(parsed, 3));
}

function normaliseText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normaliseLatLon(value, isLat = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;
  const max = isLat ? 90 : 180;
  return Math.abs(parsed) <= max ? parsed : NaN;
}

function normaliseDateIso(value) {
  const text = normaliseText(value);
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function normalisePrices(prices = {}) {
  const output = {};
  for (const [key, value] of Object.entries(prices)) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 500) continue;
    output[String(key)] = round(parsed, 2);
  }
  return output;
}

function normaliseDiscount(discount = {}) {
  const id = normaliseText(discount.id);
  if (!id) return null;
  const centsPerLitre = Number(discount.centsPerLitre);
  return {
    id,
    label: normaliseText(discount.label, id),
    centsPerLitre: Number.isFinite(centsPerLitre) ? centsPerLitre : 0,
    inferred: Boolean(discount.inferred),
  };
}

function normaliseDiscounts(discounts = []) {
  const filtered = [];
  const seen = new Set();
  for (const discount of discounts) {
    const normalised = normaliseDiscount(discount);
    if (!normalised) continue;
    if (seen.has(normalised.id)) continue;
    seen.add(normalised.id);
    filtered.push(normalised);
  }
  return filtered;
}

function normaliseStation(station = {}) {
  const stationCode = normaliseText(station.stationCode);
  if (!stationCode) return null;
  const lat = normaliseLatLon(station.lat, true);
  const lon = normaliseLatLon(station.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const prices = normalisePrices(station.prices);
  if (!Object.keys(prices).length) return null;

  const suburb = normaliseText(station.suburb);
  const address = normaliseText(station.address, `${suburb || "NSW"} sample address`);
  const state = normaliseState(station.state || station.region || inferStateFromAddress(address));

  return {
    stationCode,
    name: normaliseText(station.name, stationCode),
    brand: normaliseText(station.brand, "Unknown"),
    suburb,
    address,
    state,
    lat,
    lon,
    openNow: typeof station.openNow === "boolean" ? station.openNow : true,
    membershipRequired: Boolean(station.membershipRequired),
    updatedAt: normaliseDateIso(station.updatedAt),
    source: normaliseText(station.source, "public_demo_snapshot"),
    prices,
    discounts: normaliseDiscounts(station.discounts || []),
  };
}

function inferStateFromAddress(address = "") {
  const normalised = normaliseText(address).toUpperCase();
  const match = normalised.match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT|ACT)\b/);
  if (match) return match[1];
  return "NSW";
}

function normaliseState(value) {
  const state = normaliseText(value).toUpperCase();
  const known = new Set(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);
  return known.has(state) ? state : "NSW";
}

function dedupeByCode(stations = []) {
  const byCode = new Map();
  for (const station of stations) {
    byCode.set(station.stationCode, station);
  }
  return [...byCode.values()];
}

function seededRandom(seed) {
  let state = Number.isFinite(seed) ? (Number(seed) >>> 0) : 1729;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function jitterPoint(station, index, random, jitterKm = 0.25) {
  const latBase = Number(station.lat);
  const lonBase = Number(station.lon);
  const offsetKmX = (random() - 0.5) * 2 * jitterKm * 1000;
  const offsetKmY = (random() - 0.5) * 2 * jitterKm * 1000;
  const lat = latBase + (offsetKmY / 110574);
  const lonScale = 111320 * Math.cos((Math.PI / 180) * latBase);
  const lon = lonBase + (offsetKmX / Math.max(lonScale, 1));
  const normalisedLon = normaliseLatLon(lon, false);
  const normalisedLat = normaliseLatLon(lat, true);
  const latOffset = Number((index + 1).toString().slice(-6)) / 10000000;
  if (!Number.isFinite(normalisedLat) || !Number.isFinite(normalisedLon)) return station;
  const roundedLat = round(normalisedLat + (latOffset / 10000000), 6);
  const roundedLon = round(normalisedLon + (latOffset / 10000000), 6);
  return {
    ...station,
    lat: roundedLat,
    lon: roundedLon,
  };
}

function cloneWithSuffix(station, suffix, random, jitterKm) {
  const jittered = jitterPoint(station, suffix, random, jitterKm);
  return {
    ...jittered,
    stationCode: `${jittered.stationCode}-${suffix.toString().padStart(4, "0")}`,
    source: "public_demo_snapshot.synthetic",
    address: jittered.address,
    synthetic: true,
  };
}

function scaleStations(stations = [], scale = 1, seed = 1729, jitterKm = 0.25) {
  const requested = Math.max(1, Math.floor(Number(scale || 1)));
  if (!Number.isFinite(requested) || requested <= 1) return stations;
  const random = seededRandom(seed);
  const scaled = [];
  for (const station of stations) {
    scaled.push(station);
    for (let offset = 1; offset < requested; offset += 1) {
      scaled.push(cloneWithSuffix(station, offset, random, jitterKm));
    }
  }
  return scaled;
}

const places = [
  { label: "66B Easton Avenue, Sylvania NSW 2224", lat: -34.0114122, lon: 151.0993847 },
  { label: "Sylvania NSW, Australia", lat: -34.0128, lon: 151.1056 },
  { label: "Miranda NSW, Australia", lat: -34.0352, lon: 151.1019 },
  { label: "Taren Point NSW, Australia", lat: -34.0193, lon: 151.1225 },
  { label: "Kirrawee NSW, Australia", lat: -34.0333, lon: 151.0716 },
  { label: "Parramatta NSW, Australia", lat: -33.8136, lon: 151.0034 },
  { label: "Sydney CBD NSW, Australia", lat: -33.8688, lon: 151.2093 },
  { label: "Canberra ACT, Australia", lat: -35.2809, lon: 149.13 },
  { label: "Goulburn NSW, Australia", lat: -34.7516, lon: 149.7209 },
  { label: "Penrith NSW, Australia", lat: -33.7511, lon: 150.6942 },
  { label: "Artarmon NSW, Australia", lat: -33.8089, lon: 151.1842 },
  { label: "87A Corea Street, Sylvania NSW 2224", lat: -34.0121, lon: 151.1043 },
];

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function methodAllowed(req, res, methods = ["GET"]) {
  if (methods.includes(req.method)) return true;
  sendJson(res, 405, { error: "Method not allowed" });
  return false;
}

function numberParam(value, fallback) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringParam(value, fallback = "") {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

function sampleStations({
  includeFixtureFallback = true,
  scale = parseSampleScale(),
  seed = parseSampleSeed(),
  jitterKm = parseSampleJitterKm(),
} = {}) {
  const stationsByCode = new Map();
  const sourceStations = includeFixtureFallback
    ? [...demoStationsPayload.stations, ...stationsPayload.stations]
    : demoStationsPayload.stations;
  for (const station of sourceStations) {
    const normalised = normaliseStation(station);
    if (normalised) stationsByCode.set(normalised.stationCode, normalised);
  }
  const deduped = dedupeByCode([...stationsByCode.values()]);
  return scaleStations(deduped, scale, seed, jitterKm);
}

function distanceKm(a, b) {
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(hav));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function pointFromQuery(req, prefix) {
  return {
    lat: numberParam(req.query[`${prefix}Lat`], 0),
    lon: numberParam(req.query[`${prefix}Lon`], 0),
    label: stringParam(req.query[`${prefix}Label`], prefix),
  };
}

function nearestRoute(from, to) {
  const routes = routesPayload.routes || [];
  let bestRoute = routes[0];
  let bestDistance = Infinity;
  for (const route of routes) {
    const first = route.points[0];
    const last = route.points[route.points.length - 1];
    const forward = distanceKm(from, first) + distanceKm(to, last);
    const reverse = distanceKm(from, last) + distanceKm(to, first);
    const score = Math.min(forward, reverse);
    if (score < bestDistance) {
      bestDistance = score;
      bestRoute = reverse < forward ? { ...route, points: [...route.points].reverse() } : route;
    }
  }
  return bestDistance < 80 ? bestRoute : null;
}

function routeDistance(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceKm(points[index - 1], points[index]);
  }
  return total;
}

function distanceToRoute(station, routePoints) {
  if (!routePoints.length) return 0;
  return Math.min(...routePoints.map((point) => distanceKm(station, point)));
}

function priceFor(station, fuel) {
  return Number(station.prices?.[fuel] || station.prices?.U91 || 0);
}

function bestDiscount(station, eligibleDiscounts = []) {
  const discounts = station.discounts || [];
  const eligible = discounts.filter((discount) => eligibleDiscounts.includes(discount.id));
  return eligible.sort((a, b) => Number(b.centsPerLitre) - Number(a.centsPerLitre))[0];
}

function scoreStation(station, fuel, routePoints, eligibleDiscounts, index) {
  const pumpCpl = priceFor(station, fuel);
  const discount = bestDiscount(station, eligibleDiscounts);
  const discountCpl = Number(discount?.centsPerLitre || 0);
  const adjustedCpl = pumpCpl - discountCpl;
  const distanceToRouteKm = distanceToRoute(station, routePoints);
  const detourMinutes = distanceToRouteKm * 2.2;
  const netSaving = Math.max(-3, (205 - adjustedCpl) * 0.42 - detourMinutes * 0.35);
  return {
    station,
    fuel,
    pumpCpl,
    adjustedCpl,
    discountCpl,
    discountLabel: discount?.label,
    distanceKm: distanceToRouteKm,
    distanceToRouteKm,
    distanceAlongRouteKm: Math.max(0, index * 8),
    detourMinutes,
    netSaving,
    fillLitres: 35,
    reachable: true,
    warnings: station.openNow === false ? ["Closed in sample data"] : [],
  };
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

module.exports = {
  distanceKm,
  methodAllowed,
  nearestRoute,
  numberParam,
  places,
  pointFromQuery,
  routeDistance,
  sampleStations,
  scoreStation,
  sendJson,
  stringParam,
};
