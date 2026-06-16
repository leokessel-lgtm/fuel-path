const {
  distanceKm,
  boolParam,
  loadStationData,
  methodAllowed,
  numberParam,
  sendJson,
  setParam,
  stationPayload,
  stringParam,
} = require("./_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  const centre = {
    lat: numberParam(req.query.lat, -34.0114122),
    lon: numberParam(req.query.lon, 151.0993847),
    label: stringParam(req.query.label, "Map centre"),
  };
  const fuel = stringParam(req.query.fuel, "U91");
  const radiusKm = numberParam(req.query.radiusKm, 8);
  const limit = numberParam(req.query.limit, 120);
  const includeClosed = boolParam(req.query.includeClosed);
  const includeMemberPrices = boolParam(req.query.includeMemberPrices);
  const brandFilter = boolParam(req.query.brandFilter);
  const brands = setParam(req.query.brands);
  const data = await loadStationData({
    requestedSource: stringParam(req.query.source, "auto"),
    forceRefresh: boolParam(req.query.forceRefresh),
    points: [centre],
    radiusKm,
  });
  const stations = data.stations
    .map((station) => ({
      ...station,
      distanceKm: distanceKm(centre, station),
    }))
    .filter((station) => {
      if (!station.prices?.[fuel] || station.distanceKm > radiusKm) return false;
      if (!includeClosed && station.openNow === false) return false;
      if (!includeMemberPrices && station.membershipRequired) return false;
      if (brandFilter && !brands.has(String(station.brand || "Unknown"))) return false;
      return true;
    })
    .sort((left, right) => Number(left.prices[fuel]) - Number(right.prices[fuel]) || left.distanceKm - right.distanceKm);
  const selected = stations.slice(0, limit);

  sendJson(res, 200, {
    context: {
      fuel,
      source: data.source,
      provider: data.provider,
      radiusKm,
      centre,
      stationCount: stations.length,
      returnedCount: selected.length,
      generatedAt: new Date().toISOString(),
      cacheHit: data.cacheHit,
      cacheAgeSeconds: data.cacheAgeSeconds,
      warning: data.warning,
    },
    stations: selected.map((station) => stationPayload(station, { fuel, distanceKm: station.distanceKm })),
  });
};
