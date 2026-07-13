const {
  alertsStatus,
  alertsAdminWriteAuthorised,
  alertRecordsReadAuthorised,
  alertsWriteAuthorised,
  alertsWriteSecurity,
  deleteBackendSavedRoute,
  evaluateSavedRouteAlert,
  enrolRouteWatch,
  validateSavedRouteAlertDelivery,
  issueAlertClientCapability,
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
const { publicErrorMessage } = require("./_publicErrors");

module.exports = async function handler(req, res) {
  if (req.query?.__endpoint === "saved-routes") {
    return savedRoutesEndpoint(req, res);
  }
  if (!methodAllowed(req, res, ["GET", "POST"])) return;

  try {
    if (req.method === "GET") {
      const mode = stringParam(req.query.mode, "status");
      if (["routes", "devices", "evaluations"].includes(mode) && !alertRecordsReadAuthorised(req)) {
        sendJson(res, 401, { error: "Alert records require operator authorisation." });
        return;
      }
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

    const action = stringParam(req.query.action || req.body?.action, "evaluate");
    if (action === "client-capability") {
      const capability = await issueAlertClientCapability(req.body || {}, req);
      const rateLimited = Number(capability.retryAfterSeconds) > 0;
      if (rateLimited) res.setHeader?.("Retry-After", String(capability.retryAfterSeconds));
      sendJson(res, capability.accepted ? 202 : rateLimited ? 429 : 403, capability);
      return;
    }

    if (action === "validation-delivery") {
      if (!alertsAdminWriteAuthorised(req)) {
        sendJson(res, 401, { error: "Validation delivery is not authorised." });
        return;
      }
      const result = await validateSavedRouteAlertDelivery(req.body || {});
      sendJson(res, result.accepted ? 202 : 409, result);
      return;
    }

    if (action === "evaluate" && !alertsAdminWriteAuthorised(req)) {
      sendJson(res, 401, { error: "Alert evaluation requires operator authorisation." });
      return;
    }

    if (!alertsWriteAuthorised(req)) {
      const writeSecurity = alertsWriteSecurity();
      sendJson(res, 401, {
        error: writeSecurity.tokenConfigured
          ? "Route watch sync is not available in this session."
          : "Route watch sync is not available yet.",
        alerts: await alertsStatus(),
      });
      return;
    }

    if (action === "register-device") {
      const input = await capabilityOwnedInput(req, req.body || {});
      if (!input) return sendJson(res, 401, { error: "Route watch sync requires an installation capability." });
      sendJson(res, 202, await registerPushDevice(input));
      return;
    }
    if (action === "enrol-watch") {
      const input = await capabilityOwnedInput(req, req.body || {});
      if (!input) return sendJson(res, 401, { status: "backend_rejected", code: "capability_required" });
      sendJson(res, 202, await enrolRouteWatch(input));
      return;
    }
    if (action === "save-route") {
      const input = await capabilityOwnedInput(req, req.body || {});
      if (!input) return sendJson(res, 401, { error: "Route watch sync requires an installation capability." });
      sendJson(res, 202, await saveBackendSavedRoute(input));
      return;
    }
    if (action === "delete-route") {
      const input = await capabilityOwnedInput(req, req.body || {});
      if (!input) return sendJson(res, 401, { error: "Route watch sync requires an installation capability." });
      sendJson(res, 202, await deleteBackendSavedRoute(input));
      return;
    }
    if (action === "delete-installation-data") {
      const subject = await alertsWriteAuthorised.subjectFor?.(req);
      if (!subject) return sendJson(res, 401, { error: "Alert-data deletion requires an installation capability." });
      sendJson(res, 202, await deleteBackendSavedRoute.allForInstallation(subject.installationId));
      return;
    }
    if (action === "evaluate") {
      sendJson(res, 202, await evaluateSavedRouteAlert(req.body || {}));
      return;
    }

    sendJson(res, 400, {
      error: "That route watch action is not available.",
      supportedActions: ["enrol-watch", "register-device", "save-route", "delete-route", "delete-installation-data", "evaluate"],
      alerts: await alertsStatus(),
    });
  } catch (error) {
    sendJson(res, 400, {
      error: publicErrorMessage(error, "alerts"),
      alerts: await alertsStatus(),
    });
  }
};

async function savedRoutesEndpoint(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST", "DELETE"])) return;

  try {
    if (req.method === "GET") {
      const subject = await alertsWriteAuthorised.subjectFor?.(req);
      if (!subject && !alertRecordsReadAuthorised(req)) {
        sendJson(res, 401, { error: "Saved routes require installation or operator authorisation." });
        return;
      }
      sendJson(
        res,
        200,
        await listBackendSavedRoutes({
          userId: subject?.installationId || stringParam(req.query.userId),
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
          ? "Saved route sync is not available in this session."
          : "Saved route sync is not available yet.",
        alerts: await alertsStatus(),
      });
      return;
    }

    if (req.method === "DELETE") {
      const input = await capabilityOwnedInput(req, {
          routeId: stringParam(req.query.routeId || req.query.id || req.body?.routeId || req.body?.id),
          userId: stringParam(req.query.userId || req.body?.userId),
      });
      if (!input) return sendJson(res, 401, { error: "Saved route sync requires an installation capability." });
      sendJson(res, 202, await deleteBackendSavedRoute(input));
      return;
    }

    const input = await capabilityOwnedInput(req, req.body || {});
    if (!input) return sendJson(res, 401, { error: "Saved route sync requires an installation capability." });
    sendJson(res, 202, await saveBackendSavedRoute(input));
  } catch (error) {
    sendJson(res, 400, {
      error: publicErrorMessage(error, "alerts"),
      alerts: await alertsStatus(),
    });
  }
}

async function capabilityOwnedInput(req, input) {
  const subject = await alertsWriteAuthorised.subjectFor?.(req);
  if (subject) {
    return {
      ...input,
      userId: subject.installationId,
      deviceId: subject.installationId,
    };
  }
  return alertsAdminWriteAuthorised(req) ? input : null;
}
