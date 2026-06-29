# Geocode Quality Sprint

Generated: 2026-06-23

## Scope

Focused follow-up to the ranking safety sprint.

Production changes were limited to:

- `api/_geocode.js`
- `api/_geocodeHints.js`

External provider fetches were blocked during benchmark validation. The benchmark records external host names only.

## Changes

- Added postal-address detection for PO Box, GPO Box, Locked Bag, Private Bag, and RMB style queries.
- Suppressed external fallback for postal-only input.
- Suppressed external fallback for under-specified street-only queries without locality, state, or postcode.
- Added `Artarmon Station, Artarmon NSW 2064` as a local station hint, including the common `artamon station` misspelling.

## Benchmark Comparison

| Metric | After safety sprint | After quality sprint |
|---|---:|---:|
| Raw OK | 3/15 | 4/15 |
| Local fallback | 3/15 | 2/15 |
| Degraded | 8/15 | 4/15 |
| No match | 1/15 | 5/15 |
| External attempted | 11/15 | 6/15 |
| p50 latency | 56.4ms | 1.2ms |
| p95 latency | 6613.4ms | 9014.5ms |

The higher no-match count is intentional for unsafe or non-geocodable input. It avoids sending postal, ambiguous, or sensitive queries to external providers in local-first mode.

## Improved Cases

| Case | Before | After |
|---|---|---|
| `PO Box 123 Darlinghurst NSW` | Degraded, external attempted | No match, no external attempt |
| `George Street` | Degraded, external attempted | No match, no external attempt |
| `100 Main St` | Degraded, external attempted | No match, no external attempt |
| `artamon station` | Artarmon locality fallback, external attempted | Artarmon Station local hint, no external attempt |
| `66b eston avenue` | Degraded, external attempted | No match, no external attempt |

## Remaining Gaps

- Unit and apartment address cases still mostly degrade rather than resolve.
- `3/47 Smith St Parramatta` resolves to the base street address, not the unit-level address.
- Rural/local fallback still attempts external provider before settling on useful local regional results.
- `12 Commonwealth Ave Canberra ACT` still degrades.
- p95 latency remains high because some national SQLite lookups are still expensive.

## Validation

`node --test tests/api/geocode-resilience.test.js`

Result: pass 28, fail 0.

Latest benchmark artefacts:

- `research/benchmark/output/geocode-benchmark-2026-06-23T02-14-29-128Z.json`
- `research/benchmark/output/geocode-benchmark-2026-06-23T02-14-29-128Z.csv`
- `research/benchmark/output/geocode-benchmark-2026-06-23T02-14-29-128Z.md`

## Product Read

The system is now safer and more privacy-preserving for the benchmark set, but still not product-ready as an AU address autocomplete API.

The next product-relevant gap is unit/apartment and exact address quality. That likely requires deeper index/query work, not another hint-level patch.
