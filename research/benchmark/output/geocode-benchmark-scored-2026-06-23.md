# Scored Geocode Benchmark Evidence

Generated: 2026-06-23

## Runs Reviewed

| Run | Mode | G-NAF config | Output |
|---|---|---|---|
| 2026-06-23T01-56-59-334Z | local_only_provider_blocked | default seed/local hints only | `research/benchmark/output/geocode-benchmark-2026-06-23T01-56-59-334Z.*` |
| 2026-06-23T02-02-24-558Z | local_only_provider_blocked | `data/gnaf/build/gnaf-addresses-national.sqlite` | `research/benchmark/output/geocode-benchmark-2026-06-23T02-02-24-558Z.*` |

External provider fetches were blocked in both runs. Instrumentation recorded host names only.

## Scoring Rubric

| Score | Meaning |
|---:|---|
| 3 | Correct top result |
| 2 | Useful result or appropriate ambiguity handling |
| 1 | Wrong but plausible |
| 0 | No result or degraded without useful local result |
| -1 | Dangerous: confident wrong result likely to be accepted |

## Summary

| Run | Raw OK | Local fallback | Degraded | External attempted | Manual score | Mean score |
|---|---:|---:|---:|---:|---:|---:|
| seed/local hints only | 1/15 | 3/15 | 11/15 | 14/15 | 8/45 | 0.53 |
| national SQLite index | 8/15 | 3/15 | 4/15 | 7/15 | -2/45 | -0.13 |

The national SQLite index reduced degraded responses and external attempts, but it introduced several confidently wrong top results. For product validation, that is worse than returning no result.

## Case Scores: Seed/Local Hints Only

| ID | Score | Reason |
|---|---:|---|
| unit-slash-01 | 0 | No local result; external provider attempted and blocked. |
| unit-slash-02 | 0 | No local result; external provider attempted and blocked. |
| apartment-level-01 | 0 | No local result; external provider attempted and blocked. |
| apartment-level-02 | 0 | No local result; external provider attempted and blocked. |
| rural-lot-01 | 2 | Useful street/locality fallback, but not exact lot-level address and still attempted external provider. |
| rural-lot-02 | 2 | Useful regional fallback for a likely imprecise rural query, but still attempted external provider. |
| po-box-01 | 0 | Degraded without postal-address-specific handling. |
| ambiguous-01 | 0 | Degraded rather than presenting ambiguity options. |
| ambiguous-02 | 0 | Degraded rather than presenting ambiguity options. |
| boundary-01 | 0 | No local ACT address result. |
| suburb-poi-01 | 0 | Degraded for short Melbourne Airport query. |
| suburb-poi-02 | 3 | Correct local Canberra result with no external provider attempt. |
| typo-fuzzy-01 | 1 | Artarmon locality hint is plausible but not the requested station result. |
| typo-fuzzy-02 | 0 | No local typo/fuzzy address result. |
| privacy-01 | 0 | Degraded and attempted external provider for sensitive descriptive query. |

## Case Scores: National SQLite Index

| ID | Score | Reason |
|---|---:|---|
| unit-slash-01 | 2 | Found the base Parramatta street address locally, but not the unit-level expected address. |
| unit-slash-02 | -1 | Confidently returned a Tasmanian Railway Court result for a Kogarah NSW query. |
| apartment-level-01 | -1 | Confidently returned a Ballarat VIC address for a North Sydney NSW query. |
| apartment-level-02 | -1 | Confidently returned a Mackay QLD address for an Ashfield NSW query. |
| rural-lot-01 | -1 | Confidently returned Gundagai Street in Adelong, not Gundagai Road in Cootamundra. |
| rural-lot-02 | 2 | Useful regional fallback for an imprecise rural road query, but still attempted external provider. |
| po-box-01 | 0 | Degraded without postal-address-specific handling. |
| ambiguous-01 | -1 | Confidently returned a specific Beenleigh QLD address for ambiguous George Street. |
| ambiguous-02 | -1 | Confidently returned a specific Beeac VIC address for ambiguous 100 Main St. |
| boundary-01 | 0 | No useful ACT result. |
| suburb-poi-01 | -1 | Returned Melbourne Airport Club rather than Melbourne Airport. |
| suburb-poi-02 | -1 | Returned a NSW address named Canberra instead of Canberra ACT. |
| typo-fuzzy-01 | 1 | Artarmon locality hint is plausible but not the requested station result. |
| typo-fuzzy-02 | 0 | No local typo/fuzzy address result. |
| privacy-01 | 0 | Degraded and attempted external provider for sensitive descriptive query. |

## Evidence Read

The full national SQLite index is not enough by itself to support the product hypothesis. It improves local coverage, but ranking and intent handling are not safe enough for an address autocomplete product.

The most concerning pattern is false confidence:

- broad locality/POI queries can be captured by address records with matching names
- ambiguous street queries return arbitrary specific addresses
- unit and apartment queries can drift to wrong states
- privacy-sensitive descriptive queries still attempt external fallback when unresolved

## Product Implication

Current evidence does not support productising Fuel Path geocoding as a standalone local-first address autocomplete API.

The viable opportunity, if any, would require fixing ranking, ambiguity detection, and privacy-gated fallback before market testing. Otherwise the product risk is not "no result"; it is "wrong result that looks authoritative".

## Recommended Next Decision

Keep this as internal Fuel Path infrastructure for now.

The next technical validation should be a ranking and safety sprint, not customer outreach:

1. Prevent broad city/POI queries from being outranked by address records.
2. Treat ambiguous street-only queries as ambiguity, not exact address intent.
3. Add locality/state guards for unit and apartment queries.
4. Add privacy-sensitive query detection before external fallback.
5. Re-run this 15-case benchmark and require zero dangerous results before expanding to 50 cases.
