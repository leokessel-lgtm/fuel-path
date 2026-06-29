#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { scoreRoute } = require("../api/_routeScoring");

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");
const fuel = "PDL";

const route = {
  id: "adversarial-route",
  name: "Adversarial route",
  defaultCorridorKm: 12,
  defaultDetourSpeedKmh: 60,
  points: [
    { lat: -33.86, lon: 151.0, label: "Start" },
    { lat: -33.86, lon: 151.5, label: "Mid" },
    { lat: -33.86, lon: 152.0, label: "End" },
  ],
};

const cases = [
  scenario("cheaper-open-viable-wins", "cheap-open", [
    station("expensive-near", 182.9, 0.2, true),
    station("cheap-open", 164.9, 0.8, true),
    station("mid-open", 171.9, 0.4, true),
  ]),
  scenario("closed-cheapest-loses", "open-next", [
    station("closed-cheapest", 145.9, 0.2, false),
    station("open-next", 165.9, 0.4, true),
    station("open-expensive", 181.9, 0.5, true),
  ], {
    assertAbsent: ["closed-cheapest"],
  }),
  scenario("outside-smart-detour-cheapest-loses", "near-good", [
    station("far-small-saving", 168.0, 5.8, true),
    station("near-good", 170.0, 0.15, true),
    station("route-baseline", 190.0, 0.2, true),
    station("route-mid", 180.0, 0.25, true),
  ], {
    assertRejected: ["far-small-saving"],
  }),
  scenario("equal-price-shorter-detour-wins", "equal-near", [
    station("equal-far", 166.9, 2.5, true),
    station("equal-near", 166.9, 0.2, true),
    station("baseline", 184.9, 0.3, true),
  ]),
  scenario("stale-price-does-not-downrank", "stale-cheap", [
    station("fresh-expensive", 171.9, 0.2, true, { updatedAt: "2026-06-29T00:00:00.000Z", source: "plan_route_adversarial" }),
    station("stale-cheap", 164.9, 0.3, true, { updatedAt: "2026-05-01T00:00:00.000Z", source: "plan_route_adversarial" }),
    station("baseline", 182.9, 0.25, true),
  ]),
  scenario("membership-only-excluded-by-default", "public-open", [
    station("member-cheapest", 150.0, 0.2, true, { membershipRequired: true }),
    station("public-open", 166.0, 0.3, true),
    station("baseline", 184.0, 0.25, true),
  ], {
    assertAbsent: ["member-cheapest"],
  }),
  scenario("invalid-price-and-coordinates-are-dropped", "valid-open", [
    station("invalid-price", 0, 0.2, true),
    { ...station("invalid-coord", 140.0, 0.3, true), lat: Number.NaN },
    station("valid-open", 166.0, 0.3, true),
    station("baseline", 184.0, 0.25, true),
  ], {
    assertAbsent: ["invalid-price", "invalid-coord"],
  }),
  scenario("zero-best-price-lead-gets-neutral-ui-label", "equal-a", [
    station("equal-a", 166.9, 0.2, true),
    station("equal-b", 166.9, 0.4, true),
    station("baseline", 184.0, 0.25, true),
  ], {
    assertUiTitle: "Best route price",
    assertBestPriceBy: 0,
  }),
];

const results = cases.map(runCase);
const failed = results.filter((result) => result.status === "failed");
const summary = {
  runId,
  cases: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed.map((result) => result.id),
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `route-recommendation-adversarial-stress-${runId}.json`);
const reportPath = path.join(outputDir, `route-recommendation-adversarial-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));
for (const result of results) console.log(`${result.status === "passed" ? "OK" : "FAIL"} ${result.id}`);
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
if (failed.length) throw new Error(`${failed.length}/${results.length} route adversarial cases failed`);

function runCase(test) {
  const scored = scoreRoute({
    source: "plan_route_adversarial",
    route,
    stations: test.stations,
    fuel,
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 12,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });
  const best = scored.candidates[0];
  const bySuffix = new Map(scored.candidates.map((candidate) => [suffix(candidate.station.stationCode), candidate]));
  const bestSuffix = best ? suffix(best.station.stationCode) : "";
  const comparisonCpl = Number(scored.context.decisionSummary?.economics?.comparisonCpl);
  const bestPriceByCpl = best && Number.isFinite(comparisonCpl) ? Math.max(0, comparisonCpl - Number(best.adjustedCpl)) : 0;
  const uiTitle = recommendationTitle(bestPriceByCpl);
  const failures = checks([
    [Boolean(best), "no best recommendation returned"],
    [bestSuffix === test.expectedBest, `expected ${test.expectedBest}, got ${bestSuffix || "none"}`],
    ...test.options.assertAbsent.map((code) => [!bySuffix.has(code), `${code} should be absent from candidates`]),
    ...test.options.assertRejected.map((code) => [bySuffix.get(code)?.matchesDecisionRule === false || bySuffix.get(code)?.station?.openNow === false, `${code} should be rejected or closed`]),
    [test.options.assertUiTitle ? uiTitle === test.options.assertUiTitle : true, `expected UI title ${test.options.assertUiTitle}, got ${uiTitle}`],
    [test.options.assertBestPriceBy === undefined || Math.abs(bestPriceByCpl - test.options.assertBestPriceBy) < 0.01, `expected best price by ${test.options.assertBestPriceBy}, got ${bestPriceByCpl}`],
  ]);
  const cheaperViable = best
    ? scored.candidates.filter((candidate) =>
        candidate.station.stationCode !== best.station.stationCode &&
        candidate.station.openNow !== false &&
        candidate.matchesDecisionRule !== false &&
        candidate.reachable !== false &&
        Number(candidate.adjustedCpl) < Number(best.adjustedCpl) - 0.01,
      )
    : [];
  if (cheaperViable.length) failures.push(`cheaper viable candidate exists: ${cheaperViable.map((item) => suffix(item.station.stationCode)).join(", ")}`);

  return {
    id: test.id,
    status: failures.length ? "failed" : "passed",
    failures,
    recommendation: best ? candidateSummary(best, bestPriceByCpl, uiTitle) : null,
    candidates: scored.candidates.map((candidate) => candidateSummary(candidate, candidate === best ? bestPriceByCpl : null, candidate === best ? uiTitle : "")),
    decisionSummary: scored.context.decisionSummary,
  };
}

function scenario(id, expectedBest, stations, options = {}) {
  return {
    id,
    expectedBest,
    stations,
    options: {
      assertAbsent: options.assertAbsent || [],
      assertRejected: options.assertRejected || [],
      assertUiTitle: options.assertUiTitle || "",
      assertBestPriceBy: options.assertBestPriceBy,
    },
  };
}

function station(code, price, offsetKm, openNow, overrides = {}) {
  const latOffset = offsetKm / 111.32;
  return {
    stationCode: `ADV-${code}`,
    name: `Adversarial ${code}`,
    brand: "TestFuel",
    suburb: "Route",
    address: `${code} Route Road`,
    lat: -33.86 + latOffset,
    lon: 151.5,
    openNow,
    membershipRequired: false,
    updatedAt: "2026-05-01T00:00:00.000Z",
    source: "plan_route_adversarial",
    prices: { [fuel]: price },
    discounts: [],
    ...overrides,
  };
}

function suffix(stationCode) {
  return String(stationCode || "").replace(/^ADV-/, "");
}

function candidateSummary(candidate, bestPriceByCpl, uiTitle) {
  return {
    code: suffix(candidate.station.stationCode),
    adjustedCpl: candidate.adjustedCpl,
    detourMinutes: candidate.detourMinutes,
    matchesDecisionRule: candidate.matchesDecisionRule,
    openNow: candidate.station.openNow,
    warnings: candidate.warnings,
    score: candidate.score,
    ...(bestPriceByCpl === null ? {} : { bestPriceByCpl: round(bestPriceByCpl, 1), uiTitle }),
  };
}

function recommendationTitle(bestPriceByCpl) {
  if (!Number.isFinite(bestPriceByCpl) || bestPriceByCpl <= 0) return "Best route price";
  if (bestPriceByCpl < 2) return "Small savings detour";
  if (bestPriceByCpl < 5) return "Medium savings detour";
  if (bestPriceByCpl < 10) return "Good savings detour";
  if (bestPriceByCpl < 20) return "Great savings detour";
  return "Strong savings detour";
}

function checks(items) {
  return items.filter(([ok]) => !ok).map(([, message]) => message).filter(Boolean);
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function renderReport(summary, results) {
  return `# Route recommendation adversarial stress

Run: ${summary.runId}

## Summary

- Cases: ${summary.cases}
- Passed: ${summary.passed}
- Failed: ${summary.failed}

## Results

| Case | Recommendation | Price | Detour | Best price by | UI label | Status |
|---|---|---:|---:|---:|---|---|
${results.map((result) => `| ${result.id} | ${result.recommendation?.code || "none"} | ${result.recommendation?.adjustedCpl ?? "-"} | ${result.recommendation?.detourMinutes ?? "-"} | ${result.recommendation?.bestPriceByCpl ?? "-"} | ${result.recommendation?.uiTitle || "-"} | ${result.status.toUpperCase()} |`).join("\n")}

## Failures

${results.filter((result) => result.failures.length).map((result) => `- ${result.id}: ${result.failures.join("; ")}`).join("\n") || "- None"}

## Brutal read

${summary.failed ? "Route scoring violated at least one adversarial recommendation rule. Fix before trusting Plan recommendations." : "Route scoring held against the focused adversarial rules: cheaper viable wins, closed/unavailable and smart-detour failures lose, equal price favours shorter detour, stale price does not down-rank, and zero c/L lead stays neutral in UI labelling."}
`;
}
