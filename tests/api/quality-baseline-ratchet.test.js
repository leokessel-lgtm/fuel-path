const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

test("documentation context ceilings cannot increase above the merge base", (context) => {
  const fixture = gitFixture(context);
  copyFile(fixture, "scripts/measure-doc-context.mjs");
  write(fixture, "small.md", "test");
  writeProfiles(fixture, 3);
  commitAll(fixture, "baseline");
  writeProfiles(fixture, 4);

  assert.throws(
    () => run(process.execPath, ["scripts/measure-doc-context.mjs"], fixture, { FUEL_PATH_BASE_REF: "HEAD" }),
    /ceiling increased from base 3 to 4/,
  );
});

test("mobile web bundle baselines cannot increase above the merge base", (context) => {
  const fixture = gitFixture(context);
  copyFile(fixture, "mobile-app/scripts/check-web-bundle-regression.mjs");
  write(fixture, "mobile-app/dist/app.js", "1234");
  writeBundleBaseline(fixture, 4);
  commitAll(fixture, "baseline");
  writeBundleBaseline(fixture, 5);

  assert.throws(
    () => run(process.execPath, ["scripts/check-web-bundle-regression.mjs"], path.join(fixture, "mobile-app"), { FUEL_PATH_BASE_REF: "HEAD" }),
    /baseline increased from base 4 to 5/,
  );
});

function gitFixture(context) {
  const fixture = mkdtempSync(path.join(tmpdir(), "fuel-path-quality-ratchet-"));
  context.after(() => rmSync(fixture, { force: true, recursive: true }));
  run("git", ["init", "-q"], fixture);
  run("git", ["config", "user.email", "quality@example.invalid"], fixture);
  run("git", ["config", "user.name", "Quality Test"], fixture);
  return fixture;
}

function writeProfiles(fixture, ceiling) {
  write(fixture, "scripts/doc-context-profiles.json", `${JSON.stringify({
    estimationMethod: "ceil(UTF-8 text characters / 4)",
    maxEstimatedTokens: { small: ceiling },
    profiles: { small: ["small.md"] },
  }, null, 2)}\n`);
}

function writeBundleBaseline(fixture, value) {
  write(fixture, "mobile-app/build-baselines/web-bundle.json", `${JSON.stringify({
    webDistTotalBytes: value,
    webLargestFileBytes: value,
    webJsTotalBytes: value,
  }, null, 2)}\n`);
}

function copyFile(fixture, relativePath) {
  const target = path.join(fixture, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(path.join(ROOT, relativePath), target);
}

function write(fixture, relativePath, contents) {
  const target = path.join(fixture, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

function commitAll(fixture, message) {
  run("git", ["add", "."], fixture);
  run("git", ["commit", "-qm", message], fixture);
}

function run(command, args, cwd, env = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}
