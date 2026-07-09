#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const mobileRoot = process.cwd();
const repoRoot = path.resolve(mobileRoot, "..");
const outputRoot = path.join(repoRoot, "tmp", "native-smoke");
mkdirSync(outputRoot, { recursive: true });

const args = parseArgs();
const configuration = args.has("--debug") ? "Debug" : args.get("--configuration") || "Release";
const isDebugBuild = configuration.toLowerCase() === "debug";
const derivedDataName = isDebugBuild ? "ios-free-debug-derived-data" : "ios-free-release-derived-data";
const productDir = isDebugBuild ? "Debug-iphoneos" : "Release-iphoneos";
const deviceId = args.get("--device") || process.env.FUEL_PATH_IOS_DEVICE_ID || "";
const bundleId = args.get("--bundle-id") || "com.leokesselring.fuelpath.local";
const runs = Number(args.get("--runs") || 5);
const skipBuild = args.has("--skip-build");
const skipMemoryWarning = args.has("--skip-memory-warning");
const reuseDerivedData = args.has("--reuse-derived-data");
const consoleSeconds = Number(args.get("--console-seconds") || 10);
const generatedAt = new Date().toISOString();
const stamp = generatedAt.replace(/[:.]/g, "-");
const reportJson = path.join(outputRoot, `ipad-free-smoke-${stamp}.json`);
const reportMd = path.join(outputRoot, `ipad-free-smoke-${stamp}.md`);
const derivedDataPath = path.join(mobileRoot, "tmp", derivedDataName);
const appPath = path.join(derivedDataPath, "Build", "Products", productDir, "FuelPath.app");

const evidence = {
  generatedAt,
  status: "running",
  device: null,
  configuration,
  buildMode: isDebugBuild ? "debug_metro" : "release_embedded_js",
  bundleId,
  appPath,
  build: null,
  embeddedJs: null,
  install: null,
  launch: null,
  consoleLaunch: null,
  suspendResume: null,
  memoryWarning: null,
  relaunches: [],
  blockers: [],
};

const selectedDevice = deviceId || firstAvailableIpad();
if (!selectedDevice) {
  fail("No available paired iPad found. Connect and unlock the iPad, then keep Developer Mode enabled.");
}

evidence.device = deviceDetails(selectedDevice);
if (!evidence.device) fail(`Could not read iPad details for ${selectedDevice}.`);

if (skipBuild) {
  evidence.build = { status: "skipped", detail: "Skipped by --skip-build." };
} else {
  evidence.build = buildApp(selectedDevice);
  if (evidence.build.status !== "passed") fail(evidence.build.detail);
}

if (!existsSync(appPath)) {
  fail(`Built app was not found at ${appPath}.`);
}

evidence.embeddedJs = inspectEmbeddedJs();
if (!isDebugBuild && evidence.embeddedJs.status !== "passed") evidence.blockers.push(evidence.embeddedJs.detail);

evidence.install = installApp(selectedDevice);
if (evidence.install.status !== "passed") fail(evidence.install.detail);

evidence.launch = launchApp(selectedDevice, "ipad-free-launch", true);
if (evidence.launch.status !== "passed") fail(evidence.launch.detail);

evidence.suspendResume = suspendResume(selectedDevice, evidence.launch.pid);
if (evidence.suspendResume.status !== "passed") evidence.blockers.push(evidence.suspendResume.detail);

if (skipMemoryWarning) {
  evidence.memoryWarning = { status: "skipped", detail: "Skipped by --skip-memory-warning." };
} else {
  evidence.memoryWarning = memoryWarning(selectedDevice, evidence.launch.pid);
  if (evidence.memoryWarning.status === "failed") evidence.blockers.push(evidence.memoryWarning.detail);
}

evidence.consoleLaunch = consoleLaunch(selectedDevice);
if (evidence.consoleLaunch.status === "failed") evidence.blockers.push(evidence.consoleLaunch.detail);

for (let index = 1; index <= runs; index += 1) {
  evidence.relaunches.push(launchApp(selectedDevice, `ipad-free-relaunch-${index}`, true));
}

const failedRelaunches = evidence.relaunches.filter((item) => item.status !== "passed");
if (failedRelaunches.length) evidence.blockers.push(`${failedRelaunches.length}/${runs} relaunch cycles failed.`);

const hardFailure = evidence.build?.status === "failed"
  || evidence.install?.status === "failed"
  || evidence.launch?.status === "failed"
  || evidence.suspendResume?.status === "failed"
  || failedRelaunches.length > 0;
evidence.status = hardFailure ? "failed" : evidence.blockers.length ? "partial" : "passed";
writeReports();
console.log(reportMd);
if (hardFailure) process.exit(1);

function parseArgs() {
  const parsed = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const current = process.argv[index];
    if (!current.startsWith("--")) continue;
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed.set(current, next);
      index += 1;
    } else {
      parsed.set(current, "1");
    }
  }
  return parsed;
}

function sh(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    cwd: mobileRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function firstAvailableIpad() {
  const output = sh("xcrun", ["devicectl", "list", "devices"]);
  const line = output
    .split("\n")
    .find((item) => /available \(paired\).*iPad/i.test(item));
  if (!line) return "";
  const match = line.match(/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/i);
  return match?.[0] || "";
}

function deviceDetails(activeDeviceId) {
  try {
    const jsonPath = path.join(outputRoot, `ipad-free-device-${stamp}.json`);
    sh("xcrun", ["devicectl", "device", "info", "details", "--device", activeDeviceId, "--json-output", jsonPath]);
    const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
    const result = payload.result?.deviceProperties ? payload.result : payload.result?.device;
    const hardware = result?.hardwareProperties || {};
    const properties = result?.deviceProperties || {};
    const connection = result?.connectionProperties || {};
    return {
      identifier: activeDeviceId,
      name: properties.name || "unknown",
      model: hardware.marketingName || hardware.productType || "unknown",
      os: properties.osVersionNumber ? `iPadOS ${properties.osVersionNumber}` : "unknown",
      developerMode: properties.developerModeStatus || "unknown",
      pairing: connection.pairingState || "unknown",
      transport: connection.transportType || "unknown",
      udid: hardware.udid || "",
    };
  } catch (error) {
    return null;
  }
}

function buildApp(activeDeviceId) {
  const logPath = path.join(outputRoot, `ipad-free-build-${stamp}.log`);
  if (!reuseDerivedData) rmSync(derivedDataPath, { recursive: true, force: true });
  const result = spawnSync("xcodebuild", [
    "-workspace",
    "ios/FuelPath.xcworkspace",
    "-scheme",
    "FuelPath",
    "-configuration",
    configuration,
    "-destination",
    `id=${evidence.device?.udid || activeDeviceId}`,
    "-derivedDataPath",
    derivedDataPath,
    "-allowProvisioningUpdates",
    "CODE_SIGN_STYLE=Automatic",
    "CODE_SIGN_ENTITLEMENTS=FuelPath/FuelPath.local.entitlements",
    `PRODUCT_BUNDLE_IDENTIFIER=${bundleId}`,
    "build",
  ], { cwd: mobileRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const combined = `${result.stdout || ""}\n${result.stderr || ""}`;
  writeFileSync(logPath, combined);
  if (result.status === 0) return { status: "passed", logPath };
  return { status: "failed", detail: buildBlockerDetail(combined), logPath };
}

function inspectEmbeddedJs() {
  const bundlePath = path.join(appPath, "main.jsbundle");
  if (isDebugBuild) {
    return { status: "skipped", detail: "Debug build loads JavaScript through Metro.", bundlePath };
  }
  if (!existsSync(bundlePath)) {
    return { status: "failed", detail: `Embedded JS bundle missing at ${bundlePath}.`, bundlePath };
  }
  const size = statSync(bundlePath).size;
  if (size < 100_000) {
    return { status: "failed", detail: `Embedded JS bundle is unexpectedly small: ${size} bytes.`, bundlePath, size };
  }
  return { status: "passed", bundlePath, size };
}

function installApp(activeDeviceId) {
  try {
    const output = sh("xcrun", ["devicectl", "device", "install", "app", "--device", activeDeviceId, appPath]);
    return { status: "passed", detail: output };
  } catch (error) {
    return { status: "failed", detail: `Install failed: ${compactError(error)}` };
  }
}

function launchApp(activeDeviceId, label, terminateExisting) {
  const jsonPath = path.join(outputRoot, `${label}-${stamp}.json`);
  try {
    const commandArgs = [
      "devicectl",
      "device",
      "process",
      "launch",
      "--device",
      activeDeviceId,
      "--json-output",
      jsonPath,
    ];
    if (terminateExisting) commandArgs.push("--terminate-existing");
    commandArgs.push(bundleId);
    sh("xcrun", commandArgs);
    const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
    return {
      status: payload.info?.outcome === "success" ? "passed" : "failed",
      pid: payload.result?.process?.processIdentifier,
      evidence: jsonPath,
      detail: payload.info?.outcome || "unknown launch outcome",
    };
  } catch (error) {
    return { status: "failed", evidence: jsonPath, detail: compactError(error) };
  }
}

function consoleLaunch(activeDeviceId) {
  const logPath = path.join(outputRoot, `ipad-free-console-${stamp}.log`);
  const result = spawnSync("xcrun", [
    "devicectl",
    "device",
    "process",
    "launch",
    "--timeout",
    String(consoleSeconds),
    "--console",
    "--device",
    activeDeviceId,
    "--terminate-existing",
    bundleId,
  ], { cwd: mobileRoot, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const combined = `${result.stdout || ""}\n${result.stderr || ""}`;
  writeFileSync(logPath, combined);
  const fatalLines = combined
    .split("\n")
    .filter((line) => /\b(FATAL|Fatal|fatal error|RCTFatal|Unhandled JS Exception|TypeError:|ReferenceError:|Invariant Violation|Terminating app due to uncaught exception)\b/.test(line));
  const bundleEvaluated = /evaluateJavaScript\(\) with JS bundle|main\.jsbundle/i.test(combined);
  if (fatalLines.length) {
    return {
      status: "failed",
      detail: `Console launch found fatal output: ${fatalLines.slice(0, 2).join(" ")}`,
      logPath,
      bundleEvaluated,
      fatalLines,
    };
  }
  return {
    status: bundleEvaluated || isDebugBuild ? "passed" : "partial",
    detail: bundleEvaluated ? "Console confirms JS bundle evaluation." : "Console captured no fatal output, but did not show JS bundle evaluation.",
    logPath,
    bundleEvaluated,
    fatalLines,
  };
}

function suspendResume(activeDeviceId, pid) {
  try {
    sh("xcrun", ["devicectl", "device", "process", "suspend", "--device", activeDeviceId, "--pid", String(pid)]);
    sh("xcrun", ["devicectl", "device", "process", "resume", "--device", activeDeviceId, "--pid", String(pid)]);
    return { status: "passed", pid };
  } catch (error) {
    return { status: "failed", pid, detail: `Suspend/resume failed: ${compactError(error)}` };
  }
}

function memoryWarning(activeDeviceId, pid) {
  try {
    sh("xcrun", ["devicectl", "device", "process", "sendMemoryWarning", "--device", activeDeviceId, "--pid", String(pid)]);
    return { status: "passed", pid };
  } catch (error) {
    const detail = compactError(error);
    if (/NSPOSIXErrorDomain error 2|No such file or directory/i.test(detail)) {
      return {
        status: "unsupported",
        pid,
        detail: "CoreDevice sendMemoryWarning is unavailable for this physical-device toolchain; launch, suspend/resume and relaunch checks remain authoritative.",
      };
    }
    return { status: "failed", pid, detail: `devicectl memory warning failed: ${detail}` };
  }
}

function fail(detail) {
  evidence.status = "failed";
  evidence.blockers.push(detail);
  writeReports();
  console.error(detail);
  process.exit(1);
}

function writeReports() {
  writeFileSync(reportJson, `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(reportMd, markdown());
}

function markdown() {
  const passedRelaunches = evidence.relaunches.filter((item) => item.status === "passed").length;
  return [
    "# iPad Free-Account Native Smoke",
    "",
    `Status: ${evidence.status}`,
    `Generated: ${generatedAt}`,
    `Device: ${evidence.device?.name || "unknown"}, ${evidence.device?.model || "unknown"}, ${evidence.device?.os || "unknown"}`,
    `Mode: ${evidence.buildMode}`,
    `Configuration: ${configuration}`,
    `Bundle: ${bundleId}`,
    `App: ${appPath}`,
    "",
    "## Checks",
    "",
    `- Build: ${evidence.build?.status || "not run"}`,
    evidence.build?.logPath ? `- Build log: ${evidence.build.logPath}` : "",
    `- Embedded JS: ${evidence.embeddedJs?.status || "not run"}${evidence.embeddedJs?.size ? ` (${(evidence.embeddedJs.size / 1024).toFixed(0)} KB)` : ""}`,
    `- Install: ${evidence.install?.status || "not run"}`,
    `- Launch: ${evidence.launch?.status || "not run"}${evidence.launch?.pid ? ` (pid ${evidence.launch.pid})` : ""}`,
    `- Console launch: ${evidence.consoleLaunch?.status || "not run"}${evidence.consoleLaunch?.bundleEvaluated ? " (JS bundle evaluated)" : ""}`,
    evidence.consoleLaunch?.logPath ? `- Console log: ${evidence.consoleLaunch.logPath}` : "",
    `- Suspend/resume: ${evidence.suspendResume?.status || "not run"}`,
    `- Memory warning: ${evidence.memoryWarning?.status || "not run"}`,
    `- Relaunch cycles: ${passedRelaunches}/${evidence.relaunches.length}`,
    "",
    "## Relaunches",
    "",
    "| Cycle | Status | PID |",
    "| ---: | --- | ---: |",
    ...evidence.relaunches.map((item, index) => `| ${index + 1} | ${item.status} | ${item.pid || ""} |`),
    "",
    "## Blockers",
    "",
    ...(evidence.blockers.length ? evidence.blockers.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Notes",
    "",
    isDebugBuild
      ? "- This is a free-account local Debug build. It may require Metro to show the full app."
      : "- This is a free-account local Release build with embedded JS, so it does not require Metro to show the full app.",
    "- It does not validate APNs, TestFlight, ad hoc distribution or the production bundle ID.",
    evidence.memoryWarning?.status === "unsupported"
      ? `- Memory-warning injection is unsupported by this CoreDevice/device combination: ${evidence.memoryWarning.detail}`
      : "",
    "",
  ].filter((line) => line !== "").join("\n");
}

function compactError(error) {
  return String(error.stderr || error.message || error).replace(/\s+/g, " ").trim();
}

function buildBlockerDetail(log) {
  const usefulLines = log
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => (
      line.includes("error:")
      || line.includes("No Account for Team")
      || line.includes("No profiles for")
      || line.includes("requires a provisioning profile")
      || line.includes("Provisioning profile")
      || line.includes("Signing for")
      || line.includes("requires a development team")
      || line.includes("Push Notifications")
    ));
  if (!usefulLines.length) return "Fresh Xcode build failed. Open the saved build log for details.";
  return usefulLines.slice(0, 4).join(" ");
}
