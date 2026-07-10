const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const SCRIPT_SOURCE = readFileSync(path.join(ROOT, "mobile-app/scripts/native-validation-preflight.mjs"), "utf8");

test("non-strict native preflight warns when generated Android is absent", async (context) => {
  const fixture = createFixture(context);
  const result = await runPreflight(fixture);
  assert.match(result.stdout, /WARN Generated Android Gradle wrapper/);
  assert.match(result.stderr, /Native validation preflight passed with 1 warning/);
});

test("strict native preflight fails clearly when generated Android is absent", async (context) => {
  const fixture = createFixture(context);
  await assert.rejects(runPreflight(fixture, ["--strict"]), (error) => {
    assert.match(error.stdout, /FAIL Generated Android Gradle wrapper/);
    assert.match(error.stderr, /Native validation preflight failed with 1 blocker/);
    return true;
  });
});

test("strict native preflight accepts a generated compatible Gradle 8 wrapper", async (context) => {
  const fixture = createFixture(context);
  writeFixtureFile(
    fixture,
    "android/gradle/wrapper/gradle-wrapper.properties",
    "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip\n",
  );
  const result = await runPreflight(fixture, ["--strict"]);
  assert.match(result.stdout, /PASS Generated Android Gradle wrapper/);
  assert.match(result.stdout, /Native validation preflight passed\./);
});

function createFixture(context) {
  const fixture = mkdtempSync(path.join(tmpdir(), "fuel-path-native-preflight-"));
  context.after(() => rmSync(fixture, { force: true, recursive: true }));
  writeFixtureFile(fixture, "native-validation-preflight.mjs", SCRIPT_SOURCE);
  writeFixtureFile(fixture, "native-generation-contract.json", '{"android":{"supportedGradleMajor":8}}\n');
  writeFixtureFile(fixture, "package.json", '{"dependencies":{"expo":"~56.0.12","expo-notifications":"~56.0.18"}}\n');
  writeFixtureFile(fixture, "app.json", `${JSON.stringify({ expo: {
    ios: { bundleIdentifier: "com.fuelpath.app", supportsTablet: false },
    android: { package: "com.fuelpath.app" },
    plugins: [["expo-notifications", { defaultChannel: "route-alerts" }]],
    extra: { eas: { projectId: "fixture-project" } },
  } })}\n`);
  writeFixtureFile(fixture, "src/config.ts", [
    'const PRODUCTION_API_BASE_URL = "https://fuel-path.vercel.app";',
    "process.env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL;",
    "process.env.EXPO_PUBLIC_EAS_PROJECT_ID;",
  ].join("\n"));
  return fixture;
}

function runPreflight(fixture, args = []) {
  return execFileAsync(process.execPath, ["native-validation-preflight.mjs", ...args], {
    cwd: fixture,
    env: {
      PATH: process.env.PATH,
      ALERTS_CLIENT_WRITE_ENABLED: "1",
      ALERTS_CLIENT_CAPABILITY_SECRET: "fixture-secret",
      EXPO_PUBLIC_FUEL_PATH_API_BASE_URL: "https://fuel-path.vercel.app",
      EXPO_PUBLIC_EAS_PROJECT_ID: "fixture-project",
      FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY: "fixture-maps-key",
    },
    timeout: 10_000,
  });
}

function writeFixtureFile(fixture, relativePath, contents) {
  const target = path.join(fixture, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}
