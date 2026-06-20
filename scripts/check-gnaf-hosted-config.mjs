#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const mode = args.mode || process.env.FUEL_PATH_GNAF_CHECK_MODE || "preload";
const connectionString = process.env.FUEL_PATH_GNAF_DATABASE_URL || "";
const genericDatabaseUrl = process.env.DATABASE_URL || "";
const apiUrl = process.env.FUEL_PATH_GNAF_API_URL || "";
const apiToken = process.env.FUEL_PATH_GNAF_API_TOKEN || "";
const minAddressRows = Number(args.minRows || process.env.FUEL_PATH_GNAF_MIN_ADDRESS_ROWS || 10_000_000);
const expectedIndexes = [
  "fuel_path_gnaf_addresses_search_prefix_idx",
  "fuel_path_gnaf_addresses_search_trgm_idx",
  "fuel_path_gnaf_addresses_state_postcode_idx",
  "fuel_path_gnaf_addresses_locality_idx",
];
const exactSmokeCases = [
  ["nsw", "1 Adelaide Street Balgowlah Heights NSW 2093", "1 Adelaide Street, Balgowlah Heights NSW 2093"],
  ["act", "1 Abercorn Crescent Isabella Plains ACT 2905", "1 Abercorn Crescent, Isabella Plains ACT 2905"],
  ["vic", "1 Abbotswood Drive Hoppers Crossing VIC 3029", "1 Abbotswood Drive, Hoppers Crossing VIC 3029"],
  ["qld", "1 Abel Smith Crescent Mount Ommaney QLD 4074", "1 Abel Smith Crescent, Mount Ommaney QLD 4074"],
  ["wa", "1 Abbotsford Street West Leederville WA 6007", "1 Abbotsford Street, West Leederville WA 6007"],
  ["sa", "1 Abercrombie Court Clarence Gardens SA 5039", "1 Abercrombie Court, Clarence Gardens SA 5039"],
  ["tas", "1 Baltonsborough Road Austins Ferry TAS 7011", "1 Baltonsborough Road, Austins Ferry TAS 7011"],
  ["nt", "1 Palmerston Circuit Palmerston City NT 0830", "1 Palmerston Circuit, Palmerston City NT 0830"],
];

if (!["preload", "readiness"].includes(mode)) {
  fail({
    ok: false,
    reason: "invalid_mode",
    message: "Use --mode preload or --mode readiness.",
    mode,
  });
}

if (!connectionString && !apiUrl) {
  fail({
    ok: false,
    reason: "missing_gnaf_hosted_target",
    message: "Set FUEL_PATH_GNAF_DATABASE_URL for load/preload checks or FUEL_PATH_GNAF_API_URL plus FUEL_PATH_GNAF_API_TOKEN for API readiness checks.",
    mode,
  });
}

if (genericDatabaseUrl && connectionString === genericDatabaseUrl) {
  fail({
    ok: false,
    reason: "gnaf_url_matches_generic_database_url",
    message: "FUEL_PATH_GNAF_DATABASE_URL must be dedicated. It currently matches DATABASE_URL.",
    mode,
  });
}

const databaseResult = connectionString ? await checkDatabase(connectionString) : null;
const apiResult = apiUrl ? await checkApi(apiUrl, apiToken, minAddressRows) : null;
const readinessProblems = readinessFailures({ databaseResult, apiResult, mode, minAddressRows });
const diagnostics = diagnosticsFor({ databaseResult, apiResult, mode, readinessProblems });
const ok = mode === "preload"
  ? Boolean((databaseResult?.ok || apiResult?.configOk) && readinessProblems.length === 0)
  : readinessProblems.length === 0 && Boolean(databaseResult?.ready || apiResult?.ready);

const payload = {
  ok,
  mode,
  minAddressRows,
  database: databaseResult,
  api: apiResult,
  readinessProblems,
  diagnostics,
};

console.log(JSON.stringify(payload, null, 2));
if (!ok) process.exit(1);

async function checkDatabase(databaseUrl) {
  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT
        current_database() AS database,
        current_user AS user,
        to_regclass('public.fuel_path_gnaf_addresses') AS table_name
    `;
    const countRows = rows[0]?.table_name
      ? await sql`SELECT count(*)::bigint AS count FROM fuel_path_gnaf_addresses`
      : [{ count: "0" }];
    const indexRows = rows[0]?.table_name
      ? await sql`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'fuel_path_gnaf_addresses'
      `
      : [];
    const indexes = indexRows.map((row) => row.indexname).sort();
    const missingIndexes = expectedIndexes.filter((name) => !indexes.includes(name));
    const addressRows = Number(countRows[0]?.count || 0);
    return {
      ok: true,
      database: rows[0]?.database || "",
      user: rows[0]?.user || "",
      tableExists: Boolean(rows[0]?.table_name),
      addressRows,
      indexes,
      missingIndexes,
      indexReady: missingIndexes.length === 0,
      ready: Boolean(rows[0]?.table_name) && addressRows >= minAddressRows && missingIndexes.length === 0,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "connection_failed",
      message: error?.message || String(error),
      ready: false,
    };
  }
}

async function checkApi(rawUrl, token, minRows) {
  const configProblems = [];
  let baseUrl = null;
  try {
    baseUrl = new URL(rawUrl);
  } catch {
    return {
      configOk: false,
      ready: false,
      reason: "invalid_api_url",
      message: "FUEL_PATH_GNAF_API_URL must be an absolute URL.",
    };
  }
  const hostname = baseUrl.hostname.toLowerCase();
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  if (mode === "readiness" && baseUrl.protocol !== "https:" && !isLocalhost) {
    configProblems.push("api_url_must_use_https_for_readiness");
  }
  if (!token || token.length < 32) {
    configProblems.push("api_token_missing_or_too_short");
  }
  if (configProblems.length) {
    return {
      configOk: false,
      ready: false,
      url: publicUrl(baseUrl),
      configProblems,
    };
  }

  if (mode !== "readiness") {
    return {
      configOk: true,
      ready: false,
      url: publicUrl(baseUrl),
      checkedLive: false,
    };
  }

  try {
    const healthUrl = new URL("/health", baseUrl);
    const healthResponse = await fetch(healthUrl);
    const health = await safeJson(healthResponse);
    const healthRows = Number(health?.addressRows || health?.rows || health?.count || 0);
    const missingIndexes = Array.isArray(health?.missingIndexes) ? health.missingIndexes : [];
    const indexReady = health?.indexReady === undefined ? null : Boolean(health.indexReady);
    const authProbeUrl = searchUrl(baseUrl, exactSmokeCases[0][1], 5);
    const missingTokenResponse = await fetch(authProbeUrl);
    const wrongTokenResponse = await fetch(authProbeUrl, { headers: { Authorization: "Bearer wrong-token" } });
    const smokeResults = [];
    for (const [id, query, expectedLabel] of exactSmokeCases) {
      const response = await fetch(searchUrl(baseUrl, query, 5), { headers: { Authorization: `Bearer ${token}` } });
      const search = await safeJson(response);
      const suggestions = Array.isArray(search?.suggestions) ? search.suggestions : [];
      const exactTop = normalise(suggestions[0]?.label) === normalise(expectedLabel);
      const exactAny = suggestions.some((item) => normalise(item?.label) === normalise(expectedLabel));
      smokeResults.push({
        id,
        ok: response.ok && exactTop,
        status: response.status,
        exactTop,
        exactAny,
        topLabel: suggestions[0]?.label || "",
      });
    }
    const exactSmokePassed = smokeResults.every((result) => result.ok);
    return {
      configOk: true,
      ready: healthResponse.ok &&
        health?.tableExists !== false &&
        healthRows >= minRows &&
        indexReady !== false &&
        [401, 403].includes(missingTokenResponse.status) &&
        [401, 403].includes(wrongTokenResponse.status) &&
        exactSmokePassed,
      url: publicUrl(baseUrl),
      checkedLive: true,
      healthOk: healthResponse.ok,
      tableExists: health?.tableExists === undefined ? null : Boolean(health.tableExists),
      healthRows,
      minAddressRows: minRows,
      healthRowsReady: healthRows >= minRows,
      indexes: Array.isArray(health?.indexes) ? health.indexes : [],
      missingIndexes,
      indexReady,
      authRejectsMissingToken: [401, 403].includes(missingTokenResponse.status),
      authRejectsWrongToken: [401, 403].includes(wrongTokenResponse.status),
      exactSmokePassed,
      exactSmokeCases: smokeResults,
      exactSmokeFailures: smokeResults.filter((result) => !result.ok),
    };
  } catch (error) {
    return {
      configOk: true,
      ready: false,
      url: publicUrl(baseUrl),
      checkedLive: true,
      reason: "api_check_failed",
      message: error?.message || String(error),
    };
  }
}

function searchUrl(baseUrl, query, limit) {
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  return url;
}

function readinessFailures({ databaseResult, apiResult, mode: checkMode, minAddressRows: minRows }) {
  const failures = [];
  if (databaseResult && !databaseResult.ok) failures.push(databaseResult.reason || "database_check_failed");
  if (apiResult && !apiResult.configOk) failures.push(...(apiResult.configProblems || [apiResult.reason || "api_config_failed"]));
  if (checkMode !== "readiness") return failures;
  if (databaseResult && !databaseResult.tableExists) failures.push("database_table_missing");
  if (databaseResult && databaseResult.tableExists && databaseResult.addressRows < minRows) failures.push("database_row_count_below_threshold");
  if (databaseResult && databaseResult.tableExists && databaseResult.indexReady === false) failures.push("database_search_indexes_missing");
  if (apiResult && !apiResult.ready) {
    if (apiResult.healthOk === false) failures.push("api_health_unavailable");
    if (apiResult.tableExists === false) failures.push("api_table_missing");
    if (apiResult.healthRowsReady === false) failures.push("api_row_count_below_threshold");
    if (apiResult.indexReady === false) failures.push("api_search_indexes_missing");
    if (apiResult.authRejectsMissingToken === false) failures.push("api_missing_token_not_rejected");
    if (apiResult.authRejectsWrongToken === false) failures.push("api_wrong_token_not_rejected");
    if (apiResult.exactSmokePassed === false) failures.push("api_exact_smoke_failed");
    if (apiResult.checkedLive) failures.push("api_live_readiness_failed");
    else failures.push("api_live_readiness_not_checked");
  }
  return failures;
}

function diagnosticsFor({ databaseResult, apiResult, mode: checkMode, readinessProblems }) {
  return {
    target: databaseResult ? "database" : apiResult ? "api" : "missing",
    checkedReadiness: checkMode === "readiness",
    readinessProblems,
    nextActions: [...new Set(readinessProblems.map(actionForProblem))],
  };
}

function actionForProblem(problem) {
  if (problem === "database_table_missing" || problem === "api_table_missing") {
    return "Create the hosted G-NAF table with npm run load:gnaf-raw-postgres -- --setup-only or run the API against a database that contains fuel_path_gnaf_addresses.";
  }
  if (problem === "database_row_count_below_threshold" || problem === "api_row_count_below_threshold") {
    return "Load the national G-NAF address index, then rerun npm run check:gnaf-hosted:readiness.";
  }
  if (problem === "database_search_indexes_missing" || problem === "api_search_indexes_missing") {
    return "Create the hosted search indexes with npm run load:gnaf-raw-postgres -- --setup-only --create-indexes or the SQL in scripts/sql/gnaf-address-index-postgres.sql.";
  }
  if (problem === "api_missing_token_not_rejected" || problem === "api_wrong_token_not_rejected") {
    return "Fix FUEL_PATH_GNAF_API_TOKEN enforcement before publishing hosted lookup evidence.";
  }
  if (problem === "api_exact_smoke_failed") {
    return "Inspect api.exactSmokeFailures, fix the hosted index/search ranking, then rerun the readiness check.";
  }
  if (problem === "api_url_must_use_https_for_readiness") {
    return "Use HTTPS for the hosted G-NAF API readiness target, except localhost smoke checks.";
  }
  if (problem === "api_token_missing_or_too_short") {
    return "Set a strong FUEL_PATH_GNAF_API_TOKEN before API readiness checks.";
  }
  if (problem === "api_health_unavailable" || problem === "api_live_readiness_failed") {
    return "Check the hosted API /health and /search endpoints, then rerun npm run check:gnaf-hosted:readiness.";
  }
  return "Review the hosted G-NAF readiness payload and rerun the matching check.";
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function publicUrl(value) {
  return `${value.protocol}//${value.host}`;
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function loadLocalEnv(file = ".env.local") {
  const envPath = path.resolve(file);
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (process.env[key] !== undefined) continue;
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--mode") {
      result.mode = values[index + 1] || "";
      index += 1;
    } else if (value === "--min-rows") {
      result.minRows = values[index + 1] || "";
      index += 1;
    }
  }
  return result;
}

function fail(payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(1);
}
