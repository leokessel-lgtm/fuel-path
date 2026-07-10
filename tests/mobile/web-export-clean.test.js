const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("web export cleaner removes stale hashed output before a build", async (context) => {
  const fixture = mkdtempSync(path.join(tmpdir(), "fuel-path-web-clean-"));
  context.after(() => rmSync(fixture, { force: true, recursive: true }));
  mkdirSync(path.join(fixture, "scripts"), { recursive: true });
  copyFileSync(path.join(ROOT, "mobile-app/scripts/clean-web-export.mjs"), path.join(fixture, "scripts/clean-web-export.mjs"));
  const staleFile = path.join(fixture, "dist/_expo/static/js/web/index-stale.js");
  mkdirSync(path.dirname(staleFile), { recursive: true });
  writeFileSync(staleFile, "stale", "utf8");

  const { stdout } = await execFileAsync(process.execPath, ["scripts/clean-web-export.mjs"], { cwd: fixture });
  assert.match(stdout, /Cleaned web export: dist/);
  assert.equal(existsSync(staleFile), false);
});

test("web export cleaner refuses to remove the mobile root", async (context) => {
  const fixture = mkdtempSync(path.join(tmpdir(), "fuel-path-web-clean-root-"));
  context.after(() => rmSync(fixture, { force: true, recursive: true }));
  mkdirSync(path.join(fixture, "scripts"), { recursive: true });
  copyFileSync(path.join(ROOT, "mobile-app/scripts/clean-web-export.mjs"), path.join(fixture, "scripts/clean-web-export.mjs"));

  await assert.rejects(
    execFileAsync(process.execPath, ["scripts/clean-web-export.mjs", "--output-dir", "."], { cwd: fixture }),
    (error) => {
      assert.match(error.stderr, /Refusing to clean web export/);
      return true;
    },
  );
});
