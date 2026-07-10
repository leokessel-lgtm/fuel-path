const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("Android AVD plan blocks clearly when command-line tools are missing", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-avd-plan-"));
  const sdk = path.join(tmp, "sdk");
  const home = path.join(tmp, "home");
  writeExecutable(path.join(sdk, "emulator", "emulator"), "#!/bin/sh\nif [ \"$1\" = -list-avds ]; then echo Medium_Phone_API_35; fi\n");
  writeAvdConfig(path.join(home, ".android", "avd", "Medium_Phone_API_35.avd", "config.ini"), {
    "avd.ini.displayname": "Medium Phone API 35",
    "abi.type": "x86_64",
  });

  let error;
  try {
    await execFileAsync(process.execPath, ["mobile-app/scripts/native-android-avd-plan.mjs"], {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: "/usr/bin:/bin",
        HOME: home,
        FUEL_PATH_ANDROID_SDK_ROOT_FOR_TESTS: sdk,
        FUEL_PATH_HOST_ARCH_FOR_TESTS: "arm64",
      },
      timeout: 10_000,
    });
  } catch (caught) {
    error = caught;
  }
  assert.ok(error);

  assert.match(error.stdout, /PASS Android SDK root - /);
  assert.match(error.stdout, /BLOCKED Android SDK Command-line Tools - Install Android SDK Command-line Tools/);
  assert.match(error.stdout, /BLOCKED ARM64-compatible AVD - Host is arm64; existing AVD ABI\(s\): Medium Phone API 35 \(x86_64\)/);
  assert.match(error.stdout, /Android Studio > Settings > Languages & Frameworks > Android SDK > SDK Tools > install Android SDK Command-line Tools/);
  assert.doesNotMatch(error.stdout, /emulator" -avd "Fuel_Path_Arm64_API_35"/);
});

test("Android AVD plan is actionable when managers and ARM64 image are present", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-avd-plan-"));
  const sdk = path.join(tmp, "sdk");
  const home = path.join(tmp, "home");
  writeExecutable(
    path.join(sdk, "cmdline-tools", "latest", "bin", "sdkmanager"),
    "#!/bin/sh\nif [ \"$1\" = --list_installed ]; then echo 'platforms;android-35 | 2 | Android SDK Platform 35'; echo 'system-images;android-35;google_apis;arm64-v8a | 1 | Google APIs ARM 64 v8a System Image'; fi\n",
  );
  writeExecutable(path.join(sdk, "cmdline-tools", "latest", "bin", "avdmanager"), "#!/bin/sh\necho avdmanager\n");
  writeExecutable(path.join(sdk, "emulator", "emulator"), "#!/bin/sh\necho emulator\n");

  const { stdout } = await execFileAsync(process.execPath, ["mobile-app/scripts/native-android-avd-plan.mjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PATH: "/usr/bin:/bin",
      HOME: home,
      FUEL_PATH_ANDROID_SDK_ROOT_FOR_TESTS: sdk,
      FUEL_PATH_HOST_ARCH_FOR_TESTS: "arm64",
    },
    timeout: 10_000,
  });

  assert.match(stdout, /PASS Android SDK Command-line Tools - sdkmanager and avdmanager are available/);
  assert.match(stdout, /PASS Android 35 ARM64 system image - system-images;android-35;google_apis;arm64-v8a/);
  assert.match(stdout, /READY ARM64-compatible AVD/);
  assert.match(stdout, /avdmanager" create avd --force --name "Fuel_Path_Arm64_API_35"/);
  assert.match(stdout, /Android ARM64 AVD setup plan is actionable/);
});

test("Android AVD plan passes when a compatible AVD already exists", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-avd-plan-"));
  const sdk = path.join(tmp, "sdk");
  const home = path.join(tmp, "home");
  writeExecutable(
    path.join(sdk, "cmdline-tools", "latest", "bin", "sdkmanager"),
    "#!/bin/sh\nif [ \"$1\" = --list_installed ]; then echo 'platforms;android-35 | 2 | Android SDK Platform 35'; echo 'system-images;android-35;google_apis;arm64-v8a | 1 | Google APIs ARM 64 v8a System Image'; fi\n",
  );
  writeExecutable(path.join(sdk, "cmdline-tools", "latest", "bin", "avdmanager"), "#!/bin/sh\necho avdmanager\n");
  writeExecutable(path.join(sdk, "emulator", "emulator"), "#!/bin/sh\necho emulator\n");
  writeAvdConfig(path.join(home, ".android", "avd", "Fuel_Path_Arm64_API_35.avd", "config.ini"), {
    "avd.ini.displayname": "Fuel Path ARM64 API 35",
    "abi.type": "arm64-v8a",
  });

  const { stdout } = await execFileAsync(process.execPath, ["mobile-app/scripts/native-android-avd-plan.mjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PATH: "/usr/bin:/bin",
      HOME: home,
      FUEL_PATH_ANDROID_SDK_ROOT_FOR_TESTS: sdk,
      FUEL_PATH_HOST_ARCH_FOR_TESTS: "arm64",
    },
    timeout: 10_000,
  });

  assert.match(stdout, /PASS ARM64-compatible AVD - Fuel Path ARM64 API 35 \(arm64-v8a\)/);
  assert.doesNotMatch(stdout, /create avd --force/);
  assert.match(stdout, /Fuel_Path_Arm64_API_35" -no-snapshot/);
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
