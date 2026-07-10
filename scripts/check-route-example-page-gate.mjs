#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const args = parseArgs(process.argv.slice(2));
const repoRoot = resolve(args.repoRoot || ".");
const evidencePath = args.evidenceJson ? resolve(args.evidenceJson) : "";
const candidateRoots = ["public", "mobile-app/src"].map((root) => resolve(repoRoot, root)).filter(existsSync);
const files = candidateRoots.flatMap((root) => walk(root).map((file) => relative(repoRoot, file).split(sep).join("/")));
const broadSeoFiles = files.filter(isBroadSeoLocationPage);
const routeExampleFiles = files.filter(isRouteExamplePage);
const evidence = loadEvidence(evidencePath);
const proof = summariseEvidence(evidence);
const thresholds = {
  recruitedDrivers: 8,
  trustOrNavigateYes: 6,
  detourClarityYes: 5,
  bestPriceByClarityYes: 5,
  providerCaveatClarityYes: 5,
  maxUnresolvedSafetyObjections: 1,
  maxInitialRouteExamplePages: 5,
};
const driverProofReady =
  proof.recruitedDrivers >= thresholds.recruitedDrivers &&
  proof.trustOrNavigateYes >= thresholds.trustOrNavigateYes &&
  proof.detourClarityYes >= thresholds.detourClarityYes &&
  proof.bestPriceByClarityYes >= thresholds.bestPriceByClarityYes &&
  proof.providerCaveatClarityYes >= thresholds.providerCaveatClarityYes &&
  proof.unresolvedSafetyObjections <= thresholds.maxUnresolvedSafetyObjections;

const blockers = [
  ...(broadSeoFiles.length ? ["broad_seo_location_pages_present"] : []),
  ...(routeExampleFiles.length > thresholds.maxInitialRouteExamplePages ? ["too_many_initial_route_example_pages"] : []),
  ...(routeExampleFiles.length && !driverProofReady ? ["route_example_pages_without_driver_proof"] : []),
  ...(driverProofReady ? [] : ["driver_recommendation_proof_below_threshold"]),
];

const result = {
  ok: blockers.length === 0,
  status: blockers.length ? "blocked" : "passed",
  decision: driverProofReady
    ? "A small route-example page pilot may be considered. Broad SEO/location pages remain blocked."
    : "Delay broad SEO/location pages and route-example pages. Prove route recommendation trust with real drivers first.",
  thresholds,
  proof,
  pageInventory: {
    broadSeoLocationPages: broadSeoFiles,
    routeExamplePages: routeExampleFiles,
  },
  blockers,
  nextAction: driverProofReady
    ? "Limit any first content test to a handful of route-example pages tied to proven route recommendations."
    : "Run recruited-driver tests using docs/04-validation-evidence/historical/route-output-benchmark-user-testing-2026-07-03.md before building pages.",
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok && !args.allowBlocked) process.exit(1);

function isBroadSeoLocationPage(file) {
  if (!/\.(html|tsx?|jsx?|mdx?)$/i.test(file)) return false;
  const normalised = file.toLowerCase();
  if (normalised.includes("node_modules/")) return false;
  if (normalised.includes("docs/")) return false;
  return /(^|\/)(locations?|suburbs?|brands?|fuel-prices|petrol-prices|city-pages|seo)(\/|$)/.test(normalised);
}

function isRouteExamplePage(file) {
  if (!/\.(html|tsx?|jsx?|mdx?)$/i.test(file)) return false;
  const normalised = file.toLowerCase();
  if (normalised.includes("node_modules/")) return false;
  return /(^|\/)(route-examples?|example-routes|routes\/examples?)(\/|$)/.test(normalised);
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "tmp", "output", "dist", "build"].includes(entry.name)) continue;
      out.push(...walk(path));
    } else if (entry.isFile()) {
      out.push(path);
    }
  }
  return out;
}

function loadEvidence(path) {
  if (!path) return null;
  if (!existsSync(path)) throw new Error(`Driver proof evidence file not found: ${path}`);
  const stats = statSync(path);
  if (!stats.isFile() || stats.size <= 0) throw new Error(`Driver proof evidence file is empty or invalid: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function summariseEvidence(evidence) {
  const sessions = Array.isArray(evidence?.sessions) ? evidence.sessions : [];
  const usable = sessions.filter((session) => String(session.sessionId || "").trim());
  return {
    source: evidencePath ? relative(repoRoot, evidencePath).split(sep).join("/") : "",
    recruitedDrivers: usable.length,
    trustOrNavigateYes: countYes(usable, "trustOrNavigate"),
    detourClarityYes: countYes(usable, "detourClear"),
    bestPriceByClarityYes: countYes(usable, "bestPriceByClear"),
    providerCaveatClarityYes: countYes(usable, "providerCaveatClear"),
    unresolvedSafetyObjections: usable.filter((session) => session.unresolvedSafetyObjection === true).length,
  };
}

function countYes(items, key) {
  return items.filter((item) => item[key] === true || String(item[key] || "").toLowerCase() === "yes").length;
}

function parseArgs(argv) {
  const parsed = { allowBlocked: false, evidenceJson: "", repoRoot: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--allow-blocked") parsed.allowBlocked = true;
    else if (arg === "--evidence-json") parsed.evidenceJson = argv[++index] || "";
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index] || "";
  }
  return parsed;
}
