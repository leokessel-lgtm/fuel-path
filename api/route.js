const {
  methodAllowed,
  nearestRoute,
  pointFromQuery,
  routeDistance,
  sendJson,
} = require("./_sample");

module.exports = function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  const from = pointFromQuery(req, "from");
  const to = pointFromQuery(req, "to");
  const route = nearestRoute(from, to);
  const points = route ? route.points : [from, to];
  const distanceKm = routeDistance(points);

  sendJson(res, 200, {
    provider: route ? "sample-route" : "sample-direct",
    distanceKm,
    durationMin: Math.max(8, Math.round((distanceKm / 58) * 60)),
    points,
  });
};
