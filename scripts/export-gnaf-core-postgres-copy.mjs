#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const args = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(args.input || "");
const outputPath = path.resolve(args.output || "tmp/gnaf-addresses.copy.tsv");
const limit = args.limit ? Number(args.limit) : 0;

if (!inputPath || !fs.existsSync(inputPath)) {
  throw new Error(`Input file does not exist: ${inputPath}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const output = fs.createWriteStream(outputPath, "utf8");
output.write([
  "id",
  "label",
  "lat",
  "lon",
  "state",
  "postcode",
  "accuracy",
  "locality",
  "alias_principal",
  "primary_secondary",
  "geocode_type",
  "search_text",
].join("\t") + "\n");

let count = 0;
for await (const record of readRecords(inputPath)) {
  const address = normaliseRecord(record, count);
  if (!address) continue;
  output.write([
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
  ].map(tsvEscape).join("\t") + "\n");
  count += 1;
  if (count % 100000 === 0) console.log(`Exported ${count.toLocaleString()} addresses...`);
  if (limit && count >= limit) break;
}

await new Promise((resolve, reject) => {
  output.end(resolve);
  output.on("error", reject);
});

console.log(`Exported ${count.toLocaleString()} address records to ${outputPath}`);

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
    accuracy: String(geocodeType),
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

function tsvEscape(value) {
  return String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ")
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
