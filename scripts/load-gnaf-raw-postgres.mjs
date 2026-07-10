#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { neon } from "@neondatabase/serverless";

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const runId = args.runId || new Date().toISOString().replace(/[:.]/g, "-");
const inputPath = path.resolve(args.input || "data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip");
const connectionString = args.databaseUrl || process.env.FUEL_PATH_GNAF_DATABASE_URL || "";
const states = String(args.states || "ACT,NSW,NT,OT,QLD,SA,TAS,VIC,WA")
  .split(",")
  .map((state) => state.trim().toUpperCase())
  .filter(Boolean);
const releasePath = args.releasePath || "G-NAF/G-NAF MAY 2026/Standard";
const limitPerState = args.limitPerState ? Number(args.limitPerState) : 0;
const batchSize = Math.max(1, Math.min(Number(args.batchSize || 500), 5000));
const dryRun = Boolean(args.dryRun);
const reset = Boolean(args.reset);
const setupOnly = Boolean(args.setupOnly);
const createIndexes = Boolean(args.createIndexes);
const skipLoadIndexes = Boolean(args.skipIndexes);
const allowLargeLoad = Boolean(args.allowLargeLoad) || process.env.FUEL_PATH_ALLOW_LARGE_GNAF_LOAD === "true";
const allowStateShard = Boolean(args.allowStateShard);
const storageReviewPath = args.storageReview || process.env.FUEL_PATH_GNAF_STORAGE_REVIEW_JSON || "";
const resumeProgressJsonPath = args.resumeProgressJson ? path.resolve(args.resumeProgressJson) : "";
let progressJsonPath = args.progressJson ? path.resolve(args.progressJson) : "";
if (resumeProgressJsonPath && !progressJsonPath) progressJsonPath = resumeProgressJsonPath;
const resumeProgress = resumeProgressJsonPath ? readProgressManifest(resumeProgressJsonPath) : null;
const completedStateSet = new Set(
  Array.isArray(resumeProgress?.completedStates)
    ? resumeProgress.completedStates.map((state) => String(state).toUpperCase()).filter(Boolean)
    : [],
);
const unboundedLoad = !setupOnly && !limitPerState;
const stateShardLoad = unboundedLoad && allowStateShard;
const requiresLargeLoadControls = !dryRun && unboundedLoad && allowLargeLoad;
const requiresStateShardControls = !dryRun && stateShardLoad;
const startedAt = new Date().toISOString();
const progress = {
  runId,
  startedAt,
  updatedAt: startedAt,
  status: "initialising",
  dryRun,
  input: path.relative(process.cwd(), inputPath),
  releasePath,
  states,
  limitPerState,
  batchSize,
  reset,
  createIndexes,
  skipLoadIndexes,
  resumeFrom: resumeProgressJsonPath ? path.relative(process.cwd(), resumeProgressJsonPath) : "",
  total: Number(resumeProgress?.total || 0) || 0,
  currentState: "",
  stateCounts: resumeProgress?.stateCounts && typeof resumeProgress.stateCounts === "object" ? { ...resumeProgress.stateCounts } : {},
  completedStates: [...completedStateSet],
  skippedStates: [],
  errors: [],
};

if (!setupOnly && !fs.existsSync(inputPath)) throw new Error(`Input ZIP does not exist: ${inputPath}`);
if (resumeProgressJsonPath && reset) {
  throw new Error("Refusing to resume a G-NAF load while --reset is set. Resume without --reset, or start a fresh load with a new progress file.");
}
if (!dryRun && !connectionString) {
  throw new Error("FUEL_PATH_GNAF_DATABASE_URL is required unless --dry-run is used.");
}
if (allowStateShard && states.length !== 1) {
  throw new Error("--allow-state-shard may only be used with exactly one --states value.");
}
if (!dryRun && unboundedLoad && !allowLargeLoad && !allowStateShard) {
  throw new Error(
    [
      "Refusing an unbounded hosted G-NAF load.",
      "The full raw G-NAF import is roughly 17 million rows and can exceed free hosted database storage limits once indexed.",
      "Use --limit-per-state for a controlled validation load, pass --allow-state-shard for one reviewed state shard, or pass --allow-large-load only after confirming the database plan and storage budget.",
    ].join(" "),
  );
}
if (requiresStateShardControls && !storageReviewAllowsStateShard(storageReviewPath)) {
  throw new Error(
    [
      "Refusing an unbounded state-shard G-NAF load without a recorded staged-storage decision.",
      "Pass --storage-review docs/03-provider-data/evidence/historical/gnaf/gnaf-hosted-storage-review-2026-06-29.json or set FUEL_PATH_GNAF_STORAGE_REVIEW_JSON.",
    ].join(" "),
  );
}
if (requiresStateShardControls && !progressJsonPath) {
  throw new Error(
    [
      "Refusing an unbounded state-shard G-NAF load without --progress-json.",
      "Pass a writable progress JSON path so interrupted shard loads leave resumable operational evidence.",
    ].join(" "),
  );
}
if (requiresLargeLoadControls && !storageReviewPassed(storageReviewPath)) {
  throw new Error(
    [
      "Refusing an unbounded hosted G-NAF load without a passed storage/cost review.",
      "Run npm run review:gnaf-hosted-storage -- --load-plan <json> --require-passed, then pass --storage-review <json> or set FUEL_PATH_GNAF_STORAGE_REVIEW_JSON.",
    ].join(" "),
  );
}
if (requiresLargeLoadControls && !progressJsonPath) {
  throw new Error(
    [
      "Refusing an unbounded hosted G-NAF load without --progress-json.",
      "Pass a writable progress JSON path so interrupted national loads leave resumable operational evidence.",
    ].join(" "),
  );
}

const sql = dryRun ? null : neon(connectionString);
let total = progress.total;

try {
  await writeProgress({ status: resumeProgress ? "resume_initialised" : dryRun ? "dry_run_initialised" : "initialised" });

  if (dryRun) {
    console.log("Dry run: database writes are disabled.");
    if (setupOnly) {
      console.log(createIndexes ? "Dry run: would create G-NAF Postgres table and indexes." : "Dry run: would create G-NAF Postgres table.");
      await writeProgress({ status: "dry_run_completed" });
      process.exit(0);
    }
  } else {
    await setupDatabase({ reset });
    await writeProgress({ status: "database_ready" });
    if (createIndexes && setupOnly) {
      await writeProgress({ status: "creating_indexes" });
      await createSearchIndexes();
      console.log("Created G-NAF Postgres indexes.");
      await writeProgress({ status: "completed" });
      process.exit(0);
    }
    if (setupOnly) {
      console.log("Created G-NAF Postgres table.");
      await writeProgress({ status: "completed" });
      process.exit(0);
    }
  }

  for (const state of states) {
    if (completedStateSet.has(state)) {
      console.log(`Skipping ${state}: already completed in resume manifest.`);
      await writeProgress({
        status: "state_skipped",
        currentState: state,
        skippedStates: [...new Set([...progress.skippedStates, state])],
      });
      continue;
    }
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

    console.log(`Streaming ${state} addresses...`);
    let stateCount = 0;
    let batch = [];
    for await (const row of readZipPsv(state, "ADDRESS_DETAIL")) {
      if (row.DATE_RETIRED) continue;
      const geocode = geocodes.get(row.ADDRESS_DETAIL_PID);
      if (!geocode || geocode.retired || !Number.isFinite(geocode.lat) || !Number.isFinite(geocode.lon)) continue;
      const locality = localities.get(row.LOCALITY_PID);
      const street = streets.get(row.STREET_LOCALITY_PID);
      if (!locality || locality.retired || !street || street.retired) continue;
      const address = normaliseRawRecord(row, state, locality, street, geocode);
      if (!address) continue;
      batch.push(address);
      stateCount += 1;
      total += 1;
      if (batch.length >= batchSize) {
        await flushBatch(batch);
        batch = [];
      }
      if (stateCount % 100000 === 0) {
        console.log(`Loaded ${stateCount.toLocaleString()} ${state} addresses, ${total.toLocaleString()} total...`);
      }
      if (limitPerState && stateCount >= limitPerState) break;
    }
    if (batch.length) await flushBatch(batch);
    completedStateSet.add(state);
    await writeProgress({
      status: "state_completed",
      currentState: state,
      stateCounts: { ...progress.stateCounts, [state]: stateCount },
      completedStates: [...completedStateSet],
      total,
    });
    console.log(`Finished ${state}: ${stateCount.toLocaleString()} addresses.`);
  }

  if (!dryRun && createIndexes && !skipLoadIndexes) {
    await writeProgress({ status: "creating_indexes", currentState: "" });
    await createSearchIndexes();
  }

  await writeProgress({ status: "completed", currentState: "", total });
  console.log(`${dryRun ? "Dry-run scanned" : "Loaded"} ${total.toLocaleString()} address records.`);
  process.exit(0);
} catch (error) {
  await writeProgress({
    status: "failed",
    errors: [...progress.errors, error?.message || String(error)],
    total,
  });
  throw error;
}

async function setupDatabase({ reset: shouldReset }) {
  if (shouldReset) {
    await sql`DROP TABLE IF EXISTS fuel_path_gnaf_addresses`;
  }
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  await sql`
    CREATE TABLE IF NOT EXISTS fuel_path_gnaf_addresses (
      id text PRIMARY KEY,
      label text NOT NULL,
      lat double precision NOT NULL,
      lon double precision NOT NULL,
      state text,
      postcode text,
      accuracy text,
      locality text,
      alias_principal text,
      primary_secondary text,
      geocode_type text,
      search_text text NOT NULL
    )
  `;
}

async function createSearchIndexes() {
  await sql`
    CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_search_trgm_idx
      ON fuel_path_gnaf_addresses
      USING gin (search_text gin_trgm_ops)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_search_prefix_idx
      ON fuel_path_gnaf_addresses (search_text text_pattern_ops)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_state_postcode_idx
      ON fuel_path_gnaf_addresses (state, postcode)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS fuel_path_gnaf_addresses_locality_idx
      ON fuel_path_gnaf_addresses (locality)
  `;
}

async function flushBatch(rows) {
  if (dryRun) return;
  await sql.query(
    `
      INSERT INTO fuel_path_gnaf_addresses (
        id, label, lat, lon, state, postcode, accuracy, locality,
        alias_principal, primary_secondary, geocode_type, search_text
      )
      SELECT
        id, label, lat, lon, state, postcode, accuracy, locality,
        alias_principal, primary_secondary, geocode_type, search_text
      FROM jsonb_to_recordset($1::jsonb) AS x(
        id text,
        label text,
        lat double precision,
        lon double precision,
        state text,
        postcode text,
        accuracy text,
        locality text,
        alias_principal text,
        primary_secondary text,
        geocode_type text,
        search_text text
      )
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        lat = EXCLUDED.lat,
        lon = EXCLUDED.lon,
        state = EXCLUDED.state,
        postcode = EXCLUDED.postcode,
        accuracy = EXCLUDED.accuracy,
        locality = EXCLUDED.locality,
        alias_principal = EXCLUDED.alias_principal,
        primary_secondary = EXCLUDED.primary_secondary,
        geocode_type = EXCLUDED.geocode_type,
        search_text = EXCLUDED.search_text
    `,
    [JSON.stringify(rows)],
  );
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
    accuracy: geocode.geocodeType,
    locality: locality.name,
    alias_principal: row.ALIAS_PRINCIPAL || "",
    primary_secondary: row.PRIMARY_SECONDARY || "",
    geocode_type: geocode.geocodeType,
    search_text: buildSearchText({ label, flatNumber, flatType, number, streetName: street.name, locality: locality.name, state, postcode: row.POSTCODE }),
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
    else if (value === "--allow-large-load") parsed.allowLargeLoad = true;
    else if (value === "--allow-state-shard") parsed.allowStateShard = true;
    else if (value === "--storage-review") parsed.storageReview = values[++index];
    else if (value === "--progress-json") parsed.progressJson = values[++index];
    else if (value === "--resume-progress-json") parsed.resumeProgressJson = values[++index];
    else if (value === "--run-id") parsed.runId = values[++index];
  }
  return parsed;
}

async function writeProgress(update = {}) {
  Object.assign(progress, update, { updatedAt: new Date().toISOString() });
  if (!progressJsonPath) return;
  await fs.promises.mkdir(path.dirname(progressJsonPath), { recursive: true });
  await fs.promises.writeFile(progressJsonPath, `${JSON.stringify(progress, null, 2)}\n`);
}

function storageReviewPassed(filePath) {
  if (!filePath) return false;
  try {
    const review = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
    return review.status === "passed" &&
      review.decision === "storage_cost_review_confirmed_for_oracle_always_free_national_load_attempt" &&
      review.assumptions?.target === "oracle_always_free_compute";
  } catch {
    return false;
  }
}

function storageReviewAllowsStateShard(filePath) {
  if (!filePath) return false;
  try {
    const review = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
    return review.decision === "neon_staged_validation_full_national_not_approved" &&
      review.decisionScope?.stateShardLoadApproved === true &&
      review.decisionScope?.nationalLoadApproved === false;
  } catch {
    return false;
  }
}

function readProgressManifest(filePath) {
  try {
    const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!manifest || typeof manifest !== "object") throw new Error("manifest is not an object");
    return manifest;
  } catch (error) {
    throw new Error(`Unable to read G-NAF progress manifest for resume: ${filePath}. ${error?.message || error}`);
  }
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
