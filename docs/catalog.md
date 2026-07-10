# Fuel Path documentation catalogue

Last reviewed: 2026-07-10

This catalogue is the detailed map of the current documentation state. Use the
concise [documentation task router](README.md) for routine work. This file does not
make older evidence current. Treat dated reports as evidence for the date they
were produced unless the relevant workflow has been re-run.

## Current source-of-truth docs

| Path | Bucket | Keep/move/archive/delete | Reason | Risk |
| --- | --- | --- | --- | --- |
| `README.md` | source-of-truth | keep at repo root | Primary repo overview and setup entry point. | Keep claims broad unless release state is reverified. |
| `AGENTS.md` | source-of-truth | keep at repo root | Repo operating rules for Codex and Fuel Path changes. | Must stay visible at root. |
| `docs/README.md` | source-of-truth | keep in `docs/` | Concise task router and folder map. | Keep small so developers and Codex load only task-relevant context. |
| `docs/catalog.md` | source-of-truth | keep in `docs/` | Detailed classification, risks and move backlog. | Audit reference only; do not load by default for implementation tasks. |
| `docs/context-budget.md` | current-evidence | keep in `docs/` | Reproducible repo-owned documentation context estimates. | Character-based estimate only; update when router profiles change. |
| `docs/route-recommendation-logic-rules.md` | source-of-truth | keep in `docs/` | Route recommendation, scoring, rejection, detour, savings and Plan wording contract. | Must be updated in the same change as route logic or user-facing savings wording. |
| `PROJECT-GOALS-ROADMAP.md` | source-of-truth | move later to `docs/00-product-vision/` | Product goals and roadmap framing. | Moving requires link checks from README and handoff notes. |
| `docs/02-build-release/STORE-READINESS-PLAN.md` | source-of-truth | keep in `docs/02-build-release/` | Current store readiness and release-gate state. | Do not collapse request sent, terms confirmed, quality-ready and beta-release-ready. |
| `docs/02-build-release/CURRENT-RELEASE-DECISION.md` | source-of-truth | keep in `docs/02-build-release/` | Current release decision and blocker summary. | Must be refreshed from the live gate before any release promotion. |
| `docs/02-build-release/NATIONAL-TESTING-REGIME.md` | source-of-truth | keep in `docs/02-build-release/` | Validation and testing regime. | Keep separate from dated validation evidence. |
| `docs/03-provider-data/provider-readiness.md` | source-of-truth | keep in `docs/03-provider-data/` | Current provider verification contract and state boundaries. | Runtime and evidence checks still need to be rerun for current claims. |
| `docs/02-build-release/SUPPORT-RUNBOOK.md` | source-of-truth | keep in `docs/02-build-release/` | Support workflow and operational response guidance. | Test fixtures may mirror it but are not the source of truth. |
| `PRIVACY-POLICY.md` | source-of-truth | keep at root or move later to `docs/02-build-release/` | User-facing privacy policy. | Governance, privacy and store claims need source-backed review. |
| `DATA-RETENTION-RULES.md` | source-of-truth | move later to `docs/02-build-release/` | Data retention rules and operating constraints. | Treat as policy-sensitive. |
| `STORE-DATA-SAFETY.md` | source-of-truth | move later to `docs/02-build-release/` | Store data safety material. | Must align with privacy policy and store evidence. |
| `PERFORMANCE-GUARDRAILS.md` | source-of-truth | move later to `docs/01-architecture/` | Performance expectations and guardrails. | Keep benchmark claims evidence-dated. |
| `mobile-app/NATIVE-VALIDATION.md` | source-of-truth | keep in `mobile-app/` | Native validation evidence and caveats for the app package. | Native state can drift quickly after app or dependency changes. |
| `mobile-app/README.md` | source-of-truth | keep in `mobile-app/` | Mobile app setup and package-specific guidance. | Keep aligned with root README where setup overlaps. |
| `mobile-app/AGENTS.md` | source-of-truth | keep in `mobile-app/` | Mobile-app-specific agent rules. | More specific than root `AGENTS.md` inside `mobile-app/`. |

## Current evidence

| Path | Bucket | Keep/move/archive/delete | Reason | Risk |
| --- | --- | --- | --- | --- |
| `BACKLOG-EVIDENCE-MATRIX.md` | current-evidence | move later to `docs/04-validation-evidence/` | Matrix of known evidence against backlog and readiness claims. | Needs active maintenance to avoid stale coverage claims. |
| `GOAL-1-EVIDENCE-GATE.md` | current-evidence | move later to `docs/04-validation-evidence/` | Goal-specific evidence gate. | Dated or implicit claims should be checked before release use. |
| `VALIDATION-SESSION-WORKBOOK.md` | current-evidence | move later to `docs/04-validation-evidence/` | Working validation workbook. | Keep separate from synthesised conclusions. |
| `VALIDATION-SYNTHESIS.md` | current-evidence | move later to `docs/04-validation-evidence/` | Synthesised validation findings. | Generated synthesis is not source truth. |
| `VALIDATION-DEMO-PACK.md` | current-evidence | move later to `docs/04-validation-evidence/` | Demo support material for validation. | Check against current product before reuse. |
| `VALIDATION-RECRUITMENT-PACK.md` | current-evidence | move later to `docs/04-validation-evidence/` | Recruiting material for validation. | May need privacy and consent review before reuse. |
| `SYNTHETIC-VALIDATION-SESSIONS.md` | current-evidence | move later to `docs/04-validation-evidence/` | Synthetic validation notes. | Label as synthetic, not customer proof. |
| `docs/03-provider-data/evidence/PROVIDER-TERMS-EVIDENCE-2026-07-05.json` | current-evidence | keep in `docs/03-provider-data/evidence/` | Dated provider terms evidence. | Evidence held, not blanket permission or legal approval. |
| `docs/02-build-release/evidence/STORE-PUBLISHING-EVIDENCE-2026-07-10.json` | current-evidence | keep in `docs/02-build-release/evidence/` | Current blocked store publishing evidence. | Store readiness remains blocked until real listings and disclosure proof exist. |
| `docs/02-build-release/evidence/SUPPORT-READINESS-EVIDENCE-2026-07-05.json` | current-evidence | keep in `docs/02-build-release/evidence/` | Dated support readiness evidence. | Support readiness should remain separate from store readiness. |
| `docs/evidence/*.json` | current-evidence | keep in `docs/evidence/` for now | Raw evidence files for route, prediction and competitor checks. | Do not promote without checking dates and scripts. |
| `docs/route-output-benchmark-user-testing-2026-07-09.md` | current-evidence | keep in `docs/` for now | Latest tracked route output benchmark note. | Benchmark result is date-bound. |
| `docs/competitor-route-browser-pass-2026-07-09T03-55-48-052.md` | current-evidence | keep in `docs/` for now | Latest tracked competitor browser pass. | Browser observations can drift. |

## Historical evidence and dated reports

| Path | Bucket | Keep/move/archive/delete | Reason | Risk |
| --- | --- | --- | --- | --- |
| `VALIDATION-PASS-2026-06-14.md` | historical-evidence | move later to `docs/04-validation-evidence/` | Older validation pass. | Do not cite as current readiness without rerun. |
| `docs/02-build-release/evidence/historical/STORE-RELEASE-REVIEW-2026-06-20.md` | historical-evidence | keep under release evidence history | Older store release review retained for context. | It is not the source for current store-readiness claims. |
| `docs/02-build-release/evidence/historical/CONTROLLED-BETA-RELEASE-DECISION-2026-07-06.md` | historical-evidence | keep under release evidence history | Superseded controlled-beta GO decision. | Must not be used as current beta or store-readiness proof. |
| `docs/02-build-release/evidence/historical/STORE-PUBLISHING-EVIDENCE-2026-07-05.json` | historical-evidence | preserve unchanged | Original store evidence later invalidated by 404 listing checks. | Audit history only; its readiness claims are not current. |
| `docs/03-provider-data/evidence/historical/PROVIDER-TERMS-REVIEW-2026-06-20.md` | historical-evidence | keep as historical evidence | Older provider terms review. | Superseded by July evidence in some areas. |
| `docs/*2026-06-*.md` | historical-evidence | keep in place for now, then move by topic | Dated June stress, architecture, GNAF, map and stabilisation notes. | Useful context, but not current proof. |
| `docs/route-output-benchmark-user-testing-2026-07-03.md` | historical-evidence | keep near latest benchmark for now | Earlier route output benchmark. | Superseded by 2026-07-09 benchmark unless a specific regression history is needed. |
| `research/benchmark/output/*2026-06-23*` | historical-evidence | keep under `research/benchmark/output/` | Geocode benchmark outputs. | Large dated result set should not be treated as live performance. |

## Provider data and implementation notes

| Path | Bucket | Keep/move/archive/delete | Reason | Risk |
| --- | --- | --- | --- | --- |
| `docs/03-provider-data/implementation/ADDRESS-LOOKUP-PROVIDERS.md` | source-of-truth | keep under provider implementation | Address lookup provider notes. | Keep implementation notes separate from permission evidence. |
| `docs/03-provider-data/decisions/ADDRESS-AUTOCOMPLETE-PROVIDER-DECISION.md` | source-of-truth | keep under provider decisions | Address autocomplete provider decision. | Check against current implementation before changing claims. |
| `docs/03-provider-data/decisions/GNAF-NATIONAL-ADDRESS-INDEX.md` | source-of-truth | keep under provider decisions | G-NAF national address index direction. | Hosting and serving state can drift. |
| `docs/03-provider-data/implementation/QLD-FUEL-API-NOTES.md` | source-of-truth | keep under provider implementation | QLD fuel API implementation notes. | Provider terms and permission state remain separate. |
| `docs/03-provider-data/implementation/SA-FUEL-API-NOTES.md` | source-of-truth | keep under provider implementation | SA fuel API implementation notes. | Provider terms and permission state remain separate. |
| `docs/03-provider-data/evidence/API-NSW-SUPPORT-NOTE.md` | current-evidence | keep under provider evidence | NSW support notes. | Do not treat as approval unless explicit. |
| `docs/03-provider-data/evidence/historical/API-NSW-UNBLOCK-PLAN-2026-06-13.md` | historical-evidence | keep under historical provider evidence | Completed NSW access plan and dated findings. | Do not use as current adapter or permission state. |
| `docs/03-provider-data/evidence/historical/PROVIDER-ACCESS-READINESS-2026-06-26.md` | historical-evidence | keep under historical provider evidence | Superseded provider readiness snapshot. | Predates later VIC, SA and NT implementation work. |
| `docs/03-provider-data/evidence/provider-terms-*.md` | current-evidence | keep in `docs/03-provider-data/evidence/` | Provider request and evidence notes by jurisdiction. | Keep request sent distinct from terms confirmed. |
| `docs/03-provider-data/evidence/service-victoria-servo-saver-terms-acceptance-2026-06-27.md` | current-evidence | keep under provider evidence | Provider-specific terms acceptance evidence. | Private operational evidence unless explicitly prepared for public use. |
| `docs/provider-store-readiness-summary-2026-07-05.md` | current-evidence | move later to `docs/03-provider-data/` | Provider/store readiness summary. | Avoid collapsing provider access and store release readiness. |

## Research, strategy and product learning

| Path | Bucket | Keep/move/archive/delete | Reason | Risk |
| --- | --- | --- | --- | --- |
| `docs/05-research/fuel-path-market-research.md` | research | keep in `docs/05-research/` | Market research. | Market facts can drift and may need refresh before external use. |
| `docs/05-research/fuel-path-deep-international-research.md` | research | keep in `docs/05-research/` | International research. | Treat as research, not product commitment. |
| `docs/05-research/fuel-price-cycle-research.md` | research | keep in `docs/05-research/` | Fuel cycle research. | Refresh before current market claims. |
| `docs/05-research/FUEL-PATH-GOLD-MINING-STRESS-TEST-2026-06-20.md` | research | keep in `docs/05-research/` | Business model stress test. | Do not treat monetisation conclusions as validated demand. |
| `docs/05-research/MAP-UX-COMPETITOR-FUNCTIONALITY.md` | research | keep in `docs/05-research/` | Competitor UX research. | Competitor surfaces change. |
| `docs/05-research/fuelradar-*.md` | research | keep in `docs/05-research/` | FuelRadar competitor and map comparison notes. | Keep separate from current release readiness. |
| `docs/05-research/FUEL-DISCOUNTS-AND-FLEET-CARDS.md` | research | keep in `docs/05-research/` | Discount and fleet-card research. | Commercial terms can change. |
| `docs/05-research/PRODUCT-IDEAS.md` | research | keep in `docs/05-research/` | Idea backlog and exploratory notes. | Avoid mixing with committed roadmap. |
| `docs/05-research/STRATEGIC-REFLECTION.md` | research | keep in `docs/05-research/` | Strategy reflection. | Opinionated, not evidence. |
| `docs/05-research/AUSTRALIAN-MAPPING-INFRASTRUCTURE-PARTNER-BRIEF.md` | research | keep in `docs/05-research/` | Partner-facing infrastructure brief. | Recheck claims before sharing externally. |

## Architecture, design and app package docs

| Path | Bucket | Keep/move/archive/delete | Reason | Risk |
| --- | --- | --- | --- | --- |
| `BACKEND-PUSH-SCHEDULER-DESIGN.md` | source-of-truth | move later to `docs/01-architecture/` | Backend push scheduler design. | Check implementation before treating as built. |
| `ORACLE-ALWAYS-FREE-GNAF-HOSTING.md` | source-of-truth | move later to `docs/01-architecture/` | Oracle/GNAF hosting direction. | Hosting cost and capability claims can drift. |
| `docs/backend-hosting-v1.md` | source-of-truth | move later to `docs/01-architecture/` | Backend hosting design. | Keep aligned with deployment config. |
| `docs/oracle-gnaf-*.md` | source-of-truth | move later to `docs/01-architecture/` | Oracle GNAF architecture and operations notes. | Operational state must be reverified before release claims. |
| `docs/poi-autocomplete-fast-path-rules.md` | source-of-truth | move later to `docs/01-architecture/` | POI autocomplete fast-path rules. | Needs update if lookup logic changes. |
| `DESIGN-SYSTEM.md` | source-of-truth | move later to `docs/06-design-brand/` | Design system notes. | Keep production app assets separate from brand concepts. |
| `docs/brand-concepts/README.md` | research | keep in `docs/brand-concepts/` | Brand concept archive/index. | Brand concepts are not production assets. |
| `docs/typography-hierarchy.md` | source-of-truth | move later to `docs/06-design-brand/` | Typography hierarchy. | Needs visual validation when UI changes. |
| `docs/ui-ux-stress-loop.md` | source-of-truth | move later to `docs/06-design-brand/` | UI/UX stress loop method. | Method doc, not proof of current pass. |
| `mobile-app/ROUTE-EDITOR-BREAK-IT-TESTS.md` | current-evidence | keep in `mobile-app/` | Mobile route editor test notes. | Evidence may drift after route editor changes. |
| `mobile-app/UI-AESTHETIC-IMPLEMENTATION-PLAN.md` | source-of-truth | keep in `mobile-app/` for now | Mobile UI implementation plan. | May become stale as implementation lands. |
| `prototype/README.md` | archive | keep in `prototype/` | Prototype-specific notes. | Prototype docs should not imply production readiness. |
| `web-demo/README.md` | source-of-truth | keep in `web-demo/` | Web demo package notes. | Demo behaviour may differ from mobile app. |

## Templates and samples

| Path | Bucket | Keep/move/archive/delete | Reason | Risk |
| --- | --- | --- | --- | --- |
| `docs/templates/*.template.json` | template | keep in `docs/templates/` | Reusable evidence and review templates. | Do not confuse blank templates with evidence. |
| `docs/templates/FLEET-LITE-SAVINGS-REPORT.template.md` | template | keep in `docs/templates/` | Reusable savings report template. | Savings wording must stay aligned with route logic rules. |
| `docs/templates/FLEET-LITE-SAVINGS-REPORT.sample-2026-07-02.md` | template | keep in `docs/templates/` | Sample savings report. | Sample is not current customer evidence. |
| `docs/templates/VALIDATION-RESULTS.template.json` | template | keep in `docs/templates/` | Validation results template. | Blank template only. |
| `docs/evidence/route-example-driver-proof-template.json` | template | keep in `docs/evidence/` or move to templates later | Driver proof evidence template. | Template only, not proof. |

## Archive and scratch candidates

| Path | Bucket | Keep/move/archive/delete | Reason | Risk |
| --- | --- | --- | --- | --- |
| `TODO.md` | archive | archive later after checking unresolved items | General task residue. | May contain still-useful loose ends. |
| `mobile-app/CLAUDE.md` | archive | archive later if no longer used | Tool-specific guidance likely superseded by `AGENTS.md`. | Check external tooling before moving. |
| `docs/03-provider-data/evidence/historical/PROVIDER-TERMS-EVIDENCE.2026-06-20.draft.json` | archive | keep as historical evidence | Draft superseded by later provider evidence. | Audit trail only, not current terms proof. |
| `docs/archive/build-release/STORE-PUBLISHING-EVIDENCE.2026-06-20.draft.json` | archive | keep in `docs/archive/build-release/` | Draft superseded by later store evidence. | Keep if audit trail matters. |
| `research/benchmark/output/*` | historical-evidence | keep under research output, consider archive index later | Generated benchmark outputs that are tracked. | Too many files for root-level discoverability. |
| `tmp/*.json`, `tmp/*.md` | scratch | delete or ignore only after review | Local generated stress and smoke outputs are not tracked. | Some may contain useful recent evidence; promote intentionally before deletion. |
| `.npm-cache/**`, `.vercel/**`, `public/build-version.json`, `public/metadata.json` | scratch | do not index as docs | Tooling/build state, not documentation. | Avoid accidental doc audits from local/generated folders. |

## Suggested target structure

Use this structure for future moves once links and references are checked:

```text
docs/
  00-product-vision/
  01-architecture/
  02-build-release/
  03-provider-data/
    evidence/
  04-validation-evidence/
  05-research/
  06-design-brand/
  evidence/
  templates/
  archive/
```

Root-level docs should be limited to `README.md`, `AGENTS.md`, important
policies that need root visibility, and short handoff files that are actively in
use.

## Promotion rules

- Keep `docs/route-recommendation-logic-rules.md` in sync with route scoring,
  rejection, ranking, savings, detour, discount and Plan wording changes.
- Keep provider implementation notes separate from provider permission evidence.
- Keep `request sent`, `terms confirmed`, `quality-ready` and
  `beta-release-ready` as separate states.
- Keep public/product-facing documents separate from private operational
  evidence.
- Keep brand concepts separate from production app assets.
- Promote scratch output into `docs/evidence/` only when it has a clear owner,
  date, command/source and release relevance.
