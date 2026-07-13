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

## Superseded boundary

The selector was subsequently merged and deployed. The least-privilege runtime,
account-free lifecycle and isolated backup/restore rehearsal completed on 13
July. See
[`PREVIEW-PRODUCT-DATABASE-SAFETY-2026-07-13.md`](PREVIEW-PRODUCT-DATABASE-SAFETY-2026-07-13.md).

This clears the isolated Preview database safety gate only. Production
migration and global push delivery remain unauthorised.
