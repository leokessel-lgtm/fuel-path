#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const RUN_ID = args.runId || new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = args.outDir || "tmp";
const loadPlanPath = args.loadPlan || latestLoadPlan();

const ORACLE_ALWAYS_FREE = {
  sourceUrl: "https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm",
  blockVolumeGb: positiveNumber(args.freeBlockStorageGb, 200),
  ampereOcpus: positiveNumber(args.ampereOcpus, 2),
  ampereMemoryGb: positiveNumber(args.ampereMemoryGb, 12),
  outboundTransferTb: positiveNumber(args.outboundTransferTb, 10),
};

const assumptions = {
  target: args.target || "oracle_always_free_compute",
  bootVolumeGb: positiveNumber(args.bootVolumeGb, 180),
  attachedBlockVolumeGb: positiveNumber(args.attachedBlockVolumeGb, 0),
  osAndPackageReserveGb: positiveNumber(args.osReserveGb, 24),
  postgresRuntimeReserveGb: positiveNumber(args.postgresReserveGb, 20),
  indexBuildWorkspaceMultiplier: positiveNumber(args.indexBuildWorkspaceMultiplier, 1.35),
  budgetAlertUsd: positiveNumber(args.budgetAlertUsd, 1),
  publicPostgresAllowed: args.publicPostgresAllowed === "1",
  paidLoadBalancerAllowed: args.paidLoadBalancerAllowed === "1",
};

if (!loadPlanPath) {
  fail({
    ok: false,
    reason: "load_plan_missing",
    message: "Run npm run plan:gnaf-hosted-load first or pass --load-plan <json>.",
  });
}

const loadPlan = readJson(loadPlanPath, "load_plan");
const review = buildReview({ loadPlan, loadPlanPath, assumptions });

await fsp.mkdir(path.join(ROOT, OUT_DIR), { recursive: true });
const jsonPath = path.join(OUT_DIR, `gnaf-hosted-storage-review-${RUN_ID}.json`);
const reportPath = path.join(OUT_DIR, `gnaf-hosted-storage-review-${RUN_ID}.md`);
await fsp.writeFile(path.join(ROOT, jsonPath), `${JSON.stringify(review, null, 2)}\n`);
await fsp.writeFile(path.join(ROOT, reportPath), renderReport(review));

console.log(JSON.stringify({
  ok: review.status === "passed",
  runId: RUN_ID,
  jsonPath,
  reportPath,
  status: review.status,
  blockers: review.blockers,
  warnings: review.warnings,
}, null, 2));

if (args.requirePassed && review.status !== "passed") process.exit(1);

function buildReview({ loadPlan, loadPlanPath, assumptions }) {
  const hostedStorageRange = loadPlan.assessment?.estimatedHostedStorageGbRange || [];
  const hostedStorageMinGb = numberOrZero(hostedStorageRange[0]);
  const hostedStorageMaxGb = numberOrZero(hostedStorageRange[1]);
  const rawZipGb = numberOrZero(loadPlan.rawZip?.sizeGb);
  const sqliteGb = numberOrZero(loadPlan.sqlite?.sizeGb);
  const provisionedBlockGb = assumptions.bootVolumeGb + assumptions.attachedBlockVolumeGb;
  const freeTierHeadroomGb = round(ORACLE_ALWAYS_FREE.blockVolumeGb - provisionedBlockGb, 1);
  const usableDiskGb = round(provisionedBlockGb - assumptions.osAndPackageReserveGb - assumptions.postgresRuntimeReserveGb, 1);
  const loadWorkingGb = round(hostedStorageMaxGb * assumptions.indexBuildWorkspaceMultiplier + rawZipGb, 1);
  const loadDiskHeadroomGb = round(usableDiskGb - loadWorkingGb, 1);
  const blockers = [];
  const warnings = [];

  if (assumptions.target !== "oracle_always_free_compute") blockers.push("unsupported_review_target");
  if (!loadPlan.rawZip?.exists) blockers.push("raw_gnaf_zip_missing");
  if (!loadPlan.sqlite?.exists) blockers.push("local_national_sqlite_missing");
  if (!loadPlan.sqlite?.nationalReady) blockers.push("local_national_sqlite_not_national_ready");
  if (!hostedStorageMaxGb) blockers.push("hosted_storage_estimate_missing");
  if (provisionedBlockGb > ORACLE_ALWAYS_FREE.blockVolumeGb) blockers.push("provisioned_storage_exceeds_oracle_always_free_limit");
  if (loadWorkingGb > usableDiskGb) blockers.push("estimated_load_workspace_exceeds_usable_disk");
  if (assumptions.budgetAlertUsd <= 0) blockers.push("budget_alert_not_required");
  if (assumptions.publicPostgresAllowed) blockers.push("public_postgres_not_allowed");
  if (assumptions.paidLoadBalancerAllowed) blockers.push("paid_load_balancer_not_allowed");
  if (freeTierHeadroomGb < 10) warnings.push("low_oracle_free_storage_headroom");
  if (loadDiskHeadroomGb < 50) warnings.push("low_load_disk_headroom");
  if (loadPlan.hosted?.checked === false) warnings.push("hosted_target_not_checked");
  if (loadPlan.hosted?.addressRows && loadPlan.hosted.addressRows < loadPlan.minAddressRows) warnings.push("hosted_target_is_staging_only");
  warnings.push("oracle_capacity_can_still_block_vm_creation");
  warnings.push("review_confirms_storage_cost_only_not_public_launch");

  const status = blockers.length ? "blocked" : "passed";
  return {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    status,
    decision: status === "passed"
      ? "storage_cost_review_confirmed_for_oracle_always_free_national_load_attempt"
      : "storage_cost_review_not_confirmed",
    blockers,
    warnings,
    sourceEvidence: {
      loadPlanPath: relativePath(loadPlanPath),
      loadPlanRunId: loadPlan.runId || "",
      oracleAlwaysFreeSource: ORACLE_ALWAYS_FREE.sourceUrl,
    },
    oracleAlwaysFree: ORACLE_ALWAYS_FREE,
    assumptions,
    estimates: {
      rawZipGb,
      localSqliteGb: sqliteGb,
      hostedStorageMinGb,
      hostedStorageMaxGb,
      provisionedBlockGb,
      freeTierHeadroomGb,
      usableDiskGb,
      loadWorkingGb,
      loadDiskHeadroomGb,
      hostedRows: numberOrZero(loadPlan.hosted?.addressRows),
      localRows: numberOrZero(loadPlan.sqlite?.count),
    },
    constraints: [
      "Use the tenancy home region only.",
      "Use resources labelled Always Free-eligible in the Oracle console.",
      "Do not create a paid load balancer.",
      "Do not expose Postgres publicly.",
      "Keep Vercel on the token-protected G-NAF API path for Oracle mode.",
      "Configure a low budget alert before loading.",
    ],
    envContract: status === "passed"
      ? {
          FUEL_PATH_GNAF_STORAGE_REVIEW_CONFIRMED: "1",
        }
      : {},
  };
}

function renderReport(review) {
  return `# Hosted G-NAF Storage and Cost Review

Run ID: ${review.runId}

## Summary

- Status: ${review.status}
- Decision: ${review.decision}
- Blockers: ${review.blockers.length ? review.blockers.join(", ") : "none"}
- Warnings: ${review.warnings.length ? review.warnings.join(", ") : "none"}
- Source load plan: ${review.sourceEvidence.loadPlanPath}
- Oracle source: ${review.sourceEvidence.oracleAlwaysFreeSource}

## Assumptions

- Target: ${review.assumptions.target}
- Boot volume: ${review.assumptions.bootVolumeGb} GB
- Attached block volume: ${review.assumptions.attachedBlockVolumeGb} GB
- Always Free block storage limit: ${review.oracleAlwaysFree.blockVolumeGb} GB
- Ampere A1 limit used for this review: ${review.oracleAlwaysFree.ampereOcpus} OCPUs / ${review.oracleAlwaysFree.ampereMemoryGb} GB RAM
- Budget alert required: USD ${review.assumptions.budgetAlertUsd}
- Public Postgres allowed: ${review.assumptions.publicPostgresAllowed ? "yes" : "no"}
- Paid load balancer allowed: ${review.assumptions.paidLoadBalancerAllowed ? "yes" : "no"}

## Disk Review

metric | value
--- | ---:
Raw G-NAF ZIP | ${review.estimates.rawZipGb} GB
Local national SQLite | ${review.estimates.localSqliteGb} GB
Estimated hosted Postgres table/index range | ${review.estimates.hostedStorageMinGb}-${review.estimates.hostedStorageMaxGb} GB
Provisioned OCI block storage | ${review.estimates.provisionedBlockGb} GB
Always Free storage headroom | ${review.estimates.freeTierHeadroomGb} GB
Usable disk after OS/Postgres reserve | ${review.estimates.usableDiskGb} GB
Estimated load workspace | ${review.estimates.loadWorkingGb} GB
Load disk headroom | ${review.estimates.loadDiskHeadroomGb} GB

## Constraints

${review.constraints.map((item) => `- ${item}`).join("\n")}

## How To Use

Pass this review to the load plan:

\`\`\`bash
npm run plan:gnaf-hosted-load -- --storage-review tmp/gnaf-hosted-storage-review-${review.runId}.json
\`\`\`

This review only confirms the storage/cost side of attempting the national hosted G-NAF load. It does not prove hosted preview, production smoke or public launch readiness.
`;
}

function latestLoadPlan() {
  const dir = path.join(ROOT, "tmp");
  if (!fs.existsSync(dir)) return "";
  const regex = /^gnaf-hosted-load-plan-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/;
  const files = fs.readdirSync(dir)
    .filter((name) => regex.test(name))
    .map((name) => path.join("tmp", name))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
  return files[0] || "";
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function relativePath(filePath) {
  return path.relative(ROOT, path.resolve(ROOT, filePath));
}

function round(value, decimals) {
  return Number(value.toFixed(decimals));
}

function fail(payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(1);
}
