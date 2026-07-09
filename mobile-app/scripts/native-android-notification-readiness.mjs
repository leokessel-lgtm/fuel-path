#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDir, "..");
const repoRoot = resolve(mobileRoot, "..");
const smokeDir = resolve(repoRoot, "tmp/native-smoke");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = join(smokeDir, `android-notification-readiness-${timestamp}.md`);
const packageName = "com.fuelpath.app";
const env = { ...process.env };
const artifact = resolveInputPath(
  argumentValue("--artifact") ||
  env.FUEL_PATH_NATIVE_ARTIFACT ||
  newestLocalStandaloneApk() ||
  "",
);
const apiBaseUrl = env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL || "https://fuel-path.vercel.app";
const requestedSerial = argumentValue("--device-serial") || env.FUEL_PATH_ANDROID_DEVICE_SERIAL || "";
const checks = [];

mkdirSync(smokeDir, { recursive: true });

check("APK artifact exists", Boolean(artifact && existsSync(artifact)), {
  fail: true,
  detail: artifact || "missing",
});

const permissions = artifact && existsSync(artifact) ? apkPermissions(artifact) : [];
check("Android POST_NOTIFICATIONS permission packaged", permissions.includes("android.permission.POST_NOTIFICATIONS"), {
  fail: true,
  detail: "Required on Android 13+ before route alerts can ask permission.",
});
check("Android FCM receive permission packaged", permissions.includes("com.google.android.c2dm.permission.RECEIVE"), {
  fail: true,
  detail: "Required before Expo push token delivery can work on Android.",
});
check("Android boot receiver permission packaged", permissions.includes("android.permission.RECEIVE_BOOT_COMPLETED"), {
  fail: true,
  detail: "Needed for durable scheduled notification behaviour after reboot.",
});

const badging = artifact && existsSync(artifact) ? aapt(["dump", "badging", artifact]) : "";
const targetSdk = badging.match(/targetSdkVersion:'(\d+)'/)?.[1] || "";
check("Android target SDK supports runtime notification permission", Number(targetSdk) >= 33, {
  fail: true,
  detail: targetSdk ? `targetSdkVersion ${targetSdk}` : "target SDK missing",
});

const appConfig = artifact && existsSync(artifact) ? packagedAppConfig(artifact) : null;
check("EAS project id packaged for Expo push token", Boolean(appConfig?.extra?.eas?.projectId), {
  fail: true,
  detail: appConfig?.extra?.eas?.projectId ? "configured" : "missing",
});
check("Android Maps key packaged as configured flag only", appConfig?.extra?.androidGoogleMapsApiKeyConfigured === true, {
  fail: true,
  detail: "The report intentionally does not print the key value.",
});
check("Notification channel id configured in app config", notificationPlugin(appConfig)?.defaultChannel === "route-alerts", {
  fail: true,
  detail: notificationPlugin(appConfig)?.defaultChannel || "missing",
});

const capability = await checkBackendCapability(apiBaseUrl);
check("Backend client capability issuing responds", capability.accepted, {
  fail: false,
  detail: capability.detail,
});

const adb = findAndroidTool("adb", ["platform-tools", "adb"]);
const device = adb ? currentDevice(adb) : null;
check("Physical Android device visible for notification validation", Boolean(device), {
  fail: false,
  detail: device ? device.detail : "No connected adb device inspected.",
});

if (adb && device) {
  const packageInstalled = spawnSync(adb, adbArgs(["shell", "pm", "path", packageName], device.serial), {
    encoding: "utf8",
    timeout: 5_000,
  });
  check("Fuel Path package installed on selected Android device", packageInstalled.status === 0 && packageInstalled.stdout.includes("package:"), {
    fail: false,
    detail: device.serial,
  });

  const packageDump = spawnSync(adb, adbArgs(["shell", "dumpsys", "package", packageName], device.serial), {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 5_000,
  });
  const notificationPermissionLine = packageDump.stdout
    ?.split("\n")
    .find((line) => line.includes("android.permission.POST_NOTIFICATIONS"));
  check("Selected Android device notification permission state observed", packageDump.status === 0 && Boolean(notificationPermissionLine), {
    fail: false,
    detail: notificationPermissionLine?.trim() || commandError(packageDump),
  });

  const notificationDump = spawnSync(adb, adbArgs(["shell", "dumpsys", "notification", "--noredact"], device.serial), {
    encoding: "utf8",
    maxBuffer: 3 * 1024 * 1024,
    timeout: 5_000,
  });
  const channelLine = notificationDump.stdout
    ?.split("\n")
    .find((line) => line.includes("NotificationChannel{mId='route-alerts'") && line.includes("mName=Saved route alerts"));
  check("Installed app has Android route-alerts notification channel", notificationDump.status === 0 && Boolean(channelLine), {
    fail: false,
    detail: channelLine?.trim() || commandError(notificationDump) || "Launch the installed app once so the channel can be created.",
  });
}

const status = checks.some((item) => item.status === "fail")
  ? "failed"
  : checks.some((item) => item.status === "warn")
    ? "partial"
    : "passed";

const lines = [
  `# Android Notification Readiness - ${new Date().toISOString()}`,
  "",
  `Status: ${status}`,
  `Artifact: ${artifact ? relative(artifact) : "missing"}`,
  `API base URL: ${apiBaseUrl}`,
  "",
  "| Check | Status | Detail |",
  "| --- | --- | --- |",
  ...checks.map((item) => `| ${item.name} | ${item.status} | ${escapeTable(item.detail || "")} |`),
  "",
  "## Interpretation",
  "",
  "- This proves Android notification packaging and backend capability reachability only.",
  "- When a connected device has already launched the installed app, this also verifies the Android `route-alerts` notification channel exists on-device.",
  "- It does not register a real Expo push token or prove a delivered push notification.",
  "- Backend saved-route sync is covered separately by `npm run native:android-alert-sync-smoke`.",
  "- Runtime permission and real Expo push-token creation still need an on-device flow after permission is granted.",
  "",
];

writeFileSync(reportPath, `${lines.join("\n")}\n`);
console.log(`Android notification readiness ${status}: ${reportPath}`);
if (status === "failed") process.exit(1);

function check(name, passed, { fail = false, detail = "" } = {}) {
  checks.push({
    name,
    detail: passed ? detail : detail,
    status: passed ? "pass" : fail ? "fail" : "warn",
  });
}

function apkPermissions(path) {
  return aapt(["dump", "permissions", path])
    .split("\n")
    .map((line) => line.match(/uses-permission: name='([^']+)'/)?.[1])
    .filter(Boolean);
}

function aapt(args) {
  const candidates = [
    join(env.ANDROID_HOME || "", "build-tools", "36.0.0", "aapt"),
    join(env.ANDROID_SDK_ROOT || "", "build-tools", "36.0.0", "aapt"),
    join(env.HOME || "", "Library/Android/sdk/build-tools/36.0.0/aapt"),
    join(env.HOME || "", "Library/Android/sdk/build-tools/35.0.0/aapt"),
  ].filter(Boolean);
  const command = candidates.find((candidate) => existsSync(candidate));
  if (!command) return "";
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

function packagedAppConfig(path) {
  try {
    return JSON.parse(execFileSync("unzip", ["-p", path, "assets/app.config"], { encoding: "utf8" }));
  } catch {
    return null;
  }
}

function notificationPlugin(config) {
  const plugin = config?.plugins?.find((item) => Array.isArray(item) && item[0] === "expo-notifications");
  return Array.isArray(plugin) ? plugin[1] : undefined;
}

async function checkBackendCapability(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/alerts?action=client-capability`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId: `readiness_device_${timestamp}`,
        userId: `readiness_user_${timestamp}`,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 202 && payload?.accepted === true && typeof payload?.expiresAt === "string") {
      return { accepted: true, detail: "accepted, scoped token omitted from report" };
    }
    return { accepted: false, detail: `HTTP ${response.status}: ${payload?.error || "not accepted"}` };
  } catch (error) {
    return { accepted: false, detail: error.message || "request failed" };
  }
}

function currentDevice(adb) {
  const output = spawnSync(adb, ["devices", "-l"], { encoding: "utf8", timeout: 5_000 });
  if (output.status !== 0) return null;
  const devices = output.stdout
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && /\sdevice\s/.test(line))
    .map((line) => ({ serial: line.split(/\s+/)[0], detail: line }));
  return requestedSerial
    ? devices.find((item) => item.serial === requestedSerial) || null
    : devices.find((item) => !item.serial.startsWith("emulator-")) || devices[0] || null;
}

function adbArgs(args, serial) {
  return serial ? ["-s", serial, ...args] : args;
}

function findAndroidTool(binary, parts) {
  const candidates = [
    env.ANDROID_HOME ? join(env.ANDROID_HOME, ...parts) : "",
    env.ANDROID_SDK_ROOT ? join(env.ANDROID_SDK_ROOT, ...parts) : "",
    env.HOME ? join(env.HOME, "Library/Android/sdk", ...parts) : "",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || binary;
}

function newestLocalStandaloneApk() {
  const artifactsDir = resolve(mobileRoot, "native-artifacts");
  if (!existsSync(artifactsDir)) return "";
  return readdirSync(artifactsDir)
    .filter((name) => /^fuel-path-local-standalone.*\.apk$/.test(name))
    .map((name) => resolve(artifactsDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || "";
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] && !process.argv[index + 1].startsWith("--")
    ? process.argv[index + 1]
    : "";
}

function resolveInputPath(value) {
  if (!value) return "";
  return isAbsolute(value) ? value : resolve(mobileRoot, value);
}

function relative(path) {
  return `${basename(repoRoot)}/${path.replace(`${repoRoot}/`, "")}`;
}

function commandError(result) {
  return (result.stderr || result.stdout || "").trim();
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|");
}
