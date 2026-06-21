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

- `tmp/address-typeahead-experiment-2026-06-22-hybrid-compact-balanced-1000-rerank.json`

Result:

| Option | Final exact top | Final resolvable top | Resolvable P50 | Resolvable P90 | Resolvable P95 | Unit P90 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rebuilt typeahead FTS | 938/1000 | 1000/1000 | 4 | 10 | 10 | 10 | 12 ms |
| Compact prefix table | 562/1000 | 625/1000 | 4 | 6 | 8 | 10 | 1 ms |
| Hybrid prefix + typeahead fallback | 938/1000 | 1000/1000 | 4 | 10 | 10 | 10 | 12 ms |

Notes:

- Hybrid now uses materialised prefix only for house-number-first input.
- Unit-like input goes straight to typeahead so exact unit intent is preserved.
- Building-name and street-name input goes straight to typeahead after a wrong-base regression was found with `Islamic School Of Canberra`.
- Prefix-only is no longer a candidate. Its low P90 is misleading because it only resolves 625/1000 cases.

## Wide Stress - Rural and Unit Weighted 1000

Artefact:

- `tmp/address-typeahead-experiment-2026-06-22-hybrid-compact-rural-unit-1000-rerank.json`

Result:

| Option | Final exact top | Final resolvable top | Resolvable P50 | Resolvable P90 | Resolvable P95 | Unit P90 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rebuilt typeahead FTS | 981/1000 | 1000/1000 | 5 | 10 | 12 | 12 | 7 ms |
| Compact prefix table | 550/1000 | 569/1000 | 4 | 5 | 6 | 3 | 1 ms |
| Hybrid prefix + typeahead fallback | 981/1000 | 1000/1000 | 5 | 10 | 12 | 12 | 7 ms |

Hybrid segment breakdown:

| Segment | Cases | Final exact top | Final resolvable top | Resolvable P90 | Resolvable P95 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
Segment breakdown is captured in the JSON artefact. The headline is stable: rural and unit-weighted hybrid remains 1000/1000 final resolvable, with P90 10 and unit P90 12.

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
- materialised prefix rows are limited to high-confidence exact-base and base/refine entries
- redundant prefix index removed because the primary key starts with `prefix`
- hybrid runtime avoids materialised prefix for building-name and street-name input

Measured slim sample:

- command: `node scripts/build-gnaf-raw-address-index.mjs --states ACT --limit-per-state 100000 --output tmp/gnaf-act-hybrid-slim-100k.sqlite`
- rows: 100,000 addresses
- size: 345 MB
- typeahead entries: 205,068
- prefix entries: 1,061,281
- largest tables: `address_fts_content` 59 MB, `addresses` 58 MB, prefix autoindex 53 MB, prefix table 48 MB

Brutal read:

- 345 MB per 100k ACT rows still extrapolates too high for a comfortable full national SQLite rebuild.
- ACT is not a perfect national proxy, but the size signal is strong enough to avoid another full build without more compression.
- The current code is functionally better and safer, but the full national hybrid index is not production-proven yet.
- The next storage win is to make the prefix table optional or replace it with a smaller fixed-checkpoint/range strategy.

## Brutal Critique

What improved:

- The local SQLite builders now create production-shaped typeahead and optional prefix tables.
- Hybrid/typeahead achieves the target on sampled stress: P90 10 overall, P90 10 balanced unit cases and P90 12 rural/unit-weighted unit cases.
- The runtime no longer treats building/base suggestions as exact route targets; `refine_required` survives into suggestions.
- The benchmark now reports exact top, resolvable top, wrong-top-before-resolvable, unit P90, latency and index size.
- A wrong building-name prefix regression was found and fixed by routing non-number-first input through typeahead.

What remains weak:

- The existing 12 GB national SQLite file on disk has not been rebuilt with the new hybrid tables. Until it is rebuilt, the live local-national path still falls back to the older broad FTS path.
- Exact top and resolvable top are now deliberately different for unit/building cases. That is safer, but the UI must continue to prevent one-tap routing from `refine_required` rows.
- The stress harness samples from the national SQLite but does not yet prove full 16.9M-row production size, build time or disk footprint.
- Prefix-only continues to fail safety cases: wrong locality, wrong street number, sibling unit/shop and same-site building aliases.
- The materialised prefix table is still too large in the ACT 100k sample. It should not be nationalised without another storage pass.
- P95 is still 12 in the rural/unit-weighted run. P90 is inside target, but the tail is not fully solved.

Next:

- Compress or gate the prefix table before another full national rebuild.
- Rebuild the full national SQLite only after the 100k sample projects to an acceptable disk footprint.
- Measure full-size index bytes, build time and lookup P50/P95 once rebuilt.
- Run the hosted national benchmark against the rebuilt full index, not just the sampled experiment harness.
- Add a Plan/Nearby UI smoke case for `refine_required` rows so route submission cannot regress.
