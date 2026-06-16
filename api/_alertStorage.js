const DEFAULT_MAX_RECORDS = 500;

let sqlClient;
let ensureTablesPromise;
let testStorage;

const memoryStore = {
  devices: [],
  routes: [],
  evaluations: [],
};

function alertStorageStatus({ maxRecords = DEFAULT_MAX_RECORDS } = {}) {
  if (testStorage) return testStorage.status({ maxRecords });

  if (!databaseUrl()) {
    return {
      mode: "memory_ephemeral",
      configured: true,
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
  if (!databaseUrl()) return upsertMemory("routes", record);

  const sql = await getSql();
  await ensureTables(sql);
  await sql`
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
    ON CONFLICT (id) DO UPDATE SET
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
      last_alert_sent_at = EXCLUDED.last_alert_sent_at,
      updated_at = EXCLUDED.updated_at,
      raw = EXCLUDED.raw
  `;
  return record;
}

async function appendRouteAlertEvaluation(record) {
  if (testStorage) return testStorage.appendRouteAlertEvaluation(record);
  if (!databaseUrl()) return appendMemoryEvaluation(record);

  const sql = await getSql();
  await ensureTables(sql);
  await sql`
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
  `;
  return record;
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

async function updateSavedRouteLastAlert(routeId, sentAt) {
  if (testStorage?.updateSavedRouteLastAlert) return testStorage.updateSavedRouteLastAlert(routeId, sentAt);
  if (!databaseUrl()) {
    const record = memoryStore.routes.find((item) => item.id === routeId);
    if (record) record.lastAlertSentAt = sentAt;
    return record || null;
  }

  const sql = await getSql();
  await ensureTables(sql);
  const rows = await sql`
    UPDATE fuel_path_saved_routes
    SET last_alert_sent_at = ${sentAt}, updated_at = ${sentAt}
    WHERE id = ${routeId}
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

function upsertMemory(key, record) {
  const records = memoryStore[key];
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.push(record);
  return record;
}

function appendMemoryEvaluation(record) {
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

async function getSql() {
  if (sqlClient) return sqlClient;
  const { neon } = require("@neondatabase/serverless");
  sqlClient = neon(databaseUrl());
  return sqlClient;
}

async function ensureTables(sql) {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS fuel_path_push_devices (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          expo_push_token TEXT NOT NULL,
          app_version TEXT,
          status TEXT NOT NULL,
          last_seen_at TIMESTAMPTZ NOT NULL,
          invalidated_at TIMESTAMPTZ,
          raw JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS fuel_path_push_devices_user_status_idx
        ON fuel_path_push_devices (user_id, status, last_seen_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS fuel_path_saved_routes (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          from_lat DOUBLE PRECISION NOT NULL,
          from_lon DOUBLE PRECISION NOT NULL,
          from_label TEXT NOT NULL,
          to_lat DOUBLE PRECISION NOT NULL,
          to_lon DOUBLE PRECISION NOT NULL,
          to_label TEXT NOT NULL,
          fuel TEXT NOT NULL,
          alert_enabled BOOLEAN NOT NULL,
          alert_time_local TEXT NOT NULL,
          timezone TEXT NOT NULL,
          min_saving_dollars DOUBLE PRECISION NOT NULL,
          max_detour_minutes DOUBLE PRECISION NOT NULL,
          paused_until TIMESTAMPTZ,
          last_alert_sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          raw JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS fuel_path_saved_routes_user_enabled_idx
        ON fuel_path_saved_routes (user_id, alert_enabled, updated_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS fuel_path_route_alert_evaluations (
          id TEXT PRIMARY KEY,
          saved_route_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL,
          reason TEXT NOT NULL,
          station_code TEXT,
          station_name TEXT,
          estimated_saving_dollars DOUBLE PRECISION,
          detour_minutes DOUBLE PRECISION,
          freshness_minutes DOUBLE PRECISION,
          message_title TEXT,
          message_body TEXT,
          evaluated_at TIMESTAMPTZ NOT NULL,
          push_delivery_enabled BOOLEAN NOT NULL,
          push_ticket_id TEXT,
          push_receipt_status TEXT,
          raw JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS fuel_path_route_alert_evaluations_route_idx
        ON fuel_path_route_alert_evaluations (saved_route_id, evaluated_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS fuel_path_route_alert_evaluations_user_idx
        ON fuel_path_route_alert_evaluations (user_id, evaluated_at DESC)
      `;
    })();
  }
  return ensureTablesPromise;
}

function rowToDevice(row) {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    platform: row.platform,
    expoPushToken: row.expo_push_token,
    appVersion: row.app_version || "",
    status: row.status,
    lastSeenAt: isoDateTime(row.last_seen_at),
    invalidatedAt: row.invalidated_at ? isoDateTime(row.invalidated_at) : undefined,
  };
}

function rowToRoute(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    from: { lat: Number(row.from_lat), lon: Number(row.from_lon), label: row.from_label },
    to: { lat: Number(row.to_lat), lon: Number(row.to_lon), label: row.to_label },
    fuel: row.fuel,
    alertEnabled: Boolean(row.alert_enabled),
    alertTimeLocal: row.alert_time_local,
    timezone: row.timezone,
    minSavingDollars: Number(row.min_saving_dollars),
    maxDetourMinutes: Number(row.max_detour_minutes),
    pausedUntil: row.paused_until ? isoDateTime(row.paused_until) : undefined,
    lastAlertSentAt: row.last_alert_sent_at ? isoDateTime(row.last_alert_sent_at) : undefined,
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
  };
}

function rowToEvaluation(row) {
  return {
    id: row.id,
    routeId: row.saved_route_id,
    userId: row.user_id,
    status: row.status,
    reason: row.reason,
    stationCode: row.station_code || undefined,
    stationName: row.station_name || undefined,
    estimatedSavingDollars: optionalNumber(row.estimated_saving_dollars),
    detourMinutes: optionalNumber(row.detour_minutes),
    freshnessMinutes: optionalNumber(row.freshness_minutes),
    messageTitle: row.message_title || undefined,
    messageBody: row.message_body || undefined,
    evaluatedAt: isoDateTime(row.evaluated_at),
    pushDeliveryEnabled: Boolean(row.push_delivery_enabled),
    pushTicketId: row.push_ticket_id || undefined,
    pushReceiptStatus: row.push_receipt_status || undefined,
  };
}

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.NEON_DATABASE_URL ||
    ""
  );
}

function cleanText(value) {
  return String(value || "").trim();
}

function boundedLimit(value) {
  return Math.max(1, Math.min(DEFAULT_MAX_RECORDS, Number(value || 50)));
}

function nullableNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function optionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isoDateTime(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function setAlertStorageForTests(storage) {
  testStorage = storage || null;
}

module.exports = {
  alertStorageStatus,
  appendRouteAlertEvaluation,
  counts,
  listPushDevices,
  listPendingPushTicketEvaluations,
  listRouteAlertEvaluations,
  listSavedRoutes,
  setAlertStorageForTests,
  updatePushDeviceStatus,
  updateRouteAlertDelivery,
  updateSavedRouteLastAlert,
  upsertPushDevice,
  upsertSavedRoute,
};
