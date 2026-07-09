#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDir, "..");
const repoRoot = resolve(mobileRoot, "..");
const smokeDir = resolve(repoRoot, "tmp/native-smoke");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = join(smokeDir, `android-navigation-intents-${timestamp}.md`);
const source = readFileSync(resolve(mobileRoot, "src/screens/NearbyScreen.utils.ts"), "utf8");

mkdirSync(smokeDir, { recursive: true });

const checks = [
  {
    name: "Direct station Device maps uses Android VIEW geo intent",
    ok:
      source.includes("androidIntent: androidDeviceMapsIntent(geoUrl)") &&
      source.includes("url: geoUrl"),
    detail: "Keeps Android device maps native-first for single destination handoff.",
  },
  {
    name: "Route via fuel stop Device maps uses Google Maps app package first",
    ok:
      source.includes("androidIntent: androidGoogleMapsIntent(googleMapsUrl)") &&
      source.includes("packageName: ANDROID_GOOGLE_MAPS_PACKAGE"),
    detail: "Avoids generic browser-first handoff for route URL with waypoint.",
  },
  {
    name: "Google Maps direct destination uses google.navigation scheme",
    ok:
      source.includes("androidGoogleNavigationUrl(safeLat, safeLon)") &&
      source.includes("google.navigation:q=${Number(lat)},${Number(lon)}&mode=d"),
    detail: "Uses Android navigation intent shape instead of web URL where possible.",
  },
  {
    name: "Waze handoff uses package-targeted native intent",
    ok:
      source.includes('const ANDROID_WAZE_PACKAGE = "com.waze";') &&
      source.includes("packageName: ANDROID_WAZE_PACKAGE") &&
      source.includes("waze://?ll=${Number(lat)},${Number(lon)}&navigate=yes&utm_source=fuelpath"),
    detail: "Keeps Waze native and separate from Google Maps/device maps.",
  },
  {
    name: "Apple Maps preference remains available on Android as web handoff",
    ok:
      source.includes('provider: "apple_maps"') &&
      source.includes("fallbackUrl: appleMapsUrl") &&
      source.includes("appleMapsRouteViaStopUrl(origin, stop, destination)"),
    detail: "Respects the cross-device Apple Maps preference without pretending Android has a native Apple Maps app.",
  },
  {
    name: "Navigation fallback remains available",
    ok:
      source.includes("if (!option.fallbackUrl) throw error;") &&
      source.includes("await Linking.openURL(option.fallbackUrl);"),
    detail: "Falls back to browser URL only when a native intent fails.",
  },
];

const status = checks.every((check) => check.ok) ? "passed" : "failed";
const lines = [
  `# Android Navigation Intents - ${new Date().toISOString()}`,
  "",
  `Status: ${status}`,
  "",
  "| Check | Status | Detail |",
  "| --- | --- | --- |",
  ...checks.map((check) => `| ${check.name} | ${check.ok ? "pass" : "fail"} | ${check.detail} |`),
  "",
  "## Interpretation",
  "",
  "- This is a static Android navigation-contract smoke, not a physical app-launch test.",
  "- It guards against route handoff drifting back to browser-first URLs on Android.",
  "",
];

writeFileSync(reportPath, `${lines.join("\n")}\n`);
console.log(`Android navigation intents ${status}: ${reportPath}`);
if (status !== "passed") process.exit(1);
