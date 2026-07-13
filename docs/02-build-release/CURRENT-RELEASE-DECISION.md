# Fuel Path release decision

Reviewed: 2026-07-13 (Australia/Sydney)

## Decision

**NO-GO for controlled beta, hosted alert rollout or public store release.**

PR #30's account-free foundation was merged to `main` as `a589006` after its
quality checks, review threads and two-device Android validation passed. Release
readiness remains blocked. Do not reuse the superseded 2026-07-06 GO decision
as current proof.

## Current blockers

The remaining release blockers are:

- real App Store and Google Play listing links plus final listing-disclosure
  evidence
- signed iOS device/distribution evidence
- dated provider or authority terms evidence for each gated public region
- a least-privilege Preview runtime role and backup/restore rehearsal before
  hosted alert rollout or any Production migration

The 12 July `android_preview_smoke_missing` and
`native_blocker_packet_missing` labels predated the final PR #30 physical-device
runs. They are superseded for the PR #30 Android quality decision by the 13 July
Pixel 9 Pro and Pixel 7 evidence below. The clean-checkout automated beta gate
still emits those labels because the temporary smoke files were deliberately
removed during QA cleanup. A newly generated structured smoke packet remains
required before a future automated beta decision; that evidence-portability gap
is not evidence that the Android behaviour is untested.

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

## Android evidence cleared for PR #30 scope

- Pixel 9 Pro `49231FDAP0017N` passed the isolated native route-watch and privacy
  lifecycle: final-watch disable retained the device and route, re-enrolment was
  idempotent, and destructive Privacy confirmation removed remote device, route
  and evaluation data, revoked the installation and retained the saved route
  locally with alerts off. [Evidence](https://github.com/leokessel-lgtm/fuel-path/pull/30#issuecomment-4956743897)
- Pixel 7 `28291FDH2001KG` then passed the same user-driven Plan, watch-off,
  re-enrolment and Privacy-confirmation lifecycle against the isolated QA
  backend, finishing with zero active installations, devices, routes or
  evaluations. [Evidence](https://github.com/leokessel-lgtm/fuel-path/pull/30#issuecomment-4957227125)
- Pixel 7 also rendered real Google map tiles and both isolated QA price markers,
  selected two different markers in one session, and produced no callout,
  dispatch, fatal or Maps-authorisation error. The marker regression and full
  map guard set passed. [Evidence](https://github.com/leokessel-lgtm/fuel-path/pull/30#issuecomment-4957805141)
- Root tests passed 566 with one intentional database-gated skip, real Postgres
  retention passed 1 of 1, and the relevant architecture, documentation,
  mobile, secret-hygiene and TypeScript checks passed.

This clears the PR #30 account-free route-watch/privacy fix for controlled
internal Android use across the two physical devices tested. It does not prove
Play release signing, Play Console readiness, broad Android performance coverage,
real push delivery or public store readiness.

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
- Root secret hygiene, backend tests and mobile verification pass. These remain
  quality evidence only, not iOS distribution or store evidence.

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
5. Add signed iOS device evidence when devices are available. Generate a fresh
   structured native blocker packet when preparing the next automated beta
   decision so it references the current Android state.
6. Collect dated provider or authority terms evidence for each gated region,
   including allowed public use, cache limits and attribution requirements.
7. Rerun the beta-readiness gate with the held provider and support evidence
   inputs before changing this decision.

## Historical decision

The superseded controlled-beta GO decision is retained as dated historical
evidence at
[`evidence/historical/CONTROLLED-BETA-RELEASE-DECISION-2026-07-06.md`](evidence/historical/CONTROLLED-BETA-RELEASE-DECISION-2026-07-06.md).
