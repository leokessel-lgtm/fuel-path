const REQUIRED_TABLES = [
  "fuel_path_push_devices",
  "fuel_path_saved_routes",
  "fuel_path_route_alert_evaluations",
  "fuel_path_prediction_backtests",
  "fuel_path_market_price_snapshots",
  "fuel_path_geocode_quotas",
];

let schemaChecks = new WeakMap();
let alertInstallationSchemaChecks = new WeakMap();

function createProductSqlClient(connectionString) {
  if (usesDirectPostgres(connectionString)) {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString });
    return async (strings, ...values) => {
      const text = strings.reduce(
        (query, segment, index) => query + segment + (index < values.length ? `$${index + 1}` : ""),
        ""
      );
      const result = await pool.query(text, values);
      return result.rows;
    };
  }

  const { neon } = require("@neondatabase/serverless");
  return neon(connectionString);
}

function usesDirectPostgres(connectionString) {
  try {
    const host = new URL(connectionString).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "postgres";
  } catch {
    return false;
  }
}

async function assertProductDatabaseSchema(sql) {
  const existing = schemaChecks.get(sql);
  if (existing) return existing;

  const check = (async () => {
    const missing = await sql`
      WITH required(table_name) AS (
        VALUES
          ('fuel_path_push_devices'),
          ('fuel_path_saved_routes'),
          ('fuel_path_route_alert_evaluations'),
          ('fuel_path_prediction_backtests'),
          ('fuel_path_market_price_snapshots'),
          ('fuel_path_geocode_quotas')
      )
      SELECT table_name
      FROM required
      WHERE to_regclass('public.' || table_name) IS NULL
      ORDER BY table_name
    `;
    if (missing.length) {
      const names = missing.map((row) => row.table_name).join(", ");
      throw new Error(
        `Product database migrations have not been applied. Missing tables: ${names}. Run npm run db:migrate before starting this environment.`
      );
    }
  })();

  schemaChecks.set(sql, check);
  try {
    return await check;
  } catch (error) {
    schemaChecks.delete(sql);
    throw error;
  }
}

async function assertAlertInstallationSchema(sql) {
  const existing = alertInstallationSchemaChecks.get(sql);
  if (existing) return existing;
  const check = assertRequiredTables(sql, [
    "fuel_path_alert_installations",
    "fuel_path_alert_rate_limits",
  ]);
  alertInstallationSchemaChecks.set(sql, check);
  try {
    return await check;
  } catch (error) {
    alertInstallationSchemaChecks.delete(sql);
    throw error;
  }
}

async function assertRequiredTables(sql, tables) {
  const missing = await sql`
    SELECT table_name
    FROM unnest(${tables}::text[]) AS required(table_name)
    WHERE to_regclass('public.' || table_name) IS NULL
    ORDER BY table_name
  `;
  if (!missing.length) return;
  const names = missing.map((row) => row.table_name).join(", ");
  throw new Error(
    `Product database migrations have not been applied. Missing tables: ${names}. Run npm run db:migrate before starting this environment.`
  );
}

function resetProductDatabaseSchemaForTests() {
  schemaChecks = new WeakMap();
  alertInstallationSchemaChecks = new WeakMap();
}

module.exports = {
  REQUIRED_TABLES,
  assertAlertInstallationSchema,
  assertProductDatabaseSchema,
  createProductSqlClient,
  resetProductDatabaseSchemaForTests,
};
