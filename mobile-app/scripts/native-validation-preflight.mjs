import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const appJson = readJson("app.json").expo;
const packageJson = readJson("package.json");
const appConfigSource = readFileSync(resolve("src/config.ts"), "utf8");
const nativeGenerationContract = readJson("native-generation-contract.json");
const gradleWrapperPath = resolve("android/gradle/wrapper/gradle-wrapper.properties");
const gradleWrapperSource = existsSync(gradleWrapperPath) ? readFileSync(gradleWrapperPath, "utf8") : "";
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

check("Tracked native generation contract requires Expo-compatible Gradle 8", nativeGenerationContract.android?.supportedGradleMajor === 8, {
  fail: true,
  detail: "Keep native-generation-contract.json on Gradle 8; Gradle 9 currently breaks the React Native toolchain resolver.",
});

check("Generated Android Gradle wrapper is available and matches the tracked contract", androidGradleWrapperIsCompatible(), {
  fail: strict,
  detail: gradleWrapperSource
    ? `Regenerate Android with supported Gradle ${nativeGenerationContract.android?.supportedGradleMajor}.x.`
    : "Run Expo prebuild before strict native/device validation; generated android/ is intentionally ignored in clean worktrees.",
});

check("Route alert notification channel configured", notificationsPlugin()?.defaultChannel === "route-alerts", {
  fail: true,
  detail: notificationsPlugin()?.defaultChannel || "missing",
});

check("EAS project id available to native build", Boolean(easProjectId()), {
  fail: strict,
  detail: "Set EXPO_PUBLIC_EAS_PROJECT_ID or EAS_PROJECT_ID before building.",
});

check("Backend alerts capability issuing configured", Boolean(alertCapabilityConfigured()), {
  fail: strict,
  detail: "Set ALERTS_CLIENT_WRITE_ENABLED=1 and ALERTS_CLIENT_WRITE_TOKEN or ALERTS_CLIENT_CAPABILITY_SECRET in the preview backend environment.",
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

function alertCapabilityConfigured() {
  if (env.ALERTS_CLIENT_WRITE_ENABLED !== "1") return false;
  return Boolean(env.ALERTS_CLIENT_CAPABILITY_SECRET || env.ALERTS_CLIENT_WRITE_TOKEN);
}

function validDeviceApiBaseUrl() {
  const value = env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL || "https://fuel-path.vercel.app";
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
    appConfigSource.includes("process.env.EXPO_PUBLIC_EAS_PROJECT_ID") &&
    !appConfigSource.includes("process?.env") &&
    !appConfigSource.includes("process.env?.")
  );
}

function installedNativeFallbackIsHttps() {
  return (
    appConfigSource.includes('const PRODUCTION_API_BASE_URL = "https://fuel-path.vercel.app";') &&
    !appConfigSource.includes('if (Platform.OS === "android") {') &&
    !appConfigSource.includes("10.0.2.2:4174") &&
    !appConfigSource.includes("127.0.0.1:4174")
  );
}

function androidGradleWrapperIsCompatible() {
  const expectedMajor = Number(nativeGenerationContract.android?.supportedGradleMajor);
  return Boolean(gradleWrapperSource) && Number.isInteger(expectedMajor)
    && new RegExp(`distributionUrl=.*gradle-${expectedMajor}\\.\\d+(?:\\.\\d+)?-bin\\.zip`).test(gradleWrapperSource);
}

function notificationsPlugin() {
  const plugin = (appJson.plugins || []).find((item) => Array.isArray(item) && item[0] === "expo-notifications");
  return Array.isArray(plugin) ? plugin[1] : undefined;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}
