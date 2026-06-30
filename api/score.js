const {
  boolParam,
  buildRoute,
  liveProviderKeysForArea,
  loadStationData,
  methodAllowed,
  numberParam,
  routeContextStations,
  routeFromPayload,
  scoreRoute,
  sendJson,
  setParam,
  stringParam,
} = require("./_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;
  try {
    const body = req.method === "POST" ? req.body || {} : {};
    const query = req.query || {};
    const source = req.method === "POST" ? body.source || "auto" : stringParam(query.source, "auto");
    const fuel = String(req.method === "POST" ? body.fuel || "U91" : stringParam(query.fuel, "U91")).toUpperCase();
    const forceRefresh = req.method === "POST" ? Boolean(body.forceRefresh) : boolParam(query.forceRefresh);
    const combinedPlanRoute = req.method === "POST" && body.from && body.to && !body.route;
    const routePlan = combinedPlanRoute
      ? await buildRouteAndPreloadStations({ body, source, forceRefresh, fuel })
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
    const brandFilter = req.method === "POST" ? Boolean(body.brandFilter) : boolParam(query.brandFilter);
    const stations = brandFilter
      ? data.stations.filter((station) => brands.has(String(station.brand || "Unknown")))
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
    const recommendations = scored.candidates.slice(0, 20);
    const excludedCodes = new Set(recommendations.map((candidate) => String(candidate.station.stationCode)));

    const payload = {
      context: {
        ...scored.context,
        source: data.source,
        provider: data.provider,
        capability: data.capability,
        regionCapabilities: data.regionCapabilities || [],
        routeProvider: route.provider,
        brandFilter,
        brands: brandFilter ? Array.from(brands) : [],
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

async function buildRouteAndPreloadStations({ body, source, forceRefresh, fuel }) {
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
  const builtRoute = await buildRoute({ from, to });
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
      defaultCorridorKm: Number(body.corridorKm || 2.5),
      defaultDetourSpeedKmh: Number(body.detourSpeedKmh || 80),
      points: compactPoints(builtRoute.points || []),
    }),
  };
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
