# Fuel Path Geocode Benchmark

Generated: 2026-06-23T01:57:00.103Z

## Scope

- Read-only benchmark of current geocode behaviour.
- Local-only/provider-blocked mode blocks external provider fetches and records host names only.
- Normal fallback mode is skipped unless `FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL=1` is set and provider credentials are present.
- Score and notes columns are intentionally blank for manual review.

## Summary

| Mode | Cases | OK | Local fallback | Degraded | No match | External attempted | p50 ms | p95 ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| local_only_provider_blocked | 15 | 1 | 3 | 11 | 0 | 14 | 52.2 | 57 |

## Case Results

| ID | Category | Status | Top provider | Top result | External hosts | Latency ms |
|---|---|---|---|---|---|---:|
| unit-slash-01 | unit_slash | degraded |  |  | nominatim.openstreetmap.org | 57 |
| unit-slash-02 | unit_slash | degraded |  |  | nominatim.openstreetmap.org | 52.1 |
| apartment-level-01 | apartment_level | degraded |  |  | nominatim.openstreetmap.org | 53 |
| apartment-level-02 | apartment_level | degraded |  |  | nominatim.openstreetmap.org | 52.1 |
| rural-lot-01 | rural_lot | local_fallback | fuel_path_regional_gazetteer | Gundagai Road, Cootamundra NSW 2590 | nominatim.openstreetmap.org | 54.8 |
| rural-lot-02 | rural_lot | local_fallback | fuel_path_regional_gazetteer | Unnamed Road, Walgett NSW 2832 | nominatim.openstreetmap.org | 52.6 |
| po-box-01 | po_box | degraded |  |  | nominatim.openstreetmap.org | 52 |
| ambiguous-01 | ambiguous_street | degraded |  |  | nominatim.openstreetmap.org | 52.2 |
| ambiguous-02 | ambiguous_street | degraded |  |  | nominatim.openstreetmap.org | 52.8 |
| boundary-01 | boundary_edge | degraded |  |  | nominatim.openstreetmap.org | 52.1 |
| suburb-poi-01 | suburb_poi | degraded |  |  | nominatim.openstreetmap.org | 52.3 |
| suburb-poi-02 | suburb_poi | ok | fuel_path_hint | Canberra ACT |  | 1.2 |
| typo-fuzzy-01 | typo_fuzzy | local_fallback | fuel_path_hint | Artarmon NSW 2064 | nominatim.openstreetmap.org | 52.5 |
| typo-fuzzy-02 | typo_fuzzy | degraded |  |  | nominatim.openstreetmap.org | 52.2 |
| privacy-01 | privacy_sensitive | degraded |  |  | nominatim.openstreetmap.org | 52.2 |

## Privacy Note

Benchmark outputs include input queries by design, but external fetch instrumentation records host names only, never full URLs.

## Skipped Work

Normal fallback mode was skipped. This avoids accidental paid or third-party API calls. Re-run with `FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL=1` only after confirming provider credentials and cost posture.
