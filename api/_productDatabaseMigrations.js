const { neon } = require("@neondatabase/serverless");
const { resolve } = require("node:path");
const { productDatabaseUrl } = require("./_productDatabase");

function createNeonHttpMigrationClient(sql) {
  let transactionQueries = null;

  return {
    async query(input, values) {
      const text = typeof input === "string" ? input : input.text;
      const params = values || (typeof input === "object" ? input.values : undefined) || [];
      const command = text.trim().replace(/;$/, "").toUpperCase();

      if (command === "BEGIN") {
        if (transactionQueries) throw new Error("Nested migration transactions are not supported.");
        transactionQueries = [];
        return queryResult();
      }
      if (command === "ROLLBACK") {
        transactionQueries = null;
        return queryResult();
      }
      if (command === "COMMIT") {
        if (!transactionQueries) throw new Error("Migration COMMIT received without BEGIN.");
        const queries = transactionQueries;
        transactionQueries = null;
        if (!queries.length) return queryResult();
        const results = await sql.transaction(
          queries.map((query) => sql.query(query.text, query.params)),
        );
        return queryResult(results.at(-1) || []);
      }
      if (transactionQueries) {
        transactionQueries.push({ text, params });
        return queryResult();
      }

      return queryResult(await sql.query(text, params));
    },
  };
}

async function runProductDatabaseMigrations({
  connectionString = productDatabaseUrl(),
  migrationsDirectory = resolve(process.cwd(), "db", "migrations"),
  logger = console,
} = {}) {
  if (!connectionString) throw new Error("Product database URL is missing.");
  const { runner } = await import("node-pg-migrate");
  const migrations = await runner({
    dbClient: createNeonHttpMigrationClient(neon(connectionString)),
    dir: migrationsDirectory,
    direction: "up",
    migrationsTable: "pgmigrations",
    checkOrder: true,
    noLock: true,
    singleTransaction: false,
    logger,
  });
  return {
    accepted: true,
    appliedCount: migrations.length,
    appliedMigrations: migrations.map((migration) => migration.name),
  };
}

function queryResult(rows = []) {
  return { rows, rowCount: rows.length };
}

module.exports = {
  createNeonHttpMigrationClient,
  runProductDatabaseMigrations,
};
