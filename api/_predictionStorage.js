const { assertProductDatabaseSchema, createProductSqlClient } = require("./_productDatabase");

const DEFAULT_MAX_RECORDS = 500;
const TABLE_NAME = "fuel_path_prediction_backtests";
const SNAPSHOT_TABLE_NAME = "fuel_path_market_price_snapshots";

let sqlClient;
let testStorage;

const memoryStore = {
  records: [],
  snapshots: [],
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
    snapshotTable: SNAPSHOT_TABLE_NAME,
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
      market,
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
      ${record.market},
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
      market = EXCLUDED.market,
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

async function appendPredictionMarketSnapshotRecord(record, { maxRecords = DEFAULT_MAX_RECORDS * 5 } = {}) {
  if (testStorage?.appendSnapshot) return testStorage.appendSnapshot(record, { maxRecords });
  if (!databaseUrl()) return appendMemorySnapshot(record, { maxRecords });

  const sql = await getSql();
  await ensureTable(sql);
  await sql`
    INSERT INTO fuel_path_market_price_snapshots (
      id,
      region,
      market,
      fuel,
      observed_date,
      observed_at,
      median_cpl,
      low_cpl,
      high_cpl,
      exact_price_count,
      provider,
      capability,
      cache_mode,
      cache_age_seconds,
      warning,
      raw
    )
    VALUES (
      ${record.id},
      ${record.region},
      ${record.market},
      ${record.fuel},
      ${record.observedDate},
      ${record.observedAt},
      ${nullableNumber(record.medianCpl)},
      ${nullableNumber(record.lowCpl)},
      ${nullableNumber(record.highCpl)},
      ${Number(record.exactPriceCount || 0)},
      ${record.provider || ""},
      ${record.capability || ""},
      ${record.cacheMode || ""},
      ${nullableNumber(record.cacheAgeSeconds)},
      ${record.warning || ""},
      ${JSON.stringify(record)}
    )
    ON CONFLICT (id) DO UPDATE SET
      median_cpl = EXCLUDED.median_cpl,
      low_cpl = EXCLUDED.low_cpl,
      high_cpl = EXCLUDED.high_cpl,
      exact_price_count = EXCLUDED.exact_price_count,
      provider = EXCLUDED.provider,
      capability = EXCLUDED.capability,
      cache_mode = EXCLUDED.cache_mode,
      cache_age_seconds = EXCLUDED.cache_age_seconds,
      warning = EXCLUDED.warning,
      raw = EXCLUDED.raw
  `;
  return record;
}

async function listPredictionMarketSnapshotRecords({ market = "", fuel = "", limit = 200 } = {}) {
  if (testStorage?.listSnapshots) return testStorage.listSnapshots({ market, fuel, limit });
  if (!databaseUrl()) return listMemorySnapshots({ market, fuel, limit });

  const sql = await getSql();
  await ensureTable(sql);
  const safeMarket = String(market || "").trim().toLowerCase();
  const safeFuel = String(fuel || "").trim().toUpperCase();
  const safeLimit = Math.max(1, Math.min(DEFAULT_MAX_RECORDS * 5, Number(limit || 200)));

  let rows;
  if (safeMarket && safeFuel) {
    rows = await sql`
      SELECT * FROM fuel_path_market_price_snapshots
      WHERE market = ${safeMarket} AND fuel = ${safeFuel}
      ORDER BY observed_at DESC
      LIMIT ${safeLimit}
    `;
  } else if (safeMarket) {
    rows = await sql`
      SELECT * FROM fuel_path_market_price_snapshots
      WHERE market = ${safeMarket}
      ORDER BY observed_at DESC
      LIMIT ${safeLimit}
    `;
  } else if (safeFuel) {
    rows = await sql`
      SELECT * FROM fuel_path_market_price_snapshots
      WHERE fuel = ${safeFuel}
      ORDER BY observed_at DESC
      LIMIT ${safeLimit}
    `;
  } else {
    rows = await sql`
      SELECT * FROM fuel_path_market_price_snapshots
      ORDER BY observed_at DESC
      LIMIT ${safeLimit}
    `;
  }
  return rows.map(rowToSnapshotRecord);
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

function appendMemorySnapshot(record, { maxRecords = DEFAULT_MAX_RECORDS * 5 } = {}) {
  const index = memoryStore.snapshots.findIndex((existing) => existing.id === record.id);
  if (index >= 0) memoryStore.snapshots[index] = { ...memoryStore.snapshots[index], ...record };
  else memoryStore.snapshots.push(record);
  if (memoryStore.snapshots.length > maxRecords) {
    memoryStore.snapshots.splice(0, memoryStore.snapshots.length - maxRecords);
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

function listMemorySnapshots({ market = "", fuel = "", limit = 200 } = {}) {
  const safeMarket = String(market || "").trim().toLowerCase();
  const safeFuel = String(fuel || "").trim().toUpperCase();
  const safeLimit = Math.max(1, Math.min(DEFAULT_MAX_RECORDS * 5, Number(limit || 200)));
  return memoryStore.snapshots
    .filter((record) => (!safeMarket || record.market === safeMarket) && (!safeFuel || record.fuel === safeFuel))
    .slice(-safeLimit)
    .reverse();
}

async function getSql() {
  if (sqlClient) return sqlClient;
  sqlClient = createProductSqlClient(databaseUrl());
  return sqlClient;
}

async function ensureTable(sql) {
  return assertProductDatabaseSchema(sql);
}

function rowToSnapshotRecord(row) {
  return {
    id: row.id,
    region: row.region,
    market: row.market || "",
    fuel: row.fuel,
    observedDate: dateOnly(row.observed_date),
    observedAt: isoDateTime(row.observed_at),
    medianCpl: optionalNumber(row.median_cpl),
    lowCpl: optionalNumber(row.low_cpl),
    highCpl: optionalNumber(row.high_cpl),
    exactPriceCount: Number(row.exact_price_count || 0),
    provider: row.provider || "",
    capability: row.capability || "",
    cacheMode: row.cache_mode || "",
    cacheAgeSeconds: optionalNumber(row.cache_age_seconds),
    warning: row.warning || "",
  };
}

function rowToRecord(row) {
  return {
    id: row.id,
    region: row.region,
    market: row.market || "",
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
  appendPredictionMarketSnapshotRecord,
  listPredictionBacktestRecords,
  listPredictionMarketSnapshotRecords,
  predictionStorageStatus,
  purgePredictionBacktests,
  setPredictionStorageForTests,
};
