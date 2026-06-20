const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("iOS simulator plan blocks clearly when only command-line tools are selected", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-ios-plan-"));
  const xcodeSelect = path.join(tmp, "xcode-select");
  const xcrun = path.join(tmp, "xcrun");
  writeExecutable(xcodeSelect, "#!/bin/sh\necho /Library/Developer/CommandLineTools\n");
  writeExecutable(xcrun, "#!/bin/sh\necho 'xcrun: error: unable to find utility \"simctl\", not a developer tool or in PATH' >&2\nexit 72\n");

  let error;
  try {
    await execFileAsync(process.execPath, ["mobile-app/scripts/native-ios-simulator-plan.mjs"], {
      cwd: ROOT,
      env: {
        ...process.env,
        FUEL_PATH_XCODE_SELECT_FOR_TESTS: xcodeSelect,
        FUEL_PATH_XCRUN_FOR_TESTS: xcrun,
      },
      timeout: 10_000,
    });
  } catch (caught) {
    error = caught;
  }

  assert.ok(error);
  assert.match(error.stdout, /PASS Xcode developer directory - \/Library\/Developer\/CommandLineTools/);
  assert.match(error.stdout, /BLOCKED iOS simulator control - xcrun: error: unable to find utility "simctl"/);
  assert.match(error.stdout, /Install full Xcode from the App Store or Apple Developer downloads/);
  assert.match(error.stdout, /sudo xcode-select -s \/Applications\/Xcode.app\/Contents\/Developer/);
});

test("iOS simulator plan passes with simctl, runtime and a simulator", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-ios-plan-"));
  const xcodeSelect = path.join(tmp, "xcode-select");
  const xcrun = path.join(tmp, "xcrun");
  writeExecutable(xcodeSelect, "#!/bin/sh\necho /Applications/Xcode.app/Contents/Developer\n");
  writeExecutable(
    xcrun,
    "#!/bin/sh\nif [ \"$3\" = devices ]; then echo '    iPhone 15 (AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE) (Shutdown)'; exit 0; fi\nif [ \"$3\" = runtimes ]; then echo 'iOS 18.5 (22F77) - com.apple.CoreSimulator.SimRuntime.iOS-18-5 (available)'; exit 0; fi\nexit 0\n",
  );

  const { stdout } = await execFileAsync(process.execPath, ["mobile-app/scripts/native-ios-simulator-plan.mjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      FUEL_PATH_XCODE_SELECT_FOR_TESTS: xcodeSelect,
      FUEL_PATH_XCRUN_FOR_TESTS: xcrun,
    },
    timeout: 10_000,
  });

  assert.match(stdout, /PASS iOS simulator control - xcrun simctl is available/);
  assert.match(stdout, /PASS iOS simulator runtime - iOS 18.5/);
  assert.match(stdout, /PASS Bootable iOS simulator - 1 simulator\(s\) available/);
  assert.match(stdout, /iOS simulator setup plan is ready for native validation/);
});

function writeExecutable(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
  fs.chmodSync(filePath, 0o755);
}
