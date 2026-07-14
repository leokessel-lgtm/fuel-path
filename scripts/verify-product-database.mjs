import assert from "node:assert/strict";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const { Client } = require("pg");
const {
  appendRouteAlertEvaluation,
  enrolPushDeviceAndSavedRoute,
  listPushDevices,
  listRouteAlertEvaluations,
  listSavedRoutes,
  updateRouteAlertDelivery,
} = require("../api/_alertStorage");
const {
  consumeAlertRateLimit,
  deleteInstallationAlertData,
  getAnonymousInstallation,
  registerAnonymousInstallation,
} = require("../api/_alertInstallationStorage");
const {
  getGeocodeQuotaUsage,
  reserveGeocodeQuota,
} = require("../api/_geocodeQuotaStorage");
const {
  appendPredictionBacktestRecord,
  appendPredictionMarketSnapshotRecord,
  listPredictionBacktestRecords,
  listPredictionMarketSnapshotRecords,
} = require("../api/_predictionStorage");
const {
  normaliseBackendSavedRoute,
  normalisePushDevice,
} = require("../api/_alertRecords");

const connectionString = process.env.DATABASE_URL || "";
if (!connectionString) {
  throw new Error("Set DATABASE_URL to the product-state Postgres database before verification.");
}

const runId = `verify_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const installationId = `${runId}_installation`;
const routeId = `${runId}_route`;
const evaluationId = `${runId}_evaluation`;
const failedDeviceId = `${runId}_rollback_device`;
const quotaKey = `${runId}_quota`;
const predictionId = `${runId}_prediction`;
const snapshotId = `${runId}_snapshot`;
const now = new Date().toISOString();
const today = now.slice(0, 10);
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const client = new Client({ connectionString });
let connected = false;

try {
  await client.connect();
  connected = true;
  await verifySchemaAndMigrations();
  await verifyAnonymousInstallationAndRateLimit();
  await verifyAtomicRouteWatchEnrolment();
  await verifyAlertEvaluationIdempotency();
  await verifyQuotaPersistence();
  await verifyPredictionPersistence();
  await verifyPrivacyDeletion();
  console.log("Product database verification passed: schema, migrations, alerts, rollback, quota, predictions and deletion.");
} finally {
  await cleanup();
  await client.end();
}

async function verifySchemaAndMigrations() {
  const expectedTables = [
    "fuel_path_alert_installations",
    "fuel_path_alert_rate_limits",
    "fuel_path_geocode_quotas",
    "fuel_path_market_price_snapshots",
    "fuel_path_prediction_backtests",
    "fuel_path_push_devices",
    "fuel_path_route_alert_evaluations",
    "fuel_path_saved_routes",
  ];
  const tables = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'fuel_path_%'
    ORDER BY tablename
  `);
  assert.deepEqual(tables.rows.map((row) => row.tablename), expectedTables);

  const migrations = await client.query("SELECT name FROM pgmigrations ORDER BY name");
  assert.deepEqual(migrations.rows.map((row) => row.name), [
    "1762948800000_product_state_baseline",
    "1763035200000_anonymous_alert_installations",
    "1783987200000_alert_due_work_leases",
  ]);
  const schedulingColumns = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fuel_path_saved_routes'
      AND column_name IN (
        'alert_next_evaluation_at',
        'alert_last_evaluated_at',
        'alert_lease_token',
        'alert_lease_expires_at'
      )
    ORDER BY column_name
  `);
  assert.deepEqual(schedulingColumns.rows.map((row) => row.column_name), [
    "alert_last_evaluated_at",
    "alert_lease_expires_at",
    "alert_lease_token",
    "alert_next_evaluation_at",
  ]);
  const schedulingIndexes = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('fuel_path_saved_routes_due_alert_idx', 'fuel_path_saved_routes_alert_lease_idx')
    ORDER BY indexname
  `);
  assert.deepEqual(schedulingIndexes.rows.map((row) => row.indexname), [
    "fuel_path_saved_routes_alert_lease_idx",
    "fuel_path_saved_routes_due_alert_idx",
  ]);
  const dueIndex = schedulingIndexes.rows.find((row) => row.indexname === "fuel_path_saved_routes_due_alert_idx");
  assert.match(dueIndex?.indexdef || "", /alert_next_evaluation_at NULLS FIRST/);
}

async function verifyAnonymousInstallationAndRateLimit() {
  const created = await registerAnonymousInstallation({
    installationId,
    secretHash: `${runId}_secret_hash`,
    now,
  });
  assert.equal(created.installationId, installationId);
  const stored = await getAnonymousInstallation(installationId);
  assert.equal(stored?.secretHash, `${runId}_secret_hash`);
  assert.equal(stored?.revokedAt, undefined);

  const first = await consumeAlertRateLimit({
    rateKey: `${runId}_rate`,
    action: "verify",
    now,
    limit: 1,
  });
  const second = await consumeAlertRateLimit({
    rateKey: `${runId}_rate`,
    action: "verify",
    now,
    limit: 1,
  });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
}

async function verifyAtomicRouteWatchEnrolment() {
  const device = normalisePushDevice({
    userId: installationId,
    deviceId: `${runId}_device`,
    expoPushToken: `ExponentPushToken[${runId}]`,
    platform: "android",
    appVersion: "database-verifier",
    lastSeenAt: now,
  });
  const route = normaliseBackendSavedRoute({
    id: routeId,
    userId: installationId,
    name: "Database verification route",
    from: { lat: -33.8688, lon: 151.2093, label: "Sydney NSW" },
    to: { lat: -33.815, lon: 151.0011, label: "Parramatta NSW" },
    fuel: "U91",
    alertEnabled: true,
    alertTimeLocal: "07:30",
    alertDays: ["mon", "tue", "wed", "thu", "fri"],
    timezone: "Australia/Sydney",
    minSavingDollars: 5,
    maxDetourMinutes: 8,
    createdAt: now,
  });
  await enrolPushDeviceAndSavedRoute({ device, route });
  assert.equal((await listPushDevices({ userId: installationId })).length, 1);
  assert.equal((await listSavedRoutes({ userId: installationId })).length, 1);

  const failedDevice = { ...device, id: failedDeviceId, deviceId: failedDeviceId };
  const invalidRoute = { ...route, id: `${runId}_invalid_route`, to: { ...route.to, label: null } };
  await assert.rejects(
    enrolPushDeviceAndSavedRoute({ device: failedDevice, route: invalidRoute }),
    /null value|not-null constraint/i,
  );
  const rolledBack = await client.query(
    "SELECT id FROM fuel_path_push_devices WHERE id = $1",
    [failedDeviceId],
  );
  assert.equal(rolledBack.rowCount, 0, "failed enrolment must not leave a device row behind");
}

async function verifyAlertEvaluationIdempotency() {
  const evaluation = {
    id: evaluationId,
    routeId,
    userId: installationId,
    status: "sendable",
    reason: "database_verification",
    estimatedSavingDollars: 7.5,
    detourMinutes: 4,
    freshnessMinutes: 3,
    messageTitle: "Database verification",
    messageBody: "This row is deleted before verification completes.",
    evaluatedAt: now,
    pushDeliveryEnabled: false,
  };
  const first = await appendRouteAlertEvaluation(evaluation);
  const second = await appendRouteAlertEvaluation(evaluation);
  assert.equal(first.id, evaluationId);
  assert.equal(second._alreadyRecorded, true);
  const updated = await updateRouteAlertDelivery({
    evaluationId,
    pushTicketId: `${runId}_ticket`,
    pushReceiptStatus: "ok",
  });
  assert.equal(updated?.pushReceiptStatus, "ok");
  assert.equal((await listRouteAlertEvaluations({ userId: installationId })).length, 1);
}

async function verifyQuotaPersistence() {
  const first = await reserveGeocodeQuota({ quotaKey, date: today, cap: 2 });
  const second = await reserveGeocodeQuota({ quotaKey, date: today, cap: 2 });
  const blocked = await reserveGeocodeQuota({ quotaKey, date: today, cap: 2 });
  assert.deepEqual([first.allowed, second.allowed, blocked.allowed], [true, true, false]);
  const usage = await getGeocodeQuotaUsage({ quotaKey, date: today });
  assert.equal(usage.calls, 2);
  assert.equal(usage.durable, true);
}

async function verifyPredictionPersistence() {
  await appendPredictionBacktestRecord({
    id: predictionId,
    region: "NSW",
    market: "sydney",
    fuel: "U91",
    targetDate: tomorrow,
    predictionDate: today,
    modelVersion: "database-verifier-v1",
    predictedCpl: 180,
    actualCpl: 181,
    absoluteErrorCpl: 1,
    predictedDirection: "up",
    actualDirection: "up",
    directionMatched: true,
    recordedAt: now,
  });
  await appendPredictionMarketSnapshotRecord({
    id: snapshotId,
    region: "NSW",
    market: "sydney",
    fuel: "U91",
    observedDate: today,
    observedAt: now,
    medianCpl: 180,
    lowCpl: 170,
    highCpl: 190,
    exactPriceCount: 3,
    provider: "database-verifier",
    capability: "test",
    cacheMode: "none",
    cacheAgeSeconds: 0,
    warning: "",
  });
  assert.ok((await listPredictionBacktestRecords({ region: "NSW", fuel: "U91" }))
    .some((record) => record.id === predictionId));
  assert.ok((await listPredictionMarketSnapshotRecords({ market: "sydney", fuel: "U91" }))
    .some((record) => record.id === snapshotId));
}

async function verifyPrivacyDeletion() {
  const deleted = await deleteInstallationAlertData(installationId, now);
  assert.deepEqual(deleted, {
    deletedEvaluationCount: 1,
    deletedRouteCount: 1,
    deletedDeviceCount: 1,
    revoked: true,
  });
  assert.equal((await listPushDevices({ userId: installationId })).length, 0);
  assert.equal((await listSavedRoutes({ userId: installationId })).length, 0);
  assert.equal((await listRouteAlertEvaluations({ userId: installationId })).length, 0);
  assert.ok((await getAnonymousInstallation(installationId))?.revokedAt);
}

async function cleanup() {
  if (!connected) return;
  await client.query("DELETE FROM fuel_path_route_alert_evaluations WHERE user_id = $1 OR id = $2", [installationId, evaluationId]);
  await client.query("DELETE FROM fuel_path_saved_routes WHERE user_id = $1", [installationId]);
  await client.query("DELETE FROM fuel_path_push_devices WHERE user_id = $1 OR id = $2", [installationId, failedDeviceId]);
  await client.query("DELETE FROM fuel_path_alert_rate_limits WHERE rate_key LIKE $1", [`${runId}%`]);
  await client.query("DELETE FROM fuel_path_alert_installations WHERE installation_id = $1", [installationId]);
  await client.query("DELETE FROM fuel_path_geocode_quotas WHERE quota_key = $1", [quotaKey]);
  await client.query("DELETE FROM fuel_path_prediction_backtests WHERE id = $1", [predictionId]);
  await client.query("DELETE FROM fuel_path_market_price_snapshots WHERE id = $1", [snapshotId]);
}
