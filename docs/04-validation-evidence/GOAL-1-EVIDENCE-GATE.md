# Goal 1 Evidence Gate

Last updated: 19 June 2026, Australia/Sydney.

Goal 1: Best Fuel Decision, Not Another Map.

## Current Verdict

Goal 1 is technically credible but not customer-proven.

The build now demonstrates the core product thesis:

- route-based scoring, not raw cheapest-dot sorting
- explicit detour, saving, freshness and capability state
- fill, skip, range-first and locked-provider wait actions kept distinct
- pump price beside user-adjusted price
- map/list selection connected to the recommendation
- stale, unsupported, unavailable and wrong-fuel cases blocked from top recommendations
- saved-route alert audit preservation and delivery gates
- mobile map recovery, camera guards and redemption-state handling

The remaining proof gate is behavioural:

- recruited drivers must understand the recommendation without explanation
- recruited drivers must say the recommendation would change a real fuelling decision
- commuters/high-frequency drivers must prefer saved-route alerts over manual checking

## Evidence Already Held

| Evidence area | Status | Evidence |
| --- | --- | --- |
| National capability matrix | Passed | NSW, ACT, QLD, WA, VIC, SA, TAS and NT all expose explicit capability labels. |
| Misleading empty states | Passed | Unsupported and pending regions return explicit capability context, not silent empty recommendations. |
| Route relevance | Passed | Route scoring prefilters stations outside the route envelope and ranks corridor candidates. |
| Data freshness | Passed | Stale non-official prices are excluded from recommendations; official live effective dates are handled separately. |
| Locked wait action | Passed | `wait_if_can` is allowed only when an official provider exposes a locked tomorrow price that beats the user's saving threshold; demo future prices cannot trigger wait advice. |
| Clear action contract | Passed | Backend route timing regressions cover fill on-route, fill with detour, locked wait, skip, range-first and no eligible signal states. |
| Wrong fuel / unavailable fuel | Passed | Missing fuel grade and unavailable/out-of-fuel prices are excluded from recommendations. |
| User price | Passed | Discount wallet affects displayed prices, route scoring and alert sync; used-today discounts are excluded. |
| Alert safety | Passed | Saved-route alert edits preserve audit state; duplicate/idempotency and delivery gates are tested. |
| Map support role | Passed | Map camera guards prevent location jumps; panel recovery controls prevent trapped map states. |
| Backend reliability | Passed | Provider outage, timeout, cold cache, high station count, long route and concurrent alert paths have tests. |
| App size | Passed | Web export and source asset budgets pass; PNG assets are losslessly compressed. |

## Latest Verification

- Backend tests: `node --test tests/api/*.test.js` passed, 93/93.
- Mobile verify: `npm run verify` passed.
- Native preview preflight: `npm run native:preflight` passed through EAS preview env.
- Whitespace: `git diff --check` passed.
- Web export: 884.6 KB / 2.38 MB.
- Web JavaScript: 716.9 KB / 1.05 MB.
- Source assets: 950.7 KB / 1.43 MB.
- Brand icons: 467.3 KB / 878.9 KB.

## Behavioural Proof Still Needed

Use `VALIDATION-SESSION-WORKBOOK.md`.

Minimum pass criteria:

- 4 of 7 participants say the recommendation would change a real fuelling decision.
- 4 of 7 understand the top recommendation without explanation.
- 3 of 4 commuter/high-frequency participants want saved-route alerts.
- 1 fleet/tradie participant shows clear willingness to pilot or pay.
- Trust concerns are mostly solvable through source, freshness, opening hours or wording.

Do not mark Goal 1 as proven if:

- most users still prefer raw map scanning
- savings are usually below their action threshold
- stale price or provider-access concerns dominate
- setup friction blocks route or discount use
- provider terms block the intended public product

## Next Action

Run the recruited validation sessions. Until then, treat Goal 1 as build-ready for validation, not market-proven.
