const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const CHECKER = path.join(ROOT, "scripts/check-architecture.mjs");

test("architecture guard accepts a bounded layered fixture", async (context) => {
  const fixture = await createFixture(context);
  const { stdout } = await runChecker(fixture);
  assert.match(stdout, /Architecture check passed/);
});

test("architecture guard keeps source checks active without Git metadata", async (context) => {
  const fixture = createSourceFixture(context);
  const { stdout, stderr } = await runChecker(fixture);
  assert.match(stdout, /source tree without Git metadata/);
  assert.match(stderr, /tracked-residue check skipped/);
});

test("architecture guard rejects tracked generated residue", async (context) => {
  const fixture = await createFixture(context);
  writeFixtureFile(fixture, "tmp/report.json", "{}\n");
  await git(fixture, ["add", "."]);
  await expectFailure(fixture, "generated or machine-local path is tracked: tmp/report.json");
});

test("architecture guard rejects production module growth", async (context) => {
  const fixture = await createFixture(context);
  writeFixtureFile(fixture, "api/_large.js", "one\ntwo\nthree\n");
  await git(fixture, ["add", "."]);
  await expectFailure(fixture, "production module exceeds 2 lines: api/_large.js (3)");
});

test("architecture guard ratchets hotspot limits against the base ref", async (context) => {
  const fixture = createSourceFixture(context);
  const config = fixtureConfig();
  config.lineLimitExceptions["api/_large.js"] = 5;
  writeFixtureFile(fixture, "architecture-check.config.json", `${JSON.stringify(config, null, 2)}\n`);
  writeFixtureFile(fixture, "api/_large.js", "one\ntwo\n");
  await git(fixture, ["init"]);
  await git(fixture, ["add", "."]);
  await git(fixture, ["-c", "user.name=Fuel Path Test", "-c", "user.email=test@fuelpath.invalid", "commit", "-m", "baseline"]);
  writeFixtureFile(fixture, "api/_large.js", "one\ntwo\nthree\n");
  await git(fixture, ["add", "."]);
  await expectFailure(fixture, "production module exceeds 2 lines: api/_large.js (3)", {
    FUEL_PATH_ARCHITECTURE_BASE_REF: "HEAD",
  });
});

test("architecture guard rejects public handler domain coupling", async (context) => {
  const fixture = await createFixture(context);
  writeFixtureFile(fixture, "api/stations.js", 'require ( "./_provider" );\n');
  await git(fixture, ["add", "."]);
  await expectFailure(fixture, "public API handler imports disallowed internal module: api/stations.js -> ./_provider");
});

test("architecture guard rejects mobile lower-layer UI imports", async (context) => {
  const fixture = await createFixture(context);
  writeFixtureFile(fixture, "mobile-app/src/services/store.ts", 'export { Card } from "../components/Card";\n');
  await git(fixture, ["add", "."]);
  await expectFailure(fixture, "mobile lower layer imports UI layer");
});

async function createFixture(context) {
  const fixture = createSourceFixture(context);
  await git(fixture, ["init"]);
  await git(fixture, ["add", "."]);
  return fixture;
}

function createSourceFixture(context) {
  const fixture = mkdtempSync(path.join(tmpdir(), "fuel-path-architecture-"));
  context.after(() => rmSync(fixture, { force: true, recursive: true }));
  writeFixtureFile(fixture, "api/_backend.js", "module.exports = {};\n");
  writeFixtureFile(fixture, "api/status.js", 'require("./_backend");\n');
  writeFixtureFile(fixture, "mobile-app/src/services/store.ts", "export const value = 1;\n");
  writeFixtureFile(fixture, "architecture-check.config.json", `${JSON.stringify(fixtureConfig(), null, 2)}\n`);
  return fixture;
}

function fixtureConfig() {
  return {
    productionRoots: ["api", "mobile-app/src"],
    defaultMaxLines: 2,
    lineLimitExceptions: {},
    disallowedTrackedPathPatterns: ["^tmp/"],
    publicApiAllowedRequires: ["./_backend", "./_publicErrors"],
    publicApiRequireExceptions: {},
    mobileLowerLayerRoots: ["mobile-app/src/services", "mobile-app/src/utils"],
    mobileLowerLayerDisallowedImports: ["/components/", "/screens/"],
  };
}

function writeFixtureFile(fixture, relativePath, contents) {
  const target = path.join(fixture, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

function git(cwd, args) {
  return execFileAsync("git", args, { cwd, timeout: 10_000 });
}

function runChecker(fixture, extraEnv = {}) {
  return execFileAsync(process.execPath, [CHECKER, "architecture-check.config.json"], {
    cwd: fixture,
    env: { ...process.env, ...extraEnv },
    timeout: 10_000,
  });
}

async function expectFailure(fixture, expectedMessage, extraEnv = {}) {
  await assert.rejects(runChecker(fixture, extraEnv), (error) => {
    assert.match(error.stderr, new RegExp(escapeRegExp(expectedMessage)));
    return true;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
