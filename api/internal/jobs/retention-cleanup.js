const {
  alertsStatus,
  boolParam,
  methodAllowed,
  numberParam,
  retentionCleanupAuthorised,
  runRetentionCleanup,
  sendJson,
  stringParam,
} = require("../../_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;

  if (!retentionCleanupAuthorised(req)) {
    sendJson(res, 401, {
      error: "Retention cleanup requires CRON_SECRET or ALERTS_WRITE_TOKEN authorisation.",
      alerts: await alertsStatus(),
    });
    return;
  }

  try {
    const body = req.body || {};
    sendJson(
      res,
      202,
      await runRetentionCleanup({
        now: stringParam(req.query.now || body.now),
        dryRun: boolParam(req.query.dryRun || body.dryRun, false),
        inactiveDeviceDays: numberParam(req.query.inactiveDeviceDays || body.inactiveDeviceDays, 90),
        disabledRouteDays: numberParam(req.query.disabledRouteDays || body.disabledRouteDays, 90),
        alertEvaluationDays: numberParam(req.query.alertEvaluationDays || body.alertEvaluationDays, 180),
        predictionBacktestDays: numberParam(req.query.predictionBacktestDays || body.predictionBacktestDays, 365),
      }),
    );
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Retention cleanup failed",
      alerts: await alertsStatus(),
    });
  }
};
