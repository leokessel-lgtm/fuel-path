# Address Lookup Stress Test - 21 June 2026

## Trigger

The Plan field struggled with `51 Princes Hwy, Sylvania NSW 2224`.

That was not a missing G-NAF record. The exact address exists locally as `51 Princes Highway, Sylvania NSW 2224`, but the address index normalised common street abbreviations such as `st`, `rd`, `ave` and `dr` without normalising `hwy` to `highway`.

## What Changed

- Added broader Australian street-type normalisation: `hwy`, `cct`, `cr`, `cres`, `ct`, `bvd`, `blvd`, `tce`, `pkwy`, `pwy`, `pde`, `esp`, `sq`, `cnr` and `mt`.
- Added complex unit/building query recovery so extra place/building words do not hide the actual unit and street address.
- Added regression tests for `51 Princes Hwy, Sylvania NSW 2224` and a complex unit/building query.
- Expanded the local regional/POI gazetteer with more airports, hospitals, universities, shopping centres and regional landmarks.
- Simplified suggestion evidence labels so the UI can distinguish exact addresses, street/road, suburb/area, places/landmarks and fuel stations without provider jargon.

Post-fix result:

- Query: `51 Princes Hwy, Sylvania NSW 2224`
- Top suggestion: `51 Princes Highway, Sylvania NSW 2224`
- Provider: `fuel_path_gnaf`
- Match type: `exact_address`
- Confidence: `high`

## 1000-Case Stress Run

Run file:

- `tmp/geocode-hosted-national-benchmark-2026-06-21-address-poi-1000-hardened-rerank.json`
- `tmp/geocode-hosted-national-benchmark-2026-06-21-address-poi-1000-hardened-rerank.csv`

Method:

- 700 real G-NAF-backed address cases sampled across NSW, ACT, VIC, QLD, WA, SA, TAS and NT.
- 300 POI/gazetteer cases across metro, regional and rural Australia.
- Module mode, local national G-NAF SQLite.
- External provider calls deliberately blocked to measure Fuel Path's own capability.

Results:

| Segment | Cases | Top match | Any match | No match | Avg chars to top | P90 chars to top |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Overall | 1000 | 1000 | 1000 | 0 | 16.0 | 26 |
| Addresses | 700 | 700 | 700 | 0 | 21.2 | 30 |
| POIs/gazetteer | 300 | 300 | 300 | 0 | 3.7 | 6 |

State spread:

| State | Cases | Top match | P90 chars to top |
| --- | ---: | ---: | ---: |
| NSW | 126 | 126 | 22 |
| ACT | 126 | 126 | 30 |
| VIC | 126 | 126 | 26 |
| QLD | 126 | 126 | 30 |
| WA | 124 | 124 | 30 |
| SA | 124 | 124 | 26 |
| TAS | 124 | 124 | 26 |
| NT | 124 | 124 | 26 |

Address shape:

| Category | Cases | Top match | P90 chars to top |
| --- | ---: | ---: | ---: |
| Street address | 309 | 309 | 22 |
| Unit address | 307 | 307 | 32 |
| Range address | 46 | 46 | 26 |
| Suffix address | 32 | 32 | 22 |
| Lot address | 6 | 6 | 22 |
| POI landmark | 174 | 174 | 6 |
| POI variant | 126 | 126 | 6 |

## Iteration Notes

The first hardening attempt introduced a useful recovery idea but also exposed a ranking bug. Apartment and unit queries such as `Apt 705 L 7 394 Collins Street Melbourne VIC 3000` could be displaced by a sibling unit because recovery variants were being globally re-sorted against the primary query.

Fix:

- Keep the user's primary query results first.
- Use recovery variants only to fill gaps.
- Do not expand `apt` to `apartment` unless the national index is rebuilt with the same normalisation.

Verification:

- 350-address diagnostic after the fix: 350/350 top-match, p90 top-match at 26 typed characters.
- Full hardened 1000-case run: 1000/1000 top-match.

Brutal build finding:

- The first full benchmark produced repeated WA FuelWatch `429 Too many requests` logs while testing lookup. That was not a geocode failure, but it was a design smell: address/POI lookup tests should not wake price-provider paths so noisily.
- The national benchmark now disables station geocode in module mode with `FUEL_PATH_DISABLE_STATION_GEOCODE=1`.
- Lookup-only smoke after that change: `tmp/geocode-hosted-national-benchmark-2026-06-21-lookup-only-smoke.json`, 40/40 top-match, no WA FuelWatch warning flood.

## Important Caveats

- This run proves the local G-NAF path is strong when the query maps to an indexed Australian address.
- The POI result is positive but narrower than Google Maps because the cases come from our curated regional gazetteer.
- The run does not prove we have Google-level POI breadth, business-name recall, misspelling recovery, venue hierarchy or live place freshness.
- No Google Places API key is configured in the current shell, so a new official Google API comparison could not be run today.
- The current 1000-case POI score is for our curated local POI set. It does not prove open-ended Google Maps parity.

## Google Maps Learnings From Existing Comparison

Existing comparison artefact:

- `tmp/geocode-600-google-comparison-report-2026-06-18T10-37-21-687Z.md`
- `tmp/geocode-600-google-comparison-summary-2026-06-18T10-37-21-687Z.json`

Earlier measured comparison:

| Test | Cases | Top match | Any match | No match | Avg chars to top | P90 chars to top |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fuel Path baseline prefix full set | 600 | 529 | 529 | 71 | 13.7 | 28 |
| Google Maps full-query full set | 600 | 411 | 433 | 167 | n/a | n/a |
| Google Maps prefix subset | 50 | 41 | 45 | 9 | 12.1 | 23 |
| Fuel Path hardened local run | 1000 | 1000 | 1000 | 0 | 16.0 | 26 |

This is not an apples-to-apples victory over Google. The hardened Fuel Path run used a stronger local G-NAF index and a curated POI/gazetteer set. Google was tested against a different 600-case set and is still the stronger benchmark for broad live POI recall, typos, business aliases and recognisable landmark hierarchy.

Key findings from that earlier controlled comparison:

- Google presents suggestions as forgiving, mixed-result rows: exact addresses, street-level rows, POIs, suburbs, landmarks and sometimes surprising nearby alternatives.
- Google is stronger on famous places, islands, roadhouses, landmarks and business-style POIs.
- Google is not perfect on synthetic new-build or townhouse-style strings.
- Google tends to keep showing plausible suggestions even when exact confidence is weak. Fuel Path should avoid copying that blindly because a petrol planning app can send a user to the wrong start point.
- Google separates recognisable main text from secondary location context. Fuel Path should do the same instead of presenting every row as one long address string.

## Product Recommendations

1. Keep G-NAF as the authoritative exact-address layer.
2. Expand street-type normalisation beyond the current list: `hwy`, `cct`, `cr`, `cres`, `ct`, `bvd`, `blvd`, `tce`, `pwy`, `pkwy`, `esp`, `sq`, `cnr`, `mt`.
3. Keep the suggestion evidence model:
   - `Exact address`
   - `Street/road`
   - `Suburb/area`
   - `Place/landmark`
   - `Fuel station`
4. Make weak fallback rows visually and behaviourally different from exact address rows. They should not look equally confirmed.
5. Keep improving prefix behaviour for unit and complex-building addresses. They now pass, but unit address p90 is still 32 characters.
6. Add a limited Google Places fallback for beta only if cost controls, API key restrictions, session tokens, debounce and daily caps are ready.
7. Continue building an Australian POI/gazetteer layer for fuel-relevant places: airports, shopping centres, hospitals, universities, roadhouses, tourist landmarks, ferry terminals, ports and regional town centres.
8. In the UI, show suggestion rows with:
   - bold main label
   - secondary suburb/state/postcode
   - evidence chip only when useful
   - no technical provider labels
   - explicit wording when a row is approximate

## P90 Improvement Pass - 22 June 2026

Goal:

- Reduce useful top address suggestions to P90 15 typed characters.
- Keep local G-NAF first.
- Use Google only as a benchmark or fallback, not the default provider.
- Treat unit/building addresses honestly: a building/base suggestion is useful only when the user can refine to the exact unit and is not silently routed to a sibling unit.

Code changes:

- Added richer benchmark metrics: exact top P50/P90/P95, resolvable top P50/P90/P95, wrong top before resolvable, unit/building summary, latency P50/P95 and SQLite index size.
- Added forward-compatible G-NAF index fields for future rebuilds: `display_title`, `display_subtitle`, `suggestion_type`, `refine_required`, `refine_hint`, `base_key` and `search_key`.
- Updated the G-NAF Core builder, raw ZIP builder and Oracle hosted API path so display labels and typeahead/search keys are separate from the long address label.
- Updated the backend suggestion payload to pass title/subtitle/source-label/refine metadata through to the app.
- Updated Plan and Nearby suggestion rows to use the same short title plus fuller subtitle pattern, with minimal useful badges.

Enhanced metrics run:

- `tmp/geocode-hosted-national-benchmark-2026-06-22-address-poi-160-enhanced-metrics.json`
- `tmp/geocode-hosted-national-benchmark-2026-06-22-address-poi-160-enhanced-metrics.csv`

Run shape:

- 120 real G-NAF-backed address cases.
- 40 local POI/gazetteer cases.
- Module mode, local national G-NAF SQLite.
- External provider calls deliberately blocked.
- SQLite index: 12,540,887,040 bytes, about 11,959.9 MB.

Results:

| Segment | Cases | Exact top | Resolvable top | Wrong top before resolvable | Exact P50 | Exact P90 | Exact P95 | Resolvable P90 | Latency P50 | Latency P95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Overall | 160 | 160 | 160 | 105 | 18 | 26 | 30 | 26 | 978 ms | 6,911 ms |
| Addresses | 120 | 120 | 120 | 92 | 18 | 26 | 30 | 26 | 2,154 ms | 7,036 ms |
| POIs/gazetteer | 40 | 40 | 40 | 13 | 3 | 6 | 8 | 6 | 1 ms | 3 ms |
| Unit/building addresses | 65 | 65 | 65 | 60 | 22 | 30 | 55 | 30 | 3,019 ms | 7,828 ms |
| Standard addresses | 55 | 55 | 55 | 32 | 18 | 22 | 22 | 22 | 1,633 ms | 6,477 ms |

Blunt status:

- P90 15 was not achieved.
- Exact and resolvable P90 are the same on the current national SQLite because the current index still returns exact address rows, not separate safe building/base refine rows.
- Unit/building P90 remains the hard tail at 30, with P95 at 55.
- The current large-index lookup path is too slow for aggressive early-prefix probing. Address latency P95 was about 7 seconds in the enhanced run.
- A 1000-case re-baseline was started and stopped at 350/1000 because it was too slow for iteration. At 350/1000 it still had 100% address top match and P90 around 30, consistent with the existing full 1000-case artefact.

Build critique:

- The UI is now cleaner and more Google/Apple-like, but this is presentation improvement, not a P90 breakthrough.
- Separating typeahead keys from display labels is the right foundation, but the existing 12 GB national SQLite was not rebuilt in this pass. That means the current runtime still relies mostly on the old `search_text` FTS shape.
- Lowering the large-index gate for house-number plus street-name prefixes is not safe yet. Spot checks such as `1 adelaide`, `51 princes` and `394 collins` were either slow, ambiguous or misleading against the current FTS table.
- Exact P90 15 may be mathematically unsafe for many unit-only and nationally ambiguous addresses unless the top row is a safe grouped/refine suggestion rather than an exact sibling unit.

Next recommendation:

1. Rebuild a compact typeahead-specific index from G-NAF fields, not from display labels.
2. Add materialised prefix rows for safe base keys: house number + street + locality/postcode, building + street + locality/postcode, and unit + base where unit is present.
3. Treat building/base rows as `refine_required` and block one-tap routing until the exact unit is chosen or typed.
4. Rerun the 1000-address-only benchmark after the typeahead rebuild and use `resolvable P90 <= 15` as the first target. Keep exact unit P90 separate.
5. Only after that, compare a representative subset against Google Places if `FUEL_PATH_GOOGLE_PLACES_API_KEY` or `FUEL_PATH_GOOGLE_MAPS_API_KEY` is configured.

## Typeahead vs Prefix Experiment - 22 June 2026

Follow-up artefact:

- `docs/address-typeahead-prefix-experiment-2026-06-22.md`
- `tmp/address-typeahead-experiment-2026-06-22-typeahead-prefix-hybrid-700-rankfix.json`

The experiment tested both options against 700 sampled address cases from the national SQLite.

Result:

- rebuilt typeahead FTS: 700/700 final resolvable, P90 10
- compact prefix table: 694/700 final resolvable, P90 10 on successful cases
- hybrid prefix + typeahead fallback: 700/700 final resolvable, P90 10

Decision:

- Use a combination.
- Compact prefix alone is too risky because same-number/same-street and sibling unit/shop cases can silently choose the wrong address.
- Rebuilt typeahead is required as the safe fallback and disambiguation layer.

## Next Test Pass

Run the next benchmark with:

- 1000 addresses only, including abbreviation, unit, level, building-name and typo variants.
- 1000 POIs from a broader public/curated source, not only our current gazetteer.
- Google Places API comparison through the official API, not Google Maps UI scraping. This requires `FUEL_PATH_GOOGLE_PLACES_API_KEY` or `FUEL_PATH_GOOGLE_MAPS_API_KEY`.
- Top-match, any-match, no-match, prefix-depth and result-type classification.
- A lookup-only harness that does not touch station price providers.
