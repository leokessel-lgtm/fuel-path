import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const { Client } = require("pg");
const connectionString = process.env.DATABASE_URL || "";
if (!connectionString) throw new Error("Set DATABASE_URL before verifying restart durability.");

const quotaKey = `restart_verify_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const quotaDate = new Date().toISOString().slice(0, 10);
let client;

try {
  client = await connect();
  await client.query(
    `INSERT INTO fuel_path_geocode_quotas (quota_key, quota_date, calls, updated_at)
     VALUES ($1, $2, 1, NOW())`,
    [quotaKey, quotaDate],
  );
  await client.end();
  client = undefined;

  compose("down");
  compose("up", "-d", "--wait", "postgres");

  client = await connect();
  const persisted = await client.query(
    "SELECT calls FROM fuel_path_geocode_quotas WHERE quota_key = $1 AND quota_date = $2",
    [quotaKey, quotaDate],
  );
  assert.equal(persisted.rows[0]?.calls, 1, "Docker volume must retain product data across a normal restart");
  await client.query("DELETE FROM fuel_path_geocode_quotas WHERE quota_key = $1", [quotaKey]);
  console.log("Product database restart verification passed: Docker volume retained and recovered data.");
} finally {
  if (client) {
    await client.query("DELETE FROM fuel_path_geocode_quotas WHERE quota_key = $1", [quotaKey]).catch(() => {});
    await client.end().catch(() => {});
  }
  try {
    compose("up", "-d", "--wait", "postgres");
  } catch {
    // Preserve the original failure while making a best effort to restore Postgres.
  }
}

async function connect() {
  const next = new Client({ connectionString });
  await next.connect();
  return next;
}

function compose(...args) {
  execFileSync("docker-compose", ["-f", "docker-compose.yml", ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}
