# Provider data documentation

Use this folder for provider decisions, technical integration notes and
permission evidence. Do not infer release approval from technical availability.

## Read by task

| Task | Read first | Then read |
| --- | --- | --- |
| Check current provider access or public-claim readiness | [`provider-readiness.md`](provider-readiness.md) | The deployed `/api/status` response and matching file under [`evidence/`](evidence/) |
| Change address lookup or autocomplete | [`decisions/ADDRESS-AUTOCOMPLETE-PROVIDER-DECISION.md`](decisions/ADDRESS-AUTOCOMPLETE-PROVIDER-DECISION.md) | [`implementation/ADDRESS-LOOKUP-PROVIDERS.md`](implementation/ADDRESS-LOOKUP-PROVIDERS.md) and the relevant tests |
| Work on G-NAF | [`decisions/GNAF-NATIONAL-ADDRESS-INDEX.md`](decisions/GNAF-NATIONAL-ADDRESS-INDEX.md) | The specific hosting or benchmark evidence needed for the task |
| Review the earlier API.NSW access work | [`evidence/historical/API-NSW-UNBLOCK-PLAN-2026-06-13.md`](evidence/historical/API-NSW-UNBLOCK-PLAN-2026-06-13.md) | Treat it as dated history, then verify current code and evidence |
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

## Classification of detailed provider documents

| Document | Bucket | Current scope |
| --- | --- | --- |
| `provider-readiness.md` | source-of-truth | Verification method and state boundaries, not a readiness snapshot |
| `decisions/ADDRESS-AUTOCOMPLETE-PROVIDER-DECISION.md` | source-of-truth | Address-provider selection principles; implementation snapshot is dated |
| `decisions/GNAF-NATIONAL-ADDRESS-INDEX.md` | source-of-truth | G-NAF-first decision and constraints; direct-hosting instructions are a dated implementation option |
| `implementation/ADDRESS-LOOKUP-PROVIDERS.md` | source-of-truth | Current external-provider configuration and fallback contract |
| `implementation/QLD-FUEL-API-NOTES.md` | source-of-truth | QLD adapter contract; recorded row counts are dated evidence |
| `implementation/SA-FUEL-API-NOTES.md` | source-of-truth | SA adapter contract; access correspondence remains evidence |
| `evidence/historical/PROVIDER-ACCESS-READINESS-2026-06-26.md` | historical-evidence | Superseded readiness snapshot |
| `evidence/historical/API-NSW-UNBLOCK-PLAN-2026-06-13.md` | historical-evidence | Completed access plan and dated technical findings |

## Verification

- Run `npm run check:provider-terms` with the evidence file appropriate to the decision.
- Run `npm run check:docs` after moving provider documents or changing references.
- Reverify live/provider-dependent claims before publishing or release use.
