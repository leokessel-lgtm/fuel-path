# Fuel Path Synthetic Validation Sessions

Last updated: 13 June 2026, Australia/Sydney

## Read This First

These are simulated sessions, not real customer validation.

They are useful for:

- stress-testing the script
- anticipating objections
- sharpening the product hypotheses
- deciding what to listen for in real sessions

They are not evidence of market demand.

## Summary

Across the synthetic sessions, the core recommendation remained useful, but only when three conditions were clear:

1. The saving is worth the driver's detour threshold.
2. The data source and freshness are visible.
3. The app respects each segment's real constraint: time, range, fleet policy, family routine or trust.

Strongest hypothesised segments:

- repeat Sydney commuters
- high-frequency drivers who already check fuel prices
- small fleets if "cheapest within policy" is kept simple

Weakest hypothesised segment:

- casual price shoppers unless the app asks for very little setup and offers useful alerts.

## Cross-Session Themes

### What Tested Well

- "Cheaper after detour" is more useful than a map of prices.
- Source and freshness details increase trust.
- Saved-route alerts sound more useful than generic fuel-price alerts.
- Fleet users care about rules and reporting more than the prettiest station recommendation.
- Road-trip users value range and certainty more than a few dollars of savings.

### What Broke Or Needs Work

- A $2 to $3 saving is not enough for many drivers unless it is already on route.
- Some users will not manually enter tank level every trip.
- "Route median" is analytically useful but may need friendlier wording.
- Opening hours and fuel availability are major trust gaps.
- ACT support cannot be implied.
- Discounts need a wallet/profile, otherwise net price feels incomplete.

### Product Changes Suggested By The Dry Run

- Add a personal "minimum saving worth detour" preference.
- Add a maximum detour time preference.
- Add "already on route" or "tiny detour" labels.
- Add a "why not cheapest gross price?" explainer.
- Make source/freshness impossible to miss.
- Keep manual tank input simple: low, half, high, full.
- Treat fleet mode as separate from consumer mode.
- Hold payment and cashback until trust is established.

## Session 1: Sydney Commuter

Segment: repeat commuter

Scenario: Parramatta to Sydney CBD, U91

Simulated profile:

- Drives to the CBD 3 days per week.
- Uses Petrol Spy sometimes before leaving home.
- Usually fills near home unless price difference is obvious.

First reaction:

> This is what I try to work out myself, but I normally just pick the cheapest dot nearby.

Understanding:

- Understood net saving after seeing route median and detour time.
- "10.0 c/L cheaper" was clearer than "route median".

Trust:

- Trusted official NSW source more than community reports.
- Price age above 10 hours created hesitation.

Behaviour change:

- Would use it before commute if the stop added under 3 minutes.
- Would not detour for less than about $4 per fill.

Useful alert:

> Tell me the night before or before I leave, not while I am driving.

Main objection:

- Does not want to enter tank level every day.

Product implication:

- Strong commuter fit.
- Add saved route plus tank reminder.
- Add minimum saving threshold.

Hypothesis score: 9/12

## Session 2: Family And School-Run Driver

Segment: commuter/family

Scenario: Parramatta to Sydney CBD, U91, lower tank

Simulated profile:

- Does school drop-off and errands.
- Uses supermarket dockets.
- Chooses convenience unless petrol is obviously expensive.

First reaction:

> I like that it tells me if it is worth it, but I do not want another thing to check.

Understanding:

- Understood "worth the detour" quickly.
- Wanted the app to explain whether discount dockets were included.

Trust:

- Trusted it only if discounts and open-now status were correct.
- Worried about stale prices and closed stations.

Behaviour change:

- Would use alerts more than active search.
- Would only detour if saving was $5+ or if already nearby.

Useful alert:

- "Fuel is cheap near school pickup today."
- "Your docket expires today and this station is on the way."

Main objection:

- Setup friction. Wants low effort.

Product implication:

- Alerts and discount wallet matter.
- Avoid making the user plan every drive.

Hypothesis score: 7/12

## Session 3: Rideshare Driver

Segment: high-frequency driver

Scenario: inner-west and CBD corridor, U91/P95

Simulated profile:

- Fuels several times per week.
- Already thinks in dollars per shift.
- Values time highly.

First reaction:

> Show me saving per minute. I do not care if it is cheap if I lose a fare.

Understanding:

- Understood net saving immediately.
- Wanted ranking by saving per detour minute.

Trust:

- Wanted price age and recent mismatch reports.
- Would distrust anything older than a few hours in metro areas.

Behaviour change:

- Would use if it could check before a shift.
- Would prefer alerts tied to planned shift start.

Useful alert:

- "Fuel before starting. Cheapest worthwhile stop is 2 minutes off route."
- "Skip this detour; saving is under your threshold."

Main objection:

- Needs fast UX and maybe receipt/history export.

Product implication:

- Strong high-frequency fit.
- Add "saving per minute" and history/export later.

Hypothesis score: 10/12

## Session 4: Tradie / Service Worker

Segment: high-frequency driver

Scenario: Penrith to Sydney CBD, diesel

Simulated profile:

- Drives a ute/van.
- Uses diesel.
- Has preferred brands and sometimes a fuel card.

First reaction:

> I need diesel, access and no nonsense. If it sends me somewhere tight or closed, I am done.

Understanding:

- Understood route ranking.
- Petrol-cycle card was irrelevant, and "no cycle signal" was appreciated.

Trust:

- Needs open-now, diesel availability and vehicle access confidence.
- Would not trust consumer petrol-style advice for diesel.

Behaviour change:

- Would use if it respected diesel and job-route constraints.
- Would not use if it suggested small awkward stations.

Useful alert:

- "Diesel is cheaper on tomorrow's first job route."
- "No worthwhile detour today."

Main objection:

- Needs station suitability and card acceptance.

Product implication:

- Diesel mode should be practical and conservative.
- Avoid petrol-cycle overreach.

Hypothesis score: 8/12

## Session 5: Small Fleet Operator

Segment: fleet-lite

Scenario: Penrith to Sydney CBD, diesel, wider corridor

Simulated profile:

- Owns or manages 5 to 12 vehicles.
- Wants drivers to use approved cards and avoid wasted detours.
- Cares about reporting.

First reaction:

> I do not need drivers hunting cheap fuel. I need them using approved places and not wasting time.

Understanding:

- Understood "cheapest within policy" immediately.
- Wanted weekly summary more than individual trip UI.

Trust:

- Needs card acceptance and approved brand filters.
- Needs clear audit trail.

Behaviour change:

- Would trial if it reduced off-policy fuelling.
- More willing to pay than consumer users if reporting is useful.

Useful alert:

- Driver prompt before route starts.
- Weekly exception report.

Main objection:

- Does not want full fleet management complexity.

Product implication:

- Fleet-lite is promising but must stay separate.
- Build policy layer later, not into consumer MVP.

Hypothesis score: 9/12

## Session 6: Road-Trip / Regional Driver

Segment: road trip/regional

Scenario: Canberra to Sydney CBD, U91, lower tank and higher reserve

Simulated profile:

- Drives Sydney to regional NSW several times a year.
- Cares about range and avoiding closed stations.
- Less interested in saving $2.

First reaction:

> For a trip, I care more about not cutting it fine than saving a couple of dollars.

Understanding:

- Understood range reserve.
- Wanted "safe stop" more than "best saving".

Trust:

- Opening hours and fuel availability are critical.
- ACT live coverage uncertainty would need to be explicit.

Behaviour change:

- Would use for trip planning if safe mode is prominent.
- Would not trust without availability/opening confidence.

Useful alert:

- "Last reliable fuel before long stretch."
- "Do not skip this stop if below half a tank."

Main objection:

- Current demo still feels metro-savings oriented.

Product implication:

- Safe Regional Mode should be a distinct later mode.
- Do not lead with price in regional contexts.

Hypothesis score: 7/12

## Session 7: Non-Technical Price Shopper

Segment: casual but price-conscious driver

Scenario: commuter preset, U91

Simulated profile:

- Uses FuelCheck or Petrol Spy occasionally.
- Does not like accounts or complex settings.
- Wants quick reassurance.

First reaction:

> I like the answer, but I do not want to set up my car unless I know it is worth it.

Understanding:

- Understood the top card.
- "Route median" needed plainer language.

Trust:

- Official source helps.
- Would still want to see the map sometimes.

Behaviour change:

- Might use before filling if no login required.
- Would not pay early.

Useful alert:

- "Fuel is unusually cheap near you."
- "Your usual area is expensive; fill near work."

Main objection:

- Low setup tolerance.

Product implication:

- Onboarding should start with a route and fuel type only.
- Make vehicle/tank profile optional until value is proven.

Hypothesis score: 6/12

## Synthesis

| Segment | Hypothesis strength | Main value | Main blocker |
| --- | ---: | --- | --- |
| Commuter | High | Saved route decision and alerts | Tank-level friction |
| Family driver | Medium | Contextual alerts and discounts | Setup effort |
| Rideshare/high-frequency | High | Saving per minute and pre-shift prompts | Price freshness and speed |
| Tradie/service | Medium-high | Diesel-aware route recommendation | Station suitability |
| Small fleet | High | Cheapest within policy, reporting | Avoiding enterprise bloat |
| Road-trip/regional | Medium | Safe stop and reserve | Opening/availability data |
| Casual price shopper | Medium-low | Quick answer | Low willingness to configure/pay |

## Hypotheses To Test With Real Users

1. Commuters will save regular routes if alerts are narrow and useful.
2. High-frequency drivers care more about saving per minute than absolute cheapest price.
3. Users need a personal saving threshold before alerts feel useful.
4. Freshness and official source labels are necessary for trust.
5. Manual tank input must be extremely light.
6. Fleet-lite buyers will pay only if policy and reporting exist.
7. Road-trip mode needs safety language, not just saving language.
8. Casual users may use a web planner before installing an app.

## Product Recommendations From Dry Run

### Do Next

- Run real sessions using `VALIDATION-SESSION-WORKBOOK.md`.
- Add "minimum saving worth detour" as a future user preference.
- Add "maximum detour minutes" as a future user preference.
- Rename "route median" in consumer UI to plainer wording, such as "typical route price".
- Keep the source/freshness strip.
- Keep scenario presets for validation.

### Do Not Build Yet

- in-app payment
- cashback marketplace
- full fleet admin
- automatic route learning
- public sharing
- more state data sources

### Evidence Needed Before App MVP

- At least 4 of 7 real sessions say the recommendation would change a real fuelling decision.
- At least 4 of 7 understand the top card without explanation.
- At least 3 of 4 commuter/high-frequency participants want saved-route alerts.
- At least 1 fleet participant confirms willingness to pay for a simple policy/reporting layer.
- API.NSW confirms public/commercial/fleet use and caching terms.

## Bottom Line

The dry run supports the current direction, but it also warns against overbuilding.

The most important real question is:

> Does the recommendation feel trustworthy enough to change behaviour?

Until real users answer that, the prototype is ready enough.

