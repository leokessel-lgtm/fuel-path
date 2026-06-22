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

function normaliseSearchContext(value = {}) {
  if (!value) return null;
  const lat = Number(value.nearLat);
  const lon = Number(value.nearLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { nearLat: lat, nearLon: lon };
}

async function searchAddressIndex(query, limit = 5, options = {}) {
  const rawQuery = String(query || "");
  const needle = normaliseAddressText(query);
  if (needle.length < 4) return [];
  const needles = addressSearchNeedles(rawQuery);
  const searchContext = normaliseSearchContext(options.searchContext);

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
    const sqliteResults = searchSqliteNeedles(needles, limit, searchContext);
    if (sqliteResults.length) return sqliteResults;
  }

  return mergeAddressSuggestions(needles.map((item) => searchSeedIndex(item.needle, limit)), limit);
}

function searchSqliteNeedles(needles, limit, searchContext) {
  const groups = [];
  for (const item of needles) {
    const rows = searchSqliteIndex(item.needle, limit, searchContext);
    groups.push(rows);
    const merged = mergeAddressSuggestions(groups, limit);
    if (shouldStopSqliteNeedleSearch(merged, item.needle, limit)) return merged;
  }
  return mergeAddressSuggestions(groups, limit);
}

function shouldStopSqliteNeedleSearch(results, needle, limit) {
  if (results.length >= limit) return true;
  const top = results[0];
  if (!top || top.suggestionType !== "exact_address" || top.refineRequired === true) return false;
  if (queryContainsUnitLikeToken(needle)) return true;
  return shouldSearchLargeSqliteIndex(needle);
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

function searchSqliteIndex(needle, limit, searchContext = null) {
  const database = openSqliteIndex();
  if (!database) return [];
  const sqlitePath = configuredSqlitePath();
  if (sqliteHybridIndexAvailable(database)) {
    const hybridResults = searchSqliteHybridIndex(database, needle, limit, searchContext);
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

function searchSqliteHybridIndex(database, needle, limit, searchContext = null) {
  if (queryContainsUnitLikeToken(needle)) {
    const unitRangePrefixReady = unitLikeRangeQueryReadyForExactPrefix(needle);
    if (!unitLikeQueryReadyForTypeahead(needle) && !unitRangePrefixReady) return [];
    const exactUnitRows = searchSqliteExactUnitEntries(database, needle, limit);
    if (exactUnitRows.length) return hybridRowsToSuggestions(exactUnitRows, needle, 960);
    if (unitLikeQueryStartsWithUnitToken(needle)) {
      if (unitRangePrefixReady && !unitLikeQueryReadyForTypeahead(needle)) {
        const exactPrefixRows = searchSqlitePrefixEntries(database, needle, limit, searchContext, {
          includeTokenBoundaryPrefix: true,
          minPrefixLength: 12,
        }).filter((row) => row.entry_type === "exact" && row.unit);
        if (exactPrefixRows.length && !prefixRowsAmbiguous(exactPrefixRows)) {
          return hybridRowsToSuggestions(preferExactUnitPrefixRows(exactPrefixRows), needle, 940);
        }
        return [];
      }
      const prefixRows = searchSqlitePrefixEntries(database, needle, limit, searchContext);
      const useContextualPrefixRows = shouldUseContextualAmbiguousPrefixRows(needle, searchContext);
      if (prefixRows.length && (!prefixRowsAmbiguous(prefixRows) || useContextualPrefixRows)) {
        return hybridRowsToSuggestions(useContextualPrefixRows ? prefixRows : preferExactUnitPrefixRows(prefixRows), needle, 930);
      }
      if (unitRangePrefixReady) {
        const exactPrefixRows = searchSqlitePrefixEntries(database, needle, limit, searchContext, {
          includeTokenBoundaryPrefix: true,
        }).filter((row) => row.entry_type === "exact" && row.unit);
        if (exactPrefixRows.length && !prefixRowsAmbiguous(exactPrefixRows)) {
          return hybridRowsToSuggestions(preferExactUnitPrefixRows(exactPrefixRows), needle, 940);
        }
      }
    } else {
      const buildingUnitRows = searchSqliteBuildingUnitEntries(database, needle, limit, searchContext);
      if (buildingUnitRows.length) return hybridRowsToSuggestions(buildingUnitRows, needle, 960);
      const buildingUnitRefineRows = searchSqliteBuildingUnitRefineEntries(database, needle, limit, searchContext);
      if (buildingUnitRefineRows.length) return hybridRowsToSuggestions(buildingUnitRefineRows, needle, 940);
      const embeddedUnitNeedle = embeddedUnitAddressCoreNeedle(needle);
      if (embeddedUnitNeedle) {
        const prefixRows = searchSqlitePrefixEntries(database, embeddedUnitNeedle, limit, searchContext, {
          minPrefixLength: 12,
        });
        const useContextualPrefixRows = shouldUseContextualAmbiguousPrefixRows(embeddedUnitNeedle, searchContext);
        if (prefixRows.length && (!prefixRowsAmbiguous(prefixRows) || useContextualPrefixRows)) {
          return hybridRowsToSuggestions(useContextualPrefixRows ? prefixRows : preferExactUnitPrefixRows(prefixRows), needle, 930);
        }
      }
    }
    const typeaheadRows = searchSqliteTypeaheadEntries(database, needle, limit, searchContext);
    return hybridRowsToSuggestions(typeaheadRows, needle);
  }
  if (!/^\d/.test(needle)) {
    if (queryStartsWithLotLikeToken(needle)) {
      const prefixRows = searchSqlitePrefixEntries(database, needle, limit, searchContext);
      if (prefixRows.length && (!prefixRowsAmbiguous(prefixRows) || shouldUseContextualAmbiguousPrefixRows(needle, searchContext))) {
        return hybridRowsToSuggestions(prefixRows, needle, 950);
      }
    }
    const embeddedAddressCoreNeedle = embeddedNumberFirstAddressCoreNeedle(needle);
    if (embeddedAddressCoreNeedle) {
      const prefixRows = searchSqlitePrefixEntries(database, embeddedAddressCoreNeedle, limit, searchContext, {
        minPrefixLength: 8,
      });
      if (prefixRows.length && (!prefixRowsAmbiguous(prefixRows) || shouldUseContextualAmbiguousPrefixRows(embeddedAddressCoreNeedle, searchContext))) {
        return hybridRowsToSuggestions(prefixRows, needle, 950);
      }
    }
    const typeaheadRows = searchSqliteTypeaheadEntries(database, needle, limit, searchContext);
    return hybridRowsToSuggestions(typeaheadRows, needle);
  }
  const prefixRows = searchSqlitePrefixEntries(database, needle, limit, searchContext);
  if (prefixRows.length && (!prefixRowsAmbiguous(prefixRows) || shouldUseContextualAmbiguousPrefixRows(needle, searchContext))) {
    return hybridRowsToSuggestions(prefixRows, needle, 950);
  }
  const typeaheadRows = searchSqliteTypeaheadEntries(database, needle, limit, searchContext);
  return hybridRowsToSuggestions(typeaheadRows, needle);
}

function hybridRowsToSuggestions(rows, needle, fallbackScore = 900) {
  const suggestions = [];
  const seen = new Set();
  for (const row of rows) {
    if (!hybridRowQualityPass(row, needle)) continue;
    const record = hybridRowToAddressRecord(row);
    const suggestion = addressRecordToSuggestion(record, hybridMatchType(row, needle), Number(row.rank_weight || fallbackScore));
    const key = String(suggestion.providerId || suggestion.label);
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
  }
  return suggestions;
}

function hybridRowQualityPass(row, needle) {
  const unitSlash = queryLeadingUnitSlashNumbers(needle);
  if (unitSlash && labelUnitAndHouseMatch(row?.address_label || row?.key_text || "", unitSlash)) return true;
  const queryHouseNumber = queryLeadingHouseNumber(needle);
  if (!queryHouseNumber) return true;
  const rowHouseNumber = labelHouseNumber(row?.address_label || row?.key_text || "");
  if (!rowHouseNumber) return true;
  return houseNumbersCompatible(queryHouseNumber, rowHouseNumber);
}

function searchSqlitePrefixEntries(database, needle, limit, searchContext = null, options = {}) {
  const prefixes = options.includeTokenBoundaryPrefix
    ? [
        ...materialisedTokenBoundaryPrefixesForNeedle(needle, options.minPrefixLength),
        ...materialisedPrefixesForNeedle(needle, options.minPrefixLength),
      ]
    : materialisedPrefixesForNeedle(needle, options.minPrefixLength);
  if (!prefixes.length) return [];
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 5, 20));
  const run = (prefix) => {
    if (searchContext) {
      return database.prepare(`
        SELECT
          e.entry_id,
          e.entry_type,
          e.refine_required,
          e.rank_weight,
          e.unit,
          p.prefix AS key_text,
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
        ORDER BY
          e.rank_weight DESC,
          ((a.lat - ?) * (a.lat - ?) + (a.lon - ?) * (a.lon - ?)),
          LENGTH(a.label),
          a.label
        LIMIT ?
      `).all(
        prefix,
        searchContext.nearLat,
        searchContext.nearLat,
        searchContext.nearLon,
        searchContext.nearLon,
        cappedLimit,
      );
    }
    return database.prepare(`
      SELECT
        e.entry_id,
        e.entry_type,
        e.refine_required,
        e.rank_weight,
        e.unit,
        p.prefix AS key_text,
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
      ORDER BY e.rank_weight DESC, LENGTH(a.label), a.label
      LIMIT ?
    `).all(prefix, cappedLimit);
  };
  for (const prefix of [...new Set(prefixes)]) {
    const rows = run(prefix);
    if (rows.length) return rows;
  }
  return [];
}

function materialisedPrefixesForNeedle(needle, minPrefixLength = 4) {
  const text = normaliseAddressText(needle);
  const prefixes = [15, 12, 8, 4]
    .filter((length) => text.length >= length)
    .map((length) => text.slice(0, length))
    .filter((prefix) => prefix.length >= minPrefixLength);
  return [...new Set(prefixes)];
}

function materialisedTokenBoundaryPrefixesForNeedle(needle, minPrefixLength = 4) {
  const text = normaliseAddressText(needle);
  if (!text || text.length < minPrefixLength) return [];
  return [text, `${text} `]
    .filter((prefix) => prefix.length >= minPrefixLength);
}

function searchSqliteTypeaheadEntries(database, needle, limit, searchContext = null) {
  const terms = normaliseAddressText(needle).split(/\s+/).filter(Boolean).slice(0, 8);
  if (!terms.length) return [];
  const ftsQuery = terms.map((term) => `${escapeFtsTerm(term)}*`).join(" ");
  const contextOrder = searchContext
    ? `((a.lat - ?) * (a.lat - ?) + (a.lon - ?) * (a.lon - ?)),`
    : "";
  const params = searchContext
    ? [
        ftsQuery,
        needle,
        `${needle}%`,
        `% ${needle}%`,
        searchContext.nearLat,
        searchContext.nearLat,
        searchContext.nearLon,
        searchContext.nearLon,
        Math.max(1, Math.min(Number(limit) || 5, 20)),
      ]
    : [
        ftsQuery,
        needle,
        `${needle}%`,
        `% ${needle}%`,
        Math.max(1, Math.min(Number(limit) || 5, 20)),
      ];
  return database.prepare(`
    SELECT
      e.entry_id,
      e.entry_type,
      e.refine_required,
      e.rank_weight,
      f.key_text,
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
        WHEN f.key_text = ? THEN 0
        WHEN f.key_text LIKE ? THEN 1
        WHEN f.key_text LIKE ? THEN 2
        ELSE 3
      END,
      e.rank_weight DESC,
      ${contextOrder}
      rank,
      LENGTH(a.label),
      a.label
    LIMIT ?
  `).all(...params);
}

function searchSqliteExactUnitEntries(database, needle, limit) {
  if (!sqliteIndexExists(database, "address_typeahead_base_unit_idx")) return [];
  const refinement = exactUnitRefinementNeedle(needle);
  if (!refinement) return [];
  return searchSqliteExactUnitEntriesForBases(database, [refinement.baseSignature], refinement.unit, limit);
}

function searchSqliteBuildingUnitEntries(database, needle, limit, searchContext = null) {
  if (!sqliteIndexExists(database, "address_typeahead_base_unit_idx")) return [];
  const refinement = buildingUnitRefinementNeedle(needle);
  if (!refinement) return [];
  const prefixRows = searchSqlitePrefixEntries(database, refinement.buildingNeedle, Math.max(limit, 10), searchContext, {
    minPrefixLength: 8,
  }).filter((row) => row.entry_type === "base_refine" && row.base_signature);
  if (!prefixRows.length) return [];
  const signatures = new Set(prefixRows.map((row) => row.base_signature).filter(Boolean));
  if (signatures.size > 1 && !shouldUseContextualAmbiguousPrefixRows(needle, searchContext)) return [];
  return searchSqliteExactUnitEntriesForBases(database, [...signatures], refinement.unit, limit);
}

function searchSqliteBuildingUnitRefineEntries(database, needle, limit, searchContext = null) {
  const refinement = buildingUnitBareRefinementNeedle(needle);
  if (!refinement) return [];
  return searchSqliteBaseRefinePrefixEntries(database, refinement.buildingNeedle, limit, searchContext);
}

function searchSqliteBaseRefinePrefixEntries(database, needle, limit, searchContext = null) {
  const prefixes = materialisedPrefixesForNeedle(needle, 8);
  if (!prefixes.length) return [];
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 5, 20));
  const run = (prefix) => {
    if (searchContext) {
      return database.prepare(`
        SELECT
          e.entry_id,
          e.entry_type,
          e.refine_required,
          e.rank_weight,
          p.prefix AS key_text,
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
        WHERE p.prefix = ? AND e.entry_type = 'base_refine'
        ORDER BY
          e.rank_weight DESC,
          ((a.lat - ?) * (a.lat - ?) + (a.lon - ?) * (a.lon - ?)),
          LENGTH(a.label),
          a.label
        LIMIT ?
      `).all(
        prefix,
        searchContext.nearLat,
        searchContext.nearLat,
        searchContext.nearLon,
        searchContext.nearLon,
        cappedLimit,
      );
    }
    return database.prepare(`
      SELECT
        e.entry_id,
        e.entry_type,
        e.refine_required,
        e.rank_weight,
        p.prefix AS key_text,
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
      WHERE p.prefix = ? AND e.entry_type = 'base_refine'
      ORDER BY e.rank_weight DESC, LENGTH(a.label), a.label
      LIMIT ?
    `).all(prefix, cappedLimit);
  };
  for (const prefix of prefixes) {
    const rows = run(prefix);
    if (rows.length) return rows;
  }
  return [];
}

function searchSqliteExactUnitEntriesForBases(database, baseSignatures, unit, limit) {
  const rows = [];
  const seen = new Set();
  const statement = database.prepare(`
    SELECT
      e.entry_id,
      e.entry_type,
      e.refine_required,
      e.rank_weight,
      e.base_signature AS key_text,
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
    FROM address_typeahead_entries e
    JOIN addresses a ON a.id = e.address_id
    WHERE e.base_signature = ?
      AND e.unit = ?
      AND e.entry_type = 'exact'
      AND e.unit <> ''
    ORDER BY e.rank_weight DESC, LENGTH(a.label), a.label
    LIMIT ?
  `);
  for (const baseSignature of baseSignatures) {
    for (const row of statement.all(baseSignature, unit, Math.max(1, Math.min(Number(limit) || 5, 20)))) {
      const key = row.address_id || row.entry_id;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

function exactUnitRefinementNeedle(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  const unitIndex = tokens.findIndex((token, index) => SQLITE_UNIT_TERMS.has(token) && normalisedUnitNumberToken(tokens[index + 1]));
  if (unitIndex < 0) return null;
  const unitNumber = normalisedUnitNumberToken(tokens[unitIndex + 1]);
  const lotIndex = tokens.findIndex((token, index) =>
    index > unitIndex + 1 &&
    token === "lot" &&
    normalisedUnitNumberToken(tokens[index + 1]),
  );
  const houseIndex = lotIndex >= 0
    ? lotIndex
    : firstStreetNumberIndexAfterUnit(tokens, unitIndex + 2);
  if (houseIndex < 0) return null;
  const baseSignature = tokens.slice(houseIndex).join(" ");
  if (significantAddressTokens(baseSignature).length < 3) return null;
  return {
    unit: `${tokens[unitIndex]} ${unitNumber}`,
    baseSignature,
  };
}

function buildingUnitRefinementNeedle(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  const unitIndex = tokens.findIndex((token, index) => index > 0 && SQLITE_UNIT_TERMS.has(token) && normalisedUnitNumberToken(tokens[index + 1]));
  if (unitIndex < 0) return null;
  const buildingNeedle = tokens.slice(0, unitIndex).join(" ");
  if (buildingNeedle.length < 8) return null;
  return {
    unit: `${tokens[unitIndex]} ${normalisedUnitNumberToken(tokens[unitIndex + 1])}`,
    buildingNeedle,
  };
}

function buildingUnitBareRefinementNeedle(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  const unitIndex = tokens.findIndex((token, index) => index > 0 && isBareUnitRefineTermOrPrefix(token));
  if (unitIndex < 0) return null;
  const buildingNeedle = tokens.slice(0, unitIndex).join(" ");
  if (buildingNeedle.length < 8) return null;
  return { buildingNeedle };
}

function firstStreetNumberIndexAfterUnit(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    if (SQLITE_LEVEL_MARKER_TERMS.has(tokens[index]) && normalisedUnitNumberToken(tokens[index + 1])) {
      index += 1;
      continue;
    }
    if (normalisedAddressNumberToken(tokens[index])) return index;
  }
  return -1;
}

function normalisedUnitNumberToken(value) {
  const match = String(value || "").toLowerCase().match(/^[a-z0-9-]+$/);
  return match ? match[0] : "";
}

function normalisedAddressNumberToken(value) {
  const match = String(value || "").toLowerCase().match(/^(?:lot\s*)?[a-z]?\d+[a-z]?(?:-\d+[a-z]?)?$/);
  return match ? match[0] : "";
}

function queryStartsWithLotLikeToken(needle) {
  const text = normaliseAddressText(needle);
  return /^lot\s+[a-z0-9-]+(?:\s|$)/.test(text) || /^l\d+[a-z]?(?:\s|$)/.test(text);
}

function embeddedNumberFirstAddressCoreNeedle(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  for (let index = 1; index < tokens.length - 2; index += 1) {
    if (!normalisedAddressNumberToken(tokens[index])) continue;
    const candidate = tokens.slice(index).join(" ");
    if (shouldSearchLargeSqliteIndex(candidate)) return candidate;
  }
  return "";
}

function embeddedUnitAddressCoreNeedle(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  for (let index = 1; index < tokens.length - 3; index += 1) {
    if (!SQLITE_UNIT_TERMS.has(tokens[index]) || !normalisedUnitNumberToken(tokens[index + 1])) continue;
    const candidate = tokens.slice(index).join(" ");
    if (unitLikeQueryReadyForTypeahead(candidate)) return candidate;
  }
  return "";
}

function prefixRowsAmbiguous(rows) {
  const strongRows = rows.filter((row) => Number(row.rank_weight || 0) >= 980);
  const candidateRows = strongRows.length ? strongRows : rows;
  const signatures = new Set(candidateRows.map((row) => row.base_signature).filter(Boolean));
  return signatures.size > 1;
}

function shouldUseContextualAmbiguousPrefixRows(needle, searchContext) {
  if (!searchContext) return false;
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  if (!tokens.some((token) => /^\d+[a-z]?(?:-\d+[a-z]?)?$/.test(token))) return false;
  const alphaTokens = tokens.filter((token) =>
    /[a-z]/.test(token) &&
    !SQLITE_UNIT_TERMS.has(token) &&
    !SQLITE_STREET_TYPE_TERMS.has(token) &&
    !isStateCode(token),
  );
  return alphaTokens.some((token) => token.length >= 2);
}

function preferExactUnitPrefixRows(rows) {
  return [...rows].sort((left, right) =>
    (left.entry_type === "exact" ? 0 : 1) - (right.entry_type === "exact" ? 0 : 1) ||
    Number(right.rank_weight || 0) - Number(left.rank_weight || 0) ||
    String(left.address_label || "").length - String(right.address_label || "").length ||
    String(left.address_label || "").localeCompare(String(right.address_label || "")),
  );
}

function hybridRowToAddressRecord(row) {
  const isRefine = row.entry_type === "base_refine";
  const refineSubtitle = refineDisplaySubtitle(row);
  const entryLabel = [row.entry_display_title, refineSubtitle].filter(Boolean).join(", ");
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
    display_subtitle: isRefine ? refineSubtitle : row.entry_display_subtitle || row.address_display_subtitle,
    suggestion_type: isRefine ? "base_address" : "exact_address",
    refine_required: row.refine_required,
    refine_hint: Number(row.refine_required || 0) ? "Choose or type the exact unit before routing." : "",
  };
}

function refineDisplaySubtitle(row) {
  const entrySubtitle = String(row?.entry_display_subtitle || "");
  if (hasStreetLikeText(row?.entry_display_title)) return entrySubtitle;
  if (hasStreetLikeText(entrySubtitle)) return entrySubtitle;
  return String(row?.address_display_subtitle || entrySubtitle);
}

function hasStreetLikeText(value) {
  return /\b\d+[a-z]?(?:-\d+[a-z]?)?\s+.+\b(street|road|avenue|drive|highway|terrace|circuit|way|lane|place|court|crescent|boulevard|parade|parkway|esplanade|square)\b/i.test(String(value || ""));
}

function hybridMatchType(row, needle) {
  if (Number(row.refine_required || 0)) return "building_refine";
  const key = normaliseAddressText(row.key_text);
  const label = normaliseAddressText(row.address_label);
  if (key === needle || label === needle) return "exact_address";
  if (key.startsWith(needle) || needle.startsWith(key) || label.startsWith(needle)) return "address_prefix";
  return "address_token_overlap";
}

function queryLeadingHouseNumber(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  if (SQLITE_UNIT_TERMS.has(tokens[0])) return "";
  return normalisedHouseNumberToken(tokens[0]);
}

function queryLeadingUnitSlashNumbers(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  if (!/^\d+$/.test(tokens[0] || "")) return null;
  const houseNumber = normalisedHouseNumberToken(tokens[1]);
  if (!houseNumber) return null;
  return { unitNumber: normalisedHouseNumberToken(tokens[0]), houseNumber };
}

function queryLeadingHouseNumberFromLabel(label) {
  for (const part of String(label || "").split(",")) {
    const partTokens = normaliseAddressText(part).split(/\s+/).filter(Boolean);
    if (!partTokens.length) continue;
    if (SQLITE_UNIT_TERMS.has(partTokens[0])) continue;
    const houseNumber = normalisedHouseNumberToken(partTokens[0]);
    if (houseNumber) return houseNumber;
  }
  return "";
}

function labelHouseNumber(label) {
  return queryLeadingHouseNumberFromLabel(label);
}

function labelUnitAndHouseMatch(label, unitSlash) {
  const unitNumber = labelLeadingUnitNumber(label);
  const houseNumber = labelHouseNumber(label);
  return Boolean(
    unitNumber &&
      houseNumber &&
      houseNumbersCompatible(unitSlash.unitNumber, unitNumber) &&
      houseNumbersCompatible(unitSlash.houseNumber, houseNumber),
  );
}

function labelLeadingUnitNumber(label) {
  const parts = String(label || "").split(",").map((part) => part.trim());
  for (const part of parts) {
    const tokens = normaliseAddressText(part).split(/\s+/).filter(Boolean);
    if (!SQLITE_UNIT_TERMS.has(tokens[0])) continue;
    const unitNumber = normalisedHouseNumberToken(tokens[1]);
    if (unitNumber) return unitNumber;
  }
  return "";
}

function normalisedHouseNumberToken(value) {
  const match = String(value || "").toLowerCase().match(/^(\d+)([a-z]?)$/);
  if (!match) return "";
  return `${match[1]}${match[2] || ""}`;
}

function houseNumbersCompatible(queryNumber, rowNumber) {
  const query = String(queryNumber || "");
  const row = String(rowNumber || "");
  if (!query || !row) return true;
  if (query === row) return true;
  const queryParts = query.match(/^(\d+)([a-z]?)$/);
  const rowParts = row.match(/^(\d+)([a-z]?)$/);
  if (!queryParts || !rowParts) return false;
  if (queryParts[2]) return false;
  return queryParts[1] === rowParts[1];
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

function sqliteIndexExists(database, indexName) {
  const cacheKey = `${configuredSqlitePath()}:${indexName}`;
  if (!sqliteIndexExists.cache) sqliteIndexExists.cache = new Map();
  if (sqliteIndexExists.cache.has(cacheKey)) return sqliteIndexExists.cache.get(cacheKey);
  const row = database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(indexName);
  const exists = Boolean(row?.name);
  sqliteIndexExists.cache.set(cacheKey, exists);
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

const SQLITE_UNIT_TERMS = new Set(["apartment", "apt", "flat", "level", "lvl", "office", "offc", "shop", "site", "suite", "townhouse", "unit"]);
const SQLITE_BARE_UNIT_REFINE_TERMS = new Set(["apartment", "apt", "flat", "level", "lvl", "shop", "suite", "townhouse", "unit"]);
const SQLITE_LEVEL_MARKER_TERMS = new Set(["fl", "floor", "l", "level", "lvl"]);
const SQLITE_STREET_TYPE_TERMS = new Set([
  "avenue",
  "boulevard",
  "circuit",
  "close",
  "court",
  "crescent",
  "drive",
  "esplanade",
  "highway",
  "lane",
  "parade",
  "parkway",
  "place",
  "road",
  "square",
  "street",
  "terrace",
  "way",
]);

function queryContainsUnitLikeToken(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  return tokens.some((token, index) => isQueryUnitLikeToken(token, index, tokens));
}

function unitLikeQueryReadyForTypeahead(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  return tokens.some((token) =>
    !SQLITE_UNIT_TERMS.has(token) &&
    !SQLITE_STREET_TYPE_TERMS.has(token) &&
    !/^\d+[a-z]?$/.test(token) &&
    token.length >= 2,
  );
}

function unitLikeRangeQueryReadyForExactPrefix(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  const unitIndex = tokens.findIndex((token, index) => SQLITE_UNIT_TERMS.has(token) && normalisedUnitNumberToken(tokens[index + 1]));
  if (unitIndex < 0) return false;
  const numberTokens = tokens
    .slice(unitIndex + 2)
    .filter((token) => normalisedAddressNumberToken(token));
  return numberTokens.length >= 2;
}

function isQueryUnitLikeToken(token, index, tokens) {
  if (token === "office" || token === "offc") {
    return index === 0 || Boolean(normalisedUnitNumberToken(tokens[index + 1]));
  }
  return SQLITE_UNIT_TERMS.has(token) || isBareUnitRefineTermPrefix(token);
}

function isBareUnitRefineTermOrPrefix(token) {
  return SQLITE_BARE_UNIT_REFINE_TERMS.has(token) || isBareUnitRefineTermPrefix(token);
}

function isBareUnitRefineTermPrefix(token) {
  const value = String(token || "");
  return value.length >= 2 && [...SQLITE_BARE_UNIT_REFINE_TERMS].some((term) => term.startsWith(value));
}

function unitLikeQueryStartsWithUnitToken(needle) {
  const [firstToken] = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  return SQLITE_UNIT_TERMS.has(firstToken);
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
  const unitSlash = queryLeadingUnitSlashNumbers(needle);
  if (unitSlash && labelUnitAndHouseMatch(row?.label || row?.search_text || "", unitSlash)) return true;
  const queryHouseNumber = queryLeadingHouseNumber(needle);
  if (queryHouseNumber) {
    const rowHouseNumber = labelHouseNumber(row?.label || row?.search_text || "");
    if (rowHouseNumber && !houseNumbersCompatible(queryHouseNumber, rowHouseNumber)) return false;
  }
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
