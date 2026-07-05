const {
  boolParam,
  buildRoute,
  liveProviderKeysForArea,
  loadStationData,
  methodAllowed,
  numberParam,
  pointFromQuery,
  routeContextStations,
  routeFromPayload,
  scoreRoute,
  sendJson,
  setParam,
  stringParam,
} = require("./_backend");

module.exports = async function handler(req, res) {
  if (req.query?.__endpoint === "route") {
    return routeEndpoint(req, res);
  }
  if (!methodAllowed(req, res, ["GET", "POST"])) return;
  try {
    const body = req.method === "POST" ? req.body || {} : {};
    const query = req.query || {};
    const source = req.method === "POST" ? body.source || "auto" : stringParam(query.source, "auto");
    const fuel = String(req.method === "POST" ? body.fuel || "U91" : stringParam(query.fuel, "U91")).toUpperCase();
    const forceRefresh = req.method === "POST" ? Boolean(body.forceRefresh) : boolParam(query.forceRefresh);
    const tollPreference = normaliseTollPreference(req.method === "POST" ? body.tollPreference : stringParam(query.tollPreference, "no_preference"));
    const trafficPreference = normaliseTrafficPreference(req.method === "POST" ? body.trafficPreference : stringParam(query.trafficPreference, "unaware"));
    const combinedPlanRoute = req.method === "POST" && body.from && body.to && !body.route;
    const actualDetours = actualDetoursEnabled({ body, combinedPlanRoute, query, req });
    const routePlan = combinedPlanRoute
      ? await buildRouteAndPreloadStations({ body, source, forceRefresh, fuel, tollPreference, trafficPreference })
      : { route: req.method === "POST" ? routeFromPayload(body.route || {}) : routeFromPayloadFromQuery(query), data: null, builtRoute: null };
    const route = routePlan.route;
    const data = routePlan.data || await loadStationData({
      requestedSource: source,
      forceRefresh,
      points: route.points || [],
      fuels: [fuel],
    });
    const includeMemberPrices = req.method === "POST" ? Boolean(body.includeMemberPrices) : boolParam(query.includeMemberPrices);
    const includeClosed = req.method === "POST" ? Boolean(body.includeClosed) : boolParam(query.includeClosed);
    const eligibleDiscounts =
      req.method === "POST"
        ? new Set((body.eligibleDiscounts || []).map(String).filter(Boolean))
        : setParam(query.eligibleDiscounts);
    const brands =
      req.method === "POST"
        ? new Set((body.brands || []).map(String).filter(Boolean))
        : setParam(query.brands);
    const brandLabels =
      req.method === "POST"
        ? new Set((body.brandLabels || []).map(String).filter(Boolean))
        : brands;
    const brandFilter = req.method === "POST" ? Boolean(body.brandFilter) : boolParam(query.brandFilter);
    const stations = brandFilter
      ? data.stations.filter((station) => stationMatchesBrandFilter(station, brands))
      : data.stations;
    const scored = scoreRoute({
      source: data.source,
      route,
      stations,
      fuel,
      tankLitres: Number(req.method === "POST" ? body.tankLitres || 55 : numberParam(query.tankLitres, 55)),
      tankPercent: Number(req.method === "POST" ? body.tankPercent || 45 : numberParam(query.tankPercent, 45)),
      economy: Number(req.method === "POST" ? body.economy || 8.2 : numberParam(query.economy, 8.2)),
      reserveKm: Number(req.method === "POST" ? body.reserveKm || 35 : numberParam(query.reserveKm, 35)),
      corridorKm: Number(req.method === "POST" ? body.corridorKm || 2.5 : numberParam(query.corridorKm, 2.5)),
      minSavingDollars: Number(req.method === "POST" ? body.minSavingDollars || 5 : numberParam(query.minSavingDollars, 5)),
      maxDetourMinutes: Number(req.method === "POST" ? body.maxDetourMinutes || 8 : numberParam(query.maxDetourMinutes, 8)),
      eligibleDiscounts,
      includeMemberPrices,
      includeClosed,
    });
    const refinedRecommendations = await refineActualDetours({
      actualDetours,
      baseRoute: routePlan.builtRoute || route,
      buildRoute,
      candidates: scored.candidates,
      trafficPreference,
      tollPreference,
    });
    const recommendations = refinedRecommendations.slice(0, 20);
    const excludedCodes = new Set(recommendations.map((candidate) => String(candidate.station.stationCode)));

    const payload = {
      context: {
        ...scored.context,
        source: data.source,
        provider: data.provider,
        capability: data.capability,
        regionCapabilities: data.regionCapabilities || [],
        routeProvider: route.provider,
        routeQuality: routePlan.builtRoute?.routeQuality || route.routeQuality || routeQualityFromRoute(route),
        tollPreference,
        trafficPreference,
        actualDetours: actualDetourContext({ actualDetours, recommendations: refinedRecommendations }),
        brandFilter,
        brands: brandFilter ? Array.from(brandLabels.size ? brandLabels : brands) : [],
        generatedAt: new Date().toISOString(),
        cacheHit: data.cacheHit,
        cacheAgeSeconds: data.cacheAgeSeconds,
        cacheMode: data.cacheMode,
        degraded: Boolean(data.degraded),
        providerHealth: data.providerHealth || {},
        provenance: {
          source: data.source,
          provider: data.provider,
          cacheMode: data.cacheMode,
          degraded: Boolean(data.degraded),
          providerStatuses: providerStatuses(data.providerHealth),
        },
        warning: data.warning,
      },
      recommendations,
      contextStations: routeContextStations({
        route,
        stations,
        fuel,
        excludedCodes,
        corridorKm: scored.context.corridorKm,
        includeMemberPrices,
        includeClosed,
      }),
    };
    sendJson(res, 200, combinedPlanRoute ? { route: routePlan.builtRoute, score: payload } : payload);
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Could not score route",
    });
  }
};

async function routeEndpoint(req, res) {
  if (!methodAllowed(req, res)) return;
  try {
    const from = pointFromQuery(req, "from");
    const to = pointFromQuery(req, "to");
    sendJson(res, 200, await buildRoute({ from, to }));
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Route not found",
    });
  }
}

function routeFromPayloadFromQuery(query) {
  const from = {
    lat: numberParam(query.fromLat, 0),
    lon: numberParam(query.fromLon, 0),
    label: stringParam(query.fromLabel, "Start"),
  };
  const to = {
    lat: numberParam(query.toLat, 0),
    lon: numberParam(query.toLon, 0),
    label: stringParam(query.toLabel, "Destination"),
  };
  return routeFromPayload({
    id: "query-route",
    name: "Query route",
    points: [from, to],
    defaultCorridorKm: numberParam(query.corridorKm, 2.5),
    defaultDetourSpeedKmh: numberParam(query.detourSpeedKmh, 45),
  });
}

function providerStatuses(providerHealth = {}) {
  return Object.fromEntries(
    Object.entries(providerHealth).map(([provider, health]) => [
      provider,
      {
        status: health?.status || "unknown",
        cacheMode: health?.cacheMode || "none",
        cacheAgeSeconds: Number.isFinite(Number(health?.cacheAgeSeconds)) ? Number(health.cacheAgeSeconds) : null,
      },
    ]),
  );
}

async function buildRouteAndPreloadStations({ body, source, forceRefresh, fuel, tollPreference, trafficPreference }) {
  const from = pointFromBody(body.from, "from");
  const to = pointFromBody(body.to, "to");
  const endpointPoints = [from, to];
  const endpointProviderKeys = liveProviderKeysForArea(endpointPoints, 0).join("|");
  const stationDataPromise = loadStationData({
    requestedSource: source,
    forceRefresh,
    points: endpointPoints,
    fuels: [fuel],
  }).then(
    (data) => ({ data, error: null }),
    (error) => ({ data: null, error }),
  );
  const builtRoute = await buildRoute({ from, to, tollPreference, trafficPreference });
  const routeProviderKeys = liveProviderKeysForArea(builtRoute.points || endpointPoints, 0).join("|");
  const preloadResult = endpointProviderKeys === routeProviderKeys ? await stationDataPromise : null;
  if (preloadResult?.error) throw preloadResult.error;
  const data = preloadResult?.data || await loadStationData({
    requestedSource: source,
    forceRefresh,
    points: builtRoute.points || endpointPoints,
    fuels: [fuel],
  });
  return {
    builtRoute: {
      ...builtRoute,
      points: builtRoute.points || [],
    },
    data,
    route: routeFromPayload({
      id: "native-route",
      name: "Native planned route",
      provider: builtRoute.provider,
      routeQuality: builtRoute.routeQuality,
      defaultCorridorKm: Number(body.corridorKm || 2.5),
      defaultDetourSpeedKmh: Number(body.detourSpeedKmh || 80),
      points: compactPoints(builtRoute.points || []),
    }),
  };
}

function normaliseTollPreference(value) {
  const normalised = String(value || "no_preference").toLowerCase();
  return ["avoid", "allow", "no_preference"].includes(normalised) ? normalised : "no_preference";
}

function normaliseTrafficPreference(value) {
  const normalised = String(value || "unaware").toLowerCase();
  return ["aware", "unaware"].includes(normalised) ? normalised : "unaware";
}

async function refineActualDetours({ actualDetours, baseRoute, buildRoute, candidates = [], trafficPreference, tollPreference }) {
  if (!actualDetours && process.env.FUEL_PATH_EXPERIMENTAL_ACTUAL_DETOURS !== "1") return candidates;
  if (typeof buildRoute !== "function" || !baseRoute?.points?.length) return candidates;
  const limit = Math.max(1, Math.min(3, Number(process.env.FUEL_PATH_ACTUAL_DETOUR_LIMIT || 3)));
  const timeoutMs = Math.max(400, Math.min(2500, Number(process.env.FUEL_PATH_ACTUAL_DETOUR_TIMEOUT_MS || 1800)));
  const topCandidates = candidates.slice(0, limit);
  const refined = await Promise.all(
    topCandidates.map((candidate) => refineCandidateActualDetour({
      baseRoute,
      buildRoute,
      candidate,
      timeoutMs,
      trafficPreference,
      tollPreference,
    })),
  );
  const byCode = new Map(refined.map((candidate) => [String(candidate.station?.stationCode || ""), candidate]));
  const sorted = candidates
    .map((candidate) => byCode.get(String(candidate.station?.stationCode || "")) || candidate)
    .sort(actualDetourRecommendationOrder);
  return sorted.map((candidate) => applyActualDetourTollCost(candidate));
}

async function refineCandidateActualDetour({ baseRoute, buildRoute, candidate, timeoutMs, trafficPreference, tollPreference }) {
  const start = baseRoute.points[0];
  const destination = baseRoute.points[baseRoute.points.length - 1];
  const station = candidate.station || {};
  if (!start || !destination || !Number.isFinite(Number(station.lat)) || !Number.isFinite(Number(station.lon))) return candidate;
  try {
    const toStation = await routeWithTimeout(buildRoute({
      from: start,
      to: { lat: Number(station.lat), lon: Number(station.lon), label: station.name || "Fuel stop" },
      trafficPreference,
      tollPreference,
    }), timeoutMs);
    const fromStation = await routeWithTimeout(buildRoute({
      from: { lat: Number(station.lat), lon: Number(station.lon), label: station.name || "Fuel stop" },
      to: destination,
      trafficPreference,
      tollPreference,
    }), timeoutMs);
    const baseDistanceKm = Number(baseRoute.distanceKm || 0);
    const baseDurationMin = Number(baseRoute.durationMin || 0);
    const actualDistanceKm = Number(toStation.distanceKm || 0) + Number(fromStation.distanceKm || 0);
    const actualDurationMin = Number(toStation.durationMin || 0) + Number(fromStation.durationMin || 0);
    const baseTollCostDollars = Number(baseRoute.tollCostDollars || 0);
    const viaTollCostDollars = Number(toStation.tollCostDollars || 0) + Number(fromStation.tollCostDollars || 0);
    const tollCostDollars = Number.isFinite(viaTollCostDollars)
      ? round(Math.max(0, viaTollCostDollars - baseTollCostDollars), 2)
      : undefined;
    const detourKm = round(Math.max(0, actualDistanceKm - baseDistanceKm), 2);
    const detourMinutes = round(Math.max(0, actualDurationMin - baseDurationMin), 1);
    return {
      ...candidate,
      detourKm,
      detourMinutes,
      actualDetour: {
        source: "route_engine_via_station",
        provider: toStation.provider === fromStation.provider ? toStation.provider : "mixed",
        baseDistanceKm: round(baseDistanceKm, 2),
        baseDurationMin: round(baseDurationMin, 1),
        viaDistanceKm: round(actualDistanceKm, 2),
        viaDurationMin: round(actualDurationMin, 1),
        detourKm,
        detourMinutes,
        baseTollCostDollars,
        viaTollCostDollars,
        tollCostDollars,
        trafficPreference,
        tollPreference,
      },
    };
  } catch (error) {
    return {
      ...candidate,
      actualDetour: {
        source: "unavailable",
        warning: error instanceof Error ? error.message : "Actual detour estimate unavailable",
      },
    };
  }
}

function actualDetoursEnabled({ body = {}, combinedPlanRoute, query = {}, req = {} } = {}) {
  if (req.method === "POST") {
    if (body.actualDetours === false) return false;
    if (body.actualDetours === true) return true;
    return Boolean(combinedPlanRoute);
  }
  return boolParam(query.actualDetours);
}

function routeWithTimeout(routePromise, timeoutMs) {
  return Promise.race([
    routePromise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Actual detour route timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function routeRecommendationOrder(left, right) {
  const leftPriority = routeRecommendationPriority(left);
  const rightPriority = routeRecommendationPriority(right);
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  if (left.adjustedCpl !== right.adjustedCpl) return left.adjustedCpl - right.adjustedCpl;
  if (left.detourMinutes !== right.detourMinutes) return left.detourMinutes - right.detourMinutes;
  return right.score - left.score;
}

function actualDetourRecommendationOrder(left, right) {
  const baseOrder = routeRecommendationOrder(left, right);
  if (baseOrder !== 0) {
    const leftHasActual = left.actualDetour?.source === "route_engine_via_station";
    const rightHasActual = right.actualDetour?.source === "route_engine_via_station";
    if (!leftHasActual || !rightHasActual) return baseOrder;
    if (leftPriorityGroup(left) !== leftPriorityGroup(right)) return baseOrder;
    if (Number(left.adjustedCpl) !== Number(right.adjustedCpl)) return baseOrder;
  }
  const leftToll = Number(left.actualDetour?.tollCostDollars || 0);
  const rightToll = Number(right.actualDetour?.tollCostDollars || 0);
  if (leftToll !== rightToll) return leftToll - rightToll;
  return baseOrder;
}

function leftPriorityGroup(candidate) {
  return routeRecommendationPriority(candidate);
}

function applyActualDetourTollCost(candidate) {
  const tollCostDollars = Number(candidate.actualDetour?.tollCostDollars);
  if (!Number.isFinite(tollCostDollars) || tollCostDollars <= 0) return candidate;
  return {
    ...candidate,
    actualDetour: {
      ...candidate.actualDetour,
      totalDetourCostDollars: round(Number(candidate.detourCost || 0) + tollCostDollars, 2),
      tollRankingApplied: true,
    },
  };
}

function routeRecommendationPriority(candidate) {
  return candidate.station?.openNow !== false &&
    candidate.reachable !== false &&
    candidate.matchesDecisionRule !== false
    ? 0
    : 1;
}

function actualDetourContext({ actualDetours, recommendations = [] }) {
  const routeEstimatedCount = recommendations.filter((candidate) => candidate.actualDetour?.source === "route_engine_via_station").length;
  return {
    enabled: Boolean(actualDetours || process.env.FUEL_PATH_EXPERIMENTAL_ACTUAL_DETOURS === "1"),
    mode: "top_candidates_only",
    candidateLimit: Math.max(1, Math.min(3, Number(process.env.FUEL_PATH_ACTUAL_DETOUR_LIMIT || 3))),
    timeoutMs: Math.max(400, Math.min(2500, Number(process.env.FUEL_PATH_ACTUAL_DETOUR_TIMEOUT_MS || 1800))),
    routeEstimatedCount,
    warning: routeEstimatedCount
      ? ""
      : "Exact detour routing is off or unavailable; recommendations use smart detour estimates.",
  };
}

function normaliseBrand(value) {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

function stationMatchesBrandFilter(station, brands) {
  const candidates = [station.brand, station.name].map(normaliseBrand).filter(Boolean);
  return Array.from(brands).some((brand) => {
    const normalised = normaliseBrand(brand);
    if (!normalised) return false;
    return candidates.some((candidate) => candidate === normalised || candidate.includes(normalised));
  });
}

function routeQualityFromRoute(route) {
  return {
    level: route.provider === "google_routes" ? "medium" : "low",
    provider: route.provider || "unknown",
    geometry: route.provider === "google_routes" ? "provider_road_route" : "provided_route_geometry",
    traffic: "traffic_unaware",
    tolls: "unknown",
    tollPreference: "no_preference",
  };
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function pointFromBody(point, fallbackLabel) {
  return {
    lat: Number(point?.lat),
    lon: Number(point?.lon),
    label: String(point?.label || fallbackLabel),
  };
}

function compactPoints(points, maxPoints = 180) {
  if (points.length <= maxPoints) return points;
  const compacted = [];
  let previousIndex = -1;
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * (points.length - 1));
    if (sourceIndex !== previousIndex) {
      compacted.push(points[sourceIndex]);
      previousIndex = sourceIndex;
    }
  }
  return compacted;
}
