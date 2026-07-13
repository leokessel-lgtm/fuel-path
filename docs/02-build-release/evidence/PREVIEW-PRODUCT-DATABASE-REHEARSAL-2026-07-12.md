# Preview product database rehearsal

Date: 2026-07-12, Australia/Sydney

## Scope

- Target: schema-only Neon branch `preview` in the existing Fuel Path Neon
  project.
- Environment: Vercel Preview only, through the encrypted
  `FUEL_PATH_PRODUCT_DATABASE_URL` override.
- Excluded: Production database, Production environment variables, native
  device validation and provider/public-claim changes.

## Evidence

- The first Preview branch was deleted because it copied data from `main`.
- The replacement `preview` branch is explicitly marked schema-only and has no
  automatic expiry.
- Preview's encrypted product-database override resolves to a different target
  from Production's effective product database target. No connection string is
  recorded here.
- `1762948800000_product_state_baseline` and
  `1763035200000_anonymous_alert_installations` applied successfully to the
  schema-only Preview target.
- A second migration run reported no pending migrations.
- The required product and alert-installation tables and both migration ledger
  entries were queried successfully on the Preview target.

## Remaining boundary

The checked-out implementation now prefers `FUEL_PATH_PRODUCT_DATABASE_URL` for
product state, but that selector must be merged and deployed before a Preview
runtime can be claimed to use the isolated target. A least-privilege runtime
role and backup/restore rehearsal are still required before hosted alert rollout
or any Production migration.
