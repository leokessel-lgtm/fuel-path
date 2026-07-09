import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDir, "..");
const repoRoot = resolve(mobileRoot, "..");
const outputRoot = resolve(repoRoot, "tmp", "native-smoke");
const reportPath = resolveInputPath(argumentValue("--report") || latestPreviewSmokeReport() || "");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outJson = join(outputRoot, `android-performance-summary-${timestamp}.json`);
const outMd = join(outputRoot, `android-performance-summary-${timestamp}.md`);

mkdirSync(outputRoot, { recursive: true });

if (!reportPath || !existsSync(reportPath)) {
  fail("Pass a smoke JSON report with --report <path>, or run native:android-performance-smoke first.");
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const blockers = performanceBlockers(report);
const summary = {
  status: blockers.length ? "blocked" : "passed",
  sourceReport: reportPath,
  artifactName: report.artifactName || "",
  device: report.device || {},
  frameSummary: report.frameSummary || {},
  mapTileSummaries: report.mapTileSummaries || [],
  blockers,
};

writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(outMd, markdown(summary));

console.log(`Android performance summary ${summary.status}: ${outMd}`);
if (blockers.length) {
  console.error(blockers.map((blocker) => `- ${blocker}`).join("\n"));
  process.exit(1);
}

function performanceBlockers(report) {
  const blockers = [];
  if (!report.device?.type) {
    blockers.push("Source report is missing physical-device metadata; rerun native:android-performance-smoke with the current smoke script.");
  } else if (report.device.type !== "physical") {
    blockers.push(`Source report is not from a physical Android device: ${report.device?.type || "unknown"} ${report.device?.serial || ""}`.trim());
  }
  if (!report.device?.serial) {
    blockers.push("Source report is missing a physical-device serial.");
  }
  if (report.device?.type === "physical" && !report.device?.detail && !report.deviceDiagnostics?.targetDeviceLine) {
    blockers.push("Source report is missing adb device detail for the physical device.");
  }
  if (!report.artifactName) {
    blockers.push("Source report is missing the installed preview APK artifact name.");
  }
  if (report.renderStatus !== "passed") {
    blockers.push(`Render smoke did not pass: ${report.renderStatus || report.status || "unknown"}.`);
  }
  if (report.performanceStatus !== "passed") {
    blockers.push(`Performance smoke did not pass: ${report.performanceStatus || report.status || "unknown"}.`);
  }
  if (Array.isArray(report.failureLines) && report.failureLines.length) {
    blockers.push(`Runtime failure lines were captured: ${report.failureLines.length}.`);
  }
  if (Array.isArray(report.mapWarningLines) && report.mapWarningLines.length) {
    blockers.push(`Google Maps warning lines were captured: ${report.mapWarningLines.length}.`);
  }
  const blankMaps = (report.mapTileSummaries || []).filter((summary) => summary.blankMapLikely);
  const missingScreenshotFiles = (report.mapTileSummaries || []).filter((summary) =>
    !screenshotEvidenceExists(summary.screenshot, reportPath)
  );
  const requiredMapScreens = ["plan", "nearby", "nearby-after-pan"];
  const mapScreenshotNames = (report.mapTileSummaries || []).map((summary) => basename(summary.screenshot || ""));
  const missingMapScreens = requiredMapScreens.filter(
    (screen) => !mapScreenshotNames.some((name) => name.endsWith(`-${screen}.png`)),
  );
  if ((report.mapTileSummaries || []).length < requiredMapScreens.length || missingMapScreens.length) {
    blockers.push(
      `Physical-device map evidence is incomplete; missing ${missingMapScreens.length ? missingMapScreens.join(", ") : "required map captures"}.`,
    );
  }
  if (blankMaps.length) {
    blockers.push(`Blank map tiles were detected in ${blankMaps.length}/${report.mapTileSummaries.length} map screenshots.`);
  }
  if (missingScreenshotFiles.length) {
    blockers.push(`Physical-device map screenshot files are missing: ${missingScreenshotFiles.length}.`);
  }
  if ((report.attentionItems || []).length) {
    blockers.push(`Smoke report still has attention items: ${report.attentionItems.length}.`);
  }
  if ((report.frameSummary?.totalFrames || 0) < 30) {
    blockers.push(`Frame evidence is insufficient for a performance claim: ${report.frameSummary?.totalFrames || 0} rendered frames captured.`);
  } else if ((report.frameSummary?.jankyPercent || 0) > 20) {
    blockers.push(`Frame jank is above claim threshold: ${report.frameSummary.jankyPercent}%.`);
  }
  if ((report.frameSummary?.totalFrames || 0) >= 30 && (report.frameSummary?.percentile95Ms || 0) > 80) {
    blockers.push(`Frame p95 is above claim threshold: ${report.frameSummary.percentile95Ms} ms.`);
  }
  return blockers;
}

function screenshotEvidenceExists(filePath, sourceReportPath = "") {
  const text = String(filePath || "").trim();
  if (!text) return false;
  const candidates = [
    resolve(text),
    sourceReportPath ? resolve(sourceReportPath, "..", text) : "",
  ].filter(Boolean);
  return candidates.some((candidate) => existsSync(candidate));
}

function markdown(summary) {
  return [
    "# Android Physical Performance Summary",
    "",
    `Status: ${summary.status}`,
    `Source report: ${summary.sourceReport}`,
    `Artifact: ${summary.artifactName || "unknown"}`,
    `Device: ${summary.device.type || "unknown"} ${summary.device.serial || "unknown"}`,
    "",
    "## Frame Summary",
    "",
    `- Total frames: ${summary.frameSummary.totalFrames ?? "unknown"}`,
    `- Janky frames: ${summary.frameSummary.jankyFrames ?? "unknown"}`,
    `- Janky percent: ${summary.frameSummary.jankyPercent ?? "unknown"}%`,
    `- p95: ${summary.frameSummary.percentile95Ms ?? "unknown"} ms`,
    "",
    "## Map Screens",
    "",
    ...(summary.mapTileSummaries.length
      ? summary.mapTileSummaries.map(
          (item) => `- ${basename(item.screenshot || "unknown")}: blank=${item.blankMapLikely}, colour=${item.colourRatio}, buckets=${item.detailBuckets}`,
        )
      : ["- None"]),
    "",
    "## Blockers",
    "",
    ...(summary.blockers.length ? summary.blockers.map((item) => `- ${item}`) : ["- None"]),
    "",
  ].join("\n");
}

function latestPreviewSmokeReport() {
  if (!existsSync(outputRoot)) return "";
  return readdirSync(outputRoot)
    .filter((file) => /^android-preview-smoke-.+\.json$/.test(file))
    .map((file) => join(outputRoot, file))
    .sort()
    .at(-1) || "";
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function resolveInputPath(value) {
  if (!value) return "";
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
