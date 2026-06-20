#!/usr/bin/env node
import http from "node:http";
import { URL } from "node:url";
import pg from "pg";

const { Pool } = pg;

const port = Number(process.env.PORT || process.env.FUEL_PATH_GNAF_API_PORT || 8787);
const host = process.env.FUEL_PATH_GNAF_API_HOST || "127.0.0.1";
const connectionString = process.env.FUEL_PATH_GNAF_DATABASE_URL || process.env.DATABASE_URL || "";
const apiToken = process.env.FUEL_PATH_GNAF_API_TOKEN || "";
const allowUnauthenticated = process.env.FUEL_PATH_GNAF_API_ALLOW_UNAUTHENTICATED === "true";

if (!connectionString) {
  throw new Error("FUEL_PATH_GNAF_DATABASE_URL or DATABASE_URL is required.");
}

if (!apiToken && !allowUnauthenticated) {
  throw new Error("FUEL_PATH_GNAF_API_TOKEN is required unless FUEL_PATH_GNAF_API_ALLOW_UNAUTHENTICATED=true.");
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.FUEL_PATH_GNAF_API_POOL_SIZE || 6),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: Number(process.env.FUEL_PATH_GNAF_API_STATEMENT_TIMEOUT_MS || 2500),
});

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname === "/health") {
      await handleHealth(response);
      return;
    }
    if (url.pathname === "/search") {
      if (!isAuthorised(request)) {
        sendJson(response, 401, { ok: false, error: "unauthorised" });
        return;
      }
      await handleSearch(url, response);
      return;
    }
    sendJson(response, 404, { ok: false, error: "not_found" });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: "internal_error", message: error?.message || String(error) });
  }
});

server.listen(port, host, () => {
  console.log(`Fuel Path G-NAF API listening on ${host}:${port}`);
});

async function handleHealth(response) {
  const tableRows = await pool.query(`
    SELECT
      current_database() AS database,
      to_regclass('public.fuel_path_gnaf_addresses') AS table_name
  `);
  const row = tableRows.rows[0] || {};
  let addressRows = 0;
  let indexes = [];
  if (row.table_name) {
    const countRows = await pool.query("SELECT count(*)::bigint AS address_rows FROM fuel_path_gnaf_addresses");
    addressRows = Number(countRows.rows[0]?.address_rows || 0);
    const indexRows = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'fuel_path_gnaf_addresses'
    `);
    indexes = indexRows.rows.map((item) => item.indexname).sort();
  }
  const expectedIndexes = [
    "fuel_path_gnaf_addresses_search_prefix_idx",
    "fuel_path_gnaf_addresses_search_trgm_idx",
    "fuel_path_gnaf_addresses_state_postcode_idx",
    "fuel_path_gnaf_addresses_locality_idx",
  ];
  const missingIndexes = expectedIndexes.filter((name) => !indexes.includes(name));
  sendJson(response, 200, {
    ok: Boolean(row.table_name) && missingIndexes.length === 0,
    database: row.database || "",
    tableExists: Boolean(row.table_name),
    addressRows,
    indexes,
    missingIndexes,
    indexReady: missingIndexes.length === 0,
  });
}

async function handleSearch(url, response) {
  const query = String(url.searchParams.get("q") || "");
  const needle = normaliseAddressText(query);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 5), 20));
  if (needle.length < 4) {
    sendJson(response, 200, { ok: true, suggestions: [] });
    return;
  }

  const readiness = await pool.query(`
    SELECT to_regclass('public.fuel_path_gnaf_addresses') AS table_name
  `);
  if (!readiness.rows[0]?.table_name) {
    sendJson(response, 503, { ok: false, error: "address_index_not_ready", suggestions: [] });
    return;
  }

  const rows = await searchAddresses(needle, limit);

  sendJson(response, 200, {
    ok: true,
    suggestions: rows.map((row) => ({
      id: row.id,
      providerId: row.id,
      label: row.label,
      lat: Number(row.lat),
      lon: Number(row.lon),
      state: row.state || undefined,
      postcode: row.postcode || undefined,
      accuracy: row.accuracy || "address_index",
      matchType: matchType(row, needle),
      score: score(row, needle),
      search_text: row.search_text,
    })),
  });
}

async function searchAddresses(needle, limit) {
  const seen = new Set();
  const results = [];
  const stages = [
    { type: "address_prefix", sql: "search_text LIKE $1", params: [`${needle}%`], cap: Math.max(limit, 10), stopOnAny: true },
    { type: "address_contains", sql: "search_text LIKE $1", params: [`% ${needle}%`], cap: Math.max(limit, 10) },
    { type: "address_fuzzy", sql: "search_text % $1", params: [needle], cap: Math.max(limit, 10) },
  ];

  for (const stage of stages) {
    if (results.length >= limit) break;
    const query = `
      SELECT id, label, lat, lon, state, postcode, accuracy, search_text
      FROM fuel_path_gnaf_addresses
      WHERE ${stage.sql}
      LIMIT $${stage.params.length + 1}
    `;
    let rows;
    try {
      rows = await pool.query(query, [...stage.params, stage.cap]);
    } catch (error) {
      if (error?.code === "57014") continue;
      throw error;
    }
    for (const row of rows.rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      results.push({ ...row, _matchType: stage.type });
      if (results.length >= limit) break;
    }
    if (stage.stopOnAny && results.length > 0) break;
  }
  return results.sort((left, right) => {
    const leftScore = score(left, needle);
    const rightScore = score(right, needle);
    if (rightScore !== leftScore) return rightScore - leftScore;
    return String(left.label || "").length - String(right.label || "").length;
  });
}

function isAuthorised(request) {
  if (allowUnauthenticated) return true;
  const expected = `Bearer ${apiToken}`;
  return request.headers.authorization === expected || request.headers["x-fuel-path-token"] === apiToken;
}

function matchType(row, needle) {
  if (row?._matchType) return row._matchType;
  const text = normaliseAddressText(row?.search_text);
  const label = normaliseAddressText(row?.label);
  if (text === needle || label === needle) return "exact_address";
  if (text.startsWith(needle)) return "address_prefix";
  return "address_contains";
}

function score(row, needle) {
  const type = matchType(row, needle);
  if (type === "exact_address") return 1000;
  if (type === "address_prefix") return 900;
  return 760;
}

function normaliseAddressText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bst\b/g, "street")
    .replace(/\brd\b/g, "road")
    .replace(/\bave\b/g, "avenue")
    .replace(/\bdr\b/g, "drive")
    .replace(/\bpde\b/g, "parade")
    .replace(/\bpl\b/g, "place")
    .replace(/\bln\b/g, "lane")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}
