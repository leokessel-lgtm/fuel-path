import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { performance } from "perf_hooks";

const require = createRequire(import.meta.url);
const { regionalLocalGeocode } = require("../api/_regionalGeocodeHints.js");

const TARGET_SEARCHES = Number.parseInt(process.env.FUEL_PATH_NATIONAL_PLACE_SEARCHES || "10000", 10);
const MODE = process.env.FUEL_PATH_NATIONAL_PLACE_MODE || "local";
const API_BASE = process.env.FUEL_PATH_API_BASE || "https://fuel-path.vercel.app";
const DELAY_MS = Number.parseInt(process.env.FUEL_PATH_NATIONAL_PLACE_DELAY_MS || (MODE === "http" ? "50" : "0"), 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.FUEL_PATH_NATIONAL_PLACE_REQUEST_TIMEOUT_MS || "8000", 10);
const PROGRESS_EVERY = Number.parseInt(process.env.FUEL_PATH_NATIONAL_PLACE_PROGRESS_EVERY || (MODE === "http" ? "50" : "0"), 10);

const CASES = [
  caseItem("Katoomba", "Katoomba", "NSW"),
  caseItem("Leura", "Leura", "NSW"),
  caseItem("Wentworth Falls", "Wentworth Falls", "NSW"),
  caseItem("Blackheath", "Blackheath", "NSW"),
  caseItem("Springwood", "Springwood", "NSW"),
  caseItem("Faulconbridge", "Faulconbridge", "NSW"),
  caseItem("Blaxland", "Blaxland", "NSW"),
  caseItem("Emu Plains", "Emu Plains", "NSW"),
  caseItem("Penrith", "Penrith", "NSW"),
  caseItem("Lithgow", "Lithgow", "NSW"),
  caseItem("Bowral", "Bowral", "NSW"),
  caseItem("Nowra", "Nowra", "NSW"),
  caseItem("Hyde Park", "Hyde Park", "NSW", ["hide park", "hyde park sydney"]),
  caseItem("Hyde Park Sydney", "Hyde Park", "NSW"),
  caseItem("Service NSW", "Service NSW", "NSW"),
  caseItem("Service NSW Parramatta", "Service NSW Parramatta", "NSW"),
  caseItem("Centrelink Blacktown", "Centrelink Blacktown", "NSW"),
  caseItem("Medicare Parramatta", "Medicare Parramatta", "NSW"),
  caseItem("Royal Botanic Garden Sydney", "Royal Botanic Garden Sydney", "NSW"),
  caseItem("Barangaroo", "Barangaroo", "NSW"),
  caseItem("The Rocks", "The Rocks", "NSW"),
  caseItem("Circular Quay", "Circular Quay", "NSW"),
  caseItem("Footscray", "Footscray", "VIC"),
  caseItem("Dandenong", "Dandenong", "VIC"),
  caseItem("Frankston", "Frankston", "VIC"),
  caseItem("Ringwood", "Ringwood", "VIC"),
  caseItem("Sunbury", "Sunbury", "VIC"),
  caseItem("Melton", "Melton", "VIC"),
  caseItem("Federation Square", "Federation Square", "VIC", ["fed square"]),
  caseItem("Royal Botanic Gardens Victoria", "Royal Botanic Gardens Victoria", "VIC"),
  caseItem("Service Victoria Bendigo", "Service Victoria Bendigo", "VIC"),
  caseItem("Chermside", "Chermside", "QLD"),
  caseItem("Maroochydore", "Maroochydore", "QLD"),
  caseItem("Noosa Heads", "Noosa Heads", "QLD"),
  caseItem("Robina", "Robina", "QLD"),
  caseItem("Loganholme", "Loganholme", "QLD"),
  caseItem("South Bank Parklands", "South Bank Parklands", "QLD"),
  caseItem("Service Queensland Brisbane", "Service Queensland Brisbane", "QLD"),
  caseItem("Joondalup", "Joondalup", "WA"),
  caseItem("Busselton", "Busselton", "WA"),
  caseItem("Ellenbrook", "Ellenbrook", "WA"),
  caseItem("Morley", "Morley", "WA"),
  caseItem("Kings Park", "Kings Park", "WA", ["kings park perth"]),
  caseItem("ServiceWA Perth", "ServiceWA Perth", "WA", ["service wa perth", "servicewa"]),
  caseItem("Glenelg", "Glenelg", "SA"),
  caseItem("Elizabeth", "Elizabeth", "SA"),
  caseItem("Salisbury", "Salisbury", "SA"),
  caseItem("Rundle Mall", "Rundle Mall", "SA"),
  caseItem("Service SA Adelaide", "Service SA Adelaide", "SA"),
  caseItem("Salamanca", "Salamanca", "TAS"),
  caseItem("Glenorchy", "Glenorchy", "TAS"),
  caseItem("Moonah", "Moonah", "TAS"),
  caseItem("Salamanca Market", "Salamanca Market", "TAS"),
  caseItem("Service Tasmania Hobart", "Service Tasmania Hobart", "TAS"),
  caseItem("Darwin", "Darwin", "NT"),
  caseItem("Casuarina", "Casuarina", "NT"),
  caseItem("Nightcliff", "Nightcliff", "NT"),
  caseItem("Litchfield National Park", "Litchfield National Park", "NT"),
  caseItem("NT government service centre", "Territory Families Housing and Communities Darwin", "NT"),
  caseItem("Canberra City", "Canberra City", "ACT"),
  caseItem("Yarralumla", "Yarralumla", "ACT"),
  caseItem("Griffith ACT", "Griffith", "ACT"),
  caseItem("Parliament House Canberra", "Parliament House", "ACT"),
  caseItem("Access Canberra", "Access Canberra", "ACT"),
];

const VARIANTS = [
  (query) => query,
  (query, state) => `${query} ${state}`,
  (query) => `${query} Australia`,
  (query, state) => `${query}, ${state}`,
  (query) => query.toLowerCase(),
  (query) => query.toUpperCase(),
  (query) => `${query} town centre`,
  (query) => `${query} city centre`,
  (query, _state, aliases) => aliases[0] || query,
  (query, state, aliases) => aliases[0] ? `${aliases[0]} ${state}` : `${query} ${state}`,
];

const failures = [];
const samples = [];
const latencies = [];
const stateCounts = new Map();
const providerCounts = new Map();
const lookupStatusCounts = new Map();
const fastPathCounts = new Map();
const startedAt = new Date();
const started = performance.now();

for (let index = 0; index < TARGET_SEARCHES; index += 1) {
  const base = CASES[index % CASES.length];
  const variant = VARIANTS[Math.floor(index / CASES.length) % VARIANTS.length];
  const query = variant(base.query, base.state, base.aliases);
  const before = performance.now();
  const payload = await lookup(query, index);
  const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
  const durationMs = performance.now() - before;
  latencies.push(durationMs);

  const top = suggestions[0] || null;
  const ok = top && topMatches(top.label, base);
  stateCounts.set(base.state, (stateCounts.get(base.state) || 0) + 1);
  providerCounts.set(top?.provider || "none", (providerCounts.get(top?.provider || "none") || 0) + 1);
  lookupStatusCounts.set(payload.lookupStatus || "unknown", (lookupStatusCounts.get(payload.lookupStatus || "unknown") || 0) + 1);
  fastPathCounts.set(payload.fastPath || "none", (fastPathCounts.get(payload.fastPath || "none") || 0) + 1);

  if (!ok) {
    failures.push({
      query,
      expected: `${base.expected} ${base.state}`,
      top: top?.label || "",
      count: suggestions.length,
    });
  }

  if (samples.length < 24 && (index % Math.ceil(TARGET_SEARCHES / 24) === 0 || base.query === "Service NSW")) {
    samples.push({
      query,
      top: top?.label || "",
      provider: top?.provider || "",
      kind: top?.kind || "",
      lookupStatus: payload.lookupStatus || "",
      fastPath: payload.fastPath || "",
    });
  }

  if (DELAY_MS) await sleep(DELAY_MS);
  if (PROGRESS_EVERY > 0 && (index + 1) % PROGRESS_EVERY === 0) {
    console.log(`progress ${index + 1}/${TARGET_SEARCHES} passed=${index + 1 - failures.length} failed=${failures.length}`);
  }
}

const endedAt = new Date();
const totalMs = performance.now() - started;
latencies.sort((a, b) => a - b);

const unsafeServiceMatches = samples.filter((sample) => normalise(sample.query).includes("service nsw") && /health service/i.test(sample.top));
const summary = {
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  mode: MODE,
  apiBase: MODE === "http" ? API_BASE : "",
  totalSearches: TARGET_SEARCHES,
  passed: TARGET_SEARCHES - failures.length,
  failed: failures.length,
  passRate: Number((((TARGET_SEARCHES - failures.length) / TARGET_SEARCHES) * 100).toFixed(2)),
  statesCovered: Object.fromEntries([...stateCounts.entries()].sort()),
  providerCounts: Object.fromEntries([...providerCounts.entries()].sort()),
  lookupStatusCounts: Object.fromEntries([...lookupStatusCounts.entries()].sort()),
  fastPathCounts: Object.fromEntries([...fastPathCounts.entries()].sort()),
  latencyMs: {
    p50: percentile(latencies, 50),
    p90: percentile(latencies, 90),
    p95: percentile(latencies, 95),
    max: Number((latencies.at(-1) || 0).toFixed(3)),
    total: Number(totalMs.toFixed(3)),
  },
  unsafeServiceMatches: unsafeServiceMatches.length,
  samples,
  failures: failures.slice(0, 30),
};

mkdirSync("tmp", { recursive: true });
const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
const jsonPath = join("tmp", `geocode-national-place-10k-stress-${stamp}.json`);
const mdPath = join("tmp", `geocode-national-place-10k-stress-${stamp}.md`);
writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(mdPath, markdownReport(summary, jsonPath));

console.log(`National place autocomplete 10k stress: ${summary.passed}/${summary.totalSearches} passed (${summary.passRate}%)`);
console.log(`Mode: ${summary.mode}${summary.apiBase ? ` (${summary.apiBase})` : ""}`);
console.log(`States covered: ${Object.keys(summary.statesCovered).join(", ")}`);
console.log(`Providers: ${JSON.stringify(summary.providerCounts)}`);
console.log(`Fast paths: ${JSON.stringify(summary.fastPathCounts)}`);
console.log(`Latency: p50 ${summary.latencyMs.p50} ms, p90 ${summary.latencyMs.p90} ms, p95 ${summary.latencyMs.p95} ms, max ${summary.latencyMs.max} ms`);
console.log(`Report: ${mdPath}`);

if (failures.length > 0 || unsafeServiceMatches.length > 0) {
  console.error(JSON.stringify({ failures: summary.failures, unsafeServiceMatches }, null, 2));
  process.exitCode = 1;
}

function caseItem(query, expected, state, aliases = []) {
  return { query, expected, state, aliases };
}

async function lookup(query, index) {
  if (MODE === "local") {
    return {
      suggestions: regionalLocalGeocode(query, 5),
      lookupStatus: "ok",
      fastPath: "local_autocomplete",
    };
  }
  if (MODE !== "http") throw new Error(`Unsupported mode: ${MODE}`);
  const url = new URL("/api/geocode", API_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("provider", "auto");
  url.searchParams.set("sessionToken", `national-place-${startedAt.toISOString()}-${index}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await Promise.race([
      fetch(url, { signal: controller.signal }),
      sleep(REQUEST_TIMEOUT_MS).then(() => {
        controller.abort();
        return null;
      }),
    ]);
    if (!response) {
      return { suggestions: [], lookupStatus: "request_timeout", warning: `Timed out after ${REQUEST_TIMEOUT_MS}ms` };
    }
    if (!response.ok) {
      return { suggestions: [], lookupStatus: "http_error", warning: `HTTP ${response.status}` };
    }
    return await Promise.race([
      response.json(),
      sleep(REQUEST_TIMEOUT_MS).then(() => ({ suggestions: [], lookupStatus: "response_timeout", warning: `Timed out reading response after ${REQUEST_TIMEOUT_MS}ms` })),
    ]);
  } catch (error) {
    return {
      suggestions: [],
      lookupStatus: error?.name === "AbortError" ? "request_timeout" : "request_error",
      warning: error?.message || String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function topMatches(label, base) {
  const text = normalise(label);
  const expected = normalise(base.expected);
  const state = normalise(base.state);
  const aliases = base.aliases.map(normalise);
  const detectedState = text.match(/\b(nsw|act|qld|wa|vic|sa|tas|nt)\b/)?.[1] || "";
  const expectedNameMatched = text.includes(expected) || aliases.some((alias) => alias && text.includes(alias));
  return expectedNameMatched && (!detectedState || detectedState === state);
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function percentile(values, pct) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.ceil((pct / 100) * values.length) - 1);
  return Number(values[index].toFixed(3));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function markdownReport(summary, jsonPath) {
  const sampleRows = summary.samples.map((sample) =>
    `| ${sample.query} | ${sample.top} | ${sample.provider} |`
  ).join("\n");
  const failureRows = summary.failures.length
    ? summary.failures.map((failure) => `| ${failure.query} | ${failure.expected} | ${failure.top || "(none)"} |`).join("\n")
    : "| None |  |  |";

  return `# National place autocomplete 10k stress

Generated: ${summary.endedAt}

## Result

- Searches: ${summary.totalSearches}
- Mode: ${summary.mode}${summary.apiBase ? ` (${summary.apiBase})` : ""}
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Pass rate: ${summary.passRate}%
- Unsafe Service NSW health-service matches: ${summary.unsafeServiceMatches}
- Latency p50: ${summary.latencyMs.p50} ms
- Latency p90: ${summary.latencyMs.p90} ms
- Latency p95: ${summary.latencyMs.p95} ms
- Latency max: ${summary.latencyMs.max} ms
- JSON evidence: ${jsonPath}

## State coverage

${Object.entries(summary.statesCovered).map(([state, count]) => `- ${state}: ${count}`).join("\n")}

## Provider counts

${Object.entries(summary.providerCounts).map(([provider, count]) => `- ${provider}: ${count}`).join("\n")}

## Fast path counts

${Object.entries(summary.fastPathCounts).map(([fastPath, count]) => `- ${fastPath}: ${count}`).join("\n")}

## Samples

| Query | Top suggestion | Provider |
| --- | --- | --- |
${sampleRows}

## First failures

| Query | Expected | Top suggestion |
| --- | --- | --- |
${failureRows}
`;
}
