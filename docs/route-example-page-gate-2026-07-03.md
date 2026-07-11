# Route Example Page Gate

Date: 2026-07-03

## TLDR

Do not build broad SEO/location pages yet.

FuelRadar's location pages are useful, but Fuel Path's near-term wedge is route-specific decision confidence, not a national content footprint. A small number of route-example pages can be considered only after recruited-driver testing proves that users trust the recommendation, detour, best-price-by value and provider caveat.

## Current Decision

Status: blocked before build.

Reason:

- No broad SEO/location pages are needed for the current wedge.
- The route output benchmark is ready as a driver-testing pack, but it is not yet recruited-driver proof.
- Route-example pages should not exist before drivers validate the recommendation quality.

## Gate

Broad SEO/location pages remain blocked until a separate product decision changes the strategy. This includes generated suburb, city, brand, fuel-price and generic location pages.

Initial route-example pages are allowed only when driver proof meets all thresholds:

- at least 8 recruited-driver sessions
- at least 6 drivers would trust or navigate to the top recommendation
- at least 5 drivers understand the detour trade-off
- at least 5 drivers understand `Best price by`
- at least 5 drivers understand the provider/source caveat
- no more than 1 unresolved safety or trust objection
- no more than 5 initial route-example pages

## Route Example Scope If Gate Passes

Allowed:

- a handful of route-specific examples tied to tested route scenarios
- clear source/freshness caveats
- explicit no-recommendation or alternative-fuel caveats
- links back into Plan rather than standalone SEO browsing

Not allowed:

- generated capital/suburb/fuel-price page networks
- generic "cheap fuel in X" pages
- brand/suburb comparison pages as a first growth motion
- prediction, timing or savings claims that are not backed by runtime evidence

## Current Evidence

Use this pack for recruited-driver testing:

```text
docs/04-validation-evidence/historical/route-output-benchmark-user-testing-2026-07-03.md
```

Use this JSON shape for the gate input:

```text
docs/evidence/route-example-driver-proof-template.json
```

Current proof status:

```text
blocked: recruited-driver evidence has not been collected yet
```

## Validation Command

```bash
npm run check:route-example-page-gate -- --allow-blocked
```

The check should stay blocked until real driver evidence is supplied. If route-example pages are added before the gate passes, the check reports `route_example_pages_without_driver_proof`. If broad SEO/location pages are added, it reports `broad_seo_location_pages_present`.
