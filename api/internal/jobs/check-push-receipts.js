const {
  alertsStatus,
  alertsWriteAuthorised,
  checkPushReceipts,
  cronAuthorised,
  methodAllowed,
  numberParam,
  sendJson,
} = require("../../_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;

  if (!cronAuthorised(req) && !alertsWriteAuthorised(req)) {
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
};
