#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { neon } from "@neondatabase/serverless";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const runId = args.runId || new Date().toISOString().replace(/[:.]/g, "-");
const rawZipPath = path.resolve(ROOT, args.rawZip || "data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip");
const sqlitePath = path.resolve(ROOT, args.sqlite || "data/gnaf/build/gnaf-addresses-national.sqlite");
const databaseUrl = args.databaseUrl || process.env.FUEL_PATH_GNAF_DATABASE_URL || "";
const minAddressRows = Number(args.minRows || process.env.FUEL_PATH_GNAF_MIN_ADDRESS_ROWS || 10_000_000);
const skipHosted = Boolean(args.skipHosted);
const storageReviewPath = args.noStorageReview
  ? ""
  : args.storageReview || process.env.FUEL_PATH_GNAF_STORAGE_REVIEW_JSON || latestStorageReview();
const outDir = path.join(ROOT, "tmp");

const rawZip = await fileInfo(rawZipPath);
const sqlite = await sqliteInfo(sqlitePath);
const hosted = skipHosted
  ? {
      checked: false,
      reason: "skipped",
      targetKind: targetKind(databaseUrl),
      dedicatedTargetKnown: Boolean(databaseUrl),
    }
  : await hostedInfo(databaseUrl);
const estimatedHostedStorageGbRange = sqlite.sizeGb ? [round(sqlite.sizeGb * 1.5, 1), round(sqlite.sizeGb * 3, 1)] : [];
const storageReview = storageReviewPath
  ? readStorageReview(storageReviewPath, { estimatedHostedStorageGbRange })
  : { checked: false, ok: false, reason: "missing_storage_review" };
const storageReviewed = Boolean(
  args.confirmStorageReviewed ||
  process.env.FUEL_PATH_GNAF_STORAGE_REVIEW_CONFIRMED === "1" ||
  storageReview.ok,
);
const targetDecisionReviewed = hosted.targetKind !== "supabase" ||
  Boolean(args.confirmSupabaseMigrationReviewed || process.env.FUEL_PATH_SUPABASE_MIGRATION_REVIEW_CONFIRMED === "1");
const assessment = assess({ rawZip, sqlite, hosted, minAddressRows, storageReviewed, targetDecisionReviewed });
const payload = {
  runId,
  minAddressRows,
  storageReviewed,
  targetDecisionReviewed,
  storageReview,
  rawZip,
  sqlite,
  hosted,
  assessment,
  commands: commandPlan(rawZipPath, storageReview, runId),
};

await fsp.mkdir(outDir, { recursive: true });
const jsonPath = path.join("tmp", `gnaf-hosted-load-plan-${runId}.json`);
const reportPath = path.join("tmp", `gnaf-hosted-load-plan-${runId}.md`);
await fsp.writeFile(path.join(ROOT, jsonPath), `${JSON.stringify(payload, null, 2)}\n`);
await fsp.writeFile(path.join(ROOT, reportPath), renderReport(payload));

console.log(JSON.stringify({
  runId,
  jsonPath,
  reportPath,
  status: assessment.status,
  blockers: assessment.blockers,
  warnings: assessment.warnings,
}, null, 2));

if (args.requireReady && assessment.status !== "ready_to_load") {
  throw new Error(`Hosted G-NAF load plan is not ready: ${assessment.blockers.join(", ") || assessment.warnings.join(", ")}`);
}

async function fileInfo(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      path: path.relative(ROOT, filePath),
      exists: false,
      sizeBytes: 0,
      sizeGb: 0,
    };
  }
  const stats = await fsp.stat(filePath);
  return {
    path: path.relative(ROOT, filePath),
    exists: true,
    sizeBytes: stats.size,
    sizeGb: round(stats.size / 1024 / 1024 / 1024, 2),
  };
}

async function sqliteInfo(filePath) {
  const info = await fileInfo(filePath);
  if (!info.exists) return { ...info, count: 0, states: [], nationalReady: false };
  let db;
  try {
    db = new DatabaseSync(filePath, { readOnly: true });
    const count = Number(db.prepare("SELECT count(*) AS count FROM addresses").get().count || 0);
    const states = db.prepare("SELECT state, count(*) AS count FROM addresses GROUP BY state ORDER BY state").all()
      .map((row) => ({ state: row.state, count: Number(row.count || 0) }));
    return {
      ...info,
      count,
      states,
      nationalReady: count >= minAddressRows && requiredStatesPresent(states),
    };
  } catch (error) {
    return {
      ...info,
      count: 0,
      states: [],
      nationalReady: false,
      error: error?.message || String(error),
    };
  } finally {
    db?.close();
  }
}

async function hostedInfo(connectionString) {
  if (!connectionString) {
    return {
      checked: false,
      reason: "missing_FUEL_PATH_GNAF_DATABASE_URL",
      dedicatedTargetKnown: false,
    };
  }
  if (process.env.DATABASE_URL && connectionString === process.env.DATABASE_URL) {
    return {
      checked: true,
      ok: false,
      reason: "gnaf_url_matches_generic_database_url",
      dedicatedTargetKnown: false,
      targetKind: targetKind(connectionString),
    };
  }
  try {
    const sql = neon(connectionString);
    const rows = await sql`
      SELECT
        current_database() AS database,
        current_user AS user,
        to_regclass('public.fuel_path_gnaf_addresses') AS table_name
    `;
    const tableExists = Boolean(rows[0]?.table_name);
    const countRows = tableExists
      ? await sql`SELECT count(*)::bigint AS count FROM fuel_path_gnaf_addresses`
      : [{ count: "0" }];
    const indexRows = tableExists
      ? await sql`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'fuel_path_gnaf_addresses'
      `
      : [];
    const indexes = indexRows.map((row) => row.indexname).sort();
    const expectedIndexes = [
      "fuel_path_gnaf_addresses_search_prefix_idx",
      "fuel_path_gnaf_addresses_search_trgm_idx",
      "fuel_path_gnaf_addresses_state_postcode_idx",
      "fuel_path_gnaf_addresses_locality_idx",
    ];
    return {
      checked: true,
      ok: true,
      dedicatedTargetKnown: true,
      targetKind: targetKind(connectionString),
      database: rows[0]?.database || "",
      user: rows[0]?.user || "",
      tableExists,
      addressRows: Number(countRows[0]?.count || 0),
      indexes,
      missingIndexes: expectedIndexes.filter((name) => !indexes.includes(name)),
    };
  } catch (error) {
    return {
      checked: true,
      ok: false,
      dedicatedTargetKnown: true,
      targetKind: targetKind(connectionString),
      reason: "hosted_check_failed",
      message: error?.message || String(error),
    };
  }
}

function assess({ rawZip, sqlite, hosted, minAddressRows: minRows, storageReviewed: reviewed, targetDecisionReviewed: targetReviewed }) {
  const blockers = [];
  const warnings = [];
  if (!rawZip.exists) blockers.push("raw_gnaf_zip_missing");
  if (!sqlite.exists) blockers.push("local_national_sqlite_missing");
  if (sqlite.exists && sqlite.count < minRows) blockers.push("local_national_sqlite_below_threshold");
  if (sqlite.exists && !requiredStatesPresent(sqlite.states)) blockers.push("local_national_sqlite_missing_required_states");
  if (hosted.checked && hosted.ok === false) blockers.push(hosted.reason || "hosted_target_not_reachable");
  if (!hosted.checked) warnings.push("hosted_target_not_checked");
  if (hosted.checked && hosted.ok && hosted.addressRows >= minRows) warnings.push("hosted_target_already_has_national_rows");
  if (!reviewed) {
    warnings.push("storage_review_not_confirmed");
    if (sqlite.sizeGb >= 8) warnings.push("large_index_storage_review_required");
  }
  if (hosted.targetKind === "supabase" && !targetReviewed) {
    warnings.push("supabase_migration_review_not_confirmed");
  }

  const readyToLoad =
    blockers.length === 0 &&
    reviewed &&
    targetReviewed &&
    hosted.checked &&
    hosted.ok &&
    hosted.dedicatedTargetKnown !== false;
  return {
    status: readyToLoad ? "ready_to_load" : blockers.length ? "blocked" : "review_required",
    blockers,
    warnings,
    estimatedHostedStorageGbRange,
    hostedRowGap: hosted.addressRows !== undefined ? Math.max(0, minRows - hosted.addressRows) : null,
  };
}

function commandPlan(inputPath, storageReview, planRunId) {
  const input = path.relative(ROOT, inputPath);
  const reviewPath = storageReview?.path || "docs/gnaf-hosted-storage-review-2026-06-29.json";
  const reviewArg = storageReview?.ok && storageReview.path ? ` --storage-review ${storageReview.path}` : "";
  const stagedReviewArg = reviewPath ? ` --storage-review ${reviewPath}` : "";
  const progressPath = `tmp/gnaf-raw-postgres-load-${planRunId}.json`;
  const shardProgressPath = `tmp/gnaf-raw-postgres-load-${planRunId}-NSW-shard.json`;
  const progressArg = ` --progress-json ${progressPath} --run-id ${planRunId}`;
  return {
    validationLoad: `npm run load:gnaf-raw-postgres -- --input ${input} --limit-per-state 1000`,
    stateShardLoad: `npm run load:gnaf-raw-postgres -- --input ${input} --states NSW --reset --skip-indexes --allow-state-shard${stagedReviewArg} --progress-json ${shardProgressPath} --run-id ${planRunId}-NSW-shard`,
    stateShardCreateIndexes: "npm run load:gnaf-raw-postgres -- --setup-only --create-indexes",
    stateShardReadiness: "npm run check:gnaf-hosted:readiness",
    nationalLoad: `npm run load:gnaf-raw-postgres -- --input ${input} --reset --skip-indexes --allow-large-load${reviewArg}${progressArg}`,
    createIndexes: "npm run load:gnaf-raw-postgres -- --setup-only --create-indexes",
    readiness: "npm run check:gnaf-hosted:readiness",
    localRelease: "npm run release:lookup-local -- --plan-smoke",
  };
}

function renderReport(payload) {
  const stateRows = payload.sqlite.states.length
    ? payload.sqlite.states.map((row) => `${row.state} | ${row.count}`).join("\n")
    : "none | 0";
  return `# Fuel Path Hosted G-NAF Load Plan

Run ID: ${payload.runId}

## Summary

- Status: ${payload.assessment.status}
- Blockers: ${payload.assessment.blockers.length ? payload.assessment.blockers.join(", ") : "none"}
- Warnings: ${payload.assessment.warnings.length ? payload.assessment.warnings.join(", ") : "none"}
- Estimated hosted storage range: ${payload.assessment.estimatedHostedStorageGbRange.length ? `${payload.assessment.estimatedHostedStorageGbRange[0]}-${payload.assessment.estimatedHostedStorageGbRange[1]} GB` : "unknown"}

## Local Source

- Raw ZIP: ${payload.rawZip.exists ? "present" : "missing"} (${payload.rawZip.sizeGb} GB) at ${payload.rawZip.path}
- SQLite: ${payload.sqlite.exists ? "present" : "missing"} (${payload.sqlite.sizeGb} GB) at ${payload.sqlite.path}
- SQLite rows: ${payload.sqlite.count}
- Local national readiness: ${payload.sqlite.nationalReady ? "yes" : "no"}

state | rows
--- | ---:
${stateRows}

## Hosted Target

- Checked: ${payload.hosted.checked ? "yes" : "no"}
- Dedicated target known: ${payload.hosted.dedicatedTargetKnown ? "yes" : "no"}
- Target kind: ${payload.hosted.targetKind || "unknown"}
- Rows: ${payload.hosted.addressRows ?? "unknown"}
- Missing indexes: ${payload.hosted.missingIndexes?.length ? payload.hosted.missingIndexes.join(", ") : "none"}
- Row gap to readiness threshold: ${payload.assessment.hostedRowGap ?? "unknown"}
- Target decision reviewed: ${payload.targetDecisionReviewed ? "yes" : "no"}

## Storage Review

- Checked: ${payload.storageReview.checked ? "yes" : "no"}
- Status: ${payload.storageReview.status || payload.storageReview.reason || "missing"}
- Source: ${payload.storageReview.path || "none"}
- Confirmed: ${payload.storageReviewed ? "yes" : "no"}

## Commands

Validation load:

\`\`\`bash
${payload.commands.validationLoad}
\`\`\`

State-shard validation load:

\`\`\`bash
${payload.commands.stateShardLoad}
${payload.commands.stateShardCreateIndexes}
${payload.commands.stateShardReadiness}
\`\`\`

National load, after explicit full-load storage approval:

\`\`\`bash
${payload.commands.nationalLoad}
${payload.commands.createIndexes}
${payload.commands.readiness}
\`\`\`

Local release evidence after hosted work:

\`\`\`bash
${payload.commands.localRelease}
\`\`\`

## Guardrail

Do not run the national hosted load until storage/cost has been reviewed for the chosen dedicated target. If the target is Supabase, also record a like-for-like migration review covering storage, cost, latency, connection pooling, backups, operational ownership and rollback from the current Oracle API path. The local SQLite file is ${payload.sqlite.sizeGb} GB before Postgres table and index overhead.
`;
}

function targetKind(connectionString) {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    if (host.includes("oracle") || host.includes("oraclevcn") || host.includes("oci")) return "oracle";
    if (host.includes("neon.tech")) return "neon";
    if (host.includes("supabase.co") || host.includes("supabase.com")) return "supabase";
    if (["localhost", "127.0.0.1", "::1"].includes(host)) return "local";
    return "other";
  } catch {
    return "unknown";
  }
}

function requiredStatesPresent(states) {
  const available = new Set(states.map((row) => row.state));
  return ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].every((state) => available.has(state));
}

function latestStorageReview() {
  const candidates = [];
  const regex = /^gnaf-hosted-storage-review-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/;
  const datedRegex = /^gnaf-hosted-storage-review-\d{4}-\d{2}-\d{2}\.json$/;
  for (const dirName of ["tmp", "docs"]) {
    const dir = path.join(ROOT, dirName);
    if (!fs.existsSync(dir)) continue;
    candidates.push(...fs.readdirSync(dir)
      .filter((name) => regex.test(name) || datedRegex.test(name))
      .map((name) => path.join(dirName, name)));
  }
  return candidates
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)))[0] || "";
}

function readStorageReview(filePath, { estimatedHostedStorageGbRange }) {
  try {
    const review = JSON.parse(fs.readFileSync(path.resolve(ROOT, filePath), "utf8"));
    if (review.decision === "neon_staged_validation_full_national_not_approved") {
      return {
        checked: true,
        ok: false,
        path: path.relative(ROOT, path.resolve(ROOT, filePath)),
        status: review.status || "",
        decision: review.decision,
        reviewHostedStorageMaxGb: Number(review.currentEvidence?.estimatedHostedStorageMaxGb || 0),
        currentHostedStorageMaxGb: Number(estimatedHostedStorageGbRange[1] || 0),
        reason: "national_load_not_approved_staged_validation_only",
      };
    }
    const reviewMax = Number(review.estimates?.hostedStorageMaxGb || 0);
    const currentMax = Number(estimatedHostedStorageGbRange[1] || 0);
    const ok = review.status === "passed" &&
      review.decision === "storage_cost_review_confirmed_for_oracle_always_free_national_load_attempt" &&
      review.assumptions?.target === "oracle_always_free_compute" &&
      reviewMax >= currentMax;
    return {
      checked: true,
      ok,
      path: path.relative(ROOT, path.resolve(ROOT, filePath)),
      status: review.status || "",
      decision: review.decision || "",
      reviewHostedStorageMaxGb: reviewMax,
      currentHostedStorageMaxGb: currentMax,
      reason: ok ? "" : "storage_review_not_applicable_to_current_plan",
    };
  } catch (error) {
    return {
      checked: true,
      ok: false,
      path: path.relative(ROOT, path.resolve(ROOT, filePath)),
      status: "invalid",
      reason: "storage_review_invalid",
      message: error?.message || String(error),
    };
  }
}

function round(value, decimals) {
  return Number(value.toFixed(decimals));
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function loadLocalEnv(file = ".env.local") {
  const envPath = path.resolve(ROOT, file);
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (process.env[key] !== undefined) continue;
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
