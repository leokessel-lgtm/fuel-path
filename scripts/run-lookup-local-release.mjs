#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args.dryRun);
const forcedPlanSmoke = Boolean(args.planSmoke || process.env.FUEL_PATH_RUN_PLAN_FIELD_SMOKE === "1");
const skippedPlanSmoke = Boolean(args.noPlanSmoke || process.env.FUEL_PATH_RUN_PLAN_FIELD_SMOKE === "0");
const includePlanStress = Boolean(args.planStress || process.env.FUEL_PATH_RUN_PLAN_FIELD_STRESS === "1");
const includePlanRouteStress = Boolean(args.planRouteStress || process.env.FUEL_PATH_RUN_PLAN_ROUTE_STRESS === "1");
const includePlanBrowserStress = Boolean(args.planBrowserStress || process.env.FUEL_PATH_RUN_PLAN_BROWSER_STRESS === "1");
const includePlanVisualSnapshots = Boolean(args.planVisualSnapshots || process.env.FUEL_PATH_RUN_PLAN_VISUAL_SNAPSHOTS === "1");
const includePlanLiveApiStress = Boolean(args.planLiveApiStress || process.env.FUEL_PATH_RUN_PLAN_LIVE_API_STRESS === "1");
const autoPlanSmokeReachable = forcedPlanSmoke || skippedPlanSmoke
  ? false
  : await isPlanSmokeReachable();
const includePlanSmoke = forcedPlanSmoke || (!skippedPlanSmoke && autoPlanSmokeReachable);
const planSmokeMode = forcedPlanSmoke
  ? "forced"
  : includePlanSmoke
    ? "auto_reachable"
    : skippedPlanSmoke
      ? "disabled"
      : "unreachable";

const steps = [
  command("route-field stress", "npm", ["run", "test:geocode-route-fields:local"]),
  command("exact-address route-field stress", "npm", ["run", "test:geocode-route-exact-addresses:local"]),
  command("600-prefix fallback benchmark", "npm", ["run", "test:geocode-prefix-600:local"]),
  command("hosted G-NAF load plan", "npm", ["run", "plan:gnaf-hosted-load"]),
  ...(includePlanSmoke
    ? [command("rendered Plan-field smoke", "npm", ["run", "smoke:plan-fields"], { cwd: path.join(ROOT, "mobile-app") })]
    : []),
  ...(includePlanStress
    ? [command("rendered Plan-field stress", "npm", ["run", "stress:plan-fields"], { cwd: path.join(ROOT, "mobile-app") })]
    : []),
  ...(includePlanRouteStress
    ? [command("Plan route recommendation stress", "npm", ["run", "test:plan-route-recommendations:local"])]
    : []),
  ...(includePlanBrowserStress
    ? [command("Plan route browser click stress", "npm", ["run", "test:plan-route-browser-clicks"])]
    : []),
  ...(includePlanVisualSnapshots
    ? [command("Plan route visual snapshots", "npm", ["run", "test:plan-route-visual-snapshots"])]
    : []),
  ...(includePlanLiveApiStress
    ? [command("Plan route live API stress", "npm", ["run", "test:plan-route-live-api"])]
    : []),
  command("lookup release summary", "npm", ["run", "summarise:lookup-release-evidence"]),
];

if (includePlanSmoke && planSmokeMode === "auto_reachable") {
  console.log("Including rendered Plan-field smoke because the local app is reachable on port 8081.");
}
if (!includePlanSmoke) {
  const reason = planSmokeMode === "disabled"
    ? "disabled by --no-plan-smoke or FUEL_PATH_RUN_PLAN_FIELD_SMOKE=0"
    : "local app was not reachable on port 8081";
  console.log(`Skipping rendered Plan-field smoke: ${reason}. Pass --plan-smoke after starting the local Expo web app on port 8081.`);
}
if (!includePlanStress) {
  console.log("Skipping rendered Plan-field stress: optional deep check. Pass --plan-stress after starting the local Expo web app on port 8081.");
}
if (!includePlanRouteStress) {
  console.log("Skipping Plan route recommendation stress: optional deep check. Pass --plan-route-stress to include it.");
}
if (!includePlanBrowserStress) {
  console.log("Skipping Plan route browser click stress: optional deep check. Pass --plan-browser-stress to include it.");
}
if (!includePlanVisualSnapshots) {
  console.log("Skipping Plan route visual snapshots: optional visual evidence. Pass --plan-visual-snapshots to include it.");
}
if (!includePlanLiveApiStress) {
  console.log("Skipping Plan route live API stress: optional live-provider check. Pass --plan-live-api-stress to include it.");
}

for (const step of steps) {
  await runStep(step);
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  includedPlanSmoke: includePlanSmoke,
  planSmokeMode,
  includedPlanStress: includePlanStress,
  planStressMode: includePlanStress ? "forced" : "skipped",
  includedPlanRouteStress: includePlanRouteStress,
  includedPlanBrowserStress: includePlanBrowserStress,
  includedPlanVisualSnapshots: includePlanVisualSnapshots,
  includedPlanLiveApiStress: includePlanLiveApiStress,
  steps: steps.map((step) => ({
    name: step.name,
    cwd: path.relative(ROOT, step.cwd) || ".",
    command: [step.bin, ...step.args].join(" "),
  })),
}, null, 2));

function command(name, bin, commandArgs, options = {}) {
  return {
    name,
    bin,
    args: commandArgs,
    cwd: options.cwd || ROOT,
  };
}

async function runStep(step) {
  const relativeCwd = path.relative(ROOT, step.cwd) || ".";
  console.log(`\n== ${step.name} ==`);
  console.log(`cwd: ${relativeCwd}`);
  console.log(`cmd: ${[step.bin, ...step.args].join(" ")}`);

  if (dryRun) return;

  await new Promise((resolve, reject) => {
    const child = spawn(step.bin, step.args, {
      cwd: step.cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${step.name} failed with exit code ${code}`));
    });
  });
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (value === "--dry-run") parsed.dryRun = true;
    if (value === "--plan-smoke") parsed.planSmoke = true;
    if (value === "--no-plan-smoke") parsed.noPlanSmoke = true;
    if (value === "--plan-stress") parsed.planStress = true;
    if (value === "--plan-route-stress") parsed.planRouteStress = true;
    if (value === "--plan-browser-stress") parsed.planBrowserStress = true;
    if (value === "--plan-visual-snapshots") parsed.planVisualSnapshots = true;
    if (value === "--plan-live-api-stress") parsed.planLiveApiStress = true;
  }
  return parsed;
}

async function isPlanSmokeReachable() {
  const override = process.env.FUEL_PATH_PLAN_FIELD_SMOKE_REACHABLE;
  if (override === "1") return true;
  if (override === "0") return false;
  if (dryRun) return false;

  const url = process.env.FUEL_PATH_PLAN_SMOKE_URL || "http://127.0.0.1:8081/";
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
    return response.ok;
  } catch {
    return false;
  }
}
