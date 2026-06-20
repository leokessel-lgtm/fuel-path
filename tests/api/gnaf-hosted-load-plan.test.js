const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("hosted G-NAF load plan tracks the readiness-required prefix index", () => {
  const source = fs.readFileSync(path.join(ROOT, "scripts/plan-gnaf-hosted-load.mjs"), "utf8");

  assert.match(source, /fuel_path_gnaf_addresses_search_prefix_idx/);
  assert.match(source, /targetKind/);
  assert.match(source, /supabase/);
});

test("hosted G-NAF load plan blocks when local national SQLite is missing", async () => {
  const dir = fixtureDir("missing-sqlite");
  const rawZip = path.join(dir, "gnaf.zip");
  fs.writeFileSync(rawZip, "zip");

  const result = await runPlan([
    "--raw-zip",
    rawZip,
    "--sqlite",
    path.join(dir, "missing.sqlite"),
    "--skip-hosted",
    "--run-id",
    "missing-sqlite",
  ]);

  assert.equal(result.payload.assessment.status, "blocked");
  assert.equal(result.payload.assessment.blockers.includes("local_national_sqlite_missing"), true);
  assert.match(result.report, /local_national_sqlite_missing/);
});

test("hosted G-NAF load plan requires explicit storage review before national load", async () => {
  const dir = fixtureDir("review-required");
  const rawZip = path.join(dir, "gnaf.zip");
  const sqlite = path.join(dir, "national.sqlite");
  fs.writeFileSync(rawZip, "zip");
  writeSqlite(sqlite, 2, ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);

  const result = await runPlan([
    "--raw-zip",
    rawZip,
    "--sqlite",
    sqlite,
    "--skip-hosted",
    "--min-rows",
    "16",
    "--run-id",
    "review-required",
  ]);

  assert.equal(result.payload.assessment.status, "review_required");
  assert.equal(result.payload.sqlite.count, 16);
  assert.equal(result.payload.sqlite.nationalReady, true);
  assert.equal(result.payload.assessment.warnings.includes("storage_review_not_confirmed"), true);
  assert.match(result.report, /National load, after storage review/);
});

test("hosted G-NAF load plan still requires hosted target evidence after storage review", async () => {
  const dir = fixtureDir("ready");
  const rawZip = path.join(dir, "gnaf.zip");
  const sqlite = path.join(dir, "national.sqlite");
  fs.writeFileSync(rawZip, "zip");
  writeSqlite(sqlite, 2, ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);

  const result = await runPlan([
    "--raw-zip",
    rawZip,
    "--sqlite",
    sqlite,
    "--skip-hosted",
    "--confirm-storage-reviewed",
    "--min-rows",
    "16",
    "--run-id",
    "ready",
  ]);

  assert.equal(result.payload.assessment.status, "review_required");
  assert.equal(result.payload.assessment.blockers.length, 0);
  assert.equal(result.payload.assessment.warnings.includes("hosted_target_not_checked"), true);
});

test("hosted G-NAF storage review passes for Oracle Always Free with disk headroom", async () => {
  const dir = fixtureDir("storage-review-pass");
  const loadPlanPath = writeLoadPlanFixture(dir, {
    rawZipGb: 1.4,
    sqliteGb: 11.68,
    hostedStorageRange: [17.5, 35],
  });

  const result = await runReview([
    "--load-plan",
    loadPlanPath,
    "--out-dir",
    dir,
    "--run-id",
    "storage-pass",
    "--require-passed",
  ]);

  assert.equal(result.payload.status, "passed");
  assert.equal(result.payload.estimates.provisionedBlockGb, 180);
  assert.equal(result.payload.estimates.freeTierHeadroomGb, 20);
  assert.equal(result.payload.estimates.loadDiskHeadroomGb > 50, true);
  assert.equal(result.payload.envContract.FUEL_PATH_GNAF_STORAGE_REVIEW_CONFIRMED, "1");
  assert.match(result.report, /storage\/cost side of attempting the national hosted G-NAF load/);
});

test("hosted G-NAF storage review blocks paid-risk volume sizing", async () => {
  const dir = fixtureDir("storage-review-oversized");
  const loadPlanPath = writeLoadPlanFixture(dir, {
    rawZipGb: 1.4,
    sqliteGb: 11.68,
    hostedStorageRange: [17.5, 35],
  });

  await assert.rejects(
    runReview([
      "--load-plan",
      loadPlanPath,
      "--out-dir",
      dir,
      "--run-id",
      "storage-oversized",
      "--boot-volume-gb",
      "220",
      "--require-passed",
    ]),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.blockers.includes("provisioned_storage_exceeds_oracle_always_free_limit"), true);
      return true;
    },
  );
});

test("hosted G-NAF storage review blocks load workspace that cannot fit", async () => {
  const dir = fixtureDir("storage-review-tight");
  const loadPlanPath = writeLoadPlanFixture(dir, {
    rawZipGb: 1.4,
    sqliteGb: 11.68,
    hostedStorageRange: [17.5, 80],
  });

  await assert.rejects(
    runReview([
      "--load-plan",
      loadPlanPath,
      "--out-dir",
      dir,
      "--run-id",
      "storage-tight",
      "--boot-volume-gb",
      "120",
      "--require-passed",
    ]),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.blockers.includes("estimated_load_workspace_exceeds_usable_disk"), true);
      return true;
    },
  );
});

test("hosted G-NAF load plan accepts a passing storage review artefact", async () => {
  const dir = fixtureDir("review-accepted");
  const rawZip = path.join(dir, "gnaf.zip");
  const sqlite = path.join(dir, "national.sqlite");
  const reviewPath = path.join(dir, "review.json");
  fs.writeFileSync(rawZip, "zip");
  writeSqlite(sqlite, 2, ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);
  writeStorageReviewFixture(reviewPath, { hostedStorageMaxGb: 1 });

  const result = await runPlan([
    "--raw-zip",
    rawZip,
    "--sqlite",
    sqlite,
    "--skip-hosted",
    "--storage-review",
    reviewPath,
    "--min-rows",
    "16",
    "--run-id",
    "review-accepted",
  ], { allowStorageReview: true });

  assert.equal(result.payload.storageReviewed, true);
  assert.equal(result.payload.storageReview.ok, true);
  assert.equal(result.payload.assessment.warnings.includes("storage_review_not_confirmed"), false);
  assert.equal(result.payload.assessment.warnings.includes("hosted_target_not_checked"), true);
  assert.match(result.payload.commands.nationalLoad, /--storage-review /);
  assert.match(result.payload.commands.nationalLoad, /--progress-json tmp\/gnaf-raw-postgres-load-review-accepted\.json/);
  assert.match(result.payload.commands.nationalLoad, /--run-id review-accepted/);
});

test("hosted G-NAF load plan requires Supabase migration review before readiness", async () => {
  const dir = fixtureDir("supabase-review-required");
  const rawZip = path.join(dir, "gnaf.zip");
  const sqlite = path.join(dir, "national.sqlite");
  fs.writeFileSync(rawZip, "zip");
  writeSqlite(sqlite, 2, ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);

  const result = await runPlan([
    "--raw-zip",
    rawZip,
    "--sqlite",
    sqlite,
    "--database-url",
    "postgresql://postgres:password@db.example.supabase.co:5432/postgres",
    "--skip-hosted",
    "--confirm-storage-reviewed",
    "--min-rows",
    "16",
    "--run-id",
    "supabase-review-required",
  ]);

  assert.equal(result.payload.hosted.targetKind, "supabase");
  assert.equal(result.payload.targetDecisionReviewed, false);
  assert.equal(result.payload.assessment.status, "review_required");
  assert.equal(result.payload.assessment.warnings.includes("supabase_migration_review_not_confirmed"), true);
  assert.match(result.report, /Target decision reviewed: no/);
  assert.match(result.report, /If the target is Supabase/);
});

test("hosted G-NAF load plan records confirmed Supabase migration review", async () => {
  const dir = fixtureDir("supabase-review-confirmed");
  const rawZip = path.join(dir, "gnaf.zip");
  const sqlite = path.join(dir, "national.sqlite");
  fs.writeFileSync(rawZip, "zip");
  writeSqlite(sqlite, 2, ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);

  const result = await runPlan([
    "--raw-zip",
    rawZip,
    "--sqlite",
    sqlite,
    "--database-url",
    "postgresql://postgres:password@db.example.supabase.co:5432/postgres",
    "--skip-hosted",
    "--confirm-storage-reviewed",
    "--confirm-supabase-migration-reviewed",
    "--min-rows",
    "16",
    "--run-id",
    "supabase-review-confirmed",
  ]);

  assert.equal(result.payload.hosted.targetKind, "supabase");
  assert.equal(result.payload.targetDecisionReviewed, true);
  assert.equal(result.payload.assessment.warnings.includes("supabase_migration_review_not_confirmed"), false);
  assert.match(result.report, /Target decision reviewed: yes/);
});

async function runPlan(args, options = {}) {
  const finalArgs = options.allowStorageReview ? args : [...args, "--no-storage-review"];
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/plan-gnaf-hosted-load.mjs", ...finalArgs],
    {
      cwd: ROOT,
      timeout: 20_000,
      env: {
        ...process.env,
        FUEL_PATH_GNAF_DATABASE_URL: "",
        DATABASE_URL: "",
      },
    },
  );
  const summary = JSON.parse(stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, summary.jsonPath), "utf8"));
  const report = fs.readFileSync(path.join(ROOT, summary.reportPath), "utf8");
  return { summary, payload, report };
}

async function runReview(args) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/review-gnaf-hosted-storage.mjs", ...args],
    {
      cwd: ROOT,
      timeout: 20_000,
    },
  );
  const summary = JSON.parse(stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, summary.jsonPath), "utf8"));
  const report = fs.readFileSync(path.join(ROOT, summary.reportPath), "utf8");
  return { summary, payload, report };
}

function fixtureDir(name) {
  const dir = path.join(ROOT, "tmp", "gnaf-hosted-load-plan-tests", `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeSqlite(filePath, perState, states) {
  const db = new DatabaseSync(filePath);
  db.exec("CREATE TABLE addresses (state text)");
  const insert = db.prepare("INSERT INTO addresses (state) VALUES (?)");
  for (const state of states) {
    for (let index = 0; index < perState; index += 1) insert.run(state);
  }
  db.close();
}

function writeLoadPlanFixture(dir, { rawZipGb, sqliteGb, hostedStorageRange }) {
  const file = path.join(dir, "load-plan.json");
  fs.writeFileSync(file, `${JSON.stringify({
    runId: "load-plan-fixture",
    minAddressRows: 10_000_000,
    rawZip: {
      exists: true,
      sizeGb: rawZipGb,
    },
    sqlite: {
      exists: true,
      sizeGb: sqliteGb,
      count: 16_905_824,
      nationalReady: true,
      states: ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].map((state) => ({ state, count: 1 })),
    },
    hosted: {
      checked: true,
      ok: true,
      dedicatedTargetKnown: true,
      addressRows: 80_000,
    },
    assessment: {
      status: "review_required",
      blockers: [],
      warnings: ["storage_review_not_confirmed", "large_index_storage_review_required"],
      estimatedHostedStorageGbRange: hostedStorageRange,
    },
  }, null, 2)}\n`);
  return file;
}

function writeStorageReviewFixture(filePath, { hostedStorageMaxGb }) {
  fs.writeFileSync(filePath, `${JSON.stringify({
    status: "passed",
    decision: "storage_cost_review_confirmed_for_oracle_always_free_national_load_attempt",
    assumptions: {
      target: "oracle_always_free_compute",
    },
    estimates: {
      hostedStorageMaxGb,
    },
  }, null, 2)}\n`);
}
