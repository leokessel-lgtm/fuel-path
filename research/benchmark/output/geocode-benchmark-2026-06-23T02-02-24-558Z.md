# Fuel Path Geocode Benchmark

Generated: 2026-06-23T02:03:11.357Z

## Scope

- Read-only benchmark of current geocode behaviour.
- Local-only/provider-blocked mode blocks external provider fetches and records host names only.
- Normal fallback mode is skipped unless `FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL=1` is set and provider credentials are present.
- Score and notes columns are intentionally blank for manual review.

## Summary

| Mode | Cases | OK | Local fallback | Degraded | No match | External attempted | p50 ms | p95 ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| local_only_provider_blocked | 15 | 8 | 3 | 4 | 0 | 7 | 748.3 | 28319.5 |

## Case Results

| ID | Category | Status | Top provider | Top result | External hosts | Latency ms |
|---|---|---|---|---|---|---:|
| unit-slash-01 | unit_slash | ok | fuel_path_gnaf | 47 Smith Street, Parramatta NSW 2150 |  | 2327.1 |
| unit-slash-02 | unit_slash | ok | fuel_path_gnaf | Unit 7, 12 Railway Court, Cambridge TAS 7170 |  | 18.3 |
| apartment-level-01 | apartment_level | ok | fuel_path_gnaf | Suite 2 First Floor Currently Vacant, 1220 Sturt Street, Ballarat Central VIC 3350 |  | 1539.1 |
| apartment-level-02 | apartment_level | ok | fuel_path_gnaf | Townhouses On Byron, 4 Byron Street, Mackay QLD 4740 |  | 16.2 |
| rural-lot-01 | rural_lot | ok | fuel_path_gnaf | Lot 12, Gundagai Street, Adelong NSW 2729 |  | 2.9 |
| rural-lot-02 | rural_lot | local_fallback | fuel_path_regional_gazetteer | Unnamed Road, Walgett NSW 2832 | nominatim.openstreetmap.org | 6969 |
| po-box-01 | po_box | degraded |  |  | nominatim.openstreetmap.org | 748.3 |
| ambiguous-01 | ambiguous_street | ok | fuel_path_gnaf | George Street Twenty, 20 George Street, Beenleigh QLD 4207 |  | 28319.5 |
| ambiguous-02 | ambiguous_street | ok | fuel_path_gnaf | 100 Main Street, Beeac VIC 3251 |  | 1069 |
| boundary-01 | boundary_edge | degraded |  |  | nominatim.openstreetmap.org | 355 |
| suburb-poi-01 | suburb_poi | local_fallback | fuel_path_gnaf | Melbourne Airport Club, 309 Melrose Drive, Melbourne Airport VIC 3045 | nominatim.openstreetmap.org | 227.8 |
| suburb-poi-02 | suburb_poi | ok | fuel_path_gnaf | Canberra, 36 Greys Lane, Girvan NSW 2425 |  | 2597.8 |
| typo-fuzzy-01 | typo_fuzzy | local_fallback | fuel_path_hint | Artarmon NSW 2064 | nominatim.openstreetmap.org | 61.6 |
| typo-fuzzy-02 | typo_fuzzy | degraded |  |  | nominatim.openstreetmap.org | 408.1 |
| privacy-01 | privacy_sensitive | degraded |  |  | nominatim.openstreetmap.org | 2119.7 |

## Privacy Note

Benchmark outputs include input queries by design, but external fetch instrumentation records host names only, never full URLs.

## Skipped Work

Normal fallback mode was skipped. This avoids accidental paid or third-party API calls. Re-run with `FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL=1` only after confirming provider credentials and cost posture.
