# Fuel Path Validation Session Workbook

Last updated: 20 June 2026, Australia/Sydney

## Purpose

Use this workbook to run real user validation sessions with the current Fuel Path mobile app or local validation build.

The goal is not to sell the idea. The goal is to test whether drivers understand and trust a fuel recommendation that accounts for route, detour, range, price freshness and net saving.

## Status

Real participant sessions: not yet run.

Synthetic dry run: see `SYNTHETIC-VALIDATION-SESSIONS.md`.

Recruitment pack: see `VALIDATION-RECRUITMENT-PACK.md`.

Structured results gate: copy `VALIDATION-RESULTS.template.json` to a dated results file, fill one anonymised row per real participant, then run:

```bash
npm run check:validation-results -- --results-json VALIDATION-RESULTS-YYYY-MM-DD.json
```

By default, `evidenceFile` paths are resolved relative to the validation results file. If the anonymised evidence notes live somewhere else, run:

```bash
npm run check:validation-results -- \
  --results-json VALIDATION-RESULTS-YYYY-MM-DD.json \
  --evidence-root validation-notes
```

Use `--allow-blocked` during data entry. A passing result is required before treating the Phase 1 to Phase 4 validation gates as proven.

Each completed real session row must include a unique `sessionId`, non-future `sessionDate`, concrete `evidenceFile`, verbatim `quote`, `recommendationExplanation`, `netSavingExplanation`, `minimumWorthwhileSavingDollars` and `maximumAcceptableDetourMinutes`. Commuter/high-frequency sessions must also include `alertUseCase`. Discount-user sessions must include `discountPriceExplanation` and `possibleOfferInterpretation`. The checker rejects completed rows that only contain outcome booleans, use future dates, point to missing or empty evidence files, or point to evidence files that do not contain the matching `sessionId` and recorded quote. Use `understoodNetSavingWithoutExplanation` only when the participant can explain the saving after detour without moderator rescue.

## Participant Mix

Target 7 sessions:

| Session | Segment | Target profile |
| --- | --- | --- |
| 1 | Commuter | Drives a repeat Sydney metro route 3+ days/week |
| 2 | Commuter | Family/school-run driver with fuel-price sensitivity |
| 3 | High-frequency driver | Rideshare, delivery or sales rep |
| 4 | High-frequency driver | Tradie or service worker with daily driving |
| 5 | Small fleet | Owner/operator or office manager paying fuel bills |
| 6 | Road trip/regional | Plans longer trips and cares about range |
| 7 | Non-technical price shopper | Uses Petrol Spy/FuelCheck manually but dislikes complexity |

## Pre-Session Checklist

- Rotate API.NSW secret before showing live data.
- Put new credentials only in `prototype/.env`.
- Start the current validation surface:

```bash
cd mobile-app
npm run web
```

- Open the local app URL printed by Expo, or use the latest installed Android preview APK when physical-device evidence is being captured.

- Confirm Plan can score a route and show source/freshness evidence.
- Explain that this is an internal validation prototype, not a public product.
- Do not promise price accuracy, station availability, public live-price coverage or ACT coverage.

## Moderator Script

Opening:

```text
I am testing whether this kind of fuel recommendation is useful and trustworthy. I am not testing you. Please think aloud and be blunt.
```

Context questions:

1. How often do you fuel?
2. Do you check fuel prices today? If yes, where?
3. Do you usually choose based on price, convenience, brand, loyalty, range or habit?
4. What was the last annoying thing about fuelling?

Demo task:

```text
Imagine this is your route. Look at the recommendation and tell me what you would do.
```

Decision-rule task:

```text
Set the rule to at least $5 saving and max 8 min detour. Now change only one rule, either lower the saving or tighten the detour. Tell me whether the recommendation still makes sense.
```

Core questions:

1. Would this change where or when you fuel?
2. Is the recommendation easier than using a map?
3. Is "net saving after detour" clear?
4. What would make you distrust it?
5. Do best value, cheapest, closest and safest feel different?
6. Is the skip/worth-the-detour rule clear?
7. What minimum saving is worth a detour?
8. What is the longest detour you would accept?
9. What alert would be useful enough to keep enabled?
10. Would you enter tank level manually?
11. Would you save a regular route?
12. Would loyalty or fuel-card settings matter?
13. Would you pay, tolerate partner offers, or expect it free?

Close:

```text
If this existed tomorrow, when would you actually open it?
```

## Capture Template

```text
Session:
Date:
Participant type:
Route/fuel shown:
Current fuel-checking behaviour:

First reaction:

Did they understand the recommendation?

Participant explanation of the recommendation:

Did they trust it?

Would it change behaviour?

Did they understand best value vs cheapest vs closest vs safest?

Participant explanation of net saving after detour:

Minimum saving threshold:

Maximum acceptable detour:

Useful alert:

Concrete alert use case, if any:

Discount price explanation, if relevant:

Possible offer interpretation, if relevant:

Main objection:

Requested feature:

Quote:

Evidence strength:
```

## Scoring Rubric

Use 0 to 2 for each:

| Signal | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Understands net saving | Confused | Understands after explanation | Understands immediately |
| Trusts recommendation | Distrusts | Conditional trust | Trusts with source/freshness |
| Behaviour change | No | Maybe | Yes |
| Alert value | No alerts | One narrow alert | Strong saved-route alert need |
| Willingness to configure | No setup | Fuel type only | Tank, route and discounts |
| Monetisation fit | No | Partner offers only | Subscription/fleet willingness |

Proceed only if most real sessions score at least 7/12 and the strongest objections are fixable.

## Loop 010 + Loop 009 Execution Plan (go-live testing cadence)

### Why this order

- Start with Loop 010 to get a full-surface, evidence-backed baseline on all user-facing surfaces.
- Follow with Loop 009 at a strict bar to harden regressions quickly and prevent intermittent failures from slipping back in.

### Loop 010: Full product evaluation loop (initial run)

- Target date: 5 July 2026
- Environment:
  - Use production-like local data where possible.
  - Reuse the current inventory from `docs/user-facing-production-readiness-inventory-2026-07-03.md` as baseline.
  - Record unavoidable differences between local setup and production in the run notes.
- Pass gate:
  - Every inventoried surface and finite risk edge case is tested with reproducible evidence.
- Execution order:
  1. Rebuild synthetic dataset: `FUEL_PATH_SAMPLE_SCALE=100 FUEL_PATH_SAMPLE_SEED=2026 FUEL_PATH_SAMPLE_JITTER_KM=0.8`
  2. Re-run user-facing inventory in full scope (Plan, Nearby, Account).
  3. Execute a realistic pass across:
     - route planning and plan-result transitions,
     - nearby search, map/list panel transitions, and marker interaction,
     - policy, discount, alert, and account flows,
     - failure and degraded states,
     - provider-capability and pricing freshness boundaries,
     - accessibility and mobile/web responsive checks.
  4. Log each bug with reproduction steps, expected vs observed result, and evidence path.
  5. Group findings by root cause, apply coherent fixes, then rerun the full inventory.
- Suggested command baseline (adapt as needed):
  - `npm run test:production-smoke-matrix`
  - `npm run test:frontend-failure-states`
  - `npm run test:route-adversarial`
  - `npm run test:plan-route-browser-clicks`
  - `npm run test:claim-safety`
  - `npm run test:map-density`
  - `npm run test:map-interactions`
  - `node --test tests/api/sample-data-production-like.test.js`
  - `npm run check:validation-results -- --results-json VALIDATION-RESULTS-YYYY-MM-DD.json --allow-blocked`
- Stop condition:
  - Clean rerun of all inventory surfaces, or explicit blocked handoff if production-risk gaps remain unresolved.

### Loop 009: Quality streak loop (hardening run)

- Start only after Loop 010 clean pass.
- Set streak target: **N = 20 consecutive realistic cases**.
- Scope for streak cases:
  - commuter/high-frequency and roadmap-sensitive edge cases first,
  - one fresh case per prior failure class before restarting the bar.
- Run steps:
  1. Pick one failure class and one representative case.
  2. Log evidence and fix root cause.
  3. Add/extend regression + benchmark coverage.
  4. Reset streak to zero on each failure.
  5. Continue until 20 consecutive passes at original bar.
- Suggested command baseline:
  - `npm run test:plan-route-live-api`
  - `npm run check:beta-readiness`
  - `npm run check:support-readiness`
- Stop condition:
  - 20/20 consecutive cases with unchanged bar, or explicit blocked handoff when case design itself blocks coverage.

### Run notes format (recommended)

Create `tmp/fuel-path-eval-loop-2026-07-05.md` and add:

- pass date/time (Australia/Sydney),
- environment command and variables,
- inventory list executed,
- defects with reproduction evidence,
- fixes applied and regression hooks added,
- loop step reached (full pass / streak count),
- final decision (`clean`, `blocked`, or `handoff`).

### Initial case seeds for this cycle

| Loop 010 area | Priority case | Expected signal |
| --- | --- | --- |
| Route scoring integrity | Same-route input, high detour edge, stale prices | recommendation downgraded or blocked with reason |
| Evidence and trust | aged station, untrusted provider path | clear freshness and source state visible to user |
| Policy + discounts | policy mismatch, duplicate wallet entry | no accidental inclusion of disallowed station |
| Nearby interactions | marker burst + fast pane swaps on small screen | no stale row focus and no blocked action |
| Failure resilience | geocode timeout + provider 429/500 | no false-success and actionable error state |
| Alert flows | watch a saved route with notification denied | clear permission and no phantom active watch |
| Accessibility/responsiveness | map/list transition, keyboard tab order, dynamic text | controls remain discoverable and usable |

## Synthesis Table

| Session | Segment | Behaviour change | Trust issue | Alert wanted | Saving threshold | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |

## Real Evidence Rules

- Do not count synthetic sessions as validation evidence.
- Do not count polite praise as evidence unless it is tied to a specific behaviour.
- A real "I would use this before my Monday commute" is stronger than "nice app".
- A real "I would not detour for less than $5" is product-shaping evidence.
- Capture objections verbatim.
- Record a dated evidence file reference for each participant, such as anonymised notes or a consented recording transcript. The file must exist and include the matching `sessionId` plus the recorded verbatim quote when the checker runs. Do not include home/work addresses, registration numbers or account details.
- Record the minimum saving and maximum detour as numbers, even if the participant says "zero" or "none".
- Record short explanations in the participant's own words or as concrete moderator notes for the top recommendation, net saving, alert use case and discount-price split where applicable. Do not rely only on boolean pass/fail fields.
- Record structured pass/fail fields in the validation results JSON so `npm run check:validation-results` can enforce the 5 of 7 net-saving understanding, 4 of 7 behaviour-change, 3 of 4 alert-demand, 4 of 5 discount-understanding and small-operator gates.
