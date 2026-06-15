const { methodAllowed, sampleStations, scoreStation, sendJson } = require("./_sample");

module.exports = function handler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;
  const body = req.body || {};
  const fuel = body.fuel || "U91";
  const routePoints = body.route?.points || [];
  const eligibleDiscounts = body.eligibleDiscounts || [];
  const candidates = sampleStations()
    .filter((station) => station.prices?.[fuel])
    .map((station, index) => scoreStation(station, fuel, routePoints, eligibleDiscounts, index))
    .sort((left, right) => right.netSaving - left.netSaving)
    .slice(0, 10);

  sendJson(res, 200, {
    context: {
      routeName: body.route?.name || "Public demo route",
      source: "sample",
      fuel,
      routeDistanceKm: routePoints.length ? routePoints.length * 7 : 0,
      baselineCpl: 205,
      eligibleCandidates: candidates.length,
      freshnessCutoffHours: 48,
    },
    recommendations: candidates,
    contextStations: sampleStations(),
  });
};
