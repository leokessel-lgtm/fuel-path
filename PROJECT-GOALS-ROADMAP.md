# Fuel Path Project Goals And Roadmap

Last updated: 17 June 2026, Australia/Sydney

## Main Project Goals

Fuel Path should be a whole-of-Australia fuel decision app, not a state-first fuel map. Feature depth can vary by jurisdiction, but every state and territory must have an explicit capability state so users never confuse missing data with a genuine recommendation.

Fuel Path should stay focused on four differentiators.

### Goal 1: Best Fuel Decision, Not Another Map

Fuel Path tells the driver the best fuel action for an actual trip:

- fill here
- fill on route
- wait
- skip because the saving is not worth it
- top up earlier because range or availability is risky

The map supports the decision. It is not the product by itself.

### Goal 2: Your Real Price

Fuel Path shows the price that applies to the user, not only the pump price.

This includes:

- vehicle and fuel type
- selected discounts and memberships
- supermarket dockets and fuel locks where known
- member-only eligibility
- fleet-card or approved-brand rules for fleet-lite users

Pump price must remain visible beside the user's adjusted price.

### Goal 3: Smart Saved-Route Alerts

Fuel Path becomes useful before the user opens the app.

Alerts should be based on saved routes, timing, tank context, route prices, cycle signals where valid, and whether the saving is worth the detour.

Do not build generic fuel spam. Build timely route prompts.

### Standing Goal: Lean And Fast App

Fuel Path should stay light to download, quick to open and smooth to use.

This includes:

- dependency discipline
- compact local storage
- optimised app assets
- backend-owned heavy scoring and price-cycle analysis
- native map performance
- binary-size and startup-time baselines before store release

Performance is a release metric, not a polish task. See `PERFORMANCE-GUARDRAILS.md`.

### Goal 4: Prediction And Cycle Guidance

Fuel Path can show timing guidance only where the evidence supports it.

This includes:

- no-cycle-signal states for unsupported regions, fuels or sparse histories
- confidence labels that explain why the signal is high, medium or low
- back-testing before any prominent prediction or accuracy claim
- route recommendations that still work when cycle guidance is unavailable

Do not market prediction before measured evidence supports it.

## Product Principles

- Lead with the decision, not the map.
- A stale cheap price is not a bargain.
- Route value beats raw cheapest price.
- Confidence must be visible and humble.
- Prediction must be back-tested before it is trusted.
- Keep the app lean, fast and ad-free in the core flow.

## National Provider Capability Matrix

The app should represent all Australian states and territories as first-class regions.

| Region | Current capability | Roadmap status |
| --- | --- | --- |
| NSW | Live provider validated | Keep live support, confirm commercial/caching/attribution terms |
| ACT | Covered through API.NSW FuelCheck feed | Keep visible as ACT capability, confirm permitted usage terms |
| QLD | Live provider adapter validated | Confirm licence/usage constraints before public/commercial launch |
| WA | First FuelWatch adapter implemented for Perth/metro | Expand beyond metro without excessive provider requests |
| VIC | Pending Servo Saver API access | Implement adapter after approved schema is available |
| SA | Pending access path | Confirm API/access process and implement adapter |
| TAS | Pending provider implementation | Confirm feed access and implement adapter |
| NT | Pending access path | Confirm MyFuel NT data/API access and implement adapter |

Capability labels in the app and backend should be:

- `live`
- `limited`
- `pending_access`
- `fallback`
- `unsupported`

## Goal-Level Success Metrics

### Goal 1: Best Fuel Decision, Not Another Map

- 8/8 regions represented in the capability matrix.
- No region silently returns misleading empty results.
- Warm route planning response under 3 seconds for common Australian metro and regional routes.
- No top recommendation from data older than the freshness threshold.
- No horizontal overflow on supported mobile widths.
- 95% of valid route searches return either a recommendation or a specific, useful failure reason.
- Real validation: at least 6 of 8 users say Fuel Path reduces manual comparison effort.

### Goal 2: Your Real Price

- 100% of recommendations preserve pump price beside adjusted price.
- 0 known cases where an unconfigured discount changes the top recommendation.
- Discount rule regressions cover brand match, region mismatch, unsupported program, member-only station and no-wallet user.
- Real validation: at least 5 of 8 users understand the difference between pump price and their price.

### Goal 3: Smart Saved-Route Alerts

- 0 alerts from stale, unsupported or below-threshold data.
- 100% duplicate suppression for the same route, station and reason within the configured cooldown.
- At least 60% of beta users rate received alerts as useful.
- Alert opt-out caused by noise stays under 10% during beta.

### Goal 4: Prediction And Cycle Guidance

- 100% of unsupported regions, fuels and sparse histories avoid forecast-style copy.
- Back-test coverage exists before prediction appears as a primary decision driver.
- No user-facing "accurate" or "predicts" claim appears without measured error evidence.

## Goal 1 Breakdown

Goal 1 is the current priority. The product must first prove that it can make a better fuel decision than a user manually scanning a map, across the whole Australian capability matrix.

### 1.0 National Capability Coverage

**Objective:** Let drivers use Fuel Path across every Australian state and territory with honest capability labels.

**Build scope:**

- Normalised provider contract for every state and territory.
- Backend status exposes regional capability without leaking provider secrets.
- UI surfaces capability when data is live, limited, pending access, fallback or unsupported.
- Region-specific blockers never appear as silent empty results.

**Success metrics:**

- 8/8 regions represented in the capability matrix.
- Every region has one of the approved capability labels.
- Provider-routing tests cover supported, limited, pending and unsupported states.
- Empty states explain no stations, no provider access, stale feed, route failure or geocode failure separately.

**Priority:** P0, immediate.

### 1.1 Trip Intent Capture

**Objective:** Let the user quickly tell Fuel Path where they are going.

**Build scope:**

- From field.
- To field.
- Saved route suggestions.
- Selected vehicle and fuel type visible before route planning.
- Plan route CTA in the first useful mobile view.

**Success metrics:**

- A new user can enter or pick a route and plan it in under 30 seconds.
- On mobile, the Plan route CTA is visible without long scrolling.
- Saved route suggestions reduce typing for repeat routes.
- No required tank/economy setup blocks the first route.

**Priority:** P0, immediate.

### 1.2 Route-Corridor Station Discovery

**Objective:** Find stations that are relevant to the actual drive, not just close in a straight line.

**Build scope:**

- Resolve a real route.
- Identify stations close enough to the route corridor.
- Keep nearby non-route stations visible as context.
- Explain when no useful station is found.

**Success metrics:**

- Metro routes return enough candidates to compare meaningfully when data exists.
- Longer metro, regional and interstate routes do not silently show empty results.
- Results clearly separate "on route" from "nearby context".
- The app never leaves the user staring at a blank result without a reason.

**Priority:** P0, immediate.

### 1.3 Net-Decision Scoring

**Objective:** Rank stations by the real value of stopping there.

**Build scope:**

- Pump price.
- Route median or typical route price.
- Detour time.
- Extra fuel burned by the detour.
- Estimated net saving.
- Basic range safety.
- Price freshness penalty.

**Success metrics:**

- The cheapest pump price does not automatically win if detour cost makes it worse.
- Every ranked result explains the main reason for its position.
- Inputs such as fuel type, vehicle and route change the ranking.
- Regression tests cover "cheapest is not best", "discount changes ranking" and "range risk".
- UI preserves best value, cheapest, closest and not-worth-detour states without implying they are the same thing.

**Priority:** P0, immediate.

### 1.4 One Clear Recommendation

**Objective:** Turn the scoring into one plain decision the user can act on.

**Build scope:**

- One top recommendation card.
- Short action label: fill here, fill on route, wait, skip, or top up.
- One primary reason.
- One key risk or confidence cue.
- Detail hidden behind a secondary disclosure.

**Success metrics:**

- 4 of 7 validation participants understand the recommendation without explanation.
- Recommendation copy fits in a compact mobile card.
- The map remains visible or immediately reachable after planning.
- Users can explain why the top station won.
- The top card includes action, station, net saving, detour, source, freshness and confidence cue.

**Priority:** P0, immediate.

### 1.5 Connected Map And Ranked Results

**Objective:** Make the map and list feel like one decision surface.

**Build scope:**

- Numbered ranked markers.
- Brand or station identity on markers where practical.
- Price visible on markers.
- Selecting a station in the list highlights it on the map.
- Selecting a marker opens the matching ranked station.
- Navigate, favourite, alert and report actions available from station detail.

**Success metrics:**

- Users can match the top ranked result to the map without thinking.
- List-to-map and map-to-list selection works both ways.
- Route stops and nearby context stations are visually distinct.
- No duplicate detached "stations" sections.

**Priority:** P1, next.

### 1.6 Trust, Freshness And Exceptions

**Objective:** Prevent the app from making confident recommendations from weak data.

**Build scope:**

- Source label.
- Price timestamp and age.
- Freshness rule: live prices older than 48 hours can appear as map/context data, but cannot win the route recommendation.
- Quiet timestamp detail instead of stale-price headline copy.
- Open-now or unknown-hours state.
- Member-only or eligibility warning.
- No-cycle-signal wording where cycle logic does not apply.
- Empty, stale, no-route and no-candidate states.

**Success metrics:**

- Every recommendation shows source and freshness.
- Stale or uncertain data is visible before the user navigates.
- No station is recommended as "best" if it fails a critical eligibility, freshness or availability rule.
- Trust concerns in validation are mostly about data availability, not confusing wording.
- Closed, unavailable, restricted, unsupported or unreachable stations are downgraded or blocked before navigation.

**Priority:** P1, next.

### 1.7 Mobile-Native Decision Flow

**Objective:** Design the experience around the phone behaviour the product needs.

**Build scope:**

- Map-first result state after planning.
- Bottom-sheet style ranked results.
- Sticky primary action.
- Minimal above-map setup.
- Touch-friendly station detail.

**Success metrics:**

- After planning, users can see the route map and top result without manual scrolling.
- Core controls fit comfortably on a small phone viewport.
- No horizontal overflow.
- The app feels like a task tool, not a long web page.

**Priority:** P1, next.

### 1.8 Map Camera And Interaction Confidence

**Objective:** Make the map feel as responsive and intentional as leading mobility apps.

The map should maximise useful viewing area, keep the route or nearby search area visible despite cards and sheets, and move calmly when the user selects a station or changes context.

**Build scope:**

- Route-led camera fitting that frames the actual path first, not every station dot.
- Dynamic breathing room around the visible route/search area.
- Bottom-sheet and top-control-aware map padding.
- Selected station focus that keeps the station visible without losing trip context.
- Manual map movement protection so the app does not fight user panning and zooming.
- Clear recenter/return-to-route behaviour.

**Success metrics:**

- After planning, the full route path is visible with minimal wasted empty map.
- Top controls, recommendation cards and result sheets do not cover critical route or station information.
- Selecting a station from the list visibly moves or highlights the map marker.
- Manual map movement is respected until the user explicitly recentres or changes context.
- Users do not need to pinch/drag just to recover the route overview.

**Priority:** P0, immediate.

### 1.9 Real-User Validation

**Objective:** Prove that the recommendation changes behaviour.

**Build scope:**

- Run the validation workbook with recruited participants.
- Test commuters, high-frequency drivers and one small fleet/tradie operator.
- Capture minimum saving, max detour and trust thresholds.

**Success metrics:**

- 4 of 7 participants say the recommendation would change a real fuelling decision.
- 4 of 7 understand the top recommendation without explanation.
- 3 of 4 commuter/high-frequency participants want saved-route alerts.
- At least one fleet/tradie participant confirms fleet-lite value.
- At least 6 of 8 users say Fuel Path reduces manual comparison effort before public beta.

**Priority:** P1, next.

## Goal 2 Breakdown

Goal 2 starts after Goal 1 is credible enough that users trust the recommendation surface.

### 2.1 Pump Price And User Price

**Objective:** Show the public pump price and the user's eligible adjusted price without hiding either.

**Build scope:**

- Pump price visible in every station row and recommendation.
- Confirmed user price shown only when the user has configured an eligible discount or membership.
- Possible lower price labelled as possible, not guaranteed.
- Rule source and reason shown for every adjusted price.

**Success metrics:**

- 100% of station rows preserve pump price.
- 0 known cases where an unconfigured discount changes the top recommendation.
- Validation users can explain the difference between pump price and user price.

**Priority:** P1, next.

### 2.2 Eligibility And Restricted Prices

**Objective:** Prevent users driving to prices they cannot access.

**Build scope:**

- Member-only warning.
- Fleet-only warning.
- Eligibility-unknown warning.
- Region and brand mismatch checks.
- Recommendation downgrade or block when eligibility is missing.

**Success metrics:**

- Restricted prices cannot win unless user eligibility is configured.
- Regression tests cover brand match, region mismatch, unsupported program, member-only station and no-wallet user.
- Every restricted-price warning is visible before navigation.

**Priority:** P1, next.

### 2.3 Account Preference Hub

**Objective:** Capture vehicle, fuel, tank and discount preferences once so Plan stays fast.

**Build scope:**

- Vehicle profile.
- Fuel type.
- Tank size and economy.
- Discount wallet.
- Multiple vehicles later only if validation proves need.

**Success metrics:**

- Plan can be used without re-entering profile data.
- Local saved-profile reads stay under 100 ms.
- No profile data is sent to the backend unless required for a user-visible calculation or synced alert.

**Priority:** P1, next.

## Goal 3 Breakdown

Goal 3 moves Fuel Path from a trip tool to a habit tool.

### 3.1 Backend Saved-Route Alert Evaluation

**Objective:** Send alerts only when a saved route is worth checking.

**Build scope:**

- Backend-owned route alert evaluation.
- Region capability check.
- Source freshness check.
- Saving and detour thresholds.
- Suppression and cooldown.
- Push delivery after native notification validation.

**Success metrics:**

- 0 alerts from stale, unsupported or below-threshold data.
- Duplicate route/station/reason alerts are suppressed within the configured cooldown.
- Every non-send status has a clear reason.

**Priority:** P2, later.

### 3.2 Explainable Alert Copy

**Objective:** Make every alert understandable and non-spammy.

**Build scope:**

- Route context.
- Fuel type.
- Station area.
- Reason for alert.
- Freshness or confidence cue.
- Regional limitation explanation when alerts are unavailable.

**Success metrics:**

- Alert copy always explains why it was sent.
- At least 60% of beta users rate received alerts as useful.
- Alert opt-out caused by noise stays under 10% during beta.

**Priority:** P2, later.

### 3.3 Quiet Controls

**Objective:** Give users control over notification noise.

**Build scope:**

- Pause route alerts.
- Quiet windows.
- Quiet days.
- Missing permission and missing token states.

**Success metrics:**

- Paused routes send nothing.
- Quiet windows are respected.
- Missing permission, missing token and unsupported region states are visible in Account.

**Priority:** P2, later.

## Goal 4 Breakdown

Prediction is not a headline feature until it earns trust.

### 4.1 No-Cycle-Signal Mode

**Objective:** Avoid unsupported forecast claims.

**Build scope:**

- Unsupported regions show no-cycle-signal wording.
- Unsupported fuels show no-cycle-signal wording.
- Sparse histories show no-cycle-signal wording.
- Route recommendation still works without cycle guidance.

**Success metrics:**

- 100% unsupported cases avoid forecast-style copy.
- No unsupported region or fuel uses "predicts", "accurate" or equivalent claim wording.

**Priority:** P2, later.

### 4.2 Prediction Back-Testing Foundation

**Objective:** Measure forecast quality before surfacing prediction as a primary decision driver.

**Build scope:**

- Store prediction runs by region, fuel and date.
- Store actual outcomes by region, fuel and date.
- Track mean absolute error and sample size.
- Gate user-facing accuracy claims behind measured evidence.

**Success metrics:**

- Back-test records exist before prominent prediction UI.
- No user-facing accuracy claim appears without measured error evidence.

**Priority:** P2, later.

### 4.3 Plain Confidence Labels

**Objective:** Explain confidence without pretending precision.

**Build scope:**

- High, medium and low confidence labels.
- Reasons such as fresh official data, sparse history, stale feed or irregular pattern.
- Confidence shown beside timing guidance and trust cues.

**Success metrics:**

- Every confidence label includes a reason.
- Validation users understand that confidence is not a guarantee.

**Priority:** P2, later.

## Prioritised Build Roadmap

### Now: Prove Goal 1

1. Build the national provider capability matrix into backend status and user-facing capability states.
2. Keep production-grade address suggestions behind the backend provider adapter.
3. Keep route results to a useful decision set, with progressive expansion for long metro, regional and interstate routes.
4. Keep stale-price severity and region capability in recommendation confidence.
5. Keep Plan Trip focused on trip intent, one recommendation and route map.
6. Keep secondary setup behind Account or detail views.

### Next: Make The Decision Trustworthy

1. Add clearer availability, eligibility and region-capability warnings.
2. Add proper "not worth detour", unsupported-region and stale-data downgrade states.
3. Expand break-it tests around scoring, provider failures, accessibility and frontend state.
4. Run real validation sessions.
5. Confirm provider commercial, caching and attribution permissions by jurisdiction.

### Then: Bring In Goals 2 And 3

1. Expand live brand/network discount rules for "your real price" nationally where rules are known.
2. Add backend-driven route alert checks that evaluate saved routes before the user's normal travel window.
3. Add price-cycle guidance only where region, fuel type and history support it.
4. Add prediction back-testing storage before prediction becomes a primary decision driver.
5. Add fleet-lite approved stop mode.

### Always: Keep The App Lean

1. Track native build size once EAS preview builds start.
2. Flag unexplained app size growth over 10%.
3. Keep saved-route data compact and capped unless user research proves otherwise.
4. Avoid native SDKs that do not support a core Fuel Path job.
5. Keep heavy price-cycle, route scoring and data joins out of the app binary.

### Native App Direction

1. Keep the web demo as the scoring and validation harness.
2. Refine Plan, Nearby and Account as mobile app screens.
3. Continue the Expo/React Native shell while Goal 1 validation and address/search provider choice settle.

## Current Build Rule

Until Goal 1 validates, every new build item should answer yes to at least one of these:

- Does it help the user plan a real trip faster?
- Does it make the recommendation more accurate?
- Does it make the recommendation more trustworthy?
- Does it make the map and ranked result easier to connect?
- Does it improve whole-of-Australia capability without hiding regional limitations?
- Does it include success metrics and break-it tests from `NATIONAL-TESTING-REGIME.md`?

If not, park it.

## Done Definition

A roadmap or backlog item is done only when:

- user story and success metrics are documented
- happy path and break-it tests are added or manually recorded
- accessibility and performance impact are checked
- provider and capability limitations are visible to the user
- stale, restricted or unsupported data cannot silently drive a confident recommendation
- production smoke passes after deploy, when the change reaches production

Use `NATIONAL-TESTING-REGIME.md` as the release gate for feature, integration and production checks.

## Build Progress

### 14 June 2026

Completed the first Goal 1 build pass:

- added adaptive route-corridor scoring for sparse long routes
- returned route-context stations to keep the map useful beyond ranked stops
- simplified the recommendation into one action, reason and trust cue
- connected ranked list selection with the selected map marker and station detail
- strengthened empty states, source, freshness, eligibility and availability cues
- added regression coverage for adaptive corridor expansion

Goal 1 remains open until real validation shows users understand the recommendation and would change a fuelling decision because of it.

Ran the first internal validation pass against the current live prototype:

- validated mobile Plan, Nearby, Account and list-to-map interaction paths
- confirmed local Nominatim plus OSRM address/routing works for suburbs and POIs in validation mode
- identified that long routes can return too many ranked stations for mobile use
- identified that live discount-wallet logic needs brand/network rules because FuelCheck station payloads do not include discount eligibility
- identified that saved-route alert logic needs a visible Plan card
- fixed invalid typed-route behaviour so unresolved addresses no longer show sample-corridor recommendations

Applied P0 follow-up fixes from that pass:

- limited route ranked results to a decision-sized set with progressive expansion
- downgraded recommendations when live prices are very stale
- added a visible saved-route alert card in Plan and fixed matched-route activation
- added live brand/network discount rules on top of FuelCheck data
- changed discount scoring to use the best single eligible program rather than stacked discounts
- added internal validation address suggestions for From and To fields
- cleaned selected-address labels in route and Nearby map chrome

Applied map-first design-system pass:

- redesigned Plan as a full-map screen with a floating destination field and bottom decision sheet
- moved route editing behind the destination field expansion
- removed visible route-status text from Plan
- tightened native-app typography and introduced a primary fuel-green brand colour
- added supermarket and toll organisation wallet options, including Linkt Rewards, Linkt bonus and E-Toll context
- captured the design direction in `DESIGN-SYSTEM.md`

Added map camera and interaction confidence as a Goal 1 objective after research into Google Maps, Uber, Mapbox, Waze and Apple Maps patterns:

- route path becomes the primary camera subject for Plan
- cards, sheets and controls must contribute to map breathing room
- station focus should move the map without losing context
- manual user map movement should be respected until a clear recenter/context change

Implemented the first native-shell camera pass:

- Plan now uses a full-map base layer with floating trip controls and a bottom results sheet
- Plan camera fits the route path first instead of fitting every station marker
- Nearby passes top-control and bottom-sheet padding into the map camera
- station list and marker selection pan inside the useful visible map area
- the web-preview map records manual drag/zoom so routine refreshes do not fight user movement

Implemented the first saved-commute and route-alert intent pass:

- Plan can save the currently planned route as a commute
- saved commutes appear as quick route shortcuts in Plan
- Account shows saved commutes, alert toggles and notification permission state
- Expo Notifications is configured for native builds
- saved commutes persist locally using compact AsyncStorage records
- route alerts schedule daily local notifications on native builds
- price-triggered alert intelligence and device-build validation remain open

Added performance as a standing product goal:

- created performance guardrails for dependency discipline, storage caps, binary size and runtime metrics
- capped saved commutes at 20 routes until user research proves a higher limit
- kept heavy alert intelligence positioned for backend push rather than phone-side polling

See `VALIDATION-PASS-2026-06-14.md`.
