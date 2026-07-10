# Provider data documentation

Use this folder for provider decisions, technical integration notes and
permission evidence. Do not infer release approval from technical availability.

## Read by task

| Task | Read first | Then read |
| --- | --- | --- |
| Check current provider access or public-claim readiness | [`PROVIDER-ACCESS-READINESS.md`](PROVIDER-ACCESS-READINESS.md) | The matching file under [`evidence/`](evidence/) |
| Change address lookup or autocomplete | [`decisions/ADDRESS-AUTOCOMPLETE-PROVIDER-DECISION.md`](decisions/ADDRESS-AUTOCOMPLETE-PROVIDER-DECISION.md) | [`implementation/ADDRESS-LOOKUP-PROVIDERS.md`](implementation/ADDRESS-LOOKUP-PROVIDERS.md) and the relevant tests |
| Work on G-NAF | [`decisions/GNAF-NATIONAL-ADDRESS-INDEX.md`](decisions/GNAF-NATIONAL-ADDRESS-INDEX.md) | The specific hosting or benchmark evidence needed for the task |
| Work on API.NSW access | [`implementation/API-NSW-UNBLOCK-PLAN.md`](implementation/API-NSW-UNBLOCK-PLAN.md) | API.NSW request and response evidence only when required |
| Work on QLD or SA adapters | The matching note under [`implementation/`](implementation/) | Permission evidence remains under [`evidence/`](evidence/) |

## Boundaries

### Decisions

`decisions/` records selected provider and architecture directions. A decision
is not evidence that an integration is deployed, healthy or permitted for
public use.

### Implementation

`implementation/` records technical contracts, setup and fallback behaviour.
Technical capability does not confirm provider terms, commercial use or public
display rights.

### Evidence

`evidence/` contains dated request, correspondence, terms and readiness
artefacts. Evidence must retain its original scope:

- `request sent`: contact or application was submitted
- `terms confirmed`: applicable usage, caching, attribution and commercial-use terms are held
- `quality-ready`: schema, reliability and integration checks meet their gate
- `beta-release-ready`: all provider, native, privacy, store and support gates pass together

These states are independent. Do not promote one state into another.

`evidence/historical/` preserves superseded drafts and older reviews. They are
audit history, not current proof.

## Verification

- Run `npm run check:provider-terms` with the evidence file appropriate to the decision.
- Run `npm run check:docs` after moving provider documents or changing references.
- Reverify live/provider-dependent claims before publishing or release use.
