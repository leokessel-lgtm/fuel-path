# Address Typeahead Prefix Experiment - 22 June 2026

## TLDR

The tested P90 target is now achieved in sampled stress runs, but not yet proven on a rebuilt full national index:

- rebuilt typeahead FTS is the practical win: sampled hybrid/typeahead P90 is 10 typed characters overall
- rural/unit-weighted sampled P90 is 10 overall and unit P90 is 12
- compact prefix is only safe as a narrow house-number-first fast path
- building-name, street-name and unit-like input must use typeahead fallback to avoid wrong base suggestions
- a 994,401-row 8-state compact build now fits in 925 MB, but a full national rebuild is still not proven

Compact prefix alone is not safe enough. It is fast and reaches low P90 on successful cases, but it can silently pick the wrong locality, sibling unit/shop or same-name building when the first 15 characters are ambiguous.

## Why This Exists

The previous benchmark showed the current 12 GB national SQLite path is accurate but too slow and too late:

- current address P90 is about 26 to 30 typed characters
- current unit/building P90 is about 30, with long P95 tails
- large-index prefix probing has poor latency because it searches the broad G-NAF FTS table

This experiment compares two local-first options before changing production lookup:

1. rebuilt typeahead-specific index
2. compact prefix table

## Harness

Script:

- `scripts/address-typeahead-experiment.mjs`

Repeat command:

```sh
npm run experiment:address-typeahead -- --address-count 700 --noise-per-seed 300 --run-id 2026-06-22-typeahead-prefix-hybrid-700-rankfix
```

Main artefact:

- `tmp/address-typeahead-experiment-2026-06-22-typeahead-prefix-hybrid-700-rankfix.json`

Run shape:

- Source: `data/gnaf/build/gnaf-addresses-national.sqlite`
- Cases: 700 address cases
- Experiment index rows: 2,362 sampled rows
- Experiment SQLite: about 12 MB
- External providers: not used

## Results

| Option | Final exact top | Final resolvable top | Resolvable P50 | Resolvable P90 | Resolvable P95 | Unit resolvable P90 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rebuilt typeahead FTS | 647/700 | 700/700 | 5 | 10 | 10 | 10 | 14 ms |
| Compact prefix table | 641/700 | 694/700 | 4 | 10 | 10 | 10 | 6 ms |
| Hybrid prefix + typeahead fallback | 647/700 | 700/700 | 5 | 10 | 10 | 10 | 18 ms |

Interpretation:

- Both rebuilt typeahead and hybrid hit the P90 15 target on this sampled experiment.
- Compact prefix alone also hits P90 10 on successful cases, but it misses final resolvability for 6/700 cases.
- Hybrid keeps the compact prefix speed advantage for unambiguous prefixes and uses typeahead to recover ambiguity.

## Safety Findings

Compact prefix alone failed on cases like:

- `279 Canberra Avenue, Symonston ACT 2609` being outranked by `279 Canberra Avenue, Fyshwick ACT 2609`
- unit/shop-heavy centre addresses where the first 15 characters do not identify the exact unit or shop
- same-site sibling addresses where a prefix row can pick a plausible but wrong exact address

That is not acceptable for route planning. If the prefix table cannot prove one safe base, it must not produce a one-tap exact route target.

## Recommendation

Build the combination:

1. Compact prefix table for prefixes up to 15 characters.
2. Store base signatures for prefix rows.
3. Use prefix rows only when candidate base signatures are unambiguous.
4. For unit/building/shop/office/level records, return `refine_required` base rows unless the typed text identifies the exact unit.
5. Fall back to rebuilt typeahead FTS when the compact prefix is ambiguous, sparse or needs full-query disambiguation.
6. Keep exact unit P90 separate from resolvable P90 in benchmarks.

Decision:

- Not prefix-only.
- Not the current broad G-NAF FTS.
- A rebuilt typeahead index is required.
- A compact prefix table is still valuable as the fast path.

## Caveats

- This is a sampled experiment, not a full national rebuild.
- The sampled index is much smaller than the 12 GB national SQLite, so the exact latency numbers are directional.
- The result proves the design direction, not production readiness.
- A full national typeahead/prefix build still needs size, build-time and lookup benchmarks.

## Next Build Step

Create the production-shaped local index:

- `address_typeahead_entries`
- `address_prefix_entries`
- shared `base_signature`
- explicit `entry_type`: `exact`, `base_refine`, `street`, `locality`
- explicit `refine_required`

Then rerun:

- 700 address benchmark
- 1000 address-only benchmark
- unit/building/shop tail report
- latency P50/P95
- wrong-top-before-resolvable count

## Production Build Pass

Implemented after the initial experiment:

- `scripts/build-gnaf-address-index.mjs` now builds `address_typeahead_entries`, `address_typeahead_fts` and `address_prefix_entries`.
- `scripts/build-gnaf-raw-address-index.mjs` now builds the same hybrid tables for the full raw G-NAF ZIP path.
- `api/_addressIndex.js` detects those tables and uses the hybrid retrieval path before falling back to the old broad `address_fts` search.
- Hybrid rule: use compact prefix rows only when high-confidence candidates share one base signature; otherwise fall back to typeahead FTS.
- Unit/shop/office/level-style queries go straight to typeahead so typed exact units are not hidden behind a base-building row.

Regression coverage:

- same number and street in different localities: `279 Canberra Avenue, Symonston ACT 2609` must not resolve to Fyshwick
- complex unit intent: `Canberra Lakes Estate Unit 65 ...` must not resolve to Unit 8
- base building suggestions may surface only as `refine_required`

## Current Production-Shaped Iteration

Artefact:

- `tmp/address-typeahead-experiment-2026-06-22-hybrid-leanprefix-balanced-1000.json`

Result:

| Option | Final exact top | Final resolvable top | Resolvable P50 | Resolvable P90 | Resolvable P95 | Unit P90 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rebuilt typeahead FTS | 938/1000 | 1000/1000 | 4 | 10 | 10 | 10 | 11 ms |
| Compact prefix table | 547/1000 | 610/1000 | 4 | 8 | 8 | 8 | 1 ms |
| Hybrid prefix + typeahead fallback | 938/1000 | 1000/1000 | 4 | 10 | 10 | 10 | 11 ms |

Notes:

- Prefix rows are now stored only at checkpoints: 4, 8, 12 and 15 typed characters.
- Hybrid now uses materialised prefix only for house-number-first input.
- Unit-like input goes straight to typeahead so exact unit intent is preserved.
- Building-name and street-name input goes straight to typeahead after a wrong-base regression was found with `Islamic School Of Canberra`.
- Prefix-only is no longer a candidate. Its low P90 is misleading because it only resolves 610/1000 cases.
- Experiment index size fell from 5.4 MB to 2.7 MB after checkpointing, removing builder-only persisted fields, switching compact tables to `WITHOUT ROWID`, storing `key_text` only in FTS and dropping intermediate 6/10-char prefix checkpoints.

## Wide Stress - Rural and Unit Weighted 1000

Artefact:

- `tmp/address-typeahead-experiment-2026-06-22-hybrid-leanprefix-rural-unit-1000.json`

Result:

| Option | Final exact top | Final resolvable top | Resolvable P50 | Resolvable P90 | Resolvable P95 | Unit P90 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rebuilt typeahead FTS | 981/1000 | 1000/1000 | 5 | 10 | 12 | 12 | 8 ms |
| Compact prefix table | 548/1000 | 567/1000 | 4 | 8 | 8 | 8 | 1 ms |
| Hybrid prefix + typeahead fallback | 981/1000 | 1000/1000 | 5 | 10 | 12 | 12 | 8 ms |

Hybrid segment breakdown:

| Segment | Cases | Final exact top | Final resolvable top | Resolvable P90 | Resolvable P95 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rural/remote | 544 | 544 | 544 | 8 | 8 | 2 ms |
| Rural/remote unit | 206 | 196 | 206 | 12 | 12 | 9 ms |
| Standard | 183 | 183 | 183 | 6 | 15 | 2 ms |
| Unit/building | 67 | 58 | 67 | 15 | 18 | 9 ms |

The headline is stable: rural and unit-weighted hybrid remains 1000/1000 final resolvable, with P90 10 and unit P90 12. The small generic unit/building segment is still the tail: P90 15, P95 18.

## National Build Attempt And Size Check

Full raw national build attempt:

- command: `node scripts/build-gnaf-raw-address-index.mjs --output data/gnaf/build/gnaf-addresses-national-hybrid.sqlite`
- stopped after ACT and the first 1,000,000 NSW rows, 1,282,553 rows total
- observed size before stopping: SQLite 7.4 GB plus WAL 2.6 GB
- reason stopped: the initial hybrid schema duplicated labels, coordinates, state, postcode and locality across typeahead rows, and extrapolated far beyond the available disk budget

Slim schema changes now applied:

- `address_typeahead_entries` now stores key/display metadata and joins back to `addresses` for canonical label, coordinates and state fields
- `address_typeahead_fts` no longer duplicates label/state/postcode payload columns
- base/refine entries are grouped per base address instead of per unit
- materialised prefix rows are limited to high-confidence exact-base and base/refine entries at fixed checkpoints only
- redundant prefix index removed because the primary key starts with `prefix`
- hybrid runtime avoids materialised prefix for building-name and street-name input
- exact address suggestions are deduped across multiple typeahead keys
- raw and seed builders support `--omit-legacy-fts` for hybrid-only size testing
- raw and seed builders support `--omit-search-backstop` for compact runtime-only index testing
- persisted `prefix_key`, the unused base-signature index and optional search backstop columns are removed in compact modes
- exact typeahead entries no longer duplicate display title/subtitle already held on the canonical address row
- compact key tables now use `WITHOUT ROWID`
- `key_text` is stored only in the FTS table, not duplicated in `address_typeahead_entries`
- checkpoint prefix hits still report `address_prefix` when the typed query extends beyond the stored checkpoint
- prefix checkpoints are now 4, 8, 12 and 15 only; 6 and 10 were removed after stress testing showed hybrid P90 held
- number-first token-overlap fallback now rejects different civic street numbers, while preserving explicit slash/unit matches such as `8/21`

Measured samples:

| Sample | Command shape | Size | Prefix entries | Legacy broad FTS |
| --- | --- | ---: | ---: | --- |
| Slim dense prefixes | `--states ACT --limit-per-state 100000` | 345 MB | 1,061,281 | yes |
| Checkpoint prefixes | `--states ACT --limit-per-state 100000` | 290 MB | 489,822 | yes |
| Checkpoint hybrid-only | `--states ACT --limit-per-state 100000 --omit-legacy-fts` | 215 MB | 489,822 | no |
| Compact runtime-only | `--states ACT --limit-per-state 100000 --omit-legacy-fts --omit-search-backstop` | 141 MB | 489,822 | no |
| Display/rowid trimmed runtime-only | `--states ACT --limit-per-state 100000 --omit-legacy-fts --omit-search-backstop` | 107 MB | 489,822 | no |
| 8-state compact runtime sample | `--states ACT,NSW,NT,QLD,SA,TAS,VIC,WA --limit-per-state 25000 --omit-legacy-fts --omit-search-backstop` | 227 MB | 1,028,058 | no |
| Key-trim runtime-only | `--states ACT --limit-per-state 100000 --omit-legacy-fts --omit-search-backstop` | 98 MB | 489,822 | no |
| 8-state key-trim runtime sample | `--states ACT,NSW,NT,QLD,SA,TAS,VIC,WA --limit-per-state 25000 --omit-legacy-fts --omit-search-backstop` | 208 MB | 1,028,058 | no |
| Lean-prefix runtime-only | `--states ACT --limit-per-state 100000 --omit-legacy-fts --omit-search-backstop` | 90 MB | 326,548 | no |
| 8-state lean-prefix runtime sample | `--states ACT,NSW,NT,QLD,SA,TAS,VIC,WA --limit-per-state 25000 --omit-legacy-fts --omit-search-backstop` | 191 MB | 685,372 | no |
| 8-state lean-prefix runtime sample | `--states ACT,NSW,NT,QLD,SA,TAS,VIC,WA --limit-per-state 125000 --omit-legacy-fts --omit-search-backstop` | 925 MB | 3,281,932 | no |

The lean-prefix runtime-only sample was probed directly with `FUEL_PATH_GNAF_SQLITE_PATH=tmp/gnaf-act-hybrid-runtime-leanprefix-100k.sqlite`. It returned ACT address and unit/building suggestions without `address_fts`, `search_key` or `search_text`, including deduped exact unit results, correct title/subtitle fallback and `address_prefix` evidence for checkpoint prefix hits.

Larger compact build evidence:

- file: `tmp/gnaf-8state-hybrid-runtime-leanprefix-1m.sqlite`
- total address rows: 994,401
- state rows: ACT 125,000; NSW 125,000; NT 119,401; QLD 125,000; SA 125,000; TAS 125,000; VIC 125,000; WA 125,000
- SQLite size: 925 MB
- `addresses`: 994,401 rows, about 227 MB
- `address_typeahead_entries`: 2,078,060 rows, about 231 MB
- `address_prefix_entries`: 3,281,932 rows, about 165 MB
- `address_typeahead_fts`: 2,078,060 rows, with FTS content about 200 MB and FTS data about 74 MB
- prefix checkpoints: 820,483 rows at each of 4, 8, 12 and 15 characters

Runtime probe against this 994k-row compact build:

- `40 Unwin Street Weston ACT` returned the matching address prefix.
- `Unit 1 33 Heysen Street Weston ACT` returned the exact unit first and a `refine_required` base row second.
- `8 Queen Street Brisbane QLD` returned no local suggestion in the sample rather than falsely returning `Shop 8, 110 Queen Street`.
- `10 Smith Street Darwin NT` returned no local suggestion in the sample rather than falsely returning `100 Smith Street`.
- `1 Hannan Street Kalgoorlie WA` returned the matching address prefix.
- `125 George Street Sydney NSW` returned no local suggestion because the exact address was not in the 125k NSW sample.

Hosted-contract benchmark against this 994k-row compact build:

- artefact: `tmp/geocode-hosted-national-benchmark-2026-06-22-compact-1m-hosted-address-800.json`
- mode: module, local compact SQLite, POIs disabled, external provider blocked
- cases: 800 addresses, 100 per state
- final top match: 800/800
- final resolvable top: 800/800
- exact/resolvable P50/P90/P95: 10 / 15 / 18
- any-useful-match P50/P90/P95: 10 / 12 / 12
- unit address exact/resolvable P50/P90/P95: 12 / 15 / 15
- latency P50/P95: 62 ms / 808 ms

Corrected rural/unit hosted-contract benchmark:

- artefact: `tmp/geocode-hosted-national-benchmark-2026-06-22-compact-1m-hosted-rural-unit-corrected-800.json`
- profile: `rural-unit`
- important correction: compact fallback sampling now scopes locality seed matches by state instead of allowing `OR state = ?`, which had made an earlier profile run behave like the balanced sample
- cases: 800 addresses, including 198 unit addresses, 124 lot addresses and 36 range addresses
- final top match: 800/800
- final resolvable top: 800/800
- exact/resolvable P50/P90/P95: 10 / 18 / 18
- any-useful-match P50/P90/P95: 10 / 12 / 12
- unit address exact/resolvable P50/P90/P95: 12 / 15 / 15
- unit/building family exact/resolvable P50/P90/P95: 12 / 15 / 18
- latency P50/P95: 127 ms / 927 ms

Brutal read on the hosted-contract runs:

- The balanced hosted-contract run meets the P90 15 target exactly.
- The corrected rural/unit hosted-contract run does not meet an exact-top P90 15 target overall; it lands at P90 18.
- The rural/unit miss is concentrated in standard rural street and range addresses where the typed text has not yet included enough locality/context to safely choose between same-number/same-street candidates.
- Unit/building remains within the target on the corrected rural/unit run: P90 15, final top 198/198 for unit addresses.
- The useful suggestion is usually present earlier: any-useful-match P90 is 12 in both hosted-contract runs. That is not the same as top exact/resolvable, so it must not be overclaimed.
- The next product-level improvement is not more blind ranking; it is route/current-region boost evidence that can safely promote the local candidate before the user types the locality.

Rejected storage experiment:

- Prefix dictionary table: storing unique prefix strings once and referencing them by numeric id increased the ACT 100k sample from 98 MB to 108 MB.
- Reason: the unique prefix index cost more than it saved because distinct prefixes were high: 378,557 distinct prefixes from 489,822 prefix rows in the ACT 100k sample.
- Decision: keep direct prefix strings in `address_prefix_entries`.

Brutal read:

- 90 MB per 100k ACT rows, 191 MB per 200k across 8 states and 925 MB per 994k across 8 states are real improvements, but still project to a large national runtime SQLite.
- The 994k 8-state sample reduces the risk that the size estimate is ACT-only, but it is still a sample rather than a full 16.9M-row build.
- The current code is functionally better and safer, but the full national hybrid index is not production-proven yet.
- The next storage win is to reduce FTS/typeahead duplication or split the mobile/runtime index from the benchmark/sampling index.

## Safety Rerun After Civic-Number Guard

The manual 994k-row probe found a real safety issue: number-first queries could fall back to token-overlap rows with a different civic street number when the exact address was absent from the sample.

Examples fixed:

- `8 Queen Street Brisbane QLD` no longer returns `Shop 8, 110 Queen Street, Brisbane City QLD 4000`.
- `10 Smith Street Darwin NT` no longer returns `100 Smith Street` or `101 Smith Street`.
- Slash/unit shorthand such as `8/21 Lanyon Drive` still resolves because the guard recognises explicit unit number plus street number labels.
- Range addresses such as `123-131 Canberra Avenue` are treated as ranged street numbers, not slash/unit shorthand.

Balanced safety rerun:

- artefact: `tmp/address-typeahead-experiment-2026-06-22-hybrid-leanprefix-safety2-balanced-1000.json`
- source index: `data/gnaf/build/gnaf-addresses-national.sqlite`, 11,959.9 MB
- experiment index: 1.9 MB

| Metric | Hybrid result |
| --- | ---: |
| Cases | 1000 |
| Final exact top | 934/1000 |
| Final resolvable top | 1000/1000 |
| Wrong top before resolvable | 534 |
| Exact P50/P90/P95 | 5 / 10 / 10 |
| Resolvable P50/P90/P95 | 4 / 10 / 10 |
| Unit resolvable P90 | 10 |
| Latency P50/P95 | 1 ms / 9 ms |

Rural/unit safety rerun:

- artefact: `tmp/address-typeahead-experiment-2026-06-22-hybrid-leanprefix-safety2-rural-unit-1000.json`
- experiment index: 2.0 MB

| Metric | Hybrid result |
| --- | ---: |
| Cases | 1000 |
| Final exact top | 981/1000 |
| Final resolvable top | 1000/1000 |
| Wrong top before resolvable | 526 |
| Exact P50/P90/P95 | 4 / 10 / 10 |
| Resolvable P50/P90/P95 | 4 / 10 / 10 |
| Unit resolvable P90 | 12 |
| Latency P50/P95 | 0 ms / 6 ms |

Rural/unit segment breakdown:

| Segment | Cases | Final exact top | Final resolvable top | Resolvable P90 | Resolvable P95 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rural/remote | 561 | 561 | 561 | 8 | 8 | 1 ms |
| Rural/remote unit | 184 | 174 | 184 | 10 | 12 | 7 ms |
| Standard | 187 | 187 | 187 | 5 | 15 | 2 ms |
| Unit/building | 68 | 59 | 68 | 15 | 15 | 8 ms |

## Brutal Critique

What improved:

- The local SQLite builders now create production-shaped typeahead and optional prefix tables.
- Hybrid/typeahead achieves the target on sampled stress: P90 10 overall, P90 10 balanced unit cases and P90 12 rural/unit-weighted unit cases.
- The runtime no longer treats building/base suggestions as exact route targets; `refine_required` survives into suggestions.
- Exact address duplicates from multiple typeahead keys are removed in the runtime.
- The benchmark now reports exact top, resolvable top, wrong-top-before-resolvable, unit P90, latency and index size.
- A wrong building-name prefix regression was found and fixed by routing non-number-first input through typeahead.
- A wrong civic-number fallback regression was found and fixed for number-first token-overlap matches.
- Checkpointing reduced the ACT 100k sample from 345 MB to 290 MB, hybrid-only/no-legacy-FTS reduced it to 215 MB, compact runtime-only reduced it to 141 MB, display/rowid trimming reduced it to 107 MB, key trimming reduced it to 98 MB, and lean prefix checkpoints reduced it to 90 MB.
- The 994,401-row 8-state compact runtime sample came in at 925 MB and passed direct fail-safe probes for missing exact number-first addresses.

What remains weak:

- The existing 12 GB national SQLite file on disk has not been rebuilt with the new hybrid tables. Until it is rebuilt, the live local-national path still falls back to the older broad FTS path.
- Exact top and resolvable top are now deliberately different for unit/building cases. That is safer, but the UI must continue to prevent one-tap routing from `refine_required` rows.
- The stress harness samples from the national SQLite and the largest compact 8-state build samples 994,401 rows; neither proves full 16.9M-row production size, build time or disk footprint.
- Prefix-only continues to fail safety cases: wrong locality, wrong street number, sibling unit/shop and same-site building aliases.
- The compact runtime-only index is smaller, but removing search backstop columns means benchmark sampling needs a slower label/locality/postcode fallback.
- Generic unit/building P90 is exactly 15 in the rural/unit-weighted safety rerun. That meets the target, but leaves little margin and the tail is not fully solved.
- `wrongTopBeforeResolvable` is still high in the typed-prefix harness because many short prefixes are inherently ambiguous before enough context arrives. This is acceptable only if UI state treats those rows as suggestions, not route commitments.

Next:

- Compress FTS/typeahead duplication before another full national rebuild.
- Rebuild the full national SQLite only after accepting the likely high-teens-GB runtime footprint, or after another FTS/typeahead compression pass.
- Measure full-size index bytes, build time and lookup P50/P95 once rebuilt.
- Run the hosted national benchmark against the rebuilt full index, not just the sampled experiment harness.
- Add a Plan/Nearby UI smoke case for `refine_required` rows so route submission cannot regress.
