# Fuel Path Product Ideas

Last updated: 17 June 2026, Australia/Sydney

## TLDR

Fuel Path should be a **whole-of-Australia decision engine for fuel planning**, not another fuel price map.

The strongest product idea is:

> For this drive, with your car, tank and discounts, here is the best fuel decision.

This document captures the product ideas worth preserving from the market research, review mining, prototype and fuel price cycle research.

## Product Principles

- Recommendation first, map second.
- Lead with the decision, not the dataset.
- Net saving, not just pump price.
- Route corridor, not straight-line distance.
- Route value beats raw cheapest price.
- Confidence and freshness visible by default.
- A stale cheap price is not a bargain.
- Cycle-aware, not fortune-telling.
- Prediction must be back-tested before it is trusted.
- App-first for habits and alerts, web companion for demos and fleet/admin.
- No ads in the core decision flow.
- Avoid in-app payment until trust and partner value are proven.

## Main Project Goals

The project is now anchored on four differentiators:

1. **Best Fuel Decision, Not Another Map:** tell the driver the best fuel action for an actual trip.
2. **Your Real Price:** show pump price beside the user's eligible adjusted price.
3. **Smart Saved-Route Alerts:** prompt users around saved routes, timing, tank context and valid price signals.
4. **Prediction And Cycle Guidance:** show timing guidance only where it is evidence-gated and back-tested.

The active build priority is Goal 1 as a national capability. See [Project goals and roadmap](PROJECT-GOALS-ROADMAP.md).

## Adopted Build Direction

The web demo now follows the strategic recommendation to separate the experience into:

- **Plan Trip:** owns the decision-first route planner, with from/to fields, a rough tank-level control, saved commute signal, best decision card, route map and ranked stops.
- **Near me:** owns the classic map behaviour, with fuel, radius and brand filters for quick local station discovery.
- **Account:** owns the personalisation layer: vehicle profile, tank/economy settings, preferred brands, discount programs, price eligibilities, saved routes and notification preferences.

The next design standard is that route results should show:

- pump price
- user's confirmed price
- possible discount context
- possible lower price when a non-selected wallet program could improve the result
- saving after detour
- why this stop ranks well
- why the cheapest gross price may not be best
- source/freshness/open/range/eligibility trust cues

The Plan Trip screen should stay compact and action-led:

- saved routes sit above From/To as a route preset
- the recommendation is a short action card, not a long explanation block
- detailed reasoning is available through disclosure, not shown by default
- cycle/timing guidance is a small timing cue unless it is strongly actionable
- map and ranked stops are one connected section, with shared rank numbers and selected state
- fuel map points should show brand identity plus price, then expand into station actions: navigate, favourite, alert and report/update price

## Core Ideas

### 1. Best Fill For This Drive

**Idea:** User enters destination, fuel type and rough tank level. Fuel Path recommends whether to fill now, on route, later, or skip anywhere in Australia where the data capability supports it.

**Target:** Commuters, high-frequency drivers, road-trippers.

**Why it matters:** Existing tools make users inspect maps and compare dots manually.

**MVP timing:** Phase 1.

**Evidence:** Market research and prototype both support "decision, not dots".

**Risk:** Needs reliable route detour scoring and fresh prices.

### 1A. National Provider Capability Matrix

**Idea:** Treat NSW, ACT, QLD, VIC, SA, WA, TAS and NT as first-class regions with explicit capability labels.

**Target:** All Australian drivers.

**Why it matters:** A national app must not turn provider gaps into misleading blank results.

**MVP timing:** Phase 1.

**Evidence:** The national roadmap now requires 8/8 region representation and capability states.

**Risk:** Capability depth will vary by jurisdiction until API access, licensing and provider schemas are confirmed.

### 2. Net-Savings Route Ranking

**Idea:** Rank stations by actual saving after detour time, extra fuel burned and eligible discounts.

**Target:** Commuters, rideshare/delivery drivers, tradies, small fleets.

**Why it matters:** A cheaper station can be a worse choice if it adds too much detour.

**MVP timing:** Phase 1.

**Evidence:** Prototype demonstrates this with sample routes.

**Risk:** Real route geometry and mapping API costs need validation.

### 3. Tank Range And Reserve Safety

**Idea:** Downgrade or block recommendations the user cannot safely reach with their current tank and reserve.

**Target:** Road-trippers, regional drivers, high-frequency drivers.

**Why it matters:** The cheapest station is not always the safest station.

**MVP timing:** Phase 1.

**Evidence:** Prototype shows a later cheaper stop can be a range risk.

**Risk:** User tank level is approximate unless manually updated or integrated with vehicle data later.

### 4. Cycle Status Card

**Idea:** For eligible markets, show whether route-corridor unleaded prices are low, falling, rising or uncertain.

**Target:** Supported Australian fuel-cycle markets only.

**Why it matters:** Price cycles can create meaningful savings, but users need guidance not charts.

**MVP timing:** Phase 2, after enough price history is ingested.

**Evidence:** ACCC confirms cycles in five largest cities and estimated annual savings from timing plus shopping around.

**Risk:** Do not apply to unsupported fuels, regions or sparse histories by default.

### 5. Saved Commute Alerts

**Idea:** User saves home-work or regular routes. Fuel Path checks those routes at chosen times and sends timely prompts.

**Target:** Commuters and high-frequency drivers.

**Why it matters:** Repeat routes create habit and notification value.

**MVP timing:** Phase 1 or early Phase 2.

**Example:** "Your Parramatta-CBD route has U91 near a recent low. Fill before tomorrow's commute if under half a tank."

**Risk:** Avoid noisy generic alerts.

**Prototype status:** Saved route profiles now include usual timing, fuel type, tank threshold, minimum saving and maximum detour rules. The demo uses these rules to label a commute as "Send alert", "Watch only", "Skip alert", "Quiet today" or "Range first".

### 6. Shop Around Before The Spike

**Idea:** Detect early price rises at some stations while cheaper stations remain on the route.

**Target:** Frequent drivers in supported cycle markets.

**Why it matters:** ACCC says retailers do not all lift prices at once, and users can still find stations that have not yet risen.

**MVP timing:** Phase 2.

**Example:** "Several stations have jumped, but two on your route are still below 186.9 c/L."

**Risk:** Needs frequent price refresh and clear confidence language.

### 7. Discount-Aware Net Price

**Idea:** Build a Discount Wallet where users configure memberships, vouchers, account offers and fleet cards, then show pump price, confirmed user price and possible lower price inside route results.

**Target:** All users, especially frequent drivers, discount-heavy households and small fleets.

**Discount examples:** Everyday Rewards, Flybuys, My NRMA, RACV, RACQ, RAC WA, RAA, AANT, seniors cards, Budget Direct, Origin, Ampol Energy, Costco, 7-Eleven Fuel Lock, Uber Pro, Uber Eats Pro, AmpolCard, BP Plus, Shell Card, WEX Motorpass, FleetCard, Fleetcare, United Card and IOR Diesel Network.

**MVP timing:** Phase 1 manual wallet and rules fixture, Phase 2 smarter eligibility and stackability, Phase 3 partner integrations.

**Evidence:** Review mining shows discounts and loyalty are major user themes. Dedicated discount and fleet-card research found a fragmented market where users must mentally apply discounts after checking pump prices.

**Risk:** Never imply eligibility unless the user has configured the relevant discount. Keep pump price visible beside adjusted price so discounts do not hide expensive base prices.

**Prototype status:** The demo now separates pump price, confirmed wallet price and possible lower price. Possible lower price is conservative: it shows the best single unselected program at the station, not a stacked-discount promise.

### 7A. Account Preference Hub

**Idea:** Treat Account as the user's fuel identity layer: vehicle profile, preferred brands, discount programs, price eligibility rules and notification preferences.

**Target:** Commuters, high-frequency drivers, families with multiple vehicles and small fleets.

**Why it matters:** Tank size and economy are valuable, but most daily users will not tune those settings every trip. The better pattern is to capture them once through a vehicle profile and let Plan Trip stay lightweight.

**MVP timing:** Phase 1.

**Evidence:** Prototype review suggested moving vehicle, brand, discount and eligibility setup out of the daily planning flow.

**Risk:** Registration lookup must be clearly permissioned and privacy-safe. Demo data must not imply live vehicle registry access.

### 8. Membership-Only Warning

**Idea:** Flag or exclude member-only prices by default.

**Target:** All users.

**Why it matters:** Users complain about driving to prices they cannot access.

**MVP timing:** Phase 1.

**Risk:** Requires station/brand metadata and user membership profile.

### 9. Trust And Freshness Layer

**Idea:** Every recommendation shows source, timestamp, price age, confidence and warnings.

**Target:** All users.

**Why it matters:** Price accuracy/freshness is a recurring complaint across fuel apps.

**MVP timing:** Phase 1.

**Example:** "Official FuelCheck price, updated 12 minutes ago."

**Risk:** Requires data source attribution and careful wording.

**Adopted rule:** Official live provider timestamps mean the price effective/unchanged-since time, not API response age. Fallback, sample, demo or unknown-source prices older than the freshness threshold stay visible as context but cannot become the top route recommendation. The timestamp belongs in station detail and source context, not as scary headline copy.

### 10. Open Now And Availability Warnings

**Idea:** Do not recommend closed stations, stale untrusted-source prices or unavailable fuel types without warning.

**Target:** High-frequency drivers, road-trippers, regional users.

**MVP timing:** Phase 1 if data is available, otherwise Phase 2.

**Risk:** Opening hours and fuel availability may require additional data source beyond FuelCheck.

### 11. No Cycle Signal Mode

**Idea:** Explicitly tell users when cycle logic does not apply.

**Target:** Users in unsupported regions, unsupported fuels, sparse-history areas and non-cycle markets.

**Example:** "No petrol-cycle signal for diesel. Here is the cheapest worthwhile stop on your route."

**MVP timing:** Phase 2 with cycle feature.

**Risk:** Product must avoid overclaiming.

### 12. Safe Regional Mode

**Idea:** For longer trips, prioritise range, opening hours, fuel availability and reserve over cheapest price.

**Target:** Road-trippers, regional drivers, fleet drivers.

**MVP timing:** Phase 2.

**Example:** "Fill at Goulburn. It is not the cheapest, but it keeps your 80 km reserve."

**Risk:** Safety wording needs to be conservative.

### 13. Fleet-Lite Approved Stop Mode

**Idea:** Small fleets define approved brands, accepted fuel cards, negotiated discounts, fuel types and reserve rules. Drivers get the cheapest in-policy stop, not just the cheapest public pump price.

**Target:** Small fleets, tradies, delivery operators.

**MVP timing:** Phase 2 validation, Phase 3 production.

**Evidence:** Fleet/trucker tools show value in accepted-location, route-safe and card-aware recommendations. Fleet-card research shows cards solve admin, reporting and controls, but users still need net-price and acceptance clarity at the station level.

**Risk:** Do not become full fleet management too early.

### 14. Weekly Savings Summary

**Idea:** Show estimated savings from followed recommendations.

**Target:** Commuters, high-frequency drivers, fleet admins.

**MVP timing:** Phase 2.

**Example:** "Estimated saving this week: $18.40 across 3 fills."

**Risk:** Savings estimates must be transparent and conservative.

### 15. Receipt And Reimbursement Export

**Idea:** Let high-frequency drivers log fills and export history for reimbursement or tax.

**Target:** Rideshare, delivery, tradies, small fleets.

**MVP timing:** Phase 2.

**Evidence:** Review mining showed logging/export as a meaningful pain theme.

**Risk:** Keep it light. Do not build accounting software.

### 16. Toll Plus Fuel Route Economics

**Idea:** Compare true route cost by including tolls and fuel.

**Target:** Sydney commuters and delivery drivers.

**MVP timing:** Later Phase 2 or Phase 3.

**Why it matters:** A cheaper fuel stop on a toll-heavy route may not be the cheaper trip.

**Risk:** Toll data and route alternatives add complexity.

### 17. Web Demo Before Full App UI

**Idea:** Build a small web demo around the scoring engine before committing to full app design.

**Target:** Internal validation, early testers, partners.

**MVP timing:** Immediate next build step.

**Demo elements:**

- route selector
- fuel and tank inputs
- top recommendation card
- ranked station list
- range/freshness/eligibility warnings
- JSON debug panel

**Risk:** Web demo should not become the main product if the app-first strategy remains valid.

### 18. App-First Habit Layer

**Idea:** Dedicated mobile app for saved routes, push notifications, widgets later and navigation handoff.

**Target:** Commuters and high-frequency drivers.

**MVP timing:** After web demo validates the scoring UX.

**Evidence:** Australia is mobile-centric, and the core habit depends on alerts.

**Risk:** App adoption requires repeat value, not just a one-off calculator.

### 19. Data Transparency Page

**Idea:** Public page explaining data sources, regional capability, update frequency, limitations and how recommendations are calculated.

**Target:** All users, partners, fleet buyers.

**MVP timing:** Phase 1.

**Why it matters:** Trust is a product feature in fuel pricing.

**Risk:** Needs legal/product review before public launch.

### 20. Fuel Lock Reminder

**Idea:** Let users track 7-Eleven or similar fuel lock windows and remind them before expiry.

**Target:** Frequent discount users.

**MVP timing:** Phase 2.

**Risk:** Integration may be manual unless partnership/API access exists.

### 21. Classic Around-Me Map

**Idea:** Keep a familiar interactive map view where users can see stations around them, change fuel type, filter brands and tap a station for raw and discounted price detail. When a route is selected, the map should show the route line, highlighted ranked route stops and other nearby context stations.

**Target:** All users, especially people who want quick local comparison before using route recommendations.

**MVP timing:** Phase 1.

**Evidence:** This preserves the familiar fuel-checking behaviour while Fuel Path adds route-aware and discount-aware decisioning on top. It also helps users trust that the recommendation is not hiding nearby alternatives.

**Risk:** The map should not become the main product job. Keep it useful, but keep recommendations and net savings prominent.

### 22. Tabbed Planning Workflow

**Idea:** Split the product surface into focused tabs: Plan for recommendation and map, Results for ranked stations, Account for vehicle setup, and Data for source/debug confidence.

**Target:** All users, especially validation participants who need to understand the concept without scrolling through every supporting detail.

**MVP timing:** Phase 1.

**Evidence:** The prototype became too long once map, route scoring, discounts, data status and debug views all sat on one page.

**Risk:** Do not hide the core decision. The first tab should still show the recommendation and route map.

### 23. Account Vehicle Profile By Registration

**Idea:** Let users set up their vehicle in an Account area by entering registration number and state, then save fuel type, tank size, economy and reserve defaults to their profile.

**Target:** Everyday drivers, households with more than one car, high-frequency drivers and fleets.

**MVP timing:** Phase 1 with demo/manual lookup, later authorised registration-data integration if available.

**Evidence:** Tank size and economy are valuable for scoring but too detailed for daily trip controls. Account setup lets Fuel Path ask once and reuse the values.

**Risk:** Live registration lookup would need explicit consent, authorised data access and privacy/security review. Manual entry must remain available.

### 24. Native App-First Product Direction

**Idea:** Treat the mobile app as the primary product and the web demo as the validation harness / future companion, not the main customer experience.

**Target:** Commuters, high-frequency drivers and small fleet drivers who need repeat use, alerts and quick route decisions.

**MVP timing:** Phase 1 direction from now.

**Evidence:** The strongest Fuel Path value depends on saved routes, location-aware prompts, push notifications, navigation handoff and eventual widgets. The web demo has validated live route scoring, but the habit layer is app-native.

**Risk:** Do not jump into a full native build before the Plan, Nearby and Account flows are stable. Keep API.NSW credentials and scoring logic server-side.

## Alert Ideas

| Alert | User value | Guardrail |
| --- | --- | --- |
| Fill soon | Prompt when route price is near recent low and tank is likely low. | Use "near recent low", not guaranteed future price. |
| Shop around now | Some stations have jumped, but cheaper ones remain. | Show specific route stations and freshness. |
| Wait if safe | Prices are falling and tank range allows waiting. | Check reserve before suggesting wait. |
| Skip detour | Price saving is smaller than detour cost. | Explain the maths simply. |
| No cycle signal | Prevents bad diesel/ACT/regional predictions. | Provide useful route recommendation instead. |
| Discount expiring | Avoid lost savings from fuel locks or dockets. | User must opt in and configure manually at first. |
| Fleet policy | Shows the cheapest in-policy stop. | Never route outside approved card/brand rules. |

## Prioritised Backlog

### Now

- Build the national provider capability matrix for NSW, ACT, QLD, VIC, SA, WA, TAS and NT.
- Show region capability status in backend status and user-facing empty/limited states.
- Run real validation sessions with recruited participants.
- Confirm permitted app/commercial usage, caching and attribution terms for each state/territory provider.
- Confirm permitted usage, caching and attribution terms for ACT records exposed through the FuelCheck API.
- Confirm whether the live web demo can be shared publicly after usage rights are confirmed.
- Keep refining the validation demo from participant feedback.
- Require every implementation to include a backend or product decision rule and a UX surface that shows the rule outcome, limitation or blocked state.
- Apply the break-it testing regime in `NATIONAL-TESTING-REGIME.md` before closing new backlog items.

### Completed In Demo

- API.NSW credentials were registered and the live v1 price endpoint was validated.
- Web demo uses the scoring engine with sample data and local proxy support.
- Real address fields, explicit route planning, route cache status and Google base-map support are implemented.
- Classic Near Me map and route map context are implemented.
- Account profile, brand filters, discount wallet, saved route profiles and rule-based alert states are implemented.
- Results show pump price, confirmed wallet price and possible lower price.

### Phase 1

- National provider capability matrix.
- Best Fill For This Drive.
- Net-Savings Route Ranking.
- Classic Around-Me Map.
- Tabbed Planning Workflow.
- Account Vehicle Profile By Registration.
- Tank Range And Reserve Safety.
- Trust And Freshness Layer.
- Membership-Only Warning.
- Manual Discount Wallet and discount-aware pricing.
- Navigation handoff.
- User story and success metrics attached to every shipped backlog item.

### Phase 2

- Saved Commute Alerts.
- Prediction back-testing foundation.
- Cycle Status Card for supported fuels and regions only.
- Shop Around Before The Spike.
- Safe Regional Mode.
- Stackability rules and voucher/fuel-lock expiry fields.
- Weekly Savings Summary.
- Receipt/history export.
- Fuel Lock Reminder.

### Phase 3

- Fleet-Lite Approved Stop Mode.
- Fleet admin dashboard.
- Toll plus fuel route economics.
- Public data transparency page with national capability and source status.

### Later

- In-app fuel payment.
- CarPlay / Android Auto.
- EV charging comparison.
- Partner offer marketplace.
- Public API or licensing.

## Evidence Links

- [Project goals and roadmap](PROJECT-GOALS-ROADMAP.md)
- [Market research](fuel-path-market-research.md)
- [Deep international research](fuel-path-deep-international-research.md)
- [Fuel price cycle research](fuel-price-cycle-research.md)
- [Prototype README](prototype/README.md)
- [Current TODO](TODO.md)
- [Map UX and competitor functionality notes](MAP-UX-COMPETITOR-FUNCTIONALITY.md)
