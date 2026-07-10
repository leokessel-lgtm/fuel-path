# Controlled Beta Release Decision - refreshed 2026-07-06 (Australia)

## TL;DR
Fuel Path is ready for a controlled real-user beta checkpoint. The current provider, store, support and native evidence gates pass together, and the previous native performance blocker has been cleared by a Pixel 9 Pro physical-device run.

**Decision: GO for controlled beta validation.**

This is not a full public-launch approval. Public live-price claims remain limited to WA, and broad native performance claims should wait for lower-end Android and signed iOS device evidence.

## Current production deployment - 2026-07-06 07:48 AEST

Current production is verified back on the Settings-era build after the stale Account-era production rollback was corrected.

- Production deployment: `dpl_C7uWcRYtvhjYK8B1ZZPx5ER5UPJ1`.
- Vercel status: `Ready`, target `production`.
- Production aliases include `https://fuel-path.vercel.app`.
- Production HTML loads `_expo/static/js/web/index-d6c83cddce364d5235b117bba42f70fa.js`.
- In-app browser verification on `https://fuel-path.vercel.app/` shows the corrected bottom nav as `Plan`, `Nearby`, `Setting(s)`, with no visible `Account` text.
- Opening Settings shows the current Settings hub, including `Vehicle & fuel`, `Savings`, `Stations & brands`, `Places`, `Alerts` and `Support`.
- Raw production bundle string scan still contains internal `Account` strings, but the verified rendered production flow does not expose the old Account tab/screen.

## Current decision criteria status
- **Beta readiness gate**: `ready`, zero blockers, next action: "Phase 0 beta readiness gates are clear for controlled real-user testing."
- **Provider terms and access**: provider terms evidence passes for configured regions; public live-price claims are allowed for WA only.
- **Store/privacy evidence**: store publishing evidence is `ready` with confirmed privacy contact, policy URL, listing links, privacy/data-safety review references, provider limitation disclosure and support-process evidence.
- **Support readiness**: support runbook and ownership evidence are `ready`; support contact matches the privacy contact.
- **Native Android performance**: Pixel 9 Pro physical-device evidence passes with matching smoke and summary reports.
- **Regression coverage**: provider/store/support/beta readiness tests and native performance checks passed after the final fixes.

## Recommendation
Proceed to controlled beta validation with explicit scope controls:

- Keep public live-region claims to WA until NSW/ACT/QLD/VIC/SA/TAS/NT access blockers are cleared.
- Keep beta copy cautious: "controlled beta", not "public launch" or "national live coverage".
- Keep broad performance claims limited to the measured Pixel 9 Pro result until lower-end Android coverage is added.
- Do not claim signed iOS production readiness until real-device notification, permissions and TestFlight-style behaviour are proven.

## Go / No-go wording
### Go
Proceed with the next controlled real-user beta checkpoint because the current readiness gate is clear and the remaining risks are bounded by scope/copy controls.

### No-go conditions for broader public release
Do not move to broader public release until:

1. Provider access and terms blockers are cleared beyond WA for any claimed live regions.
2. Lower-end Android device performance has been checked before broad Android performance claims.
3. Signed iOS preview/TestFlight evidence proves notification permissions, push-token behaviour and device install behaviour.
4. Any public production claim has a fresh release-readiness check and matching evidence bundle.

## Compact risk register
- **R1 - Regional live-coverage overclaim**
  - **Likelihood:** Medium
  - **Impact:** High
  - **Evidence:** Current beta readiness lists public live regions as `WA`; NSW/ACT/QLD/VIC/SA/TAS/NT remain access-blocked.
  - **Mitigation:** Restrict public copy and in-product claims to WA live pricing unless a region-specific access gate is cleared.

- **R2 - Device performance breadth**
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Evidence:** Pixel 9 Pro pass is strong, but lower-end Android hardware has not been rechecked.
  - **Mitigation:** Add a lower-end Android pass before broad public performance claims.

- **R3 - iOS device-readiness gap**
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Evidence:** iOS simulator/source-level validation exists, but signed iOS device notification and TestFlight-style behaviour remain unproven.
  - **Mitigation:** Run signed iOS preview/TestFlight validation before claiming iOS production readiness.

- **R4 - Evidence freshness drift**
  - **Likelihood:** Medium
  - **Impact:** Medium
  - **Evidence:** Release gates rely on dated provider, store, support and native evidence files.
  - **Mitigation:** Rerun `check-beta-readiness` with current evidence before any release promotion or public-readiness claim.

## What passed
- `node scripts/check-beta-readiness.mjs --provider-terms-evidence-json docs/03-provider-data/evidence/PROVIDER-TERMS-EVIDENCE-2026-07-05.json --store-evidence-json STORE-PUBLISHING-EVIDENCE-2026-07-05.json --support-evidence-json SUPPORT-READINESS-EVIDENCE-2026-07-05.json` - ready, zero blockers.
- `node --test --test-concurrency=1 tests/api/native-android-performance-summary.test.js tests/api/beta-readiness.test.js` - 36/36.
- `node --test --test-concurrency=1 tests/api/provider-terms-readiness.test.js tests/api/store-publishing-readiness.test.js tests/api/support-readiness.test.js tests/api/beta-readiness.test.js` - 84/84.
- Pixel 9 Pro physical Android smoke: `tmp/native-smoke/android-preview-smoke-2026-07-05T20-59-03-701Z.md` - passed.
- Pixel 9 Pro Android performance summary: `tmp/native-smoke/android-performance-summary-2026-07-05T21-00-11-713Z.md` - passed, source matched the smoke report.
- Earlier production-like workflow checks remain supporting evidence:
  - `test:production-smoke-matrix` - 9/9.
  - `test:claim-safety` - 20/20.
  - `test:route-adversarial` - 8/8.
  - `test:frontend-failure-states` - 7/7.
  - `test:map-density` - 4/4.
  - `test:map-interactions` - 2/2.
  - `test:plan-route-browser-clicks` - 30/30.
  - `test:plan-route-visual-snapshots` - 8/8.
  - `validate:combined-nearby-rural-remote` - 12/12.
  - `check:production-fuel-readiness-canary` - pass.
  - `report:production-readiness-pack` - pass.
  - `validate:ev-provider-trials -- --proxy` - pass.

## Evidence bundles
- [Provider terms evidence](03-provider-data/evidence/PROVIDER-TERMS-EVIDENCE-2026-07-05.json)
- [Store publishing evidence](../STORE-PUBLISHING-EVIDENCE-2026-07-05.json)
- [Support readiness evidence](../SUPPORT-READINESS-EVIDENCE-2026-07-05.json)
- [Native validation notes](../mobile-app/NATIVE-VALIDATION.md)
- [Native launch readiness current state](native-launch-readiness-current-state-2026-07-01.md)
- [production-like sample build](../tmp/production-like-sample-build-refresh-2026-07-03T06-52-40-717Z.json)
- [production readiness pack](../tmp/production-readiness-pack-2026-07-03T06-48-55-253Z.json)
- [production canary](../tmp/production-fuel-readiness-canary-2026-07-03T06-49-40-237Z.json)
- [combined nearby rural+remote smoke](../tmp/combined-nearby-rural-remote-smoke-2026-07-03T06-51-16-389Z.json)

## Untested or excluded from this decision
- Lower-end Android performance.
- Signed iOS device/TestFlight notification and permission behaviour.
- Public release promotion.
- National live-price coverage.
- Provider access expansion outside WA.
