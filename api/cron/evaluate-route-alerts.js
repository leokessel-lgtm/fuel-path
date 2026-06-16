const {
  alertsStatus,
  cronAuthorised,
  methodAllowed,
  numberParam,
  runScheduledRouteAlertEvaluation,
  sendJson,
  stringParam,
} = require("../_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;

  if (!cronAuthorised(req)) {
    sendJson(res, 401, {
      error: "Scheduled alert evaluation requires CRON_SECRET authorisation.",
      alerts: await alertsStatus(),
    });
    return;
  }

  try {
    const body = req.body || {};
    sendJson(
      res,
      202,
      await runScheduledRouteAlertEvaluation({
        limit: numberParam(req.query.limit || body.limit, 50),
        now: stringParam(req.query.now || body.now),
        ignoreWindow: stringParam(req.query.ignoreWindow || body.ignoreWindow) === "1",
      }),
    );
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Scheduled alert evaluation failed",
      alerts: await alertsStatus(),
    });
  }
};
