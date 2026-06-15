const stationsPayload = require("../prototype/data/sample-stations.json");
const demoStationsPayload = require("../prototype/data/vercel-demo-stations.json");
const routesPayload = require("../prototype/data/routes.json");

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

function sampleStations({ includeFixtureFallback = true } = {}) {
  const stationsByCode = new Map();
  const sourceStations = includeFixtureFallback
    ? [...demoStationsPayload.stations, ...stationsPayload.stations]
    : demoStationsPayload.stations;
  for (const station of sourceStations) {
    stationsByCode.set(station.stationCode, station);
  }
  return [...stationsByCode.values()].map((station) => ({
    ...station,
    address: station.address || `${station.suburb || "NSW"} sample address`,
  }));
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
