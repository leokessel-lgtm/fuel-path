# Fuel Path release decision

Reviewed: 2026-07-14 (Australia/Sydney)

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
- a current-branch physical Android performance packet whose APK and source
  revision match this repair branch
- dated provider or authority terms evidence for each gated public region
- an explicit Production database and hosted/global push rollout decision with
  Production-specific least-privilege, backup and rollback evidence

The 12 July `android_preview_smoke_missing` and
`native_blocker_packet_missing` labels predated the final PR #30 physical-device
runs. They are superseded for the PR #30 Android quality decision by the 13 July
Pixel 9 Pro and Pixel 7 evidence below. The clean-checkout automated beta gate
still emits those labels because the temporary smoke files were deliberately
removed during QA cleanup. A newly generated structured smoke packet remains
required before a future automated beta decision; that evidence-portability gap
is not evidence that the Android behaviour is untested.

The managed `DATABASE_URL`, `POSTGRES_URL` and `POSTGRES_PRISMA_URL` values
remain shared, but product state in Preview is isolated through the Preview-only
`FUEL_PATH_PRODUCT_DATABASE_URL` override. A dedicated least-privilege runtime
role now has DML access to only the eight product and alert tables, with no
G-NAF, migration-ledger, truncate or schema-creation access. Owner migrations
remain idempotent while runtime migrations fail closed. The full account-free
watch-off, re-enrolment and Privacy lifecycle passed under that restricted role,
and a PostgreSQL 17 logical backup restored into a temporary database with all
11 tables, 118 columns, 11 constraints, 27 indexes, row counts and data hashes
matching. The restore database and temporary files were removed. The fresh
protected Preview deployment reports healthy durable alert storage at 1 device,
1 route and 0 evaluations, with writes and push delivery disabled. See
[`evidence/PREVIEW-PRODUCT-DATABASE-SAFETY-2026-07-13.md`](evidence/PREVIEW-PRODUCT-DATABASE-SAFETY-2026-07-13.md).

This clears the isolated Preview database safety gate. It does not authorise a
Production migration or hosted/global push rollout. Production still requires a
separate explicit decision with Production-specific least-privilege, backup and
rollback evidence.

The App Store and Google Play URLs previously recorded in store evidence both
returned HTTP 404 on 2026-07-10. They have been removed from current evidence.
The corrected evidence is
[`evidence/STORE-PUBLISHING-EVIDENCE-2026-07-10.json`](evidence/STORE-PUBLISHING-EVIDENCE-2026-07-10.json).

## 14 July repair branch assessment

The local product database and anonymous data lifecycle are complete for the
repair branch. Local PostgreSQL migrations are idempotent, restart persistence
passed, alert retention passed against PostgreSQL, and the alert scheduler
claimed 500 rows from a 10,000-route due set within its two-second budget while
concurrent workers remained disjoint and expired leases recovered. Mobile local
state uses recoverable primary and backup envelopes with monotonic revisions,
bounded retention, restart and backwards-clock recovery, durable write retry,
and explicit Privacy deletion.

The current-source Xcode simulator validation passed Plan, Nearby and Settings
as three distinct rendered screens. Five cold starts passed on both iPhone 17
and iPad mini (A17 Pro), with p50 launch-command times of 165 ms and 182 ms
respectively. The iPad evidence is compatibility-mode evidence only: the current
app config is portrait-only and has `supportsTablet` set to `false`. A signed
physical iPad pass is still required when the device is available and must not
be replaced by these simulator results.

The combined beta gate now accepts the portable iOS screenshot evidence. Its
automated blockers are limited to `provider_terms_not_confirmed`,
`native_performance_not_claimable` and `store_listing_links_missing`. Support,
privacy review and provider-limitation disclosure evidence pass. The broader
manual release decision remains NO-GO because signed physical iOS evidence and
a separate Production database and hosted/global push decision are also still
required.

Current-branch local dense-map stress passed all four fuel and EV cases, with
the EV overlay capped at 18 markers on both tested phone sizes. Production still
served the older 96-marker EV behaviour during the hosted stress run, so a
current Preview or Production deployment and post-deploy verification are
required before claiming that repair live. The hosted 300-route click-through
run had one Brisbane-to-Canberra marker-click failure; the exact case passed
locally on the current branch. This is treated as a deployment-version gap until
the branch is deployed and verified, not as evidence that Production is ready.

The final branch quality run passed 581 of 583 root tests with two intentional
database-gated skips and no failures. Both skipped PostgreSQL contracts passed
when run separately against the local database. Mobile verification, web build,
bundle budgets, architecture guards and dependency audit passed, with zero
known production dependency vulnerabilities. Parallel stress work also exposed
and fixed evidence-file collisions in the iOS cold-start, route-click and map
density harnesses, with regression tests added.

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

- Preview product-state isolation, least-privilege runtime access and logical
  backup/restore are proven. This is Preview safety evidence, not Production
  migration or global push authorisation.
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

1. Complete Google Play developer identity and Android-device verification, and
   enable App Store Connect for the paid Apple Developer account.
2. Create or confirm real App Store and Google Play listings, then verify both
   public URLs before recording them as evidence.
3. Put the reviewed provider-limitation disclosure into the final App Store and
   Google Play listing materials.
4. Add signed iOS device evidence when devices are available. Generate a fresh
   structured native blocker packet when preparing the next automated beta
   decision so it references the current Android state.
5. Collect dated provider or authority terms evidence for each gated region,
   including allowed public use, cache limits and attribution requirements.
6. Keep Production migration and hosted/global push disabled until a separate
   explicit rollout decision records Production-specific least privilege,
   backup and rollback evidence.
7. Rerun the beta-readiness gate with the held provider and support evidence
   inputs before changing this decision.

## Historical decision

The superseded controlled-beta GO decision is retained as dated historical
evidence at
[`evidence/historical/CONTROLLED-BETA-RELEASE-DECISION-2026-07-06.md`](evidence/historical/CONTROLLED-BETA-RELEASE-DECISION-2026-07-06.md).
