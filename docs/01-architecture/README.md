# Fuel Path architecture

Current runtime boundaries only. They do not prove approval or capacity.

## Read by task

| Task | Read first | Then inspect |
| --- | --- | --- |
| Backend/API change | [`system-context.md`](system-context.md) | The public handler and closest underscore-prefixed module |
| Provider or failure handling | [`provider-failure-boundaries.md`](provider-failure-boundaries.md) | `docs/03-provider-data/README.md` and provider tests |
| Request, cache or storage change | [`runtime-data-flow.md`](runtime-data-flow.md) | Status contracts, storage adapters and load tests |
| Traffic or capacity work | [`scaling-model.md`](scaling-model.md) | `PERFORMANCE-GUARDRAILS.md` and hosted evidence |
| Account-free native data, alerts or anonymous ownership | [`ACCOUNT-FREE-NATIVE-DATA-ARCHITECTURE.md`](ACCOUNT-FREE-NATIVE-DATA-ARCHITECTURE.md) | `LOCAL-DEVELOPMENT-DATABASE.md`, `BACKEND-PUSH-SCHEDULER-DESIGN.md` and native device evidence |
| Refactor planning | [`backend-composition-root-map.md`](backend-composition-root-map.md) | [`refactor-backlog.md`](refactor-backlog.md) and architecture checks |
| Local or production product database | [`LOCAL-DEVELOPMENT-DATABASE.md`](LOCAL-DEVELOPMENT-DATABASE.md) | `db/migrations/` and the storage modules |

## Rules

- Architecture claims need code or runtime evidence.
- A clean dependency graph does not prove production capacity.
- A local load test does not prove provider permission or hosted readiness.
- Keep the mobile bundle lean; keep provider credentials and heavy route work on
  the backend.
- Context profiles are recommended measured reading sets. Tooling does not
  automatically prevent a developer or agent from loading additional files.
  Their committed ceilings are enforced by `npm run measure:doc-context` in CI.
