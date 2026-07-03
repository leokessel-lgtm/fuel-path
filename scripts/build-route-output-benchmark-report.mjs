import fs from "node:fs";
import path from "node:path";

const appUrl = (process.env.FUEL_PATH_ROUTE_OUTPUT_BENCHMARK_URL || "https://fuel-path.vercel.app").replace(/\/$/, "");
const docsDir = path.resolve("docs");
const evidenceDir = path.join(docsDir, "evidence");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const reportDate = new Date().toISOString().slice(0, 10);
const fuels = (process.env.FUEL_PATH_ROUTE_OUTPUT_BENCHMARK_FUELS || "U91,PDL")
  .split(",")
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);

const routes = [
  route("nsw-sydney-newcastle", "NSW", ep("Sydney CBD NSW", -33.8688, 151.2093), ep("Newcastle NSW", -32.9283, 151.7817)),
  route("act-nsw-canberra-sydney", "ACT/NSW", ep("Canberra ACT", -35.2809, 149.13), ep("Sydney CBD NSW", -33.8688, 151.2093)),
  route("vic-melbourne-ballarat", "VIC", ep("Melbourne CBD VIC", -37.8136, 144.9631), ep("Ballarat VIC", -37.5622, 143.8503)),
  route("qld-brisbane-longreach", "QLD", ep("Brisbane CBD QLD", -27.4698, 153.0251), ep("Longreach QLD", -23.44, 144.25)),
  route("wa-perth-broome", "WA", ep("Perth CBD WA", -31.9523, 115.8613), ep("Broome WA", -17.9644, 122.2304)),
  route("sa-adelaide-coober-pedy", "SA", ep("Adelaide CBD SA", -34.9285, 138.6007), ep("Coober Pedy SA", -29.0139, 134.7544)),
  route("tas-hobart-strahan", "TAS", ep("Hobart TAS", -42.8821, 147.3272), ep("Strahan TAS", -42.1584, 145.355)),
  route("nt-darwin-alice-springs", "NT", ep("Darwin NT", -12.4634, 130.8456), ep("Alice Springs NT", -23.698, 133.8807)),
];

const cases = [];
for (const routeCase of routes) {
  for (const fuel of fuels) {
    const result = await runCase(routeCase, fuel).catch((error) => ({
      id: `${routeCase.id}-${fuel.toLowerCase()}`,
      route: routeCase,
      fuel,
      status: "failed",
      failure: error instanceof Error ? error.message : String(error),
      warning: "",
    }));
    cases.push(result);
    console.log(`${result.status === "passed" ? "OK" : result.status === "warning" ? "WARN" : "FAIL"} ${routeCase.id} ${fuel}`);
  }
}

const summary = summarise(cases);
fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });
const jsonPath = path.join(evidenceDir, `route-output-benchmark-user-testing-${runId}.json`);
const reportPath = path.join(docsDir, `route-output-benchmark-user-testing-${reportDate}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, routes, cases }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport({ summary, cases, jsonPath, reportDate }));
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
if (summary.failed > 0) throw new Error(`${summary.failed}/${summary.cases} route output benchmark cases failed`);

async function runCase(routeCase, fuel) {
  const startedAt = Date.now();
  const response = await fetch(`${appUrl}/api/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "live",
      from: routeCase.from,
      to: routeCase.to,
      fuel,
      eligibleDiscounts: [],
      corridorKm: 2.5,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const elapsedMs = Date.now() - startedAt;
  if (!response.ok) throw new Error(`/api/score HTTP ${response.status}`);
  const payload = await response.json();
  const score = payload.score || payload;
  const context = score.context || {};
  const best = score.recommendations?.[0];
  return {
    id: `${routeCase.id}-${fuel.toLowerCase()}`,
    route: routeCase,
    fuel,
    status: best ? "passed" : "warning",
    elapsedMs,
    routeKm: numberOrNull(payload.route?.distanceKm || context.routeDistanceKm),
    provider: context.provider || "",
    source: context.source || "",
    capability: context.capability || "",
    cacheAgeSeconds: numberOrNull(context.cacheAgeSeconds),
    cacheMode: context.cacheMode || "",
    degraded: Boolean(context.degraded),
    warning: context.warning || "",
    providerCaveat: providerCaveat(context, best),
    recommendation: best ? recommendationSummary(best, context) : null,
    rawContext: {
      eligibleCandidates: context.eligibleCandidates,
      baselineCpl: context.baselineCpl,
      generatedAt: context.generatedAt,
      decisionSummary: context.decisionSummary,
    },
  };
}

function recommendationSummary(best, context) {
  const adjustedCpl = numberOrNull(best.adjustedCpl);
  const comparisonCpl = numberOrNull(context?.decisionSummary?.economics?.comparisonCpl);
  const detourMinutes = numberOrNull(
    best.actualDetour?.detourMinutes ??
      context?.decisionSummary?.economics?.detourMinutes ??
      best.detourMinutes,
  );
  return {
    stationCode: best.station?.stationCode || "",
    stationName: best.station?.name || "",
    suburb: best.station?.suburb || "",
    brand: best.station?.brand || "",
    fuel: best.fuel || context?.fuel || "",
    adjustedCpl,
    pumpCpl: numberOrNull(best.pumpCpl),
    detourMinutes,
    bestPriceByCpl: Number.isFinite(comparisonCpl) && Number.isFinite(adjustedCpl)
      ? Math.max(0, comparisonCpl - adjustedCpl)
      : null,
    comparisonCpl,
    priceMatch: priceMatch(best, context),
  };
}

function providerCaveat(context, best) {
  const parts = [];
  const provider = providerLabel(context.provider || context.source);
  if (provider) parts.push(provider);
  if (context.capability && context.capability !== "live") parts.push(`${context.capability} data`);
  if (context.degraded) parts.push("provider degraded");
  const cache = cacheLabel(context);
  if (cache) parts.push(cache);
  const match = best ? priceMatch(best, context) : "";
  if (match) parts.push(match);
  if (context.warning) parts.push(cleanWarning(context.warning));
  const uniqueParts = Array.from(new Set(parts.filter(Boolean)));
  if (!uniqueParts.length) return "Live provider context returned no caveat.";
  return uniqueParts.join("; ");
}

function priceMatch(best, context) {
  if (!best) return "";
  const requested = best.requestedFuel || context?.requestedFuel || context?.fuel || "";
  const shown = best.fuel || best.matchedFuel || best.station?.matchedFuel || "";
  if (best.exactFuelMatch === false && requested && shown && requested !== shown) {
    return `${requested} unavailable; showing ${shown}`;
  }
  if (context?.capability === "fallback" || /fallback|sample|demo/i.test(`${context?.source || ""} ${best.station?.source || ""}`)) {
    return `fallback ${shown || requested || "fuel"} price`;
  }
  return `exact ${shown || requested || "fuel"} price`;
}

function cacheLabel(context) {
  const age = Number(context.cacheAgeSeconds);
  const mode = context.cacheMode ? context.cacheMode.replace(/_/g, " ") : "";
  if (!Number.isFinite(age) || age < 0) return mode;
  return `${mode || "cache"} ${formatAge(age)}`;
}

function providerLabel(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  const parts = text.split("+").filter(Boolean);
  if (parts.length > 1) return `${parts.map(providerLabel).filter(Boolean).join(" + ")}`;
  if (text.includes("nsw")) return "NSW FuelCheck";
  if (text.includes("vic")) return "VIC Servo Saver";
  if (text.includes("qld")) return "Queensland Fuel Prices";
  if (text.includes("wa")) return "WA FuelWatch";
  if (text.includes("sa")) return "SA Fuel Pricing";
  if (text.includes("tas")) return "TAS FuelCheck";
  if (text.includes("nt")) return "MyFuel NT";
  if (text.includes("sample") || text.includes("fallback")) return "Fallback data";
  return text.replace(/^api_/, "").replace(/_/g, " ");
}

function summarise(results) {
  return {
    runId,
    appUrl,
    fuels,
    cases: results.length,
    passed: results.filter((item) => item.status === "passed").length,
    warnings: results.filter((item) => item.status === "warning").length,
    failed: results.filter((item) => item.status === "failed").length,
    recommendations: results.filter((item) => item.recommendation).length,
    noRecommendation: results.filter((item) => !item.recommendation).length,
  };
}

function renderReport({ summary, cases, jsonPath, reportDate }) {
  const rows = cases.map((item) => {
    const rec = item.recommendation;
    return [
      item.route.region,
      `${item.route.from.label} to ${item.route.to.label}`,
      item.fuel,
      rec ? `${rec.stationName}${rec.suburb ? `, ${rec.suburb}` : ""}` : "No recommendation",
      rec ? `${formatCpl(rec.adjustedCpl)} ${rec.fuel}` : "-",
      rec ? formatMinutes(rec.detourMinutes) : "-",
      rec ? formatCpl(rec.bestPriceByCpl) : "-",
      item.providerCaveat || item.warning || item.failure || "-",
    ];
  });
  return `# Route Output Benchmark For Driver Testing

Date: ${reportDate}

Production surface: ${summary.appUrl}

Raw evidence: \`${path.relative(process.cwd(), jsonPath)}\`

## TLDR

Fuel Path returned ${summary.recommendations}/${summary.cases} route recommendations across the national driver-test route set using ${summary.fuels.join(" and ")}. ${summary.noRecommendation ? `${summary.noRecommendation} ${summary.noRecommendation === 1 ? "case returned" : "cases returned"} no recommendation and should be treated as explicit coverage/product caveats in driver testing.` : "Every case returned a top recommendation."}

Use this as the recruited-driver evidence pack: ask drivers whether the top stop, detour, best-price-by value and provider caveat are enough to trust or reject the recommendation.

## Method

- Route set: Sydney-Newcastle, Canberra-Sydney, Melbourne-Ballarat, Brisbane-Longreach, Perth-Broome, Adelaide-Coober Pedy, Hobart-Strahan, Darwin-Alice Springs.
- Fuels: ${summary.fuels.join(", ")}.
- API: production \`/api/score\`, live source, no selected discounts.
- Output captured: top recommendation, displayed fuel price, detour, best-price-by c/L, provider/source caveat.

## Route Outputs

| Region | Route | Fuel | Top recommendation | Price | Detour | Best price by | Provider caveat |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
${rows.map((row) => `| ${row.map(escapeTable).join(" | ")} |`).join("\n")}

## Driver Testing Prompts

- Would you trust this stop enough to navigate there? Why or why not?
- Is the detour small enough for the saving shown?
- Is \`Best price by\` clear, or does it need a comparison explanation?
- Does the provider caveat increase trust or create hesitation?
- For no-recommendation or alternative-fuel cases, is the explanation clear enough to avoid a bad trip decision?

## Product Read

- Keep the recommendation card focused on station, price, detour and best-price-by.
- Keep provider/source caveats visible in evidence, especially WA timing, stale cache, unsupported provider and NT exact-fuel gaps.
- Treat no-recommendation cases as research material, not failures to hide. They tell us where users need fallback guidance.
`;
}

function route(id, region, from, to) { return { id, region, from, to }; }
function ep(label, lat, lon) { return { label, lat, lon }; }
function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function formatCpl(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} c/L` : "-";
}
function formatMinutes(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} min` : "-";
}
function formatAge(seconds) {
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
function cleanWarning(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
function escapeTable(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}
