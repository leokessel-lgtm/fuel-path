const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const script = fs.readFileSync(
  path.resolve(__dirname, "../../mobile-app/scripts/native-ios-ipad-free-smoke.mjs"),
  "utf8",
);

test("physical iPad smoke always uninstalls before installing", () => {
  const uninstallCall = script.indexOf("evidence.uninstall = uninstallApp(selectedDevice)");
  const installCall = script.indexOf("evidence.install = installApp(selectedDevice)");
  assert.ok(uninstallCall >= 0);
  assert.ok(installCall > uninstallCall);
  assert.match(script, /"uninstall",\s*"app"/);
});

test("physical iPad smoke accepts a source-bound prebuilt signed app", () => {
  assert.match(script, /args\.get\("--app"\)/);
  assert.match(script, /args\.get\("--source-commit"\)/);
  assert.match(script, /args\.get\("--build-id"\)/);
  assert.match(script, /provided_signed_app/);
  assert.match(script, /must include --source-commit/);
});
