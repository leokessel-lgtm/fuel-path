import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const appJson = readJson("app.json").expo;
const packageJson = readJson("package.json");
const appConfigSource = readFileSync(resolve("src/config.ts"), "utf8");
const env = process.env;

const checks = [];

check("Expo SDK 56 app dependency", packageJson.dependencies?.expo?.startsWith("~56."), {
  fail: true,
  detail: `expo is ${packageJson.dependencies?.expo || "missing"}`,
});

check(
  "Expo Notifications SDK 56 dependency",
  packageJson.dependencies?.["expo-notifications"]?.startsWith("~56."),
  {
    fail: true,
    detail: `expo-notifications is ${packageJson.dependencies?.["expo-notifications"] || "missing"}`,
  },
);

check("iOS bundle identifier configured", appJson.ios?.bundleIdentifier === "com.fuelpath.app", {
  fail: true,
  detail: appJson.ios?.bundleIdentifier || "missing",
});

check("iOS launch target is iPhone-only until tablet UX is optimised", appJson.ios?.supportsTablet === false, {
  fail: true,
  detail: "Set ios.supportsTablet to false unless a dedicated tablet UX pass has been validated.",
});

check("Android package configured", appJson.android?.package === "com.fuelpath.app", {
  fail: true,
  detail: appJson.android?.package || "missing",
});

check("Route alert notification channel configured", notificationsPlugin()?.defaultChannel === "route-alerts", {
  fail: true,
  detail: notificationsPlugin()?.defaultChannel || "missing",
});

check("EAS project id available to native build", Boolean(easProjectId()), {
  fail: strict,
  detail: "Set EXPO_PUBLIC_EAS_PROJECT_ID or EAS_PROJECT_ID before building.",
});

check("Backend alerts validation token configured", Boolean(alertsValidationToken()), {
  fail: strict,
  detail: "Set EXPO_PUBLIC_FUEL_PATH_ALERTS_VALIDATION_TOKEN before backend push sync validation.",
});

check("Physical-device API base URL configured", validDeviceApiBaseUrl(), {
  fail: strict,
  detail: "Set EXPO_PUBLIC_FUEL_PATH_API_BASE_URL to a reachable HTTPS or LAN URL, not 127.0.0.1.",
});

check("Android Google Maps key configured", Boolean(env.FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY), {
  fail: strict,
  detail: "Set FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY for Android native map validation.",
});

check("Expo public env access is native-bundle safe", bundleSafePublicEnvAccess(), {
  fail: true,
  detail: "Use direct process.env.EXPO_PUBLIC_* access in src/config.ts so Expo can inline values into native bundles.",
});

check("Installed native fallback uses HTTPS API", installedNativeFallbackIsHttps(), {
  fail: true,
  detail: "Release/preview native builds must not fall back to emulator or localhost HTTP API URLs.",
});

const failures = checks.filter((item) => item.status === "fail");
const warnings = checks.filter((item) => item.status === "warn");

console.log("Fuel Path native validation preflight");
for (const item of checks) {
  const marker = item.status === "pass" ? "PASS" : item.status === "warn" ? "WARN" : "FAIL";
  console.log(`${marker} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failures.length) {
  console.error(`Native validation preflight failed with ${failures.length} blocker(s).`);
  process.exit(1);
}

if (warnings.length) {
  console.warn(`Native validation preflight passed with ${warnings.length} warning(s). Use --strict before EAS device validation.`);
} else {
  console.log("Native validation preflight passed.");
}

function check(name, passed, { detail = "", fail = false } = {}) {
  checks.push({
    name,
    detail: passed ? "" : detail,
    status: passed ? "pass" : fail ? "fail" : "warn",
  });
}

function easProjectId() {
  return env.EXPO_PUBLIC_EAS_PROJECT_ID || env.EAS_PROJECT_ID || appJson.extra?.eas?.projectId || "";
}

function alertsValidationToken() {
  return env.EXPO_PUBLIC_FUEL_PATH_ALERTS_VALIDATION_TOKEN || env.EXPO_PUBLIC_FUEL_PATH_ALERTS_TOKEN || "";
}

function validDeviceApiBaseUrl() {
  const value = env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL || "";
  if (!value || value === "__SAME_ORIGIN__") return false;

  try {
    const url = new URL(value);
    return !["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function bundleSafePublicEnvAccess() {
  return (
    appConfigSource.includes("process.env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL") &&
    appConfigSource.includes("process.env.EXPO_PUBLIC_FUEL_PATH_ALERTS_VALIDATION_TOKEN") &&
    appConfigSource.includes("process.env.EXPO_PUBLIC_EAS_PROJECT_ID") &&
    !appConfigSource.includes("process?.env") &&
    !appConfigSource.includes("process.env?.")
  );
}

function installedNativeFallbackIsHttps() {
  return (
    appConfigSource.includes('const PRODUCTION_API_BASE_URL = "https://fuel-path.vercel.app";') &&
    !appConfigSource.includes('if (Platform.OS === "android") {') &&
    appConfigSource.includes("if (__DEV__ && Platform.OS === \"android\")")
  );
}

function notificationsPlugin() {
  const plugin = (appJson.plugins || []).find((item) => Array.isArray(item) && item[0] === "expo-notifications");
  return Array.isArray(plugin) ? plugin[1] : undefined;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}
