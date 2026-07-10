# Provider readiness verification contract

This document explains how to determine current provider readiness. It does not
store a static region-by-region readiness snapshot.

## Sources of truth

Use these in order:

1. `api/_capabilities.js` for configured provider capability and production
   fail-closed behaviour.
2. `/api/status` for the deployed environment's current capability output.
3. `scripts/check-provider-terms-readiness.mjs` with a dated evidence file for
   public-claim permission gates.
4. Provider adapter tests and live validation scripts for technical quality.
5. Files under `evidence/` for the scope and date of held permission evidence.

No single source proves beta release readiness.

## State model

- `request sent`: an application, question or support request was submitted.
- `terms confirmed`: usage, caching, attribution and commercial-use obligations
  are recorded for the relevant provider and jurisdiction.
- `quality-ready`: the configured adapter passes its schema, routing, failure
  and live validation gates.
- `beta-release-ready`: provider, native, privacy, store and support gates pass
  together for the intended beta scope.

These states are independent. Technical capability must not be promoted into
permission or release approval.

## Current checks

Inspect the deployed capability surface:

```sh
curl -sS https://fuel-path.vercel.app/api/status
```

Check provider evidence against the deployed configuration:

```sh
npm run check:provider-terms -- \
  --api-base https://fuel-path.vercel.app \
  --evidence-json docs/03-provider-data/evidence/PROVIDER-TERMS-EVIDENCE-2026-07-05.json
```

Run provider routing and evidence regression coverage:

```sh
node --test --test-concurrency=1 \
  tests/api/provider-routing.test.js \
  tests/api/provider-terms-readiness.test.js
```

Use `--enforce-public-launch` only when a blocked public-claim state should fail
the command or release step.

## Interpretation

- A configured or `live` technical capability does not by itself allow a public
  live-price claim.
- A dated provider evidence file can be incomplete while an adapter remains
  technically usable for internal validation.
- A passing provider gate does not prove native, store, privacy or support
  readiness.
- Re-run live and evidence-dependent checks before publishing a current claim.
