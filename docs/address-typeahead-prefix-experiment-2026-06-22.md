# Address Typeahead Prefix Experiment - 22 June 2026

## TLDR

The tested P90 target is now achieved in sampled stress runs, but not yet proven on a rebuilt full national index:

- rebuilt typeahead FTS is the practical win: sampled hybrid/typeahead P90 is 10 typed characters overall
- rural/unit-weighted sampled P90 is 10 overall and unit P90 is 12
- compact prefix is only safe as a narrow house-number-first fast path
- building-name, street-name and unit-like input must use typeahead fallback to avoid wrong base suggestions
- full national rebuild remains blocked by index size until the prefix table is reduced further or made optional

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

- `tmp/address-typeahead-experiment-2026-06-22-hybrid-compact-runtime-balanced-1000.json`

Result:

| Option | Final exact top | Final resolvable top | Resolvable P50 | Resolvable P90 | Resolvable P95 | Unit P90 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rebuilt typeahead FTS | 938/1000 | 1000/1000 | 4 | 10 | 10 | 10 | 14 ms |
| Compact prefix table | 550/1000 | 613/1000 | 4 | 6 | 8 | 8 | 1 ms |
| Hybrid prefix + typeahead fallback | 938/1000 | 1000/1000 | 4 | 10 | 10 | 10 | 14 ms |

Notes:

- Prefix rows are now stored only at checkpoints: 4, 6, 8, 10, 12 and 15 typed characters.
- Hybrid now uses materialised prefix only for house-number-first input.
- Unit-like input goes straight to typeahead so exact unit intent is preserved.
- Building-name and street-name input goes straight to typeahead after a wrong-base regression was found with `Islamic School Of Canberra`.
- Prefix-only is no longer a candidate. Its low P90 is misleading because it only resolves 613/1000 cases.
- Experiment index size fell from 5.4 MB to 3.6 MB after checkpointing and removing builder-only persisted fields.

## Wide Stress - Rural and Unit Weighted 1000

Artefact:

- `tmp/address-typeahead-experiment-2026-06-22-hybrid-compact-runtime-rural-unit-1000.json`

Result:

| Option | Final exact top | Final resolvable top | Resolvable P50 | Resolvable P90 | Resolvable P95 | Unit P90 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rebuilt typeahead FTS | 981/1000 | 1000/1000 | 5 | 10 | 12 | 12 | 8 ms |
| Compact prefix table | 550/1000 | 569/1000 | 4 | 6 | 6 | 6 | 1 ms |
| Hybrid prefix + typeahead fallback | 981/1000 | 1000/1000 | 5 | 10 | 12 | 12 | 8 ms |

Hybrid segment breakdown:

| Segment | Cases | Final exact top | Final resolvable top | Resolvable P90 | Resolvable P95 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rural/remote | 544 | 544 | 544 | 8 | 8 | 2 ms |
| Rural/remote unit | 206 | 196 | 206 | 12 | 12 | 10 ms |
| Standard | 183 | 183 | 183 | 6 | 15 | 2 ms |
| Unit/building | 67 | 58 | 67 | 15 | 18 | 10 ms |

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

Measured samples:

| Sample | Command shape | Size | Prefix entries | Legacy broad FTS |
| --- | --- | ---: | ---: | --- |
| Slim dense prefixes | `--states ACT --limit-per-state 100000` | 345 MB | 1,061,281 | yes |
| Checkpoint prefixes | `--states ACT --limit-per-state 100000` | 290 MB | 489,822 | yes |
| Checkpoint hybrid-only | `--states ACT --limit-per-state 100000 --omit-legacy-fts` | 215 MB | 489,822 | no |
| Compact runtime-only | `--states ACT --limit-per-state 100000 --omit-legacy-fts --omit-search-backstop` | 141 MB | 489,822 | no |

The compact runtime-only sample was probed directly with `FUEL_PATH_GNAF_SQLITE_PATH=tmp/gnaf-act-hybrid-runtime-compact-100k.sqlite`. It returned ACT address and unit/building suggestions without `address_fts`, `search_key` or `search_text`, including deduped exact unit results.

Brutal read:

- 141 MB per 100k ACT rows is a real improvement but still too high to treat as production-cleared without a larger multi-state build.
- ACT is not a perfect national proxy, but the size signal is strong enough to avoid another full build without more compression.
- The current code is functionally better and safer, but the full national hybrid index is not production-proven yet.
- The next storage win is to reduce FTS/typeahead duplication or split the mobile/runtime index from the benchmark/sampling index.

## Brutal Critique

What improved:

- The local SQLite builders now create production-shaped typeahead and optional prefix tables.
- Hybrid/typeahead achieves the target on sampled stress: P90 10 overall, P90 10 balanced unit cases and P90 12 rural/unit-weighted unit cases.
- The runtime no longer treats building/base suggestions as exact route targets; `refine_required` survives into suggestions.
- Exact address duplicates from multiple typeahead keys are removed in the runtime.
- The benchmark now reports exact top, resolvable top, wrong-top-before-resolvable, unit P90, latency and index size.
- A wrong building-name prefix regression was found and fixed by routing non-number-first input through typeahead.
- Checkpointing reduced the ACT 100k sample from 345 MB to 290 MB, hybrid-only/no-legacy-FTS reduced it to 215 MB, and compact runtime-only reduced it to 141 MB.

What remains weak:

- The existing 12 GB national SQLite file on disk has not been rebuilt with the new hybrid tables. Until it is rebuilt, the live local-national path still falls back to the older broad FTS path.
- Exact top and resolvable top are now deliberately different for unit/building cases. That is safer, but the UI must continue to prevent one-tap routing from `refine_required` rows.
- The stress harness samples from the national SQLite but does not yet prove full 16.9M-row production size, build time or disk footprint.
- Prefix-only continues to fail safety cases: wrong locality, wrong street number, sibling unit/shop and same-site building aliases.
- The compact runtime-only index is smaller, but removing search backstop columns means benchmark sampling needs a slower label/locality/postcode fallback.
- Generic unit/building P95 is still 18 in the rural/unit-weighted run. P90 is inside target, but the tail is not fully solved.

Next:

- Compress FTS/typeahead duplication before another full national rebuild.
- Rebuild the full national SQLite only after the 100k sample projects to an acceptable disk footprint, or deliberately accept the larger server-side index size.
- Measure full-size index bytes, build time and lookup P50/P95 once rebuilt.
- Run the hosted national benchmark against the rebuilt full index, not just the sampled experiment harness.
- Add a Plan/Nearby UI smoke case for `refine_required` rows so route submission cannot regress.
