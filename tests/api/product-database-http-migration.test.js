const assert = require("node:assert/strict");
const test = require("node:test");

test("Neon HTTP migration client batches each migration transaction atomically", async () => {
  const { createNeonHttpMigrationClient } = await import("../../scripts/migrate-product-database-http.mjs");
  const transactionBatches = [];
  const directQueries = [];
  const sql = {
    query(text, params) {
      directQueries.push({ text, params });
      return Promise.resolve([{ text }]);
    },
    async transaction(queries) {
      transactionBatches.push(queries);
      return Promise.all(queries);
    },
  };
  const client = createNeonHttpMigrationClient(sql);

  const select = await client.query("SELECT 1 AS ready");
  assert.equal(select.rowCount, 1);
  await client.query("BEGIN;");
  await client.query("ALTER TABLE example ADD COLUMN IF NOT EXISTS ready BOOLEAN");
  await client.query("INSERT INTO pgmigrations (name, run_on) VALUES ($1, NOW())", ["example"]);
  assert.equal(directQueries.length, 1);
  await client.query("COMMIT;");

  assert.equal(transactionBatches.length, 1);
  assert.equal(transactionBatches[0].length, 2);
  assert.deepEqual(directQueries.slice(1).map((query) => query.params), [[], ["example"]]);
});

test("Neon HTTP migration client discards queued work on rollback", async () => {
  const { createNeonHttpMigrationClient } = await import("../../scripts/migrate-product-database-http.mjs");
  let transactionCalls = 0;
  const sql = {
    query: async () => [],
    transaction: async () => {
      transactionCalls += 1;
      return [];
    },
  };
  const client = createNeonHttpMigrationClient(sql);

  await client.query("BEGIN");
  await client.query("ALTER TABLE example ADD COLUMN unsafe BOOLEAN");
  await client.query("ROLLBACK");
  assert.equal(transactionCalls, 0);
  await assert.rejects(() => client.query("COMMIT"), /without BEGIN/);
});
