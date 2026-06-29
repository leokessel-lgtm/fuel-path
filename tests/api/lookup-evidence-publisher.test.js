const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const ROOT = path.resolve(__dirname, "../..");
const execFileAsync = promisify(execFile);

test("lookup evidence publisher emits readiness env from passing hosted check and benchmark", async () => {
  const fixture = writeFixture({
    hosted: passingHostedCheck(),
    benchmark: passingBenchmark(),
  });

  const { stdout } = await runPublisher(fixture);
  const env = parseEnv(stdout);

  assert.equal(env.FUEL_PATH_GNAF_ADDRESS_ROWS, "17000000");
  assert.equal(env.FUEL_PATH_GNAF_EXACT_SMOKE_STATUS, "passed");
  assert.equal(env.FUEL_PATH_GNAF_BENCHMARK_STATUS, "passed");
  assert.equal(env.FUEL_PATH_GNAF_BENCHMARK_CASES, "900");
  assert.equal(env.FUEL_PATH_GNAF_BENCHMARK_ADDRESS_TOP_RATE, "1");
  assert.equal(env.FUEL_PATH_GNAF_BENCHMARK_POI_TOP_RATE, "0.99");
  assert.equal(env.FUEL_PATH_GNAF_BENCHMARK_ADDRESS_P90_CHARS, "34");
  assert.equal(env.FUEL_PATH_GNAF_BENCHMARK_POI_P90_CHARS, "9");

  const readiness = await runLookupReadiness(env);
  assert.equal(readiness.ok, true);
  assert.equal(readiness.publicExactAddressClaimsAllowed, true);
});

test("lookup evidence publisher fails when exact smoke evidence is missing", async () => {
  const hosted = passingHostedCheck();
  hosted.api.exactSmokePassed = false;
  hosted.api.exactSmokeFailures = [{ id: "wa", ok: false }];
  const fixture = writeFixture({
    hosted,
    benchmark: passingBenchmark(),
  });

  const result = await runPublisher(fixture, false);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, false);
  assert.equal(payload.env.FUEL_PATH_GNAF_EXACT_SMOKE_STATUS, "failed");
  assert.equal(payload.blockers.includes("exact_smoke_not_passed"), true);
});

test("lookup evidence publisher fails when hosted benchmark thresholds are not met", async () => {
  const benchmark = passingBenchmark();
  benchmark.summary.byKind.poi.finalTopRate = 0.9;
  const fixture = writeFixture({
    hosted: passingHostedCheck(),
    benchmark,
  });

  const result = await runPublisher(fixture, false);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, false);
  assert.equal(payload.env.FUEL_PATH_GNAF_BENCHMARK_STATUS, "failed");
  assert.equal(payload.blockers.includes("hosted_benchmark_thresholds_not_met"), true);
});

test("lookup evidence publisher fails when benchmark timestamp cannot be proven", async () => {
  const benchmark = passingBenchmark();
  benchmark.runId = "manual-copy";
  const fixture = writeFixture({
    hosted: passingHostedCheck(),
    benchmark,
  });

  const result = await runPublisher(fixture, false);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, false);
  assert.equal(payload.env.FUEL_PATH_GNAF_BENCHMARK_AT, "");
  assert.equal(payload.blockers.includes("benchmark_run_timestamp_missing"), true);
});

test("lookup evidence publisher fails when benchmark timestamp is future dated", async () => {
  const benchmark = passingBenchmark();
  benchmark.runId = "2099-01-01T00-00-00-000Z";
  const fixture = writeFixture({
    hosted: passingHostedCheck(),
    benchmark,
  });

  const result = await runPublisher(fixture, false);
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, false);
  assert.equal(payload.env.FUEL_PATH_GNAF_BENCHMARK_STATUS, "failed");
  assert.equal(payload.env.FUEL_PATH_GNAF_BENCHMARK_AT, "2099-01-01T00:00:00.000Z");
  assert.equal(payload.source.benchmarkFutureDated, true);
  assert.equal(payload.blockers.includes("benchmark_run_timestamp_future_dated"), true);
  assert.equal(payload.blockers.includes("hosted_benchmark_thresholds_not_met"), true);
});

async function runPublisher({ hostedPath, benchmarkPath }, expectSuccess = true) {
  try {
    const result = await execFileAsync(
      process.execPath,
      [
        "scripts/publish-lookup-readiness-evidence.mjs",
        "--hosted-check",
        hostedPath,
        "--benchmark",
        benchmarkPath,
        "--format",
        expectSuccess ? "env" : "json",
      ],
      { cwd: ROOT, timeout: 15_000 },
    );
    assert.equal(expectSuccess, true, "expected publisher to fail");
    return result;
  } catch (error) {
    assert.equal(expectSuccess, false, error.stderr?.toString() || error.message);
    return {
      stdout: error.stdout.toString(),
      stderr: error.stderr.toString(),
    };
  }
}

async function runLookupReadiness(env) {
  const { stdout } = await execFileAsync(process.execPath, ["scripts/check-lookup-readiness.mjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...env,
      FUEL_PATH_GNAF_API_URL: "https://gnaf.example.test",
      FUEL_PATH_GNAF_API_TOKEN: "test-token-with-more-than-thirty-two-characters",
      FUEL_PATH_GNAF_DATABASE_URL: "",
      FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED: "",
      FUEL_PATH_GOOGLE_PLACES_FALLBACK_ENABLED: "",
      FUEL_PATH_GOOGLE_PLACES_API_KEY: "",
      GOOGLE_MAPS_API_KEY: "",
      DATABASE_URL: "",
      FUEL_PATH_GEOCODE_QUOTA_DATABASE_URL: "",
      POSTGRES_URL: "",
      POSTGRES_PRISMA_URL: "",
      NEON_DATABASE_URL: "",
    },
    timeout: 15_000,
  });
  return JSON.parse(stdout);
}

function writeFixture({ hosted, benchmark }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dir = path.join(ROOT, "tmp", "lookup-evidence-publisher-tests");
  fs.mkdirSync(dir, { recursive: true });
  const hostedPath = path.join(dir, `hosted-${id}.json`);
  const benchmarkPath = path.join(dir, `benchmark-${id}.json`);
  fs.writeFileSync(hostedPath, JSON.stringify(hosted, null, 2));
  fs.writeFileSync(benchmarkPath, JSON.stringify(benchmark, null, 2));
  return { hostedPath, benchmarkPath };
}

function passingHostedCheck() {
  return {
    ok: true,
    mode: "readiness",
    minAddressRows: 10_000_000,
    api: {
      ready: true,
      healthRows: 17_000_000,
      healthRowsReady: true,
      authRejectsMissingToken: true,
      authRejectsWrongToken: true,
      exactSmokePassed: true,
      exactSmokeFailures: [],
    },
    readinessProblems: [],
  };
}

function passingBenchmark() {
  return {
    runId: "2026-06-19T12-57-35-560Z",
    summary: {
      overall: {
        cases: 900,
      },
      byKind: {
        address: {
          cases: 600,
          finalTopRate: 1,
          p90AnyChars: 34,
        },
        poi: {
          cases: 300,
          finalTopRate: 0.99,
          p90AnyChars: 9,
        },
      },
    },
  };
}

function parseEnv(text) {
  return Object.fromEntries(
    text
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}
