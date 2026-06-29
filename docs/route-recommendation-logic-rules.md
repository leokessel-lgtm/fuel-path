# Route recommendation logic rules

Last updated: 2026-06-28

This document records the current Fuel Path route recommendation rules across backend scoring, frontend display and product wording. It is the working source of truth for the Plan route recommendation card.

## Maintenance rule

Any change to route recommendation logic, frontend recommendation rules, backend scoring rules, rejection rules, route-saving calculations, Plan result wording, or user-facing savings claims must update this document in the same change.

If this document and the implementation disagree, the implementation is not finished.

## Product intent

Fuel Path should give one simple fuel stop recommendation for a planned route.

The recommendation should feel like:

- "Here is the best stop for this route."
- "Here is why."
- "Here is the detour."
- "Here is the route-relative price advantage."

It should not feel like:

- a spreadsheet
- a fuel-price research report
- a list of alternatives
- a configurable optimisation engine

## Current user-facing Plan result

The Plan result should show:

- recommended station card
- price
- station name
- savings-detour label
- best-price-by comparison in c/L
- navigate arrow
- `Why this stop`
- `Pump`
- `Your price`
- `Best price by`
- `Detour`
- one comparison sentence

The Plan result should not show:

- `Suggested fuel stops`
- `Decision trade-offs`
- `Best value / Cheapest / Closest / Safest`
- estimated total dollar savings
- fuel used
- time cost
- stale-price penalty explanations
- tank size
- user-configurable decision rules

Plan recommendation and station-detail sheets should size to their content. Do not use fixed tall sheet heights that leave empty white space below the evidence or detail content.

Navigation actions inside Plan recommendation and station-detail cards should use the same arrow treatment as station list rows. Do not add a second large `Navigate to this stop` button below a station card.

Selected station-detail sheets opened from the Plan route map should stay minimal:

- do not show a separate `Station detail` heading
- do not repeat the station name above the station card
- do not show the station-row `your adjusted price` / `pump price` summary line
- keep price, station name, address, open status, data recency, confirmed discount, arrow CTA, distance and compact facts

Plan route maps should keep the recommended station plus the next three route candidates as direct price markers where possible. Do not let marker clustering hide those first four route candidates, because they are the stations users compare immediately after a route recommendation.

## Frontend display rules

### Price

`Price` is the recommended station price after eligible discounts.

Example:

```text
156.9
PDL
```

### Your price

`Your price` is the recommended station price after eligible discounts.

Example:

```text
YOUR PRICE
156.9 c/L
```

### Best price by

`Best price by` is the difference between the next-best viable route option and the recommended station's adjusted price.

Current user-facing comparison price:

```text
next-best viable route option
```

Formula:

```text
bestPriceByCpl = nextBestViableAdjustedCpl - adjustedCpl
```

Rules:

- Show as c/L, not dollars.
- Never show as a guaranteed total saving.
- Do not compare against the most expensive station.
- Do not compare against the cheapest station.
- Do not compare against the median route baseline for user-facing savings.
- Use the next-best open, reachable station that passes smart detour rules and is not cheaper than the recommended station.
- If no next-best viable station exists, fall back to the same-station discount difference only.

Example:

```text
BEST PRICE BY
4.0 c/L
```

Helper copy:

```text
Compared with the next-best route option at 160.9 c/L. Your price includes eligible discounts.
```

### Detour

`Detour` is the estimated extra time required to take the suggested stop from the route.

Example:

```text
DETOUR
0.1 min
```

### Savings labels

Recommendation labels should stay simple:

- `Small savings detour`
- `Medium savings detour`
- `Good savings detour`
- `Great savings detour`
- `Strong savings detour`

Do not add a separate `Detour` eyebrow above these labels.

For the Plan recommendation card, these labels should be based on the displayed `Best price by` c/L lead, not the backend internal dollar scoring estimate. If the c/L lead is zero or unavailable, show `Best route price` rather than a savings-detour label.

## Backend scoring rules

Primary scoring file:

```text
api/_routeScoring.js
```

### Candidate eligibility

A candidate can be excluded or effectively rejected for:

- station is closed or unavailable
- station is outside the smart detour threshold
- station is not reachable, but only when the app has a real range signal

Do not reject or down-rank solely because of stale price age.

Price age may be shown as context elsewhere, but it should not decide the winner.

### Smart detour thresholds

The current smart detour thresholds widen as route value increases:

```text
<= $1.50 estimated route value: 3 min
<  $5.00 estimated route value: 5 min
< $10.00 estimated route value: 10 min
< $20.00 estimated route value: 18 min
>= $20.00 estimated route value: 30 min
```

These values are backend scoring aids. They should not become user-facing controls.

### Internal scoring estimate

The backend currently uses an internal standard fill estimate for route scoring.

Important:

- This is used only to rank candidates.
- It must not be shown as a guaranteed saving.
- The UI must show c/L best-price-by comparison instead.

Reason:

We do not know how much fuel the user will buy.

### Ranking signal

Current recommendation ordering uses:

```text
open, reachable candidates inside smart detour rules first
then lowest adjusted c/L
then shortest detour
then backend score
```

This means the app should not recommend a more expensive station when a cheaper viable station is available on the route. A cheaper station should only lose when it is closed, unavailable, outside the smart detour threshold, or not reachable from a real range signal.

Backend score still includes:

```text
estimated route value after detour fuel
- detour time cost
- smart-rule penalties
- closed/unavailable penalties
```

Do not add stale-price penalty to ranking.

Do not add hidden fuel tank or fuel-level reachability assumptions for fuel vehicles.

## Frontend files

Main Plan recommendation UI:

```text
mobile-app/src/components/PlanRouteSheet.tsx
```

Why-this-stop evidence panel:

```text
mobile-app/src/components/DecisionEvidencePanel.tsx
```

Plan route orchestration:

```text
mobile-app/src/screens/PlanScreen.tsx
```

Route candidate mapping and Plan copy:

```text
mobile-app/src/screens/PlanScreen.utils.ts
```

Regression guard:

```text
mobile-app/scripts/check-map-camera-guards.mjs
```

Route recommendation stress evidence:

```text
scripts/plan-route-recommendation-stress.mjs
scripts/plan-route-browser-click-stress.mjs
scripts/plan-route-live-api-stress.mjs
```

Release checks can include:

```text
npm run test:plan-route-recommendations:local
npm run test:plan-route-browser-clicks
npm run test:plan-route-browser-clicks:full
npm run test:plan-route-visual-snapshots
npm run test:plan-route-live-api
```

The browser click stress should remain capable of proving that the recommended station plus three alternate map stations can be selected and render the compact station-detail sheet correctly.

The visual/browser stress should assert stable user-visible contracts:

- Plan result sheet renders with `Why this stop` and either `Best price by` or `Best route price`.
- Selected station sheets opened from map markers render the clicked station name, price, arrow CTA and compact facts.
- Tests should not require one hard-coded provider/station name for the first recommendation, because provider ordering and naming can legitimately vary while the user-visible contract remains correct.

The rendered Plan-field smoke and stress checks should open the Plan tab explicitly, because Nearby is the default landing tab. They should select route fields through the visible `Start address, suburb or place` and `Destination address, suburb or place` inputs, mock the current `POST /api/geocode` request shape, and select suggestions by their visible primary line rather than old `Use ...` accessibility labels.

## Backend files

Route scoring:

```text
api/_routeScoring.js
```

Score endpoint:

```text
api/score.js
```

Route endpoint:

```text
api/route.js
```

## Wording rules

Allowed:

```text
Route saving 20.0 c/L
Compared with 176.9 c/L across route options. Your price includes eligible discounts.
Suggested stop adds a 0.1 min detour for a 20.0 c/L better route price.
```

Not allowed:

```text
Saving $5.26
Saves $5.26
$5.26 total saving
Fuel scoring uses smart detour rules and a standard fill estimate.
Cheapest but nets $8.42
Decision trade-offs
Suggested fuel stops
Fuel used
```

## Validation expectations

Before treating Plan recommendation logic as production-ready after future edits:

- run `npm run verify` in `mobile-app`
- run EV provider API tests
- smoke test a long route with mixed state providers
- confirm no total-dollar saving claims are visible
- confirm no `Decision trade-offs` section is visible
- confirm no `Suggested fuel stops` section is visible
- confirm route saving is c/L against route comparison price
- confirm backend does not down-rank solely for stale price

## Known open questions

These are intentionally not settled yet:

- whether route comparison price should remain median or use a trimmed median
- whether provider freshness should be exposed as a small trust cue elsewhere
- whether EV route recommendations should use a parallel route-saving concept
- whether fleet policy mode should alter the route comparison baseline or only candidate eligibility
