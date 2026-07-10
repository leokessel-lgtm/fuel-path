# Fuel Path Deep International Research

Last researched: 13 June 2026, Australia/Sydney

## TLDR

Fuel Path should target commuters, high-frequency drivers and small fleets first, starting in NSW/ACT.

The market already has fuel price maps, fuel price data, fuel discounts, trip calculators and fleet fuel-card tools. The stronger opportunity is to combine them into a trusted decision layer:

- "Should I fill now, wait, or fill on my route?"
- "What is the cheapest option after detour time, extra fuel burned and discounts?"
- "Can I reach it safely with my current tank?"
- "Is the price fresh, open, available and eligible for me?"
- "Will this save money for my normal commute, job route or fleet policy?"

Recommended strategy:

1. Build a dedicated mobile app as the primary product.
2. Add a lightweight web route planner and landing page as a companion, not the main experience.
3. Launch in NSW/ACT using FuelCheck data, after verifying the ACT records exposed through the available feed.
4. Make "decision, not dots" the core product difference.
5. Add a fleet-lite layer early enough to shape the architecture, but avoid full enterprise fleet software in v1.

## Research Scope

This pass widened the original Australian scan across:

- Australia: FuelCheck, Petrol Spy, Fuel Map, My NRMA, Simples, RACQ, RAA, retailer apps and loyalty products.
- United Kingdom: PetrolPrices, Fuel Finder Scheme, myRAC, The AA, Roadtrip, FuelPal and solo-developer tools.
- United States and Canada: GasBuddy, Upside, Waze, AAA, Roadtrippers, Shell, Circle K and fleet/trucker products.
- Germany, Austria and France: ADAC Drive, clever-tanken, mehr-tanken, Spritpreisrechner and official fuel datasets.
- New Zealand: Gaspy and retailer payment/loyalty patterns.
- Fleet and high-frequency driver products: Mudflap, Trucker Path, WEX Connect, Fleetio and fuel-card tooling.

Review mining covered a qualitative sample of 2,883 recent Apple App Store and Google Play reviews across consumer, retailer, route-planning and fleet/trucker apps. The sample is directional, not statistically rigorous. Ratings, reviews and app features change over time.

## Positioning

### Best Product Wedge

The wedge is not "another fuel app".

The wedge is:

> Plan the cheapest safe fill on your actual drive.

That means Fuel Path should give a recommendation, not just a map. Petrol Spy, FuelCheck and Fuel Map already train people to compare prices. Fuel Path should save them from doing the comparison manually every week.

### First Audience Priority

| Segment | Why it matters | Product implication |
| --- | --- | --- |
| Commuters | Repeat routes, predictable times, high sensitivity to price cycles and local area variation. | Saved routes, commute alerts, fill-now/fill-later recommendation, simple weekly savings view. |
| High-frequency drivers | Rideshare, delivery, tradies and sales reps burn fuel often and value time. | Net saving after detour, fast mobile UX, low-friction alerts, discount stacking, route-safe stops. |
| Small fleets | Fuel is an operating cost, but many small operators do not want enterprise fleet tooling. | Fleet-lite: vehicle profiles, approved brands/cards, driver prompts, simple reporting. |
| Road trips | Valuable for range, regional availability and trip budgeting, but less frequent. | Safe regional mode and trip planner, but not the main activation loop. |

## International Landscape

### 1. Official Data And Transparency Schemes

| Market | Pattern | Lesson for Fuel Path |
| --- | --- | --- |
| NSW/ACT FuelCheck | Live government fuel prices for NSW and ACT. Google Play listing says more than 2,300 NSW and 60 ACT stations upload real-time prices. API.NSW exposes live fuel pricing, with v2 covering NSW and Tasmania. ACT feed coverage should be verified before build commitment. | Strong data foundation for v1. Use official data credibility, but compete on route decisioning, alerts and net savings. |
| WA FuelWatch | Next-day prices are reported by 2pm, published from 2:30pm and locked for 24 hours from 6am. | Excellent "fill today or tomorrow" pattern. Later national expansion should copy this decision logic where data allows. |
| UK Fuel Finder | Permanent open data scheme intended to provide near-live reliable fuel price data through third-party apps, maps, in-car systems and online tools. | Open data is moving into navigation and in-car contexts. Fuel Path should plan for map/navigation integrations later. |
| Germany MTS-K | Official market transparency data feeds apps like clever-tanken and mehr-tanken. | Official data plus price forecasts and fill recommendations are proven patterns. |
| Austria Spritpreisrechner | Official fuel-price data supports apps that find stations nearby or along a route, with opening hours and route search. | Route search is becoming table stakes in mature markets. Fuel Path needs stronger economics and notification smarts. |
| France prix-carburants.gouv.fr | Official fuel price site includes data, itinerary search and fuel availability. | Availability matters, especially outside metro corridors. |

Sources: [NSW Fuel API](https://api.nsw.gov.au/Product/Index/22), [NSW FuelCheck Google Play](https://play.google.com/store/apps/details?hl=en_AU&id=au.gov.nsw.onegov.fuelcheckapp), [WA FuelWatch](https://www.consumerprotection.wa.gov.au/fuelwatch-and-fuel-prices), [UK Fuel Finder Scheme](https://www.fuelsindustryuk.org/consumer-information/fuel-finder-scheme-essential-information-for-industry-and-consumers/), [CMA fuel transparency blog](https://competitionandmarkets.blog.gov.uk/2025/11/17/driving-better-road-fuel-prices-for-consumers/), [Bundeskartellamt tank apps](https://www.bundeskartellamt.de/DE/Aufgaben/MarkttransparenzstelleFuerKraftstoffe/TankApps/tankapps_node.html), [E-Control Sprit API](https://api.e-control.at/sprit/1.0/doc/index.html?url=https%3A%2F%2Fapi.e-control.at%2Fsprit%2F1.0%2Fapi-docs%3Fgroup=public-api), [France official fuel prices](https://www.prix-carburants.gouv.fr/).

### 2. Consumer Fuel Price Apps

| Product | Market | What works | Pain / gap |
| --- | --- | --- | --- |
| Petrol Spy | Australia / NZ | Large user base, strong ratings, national price map, price cycles, notifications, official plus community data. | Still mostly map-first. Review sample points to ads, freshness, station status, filters and trust. |
| NSW FuelCheck | NSW / ACT | Trusted official source, alerts, favourites, trends, My Trip. | Good data and baseline UX. Gap is net saving, commute smarts and fleet/high-frequency use. |
| Fuel Map Australia | Australia | Station map plus fuel log, useful for touring. | Review sample shows reliability, map/search, price freshness, ads and logging/export pain. |
| Simples | Australia | Claims route-based fuel prices and sits inside broader savings ecosystem. | Lower review ratings. Complaints cluster around freshness, usability and confidence. |
| PetrolPrices | UK | Strong route-first journey planner, fuel type filters, map/list, freshness sorting and official data. | Better route planner than most Australian apps, but still mostly user-driven comparison. |
| clever-tanken | Germany | Long-running app, official MTS-K data, price alerts, favourites, station price history and premium fuel support. | Ads/subscription and app complexity appear in reviews. |
| mehr-tanken | Germany | Official data, price forecasts, fill recommendation and charging tariffs. | Shows that "when to fuel" can be a feature, not just "where to fuel". |
| Gaspy | New Zealand | Crowdsourced prices, community/gamified reporting and premium features. | Community reporting creates trust and freshness trade-offs. |

Sources: [Petrol Spy App Store](https://apps.apple.com/au/app/petrol-spy-australia/id826254811), [Petrol Spy Google Play](https://play.google.com/store/apps/details?id=com.pineconesoft.petrolspy), [Fuel Map Google Play](https://play.google.com/store/apps/details?id=au.com.fuelmap), [Simples App Store](https://apps.apple.com/au/app/simples-compare-save/id1475703699), [PetrolPrices Google Play](https://play.google.com/store/apps/details?hl=en_GB&id=apposing.petrolprices), [clever-tanken](https://www.clever-tanken.de/), [mehr-tanken Google Play](https://play.google.com/store/apps/details?hl=de&id=de.msg), [Gaspy Google Play](https://play.google.com/store/apps/details?id=nz.hwem.gaspy).

### 3. Route And Trip-Cost Tools

| Product | What to borrow |
| --- | --- |
| PetrolPrices UK Journey Planner | Start/destination route, live-priced stations along route, sort by cheapest/nearest/freshest, tank size, MPG, tank range, split cost, no sign-up. This is the closest consumer reference for Fuel Path. |
| Roadtrip | Vehicle-specific trip cost, passenger cost splitting, exact route cost, CO2 and car comparison. Strong pre-trip budgeting UX. |
| GasBuddy Trip Cost Calculator | Destination, vehicle type and diesel support for trip fuel estimates. Strong for road-trip planning. |
| Waze gas stations | Navigation-native station search, sorting by price/distance/brand where enabled, community station data. Strong in-car mental model, but not a full savings optimiser. |
| AAA Gas Cost Calculator | Simple trip fuel cost from start/destination averages. Good "fast answer" pattern. |
| TollGuru | Combines toll and fuel cost by route and vehicle. Relevant in Sydney where tolls can change the true cheapest route. |

Sources: [PetrolPrices Journey Planner](https://petrolprices.co.uk/journey.php), [Roadtrip blog](https://www.getroadtrip.app/blog/new-uk-app-shows-the-cheapest-petrol-station-along-your-route), [GasBuddy trip calculator](https://www.gasbuddy.com/tripcostcalculator), [Waze gas stations](https://www.waze.com/discuss/t/gas-stations/379637), [AAA Gas Cost Calculator](https://gasprices.aaa.com/aaa-gas-cost-calculator/), [TollGuru Gas Calculator](https://tollguru.com/gas-calculator).

### 4. Savings, Payment And Retailer Apps

| Product | What works | Risk to avoid |
| --- | --- | --- |
| 7-Eleven Fuel Lock | Price certainty and timed redemption. | Users need reminders and "should I lock now?" guidance. |
| Ampol / BPme / Shell / Reddy Express | Pay-in-app, points, receipts, offers and fuel discounts. | Payment flows attract support risk, pre-authorisation complaints and trust issues. |
| Upside | Cash-back marketplace across fuel, groceries and dining. Clear cash value, stackable with other rewards in some cases. | Claim-before-buy, offer denial, low-value offers and "is this a scam?" trust concerns appear in user feedback. |
| GasBuddy card / rewards | Fuel savings tied to payments, receipts and deals. | Privacy, support, app bloat and account/payment problems can damage trust. |

Sources: [7-Eleven](https://www.7eleven.com.au/my-7-eleven.html), [Ampol app](https://www.ampol.com.au/app), [BPme App Store](https://apps.apple.com/au/app/bpme/id1258154024), [Reddy Express discounts](https://www.reddyexpress.com.au/fuels), [Upside](https://www.upside.com/), [GasBuddy app](https://www.gasbuddy.com/app), [GasBuddy Google Play](https://play.google.com/store/apps/details?hl=en_US&id=gbis.gbandroid).

### 5. Fleet And High-Frequency Driver Tools

| Product | What to borrow |
| --- | --- |
| Mudflap | Diesel discounts, existing card payment, no credit checks, truck-safe navigation and route-to-fill-up pattern. |
| Trucker Path | Cheapest diesel near route, truck GPS, fuel discounts, parking, weigh stations, route editing and route comparison. |
| WEX Connect | Accepting fuel/card locations, real-time prices from transactions, fuel and EV charging search, fleet driver companion app. |
| Fleetio | Fuel card integrations, fuel economy tracking, cost-per-mile, exception reporting and fleet-wide reports. |

Sources: [Mudflap](https://www.mudflapinc.com/), [Mudflap app](https://www.mudflapinc.com/app), [Trucker Path fuel deals](https://truckerpath.com/discounted-fuel-deals), [Trucker Path Google Play](https://play.google.com/store/apps/details?hl=en_US&id=com.sixdays.truckerpath), [WEX fleet mobile apps](https://www.wexinc.com/products/fuel-cards-fleet/fleet-mobile-apps/), [WEX Connect Google Play](https://play.google.com/store/apps/details?hl=en_US&id=com.wex.octane), [Fleetio fuel management](https://www.fleetio.com/solutions/fuel-management-software).

## Review Mining

### Method

I sampled 2,883 recent reviews from Apple App Store RSS and Google Play for Australian, UK, US, German and fleet/trucker apps. I grouped review text into product themes with keyword classification, then sanity-checked the categories against app context.

This is directional evidence only. It is useful for repeated pain patterns, not precise market sizing.

### Theme Counts

| Theme | Mentions in sample | Product meaning |
| --- | ---: | --- |
| Map/search/distance/UI | 562 | Users care about fast station discovery, clear sorting, radius, location accuracy and not fighting the interface. |
| Performance/reliability | 370 | Crashes, slow loading, broken updates and server errors quickly destroy trust. |
| Discounts/rewards/loyalty | 365 | Savings are motivating, but conditions must be clear. |
| Route/trip/commute/navigation | 251 | Route-based use exists, especially in Waze, Trucker Path, Roadtrip and PetrolPrices. |
| Privacy/account/permissions | 216 | Users dislike forced accounts, unclear tracking and over-broad location permissions. |
| Payment/receipts/card | 211 | Payment features are valuable but high-risk. |
| Fleet/truck operations | 203 | Commercial users need accepted locations, route-safe stops and fuel-card logic. |
| Vehicle logging/export | 201 | High-frequency users and fleet-adjacent users value records, reports and history. |
| Price accuracy/freshness | 200 | Incorrect or stale prices are one of the most damaging failures. |
| Support/trust | 117 | Poor support converts a small price issue into product distrust. |
| Ads/subscription/clutter | 105 | Ads are a common complaint in fuel apps. |
| Closed/opening hours/availability | 90 | A cheap station is useless if closed, missing, or out of the user's fuel type. |
| Fuel type filtering | 82 | Petrol grade, diesel, LPG, AdBlue and premium filters matter. |
| Alerts/notifications | 41 | Explicit review mentions are lower, but the market feature set shows this is underdeveloped rather than unimportant. |
| EV-specific charging | 33 | Relevant adjacent opportunity, but not the core launch wedge for Fuel Path. |

### What Users Are Mostly Asking For

- Prices that are fresh, timestamped and explain their source.
- Better fuel type filters, including diesel, premium grades, LPG and AdBlue.
- Open-now, opening-hours and station availability signals.
- A route view that accounts for detour and distance, not just nearest station.
- Less clutter and fewer ads.
- More reliable map search and location handling.
- Rewards and discounts shown in a way that reflects actual eligibility.
- Payment features that do not fail at the pump.
- Simple receipts, history, exports and reimbursement support.
- Better support when price, payment or cashback goes wrong.
- Fewer account and permission demands before value is obvious.

### What Users Are Mostly Complaining About

- Wrong prices or prices that look fresh but are not correct.
- Driving out of the way for a price that is unavailable or membership-only.
- Apps becoming slower, more cluttered or less reliable after updates.
- Ads interrupting quick price checks.
- Payment, receipt and cashback issues.
- No clear way to correct station metadata when a station is closed, duplicated, missing or wrong.
- Poor filtering for the actual fuel they buy.
- Map pins, radius logic or distances that do not match real driving routes.
- Forced login, always-on location, or unclear privacy trade-offs.

### Segment-Specific Pain

| Segment | Pain observed | Fuel Path response |
| --- | --- | --- |
| Commuters | Manual repeated checking, price-cycle timing, local station variation, discount clutter. | Saved commute alerts, price-cycle nudges, routine-based recommendations, discount setup once. |
| High-frequency drivers | Detour cost, speed, reliability, receipts, route safety, payments. | Net saving after detour, one-tap best stop, receipts/history export, avoid payment in v1. |
| Small fleets | Accepted network, card eligibility, reporting, driver compliance, route policy. | Fleet-lite policies, station eligibility, approved brand/card filters, weekly spend/saving reports. |
| Road-trippers | Range, open stations, regional availability, diesel/AdBlue, station amenities. | Safe regional mode, reserve range, opening hours, fuel availability and navigation handoff. |

## Best Practices To Borrow

### Product Experience

- Use a recommendation card first, map second.
- Show "best", "cheapest gross", "least detour" and "safest" as separate options when needed.
- Calculate net saving, not just pump price.
- Show confidence: source, timestamp, price age, mismatch reports and opening status.
- Make fuel type and vehicle profile part of onboarding, not a hidden setting.
- Let users save commute routes without tracking every movement.
- Let high-frequency drivers export fuel decisions and receipts later.
- Keep payment out of the MVP unless a retailer partner materially changes the value.
- Avoid ads in the core flow.

### Data And Decisioning

- Treat official data as the base, but build a trust score on top.
- Measure route-corridor stations using real driving detours, not straight-line distance.
- Price freshness should affect recommendation ranking.
- Membership-only, coupon-only and fuel-card-only prices must be clearly marked.
- For NSW/ACT, keep FuelCheck as the source of truth and do not imply endorsement.
- Build price history early so alerts can become smarter over time.

### Notifications

Better fuel notifications are contextual:

- "Your usual commute passes a station 12c/L below your local area."
- "Fill today if below half a tank. Your common route is likely to be dearer tomorrow."
- "This cheaper option only saves $1.80 after the detour, skip it."
- "Your saved discount expires tonight."
- "This route has no reliable diesel after the next 80km."

Do not start with noisy generic alerts. Start with saved routes, price threshold and tank-range reminders.

## App-First Versus Web-First

### Recommendation

Build app-first with a web companion.

The dedicated app is the right primary product because the best features depend on:

- push notifications
- saved commute routes
- tank-level prompts
- location-aware reminders
- widgets / lock-screen style glanceability later
- navigation handoff
- possible CarPlay / Android Auto later
- high-frequency driver habits

Australia is a strong mobile market. ACMA reported that in 2025, 97% of Australian adults used mobile phones to go online and 92% used mobile internet daily. That supports the hunch that a mobile app can earn adoption if the value is repeatable and practical.

The web companion is still important:

- SEO and explainability.
- "Try a route before installing."
- Shareable route and savings examples.
- Partner/fleet landing pages.
- Admin dashboard for fleet-lite.
- Support and data transparency pages.

Sources: [ACMA mobile internet research](https://www.acma.gov.au/articles/2026-02/mobile-phone-internet-use-soars-landline-use-keeps-falling-acma-research-shows), [DataReportal Digital 2026 Australia](https://datareportal.com/reports/digital-2026-australia).

### Practical Implementation Strategy

| Layer | Recommended approach |
| --- | --- |
| Consumer driver | Native mobile app or high-quality cross-platform app. Needs push, saved routes and fast map UX. |
| Public demo | Lightweight web route planner with NSW/ACT sample routes. |
| Fleet admin | Web dashboard first. Fleet managers do not need to manage policies from a phone. |
| Driver fleet mode | Same mobile app with team policy/profile enabled. |
| Partner/API | Later. Do not expose until the recommendation engine is stable. |

## NSW/ACT MVP Strategy

### Why NSW/ACT First

- FuelCheck provides a credible live data source.
- The market already understands fuel checking, so education cost is lower.
- Sydney/Greater Sydney commuting, toll roads and high price variability create strong route economics.
- ACT inclusion gives a natural cross-border test case.
- High-density metro plus regional corridors let the product test commute and safe regional modes.

### Product Promise

For NSW/ACT v1:

> Fuel Path checks your destination, tank and fuel type, then tells you whether to fill now, on the way, later, or not at all.

### Core MVP

- Destination search and route preview.
- Home/work/favourite route saving.
- Fuel type, tank size and rough fuel economy profile.
- Simple current tank input: Empty, quarter, half, three-quarter, full.
- Stations within a configurable route corridor.
- Driving detour calculation.
- Net saving after detour fuel burn.
- Price source, timestamp and freshness.
- Open-now and station metadata where available.
- Top recommendation plus 2-3 alternatives.
- Alerts for saved route, price threshold and "not worth detour".
- Navigation handoff to Apple Maps, Google Maps or Waze.

### Frequent Driver Add-Ons

- Weekly savings tracker.
- Repeated route detection through explicit saved routes first.
- Fuel receipt/history notes.
- Discount wallet: 7-Eleven lock, Everyday Rewards, Flybuys, NRMA, Ampol, RAA/RACQ later.
- Export for tax or reimbursement.
- "Fuel before shift" and "fuel before commute" reminders.

### Fleet-Lite Add-Ons

- Team account with vehicles and drivers.
- Approved fuel types and minimum reserve.
- Approved brands, fuel cards or member networks.
- "Cheapest within policy" recommendation.
- Weekly fleet saving and exception report.
- Driver-friendly app mode, not a heavy dispatch system.

## Decision Engine

Fuel Path's core value should be a scoring model, not a map.

### Inputs

- Route origin and destination.
- Route polyline and ETA.
- Vehicle fuel type.
- Tank size, current tank estimate and reserve.
- Fuel economy estimate.
- Station coordinates, price, timestamp and source.
- Opening hours and availability where available.
- User memberships, rewards and discount rules.
- Fleet policy where relevant.

### Station Score

Each station should be ranked by:

- gross pump price
- discount-adjusted price
- route detour distance
- route detour time
- extra fuel burned by detour
- price freshness
- source reliability
- opening status
- range safety
- payment or membership eligibility
- fleet policy fit

### Output

The output should be plain:

- Best choice: "Fill at X on your route."
- Why: "Saves about $7.40 after a 3-minute detour."
- Confidence: "Official FuelCheck price, updated 12 minutes ago."
- Warning: "Requires Costco membership" or "not worth the detour."
- Handoff: "Navigate there."

## Technical Approach

### Data

- Use API.NSW Fuel API for NSW, verify ACT records in the feed, and treat TAS as a later extension through the v2 pathway where allowed.
- Store station metadata and price snapshots.
- Run scheduled refreshes and track price history.
- Keep source attribution and last-updated fields visible.
- Build correction/reporting only after the source-of-truth policy is clear.

### Routing

Two practical options:

| Option | Pros | Cons |
| --- | --- | --- |
| Google Maps Platform | Strong Places/Routes ecosystem, Search Along Route architecture, familiar navigation handoff. | Cost can rise quickly; licensing and caching rules need care. |
| Mapbox | Strong custom map control and advanced routing patterns; good EV-route inspiration. | More implementation ownership and still needs local station data matching. |

Sources: [Google Routes API](https://developers.google.com/maps/documentation/routes), [Google Search Along Route architecture](https://developers.google.com/maps/architecture/search-along-route-places-and-routes-api), [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/), [Mapbox EV routing](https://www.mapbox.com/blog/electric-vehicle-routing-preview).

### Algorithm

1. Compute route.
2. Build a corridor around the route.
3. Select candidate stations in corridor by fuel type.
4. For each station, compute realistic detour using route matrix or waypoint route.
5. Estimate detour fuel cost.
6. Apply user discounts only when eligible.
7. Filter out unsafe range options.
8. Rank by net saving, time, freshness and policy.
9. Return a recommendation and alternatives.

### Notifications

Start conservative:

- Saved route check at user-selected times.
- Price threshold by route or suburb.
- Price-cycle or history-based prompt only after enough local history.
- Tank prompt based on user input, not background vehicle telemetry.
- Fleet policy prompt for "approved cheaper stop on route".

Avoid always-on tracking at launch. It raises privacy risk and is not needed to prove the core value.

## Business Model Options

| Model | Fit | Risk |
| --- | --- | --- |
| Freemium consumer app | Good. Basic route recommendation free, premium saved routes/alerts/discount wallet. | Paywall too early could limit trust and data. |
| Fleet-lite subscription | Strong for high-frequency and small fleets. | Requires reliability, support and reporting discipline. |
| Affiliate/partner offers | Useful later if offers are net-price transparent. | Can corrupt trust if recommendations appear sponsored. |
| Ads | Poor fit for core flow. | Reviews show ads are a common complaint in fuel apps. |
| Data/API licensing | Possible later. | Needs robust data rights and unique derived intelligence. |

Recommended first model:

- Free basic NSW/ACT route planner.
- Paid frequent-driver tier once alerts and saved route value are proven.
- Fleet-lite paid pilot with a few small operators.
- Partner offers only when the app can clearly show net price and eligibility.

## Risks

- Data rights: API use, caching, redistribution and attribution need legal review.
- Accuracy: bad recommendations can waste fuel and harm trust.
- Liability: range and safety advice needs conservative wording.
- Driving safety: keep decisioning pre-trip and hand off to navigation.
- Privacy: routes and fuel habits are sensitive behavioural data.
- Discounts: do not imply eligibility unless the user configured the relevant membership or card.
- Fleet workflows: small fleet needs are not the same as consumer needs.
- App adoption: a native app earns adoption only if the weekly habit is clear.

## Opportunity Map

### High-Confidence Opportunities

1. **Net-savings route recommendation**
   - Differentiates from maps and price lists.
   - Directly addresses detour and false-saving pain.

2. **Saved commute alerts**
   - Strong fit for commuters and frequent drivers.
   - Mobile app advantage.

3. **Trust and freshness layer**
   - Directly addresses repeated review pain.
   - Builds credibility against map-first competitors.

4. **Discount-aware net price**
   - Users already use Flybuys, Everyday Rewards, 7-Eleven locks and member discounts.
   - The hard part is eligibility, not displaying coupons.

5. **Fleet-lite approved-stop mode**
   - Natural extension for high-frequency drivers and small fleets.
   - Avoids trying to beat Fleetio/WEX at full fleet management.

### Medium-Confidence Opportunities

1. **Price-cycle prediction**
   - Useful, but state-specific and needs enough history.

2. **Receipt and reimbursement export**
   - Useful for high-frequency drivers and fleets, but can wait until route value is proven.

3. **Toll plus fuel route economics**
   - Highly relevant in Sydney, but adds complexity.

4. **EV charging comparison**
   - Adjacent future opportunity, not the launch wedge.

### Lower-Confidence Or Later

1. In-app fuel payment.
2. Full navigation.
3. Heavy gamified community reporting.
4. National launch before NSW/ACT decisioning is excellent.
5. Marketplace of unrelated financial products.

## Suggested Build Roadmap

### Phase 0: Feasibility Prototype

- Validate NSW Fuel API access, terms, rate limits and station metadata.
- Build a route-corridor prototype for 5-10 NSW/ACT routes.
- Calculate detour distance/time and net saving.
- Test output cards with real prices.

### Phase 1: Consumer MVP

- Mobile app with route planner, vehicle profile and best-stop card.
- Web demo with the same route planner.
- Saved route alerts.
- Price freshness and source labels.
- Navigation handoff.

### Phase 2: High-Frequency Driver Mode

- Frequent-route dashboard.
- Discount wallet.
- Weekly savings summary.
- Receipt/history notes.
- Basic export.

### Phase 3: Fleet-Lite Pilot

- Admin web dashboard.
- Vehicle and driver profiles.
- Approved network and fuel-card rules.
- Driver app policy mode.
- Weekly saving and exception reports.

### Phase 4: National Expansion

- TAS via FuelCheck pathway.
- WA for today/tomorrow decisioning.
- QLD/SA via approved/open feeds.
- VIC/NT after data access validation.

## Practical Next Steps

1. Validate API.NSW Fuel API access and terms for commercial/public app use.
2. Build a working route-scoring prototype for Sydney commute corridors.
3. Interview:
   - 10 commuters
   - 5 rideshare/delivery drivers
   - 5 tradies or small fleet operators
   - 3 fleet/admin buyers
4. Test four route cards:
   - cheapest
   - best net saving
   - least detour
   - safest regional stop
5. Launch a web demo/waitlist to test the promise before app store release.
6. Design the app around one primary action: "Best fill for this drive."

## Bottom Line

Fuel Path should not try to win by having more dots on a map.

It should win by becoming the Australian fuel product that reliably says:

> For this drive, with your car, tank and discounts, this is the best fuel decision.

That is the gap between fuel checking and fuel planning.
