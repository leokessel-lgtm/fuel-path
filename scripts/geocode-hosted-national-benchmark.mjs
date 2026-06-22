#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_ORDER = ["NSW", "ACT", "VIC", "QLD", "WA", "SA", "TAS", "NT"];
const DEFAULT_SQLITE_PATH = path.join(ROOT, "data", "gnaf", "build", "gnaf-addresses-national.sqlite");
const args = parseArgs(process.argv.slice(2));
const RUN_ID = args.runId || process.env.FUEL_PATH_HOSTED_BENCHMARK_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const MODE = args.mode || process.env.FUEL_PATH_HOSTED_BENCHMARK_MODE || "http";
const API_BASE = args.apiBase || process.env.FUEL_PATH_API_BASE || "";
const ADDRESS_SQLITE = path.resolve(args.addressSqlite || process.env.FUEL_PATH_HOSTED_BENCHMARK_ADDRESS_SQLITE || DEFAULT_SQLITE_PATH);
const ADDRESS_COUNT = Number(args.addressCount || process.env.FUEL_PATH_HOSTED_BENCHMARK_ADDRESS_COUNT || 600);
const POI_COUNT = Number(args.poiCount || process.env.FUEL_PATH_HOSTED_BENCHMARK_POI_COUNT || 300);
const LIMIT = Number(args.limit || process.env.FUEL_PATH_HOSTED_BENCHMARK_LIMIT || 5);
const MIN_PREFIX_CHARS = Number(args.minPrefix || process.env.FUEL_PATH_HOSTED_BENCHMARK_MIN_PREFIX || 3);
const MIN_ADDRESS_PREFIX_CHARS = Number(args.minAddressPrefix || process.env.FUEL_PATH_HOSTED_BENCHMARK_MIN_ADDRESS_PREFIX || 10);
const DELAY_MS = Number(args.delayMs || process.env.FUEL_PATH_HOSTED_BENCHMARK_DELAY_MS || (MODE === "http" ? 250 : 0));
const PROVIDER = args.provider || process.env.FUEL_PATH_GEOCODE_PROVIDER || "nominatim";
const PROFILE = args.profile || process.env.FUEL_PATH_HOSTED_BENCHMARK_PROFILE || "balanced";
const CASE_CONTEXT = Boolean(args.caseContext || process.env.FUEL_PATH_HOSTED_BENCHMARK_CASE_CONTEXT === "1");
const CASE_CONTEXT_RADIUS_KM = Number(args.caseContextRadiusKm || process.env.FUEL_PATH_HOSTED_BENCHMARK_CASE_CONTEXT_RADIUS_KM || 80);
const EXTERNAL_FAILURE_MODE = args.externalFailure || process.env.FUEL_PATH_HOSTED_BENCHMARK_EXTERNAL_FAILURE || "rate_limit";
const MIN_ADDRESS_TOP_RATE = Number(args.minAddressTopRate || process.env.FUEL_PATH_HOSTED_BENCHMARK_MIN_ADDRESS_TOP_RATE || 1);
const MIN_POI_TOP_RATE = Number(args.minPoiTopRate || process.env.FUEL_PATH_HOSTED_BENCHMARK_MIN_POI_TOP_RATE || 0.98);
const MAX_ADDRESS_P90_CHARS = Number(args.maxAddressP90Chars || process.env.FUEL_PATH_HOSTED_BENCHMARK_MAX_ADDRESS_P90_CHARS || 42);
const MAX_POI_P90_CHARS = Number(args.maxPoiP90Chars || process.env.FUEL_PATH_HOSTED_BENCHMARK_MAX_POI_P90_CHARS || 12);
const REQUEST_TIMEOUT_MS = Number(args.requestTimeoutMs || process.env.FUEL_PATH_HOSTED_BENCHMARK_REQUEST_TIMEOUT_MS || 8000);
const fetchCalls = {
  total: 0,
  gnafApi: 0,
  external: 0,
  httpGeocode: 0,
  blockedExternal: 0,
};

if (!["module", "http"].includes(MODE)) {
  throw new Error("Use --mode module or --mode http.");
}
if (MODE === "http" && !API_BASE) {
  throw new Error("Set --api-base or FUEL_PATH_API_BASE for hosted HTTP benchmark mode.");
}
if (!fs.existsSync(ADDRESS_SQLITE)) {
  throw new Error(`Address benchmark SQLite does not exist: ${ADDRESS_SQLITE}`);
}
if (
  MODE === "module" &&
  !process.env.FUEL_PATH_GNAF_API_URL &&
  !process.env.FUEL_PATH_GNAF_DATABASE_URL &&
  !process.env.FUEL_PATH_GNAF_SQLITE_PATH
) {
  process.env.FUEL_PATH_GNAF_SQLITE_PATH = ADDRESS_SQLITE;
}
if (MODE === "module" && !process.env.FUEL_PATH_DISABLE_STATION_GEOCODE) {
  process.env.FUEL_PATH_DISABLE_STATION_GEOCODE = "1";
}

installFetchObserver();

const regionalSource = await fsp.readFile(path.join(ROOT, "api", "_regionalGeocodeHints.js"), "utf8");
const poiRecords = parsePoiRecords(regionalSource);
const addressCases = sampleAddressCases(ADDRESS_SQLITE, ADDRESS_COUNT);
const poiCases = buildPoiCases(poiRecords, POI_COUNT);
const cases = [...addressCases, ...poiCases].map((row, index) => ({
  ...row,
  id: `hosted-${String(index + 1).padStart(4, "0")}`,
}));

if (addressCases.length !== ADDRESS_COUNT) {
  throw new Error(`Expected ${ADDRESS_COUNT} address cases, sampled ${addressCases.length}.`);
}
if (poiCases.length !== POI_COUNT) {
  throw new Error(`Expected ${POI_COUNT} POI cases, built ${poiCases.length}.`);
}

const geocode = MODE === "module" ? require("../api/_backend").geocode : null;

console.log(`Starting hosted national geocode benchmark: ${addressCases.length} addresses + ${poiCases.length} POIs in ${MODE} mode.`);

const rows = [];
for (let index = 0; index < cases.length; index += 1) {
  rows.push(await runCase(cases[index], index + 1));
  if ((index + 1) % 50 === 0 || index === cases.length - 1) {
    const partial = summarise(rows);
    console.log(`${index + 1}/${cases.length} addressTop=${rateText(partial.byKind.address?.finalTopRate)} poiTop=${rateText(partial.byKind.poi?.finalTopRate)} p90Any=${partial.overall.p90AnyChars}`);
  }
  if (DELAY_MS) await sleep(DELAY_MS);
}

const summary = summarise(rows);
const payload = {
  runId: RUN_ID,
  mode: MODE,
  apiBase: MODE === "http" ? API_BASE : "",
  addressSqlite: ADDRESS_SQLITE,
  provider: PROVIDER,
  limit: LIMIT,
  minPrefixChars: MIN_PREFIX_CHARS,
  minAddressPrefixChars: MIN_ADDRESS_PREFIX_CHARS,
  prefixProbeMode: "autocomplete_checkpoints",
  externalFailureMode: EXTERNAL_FAILURE_MODE,
  requested: {
    addresses: ADDRESS_COUNT,
    pois: POI_COUNT,
    profile: PROFILE,
    caseContext: CASE_CONTEXT,
    caseContextRadiusKm: CASE_CONTEXT ? CASE_CONTEXT_RADIUS_KM : null,
  },
  fetchCalls,
  index: indexEvidence(ADDRESS_SQLITE),
  summary,
  rows,
};

await fsp.mkdir(path.join(ROOT, "tmp"), { recursive: true });
const jsonPath = `tmp/geocode-hosted-national-benchmark-${RUN_ID}.json`;
const csvPath = `tmp/geocode-hosted-national-benchmark-${RUN_ID}.csv`;
await fsp.writeFile(path.join(ROOT, jsonPath), JSON.stringify(payload, null, 2));
await fsp.writeFile(path.join(ROOT, csvPath), `${toCsv(rows)}\n`);

console.log(JSON.stringify({ runId: RUN_ID, jsonPath, csvPath, fetchCalls, summary }, null, 2));
assertThresholds(summary, rows);

async function runCase(testCase, index) {
  const prefixes = prefixesFor(testCase.query, testCase.kind);
  let firstAnyMatchChars = null;
  let firstTopMatchChars = null;
  let firstResolvableTopChars = null;
  let firstSuggestionChars = null;
  let finalPayload = null;
  let finalSuggestions = [];
  let elapsedMs = 0;
  let probedFullQuery = false;
  let wrongTopBeforeResolvable = false;
  const fullQuery = testCase.query.trim();

  for (const prefix of prefixes) {
    if (prefix === fullQuery) probedFullQuery = true;
    const started = Date.now();
    const payload = await geocodeQuery(prefix, index, testCase);
    elapsedMs += Date.now() - started;
    if (payload?.lookupStatus === "request_timeout") {
      finalPayload = payload;
      finalSuggestions = [];
      break;
    }
    const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    if (suggestions.length && firstSuggestionChars === null) firstSuggestionChars = prefix.length;
    const matchIndex = suggestions.findIndex((suggestion) => suggestionMatches(testCase, suggestion));
    const top = suggestions[0] || null;
    const resolvableTop = top ? suggestionResolvesCase(testCase, top) : false;
    if (matchIndex >= 0 && firstAnyMatchChars === null) firstAnyMatchChars = prefix.length;
    if (matchIndex === 0 && firstTopMatchChars === null) firstTopMatchChars = prefix.length;
    if (resolvableTop && firstResolvableTopChars === null) firstResolvableTopChars = prefix.length;
    if (top && !resolvableTop && firstResolvableTopChars === null) wrongTopBeforeResolvable = true;
    finalPayload = payload;
    finalSuggestions = suggestions;
    if (matchIndex === 0 && resolvableTop) break;
  }

  if (finalPayload?.lookupStatus !== "request_timeout" && !probedFullQuery) {
    const started = Date.now();
    finalPayload = await geocodeQuery(fullQuery, index, testCase);
    elapsedMs += Date.now() - started;
    finalSuggestions = Array.isArray(finalPayload?.suggestions) ? finalPayload.suggestions : [];
  }

  const finalTop = finalSuggestions[0] || null;
  const finalAnyMatch = finalSuggestions.some((suggestion) => suggestionMatches(testCase, suggestion));
  const finalTopMatch = finalTop ? suggestionMatches(testCase, finalTop) : false;
  const finalResolvableTop = finalTop ? suggestionResolvesCase(testCase, finalTop) : false;
  return {
    ...testCase,
    index,
    queryLength: testCase.query.length,
    prefixesTested: prefixes.length,
    firstSuggestionChars,
    firstAnyMatchChars,
    firstTopMatchChars,
    firstResolvableTopChars,
    wrongTopBeforeResolvable,
    finalSuggestionCount: finalSuggestions.length,
    finalAnyMatch,
    finalTopMatch,
    finalResolvableTop,
    finalTopLabel: finalTop?.label || "",
    finalTopProvider: finalTop?.provider || "",
    finalTopType: finalTop?.type || "",
    finalLookupStatus: finalPayload?.lookupStatus || "",
    finalWarning: finalPayload?.warning || "",
    elapsedMs,
    result: finalTopMatch ? "top_match" : finalAnyMatch ? "ranked_match" : finalSuggestions.length ? "suggestions_but_not_expected" : "no_suggestion",
  };
}

async function geocodeQuery(query, index, testCase = {}) {
  const searchContext = caseSearchContext(testCase);
  if (MODE === "module") {
    return geocode({
      query,
      limit: LIMIT,
      sessionToken: `hosted-benchmark-${RUN_ID}-${index}`,
      provider: PROVIDER,
      searchContext,
    });
  }
  const url = new URL("/api/geocode", API_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("provider", PROVIDER);
  url.searchParams.set("sessionToken", `hosted-benchmark-${RUN_ID}-${index}`);
  if (searchContext) {
    url.searchParams.set("nearLat", String(searchContext.nearLat));
    url.searchParams.set("nearLon", String(searchContext.nearLon));
    url.searchParams.set("nearRadiusKm", String(searchContext.nearRadiusKm));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      return { suggestions: [], lookupStatus: "request_timeout", warning: `Timed out after ${REQUEST_TIMEOUT_MS}ms` };
    }
    return { suggestions: [], lookupStatus: "request_error", warning: error?.message || String(error) };
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) return { suggestions: [], lookupStatus: "http_error", warning: `HTTP ${response.status}` };
  return response.json();
}

function caseSearchContext(testCase) {
  if (!CASE_CONTEXT) return null;
  const nearLat = Number(testCase.expectedLat);
  const nearLon = Number(testCase.expectedLon);
  if (!Number.isFinite(nearLat) || !Number.isFinite(nearLon)) return null;
  return {
    nearLat,
    nearLon,
    nearRadiusKm: CASE_CONTEXT_RADIUS_KM,
  };
}

function sampleAddressCases(sqlitePath, total) {
  const { DatabaseSync } = require("node:sqlite");
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  const hasAddressFts = sqliteTableExists(database, "address_fts");
  const addressColumns = sqliteTableColumns(database, "addresses");
  const hasSearchText = addressColumns.has("search_text");
  const perState = distribute(total, STATE_ORDER);
  const rows = [];
  for (const state of STATE_ORDER) {
    const target = perState[state];
    const seen = new Set();
    for (const seed of addressSeedsForState(state)) {
      if (rows.filter((row) => row.state === state).length >= target) break;
      const statement = hasAddressFts
        ? database.prepare(`
          SELECT id, label, lat, lon, state, postcode, locality, search_text
          FROM address_fts
          WHERE address_fts MATCH ?
          LIMIT 300
        `)
        : hasSearchText ? database.prepare(`
          SELECT id, label, lat, lon, state, postcode, locality, search_text
          FROM addresses
          WHERE search_text LIKE ?
          LIMIT 300
        `) : database.prepare(`
          SELECT id, label, lat, lon, state, postcode, locality, '' AS search_text
          FROM addresses
          WHERE state = ? AND (label LIKE ? OR locality LIKE ? OR postcode LIKE ?)
          LIMIT 300
        `);
      const seedRows = hasAddressFts
        ? statement.all(ftsQuery(seed))
        : hasSearchText
          ? statement.all(`%${normalise(seed)}%`)
          : statement.all(...addressFallbackParams(seed));
      for (const row of seedRows) {
        if (row.state !== state) continue;
        if (seen.has(row.id)) continue;
        if (!addressSampleQualityPass(row)) continue;
        seen.add(row.id);
        rows.push(addressCaseFromRow(row));
        if (rows.filter((item) => item.state === state).length >= target) break;
      }
    }
    const stateCount = rows.filter((row) => row.state === state).length;
    if (stateCount < target) {
      throw new Error(`Only sampled ${stateCount}/${target} ${state} address cases from ${sqlitePath}.`);
    }
  }
  database.close?.();
  return rows.slice(0, total);
}

function sqliteTableExists(database, table) {
  const row = database.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?").get(table);
  return Boolean(row?.name);
}

function sqliteTableColumns(database, table) {
  return new Set(database.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name)));
}

function addressFallbackParams(seed) {
  const text = String(seed || "");
  const state = text.match(/\b(NSW|ACT|VIC|QLD|WA|SA|TAS|NT)\b/i)?.[1]?.toUpperCase() || "";
  const terms = text.replace(/\b(NSW|ACT|VIC|QLD|WA|SA|TAS|NT)\b/ig, "").trim();
  const like = `%${terms || text}%`;
  return [state, like, like, like];
}

function addressSeedsForState(state) {
  const base = {
    NSW: ["balgowlah heights nsw", "sylvania nsw", "sydney nsw", "parramatta nsw", "newcastle nsw", "wollongong nsw", "tamworth nsw", "orange nsw", "wagga wagga nsw"],
    ACT: ["canberra act", "tuggeranong act", "belconnen act", "gungahlin act", "phillip act", "kingston act", "isabella plains act", "dickson act"],
    VIC: ["melbourne vic", "geelong vic", "ballarat vic", "bendigo vic", "hoppers crossing vic", "shepparton vic", "wodonga vic", "traralgon vic"],
    QLD: ["mount ommaney qld", "brisbane qld", "cairns qld", "townsville qld", "longreach qld", "toowoomba qld", "mackay qld", "rockhampton qld"],
    WA: ["perth wa", "karratha wa", "broome wa", "west leederville wa", "albany wa", "geraldton wa", "bunbury wa", "kalgoorlie wa"],
    SA: ["clarence gardens sa", "adelaide sa", "mount gambier sa", "coober pedy sa", "port lincoln sa", "whyalla sa", "renmark sa", "victor harbor sa"],
    TAS: ["hobart tas", "launceston tas", "queenstown tas", "austins ferry tas", "devonport tas", "burnie tas", "ulverstone tas", "smithton tas"],
    NT: ["darwin nt", "alice springs nt", "palmerston city nt", "tennant creek nt", "katherine nt", "nhulunbuy nt", "yulara nt", "humpty doo nt"],
  };
  const seeds = base[state] || [`${state.toLowerCase()}`];
  if (PROFILE !== "rural-unit") return seeds;
  const ruralFirst = {
    NSW: ["tamworth nsw", "orange nsw", "wagga wagga nsw", "newcastle nsw", "wollongong nsw"],
    ACT: ["tuggeranong act", "belconnen act", "gungahlin act", "isabella plains act"],
    VIC: ["wodonga vic", "traralgon vic", "shepparton vic", "bendigo vic", "ballarat vic"],
    QLD: ["longreach qld", "cairns qld", "townsville qld", "rockhampton qld", "mackay qld"],
    WA: ["karratha wa", "broome wa", "kalgoorlie wa", "geraldton wa", "albany wa"],
    SA: ["coober pedy sa", "mount gambier sa", "port lincoln sa", "whyalla sa", "renmark sa"],
    TAS: ["queenstown tas", "burnie tas", "devonport tas", "smithton tas", "ulverstone tas"],
    NT: ["katherine nt", "tennant creek nt", "alice springs nt", "nhulunbuy nt", "humpty doo nt"],
  };
  return [...new Set([...(ruralFirst[state] || []), ...seeds])];
}

function addressSampleQualityPass(row) {
  const label = String(row.label || "");
  if (!label || label.length > 120) return false;
  if (!Number.isFinite(Number(row.lat)) || !Number.isFinite(Number(row.lon))) return false;
  if (!row.postcode || !row.locality) return false;
  return /\d/.test(label) && /\b(NSW|ACT|VIC|QLD|WA|SA|TAS|NT)\b/.test(label);
}

function addressCaseFromRow(row) {
  return {
    kind: "address",
    category: addressCategory(row.label),
    addressFamily: addressFamily(row.label),
    state: row.state,
    query: queryFromAddressLabel(row.label),
    expectedLabel: row.label,
    expectedLocality: row.locality || "",
    expectedLat: Number(row.lat),
    expectedLon: Number(row.lon),
    expectedTerms: [row.label, row.locality, row.postcode].filter(Boolean),
    providerExpectation: "fuel_path_gnaf",
  };
}

function addressCategory(label) {
  const normalised = normalise(label);
  if (hasUnitOrBuildingToken(normalised)) return "unit_address";
  if (normalised.startsWith("lot ")) return "lot_address";
  if (/\b\d+[a-z]\b/.test(normalised)) return "suffix_address";
  if (/\b\d+\s+\d+\b/.test(normalised)) return "range_address";
  return "street_address";
}

function addressFamily(label) {
  const normalised = normalise(label);
  if (hasUnitOrBuildingToken(normalised)) return "unit_or_building_address";
  if (String(label || "").split(",").length >= 4) return "unit_or_building_address";
  return "standard_address";
}

function hasUnitOrBuildingToken(value) {
  return /\b(unit|flat|apartment|apt|suite|townhouse|shop|office|offc|level|lvl|kiosk|ksk)\b/.test(String(value || ""));
}

function queryFromAddressLabel(label) {
  return String(label || "").replace(/,/g, "").replace(/\s+/g, " ").trim();
}

function buildPoiCases(records, total) {
  const perState = distribute(total, STATE_ORDER);
  const rows = [];
  for (const state of STATE_ORDER) {
    const stateRecords = records.filter((record) => record.state === state);
    if (!stateRecords.length) throw new Error(`No POI records available for ${state}.`);
    for (let index = 0; index < perState[state]; index += 1) {
      const record = stateRecords[index % stateRecords.length];
      const variant = poiVariant(record, index);
      rows.push({
        kind: "poi",
        category: index >= stateRecords.length ? "poi_variant" : "poi_landmark",
        addressFamily: "poi",
        state,
        query: variant,
        expectedLabel: record.label,
        expectedLocality: record.locality,
        expectedTerms: [...firstUsefulTokens(record.label), record.locality].filter(Boolean),
        providerExpectation: "fuel_path_hint_or_external",
        variantIndex: Math.floor(index / stateRecords.length),
      });
    }
  }
  return rows.slice(0, total);
}

function poiVariant(record, index) {
  const variants = [
    record.label,
    `${record.label} ${record.state}`,
    `${record.label} Australia`,
    `${record.label} near ${record.locality}`,
  ];
  return variants[index % variants.length];
}

function suggestionMatches(testCase, suggestion) {
  const label = normalise(suggestion?.label);
  if (!label) return false;
  if (testCase.kind === "address") {
    return normalise(testCase.expectedLabel) === label && suggestion?.provider === "fuel_path_gnaf";
  }
  const stateMatch =
    suggestion?.state === testCase.state ||
    label.includes(` ${testCase.state.toLowerCase()} `) ||
    label.endsWith(` ${testCase.state.toLowerCase()}`);
  const localityMatch = testCase.expectedLocality && label.includes(normalise(testCase.expectedLocality));
  const termMatch = testCase.expectedTerms.some((term) => {
    const needle = normalise(term);
    return needle.length >= 4 && label.includes(needle);
  });
  return Boolean((stateMatch || localityMatch) && (localityMatch || termMatch));
}

function suggestionResolvesCase(testCase, suggestion) {
  if (suggestionMatches(testCase, suggestion)) return true;
  if (testCase.kind !== "address") return false;
  const expected = addressParts(testCase.expectedLabel);
  const actual = addressParts(suggestion?.label);
  if (!expected || !actual) return false;
  const sameBase =
    expected.number === actual.number &&
    expected.street === actual.street &&
    expected.locality === actual.locality &&
    expected.state === actual.state &&
    expected.postcode === actual.postcode;
  if (!sameBase) return false;
  if (!expected.unit) return true;
  return Boolean(
    suggestion?.refineRequired ||
      suggestion?.suggestionType === "building" ||
      suggestion?.suggestionType === "base_address" ||
      suggestion?.type === "building",
  );
}

function addressParts(value) {
  const text = String(value || "");
  const normalised = normalise(text);
  const unitMatch = normalised.match(/\b(?:unit|flat|apartment|apt|suite|townhouse|shop|office|offc|level|lvl|kiosk|ksk)\s+([a-z0-9-]+)\b/);
  const streetMatch = normalised.match(/\b(\d+[a-z]?(?:-\d+[a-z]?)?)\s+([a-z0-9 ]+?)\s+(street|road|avenue|drive|highway|terrace|circuit|way|lane|place|court|crescent|boulevard|parade|parkway|esplanade|square)\b/);
  const stateMatch = normalised.match(/\b(nsw|act|qld|vic|wa|sa|tas|nt)\b/);
  const postcodeMatch = normalised.match(/\b(\d{4})\b/);
  if (!streetMatch || !stateMatch) return null;
  const beforeState = normalised.slice(0, normalised.lastIndexOf(` ${stateMatch[1]}`)).trim();
  const locality = beforeState.split(/\b(?:street|road|avenue|drive|highway|terrace|circuit|way|lane|place|court|crescent|boulevard|parade|parkway|esplanade|square)\b/).pop()?.trim() || "";
  return {
    unit: unitMatch?.[1] || "",
    number: streetMatch[1],
    street: `${streetMatch[2].trim()} ${streetMatch[3]}`,
    locality,
    state: stateMatch[1],
    postcode: postcodeMatch?.[1] || "",
  };
}

function summarise(rows) {
  return {
    overall: summariseGroup(rows),
    byKind: groupSummary(rows, "kind"),
    byState: groupSummary(rows, "state"),
    byCategory: groupSummary(rows, "category"),
    byAddressFamily: groupSummary(rows, "addressFamily"),
    byProvider: groupSummary(rows, "finalTopProvider"),
  };
}

function summariseGroup(rows) {
  const topChars = rows.map((row) => row.firstTopMatchChars).filter(Number.isFinite);
  const anyChars = rows.map((row) => row.firstAnyMatchChars).filter(Number.isFinite);
  const resolvableTopChars = rows.map((row) => row.firstResolvableTopChars).filter(Number.isFinite);
  const elapsed = rows.map((row) => row.elapsedMs).filter(Number.isFinite);
  return {
    cases: rows.length,
    finalTopMatch: rows.filter((row) => row.finalTopMatch).length,
    finalAnyMatch: rows.filter((row) => row.finalAnyMatch).length,
    finalResolvableTop: rows.filter((row) => row.finalResolvableTop).length,
    finalNoMatch: rows.filter((row) => !row.finalAnyMatch).length,
    suggestionsButNotExpected: rows.filter((row) => row.result === "suggestions_but_not_expected").length,
    noSuggestion: rows.filter((row) => row.result === "no_suggestion").length,
    wrongTopBeforeResolvable: rows.filter((row) => row.wrongTopBeforeResolvable).length,
    finalTopRate: rate(rows.filter((row) => row.finalTopMatch).length, rows.length),
    finalAnyRate: rate(rows.filter((row) => row.finalAnyMatch).length, rows.length),
    finalResolvableTopRate: rate(rows.filter((row) => row.finalResolvableTop).length, rows.length),
    avgTopChars: average(topChars),
    p50TopChars: percentile(topChars, 50),
    p90TopChars: percentile(topChars, 90),
    p95TopChars: percentile(topChars, 95),
    avgAnyChars: average(anyChars),
    p50AnyChars: percentile(anyChars, 50),
    p90AnyChars: percentile(anyChars, 90),
    p95AnyChars: percentile(anyChars, 95),
    avgResolvableTopChars: average(resolvableTopChars),
    p50ResolvableTopChars: percentile(resolvableTopChars, 50),
    p90ResolvableTopChars: percentile(resolvableTopChars, 90),
    p95ResolvableTopChars: percentile(resolvableTopChars, 95),
    p50ElapsedMs: percentile(elapsed, 50),
    p95ElapsedMs: percentile(elapsed, 95),
  };
}

function groupSummary(rows, field) {
  return Object.fromEntries(
    [...new Set(rows.map((row) => row[field] || "unknown"))]
      .sort()
      .map((key) => [key, summariseGroup(rows.filter((row) => (row[field] || "unknown") === key))]),
  );
}

function assertThresholds(summary, rows) {
  const failures = [];
  const address = summary.byKind.address || summariseGroup([]);
  const poi = summary.byKind.poi || summariseGroup([]);
  if (address.cases !== ADDRESS_COUNT) failures.push(`Expected ${ADDRESS_COUNT} address cases, got ${address.cases}.`);
  if (poi.cases !== POI_COUNT) failures.push(`Expected ${POI_COUNT} POI cases, got ${poi.cases}.`);
  if (address.finalTopRate < MIN_ADDRESS_TOP_RATE) failures.push(`Address top-match rate ${rateText(address.finalTopRate)} below ${rateText(MIN_ADDRESS_TOP_RATE)}.`);
  if (poi.finalTopRate < MIN_POI_TOP_RATE) failures.push(`POI top-match rate ${rateText(poi.finalTopRate)} below ${rateText(MIN_POI_TOP_RATE)}.`);
  if (address.p90AnyChars > MAX_ADDRESS_P90_CHARS) failures.push(`Address p90 chars ${address.p90AnyChars} above ${MAX_ADDRESS_P90_CHARS}.`);
  if (poi.p90AnyChars > MAX_POI_P90_CHARS) failures.push(`POI p90 chars ${poi.p90AnyChars} above ${MAX_POI_P90_CHARS}.`);
  for (const state of STATE_ORDER) {
    const stateSummary = summary.byState[state];
    if (!stateSummary || stateSummary.finalAnyRate < 0.98) failures.push(`${state} any-match rate ${rateText(stateSummary?.finalAnyRate)} below 98%.`);
  }
  if (failures.length) {
    const examples = rows
      .filter((row) => row.result !== "top_match")
      .slice(0, 12)
      .map((row) => `${row.id} ${row.kind} ${row.query} -> ${row.finalTopLabel || row.result}`);
    throw new Error(`${failures.join(" ")}${examples.length ? ` Examples: ${examples.join(" | ")}` : ""}`);
  }
}

function prefixesFor(query, kind = "") {
  const text = String(query || "").trim();
  const minimum = kind === "address" ? MIN_ADDRESS_PREFIX_CHARS : MIN_PREFIX_CHARS;
  const lengths = new Set([
    minimum,
    4,
    5,
    6,
    8,
    10,
    12,
    15,
    18,
    22,
    26,
    30,
    34,
    38,
    42,
    text.length,
  ]);
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === " ") lengths.add(index + 1);
  }
  return [...lengths]
    .filter((length) => length >= minimum && length <= text.length)
    .sort((left, right) => left - right)
    .map((length) => text.slice(0, length));
}

function parsePoiRecords(text) {
  const rows = [];
  const pattern = /poi\("([^"]+)",\s*"([A-Z]{2,3})",\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(text))) {
    if (STATE_ORDER.includes(match[2])) {
      rows.push({ label: match[1], state: match[2], locality: match[3] });
    }
  }
  return rows;
}

function ftsQuery(seed) {
  return String(seed || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((term) => `${escapeFtsTerm(term)}*`)
    .join(" ");
}

function escapeFtsTerm(value) {
  return String(value).replace(/["']/g, " ").replace(/[^\p{L}\p{N}_-]+/gu, " ").trim();
}

function distribute(total, states) {
  const base = Math.floor(total / states.length);
  const remainder = total % states.length;
  return Object.fromEntries(states.map((state, index) => [state, base + (index < remainder ? 1 : 0)]));
}

function firstUsefulTokens(value) {
  return String(value || "")
    .split(/[^A-Za-z0-9]+/)
    .filter((token) => token.length >= 5)
    .slice(0, 3);
}

function average(values) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

function rate(count, total) {
  return total ? Number((count / total).toFixed(4)) : null;
}

function rateText(value) {
  return value === null || value === undefined ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toCsv(rows) {
  const headers = [
    "id",
    "kind",
    "category",
    "state",
    "query",
    "expectedLabel",
    "expectedLocality",
    "queryLength",
    "firstSuggestionChars",
    "firstAnyMatchChars",
    "firstTopMatchChars",
    "firstResolvableTopChars",
    "wrongTopBeforeResolvable",
    "finalAnyMatch",
    "finalTopMatch",
    "finalResolvableTop",
    "result",
    "finalSuggestionCount",
    "finalTopLabel",
    "finalTopProvider",
    "finalTopType",
    "finalLookupStatus",
    "elapsedMs",
  ];
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

function indexEvidence(sqlitePath) {
  try {
    const stat = fs.statSync(sqlitePath);
    return {
      sqlitePath,
      sizeBytes: stat.size,
      sizeMb: Number((stat.size / 1024 / 1024).toFixed(1)),
    };
  } catch {
    return { sqlitePath, sizeBytes: null, sizeMb: null };
  }
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function installFetchObserver() {
  const originalFetch = global.fetch;
  global.fetch = async (input, options = {}) => {
    const url = String(input);
    fetchCalls.total += 1;
    if (MODE === "http" && url.includes("/api/geocode")) fetchCalls.httpGeocode += 1;
    const gnafApiUrl = process.env.FUEL_PATH_GNAF_API_URL || "";
    const isGnafApi = gnafApiUrl && url.startsWith(gnafApiUrl);
    if (isGnafApi) {
      fetchCalls.gnafApi += 1;
      return originalFetch(input, options);
    }
    if (MODE === "module" && EXTERNAL_FAILURE_MODE && /^https?:\/\//.test(url)) {
      fetchCalls.external += 1;
      fetchCalls.blockedExternal += 1;
      const status = EXTERNAL_FAILURE_MODE === "rate_limit" ? 429 : 500;
      return {
        ok: false,
        status,
        statusText: status === 429 ? "Too Many Requests" : "Provider Failure",
        async text() {
          return JSON.stringify({ error: { message: status === 429 ? "Too many requests" : "Provider failure" } });
        },
        async json() {
          return { error: { message: status === 429 ? "Too many requests" : "Provider failure" } };
        },
      };
    }
    if (/^https?:\/\//.test(url) && !url.includes("/api/geocode")) fetchCalls.external += 1;
    return originalFetch(input, options);
  };
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = values[index + 1];
    if (!next || next.startsWith("--")) result[key] = "1";
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}
