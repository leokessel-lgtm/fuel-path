const { assertProductDatabaseSchema, createProductSqlClient, productDatabaseUrl } = require("./_productDatabase");
const { rowToDevice, rowToEvaluation, rowToRoute } = require("./_alertRecords");
const { setAlertInstallationStorageForTests } = require("./_alertInstallationStorage");

const DEFAULT_MAX_RECORDS = 500;
let sqlClient;
let testStorage;
const memoryStore = {
  devices: [],
  installations: [],
  routes: [],
  evaluations: [],
};

function alertStorageStatus({ maxRecords = DEFAULT_MAX_RECORDS } = {}) {
  if (testStorage) return testStorage.status({ maxRecords });

  if (!databaseUrl()) {
    return {
      mode: "memory_ephemeral",
      configured: false,
      durable: false,
      maxRecords,
      deviceCount: memoryStore.devices.length,
      routeCount: memoryStore.routes.length,
      evaluationCount: memoryStore.evaluations.length,
      nextBuildStep: "Use Neon/Postgres DATABASE_URL before enabling backend saved-route alert sync.",
    };
  }

  return {
    mode: "postgres_neon",
    configured: true,
    durable: true,
    maxRecords,
    tables: ["fuel_path_push_devices", "fuel_path_saved_routes", "fuel_path_route_alert_evaluations"],
    nextBuildStep: "Add scheduled evaluation and push delivery only after device-token validation.",
  };
}

async function counts() {
  if (testStorage?.counts) return testStorage.counts();
  if (!databaseUrl()) {
    return {
      deviceCount: memoryStore.devices.length,
      routeCount: memoryStore.routes.length,
      evaluationCount: memoryStore.evaluations.length,
    };
  }

  const sql = await getSql();
  await ensureTables(sql);
  const [devices, routes, evaluations] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM fuel_path_push_devices`,
    sql`SELECT COUNT(*)::int AS count FROM fuel_path_saved_routes`,
    sql`SELECT COUNT(*)::int AS count FROM fuel_path_route_alert_evaluations`,
  ]);
  return {
    deviceCount: Number(devices[0]?.count || 0),
    routeCount: Number(routes[0]?.count || 0),
    evaluationCount: Number(evaluations[0]?.count || 0),
  };
}

async function upsertPushDevice(record) {
  if (testStorage) return testStorage.upsertPushDevice(record);
  if (!databaseUrl()) return upsertMemory("devices", record);

  const sql = await getSql();
  await ensureTables(sql);
  await sql`
    WITH retired_token AS (
      UPDATE fuel_path_push_devices
      SET status = 'inactive', invalidated_at = ${record.lastSeenAt}
      WHERE expo_push_token = ${record.expoPushToken}
        AND id <> ${record.id}
        AND status = 'active'
    )
    INSERT INTO fuel_path_push_devices (
      id, user_id, device_id, platform, expo_push_token, app_version, status, last_seen_at, invalidated_at, raw
    )
    VALUES (
      ${record.id}, ${record.userId}, ${record.deviceId}, ${record.platform}, ${record.expoPushToken},
      ${record.appVersion}, ${record.status}, ${record.lastSeenAt}, ${record.invalidatedAt || null}, ${JSON.stringify(record)}
    )
    ON CONFLICT (id) DO UPDATE SET
      platform = EXCLUDED.platform,
      expo_push_token = EXCLUDED.expo_push_token,
      app_version = EXCLUDED.app_version,
      status = EXCLUDED.status,
      last_seen_at = EXCLUDED.last_seen_at,
      invalidated_at = EXCLUDED.invalidated_at,
      raw = EXCLUDED.raw
  `;
  return record;
}
async function upsertSavedRoute(record) {
  if (testStorage) return testStorage.upsertSavedRoute(record);
  if (!databaseUrl()) return upsertMemorySavedRoute(record);

  const sql = await getSql();
  await ensureTables(sql);
  const rows = await sql`
    INSERT INTO fuel_path_saved_routes (
      id, user_id, name, from_lat, from_lon, from_label, to_lat, to_lon, to_label, fuel,
      alert_enabled, alert_time_local, timezone, min_saving_dollars, max_detour_minutes,
      paused_until, last_alert_sent_at, created_at, updated_at, raw
    )
    VALUES (
      ${record.id}, ${record.userId}, ${record.name}, ${record.from.lat}, ${record.from.lon}, ${record.from.label},
      ${record.to.lat}, ${record.to.lon}, ${record.to.label}, ${record.fuel}, ${record.alertEnabled},
      ${record.alertTimeLocal}, ${record.timezone}, ${record.minSavingDollars}, ${record.maxDetourMinutes},
      ${record.pausedUntil || null}, ${record.lastAlertSentAt || null}, ${record.createdAt}, ${record.updatedAt},
      ${JSON.stringify(record)}
    )
    ON CONFLICT (user_id, id) DO UPDATE SET
      name = EXCLUDED.name,
      from_lat = EXCLUDED.from_lat,
      from_lon = EXCLUDED.from_lon,
      from_label = EXCLUDED.from_label,
      to_lat = EXCLUDED.to_lat,
      to_lon = EXCLUDED.to_lon,
      to_label = EXCLUDED.to_label,
      fuel = EXCLUDED.fuel,
      alert_enabled = EXCLUDED.alert_enabled,
      alert_time_local = EXCLUDED.alert_time_local,
      timezone = EXCLUDED.timezone,
      min_saving_dollars = EXCLUDED.min_saving_dollars,
      max_detour_minutes = EXCLUDED.max_detour_minutes,
      paused_until = EXCLUDED.paused_until,
      last_alert_sent_at = COALESCE(EXCLUDED.last_alert_sent_at, fuel_path_saved_routes.last_alert_sent_at),
      updated_at = EXCLUDED.updated_at,
      raw = EXCLUDED.raw
    RETURNING *
  `;
  return rows[0] ? rowToRoute(rows[0]) : record;
}

async function deleteSavedRoute({ routeId = "", userId = "" } = {}) {
  const safeRouteId = cleanText(routeId);
  const safeUserId = cleanText(userId);
  if (!safeRouteId) throw new Error("routeId is required");
  if (!safeUserId) throw new Error("userId is required for saved-route deletion");
  if (testStorage?.deleteSavedRoute) return testStorage.deleteSavedRoute({ routeId: safeRouteId, userId: safeUserId });
  if (!databaseUrl()) {
    const index = memoryStore.routes.findIndex((item) =>
      item.id === safeRouteId && item.userId === safeUserId
    );
    if (index < 0) return null;
    const [deleted] = memoryStore.routes.splice(index, 1);
    return deleted || null;
  }

  const sql = await getSql();
  await ensureTables(sql);
  const rows = await sql`
    DELETE FROM fuel_path_saved_routes
    WHERE id = ${safeRouteId} AND user_id = ${safeUserId}
    RETURNING *
  `;
  return rows[0] ? rowToRoute(rows[0]) : null;
}

async function appendRouteAlertEvaluation(record) {
  if (testStorage) return testStorage.appendRouteAlertEvaluation(record);
  if (!databaseUrl()) return appendMemoryEvaluation(record);

  const sql = await getSql();
  await ensureTables(sql);
  const inserted = await sql`
    INSERT INTO fuel_path_route_alert_evaluations (
      id, saved_route_id, user_id, status, reason, station_code, station_name,
      estimated_saving_dollars, detour_minutes, freshness_minutes, message_title, message_body,
      evaluated_at, push_delivery_enabled, push_ticket_id, push_receipt_status, raw
    )
    VALUES (
      ${record.id}, ${record.routeId}, ${record.userId}, ${record.status}, ${record.reason},
      ${record.stationCode || null}, ${record.stationName || null}, ${nullableNumber(record.estimatedSavingDollars)},
      ${nullableNumber(record.detourMinutes)}, ${nullableNumber(record.freshnessMinutes)}, ${record.messageTitle || null},
      ${record.messageBody || null}, ${record.evaluatedAt}, ${record.pushDeliveryEnabled},
      ${record.pushTicketId || null}, ${record.pushReceiptStatus || null}, ${JSON.stringify(record)}
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING *
  `;
  if (inserted[0]) return record;
  const existing = await sql`
    SELECT * FROM fuel_path_route_alert_evaluations
    WHERE id = ${record.id}
    LIMIT 1
  `;
  return existing[0] ? { ...rowToEvaluation(existing[0]), _alreadyRecorded: true } : record;
}

async function updateRouteAlertDelivery({ evaluationId, pushTicketId = "", pushReceiptStatus = "" } = {}) {
  if (testStorage?.updateRouteAlertDelivery) return testStorage.updateRouteAlertDelivery({ evaluationId, pushTicketId, pushReceiptStatus });
  if (!databaseUrl()) {
    const record = memoryStore.evaluations.find((item) => item.id === evaluationId);
    if (record) {
      if (pushTicketId) record.pushTicketId = pushTicketId;
      if (pushReceiptStatus) record.pushReceiptStatus = pushReceiptStatus;
    }
    return record || null;
  }

  const sql = await getSql();
  await ensureTables(sql);
  const rows = await sql`
    UPDATE fuel_path_route_alert_evaluations
    SET
      push_ticket_id = COALESCE(NULLIF(${pushTicketId}, ''), push_ticket_id),
      push_receipt_status = COALESCE(NULLIF(${pushReceiptStatus}, ''), push_receipt_status)
    WHERE id = ${evaluationId}
    RETURNING *
  `;
  return rows[0] ? rowToEvaluation(rows[0]) : null;
}

async function updateSavedRouteLastAlert(routeId, sentAt, userId = "") {
  if (testStorage?.updateSavedRouteLastAlert) return testStorage.updateSavedRouteLastAlert(routeId, sentAt, userId);
  if (!databaseUrl()) {
    const record = memoryStore.routes.find((item) =>
      item.id === routeId && (!userId || item.userId === userId)
    );
    if (record) record.lastAlertSentAt = sentAt;
    return record || null;
  }

  const sql = await getSql();
  await ensureTables(sql);
  const rows = await sql`
    UPDATE fuel_path_saved_routes
    SET last_alert_sent_at = ${sentAt}, updated_at = ${sentAt}
    WHERE id = ${routeId} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ? rowToRoute(rows[0]) : null;
}

async function updatePushDeviceStatus({ deviceId, status, invalidatedAt } = {}) {
  if (testStorage?.updatePushDeviceStatus) return testStorage.updatePushDeviceStatus({ deviceId, status, invalidatedAt });
  if (!databaseUrl()) {
    const record = memoryStore.devices.find((item) => item.id === deviceId || item.expoPushToken === deviceId);
    if (record) {
      record.status = status;
      record.invalidatedAt = invalidatedAt;
    }
    return record || null;
  }

  const sql = await getSql();
  await ensureTables(sql);
  const rows = await sql`
    UPDATE fuel_path_push_devices
    SET status = ${status}, invalidated_at = ${invalidatedAt || null}
    WHERE id = ${deviceId} OR expo_push_token = ${deviceId}
    RETURNING *
  `;
  return rows[0] ? rowToDevice(rows[0]) : null;
}

async function listPushDevices({ userId = "", status = "active", limit = 50 } = {}) {
  if (testStorage) return testStorage.listPushDevices({ userId, status, limit });
  if (!databaseUrl()) return filterMemory(memoryStore.devices, { userId, status, limit });

  const sql = await getSql();
  await ensureTables(sql);
  const safeUserId = cleanText(userId);
  const safeStatus = cleanText(status);
  const safeLimit = boundedLimit(limit);
  if (safeUserId && safeStatus) {
    return (await sql`
      SELECT * FROM fuel_path_push_devices
      WHERE user_id = ${safeUserId} AND status = ${safeStatus}
      ORDER BY last_seen_at DESC
      LIMIT ${safeLimit}
    `).map(rowToDevice);
  }
  if (safeUserId) {
    return (await sql`
      SELECT * FROM fuel_path_push_devices
      WHERE user_id = ${safeUserId}
      ORDER BY last_seen_at DESC
      LIMIT ${safeLimit}
    `).map(rowToDevice);
  }
  return (await sql`
    SELECT * FROM fuel_path_push_devices
    ORDER BY last_seen_at DESC
    LIMIT ${safeLimit}
  `).map(rowToDevice);
}

async function listSavedRoutes({ userId = "", enabledOnly = false, limit = 50 } = {}) {
  if (testStorage) return testStorage.listSavedRoutes({ userId, enabledOnly, limit });
  if (!databaseUrl()) {
    const routes = filterMemory(memoryStore.routes, { userId, limit });
    return enabledOnly ? routes.filter((route) => route.alertEnabled) : routes;
  }

  const sql = await getSql();
  await ensureTables(sql);
  const safeUserId = cleanText(userId);
  const safeLimit = boundedLimit(limit);
  if (safeUserId && enabledOnly) {
    return (await sql`
      SELECT * FROM fuel_path_saved_routes
      WHERE user_id = ${safeUserId} AND alert_enabled = true
      ORDER BY updated_at DESC
      LIMIT ${safeLimit}
    `).map(rowToRoute);
  }
  if (safeUserId) {
    return (await sql`
      SELECT * FROM fuel_path_saved_routes
      WHERE user_id = ${safeUserId}
      ORDER BY updated_at DESC
      LIMIT ${safeLimit}
    `).map(rowToRoute);
  }
  if (enabledOnly) {
    return (await sql`
      SELECT * FROM fuel_path_saved_routes
      WHERE alert_enabled = true
      ORDER BY updated_at DESC
      LIMIT ${safeLimit}
    `).map(rowToRoute);
  }
  return (await sql`
    SELECT * FROM fuel_path_saved_routes
    ORDER BY updated_at DESC
    LIMIT ${safeLimit}
  `).map(rowToRoute);
}

async function listRouteAlertEvaluations({ routeId = "", userId = "", limit = 50 } = {}) {
  if (testStorage) return testStorage.listRouteAlertEvaluations({ routeId, userId, limit });
  if (!databaseUrl()) {
    const safeRouteId = cleanText(routeId);
    return filterMemory(memoryStore.evaluations, { userId, limit })
      .filter((record) => !safeRouteId || record.routeId === safeRouteId);
  }

  const sql = await getSql();
  await ensureTables(sql);
  const safeRouteId = cleanText(routeId);
  const safeUserId = cleanText(userId);
  const safeLimit = boundedLimit(limit);
  if (safeRouteId) {
    return (await sql`
      SELECT * FROM fuel_path_route_alert_evaluations
      WHERE saved_route_id = ${safeRouteId}
      ORDER BY evaluated_at DESC
      LIMIT ${safeLimit}
    `).map(rowToEvaluation);
  }
  if (safeUserId) {
    return (await sql`
      SELECT * FROM fuel_path_route_alert_evaluations
      WHERE user_id = ${safeUserId}
      ORDER BY evaluated_at DESC
      LIMIT ${safeLimit}
    `).map(rowToEvaluation);
  }
  return (await sql`
    SELECT * FROM fuel_path_route_alert_evaluations
    ORDER BY evaluated_at DESC
    LIMIT ${safeLimit}
  `).map(rowToEvaluation);
}

async function listPendingPushTicketEvaluations({ limit = 100 } = {}) {
  if (testStorage?.listPendingPushTicketEvaluations) return testStorage.listPendingPushTicketEvaluations({ limit });
  if (!databaseUrl()) {
    return memoryStore.evaluations
      .filter((record) => record.pushTicketId && !record.pushReceiptStatus)
      .slice(-boundedLimit(limit))
      .reverse();
  }

  const sql = await getSql();
  await ensureTables(sql);
  const safeLimit = boundedLimit(limit);
  return (await sql`
    SELECT * FROM fuel_path_route_alert_evaluations
    WHERE push_ticket_id IS NOT NULL AND push_receipt_status IS NULL
    ORDER BY evaluated_at DESC
    LIMIT ${safeLimit}
  `).map(rowToEvaluation);
}

async function purgeAlertRetention({
  now = new Date().toISOString(),
  dryRun = false,
  inactiveDeviceDays = 90,
  disabledRouteDays = 90,
  evaluationDays = 180,
} = {}) {
  if (testStorage?.purgeAlertRetention) {
    return testStorage.purgeAlertRetention({
      now,
      dryRun,
      inactiveDeviceDays,
      disabledRouteDays,
      evaluationDays,
    });
  }

  const deviceCutoff = cutoffIso(now, inactiveDeviceDays);
  const routeCutoff = cutoffIso(now, disabledRouteDays);
  const evaluationCutoff = cutoffIso(now, evaluationDays);
  if (!databaseUrl()) {
    return purgeMemoryAlertRetention({
      dryRun,
      deviceCutoff,
      routeCutoff,
      evaluationCutoff,
    });
  }

  const sql = await getSql();
  await ensureTables(sql);
  if (dryRun) {
    const [devices, routes, evaluations] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS count
        FROM fuel_path_push_devices
        WHERE status <> 'active'
          AND COALESCE(invalidated_at, last_seen_at) < ${deviceCutoff}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM fuel_path_saved_routes
        WHERE alert_enabled = false
          AND updated_at < ${routeCutoff}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM fuel_path_route_alert_evaluations
        WHERE evaluated_at < ${evaluationCutoff}
      `,
    ]);
    return {
      dryRun: true,
      inactiveDeviceCutoff: deviceCutoff,
      disabledRouteCutoff: routeCutoff,
      evaluationCutoff,
      deletedDeviceCount: Number(devices[0]?.count || 0),
      deletedRouteCount: Number(routes[0]?.count || 0),
      deletedEvaluationCount: Number(evaluations[0]?.count || 0),
    };
  }

  const [devices, routes, evaluations] = await Promise.all([
    sql`
      DELETE FROM fuel_path_push_devices
      WHERE status <> 'active'
        AND COALESCE(invalidated_at, last_seen_at) < ${deviceCutoff}
      RETURNING id
    `,
    sql`
      DELETE FROM fuel_path_saved_routes
      WHERE alert_enabled = false
        AND updated_at < ${routeCutoff}
      RETURNING id
    `,
    sql`
      DELETE FROM fuel_path_route_alert_evaluations
      WHERE evaluated_at < ${evaluationCutoff}
      RETURNING id
    `,
  ]);
  return {
    dryRun: false,
    inactiveDeviceCutoff: deviceCutoff,
    disabledRouteCutoff: routeCutoff,
    evaluationCutoff,
    deletedDeviceCount: devices.length,
    deletedRouteCount: routes.length,
    deletedEvaluationCount: evaluations.length,
  };
}

function upsertMemory(key, record) {
  const records = memoryStore[key];
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.push(record);
  return record;
}

function upsertMemorySavedRoute(record) {
  const index = memoryStore.routes.findIndex((item) =>
    item.id === record.id && item.userId === record.userId
  );
  if (index < 0) {
    memoryStore.routes.push(record);
    return record;
  }
  const existing = memoryStore.routes[index];
  const merged = {
    ...record,
    createdAt: existing.createdAt || record.createdAt,
    lastAlertSentAt: record.lastAlertSentAt || existing.lastAlertSentAt,
  };
  memoryStore.routes[index] = merged;
  return merged;
}

function appendMemoryEvaluation(record) {
  const existing = memoryStore.evaluations.find((item) => item.id === record.id);
  if (existing) return { ...existing, _alreadyRecorded: true };
  memoryStore.evaluations.push(record);
  if (memoryStore.evaluations.length > DEFAULT_MAX_RECORDS) {
    memoryStore.evaluations.splice(0, memoryStore.evaluations.length - DEFAULT_MAX_RECORDS);
  }
  return record;
}

function filterMemory(records, { userId = "", status = "", limit = 50 } = {}) {
  const safeUserId = cleanText(userId);
  const safeStatus = cleanText(status);
  return records
    .filter((record) => (!safeUserId || record.userId === safeUserId) && (!safeStatus || record.status === safeStatus))
    .slice(-boundedLimit(limit))
    .reverse();
}

function purgeMemoryAlertRetention({
  dryRun,
  deviceCutoff,
  routeCutoff,
  evaluationCutoff,
}) {
  const staleDevice = (record) => record.status !== "active" && olderThan(record.invalidatedAt || record.lastSeenAt, deviceCutoff);
  const staleRoute = (record) => record.alertEnabled === false && olderThan(record.updatedAt, routeCutoff);
  const staleEvaluation = (record) => olderThan(record.evaluatedAt, evaluationCutoff);
  const deletedDeviceCount = memoryStore.devices.filter(staleDevice).length;
  const deletedRouteCount = memoryStore.routes.filter(staleRoute).length;
  const deletedEvaluationCount = memoryStore.evaluations.filter(staleEvaluation).length;

  if (!dryRun) {
    memoryStore.devices = memoryStore.devices.filter((record) => !staleDevice(record));
    memoryStore.routes = memoryStore.routes.filter((record) => !staleRoute(record));
    memoryStore.evaluations = memoryStore.evaluations.filter((record) => !staleEvaluation(record));
  }

  return {
    dryRun,
    inactiveDeviceCutoff: deviceCutoff,
    disabledRouteCutoff: routeCutoff,
    evaluationCutoff,
    deletedDeviceCount,
    deletedRouteCount,
    deletedEvaluationCount,
  };
}

async function getSql() {
  if (sqlClient) return sqlClient;
  sqlClient = createProductSqlClient(databaseUrl());
  return sqlClient;
}

async function ensureTables(sql) {
  return assertProductDatabaseSchema(sql);
}


function databaseUrl() {
  return productDatabaseUrl();
}

function cleanText(value) {
  return String(value || "").trim();
}

function boundedLimit(value) {
  return Math.max(1, Math.min(DEFAULT_MAX_RECORDS, Number(value || 50)));
}

function cutoffIso(now, days) {
  const base = new Date(now);
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
  const safeDays = Math.max(1, Number(days || 1));
  return new Date(safeBase.getTime() - safeDays * 24 * 60 * 60 * 1000).toISOString();
}

function olderThan(value, cutoff) {
  if (!value) return false;
  const date = new Date(value);
  const cutoffDate = new Date(cutoff);
  return !Number.isNaN(date.getTime()) && !Number.isNaN(cutoffDate.getTime()) && date < cutoffDate;
}

function nullableNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function setAlertStorageForTests(storage) {
  testStorage = storage || null;
  setAlertInstallationStorageForTests(storage);
}

module.exports = {
  alertStorageStatus,
  appendRouteAlertEvaluation,
  counts,
  deleteSavedRoute,
  listPushDevices,
  listPendingPushTicketEvaluations,
  listRouteAlertEvaluations,
  listSavedRoutes,
  purgeAlertRetention,
  setAlertStorageForTests,
  updatePushDeviceStatus,
  updateRouteAlertDelivery,
  updateSavedRouteLastAlert,
  upsertPushDevice,
  upsertSavedRoute,
};
