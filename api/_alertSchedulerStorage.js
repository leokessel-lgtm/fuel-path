const { randomUUID } = require("node:crypto");
const {
  assertProductDatabaseSchema,
  createProductSqlClient,
  productDatabaseUrl,
} = require("./_productDatabase");
const { rowToRoute } = require("./_alertRecords");

const MAX_BATCH_SIZE = 500;
let sqlClient;
let testStorage;

async function claimDueSavedRoutes({ limit = 50, now, leaseSeconds = 300, ignoreWindow = false } = {}) {
  const claimedAt = validIsoDate(now) || new Date().toISOString();
  const safeLimit = boundedInteger(limit, 1, MAX_BATCH_SIZE, 50);
  const safeLeaseSeconds = boundedInteger(leaseSeconds, 30, 1800, 300);
  const leaseToken = `alert-lease-${randomUUID()}`;
  if (testStorage?.claimDueSavedRoutes) {
    return testStorage.claimDueSavedRoutes({
      limit: safeLimit,
      now: claimedAt,
      leaseSeconds: safeLeaseSeconds,
      leaseToken,
      ignoreWindow,
    });
  }
  const sql = await durableSql();
  const rows = await sql`
    WITH due AS (
      SELECT user_id, id
      FROM fuel_path_saved_routes
      WHERE alert_enabled = true
        AND (alert_lease_expires_at IS NULL OR alert_lease_expires_at <= ${claimedAt})
        AND (${ignoreWindow} OR alert_next_evaluation_at IS NULL OR alert_next_evaluation_at <= ${claimedAt})
      ORDER BY alert_next_evaluation_at ASC NULLS FIRST, updated_at ASC, user_id ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${safeLimit}
    ), claimed AS (
      UPDATE fuel_path_saved_routes AS route
      SET alert_lease_token = ${leaseToken},
          alert_lease_expires_at = ${claimedAt}::timestamptz + (${safeLeaseSeconds} * INTERVAL '1 second')
      FROM due
      WHERE route.user_id = due.user_id AND route.id = due.id
      RETURNING route.*
    )
    SELECT * FROM claimed
    ORDER BY alert_next_evaluation_at ASC NULLS FIRST, updated_at ASC, user_id ASC, id ASC
  `;
  return rows.map((row) => ({
    ...rowToRoute(row),
    alertLeaseToken: row.alert_lease_token,
    alertLeaseExpiresAt: row.alert_lease_expires_at ? new Date(row.alert_lease_expires_at).toISOString() : undefined,
  }));
}

async function completeSavedRouteAlertLease({ routeId, userId, leaseToken, evaluatedAt, nextEvaluationAt } = {}) {
  if (testStorage?.completeSavedRouteAlertLease) {
    return testStorage.completeSavedRouteAlertLease({ routeId, userId, leaseToken, evaluatedAt, nextEvaluationAt });
  }
  const sql = await durableSql();
  const rows = await sql`
    UPDATE fuel_path_saved_routes
    SET alert_last_evaluated_at = ${evaluatedAt},
        alert_next_evaluation_at = ${nextEvaluationAt},
        alert_lease_token = NULL,
        alert_lease_expires_at = NULL
    WHERE id = ${routeId} AND user_id = ${userId} AND alert_lease_token = ${leaseToken}
    RETURNING *
  `;
  return rows[0] ? rowToRoute(rows[0]) : null;
}

async function retrySavedRouteAlertLease({ routeId, userId, leaseToken, retryAt } = {}) {
  if (testStorage?.retrySavedRouteAlertLease) {
    return testStorage.retrySavedRouteAlertLease({ routeId, userId, leaseToken, retryAt });
  }
  const sql = await durableSql();
  const rows = await sql`
    UPDATE fuel_path_saved_routes
    SET alert_next_evaluation_at = ${retryAt}, alert_lease_token = NULL, alert_lease_expires_at = NULL
    WHERE id = ${routeId} AND user_id = ${userId} AND alert_lease_token = ${leaseToken}
    RETURNING *
  `;
  return rows[0] ? rowToRoute(rows[0]) : null;
}

async function savedRouteAlertLeaseActive({ routeId, userId, leaseToken, now } = {}) {
  const checkedAt = validIsoDate(now) || new Date().toISOString();
  if (testStorage?.savedRouteAlertLeaseActive) {
    return testStorage.savedRouteAlertLeaseActive({ routeId, userId, leaseToken, now: checkedAt });
  }
  const sql = await durableSql();
  const rows = await sql`
    SELECT 1 AS active
    FROM fuel_path_saved_routes
    WHERE id = ${routeId} AND user_id = ${userId} AND alert_enabled = true
      AND alert_lease_token = ${leaseToken} AND alert_lease_expires_at > ${checkedAt}
    LIMIT 1
  `;
  return rows[0]?.active === 1 || rows[0]?.active === "1";
}

function setAlertSchedulerStorageForTests(storage) {
  testStorage = storage || null;
}

async function durableSql() {
  const connectionString = productDatabaseUrl();
  if (!connectionString) throw new Error("Durable alert storage is required for scheduled route claims");
  if (!sqlClient) sqlClient = createProductSqlClient(connectionString);
  await assertProductDatabaseSchema(sqlClient);
  return sqlClient;
}

function validIsoDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

function boundedInteger(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

module.exports = {
  claimDueSavedRoutes,
  completeSavedRouteAlertLease,
  retrySavedRouteAlertLease,
  savedRouteAlertLeaseActive,
  setAlertSchedulerStorageForTests,
};
