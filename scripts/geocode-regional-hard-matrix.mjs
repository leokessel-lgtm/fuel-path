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
    "1 Banna Avenue Griffith NSW",
    "100 Baylis Street Wagga Wagga NSW",
    "200 Beardy Street Armidale NSW",
    "5 Darling Street Dubbo NSW",
    "127 Marius Street Tamworth NSW",
    "1 Kable Avenue Tamworth NSW",
    "10 Mann Street Gosford NSW",
    "66 High Street Wauchope NSW",
    "22 Molesworth Street Lismore NSW",
    "33 Horton Street Port Macquarie NSW",
    "88 Argent Street Broken Hill NSW",
    "31 Keppel Street Bathurst NSW",
    "1 Church Street Mudgee NSW",
    "2 Bourke Street Goulburn NSW",
    "121 Kendal Street Cowra NSW",
    "46 Summer Street Orange NSW",
    "1 Auburn Street Moree NSW",
    "240 Carp Street Bega NSW",
    "75 Morgan Street Cootamundra NSW",
    "2 Vulcan Street Moruya NSW",
  ],
  ACT: [
    "1 Lanyon Drive Tharwa ACT",
    "10 Beltana Road Pialligo ACT",
    "1 McClymont Way Weston Creek ACT",
    "7 O'Hanlon Place Nicholls ACT",
    "1 Felstead Vista Denman Prospect ACT",
    "21 Liardet Street Weston ACT",
    "1 Florey Drive Florey ACT",
    "1 Sidney Nolan Street Conder ACT",
    "1 Bugden Avenue Gowrie ACT",
    "1 Heard Street Mawson ACT",
    "1 Chisholm Street Ainslie ACT",
    "2 Limestone Avenue Braddon ACT",
    "1 Mouat Street Lyneham ACT",
    "1 Scollay Street Greenway ACT",
    "1 Swanson Court Belconnen ACT",
    "1 McGilvray Close Gordon ACT",
    "1 Reed Street Greenway ACT",
    "1 Gartside Street Wanniassa ACT",
    "1 Hibberson Street Gungahlin ACT",
    "1 Brierly Street Weston ACT",
  ],
  QLD: [
    "1 Flinders Mall Townsville QLD",
    "100 Abbott Street Cairns QLD",
    "22 Bolsover Street Rockhampton QLD",
    "55 Victoria Street Mackay QLD",
    "135 Margaret Street Toowoomba QLD",
    "3 Maryborough Street Bundaberg QLD",
    "1 Kent Street Maryborough QLD",
    "100 Goondoon Street Gladstone QLD",
    "7 Alma Street Gympie QLD",
    "1 Haly Street Kingaroy QLD",
    "63 Cunningham Street Dalby QLD",
    "1 Mosman Street Charters Towers QLD",
    "2 Herbert Street Bowen QLD",
    "2 Shields Street Cairns QLD",
    "1 Main Street Atherton QLD",
    "13 Edith Street Innisfail QLD",
    "1 Rankin Street Innisfail QLD",
    "1 Shamrock Street Blackall QLD",
    "1 Capella Street Clermont QLD",
    "1 Eagle Street Longreach QLD",
  ],
  WA: [
    "1 Hannan Street Kalgoorlie WA",
    "100 Marine Terrace Geraldton WA",
    "1 Frederick Street Broome WA",
    "1 York Street Albany WA",
    "2 Victoria Street Bunbury WA",
    "1 Durlacher Street Geraldton WA",
    "1 Robinson Street Carnarvon WA",
    "1 Forrest Street Collie WA",
    "1 Wittenoom Street Esperance WA",
    "1 Brockman Street Pemberton WA",
    "1 Throssell Street Northam WA",
    "1 Austral Terrace Katanning WA",
    "1 Roberts Street Narrogin WA",
    "1 Federal Street Narrogin WA",
    "1 Coolibah Drive Kununurra WA",
    "1 Padbury Street Port Hedland WA",
    "1 Dampier Road Karratha WA",
    "1 McLarty Road Pinjarra WA",
    "1 Pinjarra Road Mandurah WA",
    "1 South Coast Highway Denmark WA",
  ],
  SA: [
    "1 Commercial Street Mount Gambier SA",
    "1 Ellen Street Port Pirie SA",
    "1 Forsyth Street Whyalla SA",
    "1 Murray Street Gawler SA",
    "1 Adelaide Road Murray Bridge SA",
    "1 Railway Terrace Victor Harbor SA",
    "1 Graves Street Kadina SA",
    "1 Commercial Road Port Augusta SA",
    "1 Cadell Street Goolwa SA",
    "1 Barwell Avenue Barmera SA",
    "1 Bookpurnong Terrace Loxton SA",
    "1 East Terrace Clare SA",
    "1 Sturt Highway Berri SA",
    "1 Eyre Highway Ceduna SA",
    "1 Hutchison Street Coober Pedy SA",
    "1 Randell Street Mannum SA",
    "1 Bay Road Mount Gambier SA",
    "1 Victoria Road Port Lincoln SA",
    "1 North Terrace Moonta SA",
    "1 Grenfell Street Gawler SA",
  ],
};

const broad = {
  NSW: [
    "Griffith NSW",
    "Baylis Street Wagga",
    "Beardy Street Armidale",
    "Dubbo town centre",
    "Tamworth CBD",
    "Gosford waterfront",
    "Wauchope NSW",
    "Lismore CBD",
    "Port Macquarie foreshore",
    "Broken Hill town centre",
    "Bathurst NSW",
    "Mudgee NSW",
    "Goulburn NSW",
    "Cowra NSW",
    "Orange NSW",
    "Moree NSW",
    "Bega NSW",
    "Cootamundra NSW",
    "Moruya NSW",
    "Narrabri NSW",
  ],
  ACT: [
    "Tharwa ACT",
    "Pialligo ACT",
    "Weston Creek",
    "Nicholls ACT",
    "Denman Prospect",
    "Conder ACT",
    "Gowrie ACT",
    "Mawson ACT",
    "Ainslie ACT",
    "Lyneham ACT",
    "Greenway ACT",
    "Wanniassa ACT",
    "Gordon ACT",
    "Hume ACT",
    "Hall ACT",
    "Uriarra Village ACT",
    "Stromlo ACT",
    "Holt ACT",
    "Charnwood ACT",
    "Kaleen ACT",
  ],
  QLD: [
    "Flinders Mall Townsville",
    "Abbott Street Cairns",
    "Rockhampton CBD",
    "Mackay QLD",
    "Toowoomba centre",
    "Bundaberg QLD",
    "Maryborough QLD",
    "Gladstone QLD",
    "Gympie QLD",
    "Kingaroy QLD",
    "Dalby QLD",
    "Charters Towers",
    "Bowen QLD",
    "Atherton Tablelands",
    "Innisfail QLD",
    "Blackall QLD",
    "Clermont QLD",
    "Longreach QLD",
    "Mount Isa QLD",
    "Roma QLD",
  ],
  WA: [
    "Kalgoorlie WA",
    "Geraldton foreshore",
    "Broome Chinatown",
    "Albany WA",
    "Bunbury WA",
    "Carnarvon WA",
    "Collie WA",
    "Esperance WA",
    "Pemberton WA",
    "Northam WA",
    "Katanning WA",
    "Narrogin WA",
    "Kununurra WA",
    "Port Hedland WA",
    "Karratha WA",
    "Pinjarra WA",
    "Denmark WA",
    "Manjimup WA",
    "Merredin WA",
    "Exmouth WA",
  ],
  SA: [
    "Mount Gambier SA",
    "Port Pirie SA",
    "Whyalla SA",
    "Gawler SA",
    "Murray Bridge SA",
    "Victor Harbor SA",
    "Kadina SA",
    "Port Augusta SA",
    "Goolwa SA",
    "Barmera SA",
    "Loxton SA",
    "Clare SA",
    "Berri SA",
    "Ceduna SA",
    "Coober Pedy SA",
    "Mannum SA",
    "Port Lincoln SA",
    "Moonta SA",
    "Renmark SA",
    "Naracoorte SA",
  ],
};

const poi = {
  NSW: [
    "Taronga Western Plains Zoo Dubbo",
    "The Big Banana Coffs Harbour",
    "Jenolan Caves NSW",
    "Mungo National Park",
    "Mount Panorama Bathurst",
    "Parkes Observatory",
    "Port Macquarie Base Hospital",
    "Wagga Wagga Airport",
    "Tamworth Regional Entertainment Centre",
    "Broken Hill Airport",
    "Byron Bay Lighthouse",
    "Goulburn Big Merino",
    "Orange Health Service",
    "Dubbo Regional Botanic Garden",
    "Griffith Base Hospital",
    "Lismore Base Hospital",
    "Bega Cheese Heritage Centre",
    "Moruya Airport",
    "Cowra Japanese Garden",
    "Armidale Airport",
  ],
  ACT: [
    "Tidbinbilla Nature Reserve",
    "Namadgi National Park Visitor Centre",
    "Canberra Deep Space Communication Complex",
    "National Arboretum Canberra",
    "Stromlo Forest Park",
    "Canberra Reptile Zoo",
    "Gold Creek Village",
    "Lanyon Homestead",
    "Canberra Brickworks",
    "Canberra Walk In Aviary",
    "Mugga Lane Resource Management Centre",
    "Canberra Railway Museum",
    "Kambah Village",
    "Erindale Shopping Centre",
    "Calvary Public Hospital Bruce",
    "University of Canberra Hospital",
    "Canberra Nature Park Mount Taylor",
    "Tuggeranong Hyperdome",
    "EPIC Canberra",
    "Australian Institute of Sport",
  ],
  QLD: [
    "Australian Stockman's Hall of Fame Longreach",
    "Qantas Founders Museum Longreach",
    "Carnarvon Gorge Visitor Area",
    "Mossman Gorge Centre",
    "Paronella Park",
    "Hervey Bay Airport",
    "Bundaberg Rum Distillery",
    "Rockhampton Airport",
    "Mackay Base Hospital",
    "Toowoomba Wellcamp Airport",
    "Cairns Hospital",
    "Townsville University Hospital",
    "Mount Isa Mines Rodeo",
    "Roma Big Rig",
    "Maryborough City Hall",
    "Gympie Hospital",
    "Dalby Hospital",
    "Kingaroy Peanut Van",
    "Charters Towers Venus Gold Battery",
    "Bowen Big Mango",
  ],
  WA: [
    "Wave Rock Hyden",
    "Horizontal Falls WA",
    "Bungle Bungle Visitor Centre",
    "Karijini Visitor Centre",
    "Ningaloo Centre Exmouth",
    "Kalgoorlie Super Pit Lookout",
    "Geraldton Airport",
    "Broome International Airport",
    "Albany Health Campus",
    "Bunbury Regional Hospital",
    "Esperance Airport",
    "Carnarvon Space and Technology Museum",
    "The Gap Albany",
    "Valley of the Giants Tree Top Walk",
    "Pinnacles Desert Discovery Centre",
    "Margaret River Visitor Centre",
    "Kununurra Airport",
    "Port Hedland International Airport",
    "Karratha Health Campus",
    "Denmark Visitor Centre",
  ],
  SA: [
    "Naracoorte Caves National Park",
    "Wilpena Pound Resort",
    "Umpherston Sinkhole",
    "Blue Lake Mount Gambier",
    "Port Lincoln Airport",
    "Whyalla Hospital",
    "Murray Bridge Soldiers Memorial Hospital",
    "Victor Harbor Horse Drawn Tram",
    "Monarto Safari Park",
    "Clare Valley Wine Food Tourism Centre",
    "Coober Pedy Visitor Information Centre",
    "Ceduna Airport",
    "Port Augusta Hospital",
    "Renmark Paringa Visitor Information Centre",
    "Barossa Visitor Centre Tanunda",
    "Wallaroo Jetty",
    "Gawler Health Service",
    "Berri Hospital",
    "Port Pirie Regional Health Service",
    "Moonta Mines Museum",
  ],
};

function cases() {
  const rows = [];
  for (const [category, grouped] of Object.entries({ precise, broad, poi })) {
    for (const [state, queries] of Object.entries(grouped)) {
      queries.forEach((query, index) => rows.push({
        id: `regional-${category}-${state}-${String(index + 1).padStart(2, "0")}`,
        category,
        state,
        query,
      }));
    }
  }
  return rows;
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
  return qTokens.filter((token) => haystack.includes(token)).length / qTokens.length;
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
      sessionToken: `regional-hard-${RUN_ID}`,
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
  url.searchParams.set("sessionToken", `regional-hard-${RUN_ID}`);
  const started = Date.now();
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json();
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
  const overall = rows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.result] += 1;
    acc.elapsedMsTotal += row.elapsedMs;
    acc.maxElapsedMs = Math.max(acc.maxElapsedMs, row.elapsedMs);
    return acc;
  }, { total: 0, usable: 0, no_match: 0, degraded: 0, wrong_region: 0, weak_match: 0, http_error: 0, elapsedMsTotal: 0, maxElapsedMs: 0 });
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
  const headers = ["id", "category", "state", "query", "result", "lookupStatus", "suggestionCount", "topLabel", "topProvider", "topType", "topLat", "topLon", "topInStateBounds", "tokenCoverage", "elapsedMs", "warning"];
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

const testCases = cases();
if (testCases.length !== 300) throw new Error(`Expected 300 cases, received ${testCases.length}`);

installProviderFailureMode();

console.log(
  `Starting ${testCases.length} regional hard geocode lookups in ${MATRIX_MODE} mode against ${MATRIX_MODE === "module" ? "local backend module" : API_BASE} with ${DELAY_MS}ms delay`,
);
const rows = [];
for (let index = 0; index < testCases.length; index += 1) {
  const row = await runOne(testCases[index], index, testCases.length);
  rows.push(row);
  if ((index + 1) % 25 === 0 || index === testCases.length - 1) {
    const summary = summarise(rows).overall;
    console.log(`${index + 1}/${testCases.length} usable=${summary.usable} no_match=${summary.no_match} weak=${summary.weak_match} wrong=${summary.wrong_region} degraded=${summary.degraded} http=${summary.http_error}`);
  }
  if (index < testCases.length - 1) await delay(DELAY_MS);
}

const summary = summarise(rows);
const fs = await import("node:fs/promises");
await fs.mkdir("tmp", { recursive: true });
const jsonPath = `tmp/geocode-regional-hard-results-${RUN_ID}.json`;
const csvPath = `tmp/geocode-regional-hard-results-${RUN_ID}.csv`;
await fs.writeFile(jsonPath, JSON.stringify({ runId: RUN_ID, apiBase: API_BASE, matrixMode: MATRIX_MODE, providerFailureMode: PROVIDER_FAILURE_MODE, delayMs: DELAY_MS, limit: LIMIT, summary, rows }, null, 2));
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
