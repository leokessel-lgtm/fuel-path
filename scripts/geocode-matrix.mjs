import { createRequire } from "node:module";

const API_BASE = process.env.FUEL_PATH_API_BASE || "https://fuel-path.vercel.app";
const MATRIX_MODE = process.env.FUEL_PATH_MATRIX_MODE || "http";
const PROVIDER_FAILURE_MODE = process.env.FUEL_PATH_MATRIX_PROVIDER_FAILURE || "";
const RUN_ID = process.env.FUEL_PATH_MATRIX_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const DELAY_MS = Number(process.env.FUEL_PATH_MATRIX_DELAY_MS || (MATRIX_MODE === "module" ? 0 : 1150));
const LIMIT = Number(process.env.FUEL_PATH_MATRIX_LIMIT || 5);
const require = createRequire(import.meta.url);

const stateBounds = {
  NSW: { latMin: -37.8, latMax: -28.0, lonMin: 140.8, lonMax: 154.2 },
  ACT: { latMin: -35.95, latMax: -35.05, lonMin: 148.65, lonMax: 149.45 },
  QLD: { latMin: -29.2, latMax: -9.0, lonMin: 137.8, lonMax: 154.2 },
  WA: { latMin: -36.2, latMax: -13.0, lonMin: 112.0, lonMax: 129.1 },
  SA: { latMin: -38.3, latMax: -25.9, lonMin: 129.0, lonMax: 141.1 },
};

const precise = {
  NSW: [
    "87A Corea Street Sylvania NSW 2224",
    "1 Martin Place Sydney NSW",
    "483 George Street Sydney NSW",
    "100 Market Street Sydney NSW",
    "30 Pitt Street Sydney NSW",
    "1 Macquarie Street Sydney NSW",
    "2 Murray Street Sydney NSW",
    "1 Showground Road Sydney Olympic Park NSW",
    "10 Darcy Street Parramatta NSW",
    "159 Church Street Parramatta NSW",
    "6 Castle Street Castle Hill NSW",
    "455 George Street Sydney NSW",
    "500 George Street Sydney NSW",
    "1 Farrer Place Sydney NSW",
    "60 Margaret Street Sydney NSW",
    "1 Denison Street North Sydney NSW",
    "77 Berry Street North Sydney NSW",
    "1 Railway Parade Burwood NSW",
    "100 Burwood Road Burwood NSW",
    "36 Blue Street North Sydney NSW",
  ],
  ACT: [
    "148 Bunda Street Canberra ACT",
    "220 London Circuit Canberra ACT",
    "1 Constitution Avenue Canberra ACT",
    "25 Edinburgh Avenue Canberra ACT",
    "180 London Circuit Canberra ACT",
    "1 Garema Place Canberra ACT",
    "15 Bowes Street Woden ACT",
    "35 Furzer Street Phillip ACT",
    "8 Keltie Street Phillip ACT",
    "125 Bunda Street Canberra ACT",
    "2 Akuna Street Canberra ACT",
    "17 Garema Place Canberra ACT",
    "4 National Circuit Barton ACT",
    "1 King George Terrace Parkes ACT",
    "18 King George Terrace Parkes ACT",
    "50 Marcus Clarke Street Canberra ACT",
    "2 Phillip Law Street Canberra ACT",
    "6 Brindabella Circuit Canberra Airport ACT",
    "20 Challis Street Dickson ACT",
    "1 Cowlishaw Street Greenway ACT",
  ],
  QLD: [
    "100 Queen Street Brisbane QLD",
    "171 George Street Brisbane QLD",
    "1 Eagle Street Brisbane QLD",
    "123 Albert Street Brisbane QLD",
    "200 Mary Street Brisbane QLD",
    "33 Charlotte Street Brisbane QLD",
    "80 Albert Street Brisbane QLD",
    "167 Grey Street South Brisbane QLD",
    "Stanley Place South Brisbane QLD",
    "600 Gregory Terrace Bowen Hills QLD",
    "1 Airport Drive Brisbane Airport QLD",
    "111 Eagle Street Brisbane QLD",
    "260 Queen Street Brisbane QLD",
    "266 George Street Brisbane QLD",
    "317 Edward Street Brisbane QLD",
    "88 Creek Street Brisbane QLD",
    "40 Tank Street Brisbane QLD",
    "53 Albert Street Brisbane QLD",
    "39 Hercules Street Hamilton QLD",
    "322 Moggill Road Indooroopilly QLD",
  ],
  WA: [
    "100 St Georges Terrace Perth WA",
    "200 St Georges Terrace Perth WA",
    "250 St Georges Terrace Perth WA",
    "1 William Street Perth WA",
    "140 William Street Perth WA",
    "300 Murray Street Perth WA",
    "683 Hay Street Perth WA",
    "420 Wellington Street Perth WA",
    "Riverside Drive Perth WA",
    "4 Barrack Street Perth WA",
    "15 The Esplanade Perth WA",
    "35 Stirling Highway Crawley WA",
    "2 Victoria Avenue Perth WA",
    "99 Adelaide Terrace East Perth WA",
    "207 Adelaide Terrace Perth WA",
    "11 Mounts Bay Road Perth WA",
    "8 Whiteman Street Burswood WA",
    "146 Murray Street Perth WA",
    "124 James Street Northbridge WA",
    "2 George Wiencke Drive Perth Airport WA",
  ],
  SA: [
    "100 King William Street Adelaide SA",
    "25 Grenfell Street Adelaide SA",
    "50 Flinders Street Adelaide SA",
    "80 Grenfell Street Adelaide SA",
    "1 North Terrace Adelaide SA",
    "55 Currie Street Adelaide SA",
    "101 Grenfell Street Adelaide SA",
    "31 Rundle Mall Adelaide SA",
    "12 Pirie Street Adelaide SA",
    "70 Franklin Street Adelaide SA",
    "44 Waymouth Street Adelaide SA",
    "150 North Terrace Adelaide SA",
    "1 Festival Drive Adelaide SA",
    "141 King William Road Unley SA",
    "123 Richmond Road Richmond SA",
    "1 James Schofield Drive Adelaide Airport SA",
    "976 North East Road Modbury SA",
    "297 Diagonal Road Oaklands Park SA",
    "976 South Road Edwardstown SA",
    "8 Greenhill Road Wayville SA",
  ],
};

const broad = {
  NSW: [
    "Sylvania NSW",
    "Corea Street Sylvania",
    "Martin Place Sydney",
    "George Street Sydney",
    "Parramatta CBD",
    "Chatswood NSW",
    "Bondi Junction",
    "Burwood NSW",
    "Sydney Olympic Park",
    "Castle Hill NSW",
    "North Sydney station",
    "Rhodes NSW",
    "Blacktown NSW",
    "Campbelltown NSW",
    "Hornsby NSW",
    "Manly NSW",
    "Randwick NSW",
    "Miranda NSW",
    "Wollongong NSW",
    "Newcastle NSW",
  ],
  ACT: [
    "Canberra city",
    "Bunda Street Canberra",
    "London Circuit Canberra",
    "Woden ACT",
    "Phillip ACT",
    "Belconnen ACT",
    "Tuggeranong ACT",
    "Gungahlin ACT",
    "Kingston Foreshore",
    "Braddon ACT",
    "Dickson ACT",
    "Barton ACT",
    "Parkes ACT",
    "Fyshwick ACT",
    "Canberra Airport",
    "Manuka ACT",
    "Civic Canberra",
    "Acton ACT",
    "Kambah ACT",
    "Majura Park",
  ],
  QLD: [
    "Brisbane CBD",
    "Queen Street Brisbane",
    "South Bank Brisbane",
    "Fortitude Valley",
    "New Farm QLD",
    "Bowen Hills QLD",
    "Brisbane Airport",
    "Hamilton QLD",
    "Indooroopilly",
    "Chermside QLD",
    "Toowong QLD",
    "Mount Gravatt",
    "Logan Central",
    "Springfield QLD",
    "Ipswich QLD",
    "Gold Coast QLD",
    "Surfers Paradise",
    "Cairns QLD",
    "Townsville QLD",
    "Rockhampton QLD",
  ],
  WA: [
    "Perth CBD",
    "St Georges Terrace Perth",
    "William Street Perth",
    "Northbridge Perth",
    "East Perth",
    "West Perth",
    "Crawley WA",
    "Burswood WA",
    "Perth Airport",
    "Fremantle WA",
    "Subiaco WA",
    "Joondalup WA",
    "Cannington WA",
    "Midland WA",
    "Mandurah WA",
    "Rockingham WA",
    "Scarborough WA",
    "Victoria Park WA",
    "Applecross WA",
    "Armadale WA",
  ],
  SA: [
    "Adelaide CBD",
    "King William Street Adelaide",
    "Rundle Mall Adelaide",
    "North Terrace Adelaide",
    "North Adelaide",
    "Glenelg SA",
    "Unley SA",
    "Richmond SA",
    "Adelaide Airport",
    "Modbury SA",
    "Oaklands Park",
    "Edwardstown SA",
    "Wayville SA",
    "Norwood SA",
    "Mawson Lakes",
    "Port Adelaide",
    "Prospect SA",
    "Henley Beach",
    "Mount Gambier SA",
    "Whyalla SA",
  ],
};

const pois = {
  NSW: [
    "Sydney Opera House",
    "Sydney Harbour Bridge",
    "Bondi Beach",
    "Sydney Airport",
    "Taronga Zoo Sydney",
    "Westfield Parramatta",
    "Qudos Bank Arena",
    "Accor Stadium Sydney",
    "Chatswood Chase",
    "Manly Wharf",
    "Royal Randwick Racecourse",
    "Luna Park Sydney",
    "Darling Harbour",
    "Macquarie Centre",
    "University of Sydney",
    "Westmead Hospital",
    "Blacktown Hospital",
    "Newcastle Interchange",
    "Wollongong Central",
    "Cronulla Beach",
  ],
  ACT: [
    "Parliament House Canberra",
    "Australian War Memorial",
    "National Gallery of Australia",
    "Canberra Centre",
    "National Museum of Australia",
    "Questacon",
    "Canberra Airport",
    "Manuka Oval",
    "GIO Stadium Canberra",
    "Australian National University",
    "Westfield Belconnen",
    "South.Point Tuggeranong",
    "National Library of Australia",
    "Royal Australian Mint",
    "Mount Ainslie Lookout",
    "Old Parliament House",
    "National Portrait Gallery Canberra",
    "Canberra Hospital",
    "Dickson Interchange",
    "Kingston Foreshore",
  ],
  QLD: [
    "South Bank Parklands Brisbane",
    "Queen Street Mall",
    "Suncorp Stadium",
    "Brisbane Airport",
    "Lone Pine Koala Sanctuary",
    "Roma Street Parkland",
    "The Gabba",
    "Brisbane Convention Centre",
    "Queensland Performing Arts Centre",
    "Westfield Chermside",
    "Indooroopilly Shopping Centre",
    "Dreamworld Gold Coast",
    "Sea World Gold Coast",
    "Surfers Paradise Beach",
    "Cairns Esplanade Lagoon",
    "Townsville Strand",
    "Sunshine Plaza Maroochydore",
    "Robina Town Centre",
    "Mount Coot-tha Lookout",
    "Queensland University of Technology Gardens Point",
  ],
  WA: [
    "Elizabeth Quay Perth",
    "Optus Stadium Perth",
    "Kings Park Perth",
    "Perth Airport",
    "Fremantle Prison",
    "Cottesloe Beach",
    "Perth Zoo",
    "RAC Arena",
    "Crown Perth",
    "University of Western Australia",
    "Westfield Carousel",
    "Karrinyup Shopping Centre",
    "Scarborough Beach",
    "Hillarys Boat Harbour",
    "Joondalup Health Campus",
    "Fiona Stanley Hospital",
    "Perth Convention Centre",
    "WA Museum Boola Bardip",
    "Yagan Square",
    "Mandurah Forum",
  ],
  SA: [
    "Rundle Mall Adelaide",
    "Adelaide Oval",
    "Adelaide Airport",
    "Glenelg Beach",
    "Art Gallery of South Australia",
    "Adelaide Central Market",
    "Adelaide Zoo",
    "Botanic Garden Adelaide",
    "Festival Theatre Adelaide",
    "Westfield Marion",
    "Tea Tree Plaza",
    "University of Adelaide",
    "Flinders Medical Centre",
    "Norwood Oval",
    "Mount Lofty Summit",
    "Henley Beach",
    "Port Adelaide Plaza",
    "Mawson Lakes Interchange",
    "Thebarton Theatre",
    "Adelaide Entertainment Centre",
  ],
};

function allCases() {
  const cases = [];
  for (const [category, grouped] of Object.entries({ precise, broad, poi: pois })) {
    for (const [state, queries] of Object.entries(grouped)) {
      queries.forEach((query, index) => {
        cases.push({
          id: `${category}-${state}-${String(index + 1).padStart(2, "0")}`,
          category,
          state,
          query,
        });
      });
    }
  }
  return cases;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inBounds(location, state) {
  if (!location || typeof location.lat !== "number" || typeof location.lon !== "number") return false;
  const b = stateBounds[state];
  return location.lat >= b.latMin && location.lat <= b.latMax && location.lon >= b.lonMin && location.lon <= b.lonMax;
}

function likelyWrongState(location, state) {
  if (!location) return false;
  if (inBounds(location, state)) return false;
  const label = String(location.label || "").toUpperCase();
  return !label.includes(state);
}

function tokenCoverage(query, label) {
  const qTokens = String(query)
    .toLowerCase()
    .replace(/\b(nsw|act|qld|wa|sa|australia)\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  if (!qTokens.length) return 0;
  const haystack = String(label || "").toLowerCase();
  const matches = qTokens.filter((token) => haystack.includes(token));
  return matches.length / qTokens.length;
}

function classify(row) {
  if (!row.httpOk) return "http_error";
  if (row.lookupStatus === "degraded") return "degraded";
  if (!row.suggestionCount) return "no_match";
  if (row.topWrongState) return "wrong_region";
  if (row.category === "precise" && row.tokenCoverage < 0.45) return "weak_match";
  if (row.category !== "precise" && row.tokenCoverage < 0.2) return "weak_match";
  return "usable";
}

async function runOne(testCase, index, total) {
  if (MATRIX_MODE === "module") return runOneModule(testCase, index, total);
  return runOneHttp(testCase, index, total);
}

async function runOneModule(testCase, index, total) {
  const { geocode } = require("../api/_backend");
  const started = Date.now();
  try {
    const payload = await geocode({
      query: testCase.query,
      limit: LIMIT,
      sessionToken: `geocode-matrix-${RUN_ID}`,
      provider: process.env.FUEL_PATH_GEOCODE_PROVIDER || "nominatim",
    });
    const top = payload?.suggestions?.[0] || payload?.location || null;
    const row = {
      ...testCase,
      index: index + 1,
      total,
      httpStatus: 200,
      httpOk: true,
      elapsedMs: Date.now() - started,
      provider: payload?.provider || "",
      providerMode: payload?.providerMode || "",
      lookupStatus: payload?.lookupStatus || "",
      warning: payload?.warning || "",
      suggestionCount: Array.isArray(payload?.suggestions) ? payload.suggestions.length : 0,
      topLabel: top?.label || "",
      topProvider: top?.provider || "",
      topType: top?.type || "",
      topLat: typeof top?.lat === "number" ? top.lat : "",
      topLon: typeof top?.lon === "number" ? top.lon : "",
      topInStateBounds: inBounds(top, testCase.state),
      topWrongState: likelyWrongState(top, testCase.state),
      tokenCoverage: Number(tokenCoverage(testCase.query, top?.label).toFixed(2)),
    };
    row.result = classify(row);
    return row;
  } catch (error) {
    const row = {
      ...testCase,
      index: index + 1,
      total,
      httpStatus: 0,
      httpOk: false,
      elapsedMs: Date.now() - started,
      provider: "",
      providerMode: "",
      lookupStatus: "",
      warning: error?.message || String(error),
      suggestionCount: 0,
      topLabel: "",
      topProvider: "",
      topType: "",
      topLat: "",
      topLon: "",
      topInStateBounds: false,
      topWrongState: false,
      tokenCoverage: 0,
    };
    row.result = classify(row);
    return row;
  }
}

async function runOneHttp(testCase, index, total) {
  const url = new URL("/api/geocode", API_BASE);
  url.searchParams.set("q", testCase.query);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("sessionToken", `geocode-matrix-${RUN_ID}`);
  const started = Date.now();
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { parseError: text.slice(0, 300) };
    }
    const top = payload?.suggestions?.[0] || payload?.location || null;
    const row = {
      ...testCase,
      index: index + 1,
      total,
      httpStatus: response.status,
      httpOk: response.ok,
      elapsedMs: Date.now() - started,
      provider: payload?.provider || "",
      providerMode: payload?.providerMode || "",
      lookupStatus: payload?.lookupStatus || "",
      warning: payload?.warning || "",
      suggestionCount: Array.isArray(payload?.suggestions) ? payload.suggestions.length : 0,
      topLabel: top?.label || "",
      topProvider: top?.provider || "",
      topType: top?.type || "",
      topLat: typeof top?.lat === "number" ? top.lat : "",
      topLon: typeof top?.lon === "number" ? top.lon : "",
      topInStateBounds: inBounds(top, testCase.state),
      topWrongState: likelyWrongState(top, testCase.state),
      tokenCoverage: Number(tokenCoverage(testCase.query, top?.label).toFixed(2)),
    };
    row.result = classify(row);
    return row;
  } catch (error) {
    const row = {
      ...testCase,
      index: index + 1,
      total,
      httpStatus: 0,
      httpOk: false,
      elapsedMs: Date.now() - started,
      provider: "",
      providerMode: "",
      lookupStatus: "",
      warning: error?.message || String(error),
      suggestionCount: 0,
      topLabel: "",
      topProvider: "",
      topType: "",
      topLat: "",
      topLon: "",
      topInStateBounds: false,
      topWrongState: false,
      tokenCoverage: 0,
    };
    row.result = classify(row);
    return row;
  }
}

function summarise(rows) {
  const group = {};
  for (const row of rows) {
    for (const key of [`category:${row.category}`, `state:${row.state}`, `stateCategory:${row.state}:${row.category}`]) {
      group[key] ||= { total: 0, usable: 0, no_match: 0, degraded: 0, wrong_region: 0, weak_match: 0, http_error: 0 };
      group[key].total += 1;
      group[key][row.result] += 1;
    }
  }
  const overall = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.result] += 1;
      acc.elapsedMsTotal += row.elapsedMs;
      acc.maxElapsedMs = Math.max(acc.maxElapsedMs, row.elapsedMs);
      return acc;
    },
    { total: 0, usable: 0, no_match: 0, degraded: 0, wrong_region: 0, weak_match: 0, http_error: 0, elapsedMsTotal: 0, maxElapsedMs: 0 },
  );
  overall.avgElapsedMs = Math.round(overall.elapsedMsTotal / Math.max(1, overall.total));
  delete overall.elapsedMsTotal;
  return { overall, group };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const headers = [
    "id",
    "category",
    "state",
    "query",
    "result",
    "lookupStatus",
    "suggestionCount",
    "topLabel",
    "topProvider",
    "topType",
    "topLat",
    "topLon",
    "topInStateBounds",
    "tokenCoverage",
    "elapsedMs",
    "warning",
  ];
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

const cases = allCases();
if (cases.length !== 300) {
  throw new Error(`Expected 300 cases, received ${cases.length}`);
}

installProviderFailureMode();

console.log(
  `Starting ${cases.length} geocode lookups in ${MATRIX_MODE} mode against ${MATRIX_MODE === "module" ? "local backend module" : API_BASE} with ${DELAY_MS}ms delay`,
);
const rows = [];
for (let index = 0; index < cases.length; index += 1) {
  const row = await runOne(cases[index], index, cases.length);
  rows.push(row);
  if ((index + 1) % 25 === 0 || index === cases.length - 1) {
    const summary = summarise(rows).overall;
    console.log(
      `${index + 1}/${cases.length} usable=${summary.usable} no_match=${summary.no_match} weak=${summary.weak_match} wrong=${summary.wrong_region} degraded=${summary.degraded} http=${summary.http_error}`,
    );
  }
  if (index < cases.length - 1) await delay(DELAY_MS);
}

const summary = summarise(rows);
const fs = await import("node:fs/promises");
await fs.mkdir("tmp", { recursive: true });
const jsonPath = `tmp/geocode-matrix-results-${RUN_ID}.json`;
const csvPath = `tmp/geocode-matrix-results-${RUN_ID}.csv`;
await fs.writeFile(
  jsonPath,
  JSON.stringify({ runId: RUN_ID, apiBase: API_BASE, matrixMode: MATRIX_MODE, providerFailureMode: PROVIDER_FAILURE_MODE, delayMs: DELAY_MS, limit: LIMIT, summary, rows }, null, 2),
);
await fs.writeFile(csvPath, `${toCsv(rows)}\n`);

console.log(JSON.stringify({ runId: RUN_ID, apiBase: API_BASE, matrixMode: MATRIX_MODE, providerFailureMode: PROVIDER_FAILURE_MODE, jsonPath, csvPath, summary }, null, 2));

function installProviderFailureMode() {
  if (MATRIX_MODE !== "module" || !PROVIDER_FAILURE_MODE) return;
  global.fetch = async () => {
    const status = PROVIDER_FAILURE_MODE === "rate_limit" ? 429 : 500;
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
