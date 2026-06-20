const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("native blocker packet records missing physical Android and full Xcode", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-native-blocker-"));
  const adb = path.join(tmp, "adb");
  const xcodeSelect = path.join(tmp, "xcode-select");
  const xcrun = path.join(tmp, "xcrun");
  writeExecutable(adb, "#!/bin/sh\necho 'List of devices attached'\necho 'emulator-5554 device product:sdk_phone64_arm64 model:Medium_Phone device:emu64a transport_id:1'\n");
  writeExecutable(xcodeSelect, "#!/bin/sh\necho /Library/Developer/CommandLineTools\n");
  writeExecutable(xcrun, "#!/bin/sh\necho 'xcrun: error: unable to find utility \"simctl\", not a developer tool or in PATH' >&2\nexit 72\n");

  const { stdout } = await execFileAsync(process.execPath, ["mobile-app/scripts/native-blocker-packet.mjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      FUEL_PATH_ADB_FOR_TESTS: adb,
      FUEL_PATH_XCODE_SELECT_FOR_TESTS: xcodeSelect,
      FUEL_PATH_XCRUN_FOR_TESTS: xcrun,
    },
    timeout: 10_000,
  });
  const packetPath = stdout.match(/Native blocker packet blocked: (.+\.md)/)?.[1];
  assert.ok(packetPath);
  const payload = JSON.parse(fs.readFileSync(packetPath.replace(/\.md$/, ".json"), "utf8"));

  assert.equal(payload.status, "blocked");
  assert.equal(payload.synthetic, true);
  assert.equal(payload.android.setupPlan.status, "not_checked");
  assert.deepEqual(payload.android.blockers, ["physical_android_missing"]);
  assert.equal(payload.android.devices[0].connectionState, "device");
  assert.equal(payload.android.devices[0].type, "emulator");
  assert.equal(payload.ios.blockers.includes("full_xcode_missing"), true);
  assert.equal(payload.ios.blockers.includes("simctl_missing"), true);
  assert.equal(payload.nextCommands.includes("npm run native:android-physical-readiness"), true);
  assert.equal(payload.nextCommands.includes("npm run native:ios-simulator-plan"), true);
});

test("native blocker packet reports unauthorised physical Android devices", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-native-blocker-"));
  const adb = path.join(tmp, "adb");
  const xcodeSelect = path.join(tmp, "xcode-select");
  const xcrun = path.join(tmp, "xcrun");
  writeExecutable(adb, "#!/bin/sh\necho 'List of devices attached'\necho 'R5CT123456D unauthorized usb:336592896X product:a53x model:SM_A536B device:a53x transport_id:2'\n");
  writeExecutable(xcodeSelect, "#!/bin/sh\necho /Applications/Xcode.app/Contents/Developer\n");
  writeExecutable(
    xcrun,
    "#!/bin/sh\nif [ \"$3\" = devices ]; then echo '    iPhone 15 (AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE) (Shutdown)'; exit 0; fi\nif [ \"$3\" = runtimes ]; then echo 'iOS 18.5 (22F77) - com.apple.CoreSimulator.SimRuntime.iOS-18-5 (available)'; exit 0; fi\nexit 0\n",
  );

  const { stdout } = await execFileAsync(process.execPath, ["mobile-app/scripts/native-blocker-packet.mjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      FUEL_PATH_ADB_FOR_TESTS: adb,
      FUEL_PATH_XCODE_SELECT_FOR_TESTS: xcodeSelect,
      FUEL_PATH_XCRUN_FOR_TESTS: xcrun,
    },
    timeout: 10_000,
  });
  const packetPath = stdout.match(/Native blocker packet blocked: (.+\.md)/)?.[1];
  assert.ok(packetPath);
  const payload = JSON.parse(fs.readFileSync(packetPath.replace(/\.md$/, ".json"), "utf8"));

  assert.equal(payload.status, "blocked");
  assert.equal(payload.android.setupPlan.status, "not_checked");
  assert.deepEqual(payload.android.blockers, ["physical_android_unauthorized"]);
  assert.equal(payload.android.devices[0].connectionState, "unauthorized");
  assert.equal(payload.android.unauthorisedPhysicalDevices[0].serial, "R5CT123456D");
  assert.deepEqual(payload.android.physicalDevices, []);
  assert.match(payload.android.detail, /Authorise USB debugging/);
  assert.equal(payload.nextCommands.includes("adb devices -l"), true);
});

test("native blocker packet passes with physical Android and iOS simulator evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-native-blocker-"));
  const adb = path.join(tmp, "adb");
  const xcodeSelect = path.join(tmp, "xcode-select");
  const xcrun = path.join(tmp, "xcrun");
  writeExecutable(adb, "#!/bin/sh\necho 'List of devices attached'\necho 'R5CT123456D device usb:336592896X product:a53x model:SM_A536B device:a53x transport_id:2'\n");
  writeExecutable(xcodeSelect, "#!/bin/sh\necho /Applications/Xcode.app/Contents/Developer\n");
  writeExecutable(
    xcrun,
    "#!/bin/sh\nif [ \"$3\" = devices ]; then echo '    iPhone 15 (AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE) (Shutdown)'; exit 0; fi\nif [ \"$3\" = runtimes ]; then echo 'iOS 18.5 (22F77) - com.apple.CoreSimulator.SimRuntime.iOS-18-5 (available)'; exit 0; fi\nexit 0\n",
  );

  const { stdout } = await execFileAsync(process.execPath, ["mobile-app/scripts/native-blocker-packet.mjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      FUEL_PATH_ADB_FOR_TESTS: adb,
      FUEL_PATH_XCODE_SELECT_FOR_TESTS: xcodeSelect,
      FUEL_PATH_XCRUN_FOR_TESTS: xcrun,
    },
    timeout: 10_000,
  });
  const packetPath = stdout.match(/Native blocker packet ready: (.+\.md)/)?.[1];
  assert.ok(packetPath);
  const payload = JSON.parse(fs.readFileSync(packetPath.replace(/\.md$/, ".json"), "utf8"));

  assert.equal(payload.status, "ready");
  assert.equal(payload.synthetic, true);
  assert.equal(payload.android.setupPlan.status, "not_checked");
  assert.deepEqual(payload.blockers, []);
  assert.equal(payload.android.devices[0].connectionState, "device");
  assert.equal(payload.android.physicalDevices[0].serial, "R5CT123456D");
  assert.equal(payload.ios.simctlAvailable, true);
  assert.equal(payload.nextCommands.length, 0);
});

function writeExecutable(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
  fs.chmodSync(filePath, 0o755);
}
