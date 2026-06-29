#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const evidencePath = args["evidence-json"] || args.evidenceJson || "";
const minRows = Number(args["min-rows"] || args.minRows || 16_905_824);
const maxReviewAgeDays = Number(args["max-review-age-days"] || args.maxReviewAgeDays || 30);
const maxBenchmarkAgeDays = Number(args["max-benchmark-age-days"] || args.maxBenchmarkAgeDays || 30);

const evidence = readEvidence(evidencePath);
const review = buildReview(evidence.payload || {});
const blockers = [
  ...currentPathBlockers(review.current),
  ...candidateBlockers(review.candidate),
  ...benchmarkBlockers(review.benchmark, review.currentBenchmark),
  ...storageBlockers(review.storage),
  ...connectionBlockers(review.connection),
  ...backupBlockers(review.backup),
  ...operationsBlockers(review.operations),
  ...rollbackBlockers(review.rollback),
  ...sourceBlockers(review.sources),
];

const payload = {
  ok: blockers.length === 0,
  status: blockers.length ? "blocked" : "ready",
  blockers,
  review,
  nextAction: blockers.length
    ? "Keep Oracle API as the active G-NAF path until Supabase has like-for-like load, benchmark, storage, connection, backup and rollback evidence."
    : "Supabase has enough migration-review evidence for a deliberate cutover decision.",
};

console.log(JSON.stringify(payload, null, 2));
if (!payload.ok && !(args.allowBlocked || args["allow-blocked"])) process.exit(1);

function readEvidence(filePath) {
  if (!filePath) return { payload: {} };
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    throw new Error(`Database platform review evidence file not found: ${filePath}`);
  }
  return {
    path: filePath,
    resolvedPath: resolved,
    payload: JSON.parse(readFileSync(resolved, "utf8")),
  };
}

function buildReview(evidence) {
  const benchmark = evidence.candidate?.benchmark || {};
  const currentBenchmark = evidence.current?.benchmark || {};
  return {
    reviewedAt: text(evidence.reviewedAt),
    reviewer: text(evidence.reviewer),
    current: {
      provider: text(evidence.current?.provider),
      accessPattern: text(evidence.current?.accessPattern),
      rowCount: number(evidence.current?.rowCount),
      postgresPrivate: boolean(evidence.current?.postgresPrivate),
      publicApiTokenProtected: boolean(evidence.current?.publicApiTokenProtected),
      readinessEvidence: text(evidence.current?.readinessEvidence),
    },
    candidate: {
      provider: text(evidence.candidate?.provider),
      role: text(evidence.candidate?.role),
      rowCount: number(evidence.candidate?.rowCount),
      loadedAt: text(evidence.candidate?.loadedAt),
      indexes: array(evidence.candidate?.indexes),
      dedicatedProject: boolean(evidence.candidate?.dedicatedProject),
      mobileDirectAccess: boolean(evidence.candidate?.mobileDirectAccess),
    },
    currentBenchmark: {
      cases: number(currentBenchmark.cases),
      addressCases: number(currentBenchmark.addressCases),
      poiCases: number(currentBenchmark.poiCases),
      finalTopRate: number(currentBenchmark.finalTopRate),
      p90AnyChars: number(currentBenchmark.p90AnyChars),
      p95LatencyMs: number(currentBenchmark.p95LatencyMs),
      evidenceFile: text(currentBenchmark.evidenceFile),
    },
    benchmark: {
      cases: number(benchmark.cases),
      addressCases: number(benchmark.addressCases),
      poiCases: number(benchmark.poiCases),
      finalTopRate: number(benchmark.finalTopRate),
      p90AnyChars: number(benchmark.p90AnyChars),
      p95LatencyMs: number(benchmark.p95LatencyMs),
      p99LatencyMs: number(benchmark.p99LatencyMs),
      generatedAt: text(benchmark.generatedAt),
      evidenceFile: text(benchmark.evidenceFile),
    },
    storage: {
      estimatedGb: number(evidence.candidate?.storage?.estimatedGb),
      monthlyCostAud: number(evidence.candidate?.storage?.monthlyCostAud),
      reviewedAt: text(evidence.candidate?.storage?.reviewedAt),
      includesIndexes: boolean(evidence.candidate?.storage?.includesIndexes),
      sourceRefs: array(evidence.candidate?.storage?.sourceRefs),
    },
    connection: {
      serverSideOnly: boolean(evidence.candidate?.connection?.serverSideOnly),
      mobileDirectAccess: boolean(evidence.candidate?.connection?.mobileDirectAccess),
      poolingMode: text(evidence.candidate?.connection?.poolingMode),
      runtimePlan: text(evidence.candidate?.connection?.runtimePlan),
      secretHandling: text(evidence.candidate?.connection?.secretHandling),
    },
    backup: {
      dailyBackups: boolean(evidence.candidate?.backup?.dailyBackups),
      pitrDecision: text(evidence.candidate?.backup?.pitrDecision),
      restoreTestPlan: text(evidence.candidate?.backup?.restoreTestPlan),
      backupRefs: array(evidence.candidate?.backup?.backupRefs),
    },
    operations: {
      owner: text(evidence.candidate?.operations?.owner),
      monitoringPlan: text(evidence.candidate?.operations?.monitoringPlan),
      incidentPlan: text(evidence.candidate?.operations?.incidentPlan),
      budgetAlertPlan: text(evidence.candidate?.operations?.budgetAlertPlan),
    },
    rollback: {
      currentOracleApiRetained: boolean(evidence.rollback?.currentOracleApiRetained),
      rollbackPlan: text(evidence.rollback?.rollbackPlan),
      rollbackTestPlan: text(evidence.rollback?.rollbackTestPlan),
    },
    sources: array(evidence.sources),
  };
}

function currentPathBlockers(current) {
  const blockers = [];
  if (current.provider !== "oracle_api") blockers.push("current_oracle_api_not_declared");
  if (current.accessPattern !== "token_protected_api") blockers.push("current_access_pattern_not_token_api");
  if (current.rowCount < minRows) blockers.push("current_row_count_below_gnaf_threshold");
  if (!current.postgresPrivate) blockers.push("current_postgres_privacy_not_confirmed");
  if (!current.publicApiTokenProtected) blockers.push("current_api_token_protection_not_confirmed");
  if (!concreteReference(current.readinessEvidence)) blockers.push("current_readiness_evidence_missing");
  return blockers;
}

function candidateBlockers(candidate) {
  const blockers = [];
  if (candidate.provider !== "supabase") blockers.push("candidate_not_supabase");
  if (candidate.role !== "gnaf_lookup") blockers.push("candidate_role_not_gnaf_lookup");
  if (candidate.rowCount < minRows) blockers.push("candidate_row_count_below_gnaf_threshold");
  if (!freshDate(candidate.loadedAt, maxBenchmarkAgeDays)) blockers.push("candidate_load_evidence_missing_or_stale");
  if (!candidate.dedicatedProject) blockers.push("candidate_dedicated_project_not_confirmed");
  if (candidate.mobileDirectAccess) blockers.push("candidate_mobile_direct_database_access_forbidden");
  for (const indexName of requiredIndexes()) {
    if (!candidate.indexes.includes(indexName)) blockers.push(`candidate_index_missing:${indexName}`);
  }
  return blockers;
}

function benchmarkBlockers(benchmark, currentBenchmark) {
  const blockers = [];
  if (benchmark.cases < 900) blockers.push("candidate_benchmark_too_small");
  if (benchmark.addressCases < 600) blockers.push("candidate_address_benchmark_too_small");
  if (benchmark.poiCases < 300) blockers.push("candidate_poi_benchmark_too_small");
  if (benchmark.finalTopRate < Math.max(1, currentBenchmark.finalTopRate || 1)) {
    blockers.push("candidate_top_match_rate_below_current");
  }
  if (!benchmark.p90AnyChars || !currentBenchmark.p90AnyChars || benchmark.p90AnyChars > currentBenchmark.p90AnyChars) {
    blockers.push("candidate_p90_chars_worse_or_unproven");
  }
  if (!benchmark.p95LatencyMs || benchmark.p95LatencyMs <= 0) blockers.push("candidate_latency_missing");
  if (!benchmark.p99LatencyMs || benchmark.p99LatencyMs <= 0) blockers.push("candidate_p99_latency_missing");
  if (!freshDate(benchmark.generatedAt, maxBenchmarkAgeDays)) blockers.push("candidate_benchmark_missing_or_stale");
  if (!concreteReference(benchmark.evidenceFile)) blockers.push("candidate_benchmark_evidence_missing");
  if (!concreteReference(currentBenchmark.evidenceFile)) blockers.push("current_benchmark_evidence_missing");
  return blockers;
}

function storageBlockers(storage) {
  const blockers = [];
  if (storage.estimatedGb < 17.5) blockers.push("candidate_storage_estimate_below_index_floor");
  if (storage.monthlyCostAud <= 0) blockers.push("candidate_monthly_cost_missing");
  if (!freshDate(storage.reviewedAt, maxReviewAgeDays)) blockers.push("candidate_storage_review_missing_or_stale");
  if (!storage.includesIndexes) blockers.push("candidate_storage_review_excludes_indexes");
  if (!storage.sourceRefs.some((value) => value.includes("supabase.com/docs"))) {
    blockers.push("candidate_storage_source_missing_official_supabase_docs");
  }
  return blockers;
}

function connectionBlockers(connection) {
  const blockers = [];
  if (!connection.serverSideOnly) blockers.push("candidate_connection_not_server_side_only");
  if (connection.mobileDirectAccess) blockers.push("candidate_connection_mobile_direct_access_forbidden");
  if (!["transaction", "session", "direct"].includes(connection.poolingMode)) {
    blockers.push("candidate_pooling_mode_missing");
  }
  if (!meaningfulText(connection.runtimePlan)) blockers.push("candidate_runtime_plan_missing");
  if (!meaningfulText(connection.secretHandling)) blockers.push("candidate_secret_handling_missing");
  return blockers;
}

function backupBlockers(backup) {
  const blockers = [];
  if (!backup.dailyBackups) blockers.push("candidate_daily_backup_not_confirmed");
  if (!["enabled", "deferred_with_reason"].includes(backup.pitrDecision)) {
    blockers.push("candidate_pitr_decision_missing");
  }
  if (!meaningfulText(backup.restoreTestPlan)) blockers.push("candidate_restore_test_plan_missing");
  if (!backup.backupRefs.some((value) => value.includes("supabase.com/docs"))) {
    blockers.push("candidate_backup_source_missing_official_supabase_docs");
  }
  return blockers;
}

function operationsBlockers(operations) {
  const blockers = [];
  if (!meaningfulText(operations.owner)) blockers.push("candidate_owner_missing");
  if (!meaningfulText(operations.monitoringPlan)) blockers.push("candidate_monitoring_plan_missing");
  if (!meaningfulText(operations.incidentPlan)) blockers.push("candidate_incident_plan_missing");
  if (!meaningfulText(operations.budgetAlertPlan)) blockers.push("candidate_budget_alert_plan_missing");
  return blockers;
}

function rollbackBlockers(rollback) {
  const blockers = [];
  if (!rollback.currentOracleApiRetained) blockers.push("rollback_oracle_api_not_retained");
  if (!meaningfulText(rollback.rollbackPlan)) blockers.push("rollback_plan_missing");
  if (!meaningfulText(rollback.rollbackTestPlan)) blockers.push("rollback_test_plan_missing");
  return blockers;
}

function sourceBlockers(sources) {
  const blockers = [];
  if (!sources.some((value) => value.includes("supabase.com/docs/guides/database/connecting-to-postgres"))) {
    blockers.push("official_supabase_connection_source_missing");
  }
  if (!sources.some((value) => value.includes("supabase.com/docs/guides/platform/backups"))) {
    blockers.push("official_supabase_backup_source_missing");
  }
  if (!sources.some((value) => value.includes("supabase.com/docs/guides/platform/database-size"))) {
    blockers.push("official_supabase_database_size_source_missing");
  }
  return blockers;
}

function requiredIndexes() {
  return [
    "fuel_path_gnaf_addresses_search_prefix_idx",
    "fuel_path_gnaf_addresses_search_trgm_idx",
    "fuel_path_gnaf_addresses_state_postcode_idx",
    "fuel_path_gnaf_addresses_locality_idx",
  ];
}

function concreteReference(value) {
  return meaningfulText(value) && !placeholderLike(value);
}

function meaningfulText(value) {
  return text(value).length >= 6 && !placeholderLike(value);
}

function freshDate(value, maxAgeDays) {
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return false;
  if (date > Date.now() + 5 * 60 * 1000) return false;
  const ageDays = (Date.now() - date) / 86_400_000;
  return ageDays <= maxAgeDays;
}

function placeholderLike(value) {
  return /\b(todo|tbd|placeholder|example|unknown|changeme|fill me)\b/i.test(String(value || ""));
}

function text(value) {
  return String(value || "").trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolean(value) {
  return value === true || value === "true" || value === "1";
}

function array(value) {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
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
