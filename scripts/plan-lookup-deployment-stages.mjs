#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const RUN_ID = args.runId || new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = args.outDir || "tmp";
const releaseSummaryPath = args.releaseSummary || latestReleaseSummary();
const readinessPath = args.readiness || "";
const paidFallbackCap = positiveInteger(args.paidFallbackDailyCap || process.env.FUEL_PATH_GOOGLE_PLACES_DAILY_CAP, 0);
const requireStage = args.requireStage || "";

if (!releaseSummaryPath) {
  fail({
    ok: false,
    reason: "release_summary_missing",
    message: "Run npm run summarise:lookup-release-evidence or pass --release-summary <json>.",
  });
}

const releaseSummary = readJson(releaseSummaryPath, "release_summary");
const readiness = readinessPath ? readJson(readinessPath, "readiness") : null;
const plan = buildPlan({ releaseSummary, releaseSummaryPath, readiness, readinessPath, paidFallbackCap });

await fsp.mkdir(path.join(ROOT, OUT_DIR), { recursive: true });
const jsonPath = path.join(OUT_DIR, `lookup-deployment-stages-${RUN_ID}.json`);
const reportPath = path.join(OUT_DIR, `lookup-deployment-stages-${RUN_ID}.md`);
await fsp.writeFile(path.join(ROOT, jsonPath), `${JSON.stringify(plan, null, 2)}\n`);
await fsp.writeFile(path.join(ROOT, reportPath), renderReport(plan));

const requiredStageReady = !requireStage || plan.stages[requireStage]?.status === "ready";
console.log(JSON.stringify({
  ok: requiredStageReady,
  runId: RUN_ID,
  jsonPath,
  reportPath,
  status: plan.status,
  nextStage: plan.nextStage,
  requireStage: requireStage || "",
  blockers: plan.blockers,
}, null, 2));

if (!requiredStageReady) process.exit(1);

function buildPlan({ releaseSummary, releaseSummaryPath, readiness, readinessPath, paidFallbackCap }) {
  const gates = releaseSummary.evidence || {};
  const routeFields = gates.routeFields || {};
  const planSmoke = gates.planFieldSmoke || {};
  const gnafLoadPlan = gates.gnafLoadPlan || {};
  const hostedPreview = gates.hostedPreview || {};
  const hostedNational = gates.hostedNational || {};
  const configuredExact = gates.exactAddressReadiness?.currentConfigured || {};
  const publicReady = Boolean(releaseSummary.publicLaunchReady);
  const readinessReady = readiness ? Boolean(readiness.ok || readiness.publicExactAddressClaimsAllowed) : false;
  const paidFallback = readiness?.providerFallback || {};
  const paidFallbackEnabled = Boolean(paidFallback.billableRequestsEnabled || paidFallback.paidFallbackEnabled);
  const quotaDurable = paidFallback.quotaStorageDurable === true;
  const effectivePaidFallbackCap = positiveInteger(paidFallback.dailyCap || paidFallbackCap, 0);
  const tinyCapReady = paidFallback.tinyDailyCapReady === true || (effectivePaidFallbackCap > 0 && effectivePaidFallbackCap <= 25);
  const googlePlacesKeyRestricted = paidFallback.googlePlacesKeyRestricted === true;
  const budgetAlertConfirmed = paidFallback.budgetAlertConfirmed === true;

  const localBlockers = [];
  if (!releaseSummary.localPrecisionReady) localBlockers.push("local_precision_not_ready");
  if (routeFields.status !== "passed") localBlockers.push("route_field_stress_not_passed");
  if (planSmoke.status !== "passed") localBlockers.push("rendered_plan_field_smoke_not_passed");

  const previewBlockers = [];
  if (localBlockers.length) previewBlockers.push("local_stage_not_ready");
  if (gnafLoadPlan.status !== "passed") previewBlockers.push(...unique(gnafLoadPlan.blockers || ["hosted_gnaf_load_plan_not_ready"]));
  if (hostedPreview.status !== "passed") previewBlockers.push(...unique(hostedPreview.blockers || hostedPreview.failures || ["hosted_preview_smoke_not_passed"]));

  const productionBlockers = [];
  if (previewBlockers.length) productionBlockers.push("preview_stage_not_ready");
  if (!publicReady) productionBlockers.push(...unique(releaseSummary.blockers || ["lookup_release_summary_not_launch_ready"]));
  if (!readiness) productionBlockers.push("lookup_readiness_check_missing");
  else if (!readinessReady) productionBlockers.push(...unique(readiness.blockers || ["lookup_readiness_not_ready"]));

  const paidBlockers = [];
  if (productionBlockers.length) paidBlockers.push("production_stage_not_ready");
  if (paidFallbackEnabled && !quotaDurable) paidBlockers.push("paid_fallback_quota_storage_not_durable");
  if (paidFallbackEnabled && !tinyCapReady) paidBlockers.push("paid_fallback_tiny_daily_cap_not_confirmed");
  if (paidFallbackEnabled && !googlePlacesKeyRestricted) paidBlockers.push("paid_fallback_google_key_restriction_not_confirmed");
  if (paidFallbackEnabled && !budgetAlertConfirmed) paidBlockers.push("paid_fallback_budget_alert_not_confirmed");

  const stages = {
    local_test: stage({
      status: localBlockers.length ? "blocked" : "ready",
      blockers: localBlockers,
      evidence: [
        fileEvidence("Release summary", releaseSummaryPath),
        fileEvidence("Route-field stress", routeFields.filePath),
        fileEvidence("Rendered Plan smoke", planSmoke.filePath),
      ],
      action: localBlockers.length
        ? "Run npm run release:lookup-local with the local app available for Plan smoke, then rerun this staged plan."
        : "Local precision evidence is current enough to proceed to hosted preview work.",
    }),
    hosted_preview: stage({
      status: previewBlockers.length ? "blocked" : "ready",
      blockers: previewBlockers,
      evidence: [
        fileEvidence("Hosted G-NAF load plan", gnafLoadPlan.filePath),
        fileEvidence("Hosted preview smoke", hostedPreview.filePath),
      ],
      action: previewBlockers.length
        ? "Confirm hosted G-NAF storage/load, run hosted readiness, then run npm run test:geocode-hosted-preview -- --api-base <hosted-url>."
        : "Hosted preview smoke is ready; proceed to production smoke and national benchmark.",
    }),
    production_smoke: stage({
      status: productionBlockers.length ? "blocked" : "ready",
      blockers: productionBlockers,
      evidence: [
        fileEvidence("Lookup readiness", readinessPath),
        fileEvidence("Hosted national benchmark", hostedNational.filePath),
        fileEvidence("Configured exact-address coverage", configuredExact.filePath),
      ],
      action: productionBlockers.length
        ? "Run npm run check:lookup-readiness, hosted preview smoke and hosted national benchmark against the production candidate before public launch claims."
        : "Production exact-address claims have current hosted evidence.",
    }),
    paid_fallback: stage({
      status: paidFallbackEnabled
        ? paidBlockers.length
          ? "blocked"
          : "ready"
        : "disabled",
      blockers: paidBlockers,
      evidence: [fileEvidence("Lookup readiness", readinessPath)],
      action: paidFallbackEnabled
        ? paidBlockers.length
          ? "Keep Google fallback disabled until production smoke is ready, durable quota storage is configured and a tiny daily cap is confirmed."
          : "Paid fallback can remain enabled behind the tiny cap and budget alert."
        : "Keep paid fallback disabled. Enable only after production smoke is ready, with durable quota storage, a tiny daily cap and budget alert.",
      config: {
        paidFallbackEnabled,
        quotaDurable,
        paidFallbackCap: effectivePaidFallbackCap,
        tinyCapReady,
        googlePlacesKeyRestricted,
        budgetAlertConfirmed,
      },
    }),
  };

  const order = ["local_test", "hosted_preview", "production_smoke", "paid_fallback"];
  const nextStage = order.find((name) => stages[name].status !== "ready" && stages[name].status !== "disabled") || "paid_fallback";
  const blockers = order.flatMap((name) => stages[name].blockers.map((blocker) => `${name}:${blocker}`));
  const status = blockers.length ? "blocked" : "ready";

  return {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    status,
    nextStage,
    blockers,
    releaseSummary: {
      path: path.relative(ROOT, path.resolve(releaseSummaryPath)),
      status: releaseSummary.status || "",
      localPrecisionReady: Boolean(releaseSummary.localPrecisionReady),
      publicLaunchReady: publicReady,
    },
    readiness: readiness
      ? {
          path: path.relative(ROOT, path.resolve(readinessPath)),
          ok: readinessReady,
          status: readiness.status || "",
          publicExactAddressClaimsAllowed: Boolean(readiness.publicExactAddressClaimsAllowed),
        }
      : null,
    stages,
    launchRule: "Do not claim public exact-address precision until local_test, hosted_preview and production_smoke are ready. Keep paid fallback disabled unless durable quota storage, tiny cap and budget alert are confirmed.",
  };
}

function stage({ status, blockers = [], evidence = [], action, config }) {
  return {
    status,
    blockers: unique(blockers),
    evidence: evidence.filter((item) => item.path),
    action,
    ...(config ? { config } : {}),
  };
}

function fileEvidence(label, filePath) {
  if (!filePath) return { label, path: "" };
  return {
    label,
    path: path.relative(ROOT, path.resolve(ROOT, filePath)),
  };
}

function renderReport(plan) {
  const rows = Object.entries(plan.stages)
    .map(([name, stage]) => [
      name,
      stage.status,
      stage.blockers.length ? stage.blockers.join(", ") : "none",
      stage.action,
    ].map(markdownCell).join(" | "))
    .join("\n");
  const evidence = Object.entries(plan.stages)
    .flatMap(([name, stage]) => stage.evidence.map((item) => `- ${name}: ${item.label} - \`${item.path}\``))
    .join("\n") || "- none";

  return `# Lookup Deployment Stage Plan

Run ID: ${plan.runId}

## Summary

- Status: ${plan.status}
- Next stage: ${plan.nextStage}
- Release summary: ${plan.releaseSummary.path}
- Lookup readiness: ${plan.readiness?.path || "missing"}

## Stages

stage | status | blockers | action
--- | --- | --- | ---
${rows}

## Evidence

${evidence}

## Launch Rule

${plan.launchRule}
`;
}

function latestReleaseSummary() {
  const dir = path.join(ROOT, "tmp");
  if (!fs.existsSync(dir)) return "";
  const regex = /^lookup-release-evidence-summary-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/;
  const files = fs.readdirSync(dir)
    .filter((name) => regex.test(name))
    .map((name) => path.join("tmp", name))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
  return files[0] || "";
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(ROOT, filePath), "utf8"));
  } catch (error) {
    fail({
      ok: false,
      reason: `invalid_${label}`,
      path: filePath,
      message: error?.message || String(error),
    });
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--release-summary") {
      parsed.releaseSummary = values[index + 1] || "";
      index += 1;
    } else if (value === "--readiness") {
      parsed.readiness = values[index + 1] || "";
      index += 1;
    } else if (value === "--out-dir") {
      parsed.outDir = values[index + 1] || "";
      index += 1;
    } else if (value === "--run-id") {
      parsed.runId = values[index + 1] || "";
      index += 1;
    } else if (value === "--require-stage") {
      parsed.requireStage = values[index + 1] || "";
      index += 1;
    } else if (value === "--paid-fallback-daily-cap") {
      parsed.paidFallbackDailyCap = values[index + 1] || "";
      index += 1;
    }
  }
  return parsed;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function fail(payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(1);
}
