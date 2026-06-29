import fs from "node:fs";
import path from "node:path";

const appUrl = (process.env.FUEL_PATH_PLAN_LIVE_STRESS_URL || "https://fuel-path.vercel.app").replace(/\/$/, "");
const pairCount = Number(process.env.FUEL_PATH_PLAN_LIVE_STRESS_PAIRS || 12);
const fuel = String(process.env.FUEL_PATH_PLAN_LIVE_STRESS_FUEL || "PDL").toUpperCase();
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");

const endpoints = [
  ep("syd-cbd", "Sydney CBD NSW", -33.8688, 151.2093, "NSW", "capital"),
  ep("sylvania", "Sylvania NSW 2224", -34.0128, 151.1033, "NSW", "suburb"),
  ep("newcastle", "Newcastle NSW", -32.9283, 151.7817, "NSW", "regional"),
  ep("dubbo", "Dubbo NSW", -32.2429, 148.6048, "NSW", "regional"),
  ep("moree", "Moree NSW", -29.4639, 149.843, "NSW", "remote"),
  ep("canberra", "Canberra ACT", -35.2809, 149.13, "ACT", "capital"),
  ep("mel-cbd", "Melbourne CBD VIC", -37.8136, 144.9631, "VIC", "capital"),
  ep("ballarat", "Ballarat VIC", -37.5622, 143.8503, "VIC", "regional"),
  ep("brisbane", "Brisbane CBD QLD", -27.4698, 153.0251, "QLD", "capital"),
  ep("longreach", "Longreach QLD", -23.44, 144.25, "QLD", "remote"),
  ep("perth", "Perth CBD WA", -31.9523, 115.8613, "WA", "capital"),
  ep("broome", "Broome WA", -17.9644, 122.2304, "WA", "remote"),
  ep("adelaide", "Adelaide CBD SA", -34.9285, 138.6007, "SA", "capital"),
  ep("coober-pedy", "Coober Pedy SA", -29.0139, 134.7544, "SA", "remote"),
  ep("hobart", "Hobart TAS", -42.8821, 147.3272, "TAS", "capital"),
  ep("strahan", "Strahan TAS", -42.1584, 145.355, "TAS", "remote"),
  ep("darwin", "Darwin NT", -12.4634, 130.8456, "NT", "capital"),
  ep("alice", "Alice Springs NT", -23.698, 133.8807, "NT", "remote"),
];

const pairs = buildRoutePairs(endpoints, pairCount);
const results = [];
for (const [index, pair] of pairs.entries()) {
  const result = await runCase(pair, index).catch((error) => ({
    id: `${pair.from.id}->${pair.to.id}`,
    index: index + 1,
    from: pair.from,
    to: pair.to,
    status: "failed",
    failures: [error instanceof Error ? error.message : String(error)],
    warnings: [],
  }));
  results.push(result);
  console.log(`${result.status === "passed" ? "OK" : "FAIL"} ${index + 1}/${pairs.length} ${result.id}`);
}

const failed = results.filter((item) => item.status === "failed");
const summary = {
  runId,
  appUrl,
  pairCount: pairs.length,
  fuel,
  passed: results.length - failed.length,
  failed: failed.length,
  warnings: results.reduce((sum, item) => sum + item.warnings.length, 0),
  recommendations: results.filter((item) => item.recommendation).length,
  noRecommendation: results.filter((item) => !item.recommendation).length,
  stateCoverage: countBy(results.flatMap((item) => [item.from.state, item.to.state])),
  typeCoverage: countBy(results.flatMap((item) => [item.from.type, item.to.type])),
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `plan-route-live-api-stress-${runId}.json`);
const reportPath = path.join(outputDir, `plan-route-live-api-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
if (failed.length) throw new Error(`${failed.length}/${results.length} live API route cases failed`);

async function runCase(pair, index) {
  const route = await fetchRoute(pair);
  const score = await postScore(route);
  const warnings = [];
  const failures = [];
  const best = score.recommendations?.[0];
  if (!best) warnings.push(score.context?.warning || "no recommendation returned");
  if (best) {
    const viable = score.recommendations.filter(isViableRecommendation);
    const cheaper = viable.find((candidate) =>
      candidate.station.stationCode !== best.station.stationCode && Number(candidate.adjustedCpl) < Number(best.adjustedCpl) - 0.01,
    );
    if (cheaper) failures.push(`recommended ${best.adjustedCpl} c/L while cheaper viable ${cheaper.adjustedCpl} c/L exists`);
    const comparisonCpl = Number(score.context?.decisionSummary?.economics?.comparisonCpl);
    if (Number.isFinite(comparisonCpl) && comparisonCpl < Number(best.adjustedCpl) - 0.01) {
      failures.push(`comparisonCpl ${comparisonCpl} is cheaper than recommended ${best.adjustedCpl}`);
    }
  }
  return {
    id: `${pair.from.id}->${pair.to.id}`,
    index: index + 1,
    from: pair.from,
    to: pair.to,
    status: failures.length ? "failed" : "passed",
    routeKm: route.distanceKm,
    provider: score.context?.provider,
    source: score.context?.source,
    capability: score.context?.capability,
    recommendation: best ? {
      stationCode: best.station.stationCode,
      stationName: best.station.name,
      adjustedCpl: best.adjustedCpl,
      pumpCpl: best.pumpCpl,
      detourMinutes: best.detourMinutes,
      comparisonCpl: score.context?.decisionSummary?.economics?.comparisonCpl ?? null,
    } : null,
    warnings,
    failures,
  };
}

async function fetchRoute(pair) {
  const params = new URLSearchParams({
    fromLat: String(pair.from.lat),
    fromLon: String(pair.from.lon),
    fromLabel: pair.from.label,
    toLat: String(pair.to.lat),
    toLon: String(pair.to.lon),
    toLabel: pair.to.label,
  });
  const response = await fetch(`${appUrl}/api/route?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`/api/route HTTP ${response.status}`);
  return response.json();
}

async function postScore(route) {
  const response = await fetch(`${appUrl}/api/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fuel, route, eligibleDiscounts: ["fleet-card", "everyday-rewards"] }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`/api/score HTTP ${response.status}`);
  return response.json();
}

function isViableRecommendation(candidate) {
  return candidate.station?.openNow !== false &&
    candidate.reachable !== false &&
    candidate.matchesDecisionRule !== false;
}

function buildRoutePairs(items, count) {
  const pairs = [];
  for (let offset = 1; offset < items.length && pairs.length < count; offset += 1) {
    for (let index = 0; index < items.length && pairs.length < count; index += 1) {
      const from = items[index];
      const to = items[(index + offset) % items.length];
      if (from.id !== to.id) pairs.push({ from, to });
    }
  }
  return pairs;
}

function ep(id, label, lat, lon, state, type) { return { id, label, lat, lon, state, type }; }
function countBy(values) { return values.reduce((counts, value) => { counts[value] = (counts[value] || 0) + 1; return counts; }, {}); }
function renderReport(summary, results) {
  return `# Plan route live API stress\n\nRun: ${summary.runId}\n\n## Summary\n\n- Route pairs: ${summary.pairCount}\n- Passed: ${summary.passed}\n- Failed: ${summary.failed}\n- Warnings: ${summary.warnings}\n- Recommendations returned: ${summary.recommendations}\n- No recommendation: ${summary.noRecommendation}\n\n## Failures\n\n${results.filter((item) => item.failures.length).map((item) => `- ${item.id}: ${item.failures.join("; ")}`).join("\n") || "- None"}\n\n## Warnings\n\n${results.filter((item) => item.warnings.length).map((item) => `- ${item.id}: ${item.warnings.join("; ")}`).join("\n") || "- None"}\n`;
}
