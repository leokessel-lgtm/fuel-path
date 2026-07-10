# Fuel Path release decision

Reviewed: 2026-07-10 (Australia/Sydney)

## Decision

**NO-GO for controlled beta or public store release.**

The documentation move is verified, but release readiness is blocked. Do not
reuse the superseded 2026-07-06 GO decision as current proof.

## Current blockers

The current local beta-readiness gate reports:

- `physical_device_validation_missing`
- `native_performance_not_claimable`
- `native_blocker_packet_stale`
- `ios_native_validation_missing`
- `store_listing_links_missing`
- `provider_limitations_disclosure_missing`

The App Store and Google Play URLs previously recorded in store evidence both
returned HTTP 404 on 2026-07-10. They have been removed from current evidence.
The corrected evidence is
[`evidence/STORE-PUBLISHING-EVIDENCE-2026-07-10.json`](evidence/STORE-PUBLISHING-EVIDENCE-2026-07-10.json).

## Ready but not sufficient

- Provider terms evidence passes for configured providers, but public live-price
  claims remain limited to WA.
- Support readiness passes with the current runbook, owner and contact evidence.
- The hosted privacy page resolves, but store publication remains blocked until
  real public listing URLs and final listing disclosure evidence exist.

## Next actions

1. Create or confirm real App Store and Google Play listings, then verify both
   public URLs before recording them as evidence.
2. Review provider-limitation wording in the actual listing copy.
3. Refresh the native blocker packet against the current Android evidence.
4. Resolve the native performance source mismatch.
5. Add the missing iOS validation screenshots or device evidence.
6. Rerun the beta-readiness gate before changing this decision.

## Historical decision

The superseded controlled-beta GO decision is retained as dated historical
evidence at
[`evidence/historical/CONTROLLED-BETA-RELEASE-DECISION-2026-07-06.md`](evidence/historical/CONTROLLED-BETA-RELEASE-DECISION-2026-07-06.md).
