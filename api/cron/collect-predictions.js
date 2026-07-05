const {
  cronAuthorised,
  methodAllowed,
  numberParam,
  predictionStatus,
  runPredictionMarketBacktestJob,
  sendJson,
  stringParam,
} = require("../_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;

  if (!cronAuthorised(req)) {
    sendJson(res, 401, {
      error: "Prediction collection requires CRON_SECRET authorisation.",
      predictions: await predictionStatus(),
    });
    return;
  }

  try {
    const body = req.body || {};
    sendJson(
      res,
      202,
      await runPredictionMarketBacktestJob({
        limit: numberParam(req.query.limit || body.limit, undefined),
        now: stringParam(req.query.now || body.now),
        forceRefresh: String(req.query.forceRefresh || body.forceRefresh || "") === "1",
        dryRun: String(req.query.dryRun || body.dryRun || "") === "1",
      }),
    );
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Prediction collection failed",
      predictions: await predictionStatus(),
    });
  }
};
