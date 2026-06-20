#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const args = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(args.input || "data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip");
const outputPath = path.resolve(args.output || "data/gnaf/build/gnaf-addresses.sqlite");
const states = String(args.states || "ACT,NSW,NT,OT,QLD,SA,TAS,VIC,WA")
  .split(",")
  .map((state) => state.trim().toUpperCase())
  .filter(Boolean);
const releasePath = args.releasePath || "G-NAF/G-NAF MAY 2026/Standard";
const limitPerState = args.limitPerState ? Number(args.limitPerState) : 0;

if (!fs.existsSync(inputPath)) throw new Error(`Input ZIP does not exist: ${inputPath}`);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

const db = new DatabaseSync(outputPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA temp_store = MEMORY;
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

let total = 0;
for (const state of states) {
  console.log(`Loading ${state} lookup tables...`);
  const localities = await loadLookup(state, "LOCALITY", "LOCALITY_PID", (row) => ({
    name: titleCase(row.LOCALITY_NAME),
    retired: Boolean(row.DATE_RETIRED),
  }));
  const streets = await loadLookup(state, "STREET_LOCALITY", "STREET_LOCALITY_PID", (row) => ({
    name: titleCase([row.STREET_NAME, row.STREET_TYPE_CODE, row.STREET_SUFFIX_CODE].filter(Boolean).join(" ")),
    retired: Boolean(row.DATE_RETIRED),
  }));
  const geocodes = await loadLookup(state, "ADDRESS_DEFAULT_GEOCODE", "ADDRESS_DETAIL_PID", (row) => ({
    lat: Number(row.LATITUDE),
    lon: Number(row.LONGITUDE),
    geocodeType: row.GEOCODE_TYPE_CODE || "",
    retired: Boolean(row.DATE_RETIRED),
  }));

  console.log(`Indexing ${state} addresses...`);
  let stateCount = 0;
  db.exec("BEGIN");
  for await (const row of readZipPsv(state, "ADDRESS_DETAIL")) {
    if (row.DATE_RETIRED) continue;
    const geocode = geocodes.get(row.ADDRESS_DETAIL_PID);
    if (!geocode || geocode.retired || !Number.isFinite(geocode.lat) || !Number.isFinite(geocode.lon)) continue;
    const locality = localities.get(row.LOCALITY_PID);
    const street = streets.get(row.STREET_LOCALITY_PID);
    if (!locality || locality.retired || !street || street.retired) continue;
    const address = normaliseRawRecord(row, state, locality, street, geocode);
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
    stateCount += 1;
    total += 1;
    if (stateCount % 100000 === 0) {
      db.exec("COMMIT; BEGIN");
      console.log(`Indexed ${stateCount.toLocaleString()} ${state} addresses, ${total.toLocaleString()} total...`);
    }
    if (limitPerState && stateCount >= limitPerState) break;
  }
  db.exec("COMMIT");
  console.log(`Finished ${state}: ${stateCount.toLocaleString()} addresses.`);
}

db.exec("CREATE INDEX addresses_search_text_idx ON addresses(search_text)");
db.close();

console.log(`Built ${outputPath} with ${total.toLocaleString()} address records.`);

async function loadLookup(state, table, keyField, mapper) {
  const lookup = new Map();
  for await (const row of readZipPsv(state, table)) {
    const key = row[keyField];
    if (!key) continue;
    lookup.set(key, mapper(row));
  }
  return lookup;
}

async function* readZipPsv(state, table) {
  const entryPath = `${releasePath}/${state}_${table}_psv.psv`;
  const unzip = spawn("unzip", ["-p", inputPath, entryPath], { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  unzip.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const lines = readline.createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  let headers = null;
  for await (const line of lines) {
    if (!headers) {
      headers = line.split("|");
      continue;
    }
    if (!line) continue;
    const values = line.split("|");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    yield row;
  }
  const code = await new Promise((resolve) => unzip.on("close", resolve));
  if (code !== 0) throw new Error(`unzip failed for ${entryPath}: ${stderr.trim()}`);
}

function normaliseRawRecord(row, state, locality, street, geocode) {
  const flatNumber = joinParts(row.FLAT_NUMBER_PREFIX, row.FLAT_NUMBER, row.FLAT_NUMBER_SUFFIX);
  const flatType = titleCase(row.FLAT_TYPE_CODE || "Unit");
  const levelNumber = joinParts(row.LEVEL_NUMBER_PREFIX, row.LEVEL_NUMBER, row.LEVEL_NUMBER_SUFFIX);
  const levelType = titleCase(row.LEVEL_TYPE_CODE || "");
  const lotNumber = joinParts(row.LOT_NUMBER_PREFIX, row.LOT_NUMBER, row.LOT_NUMBER_SUFFIX);
  const numberFirst = joinParts(row.NUMBER_FIRST_PREFIX, row.NUMBER_FIRST, row.NUMBER_FIRST_SUFFIX);
  const numberLast = joinParts(row.NUMBER_LAST_PREFIX, row.NUMBER_LAST, row.NUMBER_LAST_SUFFIX);
  const number = numberFirst && numberLast ? `${numberFirst}-${numberLast}` : numberFirst;
  const unit = flatNumber ? `${flatType} ${flatNumber}` : "";
  const level = levelNumber ? `${levelType || "Level"} ${levelNumber}` : "";
  const lot = lotNumber && !number ? `Lot ${lotNumber}` : "";
  const streetAddress = [number, street.name].filter(Boolean).join(" ");
  const localityPart = [locality.name, state, row.POSTCODE].filter(Boolean).join(" ");
  const label = [
    titleCase(row.BUILDING_NAME),
    unit,
    level,
    lot,
    streetAddress,
    localityPart,
  ].filter(Boolean).join(", ");
  if (!label || !streetAddress || !locality.name) return null;
  return {
    id: row.ADDRESS_DETAIL_PID,
    label,
    lat: geocode.lat,
    lon: geocode.lon,
    state,
    postcode: row.POSTCODE || "",
    locality: locality.name,
    aliasPrincipal: row.ALIAS_PRINCIPAL || "",
    primarySecondary: row.PRIMARY_SECONDARY || "",
    geocodeType: geocode.geocodeType,
    accuracy: geocode.geocodeType,
    searchText: buildSearchText({ label, flatNumber, flatType, number, streetName: street.name, locality: locality.name, state, postcode: row.POSTCODE }),
  };
}

function buildSearchText({ label, flatNumber, flatType, number, streetName, locality, state, postcode }) {
  const values = [
    label,
    `${label} ${state} ${postcode}`,
    [number, streetName, locality, state, postcode].filter(Boolean).join(" "),
  ];
  if (flatNumber && number && streetName) {
    values.push(
      [`${flatNumber}/${number}`, streetName, locality, state, postcode].filter(Boolean).join(" "),
      [flatType, flatNumber, number, streetName, locality, state, postcode].filter(Boolean).join(" "),
      [flatNumber, number, streetName, locality, state, postcode].filter(Boolean).join(" "),
    );
  }
  return [...new Set(values.map(normaliseAddressText).filter(Boolean))].join(" ");
}

function joinParts(...parts) {
  return parts.filter(Boolean).join("");
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bNsw\b/g, "NSW")
    .replace(/\bAct\b/g, "ACT")
    .replace(/\bQld\b/g, "QLD")
    .replace(/\bWa\b/g, "WA")
    .replace(/\bSa\b/g, "SA")
    .replace(/\bTas\b/g, "TAS")
    .replace(/\bVic\b/g, "VIC")
    .replace(/\bNt\b/g, "NT");
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
    else if (value === "--states") parsed.states = values[++index];
    else if (value === "--release-path") parsed.releasePath = values[++index];
    else if (value === "--limit-per-state") parsed.limitPerState = values[++index];
  }
  return parsed;
}
