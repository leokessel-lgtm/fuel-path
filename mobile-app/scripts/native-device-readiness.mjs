import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const strict = process.argv.includes("--strict");
const requirePhysicalAndroid = process.argv.includes("--require-physical-android");
const includeIosChecks = process.argv.includes("--include-ios") || !requirePhysicalAndroid;
const checks = [];
const mobileAppRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const androidSdkRoot = findAndroidSdkRoot();
const adbCommand = findAndroidTool("adb", ["platform-tools", "adb"]);
const emulatorCommand = findAndroidTool("emulator", ["emulator", "emulator"]);
const sdkManagerCommand = findAndroidTool("sdkmanager", ["cmdline-tools", "latest", "bin", "sdkmanager"]);
const avdManagerCommand = findAndroidTool("avdmanager", ["cmdline-tools", "latest", "bin", "avdmanager"]);
const androidToolEnv = buildAndroidToolEnv();

checkCommand("Android Debug Bridge available", adbCommand, ["version"], {
  blocker: true,
  detail: "Install Android Platform Tools or set ANDROID_HOME/ANDROID_SDK_ROOT before Android device validation.",
  timeoutMs: 5_000,
});

checkExecutable("Android emulator available", emulatorCommand, {
  blocker: true,
  detail: "Install Android Emulator or set ANDROID_HOME/ANDROID_SDK_ROOT before emulator validation.",
});

checkAndroidDevices();
if (requirePhysicalAndroid) checkPhysicalAndroidDevice();
checkAndroidAvds();
checkAndroidAvdHostCompatibility();
checkAndroidSdkManagers();
if (includeIosChecks) {
  checkXcodeSelect();
  checkSimctl();
} else {
  checks.push({
    name: "iOS validation checks",
    detail: "Skipped for Android physical-device readiness. Run with --include-ios or use native:ios-simulator-plan for iOS setup.",
    status: "warn",
  });
}
checkNativePublicEnv();
checkAndroidMapsKey();
checkEasProjectConfig();

console.log("Fuel Path native device readiness");
for (const item of checks) {
  const marker = item.status === "pass" ? "PASS" : item.status === "warn" ? "WARN" : "BLOCKED";
  console.log(`${marker} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

const blockers = checks.filter((item) => item.status === "blocked");
if (blockers.length && strict) {
  console.error(`Native device readiness blocked by ${blockers.length} item(s).`);
  process.exit(1);
}

if (blockers.length) {
  console.warn(`Native device readiness has ${blockers.length} blocker(s). Use --strict in CI or release gates.`);
} else {
  console.log("Native device readiness passed.");
}

function checkCommand(name, command, args, { blocker = false, detail = "", timeoutMs = 10_000 } = {}) {
  if (!command) {
    checks.push({
      name,
      detail,
      status: blocker ? "blocked" : "warn",
    });
    return { status: 1, stdout: "", stderr: detail };
  }
  const result = spawnSync(command, args, { encoding: "utf8", env: androidToolEnv, timeout: timeoutMs });
  checks.push({
    name,
    detail: result.status === 0 ? "" : detail || commandError(result),
    status: result.status === 0 ? "pass" : blocker ? "blocked" : "warn",
  });
  return result;
}

function checkExecutable(name, command, { blocker = false, detail = "" } = {}) {
  checks.push({
    name,
    detail: command ? "" : detail,
    status: command ? "pass" : blocker ? "blocked" : "warn",
  });
}

function checkAndroidDevices() {
  const result = adbCommand ? spawnSync(adbCommand, ["devices", "-l"], { encoding: "utf8", timeout: 5_000 }) : { status: 1, stdout: "", stderr: "" };
  if (result.status !== 0) {
    const detail = adbCommand
      ? commandError(result) || "adb did not return a device list before the readiness timeout."
      : "adb is unavailable, so no Android target can be inspected.";
    checks.push({
      name: "Android physical device or emulator connected",
      detail,
      status: "blocked",
    });
    return;
  }

  const devices = parseAndroidDevices(result.stdout);

  checks.push({
    name: "Android physical device or emulator connected",
    detail: devices.length ? `${devices.length} target(s) visible to adb.` : "Connect a device or start an emulator.",
    status: devices.length ? "pass" : "blocked",
  });
}

function checkPhysicalAndroidDevice() {
  const result = adbCommand ? spawnSync(adbCommand, ["devices", "-l"], { encoding: "utf8", timeout: 5_000 }) : { status: 1, stdout: "", stderr: "" };
  if (result.status !== 0) {
    checks.push({
      name: "Physical Android device connected",
      detail: adbCommand ? commandError(result) || "adb did not return a device list before the readiness timeout." : "adb is unavailable, so physical Android devices cannot be inspected.",
      status: "blocked",
    });
    return;
  }

  const devices = parseAndroidDevices(result.stdout);
  const physical = devices.filter((device) => !device.serial.startsWith("emulator-"));
  checks.push({
    name: "Physical Android device connected",
    detail: physical.length
      ? `${physical.map((device) => device.serial).join(", ")} visible to adb.`
      : "Attach and authorise a real mid-range Android device before performance validation.",
    status: physical.length ? "pass" : "blocked",
  });
}

function parseAndroidDevices(output) {
  return output
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && !line.includes("offline") && !line.includes("unauthorized"))
    .map((line) => ({ serial: line.split(/\s+/)[0], detail: line }));
}

function checkAndroidAvds() {
  const result = emulatorCommand ? spawnSync(emulatorCommand, ["-list-avds"], { encoding: "utf8", timeout: 5_000 }) : { status: 1, stdout: "", stderr: "" };
  if (result.status !== 0) {
    const detail = emulatorCommand
      ? commandError(result) || "emulator did not return an AVD list before the readiness timeout."
      : "emulator is unavailable, so AVDs cannot be listed.";
    checks.push({
      name: "Android Virtual Device available",
      detail,
      status: "blocked",
    });
    return;
  }

  const avds = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  checks.push({
    name: "Android Virtual Device available",
    detail: avds.length ? avds.join(", ") : "Create a mid-range Android AVD before emulator validation.",
    status: avds.length ? "pass" : "blocked",
  });
}

function checkAndroidAvdHostCompatibility() {
  const avds = readAndroidAvdConfigs();
  if (!avds.length) {
    checks.push({
      name: "Android AVD ABI compatible with host",
      detail: "No AVD configs were found.",
      status: "blocked",
    });
    return;
  }

  const hostArch = process.env.FUEL_PATH_HOST_ARCH_FOR_TESTS
    || spawnSync("uname", ["-m"], { encoding: "utf8", timeout: 2_000 }).stdout.trim();
  const compatible = avds.filter((avd) => isAvdAbiCompatible(hostArch, avd.abi));
  checks.push({
    name: "Android AVD ABI compatible with host",
    detail: compatible.length
      ? `${compatible.map((avd) => `${avd.name} (${avd.abi})`).join(", ")} compatible with ${hostArch}.`
      : `Host is ${hostArch}; installed AVD ABI(s): ${avds.map((avd) => `${avd.name} (${avd.abi || "unknown"})`).join(", ")}. Create an ARM64 AVD or use a physical Android device.`,
    status: compatible.length ? "pass" : "blocked",
  });
}

function checkAndroidSdkManagers() {
  checks.push({
    name: "Android SDK manager available",
    detail: sdkManagerCommand ? "" : "Install Android SDK Command-line Tools so an ARM64 system image can be installed locally.",
    status: sdkManagerCommand ? "pass" : "warn",
  });
  checks.push({
    name: "Android AVD manager available",
    detail: avdManagerCommand ? "" : "Install Android SDK Command-line Tools so an ARM64 AVD can be created locally.",
    status: avdManagerCommand ? "pass" : "warn",
  });
}

function readAndroidAvdConfigs() {
  const avdRoot = process.env.HOME ? join(process.env.HOME, ".android", "avd") : "";
  if (!avdRoot || !existsSync(avdRoot)) return [];
  return readdirSync(avdRoot)
    .filter((name) => name.endsWith(".avd"))
    .map((name) => {
      const configPath = join(avdRoot, name, "config.ini");
      if (!existsSync(configPath)) return null;
      const config = readFileSync(configPath, "utf8");
      const displayName = readIniValue(config, "avd.ini.displayname") || readIniValue(config, "AvdId") || name.replace(/\.avd$/, "");
      return {
        name: displayName,
        abi: readIniValue(config, "abi.type") || readIniValue(config, "hw.cpu.arch") || "",
      };
    })
    .filter(Boolean);
}

function readIniValue(config, key) {
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*(.+)$`, "m");
  return config.match(pattern)?.[1]?.trim() || "";
}

function isAvdAbiCompatible(hostArch, abi) {
  const normalHost = String(hostArch || "").toLowerCase();
  const normalAbi = String(abi || "").toLowerCase();
  if (normalHost === "arm64" || normalHost === "aarch64") return normalAbi.includes("arm64") || normalAbi.includes("aarch64");
  if (normalHost === "x86_64" || normalHost === "amd64") return normalAbi.includes("x86_64") || normalAbi.includes("x86");
  return false;
}

function checkXcodeSelect() {
  const result = spawnSync("xcode-select", ["-p"], { encoding: "utf8" });
  checks.push({
    name: "Xcode developer directory configured",
    detail: result.status === 0 ? result.stdout.trim() : "Install Xcode command-line tools before iOS simulator validation.",
    status: result.status === 0 ? "pass" : "warn",
  });
}

function checkSimctl() {
  const result = spawnSync("xcrun", ["simctl", "list", "devices", "available"], { encoding: "utf8", timeout: 5_000 });
  if (result.status !== 0) {
    checks.push({
      name: "iOS simulator control available",
      detail: commandError(result) || "xcrun simctl is unavailable.",
      status: "blocked",
    });
    return;
  }

  const devices = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /\([0-9A-F-]+\) \((Shutdown|Booted)\)/.test(line));

  checks.push({
    name: "iOS simulator available",
    detail: devices.length ? `${devices.length} simulator(s) listed.` : "Install an iOS simulator runtime.",
    status: devices.length ? "pass" : "blocked",
  });
}

function checkNativePublicEnv() {
  const baseUrl = process.env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL || "https://fuel-path.vercel.app";
  const validBaseUrl = Boolean(baseUrl) && !["127.0.0.1", "localhost", "::1"].some((host) => baseUrl.includes(host));
  const capabilityConfigured =
    process.env.ALERTS_CLIENT_WRITE_ENABLED === "1" &&
    Boolean(process.env.ALERTS_CLIENT_CAPABILITY_SECRET || process.env.ALERTS_CLIENT_WRITE_TOKEN);
  checks.push({
    name: "Physical-device API URL reachable locally",
    detail: validBaseUrl ? "" : "Use a LAN or HTTPS EXPO_PUBLIC_FUEL_PATH_API_BASE_URL before device runs.",
    status: validBaseUrl ? "pass" : "warn",
  });
  checks.push({
    name: "Preview alerts capability issuing configured locally",
    detail: capabilityConfigured ? "" : "Preview backend env may hold this, but the local shell does not.",
    status: capabilityConfigured ? "pass" : "warn",
  });
}

function checkAndroidMapsKey() {
  checks.push({
    name: "Android Maps key exported locally",
    detail: process.env.FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY
      ? ""
      : "EAS preview env may hold this, but the local shell does not.",
    status: process.env.FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY ? "pass" : "warn",
  });
}

function checkEasProjectConfig() {
  const appJsonPath = join(mobileAppRoot, "app.json");
  if (!existsSync(appJsonPath)) {
    checks.push({
      name: "EAS project id in app config",
      detail: `${appJsonPath} was not found.`,
      status: "blocked",
    });
    return;
  }

  const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    process.env.EAS_PROJECT_ID ||
    appJson.expo?.extra?.eas?.projectId ||
    "";
  checks.push({
    name: "EAS project id in app config",
    detail: projectId ? "" : "Set EXPO_PUBLIC_EAS_PROJECT_ID or EAS_PROJECT_ID before native push validation.",
    status: projectId ? "pass" : "warn",
  });
}

function commandError(result) {
  return (result.stderr || result.stdout || result.error?.message || "").trim();
}

function findAndroidSdkRoot() {
  const candidates = [
    process.env.FUEL_PATH_ANDROID_SDK_ROOT_FOR_TESTS,
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.HOME ? join(process.env.HOME, "Library", "Android", "sdk") : "",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function findAndroidTool(commandName, sdkParts) {
  const pathResult = spawnSync("which", [commandName], { encoding: "utf8" });
  if (pathResult.status === 0 && pathResult.stdout.trim()) return pathResult.stdout.trim();
  if (!androidSdkRoot) return "";
  const sdkTool = join(androidSdkRoot, ...sdkParts);
  return existsSync(sdkTool) ? sdkTool : "";
}

function buildAndroidToolEnv() {
  const javaHome = process.env.JAVA_HOME || findLocalJavaHome();
  if (!javaHome) return process.env;
  return {
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: [join(javaHome, "bin"), process.env.PATH || ""].filter(Boolean).join(delimiter),
  };
}

function findLocalJavaHome() {
  const roots = [resolve("var", "tooling", "java"), resolve("..", "var", "tooling", "java")];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const homes = readdirSync(root)
      .map((name) => join(root, name, "Contents", "Home"))
      .filter((home) => existsSync(join(home, "bin", "java")));
    if (homes.length) return homes.sort().at(-1);
  }
  return "";
}
