const DEFAULT_MAX_RECORDS = 500;
const TABLE_NAME = "fuel_path_prediction_backtests";

let sqlClient;
let ensureTablePromise;
let testStorage;

const memoryStore = {
  records: [],
};

function predictionStorageStatus({ maxRecords = DEFAULT_MAX_RECORDS } = {}) {
  if (testStorage) return testStorage.status({ maxRecords });

  const url = databaseUrl();
  if (!url) {
    return {
      mode: "memory_ephemeral",
      configured: true,
      durable: false,
      maxRecords,
      recordCount: memoryStore.records.length,
      nextBuildStep: "Provision Neon Postgres through Vercel Marketplace and set DATABASE_URL before enabling any user-facing accuracy claim.",
    };
  }

  return {
    mode: "postgres_neon",
    configured: true,
    durable: true,
    maxRecords,
    recordCount: undefined,
    table: TABLE_NAME,
    nextBuildStep: "Keep prediction claims disabled until back-test sample size and error thresholds are proven.",
  };
}

async function appendPredictionBacktestRecord(record, { maxRecords = DEFAULT_MAX_RECORDS } = {}) {
  if (testStorage) return testStorage.append(record, { maxRecords });
  if (!databaseUrl()) return appendMemoryRecord(record, { maxRecords });

  const sql = await getSql();
  await ensureTable(sql);
  await sql`
    INSERT INTO fuel_path_prediction_backtests (
      id,
      region,
      fuel,
      target_date,
      prediction_date,
      model_version,
      predicted_cpl,
      actual_cpl,
      absolute_error_cpl,
      predicted_direction,
      actual_direction,
      direction_matched,
      recorded_at,
      raw
    )
    VALUES (
      ${record.id},
      ${record.region},
      ${record.fuel},
      ${record.targetDate},
      ${record.predictionDate},
      ${record.modelVersion},
      ${nullableNumber(record.predictedCpl)},
      ${nullableNumber(record.actualCpl)},
      ${nullableNumber(record.absoluteErrorCpl)},
      ${record.predictedDirection},
      ${record.actualDirection},
      ${nullableBoolean(record.directionMatched)},
      ${record.recordedAt},
      ${JSON.stringify(record)}
    )
    ON CONFLICT (id) DO UPDATE SET
      actual_cpl = EXCLUDED.actual_cpl,
      absolute_error_cpl = EXCLUDED.absolute_error_cpl,
      actual_direction = EXCLUDED.actual_direction,
      direction_matched = EXCLUDED.direction_matched,
      raw = EXCLUDED.raw
  `;
  return record;
}

async function listPredictionBacktestRecords({ region = "", fuel = "", limit = 50 } = {}) {
  if (testStorage) return testStorage.list({ region, fuel, limit });
  if (!databaseUrl()) return listMemoryRecords({ region, fuel, limit });

  const sql = await getSql();
  await ensureTable(sql);
  const safeRegion = String(region || "").trim().toUpperCase();
  const safeFuel = String(fuel || "").trim().toUpperCase();
  const safeLimit = Math.max(1, Math.min(DEFAULT_MAX_RECORDS, Number(limit || 50)));

  let rows;
  if (safeRegion && safeFuel) {
    rows = await sql`
      SELECT * FROM fuel_path_prediction_backtests
      WHERE region = ${safeRegion} AND fuel = ${safeFuel}
      ORDER BY recorded_at DESC
      LIMIT ${safeLimit}
    `;
  } else if (safeRegion) {
    rows = await sql`
      SELECT * FROM fuel_path_prediction_backtests
      WHERE region = ${safeRegion}
      ORDER BY recorded_at DESC
      LIMIT ${safeLimit}
    `;
  } else if (safeFuel) {
    rows = await sql`
      SELECT * FROM fuel_path_prediction_backtests
      WHERE fuel = ${safeFuel}
      ORDER BY recorded_at DESC
      LIMIT ${safeLimit}
    `;
  } else {
    rows = await sql`
      SELECT * FROM fuel_path_prediction_backtests
      ORDER BY recorded_at DESC
      LIMIT ${safeLimit}
    `;
  }
  return rows.map(rowToRecord);
}

async function purgePredictionBacktests({
  now = new Date().toISOString(),
  dryRun = false,
  olderThanDays = 365,
} = {}) {
  if (testStorage?.purgePredictionBacktests) {
    return testStorage.purgePredictionBacktests({ now, dryRun, olderThanDays });
  }

  const cutoff = cutoffIso(now, olderThanDays);
  if (!databaseUrl()) {
    const staleRecord = (record) => olderThan(record.recordedAt, cutoff);
    const deletedCount = memoryStore.records.filter(staleRecord).length;
    if (!dryRun) memoryStore.records = memoryStore.records.filter((record) => !staleRecord(record));
    return { dryRun, cutoff, deletedCount };
  }

  const sql = await getSql();
  await ensureTable(sql);
  if (dryRun) {
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      FROM fuel_path_prediction_backtests
      WHERE recorded_at < ${cutoff}
    `;
    return { dryRun: true, cutoff, deletedCount: Number(rows[0]?.count || 0) };
  }

  const rows = await sql`
    DELETE FROM fuel_path_prediction_backtests
    WHERE recorded_at < ${cutoff}
    RETURNING id
  `;
  return { dryRun: false, cutoff, deletedCount: rows.length };
}

function appendMemoryRecord(record, { maxRecords = DEFAULT_MAX_RECORDS } = {}) {
  memoryStore.records.push(record);
  if (memoryStore.records.length > maxRecords) {
    memoryStore.records.splice(0, memoryStore.records.length - maxRecords);
  }
  return record;
}

function listMemoryRecords({ region = "", fuel = "", limit = 50 } = {}) {
  const safeRegion = String(region || "").trim().toUpperCase();
  const safeFuel = String(fuel || "").trim().toUpperCase();
  const safeLimit = Math.max(1, Math.min(DEFAULT_MAX_RECORDS, Number(limit || 50)));
  return memoryStore.records
    .filter((record) => (!safeRegion || record.region === safeRegion) && (!safeFuel || record.fuel === safeFuel))
    .slice(-safeLimit)
    .reverse();
}

async function getSql() {
  if (sqlClient) return sqlClient;
  const { neon } = require("@neondatabase/serverless");
  sqlClient = neon(databaseUrl());
  return sqlClient;
}

async function ensureTable(sql) {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS fuel_path_prediction_backtests (
          id TEXT PRIMARY KEY,
          region TEXT NOT NULL,
          fuel TEXT NOT NULL,
          target_date DATE NOT NULL,
          prediction_date DATE NOT NULL,
          model_version TEXT NOT NULL,
          predicted_cpl DOUBLE PRECISION,
          actual_cpl DOUBLE PRECISION,
          absolute_error_cpl DOUBLE PRECISION,
          predicted_direction TEXT NOT NULL DEFAULT 'unknown',
          actual_direction TEXT NOT NULL DEFAULT 'unknown',
          direction_matched BOOLEAN,
          recorded_at TIMESTAMPTZ NOT NULL,
          raw JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS fuel_path_prediction_backtests_region_fuel_target_idx
        ON fuel_path_prediction_backtests (region, fuel, target_date DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS fuel_path_prediction_backtests_recorded_at_idx
        ON fuel_path_prediction_backtests (recorded_at DESC)
      `;
    })();
  }
  return ensureTablePromise;
}

function rowToRecord(row) {
  return {
    id: row.id,
    region: row.region,
    fuel: row.fuel,
    targetDate: dateOnly(row.target_date),
    predictionDate: dateOnly(row.prediction_date),
    modelVersion: row.model_version,
    predictedCpl: optionalNumber(row.predicted_cpl),
    actualCpl: optionalNumber(row.actual_cpl),
    absoluteErrorCpl: optionalNumber(row.absolute_error_cpl),
    predictedDirection: row.predicted_direction || "unknown",
    actualDirection: row.actual_direction || "unknown",
    directionMatched: typeof row.direction_matched === "boolean" ? row.direction_matched : undefined,
    recordedAt: isoDateTime(row.recorded_at),
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

function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isoDateTime(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function nullableNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function optionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nullableBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function setPredictionStorageForTests(storage) {
  testStorage = storage || null;
}

module.exports = {
  appendPredictionBacktestRecord,
  listPredictionBacktestRecords,
  predictionStorageStatus,
  purgePredictionBacktests,
  setPredictionStorageForTests,
};
