const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const read = (relativePath) => readFileSync(path.join(ROOT, relativePath), "utf8");

test("web screens stay lazy while the native fallback remains synchronous", () => {
  const webScreens = read("mobile-app/src/screens/AppScreens.web.tsx");
  const nativeFallback = read("mobile-app/src/screens/AppScreens.tsx");
  const app = read("mobile-app/App.tsx");
  assert.match(webScreens, /lazy\(loaders\.nearby\)/);
  assert.match(webScreens, /lazy\(loaders\.plan\)/);
  assert.match(webScreens, /lazy\(loaders\.account\)/);
  assert.doesNotMatch(nativeFallback, /lazy\(|import\(/);
  assert.match(app, /class ScreenLoadBoundary/);
  assert.match(app, /This screen could not load\./);
});

test("web platform services exclude native-only Expo SDKs", () => {
  const webLocation = read("mobile-app/src/services/currentLocation.web.ts");
  const webNotifications = read("mobile-app/src/services/routeNotifications.web.ts");
  const webIntent = read("mobile-app/src/services/androidIntentLauncher.web.ts");
  const packageJson = read("mobile-app/package.json");
  assert.doesNotMatch(webLocation, /expo-location/);
  assert.doesNotMatch(webNotifications, /expo-notifications|expo-constants/);
  assert.doesNotMatch(webIntent, /expo-intent-launcher/);
  assert.doesNotMatch(packageJson, /expo-image|expo-status-bar/);
});
