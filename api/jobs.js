const {
  alertsAdminWriteAuthorised,
  alertsStatus,
  alertsWriteAuthorised,
  boolParam,
  checkPushReceipts,
  cronAuthorised,
  methodAllowed,
  numberParam,
  retentionCleanupAuthorised,
  runRetentionCleanup,
  runScheduledRouteAlertEvaluation,
  sendJson,
  stringParam,
} = require("./_backend");

module.exports = async function handler(req, res) {
  const job = stringParam(req.query.job || req.query.__job);
  if (job === "evaluate-route-alerts") return evaluateRouteAlerts(req, res);
  if (job === "check-push-receipts") return checkPushReceiptsJob(req, res);
  if (job === "retention-cleanup") return retentionCleanupJob(req, res);

  sendJson(res, 404, {
    error: "Unknown internal job.",
    supportedJobs: ["evaluate-route-alerts", "check-push-receipts", "retention-cleanup"],
  });
};

async function evaluateRouteAlerts(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;

  if (!cronAuthorised(req) && !alertsAdminWriteAuthorised(req)) {
    sendJson(res, 401, {
      error: "Alert evaluation job requires CRON_SECRET or ALERTS_WRITE_TOKEN authorisation.",
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
      error: error instanceof Error ? error.message : "Alert evaluation job failed",
      alerts: await alertsStatus(),
    });
  }
}

async function checkPushReceiptsJob(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;

  if (!cronAuthorised(req) && !alertsAdminWriteAuthorised(req)) {
    sendJson(res, 401, {
      error: "Push receipt job requires CRON_SECRET or ALERTS_WRITE_TOKEN authorisation.",
      alerts: await alertsStatus(),
    });
    return;
  }

  try {
    const body = req.body || {};
    sendJson(
      res,
      202,
      await checkPushReceipts({
        limit: numberParam(req.query.limit || body.limit, 100),
      }),
    );
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Push receipt job failed",
      alerts: await alertsStatus(),
    });
  }
}

async function retentionCleanupJob(req, res) {
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
}
