import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const RUN_ID = process.env.FUEL_PATH_MATRIX_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const LIMIT = Number(process.env.FUEL_PATH_MATRIX_LIMIT || 5);
const MIN_PREFIX_CHARS = Number(process.env.FUEL_PATH_PREFIX_MIN || 3);
const MAX_GOOGLE_SUBSET = Number(process.env.FUEL_PATH_GOOGLE_SUBSET || 60);
const STATE_ORDER = ["NSW", "ACT", "VIC", "QLD", "WA", "SA", "TAS", "NT"];
const CASES_PER_CATEGORY = Number(process.env.FUEL_PATH_PREFIX_CASES_PER_CATEGORY || 15);
const EXPECTED_CASE_COUNT = STATE_ORDER.length * 5 * CASES_PER_CATEGORY;
const MAX_P90_ANY_CHARS = Number(process.env.FUEL_PATH_PREFIX_MAX_P90_ANY_CHARS || 28);

const providerFailureMode = process.env.FUEL_PATH_MATRIX_PROVIDER_FAILURE || "rate_limit";
installProviderLogFilter();
installProviderFailureMode(providerFailureMode);

const { geocode } = require("../api/_backend");

const source = await fs.readFile(new URL("../api/_regionalGeocodeHints.js", import.meta.url), "utf8");
const townRecords = parseTownRecords(source);
const poiRecords = parsePoiRecords(source);

const STREET_NAMES = {
  NSW: ["Banna Avenue", "Baylis Street", "Marius Street", "Summer Street", "Argent Street", "Darling Street"],
  ACT: ["Lanyon Drive", "Beltana Road", "Hibberson Street", "Mouat Street", "Scollay Street", "Bugden Avenue"],
  VIC: ["Moorabool Street", "Sturt Street", "Pall Mall", "High Street", "Liebig Street", "Deakin Avenue"],
  QLD: ["Flinders Street", "Abbott Street", "Margaret Street", "Victoria Street", "Goondoon Street", "Eagle Street"],
  WA: ["Hannan Street", "Marine Terrace", "York Street", "Victoria Street", "South Coast Highway", "Dampier Road"],
  SA: ["Commercial Street", "Murray Street", "Adelaide Road", "Railway Terrace", "Eyre Highway", "North Terrace"],
  TAS: ["Brisbane Street", "Rooke Street", "Mount Street", "Channel Highway", "Reibey Street", "Driffield Street"],
  NT: ["Todd Street", "Katherine Terrace", "University Avenue", "Paterson Street", "Chesterfield Circuit", "Arnhem Road"],
};

const SPECIAL_CASES = {
  NSW: [
    ["Lord Howe Island NSW", "Lord Howe Island", "remote_island_prominent"],
    ["Lightning Ridge NSW", "Lightning Ridge", "remote_town"],
    ["Tibooburra NSW", "Tibooburra", "remote_town"],
    ["Tilpa NSW", "Tilpa", "remote_town"],
    ["White Cliffs NSW", "White Cliffs", "remote_town"],
    ["Mungo National Park NSW", "Mungo", "remote_landmark"],
    ["Wilcannia NSW", "Wilcannia", "remote_town"],
    ["Menindee NSW", "Menindee", "remote_town"],
    ["Bourke NSW", "Bourke", "remote_town"],
    ["Walgett NSW", "Walgett", "remote_town"],
    ["Broken Hill NSW", "Broken Hill", "regional_remote"],
    ["Coonabarabran NSW", "Coonabarabran", "regional_town"],
  ],
  ACT: [
    ["Uriarra Village ACT", "Uriarra Village", "rural_village"],
    ["Tidbinbilla Nature Reserve ACT", "Tharwa", "remote_landmark"],
    ["Namadgi National Park Visitor Centre ACT", "Tharwa", "remote_landmark"],
    ["Cotter Reserve ACT", "Cotter", "rural_poi"],
    ["Pierces Creek ACT", "Pierces Creek", "rural_village"],
    ["Oaks Estate ACT", "Oaks Estate", "edge_case_suburb"],
    ["Tharwa ACT", "Tharwa", "rural_village"],
    ["Hall ACT", "Hall", "rural_village"],
    ["Stromlo Forest Park ACT", "Stromlo", "landmark"],
    ["Pialligo ACT", "Pialligo", "edge_case_suburb"],
    ["Hume ACT", "Hume", "industrial_edge"],
    ["Canberra Deep Space Communication Complex ACT", "Tharwa", "remote_landmark"],
  ],
  VIC: [
    ["Wilsons Promontory VIC", "Wilsons Promontory", "remote_landmark"],
    ["Mildura VIC", "Mildura", "regional_remote"],
    ["Swan Hill VIC", "Swan Hill", "regional_town"],
    ["Bairnsdale VIC", "Bairnsdale", "regional_town"],
    ["Sale VIC", "Sale", "regional_town"],
    ["Horsham VIC", "Horsham", "regional_town"],
    ["Traralgon VIC", "Traralgon", "regional_town"],
    ["Wodonga VIC", "Wodonga", "border_town"],
    ["Warrnambool VIC", "Warrnambool", "regional_town"],
    ["Shepparton VIC", "Shepparton", "regional_town"],
    ["Ballarat town centre VIC", "Ballarat", "regional_town"],
    ["Bendigo Australia", "Bendigo", "regional_town"],
  ],
  QLD: [
    ["Thursday Island QLD", "Thursday Island", "remote_island_prominent"],
    ["Magnetic Island QLD", "Magnetic Island", "island_prominent"],
    ["Birdsville QLD", "Birdsville", "remote_town"],
    ["Winton QLD", "Winton", "remote_town"],
    ["Weipa QLD", "Weipa", "remote_town"],
    ["Camooweal QLD", "Camooweal", "remote_town"],
    ["Longreach QLD", "Longreach", "regional_remote"],
    ["Mount Isa QLD", "Mount Isa", "regional_remote"],
    ["Carnarvon Gorge Visitor Area QLD", "Roma", "remote_landmark"],
    ["Mossman Gorge Centre QLD", "Mossman", "landmark"],
    ["Palm Island QLD", "Palm Island", "remote_island"],
    ["Normanton QLD", "Normanton", "remote_town"],
  ],
  WA: [
    ["Rottnest Island WA", "Rottnest Island", "island_prominent"],
    ["Houtman Abrolhos WA", "Houtman Abrolhos", "remote_island"],
    ["Horizontal Falls WA", "Broome", "remote_landmark"],
    ["Bungle Bungle Visitor Centre WA", "Kununurra", "remote_landmark"],
    ["Karijini Visitor Centre WA", "Karijini", "remote_landmark"],
    ["Exmouth WA", "Exmouth", "regional_remote"],
    ["Meekatharra WA", "Meekatharra", "remote_town"],
    ["Newman WA", "Newman", "remote_town"],
    ["Fitzroy Crossing WA", "Fitzroy Crossing", "remote_town"],
    ["Kununurra WA", "Kununurra", "regional_remote"],
    ["Broome WA", "Broome", "regional_remote"],
    ["Eucla WA", "Eucla", "remote_town"],
  ],
  SA: [
    ["Kangaroo Island SA", "Kangaroo Island", "island_prominent"],
    ["Kingscote SA", "Kingscote", "island_town"],
    ["Penneshaw SA", "Penneshaw", "island_town"],
    ["Coober Pedy SA", "Coober Pedy", "remote_town"],
    ["Oodnadatta SA", "Oodnadatta", "remote_town"],
    ["Marla SA", "Marla", "remote_town"],
    ["Ceduna SA", "Ceduna", "regional_remote"],
    ["Wilpena Pound Resort SA", "Wilpena Pound", "remote_landmark"],
    ["Nullarbor Roadhouse SA", "Nullarbor", "remote_roadhouse"],
    ["Innamincka SA", "Innamincka", "remote_town"],
    ["Port Lincoln SA", "Port Lincoln", "regional_remote"],
    ["Roxby Downs SA", "Roxby Downs", "remote_town"],
  ],
  TAS: [
    ["Bruny Island TAS", "Bruny Island", "island_landmark"],
    ["Queenstown TAS", "Queenstown", "remote_town"],
    ["St Helens TAS", "St Helens", "regional_town"],
    ["Smithton TAS", "Smithton", "regional_town"],
    ["New Norfolk TAS", "New Norfolk", "regional_town"],
    ["Sorell TAS", "Sorell", "regional_town"],
    ["Ulverstone TAS", "Ulverstone", "regional_town"],
    ["Burnie TAS", "Burnie", "regional_town"],
    ["Devonport TAS", "Devonport", "regional_town"],
    ["Launceston town centre TAS", "Launceston", "regional_town"],
    ["Kingston Tasmania", "Kingston", "regional_town"],
    ["Cradle Mountain TAS", "Cradle Mountain", "remote_landmark"],
  ],
  NT: [
    ["Yulara NT", "Yulara", "remote_town"],
    ["Jabiru NT", "Jabiru", "remote_town"],
    ["Nhulunbuy NT", "Nhulunbuy", "remote_town"],
    ["Tennant Creek NT", "Tennant Creek", "remote_town"],
    ["Katherine NT", "Katherine", "regional_town"],
    ["Alice Springs NT", "Alice Springs", "regional_remote"],
    ["Humpty Doo NT", "Humpty Doo", "regional_town"],
    ["Howard Springs NT", "Howard Springs", "regional_town"],
    ["Palmerston NT", "Palmerston", "regional_town"],
    ["Uluru NT", "Uluru", "remote_landmark"],
    ["Kakadu Visitor Centre NT", "Kakadu Visitor Centre", "remote_landmark"],
    ["Litchfield National Park NT", "Litchfield National Park", "remote_landmark"],
  ],
};

const cases = buildCases();
if (cases.length !== EXPECTED_CASE_COUNT) throw new Error(`Expected ${EXPECTED_CASE_COUNT} benchmark cases, received ${cases.length}`);

console.log(`Starting 600-case Fuel Path prefix benchmark with provider failure mode ${providerFailureMode}`);

const rows = [];
for (let index = 0; index < cases.length; index += 1) {
  const row = await runCase(cases[index], index + 1);
  rows.push(row);
  if ((index + 1) % 50 === 0 || index === cases.length - 1) {
    const partial = summarise(rows);
    console.log(`${index + 1}/${cases.length} top=${partial.overall.finalTopMatch} any=${partial.overall.finalAnyMatch} no=${partial.overall.finalNoMatch} avgTopChars=${partial.overall.avgTopChars}`);
  }
}

const summary = summarise(rows);
const googleSubset = selectGoogleSubset(rows, MAX_GOOGLE_SUBSET);
await fs.mkdir("tmp", { recursive: true });
const jsonPath = `tmp/geocode-600-prefix-benchmark-${RUN_ID}.json`;
const csvPath = `tmp/geocode-600-prefix-benchmark-${RUN_ID}.csv`;
const googlePath = `tmp/google-maps-comparison-subset-${RUN_ID}.json`;
await fs.writeFile(jsonPath, JSON.stringify({ runId: RUN_ID, limit: LIMIT, minPrefixChars: MIN_PREFIX_CHARS, providerFailureMode, summary, rows }, null, 2));
await fs.writeFile(csvPath, `${toCsv(rows)}\n`);
await fs.writeFile(googlePath, JSON.stringify({ runId: RUN_ID, method: "browser_safe_representative_subset", requestedFullSet: 600, subsetSize: googleSubset.length, rows: googleSubset }, null, 2));

console.log(JSON.stringify({ runId: RUN_ID, jsonPath, csvPath, googlePath, summary }, null, 2));
assertRegressionThresholds(summary, rows);

function buildCases() {
  const rows = [];
  for (const state of STATE_ORDER) {
    const towns = townRecords.filter((town) => town.state === state);
    const pois = poiRecords.filter((poi) => poi.state === state);
    rows.push(...buildPreciseAddressCases(state, towns, CASES_PER_CATEGORY));
    rows.push(...buildBroadAddressCases(state, towns, CASES_PER_CATEGORY));
    rows.push(...buildPoiCases(state, towns, pois, CASES_PER_CATEGORY));
    rows.push(...buildSpecialCases(state, CASES_PER_CATEGORY));
    rows.push(...buildNewBuildStyleCases(state, towns, CASES_PER_CATEGORY));
  }
  return rows.map((row, index) => ({ ...row, id: `prefix-600-${String(index + 1).padStart(3, "0")}` }));
}

function buildPreciseAddressCases(state, towns, count) {
  return repeatBuild(count, (index) => {
    const town = towns[index % towns.length];
    const street = STREET_NAMES[state][index % STREET_NAMES[state].length];
    const number = 1 + ((index * 17) % 238);
    return caseRow("precise_address", state, `${number} ${street} ${town.name} ${state}`, town.name, "precise_address", [
      town.name,
      street.split(" ")[0],
    ]);
  });
}

function buildBroadAddressCases(state, towns, count) {
  return repeatBuild(count, (index) => {
    const town = towns[(index * 3) % towns.length];
    const street = STREET_NAMES[state][index % STREET_NAMES[state].length];
    const query = index % 3 === 0 ? `${town.name} ${state}` : index % 3 === 1 ? `${street} ${town.name}` : `${town.name} town centre`;
    return caseRow("broad_address", state, query, town.name, "broad_prominent", [town.name]);
  });
}

function buildPoiCases(state, towns, pois, count) {
  return repeatBuild(count, (index) => {
    const poi = pois[index % pois.length];
    const fallbackTown = towns.find((town) => normalise(poi.label).includes(normalise(town.name))) || towns[index % towns.length];
    return caseRow("poi_landmark", state, poi.label, fallbackTown.name, "prominent_landmark", [
      ...firstUsefulTokens(poi.label),
      fallbackTown.name,
    ]);
  });
}

function buildSpecialCases(state, count) {
  const specials = SPECIAL_CASES[state];
  return repeatBuild(count, (index) => {
    const [query, locality, prominence] = specials[index % specials.length];
    const variant = index < specials.length ? query : index % 2 === 0 ? `${query} Australia` : query.replace(new RegExp(`\\b(${STATE_ORDER.join("|")})\\b$`), "").trim();
    return caseRow("rural_remote_island", state, variant, locality, prominence, [locality, ...firstUsefulTokens(query)]);
  });
}

function buildNewBuildStyleCases(state, towns, count) {
  return repeatBuild(count, (index) => {
    const town = towns[(index * 5) % towns.length];
    const street = STREET_NAMES[state][index % STREET_NAMES[state].length];
    const unit = index % 3 === 0 ? `87A` : index % 3 === 1 ? `Unit ${1 + (index % 9)}/${12 + index}` : `Townhouse ${1 + (index % 7)} ${18 + index}`;
    return caseRow("new_duplex_townhouse", state, `${unit} ${street} ${town.name} ${state}`, town.name, "new_build_style", [
      town.name,
      street.split(" ")[0],
    ], {
      verifiedRealAddress: false,
      expectedAccuracy: "street_or_locality_recovery",
    });
  });
}

function caseRow(category, state, query, expectedLocality, prominence, expectedTerms, extra = {}) {
  return {
    category,
    state,
    query,
    expectedLocality,
    prominence,
    expectedTerms: [...new Set(expectedTerms.map(String).filter(Boolean))],
    ...extra,
  };
}

async function runCase(testCase, index) {
  const prefixes = prefixesFor(testCase.query);
  let firstAnyMatchChars = null;
  let firstTopMatchChars = null;
  let firstWrongStreetTopBeforeAnyChars = null;
  let firstSuggestionChars = null;
  let finalPayload = null;
  let finalSuggestions = [];
  let calls = 0;
  let elapsedMs = 0;

  for (const prefix of prefixes) {
    const started = Date.now();
    const payload = await geocode({
      query: prefix,
      limit: LIMIT,
      sessionToken: `prefix-600-${RUN_ID}`,
      provider: process.env.FUEL_PATH_GEOCODE_PROVIDER || "nominatim",
    });
    calls += 1;
    elapsedMs += Date.now() - started;
    const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    if (suggestions.length && firstSuggestionChars === null) firstSuggestionChars = prefix.length;
    const matchIndex = suggestions.findIndex((suggestion) => suggestionMatches(testCase, suggestion));
    if (
      suggestions[0]?.type === "street" &&
      matchIndex < 0 &&
      firstAnyMatchChars === null &&
      firstWrongStreetTopBeforeAnyChars === null
    ) {
      firstWrongStreetTopBeforeAnyChars = prefix.length;
    }
    if (matchIndex >= 0 && firstAnyMatchChars === null) firstAnyMatchChars = prefix.length;
    if (matchIndex === 0 && firstTopMatchChars === null) firstTopMatchChars = prefix.length;
    finalPayload = payload;
    finalSuggestions = suggestions;
  }

  const finalTop = finalSuggestions[0] || null;
  const finalAnyMatch = finalSuggestions.some((suggestion) => suggestionMatches(testCase, suggestion));
  const finalTopMatch = finalTop ? suggestionMatches(testCase, finalTop) : false;
  return {
    ...testCase,
    index,
    queryLength: testCase.query.length,
    prefixesTested: calls,
    firstSuggestionChars,
    firstAnyMatchChars,
    firstTopMatchChars,
    firstWrongStreetTopBeforeAnyChars,
    finalSuggestionCount: finalSuggestions.length,
    finalAnyMatch,
    finalTopMatch,
    finalTopLabel: finalTop?.label || "",
    finalTopProvider: finalTop?.provider || "",
    finalTopType: finalTop?.type || "",
    finalLookupStatus: finalPayload?.lookupStatus || "",
    finalWarning: finalPayload?.warning || "",
    elapsedMs,
    result: finalTopMatch ? "top_match" : finalAnyMatch ? "ranked_match" : finalSuggestions.length ? "suggestions_but_not_expected" : "no_suggestion",
  };
}

function suggestionMatches(testCase, suggestion) {
  const label = normalise(suggestion?.label);
  if (!label) return false;
  const state = String(testCase.state || "").toLowerCase();
  const stateMatch = label.includes(` ${state} `) || label.endsWith(` ${state}`) || label.includes(` ${state}${normalise(suggestion?.postcode || "")}`);
  const localityMatch = normalise(testCase.expectedLocality) && label.includes(normalise(testCase.expectedLocality));
  const expectedTermMatch = testCase.expectedTerms.some((term) => {
    const needle = normalise(term);
    return needle.length >= 4 && label.includes(needle);
  });
  return Boolean((stateMatch || suggestion?.state === testCase.state || localityMatch) && (localityMatch || expectedTermMatch));
}

function prefixesFor(query) {
  const prefixes = [];
  const text = String(query || "").trim();
  for (let length = MIN_PREFIX_CHARS; length <= text.length; length += 1) {
    prefixes.push(text.slice(0, length));
  }
  return prefixes;
}

function summarise(rows) {
  return {
    overall: summariseGroup(rows),
    byState: groupSummary(rows, "state"),
    byCategory: groupSummary(rows, "category"),
    byProminence: groupSummary(rows, "prominence"),
  };
}

function summariseGroup(rows) {
  const topChars = rows.map((row) => row.firstTopMatchChars).filter(Number.isFinite);
  const anyChars = rows.map((row) => row.firstAnyMatchChars).filter(Number.isFinite);
  return {
    cases: rows.length,
    finalTopMatch: rows.filter((row) => row.finalTopMatch).length,
    finalAnyMatch: rows.filter((row) => row.finalAnyMatch).length,
    finalNoMatch: rows.filter((row) => !row.finalAnyMatch).length,
    suggestionsButNotExpected: rows.filter((row) => row.result === "suggestions_but_not_expected").length,
    noSuggestion: rows.filter((row) => row.result === "no_suggestion").length,
    wrongStreetTopBeforeAnyMatch: rows.filter((row) => Number.isFinite(row.firstWrongStreetTopBeforeAnyChars)).length,
    avgTopChars: average(topChars),
    p50TopChars: percentile(topChars, 50),
    p90TopChars: percentile(topChars, 90),
    avgAnyChars: average(anyChars),
    p50AnyChars: percentile(anyChars, 50),
    p90AnyChars: percentile(anyChars, 90),
  };
}

function groupSummary(rows, field) {
  return Object.fromEntries(
    [...new Set(rows.map((row) => row[field]))]
      .sort()
      .map((key) => [key, summariseGroup(rows.filter((row) => row[field] === key))]),
  );
}

function selectGoogleSubset(rows, maxRows) {
  const selected = [];
  for (const state of STATE_ORDER) {
    for (const category of ["precise_address", "broad_address", "poi_landmark", "rural_remote_island", "new_duplex_townhouse"]) {
      selected.push(...rows.filter((row) => row.state === state && row.category === category).slice(0, Math.max(1, Math.floor(maxRows / STATE_ORDER.length / 5))));
    }
  }
  return selected.slice(0, maxRows).map(({ id, category, state, query, expectedLocality, prominence, firstAnyMatchChars, firstTopMatchChars, finalTopMatch, finalTopLabel }) => ({
    id,
    category,
    state,
    query,
    expectedLocality,
    prominence,
    fuelPathFirstAnyMatchChars: firstAnyMatchChars,
    fuelPathFirstTopMatchChars: firstTopMatchChars,
    fuelPathFinalTopMatch: finalTopMatch,
    fuelPathFinalTopLabel: finalTopLabel,
  }));
}

function assertRegressionThresholds(summary, rows) {
  const failures = [];
  const overall = summary.overall;
  if (overall.finalTopMatch !== EXPECTED_CASE_COUNT) {
    failures.push(`Expected ${EXPECTED_CASE_COUNT}/${EXPECTED_CASE_COUNT} final top matches, got ${overall.finalTopMatch}`);
  }
  if (overall.finalNoMatch !== 0) {
    failures.push(`Expected 0 final no-match cases, got ${overall.finalNoMatch}`);
  }
  if (overall.suggestionsButNotExpected !== 0) {
    failures.push(`Expected 0 wrong final suggestions, got ${overall.suggestionsButNotExpected}`);
  }
  if (overall.noSuggestion !== 0) {
    failures.push(`Expected 0 final no-suggestion cases, got ${overall.noSuggestion}`);
  }
  if (overall.p90AnyChars > MAX_P90_ANY_CHARS) {
    failures.push(`Expected p90 chars to any correct suggestion <= ${MAX_P90_ANY_CHARS}, got ${overall.p90AnyChars}`);
  }

  for (const state of STATE_ORDER) {
    const stateSummary = summary.byState[state];
    if (!stateSummary || stateSummary.finalTopMatch !== stateSummary.cases) {
      failures.push(`Expected all ${state} cases to top-match, got ${stateSummary?.finalTopMatch || 0}/${stateSummary?.cases || 0}`);
    }
  }

  const remoteSummary = summary.byCategory.rural_remote_island;
  if (!remoteSummary || remoteSummary.finalTopMatch !== remoteSummary.cases) {
    failures.push(`Expected all rural/remote/island cases to top-match, got ${remoteSummary?.finalTopMatch || 0}/${remoteSummary?.cases || 0}`);
  }

  for (const category of ["precise_address", "new_duplex_townhouse"]) {
    const categorySummary = summary.byCategory[category];
    if (categorySummary?.wrongStreetTopBeforeAnyMatch) {
      failures.push(`Expected 0 unsafe early street suggestions for ${category}, got ${categorySummary.wrongStreetTopBeforeAnyMatch}`);
    }
  }

  if (failures.length) {
    const examples = rows
      .filter((row) => row.result !== "top_match")
      .slice(0, 10)
      .map((row) => `${row.id} ${row.query} -> ${row.finalTopLabel || row.result}`);
    throw new Error(`${failures.join("; ")}${examples.length ? `; examples: ${examples.join(" | ")}` : ""}`);
  }
}

function parseTownRecords(text) {
  const rows = [];
  const pattern = /town\("([^"]+)",\s*"([A-Z]{2,3})",\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*"([^"]*)"/g;
  let match;
  while ((match = pattern.exec(text))) {
    rows.push({
      name: match[1],
      state: match[2],
      lat: Number(match[3]),
      lon: Number(match[4]),
      postcode: match[5],
    });
  }
  return rows.filter((row) => STATE_ORDER.includes(row.state));
}

function parsePoiRecords(text) {
  const rows = [];
  const pattern = /poi\("([^"]+)",\s*"([A-Z]{2,3})",\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(text))) {
    rows.push({
      label: match[1],
      state: match[2],
      locality: match[3],
    });
  }
  return rows.filter((row) => STATE_ORDER.includes(row.state));
}

function repeatBuild(count, builder) {
  return Array.from({ length: count }, (_, index) => builder(index));
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

function toCsv(rows) {
  const headers = [
    "id",
    "category",
    "state",
    "prominence",
    "query",
    "expectedLocality",
    "queryLength",
    "firstSuggestionChars",
    "firstAnyMatchChars",
    "firstTopMatchChars",
    "firstWrongStreetTopBeforeAnyChars",
    "finalAnyMatch",
    "finalTopMatch",
    "result",
    "finalSuggestionCount",
    "finalTopLabel",
    "finalTopProvider",
    "finalTopType",
    "elapsedMs",
  ];
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function installProviderFailureMode(mode) {
  if (!mode) return;
  global.fetch = async () => {
    const status = mode === "rate_limit" ? 429 : 500;
    return {
      ok: false,
      status,
      statusText: status === 429 ? "Too Many Requests" : "Provider Failure",
      async text() {
        return JSON.stringify({
          error: {
            message: status === 429 ? "Too many requests" : "Provider failure",
          },
        });
      },
    };
  };
}

function installProviderLogFilter() {
  if (process.env.FUEL_PATH_PREFIX_VERBOSE_PROVIDER_LOGS === "1") return;
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const shouldSuppress = (args) => args.some((arg) => String(arg).includes("WA FuelWatch region") && String(arg).includes("Provider returned 429"));
  console.warn = (...args) => {
    if (!shouldSuppress(args)) originalWarn(...args);
  };
  console.error = (...args) => {
    if (!shouldSuppress(args)) originalError(...args);
  };
}
