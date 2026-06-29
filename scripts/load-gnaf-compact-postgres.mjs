#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { neon } from "@neondatabase/serverless";

loadLocalEnv();

const SUPPORTED_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
const args = parseArgs(process.argv.slice(2));
const runId = args.runId || new Date().toISOString().replace(/[:.]/g, "-");
const inputPath = path.resolve(args.input || "data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip");
const connectionString = args.databaseUrl || process.env.FUEL_PATH_GNAF_DATABASE_URL || "";
const states = parseStates(args.states || SUPPORTED_STATES.join(","));
const releasePath = args.releasePath || "G-NAF/G-NAF MAY 2026/Standard";
const limitPerState = args.limitPerState ? Number(args.limitPerState) : 0;
const batchSize = Math.max(1, Math.min(Number(args.batchSize || 1000), 5000));
const dryRun = Boolean(args.dryRun);
const reset = Boolean(args.reset);
const setupOnly = Boolean(args.setupOnly);
const createIndexes = Boolean(args.createIndexes);
const skipLoadIndexes = Boolean(args.skipIndexes);
const allowCompactStateShard = Boolean(args.allowCompactStateShard);
const storageReviewPath = args.storageReview || process.env.FUEL_PATH_GNAF_COMPACT_STORAGE_REVIEW_JSON || "";
const progressJsonPath = args.progressJson ? path.resolve(args.progressJson) : "";
const startedAt = new Date().toISOString();
const progress = {
  runId,
  startedAt,
  updatedAt: startedAt,
  status: "initialising",
  dryRun,
  input: path.relative(process.cwd(), inputPath),
  releasePath,
  table: "fuel_path_gnaf_address_serving",
  states,
  limitPerState,
  batchSize,
  reset,
  createIndexes,
  skipLoadIndexes,
  total: 0,
  currentState: "",
  stateCounts: {},
  completedStates: [],
  storage: {},
  errors: [],
};

const unboundedLoad = !setupOnly && !limitPerState;
if (!setupOnly && !fs.existsSync(inputPath)) throw new Error(`Input ZIP does not exist: ${inputPath}`);
if (!dryRun && !connectionString) throw new Error("FUEL_PATH_GNAF_DATABASE_URL is required unless --dry-run is used.");
if (allowCompactStateShard && states.length !== 1) throw new Error("--allow-compact-state-shard may only be used with exactly one --states value.");
if (!dryRun && unboundedLoad && !allowCompactStateShard) {
  throw new Error("Refusing an unbounded compact hosted G-NAF load. Use --limit-per-state or pass --allow-compact-state-shard with a compact storage review.");
}
if (!dryRun && unboundedLoad && !compactStorageReviewAllowsStateShard(storageReviewPath)) {
  throw new Error("Refusing compact state-shard load without an approved compact serving-index storage review.");
}
if (!dryRun && unboundedLoad && !progressJsonPath) {
  throw new Error("Refusing compact state-shard load without --progress-json evidence.");
}

const sql = dryRun ? null : neon(connectionString);
let total = 0;

try {
  await writeProgress({ status: dryRun ? "dry_run_initialised" : "initialised" });
  if (dryRun) {
    console.log("Dry run: database writes are disabled.");
  } else {
    await setupDatabase({ reset });
    await writeProgress({ status: "database_ready", storage: await storageSnapshot() });
    if (setupOnly) {
      if (createIndexes) {
        await writeProgress({ status: "creating_indexes" });
        await createSearchIndexes();
      }
      await writeProgress({ status: "completed", storage: await storageSnapshot() });
      console.log(createIndexes ? "Created compact G-NAF table and indexes." : "Created compact G-NAF table.");
      process.exit(0);
    }
  }

  for (const state of states) {
    await writeProgress({ status: "loading_state", currentState: state });
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

    console.log(`Streaming ${state} compact addresses...`);
    let stateCount = 0;
    let batch = [];
    for await (const row of readZipPsv(state, "ADDRESS_DETAIL")) {
      if (row.DATE_RETIRED) continue;
      const geocode = geocodes.get(row.ADDRESS_DETAIL_PID);
      if (!geocode || geocode.retired || !Number.isFinite(geocode.lat) || !Number.isFinite(geocode.lon)) continue;
      const locality = localities.get(row.LOCALITY_PID);
      const street = streets.get(row.STREET_LOCALITY_PID);
      if (!locality || locality.retired || !street || street.retired) continue;
      const compact = compactRecord(row, state, locality, street, geocode);
      if (!compact) continue;
      batch.push(compact);
      stateCount += 1;
      total += 1;
      if (batch.length >= batchSize) {
        await flushBatch(batch);
        batch = [];
      }
      if (stateCount % 100000 === 0) {
        console.log(`Loaded ${stateCount.toLocaleString()} compact ${state} addresses, ${total.toLocaleString()} total...`);
      }
      if (limitPerState && stateCount >= limitPerState) break;
    }
    if (batch.length) await flushBatch(batch);
    progress.stateCounts[state] = stateCount;
    progress.completedStates = [...new Set([...progress.completedStates, state])];
    await writeProgress({
      status: "state_completed",
      currentState: state,
      total,
      stateCounts: progress.stateCounts,
      completedStates: progress.completedStates,
      storage: await storageSnapshot(),
    });
    console.log(`Finished ${state}: ${stateCount.toLocaleString()} compact addresses.`);
  }

  if (!dryRun && createIndexes && !skipLoadIndexes) {
    await writeProgress({ status: "creating_indexes", currentState: "" });
    await createSearchIndexes();
  }

  await writeProgress({ status: "completed", currentState: "", total, storage: await storageSnapshot() });
  console.log(`${dryRun ? "Dry-run scanned" : "Loaded"} ${total.toLocaleString()} compact address records.`);
} catch (error) {
  await writeProgress({ status: "failed", errors: [...progress.errors, error?.message || String(error)], total });
  throw error;
}

async function setupDatabase({ reset: shouldReset }) {
  if (shouldReset) await sql`DROP TABLE IF EXISTS fuel_path_gnaf_address_serving`;
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  await sql`
    CREATE TABLE IF NOT EXISTS fuel_path_gnaf_address_serving (
      id text PRIMARY KEY,
      label text NOT NULL,
      lat double precision NOT NULL,
      lon double precision NOT NULL,
      state char(3) NOT NULL,
      postcode char(4),
      locality text NOT NULL,
      address_kind text NOT NULL,
      search_prefix text NOT NULL,
      search_text text NOT NULL
    )
  `;
}

async function createSearchIndexes() {
  await sql`CREATE INDEX IF NOT EXISTS fuel_path_gnaf_serving_prefix_idx ON fuel_path_gnaf_address_serving (search_prefix text_pattern_ops)`;
  await sql`CREATE INDEX IF NOT EXISTS fuel_path_gnaf_serving_search_trgm_idx ON fuel_path_gnaf_address_serving USING gin (search_text gin_trgm_ops)`;
  await sql`CREATE INDEX IF NOT EXISTS fuel_path_gnaf_serving_state_postcode_idx ON fuel_path_gnaf_address_serving (state, postcode)`;
  await sql`CREATE INDEX IF NOT EXISTS fuel_path_gnaf_serving_locality_idx ON fuel_path_gnaf_address_serving (locality)`;
}

async function flushBatch(rows) {
  if (dryRun) return;
  await sql.query(
    `
      INSERT INTO fuel_path_gnaf_address_serving (
        id, label, lat, lon, state, postcode, locality, address_kind, search_prefix, search_text
      )
      SELECT id, label, lat, lon, state, postcode, locality, address_kind, search_prefix, search_text
      FROM jsonb_to_recordset($1::jsonb) AS x(
        id text,
        label text,
        lat double precision,
        lon double precision,
        state text,
        postcode text,
        locality text,
        address_kind text,
        search_prefix text,
        search_text text
      )
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        lat = EXCLUDED.lat,
        lon = EXCLUDED.lon,
        state = EXCLUDED.state,
        postcode = EXCLUDED.postcode,
        locality = EXCLUDED.locality,
        address_kind = EXCLUDED.address_kind,
        search_prefix = EXCLUDED.search_prefix,
        search_text = EXCLUDED.search_text
    `,
    [JSON.stringify(rows)],
  );
}

async function storageSnapshot() {
  if (dryRun || !sql) return {};
  try {
    const [row] = await sql`
      SELECT
        pg_relation_size('fuel_path_gnaf_address_serving')::bigint AS table_bytes,
        pg_indexes_size('fuel_path_gnaf_address_serving')::bigint AS index_bytes,
        pg_total_relation_size('fuel_path_gnaf_address_serving')::bigint AS total_bytes,
        (SELECT count(*)::bigint FROM fuel_path_gnaf_address_serving) AS rows
    `;
    return {
      rows: Number(row.rows || 0),
      tableBytes: Number(row.table_bytes || 0),
      indexBytes: Number(row.index_bytes || 0),
      totalBytes: Number(row.total_bytes || 0),
      tableMb: mb(row.table_bytes),
      indexMb: mb(row.index_bytes),
      totalMb: mb(row.total_bytes),
    };
  } catch (error) {
    return { error: error?.message || String(error) };
  }
}

function compactRecord(row, state, locality, street, geocode) {
  const flatNumber = joinParts(row.FLAT_NUMBER_PREFIX, row.FLAT_NUMBER, row.FLAT_NUMBER_SUFFIX);
  const flatType = titleCase(row.FLAT_TYPE_CODE || "Unit");
  const levelNumber = joinParts(row.LEVEL_NUMBER_PREFIX, row.LEVEL_NUMBER, row.LEVEL_NUMBER_SUFFIX);
  const lotNumber = joinParts(row.LOT_NUMBER_PREFIX, row.LOT_NUMBER, row.LOT_NUMBER_SUFFIX);
  const numberFirst = joinParts(row.NUMBER_FIRST_PREFIX, row.NUMBER_FIRST, row.NUMBER_FIRST_SUFFIX);
  const numberLast = joinParts(row.NUMBER_LAST_PREFIX, row.NUMBER_LAST, row.NUMBER_LAST_SUFFIX);
  const number = numberFirst && numberLast ? `${numberFirst}-${numberLast}` : numberFirst;
  const unit = flatNumber ? `${flatType} ${flatNumber}` : "";
  const level = levelNumber ? `Level ${levelNumber}` : "";
  const lot = lotNumber && !number ? `Lot ${lotNumber}` : "";
  const streetAddress = [number, street.name].filter(Boolean).join(" ");
  const localityPart = [locality.name, state, row.POSTCODE].filter(Boolean).join(" ");
  const label = [titleCase(row.BUILDING_NAME), unit, level, lot, streetAddress, localityPart].filter(Boolean).join(", ");
  if (!label || !streetAddress || !locality.name) return null;
  const kind = flatNumber ? "unit" : lot ? "lot" : levelNumber ? "building" : numberLast ? "range" : "address";
  const searchPrefix = normaliseAddressText([number || lot, street.name, locality.name, state, row.POSTCODE].filter(Boolean).join(" "));
  const searchText = compactSearchText({ label, flatNumber, flatType, number, streetName: street.name, locality: locality.name, state, postcode: row.POSTCODE });
  return {
    id: row.ADDRESS_DETAIL_PID,
    label,
    lat: geocode.lat,
    lon: geocode.lon,
    state,
    postcode: row.POSTCODE || "",
    locality: locality.name,
    address_kind: kind,
    search_prefix: searchPrefix,
    search_text: searchText,
  };
}

function compactSearchText({ label, flatNumber, flatType, number, streetName, locality, state, postcode }) {
  const values = [label, [number, streetName, locality, state, postcode].filter(Boolean).join(" ")];
  if (flatNumber && number && streetName) {
    values.push(
      [`${flatNumber}/${number}`, streetName, locality, state, postcode].filter(Boolean).join(" "),
      [flatType, flatNumber, number, streetName, locality, state, postcode].filter(Boolean).join(" "),
    );
  }
  return [...new Set(values.map(normaliseAddressText).filter(Boolean))].join(" ");
}

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
  unzip.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
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
    headers.forEach((header, index) => { row[header] = values[index] || ""; });
    yield row;
  }
  const code = await new Promise((resolve) => unzip.on("close", resolve));
  if (code !== 0) throw new Error(`unzip failed for ${entryPath}: ${stderr.trim()}`);
}

function parseStates(value) {
  const selected = String(value || "").split(",").map((state) => state.trim().toUpperCase()).filter(Boolean);
  const invalid = selected.filter((state) => !SUPPORTED_STATES.includes(state));
  if (invalid.length) throw new Error(`Unsupported compact G-NAF states: ${invalid.join(", ")}`);
  return selected.length ? [...new Set(selected)] : SUPPORTED_STATES;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--input") parsed.input = values[++index];
    else if (value === "--database-url") parsed.databaseUrl = values[++index];
    else if (value === "--states") parsed.states = values[++index];
    else if (value === "--release-path") parsed.releasePath = values[++index];
    else if (value === "--limit-per-state") parsed.limitPerState = values[++index];
    else if (value === "--batch-size") parsed.batchSize = values[++index];
    else if (value === "--reset") parsed.reset = true;
    else if (value === "--dry-run") parsed.dryRun = true;
    else if (value === "--setup-only") parsed.setupOnly = true;
    else if (value === "--create-indexes") parsed.createIndexes = true;
    else if (value === "--skip-indexes") parsed.skipIndexes = true;
    else if (value === "--allow-compact-state-shard") parsed.allowCompactStateShard = true;
    else if (value === "--storage-review") parsed.storageReview = values[++index];
    else if (value === "--progress-json") parsed.progressJson = values[++index];
    else if (value === "--run-id") parsed.runId = values[++index];
  }
  return parsed;
}

function compactStorageReviewAllowsStateShard(filePath) {
  if (!filePath) return false;
  try {
    const review = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
    return review.decision === "compact_serving_index_nsw_trial_approved" &&
      review.decisionScope?.compactStateShardLoadApproved === true &&
      review.decisionScope?.compactNationalLoadApproved === false;
  } catch {
    return false;
  }
}

async function writeProgress(update = {}) {
  Object.assign(progress, update, { updatedAt: new Date().toISOString() });
  if (!progressJsonPath) return;
  await fs.promises.mkdir(path.dirname(progressJsonPath), { recursive: true });
  await fs.promises.writeFile(progressJsonPath, `${JSON.stringify(progress, null, 2)}\n`);
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

function mb(value) {
  return Number((Number(value || 0) / 1024 / 1024).toFixed(2));
}

function loadLocalEnv(file = ".env.local") {
  const envPath = path.resolve(file);
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (process.env[key] !== undefined) continue;
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
