const assert = require("node:assert/strict");
const test = require("node:test");

const {
  REQUIRED_TABLES,
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
