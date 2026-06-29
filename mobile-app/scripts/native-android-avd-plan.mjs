import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";

const API_LEVEL = "35";
const AVD_NAME = "Fuel_Path_Arm64_API_35";
const SYSTEM_IMAGE = `system-images;android-${API_LEVEL};google_apis;arm64-v8a`;
const PLATFORM = `platforms;android-${API_LEVEL}`;

const androidSdkRoot = findAndroidSdkRoot();
const sdkManagerCommand = findAndroidTool("sdkmanager", ["cmdline-tools", "latest", "bin", "sdkmanager"]);
const avdManagerCommand = findAndroidTool("avdmanager", ["cmdline-tools", "latest", "bin", "avdmanager"]);
const emulatorCommand = findAndroidTool("emulator", ["emulator", "emulator"]);
const androidToolEnv = buildAndroidToolEnv();
const existingAvds = readAndroidAvdConfigs();
const installedPackages = listInstalledPackages();
const hostArch = spawnSync("uname", ["-m"], { encoding: "utf8", timeout: 2_000 }).stdout.trim() || "unknown";
const compatibleAvds = existingAvds.filter((avd) => isArm64Compatible(avd.abi));
const commandLineToolsAvailable = Boolean(sdkManagerCommand && avdManagerCommand);
const arm64ImageInstalled = installedPackages.some((line) => line.includes(SYSTEM_IMAGE));
const platformInstalled = installedPackages.some((line) => line.includes(PLATFORM));

const checks = [
  {
    name: "Android SDK root",
    status: androidSdkRoot ? "pass" : "blocked",
    detail: androidSdkRoot || "Install Android Studio or set ANDROID_HOME/ANDROID_SDK_ROOT.",
  },
  {
    name: "Android SDK Command-line Tools",
    status: commandLineToolsAvailable ? "pass" : "blocked",
    detail: commandLineToolsAvailable
      ? "sdkmanager and avdmanager are available."
      : "Install Android SDK Command-line Tools from Android Studio SDK Tools.",
  },
  {
    name: `Android ${API_LEVEL} platform`,
    status: platformInstalled ? "pass" : sdkManagerCommand ? "ready" : "blocked",
    detail: platformInstalled ? PLATFORM : "Install with sdkmanager before creating the AVD.",
  },
  {
    name: `Android ${API_LEVEL} ARM64 system image`,
    status: arm64ImageInstalled ? "pass" : sdkManagerCommand ? "ready" : "blocked",
    detail: arm64ImageInstalled ? SYSTEM_IMAGE : "Install the ARM64 Google APIs image for this Apple Silicon host.",
  },
  {
    name: "ARM64-compatible AVD",
    status: compatibleAvds.length ? "pass" : commandLineToolsAvailable && arm64ImageInstalled ? "ready" : "blocked",
    detail: compatibleAvds.length
      ? compatibleAvds.map((avd) => `${avd.name} (${avd.abi})`).join(", ")
      : `Host is ${hostArch}; existing AVD ABI(s): ${existingAvds.map((avd) => `${avd.name} (${avd.abi || "unknown"})`).join(", ") || "none"}.`,
  },
  {
    name: "Android emulator",
    status: emulatorCommand ? "pass" : "blocked",
    detail: emulatorCommand || "Install Android Emulator from Android Studio SDK Tools.",
  },
];

const commands = buildCommands();

console.log("Fuel Path Android ARM64 AVD plan");
for (const item of checks) {
  const marker = item.status === "pass" ? "PASS" : item.status === "ready" ? "READY" : "BLOCKED";
  console.log(`${marker} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

console.log("\nRecommended commands");
for (const command of commands) {
  console.log(command);
}

const blockers = checks.filter((item) => item.status === "blocked");
if (blockers.length) {
  console.error(`Android ARM64 AVD setup is blocked by ${blockers.length} item(s).`);
  process.exit(1);
}

console.log("Android ARM64 AVD setup plan is actionable.");

function buildCommands() {
  const lines = [];
  if (!commandLineToolsAvailable) {
    lines.push("Android Studio > Settings > Languages & Frameworks > Android SDK > SDK Tools > install Android SDK Command-line Tools");
  }
  if (sdkManagerCommand && (!platformInstalled || !arm64ImageInstalled)) {
    lines.push(`"${sdkManagerCommand}" "${PLATFORM}" "${SYSTEM_IMAGE}"`);
  }
  if (avdManagerCommand && arm64ImageInstalled && !compatibleAvds.length) {
    lines.push(`"${avdManagerCommand}" create avd --force --name "${AVD_NAME}" --package "${SYSTEM_IMAGE}" --device "pixel_6"`);
  }
  if (emulatorCommand && compatibleAvds.length) {
    lines.push(`"${emulatorCommand}" -avd "${compatibleAvds[0]?.id || AVD_NAME}" -no-snapshot -gpu swiftshader_indirect`);
  }
  lines.push("npm run native:readiness -- --strict");
  return lines;
}

function listInstalledPackages() {
  if (!sdkManagerCommand) return [];
  const result = spawnSync(sdkManagerCommand, ["--list_installed"], { encoding: "utf8", env: androidToolEnv, timeout: 15_000 });
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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
      return {
        id: name.replace(/\.avd$/, ""),
        name: readIniValue(config, "avd.ini.displayname") || readIniValue(config, "AvdId") || name.replace(/\.avd$/, ""),
        abi: readIniValue(config, "abi.type") || readIniValue(config, "hw.cpu.arch") || "",
      };
    })
    .filter(Boolean);
}

function readIniValue(config, key) {
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*(.+)$`, "m");
  return config.match(pattern)?.[1]?.trim() || "";
}

function isArm64Compatible(abi) {
  const value = String(abi || "").toLowerCase();
  return value.includes("arm64") || value.includes("aarch64");
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
