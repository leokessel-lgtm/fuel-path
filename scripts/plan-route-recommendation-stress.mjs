import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { scoreRoute } = require("../api/_backend");

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");
const pairCount = Number(process.env.FUEL_PATH_PLAN_ROUTE_STRESS_PAIRS || 300);
const alternatesPerRoute = Number(process.env.FUEL_PATH_PLAN_ROUTE_STRESS_ALTERNATES || 3);
const fuel = String(process.env.FUEL_PATH_PLAN_ROUTE_STRESS_FUEL || "PDL").toUpperCase();

const endpoints = [
  ep("syd-cbd", "Sydney CBD NSW", -33.8688, 151.2093, "NSW", "capital"),
  ep("sylvania", "Sylvania NSW 2224", -34.0128, 151.1033, "NSW", "suburb"),
  ep("newcastle", "Newcastle NSW", -32.9283, 151.7817, "NSW", "regional"),
  ep("dubbo", "Dubbo NSW 2830", -32.2429, 148.6048, "NSW", "regional"),
  ep("moree", "Moree NSW 2400", -29.4639, 149.843, "NSW", "remote"),
  ep("canberra", "Canberra ACT", -35.2809, 149.13, "ACT", "capital"),
  ep("belconnen", "Belconnen ACT", -35.2386, 149.0669, "ACT", "suburb"),
  ep("mel-cbd", "Melbourne CBD VIC", -37.8136, 144.9631, "VIC", "capital"),
  ep("geelong", "Geelong VIC 3220", -38.1499, 144.3617, "VIC", "regional"),
  ep("ballarat", "Ballarat VIC 3350", -37.5622, 143.8503, "VIC", "regional"),
  ep("bendigo", "Bendigo VIC 3550", -36.757, 144.2794, "VIC", "regional"),
  ep("brisbane", "Brisbane CBD QLD", -27.4698, 153.0251, "QLD", "capital"),
  ep("gold-coast", "Gold Coast QLD", -28.0167, 153.4, "QLD", "regional"),
  ep("toowoomba", "Toowoomba QLD 4350", -27.5598, 151.9507, "QLD", "regional"),
  ep("longreach", "Longreach QLD 4730", -23.44, 144.25, "QLD", "remote"),
  ep("mount-isa", "Mount Isa QLD 4825", -20.7268, 139.4955, "QLD", "remote"),
  ep("perth", "Perth CBD WA", -31.9523, 115.8613, "WA", "capital"),
  ep("fremantle", "Fremantle WA 6160", -32.0569, 115.7439, "WA", "regional"),
  ep("bunbury", "Bunbury WA 6230", -33.3271, 115.6414, "WA", "regional"),
  ep("kalgoorlie", "Kalgoorlie WA 6430", -30.7479, 121.4728, "WA", "remote"),
  ep("broome", "Broome WA 6725", -17.9644, 122.2304, "WA", "remote"),
  ep("adelaide", "Adelaide CBD SA", -34.9285, 138.6007, "SA", "capital"),
  ep("port-augusta", "Port Augusta SA 5700", -32.4952, 137.7894, "SA", "regional"),
  ep("coober-pedy", "Coober Pedy SA 5723", -29.0139, 134.7544, "SA", "remote"),
  ep("port-lincoln", "Port Lincoln SA 5606", -34.7244, 135.8618, "SA", "remote"),
  ep("hobart", "Hobart CBD TAS", -42.8821, 147.3272, "TAS", "capital"),
  ep("launceston", "Launceston TAS 7250", -41.4332, 147.1441, "TAS", "regional"),
  ep("burnie", "Burnie TAS 7320", -41.0529, 145.9063, "TAS", "regional"),
  ep("strahan", "Strahan TAS 7468", -42.1584, 145.355, "TAS", "remote"),
  ep("darwin", "Darwin CBD NT", -12.4634, 130.8456, "NT", "capital"),
  ep("palmerston", "Palmerston NT 0830", -12.486, 130.9833, "NT", "regional"),
  ep("katherine", "Katherine NT 0850", -14.4652, 132.2635, "NT", "regional"),
  ep("tennant-creek", "Tennant Creek NT 0860", -19.648, 134.191, "NT", "remote"),
  ep("alice-springs", "Alice Springs NT 0870", -23.698, 133.8807, "NT", "remote"),
];

const pairs = buildRoutePairs(endpoints, pairCount);
const results = pairs.map((pair, index) => runCase(pair, index));
const failures = results.filter((result) => result.failures.length);
const warnings = results.filter((result) => result.warnings.length);
const summary = {
  runId,
  pairCount: pairs.length,
  fuel,
  endpointCoverage: new Set(results.flatMap((result) => [result.from.id, result.to.id])).size,
  stateCoverage: countBy(results.flatMap((result) => [result.from.state, result.to.state])),
  typeCoverage: countBy(results.flatMap((result) => [result.from.type, result.to.type])),
  passed: results.length - failures.length,
  failed: failures.length,
  warnings: warnings.length,
  alternateDetailChecks: results.reduce((total, result) => total + result.alternateDetailChecks.length, 0),
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `plan-route-recommendation-stress-${runId}.json`);
const reportPath = path.join(outputDir, `plan-route-recommendation-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));

console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));

if (failures.length) {
  throw new Error(`${failures.length}/${results.length} Plan route recommendation stress cases failed`);
}

function runCase(pair, index) {
  const route = routeForPair(pair, index);
  const stations = stationFixturesForPair(pair, index);
  const scored = scoreRoute({
    source: "plan_route_stress",
    route,
    stations,
    fuel,
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 8,
    eligibleDiscounts: new Set(["fleet-card", "everyday-rewards"]),
    includeMemberPrices: false,
    includeClosed: false,
  });
  const best = scored.candidates[0];
  const decision = scored.context.decisionSummary;
  const failures = [];
  const warnings = [];

  if (!best) {
    failures.push("no recommendation returned");
  }

  const viable = scored.candidates.filter(isViableRecommendation);
  const cheaperViable = best
    ? viable.filter((candidate) =>
        candidate.station.stationCode !== best.station.stationCode &&
        Number(candidate.adjustedCpl) < Number(best.adjustedCpl) - 0.01)
    : [];
  if (cheaperViable.length) {
    failures.push(`recommended ${best.adjustedCpl} c/L while cheaper viable ${cheaperViable[0].adjustedCpl} c/L exists`);
  }

  const comparisonCpl = Number(decision?.economics?.comparisonCpl);
  if (best && Number.isFinite(comparisonCpl) && comparisonCpl < Number(best.adjustedCpl) - 0.01) {
    failures.push(`comparisonCpl ${comparisonCpl} is cheaper than recommended ${best.adjustedCpl}`);
  }

  const bestPriceByCpl = best
    ? Number.isFinite(comparisonCpl)
      ? Math.max(0, comparisonCpl - Number(best.adjustedCpl))
      : Math.max(0, Number(best.pumpCpl) - Number(best.adjustedCpl))
    : 0;
  const uiTitle = recommendationTitle(bestPriceByCpl);
  if (bestPriceByCpl <= 0.01 && /savings detour/i.test(uiTitle)) {
    failures.push(`zero best-price lead received savings-detour UI title ${uiTitle}`);
  }
  if (bestPriceByCpl > 0.01 && /Best route price/i.test(uiTitle)) {
    failures.push(`positive best-price lead ${bestPriceByCpl.toFixed(1)} c/L received neutral UI title`);
  }

  const alternateDetailChecks = scored.candidates
    .filter((candidate) => !best || candidate.station.stationCode !== best.station.stationCode)
    .slice(0, alternatesPerRoute)
    .map((candidate) => stationDetailCheck(candidate));
  const badAlternate = alternateDetailChecks.find((check) => !check.ok);
  if (badAlternate) {
    failures.push(`alternate station detail incomplete for ${badAlternate.stationCode}: ${badAlternate.errors.join(", ")}`);
  }
  if (alternateDetailChecks.length < Math.min(alternatesPerRoute, Math.max(0, scored.candidates.length - 1))) {
    warnings.push("fewer alternate station detail checks than requested");
  }

  return {
    id: `${pair.from.id}->${pair.to.id}`,
    index: index + 1,
    from: pair.from,
    to: pair.to,
    routeKm: scored.context.routeDistanceKm,
    candidates: scored.candidates.length,
    recommendation: best
      ? {
          stationCode: best.station.stationCode,
          stationName: best.station.name,
          adjustedCpl: best.adjustedCpl,
          pumpCpl: best.pumpCpl,
          detourMinutes: best.detourMinutes,
          matchesDecisionRule: best.matchesDecisionRule,
          bestPriceByCpl: round(bestPriceByCpl, 1),
          comparisonCpl: Number.isFinite(comparisonCpl) ? round(comparisonCpl, 1) : null,
          uiTitle,
        }
      : null,
    cheapestViable: viable[0]
      ? {
          stationCode: viable[0].station.stationCode,
          adjustedCpl: viable[0].adjustedCpl,
          detourMinutes: viable[0].detourMinutes,
        }
      : null,
    alternateDetailChecks,
    warnings,
    failures,
  };
}

function stationDetailCheck(candidate) {
  const errors = [];
  if (!candidate.station?.stationCode) errors.push("missing station code");
  if (!candidate.station?.name) errors.push("missing station name");
  if (!candidate.station?.address && !candidate.station?.brand) errors.push("missing address/brand fallback");
  if (!Number.isFinite(Number(candidate.station?.lat))) errors.push("missing latitude");
  if (!Number.isFinite(Number(candidate.station?.lon))) errors.push("missing longitude");
  if (!Number.isFinite(Number(candidate.pumpCpl))) errors.push("missing pump price");
  if (!Number.isFinite(Number(candidate.adjustedCpl))) errors.push("missing adjusted price");
  if (!Number.isFinite(Number(candidate.detourMinutes))) errors.push("missing detour minutes");
  if (!Number.isFinite(Number(candidate.distanceKm))) errors.push("missing route distance");
  return {
    stationCode: candidate.station?.stationCode || "",
    stationName: candidate.station?.name || "",
    adjustedCpl: candidate.adjustedCpl,
    detourMinutes: candidate.detourMinutes,
    ok: errors.length === 0,
    errors,
  };
}

function isViableRecommendation(candidate) {
  return candidate.station?.openNow !== false &&
    candidate.reachable !== false &&
    candidate.matchesDecisionRule !== false;
}

function recommendationTitle(bestPriceByCpl) {
  if (!Number.isFinite(bestPriceByCpl) || bestPriceByCpl <= 0) return "Best route price";
  if (bestPriceByCpl < 2) return "Small savings detour";
  if (bestPriceByCpl < 5) return "Medium savings detour";
  if (bestPriceByCpl < 10) return "Good savings detour";
  if (bestPriceByCpl < 20) return "Great savings detour";
  return "Strong savings detour";
}

function stationFixturesForPair(pair, index) {
  const base = 162 + ((index * 7) % 24);
  const startHigh = round(base + 8 + (index % 5), 1);
  const best = round(base - 6 - (index % 4), 1);
  const next = round(best + 1 + (index % 7), 1);
  const second = round(next + 1 + ((index + 2) % 5), 1);
  const outlier = round(base + 18 + (index % 9), 1);
  const closedCheap = round(best - 8, 1);
  const longDetourCheap = round(best - 4, 1);
  const stations = [
    station(pair, index, "start-high", "Shell", startHigh, 0.12, 0.001, true),
    station(pair, index, "best-viable", "Budget", best, 0.42, 0.002, true),
    station(pair, index, "next-viable", "Ampol", next, 0.55, -0.002, true),
    station(pair, index, "second-viable", "Metro", second, 0.68, 0.003, true),
    station(pair, index, "expensive-outlier", "BP", outlier, 0.8, -0.003, true),
    station(pair, index, "closed-cheap", "United", closedCheap, 0.35, 0.002, false),
    station(pair, index, "detour-cheap", "Liberty", longDetourCheap, 0.5, 0.085, true),
    station(pair, index, "destination-mid", "EG Ampol", round(base + 2, 1), 0.9, -0.001, true),
  ];
  if (index % 3 === 0) {
    stations[1].discounts = [{ id: "fleet-card", label: "Fleet card", centsPerLitre: 4 }];
  }
  if (index % 5 === 0) {
    stations[2].discounts = [{ id: "everyday-rewards", label: "Everyday Rewards", centsPerLitre: 4 }];
  }
  return stations;
}

function station(pair, index, code, brand, price, along, offsetLon, openNow) {
  const point = interpolate(pair.from, pair.to, along);
  return {
    stationCode: `${pair.from.id}-${pair.to.id}-${index}-${code}`,
    name: `${brand} ${pair.to.label.split(" ")[0]} ${code}`,
    brand,
    suburb: pair.to.label.split(" ")[0],
    address: `${100 + index} Route Road, ${pair.to.label}`,
    lat: point.lat,
    lon: point.lon + offsetLon,
    openNow,
    source: "plan_route_stress",
    updatedAt: "2026-06-28T08:00:00.000Z",
    prices: { [fuel]: price },
    discounts: [],
  };
}

function routeForPair(pair, index) {
  return {
    id: `${pair.from.id}->${pair.to.id}`,
    name: `${pair.from.label} to ${pair.to.label}`,
    defaultCorridorKm: 8,
    defaultDetourSpeedKmh: 70 + (index % 4) * 10,
    points: [
      point(pair.from),
      interpolate(pair.from, pair.to, 0.33),
      interpolate(pair.from, pair.to, 0.66),
      point(pair.to),
    ],
  };
}

function buildRoutePairs(items, count) {
  const pairs = [];
  let cursor = 0;
  while (pairs.length < count) {
    const from = items[cursor % items.length];
    const to = items[(cursor * 7 + 11) % items.length];
    cursor += 1;
    if (from.id === to.id) continue;
    pairs.push({ from, to });
  }
  return pairs;
}

function ep(id, label, lat, lon, state, type) {
  return { id, label, lat, lon, state, type };
}

function point(endpoint) {
  return { lat: endpoint.lat, lon: endpoint.lon, label: endpoint.label };
}

function interpolate(from, to, ratio) {
  return {
    lat: round(from.lat + (to.lat - from.lat) * ratio, 6),
    lon: round(from.lon + (to.lon - from.lon) * ratio, 6),
    label: `${from.label} to ${to.label}`,
  };
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function renderReport(summary, results) {
  const failures = results.filter((result) => result.failures.length);
  const warnings = results.filter((result) => result.warnings.length);
  const sample = results.slice(0, 12).map((result) =>
    `| ${result.index} | ${result.from.label} | ${result.to.label} | ${result.recommendation?.stationName || "none"} | ${result.recommendation?.adjustedCpl ?? "-"} | ${result.recommendation?.bestPriceByCpl ?? "-"} | ${result.recommendation?.uiTitle || "-"} | ${result.failures.length ? "FAIL" : "PASS"} |`,
  );
  return `# Plan route recommendation stress

Run: ${summary.runId}

## Summary

- Route pairs: ${summary.pairCount}
- Fuel: ${summary.fuel}
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Warning cases: ${summary.warnings}
- Alternate station detail checks: ${summary.alternateDetailChecks}
- Endpoint coverage: ${summary.endpointCoverage}

## State coverage

\`\`\`json
${JSON.stringify(summary.stateCoverage, null, 2)}
\`\`\`

## Type coverage

\`\`\`json
${JSON.stringify(summary.typeCoverage, null, 2)}
\`\`\`

## Sample cases

| # | From | To | Recommendation | c/L | Best price by | UI title | Status |
|---:|---|---|---|---:|---:|---|---|
${sample.join("\n")}

## Failures

${failures.length ? failures.map((result) => `- ${result.id}: ${result.failures.join("; ")}`).join("\n") : "- None"}

## Warnings

${warnings.length ? warnings.slice(0, 50).map((result) => `- ${result.id}: ${result.warnings.join("; ")}`).join("\n") : "- None"}
`;
}
