import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const strict = process.argv.includes("--strict");
const mobileAppRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const projectRoot = resolve(mobileAppRoot, "..");
const outputRoot = resolve(projectRoot, "tmp", "native-smoke");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outJson = join(outputRoot, `native-blocker-packet-${timestamp}.json`);
const outMd = join(outputRoot, `native-blocker-packet-${timestamp}.md`);
const adbCommand = process.env.FUEL_PATH_ADB_FOR_TESTS || findAndroidAdb();
const xcodeSelectCommand = process.env.FUEL_PATH_XCODE_SELECT_FOR_TESTS || "xcode-select";
const xcrunCommand = process.env.FUEL_PATH_XCRUN_FOR_TESTS || "xcrun";
const synthetic = Boolean(
  process.env.FUEL_PATH_ADB_FOR_TESTS ||
    process.env.FUEL_PATH_XCODE_SELECT_FOR_TESTS ||
    process.env.FUEL_PATH_XCRUN_FOR_TESTS,
);

mkdirSync(outputRoot, { recursive: true });

const android = inspectAndroid();
const ios = inspectIos();
const blockers = [
  ...android.blockers.map((item) => `android:${item}`),
  ...ios.blockers.map((item) => `ios:${item}`),
];
const packet = {
  status: blockers.length ? "blocked" : "ready",
  generatedAt: new Date().toISOString(),
  synthetic,
  android,
  ios,
  blockers,
  nextCommands: buildNextCommands(android, ios),
};

writeFileSync(outJson, `${JSON.stringify(packet, null, 2)}\n`);
writeFileSync(outMd, markdown(packet));

console.log(`Native blocker packet ${packet.status}: ${outMd}`);
if (strict && blockers.length) process.exit(1);

function inspectAndroid() {
  const setupPlan = inspectAndroidSetupPlan();
  if (!adbCommand) {
    return {
      status: "blocked",
      adb: "",
      setupPlan,
      devices: [],
      physicalDevices: [],
      blockers: ["adb_missing"],
      detail: "Android Platform Tools adb was not found.",
    };
  }

  const devicesResult = run(adbCommand, ["devices", "-l"]);
  if (devicesResult.status !== 0) {
    return {
      status: "blocked",
      adb: adbCommand,
      setupPlan,
      devices: [],
      physicalDevices: [],
      blockers: ["adb_devices_failed"],
      detail: commandError(devicesResult) || "adb devices failed.",
    };
  }

  const devices = parseAndroidDevices(devicesResult.stdout);
  const authorisedDevices = devices.filter((device) => device.connectionState === "device");
  const unauthorisedPhysicalDevices = devices.filter(
    (device) => device.type === "physical" && device.connectionState === "unauthorized",
  );
  const offlinePhysicalDevices = devices.filter((device) => device.type === "physical" && device.connectionState === "offline");
  const physicalDevices = authorisedDevices.filter((device) => device.type === "physical");
  const blockers = [];
  if (unauthorisedPhysicalDevices.length) blockers.push("physical_android_unauthorized");
  if (offlinePhysicalDevices.length) blockers.push("physical_android_offline");
  if (!physicalDevices.length && !unauthorisedPhysicalDevices.length && !offlinePhysicalDevices.length) {
    blockers.push("physical_android_missing");
  }
  return {
    status: blockers.length ? "blocked" : "ready",
    adb: adbCommand,
    setupPlan,
    devices,
    authorisedDevices,
    unauthorisedPhysicalDevices,
    offlinePhysicalDevices,
    physicalDevices,
    blockers,
    detail: physicalDevices.length
      ? `${physicalDevices.map((device) => device.serial).join(", ")} visible to adb.`
      : androidDeviceDetail({ unauthorisedPhysicalDevices, offlinePhysicalDevices }),
  };
}

function inspectAndroidSetupPlan() {
  if (synthetic) {
    return {
      status: "not_checked",
      command: "npm run native:android-avd-plan",
      detail: "Skipped for synthetic native blocker packet tests.",
    };
  }
  const scriptPath = join(mobileAppRoot, "scripts", "native-android-avd-plan.mjs");
  const result = run(process.execPath, [scriptPath]);
  return {
    status: result.status === 0 ? "ready" : "blocked",
    command: "npm run native:android-avd-plan",
    detail: firstRelevantLine(result.stdout || result.stderr) || commandError(result) || "Android AVD plan did not return detail.",
  };
}

function inspectIos() {
  const developerDirectory = run(xcodeSelectCommand, ["-p"]);
  const simctlDevices = run(xcrunCommand, ["simctl", "list", "devices", "available"]);
  const simctlRuntimes = run(xcrunCommand, ["simctl", "list", "runtimes", "available"]);
  const simulators = parseAvailableSimulators(simctlDevices.stdout || "");
  const iosRuntimes = parseIosRuntimes(simctlRuntimes.stdout || "");
  const developerPath = developerDirectory.status === 0 ? developerDirectory.stdout.trim() : "";
  const blockers = [];
  if (developerDirectory.status !== 0 || developerPath.includes("/CommandLineTools")) blockers.push("full_xcode_missing");
  if (simctlDevices.status !== 0) blockers.push("simctl_missing");
  if (!iosRuntimes.length) blockers.push("ios_runtime_missing");
  if (!simulators.length) blockers.push("ios_simulator_missing");

  return {
    status: blockers.length ? "blocked" : "ready",
    developerPath,
    simctlAvailable: simctlDevices.status === 0,
    iosRuntimes,
    simulators,
    blockers,
    detail: blockers.length
      ? commandError(simctlDevices) || "Full Xcode, an iOS runtime and a bootable simulator are required."
      : `${simulators.length} simulator(s) available.`,
  };
}

function parseAndroidDevices(output) {
  return output
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const serial = line.split(/\s+/)[0];
      const connectionState = line.split(/\s+/)[1] || "unknown";
      return {
        serial,
        type: serial.startsWith("emulator-") ? "emulator" : "physical",
        connectionState,
        detail: line,
      };
    });
}

function androidDeviceDetail({ unauthorisedPhysicalDevices, offlinePhysicalDevices }) {
  if (unauthorisedPhysicalDevices.length) {
    return `Authorise USB debugging on ${unauthorisedPhysicalDevices.map((device) => device.serial).join(", ")}.`;
  }
  if (offlinePhysicalDevices.length) {
    return `Reconnect or wake ${offlinePhysicalDevices.map((device) => device.serial).join(", ")}; adb reports it offline.`;
  }
  return "Attach and authorise a physical Android device.";
}

function parseAvailableSimulators(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /\([0-9A-F-]+\) \((Shutdown|Booted)\)/.test(line));
}

function parseIosRuntimes(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^iOS \d+/.test(line) && !/\bunavailable\b/i.test(line));
}

function buildNextCommands(android, ios) {
  const commands = [];
  if (android.setupPlan?.status === "blocked") {
    commands.push("npm run native:android-avd-plan");
  }
  if (
    android.blockers.includes("physical_android_missing") ||
    android.blockers.includes("physical_android_unauthorized") ||
    android.blockers.includes("physical_android_offline")
  ) {
    commands.push("adb devices -l");
    commands.push("npm run native:android-physical-readiness");
    commands.push("FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-preview-android-f67da375.apk npm run native:android-performance-smoke");
    commands.push("npm run native:android-performance-summary");
  }
  if (ios.blockers.length) {
    commands.push("sudo xcode-select -s /Applications/Xcode.app/Contents/Developer");
    commands.push("npm run native:ios-simulator-plan");
    commands.push("npm run native:readiness -- --strict");
  }
  return commands;
}

function markdown(packet) {
  return [
    "# Native Blocker Packet",
    "",
    `Status: ${packet.status}`,
    `Generated: ${packet.generatedAt}`,
    "",
    "## Android",
    "",
    `Status: ${packet.android.status}`,
    `Setup plan: ${packet.android.setupPlan?.status || "unknown"} - ${packet.android.setupPlan?.detail || "not checked"}`,
    `Detail: ${packet.android.detail}`,
    `Visible devices: ${packet.android.devices.length || 0}`,
    `Physical devices: ${packet.android.physicalDevices.map((device) => device.serial).join(", ") || "none"}`,
    "",
    "## iOS",
    "",
    `Status: ${packet.ios.status}`,
    `Developer path: ${packet.ios.developerPath || "unknown"}`,
    `simctl available: ${packet.ios.simctlAvailable}`,
    `iOS runtimes: ${packet.ios.iosRuntimes.join(", ") || "none"}`,
    `Simulators: ${packet.ios.simulators.length || 0}`,
    `Detail: ${packet.ios.detail}`,
    "",
    "## Blockers",
    "",
    ...(packet.blockers.length ? packet.blockers.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Next Commands",
    "",
    ...(packet.nextCommands.length ? packet.nextCommands.map((item) => `- \`${item}\``) : ["- None"]),
    "",
  ].join("\n");
}

function findAndroidAdb() {
  const candidates = [
    process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, "platform-tools", "adb") : "",
    process.env.ANDROID_SDK_ROOT ? join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb") : "",
    process.env.HOME ? join(process.env.HOME, "Library", "Android", "sdk", "platform-tools", "adb") : "",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function run(command, args) {
  return spawnSync(command, args, { encoding: "utf8", timeout: 5_000 });
}

function commandError(result) {
  return (result.stderr || result.stdout || result.error?.message || "").trim();
}

function firstRelevantLine(value) {
  const lines = String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.find((line) => /Android ARM64 AVD setup plan is actionable/.test(line)) ||
    lines.find((line) => /^BLOCKED/.test(line)) ||
    lines.find((line) => /^READY/.test(line)) ||
    lines.find((line) => /^PASS/.test(line)) ||
    "";
}
