import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  evidence: path.join(root, "mobile-app/src/components/DecisionEvidencePanel.tsx"),
  planSheet: path.join(root, "mobile-app/src/components/PlanRouteSheet.tsx"),
  routeRules: path.join(root, "docs/route-recommendation-logic-rules.md"),
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, filePath]) => [key, fs.readFileSync(filePath, "utf8")]),
);

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert(
  /showCapabilityChip = capability && capability !== "live"/.test(source.evidence),
  "Why-this-stop must not repeat a Live data chip in the expanded evidence header.",
);
assert(
  /hasAppliedDiscount \?/.test(source.evidence) && /label="Pump price"/.test(source.evidence),
  "Why-this-stop must collapse Pump and Your price into Pump price when no discount is applied.",
);
assert(
  /showSavingMetric \? <EvidenceMetric label="Best price by"/.test(source.evidence),
  "Why-this-stop must suppress Best price by when the saving value is zero.",
);
assert(
  /shouldShowProviderState/.test(source.evidence) && /activeCapability && activeCapability !== "live"/.test(source.evidence),
  "Provider state should appear only for limited, fallback, stale, error or degraded states.",
);
assert(
  /detailsExpanded/.test(source.evidence) && /Source details/.test(source.evidence),
  "Source/update/provider details must be hidden behind a deeper details toggle by default.",
);
assert(
  /recommendationSavingCpl > 0\.05/.test(source.planSheet) &&
    /Saves \$\{recommendationSavingCpl\.toFixed\(1\)\} c\/L on this trip/.test(source.planSheet) &&
    /Best route value found with a/.test(source.planSheet),
  "Collapsed Plan card must suppress Best price by 0.0 c/L.",
);
assert(
  /expandedEvidenceScroll/.test(source.planSheet) && /<ScrollView[\s\S]*styles\.expandedEvidenceContent/.test(source.planSheet),
  "Expanded Plan evidence and route options must scroll inside the sheet.",
);
assert(
  /\{currentRouteSaved \? \(/.test(source.planSheet) && /<RouteFollowUpPrompt/.test(source.planSheet),
  "Expanded Plan evidence must not repeat Save this commute while the top Save action is visible.",
);
assert(
  /Best price by 0\.0 c\/L/.test(source.routeRules),
  "Route rules must explicitly forbid Best price by 0.0 c/L.",
);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: Object.keys(files) }, null, 2));
