# Fuel Path Project Goals And Roadmap

Last updated: 15 June 2026, Australia/Sydney

## Main Project Goals

Fuel Path should stay focused on three differentiators.

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

## Goal 1 Breakdown

Goal 1 is the current priority. The product must first prove that it can make a better fuel decision than a user manually scanning a map.

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
- Longer NSW routes do not silently show empty results.
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

**Priority:** P1, next.

## Prioritised Build Roadmap

### Now: Prove Goal 1

1. Add production-grade address suggestions for suburbs, addresses and points of reference.
2. Limit long-route ranked results to a useful decision set, with progressive expansion.
3. Make stale-price severity reduce recommendation confidence more strongly.
4. Add route-led map camera behaviour with dynamic breathing room and selected-station focus.
5. Keep Plan Trip focused on trip intent, one recommendation and route map.
6. Keep secondary setup behind Account or detail views.

### Next: Make The Decision Trustworthy

1. Add clearer availability and eligibility warnings.
2. Add proper "not worth detour" and stale-data downgrade states.
3. Expand tests around scoring edge cases.
4. Run real validation sessions.
5. Confirm API.NSW commercial, caching and public-sharing permissions.

### Then: Bring In Goals 2 And 3

1. Add live brand/network discount rules for "your real price".
2. Add backend-driven route alert checks that evaluate saved routes before the user's normal travel window.
3. Add price-cycle guidance only where valid.
4. Add fleet-lite approved stop mode.

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

If not, park it.

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
