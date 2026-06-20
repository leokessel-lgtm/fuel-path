const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("lookup release evidence summary passes local gates while blocking launch without hosted evidence", async () => {
  const fixture = writeFixtures({ currentReady: false });
  const { stdout } = await runSummary([
    "--route-fields",
    fixture.routeFields,
    "--plan-field-smoke",
    fixture.planFieldSmoke,
    "--exact-readiness",
    fixture.exactReadiness,
    "--gnaf-load-plan",
    fixture.gnafLoadPlan,
    "--prefix-600",
    fixture.prefix600,
    "--run-id",
    "local-blocked",
  ]);
  const result = JSON.parse(stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));
  const report = fs.readFileSync(path.join(ROOT, result.reportPath), "utf8");

  assert.equal(payload.status, "blocked");
  assert.equal(payload.localPrecisionReady, true);
  assert.equal(payload.publicLaunchReady, false);
  assert.equal(payload.evidence.planFieldSmoke.status, "passed");
  assert.match(payload.evidence.planFieldStress.status, /^(skipped|passed)$/);
  assert.equal(payload.evidence.gnafLoadPlan.status, "blocked");
  assert.equal(payload.evidence.exactAddressReadiness.currentConfigured.status, "blocked");
  assert.equal(payload.evidence.hostedPreview.status, "blocked");
  assert.equal(payload.evidence.hostedNational.status, "blocked");
  assert.deepEqual(payload.attentionItems, []);
  assert.equal(payload.blockers.includes("hosted_gnaf_storage_review_required"), true);
  assert.equal(payload.blockers.includes("configured_gnaf_not_ready_for_public_exact_address_claim"), true);
  assert.equal(payload.blockers.includes("hosted_preview_smoke_evidence_missing"), true);
  assert.equal(payload.blockers.includes("hosted_national_benchmark_evidence_missing"), true);
  assert.match(report, /Do not make public exact-address precision/);
  assert.match(report, /## Next Actions/);
  assert.match(report, /Hosted G-NAF load plan/);
  assert.match(report, /Confirm storage\/cost review/);
  assert.match(report, /Load national G-NAF into the configured hosted index/);
  assert.match(report, /npm run check:gnaf-hosted:readiness/);
  assert.match(report, /Run npm run test:geocode-hosted-preview -- --api-base <hosted-url>/);
  assert.match(report, /Run npm run test:geocode-hosted-national -- --api-base <hosted-url>/);
});

test("lookup release evidence summary flags slow exact-style fallback categories as attention items", async () => {
  const fixture = writeFixtures({ currentReady: false, slowExactCategories: true });
  const { stdout } = await runSummary([
    "--route-fields",
    fixture.routeFields,
    "--plan-field-smoke",
    fixture.planFieldSmoke,
    "--exact-readiness",
    fixture.exactReadiness,
    "--gnaf-load-plan",
    fixture.gnafLoadPlan,
    "--prefix-600",
    fixture.prefix600,
    "--run-id",
    "slow-exact-attention",
  ]);
  const result = JSON.parse(stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));
  const report = fs.readFileSync(path.join(ROOT, result.reportPath), "utf8");

  assert.equal(payload.status, "blocked");
  assert.equal(payload.localPrecisionReady, true);
  assert.equal(payload.evidence.prefix600.status, "passed");
  assert.equal(payload.attentionItems.length, 2);
  assert.equal(payload.attentionItems[0].id, "prefix_600_precise_address_slow_to_correct_suggestion");
  assert.equal(payload.attentionItems[1].id, "prefix_600_new_duplex_townhouse_slow_to_correct_suggestion");
  assert.match(payload.evidence.prefix600.metrics.slowCategories, /precise_address p90 24/);
  assert.match(payload.evidence.prefix600.metrics.slowCategories, /new_duplex_townhouse p90 34/);
  assert.match(report, /## Attention Items/);
  assert.match(report, /Hosted national G-NAF or controlled provider autocomplete is needed/);
});

test("lookup release evidence summary accepts optional rendered Plan-field route-pair stress", async () => {
  const fixture = writeFixtures({ currentReady: false, planFieldStressEvidence: true });
  const { stdout } = await runSummary([
    "--route-fields",
    fixture.routeFields,
    "--plan-field-smoke",
    fixture.planFieldSmoke,
    "--plan-field-stress",
    fixture.planFieldStress,
    "--exact-readiness",
    fixture.exactReadiness,
    "--gnaf-load-plan",
    fixture.gnafLoadPlan,
    "--prefix-600",
    fixture.prefix600,
    "--run-id",
    "plan-field-stress-included",
  ]);
  const result = JSON.parse(stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));
  const report = fs.readFileSync(path.join(ROOT, result.reportPath), "utf8");

  assert.equal(payload.status, "blocked");
  assert.equal(payload.localPrecisionReady, true);
  assert.equal(payload.evidence.planFieldStress.status, "passed");
  assert.equal(payload.evidence.planFieldStress.metrics.routePairs, "100/100");
  assert.equal(payload.evidence.planFieldStress.metrics.uniqueRoutePairs, "100/100");
  assert.match(report, /Rendered Plan-field route-pair stress/);
  assert.match(report, /uniqueRoutePairs: 100\/100/);
});

test("lookup release evidence summary fails duplicate route-pair stress evidence", async () => {
  const fixture = writeFixtures({ currentReady: false, duplicateRoutePairs: true });
  const { stdout } = await runSummary([
    "--route-fields",
    fixture.routeFields,
    "--plan-field-smoke",
    fixture.planFieldSmoke,
    "--exact-readiness",
    fixture.exactReadiness,
    "--gnaf-load-plan",
    fixture.gnafLoadPlan,
    "--prefix-600",
    fixture.prefix600,
    "--run-id",
    "duplicate-route-pairs-fail",
  ]);
  const result = JSON.parse(stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));

  assert.equal(payload.status, "failed");
  assert.equal(payload.localPrecisionReady, false);
  assert.equal(payload.evidence.routeFields.status, "failed");
  assert.equal(payload.failures.includes("route_pairs_not_unique"), true);
});

test("lookup release evidence summary passes launch gate with hosted smoke and national benchmark evidence", async () => {
  const fixture = writeFixtures({ currentReady: true, hosted: true });
  const { stdout } = await runSummary([
    "--route-fields",
    fixture.routeFields,
    "--plan-field-smoke",
    fixture.planFieldSmoke,
    "--exact-readiness",
    fixture.exactReadiness,
    "--gnaf-load-plan",
    fixture.gnafLoadPlan,
    "--prefix-600",
    fixture.prefix600,
    "--hosted-preview",
    fixture.hostedPreview,
    "--hosted-national",
    fixture.hostedNational,
    "--require-launch-ready",
    "--run-id",
    "launch-pass",
  ]);
  const result = JSON.parse(stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));

  assert.equal(payload.status, "passed");
  assert.equal(payload.localPrecisionReady, true);
  assert.equal(payload.publicLaunchReady, true);
  assert.equal(payload.evidence.gnafLoadPlan.status, "passed");
  assert.deepEqual(payload.blockers, []);
  assert.deepEqual(payload.failures, []);
});

test("lookup release evidence summary accepts hosted lookup readiness for configured exact-address coverage", async () => {
  const fixture = writeFixtures({ currentReady: false, hosted: true });
  fs.writeFileSync(fixture.gnafLoadPlan, JSON.stringify(gnafLoadPlan({ ready: true }), null, 2));
  fixture.lookupReadiness = path.join(path.dirname(fixture.gnafLoadPlan), "lookup-readiness.json");
  fs.writeFileSync(fixture.lookupReadiness, JSON.stringify(lookupReadiness(), null, 2));

  const { stdout } = await runSummary([
    "--route-fields",
    fixture.routeFields,
    "--plan-field-smoke",
    fixture.planFieldSmoke,
    "--exact-readiness",
    fixture.exactReadiness,
    "--lookup-readiness",
    fixture.lookupReadiness,
    "--gnaf-load-plan",
    fixture.gnafLoadPlan,
    "--prefix-600",
    fixture.prefix600,
    "--hosted-preview",
    fixture.hostedPreview,
    "--hosted-national",
    fixture.hostedNational,
    "--require-launch-ready",
    "--run-id",
    "launch-pass-hosted-readiness",
  ]);
  const result = JSON.parse(stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));

  assert.equal(payload.status, "passed");
  assert.equal(payload.publicLaunchReady, true);
  assert.equal(payload.evidence.exactAddressReadiness.currentConfigured.status, "passed");
  assert.equal(payload.evidence.exactAddressReadiness.currentConfigured.filePath, path.relative(ROOT, fixture.lookupReadiness));
  assert.equal(payload.evidence.exactAddressReadiness.currentConfigured.metrics.launchReadiness, "hosted_lookup_ready");
  assert.deepEqual(payload.blockers, []);
});

test("lookup release evidence summary fails enforced launch readiness when hosted evidence is missing", async () => {
  const fixture = writeFixtures({ currentReady: false });
  await assert.rejects(
    runSummary([
    "--route-fields",
    fixture.routeFields,
    "--plan-field-smoke",
    fixture.planFieldSmoke,
    "--exact-readiness",
      fixture.exactReadiness,
      "--gnaf-load-plan",
      fixture.gnafLoadPlan,
      "--prefix-600",
      fixture.prefix600,
      "--require-launch-ready",
      "--run-id",
      "launch-blocked",
    ]),
    /Lookup release evidence is not launch-ready/,
  );
});

test("lookup release evidence summary carries hosted preview diagnostics", async () => {
  const fixture = writeFixtures({ currentReady: true, hosted: true, hostedPreviewProblem: "non_gnaf_addresses" });
  const { stdout } = await runSummary([
    "--route-fields",
    fixture.routeFields,
    "--plan-field-smoke",
    fixture.planFieldSmoke,
    "--exact-readiness",
    fixture.exactReadiness,
    "--gnaf-load-plan",
    fixture.gnafLoadPlan,
    "--prefix-600",
    fixture.prefix600,
    "--hosted-preview",
    fixture.hostedPreview,
    "--hosted-national",
    fixture.hostedNational,
    "--run-id",
    "hosted-preview-diagnostics",
  ]);
  const result = JSON.parse(stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));
  const report = fs.readFileSync(path.join(ROOT, result.reportPath), "utf8");

  assert.equal(payload.status, "failed");
  assert.equal(payload.evidence.hostedPreview.status, "failed");
  assert.equal(payload.failures.includes("hosted_preview_address_provider_not_gnaf"), true);
  assert.equal(payload.evidence.hostedPreview.metrics.addressTopProviders, "fuel_path_seed 12");
  assert.match(report, /hosted_preview_address_provider_not_gnaf/);
  assert.match(report, /addressTopProviders: fuel_path_seed 12/);
});

test("lookup release evidence summary default resolver ignores named G-NAF load-plan fixtures", async () => {
  const fixture = writeFixtures({ currentReady: false, slowExactCategories: true });
  const namedFixture = path.join(ROOT, "tmp", "gnaf-hosted-load-plan-review-accepted.json");
  const timestampedFixture = path.join(ROOT, "tmp", "gnaf-hosted-load-plan-2099-01-02T03-04-05-006Z.json");

  try {
    fs.writeFileSync(namedFixture, JSON.stringify({
      sqlite: { count: 16 },
      hosted: { checked: false },
      assessment: {
        status: "review_required",
        blockers: [],
        warnings: ["hosted_target_not_checked"],
      },
    }, null, 2));
    fs.writeFileSync(timestampedFixture, JSON.stringify(gnafLoadPlan({ ready: true }), null, 2));

    const { stdout } = await runSummary([
      "--route-fields",
      fixture.routeFields,
      "--plan-field-smoke",
      fixture.planFieldSmoke,
      "--exact-readiness",
      fixture.exactReadiness,
      "--prefix-600",
      fixture.prefix600,
      "--run-id",
      "default-gnaf-load-plan-resolver",
    ], { optionalAuto: true });
    const result = JSON.parse(stdout);
    const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));

    assert.equal(payload.evidence.gnafLoadPlan.filePath, path.relative(ROOT, timestampedFixture));
    assert.equal(payload.evidence.gnafLoadPlan.status, "passed");
    assert.equal(payload.blockers.includes("hosted_gnaf_storage_review_required"), false);
    assert.equal(payload.blockers.includes("hosted_target_not_checked"), false);
  } finally {
    fs.rmSync(namedFixture, { force: true });
    fs.rmSync(timestampedFixture, { force: true });
  }
});

test("lookup release evidence summary default resolver only accepts hosted HTTP national benchmark evidence", async () => {
  const fixture = writeFixtures({ currentReady: true, hosted: true });
  const localModuleBenchmark = path.join(ROOT, "tmp", "geocode-hosted-national-benchmark-2099-02-03T04-05-06-007Z.json");
  const hostedHttpBenchmark = path.join(ROOT, "tmp", "geocode-hosted-national-benchmark-2099-02-03T04-05-07-008Z.json");

  try {
    fs.writeFileSync(localModuleBenchmark, JSON.stringify(hostedNational({ mode: "module" }), null, 2));

    const blocked = await runSummary([
      "--route-fields",
      fixture.routeFields,
      "--plan-field-smoke",
      fixture.planFieldSmoke,
      "--exact-readiness",
      fixture.exactReadiness,
      "--gnaf-load-plan",
      fixture.gnafLoadPlan,
      "--prefix-600",
      fixture.prefix600,
      "--hosted-preview",
      fixture.hostedPreview,
      "--run-id",
      "default-hosted-national-resolver-blocks-module",
    ], { optionalAuto: true });
    const blockedResult = JSON.parse(blocked.stdout);
    const blockedPayload = JSON.parse(fs.readFileSync(path.join(ROOT, blockedResult.jsonPath), "utf8"));

    assert.equal(blockedPayload.evidence.hostedNational.status, "blocked");
    assert.equal(blockedPayload.evidence.hostedNational.filePath, "");
    assert.equal(blockedPayload.blockers.includes("hosted_national_benchmark_evidence_missing"), true);

    fs.writeFileSync(hostedHttpBenchmark, JSON.stringify(hostedNational({ mode: "http" }), null, 2));

    const passed = await runSummary([
      "--route-fields",
      fixture.routeFields,
      "--plan-field-smoke",
      fixture.planFieldSmoke,
      "--exact-readiness",
      fixture.exactReadiness,
      "--gnaf-load-plan",
      fixture.gnafLoadPlan,
      "--prefix-600",
      fixture.prefix600,
      "--hosted-preview",
      fixture.hostedPreview,
      "--run-id",
      "default-hosted-national-resolver-accepts-http",
    ], { optionalAuto: true });
    const passedResult = JSON.parse(passed.stdout);
    const passedPayload = JSON.parse(fs.readFileSync(path.join(ROOT, passedResult.jsonPath), "utf8"));

    assert.equal(passedPayload.evidence.hostedNational.filePath, path.relative(ROOT, hostedHttpBenchmark));
    assert.equal(passedPayload.evidence.hostedNational.status, "passed");
    assert.equal(passedPayload.publicLaunchReady, true);
  } finally {
    fs.rmSync(localModuleBenchmark, { force: true });
    fs.rmSync(hostedHttpBenchmark, { force: true });
  }
});

function runSummary(args, options = {}) {
  const env = { ...process.env };
  if (!options.optionalAuto) env.FUEL_PATH_LOOKUP_RELEASE_DISABLE_OPTIONAL_AUTO = "1";
  else delete env.FUEL_PATH_LOOKUP_RELEASE_DISABLE_OPTIONAL_AUTO;
  return execFileAsync(process.execPath, ["scripts/summarise-lookup-release-evidence.mjs", ...args], {
    cwd: ROOT,
    env,
    timeout: 20_000,
  });
}

function writeFixtures({ currentReady, hosted = false, slowExactCategories = false, hostedPreviewProblem = "", planFieldStressEvidence = false, duplicateRoutePairs = false }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dir = path.join(ROOT, "tmp", "lookup-release-evidence-summary-tests", id);
  fs.mkdirSync(dir, { recursive: true });
  const files = {
    routeFields: path.join(dir, "route-fields.json"),
    planFieldSmoke: path.join(dir, "plan-field-smoke.json"),
    planFieldStress: path.join(dir, "plan-field-stress.json"),
    exactReadiness: path.join(dir, "exact-readiness.json"),
    gnafLoadPlan: path.join(dir, "gnaf-load-plan.json"),
    prefix600: path.join(dir, "prefix-600.json"),
  };
  fs.writeFileSync(files.routeFields, JSON.stringify(routeFields({ duplicatePairs: duplicateRoutePairs }), null, 2));
  fs.writeFileSync(files.planFieldSmoke, JSON.stringify(planFieldSmoke(), null, 2));
  if (planFieldStressEvidence) fs.writeFileSync(files.planFieldStress, JSON.stringify(planFieldStress(), null, 2));
  fs.writeFileSync(files.exactReadiness, JSON.stringify(exactReadiness(currentReady), null, 2));
  fs.writeFileSync(files.gnafLoadPlan, JSON.stringify(gnafLoadPlan({ ready: currentReady && hosted }), null, 2));
  fs.writeFileSync(files.prefix600, JSON.stringify(prefix600({ slowExactCategories }), null, 2));
  if (hosted) {
    files.hostedPreview = path.join(dir, "hosted-preview.json");
    files.hostedNational = path.join(dir, "hosted-national.json");
    fs.writeFileSync(files.hostedPreview, JSON.stringify(hostedPreview({ problem: hostedPreviewProblem }), null, 2));
    fs.writeFileSync(files.hostedNational, JSON.stringify(hostedNational(), null, 2));
  }
  return files;
}

function routeFields({ duplicatePairs = false } = {}) {
  return {
    summary: {
      endpointCount: 52,
      routePairCount: 100,
      usableEndpointPrefixes: 52,
      top1EndpointPrefixes: 52,
      finalQuality: { top1: 52 },
      charsNeeded: { p90: 3 },
      top1CharsNeeded: { p90: 9, max: 12 },
      routePairs: {
        uniquePairs: duplicatePairs ? 52 : 100,
        bothPrefixReady: 100,
        bothTop1PrefixReady: 100,
      },
    },
  };
}

function planFieldStress() {
  return {
    summary: {
      routePairs: 100,
      uniqueRoutePairs: 100,
      cases: 100,
      passed: 100,
      failed: 0,
      submittedRoutes: 4,
      endpointCoverage: 52,
      apiCalls: {
        geocode: 200,
        route: 4,
        score: 4,
      },
    },
    results: Array.from({ length: 100 }, (_, index) => ({
      name: `${index + 1}. endpoint-${index} to endpoint-${index + 1}`,
      status: "passed",
      elapsedMs: 10,
    })),
  };
}

function planFieldSmoke() {
  const names = [
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
  return {
    summary: {
      cases: names.length,
      passed: names.length,
      failed: 0,
      apiCalls: {
        geocode: 13,
        route: 3,
        score: 3,
      },
    },
    results: names.map((name) => ({
      name,
      status: "passed",
      elapsedMs: 10,
    })),
  };
}

function exactReadiness(currentReady) {
  return {
    caseCount: 16,
    fixtureIndexed: {
      exactTop: 16,
      providerCalls: 0,
      charsToExact: { p90: 34 },
    },
    currentConfigured: {
      exactTop: currentReady ? 16 : 2,
      providerCalls: 0,
      addressIndexMode: currentReady ? "api" : "seed",
    },
    launchReadiness: {
      ready: currentReady,
      status: currentReady ? "ready_for_exact_address_smoke" : "not_ready_for_public_exact_address_claim",
    },
  };
}

function gnafLoadPlan({ ready }) {
  return {
    minAddressRows: 10_000_000,
    storageReviewed: ready,
    sqlite: {
      count: 16_905_824,
      sizeGb: 11.68,
      nationalReady: true,
    },
    hosted: {
      checked: true,
      ok: true,
      dedicatedTargetKnown: true,
      addressRows: ready ? 10_000_000 : 80_000,
      missingIndexes: [],
    },
    assessment: {
      status: ready ? "ready_to_load" : "review_required",
      blockers: [],
      warnings: ready ? [] : ["storage_review_not_confirmed", "large_index_storage_review_required"],
      estimatedHostedStorageGbRange: [17.5, 35],
      hostedRowGap: ready ? 0 : 9_920_000,
    },
  };
}

function prefix600({ slowExactCategories = false } = {}) {
  return {
    summary: {
      overall: {
        cases: 600,
        finalTopMatch: 600,
        finalNoMatch: 0,
        suggestionsButNotExpected: 0,
        p90AnyChars: slowExactCategories ? 27 : 3,
        p90TopChars: slowExactCategories ? 27 : 9,
      },
      byCategory: {
        rural_remote_island: {
          cases: 120,
          finalTopMatch: 120,
        },
        precise_address: {
          cases: 120,
          finalTopMatch: 120,
          p50AnyChars: slowExactCategories ? 21 : 3,
          p90AnyChars: slowExactCategories ? 24 : 3,
          p90TopChars: slowExactCategories ? 24 : 9,
        },
        new_duplex_townhouse: {
          cases: 120,
          finalTopMatch: 120,
          p50AnyChars: slowExactCategories ? 27 : 3,
          p90AnyChars: slowExactCategories ? 34 : 3,
          p90TopChars: slowExactCategories ? 34 : 9,
        },
      },
    },
  };
}

function hostedPreview({ problem = "" } = {}) {
  if (problem === "non_gnaf_addresses") {
    return {
      summary: {
        cases: 20,
        topMatch: 8,
        failures: 0,
        addressCases: 12,
        addressTopMatch: 0,
        poiCases: 8,
        poiTopMatch: 8,
      },
      diagnostics: {
        likelyBlockers: ["hosted_preview_address_provider_not_gnaf"],
        addressTopProviderCounts: {
          fuel_path_seed: 12,
        },
        lookupStatusCounts: {
          ok: 20,
        },
      },
    };
  }
  return {
    summary: {
      cases: 20,
      topMatch: 20,
      failures: 0,
      addressCases: 12,
      addressTopMatch: 12,
      poiCases: 8,
      poiTopMatch: 8,
    },
    diagnostics: {
      likelyBlockers: [],
      addressTopProviderCounts: {
        fuel_path_gnaf: 12,
      },
      lookupStatusCounts: {
        ok: 20,
      },
    },
  };
}

function hostedNational({ mode = "http" } = {}) {
  return {
    mode,
    apiBase: mode === "http" ? "https://fuel-path.example.test" : "",
    requested: {
      addresses: 600,
      pois: 300,
    },
    fetchCalls: {
      total: mode === "http" ? 900 : 0,
      httpGeocode: mode === "http" ? 900 : 0,
      gnafApi: 0,
      external: 0,
      blockedExternal: 0,
    },
    summary: {
      overall: { cases: 900 },
      byKind: {
        address: {
          finalTopRate: 1,
          p90AnyChars: 34,
        },
        poi: {
          finalTopRate: 0.99,
          p90AnyChars: 9,
        },
      },
    },
  };
}

function lookupReadiness() {
  return {
    ok: true,
    status: "ready",
    publicExactAddressClaimsAllowed: true,
    blockers: [],
    addressIndex: {
      mode: "api",
      hosted: true,
      reportedAddressRows: 16_905_824,
    },
    exactSmoke: {
      passed: true,
      status: "passed",
    },
    hostedBenchmark: {
      passed: true,
      status: "passed",
      cases: 900,
      addressTopRate: 1,
      poiTopRate: 1,
    },
  };
}
