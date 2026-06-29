import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);

process.env.FUEL_PATH_GEOCODE_PROVIDER = process.env.FUEL_PATH_GEOCODE_PROVIDER || "nominatim";

installProviderFailure();

const { geocode } = require("../api/_backend");

const LIMIT = Number(process.env.FUEL_PATH_ROUTE_FIELD_LIMIT || 5);
const MIN_CHARS = Number(process.env.FUEL_PATH_ROUTE_FIELD_MIN_CHARS || 3);
const STATE_SYNONYMS = {
  nsw: ["nsw", "new south wales"],
  act: ["act", "australian capital territory"],
  vic: ["vic", "victoria"],
  qld: ["qld", "queensland"],
  wa: ["wa", "western australia"],
  sa: ["sa", "south australia"],
  tas: ["tas", "tasmania"],
  nt: ["nt", "northern territory"],
};
const ENDPOINTS = [
  ep("syd-cbd", "NSW", "Sydney CBD NSW", ["sydney", "nsw"], "capital"),
  ep("bondi", "NSW", "Bondi Beach NSW", ["bondi", "nsw"], "poi"),
  ep("parramatta", "NSW", "Parramatta NSW", ["parramatta", "nsw"], "regional"),
  ep("newcastle", "NSW", "Newcastle NSW", ["newcastle", "nsw"], "regional"),
  ep("wollongong", "NSW", "Wollongong NSW", ["wollongong", "nsw"], "regional"),
  ep("dubbo", "NSW", "Dubbo NSW", ["dubbo", "nsw"], "regional"),
  ep("coffs", "NSW", "Coffs Harbour NSW", ["coffs", "nsw"], "regional"),
  ep("syd-airport", "NSW", "Sydney Airport NSW", ["sydney airport", "nsw"], "airport"),
  ep("sylvania-addr", "NSW", "66B Easton Avenue Sylvania NSW 2224", ["easton", "sylvania", "nsw"], "address"),
  ep("artarmon-typo", "NSW", "Artamon NSW", ["artarmon", "nsw"], "typo"),
  ep("moree", "NSW", "Moree NSW", ["moree", "nsw"], "remote"),

  ep("canberra", "ACT", "Canberra ACT", ["canberra", "act"], "capital"),
  ep("canberra-centre", "ACT", "Canberra Centre ACT", ["canberra centre"], "poi"),
  ep("braddon", "ACT", "Braddon ACT", ["braddon", "act"], "suburb"),
  ep("belconnen", "ACT", "Belconnen ACT", ["belconnen", "act"], "suburb"),
  ep("tuggeranong", "ACT", "Tuggeranong ACT", ["tuggeranong", "act"], "suburb"),

  ep("mel-cbd", "VIC", "Melbourne CBD VIC", ["melbourne", "vic"], "capital"),
  ep("mel-airport", "VIC", "Melbourne Airport VIC", ["melbourne airport", "vic"], "airport"),
  ep("geelong", "VIC", "Geelong VIC", ["geelong", "vic"], "regional"),
  ep("ballarat", "VIC", "Ballarat VIC", ["ballarat", "vic"], "regional"),
  ep("bendigo", "VIC", "Bendigo VIC", ["bendigo", "vic"], "regional"),
  ep("mcg", "VIC", "Melbourne Cricket Ground VIC", ["melbourne cricket ground"], "poi"),
  ep("flinders", "VIC", "Flinders Street Station VIC", ["flinders", "vic"], "poi"),

  ep("brisbane", "QLD", "Brisbane CBD QLD", ["brisbane", "qld"], "capital"),
  ep("gold-coast", "QLD", "Gold Coast QLD", ["gold coast", "qld"], "regional"),
  ep("sunshine-coast", "QLD", "Sunshine Coast QLD", ["sunshine coast", "qld"], "regional"),
  ep("longreach", "QLD", "Longreach QLD", ["longreach", "qld"], "remote"),
  ep("cairns", "QLD", "Cairns QLD", ["cairns", "qld"], "regional"),
  ep("townsville", "QLD", "Townsville QLD", ["townsville", "qld"], "regional"),
  ep("toowoomba", "QLD", "Toowoomba QLD", ["toowoomba", "qld"], "regional"),
  ep("bris-airport", "QLD", "Brisbane Airport QLD", ["brisbane airport"], "airport"),
  ep("mount-isa", "QLD", "Mount Isa QLD", ["mount isa", "qld"], "remote"),

  ep("perth", "WA", "Perth CBD WA", ["perth", "wa"], "capital"),
  ep("fremantle", "WA", "Fremantle WA", ["fremantle", "wa"], "regional"),
  ep("bunbury", "WA", "Bunbury WA", ["bunbury", "wa"], "regional"),
  ep("geraldton", "WA", "Geraldton WA", ["geraldton", "wa"], "regional"),
  ep("kalgoorlie", "WA", "Kalgoorlie WA", ["kalgoorlie", "wa"], "regional"),
  ep("broome", "WA", "Broome WA", ["broome", "wa"], "remote"),
  ep("perth-airport", "WA", "Perth Airport WA", ["perth airport"], "airport"),
  ep("newman", "WA", "Newman WA", ["newman", "wa"], "remote"),

  ep("adelaide", "SA", "Adelaide CBD SA", ["adelaide", "sa"], "capital"),
  ep("mount-gambier", "SA", "Mount Gambier SA", ["mount gambier", "sa"], "regional"),
  ep("port-augusta", "SA", "Port Augusta SA", ["port augusta", "sa"], "regional"),
  ep("whyalla", "SA", "Whyalla SA", ["whyalla", "sa"], "regional"),
  ep("coober-pedy", "SA", "Coober Pedy SA", ["coober pedy", "sa"], "remote"),
  ep("rundle", "SA", "Rundle Mall Adelaide SA", ["rundle mall"], "poi"),
  ep("port-lincoln", "SA", "Port Lincoln SA", ["port lincoln", "sa"], "remote"),

  ep("hobart", "TAS", "Hobart CBD TAS", ["hobart", "tas"], "capital"),
  ep("launceston", "TAS", "Launceston TAS", ["launceston", "tas"], "regional"),
  ep("devonport", "TAS", "Devonport TAS", ["devonport", "tas"], "regional"),
  ep("burnie", "TAS", "Burnie TAS", ["burnie", "tas"], "regional"),
  ep("hobart-airport", "TAS", "Hobart Airport TAS", ["hobart airport"], "airport"),

  ep("darwin", "NT", "Darwin CBD NT", ["darwin", "nt"], "capital"),
  ep("alice", "NT", "Alice Springs NT", ["alice springs", "nt"], "remote"),
  ep("tennant", "NT", "Tennant Creek NT", ["tennant", "nt"], "remote"),
  ep("katherine", "NT", "Katherine NT", ["katherine", "nt"], "regional"),
  ep("palmerston", "NT", "Palmerston NT", ["palmerston", "nt"], "regional"),
  ep("darwin-airport", "NT", "Darwin Airport NT", ["darwin airport"], "airport"),
];

const rows = [];
for (const endpoint of ENDPOINTS) {
  rows.push(await assessEndpoint(endpoint));
}

const pairs = buildRoutePairs(rows, 100);
const charValues = rows.filter((row) => row.minChars).map((row) => row.minChars);
const top1CharValues = rows.filter((row) => row.firstTop1Chars).map((row) => row.firstTop1Chars);
const pairCharValues = pairs.filter((pair) => pair.totalChars).map((pair) => pair.totalChars);
const pairTop1CharValues = pairs.filter((pair) => pair.totalTop1Chars).map((pair) => pair.totalTop1Chars);
const summary = {
  runId: new Date().toISOString().replace(/[:.]/g, "-"),
  endpointCount: rows.length,
  routePairCount: pairs.length,
  usableEndpointPrefixes: rows.filter((row) => row.minChars).length,
  top1EndpointPrefixes: rows.filter((row) => row.firstTop1Chars).length,
  finalUsableEndpoints: rows.filter((row) => row.finalRank).length,
  prefixQuality: countBy(rows, "prefixQuality"),
  top1PrefixQuality: countBy(rows, "top1PrefixQuality"),
  finalQuality: countBy(rows, "finalQuality"),
  lookupStatus: countBy(rows, "lookupStatus"),
  providers: countBy(rows, "provider"),
  charsNeeded: {
    min: Math.min(...charValues),
    median: quantile(charValues, 0.5),
    p90: quantile(charValues, 0.9),
    max: Math.max(...charValues),
    average: Number((charValues.reduce((sum, value) => sum + value, 0) / charValues.length).toFixed(1)),
    nonUsable: rows.filter((row) => !row.minChars).length,
  },
  top1CharsNeeded: {
    min: Math.min(...top1CharValues),
    median: quantile(top1CharValues, 0.5),
    p90: quantile(top1CharValues, 0.9),
    max: Math.max(...top1CharValues),
    average: Number((top1CharValues.reduce((sum, value) => sum + value, 0) / top1CharValues.length).toFixed(1)),
    nonTop1: rows.filter((row) => !row.firstTop1Chars).length,
  },
  routePairs: {
    uniquePairs: new Set(pairs.map((pair) => `${pair.from}->${pair.to}`)).size,
    bothPrefixReady: pairs.filter((pair) => pair.ready).length,
    bothTop1PrefixReady: pairs.filter((pair) => pair.top1Ready).length,
    bothFullReady: pairs.filter((pair) => pair.fullReady).length,
    oneOrMoreMissingPrefix: pairs.filter((pair) => !pair.ready).length,
    oneOrMoreMissingTop1Prefix: pairs.filter((pair) => !pair.top1Ready).length,
    totalCharsMedian: quantile(pairCharValues, 0.5),
    totalCharsP90: quantile(pairCharValues, 0.9),
    totalCharsMax: pairCharValues.length ? Math.max(...pairCharValues) : null,
    totalTop1CharsMedian: quantile(pairTop1CharValues, 0.5),
    totalTop1CharsP90: quantile(pairTop1CharValues, 0.9),
    totalTop1CharsMax: pairTop1CharValues.length ? Math.max(...pairTop1CharValues) : null,
  },
  byState: summariseGroup(rows, "state"),
  byType: summariseGroup(rows, "type"),
  weakestEndpoints: rows
    .slice()
    .sort((left, right) => (right.minChars || 999) - (left.minChars || 999) || (right.firstRank || 999) - (left.firstRank || 999))
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      state: row.state,
      type: row.type,
      query: row.query,
      minChars: row.minChars,
      firstRank: row.firstRank,
      firstTop1Chars: row.firstTop1Chars,
      finalRank: row.finalRank,
      provider: row.provider,
    })),
  failures: rows.filter((row) => !row.finalRank).map((row) => row.query),
};

mkdirSync("tmp", { recursive: true });
const jsonPath = `tmp/geocode-route-field-stress-${summary.runId}.json`;
const reportPath = `tmp/geocode-route-field-stress-${summary.runId}.md`;
writeFileSync(jsonPath, `${JSON.stringify({ summary, endpoints: rows, routePairs: pairs }, null, 2)}\n`);
writeFileSync(reportPath, renderReport(summary, rows, pairs));

console.log(JSON.stringify(summary, null, 2));
console.log(`Route field stress JSON: ${jsonPath}`);
console.log(`Route field stress report: ${reportPath}`);

const errors = [];
if (summary.usableEndpointPrefixes !== summary.endpointCount) {
  errors.push(`Expected ${summary.endpointCount}/${summary.endpointCount} endpoint prefixes, got ${summary.usableEndpointPrefixes}`);
}
if (summary.finalUsableEndpoints !== summary.endpointCount) {
  errors.push(`Expected ${summary.endpointCount}/${summary.endpointCount} final endpoint matches, got ${summary.finalUsableEndpoints}`);
}
if (summary.routePairs.bothPrefixReady !== summary.routePairCount) {
  errors.push(`Expected ${summary.routePairCount}/${summary.routePairCount} route pairs ready from prefixes, got ${summary.routePairs.bothPrefixReady}`);
}
if (summary.routePairs.uniquePairs !== summary.routePairCount) {
  errors.push(`Expected ${summary.routePairCount}/${summary.routePairCount} unique route pairs, got ${summary.routePairs.uniquePairs}`);
}
if (summary.finalQuality.top1 !== summary.endpointCount) {
  errors.push(`Expected all final matches at rank 1, got ${summary.finalQuality.top1 || 0}`);
}
if (summary.charsNeeded.p90 > 3) {
  errors.push(`Expected p90 endpoint prefix chars <= 3, got ${summary.charsNeeded.p90}`);
}
if (errors.length) {
  throw new Error(errors.join("; "));
}

function ep(id, state, query, expected, type) {
  return { id, state, query, expected, type };
}

async function assessEndpoint(endpoint) {
  let firstProper = null;
  let firstTop1 = null;
  for (const length of candidateLengths(endpoint.query)) {
    const query = endpoint.query.slice(0, length).trimEnd();
    const result = await geocode({
      query,
      limit: LIMIT,
      sessionToken: `route-field-${endpoint.id}-${length}`,
    });
    const resultRank = rank(result, endpoint);
    if (resultRank) {
      firstProper ||= { length, rank: resultRank };
      if (resultRank === 1) {
        firstTop1 = { length, rank: resultRank };
        break;
      }
    }
  }
  const finalResult = await geocode({
    query: endpoint.query,
    limit: LIMIT,
    sessionToken: `route-field-${endpoint.id}-full`,
  });
  const finalRank = rank(finalResult, endpoint);
  return {
    ...endpoint,
    minChars: firstProper?.length || null,
    firstRank: firstProper?.rank || null,
    prefixQuality: quality(firstProper?.rank),
    firstTop1Chars: firstTop1?.length || null,
    top1PrefixQuality: firstTop1 ? "top1" : "miss",
    finalRank,
    finalQuality: quality(finalRank),
    lookupStatus: finalResult.lookupStatus,
    provider: finalResult.location?.provider || "",
  };
}

function candidateLengths(query) {
  const lengths = new Set([MIN_CHARS, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 24, 28, query.length]);
  for (const match of query.matchAll(/\s/g)) {
    lengths.add(match.index + 2);
  }
  return [...lengths].filter((length) => length >= MIN_CHARS && length <= query.length).sort((left, right) => left - right);
}

function buildRoutePairs(items, count) {
  const pairs = [];
  const seen = new Set();
  const offsets = [13, 7, 23, 17, 31, 5, 29, 11, 37, 19, 41, 3, 43, 2, 47];
  for (const offset of offsets) {
    for (let index = 0; index < items.length && pairs.length < count; index += 1) {
      const from = items[index];
      const to = items[(index + offset) % items.length];
      const key = `${from.id}->${to.id}`;
      if (from.id === to.id || seen.has(key)) continue;
      seen.add(key);
      pairs.push({
        from: from.id,
        to: to.id,
        ready: Boolean(from.minChars && to.minChars),
        top1Ready: Boolean(from.firstTop1Chars && to.firstTop1Chars),
        fullReady: Boolean(from.finalRank && to.finalRank),
        totalChars: from.minChars && to.minChars ? from.minChars + to.minChars : null,
        totalTop1Chars: from.firstTop1Chars && to.firstTop1Chars ? from.firstTop1Chars + to.firstTop1Chars : null,
      });
    }
  }
  if (pairs.length < count) {
    throw new Error(`Only built ${pairs.length}/${count} unique route pairs`);
  }
  return pairs;
}

function rank(payload, endpoint) {
  const suggestions = payload.suggestions || [];
  for (let index = 0; index < suggestions.length; index += 1) {
    const suggestion = suggestions[index];
    const label = suggestion.label || "";
    if (endpoint.expected.every((token) => suggestionLabelHas(label, suggestion, token))) return index + 1;
    const hasKeyToken = endpoint.expected.some(
      (token) => !isStateToken(token) && normalise(token).length >= 4 && labelHas(label, token),
    );
    const stateToken = endpoint.expected.find(isStateToken);
    const stateOk = !stateToken || suggestionLabelHas(label, suggestion, stateToken);
    if (hasKeyToken && stateOk && endpoint.type !== "address") return index + 1;
  }
  return null;
}

function suggestionLabelHas(label, suggestion, token) {
  return labelHas(label, token) || suggestionHasStateToken(suggestion, token);
}

function suggestionHasStateToken(suggestion, token) {
  const state = normalise(suggestion?.state || "");
  if (!state) return false;
  if (STATE_SYNONYMS[normalise(token)]) {
    return STATE_SYNONYMS[normalise(token)].includes(state);
  }
  return state === normalise(token);
}

function labelHas(label, token) {
  const normalisedLabel = normalise(label);
  const normalisedToken = normalise(token);
  if (STATE_SYNONYMS[normalisedToken]) {
    return STATE_SYNONYMS[normalisedToken].some((synonym) => normalisedLabel.includes(synonym));
  }
  return normalisedLabel.includes(normalisedToken);
}

function isStateToken(value) {
  return Boolean(STATE_SYNONYMS[normalise(value)]);
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function quality(resultRank) {
  if (resultRank === 1) return "top1";
  if (resultRank && resultRank <= 3) return "top3";
  if (resultRank) return "top5";
  return "miss";
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const value = item[field];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function summariseGroup(items, field) {
  return Object.fromEntries(
    Object.entries(
      items.reduce((groups, item) => {
        const key = item[field] || "unknown";
        groups[key] = groups[key] || [];
        groups[key].push(item);
        return groups;
      }, {}),
    )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, group]) => [
        key,
        {
          count: group.length,
          prefixTop1: group.filter((row) => row.prefixQuality === "top1").length,
          prefixTop3: group.filter((row) => row.prefixQuality === "top3").length,
          prefixTop5: group.filter((row) => row.prefixQuality === "top5").length,
          finalTop1: group.filter((row) => row.finalQuality === "top1").length,
          p90Chars: quantile(group.map((row) => row.minChars).filter(Number.isFinite), 0.9),
          maxChars: Math.max(...group.map((row) => row.minChars).filter(Number.isFinite)),
        },
      ]),
  );
}

function quantile(values, percentile) {
  if (!values.length) return null;
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentile))];
}

function renderReport(summary, endpoints, routePairs) {
  const stateRows = tableRows(summary.byState, ["count", "prefixTop1", "prefixTop3", "prefixTop5", "finalTop1", "p90Chars", "maxChars"]);
  const typeRows = tableRows(summary.byType, ["count", "prefixTop1", "prefixTop3", "prefixTop5", "finalTop1", "p90Chars", "maxChars"]);
  const weakestRows = summary.weakestEndpoints
    .map((row) =>
      [
        row.id,
        row.state,
        row.type,
        row.minChars,
        row.firstRank,
        row.firstTop1Chars,
        row.finalRank,
        row.provider,
        row.query,
      ]
        .map(markdownCell)
        .join(" | "),
    )
    .join("\n");
  const samplePairRows = routePairs
    .slice(0, 20)
    .map((pair) =>
      [
        pair.from,
        pair.to,
        pair.ready ? "yes" : "no",
        pair.fullReady ? "yes" : "no",
        pair.totalChars,
        pair.totalTop1Chars,
      ]
        .map(markdownCell)
        .join(" | "),
    )
    .join("\n");

  return `# Fuel Path Route Field Stress Report

Run ID: ${summary.runId}

## Summary

- Endpoint queries: ${summary.endpointCount}
- From/to route combinations: ${summary.routePairCount}
- Prefix-ready endpoints: ${summary.usableEndpointPrefixes}/${summary.endpointCount}
- Final top-1 endpoints: ${summary.finalQuality.top1 || 0}/${summary.endpointCount}
- Prefix suggestion quality: top-1 ${summary.prefixQuality.top1 || 0}, top-3 ${summary.prefixQuality.top3 || 0}, top-5 ${summary.prefixQuality.top5 || 0}
- Characters to a proper suggestion: min ${summary.charsNeeded.min}, median ${summary.charsNeeded.median}, p90 ${summary.charsNeeded.p90}, max ${summary.charsNeeded.max}, average ${summary.charsNeeded.average}
- Characters to a top-1 proper suggestion: min ${summary.top1CharsNeeded.min}, median ${summary.top1CharsNeeded.median}, p90 ${summary.top1CharsNeeded.p90}, max ${summary.top1CharsNeeded.max}, average ${summary.top1CharsNeeded.average}
- Route-pair characters needed: median ${summary.routePairs.totalCharsMedian}, p90 ${summary.routePairs.totalCharsP90}, max ${summary.routePairs.totalCharsMax}
- Route-pair top-1 characters needed: median ${summary.routePairs.totalTop1CharsMedian}, p90 ${summary.routePairs.totalTop1CharsP90}, max ${summary.routePairs.totalTop1CharsMax}
- Missing or unusable routes: ${summary.routePairs.oneOrMoreMissingPrefix}
- Missing top-1 route prefixes: ${summary.routePairs.oneOrMoreMissingTop1Prefix}

## By State

state | count | prefixTop1 | prefixTop3 | prefixTop5 | finalTop1 | p90Chars | maxChars
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---:
${stateRows}

## By Type

type | count | prefixTop1 | prefixTop3 | prefixTop5 | finalTop1 | p90Chars | maxChars
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---:
${typeRows}

## Weakest Prefix Cases

id | state | type | minChars | firstRank | firstTop1Chars | finalRank | provider | query
--- | --- | --- | ---: | ---: | ---: | ---: | --- | ---
${weakestRows}

## Sample Route Pairs

from | to | prefixReady | fullReady | totalChars | totalTop1Chars
--- | --- | --- | --- | ---: | ---:
${samplePairRows}
`;
}

function tableRows(groups, fields) {
  return Object.entries(groups)
    .map(([key, values]) => [key, ...fields.map((field) => values[field])].map(markdownCell).join(" | "))
    .join("\n");
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

function installProviderFailure() {
  global.fetch = async () => ({
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
    async text() {
      return JSON.stringify({ error: { message: "Too many requests" } });
    },
  });
}
