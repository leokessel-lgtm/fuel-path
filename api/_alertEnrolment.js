const { alertStorageStatus, enrolPushDeviceAndSavedRoute } = require("./_alertStorage");
const { normaliseBackendSavedRoute, normalisePushDevice } = require("./_alertRecords");

async function enrolBackendRouteWatch(input = {}, { alertsStatus } = {}) {
  if (!alertStorageStatus().durable) {
    throw new Error("Backend alert sync requires durable alert storage. Set DATABASE_URL or NEON_DATABASE_URL before syncing saved routes, devices or scheduled evaluations.");
  }
  const device = normalisePushDevice(input);
  const route = normaliseBackendSavedRoute(input);
  await enrolPushDeviceAndSavedRoute({ device, route });
  return { accepted: true, device, route, alerts: await alertsStatus() };
}

module.exports = { enrolBackendRouteWatch };
