#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");

const files = {
  planSheet: read("mobile-app/src/components/PlanRouteSheet.tsx"),
  planUtils: read("mobile-app/src/screens/PlanScreen.utils.ts"),
  planScreen: read("mobile-app/src/screens/PlanScreen.tsx"),
  evidence: read("mobile-app/src/components/DecisionEvidencePanel.tsx"),
  stationRow: read("mobile-app/src/components/StationRow.tsx"),
  nearbyEv: read("mobile-app/src/components/NearbyEvControls.tsx"),
  nearbyCombined: read("mobile-app/src/components/NearbyCombinedPanel.tsx"),
  evPolicy: read("api/_evProviderPolicy.js"),
  evApiNinjas: read("api/_evApiNinjas.js"),
  evOpenChargeMap: read("api/_evOpenChargeMap.js"),
  evOpenWebNinja: read("api/_evOpenWebNinja.js"),
  routeRules: read("docs/route-recommendation-logic-rules.md"),
};

const checks = [
  checkAbsent("Plan UI does not mention Suggested fuel stops", [files.planSheet, files.planScreen], /Suggested fuel stops/i),
  checkAbsent("Plan UI does not mention Decision trade-offs", [files.planSheet, files.evidence, files.planUtils], /Decision trade-offs/i),
  checkAbsent("Plan UI does not show Fuel used", [files.planSheet, files.evidence], /Fuel used/i),
  checkAbsent("Plan route notice does not mention standard fill estimate", [files.planUtils, files.planSheet], /standard fill estimate/i),
  checkAbsent("Plan UI does not use route saving label", [files.planSheet, files.evidence, files.planUtils], /Route saving/i),
  checkAbsent("Plan UI does not show guaranteed total dollar saving copy", [files.planSheet, files.evidence, files.planUtils], /\b(Saving|Saves)\s+\$|total saving|guaranteed saving/i),
  checkPresent("Plan recommendation uses Best price by", files.planSheet, /Best price by \{recommendationSavingCpl\.toFixed\(1\)\} c\/L/),
  checkPresent("Why-this-stop uses Best price by metric", files.evidence, /<EvidenceMetric label="Best price by"/),
  checkPresent("Why-this-stop compares next-best route option", files.evidence, /Compared with the next-best route option/),
  checkPresent("Selected Plan station hides station why line", files.planSheet, /<StationRow hideWhyLine item=\{selected\} selected onPress=\{onNavigate\} \/>/),
  checkAbsent("EV UI no stale Full list helper", [files.nearbyEv], /Browse view\. Full list for more\.|Full list/),
  checkAbsent("EV UI does not show available-now claim", [files.nearbyEv, files.nearbyCombined, files.evApiNinjas, files.evOpenChargeMap, files.evOpenWebNinja], /available now/i),
  checkAbsent("EV UI does not show unknown power as question mark", [files.nearbyEv, files.nearbyCombined], /\?\s*kW|\? kw/i),
  checkPresent("EV provider wording says live bay status unknown", `${files.evApiNinjas}\n${files.evOpenChargeMap}\n${files.evOpenWebNinja}`, /live bay status unknown/i),
  checkPresent("EV provider policy forbids live bay availability claims", files.evPolicy, /No live bay availability claims/),
  checkPresent("Logic doc requires next-best viable comparison", files.routeRules, /next-best viable route option/i),
  checkPresent("Logic doc forbids total dollar savings", files.routeRules, /Never show as a guaranteed total saving/i),
  checkPresent("Logic doc records stale price must not decide winner", files.routeRules, /Do not reject or down-rank solely because of stale price age/i),
  checkPresent("Logic doc allowed wording uses Best price by", files.routeRules, /Best price by 20\.0 c\/L/),
  checkPresent("Logic doc not-allowed wording still names retired examples", files.routeRules, /Not allowed:[\s\S]*Suggested fuel stops[\s\S]*Fuel used/),
];

const failures = checks.filter((item) => !item.passed);
const summary = {
  runId,
  checks: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  failures: failures.map((item) => item.id),
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `claim-safety-audit-stress-${runId}.json`);
const reportPath = path.join(outputDir, `claim-safety-audit-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, checks }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, checks));
for (const item of checks) console.log(`${item.passed ? "OK" : "FAIL"} ${item.id}`);
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
if (failures.length) throw new Error(`${failures.length}/${checks.length} claim-safety checks failed`);

function read(file) {
  return fs.readFileSync(path.resolve(file), "utf8");
}

function checkAbsent(id, contents, pattern) {
  const matches = contents.flatMap((content, index) => pattern.test(content) ? [`content-${index}`] : []);
  return { id, passed: matches.length === 0, kind: "absent", pattern: String(pattern), matches };
}

function checkPresent(id, content, pattern) {
  const passed = pattern.test(content);
  return { id, passed, kind: "present", pattern: String(pattern), matches: passed ? ["matched"] : [] };
}

function renderReport(summary, checks) {
  return `# Claim-safety audit stress

Run: ${summary.runId}

## Summary

- Checks: ${summary.checks}
- Passed: ${summary.passed}
- Failed: ${summary.failed}

## Failures

${checks.filter((item) => !item.passed).map((item) => `- ${item.id}: expected ${item.kind} ${item.pattern}`).join("\n") || "- None"}

## Checks

${checks.map((item) => `- ${item.passed ? "PASS" : "FAIL"}: ${item.id}`).join("\n")}

## Brutal read

${summary.failed ? "Claim-safety wording still has risky or stale text. Fix before making public savings/live-data claims." : "Claim-safety checks passed for the main Plan, EV and route-logic wording surfaces. This is a static audit, so live rendered copy should still be smoke-tested after deployment."}
`;
}
