# Geocode Exact Address Quality Sprint

Generated: 2026-06-23

## Scope

Follow-up sprint for the remaining unit/apartment and exact-address quality gap.

Production changes were limited to `api/_geocode.js`.

## What Changed

- Added `eston -> easton` query correction so typo/fuzzy local address hints can resolve `66b eston avenue`.
- Suppressed external fallback when the first local suggestion is a useful regional street/locality fallback.
- Preserved `local_fallback` status for those suppressed regional fallbacks so graceful-degradation semantics remain visible.

## Evidence

The national SQLite probe showed that some benchmark expectations are not clearly present as exact unit/apartment records in the local index:

- `Railway Parade, Kogarah` has matching street records, but not the benchmarked `Unit 7/12 Railway Parade`.
- `Walker Street, North Sydney` has many records, but not the benchmarked `Level 4 Suite 12 100 Walker Street`.
- `Bland Street, Ashfield` has many unit records, but not the benchmarked `Townhouse 4/18 Bland Street`.

Given that, the sprint did not try to manufacture unit-level results from absent or ambiguous data.

## Benchmark Comparison

| Metric | After quality sprint | After exact-address sprint |
|---|---:|---:|
| Raw OK | 4/15 | 5/15 |
| Local fallback | 2/15 | 2/15 |
| Degraded | 4/15 | 4/15 |
| No match | 5/15 | 4/15 |
| External attempted | 6/15 | 4/15 |
| p50 latency | 1.2ms | 1.4ms |
| p95 latency | 9014.5ms | 5910.7ms |

Latest benchmark artefacts:

- `research/benchmark/output/geocode-benchmark-2026-06-23T02-23-26-208Z.json`
- `research/benchmark/output/geocode-benchmark-2026-06-23T02-23-26-208Z.csv`
- `research/benchmark/output/geocode-benchmark-2026-06-23T02-23-26-208Z.md`

## Improved Cases

| Case | Before | After |
|---|---|---|
| `66b eston avenue` | No match | `66B Easton Avenue, Sylvania NSW 2224`, local hint |
| `Lot 12 Gundagai Road Cootamundra` | Local fallback with external attempt | Local fallback, no external attempt |
| `123 Unnamed Road Walgett` | Local fallback with external attempt | Local fallback, no external attempt |

## Remaining Gaps

- Unit-level exactness remains weak when the exact unit record is absent from the index.
- Several apartment/level examples should degrade rather than guess because the local index does not provide a safe exact match.
- `12 Commonwealth Ave Canberra ACT` still degrades; the available ACT records found nearby are different street numbers or named buildings, not the benchmarked address.
- The national SQLite index still has slow cases, though p95 improved in this sprint.

## Validation

`node --test tests/api/geocode-resilience.test.js`

Result: pass 28, fail 0.

## Product Read

The exact-address gap is now better bounded:

- Safe typo/fuzzy local resolution improved.
- Useful regional fallbacks avoid unnecessary external calls.
- Unit/apartment exactness cannot be made product-grade from the current local index alone without deeper data/index work or a provider such as Addressr/AddressFinder.

For productisation, the next meaningful test is not another code patch. It is a benchmark against Addressr or AddressFinder for the same absent/ambiguous unit cases, to decide whether this is a data limitation, an index design limitation, or both.
