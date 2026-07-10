# Release readiness task guide

Use this as the small entry point for release work. It routes to current state
and detailed gates without loading every gate by default.

## Read in order

1. [`CURRENT-RELEASE-DECISION.md`](CURRENT-RELEASE-DECISION.md) for the latest
   dated verdict and blockers.
2. [`STORE-READINESS-PLAN.md`](STORE-READINESS-PLAN.md) only when changing or
   auditing gate definitions.
3. [`NATIONAL-TESTING-REGIME.md`](NATIONAL-TESTING-REGIME.md) when selecting
   validation coverage.
4. Dated evidence only for the lane and claim under review.

## Lanes and claim boundaries

- `quality-ready`: required automated and product-quality gates pass.
- `beta-ready`: the intended beta scope also has provider permission, hosted
  lookup, native device, privacy and support evidence.
- `store-ready`: beta gates plus real store listings, disclosures, metadata and
  distribution evidence pass.

Keep web production, Android, iOS, provider data, privacy/store, support and
quality separate. A request sent is not terms confirmed. Technical availability
is not public-use permission. A preview or free-account device build is not
TestFlight or store distribution.

## Checks

Run the narrow lane checks first, then `npm run check:beta-readiness` for the
combined gate. Reverify hosted and provider-dependent claims before publishing.
