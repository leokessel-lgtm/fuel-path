const {
  buildRoute,
  methodAllowed,
  pointFromQuery,
  sendJson,
} = require("./_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  try {
    const from = pointFromQuery(req, "from");
    const to = pointFromQuery(req, "to");
    sendJson(res, 200, await buildRoute({ from, to }));
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Route not found",
    });
  }
};
