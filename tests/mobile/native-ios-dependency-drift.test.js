const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

async function loadScanner() {
  return import("../../mobile-app/scripts/native-ios-dependency-drift.mjs");
}

test("iOS dependency drift guard rejects stale local Pod paths", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fuel-path-ios-drift-"));
  try {
    mkdirSync(path.join(root, "ios"), { recursive: true });
    writeFileSync(path.join(root, "ios", "Podfile.lock"), '  ExpoImage:\n    :path: "../node_modules/expo-image/ios"\n');
    const { scanNativeIosDependencyDrift } = await loadScanner();
    const result = scanNativeIosDependencyDrift({ mobileRoot: root });
    assert.equal(result.status, "stale");
    assert.deepEqual(result.missingPaths.map((item) => item.dependencyPath), ["../node_modules/expo-image/ios"]);
    assert.match(result.message, /do not restore removed packages/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("iOS dependency drift guard accepts generated Pod paths that exist", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fuel-path-ios-drift-"));
  try {
    mkdirSync(path.join(root, "ios"), { recursive: true });
    mkdirSync(path.join(root, "node_modules", "expo-constants", "ios"), { recursive: true });
    writeFileSync(path.join(root, "ios", "Podfile.lock"), '  ExpoConstants:\n    :path: "../node_modules/expo-constants/ios"\n');
    const { scanNativeIosDependencyDrift } = await loadScanner();
    const result = scanNativeIosDependencyDrift({ mobileRoot: root });
    assert.equal(result.status, "ready");
    assert.equal(result.checkedPaths, 1);
    assert.deepEqual(result.missingPaths, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
