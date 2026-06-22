const { geocode, methodAllowed, numberParam, sendJson, stringParam } = require("./_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  try {
    const q = stringParam(req.query.q).trim();
    if (!q) throw new Error("q is required");
    const limit = Math.max(1, Math.min(8, numberParam(req.query.limit, 5)));
    const payload = await geocode({
      query: q,
      limit,
      sessionToken: stringParam(req.query.sessionToken),
      provider: stringParam(req.query.provider),
      searchContext: {
        nearLat: numberParam(req.query.nearLat, NaN),
        nearLon: numberParam(req.query.nearLon, NaN),
        nearRadiusKm: numberParam(req.query.nearRadiusKm, NaN),
      },
    });
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 404, {
      error: error instanceof Error ? error.message : "No location found",
    });
  }
};
