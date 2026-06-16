const {
  listPredictionBacktests,
  methodAllowed,
  numberParam,
  predictionSignal,
  predictionStatus,
  recordPredictionBacktest,
  sendJson,
  stringParam,
} = require("./_backend");

module.exports = function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;

  try {
    if (req.method === "POST") {
      sendJson(res, 202, recordPredictionBacktest(req.body || {}));
      return;
    }

    const mode = stringParam(req.query.mode, "status");
    if (mode === "signal") {
      sendJson(
        res,
        200,
        predictionSignal({
          region: stringParam(req.query.region),
          fuel: stringParam(req.query.fuel),
          historyDays: numberParam(req.query.historyDays, 0),
          observedPriceCount: numberParam(req.query.observedPriceCount, 0),
        }),
      );
      return;
    }

    if (mode === "backtests") {
      sendJson(
        res,
        200,
        listPredictionBacktests({
          region: stringParam(req.query.region),
          fuel: stringParam(req.query.fuel),
          limit: numberParam(req.query.limit, 50),
        }),
      );
      return;
    }

    sendJson(res, 200, predictionStatus());
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Invalid prediction back-test request",
      predictions: predictionStatus(),
    });
  }
};
