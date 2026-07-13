# Fuel Path documentation

Start here, then open one task guide. Dated material is evidence for its date,
not proof of current readiness. The [catalogue](catalog.md) is for audits, not
routine work.

## Task router

| Task | Read first | Read only when relevant |
| --- | --- | --- |
| Understand the product | [`current-product.md`](current-product.md) | Detailed roadmap or research only when needed |
| Plan account-free native data or backend alerts | [`00-product-vision/PROJECT-VISION.md`](00-product-vision/PROJECT-VISION.md) | [`01-architecture/ACCOUNT-FREE-NATIVE-DATA-ARCHITECTURE.md`](01-architecture/ACCOUNT-FREE-NATIVE-DATA-ARCHITECTURE.md) for boundaries and staged delivery |
| Change route recommendations, scoring or savings wording | [`route-recommendation-logic-rules.md`](route-recommendation-logic-rules.md) | Latest route evidence under [`evidence/`](evidence/) |
| Work on provider integrations or access | [`03-provider-data/README.md`](03-provider-data/README.md) | Open only the relevant provider decision, implementation note or evidence file |
| Assess beta or store readiness | [`02-build-release/release-readiness-guide.md`](02-build-release/release-readiness-guide.md) | Current decision, gate plan and dated evidence as routed there |
| Work on the mobile app | [`mobile-app/README.md`](../mobile-app/README.md) and [`mobile-app/AGENTS.md`](../mobile-app/AGENTS.md) | [`mobile-app/NATIVE-VALIDATION.md`](../mobile-app/NATIVE-VALIDATION.md) when validation state matters |
| Plan validation sessions | [`04-validation-evidence/VALIDATION-SESSION-WORKBOOK.md`](04-validation-evidence/VALIDATION-SESSION-WORKBOOK.md) | Recruitment and synthesis only for that workflow |
| Run or change tests | [`02-build-release/NATIONAL-TESTING-REGIME.md`](02-build-release/NATIONAL-TESTING-REGIME.md) | Closest tests and package script |
| Review architecture or performance | [`01-architecture/README.md`](01-architecture/README.md) | Follow its task route |
| Understand or refactor runtime boundaries | [`01-architecture/README.md`](01-architecture/README.md) | The closest handler, module and regression tests only |

## Reading rules

- Prefer current source-of-truth documents over dated evidence.
- Read one task route first. Do not load the full catalogue or every evidence file by default.
- Keep provider implementation notes separate from provider permission evidence.
- Keep `request sent`, `terms confirmed`, `quality-ready` and `beta-release-ready` distinct.
- Treat templates, samples, synthetic sessions and generated synthesis as non-primary evidence.
- Use the catalogue for full classification, folder boundaries and move history.
- Update [`route-recommendation-logic-rules.md`](route-recommendation-logic-rules.md) whenever route scoring, rejection, ranking, detour, savings or Plan recommendation wording changes.
- Use [`context-budget.md`](context-budget.md) for measured repo-owned context profiles; do not claim broad token savings from file moves alone.

## Checks

Run `npm run check:docs` after documentation changes and
`npm run measure:doc-context` after router/profile changes.
