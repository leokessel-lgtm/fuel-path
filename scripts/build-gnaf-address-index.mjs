#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";

const args = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(args.input || "prototype/data/gnaf-addresses.seed.json");
const outputPath = path.resolve(args.output || "prototype/data/gnaf-addresses.sqlite");
const limit = args.limit ? Number(args.limit) : 0;
const includeLegacyFts = !args.omitLegacyFts;
const includeSearchBackstop = includeLegacyFts || !args.omitSearchBackstop;
const SQLITE_LEVEL_MARKER_TERMS = new Set(["fl", "floor", "l", "level", "lvl"]);

if (!fs.existsSync(inputPath)) {
  throw new Error(`Input file does not exist: ${inputPath}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

const db = new DatabaseSync(outputPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE addresses (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    state TEXT,
    postcode TEXT,
    accuracy TEXT,
    locality TEXT,
    alias_principal TEXT,
    primary_secondary TEXT,
    geocode_type TEXT,
    display_title TEXT,
    display_subtitle TEXT,
    suggestion_type TEXT,
    refine_required INTEGER DEFAULT 0,
    refine_hint TEXT,
    base_key TEXT
    ${includeSearchBackstop ? `,
    search_key TEXT NOT NULL,
    search_text TEXT NOT NULL` : ""}
  ) WITHOUT ROWID;
  ${includeLegacyFts ? `CREATE VIRTUAL TABLE address_fts USING fts5(
    id UNINDEXED,
    label,
    state UNINDEXED,
    postcode UNINDEXED,
    accuracy UNINDEXED,
    locality UNINDEXED,
    alias_principal UNINDEXED,
    primary_secondary UNINDEXED,
    geocode_type UNINDEXED,
    display_title UNINDEXED,
    display_subtitle UNINDEXED,
    suggestion_type UNINDEXED,
    refine_required UNINDEXED,
    refine_hint UNINDEXED,
    base_key UNINDEXED,
    search_key,
    search_text,
    lat UNINDEXED,
    lon UNINDEXED
  );` : ""}
  CREATE TABLE address_typeahead_entries (
    entry_id TEXT PRIMARY KEY,
    address_id TEXT NOT NULL,
    display_title TEXT,
    display_subtitle TEXT,
    base_signature TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    refine_required INTEGER DEFAULT 0,
    unit TEXT,
    rank_weight INTEGER NOT NULL
  ) WITHOUT ROWID;
  CREATE INDEX address_typeahead_base_unit_idx
    ON address_typeahead_entries(base_signature, unit, rank_weight DESC)
    WHERE entry_type = 'exact' AND unit <> '';
  CREATE VIRTUAL TABLE address_typeahead_fts USING fts5(
    entry_id UNINDEXED,
    key_text,
    detail=column
  );
  CREATE TABLE address_prefix_entries (
    prefix TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    PRIMARY KEY (prefix, entry_id)
  ) WITHOUT ROWID;
`);

const insertAddress = db.prepare(`
  INSERT OR REPLACE INTO addresses (
    id, label, lat, lon, state, postcode, accuracy, locality, alias_principal, primary_secondary, geocode_type,
    display_title, display_subtitle, suggestion_type, refine_required, refine_hint, base_key
    ${includeSearchBackstop ? ", search_key, search_text" : ""}
  )
  VALUES (${Array.from({ length: includeSearchBackstop ? 19 : 17 }, () => "?").join(", ")})
`);
const insertFts = includeLegacyFts ? db.prepare(`
  INSERT INTO address_fts (
    id, label, state, postcode, accuracy, locality, alias_principal, primary_secondary, geocode_type,
    display_title, display_subtitle, suggestion_type, refine_required, refine_hint, base_key, search_key, search_text, lat, lon
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`) : null;
const insertTypeaheadEntry = db.prepare(`
  INSERT OR IGNORE INTO address_typeahead_entries (
    entry_id, address_id, display_title, display_subtitle,
    base_signature, entry_type, refine_required, unit, rank_weight
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertTypeaheadFts = db.prepare(`
  INSERT INTO address_typeahead_fts (
    entry_id, key_text
  )
  VALUES (?, ?)
`);
const insertPrefixEntry = db.prepare(`
  INSERT OR IGNORE INTO address_prefix_entries (prefix, entry_id)
  VALUES (?, ?)
`);

let count = 0;
const seenBaseRefineEntryIds = new Set();
db.exec("BEGIN");
for await (const record of readRecords(inputPath)) {
  const address = normaliseRecord(record, count);
  if (!address) continue;
  const addressValues = [
    address.id,
    address.label,
    address.lat,
    address.lon,
    address.state,
    address.postcode,
    address.accuracy,
    address.locality,
    address.aliasPrincipal,
    address.primarySecondary,
    address.geocodeType,
    address.displayTitle,
    address.displaySubtitle,
    address.suggestionType,
    address.refineRequired ? 1 : 0,
    address.refineHint,
    address.baseKey,
  ];
  if (includeSearchBackstop) addressValues.push(address.searchKey, address.searchText);
  insertAddress.run(...addressValues);
  if (insertFts) {
    insertFts.run(
      address.id,
      address.label,
      address.state,
      address.postcode,
      address.accuracy,
      address.locality,
      address.aliasPrincipal,
      address.primarySecondary,
      address.geocodeType,
      address.displayTitle,
      address.displaySubtitle,
      address.suggestionType,
      address.refineRequired ? 1 : 0,
      address.refineHint,
      address.baseKey,
      address.searchKey,
      address.searchText,
      address.lat,
      address.lon,
    );
  }
  for (const entry of address.typeaheadEntries || []) {
    if (entry.entryType === "base_refine") {
      const firstEntry = !seenBaseRefineEntryIds.has(entry.entryId);
      seenBaseRefineEntryIds.add(entry.entryId);
      if (!firstEntry) continue;
    }
    insertTypeaheadEntry.run(
      entry.entryId,
      address.id,
      entry.displayTitle,
      entry.displaySubtitle,
      entry.baseSignature,
      entry.entryType,
      entry.refineRequired ? 1 : 0,
      entry.unit,
      entry.rankWeight,
    );
    insertTypeaheadFts.run(
      entry.entryId,
      entry.keyText,
    );
    if (shouldMaterialisePrefix(entry)) {
      for (const prefix of compactPrefixes(entry.prefixKey, compactPrefixMode(entry))) {
        insertPrefixEntry.run(prefix, entry.entryId);
      }
    }
  }
  count += 1;
  if (count % 10000 === 0) {
    db.exec("COMMIT; BEGIN");
    console.log(`Indexed ${count.toLocaleString()} addresses...`);
  }
  if (limit && count >= limit) break;
}
db.exec("COMMIT");
if (includeSearchBackstop) db.exec("CREATE INDEX addresses_search_text_idx ON addresses(search_text)");
db.close();

console.log(`Built ${outputPath} with ${count.toLocaleString()} address records.`);

async function* readRecords(filePath) {
  if (filePath.endsWith(".json")) {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(payload)) throw new Error("JSON input must be an array");
    for (const item of payload) yield item;
    return;
  }

  const stream = fs.createReadStream(filePath, "utf8");
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let headers = null;
  let delimiter = filePath.endsWith(".psv") ? "|" : ",";
  for await (const line of lines) {
    if (!line.trim()) continue;
    if (!headers) {
      delimiter = line.includes("|") ? "|" : ",";
      headers = splitDelimited(line, delimiter).map((header) => header.trim());
      continue;
    }
    const values = splitDelimited(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    yield row;
  }
}

function normaliseRecord(record, index) {
  const label = firstValue(record, [
    "label",
    "ADDRESS_LABEL",
    "address_label",
    "formatted_address",
    "FORMATTED_ADDRESS",
    "full_address",
    "FULL_ADDRESS",
  ]) || composeGnafLabel(record);
  const lat = Number(firstValue(record, ["lat", "LAT", "latitude", "LATITUDE"]));
  const lon = Number(firstValue(record, ["lon", "LON", "long", "LONG", "longitude", "LONGITUDE"]));
  if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const id = firstValue(record, [
    "id",
    "ID",
    "ADDRESS_DETAIL_PID",
    "ADDRESS_SITE_PID",
    "GNAF_PID",
  ]) || `gnaf-${index}`;
  const state = firstValue(record, ["state", "STATE", "STATE_ABBREVIATION", "STATE_NAME"]) || "";
  const postcode = firstValue(record, ["postcode", "POSTCODE"]) || "";
  const locality = firstValue(record, ["locality", "LOCALITY_NAME", "suburb", "SUBURB"]) || "";
  const aliasPrincipal = firstValue(record, ["ALIAS_PRINCIPAL", "alias_principal"]) || "";
  const primarySecondary = firstValue(record, ["PRIMARY_SECONDARY", "primary_secondary"]) || "";
  const geocodeType = firstValue(record, ["GEOCODE_TYPE", "GEOCODE_TYPE_CODE", "accuracy", "ACCURACY"]) || "gnaf";
  const accuracy = geocodeType;
  const structure = addressStructure(record, label);
  const display = addressDisplayParts(structure, label);
  const keys = buildAddressKeys(record, structure, label);
  const typeaheadEntries = buildTypeaheadEntries({
    id: String(id),
    label: String(label),
    structure,
    display,
    keys,
  });
  return {
    id: String(id),
    label: String(label),
    lat,
    lon,
    state: String(state),
    postcode: String(postcode),
    locality: String(locality),
    aliasPrincipal: String(aliasPrincipal),
    primarySecondary: String(primarySecondary),
    geocodeType: String(geocodeType),
    accuracy: String(accuracy),
    displayTitle: display.title,
    displaySubtitle: display.subtitle,
    suggestionType: display.suggestionType,
    refineRequired: false,
    refineHint: "",
    baseKey: keys.baseKey,
    searchKey: keys.searchKey,
    searchText: buildSearchText(record, label, keys.values),
    typeaheadEntries,
  };
}

function composeGnafLabel(record) {
  const flat = [
    firstValue(record, ["FLAT_TYPE", "flat_type"]),
    firstValue(record, ["FLAT_NUMBER", "flat_number"]),
  ].filter(Boolean).join(" ");
  const numberFirst = [
    firstValue(record, ["NUMBER_FIRST_PREFIX", "number_first_prefix"]),
    firstValue(record, ["NUMBER_FIRST", "number_first"]),
    firstValue(record, ["NUMBER_FIRST_SUFFIX", "number_first_suffix"]),
  ].filter(Boolean).join("");
  const numberLast = [
    firstValue(record, ["NUMBER_LAST_PREFIX", "number_last_prefix"]),
    firstValue(record, ["NUMBER_LAST", "number_last"]),
    firstValue(record, ["NUMBER_LAST_SUFFIX", "number_last_suffix"]),
  ].filter(Boolean).join("");
  const number = numberFirst && numberLast ? `${numberFirst}-${numberLast}` : numberFirst;
  const lot = [
    firstValue(record, ["LOT_NUMBER_PREFIX", "lot_number_prefix"]),
    firstValue(record, ["LOT_NUMBER", "lot_number"]),
    firstValue(record, ["LOT_NUMBER_SUFFIX", "lot_number_suffix"]),
  ].filter(Boolean).join("");
  const street = [
    firstValue(record, ["STREET_NAME", "street_name"]),
    firstValue(record, ["STREET_TYPE", "STREET_TYPE_CODE", "street_type", "street_type_code"]),
    firstValue(record, ["STREET_SUFFIX", "street_suffix"]),
  ].filter(Boolean).join(" ");
  const locality = firstValue(record, ["LOCALITY_NAME", "locality_name", "locality"]) || "";
  const state = firstValue(record, ["STATE_ABBREVIATION", "STATE", "state"]) || "";
  const postcode = firstValue(record, ["POSTCODE", "postcode"]) || "";
  return [flat, lot ? `Lot ${lot}` : "", number, street, locality, state, postcode].filter(Boolean).join(" ").trim();
}

function addressStructure(record, label) {
  const flatNumber = firstValue(record, ["FLAT_NUMBER", "flat_number"]);
  const flatType = firstValue(record, ["FLAT_TYPE", "flat_type"]) || "Unit";
  const levelNumber = firstValue(record, ["LEVEL_NUMBER", "level_number"]);
  const levelType = firstValue(record, ["LEVEL_TYPE", "level_type"]) || "Level";
  const buildingName = firstValue(record, ["BUILDING_NAME", "building_name"]) || buildingNameFromLabel(label);
  const numberFirst = [
    firstValue(record, ["NUMBER_FIRST_PREFIX", "number_first_prefix"]),
    firstValue(record, ["NUMBER_FIRST", "number_first"]),
    firstValue(record, ["NUMBER_FIRST_SUFFIX", "number_first_suffix"]),
  ].filter(Boolean).join("");
  const numberLast = [
    firstValue(record, ["NUMBER_LAST_PREFIX", "number_last_prefix"]),
    firstValue(record, ["NUMBER_LAST", "number_last"]),
    firstValue(record, ["NUMBER_LAST_SUFFIX", "number_last_suffix"]),
  ].filter(Boolean).join("");
  const number = numberFirst && numberLast ? `${numberFirst}-${numberLast}` : numberFirst;
  const lot = [
    firstValue(record, ["LOT_NUMBER_PREFIX", "lot_number_prefix"]),
    firstValue(record, ["LOT_NUMBER", "lot_number"]),
    firstValue(record, ["LOT_NUMBER_SUFFIX", "lot_number_suffix"]),
  ].filter(Boolean).join("");
  const street = [
    firstValue(record, ["STREET_NAME", "street_name"]),
    firstValue(record, ["STREET_TYPE", "STREET_TYPE_CODE", "street_type", "street_type_code"]),
    firstValue(record, ["STREET_SUFFIX", "street_suffix"]),
  ].filter(Boolean).join(" ");
  const locality = firstValue(record, ["LOCALITY_NAME", "locality_name", "locality"]) || "";
  const state = firstValue(record, ["STATE_ABBREVIATION", "STATE", "state"]) || "";
  const postcode = firstValue(record, ["POSTCODE", "postcode"]) || "";
  return { flatNumber, flatType, levelNumber, levelType, buildingName, number, lot, street, locality, state, postcode };
}

function addressDisplayParts(structure, label) {
  const unit = structure.flatNumber ? `${structure.flatType} ${structure.flatNumber}` : "";
  const street = [structure.number || (structure.lot ? `Lot ${structure.lot}` : ""), structure.street].filter(Boolean).join(" ");
  const place = [structure.locality, structure.state, structure.postcode].filter(Boolean).join(" ");
  if (structure.buildingName && unit) {
    return {
      title: `${structure.buildingName}, ${unit}`,
      subtitle: [street, place].filter(Boolean).join(", "),
      suggestionType: "exact_address",
    };
  }
  if (unit) {
    return {
      title: unit,
      subtitle: [street, place].filter(Boolean).join(", "),
      suggestionType: "exact_address",
    };
  }
  return {
    title: street || firstLabelPart(label),
    subtitle: place || remainingLabelParts(label),
    suggestionType: "exact_address",
  };
}

function buildAddressKeys(record, structure, label) {
  const unit = structure.flatNumber ? `${structure.flatType} ${structure.flatNumber}` : "";
  const slashUnit = structure.flatNumber && structure.number ? `${structure.flatNumber}/${structure.number}` : "";
  const level = structure.levelNumber ? `${structure.levelType} ${structure.levelNumber}` : "";
  const street = [structure.number || (structure.lot ? `Lot ${structure.lot}` : ""), structure.street].filter(Boolean).join(" ");
  const place = [structure.locality, structure.state, structure.postcode].filter(Boolean).join(" ");
  const aliases = firstValue(record, ["aliases", "ALIASES"]);
  const values = [
    label,
    `${label} ${structure.state} ${structure.postcode}`,
    [street, place].filter(Boolean).join(" "),
    [structure.street, structure.locality, structure.state, structure.postcode].filter(Boolean).join(" "),
    [structure.locality, structure.postcode, structure.state].filter(Boolean).join(" "),
  ];
  if (structure.buildingName) {
    values.push(
      [structure.buildingName, place].filter(Boolean).join(" "),
      [structure.buildingName, street, place].filter(Boolean).join(" "),
    );
  }
  if (unit && street) {
    values.push(
      [slashUnit, structure.street, place].filter(Boolean).join(" "),
      [unit, street, place].filter(Boolean).join(" "),
      [structure.flatNumber, street, place].filter(Boolean).join(" "),
      [street, unit, place].filter(Boolean).join(" "),
      [level, unit, street, place].filter(Boolean).join(" "),
    );
  }
  if (aliases) values.push(aliases);
  const normalised = [...new Set(values.map(normaliseAddressText).filter(Boolean))];
  return {
    baseKey: normaliseAddressText([street, place].filter(Boolean).join(" ")),
    searchKey: normalised.join(" "),
    values: normalised,
  };
}

function buildSearchText(record, label, keyValues = []) {
  const aliases = firstValue(record, ["aliases", "ALIASES"]);
  return [...new Set([label, ...keyValues, aliases].map(normaliseAddressText).filter(Boolean))].join(" ");
}

function buildTypeaheadEntries({ id, label, structure, display, keys }) {
  const unit = unitText(structure);
  const baseSignature = keys.baseKey || normaliseAddressText(label);
  const entries = [
    {
      entryId: `${id}:exact:label`,
      label,
      displayTitle: null,
      displaySubtitle: null,
      keyText: normaliseAddressText(label),
      prefixKey: normaliseAddressText(label),
      baseSignature,
      entryType: "exact",
      refineRequired: false,
      unit,
      rankWeight: unit ? 920 : 1000,
    },
  ];
  if (keys.baseKey) {
    entries.push({
      entryId: `${id}:exact:base`,
      label,
      displayTitle: null,
      displaySubtitle: null,
      keyText: [unit, keys.baseKey].filter(Boolean).join(" "),
      prefixKey: [unit, keys.baseKey].filter(Boolean).join(" "),
      baseSignature,
      entryType: "exact",
      refineRequired: false,
      unit,
      rankWeight: unit ? 940 : 1000,
    });
  }
  const level = levelText(structure) || levelTextFromLabel(label, unit, keys.baseKey);
  if (keys.baseKey && unit && level) {
    entries.push({
      entryId: `${id}:exact:level-base`,
      label,
      displayTitle: null,
      displaySubtitle: null,
      keyText: [unit, level, keys.baseKey].filter(Boolean).join(" "),
      prefixKey: [unit, level, keys.baseKey].filter(Boolean).join(" "),
      baseSignature,
      entryType: "exact",
      refineRequired: false,
      unit,
      rankWeight: 945,
    });
  }
  if (keys.baseKey && structure.buildingName && !unit) {
    const street = [structure.number || (structure.lot ? `Lot ${structure.lot}` : ""), structure.street].filter(Boolean).join(" ");
    const place = [structure.locality, structure.state, structure.postcode].filter(Boolean).join(" ");
    entries.push({
      entryId: `${id}:exact:building`,
      label,
      displayTitle: null,
      displaySubtitle: null,
      keyText: [normaliseAddressText(structure.buildingName), street, place].filter(Boolean).join(" "),
      prefixKey: normaliseAddressText(structure.buildingName),
      baseSignature,
      entryType: "exact",
      refineRequired: false,
      unit,
      rankWeight: 970,
    });
  }
  if (keys.baseKey && unit) {
    const street = [structure.number || (structure.lot ? `Lot ${structure.lot}` : ""), structure.street].filter(Boolean).join(" ");
    const baseTitle = structure.buildingName || street;
    const place = [structure.locality, structure.state, structure.postcode].filter(Boolean).join(" ");
    const baseSubtitle = structure.buildingName ? [street, place].filter(Boolean).join(", ") : place;
    entries.push({
      entryId: `${baseSignature}:base:refine`,
      label: [baseTitle, baseSubtitle].filter(Boolean).join(", "),
      displayTitle: baseTitle,
      displaySubtitle: baseSubtitle,
      keyText: [normaliseAddressText(structure.buildingName), keys.baseKey].filter(Boolean).join(" "),
      prefixKey: normaliseAddressText(structure.buildingName) || keys.baseKey,
      baseSignature,
      entryType: "base_refine",
      refineRequired: true,
      unit: "",
      rankWeight: 980,
    });
  }
  return entries.filter((entry) => entry.keyText.length >= 4);
}

function unitText(structure) {
  if (!structure.flatNumber) return "";
  return normaliseAddressText(`${structure.flatType || "Unit"} ${structure.flatNumber}`);
}

function levelText(structure) {
  if (!structure.levelNumber) return "";
  return normaliseAddressText(`${structure.levelType || "Level"} ${structure.levelNumber}`);
}

function levelTextFromLabel(label, unit, baseSignature) {
  if (!unit) return "";
  const base = normaliseAddressText(baseSignature);
  const parts = String(label || "").split(",").map((part) => normaliseAddressText(part)).filter(Boolean);
  for (const part of parts) {
    if (part === unit || part === base || base.startsWith(part)) continue;
    const tokens = part.split(/\s+/).filter(Boolean);
    if (SQLITE_LEVEL_MARKER_TERMS.has(tokens[0]) && /^[a-z0-9-]+$/.test(tokens[1] || "")) return part;
  }
  return "";
}

function compactPrefixes(value, mode = "default") {
  const text = normaliseAddressText(value);
  const prefixes = new Set();
  const lengths = mode === "unit_exact" ? [12, 15] : [4, 8, 12, 15];
  for (const length of lengths) {
    if (length <= text.length) prefixes.add(text.slice(0, length));
  }
  return [...prefixes].filter((prefix) => prefix.length >= 4);
}

function shouldMaterialisePrefix(entry) {
  return entry.entryType === "base_refine" ||
    (String(entry.entryId).endsWith(":exact:base") && (!entry.unit || entry.rankWeight >= 900)) ||
    (String(entry.entryId).endsWith(":exact:level-base") && entry.unit) ||
    (String(entry.entryId).endsWith(":exact:building") && !entry.unit) ||
    isLotOrRangeExactLabelEntry(entry);
}

function isLotOrRangeExactLabelEntry(entry) {
  if (entry.entryType !== "exact" || entry.unit || !String(entry.entryId).endsWith(":exact:label")) return false;
  const key = normaliseAddressText(entry.keyText);
  return /^lot [a-z0-9-]+ /.test(key) || /^\d+ \d+ [a-z]/.test(key);
}

function compactPrefixMode(entry) {
  return entry.entryType === "exact" && entry.unit ? "unit_exact" : "default";
}

function firstLabelPart(label) {
  return String(label || "").split(",")[0]?.trim() || "";
}

function remainingLabelParts(label) {
  return String(label || "").split(",").slice(1).map((part) => part.trim()).filter(Boolean).join(", ");
}

function buildingNameFromLabel(label) {
  const parts = String(label || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return "";
  return /^(unit|flat|apartment|apt|suite|townhouse)\b/i.test(parts[1]) ? parts[0] : "";
}

function firstValue(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && String(record[key]).trim()) {
      return String(record[key]).trim();
    }
  }
  return "";
}

function splitDelimited(line, delimiter) {
  if (delimiter === "|") return line.split("|");
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function normaliseAddressText(value) {
  return String(value || "")
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
    .replace(/\btce\b/g, "terrace")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--input") parsed.input = values[++index];
    else if (value === "--output") parsed.output = values[++index];
    else if (value === "--limit") parsed.limit = values[++index];
    else if (value === "--omit-legacy-fts") parsed.omitLegacyFts = true;
    else if (value === "--omit-search-backstop") parsed.omitSearchBackstop = true;
  }
  return parsed;
}
