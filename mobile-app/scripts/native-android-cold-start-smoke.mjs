#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(mobileRoot, "..");
const outputRoot = path.resolve(repoRoot, "tmp/native-smoke");
const artifactsDirs = [
  path.resolve(repoRoot, "native-artifacts"),
  path.resolve(mobileRoot, "native-artifacts"),
];
const localDebugApk = path.resolve(mobileRoot, "android/app/build/outputs/apk/debug/app-debug.apk");
const sdkRoot = findAndroidSdkRoot();
const adb = path.join(sdkRoot, "platform-tools", "adb");
const emulator = path.join(sdkRoot, "emulator", "emulator");
const avdName = process.env.FUEL_PATH_ANDROID_AVD || "Fuel_Path_Arm64_API_35";
const packageName = "com.fuelpath.app";
const activityName = "com.fuelpath.app/.MainActivity";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key.startsWith("--")) continue;
  const value = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "1";
  args.set(key, value);
}

const allowDebugArtifact = args.has("--allow-debug-artifact") || process.env.FUEL_PATH_ALLOW_DEBUG_COLD_START === "1";
const artifact = resolveInputPath(args.get("--artifact") || process.env.FUEL_PATH_NATIVE_ARTIFACT || newestApk() || (allowDebugArtifact ? localDebugApk : ""));
const runs = Number(args.get("--runs") || 5);
const settleMs = Number(args.get("--settle-ms") || 10000);
const requestedSerial = args.get("--device-serial") || process.env.FUEL_PATH_ANDROID_DEVICE_SERIAL || "";
const keepEmulator = args.has("--keep-emulator");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportMd = path.join(outputRoot, `android-cold-start-smoke-${timestamp}.md`);
let selectedSerial = requestedSerial;
let emulatorProcess;

mkdirSync(outputRoot, { recursive: true });

const lines = [
  `# Android cold-start smoke - ${new Date().toISOString()}`,
  "",
  `Artifact: \`${artifact ? path.relative(repoRoot, artifact) : "missing"}\``,
  `Package: \`${packageName}\``,
  `Activity: \`${activityName}\``,
  `Runs: ${runs}`,
  `Settle wait: ${settleMs} ms`,
  "",
];

try {
  assertFile(adb, "adb");
  assertFile(emulator, "emulator");
  if (!artifact) {
    fail("Preview or release APK artifact required. Pass --artifact <path>, set FUEL_PATH_NATIVE_ARTIFACT, or use --allow-debug-artifact only when Metro is intentionally part of the test.");
  }
  assertFile(artifact, "APK artifact");
  const device = await ensureAndroidBooted();
  lines.push(`Device: ${device.type} ${device.serial}`);
  lines.push("");
  adbCommand(["install", "-r", artifact], { maxBuffer: 16 * 1024 * 1024 });
  adbCommand(["logcat", "-c"]);

  const results = [];
  for (let run = 1; run <= runs; run += 1) {
    const started = Date.now();
    adbCommand(["shell", "am", "force-stop", packageName]);
    adbCommand(["shell", "am", "start", "-n", activityName]);
    const launchCommandMs = Date.now() - started;
    await wait(settleMs);
    const screenshot = path.join(outputRoot, `android-cold-start-smoke-${timestamp}-run-${run}.png`);
    const capture = adbSpawnSync(["exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 });
    if (capture.status !== 0 || capture.stdout.length < 1024) {
      results.push({ run, launchCommandMs, status: "failed", reason: capture.stderr?.toString() || "empty screenshot" });
      continue;
    }
    writeFileSync(screenshot, capture.stdout);
    const size = statSync(screenshot).size;
    results.push({
      run,
      launchCommandMs,
      status: size > 250000 ? "captured" : "weak",
      screenshot,
      size,
    });
  }

  const resumeResult = await captureForegroundResume(timestamp, settleMs);

  const logcat = adbCommand(["logcat", "-d", "-t", "1000"]).stdout;
  const failureLines = logcat
    .split("\n")
    .filter((line) => /\b(FATAL EXCEPTION|TypeError: undefined is not a function|Unable to load script|packager does not seem to be running|loadJSBundleFromAssets)\b/i.test(line));
  const mapWarningLines = logcat.split("\n").filter(isMapCredentialWarningLine);
  const captured = results.filter((item) => item.status === "captured").length;
  const weakCaptures = results.length - captured;
  const resumeWeak = resumeResult.status !== "captured";
  const launchDurations = results.map((item) => item.launchCommandMs).sort((a, b) => a - b);
  const p50 = percentile(launchDurations, 0.5);
  const p90 = percentile(launchDurations, 0.9);

  lines.push(`Status: ${failureLines.length ? "failed" : weakCaptures || resumeWeak || mapWarningLines.length ? "partial" : "passed"}`);
  lines.push(`Screenshot capture: ${captured}/${runs} above minimum size`);
  lines.push(`Foreground resume: ${resumeResult.status}`);
  lines.push(`Launch command p50: ${p50} ms`);
  lines.push(`Launch command p90: ${p90} ms`);
  lines.push(`Runtime failure lines: ${failureLines.length}`);
  lines.push(`Map warning lines: ${mapWarningLines.length}`);
  if (mapWarningLines.length) {
    lines.push("");
    lines.push("## Map warning lines");
    lines.push("");
    for (const line of mapWarningLines.slice(0, 20)) {
      lines.push(`- ${line.trim()}`);
    }
  }
  if (failureLines.length) {
    lines.push("");
    lines.push("## Runtime failures");
    lines.push("");
    for (const line of failureLines.slice(0, 20)) {
      lines.push(`- ${line.trim()}`);
    }
  }
  lines.push("");
  lines.push("## Screenshots");
  lines.push("");
  lines.push("| Run | Status | Launch command | Screenshot | Size |");
  lines.push("| ---: | --- | ---: | --- | ---: |");
  for (const item of results) {
    lines.push(`| ${item.run} | ${item.status} | ${item.launchCommandMs} ms | ${item.screenshot ? path.relative(repoRoot, item.screenshot) : item.reason} | ${item.size ? `${Math.round(item.size / 1024)} KB` : ""} |`);
  }
  lines.push(`| foreground resume | ${resumeResult.status} | ${resumeResult.resumeCommandMs} ms | ${resumeResult.screenshot ? path.relative(repoRoot, resumeResult.screenshot) : resumeResult.reason} | ${resumeResult.size ? `${Math.round(resumeResult.size / 1024)} KB` : ""} |`);
  lines.push("");
  lines.push("## Brutal interpretation");
  lines.push("");
  lines.push("- This proves repeated Android launch and settled screenshot capture on the selected device only.");
  lines.push("- Foreground resume proves the installed app returns from Android Home/background to a settled screenshot; it is not a deep process-death restore test.");
  lines.push("- Emulator pass is render-repeatability evidence, not performance evidence.");
  lines.push("- Any Google Maps credential warning keeps Android native readiness amber until a physical-device pass confirms real tiles and acceptable frames.");
  lines.push("");

  writeFileSync(reportMd, `${lines.join("\n")}\n`);
  console.log(reportMd);
  if (failureLines.length) process.exit(1);
} finally {
  if (emulatorProcess && !keepEmulator) {
    adbSpawnSync(["emu", "kill"], { encoding: "utf8" });
  }
}

function newestApk() {
  return artifactsDirs
    .filter((dir) => existsSync(dir))
    .flatMap((dir) => readdirSync(dir)
      .filter((name) => /^fuel-path-preview-android.*\.apk$/.test(name))
      .map((name) => path.join(dir, name)))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || "";
}

function resolveInputPath(value) {
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

async function ensureAndroidBooted() {
  let device = currentAndroidDevice();
  if (requestedSerial && !device) throw new Error(`Requested Android device ${requestedSerial} is not visible to adb.`);
  if (!device) {
    emulatorProcess = spawn(emulator, [
      "-avd",
      avdName,
      "-no-window",
      "-no-audio",
      "-no-snapshot",
      "-gpu",
      "swiftshader_indirect",
      "-no-boot-anim",
    ], { stdio: "ignore" });
    emulatorProcess.unref();
  }
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120000) {
    device = currentAndroidDevice();
    const booted = device ? adbCommand(["shell", "getprop", "sys.boot_completed"]).stdout.trim() : "";
    if (booted === "1") return device;
    await wait(2000);
  }
  throw new Error(`Android emulator ${avdName} did not boot within 120 seconds.`);
}

function currentAndroidDevice() {
  const output = command(adb, ["devices", "-l"]).stdout;
  const devices = output.split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices") && /\sdevice\s/.test(line))
    .map((line) => {
      const serial = line.split(/\s+/)[0];
      return { serial, type: serial.startsWith("emulator-") ? "emulator" : "physical", detail: line };
    });
  const device = requestedSerial ? devices.find((item) => item.serial === requestedSerial) : devices[0];
  if (device) selectedSerial = device.serial;
  return device;
}

function adbArgs(commandArgs) {
  return selectedSerial ? ["-s", selectedSerial, ...commandArgs] : commandArgs;
}

function adbCommand(commandArgs, options = {}) {
  return command(adb, adbArgs(commandArgs), options);
}

function adbSpawnSync(commandArgs, options = {}) {
  return spawnSync(adb, adbArgs(commandArgs), options);
}

async function captureForegroundResume(stamp, waitMs) {
  adbCommand(["shell", "input", "keyevent", "3"]);
  await wait(1000);
  const started = Date.now();
  adbCommand(["shell", "am", "start", "-n", activityName]);
  const resumeCommandMs = Date.now() - started;
  await wait(waitMs);
  const screenshot = path.join(outputRoot, `android-cold-start-smoke-${stamp}-foreground-resume.png`);
  const capture = adbSpawnSync(["exec-out", "screencap", "-p"], { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 });
  if (capture.status !== 0 || capture.stdout.length < 1024) {
    return {
      reason: capture.stderr?.toString() || "empty screenshot",
      resumeCommandMs,
      status: "failed",
    };
  }
  writeFileSync(screenshot, capture.stdout);
  const size = statSync(screenshot).size;
  return {
    resumeCommandMs,
    screenshot,
    size,
    status: size > 250000 ? "captured" : "weak",
  };
}

function command(binary, commandArgs, options = {}) {
  return {
    stdout: execFileSync(binary, commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }),
  };
}

function findAndroidSdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(process.env.HOME || "", "Library/Android/sdk"),
  ].filter(Boolean);
  const root = candidates.find((candidate) => existsSync(path.join(candidate, "platform-tools", "adb")));
  if (!root) throw new Error("Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT.");
  return root;
}

function assertFile(file, label) {
  if (!file || !existsSync(file)) throw new Error(`${label} not found: ${file}`);
}

function isMapCredentialWarningLine(line) {
  if (/GoogleCertificatesRslt/i.test(line) && /PhFlagUpdateRegistry|Phenotype/i.test(line)) return false;
  return /GoogleCertificatesRslt|Authorization failure|API key|ApiNotActivated|REQUEST_DENIED|Application credential header not valid|GLSUser/i.test(line);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  return values[Math.floor((values.length - 1) * ratio)];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
