const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("Android performance summary passes only clean physical-device evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-android-performance-summary-"));
  const mapTileSummaries = physicalMapTileSummaries(tmp);
  const report = writeReport({
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android-test.apk",
    device: {
      type: "physical",
      serial: "R5CT123456D",
      detail: "R5CT123456D device usb:336592896X product:a53x model:SM_A536B device:a53x transport_id:2",
    },
    frameSummary: {
      totalFrames: 120,
      jankyFrames: 6,
      jankyPercent: 5,
      percentile95Ms: 32,
    },
    failureLines: [],
    mapWarningLines: [],
    attentionItems: [],
    mapTileSummaries,
  }, tmp);

  const { stdout } = await execFileAsync(
    process.execPath,
    ["mobile-app/scripts/native-android-performance-summary.mjs", "--report", report],
    { cwd: ROOT, timeout: 10_000 },
  );

  assert.match(stdout, /Android performance summary passed:/);
});

test("Android performance summary rejects emulator or janky evidence", async () => {
  const report = writeReport({
    status: "partial",
    renderStatus: "passed",
    performanceStatus: "needs_device_validation",
    artifactName: "fuel-path-preview-android-test.apk",
    device: { type: "emulator", serial: "emulator-5554" },
    frameSummary: {
      totalFrames: 100,
      jankyFrames: 75,
      jankyPercent: 75,
      percentile95Ms: 125,
    },
    failureLines: [],
    mapWarningLines: [],
    attentionItems: ["Frame jank is high for a performance claim: 75% janky frames."],
    mapTileSummaries: [
      { screenshot: "/tmp/plan.png", blankMapLikely: false, colourRatio: 0.5, detailBuckets: 120 },
    ],
  });

  let error;
  try {
    await execFileAsync(
      process.execPath,
      ["mobile-app/scripts/native-android-performance-summary.mjs", "--report", report],
      { cwd: ROOT, timeout: 10_000 },
    );
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.match(error.stdout, /Android performance summary blocked:/);
  assert.match(error.stderr, /Source report is not from a physical Android device/);
  assert.match(error.stderr, /Performance smoke did not pass/);
  assert.match(error.stderr, /Smoke report still has attention items/);
  assert.match(error.stderr, /Frame jank is above claim threshold: 75%/);
  assert.match(error.stderr, /Frame p95 is above claim threshold: 125 ms/);
});

test("Android performance summary rejects incomplete physical map evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-android-performance-summary-"));
  const [planSummary] = physicalMapTileSummaries(tmp);
  const report = writeReport({
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android-test.apk",
    device: {
      type: "physical",
      serial: "R5CT123456D",
      detail: "R5CT123456D device usb:336592896X product:a53x model:SM_A536B device:a53x transport_id:2",
    },
    frameSummary: {
      totalFrames: 120,
      jankyFrames: 6,
      jankyPercent: 5,
      percentile95Ms: 32,
    },
    failureLines: [],
    mapWarningLines: [],
    attentionItems: [],
    mapTileSummaries: [planSummary],
  }, tmp);

  let error;
  try {
    await execFileAsync(
      process.execPath,
      ["mobile-app/scripts/native-android-performance-summary.mjs", "--report", report],
      { cwd: ROOT, timeout: 10_000 },
    );
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.match(error.stderr, /Physical-device map evidence is incomplete/);
  assert.match(error.stderr, /nearby/);
  assert.match(error.stderr, /nearby-after-pan/);
});

test("Android performance summary rejects zero-frame physical evidence without treating placeholder p95 as jank", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-android-performance-summary-"));
  const report = writeReport({
    status: "partial",
    renderStatus: "passed",
    performanceStatus: "needs_device_validation",
    artifactName: "fuel-path-preview-android-test.apk",
    device: {
      type: "physical",
      serial: "R5CT123456D",
      detail: "R5CT123456D device usb:336592896X product:a53x model:SM_A536B device:a53x transport_id:2",
    },
    frameSummary: {
      totalFrames: 0,
      jankyFrames: 0,
      jankyPercent: 0,
      percentile95Ms: 4950,
    },
    failureLines: [],
    mapWarningLines: [],
    attentionItems: ["Frame evidence is insufficient for a performance claim: 0 rendered frames captured."],
    mapTileSummaries: physicalMapTileSummaries(tmp),
  }, tmp);

  let error;
  try {
    await execFileAsync(
      process.execPath,
      ["mobile-app/scripts/native-android-performance-summary.mjs", "--report", report],
      { cwd: ROOT, timeout: 10_000 },
    );
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.match(error.stderr, /Frame evidence is insufficient for a performance claim: 0 rendered frames captured/);
  assert.doesNotMatch(error.stderr, /Frame p95 is above claim threshold/);
});

test("Android performance summary rejects missing physical map screenshot files", async () => {
  const report = writeReport({
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android-test.apk",
    device: {
      type: "physical",
      serial: "R5CT123456D",
      detail: "R5CT123456D device usb:336592896X product:a53x model:SM_A536B device:a53x transport_id:2",
    },
    frameSummary: {
      totalFrames: 120,
      jankyFrames: 6,
      jankyPercent: 5,
      percentile95Ms: 32,
    },
    failureLines: [],
    mapWarningLines: [],
    attentionItems: [],
    mapTileSummaries: [
      { screenshot: "android-preview-smoke-test-plan.png", blankMapLikely: false, colourRatio: 0.5, detailBuckets: 120 },
      { screenshot: "android-preview-smoke-test-nearby.png", blankMapLikely: false, colourRatio: 0.45, detailBuckets: 110 },
      { screenshot: "android-preview-smoke-test-nearby-after-pan.png", blankMapLikely: false, colourRatio: 0.46, detailBuckets: 112 },
    ],
  });

  let error;
  try {
    await execFileAsync(
      process.execPath,
      ["mobile-app/scripts/native-android-performance-summary.mjs", "--report", report],
      { cwd: ROOT, timeout: 10_000 },
    );
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.match(error.stderr, /Physical-device map screenshot files are missing: 3/);
});

test("Android performance summary rejects old reports without device metadata", async () => {
  const report = writeReport({
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    frameSummary: {
      totalFrames: 100,
      jankyFrames: 4,
      jankyPercent: 4,
      percentile95Ms: 30,
    },
    failureLines: [],
    mapWarningLines: [],
    attentionItems: [],
    mapTileSummaries: [
      { screenshot: "/tmp/plan.png", blankMapLikely: false, colourRatio: 0.5, detailBuckets: 120 },
    ],
  });

  let error;
  try {
    await execFileAsync(
      process.execPath,
      ["mobile-app/scripts/native-android-performance-summary.mjs", "--report", report],
      { cwd: ROOT, timeout: 10_000 },
    );
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.match(error.stderr, /Source report is missing physical-device metadata/);
});

function writeReport(payload, tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-android-performance-summary-"))) {
  const report = path.join(tmp, "android-preview-smoke-test.json");
  fs.writeFileSync(report, `${JSON.stringify(payload, null, 2)}\n`);
  return report;
}

function physicalMapTileSummaries(tmp) {
  const screenshots = {
    plan: path.join(tmp, "android-preview-smoke-test-plan.png"),
    nearby: path.join(tmp, "android-preview-smoke-test-nearby.png"),
    nearbyAfterPan: path.join(tmp, "android-preview-smoke-test-nearby-after-pan.png"),
  };
  for (const screenshot of Object.values(screenshots)) {
    fs.writeFileSync(screenshot, "screenshot evidence");
  }
  return [
    { screenshot: screenshots.plan, blankMapLikely: false, colourRatio: 0.5, detailBuckets: 120 },
    { screenshot: screenshots.nearby, blankMapLikely: false, colourRatio: 0.45, detailBuckets: 110 },
    { screenshot: screenshots.nearbyAfterPan, blankMapLikely: false, colourRatio: 0.46, detailBuckets: 112 },
  ];
}
