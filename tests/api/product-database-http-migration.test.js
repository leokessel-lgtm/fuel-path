const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("Vercel jobs bundle includes product database migrations", () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "..", "vercel.json"), "utf8"),
  );
  assert.equal(config.functions?.["api/jobs.js"]?.includeFiles, "db/migrations/**");
});

test("serverless migration module loads node-pg-migrate through its ESM entrypoint", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", "api", "_productDatabaseMigrations.js"),
    "utf8",
  );
  assert.match(source, /await import\("node-pg-migrate"\)/);
  assert.doesNotMatch(source, /require\("node-pg-migrate"\)/);
});

test("Neon HTTP migration client batches each migration transaction atomically", async () => {
  const { createNeonHttpMigrationClient } = require("../../api/_productDatabaseMigrations");
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
  const { createNeonHttpMigrationClient } = require("../../api/_productDatabaseMigrations");
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
