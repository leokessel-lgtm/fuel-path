#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";

const args = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(args.input || "prototype/data/gnaf-addresses.seed.json");
const outputPath = path.resolve(args.output || "prototype/data/gnaf-addresses.sqlite");
const limit = args.limit ? Number(args.limit) : 0;

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
    search_text TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE address_fts USING fts5(
    id UNINDEXED,
    label,
    state UNINDEXED,
    postcode UNINDEXED,
    accuracy UNINDEXED,
    locality UNINDEXED,
    alias_principal UNINDEXED,
    primary_secondary UNINDEXED,
    geocode_type UNINDEXED,
    search_text,
    lat UNINDEXED,
    lon UNINDEXED
  );
`);

const insertAddress = db.prepare(`
  INSERT OR REPLACE INTO addresses (
    id, label, lat, lon, state, postcode, accuracy, locality, alias_principal, primary_secondary, geocode_type, search_text
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertFts = db.prepare(`
  INSERT INTO address_fts (
    id, label, state, postcode, accuracy, locality, alias_principal, primary_secondary, geocode_type, search_text, lat, lon
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let count = 0;
db.exec("BEGIN");
for await (const record of readRecords(inputPath)) {
  const address = normaliseRecord(record, count);
  if (!address) continue;
  insertAddress.run(
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
    address.searchText,
  );
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
    address.searchText,
    address.lat,
    address.lon,
  );
  count += 1;
  if (count % 10000 === 0) {
    db.exec("COMMIT; BEGIN");
    console.log(`Indexed ${count.toLocaleString()} addresses...`);
  }
  if (limit && count >= limit) break;
}
db.exec("COMMIT");
db.exec("CREATE INDEX addresses_search_text_idx ON addresses(search_text)");
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
    searchText: buildSearchText(record, label),
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

function buildSearchText(record, label) {
  const flatNumber = firstValue(record, ["FLAT_NUMBER", "flat_number"]);
  const flatType = firstValue(record, ["FLAT_TYPE", "flat_type"]) || "Unit";
  const numberFirst = [
    firstValue(record, ["NUMBER_FIRST_PREFIX", "number_first_prefix"]),
    firstValue(record, ["NUMBER_FIRST", "number_first"]),
    firstValue(record, ["NUMBER_FIRST_SUFFIX", "number_first_suffix"]),
  ].filter(Boolean).join("");
  const street = [
    firstValue(record, ["STREET_NAME", "street_name"]),
    firstValue(record, ["STREET_TYPE", "STREET_TYPE_CODE", "street_type", "street_type_code"]),
    firstValue(record, ["STREET_SUFFIX", "street_suffix"]),
  ].filter(Boolean).join(" ");
  const locality = firstValue(record, ["LOCALITY_NAME", "locality_name", "locality"]) || "";
  const state = firstValue(record, ["STATE_ABBREVIATION", "STATE", "state"]) || "";
  const postcode = firstValue(record, ["POSTCODE", "postcode"]) || "";
  const aliases = firstValue(record, ["aliases", "ALIASES"]);
  const values = [
    label,
    `${label} ${state} ${postcode}`,
    [numberFirst, street, locality, state, postcode].filter(Boolean).join(" "),
  ];
  if (flatNumber && numberFirst && street) {
    values.push(
      [`${flatNumber}/${numberFirst}`, street, locality, state, postcode].filter(Boolean).join(" "),
      [flatType, flatNumber, numberFirst, street, locality, state, postcode].filter(Boolean).join(" "),
      [flatNumber, numberFirst, street, locality, state, postcode].filter(Boolean).join(" "),
    );
  }
  if (aliases) values.push(aliases);
  return [...new Set(values.map(normaliseAddressText).filter(Boolean))].join(" ");
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

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--input") parsed.input = values[++index];
    else if (value === "--output") parsed.output = values[++index];
    else if (value === "--limit") parsed.limit = values[++index];
  }
  return parsed;
}
