# Fuel Path Validation Synthesis

Last updated: 14 June 2026, Australia/Sydney

## Status

Synthetic validation dry run complete.

First internal prototype validation pass complete. See `VALIDATION-PASS-2026-06-14.md`.

Real participant validation not yet run.

Do not treat the synthetic findings or internal prototype pass as evidence of demand. Treat them as a rehearsal, implementation check and hypothesis map.

## What The Dry Run Suggests

The product direction still holds:

> Recommendation first, map second.

The strongest value appears when Fuel Path answers:

- is it worth the detour?
- can I safely reach it?
- is the price fresh enough to trust?
- should I act before a saved route?

## What The Internal Prototype Pass Added

- The current Plan flow can resolve real suburb and POI-style routes through the local validation stack.
- Nearby now works as the familiar map-first comparison surface.
- List-to-map selection works for ranked route stations.
- Invalid typed routes must block recommendations. This trust issue was fixed after the pass.
- Long routes need a smaller decision set, not hundreds of ranked cards.
- Live Discount Wallet needs brand/network rules layered over FuelCheck data.
- Saved-route alert logic needs a visible Plan treatment, not only settings and select-title text.
- Stale live price data needs a stronger confidence downgrade.

## Strongest Segments To Test First

1. Sydney commuters who already check prices manually.
2. High-frequency drivers who care about time and fuel cost.
3. Small fleet or tradie operators who need approved, in-policy stops.

Road-trip/regional mode is valuable, but the current prototype lacks enough opening-hours and fuel-availability confidence to lead with it.

## Most Important Risks To Test

| Risk | Why it matters | Real-session test |
| --- | --- | --- |
| Saving too small | A $2-$3 saving may not change behaviour. | Ask minimum saving and max detour. |
| Trust gap | Stale prices can kill confidence. | Watch reaction to price age and source strip. |
| Setup friction | Manual tank entry may be annoying. | Ask what profile fields they would actually set. |
| Alert fatigue | Generic fuel alerts are easy to disable. | Test saved-route alert examples. |
| Discount incompleteness | Users think in net price after dockets/cards. | Ask which discounts must be included. |
| Fleet scope creep | Fleet needs can become enterprise software. | Test only policy, approved stop and weekly report. |

## Recommended Real-Session Pass

Run 7 sessions:

- 2 commuters
- 2 high-frequency drivers
- 1 small fleet/tradie operator
- 1 road-trip/regional driver
- 1 non-technical price shopper

Use `VALIDATION-SESSION-WORKBOOK.md`.

## Decision Criteria

Move to app MVP design only if:

- 4 of 7 say the recommendation would change a real fuelling decision.
- 4 of 7 understand the top recommendation without explanation.
- 3 of 4 commuter/high-frequency participants want saved-route alerts.
- 1 fleet participant shows clear willingness to pay or pilot.
- Trust concerns are mostly solvable through source, freshness, opening hours or wording.

Do not move to app MVP if:

- most users still prefer map-first behaviour
- saving thresholds are too high for typical route savings
- trust concerns dominate
- users reject tank/route setup
- API.NSW usage rights block the intended product

## Product Changes Worth Queuing After Real Sessions

Only queue these if real sessions support them:

- minimum saving threshold
- maximum detour minutes
- "typical route price" wording instead of "route median"
- saved-route alert settings
- simple tank selector
- discount wallet
- fleet-lite policy mode

## Bottom Line

The dry run strengthens the case for validation, not more building.

The next real test is behavioural:

> Would a driver change a fuel decision because Fuel Path made the trade-off clearer?
