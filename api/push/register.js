const {
  alertsStatus,
  alertsWriteAuthorised,
  alertsWriteSecurity,
  methodAllowed,
  registerPushDevice,
  sendJson,
} = require("../_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;

  try {
    if (!alertsWriteAuthorised(req)) {
      const writeSecurity = alertsWriteSecurity();
      sendJson(res, 401, {
        error: writeSecurity.tokenConfigured
          ? "Push device registration requires a valid token."
          : "Push device registration requires ALERTS_WRITE_TOKEN before durable storage is enabled.",
        alerts: await alertsStatus(),
      });
      return;
    }

    sendJson(res, 202, await registerPushDevice(req.body || {}));
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Invalid push device registration",
      alerts: await alertsStatus(),
    });
  }
};
