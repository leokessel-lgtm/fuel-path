const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  REQUIRED_TABLES,
  assertAlertInstallationSchema,
  assertProductDatabaseSchema,
  createProductSqlClient,
  resetProductDatabaseSchemaForTests,
} = require("../../api/_productDatabase");

function sqlWithRows(rows, queries) {
  return async (strings) => {
    queries.push(strings.join("?"));
    return rows;
  };
}

test("product database schema check accepts a fully migrated database", async () => {
  resetProductDatabaseSchemaForTests();
  const queries = [];
  await assertProductDatabaseSchema(sqlWithRows([], queries));
  assert.equal(queries.length, 1);
  for (const table of REQUIRED_TABLES) assert.match(queries[0], new RegExp(table));
  assert.doesNotMatch(queries[0], /fuel_path_alert_installations/);
});

test("anonymous alert tables are checked only by the opt-in alert boundary", async () => {
  resetProductDatabaseSchemaForTests();
  const queries = [];
  await assertAlertInstallationSchema(sqlWithRows([], queries));
  assert.equal(queries.length, 1);
  assert.match(queries[0], /unnest\(\?::text\[\]\)/);
});

test("product database schema check names missing tables and migration command", async () => {
  resetProductDatabaseSchemaForTests();
  await assert.rejects(
    () => assertProductDatabaseSchema(sqlWithRows([{ table_name: "fuel_path_saved_routes" }], [])),
    /Missing tables: fuel_path_saved_routes\. Run npm run db:migrate/
  );
});

test("local product database URLs use the direct Postgres client", () => {
  const local = createProductSqlClient("postgres://fuel_path:fuel_path@127.0.0.1:54329/fuel_path");
  assert.equal(typeof local, "function");
});

test("anonymous alert migration scopes route keys and capability issuance", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../../db/migrations/1763035200000_anonymous_alert_installations.js"),
    "utf8",
  );
  assert.match(source, /capability_version INTEGER NOT NULL DEFAULT 1/);
  assert.match(source, /fuel_path_alert_rate_limits/);
  assert.match(source, /DELETE FROM fuel_path_saved_routes[\s\S]*LEFT\(user_id, 6\) = 'local_'/);
  assert.match(source, /PRIMARY KEY \(user_id, id\)/);
});
