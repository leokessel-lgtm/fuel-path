const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("database platform review blocks the empty template", async () => {
  const result = await runReview(["--evidence-json", "DATABASE-PLATFORM-REVIEW.template.json", "--allow-blocked"]);

  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.includes("candidate_row_count_below_gnaf_threshold"), true);
  assert.equal(result.blockers.includes("candidate_benchmark_too_small"), true);
  assert.equal(result.blockers.includes("candidate_monthly_cost_missing"), true);
  assert.equal(result.blockers.includes("candidate_restore_test_plan_missing"), true);
});

test("database platform review rejects direct mobile database access", async () => {
  const filePath = writeEvidence("database-review-direct-mobile", {
    ...passingEvidence(),
    candidate: {
      ...passingEvidence().candidate,
      mobileDirectAccess: true,
      connection: {
        ...passingEvidence().candidate.connection,
        mobileDirectAccess: true,
      },
    },
  });

  const result = await runReview(["--evidence-json", filePath, "--allow-blocked"]);

  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.includes("candidate_mobile_direct_database_access_forbidden"), true);
  assert.equal(result.blockers.includes("candidate_connection_mobile_direct_access_forbidden"), true);
});

test("database platform review passes complete Supabase evidence", async () => {
  const filePath = writeEvidence("database-review-pass", passingEvidence());

  const result = await runReview(["--evidence-json", filePath]);

  assert.equal(result.status, "ready");
  assert.equal(result.blockers.length, 0);
  assert.equal(result.review.candidate.provider, "supabase");
  assert.equal(result.review.rollback.currentOracleApiRetained, true);
});

async function runReview(args) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-database-platform-review.mjs", ...args],
    {
      cwd: ROOT,
      timeout: 20_000,
    },
  );
  return JSON.parse(stdout);
}

function writeEvidence(name, payload) {
  const dir = path.join(ROOT, "tmp", "database-platform-review-tests");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return filePath;
}

function passingEvidence() {
  const now = new Date().toISOString();
  return {
    reviewedAt: now,
    reviewer: "Fuel Path technical review",
    current: {
      provider: "oracle_api",
      accessPattern: "token_protected_api",
      rowCount: 16_905_824,
      postgresPrivate: true,
      publicApiTokenProtected: true,
      readinessEvidence: "tmp/gnaf-hosted-readiness-2026-06-19T20-59-public-api.clean.json",
      benchmark: {
        cases: 900,
        addressCases: 600,
        poiCases: 300,
        finalTopRate: 1,
        p90AnyChars: 18,
        p95LatencyMs: 900,
        evidenceFile: "tmp/geocode-hosted-national-benchmark-2026-06-20T20-34-17-079Z.json",
      },
    },
    candidate: {
      provider: "supabase",
      role: "gnaf_lookup",
      rowCount: 16_905_824,
      loadedAt: now,
      dedicatedProject: true,
      mobileDirectAccess: false,
      indexes: [
        "fuel_path_gnaf_addresses_search_prefix_idx",
        "fuel_path_gnaf_addresses_search_trgm_idx",
        "fuel_path_gnaf_addresses_state_postcode_idx",
        "fuel_path_gnaf_addresses_locality_idx",
      ],
      benchmark: {
        cases: 900,
        addressCases: 600,
        poiCases: 300,
        finalTopRate: 1,
        p90AnyChars: 18,
        p95LatencyMs: 850,
        p99LatencyMs: 1200,
        generatedAt: now,
        evidenceFile: "tmp/supabase-geocode-hosted-national-benchmark.json",
      },
      storage: {
        estimatedGb: 35,
        monthlyCostAud: 60,
        includesIndexes: true,
        reviewedAt: now,
        sourceRefs: [
          "https://supabase.com/docs/guides/platform/database-size",
          "https://supabase.com/docs/guides/platform/billing-on-supabase",
        ],
      },
      connection: {
        serverSideOnly: true,
        mobileDirectAccess: false,
        poolingMode: "transaction",
        runtimePlan: "Vercel API calls Supabase Postgres through server-side environment variables only.",
        secretHandling: "Service credentials stay in backend env vars and are never shipped to mobile clients.",
      },
      backup: {
        dailyBackups: true,
        pitrDecision: "enabled",
        restoreTestPlan: "Restore the loaded project into a separate project and rerun hosted readiness.",
        backupRefs: [
          "https://supabase.com/docs/guides/platform/backups",
          "https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery",
        ],
      },
      operations: {
        owner: "Fuel Path operator",
        monitoringPlan: "Track latency, database size, connections and failed lookup rates daily.",
        incidentPlan: "Fail back to Oracle API if Supabase lookup readiness or latency breaches thresholds.",
        budgetAlertPlan: "Set monthly spend alert before production traffic is routed to Supabase.",
      },
    },
    rollback: {
      currentOracleApiRetained: true,
      rollbackPlan: "Keep Oracle G-NAF API env vars and Caddy service active until Supabase has a full release cycle.",
      rollbackTestPlan: "Switch API base back to Oracle env vars and rerun hosted readiness plus benchmark.",
    },
    sources: [
      "https://supabase.com/docs/guides/database/connecting-to-postgres",
      "https://supabase.com/docs/guides/database/connection-management",
      "https://supabase.com/docs/guides/platform/backups",
      "https://supabase.com/docs/guides/platform/database-size",
      "https://supabase.com/docs/guides/platform/compute-and-disk",
    ],
  };
}
