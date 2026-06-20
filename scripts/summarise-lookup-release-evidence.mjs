#!/usr/bin/env node
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const RUN_ID = args.runId || process.env.FUEL_PATH_LOOKUP_RELEASE_EVIDENCE_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = args.outDir || process.env.FUEL_PATH_LOOKUP_RELEASE_EVIDENCE_OUT_DIR || "tmp";
const REQUIRE_LAUNCH_READY = Boolean(args.requireLaunchReady || process.env.FUEL_PATH_REQUIRE_LOOKUP_RELEASE_READY === "1");

const inputs = {
  routeFields: await resolveInput("route-fields", "geocode-route-field-stress-*.json"),
  planFieldSmoke: await resolveInput("plan-field-smoke", "plan-field-browser-smoke-*.json", { optional: true }),
  planFieldStress: await resolveInput("plan-field-stress", "plan-field-browser-stress-*.json", { optional: true }),
  exactAddressReadiness: await resolveInput("exact-readiness", "geocode-exact-address-readiness-*.json"),
  lookupReadiness: args.lookupReadiness
    ? await resolveInput("lookup-readiness", "lookup-readiness-check-*.json", { optional: true })
    : "",
  gnafLoadPlan: await resolveInput("gnaf-load-plan", "gnaf-hosted-load-plan-*.json", {
    optional: true,
    autoPredicate: isTimestampedGnafLoadPlanEvidence,
  }),
  prefix600: await resolveInput("prefix-600", "geocode-600-prefix-benchmark-*.json", {
    autoPredicate: isTimestampedPrefix600Evidence,
  }),
  hostedPreview: await resolveInput("hosted-preview", "geocode-hosted-preview-smoke-*.json", { optional: true }),
  hostedNational: await resolveInput("hosted-national", "geocode-hosted-national-benchmark-*.json", {
    optional: true,
    autoPredicate: isReleaseSizedHostedNationalEvidence,
    failClosedPredicate: true,
  }),
};

const evidence = {
  routeFields: await assessRouteFields(inputs.routeFields),
  planFieldSmoke: await assessPlanFieldSmoke(inputs.planFieldSmoke),
  planFieldStress: await assessPlanFieldStress(inputs.planFieldStress),
  exactAddressReadiness: await assessExactAddress(inputs.exactAddressReadiness, inputs.lookupReadiness),
  gnafLoadPlan: await assessGnafLoadPlan(inputs.gnafLoadPlan),
  prefix600: await assessPrefix600(inputs.prefix600),
  hostedPreview: await assessHostedPreview(inputs.hostedPreview),
  hostedNational: await assessHostedNational(inputs.hostedNational),
};

const optionalLocalGates = [evidence.planFieldStress].filter((gate) => gate.status !== "skipped");
const localGates = [evidence.routeFields, evidence.planFieldSmoke, ...optionalLocalGates, evidence.exactAddressReadiness.localMechanics, evidence.prefix600];
const launchGates = [
  ...localGates,
  evidence.gnafLoadPlan,
  evidence.exactAddressReadiness.currentConfigured,
  evidence.hostedPreview,
  evidence.hostedNational,
];
const blockers = launchGates.flatMap((gate) => gate.blockers || []);
const failures = launchGates.flatMap((gate) => gate.failures || []);
const localPrecisionReady = localGates.every((gate) => gate.status === "passed");
const publicLaunchReady = launchGates.every((gate) => gate.status === "passed");
const overallStatus = publicLaunchReady ? "passed" : failures.length ? "failed" : "blocked";
const attentionItems = collectAttentionItems(evidence);
const payload = {
  runId: RUN_ID,
  generatedAt: new Date().toISOString(),
  status: overallStatus,
  localPrecisionReady,
  publicLaunchReady,
  inputs,
  blockers,
  failures,
  attentionItems,
  evidence,
  interpretation: {
    localPrecisionReady:
      "Local route-field, rendered Plan-field UX, exact-address mechanics and 600-prefix fallback evidence all pass without relying on paid provider calls.",
    publicLaunchReady: publicLaunchReady
      ? "Hosted national G-NAF, hosted smoke and hosted national benchmark evidence all pass."
      : "Public exact-address and launch precision claims remain blocked until hosted national G-NAF evidence passes.",
  },
};

await fsp.mkdir(path.join(ROOT, OUT_DIR), { recursive: true });
const jsonPath = path.join(OUT_DIR, `lookup-release-evidence-summary-${RUN_ID}.json`);
const reportPath = path.join(OUT_DIR, `lookup-release-evidence-summary-${RUN_ID}.md`);
await fsp.writeFile(path.join(ROOT, jsonPath), `${JSON.stringify(payload, null, 2)}\n`);
await fsp.writeFile(path.join(ROOT, reportPath), renderReport(payload));

console.log(JSON.stringify({ runId: RUN_ID, jsonPath, reportPath, status: payload.status, localPrecisionReady, publicLaunchReady, blockers, failures }, null, 2));

if (REQUIRE_LAUNCH_READY && !publicLaunchReady) {
  throw new Error(`Lookup release evidence is not launch-ready: ${[...failures, ...blockers].join(", ")}`);
}

async function assessRouteFields(filePath) {
  const report = await readJson(filePath);
  const summary = report.summary || {};
  const routePairs = summary.routePairs || {};
  const failures = [];
  if (summary.usableEndpointPrefixes !== summary.endpointCount) failures.push("route_field_prefixes_not_all_usable");
  if (summary.top1EndpointPrefixes !== summary.endpointCount) failures.push("route_field_top1_prefixes_not_all_usable");
  if (summary.finalQuality?.top1 !== summary.endpointCount) failures.push("route_field_final_results_not_all_top1");
  if (routePairs.uniquePairs !== summary.routePairCount) failures.push("route_pairs_not_unique");
  if (routePairs.bothPrefixReady !== summary.routePairCount) failures.push("route_pairs_not_all_prefix_ready");
  if (routePairs.bothTop1PrefixReady !== summary.routePairCount) failures.push("route_pairs_not_all_top1_prefix_ready");
  if (!Number.isFinite(summary.charsNeeded?.p90) || summary.charsNeeded.p90 > 3) failures.push("route_field_any_match_p90_chars_above_3");
  if (!Number.isFinite(summary.top1CharsNeeded?.p90) || summary.top1CharsNeeded.p90 > 12) failures.push("route_field_top1_p90_chars_above_12");
  return gate({
    id: "route_fields",
    label: "From/To route-field stress",
    filePath,
    status: failures.length ? "failed" : "passed",
    failures,
    metrics: {
      endpoints: `${summary.usableEndpointPrefixes}/${summary.endpointCount}`,
      top1Endpoints: `${summary.top1EndpointPrefixes}/${summary.endpointCount}`,
      routePairs: `${routePairs.bothPrefixReady}/${summary.routePairCount}`,
      uniqueRoutePairs: `${routePairs.uniquePairs ?? 0}/${summary.routePairCount}`,
      p90CharsToAny: summary.charsNeeded?.p90 ?? null,
      p90CharsToTop1: summary.top1CharsNeeded?.p90 ?? null,
      maxCharsToTop1: summary.top1CharsNeeded?.max ?? null,
    },
    note: "Measures the current From/To autocomplete UX under provider outage.",
  });
}

async function assessPlanFieldSmoke(filePath) {
  if (!filePath) {
    return gate({
      id: "plan_field_browser_smoke",
      label: "Rendered Plan-field browser smoke",
      status: "blocked",
      blockers: ["plan_field_browser_smoke_evidence_missing"],
      metrics: {},
      note: "Run npm run smoke:plan-fields in mobile-app/ against the local web app before release review.",
    });
  }
  const report = await readJson(filePath);
  const summary = report.summary || {};
  const rows = Array.isArray(report.results) ? report.results : [];
  const caseNames = new Set(rows.map((row) => row.name));
  const requiredCases = [
    "blank plan form stays disabled",
    "partial street input asks for suburb or postcode",
    "state-only address context is not enough",
    "locality-qualified typed address still needs suggestion confirmation",
    "validation address rows are ranked above POI-like rows",
    "validation rows show unconfirmed evidence",
    "street fallback rows show street-only evidence",
    "selecting confirmed From and To unlocks Plan route",
    "selected broad capital pair can submit route",
    "airport pair suggestions can submit route",
    "editing after a planned route clears route results",
  ];
  const failures = [];
  if (!Number.isFinite(summary.cases) || summary.cases < requiredCases.length) failures.push("plan_field_smoke_case_count_too_low");
  if (summary.failed !== 0) failures.push("plan_field_smoke_has_failed_cases");
  if (summary.passed !== summary.cases) failures.push("plan_field_smoke_not_all_cases_passed");
  for (const name of requiredCases) {
    if (!caseNames.has(name)) failures.push(`plan_field_smoke_missing_${slug(name)}`);
  }
  return gate({
    id: "plan_field_browser_smoke",
    label: "Rendered Plan-field browser smoke",
    filePath,
    status: failures.length ? "failed" : "passed",
    failures,
    metrics: {
      cases: `${summary.passed ?? 0}/${summary.cases ?? 0}`,
      geocodeCalls: summary.apiCalls?.geocode ?? null,
      routeCalls: summary.apiCalls?.route ?? null,
      scoreCalls: summary.apiCalls?.score ?? null,
    },
    note: "Checks the rendered mobile-viewport Plan form for disabled states, suggestion confirmation, validation ranking, route submit and edit recovery.",
  });
}

async function assessPlanFieldStress(filePath) {
  if (!filePath) {
    return gate({
      id: "plan_field_browser_stress",
      label: "Rendered Plan-field route-pair stress",
      status: "skipped",
      metrics: {},
      note: "Optional deep check. Run npm run stress:plan-fields in mobile-app/ against the local web app before high-confidence UX review.",
    });
  }
  const report = await readJson(filePath);
  const summary = report.summary || {};
  const failures = [];
  if (!Number.isFinite(summary.routePairs) || summary.routePairs < 100) failures.push("plan_field_stress_route_pair_count_too_low");
  if (summary.uniqueRoutePairs !== summary.routePairs) failures.push("plan_field_stress_route_pairs_not_unique");
  if (summary.failed !== 0) failures.push("plan_field_stress_has_failed_cases");
  if (summary.passed !== summary.cases) failures.push("plan_field_stress_not_all_cases_passed");
  if (!Number.isFinite(summary.endpointCoverage) || summary.endpointCoverage < 52) failures.push("plan_field_stress_endpoint_coverage_too_low");
  if (!Number.isFinite(summary.apiCalls?.geocode) || summary.apiCalls.geocode < summary.routePairs * 2) failures.push("plan_field_stress_geocode_calls_too_low");
  if (!Number.isFinite(summary.submittedRoutes) || summary.submittedRoutes < 4) failures.push("plan_field_stress_route_submit_coverage_too_low");
  return gate({
    id: "plan_field_browser_stress",
    label: "Rendered Plan-field route-pair stress",
    filePath,
    status: failures.length ? "failed" : "passed",
    failures,
    metrics: {
      routePairs: `${summary.passed ?? 0}/${summary.routePairs ?? 0}`,
      uniqueRoutePairs: `${summary.uniqueRoutePairs ?? 0}/${summary.routePairs ?? 0}`,
      endpointCoverage: `${summary.endpointCoverage ?? 0}/52`,
      submittedRoutes: summary.submittedRoutes ?? null,
      geocodeCalls: summary.apiCalls?.geocode ?? null,
    },
    note: "Checks the rendered mobile-viewport Plan form across 100 national From/To pairs with deterministic mocked API responses.",
  });
}

async function assessExactAddress(filePath, lookupReadinessPath = "") {
  const report = await readJson(filePath);
  const lookupReadiness = lookupReadinessPath ? await readJson(lookupReadinessPath) : null;
  const fixture = report.fixtureIndexed || {};
  const current = report.currentConfigured || {};
  const launch = report.launchReadiness || {};
  const hostedReady = lookupReadinessReady(lookupReadiness);
  const localFailures = [];
  if (fixture.exactTop !== report.caseCount) localFailures.push("fixture_gnaf_exact_address_not_all_top1");
  if (fixture.providerCalls !== 0) localFailures.push("fixture_gnaf_used_provider_calls");
  const currentBlockers = [];
  const currentFailures = [];
  if (!launch.ready && !hostedReady) currentBlockers.push("configured_gnaf_not_ready_for_public_exact_address_claim");
  if (!hostedReady && launch.ready && current.exactTop !== report.caseCount) currentFailures.push("configured_gnaf_launch_ready_but_exact_cases_not_all_top1");
  return {
    localMechanics: gate({
      id: "exact_address_local_mechanics",
      label: "Exact-address G-NAF mechanics",
      filePath,
      status: localFailures.length ? "failed" : "passed",
      failures: localFailures,
      metrics: {
        exactTop: `${fixture.exactTop}/${report.caseCount}`,
        providerCalls: fixture.providerCalls ?? null,
        p90CharsToExact: fixture.charsToExact?.p90 ?? null,
      },
      note: "Proves the index path can resolve unit, slash, suffix, townhouse, rural and remote exact addresses.",
    }),
    currentConfigured: gate({
      id: "exact_address_current_configured",
      label: "Configured exact-address coverage",
      filePath: lookupReadinessPath || filePath,
      status: currentFailures.length ? "failed" : currentBlockers.length ? "blocked" : "passed",
      failures: currentFailures,
      blockers: currentBlockers,
      metrics: {
        launchReadiness: hostedReady ? "hosted_lookup_ready" : launch.status || "",
        exactTop: hostedReady ? "hosted_smoke_passed" : `${current.exactTop ?? 0}/${report.caseCount}`,
        providerCalls: hostedReady ? 0 : current.providerCalls ?? null,
        addressIndexMode: hostedReady ? lookupReadiness?.addressIndex?.mode || "" : current.addressIndexMode || "",
        hostedBenchmarkCases: hostedReady ? lookupReadiness?.hostedBenchmark?.cases ?? null : null,
        hostedBenchmarkAddressTopRate: hostedReady ? lookupReadiness?.hostedBenchmark?.addressTopRate ?? null : null,
      },
      note: hostedReady
        ? "Production /api/status lookup readiness allows public exact-address claims with hosted G-NAF evidence."
        : "Load national G-NAF into the configured hosted index, run npm run check:gnaf-hosted:readiness, then rerun exact-address readiness.",
    }),
  };
}

function lookupReadinessReady(payload) {
  return Boolean(
    payload?.ok === true &&
      payload?.publicExactAddressClaimsAllowed === true &&
      payload?.addressIndex?.hosted === true &&
      payload?.exactSmoke?.passed === true &&
      payload?.hostedBenchmark?.passed === true,
  );
}

async function assessGnafLoadPlan(filePath) {
  if (!filePath) {
    return gate({
      id: "gnaf_hosted_load_plan",
      label: "Hosted G-NAF load plan",
      status: "blocked",
      blockers: ["gnaf_hosted_load_plan_evidence_missing"],
      metrics: {},
      note: "Run npm run plan:gnaf-hosted-load so storage, source-data and hosted-target readiness are explicit before public launch review.",
    });
  }
  const report = await readJson(filePath);
  const assessment = report.assessment || {};
  const hosted = report.hosted || {};
  const sqlite = report.sqlite || {};
  const warnings = Array.isArray(assessment.warnings) ? assessment.warnings : [];
  const rawBlockers = Array.isArray(assessment.blockers) ? assessment.blockers : [];
  const estimatedStorage = Array.isArray(assessment.estimatedHostedStorageGbRange) && assessment.estimatedHostedStorageGbRange.length === 2
    ? `${assessment.estimatedHostedStorageGbRange[0]}-${assessment.estimatedHostedStorageGbRange[1]} GB`
    : "unknown";
  const hostedRowsReady =
    Number(hosted.addressRows || 0) >= Number(report.minAddressRows || 10_000_000) &&
    hosted.ok === true &&
    (!Array.isArray(hosted.missingIndexes) || hosted.missingIndexes.length === 0);
  const readyToLoad = assessment.status === "ready_to_load";
  const blockers = rawBlockers.length
    ? rawBlockers
    : readyToLoad || hostedRowsReady
      ? []
      : ["hosted_gnaf_storage_review_required", ...warnings];
  const status = blockers.length ? "blocked" : "passed";
  return gate({
    id: "gnaf_hosted_load_plan",
    label: "Hosted G-NAF load plan",
    filePath,
    status,
    blockers,
    metrics: {
      planStatus: assessment.status || "",
      sqliteRows: sqlite.count ?? null,
      hostedRows: hosted.addressRows ?? null,
      hostedRowGap: assessment.hostedRowGap ?? null,
      estimatedHostedStorage: estimatedStorage,
      warnings: warnings.length ? warnings.join(", ") : "none",
    },
    note: status === "passed"
      ? "Hosted national-load planning is clear; proceed with hosted readiness, preview smoke and hosted national benchmark evidence."
      : "Confirm storage/cost review for the dedicated hosted G-NAF target, then run the national load and readiness commands from the load-plan report.",
  });
}

async function assessPrefix600(filePath) {
  const report = await readJson(filePath);
  const overall = report.summary?.overall || {};
  const remote = report.summary?.byCategory?.rural_remote_island || {};
  const categoryAttention = prefix600CategoryAttention(report.summary?.byCategory || {});
  const failures = [];
  if (overall.cases !== 600) failures.push("prefix_600_case_count_not_600");
  if (overall.finalTopMatch !== overall.cases) failures.push("prefix_600_not_all_final_top_matches");
  if (overall.finalNoMatch !== 0) failures.push("prefix_600_has_no_match_cases");
  if (overall.suggestionsButNotExpected !== 0) failures.push("prefix_600_has_wrong_suggestions");
  if (!Number.isFinite(overall.p90AnyChars) || overall.p90AnyChars > 28) failures.push("prefix_600_p90_any_chars_above_28");
  if (remote.finalTopMatch !== remote.cases) failures.push("prefix_600_remote_cases_not_all_top_matches");
  return gate({
    id: "prefix_600",
    label: "600-prefix national fallback benchmark",
    filePath,
    status: failures.length ? "failed" : "passed",
    failures,
    metrics: {
      finalTopMatch: `${overall.finalTopMatch}/${overall.cases}`,
      p90CharsToAny: overall.p90AnyChars ?? null,
      p90CharsToTop1: overall.p90TopChars ?? null,
      unsafeEarlyStreetTop: overall.wrongStreetTopBeforeAnyMatch ?? null,
      slowCategories: categoryAttention.length ? categoryAttention.map((item) => `${item.category} p90 ${item.p90AnyChars}`).join(", ") : "none",
      ruralRemoteIsland: `${remote.finalTopMatch}/${remote.cases}`,
    },
    attention: categoryAttention.map((item) => ({
      id: `prefix_600_${item.category}_slow_to_correct_suggestion`,
      severity: item.severity,
      message: `${item.label} need p90 ${item.p90AnyChars} chars for a correct suggestion in local fallback.`,
      evidence: {
        category: item.category,
        cases: item.cases,
        p50AnyChars: item.p50AnyChars,
        p90AnyChars: item.p90AnyChars,
        p90TopChars: item.p90TopChars,
      },
      recommendation: "Do not present this as launch-grade exact-address autocomplete. Hosted national G-NAF or controlled provider autocomplete is needed to reduce typing friction.",
    })),
    note: "Stress-tests national no-cost fallback suggestions under provider outage.",
  });
}

async function assessHostedPreview(filePath) {
  if (!filePath) {
    return gate({
      id: "hosted_preview_smoke",
      label: "Hosted preview smoke",
      status: "blocked",
      blockers: ["hosted_preview_smoke_evidence_missing"],
      metrics: {},
      note: "Run npm run test:geocode-hosted-preview -- --api-base <hosted-url> after hosted G-NAF is live.",
    });
  }
  const report = await readJson(filePath);
  const summary = report.summary || {};
  const diagnostics = report.diagnostics || {};
  const failures = [];
  if (summary.topMatch !== summary.cases) failures.push("hosted_preview_not_all_top_matches");
  if (summary.addressTopMatch !== summary.addressCases) failures.push("hosted_preview_address_cases_not_all_top_matches");
  if (summary.poiTopMatch !== summary.poiCases) failures.push("hosted_preview_poi_cases_not_all_top_matches");
  if (summary.failures !== 0) failures.push("hosted_preview_has_failures");
  for (const blocker of diagnostics.likelyBlockers || []) {
    if (!failures.includes(blocker)) failures.push(blocker);
  }
  return gate({
    id: "hosted_preview_smoke",
    label: "Hosted preview smoke",
    filePath,
    status: failures.length ? "failed" : "passed",
    failures,
    metrics: {
      topMatch: `${summary.topMatch}/${summary.cases}`,
      addressTopMatch: `${summary.addressTopMatch}/${summary.addressCases}`,
      poiTopMatch: `${summary.poiTopMatch}/${summary.poiCases}`,
      likelyBlockers: diagnostics.likelyBlockers?.length ? diagnostics.likelyBlockers.join(", ") : "none",
      addressTopProviders: formatCounts(diagnostics.addressTopProviderCounts),
      lookupStatuses: formatCounts(diagnostics.lookupStatusCounts),
    },
    note: "High-risk hosted smoke for exact, unit/slash, townhouse, rural, remote, island and POI cases.",
  });
}

async function assessHostedNational(filePath) {
  if (!filePath) {
    return gate({
      id: "hosted_national_benchmark",
      label: "Hosted 900-case national benchmark",
      status: "blocked",
      blockers: ["hosted_national_benchmark_evidence_missing"],
      metrics: {},
      note: "Run npm run test:geocode-hosted-national -- --api-base <hosted-url> after hosted national G-NAF is live.",
    });
  }
  const report = await readJson(filePath);
  const overall = report.summary?.overall || {};
  const address = report.summary?.byKind?.address || {};
  const poi = report.summary?.byKind?.poi || {};
  const failures = [];
  const blockers = [];
  const completeBenchmark = (overall.cases || 0) >= 900;
  if (!completeBenchmark) blockers.push("hosted_national_benchmark_incomplete");
  if (completeBenchmark && (address.finalTopRate || 0) < 1) failures.push("hosted_national_address_top_rate_below_1");
  if (completeBenchmark && (poi.finalTopRate || 0) < 0.98) failures.push("hosted_national_poi_top_rate_below_0_98");
  if (completeBenchmark && (!Number.isFinite(address.p90AnyChars) || address.p90AnyChars > 42)) failures.push("hosted_national_address_p90_chars_above_42");
  if (completeBenchmark && (!Number.isFinite(poi.p90AnyChars) || poi.p90AnyChars > 12)) failures.push("hosted_national_poi_p90_chars_above_12");
  return gate({
    id: "hosted_national_benchmark",
    label: "Hosted 900-case national benchmark",
    filePath,
    status: failures.length ? "failed" : blockers.length ? "blocked" : "passed",
    failures,
    blockers,
    metrics: {
      cases: overall.cases ?? null,
      addressTopRate: address.finalTopRate ?? null,
      addressP90Chars: address.p90AnyChars ?? null,
      poiTopRate: poi.finalTopRate ?? null,
      poiP90Chars: poi.p90AnyChars ?? null,
    },
    note: "Launch-grade hosted precision benchmark across 600 real addresses and 300 POIs.",
  });
}

function gate({ id, label, filePath = "", status, failures = [], blockers = [], metrics = {}, attention = [], note = "" }) {
  return { id, label, status, filePath, failures, blockers, metrics, attention, note };
}

function collectAttentionItems(evidence) {
  return [
    ...(evidence.routeFields.attention || []),
    ...(evidence.planFieldSmoke.attention || []),
    ...(evidence.planFieldStress.attention || []),
    ...(evidence.exactAddressReadiness.localMechanics.attention || []),
    ...(evidence.gnafLoadPlan.attention || []),
    ...(evidence.exactAddressReadiness.currentConfigured.attention || []),
    ...(evidence.prefix600.attention || []),
    ...(evidence.hostedPreview.attention || []),
    ...(evidence.hostedNational.attention || []),
  ];
}

function prefix600CategoryAttention(byCategory) {
  const watched = [
    ["precise_address", "Precise addresses"],
    ["new_duplex_townhouse", "Duplex and townhouse-style addresses"],
  ];
  return watched.flatMap(([category, label]) => {
    const summary = byCategory[category];
    if (!summary) return [];
    const p90AnyChars = Number(summary.p90AnyChars);
    if (!Number.isFinite(p90AnyChars) || p90AnyChars <= 18) return [];
    return [{
      category,
      label,
      severity: p90AnyChars > 28 ? "high" : "medium",
      cases: summary.cases ?? null,
      p50AnyChars: summary.p50AnyChars ?? null,
      p90AnyChars,
      p90TopChars: summary.p90TopChars ?? null,
    }];
  });
}

async function resolveInput(argName, pattern, options = {}) {
  const explicit = args[toCamel(argName)];
  if (explicit) return path.relative(ROOT, path.resolve(explicit));
  if (options.optional && process.env.FUEL_PATH_LOOKUP_RELEASE_DISABLE_OPTIONAL_AUTO === "1") return "";
  const latest = await latestMatchingFile(path.join(ROOT, "tmp"), pattern, options.autoPredicate, options);
  if (latest) return path.relative(ROOT, latest);
  if (options.optional) return "";
  throw new Error(`Missing required evidence. Pass --${argName} or run the matching script for tmp/${pattern}.`);
}

async function latestMatchingFile(dir, pattern, predicate, options = {}) {
  if (!fs.existsSync(dir)) return "";
  const regex = globToRegExp(pattern);
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && regex.test(entry.name) && !isAutoIgnoredEvidenceFile(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
  if (!predicate) return candidates[0] || "";
  if (options.failClosedPredicate) {
    const latest = candidates[0] || "";
    return latest && await predicate(latest) ? latest : "";
  }
  for (const candidate of candidates) {
    if (await predicate(candidate)) return candidate;
  }
  return "";
}

function isAutoIgnoredEvidenceFile(name) {
  return /-(mock|test|fixture|local-blocked|launch-pass|launch-blocked|ready|review-required|review-accepted|missing-sqlite|local-national)\b/i.test(name);
}

async function isTimestampedGnafLoadPlanEvidence(filePath) {
  if (!/^gnaf-hosted-load-plan-\d{4}-\d{2}-\d{2}T/.test(path.basename(filePath))) return false;
  try {
    const payload = JSON.parse(await fsp.readFile(filePath, "utf8"));
    return Boolean(payload.assessment && payload.sqlite);
  } catch {
    return false;
  }
}

async function isReleaseSizedHostedNationalEvidence(filePath) {
  try {
    const payload = JSON.parse(await fsp.readFile(filePath, "utf8"));
    const requested = payload.requested || {};
    const cases = payload.summary?.overall?.cases || 0;
    const apiBase = String(payload.apiBase || "").trim();
    const httpGeocodeCalls = Number(payload.fetchCalls?.httpGeocode || 0);
    if (payload.mode !== "http") return false;
    if (!apiBase) return false;
    if (requested.addresses < 600) return false;
    if (requested.pois < 300) return false;
    if (cases < 900) return false;
    return httpGeocodeCalls >= cases;
  } catch {
    return false;
  }
}

async function isTimestampedPrefix600Evidence(filePath) {
  return /^geocode-600-prefix-benchmark-\d{4}-\d{2}-\d{2}T/.test(path.basename(filePath));
}

async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(path.resolve(ROOT, filePath), "utf8"));
}

function renderReport(payload) {
  const gates = [
    payload.evidence.routeFields,
    payload.evidence.planFieldSmoke,
    payload.evidence.planFieldStress,
    payload.evidence.exactAddressReadiness.localMechanics,
    payload.evidence.gnafLoadPlan,
    payload.evidence.exactAddressReadiness.currentConfigured,
    payload.evidence.prefix600,
    payload.evidence.hostedPreview,
    payload.evidence.hostedNational,
  ];
  const rows = gates.map((item) => [
    statusLabel(item.status),
    item.label,
    item.filePath || "missing",
    metricText(item.metrics),
    [...item.failures, ...item.blockers].join(", ") || "none",
  ].map(markdownCell).join(" | ")).join("\n");
  const attentionRows = payload.attentionItems.length
    ? payload.attentionItems.map((item) => [
      item.severity.toUpperCase(),
      item.message,
      item.recommendation,
    ].map(markdownCell).join(" | ")).join("\n")
    : "none | none | none";
  const actionRows = gates
    .filter((item) => item.status !== "passed" && item.status !== "skipped")
    .map((item) => [
      item.label,
      [...item.failures, ...item.blockers].join(", ") || "none",
      item.note || "Review the gate evidence and rerun the matching check.",
    ].map(markdownCell).join(" | "))
    .join("\n") || "none | none | none";

  return `# Fuel Path Lookup Release Evidence Summary

Run ID: ${payload.runId}

## Summary

- Status: ${payload.status}
- Local precision ready: ${payload.localPrecisionReady ? "yes" : "no"}
- Public launch ready: ${payload.publicLaunchReady ? "yes" : "no"}
- Blockers: ${payload.blockers.length ? payload.blockers.join(", ") : "none"}
- Failures: ${payload.failures.length ? payload.failures.join(", ") : "none"}
- Attention items: ${payload.attentionItems.length}

## Evidence Gates

status | gate | evidence file | key metrics | issues
--- | --- | --- | --- | ---
${rows}

## Attention Items

severity | issue | recommendation
--- | --- | ---
${attentionRows}

## Next Actions

gate | issue | action
--- | --- | ---
${actionRows}

## Interpretation

- ${payload.interpretation.localPrecisionReady}
- ${payload.interpretation.publicLaunchReady}

## Launch Rule

Do not make public exact-address precision or hosted-national autocomplete claims until every gate above is passed. Blocked hosted evidence is intentional evidence of a release blocker, not a local regression.
`;
}

function metricText(metrics) {
  const entries = Object.entries(metrics).filter(([, value]) => value !== "" && value !== undefined && value !== null);
  if (!entries.length) return "none";
  return entries.map(([key, value]) => `${key}: ${value}`).join("; ");
}

function formatCounts(counts) {
  const entries = Object.entries(counts || {});
  return entries.length ? entries.map(([key, value]) => `${key} ${value}`).join(", ") : "none";
}

function statusLabel(status) {
  return status === "passed" ? "PASS" : status === "blocked" ? "BLOCKED" : status === "skipped" ? "SKIPPED" : "FAIL";
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function toCamel(value) {
  return value.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = toCamel(value.slice(2));
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}
