const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("iOS validation report passes with target and screen evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-ios-validation-"));
  const screenshots = writeScreenshots(tmp);

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "mobile-app/scripts/native-ios-validation-report.mjs",
      "--simulator-name",
      "iPhone 16",
      "--simulator-runtime",
      "iOS 18.5",
      "--output-dir",
      tmp,
      "--plan-screenshot",
      screenshots.plan,
      "--nearby-screenshot",
      screenshots.nearby,
      "--account-screenshot",
      screenshots.account,
    ],
    { cwd: ROOT, timeout: 10_000 },
  );

  assert.match(stdout, /iOS validation report passed:/);
});

test("iOS validation report blocks without complete screen evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-ios-validation-"));
  const screenshots = writeScreenshots(tmp);

  let error;
  try {
    await execFileAsync(
      process.execPath,
      [
        "mobile-app/scripts/native-ios-validation-report.mjs",
        "--simulator-name",
        "iPhone 16",
        "--simulator-runtime",
        "iOS 18.5",
        "--output-dir",
        tmp,
        "--plan-screenshot",
        screenshots.plan,
        "--nearby-screenshot",
        screenshots.nearby,
      ],
      { cwd: ROOT, timeout: 10_000 },
    );
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.match(error.stdout, /iOS validation report blocked:/);
  assert.match(error.stderr, /Missing screenshot evidence: account/);
});

test("iOS validation report blocks runtime failure lines", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-ios-validation-"));
  const screenshots = writeScreenshots(tmp);
  const failureLog = path.join(tmp, "ios.log");
  fs.writeFileSync(failureLog, "Unhandled JS Exception: route screen failed\n");

  let error;
  try {
    await execFileAsync(
      process.execPath,
      [
        "mobile-app/scripts/native-ios-validation-report.mjs",
        "--simulator-name",
        "iPhone 16",
        "--simulator-runtime",
        "iOS 18.5",
        "--output-dir",
        tmp,
        "--plan-screenshot",
        screenshots.plan,
        "--nearby-screenshot",
        screenshots.nearby,
        "--account-screenshot",
        screenshots.account,
        "--failure-log",
        failureLog,
      ],
      { cwd: ROOT, timeout: 10_000 },
    );
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.match(error.stderr, /Runtime failure lines were captured: 1/);
});

function writeScreenshots(tmp) {
  const screenshots = {
    plan: path.join(tmp, "ios-plan.png"),
    nearby: path.join(tmp, "ios-nearby.png"),
    account: path.join(tmp, "ios-account.png"),
  };
  for (const screenshot of Object.values(screenshots)) {
    fs.writeFileSync(screenshot, "screenshot evidence");
  }
  return screenshots;
}
