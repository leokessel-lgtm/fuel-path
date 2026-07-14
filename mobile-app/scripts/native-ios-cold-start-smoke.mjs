#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "..");
const artifactsDir = path.resolve(process.cwd(), "native-artifacts");
const smokeDir = path.resolve(repoRoot, "tmp/native-smoke");
mkdirSync(smokeDir, { recursive: true });

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const current = process.argv[i];
  if (current.startsWith("--")) {
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(current, next);
      i += 1;
    } else {
      args.set(current, "1");
    }
  }
}

const bundleId = args.get("--bundle-id") || "com.fuelpath.app";
const requestedDevice = args.get("--device") || args.get("--udid") || process.env.FUEL_PATH_IOS_DEVICE_UDID || "";
const runs = Number(args.get("--runs") || 3);
const settleMs = Number(args.get("--settle-ms") || 12000);

function sh(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
}

function newestAppBundle() {
  const candidates = [];
  if (!existsSync(artifactsDir)) return null;
  for (const name of readdirSync(artifactsDir)) {
    const candidate = path.join(artifactsDir, name, "FuelPath.app");
    if (existsSync(candidate)) candidates.push(candidate);
  }
  return candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || null;
}

function bootedDevice() {
  const json = JSON.parse(sh("xcrun", ["simctl", "list", "devices", "booted", "--json"]));
  const allBooted = [];
  for (const devices of Object.values(json.devices || {})) {
    allBooted.push(...devices.filter((device) => device.state === "Booted"));
  }
  if (requestedDevice) {
    return allBooted.find((device) =>
      device.udid === requestedDevice || device.name.toLowerCase() === requestedDevice.toLowerCase()
    ) || null;
  }
  return allBooted[0] || null;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const appBundle = args.get("--app") || newestAppBundle();
const generatedAt = new Date().toISOString();
const safeStamp = generatedAt.replaceAll(":", "-");
const requestedDeviceSlug = (requestedDevice || "auto")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 48) || "auto";
// Include both the requested target and process id so parallel simulator jobs
// can never overwrite one another when they start in the same millisecond.
const evidenceStem = `ios-cold-start-smoke-${safeStamp}-${requestedDeviceSlug}-${process.pid}`;
const report = path.join(smokeDir, `${evidenceStem}.md`);

const lines = [
  `# iOS cold-start smoke - ${generatedAt}`,
  "",
  `Bundle id: \`${bundleId}\``,
  `App bundle: \`${appBundle ? path.relative(repoRoot, appBundle) : "missing"}\``,
  `Requested device: \`${requestedDevice || "first booted"}\``,
  `Runs: ${runs}`,
  `Settle wait: ${settleMs} ms`,
  "",
];

if (!appBundle || !existsSync(appBundle)) {
  lines.push("Status: failed", "", "Reason: iOS simulator app bundle was not found.");
  writeFileSync(report, `${lines.join("\n")}\n`);
  console.log(report);
  process.exit(1);
}

let device;
try {
  device = bootedDevice();
} catch (error) {
  lines.push("Status: failed", "", `Reason: could not inspect booted simulators: ${error.message}`);
  writeFileSync(report, `${lines.join("\n")}\n`);
  console.log(report);
  process.exit(1);
}

if (!device) {
  lines.push("Status: failed", "", `Reason: no matching booted iOS simulator found${requestedDevice ? ` for ${requestedDevice}` : ""}.`);
  writeFileSync(report, `${lines.join("\n")}\n`);
  console.log(report);
  process.exit(1);
}

lines.push(`Device: ${device.name} (${device.udid})`, "");

try {
  sh("xcrun", ["simctl", "install", device.udid, appBundle]);
} catch (error) {
  lines.push("Status: failed", "", `Reason: install failed: ${error.stderr || error.message}`);
  writeFileSync(report, `${lines.join("\n")}\n`);
  console.log(report);
  process.exit(1);
}

const screenshots = [];
const launchDurations = [];
let failures = 0;

for (let run = 1; run <= runs; run += 1) {
  try {
    spawnSync("xcrun", ["simctl", "terminate", device.udid, bundleId], { stdio: "ignore" });
    const start = Date.now();
    sh("xcrun", ["simctl", "launch", device.udid, bundleId]);
    const launchMs = Date.now() - start;
    launchDurations.push(launchMs);
    sleep(settleMs);
    const screenshot = path.join(smokeDir, `${evidenceStem}-run-${run}.png`);
    sh("xcrun", ["simctl", "io", device.udid, "screenshot", screenshot]);
    const size = statSync(screenshot).size;
    screenshots.push({ run, screenshot, size, launchMs });
    if (size < 250000) failures += 1;
  } catch (error) {
    failures += 1;
    screenshots.push({ run, error: error.stderr || error.message });
  }
}

const sortedDurations = [...launchDurations].sort((a, b) => a - b);
const p50 = sortedDurations[Math.floor((sortedDurations.length - 1) * 0.5)] || 0;
const p90 = sortedDurations[Math.floor((sortedDurations.length - 1) * 0.9)] || 0;

lines.push(`Status: ${failures === 0 ? "passed" : "partial"}`);
lines.push(`Result: ${runs - failures}/${runs} settled screenshots above minimum size`);
lines.push(`Launch command p50: ${p50} ms`);
lines.push(`Launch command p90: ${p90} ms`);
lines.push("");
lines.push("## Screenshots");
lines.push("");
lines.push("| Run | Launch command | Screenshot | Size |");
lines.push("| ---: | ---: | --- | ---: |");
for (const item of screenshots) {
  if (item.error) {
    lines.push(`| ${item.run} | failed | ${item.error.replace(/\s+/g, " ").slice(0, 100)} |  |`);
  } else {
    lines.push(`| ${item.run} | ${item.launchMs} ms | ${path.relative(repoRoot, item.screenshot)} | ${(item.size / 1024).toFixed(0)} KB |`);
  }
}
lines.push("");
lines.push("## Brutal interpretation");
lines.push("");
lines.push("- This proves repeated signed-simulator launch and settled screenshot capture, not real-device performance.");
lines.push("- Screenshot size is a blunt proxy only. Visual inspection is still required before claiming map-tile quality.");
lines.push("- If Apple map tiles are slow on the first run but settled by later runs, treat it as a perceived-performance watch item, not a correctness failure.");
lines.push("");

writeFileSync(report, `${lines.join("\n")}\n`);
console.log(report);
