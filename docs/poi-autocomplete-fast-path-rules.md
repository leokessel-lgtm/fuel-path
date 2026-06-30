# POI autocomplete fast-path rules

Last updated: 2026-06-30

## Purpose

Known places must feel instant. Autocomplete for known POIs, transit stops, airports, venues, hospitals, beaches, parks, universities and regional gazetteer places must return from local data before any hosted address index or external provider lookup runs.

This protects the user experience for searches like:

- `Arncliffe Station`
- `St James Station NSW`
- `Scarborough Beach`
- `Westfield Belconnen`
- `Makers Workshop Burnie`

## Runtime rules

- Exact numbered address and unit/building queries stay address-first.
- Known local POI/station/gazetteer queries return immediately from local autocomplete data.
- Hosted G-NAF lookup must not run before a strong local POI/station suggestion.
- External provider lookup must not run before a strong local POI/station suggestion.
- Slow provider enrichment belongs after user selection or in downstream flows, not ahead of first suggestions.
- Station intent must not be misread as street intent when the query is not a numbered address.
- Numbered `Station Street` addresses must still resolve as addresses, not transit stops.
- Curated local hints should outrank shorter duplicate regional gazetteer names when the primary place name matches.

## Performance budget

The local autocomplete guard is enforced by:

```text
npm run test:poi-autocomplete-budget
```

Default budget:

- 500 known POI/station cases.
- 500/500 top match required.
- 500/500 must use `local_autocomplete` fast path.
- 0 provider calls allowed.
- Overall p90 must be <= 800 ms.
- Overall p95 must be <= 1500 ms.
- Station p90 must be <= 800 ms.

The budget guard is wired into:

- `vercel.json` build command, so production deploys fail before aliasing if the fast path regresses.
- `.github/workflows/production-lookup-monitor.yml`, so scheduled lookup monitoring catches regressions.

## Evidence from implementation run

After the fast path was deployed, live production 500 POI stress returned:

- 500/500 top match.
- 500/500 any match.
- 0 wrong top.
- 0 errors.
- 0 timeouts.
- p50 296 ms.
- p90 483 ms.
- p95 547 ms.
- station p90 630 ms on the warmed production run.

Report:

```text
tmp/poi-500-http-stress-2026-06-30T01-46-05-461Z.md
```

## Change checklist

When changing geocode/autocomplete ranking, provider fallback, local POI hints, station parsing, or suggestion labels:

- Update this document if the user-facing behaviour or budget changes.
- Run `node --test tests/api/geocode-resilience.test.js`.
- Run `npm run test:poi-autocomplete-budget`.
- For production-impacting changes, rerun the 500-case live POI stress before claiming production latency is green.
