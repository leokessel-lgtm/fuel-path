# Preview product database safety rehearsal

Date: 2026-07-13, Australia/Sydney

## Scope

- Target: the schema-only Neon `preview` branch used only by Vercel Preview's
  `FUEL_PATH_PRODUCT_DATABASE_URL` override.
- Included: least-privilege runtime role, migration boundary, account-free
  alert lifecycle, logical backup and isolated restore.
- Excluded: Production database or environment changes, global push delivery,
  provider claims, route scoring and native-device work.

No connection string, password, token, capability or push token is recorded in
this evidence.

## Least-privilege runtime role

The dedicated `fuel_path_preview_runtime` login is a login-only role with no
superuser, role-creation, database-creation, replication, bypass-RLS or inherited
role capability. It has schema usage and `SELECT`, `INSERT`, `UPDATE` and
`DELETE` on exactly these product-state tables:

- `fuel_path_alert_installations`
- `fuel_path_alert_rate_limits`
- `fuel_path_geocode_quotas`
- `fuel_path_market_price_snapshots`
- `fuel_path_prediction_backtests`
- `fuel_path_push_devices`
- `fuel_path_route_alert_evaluations`
- `fuel_path_saved_routes`

The privilege audit confirmed no DML or truncate access to the G-NAF tables or
`pgmigrations`, no table truncate access, and no schema-creation permission.
The owner migration account remains separate from the runtime account.

## Migration and runtime evidence

- The Preview owner reran `npm run db:migrate`; there were no pending
  migrations.
- Running the migration command with the runtime role failed closed with
  `permission denied for schema public`. This is expected: deployments must not
  be able to run migrations.
- The runtime role then completed the isolated account-free lifecycle using the
  real backend implementation:
  - baseline: 4 installations, 1 device, 1 route, 0 evaluations and 7 rate-limit
    counters
  - enrolment plus one non-delivered evaluation: 5/2/2/1/9
  - watch-off: counts remained 5/2/2/1/9 and the route changed only to alerts
    off
  - re-enrolment: counts remained 5/2/2/1/9 and the route returned to alerts on
  - Privacy deletion: exactly one device, route and evaluation were deleted and
    the installation was revoked
  - QA cleanup: the original 4/1/1/0/7 state was restored exactly
- `FUEL_PATH_PUSH_DELIVERY_ENABLED=0` was held for the lifecycle. No push was
  sent.

## Backup and restore evidence

- PostgreSQL 17 `pg_dump` created a 26,272-byte custom-format logical backup.
- Backup SHA-256:
  `f32d72518bb452f04bbae73cf5a53153c7e5202da0e288a3f5bc222d80017bad`.
- The dump restored into a new, separately named temporary database on the
  isolated Preview branch.
- Source and restore matched across 11 tables, 118 columns, 11 behavioural
  constraints, 27 indexes, every table row count and an order-independent hash
  of every row.
- The temporary restore database was dropped. A final database-catalog query
  found zero remaining `fuel_path_restore_*` databases.
- The temporary dump and credential files were removed after verification.

PostgreSQL 17 regenerates internal object-ID-based names for NOT NULL
constraints during restore. The verifier therefore compared column nullability
directly and compared constraints by table, type and definition rather than by
those generated internal names.

## Protected Preview evidence

The tested runtime credential was stored only in Vercel Preview and a fresh
Preview deployment was created:

- deployment: `dpl_CoL3hZPRrjTCn8qmz5o9DWLNCShz`
- URL:
  `https://fuel-path-69fdw2eu0-leonardo-volpi-kesselring-s-projects.vercel.app`
- Vercel status: `Ready`
- unauthenticated `/api/status`: HTTP 302 to Vercel SSO, confirming Preview
  protection remains active
- authenticated `/api/status`: alert storage `postgres_neon`, durable and
  healthy at 1 device, 1 route and 0 evaluations; push delivery disabled; alert
  client writes disabled on this branch

The Production alias remained on deployment
`dpl_HD3H3VTsMzNGMiBBCTLPZZpW1QXd`, created before this rehearsal. No Production
database, Production environment variable, Production deployment or global push
setting was changed.

## Regression evidence

- Root backend suite: 566 passed, one intentional database-gated skip.
- Real local Postgres retention integration: 1 passed.
- Architecture, backend composition, documentation, readiness, mobile source
  guards, secret hygiene and mobile TypeScript checks passed.
- Clean-worktree native preflight still reports the already-recorded missing
  generated Android directory and branch-scoped capability inputs. Those are
  native evidence-portability inputs, not failures of this database rehearsal or
  contradictions of the completed Pixel 7 and Pixel 9 Pro evidence.

## Decision

The least-privilege Preview runtime and backup/restore blocker is cleared for
the isolated Preview target. This does not authorise Production migration or
global push delivery. Any Production database rollout still requires a separate
explicit decision, Production-specific backup and rollback evidence, and a
Production least-privilege runtime credential.
