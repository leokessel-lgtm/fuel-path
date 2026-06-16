const {
  alertsStatus,
  alertsWriteAuthorised,
  alertsWriteSecurity,
  listBackendSavedRoutes,
  methodAllowed,
  numberParam,
  saveBackendSavedRoute,
  sendJson,
  stringParam,
} = require("./_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;

  try {
    if (req.method === "GET") {
      sendJson(
        res,
        200,
        await listBackendSavedRoutes({
          userId: stringParam(req.query.userId),
          enabledOnly: stringParam(req.query.enabledOnly) === "1",
          limit: numberParam(req.query.limit, 50),
        }),
      );
      return;
    }

    if (!alertsWriteAuthorised(req)) {
      const writeSecurity = alertsWriteSecurity();
      sendJson(res, 401, {
        error: writeSecurity.tokenConfigured
          ? "Saved route sync requires a valid token."
          : "Saved route sync requires ALERTS_WRITE_TOKEN before durable storage is enabled.",
        alerts: await alertsStatus(),
      });
      return;
    }

    sendJson(res, 202, await saveBackendSavedRoute(req.body || {}));
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Invalid saved route request",
      alerts: await alertsStatus(),
    });
  }
};
