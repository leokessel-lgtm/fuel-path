const {
  boolParam,
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
    const data = await loadStationData({
      requestedSource: source,
      forceRefresh: req.method === "POST" ? Boolean(body.forceRefresh) : boolParam(query.forceRefresh),
    });
    const route = req.method === "POST" ? routeFromPayload(body.route || {}) : routeFromPayloadFromQuery(query);
    const fuel = String(req.method === "POST" ? body.fuel || "U91" : stringParam(query.fuel, "U91")).toUpperCase();
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
      eligibleDiscounts,
      includeMemberPrices,
      includeClosed,
    });
    const recommendations = scored.candidates.slice(0, 20);
    const excludedCodes = new Set(recommendations.map((candidate) => String(candidate.station.stationCode)));

    sendJson(res, 200, {
      context: {
        ...scored.context,
        source: data.source,
        provider: data.provider,
        routeProvider: route.provider,
        generatedAt: new Date().toISOString(),
        cacheHit: data.cacheHit,
        cacheAgeSeconds: data.cacheAgeSeconds,
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
    });
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
