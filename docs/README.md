# Fuel Path documentation

Start here, then open only the documents needed for the task. Dated reports are
evidence for their recorded date, not proof of current readiness.

For the complete document classification and move backlog, see
[Documentation catalogue](catalog.md).

## Task router

| Task | Read first | Read only when relevant |
| --- | --- | --- |
| Understand the product | [`current-product.md`](current-product.md) | The detailed roadmap or research only when the task needs that depth |
| Change route recommendations, scoring or savings wording | [`route-recommendation-logic-rules.md`](route-recommendation-logic-rules.md) | Latest route evidence under [`evidence/`](evidence/) |
| Work on provider integrations or access | [`03-provider-data/README.md`](03-provider-data/README.md) | Open only the relevant provider decision, implementation note or evidence file |
| Assess beta or store readiness | [`STORE-READINESS-PLAN.md`](../STORE-READINESS-PLAN.md) and [`NATIONAL-TESTING-REGIME.md`](../NATIONAL-TESTING-REGIME.md) | Dated store, support, native and provider evidence |
| Work on the mobile app | [`mobile-app/README.md`](../mobile-app/README.md) and [`mobile-app/AGENTS.md`](../mobile-app/AGENTS.md) | [`mobile-app/NATIVE-VALIDATION.md`](../mobile-app/NATIVE-VALIDATION.md) when validation state matters |
| Plan validation sessions | [`VALIDATION-SESSION-WORKBOOK.md`](../VALIDATION-SESSION-WORKBOOK.md) | Recruitment, demo and synthesis documents only for that workflow |
| Run or change tests | [`NATIONAL-TESTING-REGIME.md`](../NATIONAL-TESTING-REGIME.md) | The closest test file and package script for the changed subsystem |
| Review architecture or performance | [`backend-hosting-v1.md`](backend-hosting-v1.md) or [`PERFORMANCE-GUARDRAILS.md`](../PERFORMANCE-GUARDRAILS.md), depending on scope | Dated benchmarks only when the claim needs evidence |

## Folder map

```text
docs/
  03-provider-data/        provider decisions, implementation and evidence
  05-research/             research, strategy and product learning
  brand-concepts/          exploratory brand concepts, not production assets
  evidence/                current generated evidence not yet grouped by topic
  templates/               blank and sample artefacts, never proof by themselves
  catalog.md               detailed classification and future move backlog
```

## Reading rules

- Prefer current source-of-truth documents over dated evidence.
- Read one task route first. Do not load the full catalogue or every evidence file by default.
- Keep provider implementation notes separate from provider permission evidence.
- Keep `request sent`, `terms confirmed`, `quality-ready` and `beta-release-ready` distinct.
- Treat templates, samples, synthetic sessions and generated synthesis as non-primary evidence.
- Update [`route-recommendation-logic-rules.md`](route-recommendation-logic-rules.md) whenever route scoring, rejection, ranking, detour, savings or Plan recommendation wording changes.
- Use [`context-budget.md`](context-budget.md) for measured repo-owned context profiles; do not claim broad token savings from file moves alone.

## Checks

Run `npm run check:docs` after moving documentation or changing internal links.
Run `npm run measure:doc-context` after changing task-router profile membership.
