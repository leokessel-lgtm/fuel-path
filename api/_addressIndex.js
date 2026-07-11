const { createAddressRanking } = require("./_addressRanking");
const { normaliseAddressText, normaliseSearchContext } = require("./_addressQuery");
const { createAddressStorageAdapters } = require("./_addressStorageAdapters");

const { addressIndexRank, scoreRecord, significantAddressTokens } = createAddressRanking({ normaliseAddressText });
const {
  configuredApiUrl,
  configuredPostgresUrl,
  configuredSqlitePath,
  defaultSeedPath: DEFAULT_SEED_PATH,
  fetchApiSuggestions,
  loadSeedRecords,
  openSqliteIndex,
  postgresClient,
} = createAddressStorageAdapters();

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

async function searchAddressIndex(query, limit = 5, options = {}) {
  const rawQuery = String(query || "");
  const needle = normaliseAddressText(query);
  if (needle.length < 4) return [];
  const needles = addressSearchNeedles(rawQuery);
  const searchContext = normaliseSearchContext(options.searchContext);

  if (configuredApiUrl()) {
    const apiResults = await searchApiNeedles(apiAddressSearchNeedles(rawQuery, needles), limit, rawQuery);
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
    const sqliteResults = filterLeadingUnitSlashAddressSuggestions(
      searchSqliteNeedles(needles, limit, searchContext, rawQuery),
      needle,
      rawQuery,
    );
    if (sqliteResults.length) return sqliteResults;
  }

  return mergeAddressSuggestions(needles.map((item) => searchSeedIndex(item.needle, limit)), limit);
}

function filterLeadingUnitSlashAddressSuggestions(suggestions, needle, rawNeedle = null) {
  const queryUnitIntent = queryLeadingUnitIntent(needle, rawNeedle);
  if (!queryUnitIntent?.unitNumber) return suggestions;
  const targetUnit = normalisedHouseNumberToken(queryUnitIntent.unitNumber);
  const targetHouse = normalisedHouseNumberToken(queryUnitIntent.houseNumber || "");
  if (!targetUnit) return suggestions;

  const filtered = [];
  for (const suggestion of suggestions) {
    if (suggestion.provider !== "fuel_path_gnaf" || suggestion.type !== "address") {
      filtered.push(suggestion);
      continue;
    }
    const tokens = normaliseAddressText(suggestion.label).split(/\s+/).filter(Boolean);
    const unitIndex = tokens.findIndex((token, index) =>
      SQLITE_UNIT_TERMS.has(token) && normalisedHouseNumberToken(tokens[index + 1]) === targetUnit,
    );
    if (unitIndex < 0) continue;
    if (!targetHouse) {
      filtered.push(suggestion);
      continue;
    }
    const hasTargetHouse = tokens.some((token, index) => {
      if (index === unitIndex + 1) return false;
      const rowHouse = normalisedHouseNumberToken(token);
      return rowHouse && houseNumbersCompatible(targetHouse, rowHouse);
    });
    if (hasTargetHouse) filtered.push(suggestion);
  }
  return filtered;
}

function searchSqliteNeedles(needles, limit, searchContext, rawNeedle = "") {
  const primaryNeedle = needles[0]?.needle || "";
  const primaryRawNeedle = needles[0]?.rawNeedle || "";
  const groups = [];
  for (const item of needles) {
    const rows = searchSqliteIndex(item.needle, limit, searchContext, item.rawNeedle || primaryRawNeedle);
    groups.push(rows);
    const merged = collapseAmbiguousUnitHouseResults(mergeAddressSuggestions(groups, limit), primaryNeedle, primaryRawNeedle);
    if (shouldStopSqliteNeedleSearch(merged, item.needle, limit, item.rawNeedle || rawNeedle || primaryRawNeedle)) return merged;
  }
  return collapseAmbiguousUnitHouseResults(mergeAddressSuggestions(groups, limit), primaryNeedle, primaryRawNeedle);
}

async function searchApiNeedles(needles, limit, rawNeedle = "") {
  const groups = [];
  for (const item of needles) {
    const rows = await searchApiIndex(item.rawQuery, item.needle, limit);
    groups.push(rows);
    const merged = mergeAddressSuggestions(groups, limit);
    if (rows.length) return merged;
    if (shouldStopApiNeedleSearch(merged, item.needle, limit, item.rawNeedle || rawNeedle)) return merged;
  }
  return mergeAddressSuggestions(groups, limit);
}

function apiAddressSearchNeedles(rawQuery, needles) {
  const rawNeedle = normaliseAddressText(rawQuery);
  if (!rawNeedle) return needles;
  const seen = new Set();
  return [
    { needle: rawNeedle, rawQuery: String(rawQuery || ""), rawNeedle: String(rawQuery || "") },
    ...needles,
  ].filter((item) => {
    if (!item?.needle || item.needle.length < 4 || seen.has(item.needle)) return false;
    seen.add(item.needle);
    return true;
  });
}

function shouldStopApiNeedleSearch(results, needle, limit, rawNeedle = null) {
  const top = results[0];
  if (!top) return false;
  if (queryHasUnitBuildingIntent(needle, rawNeedle) && top.matchType !== "exact_address") return false;
  if (top.matchType === "exact_address" && !top.refineRequired) return true;
  return results.length >= limit && top.matchType === "address_prefix";
}

function collapseAmbiguousUnitHouseResults(suggestions, primaryNeedle, rawNeedle = null) {
  const queryUnitIntent = queryLeadingUnitIntent(primaryNeedle, rawNeedle);
  if (!queryUnitIntent?.unitNumber || !queryUnitIntent?.houseNumber) return suggestions;
  return suggestions.filter((suggestion) => {
    if (!Number(suggestion.refineRequired || 0)) return true;
    if (suggestion.suggestionType === "base_address") return false;
    return suggestion.type !== "building";
  });
}

function shouldStopSqliteNeedleSearch(results, needle, limit, rawNeedle = null) {
  const top = results[0];
  if (!top) return false;
  if (queryHasUnitBuildingIntent(needle, rawNeedle) && !canStopUnitLikeNeedle(top)) return false;
  if (results.length >= limit) {
    return top.suggestionType === "exact_address" && !top.refineRequired && top.matchType === "exact_address";
  }
  if (top.suggestionType !== "exact_address" || top.refineRequired === true) return false;
  return shouldSearchLargeSqliteIndex(needle);
}

function canStopUnitLikeNeedle(top) {
  return top.suggestionType === "exact_address" && !top.refineRequired && top.matchType === "exact_address";
}

async function searchApiIndex(rawQuery, needle, limit) {
  const rows = await fetchApiSuggestions(rawQuery, limit);
  return rows
    .map((row) => addressRecordToSuggestion(row, row.matchType || apiMatchType(row, needle), Number(row.score || 950)))
    .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon));
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
      .filter(({ row, matchType }) => addressMatchQualityPass(row, needle, matchType, rawNeedle))
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

function searchSqliteIndex(needle, limit, searchContext = null, rawNeedle = null) {
  const database = openSqliteIndex();
  if (!database) return [];
  const sqlitePath = configuredSqlitePath();
  if (sqliteHybridIndexAvailable(database)) {
    const hybridResults = searchSqliteHybridIndex(database, needle, limit, searchContext, rawNeedle);
    if (hybridResults.length) return hybridResults;
  }
  if (isLargeSqliteIndex(sqlitePath) && !shouldSearchLargeSqliteIndex(needle)) return [];

  const terms = sqliteFtsTermsForNeedle(needle);
  if (!terms.length) return [];
  const ftsTable = sqliteTableExists(database, "address_fts")
    ? "address_fts"
    : sqliteTableExists(database, "address_typeahead_fts")
      ? "address_typeahead_fts"
      : "";
  if (!ftsTable) return [];

  try {
    const ftsQuery = terms.map((term) => `${escapeFtsTerm(term)}*`).join(" ");
    const expandedLimit = Math.max(Math.min(Number(limit) || 5, 20) * 8, 40);
    const statement = database.prepare(`
      SELECT ${sqliteAddressSelect(database)}
      FROM ${ftsTable}
      WHERE ${ftsTable} MATCH ?
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
      const fallbackSearchColumn = sqliteSchemaColumns(database, "addresses").has("search_text") ? "search_text" : "label";
      const statement = database.prepare(`
        SELECT ${sqliteAddressSelect(database)}
        FROM addresses
        WHERE ${fallbackSearchColumn} LIKE ?
        ORDER BY LENGTH(label)
        LIMIT ?
      `);
      return statement
        .all(`%${needle}%`, limit)
        .map((row) => ({ row, matchType: sqliteMatchType(row, needle) }))
        .filter(({ row, matchType }) => addressMatchQualityPass(row, needle, matchType, rawNeedle))
        .sort((left, right) => addressIndexRank(right, needle) - addressIndexRank(left, needle) || left.row.label.length - right.row.label.length)
        .map(({ row, matchType }) => addressRecordToSuggestion(row, matchType, addressIndexRank({ row, matchType }, needle)));
    } catch {
      return [];
    }
  }
}

function searchSqliteHybridIndex(database, needle, limit, searchContext = null, rawNeedle = null) {
  const leadingUnitSlash = queryLeadingUnitSlashNumbers(needle, rawNeedle);
  if (queryContainsUnitLikeToken(needle) || leadingUnitSlash) {
    const unitLotIntent = queryUnitLotIntent(needle);
    const unitRangePrefixReady = unitLikeRangeQueryReadyForExactPrefix(needle);
    const forceTypeaheadForUnitBuilding = shouldUseRebuiltTypeaheadForUnitOrBuildingQuery(needle, searchContext, rawNeedle);
    if (!unitLikeQueryReadyForTypeahead(needle) && !unitRangePrefixReady) return [];
    const exactUnitRows = searchSqliteExactUnitEntries(database, needle, limit);
    const safeExactUnitRows = filterRowsForUnitLotIntent(exactUnitRows, unitLotIntent);
    const safeExactUnitRowsForIntent = filterRowsForLeadingUnitSlashIntent(safeExactUnitRows, needle, rawNeedle);
    if (safeExactUnitRowsForIntent.length) return hybridRowsToSuggestions(safeExactUnitRowsForIntent, needle, 960, rawNeedle);
    if (unitLikeQueryStartsWithUnitToken(needle)) {
      if (unitRangePrefixReady && !unitLikeQueryReadyForTypeahead(needle)) {
        const exactPrefixRows = searchSqlitePrefixEntries(database, needle, limit, searchContext, {
          includeTokenBoundaryPrefix: true,
          minPrefixLength: 12,
        }, rawNeedle).filter((row) => row.entry_type === "exact" && row.unit);
        const safeExactPrefixRows = filterRowsForUnitLotIntent(exactPrefixRows, unitLotIntent);
        const safeExactPrefixRowsForIntent = filterRowsForLeadingUnitSlashIntent(safeExactPrefixRows, needle, rawNeedle);
        if (safeExactPrefixRowsForIntent.length && !forceTypeaheadForUnitBuilding && !prefixRowsAmbiguous(safeExactPrefixRowsForIntent)) {
          return hybridRowsToSuggestions(preferExactUnitPrefixRows(safeExactPrefixRowsForIntent), needle, 940, rawNeedle);
        }
        return [];
      }
      const prefixRows = searchSqlitePrefixEntries(database, needle, limit, searchContext, {}, rawNeedle);
      const useContextualPrefixRows = shouldUseContextualAmbiguousPrefixRows(needle, searchContext);
      const safePrefixRows = filterRowsForUnitLotIntent(prefixRows, unitLotIntent);
      const safePrefixRowsForIntent = filterRowsForLeadingUnitSlashIntent(safePrefixRows, needle, rawNeedle);
      if (safePrefixRowsForIntent.length &&
        !forceTypeaheadForUnitBuilding &&
        (!prefixRowsAmbiguous(safePrefixRowsForIntent) || useContextualPrefixRows)) {
        return hybridRowsToSuggestions(
          useContextualPrefixRows ? safePrefixRowsForIntent : preferExactUnitPrefixRows(safePrefixRowsForIntent),
          needle,
          930,
          rawNeedle,
        );
      }
      if (unitRangePrefixReady) {
        const exactPrefixRows = searchSqlitePrefixEntries(database, needle, limit, searchContext, {
          includeTokenBoundaryPrefix: true,
        }, rawNeedle).filter((row) => row.entry_type === "exact" && row.unit);
        const safeExactPrefixRows = filterRowsForUnitLotIntent(exactPrefixRows, unitLotIntent);
        const safeExactPrefixRowsForIntent = filterRowsForLeadingUnitSlashIntent(safeExactPrefixRows, needle, rawNeedle);
        if (safeExactPrefixRowsForIntent.length && !forceTypeaheadForUnitBuilding && !prefixRowsAmbiguous(safeExactPrefixRowsForIntent)) {
          return hybridRowsToSuggestions(preferExactUnitPrefixRows(safeExactPrefixRowsForIntent), needle, 940, rawNeedle);
        }
      }
    } else {
      const buildingUnitRows = searchSqliteBuildingUnitEntries(database, needle, limit, searchContext);
      const safeBuildingUnitRows = filterRowsForUnitLotIntent(buildingUnitRows, unitLotIntent);
      const safeBuildingUnitRowsForIntent = filterRowsForLeadingUnitSlashIntent(safeBuildingUnitRows, needle, rawNeedle);
      if (safeBuildingUnitRowsForIntent.length) return hybridRowsToSuggestions(safeBuildingUnitRowsForIntent, needle, 960, rawNeedle);
      const buildingUnitRefineRows = searchSqliteBuildingUnitRefineEntries(database, needle, limit, searchContext);
      const buildingUnitRefineRowsForIntent = filterRowsForLeadingUnitSlashIntent(buildingUnitRefineRows, needle, rawNeedle);
      if (buildingUnitRefineRowsForIntent.length) return hybridRowsToSuggestions(buildingUnitRefineRowsForIntent, needle, 940, rawNeedle);
      const embeddedUnitNeedle = embeddedUnitAddressCoreNeedle(needle);
      if (embeddedUnitNeedle) {
        const prefixRows = searchSqlitePrefixEntries(database, embeddedUnitNeedle, limit, searchContext, {
          minPrefixLength: 12,
        }, rawNeedle);
        const useContextualPrefixRows = shouldUseContextualAmbiguousPrefixRows(embeddedUnitNeedle, searchContext);
        const safePrefixRows = filterRowsForUnitLotIntent(prefixRows, unitLotIntent);
        const safePrefixRowsForIntent = filterRowsForLeadingUnitSlashIntent(safePrefixRows, needle, rawNeedle);
        if (safePrefixRowsForIntent.length &&
          !forceTypeaheadForUnitBuilding &&
          (!prefixRowsAmbiguous(safePrefixRowsForIntent) || useContextualPrefixRows)) {
          return hybridRowsToSuggestions(
            useContextualPrefixRows ? safePrefixRowsForIntent : preferExactUnitPrefixRows(safePrefixRowsForIntent),
            needle,
            930,
            rawNeedle,
          );
        }
      }
    }
    const typeaheadRows = searchSqliteTypeaheadEntries(database, needle, limit, searchContext, rawNeedle);
    const filteredTypeaheadRows = filterRowsForUnitLotIntent(typeaheadRows, unitLotIntent);
    return hybridRowsToSuggestions(
      filterRowsForLeadingUnitSlashIntent(filteredTypeaheadRows, needle, rawNeedle),
      needle,
      900,
      rawNeedle,
    );
  }
  if (!/^\d/.test(needle)) {
    if (queryStartsWithLotLikeToken(needle)) {
      const prefixRows = searchSqlitePrefixEntries(database, needle, limit, searchContext);
      if (prefixRows.length && (!prefixRowsAmbiguous(prefixRows) || shouldUseContextualAmbiguousPrefixRows(needle, searchContext))) {
        return hybridRowsToSuggestions(prefixRows, needle, 950, rawNeedle);
      }
    }
    const embeddedAddressCoreNeedle = embeddedNumberFirstAddressCoreNeedle(needle);
    if (embeddedAddressCoreNeedle) {
      const prefixRows = searchSqlitePrefixEntries(database, embeddedAddressCoreNeedle, limit, searchContext, {
        minPrefixLength: 8,
      }, rawNeedle);
      if (prefixRows.length && (!prefixRowsAmbiguous(prefixRows) || shouldUseContextualAmbiguousPrefixRows(embeddedAddressCoreNeedle, searchContext))) {
        return hybridRowsToSuggestions(prefixRows, needle, 950, rawNeedle);
      }
    }
    const typeaheadRows = searchSqliteTypeaheadEntries(database, needle, limit, searchContext, rawNeedle);
    return hybridRowsToSuggestions(typeaheadRows, needle, 900, rawNeedle);
  }
  const prefixRows = searchSqlitePrefixEntries(database, needle, limit, searchContext, {}, rawNeedle);
  if (prefixRows.length && (!prefixRowsAmbiguous(prefixRows) || shouldUseContextualAmbiguousPrefixRows(needle, searchContext))) {
    return hybridRowsToSuggestions(prefixRows, needle, 950, rawNeedle);
  }
  const typeaheadRows = searchSqliteTypeaheadEntries(database, needle, limit, searchContext, rawNeedle);
  return hybridRowsToSuggestions(typeaheadRows, needle, 900, rawNeedle);
}

function hybridRowsToSuggestions(rows, needle, fallbackScore = 900, rawNeedle = null) {
  const suggestions = [];
  const seen = new Set();
  for (const row of rows) {
    if (!hybridRowQualityPass(row, needle, rawNeedle)) continue;
    if (shouldSkipAmbiguousUnitStartExactRow(row, needle, rawNeedle)) continue;
    const record = hybridRowToAddressRecord(row);
    const suggestion = addressRecordToSuggestion(record, hybridMatchType(row, needle), Number(row.rank_weight || fallbackScore));
    const key = String(suggestion.providerId || suggestion.label);
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
  }
  return suggestions;
}

function shouldSkipAmbiguousUnitStartExactRow(row, needle, rawNeedle = null) {
  if (!queryHasUnitBuildingIntent(needle, rawNeedle)) return false;
  const queryUnitIntent = queryLeadingUnitIntent(needle, rawNeedle);
  const rowLabel = String(row?.address_label || row?.key_text || "");
  const entryType = String(row?.entry_type || row?.suggestion_type || "");
  if (queryUnitIntent?.unitNumber && queryUnitIntent?.houseNumber && entryType === "base_refine") {
    return true;
  }
  if (Number(row?.refine_required || 0)) {
    return Boolean(queryUnitIntent?.unitNumber);
  }
  if (entryType === "base_refine") return false;
  if (queryHasUnitBuildingIntent(needle, rawNeedle) && !isRowUnitContextCompatible(rowLabel, row?.unit || "", queryUnitIntent)) {
    return true;
  }
  if (queryUnitIntent) {
    const rowUnitText = String(row?.unit || "").trim();
    const rowUnitNumber = normalisedHouseNumberToken(rowUnitText || "");
    if (rowUnitNumber && queryUnitIntent.unitNumber && !houseNumbersCompatible(queryUnitIntent.unitNumber, rowUnitNumber)) {
      return true;
    }
    const rowLeadingUnit = labelLeadingUnitNumber(row?.address_label || row?.key_text || "");
    if (!rowLeadingUnit) {
      return true;
    }
    if (!houseNumbersCompatible(queryUnitIntent.unitNumber, rowLeadingUnit)) {
      return true;
    }
    if (queryUnitIntent.houseNumber && !houseNumbersCompatible(queryUnitIntent.houseNumber, labelHouseNumber(row?.address_label || row?.key_text || ""))) {
      return true;
    }
  }
  const specificIntent = queryUnitStartSpecificIntent(needle);
  if (specificIntent) {
    if (!detectQueryStateCode(needle) && !detectQueryPostcode(needle)) {
      const entryTypeForSpecificIntent = String(row?.entry_type || row?.suggestion_type || "");
      if (entryTypeForSpecificIntent === "base_refine" || entryTypeForSpecificIntent === "base_address" || entryTypeForSpecificIntent === "building") {
        return true;
      }
    }
  }
  const matchType = hybridMatchType(row, needle);
  if (matchType !== "exact_address" && matchType !== "address_prefix") return false;
  if (entryType === "building" || entryType === "base_address") return false;
  if (labelHasLeadingUnit(row?.address_label || row?.key_text || "") && !queryUnitIntent?.unitNumber) return true;
  return false;
}

function shouldUseRebuiltTypeaheadForUnitOrBuildingQuery(needle, searchContext = null, rawNeedle = null) {
  if (!queryHasUnitBuildingIntent(needle, rawNeedle)) return false;
  if (searchContext && Number.isFinite(searchContext.nearLat) && Number.isFinite(searchContext.nearLon)) return false;
  if (unitLikeRangeQueryReadyForExactPrefix(needle)) return false;
  return !queryHasExplicitLocationContext(needle);
}

function queryHasUnitBuildingIntent(needle, rawNeedle = null) {
  if (queryLeadingUnitSlashNumbers(needle, rawNeedle)) return true;
  return Boolean(queryLeadingUnitIntent(needle, rawNeedle));
}

function isRowUnitContextCompatible(rowLabel, rowUnitField, queryUnitIntent) {
  const normalizedRowLabel = normaliseAddressText(rowLabel);
  const rowUnitNumber = normalisedHouseNumberToken(String(rowUnitField || ""));
  if (queryUnitIntent?.unitNumber) {
    if (queryUnitIntent.houseNumber) {
      const rowHouseNumber = queryLeadingHouseNumberFromLabel(rowLabel);
      if (rowHouseNumber && !houseNumbersCompatible(queryUnitIntent.houseNumber, rowHouseNumber)) return false;
    }
    if (rowUnitNumber) {
      if (!houseNumbersCompatible(queryUnitIntent.unitNumber, rowUnitNumber)) return false;
      return true;
    }
    const rowLeadingUnit = labelLeadingUnitNumber(rowLabel || "");
    if (rowLeadingUnit && houseNumbersCompatible(queryUnitIntent.unitNumber, rowLeadingUnit)) return true;
    return false;
  }
  return normalizedRowLabel.includes(" unit ") || labelHasLeadingUnit(rowLabel);
}

function queryLeadingUnitIntent(needle, rawNeedle = null) {
  const leadingUnitSlash = queryLeadingUnitSlashNumbers(needle, rawNeedle);
  if (leadingUnitSlash) {
    return { unitNumber: leadingUnitSlash.unitNumber, houseNumber: leadingUnitSlash.houseNumber };
  }
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  if (!SQLITE_UNIT_TERMS.has(tokens[0])) return null;
  const unitNumber = normalisedUnitNumberToken(tokens[1]);
  if (!unitNumber) return null;
  if (tokens[0] === "site" && !/\d/.test(unitNumber)) return null;
  const houseNumberIndex = firstStreetNumberIndexAfterUnit(tokens, 2);
  const houseNumber = normalisedAddressNumberToken(houseNumberIndex > -1 ? tokens[houseNumberIndex] : "") || "";
  return { unitNumber, houseNumber };
}


function queryUnitStartSpecificIntent(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  const unitIndex = tokens.findIndex((token, index) => SQLITE_UNIT_TERMS.has(token) && normalisedUnitNumberToken(tokens[index + 1]));
  if (unitIndex < 0) return false;
  const afterUnit = tokens.slice(unitIndex + 2);
  if (!afterUnit.length) return false;
  const hasHouseNumber = normalisedAddressNumberToken(afterUnit[0]);
  if (!hasHouseNumber) return false;
  return afterUnit.some((token) => {
    return token.length >= 2 &&
      !normalisedAddressNumberToken(token) &&
      !SQLITE_UNIT_TERMS.has(token) &&
      !isStateCode(token) &&
      !/^(?:nsw|act|qld|vic|wa|sa|tas|nt)$/.test(token) &&
      !SQLITE_STREET_TYPE_TERMS.has(token);
  });
}

function labelHasLeadingUnit(label) {
  const text = String(label || "").trim();
  if (!text) return false;
  const tokens = normaliseAddressText(text).split(/\s+/).filter(Boolean);
  return SQLITE_UNIT_TERMS.has(tokens[0]);
}

function prioritizeUnitIntentRows(rows, unitIntent, needle = "") {
  if (!unitIntent || !rows.length) return rows;
  const unitNeedle = normaliseAddressText(unitIntent.unitNumber || "");
  const houseNeedle = normaliseAddressText(unitIntent.houseNumber || "");
  const queryText = normaliseAddressText(needle);
  return [...rows].sort((left, right) => {
    const leftScore = unitIntentRowScore(left, unitNeedle, houseNeedle, queryText);
    const rightScore = unitIntentRowScore(right, unitNeedle, houseNeedle, queryText);
    if (leftScore !== rightScore) return rightScore - leftScore;
    return Number(right.rank_weight || 0) - Number(left.rank_weight || 0) || String(left.address_label || left.key_text || "").length - String(right.address_label || right.key_text || "").length;
  });
}

function unitIntentRowScore(row, unitNeedle, houseNeedle, queryText) {
  let score = 0;
  const addressLabel = normaliseAddressText(row?.address_label || row?.key_text || row?.search_text || "");
  const rowUnit = normalisedUnitNumberToken(String(row?.unit || ""));
  const rowHouse = normalisedHouseNumberToken(labelHouseNumber(addressLabel));
  if (unitNeedle) {
    if (rowUnit) {
      score += houseNumbersCompatible(unitNeedle, rowUnit) ? 600 : -220;
    } else if (labelHasLeadingUnit(addressLabel)) {
      score += 20;
    } else {
      score -= 180;
    }
  }
  if (houseNeedle) {
    if (rowHouse) {
      score += houseNumbersCompatible(houseNeedle, rowHouse) ? 360 : -140;
    } else if (isRowUnitContextCompatible(addressLabel, row?.unit || "", { unitNumber: unitNeedle, houseNumber: houseNeedle })) {
      score += 80;
    }
  }
  if (queryText && addressLabel.includes(queryText)) {
    score += 30;
  }
  return score;
}

function hybridRowQualityPass(row, needle, rawNeedle = null) {
  const queryState = detectQueryStateCode(needle);
  const rowState = String(row?.state || "").toUpperCase();
  if (queryState && rowState && queryState !== rowState) return false;
  const queryPostcode = detectQueryPostcode(needle);
  if (queryPostcode && String(row?.postcode || "") && String(row.postcode) !== queryPostcode) return false;
  const queryLocality = detectAddressLocality(needle);
  const rowLocality = normaliseAddressText(row?.locality || "");
  if (queryLocality && rowLocality && !localityTokenMatch(queryLocality, rowLocality)) return false;

  const unitSlash = queryLeadingUnitSlashNumbers(needle, rawNeedle);
  if (unitSlash && labelUnitAndHouseMatch(row?.address_label || row?.key_text || "", unitSlash)) return true;
  const queryHouseNumber = queryLeadingHouseNumber(needle, rawNeedle) || queryEmbeddedHouseNumber(needle);
  if (!queryHouseNumber) return true;
  const rowHouseNumber = labelHouseNumber(row?.address_label || row?.key_text || "");
  if (!rowHouseNumber) return true;
  return houseNumbersCompatible(queryHouseNumber, rowHouseNumber);
}

function searchSqlitePrefixEntries(database, needle, limit, searchContext = null, options = {}, rawNeedle = null) {
  const unitIntent = queryLeadingUnitIntent(needle, rawNeedle);
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
    const rows = prioritizeUnitIntentRows(run(prefix), unitIntent, needle);
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

function searchSqliteTypeaheadEntries(database, needle, limit, searchContext = null, rawNeedle = null) {
  const unitIntent = queryLeadingUnitIntent(needle, rawNeedle);
  const terms = queryContainsUnitLikeToken(needle)
    ? [...new Set(sqliteFtsTermsForNeedle(needle))]
    : normaliseAddressText(needle).split(/\s+/).filter(Boolean).slice(0, 8);
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
  const rows = database.prepare(`
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

  return prioritizeUnitIntentRows(rows, unitIntent, needle);
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

function queryLeadingHouseNumber(needle, rawNeedle = null) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  const unitSlashNumbers = queryLeadingUnitSlashNumbers(needle, rawNeedle);
  if (unitSlashNumbers) return unitSlashNumbers?.houseNumber || "";
  if (SQLITE_UNIT_TERMS.has(tokens[0])) return "";
  return normalisedHouseNumberToken(tokens[0]);
}

function queryLeadingHouseRange(needle, rawNeedle = null) {
  const source = String(rawNeedle || needle || "");
  const match = source.match(/^\s*(\d+\s*-\s*\d+)\b/i);
  if (!match) return null;
  return parseHouseRange(match[1]);
}

function queryEmbeddedHouseNumber(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  if (SQLITE_UNIT_TERMS.has(tokens[0])) return "";
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const previous = tokens[index - 1];
    if (
      previous &&
      (isStateCode(previous) || previous === "lot" || SQLITE_UNIT_TERMS.has(previous))
    ) {
      continue;
    }
    const numberToken = normalisedHouseNumberToken(token);
    if (!numberToken) continue;
    if (numberToken.length < 3) continue;
    if (/^\d{4}$/.test(numberToken)) continue;
    return numberToken;
  }
  return "";
}

function queryLeadingUnitSlashNumbers(needle, rawNeedle = null) {
  if (rawNeedle) {
    if (!/^\s*\d+[a-z]?\s*\/\s*\d+[a-z]?/i.test(String(rawNeedle || ""))) return null;
  }
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
    if (partTokens.length >= 3 && SQLITE_UNIT_TERMS.has(partTokens[0])) {
      if (/^\d+[a-z]?$/.test(partTokens[1]) && /^\d+[a-z]?$/.test(partTokens[2])) {
        return normalisedHouseNumberToken(partTokens[2]);
      }
      continue;
    }
    if (SQLITE_UNIT_TERMS.has(partTokens[0])) continue;
    const houseNumber = normalisedHouseNumberToken(partTokens[0]);
    if (houseNumber) return houseNumber;
  }
  return "";
}

function labelHouseNumber(label) {
  return queryLeadingHouseNumberFromLabel(label);
}

function labelHouseRange(label) {
  const rawLabel = String(label || "").trim();
  if (!rawLabel) return null;
  for (const part of rawLabel.split(",").map((value) => value.trim()).filter(Boolean)) {
    const match = part.match(/^\s*(\d+\s*-\s*\d+)\b/i);
    if (match) {
      const range = parseHouseRange(match[1]);
      if (range) return range;
    }
  }
  return null;
}

function parseHouseRange(value) {
  const match = String(value || "").match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (!match) return null;
  const from = Number.parseInt(match[1], 10);
  const to = Number.parseInt(match[2], 10);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return {
    from: Math.min(from, to),
    to: Math.max(from, to),
  };
}

function houseRangesOverlap(queryRange, rowRange) {
  return queryRange.from <= rowRange.to && rowRange.from <= queryRange.to;
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

const SQLITE_UNIT_TERMS = new Set(["apartment", "apt", "building", "duplex", "flat", "level", "lvl", "office", "offc", "shop", "site", "suite", "townhouse", "unit"]);
const SQLITE_BUILDING_ALIAS_TERMS = new Set(["building", "blg", "bldg", "suite", "ste"]);
const SQLITE_BARE_UNIT_REFINE_TERMS = new Set(["apartment", "apt", "building", "duplex", "flat", "level", "lvl", "shop", "suite", "townhouse", "unit"]);
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
const NON_LOCALITY_QUERY_SUFFIXES = new Set([
  "airport",
  "arena",
  "beach",
  "centre",
  "center",
  "hospital",
  "interchange",
  "mall",
  "market",
  "park",
  "parkland",
  "stadium",
  "station",
  "wharf",
  "zoo",
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

function queryUnitLotIntent(needle) {
  const tokens = normaliseAddressText(needle).split(/\s+/).filter(Boolean);
  const unitIndex = tokens.findIndex((token, index) => SQLITE_UNIT_TERMS.has(token) && normalisedUnitNumberToken(tokens[index + 1]));
  if (unitIndex < 0) return null;
  const lotIndex = tokens.findIndex((token, index) =>
    index > unitIndex + 1 &&
    token === "lot" &&
    normalisedUnitNumberToken(tokens[index + 1]),
  );
  if (lotIndex < 0) return null;
  return {
    unitNumber: normalisedUnitNumberToken(tokens[unitIndex + 1]),
    lotNumber: normalisedUnitNumberToken(tokens[lotIndex + 1]),
  };
}

function filterRowsForUnitLotIntent(rows, intent) {
  if (!intent) return rows;
  return rows.filter((row) => rowMatchesUnitLotIntent(row, intent));
}

function filterRowsForLeadingUnitSlashIntent(rows, needle, rawNeedle = null) {
  const queryUnitIntent = queryLeadingUnitIntent(needle, rawNeedle);
  if (!queryUnitIntent) return rows;
  if (!queryUnitIntent.unitNumber && !queryUnitIntent.houseNumber) return rows;
  return rows.filter((row) => isRowUnitContextCompatible(
    String(row?.address_label || row?.search_text || row?.key_text || ""),
    String(row?.unit || ""),
    queryUnitIntent,
  ));
}

function rowMatchesUnitLotIntent(row, intent) {
  const label = normaliseAddressText(row?.address_label || row?.label || "");
  if (!label.includes(`lot ${intent.lotNumber}`)) return false;
  const tokens = label.split(/\s+/).filter(Boolean);
  return tokens.some((token, index) => SQLITE_UNIT_TERMS.has(token) && normalisedUnitNumberToken(tokens[index + 1]) === intent.unitNumber);
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

function detectQueryPostcode(needle) {
  const tokens = String(needle || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.toUpperCase());
  let fallbackPostcode = "";
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const postcode = tokens[index].replace(/[^A-Z0-9]/g, "");
    if (!/^\d{4}$/.test(postcode)) continue;
    if (index > 0 && isStateCode(tokens[index - 1])) return postcode;
    fallbackPostcode = postcode;
  }
  return fallbackPostcode;
}

function queryHasExplicitLocationContext(needle) {
  if (detectQueryPostcode(needle)) return true;
  if (detectQueryStateCode(needle)) return true;
  return Boolean(detectAddressLocality(needle));
}

function addressMatchQualityPass(row, needle, matchType, rawNeedle = null) {
  if (["exact_address", "address_prefix"].includes(matchType)) return true;
  const unitSlash = queryLeadingUnitSlashNumbers(needle, rawNeedle);
  if (unitSlash && labelUnitAndHouseMatch(row?.label || row?.search_text || "", unitSlash)) return true;
  const queryHouseRange = queryLeadingHouseRange(needle, rawNeedle);
  if (queryHouseRange) {
    const rowHouseRange = labelHouseRange(row?.label || row?.search_text || "");
    if (rowHouseRange && !houseRangesOverlap(queryHouseRange, rowHouseRange)) return false;
  }
  const queryHouseNumber = queryLeadingHouseNumber(needle, rawNeedle) || queryEmbeddedHouseNumber(needle);
  if (queryHouseNumber) {
    const rowHouseNumber = labelHouseNumber(row?.label || row?.search_text || "");
    if (rowHouseNumber && !houseNumbersCompatible(queryHouseNumber, rowHouseNumber)) return false;
  }
  const queryState = detectQueryStateCode(needle);
  const rowState = String(row?.state || "").toUpperCase();
  if (queryState && rowState && queryState !== rowState) return false;
  const queryPostcode = detectQueryPostcode(needle);
  if (queryPostcode && String(row?.postcode || "") && String(row.postcode) !== queryPostcode) return false;
  const queryLocality = detectAddressLocality(needle);
  const rowLocality = normaliseAddressText(row?.locality || "");
  if (queryLocality && rowLocality && !localityTokenMatch(queryLocality, rowLocality)) return false;
  const queryTokens = significantAddressTokens(needle);
  if (queryTokens.length < 3) return true;
  const rowTokens = new Set(significantAddressTokens(`${row?.search_text || ""} ${row?.label || ""}`));
  const overlap = queryTokens.filter((token) => rowTokens.has(token)).length;
  const minimumOverlap = queryHouseRange && queryTokens.length <= 3 ? 2 : Math.min(3, queryTokens.length);
  return overlap >= minimumOverlap;
}

function detectAddressLocality(needle) {
  const text = String(needle || "").trim().replace(/\s+/g, " ");
  const streetMatch = /\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|terrace|highway|mall|court|close|vista|circuit|way|lane|ln)\b\s+(.+?)(?:\s+\b(NSW|ACT|QLD|WA|VIC|SA|TAS|NT)\b|\s*$)/i.exec(text);
  if (streetMatch?.[1]) {
    const locality = normaliseAddressText(streetMatch[1]);
    return NON_LOCALITY_QUERY_SUFFIXES.has(locality) ? "" : locality;
  }
  return "";
}

function localityTokenMatch(left, right) {
  return left === right || left.includes(right) || right.includes(left);
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
          : "Near address match",
    subtitle,
    suggestionType,
    title,
    type: refineRequired ? "building" : "address",
  };
}

function escapeFtsTerm(value) {
  return String(value).replace(/["']/g, " ").replace(/[^\p{L}\p{N}_-]+/gu, " ").trim();
}

function addressSearchNeedles(rawQuery) {
  const primary = normaliseLeadingUnitAliasNeedle(rawQuery);
  const leadingUnitSlashNeedles = queryHasLeadingUnitSlashNeedleVariants(primary, rawQuery);
  if (leadingUnitSlashNeedles.length && !queryUnitLotIntent(primary)) {
    const variants = [...leadingUnitSlashNeedles, ...complexAddressNeedles(primary), primary];
    const seen = new Set();
    return variants
      .map((needle) => normaliseAddressText(needle))
      .filter((needle) => {
        if (needle.length < 4 || seen.has(needle)) return false;
        seen.add(needle);
        return true;
      })
      .map((needle) => ({ needle, rawQuery: needle === primary ? String(rawQuery || "") : needle, rawNeedle: String(rawQuery || "") }));
}

function normaliseLeadingUnitAliasNeedle(rawQuery = "") {
  const tokens = normaliseAddressText(rawQuery).split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return tokens.join(" ");
  const [firstToken, secondToken] = tokens;
  if (!SQLITE_BUILDING_ALIAS_TERMS.has(firstToken) || !normalisedUnitNumberToken(secondToken)) return tokens.join(" ");
  tokens[0] = "unit";
  return tokens.join(" ");
}
  const variants = queryUnitLotIntent(primary)
    ? [primary, ...leadingUnitSlashNeedles]
    : [primary, ...leadingUnitSlashNeedles, ...complexAddressNeedles(primary)];
  const seen = new Set();
  return variants
    .map((needle) => normaliseAddressText(needle))
    .filter((needle) => {
      if (needle.length < 4 || seen.has(needle)) return false;
      seen.add(needle);
      return true;
    })
      .map((needle) => ({ needle, rawQuery: needle === primary ? String(rawQuery || "") : needle, rawNeedle: String(rawQuery || "") }));
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

function queryHasLeadingUnitSlashNeedleVariants(needle, rawNeedle = null) {
  const unitSlash = queryLeadingUnitSlashNumbers(needle, rawNeedle);
  if (!unitSlash) return [];
  const tokens = String(needle || "").split(/\s+/).filter(Boolean);
  const remainder = tokens.slice(2).join(" ");
  if (!remainder) return [];
  return [`unit ${unitSlash.unitNumber} ${unitSlash.houseNumber} ${remainder}`];
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
