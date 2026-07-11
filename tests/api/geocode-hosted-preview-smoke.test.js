const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("hosted geocode preview smoke writes pass report for high-risk cases", async () => {
  const api = await startMockPreviewApi();
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "scripts/geocode-hosted-preview-smoke.mjs",
        "--api-base",
        api.url,
        "--delay-ms",
        "0",
        "--run-id",
        "mock-pass",
      ],
      { cwd: ROOT, timeout: 30_000 },
    );
    const result = readResult(stdout);
    const report = fs.readFileSync(path.join(ROOT, result.reportPath), "utf8");
    const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));

    assert.equal(payload.summary.cases, 20);
    assert.equal(payload.summary.topMatch, 20);
    assert.equal(payload.summary.addressTopMatch, 12);
    assert.equal(payload.summary.poiTopMatch, 8);
    assert.equal(payload.target, api.url);
    assert.equal(payload.transport, "direct_http");
    assert.equal(payload.performanceEvidence, "request_elapsed_only");
    assert.deepEqual(payload.diagnostics.likelyBlockers, []);
    assert.equal(payload.diagnostics.addressTopProviderCounts.fuel_path_gnaf, 12);
    assert.match(report, /Fuel Path Hosted Geocode Preview Smoke/);
    assert.match(report, /Likely blockers: none/);
    assert.match(report, /Transport: direct_http/);
    assert.match(report, /not a load benchmark/);
    assert.match(report, /Rottnest Island WA/);
  } finally {
    await api.close();
  }
});

test("hosted geocode preview smoke fails after writing artefacts when a case is wrong", async () => {
  const api = await startMockPreviewApi({ failRottnest: true });
  try {
    await assert.rejects(
      execFileAsync(
        process.execPath,
        [
          "scripts/geocode-hosted-preview-smoke.mjs",
          "--api-base",
          api.url,
          "--delay-ms",
          "0",
          "--run-id",
          "mock-fail",
        ],
        { cwd: ROOT, timeout: 30_000 },
      ),
      (error) => {
        const result = readResult(error.stdout);
        const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));
        assert.equal(payload.summary.topMatch, 19);
        assert.equal(payload.summary.failures, 1);
        assert.equal(payload.rows.find((row) => row.id === "poi-rottnest").result, "suggestions_but_not_expected");
        return true;
      },
    );
  } finally {
    await api.close();
  }
});

test("hosted geocode preview smoke diagnoses non-GNAF hosted address rows", async () => {
  const api = await startMockPreviewApi({ addressProvider: "fuel_path_seed" });
  try {
    await assert.rejects(
      execFileAsync(
        process.execPath,
        [
          "scripts/geocode-hosted-preview-smoke.mjs",
          "--api-base",
          api.url,
          "--delay-ms",
          "0",
          "--run-id",
          "mock-non-gnaf",
        ],
        { cwd: ROOT, timeout: 30_000 },
      ),
      (error) => {
        const result = readResult(error.stdout);
        const payload = JSON.parse(fs.readFileSync(path.join(ROOT, result.jsonPath), "utf8"));
        const report = fs.readFileSync(path.join(ROOT, result.reportPath), "utf8");

        assert.equal(payload.summary.addressTopMatch, 0);
        assert.equal(payload.summary.poiTopMatch, 8);
        assert.equal(payload.diagnostics.addressTopProviderCounts.fuel_path_seed, 12);
        assert.equal(payload.diagnostics.nonGnafAddressRows.length, 12);
        assert.equal(payload.diagnostics.likelyBlockers.includes("hosted_preview_address_provider_not_gnaf"), true);
        assert.match(report, /hosted_preview_address_provider_not_gnaf/);
        assert.match(report, /Address top providers: fuel_path_seed 12/);
        return true;
      },
    );
  } finally {
    await api.close();
  }
});

test("tracked hosted preview summary stays redacted and claim-bounded", () => {
  const file = path.join(
    ROOT,
    "docs/04-validation-evidence/hosted-preview/hosted-geocode-preview-summary-2026-07-12.json",
  );
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const text = JSON.stringify(payload);

  assert.equal(payload.evidenceType, "hosted_preview_functional_correctness");
  assert.equal(payload.functionalSmoke.status, "passed");
  assert.equal(payload.functionalSmoke.topMatches, 20);
  assert.equal(payload.transport.performanceEvidence, "invalid_cli_transport_overhead");
  assert.equal(payload.readinessImpact.performance, "not_proven_by_this_run");
  assert.equal(payload.readinessImpact.beta, "not_proven");
  assert.equal(payload.authentication.missingTokenStatus, 401);
  assert.equal(payload.authentication.wrongTokenStatus, 401);
  assert.equal(payload.authentication.tokenObservedInResponse, false);
  assert.doesNotMatch(text, /Authorization|Bearer|FUEL_PATH_GNAF_API_TOKEN|1 Adelaide Street|87A Corea Street/);
});

async function startMockPreviewApi(options = {}) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname !== "/api/geocode") {
      sendJson(response, 404, { error: "not_found" });
      return;
    }
    const query = url.searchParams.get("q") || "";
    const suggestion = suggestionForQuery(query, options);
    sendJson(response, 200, {
      provider: "test",
      lookupStatus: "ok",
      location: suggestion,
      suggestions: suggestion ? [suggestion] : [],
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function suggestionForQuery(query, options) {
  const key = normalise(query);
  if (options.failRottnest && key.includes("rottnest")) {
    return poi("Perth CBD WA", "WA");
  }
  const label = ADDRESS_BY_QUERY[key];
  if (label) return address(label, stateFromLabel(label), options.addressProvider);
  const poiLabel = POI_BY_QUERY[key];
  if (poiLabel) return poi(poiLabel, stateFromLabel(poiLabel));
  return poi(query, stateFromLabel(query));
}

function readResult(stdout) {
  const jsonPath = stdout.match(/"jsonPath": "([^"]+)"/)?.[1];
  const reportPath = stdout.match(/"reportPath": "([^"]+)"/)?.[1];
  assert.ok(jsonPath, stdout);
  assert.ok(reportPath, stdout);
  return { jsonPath, reportPath };
}

function address(label, state, provider = "fuel_path_gnaf") {
  return {
    label,
    state,
    provider,
    type: "address",
    lat: -33,
    lon: 151,
    matchType: "exact_address",
  };
}

function poi(label, state) {
  return {
    label,
    state,
    provider: "fuel_path_hint",
    type: "poi",
    lat: -33,
    lon: 151,
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function stateFromLabel(label) {
  return label.match(/\b(NSW|ACT|VIC|QLD|WA|SA|TAS|NT)\b/i)?.[1]?.toUpperCase() || "";
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const ADDRESS_BY_QUERY = Object.fromEntries(
  [
    ["1 Adelaide Street Balgowlah Heights NSW 2093", "1 Adelaide Street, Balgowlah Heights NSW 2093"],
    ["1 Abercorn Crescent Isabella Plains ACT 2905", "1 Abercorn Crescent, Isabella Plains ACT 2905"],
    ["1 Abbotswood Drive Hoppers Crossing VIC 3029", "1 Abbotswood Drive, Hoppers Crossing VIC 3029"],
    ["1 Abel Smith Crescent Mount Ommaney QLD 4074", "1 Abel Smith Crescent, Mount Ommaney QLD 4074"],
    ["1 Abbotsford Street West Leederville WA 6007", "1 Abbotsford Street, West Leederville WA 6007"],
    ["1 Abercrombie Court Clarence Gardens SA 5039", "1 Abercrombie Court, Clarence Gardens SA 5039"],
    ["1 Baltonsborough Road Austins Ferry TAS 7011", "1 Baltonsborough Road, Austins Ferry TAS 7011"],
    ["1 Palmerston Circuit Palmerston City NT 0830", "1 Palmerston Circuit, Palmerston City NT 0830"],
    ["Unit 8 Fl 5 51 Mill Point Road South Perth WA 6151", "Unit 8, Fl 5, 51 Mill Point Road, South Perth WA 6151"],
    ["Unit 9 131 Canberra Avenue Griffith ACT 2603", "Unit 9, 131 Canberra Avenue, Griffith ACT 2603"],
    ["87A Corea Street Sylvania NSW 2224", "87A Corea Street, Sylvania NSW 2224"],
    ["Lot 9138 Stuart Highway Alice Springs NT 0870", "Lot 9138, Stuart Highway, Alice Springs NT 0870"],
  ].map(([query, label]) => [normalise(query), label]),
);

const POI_BY_QUERY = Object.fromEntries(
  [
    "Sydney Airport NSW",
    "Canberra Airport ACT",
    "Cataract Gorge TAS",
    "Rottnest Island WA",
    "Coober Pedy SA",
    "Thursday Island QLD",
    "Uluru NT",
    "Wilsons Promontory VIC",
  ].map((label) => [normalise(label), label]),
);
