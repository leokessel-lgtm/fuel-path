#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "..");
const artifactsDir = path.resolve(process.cwd(), "native-artifacts");
const smokeDir = path.resolve(repoRoot, "tmp/native-smoke");
const outDir = smokeDir;
const invalidEvidenceFiles = new Set([
  "ios-cold-start-smoke-2026-07-01T05-00-52.063Z.md",
  "ios-cold-start-smoke-2026-07-01T05-00-52.064Z.md",
]);

function listFiles(dir, predicate) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => path.join(dir, name))
    .filter((file) => {
      try {
        return statSync(file).isFile() && predicate(file);
      } catch {
        return false;
      }
    })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function sha256(file) {
  const hash = createHash("sha256");
  hash.update(readFileSync(file));
  return hash.digest("hex");
}

function fileRow(label, file) {
  if (!file) return `| ${label} | Missing |  |  |`;
  const stats = statSync(file);
  return `| ${label} | ${path.relative(repoRoot, file)} | ${(stats.size / 1024 / 1024).toFixed(2)} MB | ${sha256(file)} |`;
}

function latestReport(pattern) {
  return listFiles(smokeDir, (file) => pattern.test(path.basename(file)))[0];
}

function readReportSignals(file) {
  if (!file) return ["missing"];
  const text = readFileSync(file, "utf8");
  const signals = [];
  for (const line of text.split("\n")) {
    if (/^[-*]?\s*(Status|Result|Render status|Performance status|Frame summary|Map warning lines|Scenarios passed|Passed):/i.test(line.trim())) {
      signals.push(line.trim().replace(/^\-\s*/, ""));
    }
  }
  return signals.slice(0, 10);
}

const latestAndroidApks = listFiles(artifactsDir, (file) => /fuel-path-preview-android.*\.apk$/.test(path.basename(file))).slice(0, 3);
const latestIosTarballs = listFiles(artifactsDir, (file) => /fuel-path-ios-simulator.*\.tar\.gz$/.test(path.basename(file))).slice(0, 5);
const latestAndroidPhone = latestReport(/^android-preview-smoke-.*\.md$/);
const latestAndroidColdStart = latestReport(/^android-cold-start-smoke-.*\.md$/);
const latestIosValidation = latestReport(/^ios-validation-.*\.md$/);
const latestIosColdStarts = listFiles(smokeDir, (file) =>
  /^ios-cold-start-smoke-.*\.md$/.test(path.basename(file)) && !invalidEvidenceFiles.has(path.basename(file))
).slice(0, 5);

const generatedAt = new Date().toISOString();
const outFile = path.join(outDir, `native-current-evidence-audit-${generatedAt.replaceAll(":", "-")}.md`);

const lines = [
  `# Native current evidence audit - ${generatedAt}`,
  "",
  "This audit is intentionally narrow: it identifies the latest local native artefacts and the latest smoke reports so launch-readiness claims do not accidentally cite stale builds.",
  "",
  "## Latest artefacts",
  "",
  "| Item | Path | Size | SHA-256 |",
  "| --- | --- | ---: | --- |",
  ...(latestAndroidApks.length ? latestAndroidApks.map((file, index) => fileRow(`Android APK ${index + 1}`, file)) : [fileRow("Android APK", null)]),
  ...(latestIosTarballs.length ? latestIosTarballs.map((file, index) => fileRow(`iOS simulator tarball ${index + 1}`, file)) : [fileRow("iOS simulator tarball", null)]),
  "",
  "## Latest report signals",
  "",
  "### Android preview smoke",
  "",
  latestAndroidPhone ? `Report: \`${path.relative(repoRoot, latestAndroidPhone)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidPhone).map((line) => `- ${line}`),
  "",
  "### Android cold-start smoke",
  "",
  latestAndroidColdStart ? `Report: \`${path.relative(repoRoot, latestAndroidColdStart)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidColdStart).map((line) => `- ${line}`),
  "",
  "### iOS validation report",
  "",
  latestIosValidation ? `Report: \`${path.relative(repoRoot, latestIosValidation)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestIosValidation).map((line) => `- ${line}`),
  "",
  "### Recent iOS cold-start smoke reports",
  "",
  ...(latestIosColdStarts.length
    ? latestIosColdStarts.flatMap((report) => [
        `Report: \`${path.relative(repoRoot, report)}\``,
        ...readReportSignals(report).map((line) => `- ${line}`),
        "",
      ])
    : ["Report: missing", "", "- missing"]),
  "",
  "### Excluded invalid evidence",
  "",
  ...[...invalidEvidenceFiles].map((file) => `- ${file}: excluded because parallel iOS runs shared the same bundle id and screenshots were polluted.`),
  "",
  "## Brutal launch-readiness interpretation",
  "",
  "- Latest local native artefacts are discoverable and hashable.",
  "- This audit does not prove app-store readiness, notification permissions, Android physical-device performance or tablet UX quality.",
  "- If this report says a report is missing, the launch claim depending on that report is not evidence-ready.",
  "",
];

writeFileSync(outFile, `${lines.join("\n")}\n`);
console.log(outFile);
