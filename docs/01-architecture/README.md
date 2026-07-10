# Fuel Path architecture

Use this folder to understand runtime boundaries before changing production
code. These documents describe current implementation, not future approval or
capacity proof.

## Read by task

| Task | Read first | Then inspect |
| --- | --- | --- |
| Backend/API change | [`system-context.md`](system-context.md) | The public handler and closest underscore-prefixed module |
| Provider or failure handling | [`provider-failure-boundaries.md`](provider-failure-boundaries.md) | `docs/03-provider-data/README.md` and provider tests |
| Request, cache or storage change | [`runtime-data-flow.md`](runtime-data-flow.md) | Status contracts, storage adapters and load tests |
| Traffic or capacity work | [`scaling-model.md`](scaling-model.md) | `PERFORMANCE-GUARDRAILS.md` and hosted evidence |
| Refactor planning | [`refactor-backlog.md`](refactor-backlog.md) | Module-size report from `npm run check:architecture` |

## Rules

- Architecture claims need code or runtime evidence.
- A clean dependency graph does not prove production capacity.
- A local load test does not prove provider permission or hosted readiness.
- Keep the mobile bundle lean; keep provider credentials and heavy route work on
  the backend.
