const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("G-NAF Postgres setup-only dry run does not require raw ZIP input", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/load-gnaf-raw-postgres.mjs",
      "--setup-only",
      "--create-indexes",
      "--dry-run",
      "--input",
      "tmp/definitely-missing-gnaf.zip",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );

  assert.match(stdout, /Dry run: database writes are disabled/);
  assert.match(stdout, /would create G-NAF Postgres table and indexes/);
});

test("G-NAF raw Postgres loader creates every readiness-required search index", () => {
  const loaderSource = fs.readFileSync(path.join(ROOT, "scripts/load-gnaf-raw-postgres.mjs"), "utf8");
  const sqlSource = fs.readFileSync(path.join(ROOT, "scripts/sql/gnaf-address-index-postgres.sql"), "utf8");
  const requiredIndexes = [
    "fuel_path_gnaf_addresses_search_prefix_idx",
    "fuel_path_gnaf_addresses_search_trgm_idx",
    "fuel_path_gnaf_addresses_state_postcode_idx",
    "fuel_path_gnaf_addresses_locality_idx",
  ];

  for (const indexName of requiredIndexes) {
    assert.match(loaderSource, new RegExp(indexName));
    assert.match(sqlSource, new RegExp(indexName));
  }
});

test("G-NAF setup-only dry run can write a progress manifest", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnaf-load-progress-"));
  const progressPath = path.join(dir, "progress.json");

  await execFileAsync(
    process.execPath,
    [
      "scripts/load-gnaf-raw-postgres.mjs",
      "--setup-only",
      "--create-indexes",
      "--dry-run",
      "--input",
      "tmp/definitely-missing-gnaf.zip",
      "--progress-json",
      progressPath,
      "--run-id",
      "dry-progress-test",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );

  const progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));
  assert.equal(progress.runId, "dry-progress-test");
  assert.equal(progress.status, "dry_run_completed");
  assert.deepEqual(progress.errors, []);
});

test("G-NAF dry run can resume from a progress manifest and skip completed states", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnaf-load-resume-"));
  const progressPath = path.join(dir, "progress.json");
  fs.writeFileSync(progressPath, `${JSON.stringify({
    runId: "previous-run",
    status: "failed",
    total: 123,
    completedStates: ["ACT", "NSW"],
    stateCounts: {
      ACT: 50,
      NSW: 73,
    },
  })}\n`);

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/load-gnaf-raw-postgres.mjs",
      "--dry-run",
      "--input",
      "package.json",
      "--states",
      "ACT,NSW",
      "--resume-progress-json",
      progressPath,
      "--run-id",
      "resume-test",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );

  assert.match(stdout, /Skipping ACT: already completed in resume manifest/);
  assert.match(stdout, /Skipping NSW: already completed in resume manifest/);
  const progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));
  assert.equal(progress.runId, "resume-test");
  assert.equal(progress.status, "completed");
  assert.equal(progress.total, 123);
  assert.deepEqual(progress.completedStates, ["ACT", "NSW"]);
  assert.deepEqual(progress.skippedStates, ["ACT", "NSW"]);
  assert.match(progress.resumeFrom, /progress\.json$/);
});

test("G-NAF resume refuses reset because it would erase completed state evidence", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnaf-load-resume-reset-"));
  const progressPath = path.join(dir, "progress.json");
  fs.writeFileSync(progressPath, `${JSON.stringify({ completedStates: ["ACT"] })}\n`);

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/load-gnaf-raw-postgres.mjs",
        "--dry-run",
        "--input",
        "package.json",
        "--states",
        "ACT",
        "--resume-progress-json",
        progressPath,
        "--reset",
      ],
      { cwd: ROOT, timeout: 10_000 },
    ),
    (error) => {
      assert.match(error.stderr, /Refusing to resume a G-NAF load while --reset is set/);
      return true;
    },
  );
});

test("G-NAF national hosted load requires a passed storage review", async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/load-gnaf-raw-postgres.mjs",
        "--input",
        "package.json",
        "--database-url",
        "postgres://fuelpath:example@127.0.0.1:9/fuel_path_gnaf",
        "--allow-large-load",
      ],
      { cwd: ROOT, timeout: 10_000 },
    ),
    (error) => {
      assert.match(error.stderr, /Refusing an unbounded hosted G-NAF load without a passed storage\/cost review/);
      return true;
    },
  );
});

test("G-NAF national hosted load requires a progress manifest path after storage review", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnaf-load-review-"));
  const reviewPath = path.join(dir, "review.json");
  writePassedStorageReview(reviewPath);

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/load-gnaf-raw-postgres.mjs",
        "--input",
        "package.json",
        "--database-url",
        "postgres://fuelpath:example@127.0.0.1:9/fuel_path_gnaf",
        "--allow-large-load",
        "--storage-review",
        reviewPath,
      ],
      { cwd: ROOT, timeout: 10_000 },
    ),
    (error) => {
      assert.match(error.stderr, /Refusing an unbounded hosted G-NAF load without --progress-json/);
      return true;
    },
  );
});

test("G-NAF national hosted load rejects an invalid storage review", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnaf-load-review-"));
  const reviewPath = path.join(dir, "review.json");
  fs.writeFileSync(reviewPath, `${JSON.stringify({ status: "blocked" })}\n`);

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/load-gnaf-raw-postgres.mjs",
        "--input",
        "package.json",
        "--database-url",
        "postgres://fuelpath:example@127.0.0.1:9/fuel_path_gnaf",
        "--allow-large-load",
        "--storage-review",
        reviewPath,
      ],
      { cwd: ROOT, timeout: 10_000 },
    ),
    (error) => {
      assert.match(error.stderr, /Refusing an unbounded hosted G-NAF load without a passed storage\/cost review/);
      return true;
    },
  );
});

test("G-NAF setup failure writes failed progress when a progress path is provided", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnaf-load-setup-fail-"));
  const progressPath = path.join(dir, "progress.json");

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/load-gnaf-raw-postgres.mjs",
        "--setup-only",
        "--database-url",
        "postgres://fuelpath:example@127.0.0.1:9/fuel_path_gnaf",
        "--progress-json",
        progressPath,
        "--run-id",
        "setup-fail-test",
      ],
      { cwd: ROOT, timeout: 10_000 },
    ),
  );

  const progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));
  assert.equal(progress.runId, "setup-fail-test");
  assert.equal(progress.status, "failed");
  assert.equal(progress.errors.length > 0, true);
});

function writePassedStorageReview(filePath) {
  fs.writeFileSync(filePath, `${JSON.stringify({
    status: "passed",
    decision: "storage_cost_review_confirmed_for_oracle_always_free_national_load_attempt",
    assumptions: {
      target: "oracle_always_free_compute",
    },
  })}\n`);
}
