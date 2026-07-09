# Route recommendation logic rules

Last updated: 2026-07-09

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
- compact recommendation rationale summary inside the station card, capped to a short heading plus at most two text lines
- price
- station name
- trip-oriented label, usually `Best stop for this trip`
- route saving comparison in c/L when positive
- compact detour evidence in the recommendation card
- compact eligibility chip, such as `Pump price only`, `Selected discount`, `Membership needed` or `Policy limited`
- compact data confidence chip, such as `Live data`, `Limited data` or `Fallback data`
- navigate arrow
- `Why?` action to expand supporting evidence
- compact `Save route` action when the route is not saved

Expanded Plan evidence may show:

- `Eligibility before you go`
- `Why this stop`
- `Pump price` when no selected discount is applied
- `Pump` and `Your price` only when a selected discount changes the displayed price
- `Best price by` only when the next-best viable route option is dearer than the recommendation
- `Checked detour` only when the route engine checked the via-station route
- `Estimated detour` when the stop uses smart-detour estimation or route-engine refinement is unavailable
- diagnostic data detail, when expanded evidence or support tooling needs it:
  - source/provider
  - station update age
  - provider state/cache state
  - exact, alternative or fallback price match
- one comparison sentence
- route option list
- follow-up prompt after the recommendation evidence:
  - do not repeat `Save this commute` while the top expanded `Save` action is already visible
  - `Watch this route` only after the route is saved

Expanded Plan evidence should scroll inside the sheet. Keep the grabber, map button, compact recommendation card and `Less` / `Save` actions fixed while eligibility, `Why this stop`, source details, route options and follow-up content scroll underneath. Source/update/provider details should be hidden behind an explicit source-details control by default so the expanded state stays decision-focused rather than report-like.

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
- an always-visible route notice that repeats route distance, detour and c/L lead above the recommendation card
- a result context strip above or visually competing with the main recommendation
- `Best price by 0.0 c/L`
- repeated `Live data` chips in both the `Why this stop` header and provider-state rows

Plan should make discount eligibility explicit before a driver acts on a recommendation. The default recommendation card should show a compact eligibility chip. The expanded eligibility card should state whether the displayed price is pump-only, a selected eligible discount, membership/app dependent, policy-limited, or lower-but-not-applied because the user has not selected/proven that discount.

Vehicle settings may contain up to five saved vehicle profiles, but only the active vehicle supplies current Plan and Nearby defaults. For petrol, LPG and diesel vehicles, the active profile supplies fuel grade, tank size and the standard economy estimate used by live Plan route ranking. Manual fuel changes in Nearby or Plan clear the active vehicle context and should present as fuel-only search/routing assumptions until the user selects a saved vehicle again. Settings fuel changes still edit the selected saved vehicle profile. When two or more vehicles are saved, the app chrome should let the user switch vehicle context without visiting Settings. LPG is a selectable fuel grade inside the fuel-vehicle flow, not a separate EV-style route mode. Plan must not expose fuel-level controls or make visible reachability assumptions for fuel vehicles. For EVs, the active profile supplies connector filters, usable range and charging preference for Nearby and Plan charger discovery. Discounts, saved places and saved routes remain account-level unless a separate fleet/business mode explicitly changes that contract.

Station brand preferences are account-level and separate from vehicle setup, discounts and legacy policy mode. By default, Nearby and Plan must show all station brands. When the user chooses `preferred only`, Nearby fuel results and map markers should show only the selected station brands, with a visible one-search override to show all brands. Plan route scoring must apply the selected brands before ranking so a hidden brand cannot become the recommendation. Plan and Nearby must disclose when preferred brands are filtering the result set, and empty states should offer a clear recovery path rather than forcing a weak recommendation.

Saved route notifications are route-level watches, not generic reminders. A watched route may store a selected `vehicleId`, commute days, local alert time, local reminder preference and minimum saving. Existing saved routes without these fields must keep working by falling back to the active vehicle and all-day smart alert checks, but must not silently create local daily reminders. New saved routes should default to the active vehicle, weekday commute days and local reminders off. User-facing notification copy should say Fuel Path alerts only when a saving is worth checking, with fresh prices and sensible detours. Settings may offer an explicit local reminder switch, but local reminders are separate from smart price alerts and must stay off unless the user chooses them. Do not expose backend, token or sync terminology in Settings copy.

Backend saved-route alert delivery should be conservative. A route should not send another smart alert within 72 hours of its last sent alert, and a scheduled evaluation run should cap sendable alerts to one per user. It is acceptable to miss a marginal saving rather than train users to ignore Fuel Path notifications.

Fuel-cycle thinking should inform alerts only as backend background intelligence until prediction readiness and product review are complete. The phone must not poll in the background for price-cycle checks, Home/Work prices or route watches. The backend scheduled evaluator may attach cycle-signal status to alert evaluations for audit and later ranking, but cycle-specific notifications must stay blocked while `userFacingPredictionEnabled` is false, `accuracyClaimsAllowed` is false, or `FUEL_PATH_CYCLE_ALERTS_ENABLED` is not explicitly enabled. Current-price route alerts may still send without cycle guidance when the normal saving, freshness and detour gates pass.

Home and Work fuel alerts should be modelled later as place watches inside the same alert budget, not as a competing notification stream. Route alerts remain the primary notification type. A future Home/Work alert should only compete as a lower-priority fuel opportunity after route alerts are quiet, and should require stronger value than a route alert because the app has less route intent. It must not launch as a separate daily reminder.

Saved-route alert economics may use the selected route vehicle profile for notification payload context, including fuel, tank size and EV range/connector fields where available. Live Plan route scoring uses the active vehicle profile for the same fuel, tank-size and standard-economy context so native Plan and saved-route alert economics do not diverge. Fuel-level and reserve inputs remain fixed route-scoring defaults unless a separate, reviewed route-scoring change introduces explicit controls.

Places & routes settings should separate key places from favourite routes. Home and Work are special quick-plan shortcuts and should stay compact until edited. Favourite routes are saved from Plan, can be renamed or removed from Settings, and may expose small helper actions such as setting the route start as Home or destination as Work. Notification controls remain in Notifications; Places & routes may show whether a route is saved or watching but should not duplicate the alert rule editor.

The discount wallet should list specific, user-recognisable Australian programmes with their connected station networks. Each programme must carry `discountType`, `expiryDate`, `sourceUrl`, `lastVerifiedAt`, `nextReviewAt`, litre cap, transaction cap, barcode requirement, participating-station scope and state/fuel exclusions where relevant. Only active `direct_cpl` offers should be visible in the wallet or applied to route pricing. Do not include discounts that require an extra in-store purchase, same-transaction spend or qualifying purchase before the driver can get the displayed c/L reduction. Everyday Rewards and Flybuys-style fuel dockets may remain in the registry when the user can choose them as a wallet entitlement, but extra-spend offers such as the Reddy/Shell Coles Express $20 in-store purchase discount must stay out of direct route pricing. An offer is active only when its expiry date is blank or today/future, its source still supports the displayed value and its next review date has not passed. If source terms have expired, fail closed: keep the record for audit if useful, but do not show it in the wallet or apply it to station pricing until refreshed evidence supports reinstatement. Do not use a generic `Fleet card` or generic motoring-club bucket as a user-facing discount unless each card or programme is modelled separately. Partner perks such as Linkt Rewards, Telstra Plus, Wilson Parking and NAB Goodies should be represented as separate 7-Eleven offers rather than merged into the generic 7-Eleven app row. Variable offers such as Costco member fuel pricing, 7-Eleven Fuel Lock, gift-card cashback and price-lock mechanics should not be shown in the direct discount wallet or subtracted from pump prices.

Discount metadata is authored once in `shared/discountRegistry.json`. The mobile app uses a generated in-project copy for Expo bundling compatibility, but the shared file remains the source of truth. Build and typecheck scripts must sync the generated mobile copy before compiling.

Discount evidence needs a monthly review loop because partner pages and app perks change quietly. Each monthly review should:

- re-open every `sourceUrl` for active and recently expired rules
- record whether the c/L value, litre cap, daily transaction cap, fuel exclusions, state exclusions, station scope, stacking rule and expiry still match the registry
- search for new or removed Australian c/L fuel offers across supermarket docket, motoring club, toll-account, telco, parking, bank, insurance, energy, seniors and clean partner programmes
- reject in-store spend, same-transaction purchase and qualifying-purchase offers from direct route pricing even when the headline c/L value is attractive
- treat account-only, docket and app-only offers as eligible only when the user has explicitly selected that entitlement and no further in-store spend or qualifying purchase condition is required
- update `lastVerifiedAt`, `nextReviewAt`, source evidence and tests in the same change
- remove or expire any offer that cannot be verified from a current source before it can influence a user-facing price

Route pricing must apply only eligible selected direct c/L discounts. If a discount has a fuel-specific value, use that value for the requested fuel. The evaluated fill volume is calculated from `tankLitres * (1 - tankPercent / 100)` with a 5 L minimum and a backend fallback of 40 L when inputs are missing. If a discount has a litre cap, route economics must cap the effective discount to the evaluated fill volume. If a discount has state inclusions or exclusions, do not apply it outside the eligible state scope. Do not stack multiple non-stackable partner discounts; use the best eligible single discount unless a provider explicitly proves stacking.

Plan recommendation and station-detail sheets should size to their content. Do not use fixed tall sheet heights that leave empty white space below the evidence or detail content.

Navigation actions inside Plan recommendation and station-detail cards should use the same arrow treatment as station list rows. Do not add a second large `Navigate to this stop` button below a station card. When the planned route endpoints are available, the arrow must open directions for the full trip via the selected fuel stop: route origin -> selected station waypoint -> final destination. A Plan route arrow must not silently open station-only directions unless route endpoints are unavailable.

Selected station-detail sheets opened from the Plan route map should stay minimal:

- do not show a separate `Station detail` heading
- do not repeat the station name above the station card
- do not show the station-row `your adjusted price` / `pump price` summary line
- keep price, station name, address, open status, data recency, confirmed discount, arrow CTA, distance and compact facts

Primary Plan, Nearby and EV cards should not duplicate detail or provenance copy already available in expanded evidence, detail panels or provider/network apps. The default card should answer `what is this`, `how far is it`, and `what action can I take`. Move freshness timestamps, provider confidence, source labels, live-bay caveats, tomorrow-price explanation and repeated connector/speed/distance sentences out of the primary card unless they materially change the immediate decision. EV charger rows should show max power, charger name, location, connector compatibility, one distance or detour label and the navigation action. Near-zero charger distances should use a human label such as `Here` or `At route point`, not `0.0 km away`.

Collapsed Plan summaries should keep only the route and the edit action by default. Do not show a `PLAN TRIP` eyebrow or repeat vehicle profile details in the collapsed card, because the Plan controls and Account settings already own that context.

EV route charger panels should stay map-first. Show only the selected charger and one comparison row in the sheet, with the remaining count described as visible on the map. Keep provider/source, freshness and live-bay caution copy out of the primary EV card. Use a compact connector warning only when no connector preference is set, and keep availability checking as an action implied by navigation/network app use rather than a repeated paragraph.

EV route charger ordering is route-guidance, not charger-stop optimisation. The backend samples charger directories along the route, gathers more candidates than the UI displays, estimates or route-checks detour where available, then ranks final rows by a cautious score using:

- return detour distance and minutes
- route progress, with tighter trips favouring mid/late-route options
- charger power, capped so high power helps but does not erase large detours
- endpoint penalty for tight or charging-needed trips

The score may be returned for diagnostics, but user-facing copy must not call the first EV row `best`, `optimised` or `guaranteed available` until commercial provider evidence and availability semantics are approved.

Plan route maps should keep one clear recommended station while also showing broad, controlled fuel-price coverage along the trip. The recommendation card and first sheet rows may stay tightly ranked, but the map should not collapse a long route to only a few early-route pins or flood the route with every available station. For Plan routes, return a broader display set of route candidates/context stations, then render a tightly capped, route-progress spread so users can see later-trip fuel options and understand that the route has been checked end to end without turning the route into a price-marker carpet. Map-only marker ordering may spread candidates by route progress; it must not change the ranked recommendation order or the selected best-stop logic.

Plan route failure states should never show raw JavaScript errors, undefined route-shape errors or provider stack details. If scoring returns a valid score payload without a route shape, the frontend should preserve the route endpoints and show the score result or an empty recommendation state rather than crashing. If routing or scoring is unavailable, show a plain recovery message that points users back to retrying, editing the route or checking Nearby fuel.

Nearby NT station search may return labelled available-fuel alternatives when the requested fuel has no exact MyFuel NT price within the search area. If the strict search radius would otherwise return nothing, NT may expand the alternative-fuel radius and must disclose the expanded radius in the response context and warning. Alternative results must keep the real available fuel and price, set an explicit non-exact match signal, and warn that the requested fuel was not found nearby. Do not copy, infer or relabel an alternative fuel price as the requested fuel price.

When exact fuel is unavailable but alternatives are shown, the UI must explicitly say the exact requested fuel is unavailable and name the alternative fuel being shown. Example: if the user asks for `PDL` and only `DL` is available, the price tile, row, selected card, result notice and result context strip must show `DL` as the displayed fuel and must not make the alternative diesel price look like `PDL`. In Plan route contexts, the notice should say the fuel is unavailable `on this route`; in Nearby contexts it should say `nearby`.

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
- Suppress the metric when the value is zero. Use `Best stop for this trip` as the recommendation label instead.
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
- Legacy work/fleet brand limits are no longer user-facing. Stored legacy brand-limit preferences must normalise to off rather than silently limiting route recommendations.
- Do not imply membership, fuel-card, voucher or loyalty eligibility unless it is selected and supported by the user's preferences.

### Detour evidence

Plan must distinguish checked detours from estimated detours.

`Detour checked` means the backend route engine compared:

```text
origin -> station -> destination
minus
origin -> destination
```

`Estimated detour` means the stop uses smart-detour estimation or route-engine refinement was unavailable, timed out or not requested.

Example:

```text
CHECKED DETOUR
0.1 min
```

Rules:

- Show `Detour checked` only when the candidate has `actualDetour.source = route_engine_via_station`.
- Show `Estimated detour` for all other fuel route candidates.
- Do not expose approximate same-side-road, turn-friction, traffic-aware or toll-optimised claims in Plan recommendation copy.
- Do not imply a stop is exact, traffic-aware or toll-cost optimised unless the provider supplied that signal and the scoring path used it.
- It is acceptable to say `about 3.2 min`, because even route-engine detours are still provider estimates.

### Savings labels

Recommendation labels should stay simple:

- `Small savings detour`
- `Medium savings detour`
- `Good savings detour`
- `Great savings detour`
- `Strong savings detour`

Do not add a separate `Detour` eyebrow above these labels.

For the Plan recommendation card, the default headline should stay trip-oriented: `Best stop for this trip`. A compact rationale summary may sit inside the station card when it only restates verified route-saving and detour evidence, for example `Saves 20.0 c/L on this trip with a 4.0 min checked detour.` Savings-detour labels may still appear in supporting evidence, but the compact card should prioritise the chosen stop, the route c/L lead and the detour evidence over internal label thresholds.

### Result context metrics

Result context metrics are secondary diagnostic context, not a ranking explanation. They should not appear as a primary Plan or Nearby card group when `Why?` or expanded evidence already explains the recommendation. When a deeper diagnostic surface uses them, they may show:

- cheapest displayed candidate price, labelled with the displayed alternative fuel when exact fuel is unavailable
- typical displayed candidate price, labelled with the displayed alternative fuel when exact fuel is unavailable
- displayed candidate price spread
- station or eligible-candidate count

These values describe the returned result set and provider context. They must not override the recommendation, create a new savings claim, or imply wider market coverage than the returned candidate/context data supports.

The strip must not present alternative-fuel prices as if they were exact requested-fuel prices.

The primary result surface must not show a standalone result context strip. Keep these details in `Why?`, diagnostic evidence, support tooling or deeper expanded explanations where they are useful.

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

Sample-data runs should remain deterministic by setting `FUEL_PATH_SAMPLE_NOW` so sample freshness behaviour is reproducible under local performance and production-similar hardening checks.

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

`api/score` also accepts optional decision-rule overrides for explicit API callers:

- `minSavingDollars` — minimum after-detour savings threshold required for a station to count as a viable match (defaults to $1.50; values below 0 are treated as 0).
- `maxDetourMinutes` — hard upper bound for detour pass/fail even when the smart rule would permit more (defaults to 30; bounded to 1..30).

Native live Plan requests must send the active vehicle tank size, the standard economy estimate for that vehicle energy type, `minSavingDollars` and `maxDetourMinutes` to `api/score`. Once a Plan result is visible, changing the active vehicle, tank size, minimum saving or maximum detour must re-run the route score so the native recommendation does not display stale economics. Fuel-level and reserve values remain fixed native defaults of 45% tank and 35 km reserve until explicit reviewed controls exist.

These values are intentionally not user-facing controls in current UI patterns, but scoring contexts and recommendation evidence must preserve them.

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

Do not add hidden fuel-level reachability assumptions for fuel vehicles. Tank size may be supplied from the active vehicle profile for scoring economics, but it should not become a prominent Plan control.

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

- keep actual detour routing off by default for score-only calls unless explicitly requested or feature-flagged
- for combined Plan route scoring, run actual detour routing for the top 3 candidates by default unless explicitly disabled
- after the top-candidate pass, route-check any same-price candidate group that can become the final recommendation, capped by `FUEL_PATH_ACTUAL_DETOUR_FINAL_LIMIT` with a default of 4 and a hard cap of 6
- cap route-engine detour checks to a small top-candidate set plus the final same-price recommendation check
- use a strict timeout and fall back to smart detour estimates when route-engine refinement is slow or unavailable
- record actual detour source, provider, base distance/time and via-station distance/time
- when actual detour routing succeeds, recalculate detour fuel, detour cost, net saving, time cost, decision-rule pass/fail and backend score from the route-engine detour before final ordering
- include route-position metadata for candidates, including near-origin, mid-route, near-destination and endpoint-adjacent/backtracking-risk hints
- include approximate same-side-road and turn-friction metadata only as route-geometry hints, not as proven navigation truth
- do not claim live traffic or toll-aware optimisation unless the route provider actually supplied that signal
- user-facing Plan copy should show only `Checked detour` or `Estimated detour` evidence, not same-side-road, turn-friction, traffic or toll claims
- keep approximate smart-detour scoring as the safe fallback when actual detour routing is unavailable
- use dynamic corridor attempts: narrower for short urban routes and wider for long regional/remote routes

Traffic-aware routing may be requested only through explicit request/provider configuration. If enabled, route quality should move to `high` only when the provider returns a traffic-aware route.

Toll preference may be passed to the route provider. Google toll estimates may be captured in actual-detour metadata when supplied. Toll-cost ranking may only apply inside actual-detour mode, and only using provider-supplied toll deltas. Do not claim general toll-cost optimisation until toll charges are consistently available and included in ranking.

Historical/cycle intelligence remains measurement-gated. Back-test storage must be durable and meet sample-size, mean-absolute-error and direction-accuracy thresholds before limited cycle guidance can be considered. User-facing prediction copy remains disabled until those gates are met and reviewed.

Fuel Path must treat `petrol cycle guidance` and `local price trend` as separate product claims:

- `petrol cycle guidance` is only eligible for known Australian unleaded petrol cycle markets: Sydney, Melbourne, Brisbane, Adelaide and Perth/Mandurah.
- `petrol cycle guidance` is only eligible for unleaded petrol grades: E10, U91, P95 and P98.
- LPG route and Nearby support is current-price comparison only. It may use live provider prices, selected discounts and the normal route economics, but it must not imply petrol-cycle timing or an LPG-specific prediction claim.
- Diesel, premium diesel, LPG, EV charging and unsupported fuels must not receive petrol-cycle copy. They may only receive current-price comparison or local trend copy when enough evidence exists.
- Canberra, Hobart, Darwin and regional markets must not receive petrol-cycle copy by default. They may receive local trend copy only when enough fresh local observations exist.
- State-level requests such as `NSW` or `WA` are not enough to prove a city cycle market. Cycle guidance must be scoped to the supported city/market, not the whole state.
- Prediction back-test records must include market scope for launch-grade cycle evidence. Older state/fuel-only records may remain useful for measurement history, but readiness must remain `measurement_only` with `prediction_market_scope_missing` until enough completed market/fuel-scoped records meet the configured thresholds.
- Market-scoped evidence may be collected by the scheduled prediction back-test job. The job uses supported petrol-cycle markets and fuel grades only, samples exact live prices around the market centre, records the median market price to `fuel_path_market_price_snapshots`, completes due back-tests before seeding new ones, and seeds the next target day using a simple market-median persistence baseline when daily capacity remains. The job must stay capped and cache-friendly: default production collection is 5 market/fuel checks per day, configurable with `FUEL_PATH_PREDICTION_BACKTEST_DAILY_LIMIT`, and prioritised by due back-tests, under-sampled market/fuel pairs and stale snapshot coverage. Passive observations from already-fetched station responses may also write market snapshots when the user query is near a supported market and has enough exact prices; this must not trigger additional provider calls. This baseline is measurement infrastructure only. It must not be described to users as a forecast, price-cycle prediction, best-day recommendation or Fuel Path timing advice.
- Provider-level batching is allowed only through explicit provider/market pilots. Approved pilots are Sydney/NSW petrol batching, Brisbane/QLD petrol batching and Adelaide/SA petrol batching inside prediction evidence collection. When multiple selected pilot-market petrol fuels can be derived from one existing provider station response, the collector may write multiple market snapshots from that single provider response. If batch evidence is incomplete or unusable, the collector must fall back to the existing per-market/fuel path. Do not generalise this rule to WA FuelWatch, VIC or other providers until each provider's batching behaviour is reviewed and covered by tests.
- Batch groups must be scheduled deliberately, not only opportunistically. The Sydney/NSW, Brisbane/QLD and Adelaide/SA pilot batch groups each contain E10, U91, P95 and P98, consume four daily collection slots when selected, run on their configured cadence when stale, and are pulled forward when any member has a due back-test. The daily cap still applies, and remaining capacity may be filled by normal due/stale/under-sampled market-fuel prioritisation.
- WA tomorrow locked prices are official FuelWatch source data, not model prediction, and must be labelled separately from any cycle or trend signal.
- Local trend copy must use cautious wording such as `prices have been rising locally` or `recent local prices are mixed`; it must not say `cycle`, `bottom`, `peak`, `best day` or `wait/fill now` unless the limited cycle-guidance gate has passed for that exact market and fuel.

Prediction or cycle guidance must not be added to Nearby, Plan, alerts, saved routes or marketing copy unless the prediction readiness API reports:

- `status: ready_for_limited_cycle_guidance`
- `accuracyClaimsAllowed: true`
- durable prediction back-test storage
- completed sample size and direction sample size at or above the configured thresholds
- mean absolute error at or below the configured threshold
- directional accuracy at or above the configured threshold
- supported market and fuel scope for the requested timing claim
- clear blind spots covering uncovered regions/fuels, provider staleness/outages, station-level variance and WA tomorrow-price labelling

Even when those gates pass, `userFacingPredictionEnabled` must remain `false` until a separate product review approves the exact copy and scope. Any user-facing prediction copy must show the measured sample size, directional accuracy, mean absolute error, model horizon, market/fuel scope and blind spots. WA tomorrow locked prices are official source data, not model prediction, and must be labelled separately.

Fuel-cycle alerts have one additional delivery gate: `FUEL_PATH_CYCLE_ALERTS_ENABLED` must be explicitly enabled after the product review. Until then, cycle status may be evaluated and recorded in the background, but it must not be the reason a push notification is sent.

Personalised commute optimisation is local-behaviour gated. The app may classify readiness from aggregate behaviour such as repeated route plans, saved commutes, route alert opt-ins and navigation opens. It must not require exact saved addresses, route geometry, push tokens or provider secrets for that evidence.

## EV route fallback rules

EV route charging guidance is prototype route-corridor charger discovery, not live availability guidance.

Primary API files:

```text
api/ev-chargers.js
api/_evRouteFallback.js
```

Rules:

- Use the same configured EV provider cascade as Nearby EV search.
- Keep Google Places EV as the first real provider candidate only when explicitly enabled with server-side cost and terms controls.
- Google Places EV must reserve quota with the separate `google_places_ev` quota key before every provider call. `FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP` must be greater than zero, and production must use durable quota storage before EV Google traffic is allowed.
- `/api/status` must expose provider observability for paid Google Places geocode fallback and Google Places EV charging. The observability block must include cap, used, remaining, usage percent, readiness blockers, watch warnings and stop-state without exposing API keys.
- Paid provider observability should classify each paid lookup path as `normal`, `watch` or `stopped`; `watch` starts at 80 percent usage and `stopped` starts at 95 percent usage or any readiness/quality blocker.
- User-facing settings may show only a compact provider-safety label. Detailed provider/source diagnostics belong in status/support tooling, not primary Plan/Nearby cards.
- Keep API Ninjas as fallback coverage, not the preferred default when a stronger EV directory candidate is configured.
- Demote OpenWeb Ninja behind Google Places EV and Open Charge Map while rate-limit behaviour remains unresolved; explicit cascade configuration may still force it for trials.
- Treat Open Charge Map empty responses as non-useful for the cascade, so route charging can continue to other configured providers instead of stopping on zero rows.
- If no EV directory provider is configured in local development, the backend may return sanitised local prototype EV charger rows so EV Plan does not go blank. These rows must be labelled as prototype directory data and must not be described as live, guaranteed or production coverage.
- Do not hard-wire EV route fallback to a single trial provider.
- Preserve connector filters supplied by the user or vehicle profile.
- Electric Plan mode must treat route charger options as the primary result, similar to fuel stop options.
- Electric Plan mode must keep route distance against selected usable EV range as context only. A comfortable range status must not suppress route charger discovery or make the result look complete without charger options.
- Electric Plan route copy should be compact. Avoid duplicate range-check panels, repeated headings, and long caution paragraphs in the primary route sheet.
- Electric Plan mode should classify the route as `comfortable`, `tight`, `charging_needed` or `unknown`, but that classification must not gate whether charger options are requested or displayed.
- Electric Plan mode should show compatible route chargers whenever a route is planned, not only when fuel stops are absent.
- Gather EV route chargers across the route corridor, including origin, intermediate route points and destination where route geometry allows.
- Rank fallback chargers by route-corridor proximity, then refine detour with the route engine where available.
- Refine candidate detours in parallel so one slow route-engine call does not serially delay every EV fallback result.
- Do not claim live bay availability unless the provider supplies real-time status.
- Keep provenance clear that EV route fallback uses directory data.

Current provider cascade behaviour:

```text
explicit default if set, otherwise Google Places EV when enabled, Open Charge Map when configured, OpenWeb Ninja when configured, then API Ninjas fallback; continue through configured fallback providers until usable charger rows are found or the cascade is exhausted
```

Reason:

Remote and regional EV coverage differs materially by provider. Route fallback should not fail a viable corridor only because the first cheap provider has thin coverage.

Google Places EV charging is a trial candidate only. It must stay behind explicit server-side enablement and must not be used for public live-availability or tariff claims until terms, cost controls, attribution and route-guidance rights are approved.

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

- Plan result sheet renders with `Why this stop`, `Best stop for this trip` and route saving/detour evidence when available.
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

Official live source identifiers recognised by route scoring are:

```text
api_nsw_fuelcheck
api_qld_fuelprices
api_wa_fuelwatch
api_vic_servo_saver
api_sa_fuel_price_reporting
api_tas_fuelcheck
api_nt_myfuel
```

Plan route scoring may need live fuel data from more than one provider region. Independent regional provider loads should run in parallel and then be aggregated in stable provider order. Multi-state routes must request every configured provider touched by the route geometry rather than stopping at the first matching state. This keeps multi-state route latency bounded by the slowest required provider rather than the sum of every required provider. Do not change ranking, rejection, source attribution or warning semantics just to optimise latency.

Fuel Plan routes should use the combined `/api/score` mode from the app by sending `from` and `to` points instead of a pre-built `route`. This returns both route geometry and route scoring in one response, and it may preload endpoint fuel providers while route geometry is being built. The old `/api/route` then `/api/score` sequence should be kept only for legacy/testing paths or non-fuel route flows such as EV fallback.

Plan route geometry must remain dense enough for native and web maps to read as a road-following route, not straight-line legs. Combined `/api/score` responses and mobile route payload compaction should preserve up to 1,200 route points before display sampling. Do not reduce this budget without replacing it with a geometry-aware simplifier and rerunning long-route native map evidence.

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
Best stop for this trip
Recommended
Saves 20.0 c/L on this trip
Best route value found
Compared with the next-best route option at 176.9 c/L. Your price includes eligible discounts.
Suggested stop adds a 0.1 min detour and is best by 20.0 c/L.
```

Route navigation must preserve the route contract when the user opens directions from a Plan recommendation. The outbound URL must include origin, the recommended station as a waypoint, and the final destination. Device Maps and Google Maps on Android should use native Android intents where possible, while Apple Maps may use a web handoff on Android because there is no native Android Apple Maps app. Do not silently switch this action to a provider unless the implementation can preserve the detour stop plus final destination. Waze may remain stop-first because its native route handoff does not preserve the full final-destination contract; label that option as `Waze to stop` rather than full-route navigation.

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
- whether a future work-account flow should reintroduce brand restrictions with explicit user-facing controls
