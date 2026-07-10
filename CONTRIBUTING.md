# Contributing to Fuel Path

Fuel Path is a route-decision product with a React Native/Expo client and a
serverless Node.js backend. Start with [`docs/README.md`](docs/README.md), then
open only the task route relevant to your change.

## Before changing code

1. Read `AGENTS.md` and any closer `AGENTS.md` in the directory you are editing.
2. Read [`docs/01-architecture/README.md`](docs/01-architecture/README.md).
3. Identify the public contract and closest regression test before refactoring.
4. Keep provider permission evidence separate from provider implementation.
5. Update [`docs/route-recommendation-logic-rules.md`](docs/route-recommendation-logic-rules.md)
   with any scoring, ranking, rejection, savings or recommendation-copy change.

## Change boundaries

- Public files under `api/` are transport handlers. Put domain behaviour in
  underscore-prefixed modules.
- Keep mobile API access under `mobile-app/src/api/`, persistence and device
  integration under `services/`, stateful composition under `hooks/` or
  `screens/`, and pure presentation helpers under `utils/`.
- Do not add production datasets, provider payloads, map tiles or raw benchmark
  output to the app bundle.
- Preserve response shapes and user-visible failure contracts during extraction.
- Prefer one subsystem per pull request.

## Required checks

```sh
npm run check:architecture
npm run check:docs
npm test
cd mobile-app && npm run verify
```

Run the smallest relevant checks while developing, then the broader gates before
publication. Live-provider, hosted and native checks require explicit evidence
and are not implied by local unit-test success.

## Pull requests

Describe the changed subsystem, preserved contracts, validation run and any
release claim that remains blocked. Do not describe a preview deploy, dated
evidence file or passing fixture as current production readiness.
