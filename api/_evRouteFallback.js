const { nearestRoutePosition } = require("./_geoMath");

function createEvRouteFallbackScorer({ buildRoute, loadEvChargers }) {
  async function scoreEvRouteFallback({
    connectors = [],
    limit = 3,
    radiusKm = 18,
    route,
  } = {}) {
    const points = Array.isArray(route?.points) ? route.points : [];
    if (points.length < 2) throw new Error("route points are required");
    const centres = routeFallbackCentres(points);
    const responses = await Promise.all(
      centres.map((centre) =>
        loadEvChargers({
          centre,
          connectors,
          limit: 8,
          radiusKm,
        }),
      ),
    );
    const approximateChargers = scoreRouteFallbackChargers({
      chargers: responses.flatMap((response) => response.chargers || []),
      limit,
      routePoints: points,
    });
    const chargers = await refineFallbackDetours({
      buildRoute,
      chargers: approximateChargers,
      routePoints: points,
    });
    const routeEstimatedCount = chargers.filter((charger) => charger.routeDetourSource === "route_engine").length;
    return {
      context: {
        capability: "prototype",
        fallbackMode: "sampled_route_corridor",
        radiusKm,
        sampleCount: centres.length,
        chargerCount: chargers.length,
        returnedCount: chargers.length,
        routeEstimatedCount,
        generatedAt: new Date().toISOString(),
        provenance: {
          realTimeAvailability: false,
          scoring: routeEstimatedCount
            ? "Fallback candidates are route-corridor ranked; top candidates include route-engine detour estimates where available."
            : "Approximate straight-line distance to route corridor; not road-network detour time.",
        },
        warning:
          "EV fallback chargers use directory data and route-corridor scoring. Confirm tariff, access and live bay status with the charging network before driving.",
      },
      chargers,
    };
  }

  return { scoreEvRouteFallback };
}

function scoreRouteFallbackChargers({ chargers = [], limit = 3, routePoints = [] } = {}) {
  const byId = new Map();
  chargers.forEach((charger) => {
    if (!charger || !charger.id) return;
    const [routeDistanceKm, distanceAlongRouteKm] = nearestRoutePosition(charger, routePoints);
    const ranked = {
      ...charger,
      distanceAlongRouteKm: round(distanceAlongRouteKm, 2),
      routeDetourMinutes: estimateOffRouteMinutes(routeDistanceKm),
      routeDetourSource: "straight_line_estimate",
      routeDistanceKm: round(routeDistanceKm, 2),
      routeJoinPoint: nearestRoutePointForDistanceAlong(routePoints, distanceAlongRouteKm),
    };
    const existing = byId.get(charger.id);
    if (!existing || chargerRank(ranked) < chargerRank(existing)) {
      byId.set(charger.id, ranked);
    }
  });
  return Array.from(byId.values())
    .sort((left, right) => chargerRank(left) - chargerRank(right))
    .slice(0, Math.max(1, Math.round(Number(limit) || 3)));
}

async function refineFallbackDetours({ buildRoute, chargers = [], routePoints = [] }) {
  if (typeof buildRoute !== "function") return chargers;
  const refined = await Promise.all(
    chargers.map((charger) => refineFallbackDetour({ buildRoute, charger, routePoints })),
  );
  return refined.sort((left, right) => chargerRank(left) - chargerRank(right));
}

async function refineFallbackDetour({ buildRoute, charger, routePoints }) {
  const joinPoint = charger.routeJoinPoint || nearestRoutePointForDistanceAlong(routePoints, charger.distanceAlongRouteKm || 0);
  if (!joinPoint) return charger;
  try {
    const detourRoute = await buildRoute({
      from: {
        lat: joinPoint.lat,
        lon: joinPoint.lon,
        label: joinPoint.label || "Route join point",
      },
      to: {
        lat: charger.lat,
        lon: charger.lon,
        label: charger.name || "EV charger",
      },
    });
    return {
      ...charger,
      routeDetourDistanceKm: round(Number(detourRoute.distanceKm || 0) * 2, 2),
      routeDetourMinutes: Math.round(Number(detourRoute.durationMin || 0) * 2),
      routeDetourProvider: detourRoute.provider,
      routeDetourSource: "route_engine",
    };
  } catch (error) {
    return {
      ...charger,
      routeDetourWarning: error instanceof Error ? error.message : "Route detour estimate unavailable",
    };
  }
}

function nearestRoutePointForDistanceAlong(routePoints = [], distanceAlongKm = 0) {
  if (!routePoints.length) return null;
  let travelled = 0;
  for (let index = 1; index < routePoints.length; index += 1) {
    const start = routePoints[index - 1];
    const end = routePoints[index];
    const segmentKm = haversineKm(start, end);
    if (travelled + segmentKm >= distanceAlongKm) {
      return Math.abs(distanceAlongKm - travelled) <= Math.abs(travelled + segmentKm - distanceAlongKm)
        ? start
        : end;
    }
    travelled += segmentKm;
  }
  return routePoints[routePoints.length - 1];
}

function routeFallbackCentres(routePoints = []) {
  const indexes = [
    Math.round((routePoints.length - 1) * 0.25),
    Math.round((routePoints.length - 1) * 0.5),
    Math.round((routePoints.length - 1) * 0.75),
    routePoints.length - 1,
  ];
  const centres = indexes
    .map((index) => routePoints[Math.max(0, Math.min(routePoints.length - 1, index))])
    .filter(Boolean);
  return uniqueMapPoints(centres).slice(0, 4);
}

function uniqueMapPoints(points) {
  const seen = new Set();
  return points.filter((point) => {
    const key = `${Number(point.lat).toFixed(4)}|${Number(point.lon).toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function chargerRank(charger) {
  const routeDistance = Number.isFinite(Number(charger.routeDetourDistanceKm))
    ? Number(charger.routeDetourDistanceKm)
    : Number.isFinite(Number(charger.routeDistanceKm))
      ? Number(charger.routeDistanceKm)
      : Number(charger.distanceKm || 0);
  const powerBoost = charger.maxPowerKw ? Math.min(charger.maxPowerKw, 250) / 250 : 0;
  return routeDistance - powerBoost;
}

function estimateOffRouteMinutes(routeDistanceKm) {
  const distance = Number(routeDistanceKm);
  if (!Number.isFinite(distance)) return undefined;
  return Math.round(((distance * 2) / 50) * 60);
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function haversineKm(a, b) {
  const radiusKm = 6371;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLon = toRad(Number(b.lon) - Number(a.lon));
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(hav));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

module.exports = {
  createEvRouteFallbackScorer,
  routeFallbackCentres,
  scoreRouteFallbackChargers,
};
