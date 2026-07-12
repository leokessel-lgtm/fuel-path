const assert = require("node:assert/strict");
const { execFile, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const ADDRESS_ROWS = [
  ["GANSW0001", "1 Adelaide Street, Balgowlah Heights NSW 2093", "1", "Adelaide", "Street", "Balgowlah Heights", "NSW", "2093", "151.25889968", "-33.80797092"],
  ["GAACT0001", "1 Abercorn Crescent, Isabella Plains ACT 2905", "1", "Abercorn", "Crescent", "Isabella Plains", "ACT", "2905", "149.09854244", "-35.42628067"],
  ["GAVIC0001", "1 Abbotswood Drive, Hoppers Crossing VIC 3029", "1", "Abbotswood", "Drive", "Hoppers Crossing", "VIC", "3029", "144.67410998", "-37.84943482"],
  ["GAQLD0001", "1 Abel Smith Crescent, Mount Ommaney QLD 4074", "1", "Abel Smith", "Crescent", "Mount Ommaney", "QLD", "4074", "152.93577894", "-27.54763984"],
  ["GAWA0001", "1 Abbotsford Street, West Leederville WA 6007", "1", "Abbotsford", "Street", "West Leederville", "WA", "6007", "115.8372549", "-31.94182946"],
  ["GASA0001", "1 Abercrombie Court, Clarence Gardens SA 5039", "1", "Abercrombie", "Court", "Clarence Gardens", "SA", "5039", "138.57502939", "-34.97354964"],
  ["GATAS0001", "1 Baltonsborough Road, Austins Ferry TAS 7011", "1", "Baltonsborough", "Road", "Austins Ferry", "TAS", "7011", "147.24392043", "-42.7704639"],
  ["GANT0001", "1 Palmerston Circuit, Palmerston City NT 0830", "1", "Palmerston", "Circuit", "Palmerston City", "NT", "0830", "130.98505609", "-12.47843981"],
];
const RURAL_ADDRESS_ROWS = [
  ["GANSW0101", "40 Napier Street, East Tamworth NSW 2340", "40", "Napier", "Street", "East Tamworth", "NSW", "2340", "150.938", "-31.083"],
  ["GAACT0101", "21 Lanyon Drive, Tuggeranong ACT 2900", "21", "Lanyon", "Drive", "Tuggeranong", "ACT", "2900", "149.065", "-35.414"],
  ["GAVIC0101", "37 Lawrence Street, Wodonga VIC 3690", "37", "Lawrence", "Street", "Wodonga", "VIC", "3690", "146.889", "-36.121"],
  ["GAQLD0101", "18 Swan Street, Longreach QLD 4730", "18", "Swan", "Street", "Longreach", "QLD", "4730", "144.253", "-23.440"],
  ["GAWA0101", "4603 Basset Road, Karratha WA 6714", "4603", "Basset", "Road", "Karratha", "WA", "6714", "116.846", "-20.736"],
  ["GASA0101", "10 Kent Street, Coober Pedy SA 5723", "10", "Kent", "Street", "Coober Pedy", "SA", "5723", "134.754", "-29.014"],
  ["GATAS0101", "20 Alfred Street, Queenstown TAS 7467", "20", "Alfred", "Street", "Queenstown", "TAS", "7467", "145.556", "-42.080"],
  ["GANT0101", "34 Victoria Highway, Katherine South NT 0850", "34", "Victoria", "Highway", "Katherine South", "NT", "0850", "132.266", "-14.466"],
];
const LOT_ADDRESS_ROWS = ADDRESS_ROWS.map((row) =>
  row[0] === "GAQLD0001"
    ? ["GAQLDLOT1", "Lot 127, Falcon Street, Longreach QLD 4730", "127", "Falcon", "Street", "Longreach", "QLD", "4730", "144.250841", "-23.44903667"]
    : row,
);

test("hosted national benchmark runs against an HTTP geocode API contract", async () => {
  const fixture = buildAddressFixture();
  const api = await startMockGeocodeApi(ADDRESS_ROWS);
  const runId = `checkpoint-${Date.now()}`;
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "scripts/geocode-hosted-national-benchmark.mjs",
        "--mode",
        "http",
        "--api-base",
        api.url,
        "--address-sqlite",
        fixture.sqlitePath,
        "--address-count",
        "8",
        "--poi-count",
        "8",
        "--min-poi-top-rate",
        "0.75",
        "--max-address-p90-chars",
        "80",
        "--max-poi-p90-chars",
        "80",
        "--delay-ms",
        "0",
        "--checkpoint-every",
        "1",
        "--run-id",
        runId,
      ],
      { cwd: ROOT, timeout: 30_000 },
    );
    const jsonPath = stdout.match(/"jsonPath": "([^"]+)"/)?.[1];
    assert.ok(jsonPath, stdout);
    const result = JSON.parse(fs.readFileSync(path.join(ROOT, jsonPath), "utf8"));

    assert.equal(result.summary.byKind.address.cases, 8);
    assert.equal(result.summary.byKind.address.finalTopMatch, 8);
    assert.equal(result.summary.byKind.poi.cases, 8);
    assert.equal(result.fetchCalls.httpGeocode > 0, true);
    const checkpoint = JSON.parse(fs.readFileSync(path.join(ROOT, "tmp", `geocode-hosted-national-benchmark-${runId}.checkpoint.json`), "utf8"));
    assert.equal(checkpoint.status, "running");
    assert.equal(checkpoint.completedCases, 16);
    fs.rmSync(path.join(ROOT, "tmp", `geocode-hosted-national-benchmark-${runId}.checkpoint.json`), { force: true });
  } finally {
    await api.close();
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test("hosted national benchmark rural-unit profile samples compact rows by locality", async () => {
  const fixture = buildAddressFixture(RURAL_ADDRESS_ROWS, ["--omit-legacy-fts", "--omit-search-backstop"]);
  const api = await startMockGeocodeApi(RURAL_ADDRESS_ROWS);
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "scripts/geocode-hosted-national-benchmark.mjs",
        "--mode",
        "http",
        "--api-base",
        api.url,
        "--address-sqlite",
        fixture.sqlitePath,
        "--address-count",
        "8",
        "--poi-count",
        "0",
        "--profile",
        "rural-unit",
        "--min-poi-top-rate",
        "0",
        "--max-address-p90-chars",
        "80",
        "--delay-ms",
        "0",
      ],
      { cwd: ROOT, timeout: 30_000 },
    );
    const jsonPath = stdout.match(/"jsonPath": "([^"]+)"/)?.[1];
    assert.ok(jsonPath, stdout);
    const result = JSON.parse(fs.readFileSync(path.join(ROOT, jsonPath), "utf8"));

    assert.equal(result.requested.profile, "rural-unit");
    assert.equal(result.summary.byKind.address.finalTopMatch, 8);
    assert.deepEqual(
      result.rows.map((row) => row.expectedLocality).sort(),
      ["Coober Pedy", "East Tamworth", "Karratha", "Katherine South", "Longreach", "Queenstown", "Tuggeranong", "Wodonga"].sort(),
    );
  } finally {
    await api.close();
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test("hosted national benchmark accepts a canonical G-NAF address when its source label includes Lot", async () => {
  const fixture = buildAddressFixture(LOT_ADDRESS_ROWS);
  const api = await startMockGeocodeApi(LOT_ADDRESS_ROWS, { canonicaliseLotLabels: true });
  const runId = `lot-canonical-${Date.now()}`;
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "scripts/geocode-hosted-national-benchmark.mjs",
        "--mode", "http",
        "--api-base", api.url,
        "--address-sqlite", fixture.sqlitePath,
        "--address-count", "8",
        "--poi-count", "0",
        "--profile", "rural-unit",
        "--min-poi-top-rate", "0",
        "--max-address-p90-chars", "80",
        "--delay-ms", "0",
        "--run-id", runId,
      ],
      { cwd: ROOT, timeout: 30_000 },
    );
    const jsonPath = stdout.match(/"jsonPath": "([^"]+)"/)?.[1];
    const result = JSON.parse(fs.readFileSync(path.join(ROOT, jsonPath), "utf8"));
    assert.equal(result.summary.byKind.address.finalTopMatch, 8);
    assert.equal(result.rows.find((row) => row.expectedLabel.startsWith("Lot 127")).finalTopLabel, "127 Falcon Street, Longreach QLD 4730");
    fs.rmSync(path.join(ROOT, jsonPath), { force: true });
    fs.rmSync(path.join(ROOT, jsonPath.replace(/\.json$/, ".csv")), { force: true });
  } finally {
    await api.close();
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test("hosted national benchmark applies pacing between autocomplete requests", () => {
  const source = fs.readFileSync(path.join(ROOT, "scripts/geocode-hosted-national-benchmark.mjs"), "utf8");
  assert.equal((source.match(/if \(DELAY_MS\) await sleep\(DELAY_MS\);/g) || []).length, 2);
  assert.doesNotMatch(source, /console\.log\(`\$\{index \+ 1\}\/\$\{cases\.length\}[\s\S]{0,500}if \(DELAY_MS\) await sleep\(DELAY_MS\);/);
});

function buildAddressFixture(rows = ADDRESS_ROWS, extraArgs = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-hosted-benchmark-"));
  const inputPath = path.join(dir, "GNAF_CORE.psv");
  const sqlitePath = path.join(dir, "gnaf-hosted-benchmark.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      ...rows.map((row) => row.join("|")),
    ].join("\n"),
  );
  execFileSync(
    process.execPath,
    ["scripts/build-gnaf-address-index.mjs", "--input", inputPath, "--output", sqlitePath, ...extraArgs],
    { cwd: ROOT, stdio: "ignore" },
  );
  return { dir, inputPath, sqlitePath };
}

async function startMockGeocodeApi(rows = ADDRESS_ROWS, { canonicaliseLotLabels = false } = {}) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname !== "/api/geocode") {
      sendJson(response, 404, { error: "not_found" });
      return;
    }
    const query = url.searchParams.get("q") || "";
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 5), 8));
    const addressSuggestions = rows
      .map((row) => ({
        label: canonicaliseLotLabels ? row[1].replace(/^Lot\s+(\d+),\s*/i, "$1 ") : row[1],
        searchLabel: row[1],
        state: row[6],
        postcode: row[7],
        lat: Number(row[9]),
        lon: Number(row[8]),
        provider: "fuel_path_gnaf",
        type: "address",
        matchType: normalise(row[1].replace(/,/g, "")).startsWith(normalise(query)) ? "address_prefix" : "address_token_overlap",
      }))
      .filter((row) => addressMatchesQuery(row.searchLabel, query))
      .map(({ searchLabel, ...suggestion }) => suggestion);

    const poiState = stateFromQuery(query);
    const poiSuggestion = {
      label: poiState ? `${query} ${poiState}` : query,
      state: poiState,
      lat: -33,
      lon: 151,
      provider: "fuel_path_hint",
      type: "poi",
    };
    const suggestions = addressSuggestions.length ? addressSuggestions.slice(0, limit) : [poiSuggestion];
    sendJson(response, 200, {
      provider: "test",
      lookupStatus: "ok",
      location: suggestions[0],
      suggestions,
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function addressMatchesQuery(label, query) {
  const haystack = normalise(label.replace(/,/g, ""));
  const needle = normalise(query);
  if (haystack.startsWith(needle)) return true;
  const tokens = needle.split(/\s+/).filter((token) => token.length >= 3);
  return tokens.length >= 2 && tokens.every((token) => haystack.includes(token));
}

function stateFromQuery(query) {
  const state = query.match(/\b(NSW|ACT|VIC|QLD|WA|SA|TAS|NT)\b/i)?.[1]?.toUpperCase();
  if (state) return state;
  if (/cataract|bruny|queenstown|cradle/i.test(query)) return "TAS";
  if (/canberra|tidbinbilla|namadgi/i.test(query)) return "ACT";
  if (/sydney|bondi|taronga/i.test(query)) return "NSW";
  if (/melbourne|promontory/i.test(query)) return "VIC";
  if (/brisbane|island|gorge/i.test(query)) return "QLD";
  if (/perth|rottnest|karijini/i.test(query)) return "WA";
  if (/adelaide|kangaroo|coober/i.test(query)) return "SA";
  if (/uluru|kakadu|darwin/i.test(query)) return "NT";
  return "";
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
