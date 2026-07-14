const {
  alertsStatus,
  alertsAdminWriteAuthorised,
  alertsWriteAuthorised,
  alertsWriteSecurity,
  logServerError,
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

    const subject = await alertsWriteAuthorised.subjectFor?.(req);
    if (!subject && !alertsAdminWriteAuthorised(req)) {
      sendJson(res, 401, { error: "Notifications require an installation capability." });
      return;
    }
    const input = subject
      ? { ...(req.body || {}), userId: subject.installationId, deviceId: subject.installationId }
      : (req.body || {});
    sendJson(res, 202, await registerPushDevice(input));
  } catch (error) {
    logServerError("push-register", error);
    sendJson(res, 400, {
      error: publicErrorMessage(error, "alerts"),
      alerts: await alertsStatus(),
    });
  }
};
