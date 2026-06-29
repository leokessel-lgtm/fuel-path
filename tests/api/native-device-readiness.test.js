const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("native readiness detects Android tools outside PATH and flags x86 AVD on arm64 host", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-native-readiness-"));
  const sdk = path.join(tmp, "sdk");
  const home = path.join(tmp, "home");
  writeExecutable(path.join(sdk, "platform-tools", "adb"), "#!/bin/sh\nif [ \"$1\" = version ]; then echo 'Android Debug Bridge version 1.0.41'; exit 0; fi\necho 'List of devices attached'\n");
  writeExecutable(path.join(sdk, "emulator", "emulator"), "#!/bin/sh\nif [ \"$1\" = -list-avds ]; then echo 'Medium_Phone_API_35'; exit 0; fi\necho 'emulator ok'\n");
  writeAvdConfig(path.join(home, ".android", "avd", "Medium_Phone_API_35.avd", "config.ini"), {
    "avd.ini.displayname": "Medium Phone API 35",
    "abi.type": "x86_64",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["mobile-app/scripts/native-device-readiness.mjs"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: "/usr/bin:/bin",
        HOME: home,
        FUEL_PATH_ANDROID_SDK_ROOT_FOR_TESTS: sdk,
      },
      timeout: 10_000,
    },
  );

  assert.match(stdout, /PASS Android Debug Bridge available/);
  assert.match(stdout, /PASS Android emulator available/);
  assert.match(stdout, /PASS Android Virtual Device available - Medium_Phone_API_35/);
  assert.match(stdout, /BLOCKED Android AVD ABI compatible with host - Host is arm64; installed AVD ABI\(s\): Medium Phone API 35 \(x86_64\)/);
  assert.match(stdout, /WARN Android SDK manager available/);
  assert.match(stdout, /WARN Android AVD manager available/);
});

test("native readiness accepts an arm64 AVD and command-line managers", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-native-readiness-"));
  const sdk = path.join(tmp, "sdk");
  const home = path.join(tmp, "home");
  writeExecutable(path.join(sdk, "platform-tools", "adb"), "#!/bin/sh\nif [ \"$1\" = version ]; then echo 'Android Debug Bridge version 1.0.41'; exit 0; fi\necho 'List of devices attached'\n");
  writeExecutable(path.join(sdk, "emulator", "emulator"), "#!/bin/sh\nif [ \"$1\" = -list-avds ]; then echo 'Fuel_Path_Arm64_API_35'; exit 0; fi\necho 'emulator ok'\n");
  writeExecutable(path.join(sdk, "cmdline-tools", "latest", "bin", "sdkmanager"), "#!/bin/sh\necho sdkmanager\n");
  writeExecutable(path.join(sdk, "cmdline-tools", "latest", "bin", "avdmanager"), "#!/bin/sh\necho avdmanager\n");
  writeAvdConfig(path.join(home, ".android", "avd", "Fuel_Path_Arm64_API_35.avd", "config.ini"), {
    "avd.ini.displayname": "Fuel Path ARM64 API 35",
    "abi.type": "arm64-v8a",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["mobile-app/scripts/native-device-readiness.mjs"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: "/usr/bin:/bin",
        HOME: home,
        FUEL_PATH_ANDROID_SDK_ROOT_FOR_TESTS: sdk,
      },
      timeout: 10_000,
    },
  );

  assert.match(stdout, /PASS Android AVD ABI compatible with host - Fuel Path ARM64 API 35 \(arm64-v8a\) compatible with arm64/);
  assert.match(stdout, /PASS Android SDK manager available/);
  assert.match(stdout, /PASS Android AVD manager available/);
  assert.match(stdout, /PASS EAS project id in app config/);
});

test("physical Android readiness blocks emulator-only targets", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-native-readiness-"));
  const sdk = path.join(tmp, "sdk");
  const home = path.join(tmp, "home");
  writeExecutable(
    path.join(sdk, "platform-tools", "adb"),
    "#!/bin/sh\nif [ \"$1\" = version ]; then echo 'Android Debug Bridge version 1.0.41'; exit 0; fi\necho 'List of devices attached'\necho 'emulator-5554 device product:sdk_phone64_arm64 model:Medium_Phone device:emu64a transport_id:1'\n",
  );
  writeExecutable(path.join(sdk, "emulator", "emulator"), "#!/bin/sh\nif [ \"$1\" = -list-avds ]; then echo 'Fuel_Path_Arm64_API_35'; exit 0; fi\necho 'emulator ok'\n");
  writeExecutable(path.join(sdk, "cmdline-tools", "latest", "bin", "sdkmanager"), "#!/bin/sh\necho sdkmanager\n");
  writeExecutable(path.join(sdk, "cmdline-tools", "latest", "bin", "avdmanager"), "#!/bin/sh\necho avdmanager\n");
  writeAvdConfig(path.join(home, ".android", "avd", "Fuel_Path_Arm64_API_35.avd", "config.ini"), {
    "avd.ini.displayname": "Fuel Path ARM64 API 35",
    "abi.type": "arm64-v8a",
  });

  let error;
  try {
    await execFileAsync(
      process.execPath,
      ["mobile-app/scripts/native-device-readiness.mjs", "--strict", "--require-physical-android"],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          PATH: "/usr/bin:/bin",
          HOME: home,
          FUEL_PATH_ANDROID_SDK_ROOT_FOR_TESTS: sdk,
        },
        timeout: 10_000,
      },
    );
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.match(error.stdout, /PASS Android physical device or emulator connected - 1 target\(s\) visible to adb/);
  assert.match(error.stdout, /BLOCKED Physical Android device connected - Attach and authorise a real mid-range Android device before performance validation/);
  assert.doesNotMatch(error.stdout, /iOS simulator control available/);
});

test("physical Android readiness passes when a real device is attached", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-native-readiness-"));
  const sdk = path.join(tmp, "sdk");
  const home = path.join(tmp, "home");
  writeExecutable(
    path.join(sdk, "platform-tools", "adb"),
    "#!/bin/sh\nif [ \"$1\" = version ]; then echo 'Android Debug Bridge version 1.0.41'; exit 0; fi\necho 'List of devices attached'\necho 'R5CT123456D device usb:336592896X product:a53x model:SM_A536B device:a53x transport_id:2'\n",
  );
  writeExecutable(path.join(sdk, "emulator", "emulator"), "#!/bin/sh\nif [ \"$1\" = -list-avds ]; then echo 'Fuel_Path_Arm64_API_35'; exit 0; fi\necho 'emulator ok'\n");
  writeExecutable(path.join(sdk, "cmdline-tools", "latest", "bin", "sdkmanager"), "#!/bin/sh\necho sdkmanager\n");
  writeExecutable(path.join(sdk, "cmdline-tools", "latest", "bin", "avdmanager"), "#!/bin/sh\necho avdmanager\n");
  writeAvdConfig(path.join(home, ".android", "avd", "Fuel_Path_Arm64_API_35.avd", "config.ini"), {
    "avd.ini.displayname": "Fuel Path ARM64 API 35",
    "abi.type": "arm64-v8a",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["mobile-app/scripts/native-device-readiness.mjs", "--strict", "--require-physical-android"],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: "/usr/bin:/bin",
        HOME: home,
        FUEL_PATH_ANDROID_SDK_ROOT_FOR_TESTS: sdk,
      },
      timeout: 10_000,
    },
  );

  assert.match(stdout, /PASS Physical Android device connected - R5CT123456D visible to adb/);
  assert.match(stdout, /WARN iOS validation checks - Skipped for Android physical-device readiness/);
  assert.doesNotMatch(stdout, /iOS simulator control available/);
});

function writeExecutable(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
  fs.chmodSync(filePath, 0o755);
}

function writeAvdConfig(filePath, values) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
}
