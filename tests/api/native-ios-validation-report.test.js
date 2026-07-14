const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const MOBILE_ROOT = path.join(ROOT, "mobile-app");

test("iOS validation report passes with target and screen evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-ios-validation-"));
  const screenshots = writeScreenshots(tmp);
  const appBundle = writeAppBundle(tmp);

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
      "--source-commit", "abc1234",
      "--app-bundle", appBundle,
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

test("iOS validation report emits project-relative evidence paths from the mobile directory", async () => {
  const tmpRoot = path.join(ROOT, "tmp");
  fs.mkdirSync(tmpRoot, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpRoot, "fuel-path-ios-portable-"));

  try {
    const screenshots = writeScreenshots(tmp);
    const appBundle = writeAppBundle(tmp);
    const mobileRelative = (value) => path.relative(MOBILE_ROOT, value);

    await execFileAsync(
      process.execPath,
      [
        "scripts/native-ios-validation-report.mjs",
        "--simulator-name", "iPhone 16",
        "--simulator-runtime", "iOS 18.5",
        "--output-dir", mobileRelative(tmp),
        "--source-commit", "abc1234",
        "--app-bundle", mobileRelative(appBundle),
        "--plan-screenshot", mobileRelative(screenshots.plan),
        "--nearby-screenshot", mobileRelative(screenshots.nearby),
        "--account-screenshot", mobileRelative(screenshots.account),
      ],
      { cwd: MOBILE_ROOT, timeout: 10_000 },
    );

    const reportName = fs.readdirSync(tmp).find((name) => /^ios-validation-.*\.json$/.test(name));
    const report = JSON.parse(fs.readFileSync(path.join(tmp, reportName), "utf8"));
    assert.match(report.appBundle, /^tmp\//);
    for (const screen of report.renderedScreens) assert.match(screen.screenshot, /^tmp\//);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("iOS validation report blocks without complete screen evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-ios-validation-"));
  const screenshots = writeScreenshots(tmp);
  const appBundle = writeAppBundle(tmp);

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
        "--source-commit", "abc1234",
        "--app-bundle", appBundle,
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
  const appBundle = writeAppBundle(tmp);
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
        "--source-commit", "abc1234",
        "--app-bundle", appBundle,
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

test("iOS validation report blocks duplicate rendered screenshot content", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-ios-validation-"));
  const screenshots = writeScreenshots(tmp);
  const appBundle = writeAppBundle(tmp);
  fs.copyFileSync(screenshots.plan, screenshots.nearby);

  await assert.rejects(
    execFileAsync(process.execPath, [
      "mobile-app/scripts/native-ios-validation-report.mjs",
      "--simulator-name", "iPhone 16",
      "--simulator-runtime", "iOS 18.5",
      "--output-dir", tmp,
      "--source-commit", "abc1234",
      "--app-bundle", appBundle,
      "--plan-screenshot", screenshots.plan,
      "--nearby-screenshot", screenshots.nearby,
      "--account-screenshot", screenshots.account,
    ], { cwd: ROOT, timeout: 10_000 }),
    /distinct rendered evidence/,
  );
});

function writeScreenshots(tmp) {
  const screenshots = {
    plan: path.join(tmp, "ios-plan.png"),
    nearby: path.join(tmp, "ios-nearby.png"),
    account: path.join(tmp, "ios-account.png"),
  };
  for (const [screen, screenshot] of Object.entries(screenshots)) {
    fs.writeFileSync(screenshot, `screenshot evidence for ${screen}`);
  }
  return screenshots;
}

function writeAppBundle(tmp) {
  const bundle = path.join(tmp, "FuelPath.app");
  fs.mkdirSync(bundle);
  return bundle;
}
