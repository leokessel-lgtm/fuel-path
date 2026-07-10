const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const CHECKER = path.join(ROOT, "scripts/measure-doc-context.mjs");

test("context budget passes within a committed ceiling", async (context) => {
  const fixture = createFixture(context, 3);
  const { stdout } = await runChecker(fixture);
  assert.match(stdout, /\| small \| 1 \| 1 \| 4 \| 1 \| 3 \|/);
});

test("context budget fails when a profile exceeds its ceiling", async (context) => {
  const fixture = createFixture(context, 0.5);
  await assert.rejects(runChecker(fixture), (error) => {
    assert.match(error.stderr, /small: 1 > 0\.5/);
    return true;
  });
});

test("context budget fails when a protected profile loses growth headroom", async (context) => {
  const fixture = createFixture(context, 1.1, { minimumHeadroomPercent: 15, headroomProfiles: ["small"] });
  await assert.rejects(runChecker(fixture), (error) => {
    assert.match(error.stderr, /small: 9\.1% headroom < 15%/);
    return true;
  });
});

test("context budget rejects headroom policy drift to an unknown profile", async (context) => {
  const fixture = createFixture(context, 3, { minimumHeadroomPercent: 15, headroomProfiles: ["missing"] });
  await assert.rejects(runChecker(fixture), (error) => {
    assert.match(error.stderr, /missing: headroom policy has no profile/);
    return true;
  });
});

test("context budget rejects removing required guidance to create headroom", async (context) => {
  const fixture = createFixture(context, 3, { requiredProfileFiles: { small: ["essential.md"] } });
  await assert.rejects(runChecker(fixture), (error) => {
    assert.match(error.stderr, /small: required context missing: essential\.md/);
    return true;
  });
});

function createFixture(context, ceiling, policy = {}) {
  const fixture = mkdtempSync(path.join(tmpdir(), "fuel-path-context-budget-"));
  context.after(() => rmSync(fixture, { force: true, recursive: true }));
  writeFixtureFile(fixture, "small.md", "test");
  writeFixtureFile(fixture, "profiles.json", `${JSON.stringify({
    estimationMethod: "ceil(UTF-8 text characters / 4)",
    maxEstimatedTokens: { small: ceiling },
    profiles: { small: ["small.md"] },
    ...policy,
  }, null, 2)}\n`);
  return fixture;
}

function writeFixtureFile(fixture, relativePath, contents) {
  const target = path.join(fixture, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

function runChecker(fixture) {
  return execFileAsync(process.execPath, [CHECKER, "profiles.json"], {
    cwd: fixture,
    timeout: 10_000,
  });
}
