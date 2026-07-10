# Build and release

Use this folder for current build, test, support and release gates. Dated JSON
files under `evidence/` support a recorded review state; they do not make the
app currently beta-ready or store-ready without rerunning the relevant checks.

## Read first

- [`CURRENT-RELEASE-DECISION.md`](CURRENT-RELEASE-DECISION.md)
  records the current no-go decision and blockers.
- [`STORE-READINESS-PLAN.md`](STORE-READINESS-PLAN.md) defines the current store
  and beta release gates.
- [`NATIONAL-TESTING-REGIME.md`](NATIONAL-TESTING-REGIME.md) defines the testing
  and validation regime.
- [`SUPPORT-RUNBOOK.md`](SUPPORT-RUNBOOK.md) defines support ownership, triage
  and escalation requirements.

## Evidence boundaries

- [`evidence/STORE-PUBLISHING-EVIDENCE-2026-07-10.json`](evidence/STORE-PUBLISHING-EVIDENCE-2026-07-10.json)
  is dated store publishing evidence.
- [`evidence/SUPPORT-READINESS-EVIDENCE-2026-07-05.json`](evidence/SUPPORT-READINESS-EVIDENCE-2026-07-05.json)
  is dated support readiness evidence.
- Historical release reviews live under [`evidence/historical/`](evidence/historical/).
- Superseded drafts live under [`../archive/build-release/`](../archive/build-release/).
- Provider permissions remain under [`../03-provider-data/evidence/`](../03-provider-data/evidence/).
- Native validation remains in [`../../mobile-app/NATIVE-VALIDATION.md`](../../mobile-app/NATIVE-VALIDATION.md).

Keep `request sent`, `terms confirmed`, `quality-ready` and
`beta-release-ready` as separate states.
