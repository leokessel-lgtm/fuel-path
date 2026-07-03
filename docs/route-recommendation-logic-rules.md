# Route recommendation logic rules

Last updated: 2026-07-03

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
- `Eligibility before you go`
- `Why this stop`
- `Pump`
- `Your price`
- `Best price by`
- `Detour`
- one comparison sentence
- a light follow-up prompt after the recommendation evidence:
  - `Save this commute` when the route is not saved
  - `Watch this route` only after the route is saved

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
- route alert prompts before the route is saved
- route tracking or beta-behaviour claims as part of the recommendation evidence

Plan should make discount eligibility explicit before a driver acts on a recommendation. The eligibility card should state whether the displayed price is pump-only, a selected eligible discount, membership/app dependent, policy-limited, or lower-but-not-applied because the user has not selected/proven that discount.

Plan recommendation and station-detail sheets should size to their content. Do not use fixed tall sheet heights that leave empty white space below the evidence or detail content.

Navigation actions inside Plan recommendation and station-detail cards should use the same arrow treatment as station list rows. Do not add a second large `Navigate to this stop` button below a station card.

Selected station-detail sheets opened from the Plan route map should stay minimal:

- do not show a separate `Station detail` heading
- do not repeat the station name above the station card
- do not show the station-row `your adjusted price` / `pump price` summary line
- keep price, station name, address, open status, data recency, confirmed discount, arrow CTA, distance and compact facts

Plan route maps should keep the recommended station plus the next three route candidates as direct price markers where possible. Do not let marker clustering hide those first four route candidates, because they are the stations users compare immediately after a route recommendation.

Plan route failure states should never show raw JavaScript errors, undefined route-shape errors or provider stack details. If scoring returns a valid score payload without a route shape, the frontend should preserve the route endpoints and show the score result or an empty recommendation state rather than crashing. If routing or scoring is unavailable, show a plain recovery message that points users back to retrying, editing the route or checking Nearby fuel.

## Frontend display rules

### Price

`Price` is the recommended station price after selected eligible discounts only.

Example:

```text
156.9
PDL
```

### Your price

`Your price` is the recommended station price after selected eligible discounts only.

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
Compared with the next-best route option at 160.9 c/L. Only selected eligible discounts are applied.
```

### Eligibility before you go

`Eligibility before you go` appears before the main recommendation card.

Rules:

- If a selected discount is applied, say `Selected discount applied`.
- If no selected discount is applied, say `Pump price only`.
- If the station may require app, membership or account access, say that clearly.
- If a lower unselected discount may exist, disclose that it is not applied unless selected and eligible.
- If policy mode is active, say recommendations are limited to approved brands.
- Do not imply membership, fuel-card, voucher or loyalty eligibility unless it is selected and supported by the user's preferences.

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

### Route and detour quality

Route building currently uses the configured route provider for road-route geometry. Google Routes is preferred when configured; OSRM remains the validation fallback. Current production routing is traffic-unaware by default.

Route responses should carry route quality metadata:

- `high`: traffic-aware provider route
- `medium`: provider road route without traffic
- `low`: validation or fallback road route

Fuel recommendations may optionally run feature-flagged actual detour routing for a small ranked candidate set. This mode compares:

```text
origin -> station -> destination
minus
origin -> destination
```

Rules:

- keep actual detour routing off by default unless explicitly requested or feature-flagged
- cap route-engine detour checks to a small top-candidate set
- record actual detour source, provider, base distance/time and via-station distance/time
- include route-position metadata for candidates, including near-origin, mid-route, near-destination and endpoint-adjacent/backtracking-risk hints
- include approximate same-side-road and turn-friction metadata only as route-geometry hints, not as proven navigation truth
- do not claim live traffic or toll-aware optimisation unless the route provider actually supplied that signal
- keep approximate smart-detour scoring as the safe fallback when actual detour routing is unavailable
- use dynamic corridor attempts: narrower for short urban routes and wider for long regional/remote routes

Traffic-aware routing may be requested only through explicit request/provider configuration. If enabled, route quality should move to `high` only when the provider returns a traffic-aware route.

Toll preference may be passed to the route provider. Google toll estimates may be captured in actual-detour metadata when supplied. Toll-cost ranking may only apply inside actual-detour mode, and only using provider-supplied toll deltas. Do not claim general toll-cost optimisation until toll charges are consistently available and included in ranking.

Historical/cycle intelligence remains measurement-gated. Back-test storage must be durable and meet sample-size, mean-absolute-error and direction-accuracy thresholds before limited cycle guidance can be considered. User-facing prediction copy remains disabled until those gates are met and reviewed.

Personalised commute optimisation is local-behaviour gated. The app may classify readiness from aggregate behaviour such as repeated route plans, saved commutes, route alert opt-ins and navigation opens. It must not require exact saved addresses, route geometry, push tokens or provider secrets for that evidence.

## EV route fallback rules

EV route fallback is prototype route-corridor charger discovery, not live availability guidance.

Primary API files:

```text
api/ev-chargers.js
api/_evRouteFallback.js
```

Rules:

- Use the same configured EV provider cascade as Nearby EV search.
- Do not hard-wire EV route fallback to a single trial provider.
- Preserve connector filters supplied by the user or vehicle profile.
- Rank fallback chargers by route-corridor proximity, then refine detour with the route engine where available.
- Refine candidate detours in parallel so one slow route-engine call does not serially delay every EV fallback result.
- Do not claim live bay availability unless the provider supplies real-time status.
- Keep provenance clear that EV route fallback uses directory data.

Current provider cascade behaviour:

```text
default provider, then configured fallback providers until at least one provider returns chargers
```

Reason:

Remote and regional EV coverage differs materially by provider. Route fallback should not fail a viable corridor only because the first cheap provider has thin coverage.

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
npm run check:plan-route-latency-budget
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

Fuel provider orchestration:

```text
api/_backend.js
api/score.js
```

Plan route scoring may need live fuel data from more than one provider region. Independent regional provider loads should run in parallel and then be aggregated in stable provider order. This keeps multi-state route latency bounded by the slowest required provider rather than the sum of every required provider. Do not change ranking, rejection, source attribution or warning semantics just to optimise latency.

Fuel Plan routes should use the combined `/api/score` mode from the app by sending `from` and `to` points instead of a pre-built `route`. This returns both route geometry and route scoring in one response, and it may preload endpoint fuel providers while route geometry is being built. The old `/api/route` then `/api/score` sequence should be kept only for legacy/testing paths or non-fuel route flows such as EV fallback.

Production monitoring runs a 12-case Plan route latency budget against live `/api/score` route mode. Current guardrails are total p90 <= 5500 ms, p95 <= 8000 ms, max <= 12000 ms, and at least 10 recommendations returned. This is a regression guard for speed and obvious route coverage loss, not proof that every route ranking is optimal.

Broad POI-to-POI Plan journey stress uses the app's current route shape: geocode each selected endpoint, then call combined `/api/score` with `from` and `to`. Legacy `/api/route` plus `/api/score` mode is retained only behind an explicit stress-script flag. Live provider loads for Plan scoring share in-flight provider requests where possible, so concurrent route scoring does not stampede the same state fuel provider.

Current production evidence after provider single-flight and local POI geocode fast-path hardening:

- 12-case live Plan route latency budget: 12/12 passed, p90 2,835 ms, p95 4,411 ms, max 4,411 ms.
- 200-case live POI-to-POI Plan journey stress: 200/200 passed, p90 2,468 ms, p95 3,405 ms, max 5,742 ms.
- POI journey failures: 0 geocode, 0 route, 0 score.

Evidence files:

```text
tmp/plan-route-live-api-stress-2026-06-30T11-48-47-637Z.md
tmp/poi-route-journey-stress-2026-06-30T11-48-48-041Z.md
```

## Wording rules

Allowed:

```text
Best price by 20.0 c/L
Compared with the next-best route option at 176.9 c/L. Your price includes eligible discounts.
Suggested stop adds a 0.1 min detour and is best by 20.0 c/L.
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
