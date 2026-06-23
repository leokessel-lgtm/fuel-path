# Geocode Ranking Safety Sprint

Generated: 2026-06-23

## Scope

Focused ranking and privacy safety sprint for the 15-case geocode benchmark.

Production changes were limited to `api/_geocode.js`:

- added query-safety filtering for G-NAF suggestions
- added locality/state mismatch rejection for G-NAF candidates
- suppressed address-index use for broad locality, POI, under-specified street, and sensitive-context queries
- suppressed external geocoding for sensitive-context queries
- added `mel airport` as a local alias for Melbourne Airport

External provider fetches were blocked during validation. Full URLs were not logged by the benchmark harness.

## Benchmark Runs

| Run | Description |
|---|---|
| `geocode-benchmark-2026-06-23T02-02-24-558Z` | Before safety patch, national SQLite index |
| `geocode-benchmark-2026-06-23T02-09-10-511Z` | First safety patch |
| `geocode-benchmark-2026-06-23T02-10-23-185Z` | Final safety patch |

## Before vs After

| Metric | Before | After |
|---|---:|---:|
| Raw OK | 8/15 | 3/15 |
| Local fallback | 3/15 | 3/15 |
| Degraded | 4/15 | 8/15 |
| No match | 0/15 | 1/15 |
| External attempted | 7/15 | 11/15 |
| p50 latency | 748.3ms | 52.9ms |
| p95 latency | 28319.5ms | 5691.8ms |
| Dangerous top results in manual review | 7 | 0 |

The lower raw OK count is intentional. The sprint favoured "do not guess" over returning authoritative-looking but wrong G-NAF records.

## Fixed Cases

| Case | Before | After |
|---|---|---|
| `unit 7 12 Railway Pde Kogarah` | Wrong TAS address | Degraded, no confident wrong result |
| `Level 4 Suite 12 100 Walker St North Sydney` | Wrong VIC address | Degraded, no confident wrong result |
| `Townhouse 4 18 Bland St Ashfield` | Wrong QLD address | Degraded, no confident wrong result |
| `Lot 12 Gundagai Road Cootamundra` | Wrong Adelong G-NAF address | Useful Cootamundra regional fallback |
| `George Street` | Arbitrary Beenleigh address | Degraded, no confident guess |
| `100 Main St` | Arbitrary Beeac address | Degraded, no confident guess |
| `mel airport` | Melbourne Airport Club address | Melbourne Airport local hint |
| `Canberra` | NSW address named Canberra | Canberra ACT local hint |
| Sensitive shelter query | External attempted | No match, no external attempt |

## Remaining Gaps

- Unit/apartment address coverage is now safer but weak; several cases degrade instead of resolving.
- PO Box handling still degrades and still attempts external provider in blocked mode.
- Rural/local fallback can still attempt external provider even when a useful local fallback exists.
- `Artarmon station` resolves to Artarmon locality, not the station POI.
- Some exact address/locality searches remain slow with the national SQLite index.

## Product Read

The sprint materially reduced safety risk, but it did not create a product-ready autocomplete surface.

Current state is better for Fuel Path because it avoids confident wrong results. It is still not strong enough to productise as a standalone address API. The next useful technical sprint would target resolution quality for unit/apartment and PO Box cases after the safety gates.
