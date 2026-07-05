const DEFAULT_QUOTA_KEY = "google_places_fallback";

let sqlClient;
let ensureTablePromise;
let testStorage;

const memoryQuotas = new Map();

function geocodeQuotaStorageStatus() {
  if (testStorage?.status) return testStorage.status();
  if (!databaseUrl()) {
    return {
      mode: "memory_ephemeral",
      configured: false,
      durable: false,
      table: "",
      warning: "Google Places fallback quota is process-local until DATABASE_URL or FUEL_PATH_GEOCODE_QUOTA_DATABASE_URL is configured.",
    };
  }
  return {
    mode: "postgres_neon",
    configured: true,
    durable: true,
    table: "fuel_path_geocode_quotas",
    warning: "",
  };
}

async function reserveGeocodeQuota({
  quotaKey = DEFAULT_QUOTA_KEY,
  date = new Date().toISOString().slice(0, 10),
  cap = 0,
} = {}) {
  if (testStorage?.reserve) return testStorage.reserve({ quotaKey, date, cap });

  const safeCap = Math.max(0, Number(cap || 0));
  const safeDate = normaliseDate(date);
  const safeQuotaKey = String(quotaKey || DEFAULT_QUOTA_KEY).trim() || DEFAULT_QUOTA_KEY;
  if (safeCap <= 0) {
    return { allowed: false, calls: 0, cap: safeCap, date: safeDate, durable: geocodeQuotaStorageStatus().durable };
  }

  if (!databaseUrl()) {
    const key = `${safeQuotaKey}:${safeDate}`;
    const calls = Number(memoryQuotas.get(key) || 0);
    if (calls >= safeCap) {
      return { allowed: false, calls, cap: safeCap, date: safeDate, durable: false };
    }
    const nextCalls = calls + 1;
    memoryQuotas.set(key, nextCalls);
    return { allowed: true, calls: nextCalls, cap: safeCap, date: safeDate, durable: false };
  }

  const sql = await getSql();
  await ensureTable(sql);
  const rows = await sql`
    INSERT INTO fuel_path_geocode_quotas (quota_key, quota_date, calls, updated_at)
    VALUES (${safeQuotaKey}, ${safeDate}, 1, ${new Date().toISOString()})
    ON CONFLICT (quota_key, quota_date) DO UPDATE SET
      calls = fuel_path_geocode_quotas.calls + 1,
      updated_at = EXCLUDED.updated_at
    WHERE fuel_path_geocode_quotas.calls < ${safeCap}
    RETURNING calls
  `;
  if (rows[0]) {
    return { allowed: true, calls: Number(rows[0].calls || 0), cap: safeCap, date: safeDate, durable: true };
  }

  const existing = await sql`
    SELECT calls
    FROM fuel_path_geocode_quotas
    WHERE quota_key = ${safeQuotaKey}
      AND quota_date = ${safeDate}
    LIMIT 1
  `;
  return {
    allowed: false,
    calls: Number(existing[0]?.calls || safeCap),
    cap: safeCap,
    date: safeDate,
    durable: true,
  };
}

async function getGeocodeQuotaUsage({
  quotaKey = DEFAULT_QUOTA_KEY,
  date = new Date().toISOString().slice(0, 10),
} = {}) {
  if (testStorage?.usage) return testStorage.usage({ quotaKey, date });

  const safeDate = normaliseDate(date);
  const safeQuotaKey = String(quotaKey || DEFAULT_QUOTA_KEY).trim() || DEFAULT_QUOTA_KEY;

  if (!databaseUrl()) {
    const key = `${safeQuotaKey}:${safeDate}`;
    return {
      quotaKey: safeQuotaKey,
      date: safeDate,
      calls: Number(memoryQuotas.get(key) || 0),
      durable: false,
    };
  }

  const sql = await getSql();
  const rows = await sql`
    SELECT calls
    FROM fuel_path_geocode_quotas
    WHERE quota_key = ${safeQuotaKey}
      AND quota_date = ${safeDate}
    LIMIT 1
  `;
  return {
    quotaKey: safeQuotaKey,
    date: safeDate,
    calls: Number(rows[0]?.calls || 0),
    durable: true,
  };
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
        CREATE TABLE IF NOT EXISTS fuel_path_geocode_quotas (
          quota_key TEXT NOT NULL,
          quota_date DATE NOT NULL,
          calls INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL,
          PRIMARY KEY (quota_key, quota_date)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS fuel_path_geocode_quotas_updated_at_idx
        ON fuel_path_geocode_quotas (updated_at DESC)
      `;
    })();
  }
  return ensureTablePromise;
}

function databaseUrl() {
  return (
    process.env.FUEL_PATH_GEOCODE_QUOTA_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.NEON_DATABASE_URL ||
    ""
  );
}

function normaliseDate(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
}

function resetMemoryGeocodeQuotaForTests() {
  memoryQuotas.clear();
}

function setGeocodeQuotaStorageForTests(storage) {
  testStorage = storage || null;
}

module.exports = {
  geocodeQuotaStorageStatus,
  reserveGeocodeQuota,
  getGeocodeQuotaUsage,
  resetMemoryGeocodeQuotaForTests,
  setGeocodeQuotaStorageForTests,
};
