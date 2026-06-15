const { alertsStatus, methodAllowed, sendJson } = require("./_backend");

module.exports = function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;

  if (req.method === "GET") {
    sendJson(res, 200, {
      alerts: alertsStatus(),
    });
    return;
  }

  sendJson(res, 501, {
    error: "Smart saved-route alerts are not enabled in hosted backend v1.",
    alerts: alertsStatus(),
    acceptedScope: "This endpoint is a contract marker only. Phone-side daily reminders remain local until backend storage, scheduler and push tokens are added.",
  });
};
