const { assertAlertInstallationSchema, createProductSqlClient, productDatabaseUrl } = require("./_productDatabase");
const { isoDateTime } = require("./_alertRecords");

let sqlClient;
let testStorage;

async function registerAnonymousInstallation({
  installationId = "",
  secretHash = "",
  secretKeyVersion = "v1",
  now = new Date().toISOString(),
} = {}) {
  const safeId = cleanText(installationId);
  const safeHash = cleanText(secretHash);
  if (!safeId || !safeHash) throw new Error("installation identity is required");
  if (testStorage) {
    const installations = testStorage.__alertInstallations || (testStorage.__alertInstallations = new Map());
    const existing = installations.get(safeId);
    if (existing) {
      existing.lastSeenAt = now;
      return { ...existing, created: false };
    }
    const record = {
      installationId: safeId,
      secretHash: safeHash,
      secretKeyVersion,
      capabilityVersion: 1,
      createdAt: now,
      lastSeenAt: now,
      revokedAt: undefined,
    };
    installations.set(safeId, record);
    return { ...record, created: true };
  }
  const sql = await getSql();
  await assertAlertInstallationSchema(sql);
  await sql`
    INSERT INTO fuel_path_alert_installations (
      installation_id, secret_hash, secret_key_version, capability_version, created_at, last_seen_at
    )
    VALUES (${safeId}, ${safeHash}, ${secretKeyVersion}, 1, ${now}, ${now})
    ON CONFLICT (installation_id) DO NOTHING
  `;
  const record = await getAnonymousInstallation(safeId);
  if (!record) throw new Error("Anonymous installation could not be created.");
  if (record.secretHash === safeHash && !record.revokedAt) {
    await sql`
      UPDATE fuel_path_alert_installations SET last_seen_at = ${now}
      WHERE installation_id = ${safeId}
    `;
  }
  return { ...record, created: false };
}

async function getAnonymousInstallation(installationId = "") {
  const safeId = cleanText(installationId);
  if (!safeId) return null;
  if (testStorage) return testStorage.__alertInstallations?.get(safeId) || null;
  const sql = await getSql();
  await assertAlertInstallationSchema(sql);
  const rows = await sql`
    SELECT installation_id, secret_hash, secret_key_version, capability_version,
      created_at, last_seen_at, revoked_at
    FROM fuel_path_alert_installations
    WHERE installation_id = ${safeId}
    LIMIT 1
  `;
  const row = rows[0];
  return row ? {
    installationId: row.installation_id,
    secretHash: row.secret_hash,
    secretKeyVersion: row.secret_key_version,
    capabilityVersion: Number(row.capability_version || 1),
    createdAt: isoDateTime(row.created_at),
    lastSeenAt: isoDateTime(row.last_seen_at),
    revokedAt: row.revoked_at ? isoDateTime(row.revoked_at) : undefined,
  } : null;
}

async function consumeAlertRateLimit({ rateKey, action, now, windowSeconds = 60, limit = 20 } = {}) {
  const safeRateKey = cleanText(rateKey);
  const safeAction = cleanText(action);
  const safeNow = isoDateTime(now || new Date().toISOString());
  const cutoff = new Date(new Date(safeNow).getTime() - Math.max(1, windowSeconds) * 1000).toISOString();
  if (!safeRateKey || !safeAction) return { allowed: false, count: limit + 1 };
  if (testStorage) {
    const limits = testStorage.__alertRateLimits || (testStorage.__alertRateLimits = new Map());
    const key = `${safeRateKey}:${safeAction}`;
    const current = limits.get(key);
    const reset = !current || current.windowStartedAt <= cutoff;
    const next = { windowStartedAt: reset ? safeNow : current.windowStartedAt, count: reset ? 1 : current.count + 1 };
    limits.set(key, next);
    return { allowed: next.count <= limit, ...next };
  }
  const sql = await getSql();
  await assertAlertInstallationSchema(sql);
  const rows = await sql`
    INSERT INTO fuel_path_alert_rate_limits (rate_key, action, window_started_at, request_count)
    VALUES (${safeRateKey}, ${safeAction}, ${safeNow}, 1)
    ON CONFLICT (rate_key, action) DO UPDATE SET
      window_started_at = CASE
        WHEN fuel_path_alert_rate_limits.window_started_at <= ${cutoff} THEN EXCLUDED.window_started_at
        ELSE fuel_path_alert_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN fuel_path_alert_rate_limits.window_started_at <= ${cutoff} THEN 1
        ELSE fuel_path_alert_rate_limits.request_count + 1
      END
    RETURNING window_started_at, request_count
  `;
  const count = Number(rows[0]?.request_count || 1);
  return { allowed: count <= limit, count, windowStartedAt: isoDateTime(rows[0]?.window_started_at) };
}

async function deleteInstallationAlertData(installationId = "", now = new Date().toISOString()) {
  const safeId = cleanText(installationId);
  if (!safeId) throw new Error("installation identity is required");
  if (testStorage) {
    const removeOwned = (records) => {
      const kept = records.filter((item) => item.userId !== safeId);
      const removed = records.length - kept.length;
      records.splice(0, records.length, ...kept);
      return removed;
    };
    const installation = testStorage.__alertInstallations?.get(safeId);
    if (installation) {
      installation.revokedAt = now;
      installation.capabilityVersion = Number(installation.capabilityVersion || 1) + 1;
    }
    return {
      deletedDeviceCount: removeOwned(testStorage.devices || []),
      deletedRouteCount: removeOwned(testStorage.routes || []),
      deletedEvaluationCount: removeOwned(testStorage.evaluations || []),
      revoked: Boolean(installation),
    };
  }
  const sql = await getSql();
  await assertAlertInstallationSchema(sql);
  const rows = await sql`
    WITH deleted_evaluations AS (
      DELETE FROM fuel_path_route_alert_evaluations WHERE user_id = ${safeId} RETURNING id
    ), deleted_routes AS (
      DELETE FROM fuel_path_saved_routes WHERE user_id = ${safeId} RETURNING id
    ), deleted_devices AS (
      DELETE FROM fuel_path_push_devices WHERE user_id = ${safeId} RETURNING id
    ), revoked AS (
      UPDATE fuel_path_alert_installations
      SET revoked_at = ${now}, capability_version = capability_version + 1
      WHERE installation_id = ${safeId} AND revoked_at IS NULL
      RETURNING installation_id
    )
    SELECT
      (SELECT COUNT(*)::int FROM deleted_evaluations) AS evaluation_count,
      (SELECT COUNT(*)::int FROM deleted_routes) AS route_count,
      (SELECT COUNT(*)::int FROM deleted_devices) AS device_count,
      EXISTS(SELECT 1 FROM revoked) AS revoked
  `;
  return {
    deletedEvaluationCount: Number(rows[0]?.evaluation_count || 0),
    deletedRouteCount: Number(rows[0]?.route_count || 0),
    deletedDeviceCount: Number(rows[0]?.device_count || 0),
    revoked: Boolean(rows[0]?.revoked),
  };
}

function databaseUrl() {
  return productDatabaseUrl();
}

async function getSql() {
  if (!sqlClient) sqlClient = createProductSqlClient(databaseUrl());
  return sqlClient;
}

function cleanText(value) {
  return String(value || "").trim();
}

function setAlertInstallationStorageForTests(storage) {
  testStorage = storage || null;
}

module.exports = {
  consumeAlertRateLimit,
  deleteInstallationAlertData,
  getAnonymousInstallation,
  registerAnonymousInstallation,
  setAlertInstallationStorageForTests,
};
