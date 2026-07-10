# POI autocomplete fast-path rules

Last updated: 2026-07-05

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
- A broad city or suburb match must not end local lookup when the query contains
  additional specific terms, such as a building or venue name.
- An under-specified street address remains hidden without locality context, but
  a G-NAF match inside the supplied nearby search context may be returned.
- An exact building-name prefix from G-NAF outranks a broad locality fallback;
  ambiguous base-building results remain marked for refinement.
- Known local POI/station/gazetteer queries return immediately from local autocomplete data.
- Strong local POI/station/gazetteer queries must be checked before address-index status is loaded.
- Hosted G-NAF lookup must not run before a strong local POI/station suggestion.
- External provider lookup must not run before a strong local POI/station suggestion.
- Slow provider enrichment belongs after user selection or in downstream flows, not ahead of first suggestions.
- Station intent must not be misread as street intent when the query is not a numbered address.
- Numbered `Station Street` addresses must still resolve as addresses, not transit stops.
- Curated local hints should outrank shorter duplicate regional gazetteer names when the primary place name matches.
- National locality and civic POI coverage must not be NSW/Sydney-only. Common towns, suburbs, parks, landmarks and government-service places across every Australian state and territory should return from local autocomplete where curated.
- Generic stripped search needles such as `service` must not create false civic matches. A query like `Service NSW` should prefer explicit Service NSW records and must not fall through to unrelated health-service records.
- Terminal user-intent suffixes such as `town centre`, `city centre`, `suburb` and `suburbs` should be stripped for local place matching. The suffix must only be removed at the end of the query so genuine place names are not rewritten.

## Performance budget

The local autocomplete guard is enforced by:

```text
npm run test:poi-autocomplete-budget
```

National locality and civic POI coverage is stress-tested by:

```text
npm run test:geocode-national-places:local
```

Fixed Australian place quality regression is checked by:

```text
npm run test:geocode-quality-regression
```

Default budget:

- 500 known POI/station cases.
- 500/500 top match required.
- 500/500 must use `local_autocomplete` fast path.
- 0 provider calls allowed.
- Overall p90 must be <= 800 ms.
- Overall p95 must be <= 1500 ms.
- Station p90 must be <= 800 ms.

National place stress budget:

- 10,000 deterministic local searches by default.
- Every Australian state and territory must be represented.
- 100% must return the expected top local suggestion.
- 0 unsafe `Service NSW` to unrelated health-service matches.
- Provider calls are intentionally out of scope because this guard protects the local fast path.

Quality regression budget:

- Fixture cases live in `tests/fixtures/geocode-quality-regression.json`.
- Cases must cover suburbs, towns, cities, government-service places, parks, transit, airports and attractions across Australia.
- Local module mode disables external provider calls by default.
- Top result pass rate must be at least 80%.
- Top 5 pass rate must be at least 95%.
- Wrong-state top results must be 0.
- Known aliases can be accepted explicitly in the fixture, but wrong-state results must not be accepted as aliases.

Plan route context ranking:

- When Plan autocomplete has the other route endpoint, local coordinate-backed suggestions may receive a proximity boost.
- The boost applies to local G-NAF, curated POI hints and regional gazetteer rows.
- Exact user text still matters; route context should break plausible ties, not override explicit state or exact-place intent.
- Regression coverage must include a context-sensitive ambiguity, for example `Airport W` near Newcastle promoting Newcastle Airport Williamtown over interstate airport matches.

Provider fallback policy:

- Validation mode (`nominatim`) merges local suggestions before provider suggestions.
- Plan autocomplete cascade is local-first, paid/provider suggestions second, and weaker local fallback suggestions last.
- Normal production geocode keeps exact local address matches ahead of provider results for exact-address queries, then appends non-exact local fallbacks.
- Google Places can fall back to HERE only when Plan autocomplete cascade is enabled and HERE is configured.
- Cost-control failures, missing session tokens, exhausted caps and missing durable quota storage must fail closed rather than falling through into paid traffic.
- Run `npm run test:map-geocode-cost-guardrails` before enabling or changing paid Plan autocomplete provider traffic.

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

After the local fast path was moved ahead of address-index status loading, the live production POI-to-POI Plan journey stress returned:

- 200/200 journey cases passed.
- 0 geocode failures.
- 0 route failures.
- 0 score failures.
- 200/200 recommendations returned.
- total journey p50 1,363 ms.
- total journey p90 2,468 ms.
- total journey p95 3,405 ms.
- max 5,742 ms.

Report:

```text
tmp/poi-route-journey-stress-2026-06-30T11-48-48-041Z.md
```

## Change checklist

When changing geocode/autocomplete ranking, provider fallback, local POI hints, station parsing, or suggestion labels:

- Update this document if the user-facing behaviour or budget changes.
- Run `node --test tests/api/geocode-resilience.test.js`.
- Run `node --test tests/api/geocode-fallback-policy-guard.test.js`.
- Run `npm run test:map-geocode-cost-guardrails`.
- Run `npm run test:geocode-quality-regression`.
- Run `npm run test:poi-autocomplete-budget`.
- For production-impacting changes, rerun the 500-case live POI stress before claiming production latency is green.
