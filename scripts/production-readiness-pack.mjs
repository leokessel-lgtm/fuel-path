#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const API_BASE = args.apiBase || process.env.FUEL_PATH_API_BASE || "https://fuel-path.vercel.app";
const RUN_ID = args.runId || new Date().toISOString().replace(/[:.]/g, "-");
const PLAN_ROUTE_PAIR_COUNT = Math.max(10, Number(args.planPairs || process.env.FUEL_PATH_PLAN_LIVE_STRESS_PAIRS || 20));
const OUTPUT_DIR = path.resolve(args.outDir || process.env.FUEL_PATH_READINESS_PACK_OUT_DIR || "tmp");

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_ENV = {
  ...process.env,
  FUEL_PATH_API_BASE: API_BASE,
};
const canaryEnv = {
  ...BASE_ENV,
  FUEL_PATH_READINESS_OUT_DIR: OUTPUT_DIR,
};
const planRouteEnv = {
  ...BASE_ENV,
  FUEL_PATH_PLAN_LIVE_STRESS_PAIRS: String(PLAN_ROUTE_PAIR_COUNT),
};

const steps = [
  { name: "provider-chaos", command: "npm", args: ["run", "test:provider-chaos"], env: BASE_ENV },
  { name: "state-fuel-provider-chaos", command: "npm", args: ["run", "test:state-fuel-chaos"], env: BASE_ENV },
  {
    name: "plan-route-live-api",
    command: "npm",
    args: ["run", "test:plan-route-live-api"],
    env: planRouteEnv,
  },
  {
    name: "production-fuel-readiness-canary",
    command: "npm",
    args: ["run", "check:production-fuel-readiness-canary"],
    env: canaryEnv,
  },
];

const stepResults = [];
for (const step of steps) {
  const result = await runStep(step);
  stepResults.push(result);
}

const failures = stepResults.filter((step) => !step.ok);
const ntStep = stepResults.find((step) => step.name === "production-fuel-readiness-canary");
const canaryPayload = ntStep?.payload || {};

const summary = {
  runId: RUN_ID,
  generatedAt: new Date().toISOString(),
  apiBase: API_BASE,
  planPairCount: PLAN_ROUTE_PAIR_COUNT,
  outputDir: OUTPUT_DIR,
  ok: failures.length === 0,
  failedSteps: failures.length,
  steps: stepResults,
  jsonPath: "",
  mdPath: "",
  failures: failures.flatMap((step) => step.failures || []),
  statusSnapshotPath: canaryPayload.statusSnapshotPath || "",
  canaryReportPath: canaryPayload.reportPath || "",
  canaryJsonPath: canaryPayload.jsonPath || "",
};

const jsonPath = path.join(OUTPUT_DIR, `production-readiness-pack-${RUN_ID}.json`);
const mdPath = path.join(OUTPUT_DIR, `production-readiness-pack-${RUN_ID}.md`);
summary.jsonPath = jsonPath;
summary.mdPath = mdPath;
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(mdPath, renderReport(summary));

console.log(JSON.stringify({ ...summary, jsonPath, mdPath }, null, 2));
if (!summary.ok) process.exit(1);

async function runStep(step) {
  const start = Date.now();
  let stdout = "";
  let stderr = "";

  const child = spawn(step.command, step.args, {
    env: step.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    const text = String(chunk);
    stdout += text;
    process.stdout.write(text);
  });
  child.stderr.on("data", (chunk) => {
    const text = String(chunk);
    stderr += text;
    process.stderr.write(text);
  });

  const payload = await new Promise((resolve) => {
    child.on("close", async (code) => {
      const parsed = extractJson(stdout);
      const failures = Array.isArray(parsed?.failures)
        ? parsed.failures
        : Array.isArray(parsed?.summary?.failures)
          ? parsed.summary.failures
          : typeof parsed === "string"
            ? [parsed]
          : [];
      const parsedOk = typeof parsed?.ok === "boolean" ? parsed.ok : true;
      resolve({
        name: step.name,
        command: `${step.command} ${step.args.join(" ")}`,
        exitCode: code,
        durationMs: Date.now() - start,
        ok: code === 0 && parsedOk,
        failures,
        payload: parsed || {},
        jsonPath: parsed?.jsonPath || "",
        reportPath: parsed?.reportPath || "",
        status: parsed?.status || (code === 0 ? "passed" : "failed"),
        stdoutTail: tailText(stdout),
        stderrTail: tailText(stderr),
      });
    });
    child.on("error", (error) => {
      resolve({
        name: step.name,
        command: `${step.command} ${step.args.join(" ")}`,
        exitCode: 1,
        durationMs: Date.now() - start,
        ok: false,
        failures: [error?.message || String(error)],
        payload: {},
        jsonPath: "",
        reportPath: "",
        status: "failed",
        stdoutTail: tailText(stdout),
        stderrTail: tailText(stderr),
      });
    });
  });

  return payload;
}

function renderReport(summary) {
  const status = summary.ok ? "PASS" : "FAIL";
  const failedNames = summary.steps.filter((item) => !item.ok).map((item) => item.name);

  const failureSummary = summary.steps
    .flatMap((step) => (step.failures || []).map((failure) => `${step.name}: ${failure}`))
    .join("\n");
  const canarySummary = failedNames.includes("production-fuel-readiness-canary")
    ? "NT canary included in the failed step list."
    : "NT canary passed its current gate checks.";

  return `# Production Readiness Pack\n\nRun: ${summary.runId}\n\n- Status: ${status}\n- API base: ${summary.apiBase}\n- Plan route live pairs: ${summary.planPairCount}\n- Output directory: ${summary.outputDir}\n- Failed steps: ${summary.failedSteps}\n\n## Inputs\n\n- Can run against apiBase: ${summary.apiBase}\n- Source snapshots combined:\n  - ${summary.statusSnapshotPath || "not available"}\n\n## Step results\n\n${summary.steps.map((step) => `- ${step.name}: ${step.ok ? "pass" : "fail"} (${step.command})`).join("\n")}\n\n${failedNames.length ? `\n## Failed steps\n\n${failedNames.map((name) => `- ${name}`).join("\n")}\n\n## Failure list\n\n${failureSummary}\n` : "\n## Failure list\n\n- none\n"}\n\n## Evidence\n\n- Production readiness pack JSON: ${summary.jsonPath || path.resolve(summary.outputDir, `production-readiness-pack-${summary.runId}.json`)}\n- Production readiness pack report: ${summary.mdPath || path.resolve(summary.outputDir, `production-readiness-pack-${summary.runId}.md`)}\n- Canary JSON: ${summary.canaryJsonPath || "none"}\n- Canary report: ${summary.canaryReportPath || "none"}\n\n## Release signal\n\n${summary.ok ? "Pass. All three stress suites and the readiness canary are healthy.\n" : `Do not release. ${canarySummary}`}\n`;
}

function extractJson(text) {
  const raw = String(text || "");
  const clean = raw.trim();
  const starts = [];
  for (let index = clean.length - 1; index >= 0; index -= 1) {
    if (clean[index] === "{") starts.push(index);
  }

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const candidate = clean.slice(start).trim();
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  const lines = clean.split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {}
  }
  return null;
}

function tailText(text) {
  const normalised = String(text || "").replace(/\s+$/g, "");
  const lines = normalised.split(/\r?\n/);
  return lines.slice(-3).join("\n");
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;

    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[camelCase(key)] = next;
      index += 1;
    } else {
      parsed[camelCase(key)] = true;
    }
  }
  return parsed;
}

function camelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
