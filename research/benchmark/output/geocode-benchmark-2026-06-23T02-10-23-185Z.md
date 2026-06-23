# Fuel Path Geocode Benchmark

Generated: 2026-06-23T02:10:34.056Z

## Scope

- Read-only benchmark of current geocode behaviour.
- Local-only/provider-blocked mode blocks external provider fetches and records host names only.
- Normal fallback mode is skipped unless `FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL=1` is set and provider credentials are present.
- Score and notes columns are intentionally blank for manual review.

## Summary

| Mode | Cases | OK | Local fallback | Degraded | No match | External attempted | p50 ms | p95 ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| local_only_provider_blocked | 15 | 3 | 3 | 8 | 1 | 11 | 52.9 | 5691.8 |

## Case Results

| ID | Category | Status | Top provider | Top result | External hosts | Latency ms |
|---|---|---|---|---|---|---:|
| unit-slash-01 | unit_slash | ok | fuel_path_gnaf | 47 Smith Street, Parramatta NSW 2150 |  | 1899.1 |
| unit-slash-02 | unit_slash | degraded |  |  | nominatim.openstreetmap.org | 54.7 |
| apartment-level-01 | apartment_level | degraded |  |  | nominatim.openstreetmap.org | 1839.4 |
| apartment-level-02 | apartment_level | degraded |  |  | nominatim.openstreetmap.org | 63 |
| rural-lot-01 | rural_lot | local_fallback | fuel_path_regional_gazetteer | Gundagai Road, Cootamundra NSW 2590 | nominatim.openstreetmap.org | 52.9 |
| rural-lot-02 | rural_lot | local_fallback | fuel_path_regional_gazetteer | Unnamed Road, Walgett NSW 2832 | nominatim.openstreetmap.org | 5691.8 |
| po-box-01 | po_box | degraded |  |  | nominatim.openstreetmap.org | 755 |
| ambiguous-01 | ambiguous_street | degraded |  |  | nominatim.openstreetmap.org | 52.7 |
| ambiguous-02 | ambiguous_street | degraded |  |  | nominatim.openstreetmap.org | 52.2 |
| boundary-01 | boundary_edge | degraded |  |  | nominatim.openstreetmap.org | 285 |
| suburb-poi-01 | suburb_poi | ok | fuel_path_hint | Melbourne Airport, Tullamarine VIC 3045 |  | 0.9 |
| suburb-poi-02 | suburb_poi | ok | fuel_path_hint | Canberra ACT |  | 1.9 |
| typo-fuzzy-01 | typo_fuzzy | local_fallback | fuel_path_hint | Artarmon NSW 2064 | nominatim.openstreetmap.org | 52.2 |
| typo-fuzzy-02 | typo_fuzzy | degraded |  |  | nominatim.openstreetmap.org | 51.8 |
| privacy-01 | privacy_sensitive | no_match |  |  |  | 0.6 |

## Privacy Note

Benchmark outputs include input queries by design, but external fetch instrumentation records host names only, never full URLs.

## Skipped Work

Normal fallback mode was skipped. This avoids accidental paid or third-party API calls. Re-run with `FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL=1` only after confirming provider credentials and cost posture.
