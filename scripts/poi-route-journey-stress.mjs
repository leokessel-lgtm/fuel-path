import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const ROOT = process.cwd();
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const API_BASE = (process.env.FUEL_PATH_API_BASE || "https://fuel-path.vercel.app").replace(/\/$/, "");
const TOTAL = Number(process.env.FUEL_PATH_POI_ROUTE_TOTAL || 200);
const CONCURRENCY = Number(process.env.FUEL_PATH_POI_ROUTE_CONCURRENCY || 4);
const TIMEOUT_MS = Number(process.env.FUEL_PATH_POI_ROUTE_TIMEOUT_MS || 25000);
const FUEL = String(process.env.FUEL_PATH_POI_ROUTE_FUEL || "PDL").toUpperCase();
const USE_COMBINED_SCORE = process.env.FUEL_PATH_POI_ROUTE_LEGACY !== "1";
const MAX_TOTAL_P90_MS = optionalNumber(process.env.FUEL_PATH_POI_ROUTE_MAX_TOTAL_P90_MS);
const MAX_TOTAL_P95_MS = optionalNumber(process.env.FUEL_PATH_POI_ROUTE_MAX_TOTAL_P95_MS);
const MAX_TOTAL_MAX_MS = optionalNumber(process.env.FUEL_PATH_POI_ROUTE_MAX_TOTAL_MAX_MS);
const MIN_RECOMMENDATIONS = optionalNumber(process.env.FUEL_PATH_POI_ROUTE_MIN_RECOMMENDATIONS);
const POI_TYPES = new Set(["poi", "regional_poi", "airport", "venue", "university", "hospital", "beach", "station", "ferry_wharf", "park"]);
const STATE_ORDER = ["NSW", "ACT", "VIC", "QLD", "WA", "SA", "TAS", "NT"];
const geocodeCache = new Map();

const records = loadRecords().filter((record) => Number.isFinite(record.lat) && Number.isFinite(record.lon));
const cases = buildPairs(records, TOTAL);
const rows = [];

console.log(`Starting POI route journey stress: ${cases.length} journeys against ${API_BASE}`);
for (let start = 0; start < cases.length; start += CONCURRENCY) {
  const batch = cases.slice(start, start + CONCURRENCY);
  rows.push(...await Promise.all(batch.map((testCase, index) => runCase(testCase, start + index + 1))));
  const summary = summarise(rows);
  console.log(`${rows.length}/${cases.length} pass=${summary.passed} fail=${summary.failed} geocodeFail=${summary.geocodeFailures} routeFail=${summary.routeFailures} scoreFail=${summary.scoreFailures} p90=${summary.latencyMs.p90}`);
}

const summary = summarise(rows);
const budgetFailures = budgetFailureMessages(summary);
const payload = {
  runId: RUN_ID,
  apiBase: API_BASE,
  totalRequested: TOTAL,
  concurrency: CONCURRENCY,
  caseTimeoutMs: TIMEOUT_MS,
  mode: USE_COMBINED_SCORE ? "combined /api/score" : "legacy /api/route plus /api/score",
  summary: { ...summary, budgetFailures },
  coverage: coverage(rows),
  failures: rows.filter((row) => row.status === "failed").slice(0, 80),
  rows,
};
fs.mkdirSync(path.join(ROOT, "tmp"), { recursive: true });
const jsonPath = path.join(ROOT, "tmp", `poi-route-journey-stress-${RUN_ID}.json`);
const mdPath = path.join(ROOT, "tmp", `poi-route-journey-stress-${RUN_ID}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(mdPath, renderReport(payload));
console.log(`JSON ${jsonPath}`);
console.log(`Report ${mdPath}`);
console.log(JSON.stringify(payload.summary, null, 2));
if (summary.failed) process.exitCode = 1;
if (budgetFailures.length) throw new Error(`POI route journey budget failed: ${budgetFailures.join("; ")}`);

function loadRecords() {
  const rows = [];
  for (const sourceFile of ["api/_geocodeHints.js", "api/_regionalGeocodeHints.js"]) {
    const sourcePath = path.join(ROOT, sourceFile);
    if (!fs.existsSync(sourcePath)) continue;
    const source = fs.readFileSync(sourcePath, "utf8");
    for (const match of source.matchAll(/\bhint\("([^"]+)",\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*"([^"]+)"/g)) {
      const [, label, lat, lon, type] = match;
      if (POI_TYPES.has(type)) rows.push(record(sourceFile, label, Number(lat), Number(lon), type));
    }
  }
  const seen = new Set();
  return rows.filter((row) => {
    const key = normalise(row.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function record(source, label, lat, lon, type) {
  return {
    label,
    lat,
    lon,
    source,
    state: stateFromLabel(label),
    primary: label.split(",")[0].trim(),
    type,
  };
}

function buildPairs(records, total) {
  const byState = Object.fromEntries(STATE_ORDER.map((state) => [state, records.filter((record) => record.state === state)]));
  const pairs = [];
  for (const state of STATE_ORDER) {
    const stateRecords = byState[state] || [];
    for (let index = 0; index < stateRecords.length - 1 && pairs.length < total; index += 1) {
      pairs.push({
        id: `${state}-${index + 1}`,
        state,
        from: stateRecords[index],
        to: stateRecords[(index + 3) % stateRecords.length] || stateRecords[index + 1],
        kind: "same_state",
      });
    }
  }
  let index = 0;
  while (pairs.length < total) {
    const from = records[index % records.length];
    const to = records[(index * 7 + 13) % records.length];
    if (from.label !== to.label) {
      pairs.push({
        id: `cross-${pairs.length + 1}`,
        state: `${from.state}->${to.state}`,
        from,
        to,
        kind: "cross_state",
      });
    }
    index += 1;
  }
  return pairs.slice(0, total);
}

async function runCase(testCase, index) {
  const started = performance.now();
  const failures = [];
  const timings = {};
  let fromGeo = null;
  let toGeo = null;
  let route = null;
  let score = null;
  try {
    fromGeo = await timed(() => geocode(testCase.from, index, "from"), timings, "fromGeocode");
    toGeo = await timed(() => geocode(testCase.to, index, "to"), timings, "toGeocode");
    if (!match(testCase.from, fromGeo?.suggestions?.[0])) failures.push(`from geocode top mismatch: ${fromGeo?.suggestions?.[0]?.label || "none"}`);
    if (!match(testCase.to, toGeo?.suggestions?.[0])) failures.push(`to geocode top mismatch: ${toGeo?.suggestions?.[0]?.label || "none"}`);
    const from = fromGeo?.suggestions?.[0] || fromGeo?.location;
    const to = toGeo?.suggestions?.[0] || toGeo?.location;
    if (!from?.lat || !from?.lon || !to?.lat || !to?.lon) throw new Error("missing geocoded coordinates");
    if (USE_COMBINED_SCORE) {
      const combined = await timed(() => postPlanScore(from, to), timings, "combinedScore");
      route = combined.route;
      score = combined.score;
    } else {
      route = await timed(() => fetchRoute(from, to), timings, "route");
      score = await timed(() => postScore(route), timings, "score");
    }
    if (!Number.isFinite(Number(route?.distanceKm)) || Number(route.distanceKm) <= 0) failures.push("route distance missing");
    if (!Array.isArray(route?.points) || route.points.length < 2) failures.push("route points missing");
    if (!score?.context) failures.push("score context missing");
  } catch (error) {
    failures.push(error?.message || String(error));
  }
  const elapsedMs = Math.round(performance.now() - started);
  const phaseFailure = classifyFailure(failures);
  return {
    id: testCase.id,
    elapsedMs,
    failures,
    from: testCase.from.label,
    fromTop: fromGeo?.suggestions?.[0]?.label || "",
    kind: testCase.kind,
    mode: USE_COMBINED_SCORE ? "combined" : "legacy",
    phaseFailure,
    provider: score?.context?.provider || "",
    recommendations: score?.recommendations?.length || 0,
    routeKm: route?.distanceKm ?? null,
    state: testCase.state,
    status: failures.length ? "failed" : "passed",
    timings,
    to: testCase.to.label,
    toTop: toGeo?.suggestions?.[0]?.label || "",
  };
}

async function geocode(record, index, side) {
  const query = queryFor(record);
  const cacheKey = normalise(query);
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);
  const payload = await fetchJsonWithRetry(`${API_BASE}/api/geocode`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      q: query,
      limit: 5,
      sessionToken: `poi-route-${RUN_ID}-${index}-${side}`,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }, `${side} geocode`);
  geocodeCache.set(cacheKey, payload);
  return payload;
}

async function fetchRoute(from, to) {
  const params = new URLSearchParams({
    fromLat: String(from.lat),
    fromLon: String(from.lon),
    fromLabel: from.label,
    toLat: String(to.lat),
    toLon: String(to.lon),
    toLabel: to.label,
  });
  return fetchJsonWithRetry(`${API_BASE}/api/route?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) }, "route");
}

async function postPlanScore(from, to) {
  return fetchJsonWithRetry(`${API_BASE}/api/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "live",
      from,
      to,
      fuel: FUEL,
      eligibleDiscounts: ["fleet-card", "everyday-rewards"],
      corridorKm: 2.5,
      detourSpeedKmh: 80,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }, "combined score");
}

async function postScore(route) {
  return fetchJsonWithRetry(`${API_BASE}/api/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fuel: FUEL,
      route,
      eligibleDiscounts: ["fleet-card", "everyday-rewards"],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }, "score");
}

async function fetchJsonWithRetry(url, init, label) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const payload = await response.json();
      if (!response.ok) throw new Error(`${label} HTTP ${response.status}: ${payload?.error || response.statusText}`);
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt >= 2 || !retriableFetchError(error)) break;
      await delay(250);
    }
  }
  throw new Error(`${label} failed: ${lastError?.message || String(lastError)}`);
}

function retriableFetchError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /fetch failed|timed out|network|ECONN|ETIMEDOUT|EAI_AGAIN|socket|HTTP 408|HTTP 429|HTTP 5\d\d/i.test(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function timed(fn, timings, key) {
  const started = performance.now();
  const result = await fn();
  timings[key] = Math.round(performance.now() - started);
  return result;
}

function queryFor(record) {
  return record.type === "station" ? `${record.primary} ${record.state}` : record.label;
}

function match(record, suggestion) {
  if (!suggestion) return false;
  const label = normalise(suggestion.label || "");
  const expected = normalise(record.label);
  const primary = normalise(record.primary);
  const stateOk = record.state ? label.includes(normalise(record.state)) : true;
  return label === expected || (primary.length >= 5 && label.includes(primary) && stateOk);
}

function classifyFailure(failures) {
  const text = failures.join(" ").toLowerCase();
  if (text.includes("geocode")) return "geocode";
  if (text.includes("route")) return "route";
  if (text.includes("score")) return "score";
  return failures.length ? "other" : "";
}

function summarise(rows) {
  const elapsed = rows.map((row) => row.elapsedMs).sort((left, right) => left - right);
  return {
    cases: rows.length,
    passed: rows.filter((row) => row.status === "passed").length,
    failed: rows.filter((row) => row.status === "failed").length,
    geocodeFailures: rows.filter((row) => row.phaseFailure === "geocode").length,
    routeFailures: rows.filter((row) => row.phaseFailure === "route").length,
    scoreFailures: rows.filter((row) => row.phaseFailure === "score").length,
    recommendationsReturned: rows.filter((row) => row.recommendations > 0).length,
    latencyMs: {
      p50: percentile(elapsed, 50),
      p90: percentile(elapsed, 90),
      p95: percentile(elapsed, 95),
      max: elapsed.at(-1) || null,
    },
    byState: group(rows, "state"),
    byKind: group(rows, "kind"),
  };
}

function budgetFailureMessages(summary) {
  const failures = [];
  if (Number.isFinite(MAX_TOTAL_P90_MS) && Number(summary.latencyMs.p90) > MAX_TOTAL_P90_MS) {
    failures.push(`total p90 ${summary.latencyMs.p90}ms above ${MAX_TOTAL_P90_MS}ms`);
  }
  if (Number.isFinite(MAX_TOTAL_P95_MS) && Number(summary.latencyMs.p95) > MAX_TOTAL_P95_MS) {
    failures.push(`total p95 ${summary.latencyMs.p95}ms above ${MAX_TOTAL_P95_MS}ms`);
  }
  if (Number.isFinite(MAX_TOTAL_MAX_MS) && Number(summary.latencyMs.max) > MAX_TOTAL_MAX_MS) {
    failures.push(`total max ${summary.latencyMs.max}ms above ${MAX_TOTAL_MAX_MS}ms`);
  }
  if (Number.isFinite(MIN_RECOMMENDATIONS) && Number(summary.recommendationsReturned) < MIN_RECOMMENDATIONS) {
    failures.push(`recommendations ${summary.recommendationsReturned} below ${MIN_RECOMMENDATIONS}`);
  }
  return failures;
}

function group(rows, field) {
  return Object.fromEntries([...new Set(rows.map((row) => row[field] || "unknown"))].sort().map((key) => {
    const subset = rows.filter((row) => (row[field] || "unknown") === key);
    return [key, {
      cases: subset.length,
      failed: subset.filter((row) => row.status === "failed").length,
      passed: subset.filter((row) => row.status === "passed").length,
      p90Ms: percentile(subset.map((row) => row.elapsedMs).sort((left, right) => left - right), 90),
    }];
  }));
}

function coverage(rows) {
  return {
    kind: group(rows, "kind"),
    state: group(rows, "state"),
  };
}

function renderReport(payload) {
  const summary = payload.summary;
  return `# POI route journey stress\n\nRun: ${payload.runId}\nAPI: ${payload.apiBase}\nMode: ${payload.mode}\n\n## Summary\n\n- Cases: ${summary.cases}\n- Passed: ${summary.passed}\n- Failed: ${summary.failed}\n- Geocode/route/score failures: ${summary.geocodeFailures}/${summary.routeFailures}/${summary.scoreFailures}\n- Recommendations returned: ${summary.recommendationsReturned}\n- Latency p50/p90/p95/max: ${summary.latencyMs.p50}/${summary.latencyMs.p90}/${summary.latencyMs.p95}/${summary.latencyMs.max} ms\n- Budget failures: ${summary.budgetFailures.length ? summary.budgetFailures.join("; ") : "None"}\n\n## Failures\n\n| id | state | from | to | phase | failures |\n| --- | --- | --- | --- | --- | --- |\n${payload.failures.map((row) => `| ${esc(row.id)} | ${esc(row.state)} | ${esc(row.from)} | ${esc(row.to)} | ${esc(row.phaseFailure)} | ${esc(row.failures.join("; "))} |`).join("\n") || "| | | | | | None |"}\n`;
}

function stateFromLabel(label) {
  return (String(label).match(/\b(NSW|ACT|VIC|QLD|WA|SA|TAS|NT)\b/) || [])[1] || "unknown";
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function optionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function esc(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}
