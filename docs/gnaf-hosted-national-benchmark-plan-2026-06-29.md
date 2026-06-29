# Hosted 900-case national benchmark plan

Date: 2026-06-29

## Decision

Prepare the hosted national benchmark as a launch gate, but do not run it until hosted national G-NAF is loaded and readiness has passed.

## Why this exists

The release summary currently blocks public exact-address claims because hosted national G-NAF and launch-grade hosted benchmark evidence are missing.

The benchmark must prove more than "900 queries returned something". It must prove that the hosted app can resolve real national address and place queries with the same behaviour users expect in Plan and Nearby.

## Required command

Run only after hosted national G-NAF readiness passes:

```bash
npm run test:geocode-hosted-national -- --mode http --api-base https://fuel-path.vercel.app --address-count 600 --poi-count 300 --profile rural-unit --case-context --delay-ms 250
```

## Safe planning command

This command does not call the hosted API:

```bash
npm run test:geocode-hosted-national -- --plan-only --mode http --api-base https://fuel-path.vercel.app --address-count 600 --poi-count 300 --profile rural-unit --case-context
```

## Required evidence

- 600 real address cases from the national G-NAF SQLite.
- 300 POI cases from Fuel Path regional hints.
- All Australian states and territories represented.
- Rural and remote address coverage represented.
- Unit, building, townhouse or similar address coverage represented.
- Numeric-address-like queries represented.
- HTTP mode used against the hosted app, not local module mode.
- JSON and CSV evidence written under `tmp/`.

## Pass criteria

- Address top-match rate is 100%.
- POI top-match rate is at least 98%.
- Address p90 chars-to-any-match is at most 42.
- POI p90 chars-to-any-match is at most 12.
- Every selected state or territory has at least 98% any-match rate.
- At least 80 rural or remote address rows are included in the full 600-address run.
- At least 20 unit or building-style address rows are included in the full 600-address run.
- All 600 address rows are numeric-address-like, because the address benchmark is specifically for precise address lookup.

## Release-summary integration

After the hosted benchmark runs, run:

```bash
npm run summarise:lookup-release-evidence
```

The release can only treat public exact-address lookup as green when the `Hosted 900-case national benchmark` gate passes.

## Brutal critique

- This is still a future evidence path, not evidence that production is ready.
- The benchmark depends on the local national SQLite being present to sample cases.
- The rural/remote detector is heuristic and should be improved if the first live benchmark under-represents remote addresses.
- The unit/building minimum is intentionally low because the sampler depends on available labels from the seeded places. If the first live run only scrapes over the threshold, we should strengthen sampling rather than celebrate.
- A passing benchmark proves autocomplete/retrieval behaviour, not fuel price correctness.

## Current status

Ready to run after hosted national G-NAF load and readiness. Public launch remains blocked until this evidence exists and passes.
