# Geocode Benchmark Harness

Read-only research harness for Fuel Path geocoding behaviour.

Run the safe local/provider-blocked benchmark:

```bash
node research/benchmark/run-geocode-benchmark.mjs
```

Outputs are written to `research/benchmark/output/` as JSON, CSV, and Markdown.

By default, external provider fetches are blocked and only external host names are recorded. Full external URLs are never written.

Normal fallback mode is intentionally opt-in:

```bash
FUEL_PATH_BENCHMARK_ALLOW_EXTERNAL=1 node research/benchmark/run-geocode-benchmark.mjs
```

Use the opt-in mode only after confirming provider credentials, provider terms, and cost posture.
