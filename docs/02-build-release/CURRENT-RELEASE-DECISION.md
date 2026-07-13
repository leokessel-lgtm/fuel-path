# Fuel Path release decision

Reviewed: 2026-07-12 (Australia/Sydney)

## Decision

**NO-GO for controlled beta, hosted alert rollout or public store release.**

PR #30's account-free foundation is quality-checked and its two repaired review
threads are resolved, but release readiness is blocked. Do not reuse the
superseded 2026-07-06 GO decision as current proof.

## Current blockers

The current beta-readiness gate reports:

- `android_preview_smoke_missing`
- `native_blocker_packet_missing`
- `store_listing_links_missing`

The managed `DATABASE_URL`, `POSTGRES_URL` and `POSTGRES_PRISMA_URL` values
remain shared. A Preview-only `FUEL_PATH_PRODUCT_DATABASE_URL` override points
to a schema-only Neon Preview branch, and the PR #29 and PR #30 migrations were
rehearsed there successfully. The selector and Preview-only account-free
capability configuration are now deployed on the PR #30 branch. The complete
capability, device registration, route save/list/delete, atomic installation
deletion and revocation lifecycle passed there with zero device/route rows
remaining. Least-privilege role plus backup/restore evidence remain required
before hosted alert rollout or any Production migration.

The App Store and Google Play URLs previously recorded in store evidence both
returned HTTP 404 on 2026-07-10. They have been removed from current evidence.
The corrected evidence is
[`evidence/STORE-PUBLISHING-EVIDENCE-2026-07-10.json`](evidence/STORE-PUBLISHING-EVIDENCE-2026-07-10.json).

## Ready but not sufficient

- Provider capability is live across configured regions, but public live-price
  claims remain blocked until provider or authority terms evidence is held for
  each gated region. The 2026-07-12 release-owner attestation is an internal
  operating decision, not provider terms evidence.
- Support readiness passes with the current runbook, owner and contact evidence.
- Provider-limitation disclosure copy is reviewed and ready to include in final
  listing materials.
- The hosted privacy page resolves, but store publication remains blocked until
  real public listing URLs and final listing disclosure evidence exist.
- Root secret hygiene passes, the backend suite passes 559 of 559 tests, and
  mobile `npm run verify` passes. These are quality evidence only, not native
  device or store evidence.

## Next actions

1. Create a least-privilege Preview runtime role and complete a backup/restore
   rehearsal before any hosted alert rollout. Keep Production migrations
   blocked until the rehearsal and an explicit rollout decision are recorded.
2. Complete Google Play developer identity and Android-device verification, and
   enable App Store Connect for the paid Apple Developer account.
3. Create or confirm real App Store and Google Play listings, then verify both
   public URLs before recording them as evidence.
4. Put the reviewed provider-limitation disclosure into the final App Store and
   Google Play listing materials.
5. Refresh the native blocker packet against the current Android evidence, then
   add signed iOS device evidence when devices are available.
6. Collect dated provider or authority terms evidence for each gated region,
   including allowed public use, cache limits and attribution requirements.
7. Rerun the beta-readiness gate with the held provider and support evidence
   inputs before changing this decision.

## Historical decision

The superseded controlled-beta GO decision is retained as dated historical
evidence at
[`evidence/historical/CONTROLLED-BETA-RELEASE-DECISION-2026-07-06.md`](evidence/historical/CONTROLLED-BETA-RELEASE-DECISION-2026-07-06.md).
