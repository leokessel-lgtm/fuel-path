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
    search_text TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE address_fts USING fts5(
    id UNINDEXED,
    label,
    state UNINDEXED,
    postcode UNINDEXED,
    accuracy UNINDEXED,
    search_text,
    lat UNINDEXED,
    lon UNINDEXED
  );
`);

const insertAddress = db.prepare(`
  INSERT OR REPLACE INTO addresses (id, label, lat, lon, state, postcode, accuracy, search_text)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertFts = db.prepare(`
  INSERT INTO address_fts (id, label, state, postcode, accuracy, search_text, lat, lon)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
    address.searchText,
  );
  insertFts.run(
    address.id,
    address.label,
    address.state,
    address.postcode,
    address.accuracy,
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
  const accuracy = firstValue(record, ["accuracy", "ACCURACY", "GEOCODE_TYPE_CODE"]) || "gnaf";
  return {
    id: String(id),
    label: String(label),
    lat,
    lon,
    state: String(state),
    postcode: String(postcode),
    accuracy: String(accuracy),
    searchText: normaliseAddressText(`${label} ${state} ${postcode}`),
  };
}

function composeGnafLabel(record) {
  const number = [
    firstValue(record, ["FLAT_NUMBER", "flat_number"]),
    firstValue(record, ["NUMBER_FIRST", "number_first"]),
    firstValue(record, ["NUMBER_FIRST_SUFFIX", "number_first_suffix"]),
  ].filter(Boolean).join("");
  const street = [
    firstValue(record, ["STREET_NAME", "street_name"]),
    firstValue(record, ["STREET_TYPE_CODE", "street_type_code"]),
  ].filter(Boolean).join(" ");
  const locality = firstValue(record, ["LOCALITY_NAME", "locality_name"]) || "";
  const state = firstValue(record, ["STATE_ABBREVIATION", "STATE", "state"]) || "";
  const postcode = firstValue(record, ["POSTCODE", "postcode"]) || "";
  return [number, street, locality, state, postcode].filter(Boolean).join(" ").trim();
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
