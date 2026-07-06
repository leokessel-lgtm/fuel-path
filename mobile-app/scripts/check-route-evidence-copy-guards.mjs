import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..");

const files = {
  helper: path.join(root, "src/utils/routeEvidenceCopy.ts"),
  sheet: path.join(root, "src/components/PlanRouteSheet.tsx"),
  evidence: path.join(root, "src/components/DecisionEvidencePanel.tsx"),
  mapper: path.join(root, "src/screens/PlanScreen.utils.ts"),
  doc: path.join(repoRoot, "docs/route-recommendation-logic-rules.md"),
};

const text = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")]),
);

const required = [
  ["helper", "route_engine_via_station"],
  ["helper", "Detour checked"],
  ["helper", "Estimated"],
  ["sheet", "routeDetourEvidenceLine"],
  ["sheet", "Best stop for this trip"],
  ["sheet", "`Saves ${recommendationSavingCpl.toFixed(1)} c/L on this trip with"],
  ["sheet", "routeRecommendationSummary"],
  ["sheet", "Best route value found"],
  ["sheet", "compactChipRow"],
  ["sheet", "Why?"],
  ["sheet", "Save route"],
  ["evidence", "routeDetourEvidenceMetricLabel"],
  ["mapper", "actualDetour: candidate.actualDetour"],
  ["mapper", "routePosition: candidate.routePosition"],
  ["doc", "`Detour checked`"],
  ["doc", "`Estimated detour`"],
  ["doc", "`Why?` action"],
  ["doc", "compact eligibility chip"],
  ["doc", "`Best stop for this trip`"],
  ["doc", "Saves 20.0 c/L on this trip"],
  ["doc", "Best route value found"],
];

const failures = [];

for (const [key, needle] of required) {
  if (!text[key].includes(needle)) {
    failures.push(`${key} is missing required route-evidence copy guard: ${needle}`);
  }
}

const forbiddenUserClaims = [
  /same-side/i,
  /same side/i,
  /no hard turns/i,
  /traffic[- ]optim/i,
  /toll[- ]optim/i,
];

for (const key of ["sheet", "evidence"]) {
  for (const pattern of forbiddenUserClaims) {
    if (pattern.test(text[key])) {
      failures.push(`${key} contains a forbidden user-facing route-quality claim: ${pattern}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Route evidence copy guards passed.");
