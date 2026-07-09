#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const smokeDir = resolve(repoRoot, "tmp/native-smoke");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = join(smokeDir, `android-performance-coverage-${timestamp}.md`);
const requireBroad = process.argv.includes("--require-broad");
const highEndModelPatterns = [
  /pixel[_\s-]?9/i,
  /pixel[_\s-]?8[_\s-]?pro/i,
  /galaxy[_\s-]?s2[4-9]/i,
  /galaxy[_\s-]?z/i,
];

mkdirSync(smokeDir, { recursive: true });

const reports = latestPhysicalPerformanceReports();
const distinctModels = distinctBy(reports, (report) => report.modelKey);
const nonHighEndModels = distinctModels.filter((report) => !report.highEndLikely);
const status = !reports.length
  ? "blocked_no_physical_evidence"
  : nonHighEndModels.length
    ? "broad_candidate"
    : "controlled_beta_only";
const failed = requireBroad && status !== "broad_candidate";

const lines = [
  `# Android Performance Coverage - ${new Date().toISOString()}`,
  "",
  `Status: ${failed ? "failed" : status}`,
  "",
  "| Report | Device | Model class | Frames | Jank | p95 |",
  "| --- | --- | --- | ---: | ---: | ---: |",
  ...(reports.length
    ? reports.map((report) => [
        basename(report.path),
        report.modelLabel,
        report.highEndLikely ? "high-end" : "not marked high-end",
        report.frameSummary.totalFrames ?? "",
        `${report.frameSummary.jankyPercent ?? ""}%`,
        `${report.frameSummary.percentile95Ms ?? ""} ms`,
      ].map(escapeTable).join(" | ")).map((row) => `| ${row} |`)
    : ["| Missing | Missing | Missing |  |  |  |"]),
  "",
  "## Interpretation",
  "",
  "- Pixel 9 Pro or equivalent evidence is valid for controlled beta performance only.",
  "- Broad Android performance claims need at least one current passing physical run from a lower or mid-range Android class.",
  "- Use `--require-broad` in a release gate that must block until broader device coverage exists.",
  "",
];

writeFileSync(reportPath, `${lines.join("\n")}\n`);
console.log(`Android performance coverage ${failed ? "failed" : status}: ${reportPath}`);
if (failed) process.exit(1);

function latestPhysicalPerformanceReports() {
  if (!existsSync(smokeDir)) return [];
  return readdirSync(smokeDir)
    .filter((file) => /^android-preview-smoke-.+\.json$/.test(file))
    .map((file) => join(smokeDir, file))
    .map(readSmokeReport)
    .filter(Boolean)
    .filter((report) =>
      report.device?.type === "physical" &&
      report.renderStatus === "passed" &&
      report.performanceStatus === "passed" &&
      (report.frameSummary?.totalFrames || 0) >= 30
    )
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 8)
    .map((report) => ({
      ...report,
      modelLabel: androidModelLabel(report),
      modelKey: androidModelLabel(report).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      highEndLikely: highEndModelPatterns.some((pattern) => pattern.test(androidModelLabel(report))),
    }));
}

function readSmokeReport(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return { ...parsed, path, mtimeMs: statSync(path).mtimeMs };
  } catch {
    return null;
  }
}

function androidModelLabel(report) {
  const detail = report.deviceDiagnostics?.targetDeviceLine || report.device?.detail || "";
  const model = String(detail).match(/\bmodel:([^\s]+)/)?.[1];
  if (model) return model.replaceAll("_", " ");
  return report.device?.serial || "unknown physical Android";
}

function distinctBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|");
}
