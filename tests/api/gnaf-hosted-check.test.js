const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const ROOT = path.resolve(__dirname, "../..");
const TOKEN = "test-token-with-more-than-thirty-two-characters";
const execFileAsync = promisify(execFile);
const SMOKE_CASES = [
  ["1 Adelaide Street Balgowlah Heights NSW 2093", "1 Adelaide Street, Balgowlah Heights NSW 2093"],
  ["1 Abercorn Crescent Isabella Plains ACT 2905", "1 Abercorn Crescent, Isabella Plains ACT 2905"],
  ["1 Abbotswood Drive Hoppers Crossing VIC 3029", "1 Abbotswood Drive, Hoppers Crossing VIC 3029"],
  ["1 Abel Smith Crescent Mount Ommaney QLD 4074", "1 Abel Smith Crescent, Mount Ommaney QLD 4074"],
  ["1 Abbotsford Street West Leederville WA 6007", "1 Abbotsford Street, West Leederville WA 6007"],
  ["1 Abercrombie Court Clarence Gardens SA 5039", "1 Abercrombie Court, Clarence Gardens SA 5039"],
  ["1 Baltonsborough Road Austins Ferry TAS 7011", "1 Baltonsborough Road, Austins Ferry TAS 7011"],
  ["1 Palmerston Circuit Palmerston City NT 0830", "1 Palmerston Circuit, Palmerston City NT 0830"],
];

test("hosted G-NAF API readiness requires national row threshold", async () => {
  const api = await startMockGnafApi({ addressRows: 80_000 });
  try {
    const result = await runHostedCheck(api.url, ["--mode", "readiness", "--min-rows", "10000000"], false);

    assert.equal(result.ok, false);
    assert.equal(result.api.healthRowsReady, false);
    assert.equal(result.api.indexReady, true);
    assert.equal(result.api.exactSmokePassed, true);
    assert.equal(result.readinessProblems.includes("api_row_count_below_threshold"), true);
    assert.equal(result.readinessProblems.includes("api_exact_smoke_failed"), false);
    assert.equal(result.diagnostics.nextActions.some((action) => action.includes("Load the national G-NAF address index")), true);
  } finally {
    await api.close();
  }
});

test("hosted G-NAF API readiness reports missing hosted search indexes", async () => {
  const api = await startMockGnafApi({
    addressRows: 10_000_000,
    missingIndexes: ["fuel_path_gnaf_addresses_search_trgm_idx"],
  });
  try {
    const result = await runHostedCheck(api.url, ["--mode", "readiness", "--min-rows", "10000000"], false);

    assert.equal(result.ok, false);
    assert.equal(result.api.healthRowsReady, true);
    assert.equal(result.api.indexReady, false);
    assert.deepEqual(result.api.missingIndexes, ["fuel_path_gnaf_addresses_search_trgm_idx"]);
    assert.equal(result.readinessProblems.includes("api_search_indexes_missing"), true);
    assert.equal(result.diagnostics.nextActions.some((action) => action.includes("--create-indexes")), true);
  } finally {
    await api.close();
  }
});

test("hosted G-NAF API readiness fails if search auth is not enforced", async () => {
  const api = await startMockGnafApi({ addressRows: 10_000_000, allowUnauthenticatedSearch: true });
  try {
    const result = await runHostedCheck(api.url, ["--mode", "readiness", "--min-rows", "10000000"], false);

    assert.equal(result.ok, false);
    assert.equal(result.api.authRejectsMissingToken, false);
    assert.equal(result.api.authRejectsWrongToken, false);
    assert.equal(result.readinessProblems.includes("api_missing_token_not_rejected"), true);
    assert.equal(result.readinessProblems.includes("api_wrong_token_not_rejected"), true);
    assert.equal(result.diagnostics.nextActions.some((action) => action.includes("FUEL_PATH_GNAF_API_TOKEN enforcement")), true);
  } finally {
    await api.close();
  }
});

test("hosted G-NAF API readiness probes exact addresses across jurisdictions", async () => {
  const api = await startMockGnafApi({ addressRows: 10_000_000, failQuery: "West Leederville" });
  try {
    const result = await runHostedCheck(api.url, ["--mode", "readiness", "--min-rows", "10000000"], false);

    assert.equal(result.ok, false);
    assert.equal(result.api.healthRowsReady, true);
    assert.equal(result.api.exactSmokePassed, false);
    assert.equal(result.api.exactSmokeFailures.length, 1);
    assert.equal(result.api.exactSmokeFailures[0].id, "wa");
    assert.equal(result.readinessProblems.includes("api_exact_smoke_failed"), true);
  } finally {
    await api.close();
  }
});

test("hosted G-NAF API readiness passes only with threshold, auth and exact smoke", async () => {
  const api = await startMockGnafApi({ addressRows: 10_000_000 });
  try {
    const result = await runHostedCheck(api.url, ["--mode", "readiness", "--min-rows", "10000000"], true);

    assert.equal(result.ok, true);
    assert.equal(result.api.healthRowsReady, true);
    assert.equal(result.api.authRejectsMissingToken, true);
    assert.equal(result.api.authRejectsWrongToken, true);
    assert.equal(result.api.indexReady, true);
    assert.equal(result.api.exactSmokePassed, true);
    assert.equal(result.api.exactSmokeCases.length, 8);
    assert.deepEqual(result.diagnostics.nextActions, []);
  } finally {
    await api.close();
  }
});

async function runHostedCheck(apiUrl, args, expectSuccess) {
  try {
    const { stdout } = await execFileAsync(process.execPath, ["scripts/check-gnaf-hosted-config.mjs", ...args], {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: "",
        FUEL_PATH_GNAF_DATABASE_URL: "",
        FUEL_PATH_GNAF_API_URL: apiUrl,
        FUEL_PATH_GNAF_API_TOKEN: TOKEN,
      },
      timeout: 15_000,
    });
    assert.equal(expectSuccess, true, "expected hosted check to fail");
    return JSON.parse(stdout);
  } catch (error) {
    assert.equal(expectSuccess, false, error.stderr?.toString() || error.message);
    return JSON.parse(error.stdout.toString());
  }
}

async function startMockGnafApi({ addressRows, failQuery = "", missingIndexes = [], allowUnauthenticatedSearch = false }) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/health") {
      sendJson(response, 200, {
        ok: missingIndexes.length === 0,
        tableExists: true,
        addressRows,
        indexes: [
          "fuel_path_gnaf_addresses_search_trgm_idx",
          "fuel_path_gnaf_addresses_state_postcode_idx",
          "fuel_path_gnaf_addresses_locality_idx",
        ].filter((name) => !missingIndexes.includes(name)),
        missingIndexes,
        indexReady: missingIndexes.length === 0,
      });
      return;
    }
    if (url.pathname === "/search") {
      if (!allowUnauthenticatedSearch && request.headers.authorization !== `Bearer ${TOKEN}`) {
        sendJson(response, 401, { ok: false, error: "unauthorised" });
        return;
      }
      const query = url.searchParams.get("q") || "";
      const match = SMOKE_CASES.find(([caseQuery]) => normalise(caseQuery) === normalise(query));
      if (!match || (failQuery && query.includes(failQuery))) {
        sendJson(response, 200, { ok: true, suggestions: [] });
        return;
      }
      sendJson(response, 200, {
        ok: true,
        suggestions: [
          {
            id: `mock-${normalise(match[0]).replace(/\s+/g, "-")}`,
            label: match[1],
            lat: -33,
            lon: 151,
            matchType: "exact_address",
            score: 1000,
          },
        ],
      });
      return;
    }
    sendJson(response, 404, { ok: false, error: "not_found" });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
