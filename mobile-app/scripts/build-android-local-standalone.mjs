#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDir, "..");
const repoRoot = resolve(mobileRoot, "..");
const androidRoot = resolve(mobileRoot, "android");
const artifactsDir = resolve(mobileRoot, "native-artifacts");
const args = new Set(process.argv.slice(2));
const architecture = args.has("--all-architectures") ? "" : "arm64-v8a";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const architectureLabel = architecture || "universal";
const outputName = `fuel-path-local-standalone-${architectureLabel}-${timestamp}.apk`;
const outputPath = resolve(artifactsDir, outputName);
const releaseApk = resolve(androidRoot, "app/build/outputs/apk/release/app-release.apk");
const env = {
  ...process.env,
};

loadEnvFile(resolve(repoRoot, ".env.local"), env);
loadEnvFile(resolve(mobileRoot, ".env.local"), env);

if (!env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL) {
  env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL = "https://fuel-path.vercel.app";
}

if (!env.FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY) {
  fail("FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY is required for Android standalone map validation.");
}

if (!env.JAVA_HOME) {
  const androidStudioJavaHome = "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
  if (existsSync(androidStudioJavaHome)) env.JAVA_HOME = androidStudioJavaHome;
}

if (!env.ANDROID_HOME) {
  const androidSdkRoot = join(env.HOME || "", "Library/Android/sdk");
  if (existsSync(androidSdkRoot)) env.ANDROID_HOME = androidSdkRoot;
}
if (!env.ANDROID_SDK_ROOT && env.ANDROID_HOME) {
  env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
}

env.PATH = [
  env.JAVA_HOME ? join(env.JAVA_HOME, "bin") : "",
  env.ANDROID_HOME ? join(env.ANDROID_HOME, "platform-tools") : "",
  env.PATH || "",
].filter(Boolean).join(":");

mkdirSync(artifactsDir, { recursive: true });

const gradleArgs = [
  "assembleRelease",
  ...(architecture ? [`-PreactNativeArchitectures=${architecture}`] : []),
];

execFileSync("./gradlew", gradleArgs, {
  cwd: androidRoot,
  env,
  stdio: "inherit",
});

if (!existsSync(releaseApk)) {
  fail(`Release APK was not created at ${releaseApk}`);
}

copyFileSync(releaseApk, outputPath);

const sizeMb = statSync(outputPath).size / 1024 / 1024;
const sha256 = createHash("sha256").update(readFileSync(outputPath)).digest("hex");

console.log(`Android local standalone APK: ${relative(outputPath)}`);
console.log(`Architecture: ${architecture || "all configured architectures"}`);
console.log(`Size: ${sizeMb.toFixed(2)} MB`);
console.log(`SHA-256: ${sha256}`);
console.log("Signing: local debug signing config for validation only, not store release signing.");

function loadEnvFile(path, target) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    if (!key || target[key]) continue;
    target[key] = unquote(line.slice(index + 1).trim());
  }
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function relative(path) {
  return `${basename(repoRoot)}/${path.replace(`${repoRoot}/`, "")}`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
