#!/usr/bin/env node

import { neon } from "@neondatabase/serverless";
import { runner } from "node-pg-migrate";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function createNeonHttpMigrationClient(sql) {
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

export async function migrateProductDatabaseHttp({
  connectionString = productDatabaseUrl(),
  migrationsDirectory = resolve(repoRoot, "db", "migrations"),
  logger = console,
} = {}) {
  if (!connectionString) {
    throw new Error(
      "Product database URL is missing. Set FUEL_PATH_PRODUCT_DATABASE_URL, DATABASE_URL, POSTGRES_URL or NEON_DATABASE_URL.",
    );
  }
  const sql = neon(connectionString);
  return runner({
    dbClient: createNeonHttpMigrationClient(sql),
    dir: migrationsDirectory,
    direction: "up",
    migrationsTable: "pgmigrations",
    checkOrder: true,
    noLock: true,
    singleTransaction: false,
    logger,
  });
}

function productDatabaseUrl() {
  return (
    process.env.FUEL_PATH_PRODUCT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    ""
  );
}

function queryResult(rows = []) {
  return { rows, rowCount: rows.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const migrations = await migrateProductDatabaseHttp();
  console.log(`Product database HTTP migration complete: ${migrations.length} migration(s) applied.`);
}
