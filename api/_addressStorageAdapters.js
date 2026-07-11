const fs = require("node:fs");
const path = require("node:path");

function createAddressStorageAdapters({ root = path.resolve(__dirname, ".."), fetchFn } = {}) {
  const defaultSeedPath = path.join(root, "prototype", "data", "gnaf-addresses.seed.json");
  let seedRecordsCache = null;
  let sqliteCache = null;
  let postgresCache = null;

  function configuredApiUrl() {
    return process.env.FUEL_PATH_GNAF_API_URL || "";
  }

  function configuredPostgresUrl() {
    return process.env.FUEL_PATH_GNAF_DATABASE_URL || "";
  }

  function configuredSqlitePath() {
    const value = process.env.FUEL_PATH_GNAF_SQLITE_PATH || "";
    if (!value) return "";
    const resolved = path.resolve(value);
    return fs.existsSync(resolved) ? resolved : "";
  }

  function apiHeaders() {
    const token = process.env.FUEL_PATH_GNAF_API_TOKEN || "";
    return { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }

  async function fetchApiSuggestions(rawQuery, limit) {
    const url = configuredApiUrl();
    const activeFetch = fetchFn || globalThis.fetch;
    if (!url || typeof activeFetch !== "function") return [];
    const requestUrl = new URL("/search", url);
    requestUrl.searchParams.set("q", rawQuery);
    requestUrl.searchParams.set("limit", String(Math.max(1, Math.min(Number(limit) || 5, 20))));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await activeFetch(requestUrl.toString(), { headers: apiHeaders(), signal: controller.signal });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload?.suggestions) ? payload.suggestions : Array.isArray(payload) ? payload : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  function loadSeedRecords() {
    if (seedRecordsCache) return seedRecordsCache;
    try {
      const payload = JSON.parse(fs.readFileSync(defaultSeedPath, "utf8"));
      seedRecordsCache = Array.isArray(payload) ? payload : [];
    } catch {
      seedRecordsCache = [];
    }
    return seedRecordsCache;
  }

  function postgresClient() {
    const connectionString = configuredPostgresUrl();
    if (!connectionString) return null;
    if (postgresCache?.connectionString === connectionString) return postgresCache.sql;
    try {
      const { neon } = require("@neondatabase/serverless");
      const sql = neon(connectionString);
      postgresCache = { connectionString, sql };
      return sql;
    } catch {
      postgresCache = null;
      return null;
    }
  }

  function openSqliteIndex() {
    const sqlitePath = configuredSqlitePath();
    if (!sqlitePath) return null;
    if (sqliteCache?.path === sqlitePath) return sqliteCache.database;
    try {
      const { DatabaseSync } = require("node:sqlite");
      const database = new DatabaseSync(sqlitePath, { readOnly: true });
      sqliteCache = { path: sqlitePath, database };
      return database;
    } catch {
      sqliteCache = null;
      return null;
    }
  }

  return {
    apiHeaders,
    configuredApiUrl,
    configuredPostgresUrl,
    configuredSqlitePath,
    defaultSeedPath,
    fetchApiSuggestions,
    loadSeedRecords,
    openSqliteIndex,
    postgresClient,
  };
}

module.exports = { createAddressStorageAdapters };
