const {
  alertsStatus,
  alertsWriteAuthorised,
  alertsWriteSecurity,
  methodAllowed,
  registerPushDevice,
  sendJson,
} = require("../_backend");
const { publicErrorMessage } = require("../_publicErrors");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;

  try {
    if (!alertsWriteAuthorised(req)) {
      const writeSecurity = alertsWriteSecurity();
      sendJson(res, 401, {
        error: writeSecurity.tokenConfigured
          ? "Notifications cannot sync from this session."
          : "Notifications are not available yet.",
        alerts: await alertsStatus(),
      });
      return;
    }

    sendJson(res, 202, await registerPushDevice(req.body || {}));
  } catch (error) {
    sendJson(res, 400, {
      error: publicErrorMessage(error, "alerts"),
      alerts: await alertsStatus(),
    });
  }
};
