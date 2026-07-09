import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = path.join(root, "mobile-app");
const args = parseArgs(process.argv.slice(2));
const profile = String(args.profile || process.env.FUEL_PATH_UI_UX_STRESS_PROFILE || "broad").toLowerCase();
const listOnly = Boolean(args.list);
const continueOnFailure =
  Boolean(args["continue-on-failure"]) || process.env.FUEL_PATH_UI_UX_STRESS_CONTINUE === "1";
const appUrl = String(args["app-url"] || process.env.FUEL_PATH_UI_UX_STRESS_URL || "https://fuel-path.vercel.app/");
const runId = String(args["run-id"] || new Date().toISOString().replace(/[:.]/g, "-"));
const outDir = path.resolve(String(args["out-dir"] || process.env.FUEL_PATH_UI_UX_STRESS_OUT_DIR || "tmp"));
const maxTailChars = Number(args["tail-chars"] || process.env.FUEL_PATH_UI_UX_STRESS_TAIL_CHARS || 7000);
const requestedPlanFieldPairs = Number(
  args["plan-field-pairs"] || process.env.FUEL_PATH_PLAN_STRESS_ROUTE_PAIRS || Number.NaN,
);
const defaultPlanFieldPairs = profile === "quick" ? 12 : profile === "broad" ? 100 : 300;
const planFieldPairs = Number.isFinite(requestedPlanFieldPairs) && requestedPlanFieldPairs > 0
  ? requestedPlanFieldPairs
  : defaultPlanFieldPairs;
const planFieldStressTimeoutMs =
  planFieldPairs >= 250
    ? 900_000
    : profile === "quick"
      ? 90_000
      : 420_000;

const profileOrder = ["quick", "broad", "full", "native"];
if (!profileOrder.includes(profile)) {
  throw new Error(`Unknown profile "${profile}". Use one of: ${profileOrder.join(", ")}.`);
}

const checks = [
  check({
    id: "root-release-contract",
    title: "Core provider, readiness and recommendation tests",
    category: "release safety",
    harm: "P0 blocker",
    intent: "Catches broken API contracts, provider routing, beta gates and route-quality assertions before UI evidence is trusted.",
    profiles: ["quick", "broad", "full"],
    command: ["npm", "test"],
    timeoutMs: 180_000,
  }),
  check({
    id: "mobile-ui-source-guards",
    title: "Mobile typecheck and UI source guards",
    category: "front-end foundation",
    harm: "P0 blocker",
    intent: "Verifies screen structure, map-camera guards, settings UX guards and route-evidence copy guards.",
    profiles: ["quick", "broad", "full"],
    cwd: mobileRoot,
    command: ["npm", "test"],
    timeoutMs: 240_000,
  }),
  check({
    id: "plan-field-entry-stress",
    title: "Plan field entry, suggestions and keyboard stress",
    category: "major interactions",
    harm: "P0 blocker",
    intent: "Stresses origin/destination entry, suggestion visibility, incomplete routes, edits and repeated route submission.",
    profiles: ["quick", "broad", "full"],
    cwd: mobileRoot,
    command: ["npm", "run", "stress:plan-fields"],
    env: {
      FUEL_PATH_PLAN_STRESS_URL: appUrl,
      FUEL_PATH_PLAN_STRESS_ROUTE_PAIRS: String(planFieldPairs),
    },
    skipIf: () => !isLocalAppUrl(appUrl),
    skipReason:
      "This field-level stress uses local Expo/web mocks and current editable-field oracles. Run against a local Expo web URL, for example --app-url http://127.0.0.1:8081/.",
    timeoutMs: planFieldStressTimeoutMs,
  }),
  check({
    id: "settings-preferences-stress",
    title: "Settings, vehicle, fuel and brand preference stress",
    category: "choices and options",
    harm: "P1 high",
    intent: "Exercises preference controls, saved state, invalid edits and recovery paths that affect recommendations.",
    profiles: ["broad", "full"],
    cwd: mobileRoot,
    command: ["npm", "run", "stress:settings-flows"],
    env: { FUEL_PATH_LOCAL_URL: `${appUrl}${appUrl.includes("?") ? "&" : "?"}local_vehicle_profiles=1` },
    timeoutMs: 240_000,
  }),
  check({
    id: "route-notification-schedule-stress",
    title: "Route watch and notification scheduling stress",
    category: "choices and options",
    harm: "P1 high",
    intent: "Checks route-watch controls, schedule boundaries, opt-in/out behaviour and user recovery states.",
    profiles: ["broad", "full"],
    cwd: mobileRoot,
    command: ["npm", "run", "stress:route-notification-schedule"],
    timeoutMs: 180_000,
  }),
  check({
    id: "frontend-failure-state-stress",
    title: "Frontend unhappy-path and degraded-provider UX",
    category: "unhappy paths",
    harm: "P0 blocker",
    intent: "Forces provider outages, stale data, empty states and copy clarity checks so users can understand what to do next.",
    profiles: ["quick", "broad", "full"],
    command: ["npm", "run", "test:frontend-failure-states"],
    env: { FUEL_PATH_FAILURE_UX_URL: appUrl },
    timeoutMs: 240_000,
  }),
  check({
    id: "provider-chaos-stress",
    title: "Provider chaos and fallback stress",
    category: "rules and resilience",
    harm: "P0 blocker",
    intent: "Confirms provider fallback rules do not create false confidence, broken cards or unsafe recommendation claims.",
    profiles: ["broad", "full"],
    command: ["npm", "run", "test:provider-chaos"],
    timeoutMs: 240_000,
  }),
  check({
    id: "state-fuel-chaos-stress",
    title: "State and fuel-type chaos stress",
    category: "rules and resilience",
    harm: "P1 high",
    intent: "Exercises regional provider differences, fuel switches, unavailable products and state-specific edge cases.",
    profiles: ["broad", "full"],
    command: ["npm", "run", "test:state-fuel-chaos"],
    timeoutMs: 240_000,
  }),
  check({
    id: "mocked-map-interactions",
    title: "Map controls, marker selection and sheet interaction stress",
    category: "map interaction",
    harm: "P0 blocker",
    intent: "Clicks dense marker clusters, station cards, list/map toggles, ranking pills and dismissal controls under deterministic map data.",
    profiles: ["quick", "broad", "full"],
    command: ["npm", "run", "test:map-interactions:mocked"],
    env: { FUEL_PATH_MAP_MOCKED_STRESS_URL: appUrl },
    timeoutMs: profile === "quick" ? 120_000 : 300_000,
  }),
  check({
    id: "map-density-performance",
    title: "Dense-map visual response and performance stress",
    category: "map interaction",
    harm: "P1 high",
    intent: "Checks marker density, overlap tolerance, screenshot evidence and interaction latency under busy map conditions.",
    profiles: ["broad", "full"],
    command: ["npm", "run", "test:map-density"],
    env: { FUEL_PATH_DENSITY_URL: appUrl },
    timeoutMs: 360_000,
  }),
  check({
    id: "plan-route-browser-clicks",
    title: "Plan result browser click-through stress",
    category: "Plan route result",
    harm: "P0 blocker",
    intent: "Validates route results, recommendation cards, map exploration after result, station re-selection and native-map launch links.",
    profiles: ["quick", "broad", "full"],
    command: ["npm", "run", profile === "full" ? "test:plan-route-browser-clicks:full" : "test:plan-route-browser-clicks"],
    env: {
      FUEL_PATH_PLAN_BROWSER_STRESS_URL: appUrl,
      FUEL_PATH_PLAN_BROWSER_STRESS_PAIRS: profile === "quick" ? "12" : profile === "broad" ? "80" : "300",
    },
    timeoutMs: profile === "quick" ? 180_000 : profile === "broad" ? 600_000 : 1_500_000,
  }),
  check({
    id: "route-adversarial-recommendations",
    title: "Adversarial route recommendation rules",
    category: "recommendation logic",
    harm: "P0 blocker",
    intent: "Attacks the scoring rules with same-price candidates, impossible detours, misleading savings, stale price data and route edge cases.",
    profiles: ["quick", "broad", "full"],
    command: ["npm", "run", "test:route-adversarial"],
    timeoutMs: 240_000,
  }),
  check({
    id: "plan-recommendation-volume",
    title: "Plan recommendation volume and rationale stress",
    category: "recommendation logic",
    harm: "P1 high",
    intent: "Runs route recommendation scenarios at volume to check ranking stability, rationale labels and fallback handling.",
    profiles: ["broad", "full"],
    command: ["npm", "run", "test:plan-route-recommendations:local"],
    env: {
      FUEL_PATH_ROUTE_RECOMMENDATION_PAIRS: profile === "broad" ? "100" : "500",
    },
    timeoutMs: profile === "broad" ? 420_000 : 1_200_000,
  }),
  check({
    id: "claim-and-copy-safety",
    title: "Claim safety, card copy and busy-user labels",
    category: "copy and comprehension",
    harm: "P1 high",
    intent: "Checks that price, detour, savings and recommendation labels stay direct, explainable and not over-claimed.",
    profiles: ["quick", "broad", "full"],
    command: ["npm", "run", "test:claim-safety"],
    timeoutMs: 180_000,
  }),
  check({
    id: "plan-card-copy-regression",
    title: "Plan card copy regression",
    category: "copy and comprehension",
    harm: "P1 high",
    intent: "Verifies Plan result copy, recommendation headings and evidence wording against expected product language.",
    profiles: ["quick", "broad", "full"],
    command: ["npm", "run", "test:plan-card-copy"],
    timeoutMs: 120_000,
  }),
  check({
    id: "production-smoke-matrix",
    title: "Production responsive smoke matrix",
    category: "deployed experience",
    harm: "P0 blocker",
    intent: "Confirms production behaves coherently across fuel Nearby, EV Nearby and Plan route states on responsive viewports.",
    profiles: ["broad", "full"],
    command: ["npm", "run", "test:production-smoke-matrix"],
    env: { FUEL_PATH_PRODUCTION_SMOKE_URL: appUrl },
    timeoutMs: 360_000,
  }),
  check({
    id: "live-plan-route-api",
    title: "Live Plan route API stress",
    category: "live route data",
    harm: "P1 high",
    intent: "Checks production route API responses, latency and route recommendation coverage using live API behaviour.",
    profiles: ["full"],
    command: ["npm", "run", "test:plan-route-live-api:full"],
    timeoutMs: 1_500_000,
  }),
  check({
    id: "poi-route-journeys",
    title: "POI route journey stress",
    category: "suggestions and geocoding",
    harm: "P1 high",
    intent: "Stresses named places, POI selection, ambiguous inputs and route journey completion.",
    profiles: ["full"],
    command: ["npm", "run", "test:poi-route-journeys"],
    timeoutMs: 900_000,
  }),
  check({
    id: "native-android-readiness",
    title: "Native Android physical-device readiness",
    category: "native app",
    harm: "P0 blocker",
    intent: "Checks connected Android device readiness, API URL safety, map-key presence and physical-device prerequisites.",
    profiles: ["native"],
    cwd: mobileRoot,
    command: ["npm", "run", "native:android-physical-readiness"],
    timeoutMs: 180_000,
  }),
  check({
    id: "native-android-preview-smoke",
    title: "Native Android preview smoke",
    category: "native app",
    harm: "P0 blocker",
    intent: "Installs and opens the preview APK on a physical Android device to verify native map rendering and core navigation.",
    profiles: ["native"],
    cwd: mobileRoot,
    command: ["npm", "run", "native:android-preview-smoke", "--", "--require-physical", "--map-settle-ms", "10000"],
    env: { FUEL_PATH_NATIVE_ARTIFACT: process.env.FUEL_PATH_NATIVE_ARTIFACT || String(args["native-artifact"] || "") },
    skipIf: () => !process.env.FUEL_PATH_NATIVE_ARTIFACT && !args["native-artifact"],
    skipReason: "Set FUEL_PATH_NATIVE_ARTIFACT or pass --native-artifact to run the physical preview APK smoke.",
    timeoutMs: 600_000,
  }),
];

const selectedChecks = checks.filter((item) => item.profiles.includes(profile));

if (listOnly) {
  printCheckList(selectedChecks);
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });

console.log(`UI/UX stress loop`);
console.log(`Profile: ${profile}`);
console.log(`App URL: ${appUrl}`);
console.log(`Checks: ${selectedChecks.length}`);
console.log(`Stop on blocker: ${continueOnFailure ? "no" : "yes"}\n`);

const results = [];
for (const item of selectedChecks) {
  const result = runCheck(item);
  results.push(result);
  printResult(result);

  if (!continueOnFailure && result.status === "blocked") {
    console.log(`\nStopping on blocker: ${result.id}`);
    break;
  }
}

const summary = buildSummary(results, selectedChecks);
const jsonPath = path.join(outDir, `ui-ux-stress-loop-${runId}.json`);
const mdPath = path.join(outDir, `ui-ux-stress-loop-${runId}.md`);
writeFileSync(jsonPath, `${JSON.stringify({ runId, profile, appUrl, summary, results }, null, 2)}\n`);
writeFileSync(mdPath, renderMarkdown({ runId, profile, appUrl, summary, results }));

console.log(`\nEvidence written:`);
console.log(`- ${path.relative(root, jsonPath)}`);
console.log(`- ${path.relative(root, mdPath)}`);

if (summary.blocked > 0) process.exit(2);
if (summary.failed > 0) process.exit(1);
process.exit(0);

function check(definition) {
  return {
    cwd: root,
    env: {},
    timeoutMs: 180_000,
    profiles: [],
    ...definition,
  };
}

function runCheck(item) {
  const startedAt = new Date();
  if (item.skipIf?.()) {
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      harm: item.harm,
      intent: item.intent,
      command: item.command.join(" "),
      cwd: item.cwd,
      status: "skipped",
      skipReason: item.skipReason,
      startedAt: startedAt.toISOString(),
      durationMs: 0,
    };
  }

  console.log(`Running ${item.harm}: ${item.title}`);
  const started = Date.now();
  const result = spawnSync(item.command[0], item.command.slice(1), {
    cwd: item.cwd,
    env: {
      ...process.env,
      ...item.env,
    },
    encoding: "utf8",
    timeout: item.timeoutMs,
    maxBuffer: 40 * 1024 * 1024,
  });
  const durationMs = Date.now() - started;
  const timedOut = result.error?.code === "ETIMEDOUT";
  const exitCode = typeof result.status === "number" ? result.status : null;
  const status =
    exitCode === 0
      ? "passed"
      : timedOut || item.harm.startsWith("P0")
        ? "blocked"
        : "failed";

  return {
    id: item.id,
    title: item.title,
    category: item.category,
    harm: item.harm,
    intent: item.intent,
    command: item.command.join(" "),
    cwd: item.cwd,
    status,
    exitCode,
    signal: result.signal || null,
    error: result.error ? String(result.error.message || result.error) : "",
    startedAt: startedAt.toISOString(),
    durationMs,
    stdoutTail: tail(result.stdout || "", maxTailChars),
    stderrTail: tail(result.stderr || "", maxTailChars),
  };
}

function printResult(result) {
  const seconds = (result.durationMs / 1000).toFixed(1);
  const suffix = result.status === "skipped" ? `, ${result.skipReason}` : `, ${seconds}s`;
  console.log(`${statusLabel(result.status)} ${result.id}${suffix}\n`);
}

function printCheckList(items) {
  console.log(`UI/UX stress loop profile: ${profile}`);
  console.log(`App URL: ${appUrl}`);
  console.log("");
  for (const item of items) {
    console.log(`- ${item.harm} | ${item.category} | ${item.id}`);
    console.log(`  ${item.title}`);
    console.log(`  ${item.intent}`);
  }
}

function buildSummary(results, expected) {
  const counts = {
    expected: expected.length,
    run: results.filter((item) => item.status !== "skipped").length,
    passed: results.filter((item) => item.status === "passed").length,
    failed: results.filter((item) => item.status === "failed").length,
    blocked: results.filter((item) => item.status === "blocked").length,
    skipped: results.filter((item) => item.status === "skipped").length,
  };
  const issues = results
    .filter((item) => item.status === "blocked" || item.status === "failed")
    .sort((left, right) => harmRank(left.harm) - harmRank(right.harm));
  return {
    ...counts,
    complete: counts.expected === results.length && counts.failed === 0 && counts.blocked === 0,
    highestHarm: issues[0]?.harm || "none",
    nextFix: issues[0]?.id || "",
  };
}

function renderMarkdown(report) {
  const { runId, profile, appUrl, summary, results } = report;
  const issues = results
    .filter((item) => item.status === "blocked" || item.status === "failed")
    .sort((left, right) => harmRank(left.harm) - harmRank(right.harm));
  const skipped = results.filter((item) => item.status === "skipped");
  const rows = results
    .map(
      (item) =>
        `| ${item.status} | ${item.harm} | ${item.category} | ${item.id} | ${formatMs(item.durationMs)} |`,
    )
    .join("\n");

  return `# UI/UX Stress Loop

Run: ${runId}

## Summary

- Profile: ${profile}
- App URL: ${appUrl}
- Expected checks: ${summary.expected}
- Run checks: ${summary.run}
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Blocked: ${summary.blocked}
- Skipped: ${summary.skipped}
- Highest harm: ${summary.highestHarm}
- Next fix: ${summary.nextFix || "None"}

## Issues

${issues.length ? issues.map(renderIssue).join("\n\n") : "- None"}

## Evidence

| Status | Harm | Category | Check | Duration |
| --- | --- | --- | --- | --- |
${rows || "| none | none | none | none | none |"}

## Exceptions

${skipped.length ? skipped.map((item) => `- ${item.id}: ${item.skipReason}`).join("\n") : "- None"}

## Untested Needs

${untestedNeeds(profile, skipped)}
`;
}

function renderIssue(item) {
  const output = [item.stderrTail, item.stdoutTail].filter(Boolean).join("\n").trim();
  return `- ${item.harm} ${item.id}: ${item.title}
  - Category: ${item.category}
  - Why it matters: ${item.intent}
  - Command: \`${item.command}\`
  - Evidence tail: ${output ? `\n\n\`\`\`text\n${output.slice(0, 1800)}\n\`\`\`` : "No output captured."}`;
}

function untestedNeeds(currentProfile, skipped) {
  const needs = [];
  if (currentProfile !== "full") needs.push("- Full 300 to 500 route-query and live-API volume pass: run `npm run test:ui-ux-stress-loop:full`.");
  if (currentProfile !== "native") needs.push("- Native physical-device pass: run `npm run test:ui-ux-stress-loop:native` with a connected device and preview APK.");
  if (skipped.length) needs.push(...skipped.map((item) => `- ${item.id}: ${item.skipReason}`));
  needs.push("- Manual screen-reader interpretation: TalkBack and VoiceOver still require human confirmation of focus order, spoken labels and recovery copy.");
  return needs.join("\n");
}

function statusLabel(status) {
  return {
    passed: "PASS",
    failed: "FAIL",
    blocked: "BLOCKED",
    skipped: "SKIP",
  }[status] || status.toUpperCase();
}

function harmRank(harm) {
  if (harm.startsWith("P0")) return 0;
  if (harm.startsWith("P1")) return 1;
  if (harm.startsWith("P2")) return 2;
  return 3;
}

function formatMs(ms) {
  if (!ms) return "0s";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function isLocalAppUrl(value) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function tail(value, maxLength) {
  if (value.length <= maxLength) return value.trim();
  return value.slice(value.length - maxLength).trim();
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const [rawKey, inlineValue] = current.slice(2).split("=");
    const next = argv[index + 1];
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      parsed[rawKey] = next;
      index += 1;
    } else {
      parsed[rawKey] = true;
    }
  }
  return parsed;
}
