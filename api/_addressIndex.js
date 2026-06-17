const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SEED_PATH = path.join(ROOT, "prototype", "data", "gnaf-addresses.seed.json");

let seedRecordsCache = null;
let sqliteCache = null;

function addressIndexStatus() {
  const sqlitePath = configuredSqlitePath();
  const seedRecords = loadSeedRecords();
  return {
    configured: Boolean(sqlitePath) || seedRecords.length > 0,
    mode: sqlitePath ? "sqlite" : seedRecords.length ? "seed" : "disabled",
    sqliteConfigured: Boolean(sqlitePath),
    seedRecords: seedRecords.length,
    source: sqlitePath || DEFAULT_SEED_PATH,
    provider: "fuel_path_gnaf",
    attribution:
      "G-NAF © Geoscape Australia licensed by the Commonwealth of Australia under the Open G-NAF End User Licence Agreement.",
  };
}

function searchAddressIndex(query, limit = 5) {
  const needle = normaliseAddressText(query);
  if (needle.length < 4) return [];

  const sqlitePath = configuredSqlitePath();
  if (sqlitePath) {
    const sqliteResults = searchSqliteIndex(needle, limit);
    if (sqliteResults.length) return sqliteResults;
  }

  return searchSeedIndex(needle, limit);
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

  const terms = needle.split(" ").filter(Boolean).slice(0, 8);
  if (!terms.length) return [];

  try {
    const ftsQuery = terms.map((term) => `${escapeFtsTerm(term)}*`).join(" ");
    const statement = database.prepare(`
      SELECT id, label, lat, lon, state, postcode, accuracy, search_text
      FROM address_fts
      WHERE address_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    return statement
      .all(ftsQuery, limit)
      .map((row) => addressRecordToSuggestion(row, sqliteMatchType(row.search_text, needle), 1000));
  } catch {
    try {
      const statement = database.prepare(`
        SELECT id, label, lat, lon, state, postcode, accuracy, search_text
        FROM addresses
        WHERE search_text LIKE ?
        ORDER BY LENGTH(label)
        LIMIT ?
      `);
      return statement
        .all(`%${needle}%`, limit)
        .map((row) => addressRecordToSuggestion(row, sqliteMatchType(row.search_text, needle), 700));
    } catch {
      return [];
    }
  }
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
  return {
    label: String(record.label),
    lat: Number(record.lat),
    lon: Number(record.lon),
    type: "address",
    provider: "fuel_path_gnaf",
    providerId: String(record.id || record.provider_id || record.label),
    confidence: matchType === "exact_address" ? "high" : "medium",
    matchType,
    score,
    source: "gnaf_address_index",
    accuracy: String(record.accuracy || "address_index"),
    state: record.state ? String(record.state) : undefined,
    postcode: record.postcode ? String(record.postcode) : undefined,
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

function sqliteMatchType(searchText, needle) {
  const text = normaliseAddressText(searchText);
  if (text === needle) return "exact_address";
  if (text.startsWith(needle)) return "address_prefix";
  return "address_contains";
}

function escapeFtsTerm(value) {
  return String(value).replace(/["']/g, " ").replace(/[^\p{L}\p{N}_-]+/gu, " ").trim();
}

function normaliseAddressText(value) {
  const expanded = String(value || "")
    .toLowerCase()
    .replace(/\bst\b/g, "street")
    .replace(/\brd\b/g, "road")
    .replace(/\bave\b/g, "avenue")
    .replace(/\bdr\b/g, "drive")
    .replace(/\bpde\b/g, "parade")
    .replace(/\bpl\b/g, "place")
    .replace(/\bln\b/g, "lane");
  return expanded.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

module.exports = {
  addressIndexStatus,
  normaliseAddressText,
  searchAddressIndex,
};
