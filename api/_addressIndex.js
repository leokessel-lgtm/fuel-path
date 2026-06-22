const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SEED_PATH = path.join(ROOT, "prototype", "data", "gnaf-addresses.seed.json");

let seedRecordsCache = null;
let sqliteCache = null;

function addressIndexStatus() {
  const sqlitePath = configuredSqlitePath();
  const apiConfigured = Boolean(configuredApiUrl());
  const postgresConfigured = Boolean(configuredPostgresUrl());
  const seedRecords = loadSeedRecords();
  return {
    configured: apiConfigured || postgresConfigured || Boolean(sqlitePath) || seedRecords.length > 0,
    mode: apiConfigured ? "api" : postgresConfigured ? "postgres" : sqlitePath ? "sqlite" : seedRecords.length ? "seed" : "disabled",
    apiConfigured,
    postgresConfigured,
    sqliteConfigured: Boolean(sqlitePath),
    seedRecords: seedRecords.length,
    source: apiConfigured
      ? configuredApiUrl()
      : postgresConfigured
        ? "fuel_path_gnaf_addresses"
        : sqlitePath || DEFAULT_SEED_PATH,
    provider: "fuel_path_gnaf",
    attribution:
      "G-NAF © Geoscape Australia licensed by the Commonwealth of Australia under the Open G-NAF End User Licence Agreement.",
  };
}

async function searchAddressIndex(query, limit = 5) {
  const rawQuery = String(query || "");
  const needle = normaliseAddressText(query);
  if (needle.length < 4) return [];
  const needles = addressSearchNeedles(rawQuery);

  if (configuredApiUrl()) {
    const apiResults = mergeAddressSuggestions(
      await Promise.all(needles.map((item) => searchApiIndex(item.rawQuery, item.needle, limit))),
      limit,
    );
    if (apiResults.length) return apiResults;
  }

  if (configuredPostgresUrl()) {
    const postgresResults = mergeAddressSuggestions(
      await Promise.all(needles.map((item) => searchPostgresIndex(item.needle, limit))),
      limit,
    );
    if (postgresResults.length) return postgresResults;
  }

  const sqlitePath = configuredSqlitePath();
  if (sqlitePath) {
    const sqliteResults = mergeAddressSuggestions(
      needles.map((item) => searchSqliteIndex(item.needle, limit)),
      limit,
    );
    if (sqliteResults.length) return sqliteResults;
  }

  return mergeAddressSuggestions(needles.map((item) => searchSeedIndex(item.needle, limit)), limit);
}

async function searchApiIndex(rawQuery, needle, limit) {
  try {
    const url = new URL("/search", configuredApiUrl());
    url.searchParams.set("q", rawQuery);
    url.searchParams.set("limit", String(Math.max(1, Math.min(Number(limit) || 5, 20))));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url.toString(), {
      headers: apiHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return [];
    const payload = await response.json();
    const rows = Array.isArray(payload?.suggestions) ? payload.suggestions : Array.isArray(payload) ? payload : [];
    return rows
      .map((row) => addressRecordToSuggestion(row, row.matchType || apiMatchType(row, needle), Number(row.score || 950)))
      .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon));
  } catch {
    return [];
  }
}

async function searchPostgresIndex(needle, limit) {
  const sql = postgresClient();
  if (!sql) return [];
  try {
    const queryState = detectQueryStateCode(needle);
    const rows = queryState
      ? await sql`
        SELECT id, label, lat, lon, state, postcode, accuracy, search_text
        FROM fuel_path_gnaf_addresses
        WHERE state = ${queryState}
          AND (
            search_text LIKE ${`${needle}%`}
            OR search_text LIKE ${`% ${needle}%`}
            OR search_text % ${needle}
          )
        ORDER BY
          CASE
            WHEN search_text = ${needle} THEN 0
            WHEN search_text LIKE ${`${needle}%`} THEN 1
            WHEN search_text LIKE ${`% ${needle}%`} THEN 2
            ELSE 3
          END,
          similarity(search_text, ${needle}) DESC,
          LENGTH(label)
        LIMIT ${Math.max(1, Math.min(Number(limit) || 5, 20))}
      `
      : await sql`
        SELECT id, label, lat, lon, state, postcode, accuracy, search_text
        FROM fuel_path_gnaf_addresses
        WHERE search_text LIKE ${`${needle}%`}
          OR search_text LIKE ${`% ${needle}%`}
          OR search_text % ${needle}
        ORDER BY
          CASE
            WHEN search_text = ${needle} THEN 0
            WHEN search_text LIKE ${`${needle}%`} THEN 1
            WHEN search_text LIKE ${`% ${needle}%`} THEN 2
            ELSE 3
          END,
          similarity(search_text, ${needle}) DESC,
          LENGTH(label)
        LIMIT ${Math.max(1, Math.min(Number(limit) || 5, 20))}
      `;
    return rows
      .map((row) => ({ row, matchType: postgresMatchType(row, needle) }))
      .filter(({ row, matchType }) => addressMatchQualityPass(row, needle, matchType))
      .map(({ row, matchType }) => addressRecordToSuggestion(row, matchType, 1000));
  } catch {
    return [];
  }
}

function searchSeedIndex(needle, limit) {
  return loadSeedRecords()
    .map((record) => scoreRecord(record, needle))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.record.label.length - right.record.label.length)
    .slice(0, limit)
    .map(({ record, matchType, score }) => addressRecordToSuggestion(record, matchType, score));
}

function searchSqliteIndex(needle, limit) {
  const database = openSqliteIndex();
  if (!database) return [];
  const sqlitePath = configuredSqlitePath();
  if (sqliteHybridIndexAvailable(database)) {
    const hybridResults = searchSqliteHybridIndex(database, needle, limit);
    if (hybridResults.length) return hybridResults;
  }
  if (isLargeSqliteIndex(sqlitePath) && !shouldSearchLargeSqliteIndex(needle)) return [];

  const terms = sqliteFtsTermsForNeedle(needle);
  if (!terms.length) return [];

  try {
    const ftsQuery = terms.map((term) => `${escapeFtsTerm(term)}*`).join(" ");
    const expandedLimit = Math.max(Math.min(Number(limit) || 5, 20) * 8, 40);
    const statement = database.prepare(`
      SELECT ${sqliteAddressSelect(database)}
      FROM address_fts
      WHERE address_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    return statement
      .all(ftsQuery, expandedLimit)
      .map((row) => ({ row, matchType: sqliteMatchType(row, needle) }))
      .filter(({ row, matchType }) => addressMatchQualityPass(row, needle, matchType))
      .sort((left, right) => addressIndexRank(right, needle) - addressIndexRank(left, needle) || left.row.label.length - right.row.label.length)
      .slice(0, limit)
      .map(({ row, matchType }) => addressRecordToSuggestion(row, matchType, addressIndexRank({ row, matchType }, needle)));
  } catch {
    try {
      const statement = database.prepare(`
        SELECT ${sqliteAddressSelect(database)}
        FROM addresses
        WHERE search_text LIKE ?
        ORDER BY LENGTH(label)
        LIMIT ?
      `);
      return statement
        .all(`%${needle}%`, limit)
        .map((row) => ({ row, matchType: sqliteMatchType(row, needle) }))
        .filter(({ row, matchType }) => addressMatchQualityPass(row, needle, matchType))
        .sort((left, right) => addressIndexRank(right, needle) - addressIndexRank(left, needle) || left.row.label.length - right.row.label.length)
        .map(({ row, matchType }) => addressRecordToSuggestion(row, matchType, addressIndexRank({ row, matchType }, needle)));
    } catch {
      return [];
    }
  }
}

function searchSqliteHybridIndex(database, needle, limit) {
  if (queryContainsUnitLikeToken(needle)) {
    const typeaheadRows = searchSqliteTypeaheadEntries(database, needle, limit);
    return hybridRowsToSuggestions(typeaheadRows, needle);
  }
  if (!/^\d/.test(needle)) {
    const typeaheadRows = searchSqliteTypeaheadEntries(database, needle, limit);
    return hybridRowsToSuggestions(typeaheadRows, needle);
  }
  const prefixRows = searchSqlitePrefixEntries(database, needle, limit);
  if (prefixRows.length && !prefixRowsAmbiguous(prefixRows)) {
    return hybridRowsToSuggestions(prefixRows, needle, 950);
  }
  const typeaheadRows = searchSqliteTypeaheadEntries(database, needle, limit);
  return hybridRowsToSuggestions(typeaheadRows, needle);
}

function hybridRowsToSuggestions(rows, needle, fallbackScore = 900) {
  const suggestions = [];
  const seen = new Set();
  for (const row of rows) {
    const record = hybridRowToAddressRecord(row);
    const suggestion = addressRecordToSuggestion(record, hybridMatchType(row, needle), Number(row.rank_weight || fallbackScore));
    const key = String(suggestion.providerId || suggestion.label);
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
  }
  return suggestions;
}

function searchSqlitePrefixEntries(database, needle, limit) {
  const prefix = normaliseAddressText(needle).slice(0, 15);
  if (prefix.length < 3) return [];
  return database.prepare(`
    SELECT
      e.entry_id,
      e.entry_type,
      e.refine_required,
      e.rank_weight,
      e.key_text,
      e.base_signature,
      e.display_title AS entry_display_title,
      e.display_subtitle AS entry_display_subtitle,
      a.id AS address_id,
      a.label AS address_label,
      a.lat,
      a.lon,
      a.state,
      a.postcode,
      a.locality,
      a.accuracy,
      a.display_title AS address_display_title,
      a.display_subtitle AS address_display_subtitle
    FROM address_prefix_entries p
    JOIN address_typeahead_entries e ON e.entry_id = p.entry_id
    JOIN addresses a ON a.id = e.address_id
    WHERE p.prefix = ?
    ORDER BY p.rank_weight DESC, LENGTH(a.label), a.label
    LIMIT ?
  `).all(prefix, Math.max(1, Math.min(Number(limit) || 5, 20)));
}

function searchSqliteTypeaheadEntries(database, needle, limit) {
  const terms = normaliseAddressText(needle).split(/\s+/).filter(Boolean).slice(0, 8);
  if (!terms.length) return [];
  const ftsQuery = terms.map((term) => `${escapeFtsTerm(term)}*`).join(" ");
  return database.prepare(`
    SELECT
      e.entry_id,
      e.entry_type,
      e.refine_required,
      e.rank_weight,
      e.key_text,
      e.base_signature,
      e.display_title AS entry_display_title,
      e.display_subtitle AS entry_display_subtitle,
      a.id AS address_id,
      a.label AS address_label,
      a.lat,
      a.lon,
      a.state,
      a.postcode,
      a.locality,
      a.accuracy,
      a.display_title AS address_display_title,
      a.display_subtitle AS address_display_subtitle
    FROM address_typeahead_fts f
    JOIN address_typeahead_entries e ON e.entry_id = f.entry_id
    JOIN addresses a ON a.id = e.address_id
    WHERE address_typeahead_fts MATCH ?
    ORDER BY
      CASE
        WHEN e.key_text = ? THEN 0
        WHEN e.key_text LIKE ? THEN 1
        WHEN e.key_text LIKE ? THEN 2
        ELSE 3
      END,
      e.rank_weight DESC,
      rank,
      LENGTH(a.label),
      a.label
    LIMIT ?
  `).all(ftsQuery, needle, `${needle}%`, `% ${needle}%`, Math.max(1, Math.min(Number(limit) || 5, 20)));
}

function prefixRowsAmbiguous(rows) {
  const strongRows = rows.filter((row) => Number(row.rank_weight || 0) >= 980);
  const signatures = new Set(strongRows.map((row) => row.base_signature).filter(Boolean));
  return signatures.size > 1;
}

function hybridRowToAddressRecord(row) {
  const isRefine = row.entry_type === "base_refine";
  const entryLabel = [row.entry_display_title, row.entry_display_subtitle].filter(Boolean).join(", ");
  return {
    id: isRefine ? row.entry_id : row.address_id,
    label: isRefine ? entryLabel || row.address_label : row.address_label,
    lat: row.lat,
    lon: row.lon,
    state: row.state,
    postcode: row.postcode,
    locality: row.locality,
    accuracy: row.accuracy || "address_typeahead",
    search_text: row.key_text,
    display_title: isRefine ? row.entry_display_title : row.entry_display_title || row.address_display_title,
    display_subtitle: isRefine ? row.entry_display_subtitle : row.entry_display_subtitle || row.address_display_subtitle,
    suggestion_type: isRefine ? "base_address" : "exact_address",
    refine_required: row.refine_required,
    refine_hint: Number(row.refine_required || 0) ? "Choose or type the exact unit before routing." : "",
  };
}

function hybridMatchType(row, needle) {
  if (Number(row.refine_required || 0)) return "building_refine";
  const key = normaliseAddressText(row.key_text);
  const label = normaliseAddressText(row.address_label);
  if (key === needle || label === needle) return "exact_address";
  if (key.startsWith(needle) || label.startsWith(needle)) return "address_prefix";
  return "address_token_overlap";
}

function scoreRecord(record, needle) {
  const texts = [record.searchText, normaliseAddressText(record.label), ...(record.aliases || [])]
    .filter(Boolean)
    .map(normaliseAddressText);
  let bestScore = 0;
  let matchType = "";
  for (const text of texts) {
    if (needle === text) {
      bestScore = Math.max(bestScore, 1000);
      matchType = "exact_address";
      continue;
    }
    if (text.startsWith(needle)) {
      bestScore = Math.max(bestScore, 900);
      matchType ||= "address_prefix";
      continue;
    }
    if (text.includes(needle)) {
      bestScore = Math.max(bestScore, 760);
      matchType ||= "address_contains";
      continue;
    }
    if (needle.includes(text) && text.length >= 8) {
      bestScore = Math.max(bestScore, 680);
      matchType ||= "address_alias";
    }
  }
  return bestScore ? { record, score: bestScore, matchType } : null;
}

function addressRecordToSuggestion(record, matchType, score) {
  const display = addressDisplayMetadata(record, matchType);
  return {
    label: String(record.label),
    lat: Number(record.lat),
    lon: Number(record.lon),
    type: display.type,
    provider: "fuel_path_gnaf",
    providerId: String(record.id || record.provider_id || record.label),
    confidence: display.confidence,
    matchType: display.matchType,
    score,
    source: "gnaf_address_index",
    accuracy: String(record.accuracy || "address_index"),
    state: record.state ? String(record.state) : undefined,
    postcode: record.postcode ? String(record.postcode) : undefined,
    displayTitle: display.title,
    displaySubtitle: display.subtitle,
    sourceLabel: display.sourceLabel,
    suggestionType: display.suggestionType,
    refineRequired: display.refineRequired,
    refineHint: display.refineHint,
  };
}

function loadSeedRecords() {
  if (seedRecordsCache) return seedRecordsCache;
  try {
    const payload = JSON.parse(fs.readFileSync(DEFAULT_SEED_PATH, "utf8"));
    seedRecordsCache = Array.isArray(payload) ? payload : [];
  } catch {
    seedRecordsCache = [];
  }
  return seedRecordsCache;
}

function configuredSqlitePath() {
  const value = process.env.FUEL_PATH_GNAF_SQLITE_PATH || "";
  if (!value) return "";
  const resolved = path.resolve(value);
  return fs.existsSync(resolved) ? resolved : "";
}

function configuredApiUrl() {
  return process.env.FUEL_PATH_GNAF_API_URL || "";
}

function apiHeaders() {
  const token = process.env.FUEL_PATH_GNAF_API_TOKEN || "";
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function configuredPostgresUrl() {
  return process.env.FUEL_PATH_GNAF_DATABASE_URL || "";
}

function postgresClient() {
  const connectionString = configuredPostgresUrl();
  if (!connectionString) return null;
  if (postgresClient.cache?.connectionString === connectionString) return postgresClient.cache.sql;
  try {
    const { neon } = require("@neondatabase/serverless");
    const sql = neon(connectionString);
    postgresClient.cache = { connectionString, sql };
    return sql;
  } catch {
    postgresClient.cache = null;
    return null;
  }
}

function openSqliteIndex() {
  const sqlitePath = configuredSqlitePath();
  if (!sqlitePath) return null;
  if (sqliteCache?.path === sqlitePath) return sqliteCache.database;
  try {
    const { DatabaseSync } = require("node:sqlite");
    const database = new DatabaseSync(sqlitePath, { readOnly: true });
    sqliteCache = { path: sqlitePath, database };
    return database;
  } catch {
    sqliteCache = null;
    return null;
  }
}

function sqliteAddressSelect(database) {
  const optional = [
    "display_title",
    "display_subtitle",
    "suggestion_type",
    "refine_required",
    "refine_hint",
    "base_key",
    "search_key",
  ];
  const columns = sqliteSchemaColumns(database, "address_fts");
  return [
    "id",
    "label",
    "lat",
    "lon",
    "state",
    "postcode",
    "accuracy",
    "search_text",
    "locality",
    ...optional.filter((column) => columns.has(column)),
  ].join(", ");
}

function sqliteSchemaColumns(database, table) {
  const cacheKey = `${configuredSqlitePath()}:${table}`;
  if (sqliteSchemaColumns.cache?.key === cacheKey) return sqliteSchemaColumns.cache.columns;
  const rows = database.prepare(`PRAGMA table_info(${table})`).all();
  const columns = new Set(rows.map((row) => String(row.name)));
  sqliteSchemaColumns.cache = { key: cacheKey, columns };
  return columns;
}

function sqliteHybridIndexAvailable(database) {
  return sqliteTableExists(database, "address_typeahead_entries") &&
    sqliteTableExists(database, "address_typeahead_fts") &&
    sqliteTableExists(database, "address_prefix_entries");
}

function sqliteTableExists(database, table) {
  const cacheKey = `${configuredSqlitePath()}:${table}`;
  if (!sqliteTableExists.cache) sqliteTableExists.cache = new Map();
  if (sqliteTableExists.cache.has(cacheKey)) return sqliteTableExists.cache.get(cacheKey);
  const row = database.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?").get(table);
  const exists = Boolean(row?.name);
  sqliteTableExists.cache.set(cacheKey, exists);
  return exists;
}

function isLargeSqliteIndex(sqlitePath) {
  if (!sqlitePath) return false;
  const threshold = Number(process.env.FUEL_PATH_GNAF_LARGE_SQLITE_BYTES || 1_000_000_000);
  try {
    return fs.statSync(sqlitePath).size >= threshold;
  } catch {
    return false;
  }
}

function shouldSearchLargeSqliteIndex(needle) {
  const terms = sqliteFtsTermsForNeedle(needle);
  if (terms.length < 3) return false;
  const hasHouseNumber = terms.some((term) => /^\d+[a-z]?$/.test(term));
  if (!hasHouseNumber) return false;
  const alphaTerms = terms.filter((term) => /[a-z]/.test(term) && !isStateCode(term));
  if (alphaTerms.length < 2) return false;
  if (alphaTerms.some((term) => term.length >= 4)) return true;
  return /\b\d{4}\b/.test(needle) || terms.some(isStateCode);
}

function sqliteFtsTermsForNeedle(needle) {
  const tokens = normaliseAddressText(needle).split(" ").filter(Boolean).slice(0, 10);
  return tokens
    .filter((token, index) => {
      if (SQLITE_FTS_STOP_TERMS.has(token)) return false;
      if (/^\d{1,2}$/.test(token) && index === 0 && /^\d+$/.test(tokens[index + 1] || "")) return false;
      if (
        /^\d{1,2}$/.test(token) &&
        SQLITE_UNIT_TERMS.has(tokens[index - 1] || "") &&
        /^\d+$/.test(tokens[index + 1] || "")
      ) {
        return false;
      }
      return true;
    })
    .slice(0, 8);
}

const SQLITE_FTS_STOP_TERMS = new Set([
  "avenue",
  "boulevard",
  "circuit",
  "close",
  "court",
  "crescent",
  "drive",
  "highway",
  "lane",
  "parade",
  "place",
  "road",
  "street",
  "terrace",
  "townhouse",
  "unit",
]);

const SQLITE_UNIT_TERMS = new Set(["apartment", "apt", "flat", "level", "lvl", "office", "shop", "suite", "townhouse", "unit"]);

function queryContainsUnitLikeToken(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  return tokens.some((token) => SQLITE_UNIT_TERMS.has(token));
}

function isStateCode(value) {
  return ["act", "nsw", "nt", "ot", "qld", "sa", "tas", "vic", "wa"].includes(String(value || "").toLowerCase());
}

function sqliteMatchType(row, needle) {
  const text = normaliseAddressText(row?.search_text);
  const label = normaliseAddressText(row?.label);
  if (text === needle || label === needle) return "exact_address";
  if (text.startsWith(needle)) return "address_prefix";
  if (text.includes(needle) || label.includes(needle)) return "address_contains";
  return "address_token_overlap";
}

function postgresMatchType(row, needle) {
  return sqliteMatchType(row, needle);
}

function detectQueryStateCode(needle) {
  const tokens = new Set(String(needle || "").toUpperCase().split(/\s+/).filter(Boolean));
  return ["NSW", "ACT", "QLD", "VIC", "SA", "WA", "TAS", "NT", "OT"].find((code) => tokens.has(code)) || "";
}

function addressMatchQualityPass(row, needle, matchType) {
  if (["exact_address", "address_prefix"].includes(matchType)) return true;
  const queryTokens = significantAddressTokens(needle);
  if (queryTokens.length < 3) return true;
  const rowTokens = new Set(significantAddressTokens(`${row?.search_text || ""} ${row?.label || ""}`));
  const overlap = queryTokens.filter((token) => rowTokens.has(token)).length;
  return overlap >= Math.min(3, queryTokens.length);
}

function addressIndexRank(candidate, needle) {
  const { row, matchType } = candidate;
  const label = normaliseAddressText(row?.label);
  const text = normaliseAddressText(row?.search_text);
  const key = normaliseAddressText(row?.search_key);
  const base = normaliseAddressText(row?.base_key);
  if (matchType === "exact_address") return 1000;
  if (label.startsWith(needle)) return 960;
  if (key && key.startsWith(needle)) return 950;
  if (base && base.startsWith(needle)) return 940;
  if (text.startsWith(needle)) return 930;
  if (matchType === "address_contains") return 760;
  const queryTokens = significantAddressTokens(needle);
  const rowTokens = new Set(significantAddressTokens(`${row?.search_text || ""} ${row?.label || ""}`));
  const overlap = queryTokens.filter((token) => rowTokens.has(token)).length;
  return 500 + overlap;
}

function significantAddressTokens(value) {
  const stopwords = new Set([
    "act",
    "australia",
    "avenue",
    "ave",
    "drive",
    "dr",
    "highway",
    "hwy",
    "lane",
    "ln",
    "new",
    "nsw",
    "nt",
    "place",
    "pl",
    "qld",
    "road",
    "rd",
    "sa",
    "street",
    "st",
    "tas",
    "unit",
    "vic",
    "wa",
  ]);
  return normaliseAddressText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopwords.has(token));
}

function apiMatchType(row, needle) {
  return sqliteMatchType({ label: row?.label, search_text: row?.search_text || row?.searchText }, needle);
}

function addressDisplayMetadata(record, matchType) {
  const storedType = String(record.suggestion_type || "");
  const storedRefineRequired = Boolean(Number(record.refine_required || 0));
  const label = String(record.label || "");
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  const unitIndex = parts.findIndex((part) => /^(unit|flat|apartment|apt|suite|townhouse)\b/i.test(part));
  const streetIndex = parts.findIndex((part) => /^\d+[a-z]?(?:-\d+[a-z]?)?\s+/i.test(part));
  const hasBuildingName = unitIndex > 0;
  const title =
    record.display_title ||
    (hasBuildingName ? `${parts[0]}, ${parts[unitIndex]}` : unitIndex === 0 ? parts[unitIndex] : parts[streetIndex] || parts[0] || label);
  const subtitle =
    record.display_subtitle ||
    (unitIndex >= 0
      ? [parts[streetIndex], parts[parts.length - 1]].filter(Boolean).join(", ")
      : parts.slice(1).join(", "));
  const refineRequired = storedRefineRequired || storedType === "building" || storedType === "base_address";
  const suggestionType = storedType || "exact_address";
  return {
    confidence: matchType === "exact_address" && !refineRequired ? "high" : "medium",
    matchType: refineRequired && matchType !== "exact_address" ? "building_refine" : matchType,
    refineHint: record.refine_hint || (refineRequired ? "Type or choose the exact unit before routing." : ""),
    refineRequired,
    sourceLabel:
      refineRequired || suggestionType === "building"
        ? "Building"
        : suggestionType === "exact_address" || matchType === "exact_address"
          ? "Exact address"
          : "Address match",
    subtitle,
    suggestionType,
    title,
    type: refineRequired ? "building" : "address",
  };
}

function escapeFtsTerm(value) {
  return String(value).replace(/["']/g, " ").replace(/[^\p{L}\p{N}_-]+/gu, " ").trim();
}

function normaliseAddressText(value) {
  const expanded = String(value || "")
    .toLowerCase()
    .replace(/\bbvd\b/g, "boulevard")
    .replace(/\bblvd\b/g, "boulevard")
    .replace(/\bcct\b/g, "circuit")
    .replace(/\bcnr\b/g, "corner")
    .replace(/\bcr\b/g, "crescent")
    .replace(/\bcres\b/g, "crescent")
    .replace(/\bct\b/g, "court")
    .replace(/\bst\b/g, "street")
    .replace(/\brd\b/g, "road")
    .replace(/\bave\b/g, "avenue")
    .replace(/\bdr\b/g, "drive")
    .replace(/\besp\b/g, "esplanade")
    .replace(/\bhwy\b/g, "highway")
    .replace(/\bmt\b/g, "mount")
    .replace(/\bpkwy\b/g, "parkway")
    .replace(/\bpwy\b/g, "parkway")
    .replace(/\bpde\b/g, "parade")
    .replace(/\bpl\b/g, "place")
    .replace(/\bln\b/g, "lane")
    .replace(/\bsq\b/g, "square")
    .replace(/\btce\b/g, "terrace");
  return expanded.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function addressSearchNeedles(rawQuery) {
  const primary = normaliseAddressText(rawQuery);
  const variants = [primary, ...complexAddressNeedles(primary)];
  const seen = new Set();
  return variants
    .map((needle) => normaliseAddressText(needle))
    .filter((needle) => {
      if (needle.length < 4 || seen.has(needle)) return false;
      seen.add(needle);
      return true;
    })
    .map((needle) => ({ needle, rawQuery: needle === primary ? String(rawQuery || "") : needle }));
}

function complexAddressNeedles(needle) {
  const variants = [];
  const tokens = String(needle || "").split(/\s+/).filter(Boolean);
  for (let index = 0; index < tokens.length; index += 1) {
    if (!SQLITE_UNIT_TERMS.has(tokens[index])) continue;
    const afterUnit = tokens.slice(index).join(" ");
    if (shouldSearchLargeSqliteIndex(afterUnit)) variants.push(afterUnit);
    const afterFlatNumber = tokens.slice(index + 2).join(" ");
    if (shouldSearchLargeSqliteIndex(afterFlatNumber)) variants.push(afterFlatNumber);
  }
  for (let index = 0; index < tokens.length; index += 1) {
    if (!/^\d+[a-z]?$/.test(tokens[index])) continue;
    const candidate = tokens.slice(index).join(" ");
    if (shouldSearchLargeSqliteIndex(candidate)) variants.push(candidate);
  }
  return variants;
}

function mergeAddressSuggestions(groups, limit) {
  const rows = [];
  const seen = new Set();
  for (const group of groups) {
    for (const item of group || []) {
      const key = String(item.providerId || item.label);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(item);
    }
  }
  return rows.slice(0, limit);
}

module.exports = {
  addressIndexStatus,
  addressMatchQualityPass,
  addressSearchNeedles,
  normaliseAddressText,
  searchAddressIndex,
  shouldSearchLargeSqliteIndex,
  sqliteFtsTermsForNeedle,
};
