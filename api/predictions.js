const {
  listPredictionBacktests,
  boolParam,
  cronAuthorised,
  methodAllowed,
  numberParam,
  predictionSignal,
  predictionStatus,
  predictionWriteAuthorised,
  predictionWriteSecurity,
  recordPredictionBacktest,
  runPredictionMarketBacktestJob,
  sendJson,
  stringParam,
} = require("./_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;

  try {
    if (req.method === "POST") {
      if (!predictionWriteAuthorised(req)) {
        const writeSecurity = predictionWriteSecurity();
        sendJson(res, 401, {
          error: writeSecurity.tokenConfigured
            ? "Prediction back-test writes require a valid token."
            : "Prediction back-test writes require PREDICTION_BACKTEST_WRITE_TOKEN before durable storage is enabled.",
          predictions: await predictionStatus(),
        });
        return;
      }
      sendJson(res, 202, await recordPredictionBacktest(req.body || {}));
      return;
    }

    const mode = stringParam(req.query.mode, "status");
    if (mode === "collect") {
      if (!cronAuthorised(req) && !predictionWriteAuthorised(req)) {
        const writeSecurity = predictionWriteSecurity();
        sendJson(res, 401, {
          error: writeSecurity.tokenConfigured
            ? "Prediction back-test collection requires CRON_SECRET or a valid prediction write token."
            : "Prediction back-test collection requires CRON_SECRET or PREDICTION_BACKTEST_WRITE_TOKEN.",
          predictions: await predictionStatus(),
        });
        return;
      }
      const body = req.body || {};
      sendJson(
        res,
        202,
        await runPredictionMarketBacktestJob({
          limit: req.query.limit || body.limit,
          now: stringParam(req.query.now || body.now),
          forceRefresh: boolParam(req.query.forceRefresh || body.forceRefresh),
          dryRun: boolParam(req.query.dryRun || body.dryRun),
        }),
      );
      return;
    }

    if (mode === "signal") {
      sendJson(
        res,
        200,
        predictionSignal({
          region: stringParam(req.query.region),
          market: stringParam(req.query.market),
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
        await listPredictionBacktests({
          region: stringParam(req.query.region),
          fuel: stringParam(req.query.fuel),
          limit: numberParam(req.query.limit, 50),
        }),
      );
      return;
    }

    sendJson(res, 200, await predictionStatus());
  } catch (error) {
    sendJson(res, error.statusCode || 400, {
      error: error instanceof Error ? error.message : "Invalid prediction back-test request",
      predictions: await predictionStatus(),
    });
  }
};
