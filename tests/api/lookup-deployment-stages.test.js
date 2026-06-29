const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("lookup deployment stage plan blocks preview and production when hosted evidence is missing", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lookup-stages-"));
  const summaryPath = writeJson(tmp, "summary.json", releaseSummaryFixture());
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/plan-lookup-deployment-stages.mjs",
      "--release-summary",
      summaryPath,
      "--out-dir",
      tmp,
      "--run-id",
      "blocked-preview",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );

  const result = readLastJson(stdout);
  const plan = readJson(path.join(ROOT, result.jsonPath));
  assert.equal(result.ok, true);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.stages.local_test.status, "ready");
  assert.equal(plan.stages.hosted_preview.status, "blocked");
  assert.equal(plan.stages.production_smoke.status, "blocked");
  assert.equal(plan.stages.paid_fallback.status, "disabled");
  assert.equal(plan.blockers.includes("hosted_preview:hosted_preview_smoke_evidence_missing"), true);
  assert.equal(plan.blockers.includes("production_smoke:lookup_readiness_check_missing"), true);
});

test("lookup deployment stage plan can fail fast for a required blocked stage", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lookup-stages-"));
  const summaryPath = writeJson(tmp, "summary.json", releaseSummaryFixture());

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/plan-lookup-deployment-stages.mjs",
        "--release-summary",
        summaryPath,
        "--out-dir",
        tmp,
        "--run-id",
        "required-production",
        "--require-stage",
        "production_smoke",
      ],
      { cwd: ROOT, timeout: 10_000 },
    ),
    (error) => {
      const payload = readLastJson(error.stdout);
      assert.equal(payload.ok, false);
      assert.equal(payload.requireStage, "production_smoke");
      return true;
    },
  );
});

test("lookup deployment stage plan passes production when release and readiness evidence are ready", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lookup-stages-"));
  const summaryPath = writeJson(tmp, "summary.json", releaseSummaryFixture({
    status: "passed",
    publicLaunchReady: true,
    blockers: [],
    gnafLoadPlanStatus: "passed",
    hostedPreviewStatus: "passed",
    hostedNationalStatus: "passed",
    configuredExactStatus: "passed",
  }));
  const readinessPath = writeJson(tmp, "readiness.json", {
    ok: true,
    status: "ready",
    publicExactAddressClaimsAllowed: true,
    blockers: [],
    providerFallback: {
      billableRequestsEnabled: false,
      paidFallbackEnabled: false,
      quotaStorageDurable: false,
      ready: true,
    },
  });
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/plan-lookup-deployment-stages.mjs",
      "--release-summary",
      summaryPath,
      "--readiness",
      readinessPath,
      "--out-dir",
      tmp,
      "--run-id",
      "ready-production",
      "--require-stage",
      "production_smoke",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );

  const result = readLastJson(stdout);
  const plan = readJson(path.join(ROOT, result.jsonPath));
  assert.equal(result.ok, true);
  assert.equal(plan.status, "ready");
  assert.equal(plan.stages.production_smoke.status, "ready");
  assert.equal(plan.stages.paid_fallback.status, "disabled");
});

test("lookup deployment stage plan blocks enabled paid fallback without all cost controls", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lookup-stages-"));
  const summaryPath = writeJson(tmp, "summary.json", releaseSummaryFixture({
    status: "passed",
    publicLaunchReady: true,
    blockers: [],
    gnafLoadPlanStatus: "passed",
    hostedPreviewStatus: "passed",
    hostedNationalStatus: "passed",
    configuredExactStatus: "passed",
  }));
  const readinessPath = writeJson(tmp, "readiness.json", {
    ok: true,
    status: "ready",
    publicExactAddressClaimsAllowed: true,
    blockers: [],
    providerFallback: {
      billableRequestsEnabled: true,
      paidFallbackEnabled: true,
      quotaStorageDurable: false,
      ready: false,
    },
  });
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/plan-lookup-deployment-stages.mjs",
      "--release-summary",
      summaryPath,
      "--readiness",
      readinessPath,
      "--out-dir",
      tmp,
      "--run-id",
      "blocked-paid",
      "--paid-fallback-daily-cap",
      "250",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );

  const result = readLastJson(stdout);
  const plan = readJson(path.join(ROOT, result.jsonPath));
  assert.equal(result.ok, true);
  assert.equal(plan.stages.production_smoke.status, "ready");
  assert.equal(plan.stages.paid_fallback.status, "blocked");
  assert.deepEqual(plan.stages.paid_fallback.blockers, [
    "paid_fallback_quota_storage_not_durable",
    "paid_fallback_tiny_daily_cap_not_confirmed",
    "paid_fallback_google_key_restriction_not_confirmed",
    "paid_fallback_budget_alert_not_confirmed",
  ]);
});

test("lookup deployment stage plan allows enabled paid fallback after all cost controls", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lookup-stages-"));
  const summaryPath = writeJson(tmp, "summary.json", releaseSummaryFixture({
    status: "passed",
    publicLaunchReady: true,
    blockers: [],
    gnafLoadPlanStatus: "passed",
    hostedPreviewStatus: "passed",
    hostedNationalStatus: "passed",
    configuredExactStatus: "passed",
  }));
  const readinessPath = writeJson(tmp, "readiness.json", {
    ok: true,
    status: "ready",
    publicExactAddressClaimsAllowed: true,
    blockers: [],
    providerFallback: {
      billableRequestsEnabled: true,
      paidFallbackEnabled: true,
      quotaStorageDurable: true,
      dailyCap: 25,
      tinyDailyCapReady: true,
      googlePlacesKeyRestricted: true,
      budgetAlertConfirmed: true,
      ready: true,
    },
  });
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/plan-lookup-deployment-stages.mjs",
      "--release-summary",
      summaryPath,
      "--readiness",
      readinessPath,
      "--out-dir",
      tmp,
      "--run-id",
      "ready-paid",
      "--require-stage",
      "paid_fallback",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );

  const result = readLastJson(stdout);
  const plan = readJson(path.join(ROOT, result.jsonPath));
  assert.equal(result.ok, true);
  assert.equal(plan.status, "ready");
  assert.equal(plan.stages.paid_fallback.status, "ready");
  assert.deepEqual(plan.stages.paid_fallback.blockers, []);
});

test("lookup deployment stage plan default resolver ignores named test summaries", async () => {
  const tmpDir = path.join(ROOT, "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const namedFixture = path.join(tmpDir, "lookup-release-evidence-summary-zz-test-fixture.json");
  const timestampedFixture = path.join(tmpDir, "lookup-release-evidence-summary-2099-01-02T03-04-05-006Z.json");
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "lookup-stages-"));
  try {
    fs.writeFileSync(namedFixture, `${JSON.stringify(releaseSummaryFixture({
      status: "passed",
      publicLaunchReady: true,
      blockers: [],
      gnafLoadPlanStatus: "passed",
      hostedPreviewStatus: "passed",
      hostedNationalStatus: "passed",
      configuredExactStatus: "passed",
    }))}\n`);
    fs.writeFileSync(timestampedFixture, `${JSON.stringify(releaseSummaryFixture())}\n`);

    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "scripts/plan-lookup-deployment-stages.mjs",
        "--out-dir",
        outDir,
        "--run-id",
        "default-resolver",
      ],
      { cwd: ROOT, timeout: 10_000 },
    );
    const result = readLastJson(stdout);
    const plan = readJson(path.join(ROOT, result.jsonPath));

    assert.equal(plan.releaseSummary.path, "tmp/lookup-release-evidence-summary-2099-01-02T03-04-05-006Z.json");
    assert.equal(plan.stages.hosted_preview.status, "blocked");
  } finally {
    fs.rmSync(namedFixture, { force: true });
    fs.rmSync(timestampedFixture, { force: true });
  }
});

function releaseSummaryFixture(overrides = {}) {
  const {
    status = "blocked",
    publicLaunchReady = false,
    blockers = ["hosted_preview_smoke_evidence_missing", "hosted_national_benchmark_evidence_missing"],
    gnafLoadPlanStatus = "blocked",
    hostedPreviewStatus = "blocked",
    hostedNationalStatus = "blocked",
    configuredExactStatus = "blocked",
  } = overrides;
  return {
    runId: "test-run",
    status,
    localPrecisionReady: true,
    publicLaunchReady,
    blockers,
    evidence: {
      routeFields: gate("passed", "tmp/route.json"),
      planFieldSmoke: gate("passed", "tmp/plan.json"),
      gnafLoadPlan: gate(gnafLoadPlanStatus, "tmp/load.json", ["hosted_gnaf_storage_review_required"]),
      hostedPreview: gate(hostedPreviewStatus, "tmp/preview.json", ["hosted_preview_smoke_evidence_missing"]),
      hostedNational: gate(hostedNationalStatus, "tmp/national.json", ["hosted_national_benchmark_evidence_missing"]),
      exactAddressReadiness: {
        currentConfigured: gate(configuredExactStatus, "tmp/exact.json", ["configured_gnaf_not_ready_for_public_exact_address_claim"]),
      },
    },
  };
}

function gate(status, filePath, blockers = []) {
  return {
    status,
    filePath,
    blockers: status === "passed" ? [] : blockers,
    failures: [],
  };
}

function writeJson(dir, name, value) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readLastJson(stdout) {
  const start = stdout.lastIndexOf("\n{");
  return JSON.parse(stdout.slice(start === -1 ? 0 : start + 1));
}
