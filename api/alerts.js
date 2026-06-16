const {
  alertsStatus,
  alertsWriteAuthorised,
  alertsWriteSecurity,
  evaluateSavedRouteAlert,
  listBackendAlertEvaluations,
  listBackendPushDevices,
  listBackendSavedRoutes,
  methodAllowed,
  numberParam,
  registerPushDevice,
  saveBackendSavedRoute,
  sendJson,
  stringParam,
} = require("./_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;

  try {
    if (req.method === "GET") {
      const mode = stringParam(req.query.mode, "status");
      if (mode === "routes") {
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
      if (mode === "devices") {
        sendJson(
          res,
          200,
          await listBackendPushDevices({
            userId: stringParam(req.query.userId),
            status: stringParam(req.query.status, "active"),
            limit: numberParam(req.query.limit, 50),
          }),
        );
        return;
      }
      if (mode === "evaluations") {
        sendJson(
          res,
          200,
          await listBackendAlertEvaluations({
            routeId: stringParam(req.query.routeId),
            userId: stringParam(req.query.userId),
            limit: numberParam(req.query.limit, 50),
          }),
        );
        return;
      }
      sendJson(res, 200, { alerts: await alertsStatus() });
      return;
    }

    if (!alertsWriteAuthorised(req)) {
      const writeSecurity = alertsWriteSecurity();
      sendJson(res, 401, {
        error: writeSecurity.tokenConfigured
          ? "Saved-route alert writes require a valid token."
          : "Saved-route alert writes require ALERTS_WRITE_TOKEN before durable storage is enabled.",
        alerts: await alertsStatus(),
      });
      return;
    }

    const action = stringParam(req.query.action || req.body?.action, "evaluate");
    if (action === "register-device") {
      sendJson(res, 202, await registerPushDevice(req.body || {}));
      return;
    }
    if (action === "save-route") {
      sendJson(res, 202, await saveBackendSavedRoute(req.body || {}));
      return;
    }
    if (action === "evaluate") {
      sendJson(res, 202, await evaluateSavedRouteAlert(req.body || {}));
      return;
    }

    sendJson(res, 400, {
      error: "Unsupported alert action.",
      supportedActions: ["register-device", "save-route", "evaluate"],
      alerts: await alertsStatus(),
    });
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Invalid saved-route alert request",
      alerts: await alertsStatus(),
    });
  }
};
