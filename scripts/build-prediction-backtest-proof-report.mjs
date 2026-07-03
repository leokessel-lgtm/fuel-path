import fs from "node:fs";
import path from "node:path";

const appUrl = (process.env.FUEL_PATH_PREDICTION_PROOF_URL || "https://fuel-path.vercel.app").replace(/\/$/, "");
const outputDir = path.resolve("tmp");
const docsDir = path.resolve("docs");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const reportDate = new Date().toISOString().slice(0, 10);
const regions = (process.env.FUEL_PATH_PREDICTION_PROOF_REGIONS || "NSW,ACT,VIC,QLD,WA,SA,TAS,NT")
  .split(",")
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);
const fuels = (process.env.FUEL_PATH_PREDICTION_PROOF_FUELS || "U91,PDL")
  .split(",")
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);
const requiredBlindSpots = [
  "Predictions are blocked unless durable back-test storage is configured.",
  "Directional accuracy proves only up/down/flat direction, not the exact pump price a driver will see.",
  "Station-level prices can move differently from region averages and must not be presented as guaranteed.",
  "Provider outages, stale cache, delayed official feeds or station corrections can invalidate a cycle signal.",
  "WA tomorrow locked prices are official source data, not model prediction, and should be labelled separately.",
  "Uncovered or sparse regions and fuel grades must remain outside any prediction claim.",
];

const status = await fetchJson("/api/predictions");
const signalChecks = [];
for (const region of regions) {
  for (const fuel of fuels) {
    signalChecks.push(
      await fetchJson(`/api/predictions?mode=signal&region=${encodeURIComponent(region)}&fuel=${encodeURIComponent(fuel)}&historyDays=90&observedPriceCount=300`)
        .then((payload) => ({ region, fuel, status: "ok", payload }))
        .catch((error) => ({ region, fuel, status: "failed", error: error instanceof Error ? error.message : String(error) })),
    );
  }
}

const summary = summarise(status, signalChecks);
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });
const jsonPath = path.join(outputDir, `prediction-backtest-proof-${runId}.json`);
const reportPath = path.join(docsDir, `prediction-backtest-proof-${reportDate}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, status, signalChecks }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport({ summary, status, signalChecks, jsonPath, reportDate }));
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));

if (summary.userFacingPredictionEnabled) {
  throw new Error("User-facing prediction is enabled before this proof report approved it");
}

async function fetchJson(resource) {
  const response = await fetch(`${appUrl}${resource}`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${resource} HTTP ${response.status}`);
  return response.json();
}

function summarise(statusPayload, checks) {
  const readiness = statusPayload.readiness || {};
  const summaryPayload = statusPayload.summary || {};
  return {
    runId,
    appUrl,
    regions,
    fuels,
    readinessStatus: readiness.status || "unknown",
    userFacingPredictionEnabled: Boolean(statusPayload.userFacingPredictionEnabled),
    accuracyClaimsAllowed: Boolean(statusPayload.accuracyClaimsAllowed),
    storageDurable: Boolean(statusPayload.storage?.durable),
    completedSampleSize: Number(summaryPayload.completedSampleSize || readiness.completedSampleSize || 0),
    directionSampleSize: Number(summaryPayload.directionSampleSize || readiness.directionSampleSize || 0),
    meanAbsoluteErrorCpl: numberOrNull(summaryPayload.meanAbsoluteErrorCpl ?? readiness.meanAbsoluteErrorCpl),
    directionAccuracy: numberOrNull(summaryPayload.directionAccuracy ?? readiness.directionAccuracy),
    blockers: Array.isArray(readiness.blockers) ? readiness.blockers : [],
    apiBlindSpots: Array.isArray(readiness.blindSpots) ? readiness.blindSpots : [],
    requiredBlindSpots,
    blindSpotExposure: Array.isArray(readiness.blindSpots) && readiness.blindSpots.length ? "api_exposes_blind_spots" : "api_blind_spots_missing",
    signalChecks: checks.length,
    backtestRequiredSignals: checks.filter((item) => item.payload?.signal === "backtest_required").length,
    noCycleSignals: checks.filter((item) => item.payload?.signal === "no_cycle_signal").length,
    failedSignalChecks: checks.filter((item) => item.status === "failed").length,
  };
}

function renderReport({ summary, status, signalChecks, jsonPath, reportDate }) {
  const thresholds = status.readiness?.thresholds || {};
  const rows = [
    ["Readiness", summary.readinessStatus],
    ["Public prediction enabled", summary.userFacingPredictionEnabled ? "Yes" : "No"],
    ["Accuracy claims allowed", summary.accuracyClaimsAllowed ? "Yes" : "No"],
    ["Durable storage", summary.storageDurable ? "Yes" : "No"],
    ["Completed back-tests", `${summary.completedSampleSize} / ${thresholds.completedSampleSize ?? "?"}`],
    ["Direction-labelled back-tests", `${summary.directionSampleSize} / ${thresholds.directionSampleSize ?? "?"}`],
    ["Mean absolute error", formatCpl(summary.meanAbsoluteErrorCpl, thresholds.maxMeanAbsoluteErrorCpl, "max")],
    ["Directional accuracy", formatPct(summary.directionAccuracy, thresholds.minDirectionAccuracy, "min")],
  ];
  const signalRows = signalChecks.map((item) => [
    item.region,
    item.fuel,
    item.status === "failed" ? "failed" : item.payload?.signal || "unknown",
    item.status === "failed" ? item.error : (item.payload?.reasons || []).join("; "),
  ]);
  return `# Prediction Back-Test Proof Gate

Date: ${reportDate}

Production surface: ${summary.appUrl}

Raw evidence: \`${path.relative(process.cwd(), jsonPath)}\`

## TLDR

Do not add Fuel Path prediction or cycle guidance to the user-facing product yet.

Current readiness is \`${summary.readinessStatus}\`. Public prediction is ${summary.userFacingPredictionEnabled ? "enabled" : "disabled"} and accuracy claims are ${summary.accuracyClaimsAllowed ? "allowed by the API gate" : "blocked by the API gate"}. FuelRadar has a stronger public prediction story, but Fuel Path should only copy that product shape after back-tested directional accuracy, price-error performance and blind spots are visible in this report.

## Proof Gate

| Check | Current evidence |
| --- | --- |
${rows.map((row) => `| ${row.map(escapeTable).join(" | ")} |`).join("\n")}

## Blockers

${summary.blockers.length ? summary.blockers.map((item) => `- ${item}`).join("\n") : "- No readiness blockers reported by the API gate."}

## API Blind-Spot Exposure

${summary.apiBlindSpots.length ? summary.apiBlindSpots.map((item) => `- ${item}`).join("\n") : "- No blind spots reported by the production API. Treat this as a validation failure before any prediction launch."}

## Required Blind Spots Before Any Launch

${summary.requiredBlindSpots.map((item) => `- ${item}`).join("\n")}

## National Signal Probe

This probe asks the production prediction API for the national scenario regions and U91/PDL with enough synthetic history to pass the initial history threshold. A \`backtest_required\` result is acceptable; it means the product still refuses guidance until measured records pass the proof gate.

| Region | Fuel | Signal | Reason |
| --- | --- | --- | --- |
${signalRows.map((row) => `| ${row.map(escapeTable).join(" | ")} |`).join("\n")}

## Product Rule

- Do not add prediction copy to Nearby, Plan, route alerts, saved routes or marketing pages while \`userFacingPredictionEnabled\` is false.
- Do not make accuracy claims while \`accuracyClaimsAllowed\` is false.
- Before any limited launch, rerun this report and require durable storage, enough completed back-tests, measured directional accuracy, measured mean absolute error and named blind spots.
- WA tomorrow prices must stay labelled as official locked source data, not Fuel Path prediction.
`;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function formatCpl(value, threshold, mode) {
  const current = Number.isFinite(value) ? `${Number(value).toFixed(1)} c/L` : "not measured";
  const target = Number.isFinite(Number(threshold)) ? `${mode === "max" ? "max " : ""}${Number(threshold).toFixed(1)} c/L` : "threshold unknown";
  return `${current} (${target})`;
}
function formatPct(value, threshold, mode) {
  const current = Number.isFinite(value) ? `${Math.round(Number(value) * 100)}%` : "not measured";
  const target = Number.isFinite(Number(threshold)) ? `${mode === "min" ? "min " : ""}${Math.round(Number(threshold) * 100)}%` : "threshold unknown";
  return `${current} (${target})`;
}
function escapeTable(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}
