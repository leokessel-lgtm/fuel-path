const {
  distanceKm,
  methodAllowed,
  numberParam,
  sampleStations,
  sendJson,
  stringParam,
} = require("./_sample");

module.exports = function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  const centre = {
    lat: numberParam(req.query.lat, -34.0114122),
    lon: numberParam(req.query.lon, 151.0993847),
  };
  const fuel = stringParam(req.query.fuel, "U91");
  const radiusKm = numberParam(req.query.radiusKm, 8);
  const limit = numberParam(req.query.limit, 120);
  const stations = sampleStations({ includeFixtureFallback: false })
    .map((station) => ({
      ...station,
      distanceKm: distanceKm(centre, station),
    }))
    .filter((station) => station.prices?.[fuel] && station.distanceKm <= radiusKm)
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, limit);

  sendJson(res, 200, {
    context: {
      fuel,
      source: "sample",
      radiusKm,
      stationCount: stations.length,
      returnedCount: stations.length,
      generatedAt: new Date().toISOString(),
    },
    stations,
  });
};
