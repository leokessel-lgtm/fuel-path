#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_ORDER = ["NSW", "ACT", "VIC", "QLD", "WA", "SA", "TAS", "NT"];
const args = parseArgs(process.argv.slice(2));
const SOURCE_SQLITE = path.resolve(args.addressSqlite || "data/gnaf/build/gnaf-addresses-national.sqlite");
const RUN_ID = args.runId || new Date().toISOString().replace(/[:.]/g, "-");
const ADDRESS_COUNT = Number(args.addressCount || 160);
const NOISE_PER_SEED = Number(args.noisePerSeed || 120);
const OUTPUT_SQLITE = path.resolve(args.outputSqlite || `tmp/address-typeahead-experiment-${RUN_ID}.sqlite`);
const LIMIT = Number(args.limit || 5);
const MAX_PREFIX = Number(args.maxPrefix || 15);
const PROFILE = args.profile || "balanced";

if (!fs.existsSync(SOURCE_SQLITE)) throw new Error(`Address SQLite does not exist: ${SOURCE_SQLITE}`);

const source = new DatabaseSync(SOURCE_SQLITE, { readOnly: true });
const sampledRows = sampleRows(source, ADDRESS_COUNT, NOISE_PER_SEED);
source.close?.();

const cases = sampledRows.cases.map((row, index) => ({
  ...row,
  id: `case-${String(index + 1).padStart(4, "0")}`,
  query: String(row.label || "").replace(/,/g, "").replace(/\s+/g, " ").trim(),
  segment: addressSegment(row),
}));
const allRows = dedupeRows([...sampledRows.indexRows, ...sampledRows.cases]);

fs.mkdirSync(path.dirname(OUTPUT_SQLITE), { recursive: true });
if (fs.existsSync(OUTPUT_SQLITE)) fs.unlinkSync(OUTPUT_SQLITE);
const experimentDb = new DatabaseSync(OUTPUT_SQLITE);
buildExperimentIndex(experimentDb, allRows);

const rows = [];
for (const testCase of cases) {
  rows.push({
    ...testCase,
    typeahead: runCase(experimentDb, "typeahead", testCase),
    prefix: runCase(experimentDb, "prefix", testCase),
    hybrid: runCase(experimentDb, "hybrid", testCase),
  });
}
experimentDb.exec("PRAGMA wal_checkpoint(TRUNCATE)");

const payload = {
  runId: RUN_ID,
  sourceSqlite: SOURCE_SQLITE,
  outputSqlite: OUTPUT_SQLITE,
  sourceIndex: fileEvidence(SOURCE_SQLITE),
  experimentIndex: fileEvidence(OUTPUT_SQLITE),
  requested: {
    addressCount: ADDRESS_COUNT,
    noisePerSeed: NOISE_PER_SEED,
    maxPrefix: MAX_PREFIX,
    profile: PROFILE,
  },
  sampled: {
    cases: cases.length,
    indexRows: allRows.length,
  },
  summary: {
    typeahead: summarise(rows.map((row) => row.typeahead), rows),
    prefix: summarise(rows.map((row) => row.prefix), rows),
    hybrid: summarise(rows.map((row) => row.hybrid), rows),
  },
  bySegment: {
    typeahead: summariseBySegment(rows, "typeahead"),
    prefix: summariseBySegment(rows, "prefix"),
    hybrid: summariseBySegment(rows, "hybrid"),
  },
  rows,
};

await fsp.mkdir(path.join(ROOT, "tmp"), { recursive: true });
const jsonPath = `tmp/address-typeahead-experiment-${RUN_ID}.json`;
await fsp.writeFile(path.join(ROOT, jsonPath), JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ jsonPath, summary: payload.summary, sampled: payload.sampled, experimentIndex: payload.experimentIndex }, null, 2));

experimentDb.close?.();

function buildExperimentIndex(db, rows) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE entries (
      entry_id TEXT PRIMARY KEY,
      address_id TEXT NOT NULL,
      label TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      state TEXT,
      postcode TEXT,
      locality TEXT,
      key_text TEXT NOT NULL,
      prefix_key TEXT NOT NULL,
      base_signature TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      refine_required INTEGER DEFAULT 0,
      unit TEXT,
      rank_weight INTEGER NOT NULL
    );
    CREATE VIRTUAL TABLE typeahead_fts USING fts5(
      entry_id UNINDEXED,
      key_text,
      label UNINDEXED,
      state UNINDEXED,
      postcode UNINDEXED,
      entry_type UNINDEXED,
      refine_required UNINDEXED,
      rank_weight UNINDEXED
    );
    CREATE TABLE prefix_entries (
      prefix TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      rank_weight INTEGER NOT NULL,
      PRIMARY KEY (prefix, entry_id)
    );
    CREATE INDEX entries_base_idx ON entries(base_signature);
  `);
  const insertEntry = db.prepare(`
    INSERT OR REPLACE INTO entries (
      entry_id, address_id, label, lat, lon, state, postcode, locality, key_text, prefix_key,
      base_signature, entry_type, refine_required, unit, rank_weight
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFts = db.prepare(`
    INSERT INTO typeahead_fts (
      entry_id, key_text, label, state, postcode, entry_type, refine_required, rank_weight
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPrefix = db.prepare(`
    INSERT OR IGNORE INTO prefix_entries (prefix, entry_id, rank_weight)
    VALUES (?, ?, ?)
  `);
  db.exec("BEGIN");
  const seenBaseRefineEntryIds = new Set();
  for (const row of rows) {
    for (const entry of entriesForRow(row)) {
      if (entry.entryType === "base_refine") {
        const firstEntry = !seenBaseRefineEntryIds.has(entry.entryId);
        seenBaseRefineEntryIds.add(entry.entryId);
        if (!firstEntry) continue;
      }
      insertEntry.run(
        entry.entryId,
        row.id,
        row.label,
        row.lat,
        row.lon,
        row.state,
        row.postcode,
        row.locality,
        entry.keyText,
        entry.prefixKey,
        entry.baseSignature,
        entry.entryType,
        entry.refineRequired ? 1 : 0,
        entry.unit,
        entry.rankWeight,
      );
      insertFts.run(
        entry.entryId,
        entry.keyText,
        row.label,
        row.state,
        row.postcode,
        entry.entryType,
        entry.refineRequired ? 1 : 0,
        entry.rankWeight,
      );
      if (shouldMaterialisePrefix(entry)) {
        for (const prefix of compactPrefixes(entry.prefixKey)) {
          insertPrefix.run(prefix, entry.entryId, entry.rankWeight);
        }
      }
    }
  }
  db.exec("COMMIT");
}

function entriesForRow(row) {
  const parsed = parseAddress(row.label);
  const normalisedLabel = normalise(row.label);
  const id = String(row.id);
  const entries = [
    {
      entryId: `${id}:exact:label`,
      keyText: normalisedLabel,
      prefixKey: normalisedLabel,
      baseSignature: parsed?.baseSignature || normalisedLabel,
      entryType: "exact",
      refineRequired: false,
      unit: parsed?.unit || "",
      rankWeight: parsed?.unit ? 920 : 1000,
    },
  ];
  if (parsed?.baseKey) {
    entries.push({
      entryId: `${id}:exact:base`,
      keyText: [parsed.unitText, parsed.baseKey].filter(Boolean).join(" "),
      prefixKey: [parsed.unitText, parsed.baseKey].filter(Boolean).join(" "),
      baseSignature: parsed.baseSignature,
      entryType: "exact",
      refineRequired: false,
      unit: parsed.unit || "",
      rankWeight: parsed.unit ? 940 : 1000,
    });
  }
  if (parsed?.baseKey && parsed.unit) {
    entries.push({
      entryId: `${parsed.baseSignature}:base:refine`,
      keyText: [parsed.building, parsed.baseKey].filter(Boolean).join(" "),
      prefixKey: [parsed.building, parsed.baseKey].filter(Boolean).join(" "),
      baseSignature: parsed.baseSignature,
      entryType: "base_refine",
      refineRequired: true,
      unit: "",
      rankWeight: 980,
    });
  }
  return entries.filter((entry) => entry.keyText.length >= 4);
}

function runCase(db, mode, testCase) {
  const prefixes = prefixesFor(testCase.query);
  let firstExactTopChars = null;
  let firstResolvableTopChars = null;
  let firstSuggestionChars = null;
  let wrongTopBeforeResolvable = false;
  let finalTop = null;
  const started = Date.now();
  for (const prefix of prefixes) {
    const suggestions = searchExperiment(db, mode, prefix, LIMIT);
    if (suggestions.length && firstSuggestionChars === null) firstSuggestionChars = prefix.length;
    const top = suggestions[0] || null;
    if (top) finalTop = top;
    const exactTop = top ? exactMatch(testCase, top) : false;
    const resolvableTop = top ? resolvableMatch(testCase, top) : false;
    if (exactTop && firstExactTopChars === null) firstExactTopChars = prefix.length;
    if (resolvableTop && firstResolvableTopChars === null) firstResolvableTopChars = prefix.length;
    if (top && !resolvableTop && firstResolvableTopChars === null) wrongTopBeforeResolvable = true;
    if (resolvableTop && prefix.length <= MAX_PREFIX) break;
  }
  return {
    firstSuggestionChars,
    firstExactTopChars,
    firstResolvableTopChars,
    wrongTopBeforeResolvable,
    elapsedMs: Date.now() - started,
    finalTopLabel: finalTop?.label || "",
    finalEntryType: finalTop?.entry_type || "",
    finalRefineRequired: Boolean(Number(finalTop?.refine_required || 0)),
    finalTopExact: finalTop ? exactMatch(testCase, finalTop) : false,
    finalTopResolvable: finalTop ? resolvableMatch(testCase, finalTop) : false,
  };
}

function searchExperiment(db, mode, rawQuery, limit) {
  const needle = normalise(rawQuery);
  if (needle.length < 3) return [];
  if (mode === "prefix") return searchPrefix(db, needle, limit);
  if (mode === "typeahead") return searchTypeahead(db, needle, limit);
  return searchHybrid(db, needle, limit);
}

function searchPrefix(db, needle, limit) {
  return db.prepare(`
    SELECT e.*
    FROM prefix_entries p
    JOIN entries e ON e.entry_id = p.entry_id
    WHERE p.prefix = ?
    ORDER BY p.rank_weight DESC, LENGTH(e.label), e.label
    LIMIT ?
  `).all(needle.slice(0, MAX_PREFIX), limit);
}

function searchHybrid(db, needle, limit) {
  if (queryContainsUnitLikeToken(needle)) return searchTypeahead(db, needle, limit);
  if (!/^\d/.test(needle)) return searchTypeahead(db, needle, limit);
  const prefixRows = searchPrefix(db, needle, limit);
  if (prefixRows.length && !prefixRowsAmbiguous(prefixRows)) return prefixRows;
  return searchTypeahead(db, needle, limit);
}

function searchTypeahead(db, needle, limit) {
  const terms = needle.split(/\s+/).filter(Boolean).slice(0, 8);
  if (!terms.length) return [];
  const ftsQuery = terms.map((term) => `${escapeFtsTerm(term)}*`).join(" ");
  return db.prepare(`
    SELECT e.*
    FROM typeahead_fts f
    JOIN entries e ON e.entry_id = f.entry_id
    WHERE typeahead_fts MATCH ?
    ORDER BY
      CASE
        WHEN e.key_text = ? THEN 0
        WHEN e.key_text LIKE ? THEN 1
        WHEN e.key_text LIKE ? THEN 2
        ELSE 3
      END,
      e.rank_weight DESC,
      rank,
      LENGTH(e.label),
      e.label
    LIMIT ?
  `).all(ftsQuery, needle, `${needle}%`, `% ${needle}%`, limit);
}

function prefixRowsAmbiguous(rows) {
  const strongRows = rows.filter((row) => Number(row.rank_weight || 0) >= 980);
  const signatures = new Set(strongRows.map((row) => row.base_signature).filter(Boolean));
  return signatures.size > 1;
}

function sampleRows(db, total, noisePerSeed) {
  const perState = distribute(total, STATE_ORDER);
  const cases = [];
  const indexRows = [];
  const seen = new Set();
  for (const state of STATE_ORDER) {
    const target = perState[state];
    for (const seed of addressSeedsForState(state)) {
      const rows = db.prepare(`
        SELECT id, label, lat, lon, state, postcode, locality, search_text
        FROM address_fts
        WHERE address_fts MATCH ?
        LIMIT ?
      `).all(ftsQuery(seed), noisePerSeed);
      for (const row of rows) {
        if (row.state !== state || seen.has(row.id) || !addressSampleQualityPass(row)) continue;
        seen.add(row.id);
        indexRows.push(row);
        if (cases.filter((item) => item.state === state).length < target) cases.push(row);
      }
      if (cases.filter((item) => item.state === state).length >= target) break;
    }
    const stateCount = cases.filter((item) => item.state === state).length;
    if (stateCount < target) throw new Error(`Only sampled ${stateCount}/${target} ${state} cases.`);
  }
  return { cases: cases.slice(0, total), indexRows };
}

function parseAddress(label) {
  const parts = String(label || "").split(",").map((part) => part.trim()).filter(Boolean);
  const normalised = normalise(label);
  const unitMatch = normalised.match(/\b(unit|flat|apartment|apt|suite|townhouse|shop|office|level|lvl)\s+([a-z0-9-]+)\b/);
  const streetText = normalised.replace(/\b(unit|flat|apartment|apt|suite|townhouse|shop|office|level|lvl)\s+[a-z0-9-]+\b/g, " ");
  const streetMatch = streetText.match(/\b(\d+[a-z]?(?:-\d+[a-z]?)?)\s+([a-z0-9 ]+?)\s+(street|road|avenue|drive|highway|terrace|circuit|way|lane|place|court|crescent|boulevard|parade|parkway|esplanade|square)\b/);
  const stateMatch = normalised.match(/\b(nsw|act|qld|vic|wa|sa|tas|nt)\b/);
  const postcodeMatch = normalised.match(/\b(\d{4})\b/);
  if (!streetMatch || !stateMatch) return null;
  const beforeState = normalised.slice(0, normalised.lastIndexOf(` ${stateMatch[1]}`)).trim();
  const locality = beforeState.split(/\b(?:street|road|avenue|drive|highway|terrace|circuit|way|lane|place|court|crescent|boulevard|parade|parkway|esplanade|square)\b/).pop()?.trim() || "";
  const street = `${streetMatch[1]} ${streetMatch[2].trim()} ${streetMatch[3]}`;
  const baseKey = [street, locality, stateMatch[1], postcodeMatch?.[1] || ""].filter(Boolean).join(" ");
  return {
    baseKey,
    baseSignature: baseKey,
    building: parts.length >= 4 ? normalise(parts[0]) : "",
    unit: unitMatch?.[2] || "",
    unitText: unitMatch ? `${unitMatch[1]} ${unitMatch[2]}` : "",
  };
}

function exactMatch(testCase, suggestion) {
  return normalise(testCase.label) === normalise(suggestion?.label);
}

function resolvableMatch(testCase, suggestion) {
  if (exactMatch(testCase, suggestion)) return true;
  const expected = parseAddress(testCase.label);
  const actual = parseAddress(suggestion?.label);
  if (!expected || !actual) return false;
  if (expected.baseSignature !== actual.baseSignature) return false;
  if (!expected.unit) return true;
  return Boolean(Number(suggestion?.refine_required || 0));
}

function compactPrefixes(value) {
  const text = normalise(value);
  const prefixes = new Set();
  for (const length of [4, 6, 8, 10, 12, MAX_PREFIX]) {
    if (length <= text.length) prefixes.add(text.slice(0, length));
  }
  return [...prefixes].filter((prefix) => prefix.length >= 4);
}

function shouldMaterialisePrefix(entry) {
  return entry.rankWeight >= 980 && (entry.entryType === "base_refine" || String(entry.entryId).endsWith(":exact:base"));
}

function prefixesFor(query) {
  const text = String(query || "").trim();
  const lengths = new Set([3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 26, 30, 34, 38, 42, text.length]);
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === " ") lengths.add(index + 1);
  }
  return [...lengths]
    .filter((length) => length >= 3 && length <= text.length)
    .sort((left, right) => left - right)
    .map((length) => text.slice(0, length));
}

function summarise(results, sourceRows) {
  const exact = results.map((row) => row.firstExactTopChars).filter(Number.isFinite);
  const resolvable = results.map((row) => row.firstResolvableTopChars).filter(Number.isFinite);
  const elapsed = results.map((row) => row.elapsedMs).filter(Number.isFinite);
  const units = results.filter((_, index) => parseAddress(sourceRows[index].label)?.unit);
  return {
    cases: results.length,
    finalExactTop: results.filter((row) => row.finalTopExact).length,
    finalResolvableTop: results.filter((row) => row.finalTopResolvable).length,
    wrongTopBeforeResolvable: results.filter((row) => row.wrongTopBeforeResolvable).length,
    p50ExactTopChars: percentile(exact, 50),
    p90ExactTopChars: percentile(exact, 90),
    p95ExactTopChars: percentile(exact, 95),
    p50ResolvableTopChars: percentile(resolvable, 50),
    p90ResolvableTopChars: percentile(resolvable, 90),
    p95ResolvableTopChars: percentile(resolvable, 95),
    p50ElapsedMs: percentile(elapsed, 50),
    p95ElapsedMs: percentile(elapsed, 95),
    unitCases: units.length,
    unitP90ResolvableTopChars: percentile(units.map((row) => row.firstResolvableTopChars).filter(Number.isFinite), 90),
  };
}

function summariseBySegment(rows, mode) {
  return Object.fromEntries(
    [...new Set(rows.map((row) => row.segment || "standard"))]
      .sort()
      .map((segment) => [segment, summarise(rows.filter((row) => row.segment === segment).map((row) => row[mode]), rows.filter((row) => row.segment === segment))]),
  );
}

function addressSegment(row) {
  const parsed = parseAddress(row.label);
  const ruralRemote = ruralRemoteLocality(row.locality, row.state, row.label);
  if (parsed?.unit && ruralRemote) return "rural_remote_unit";
  if (parsed?.unit) return "unit_or_building";
  if (ruralRemote) return "rural_remote";
  return "standard";
}

function ruralRemoteLocality(locality, state, label) {
  const text = normalise(`${locality || ""} ${state || ""} ${label || ""}`);
  return /\b(alice springs|albany|austins ferry|broome|burnie|coober pedy|devonport|geraldton|humpty doo|kalgoorlie|karratha|katherine|longreach|mount gambier|nhulunbuy|orange|palmerston city|port lincoln|queenstown|renmark|smithton|tamworth|tennant creek|ulverstone|victor harbor|wagga wagga|whyalla|yulara)\b/.test(text);
}

function addressSeedsForState(state) {
  const base = {
    NSW: ["balgowlah heights nsw", "sylvania nsw", "sydney nsw", "parramatta nsw", "newcastle nsw", "wollongong nsw", "tamworth nsw", "orange nsw", "wagga wagga nsw"],
    ACT: ["canberra act", "tuggeranong act", "belconnen act", "gungahlin act", "phillip act", "kingston act", "isabella plains act", "dickson act"],
    VIC: ["melbourne vic", "geelong vic", "ballarat vic", "bendigo vic", "hoppers crossing vic", "shepparton vic", "wodonga vic", "traralgon vic"],
    QLD: ["mount ommaney qld", "brisbane qld", "cairns qld", "townsville qld", "longreach qld", "toowoomba qld", "mackay qld", "rockhampton qld"],
    WA: ["perth wa", "karratha wa", "broome wa", "west leederville wa", "albany wa", "geraldton wa", "bunbury wa", "kalgoorlie wa"],
    SA: ["clarence gardens sa", "adelaide sa", "mount gambier sa", "coober pedy sa", "port lincoln sa", "whyalla sa", "renmark sa", "victor harbor sa"],
    TAS: ["hobart tas", "launceston tas", "queenstown tas", "austins ferry tas", "devonport tas", "burnie tas", "ulverstone tas", "smithton tas"],
    NT: ["darwin nt", "alice springs nt", "palmerston city nt", "tennant creek nt", "katherine nt", "nhulunbuy nt", "yulara nt", "humpty doo nt"],
  };
  const seeds = base[state] || [`${state.toLowerCase()}`];
  if (PROFILE !== "rural-unit") return seeds;
  const ruralFirst = {
    NSW: ["tamworth nsw", "orange nsw", "wagga wagga nsw", "newcastle nsw", "wollongong nsw"],
    ACT: ["tuggeranong act", "belconnen act", "gungahlin act", "isabella plains act"],
    VIC: ["wodonga vic", "traralgon vic", "shepparton vic", "bendigo vic", "ballarat vic"],
    QLD: ["longreach qld", "townsville qld", "cairns qld", "mackay qld", "rockhampton qld", "toowoomba qld"],
    WA: ["karratha wa", "broome wa", "albany wa", "geraldton wa", "bunbury wa", "kalgoorlie wa"],
    SA: ["coober pedy sa", "mount gambier sa", "port lincoln sa", "whyalla sa", "renmark sa", "victor harbor sa"],
    TAS: ["queenstown tas", "austins ferry tas", "devonport tas", "burnie tas", "ulverstone tas", "smithton tas"],
    NT: ["alice springs nt", "tennant creek nt", "katherine nt", "nhulunbuy nt", "yulara nt", "humpty doo nt"],
  };
  return [...new Set([...(ruralFirst[state] || []), ...seeds])];
}

function addressSampleQualityPass(row) {
  const label = String(row.label || "");
  if (!label || label.length > 140) return false;
  if (!Number.isFinite(Number(row.lat)) || !Number.isFinite(Number(row.lon))) return false;
  if (!row.postcode || !row.locality) return false;
  return /\d/.test(label) && /\b(NSW|ACT|VIC|QLD|WA|SA|TAS|NT)\b/.test(label);
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function ftsQuery(seed) {
  return String(seed || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((term) => `${escapeFtsTerm(term)}*`)
    .join(" ");
}

function escapeFtsTerm(value) {
  return String(value).replace(/["']/g, " ").replace(/[^\p{L}\p{N}_-]+/gu, " ").trim();
}

function normalise(value) {
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

function queryContainsUnitLikeToken(needle) {
  const terms = new Set(["apartment", "apt", "flat", "level", "lvl", "office", "shop", "suite", "townhouse", "unit"]);
  return normalise(needle).split(/\s+/).some((token) => terms.has(token));
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

function distribute(total, states) {
  const base = Math.floor(total / states.length);
  const remainder = total % states.length;
  return Object.fromEntries(states.map((state, index) => [state, base + (index < remainder ? 1 : 0)]));
}

function fileEvidence(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return {
      path: filePath,
      sizeBytes: stat.size,
      sizeMb: Number((stat.size / 1024 / 1024).toFixed(1)),
    };
  } catch {
    return { path: filePath, sizeBytes: null, sizeMb: null };
  }
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = values[index + 1];
    if (!next || next.startsWith("--")) result[key] = "1";
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}
