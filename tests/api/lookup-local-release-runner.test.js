const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("local lookup release runner dry-run keeps the precision pack in order", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/run-lookup-local-release.mjs", "--dry-run"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = readLastJson(stdout);

  assert.equal(payload.dryRun, true);
  assert.equal(payload.includedPlanSmoke, false);
  assert.equal(payload.planSmokeMode, "unreachable");
  assert.equal(payload.includedPlanStress, false);
  assert.equal(payload.planStressMode, "skipped");
  assert.deepEqual(payload.steps.map((step) => step.name), [
    "route-field stress",
    "exact-address route-field stress",
    "600-prefix fallback benchmark",
    "hosted G-NAF load plan",
    "lookup release summary",
  ]);
  assert.match(stdout, /Skipping rendered Plan-field smoke/);
  assert.match(stdout, /Skipping rendered Plan-field stress/);
});

test("local lookup release runner can include rendered Plan-field smoke", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/run-lookup-local-release.mjs", "--dry-run", "--plan-smoke"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = readLastJson(stdout);

  assert.equal(payload.includedPlanSmoke, true);
  assert.equal(payload.planSmokeMode, "forced");
  assert.deepEqual(payload.steps.map((step) => step.name), [
    "route-field stress",
    "exact-address route-field stress",
    "600-prefix fallback benchmark",
    "hosted G-NAF load plan",
    "rendered Plan-field smoke",
    "lookup release summary",
  ]);
  assert.equal(payload.steps.find((step) => step.name === "rendered Plan-field smoke").cwd, "mobile-app");
});

test("local lookup release runner can include rendered Plan-field stress", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/run-lookup-local-release.mjs", "--dry-run", "--plan-smoke", "--plan-stress"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = readLastJson(stdout);

  assert.equal(payload.includedPlanSmoke, true);
  assert.equal(payload.includedPlanStress, true);
  assert.equal(payload.planStressMode, "forced");
  assert.deepEqual(payload.steps.map((step) => step.name), [
    "route-field stress",
    "exact-address route-field stress",
    "600-prefix fallback benchmark",
    "hosted G-NAF load plan",
    "rendered Plan-field smoke",
    "rendered Plan-field stress",
    "lookup release summary",
  ]);
  assert.equal(payload.steps.find((step) => step.name === "rendered Plan-field stress").cwd, "mobile-app");
});

test("local lookup release runner auto-includes rendered Plan-field smoke when app is reachable", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/run-lookup-local-release.mjs", "--dry-run"],
    {
      cwd: ROOT,
      timeout: 10_000,
      env: {
        ...process.env,
        FUEL_PATH_PLAN_FIELD_SMOKE_REACHABLE: "1",
      },
    },
  );
  const payload = readLastJson(stdout);

  assert.equal(payload.includedPlanSmoke, true);
  assert.equal(payload.planSmokeMode, "auto_reachable");
  assert.deepEqual(payload.steps.map((step) => step.name), [
    "route-field stress",
    "exact-address route-field stress",
    "600-prefix fallback benchmark",
    "hosted G-NAF load plan",
    "rendered Plan-field smoke",
    "lookup release summary",
  ]);
  assert.match(stdout, /Including rendered Plan-field smoke/);
});

test("local lookup release runner can explicitly skip rendered Plan-field smoke", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/run-lookup-local-release.mjs", "--dry-run", "--no-plan-smoke"],
    {
      cwd: ROOT,
      timeout: 10_000,
      env: {
        ...process.env,
        FUEL_PATH_PLAN_FIELD_SMOKE_REACHABLE: "1",
      },
    },
  );
  const payload = readLastJson(stdout);

  assert.equal(payload.includedPlanSmoke, false);
  assert.equal(payload.planSmokeMode, "disabled");
  assert.deepEqual(payload.steps.map((step) => step.name), [
    "route-field stress",
    "exact-address route-field stress",
    "600-prefix fallback benchmark",
    "hosted G-NAF load plan",
    "lookup release summary",
  ]);
  assert.match(stdout, /disabled by --no-plan-smoke/);
});

function readLastJson(stdout) {
  const start = stdout.lastIndexOf("\n{");
  assert.notEqual(start, -1, stdout);
  return JSON.parse(stdout.slice(start + 1));
}
