# FuelRadar Competitor Analysis

Date: 2026-06-17

Target: https://fuelradar.com.au/

Purpose: identify what FuelRadar does well, where it is vulnerable, and which ideas Fuel Path should adopt, avoid, or improve.

## Executive View

FuelRadar is not just a cheap-fuel map. Its strongest positioning is "when to fill up", combining live official fuel prices, forecast calls, alerts, suburb/station pages, fair-price signals, availability tracking, and broad SEO coverage.

The important lesson for Fuel Path is not to copy the whole surface area. FuelRadar has sprawled into many data pages and content types. Fuel Path should take the best decision patterns and apply them to a narrower wedge: route-aware, commuter-first, low-friction fuel decisions.

Best implementation angles for Fuel Path:

1. Make the primary decision "fill now, wait, or detour" instead of just showing pins.
2. Build trust with freshness, source and confidence labels on every station.
3. Add route-aware savings so a cheaper servo is judged against distance, time and fuel burn.
4. Use alerts around saved commutes and personal target prices.
5. Keep the app calm, fast and ad-free while FuelRadar carries complaints about ads, freezing and clutter.
6. Treat prediction as transparent probability, not magic. Start with simple confidence and back-testing before making big claims.

## What FuelRadar Offers

### Core proposition

FuelRadar leads with a forecasting promise: know when to fill up, not just where. Its homepage says it forecasts the price cycle for the user's fuel and nearby servos, gives a "fill before the next jump" style call, and uses live prices across more than 8,050 stations.

Sources:
- https://fuelradar.com.au/
- https://fuelradar.com.au/download
- https://fuelradar.com.au/petrol-price-prediction

### Main product surfaces

FuelRadar has:

- National fuel price map and suburb/location pages.
- Fuel type pages and brand pages.
- City-level 30-day price predictions.
- Station-level likely next-price-change cards.
- Saved stations and alerts.
- Route/trip planning.
- Fair Price Watch, comparing pump prices to wholesale terminal gate prices.
- Station availability and "running dry" pages.
- Fuel supply pages using port schedules, tanker/AIS-style signals and fuel cover.
- Daily awards for cheapest stations.
- Free embeddable widgets.
- iOS and Android apps.

Sources:
- https://fuelradar.com.au/fuel-map
- https://fuelradar.com.au/locations
- https://fuelradar.com.au/petrol-price-prediction
- https://fuelradar.com.au/fair-price-watch
- https://fuelradar.com.au/alerts
- https://fuelradar.com.au/widgets
- https://fuelradar.com.au/stations-running-dry
- https://fuelradar.com.au/fuel-supply
- https://fuelradar.com.au/daily-awards

## Data Sources And Structure

### Stated data sources

FuelRadar says it uses official government and retailer feeds, including:

- NSW Fuel Check
- VIC Servo Saver
- QLD Fuel Prices
- SA fuel pricing scheme
- WA FuelWatch
- TAS Fuel Check
- MyFuel NT
- Station-direct or retailer disclosure feeds in some areas

It says prices refresh every 15 to 30 minutes, and that stations not updated in 48 hours are dropped from some live views.

Sources:
- https://fuelradar.com.au/
- https://fuelradar.com.au/fuel-map
- https://fuelradar.com.au/about

### Notable tension

FuelRadar strongly markets "official data" and "no crowdsourcing" in some copy, but its About page also says motorists can verify and update prices. That is not necessarily a flaw, but it creates a trust/copy risk. If Fuel Path uses community validation later, it should label it clearly as "official feed" versus "user report" versus "station-direct".

### Inferred backend model

FuelRadar's public pages imply a data model roughly like:

- stations: brand, address, coordinates, state, suburb, open/trading details, provider IDs
- price observations: station, fuel type, price, source, update time, availability status
- area aggregates: city/suburb/state averages, lows, highs, spreads, station counts
- fuel type dictionary: U91, E10, P95, P98, diesel, premium diesel, LPG, EV, LNG, Opal and others
- predictions: city/fuel/date forecasts, confidence bands, cycle phase, best day
- station prediction cards: usual change days, last changed, expected change, confidence
- alert rules: target price, nearby station/suburb, saved station, notification channel
- content pages: suburb, city, brand, fuel type and widget endpoints

Fuel Path should not start with this entire model. The minimum useful version is stations, price observations, route candidates, saved preferences, alert rules, and a small prediction table once back-testing exists.

## Prediction And "Predictability Score"

I did not find a published exact formula called a "predictability score". FuelRadar exposes several related signals instead:

- City forecast confidence bands.
- Station-level labels such as low/high confidence for the next price change.
- A back-testing methodology based on mean absolute error between predictions and actual daily city averages.
- Cycle-phase labels such as peak, trough, rising or falling.

Sources:
- https://fuelradar.com.au/petrol-price-prediction
- https://fuelradar.com.au/petrol-price-prediction/accuracy
- Example indexed station/city pages found through search, including Sydney, Darwin, Canberra, Metro Toongabbie, Liberty Seaford and Solo Riverton prediction snippets.

### Published city prediction inputs

FuelRadar says it uses:

- Last 90 days of daily city averages by fuel type.
- Terminal gate prices.
- AUD/USD.
- Brent crude.
- Detected cycle position.
- A 30-day horizon with widening confidence bands.

Its accuracy page says it joins prediction rows against actual fuel price logs by city, fuel and date, then calculates absolute error and mean absolute error over recent windows.

### Inferred city prediction approach

Search-indexed pages mention a cycle-position estimator and Holt-Winters seasonal smoothing. The likely flow is:

1. Detect market cycle length and current phase.
2. Smooth recent price history.
3. Adjust for wholesale and macro signals.
4. Generate point forecasts for each day.
5. Widen uncertainty as the forecast horizon gets longer.
6. Convert the forecast into plain-language calls such as fill up, wait, or hold.

### Inferred station predictability approach

For station-level "next change likely" and confidence labels, the likely inputs are:

- Station's recent price-change cadence.
- Typical days and times for that servo to move.
- Last changed time.
- Current price gap versus local median/fair price.
- City/suburb cycle phase.
- Feed freshness and observation count.
- Forecast horizon.

Fuel Path opportunity: build a simpler transparent "confidence" label first:

- High: official price fresh, repeated local pattern, station has frequent reliable updates.
- Medium: official price fresh, but station pattern is less regular.
- Low: stale price, sparse history, unusual price movement, or closed/unavailable risk.

Avoid making a precision claim until there is a visible back-test.

## Business Model And Revenue

FuelRadar appears to use a mixed consumer growth model:

- Free app and website.
- In-app purchases.
- Ads in the free app.
- FuelRadar+ or similar paid tier to remove ads.
- SEO traffic from many generated location, brand, fuel-type and topic pages.
- Free widgets that likely create reach, backlinks and embedded distribution.

Evidence:

- App Store lists the app as free with in-app purchases.
- Google Play lists in-app purchases.
- An App Store developer reply says ads are Google AdMob and can be removed through FuelRadar+.
- The download page says users do not need subscriptions to compare prices, set alerts or save stations.
- Widgets are positioned as free, no signup, no API key.

Sources:
- https://apps.apple.com/au/app/fuelradar-fuel-map-prices/id6473671116
- https://play.google.com/store/apps/details?id=au.com.fuelradar.app
- https://fuelradar.com.au/download
- https://fuelradar.com.au/widgets

Fuel Path recommendation: do not monetise early with intrusive ads. The stronger wedge is trust, speed and route usefulness. Later options are household premium, fleet/export tools, commute alerts, or sponsored but clearly labelled station offers.

## User Feedback

### What users like

Positive reviews mention:

- Accuracy and update quality.
- Savings from finding cheaper fuel.
- Utility of trip planning, especially for long-distance driving.
- Seeing fuel prices clearly by fuel type.

### Main complaints and friction

Observed App Store review themes include:

- Station shown as cheap but closed or with missing price details.
- App freezing.
- Full-screen ads being annoying.
- Onboarding asking preference questions before the user understands the app.
- Default theme not following system preference.
- Clustered map bubbles obscuring prices.
- Grouped stations in route planner being confusing.
- Cheapest station not clearly highlighted.
- Fuel type not always remembered in map view.
- General UI polish complaints.

Sources:
- https://apps.apple.com/au/app/fuelradar-fuel-map-prices/id6473671116?see-all=reviews
- https://play.google.com/store/apps/details?id=au.com.fuelradar.app

Fuel Path opportunities:

- Default to the user's system theme.
- Persist fuel type everywhere.
- Highlight cheapest and best-route-value stations clearly.
- Do not hide price behind cluster count.
- Show "open now", phone, last update and confidence before asking a user to drive.
- Keep notification setup after first value, not before.
- Avoid full-screen ads.

## Frontend, UI And Interaction Review

### What FuelRadar does well

- It has a clear decision layer: fill up, wait, hold.
- It uses colour-coded price status in the Android listing.
- It supports both map and list views.
- It creates deep pages for state, city, suburb, station, brand and fuel type.
- It has clear fuel-type filtering.
- It uses data-rich cards: price, distance, brand, source/update time, availability.
- It links station pages, maps and directions.
- Its media kit standardises brand colours and assets.

### Where FuelRadar is vulnerable

- It has a lot of surfaces, which can make IA feel dense.
- The SEO pages can feel generated and sometimes inconsistent.
- Prediction accuracy currently has a methodology page but says it is awaiting enough back-test data.
- Review feedback suggests map clustering and route grouping create confusion.
- Ads create trust and flow damage in a utility app.
- Data privacy disclosure on Google Play includes personal info, financial info and app activity categories, which may deter some users.

## Accessibility And Trust

FuelRadar appears to rely heavily on colour coding and map markers. Fuel Path should support:

- Colour plus text labels, not colour-only meaning.
- Screen-reader labels for price pins and station rows.
- Larger touch targets for pins, fuel filters and alert actions.
- System theme by default.
- Reduced-motion-friendly micro-interactions.
- Plain freshness labels: "updated 8 min ago", "official feed", "stale", "verify before driving".
- Clear unavailable/closed status before navigation.

## SWOT

### Strengths

- Strong national coverage and broad official data integration.
- Differentiated "when to fill up" message.
- Rich SEO footprint across locations, brands, fuel types and topics.
- Consumer apps on both major stores.
- Alerts, saved stations, trip planning and forecasts.
- Fair-price and supply-side context that makes it feel more authoritative than a basic map.
- Widgets and media pages create distribution and credibility.

### Weaknesses

- User complaints about ads, freezing and UI complexity.
- Some trust tension between "official only" language and community verification.
- Prediction transparency is not yet fully proven publicly, with back-test pages still waiting for enough cycles.
- Clustered map prices and grouped route stations may reduce scanability.
- App appears broad rather than focused, which can slow the core user journey.
- Data privacy disclosures may make a leaner competitor feel safer.

### Opportunities For Fuel Path

- Own the commute/route decision rather than the national SEO encyclopedia.
- Build "worth the detour" as a signature feature.
- Pair every recommendation with confidence, freshness and source.
- Make alerts route-aware: near my commute, near home, near work, along this trip.
- Use a no-ad, privacy-light promise during MVP.
- Build transparent prediction later, starting with simple historical trend and confidence bands.
- Add "closed/stale/unavailable risk" as part of the recommendation, not hidden in details.
- Offer household and fleet modes after the consumer wedge is proven.

### Threats

- FuelRadar already has app-store presence, reviews and SEO coverage.
- Government apps and state fuel schemes can satisfy basic lookup needs.
- Data access can be brittle across states and terms.
- Prediction claims can backfire if users drive out of their way and the price is wrong.
- Large generated content footprints can outrank a newer product.
- App-store quality expectations are high for maps, location, battery and notifications.

## Recommended Fuel Path Implementation Backlog

### P0: Trust and safety layer

- Add station freshness status everywhere.
- Show source type: official feed, station-direct, user report if ever used.
- Show open/closed or unknown.
- Add stale/unavailable warnings before navigation.
- Persist selected fuel type across map, list, route and alert surfaces.

### P1: Route-aware value

- Add "worth the detour" calculation using price saving, distance, time and estimated fuel burn.
- Rank stations by route value, not just cheapest price.
- Add saved commute views: home to work, school run, weekend route.
- Show cheapest, nearest, fastest detour and best overall.

### P2: Alert engine

- Target price alerts for saved places and routes.
- "Jump risk" alerts only once there is enough evidence.
- Alerts should include reason: price below target, likely rise soon, best on your route.
- Add quiet hours and frequency caps.

### P3: Prediction foundations

- Start with area trend and simple confidence labels.
- Store prediction runs and actual outcomes for back-testing.
- Publish internal MAE and hit-rate dashboards before user-facing accuracy claims.
- Use "likely", "confidence", and "updated" language rather than deterministic claims.

### P4: Long-trip mode

- Route segments with fuel availability and price gaps.
- Highlight sparse fuel corridors.
- Add "last reliable station before long gap" later if source data supports it.

### P5: Growth surfaces

- Suburb/station pages only after the app journey is strong.
- Widgets only if they support acquisition without bloating the core app.
- Media/data pages later, when the data quality story is proven.

## Product Principles To Carry Forward

- Lead with the decision, not the dataset.
- Every recommendation needs a reason.
- A stale cheap price is not a bargain.
- Route value beats raw cheapest price.
- Confidence should be visible and humble.
- Avoid ad formats that interrupt a time-sensitive utility workflow.
- Keep architecture small: data ingestion, normalisation, route scoring, alerts, prediction back-test. Do not copy FuelRadar's full content machine too early.

## Source List

- FuelRadar homepage: https://fuelradar.com.au/
- Download page: https://fuelradar.com.au/download
- Prediction page: https://fuelradar.com.au/petrol-price-prediction
- Prediction accuracy: https://fuelradar.com.au/petrol-price-prediction/accuracy
- Fuel map: https://fuelradar.com.au/fuel-map
- Locations: https://fuelradar.com.au/locations
- Fuel data: https://fuelradar.com.au/fuel-data
- Fair Price Watch: https://fuelradar.com.au/fair-price-watch
- Alerts: https://fuelradar.com.au/alerts
- Widgets: https://fuelradar.com.au/widgets
- Stations running dry: https://fuelradar.com.au/stations-running-dry
- Fuel supply: https://fuelradar.com.au/fuel-supply
- Daily awards: https://fuelradar.com.au/daily-awards
- About: https://fuelradar.com.au/about
- Apple App Store listing and reviews: https://apps.apple.com/au/app/fuelradar-fuel-map-prices/id6473671116
- Google Play listing: https://play.google.com/store/apps/details?id=au.com.fuelradar.app
