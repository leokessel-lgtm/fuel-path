const { nearestRoutePosition } = require("./_geoMath");

function createEvRouteFallbackScorer({ buildRoute, loadEvChargers }) {
  async function scoreEvRouteFallback({
    connectors = [],
    limit = 3,
    radiusKm = 18,
    route,
    selectedRangeKm = 0,
  } = {}) {
    const points = Array.isArray(route?.points) ? route.points : [];
    if (points.length < 2) throw new Error("route points are required");
    const routeDistanceKm = Number(route?.distanceKm || 0) || routeDistanceFromPoints(points);
    const rangeStatus = evRangeStatus({ routeDistanceKm, selectedRangeKm });
    const centres = routeFallbackCentres(points);
    const responses = await Promise.allSettled(
      centres.map((centre) =>
        loadEvChargers({
          centre,
          connectors,
          limit: Math.max(12, Math.round(Number(limit) || 10) * 2),
          radiusKm,
        }),
      ),
    );
    const fulfilled = responses
      .filter((response) => response.status === "fulfilled")
      .map((response) => response.value);
    const providerTrace = providerTraceFromResponses(fulfilled);
    const providerErrors = responses
      .filter((response) => response.status === "rejected")
      .map((response) => response.reason instanceof Error ? response.reason.message : "EV provider unavailable");
    const safeLimit = Math.max(1, Math.round(Number(limit) || 3));
    const candidateLimit = Math.min(24, Math.max(safeLimit * 3, safeLimit + 5));
    const approximateChargers = scoreRouteFallbackChargers({
      chargers: fulfilled.flatMap((response) => response.chargers || []),
      limit: candidateLimit,
      routePoints: points,
    });
    const refinedChargers = await refineFallbackDetours({
      buildRoute,
      chargers: approximateChargers,
      rangeStatus: rangeStatus.status,
      routeDistanceKm,
      routePoints: points,
    });
    const chargers = refinedChargers.slice(0, safeLimit);
    const routeEstimatedCount = chargers.filter((charger) => charger.routeDetourSource === "route_engine").length;
    return {
      context: {
        capability: "prototype",
        fallbackMode: "sampled_route_corridor",
        planMode: "route_charging",
        provider: providerTrace.join("+") || "unknown",
        source: providerTrace.length === 1 ? providerTrace[0] : providerTrace.length ? "route_provider_cascade" : "unknown",
        radiusKm,
        filters: {
          connectors: Array.isArray(connectors) ? connectors : [],
          minPowerKw: 0,
          powerMode: "",
        },
        sampleCount: centres.length,
        routeDistanceKm: round(routeDistanceKm, 1),
        selectedRangeKm: Number(selectedRangeKm || 0),
        rangeStatus: rangeStatus.status,
        rangeMarginKm: rangeStatus.marginKm,
        recommendedChargeCount: recommendedChargeCount(rangeStatus.status, chargers.length),
        chargerCount: chargers.length,
        returnedCount: chargers.length,
        scoredCandidateCount: refinedChargers.length,
        routeEstimatedCount,
        warnings: [
          rangeStatus.warning,
          ...providerErrors.map((message) => `EV provider lookup failed for a sampled route point: ${message}`),
        ].filter(Boolean),
        degraded: providerErrors.length > 0 && chargers.length === 0,
        generatedAt: new Date().toISOString(),
        provenance: {
          realTimeAvailability: false,
          scoring: routeEstimatedCount
            ? "Route charging options are gathered along the route corridor; top candidates include route-engine detour estimates where available."
            : "Route charging options are gathered along the route corridor; approximate straight-line distance is used when road-network detour time is unavailable.",
        },
        warning:
          "EV route chargers use directory data and route-corridor scoring. Confirm tariff, access and bay status with the charging network before driving.",
      },
      chargers,
    };
  }

  return { scoreEvRouteFallback };
}

function evRangeStatus({ routeDistanceKm, selectedRangeKm }) {
  const routeKm = Number(routeDistanceKm || 0);
  const rangeKm = Number(selectedRangeKm || 0);
  if (!Number.isFinite(rangeKm) || rangeKm <= 0) {
    return {
      status: "unknown",
      marginKm: null,
      warning: "Selected EV range is not set, so route range confidence is unknown.",
    };
  }
  const marginKm = Math.round(rangeKm - routeKm);
  if (marginKm >= 80) return { status: "comfortable", marginKm, warning: "" };
  if (marginKm >= 0) {
    return {
      status: "tight",
      marginKm,
      warning: "Route is within selected range, but the margin is tight before weather, speed, load and detours.",
    };
  }
  return {
    status: "charging_needed",
    marginKm,
    warning: "Route distance is above selected EV range, so plan a charging stop before driving.",
  };
}

function recommendedChargeCount(status, chargerCount) {
  if (status === "charging_needed") return Math.max(1, chargerCount ? 1 : 0);
  if (status === "tight" && chargerCount) return 1;
  return 0;
}

function providerTraceFromResponses(responses = []) {
  return [
    ...new Set(
      responses
        .flatMap((response) => String(response?.context?.provider || response?.context?.source || "")
          .split("+"))
        .map((provider) => provider.trim())
        .filter(Boolean),
    ),
  ];
}

function routeDistanceFromPoints(points = []) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineKm(points[index - 1], points[index]);
  }
  return total;
}

function scoreRouteFallbackChargers({ chargers = [], limit = 3, routePoints = [] } = {}) {
  const byId = new Map();
  chargers.forEach((charger) => {
    if (!charger || !charger.id) return;
    const [routeDistanceKm, distanceAlongRouteKm] = nearestRoutePosition(charger, routePoints);
    const progressRatio = routeProgressRatio(distanceAlongRouteKm, routePoints);
    const ranked = {
      ...charger,
      distanceAlongRouteKm: round(distanceAlongRouteKm, 2),
      routeProgressRatio: progressRatio,
      routeSegment: routeSegmentForProgress(progressRatio),
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

async function refineFallbackDetours({
  buildRoute,
  chargers = [],
  rangeStatus = "unknown",
  routeDistanceKm = 0,
  routePoints = [],
}) {
  if (typeof buildRoute !== "function") return chargers;
  const refined = await Promise.all(
    chargers.map((charger) => refineFallbackDetour({ buildRoute, charger, routePoints })),
  );
  return refined
    .map((charger) => ({
      ...charger,
      routeScore: evRouteChargerScore(charger, { rangeStatus, routeDistanceKm }),
      routeScoreReason: evRouteChargerScoreReason(charger, { rangeStatus }),
    }))
    .sort((left, right) => routeOptionOrder(left, right, { rangeStatus, routeDistanceKm }));
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
  const lastIndex = routePoints.length - 1;
  const indexes = [0, 0.2, 0.4, 0.6, 0.8, 1].map((fraction) => Math.round(lastIndex * fraction));
  const centres = indexes
    .map((index) => routePoints[Math.max(0, Math.min(routePoints.length - 1, index))])
    .filter(Boolean);
  return uniqueMapPoints(centres).slice(0, 6);
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

function routeOptionOrder(left, right, context = {}) {
  const leftScore = evRouteChargerScore(left, context);
  const rightScore = evRouteChargerScore(right, context);
  if (Math.abs(leftScore - rightScore) > 0.05) return leftScore - rightScore;
  const leftAlong = Number(left.distanceAlongRouteKm);
  const rightAlong = Number(right.distanceAlongRouteKm);
  if (Number.isFinite(leftAlong) && Number.isFinite(rightAlong) && Math.abs(leftAlong - rightAlong) > 0.1) {
    return leftAlong - rightAlong;
  }
  if (Number.isFinite(leftAlong) && !Number.isFinite(rightAlong)) return -1;
  if (!Number.isFinite(leftAlong) && Number.isFinite(rightAlong)) return 1;
  return chargerRank(left) - chargerRank(right);
}

function evRouteChargerScore(charger, { rangeStatus = "unknown", routeDistanceKm = 0 } = {}) {
  const detourKm = Number.isFinite(Number(charger.routeDetourDistanceKm))
    ? Number(charger.routeDetourDistanceKm)
    : Number.isFinite(Number(charger.routeDistanceKm))
      ? Number(charger.routeDistanceKm) * 2
      : Number(charger.distanceKm || 0);
  const detourMinutes = Number.isFinite(Number(charger.routeDetourMinutes))
    ? Number(charger.routeDetourMinutes)
    : estimateOffRouteMinutes(Number(charger.routeDistanceKm || charger.distanceKm || 0)) || 0;
  const powerKw = Number(charger.maxPowerKw || 0);
  const progress = Number.isFinite(Number(charger.routeProgressRatio))
    ? Number(charger.routeProgressRatio)
    : routeDistanceKm > 0 && Number.isFinite(Number(charger.distanceAlongRouteKm))
      ? Number(charger.distanceAlongRouteKm) / routeDistanceKm
      : 0.5;
  const target = rangeStatus === "charging_needed"
    ? 0.66
    : rangeStatus === "tight"
      ? 0.55
      : 0.45;
  const progressPenalty = Math.abs(progress - target) * (rangeStatus === "charging_needed" ? 8 : 4);
  const endpointPenalty = (rangeStatus === "charging_needed" || rangeStatus === "tight") && (progress < 0.08 || progress > 0.97)
    ? 5
    : 0;
  const powerCredit = Math.min(Math.max(powerKw, 0), 250) / 250 * 5;
  return round((detourKm * 1.2) + (detourMinutes * 0.18) + progressPenalty + endpointPenalty - powerCredit, 3);
}

function evRouteChargerScoreReason(charger, { rangeStatus = "unknown" } = {}) {
  const segment = charger.routeSegment || "route";
  const power = charger.maxPowerKw ? `${Math.round(charger.maxPowerKw)} kW` : "power unknown";
  const detour = Number.isFinite(Number(charger.routeDetourMinutes))
    ? `${Math.round(Number(charger.routeDetourMinutes))} min return`
    : "detour estimated";
  if (rangeStatus === "charging_needed") return `${segment} charging option, ${power}, ${detour}`;
  if (rangeStatus === "tight") return `${segment} fallback option, ${power}, ${detour}`;
  return `${segment} route option, ${power}, ${detour}`;
}

function routeProgressRatio(distanceAlongRouteKm, routePoints = []) {
  const totalKm = routeDistanceFromPoints(routePoints);
  if (!Number.isFinite(totalKm) || totalKm <= 0) return 0;
  return round(Math.max(0, Math.min(1, Number(distanceAlongRouteKm || 0) / totalKm)), 3);
}

function routeSegmentForProgress(progress) {
  const ratio = Number(progress);
  if (!Number.isFinite(ratio)) return "unknown";
  if (ratio < 0.18) return "near_origin";
  if (ratio > 0.82) return "near_destination";
  return "mid_route";
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
  evRouteChargerScore,
  evRangeStatus,
  providerTraceFromResponses,
  routeFallbackCentres,
  routeProgressRatio,
  scoreRouteFallbackChargers,
};
