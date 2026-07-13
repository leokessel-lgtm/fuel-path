#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(mobileRoot, "..");
const artifactsDirs = [
  path.resolve(repoRoot, "native-artifacts"),
  path.resolve(mobileRoot, "native-artifacts"),
];
const localDebugApk = path.resolve(mobileRoot, "android/app/build/outputs/apk/debug/app-debug.apk");
const smokeDirs = [
  path.resolve(repoRoot, "tmp/native-smoke"),
  path.resolve(mobileRoot, "tmp/native-smoke"),
];
const outDir = smokeDirs[0];
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

function listFilesAcross(dirs, predicate) {
  return dirs
    .flatMap((dir) => listFiles(dir, predicate))
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
  return listFilesAcross(smokeDirs, (file) => pattern.test(path.basename(file)))[0];
}

function latestReportAny(patterns) {
  return listFilesAcross(smokeDirs, (file) => patterns.some((pattern) => pattern.test(path.basename(file))))[0];
}

function latestReportWhere(pattern, matcher) {
  return listFilesAcross(smokeDirs, (file) => pattern.test(path.basename(file)))
    .find((file) => {
      try {
        return matcher(readFileSync(file, "utf8"), file);
      } catch {
        return false;
      }
    });
}

function readReportSignals(file) {
  if (!file) return ["missing"];
  const text = readFileSync(file, "utf8");
  if (path.extname(file).toLowerCase() === ".json") {
    try {
      const json = JSON.parse(text);
      const signals = [];
      if (json.status) signals.push(`Status: ${json.status}`);
      if (Array.isArray(json.checks)) {
        const passed = json.checks.filter((check) => check.status === "passed").length;
        const failed = json.checks.filter((check) => check.status === "failed").length;
        signals.push(`Checks: ${passed} passed, ${failed} failed`);
      }
      return signals.length ? signals.slice(0, 10) : ["JSON report present"];
    } catch {
      return ["JSON report present, but could not be parsed"];
    }
  }
  const signals = [];
  for (const line of text.split("\n")) {
    if (/^[-*]?\s*(Status|Result|Render status|Performance status|Frame summary|Map warning lines|Scenarios passed|Passed):/i.test(line.trim())) {
      signals.push(line.trim().replace(/^\-\s*/, ""));
    }
  }
  return signals.slice(0, 10);
}

mkdirSync(outDir, { recursive: true });

const latestAndroidApks = listFilesAcross(artifactsDirs, (file) => /fuel-path-preview-android.*\.apk$/.test(path.basename(file))).slice(0, 3);
const latestAndroidStandaloneApks = listFilesAcross(artifactsDirs, (file) => /fuel-path-local-standalone.*\.apk$/.test(path.basename(file))).slice(0, 3);
const latestAndroidDebugApks = existsSync(localDebugApk) ? [localDebugApk] : [];
const latestIosTarballs = listFilesAcross(artifactsDirs, (file) => /fuel-path-ios-simulator.*\.tar\.gz$/.test(path.basename(file))).slice(0, 5);
const latestAndroidPhysicalPreview = latestReportWhere(/^android-preview-smoke-.*\.md$/, (text) => /Device:\s+physical\b/i.test(text));
const latestAndroidPhysicalPerformancePass = latestReportWhere(/^android-preview-smoke-.*\.md$/, (text) =>
  /Device:\s+physical\b/i.test(text) && /^Status:\s+passed\b/im.test(text)
);
const latestAndroidEmulatorPreview = latestReportWhere(/^android-preview-smoke-.*\.md$/, (text) => /Device:\s+emulator\b/i.test(text));
const latestAndroidPhone = latestAndroidPhysicalPreview || latestReport(/^android-preview-smoke-.*\.md$/);
const latestAndroidColdStart = latestReport(/^android-cold-start-smoke-.*\.md$/);
const latestAndroidPerformanceCoverage = latestReport(/^android-performance-coverage-.*\.md$/);
const latestAndroidNotificationReadiness = latestReport(/^android-notification-readiness-.*\.md$/);
const latestAndroidAlertSync = latestReportWhere(/^android-alert-sync-smoke-.*\.md$/, (text) =>
  /account-free Android route-watch backend contract/i.test(text) &&
  !/^API base URL:\s*https:\/\/fuel-path\.vercel\.app\/?\s*$/im.test(text)
);
const latestExcludedProductionAlertSync = latestReportWhere(/^android-alert-sync-smoke-.*\.md$/, (text) =>
  /^API base URL:\s*https:\/\/fuel-path\.vercel\.app\/?\s*$/im.test(text)
);
const latestAndroidAlertDeliveryGate = latestReport(/^android-alert-delivery-gate-.*\.md$/);
const latestAndroidNavigationIntents = latestReport(/^android-navigation-intents-.*\.md$/);
const latestRouteNotificationScheduleStress = latestReport(/^route-notification-schedule-stress-.*\.json$/);
const latestAndroidEvRouteScreenshot = latestReportAny([
  /^fuelpath-ev-route-pins-final-.*\.png$/,
  /^fuelpath-ev-route-pins-framed-.*\.png$/,
  /^android-pixel-ev-route-result-.*\.png$/,
]);
const latestAndroidEvRouteXml = latestReportAny([
  /^fuelpath-ev-route-pins-final-.*\.xml$/,
  /^fuelpath-ev-route-pins-framed-.*\.xml$/,
  /^android-pixel-ev-route-result-.*\.xml$/,
]);
const latestIosValidation = latestReport(/^ios-validation-.*\.md$/);
const latestIosColdStarts = listFilesAcross(smokeDirs, (file) =>
  /^ios-cold-start-smoke-.*\.md$/.test(path.basename(file)) && !invalidEvidenceFiles.has(path.basename(file))
).slice(0, 5);

const generatedAt = new Date().toISOString();
const outFile = path.join(outDir, `native-current-evidence-audit-${generatedAt.replaceAll(":", "-")}.md`);
const artefactInterpretation = latestAndroidApks.length || latestAndroidStandaloneApks.length || latestIosTarballs.length
  ? "- Latest local standalone, preview or simulator native artefacts are discoverable and hashable."
  : latestAndroidDebugApks.length
    ? "- A local Android debug APK is discoverable and hashable, but no preview APK or iOS simulator tarball is present; release/build-artifact claims still need a fresh preview or simulator artefact."
    : "- No local native APK or iOS simulator tarball artefact is currently discoverable; any build-artifact claim still needs a fresh artefact.";

const lines = [
  `# Native current evidence audit - ${generatedAt}`,
  "",
  "This audit is intentionally narrow: it identifies the latest local native artefacts and the latest smoke reports so launch-readiness claims do not accidentally cite stale builds.",
  "",
  "## Latest artefacts",
  "",
  "| Item | Path | Size | SHA-256 |",
  "| --- | --- | ---: | --- |",
  ...(latestAndroidApks.length ? latestAndroidApks.map((file, index) => fileRow(`Android preview APK ${index + 1}`, file)) : [fileRow("Android preview APK", null)]),
  ...(latestAndroidStandaloneApks.length ? latestAndroidStandaloneApks.map((file, index) => fileRow(`Android local standalone APK ${index + 1}`, file)) : [fileRow("Android local standalone APK", null)]),
  ...(latestAndroidDebugApks.length ? latestAndroidDebugApks.map((file) => fileRow("Android debug APK", file)) : [fileRow("Android debug APK", null)]),
  ...(latestIosTarballs.length ? latestIosTarballs.map((file, index) => fileRow(`iOS simulator tarball ${index + 1}`, file)) : [fileRow("iOS simulator tarball", null)]),
  "",
  "## Latest report signals",
  "",
  "### Android physical preview smoke",
  "",
  latestAndroidPhone ? `Report: \`${path.relative(repoRoot, latestAndroidPhone)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidPhone).map((line) => `- ${line}`),
  "",
  "### Android physical performance-pass preview smoke",
  "",
  latestAndroidPhysicalPerformancePass ? `Report: \`${path.relative(repoRoot, latestAndroidPhysicalPerformancePass)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidPhysicalPerformancePass).map((line) => `- ${line}`),
  "",
  "### Android emulator preview smoke",
  "",
  latestAndroidEmulatorPreview ? `Report: \`${path.relative(repoRoot, latestAndroidEmulatorPreview)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidEmulatorPreview).map((line) => `- ${line}`),
  "",
  "### Android cold-start smoke",
  "",
  latestAndroidColdStart ? `Report: \`${path.relative(repoRoot, latestAndroidColdStart)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidColdStart).map((line) => `- ${line}`),
  "",
  "### Android performance coverage",
  "",
  latestAndroidPerformanceCoverage ? `Report: \`${path.relative(repoRoot, latestAndroidPerformanceCoverage)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidPerformanceCoverage).map((line) => `- ${line}`),
  "",
  "### Android notification readiness",
  "",
  latestAndroidNotificationReadiness ? `Report: \`${path.relative(repoRoot, latestAndroidNotificationReadiness)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidNotificationReadiness).map((line) => `- ${line}`),
  "",
  "### Android route-watch backend sync smoke",
  "",
  latestAndroidAlertSync ? `Report: \`${path.relative(repoRoot, latestAndroidAlertSync)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidAlertSync).map((line) => `- ${line}`),
  ...(latestExcludedProductionAlertSync ? [
    "",
    `- Excluded Production/PR #29 report: \`${path.relative(repoRoot, latestExcludedProductionAlertSync)}\`. It does not validate PR #30's account-free Preview contract.`,
  ] : []),
  "",
  "### Android alert delivery gate",
  "",
  latestAndroidAlertDeliveryGate ? `Report: \`${path.relative(repoRoot, latestAndroidAlertDeliveryGate)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidAlertDeliveryGate).map((line) => `- ${line}`),
  "",
  "### Android navigation intents",
  "",
  latestAndroidNavigationIntents ? `Report: \`${path.relative(repoRoot, latestAndroidNavigationIntents)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestAndroidNavigationIntents).map((line) => `- ${line}`),
  "",
  "### Android route-notification schedule stress",
  "",
  latestRouteNotificationScheduleStress ? `Report: \`${path.relative(repoRoot, latestRouteNotificationScheduleStress)}\`` : "Report: missing",
  "",
  ...readReportSignals(latestRouteNotificationScheduleStress).map((line) => `- ${line}`),
  "",
  "### Android EV Plan route evidence",
  "",
  latestAndroidEvRouteScreenshot ? `Screenshot: \`${path.relative(repoRoot, latestAndroidEvRouteScreenshot)}\`` : "Screenshot: missing",
  latestAndroidEvRouteXml ? `Accessibility dump: \`${path.relative(repoRoot, latestAndroidEvRouteXml)}\`` : "Accessibility dump: missing",
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
  artefactInterpretation,
  "- Source guards, typecheck and native parity scripts still need to be run for the current checkout before making code-quality claims; this report indexes evidence artefacts rather than executing every guard.",
  "- Android notification readiness and route-watch backend sync evidence are separate from real delivered push-notification evidence.",
  "- Production-targeted alert sync reports do not satisfy the account-free PR #30 Preview lane.",
  "- Android route schedule stress and EV route screenshots are now indexed when present, but they are still separate from lower-end Android performance and delivered push evidence.",
  "- This audit does not prove app-store readiness, delivered notifications, Android tablet UX quality or lower-end Android performance.",
  "- If this report says a report is missing, the launch claim depending on that report is not evidence-ready.",
  "",
];

writeFileSync(outFile, `${lines.join("\n")}\n`);
console.log(outFile);
