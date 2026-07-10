# FuelRadar Map National Comparison

Date: 2026-07-03

Compared products:

- Fuel Path production: https://fuel-path.vercel.app
- FuelRadar web map: https://fuelradar.com.au/map
- FuelRadar route planner tool: https://fuelradar.com.au/tools/route-planner

Evidence labels:

- `runtime`: tested live with the production app, browser automation or API calls in this pass.
- `public copy`: confirmed from FuelRadar public pages in this pass.
- `inferred`: reasonable product judgement from observed behaviour, not independently verified.
- `not comparable`: the public surfaces do not expose equivalent evidence.

## TLDR

Fuel Path is stronger where the product wedge matters most: route-specific recommendations. In the balanced national API run, Fuel Path returned 17 recommendations from 18 PDL route cases, covered every state/territory in the test set, and completed at p95 2.8s. The only no-recommendation route was Darwin to Alice Springs for PDL, where the NT provider path had stale-cache context and no compatible recommendation.

FuelRadar is stronger as a public fuel-price information product. Its web map and location pages are faster to first usable content, have richer national SEO/location coverage, expose low/average/high price spreads, fuel-type comparison tables, brand/suburb comparisons, alerts, prediction, tools and route-planner positioning. It is much broader than Fuel Path.

The clearest gap is not raw map coverage. It is decision confidence. Fuel Path gives a route recommendation with detour and route-relative price evidence, but needs stronger public-facing freshness/source treatment and less test debt. FuelRadar gives richer price context and timing tools, but its public web route-planner flow did not produce route stop results in the automated Sydney to Newcastle attempt unless locations were selected from suggestions, and it still leaves more of the decision work to the driver.

Recommendation: keep Fuel Path route-first and commuter-first. Copy FuelRadar's best trust and context patterns, especially low/average/high by area, fuel-type comparison, update-time/source prominence and prediction back-testing language. Do not copy the sprawling content surface before the route recommendation and saved-route habit are proven.

## Evidence Run

Fuel Path runtime evidence:

| Check | Result | Evidence |
| --- | ---: | --- |
| National live route API stress, PDL, 18 pairs | Passed 18/18 | `tmp/plan-route-live-api-stress-2026-07-03T04-53-53-846Z.json` |
| National live route recommendations | 17/18 recommendations | Same run |
| National live route latency | p50 1.6s, p90 2.6s, p95 2.8s, max 2.8s | Same run |
| Route adversarial scoring | Passed 8/8 | `tmp/route-recommendation-adversarial-stress-2026-07-03T04-54-38-568Z.json` |
| Map density/performance | Passed 4/4 | `tmp/map-density-performance-stress-2026-07-03T04-54-38-721Z.json` |
| Production smoke matrix | Follow-up fixed stale Plan expectation; Nearby, EV and Plan now passed 9/9 | `tmp/production-smoke-matrix-stress-2026-07-03T05-09-24-686Z.json` |
| Plan route browser click stress | Follow-up fixed stale Plan expectation; 30/30 routes and 90/90 station clicks passed | `tmp/plan-route-browser-click-stress-2026-07-03T05-11-21-820Z.json` |
| Rich national Fuel Path scrape, U91 and PDL | 14/14 local searches OK, 16/16 route API calls OK | `tmp/fuelpath-national-comparison-2026-07-03.json` |

FuelRadar runtime and public evidence:

| Check | Result | Evidence |
| --- | ---: | --- |
| Static public page fetches | 13/14 useful pages OK, `data-methodology` URL returned 404 | `tmp/fuelradar-national-comparison-2026-07-03.json` |
| Rendered mobile pages | 9/9 rendered without automation errors | `tmp/fuelradar-national-comparison-2026-07-03.json` |
| FuelRadar map mobile render | DOM 376ms, observed after 2.2s | `output/playwright/fuelradar-national-comparison-2026-07-03/map.png` |
| FuelRadar capital pages | Sydney, Melbourne, Brisbane, Perth, Adelaide, Hobart and Darwin rendered with map/list content | `output/playwright/fuelradar-national-comparison-2026-07-03/*.png` |
| FuelRadar route planner form | Rendered, accepted typed input, then asked for start/end to be selected from suggestions | `tmp/fuelradar-route-planner-form-2026-07-03.json` |

Important correction from the smoke checks: the Fuel Path rendered Plan route result was not broken in the captured state. The deterministic browser tests were stale. They waited for `Why this stop`, while the live UI now shows `Why?`. Follow-up work updated the browser checks to wait for the compact `Why?` action and, in production smoke, click it to confirm the expanded `Why this stop` evidence panel still appears.

## National Scenario Matrix

Fuel Path exact route API results from the richer scrape:

| Scenario | U91 Fuel Path result | PDL Fuel Path result | FuelRadar comparable evidence |
| --- | --- | --- | --- |
| Sydney local search | OK, NSW live provider, 426 exact U91 stations in 25km | OK, 393 exact PDL stations | FuelRadar Sydney page rendered live map/list, U91 markers and current station list. Public page title showed E10 151.9c. |
| Sydney to Newcastle | North Ryde Petroleum, 153.7 c/L, 3.1 min detour | Metro Petroleum West Wallsend, 177.9 c/L, 4.1 min detour | FuelRadar public route planner describes route scan, corridor stations, price ranking and trip-cost estimate, but route output was not completed in automation. |
| Canberra to Sydney | Metro Bexley, 147.9 c/L, 8.3 min detour | Budget Bexley South, 169.8 c/L, 6.7 min detour | FuelRadar has national map/location coverage, but this exact route was not completed on public web. |
| Melbourne local search | OK, VIC live provider, 569 exact U91 stations | OK, 398 exact PDL stations | FuelRadar Melbourne page rendered live map/list, U91 markers and current station list. Public page title showed E10 143.9c. |
| Melbourne to Ballarat | Metro Petroleum Golden Point, 149.3 c/L, 2.1 min detour | Metro Petroleum Golden Point, 163.3 c/L, 2.1 min detour | FuelRadar route planner positioning is comparable, but output not completed in this pass. |
| Brisbane local search | OK, QLD live provider, 360 exact U91 stations | OK, 291 exact PDL stations | FuelRadar Brisbane page rendered live map/list, U91 markers and current station list. Public page title showed E10 151.9c. |
| Brisbane to Longreach | United Woolloongabba, 153.9 c/L, 3.1 min detour | Costco Ipswich Fuel Station, 172.7 c/L, 3.1 min detour | FuelRadar public map supports QLD pages and route planner claims corridor scanning. Exact route output not completed. |
| Perth local search | OK, WA live provider, 329 exact U91 stations, WA tomorrow warning | OK, 237 exact PDL stations, WA tomorrow warning | FuelRadar Perth page is especially strong: today/tomorrow prices, 30 official tomorrow prices and FuelWatch tomorrow columns. |
| Perth to Broome | Metro Bassendean, 149.2 c/L, 3.1 min detour, WA timing warning | Solo Morley, 171.5 c/L, 4.6 min detour, WA timing warning | FuelRadar WA page shows tomorrow locked prices, but exact long-route output not completed. |
| Adelaide local search | OK, SA live provider, 138 exact U91 stations | OK, 129 exact PDL stations | FuelRadar Adelaide page rendered map/list and public page title showed U91 158.9c. |
| Adelaide to Coober Pedy | U-Go West Hindmarsh, 157.5 c/L, 1.8 min detour | Liberty Port Augusta, 180.5 c/L, 0.8 min detour | FuelRadar exact route output not completed. |
| Hobart local search | OK, TAS live provider, 20 exact U91 stations | OK, 15 exact PDL stations | FuelRadar Hobart page rendered map/list and public page title showed E10 154.9c. |
| Hobart to Strahan | United North Hobart, 159.9 c/L, 1.2 min detour | Tas Petroleum Moonah, 199.9 c/L, 3.1 min detour | FuelRadar exact route output not completed. |
| Darwin local search | OK, NT live provider, 48 exact U91 stations | OK response, 0 exact PDL stations, alternative DL shown | FuelRadar Darwin page rendered U91, DSL, P95 and P98 comparison, 29 stations and official/feed freshness caveats. |
| Darwin to Alice Springs | NT-08200045, 164.5 c/L, 2.5 min detour | No PDL recommendation | FuelRadar Darwin page showed PDSL absent in table, but public route output not completed. |

## Side By Side

| Area | Fuel Path | FuelRadar | Read |
| --- | --- | --- | --- |
| Core job | Gives a route-specific stop recommendation with price and detour. `runtime` | Helps users compare local stations, timing, alerts, forecasts and tools. `public copy` | Fuel Path has the sharper wedge. FuelRadar has broader utility. |
| National coverage | Live provider paths returned local results across NSW, VIC, QLD, WA, SA, TAS and NT. `runtime` | Public pages and map rendered for the same capital-city spread. `runtime` | Comparable national footprint for local price browsing. |
| Route quality | Exact route API returned recommendations for 15/16 U91/PDL planned route calls. `runtime` | Route planner page says it scans stations near the route, ranks by price and estimates trip cost. `public copy` | Fuel Path has stronger tested route proof in this pass. |
| Route planner UX | Plan result card is compact and decision-led; follow-up browser checks now assert the current `Why?` action and expanded evidence panel. `runtime` | Public route planner has start/end fields plus efficiency/tank size, but automated typing did not complete without suggestion selection. `runtime` | FuelRadar has a richer route form, Fuel Path has a cleaner recommendation output. |
| Performance | National PDL route stress p95 2.8s. Dense mocked map ready around 1.1s to 1.4s. `runtime` | Rendered capital pages reached DOM content in about 0.2s to 0.8s and useful content after about 2.0s to 2.6s. `runtime` | FuelRadar is very fast for location pages. Fuel Path route API is fast enough in this pass. |
| Accuracy evidence | Shows provider, capability, cache warnings and exact/alternative fuel signals in API context. UI shows `Live data`, but less public detail than FuelRadar. `runtime` | Public pages say prices refresh from official feeds plus driver/station-direct updates, with freshness badges on station cards. `public copy` | FuelRadar communicates trust better. Fuel Path has good backend signals but should surface them more clearly. |
| Source transparency | Provider names are available in API evidence: `api_nsw`, `api_vic`, `api_qld`, `api_wa`, `api_sa`, `api_tas`, `api_nt`. `runtime` | Public pages cite official price feeds where available, station-direct data, driver updates and state-specific sources. `public copy` | FuelRadar is clearer to a normal user. |
| Fuel type support | U91 and PDL tested. NT PDL falls back to available DL alternatives in local search and no route recommendation for Darwin to Alice. `runtime` | Capital pages expose U91, E10, DSL, PDSL, P95, P98 and LPG where available. Darwin page did not expose PDSL in the visible fuel table. `runtime` | FuelRadar has broader visible fuel-type context. |
| Forecasting and timing | Fuel Path has prediction infrastructure in repo, but not a leading public UX in this test. `runtime/repo evidence` | FuelRadar has a 30-day outlook, confidence language, inputs, nightly refresh and accuracy back-test positioning. `public copy` | FuelRadar is ahead for timing and prediction story. |
| Alerts and saved routes | Fuel Path has saved/watched route concepts in Plan and backend alert infrastructure. `runtime/repo evidence` | FuelRadar markets price alerts, cycle trough alerts, saved servos and app push notifications. `public copy` | FuelRadar is broader, Fuel Path should stay route-specific. |
| Map/list UI | Fuel Path map density stress passed and keeps recommendation markers visible in mocked dense cases. `runtime` | FuelRadar capital pages show map markers, price list, low/average/high, fuel table, suburbs and brand comparisons. `runtime/public copy` | FuelRadar is richer for browsing. Fuel Path is calmer for route decision. |
| Clutter and monetisation | No ads seen in Fuel Path. `runtime` | No ads counted in the rendered capital pages in this pass, but public pages have broad nav, SEO content, app prompts and many tool links. `runtime/inferred` | Fuel Path should preserve calmness. |

## Evidence Backed Findings

1. Fuel Path's national route API is in better shape than the earlier 12-case smoke suggested.

The earlier p95 budget miss was not reproduced in the balanced 18-pair national run. The newer run passed 18/18 with p95 2.8s and no budget failures. That said, it returned one no-recommendation route, Darwin to Alice Springs for PDL, with NT provider context.

2. Fuel Path's stale Plan browser checks were fixed.

The failed smoke waited for `Why this stop`. The captured production UI showed `Why?` and had a complete-looking recommendation card. Follow-up test work now waits for `Why?`, asserts the compact evidence action, and confirms the expanded `Why this stop` panel after clicking it. Production smoke passed 9/9, and Plan route browser click stress passed 30/30 routes with 90/90 station clicks.

3. FuelRadar's public map is very strong for fast local context.

The national map opens with live Sydney context, low/average/high, spread, station count, brands, cheapest stations and fuel comparison. The page also explains that prices come from official feeds where available, topped up with station-direct data, and says station cards link to their source.

Source: https://fuelradar.com.au/map

4. FuelRadar's capital pages are product pages, not just maps.

The tested Sydney, Melbourne, Brisbane, Perth, Adelaide, Hobart and Darwin pages all rendered mobile map/list content. Perth is the standout because it exposes today and official tomorrow FuelWatch prices. Darwin exposes local spread, cheapest station, fuel comparison and caveats around source/freshness.

Sources:

- https://fuelradar.com.au/map/location/au/wa/6000/perth
- https://fuelradar.com.au/map/location/au/nt/0800/darwin

5. FuelRadar has more valuable surrounding functionality.

FuelRadar exposes tools, alerts, price prediction, price cycles, running-dry/supply pages, daily awards, widgets and app download flows. Its route planner page says it checks listed servos near a route, ranks by price and estimates trip cost. Its prediction page explains inputs, algorithm, refresh cadence, calibration and blind spots.

Sources:

- https://fuelradar.com.au/tools
- https://fuelradar.com.au/tools/route-planner
- https://fuelradar.com.au/alerts
- https://fuelradar.com.au/petrol-price-prediction
- https://fuelradar.com.au/about

6. FuelRadar's route quality could not be fully verified from public web output in this pass.

The route planner page rendered and accepted typed Sydney/Newcastle input, but the page asked to select both start and end locations from suggestions. The automated pass did not complete a route result. Treat FuelRadar's route planner as a public claim plus rendered form evidence, not verified route-output evidence.

7. Fuel Path's NT PDL handling is honest but still a product gap.

Local Darwin PDL search returned an OK response, but with zero exact PDL stations and alternative DL results. PDL Darwin to Alice returned no recommendation. That is the right trust behaviour if PDL is unavailable, but the user-facing message needs to make the fuel mismatch and alternatives clear.

## Fuel Path Strengths

- Route-first decision layer is clearer than FuelRadar's browse-first experience.
- National route API performance was strong in the balanced run.
- Scoring guards passed adversarial cases: closed cheapest loses, membership-only excluded by default, invalid prices dropped, stale price does not incorrectly down-rank, equal-price shorter detour wins.
- Map density stress passed across fuel and EV modes on mobile-sized viewports.
- Recommendation copy is compact: price, station, best-price-by, detour, eligibility and confidence.
- Fuel Path avoids the sprawl and SEO-heavy surface area that can make FuelRadar feel more like a portal than a task app.

## Fuel Path Gaps

- Browser smoke tests for Plan were stale, but follow-up work fixed the stale `Why this stop` expectation and restored green production/browser evidence.
- FuelRadar communicates public trust better: low/average/high, spread, station count, brands, source/freshness copy and fuel comparison tables are all clearer.
- FuelRadar is ahead on timing: 30-day outlook, confidence bands, back-test positioning and cycle guidance are public and discoverable.
- FuelRadar is ahead on user-retention mechanics: price alerts, saved servos, cycle trough alerts and app push are marketed more directly.
- FuelRadar is ahead on fuel-type browsing. Fuel Path handles U91 and PDL in the tests, but FuelRadar shows broader fuel tables per area.
- Fuel Path needs a better public/local explanation for unsupported or alternative-fuel cases, especially NT PDL.
- Fuel Path does not yet have an equivalent public web SEO/location content layer, though building that now may distract from the route wedge.

## FuelRadar Ideas Worth Copying

- Area summary strip: cheapest, average, highest, spread, station count and brands in view.
- Fuel comparison table: low, average, high, station count and cheapest station by fuel type.
- WA-specific tomorrow price treatment where official FuelWatch locked prices exist.
- Source/freshness wording on every station card and in the result context.
- Price-alert setup that starts with fuel, location and target price.
- Prediction model card language: inputs, confidence, refresh cadence, calibration and blind spots.
- Accuracy/back-test framing before making strong prediction claims.
- Tools that support the core decision: detour calculator, fill-up cost, trip cost and discount comparison.

## FuelRadar Patterns To Avoid

- Do not make Fuel Path a broad fuel content portal before the route recommendation is behaviour-proven.
- Do not let route planning become a calculator that still makes the user do the hard comparison.
- Do not overclaim accuracy. FuelRadar itself uses caveats about source delays, station update time and confirmation before driving.
- Do not bury the primary decision under too many tools, city pages, brand pages and SEO surfaces.
- Do not rely on driver/community updates without a clear source label. FuelRadar's public copy mixes official feeds, station-direct data and driver updates.

## Ranked Next Actions

1. Completed: fix the stale Plan browser smoke expectations.

Tests now accept the current `Why?` control and assert the expanded evidence title after opening it. Keep this as a regression guard because stale UI evidence can hide real Plan failures.

2. Add a Fuel Path result context strip.

For route and nearby results, add compact area context where available: cheapest, typical/average, spread, station count, provider and freshness. Keep it secondary to the recommendation.

3. Improve fuel mismatch handling.

For NT PDL and similar cases, make the UI explicitly say when exact fuel is unavailable and when an alternative fuel is being shown. Do not allow alternative DL to look like PDL.

4. Add station source/freshness detail to the recommendation evidence.

Fuel Path already has provider/cache context. Surface it in plain language: source, update age, provider state and whether the price is exact or fallback.

5. Build a small route output benchmark report for user testing.

Use the current national route set and show top recommendation, detour, best-price-by and provider caveat. This should become the recruited-driver evidence pack.

6. Add prediction only with back-test proof.

FuelRadar has a strong prediction story. Fuel Path should not copy the feature until it can show back-tested directional accuracy and clear blind spots.

7. Delay broad SEO/location pages.

FuelRadar's location pages are useful, but Fuel Path's near-term wedge is not "more pages". Build a small number of route-example pages only after the recommendation is proven with real drivers.

## Source Links

- FuelRadar map: https://fuelradar.com.au/map
- FuelRadar route planner: https://fuelradar.com.au/tools/route-planner
- FuelRadar tools: https://fuelradar.com.au/tools
- FuelRadar alerts: https://fuelradar.com.au/alerts
- FuelRadar prediction: https://fuelradar.com.au/petrol-price-prediction
- FuelRadar about: https://fuelradar.com.au/about
- FuelRadar Perth: https://fuelradar.com.au/map/location/au/wa/6000/perth
- FuelRadar Darwin: https://fuelradar.com.au/map/location/au/nt/0800/darwin
- Fuel Path production: https://fuel-path.vercel.app
