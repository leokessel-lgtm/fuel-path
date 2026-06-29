# Fuel Path Market Research

Last researched: 13 June 2026, Australia/Sydney

## TLDR

Australia already has strong fuel price data, but the user experience is still mostly "open a map, compare dots, decide for yourself".

The gap is not simply "show cheap fuel near my route". NSW FuelCheck, FuelCheck TAS and Simples already claim route-based search. The stronger gap is a decision engine that answers:

- Should I fill now, wait, or fill on my route?
- Which station is cheapest after detour time, extra fuel used, opening hours, membership rules and loyalty discounts?
- Can I safely reach that station with my vehicle and current tank level?
- Should I get a notification before a regular commute, school run, weekend trip or price cycle jump?

The best opportunity is a consumer "fuel planning copilot" for Australian motorists. It should start with a destination, vehicle profile and tank level, then recommend the best fuel action rather than making the user inspect a map.

## Recommendation

Build Fuel Path around the promise: "Plan the cheapest safe fill on your actual drive."

Do not compete first as another fuel price map. Compete as a planner:

1. Destination-first route planner.
2. Net savings calculation after detour, fuel used and available discounts.
3. Smart alerts for regular routes, tank range, price thresholds and price-cycle timing.
4. Trust layer showing price freshness, source, mismatch risk, opening hours, fuel availability and membership-only restrictions.
5. Offer stacker for supermarket dockets, memberships, cashback, fuel-lock products and brand apps.

## Australian Market Map

### Government And State-Backed Tools

| Tool | Coverage | Strengths | Limits / opportunity |
| --- | --- | --- | --- |
| NSW FuelCheck | NSW and ACT | Real-time fuel prices, directions, favourite stations, price-drop alerts, trends, price mismatch reporting, "My trip" route feature. App Store shows 4.8 from 121K Australian ratings. NSW Fuel API exposes live pricing for NSW, with v2 covering NSW and Tasmania. | Strong incumbent in NSW. Product gap is better route economics, offer stacking, proactive journey alerts and clearer "best decision" guidance. |
| FuelCheck TAS | Tasmania | Real-time prices, trends, cheapest day, price mismatch reporting and My Trip for longer journeys. | Small market but useful official pattern for route-based fuel. |
| FuelWatch WA | Western Australia | Next-day fuel prices submitted by 2pm, published by 2:30pm and locked for 24 hours from 6am. This is excellent for "buy today or tomorrow" decisions. | Map-led. Discounts and fees are excluded. Route planning is not the core product. |
| QLD fuel price reporting | Queensland | Open fuel price data via API and CSV. Government lists many apps that receive QLD data. | No single government app. Fragmented third-party UX creates room for a better planner. |
| SA fuel price transparency scheme | South Australia | Retailers report to a central database within 30 minutes. Government uses approved third-party apps rather than its own app. | Fragmented. RAA is strong locally, but trip-level planning is still limited. |
| Victoria Servo Saver | Victoria | Integrated into Service Victoria app. Mandatory retailer reporting, current price, tomorrow's price cap, opening hours, ad-free interface. Service Victoria now lists a Servo Saver Public API for third-party access. | Public API/application path appears available, but Fuel Path still needs approved access, schema, licence, caching and attribution terms before adapter work. Recent reporting raised accuracy concerns during the 2026 fuel crisis. |
| MyFuel NT | Northern Territory | Web app with mandatory reporting, real-time prices, fuel availability, list/map views and navigation. | Web-app only. Strong rural/remote planning need, but not a route-intelligence product. |

Sources: [Service NSW FuelCheck](https://www.service.nsw.gov.au/referral/check-fuel-prices), [NSW Fuel API](https://api.nsw.gov.au/Product/Index/22), [FuelCheck TAS](https://cbos.tas.gov.au/topics/products-services/fuelchecktas-consumer), [WA FuelWatch](https://www.consumerprotection.wa.gov.au/fuelwatch-and-fuel-prices), [Queensland fuel price apps](https://www.treasury.qld.gov.au/policies-and-programs/fuel-in-queensland/fuel-price-apps-websites/), [SA real-time petrol pricing](https://cbs.sa.gov.au/news/real-time-petrol-pricing), [Victoria mandatory fuel price reporting](https://www.consumer.vic.gov.au/consumers-and-businesses/products-and-services/mandatory-fuel-price-reporting), [MyFuel NT](https://consumeraffairs.nt.gov.au/myfuel-nt).

### Consumer Fuel Price Apps

| Tool | Positioning | Strengths | Limits / opportunity |
| --- | --- | --- | --- |
| Petrol Spy | National fuel price map for Australia and NZ | Very strong reach. App Store shows 4.8 from 169K Australian ratings. Google Play shows 4.7, 66K+ reviews and 1M+ downloads. Includes real-time map, price cycles, notifications for best time to buy unleaded, government data for NSW and WA, and community submissions. | Customer pain centres on ads, closed stations, membership-only stations, fuel-type filtering and distance accuracy. It is popular, but still map-first. |
| Fuel Map Australia | Crowdsourced station map plus fuel log | Helpful for touring and fuel economy logging. Shows real-time WA, NSW and QLD data, plus WA tomorrow prices. | Google Play shows 3.5 from 12K reviews. Complaints mention clunkiness, ads, inaccurate or fake stations and export/support issues. App update history appears old. |
| My NRMA | Roadside, rewards, EV charging, cashback, fuel deals | App Store shows 4.6 from 109K ratings. Google Play listing says it supports real-time fuel pricing across Australia and stacks member Ampol discounts with Everyday Rewards. | Broad member app, not a specialist fuel-route optimiser. |
| Simples | Compare the Market app with fuel and financial comparisons | Claims route-based fuel prices and favourites. Broad savings ecosystem can cross-sell insurance, loans, utilities and other comparison products. | App Store rating is lower at 3.6 from 142 ratings. Terms note only participating stations are compared and price display can lag. Some users complained about lack of time/date stamps. |
| RACQ Fuel and Deals | Queensland motoring club fuel and member deals | Combines price comparison, price-cycle buying advice and member discounts. | Queensland-led, not a national route planning engine. |
| RAA app | SA fuel price map and member benefits | Real-time prices, trends and member savings icon. RAA says prices update when stations report to the central database, within 30 minutes. It also advertises member discounts. | Strong local utility, but not destination-first. |
| MotorMouth, ServoTrack, FuelRadar, Fuel Snoop, Fuel Price Australia, FuelWise, Petrolmate and others | Long-tail fuel apps and websites | Demonstrates active demand and low barriers to map-based competition. | Many are thin, local, ad-supported or duplicative. Differentiation is weak unless they add planning intelligence or unique offers. |

Sources: [Petrol Spy App Store](https://apps.apple.com/au/app/petrol-spy-australia/id826254811), [Petrol Spy Google Play](https://play.google.com/store/apps/details?id=com.pineconesoft.petrolspy), [Fuel Map App Store](https://apps.apple.com/us/app/fuel-map-australia/id999638192), [Fuel Map Google Play](https://play.google.com/store/apps/details?id=au.com.fuelmap), [My NRMA App Store](https://apps.apple.com/au/app/my-nrma/id343747162), [My NRMA Google Play](https://play.google.com/store/apps/details?id=com.nrma), [Simples App Store](https://apps.apple.com/au/app/simples-compare-save/id1475703699), [Simples fuel page](https://www.comparethemarket.com.au/fuel/simples-fuel-app/), [RACQ fuel prices](https://www.racq.com.au/car/queensland-fuel-prices), [RAA fuel prices](https://www.raa.com.au/motor/safety-and-advice/fuel).

### Retailer And Loyalty Offers

| Offer | What it does | Product lesson |
| --- | --- | --- |
| 7-Eleven Fuel Price Lock | Lets users find 7-Eleven's best local price, lock it for 7 days and redeem up to 25c/L discount. | Price certainty is powerful. Customers want help knowing when to lock. Complaints show trust matters when locks disappear or caps feel reduced. |
| Ampol app | FuelPay, 6c/L first three FuelPay fills, referral discount, Everyday Rewards linking and in-app offers. | Payments, rewards and fuel price planning are currently separate experiences. |
| BPme | Pay in app, earn BP or Qantas points, pre-order coffee, track points and purchases, station finder. | Convenience has value, but payment flows introduce trust and support risk. |
| Shell / Reddy Express / Flybuys | Coles digital fuel dockets, 4c/L discount or 8 Flybuys points/L, plus Reddy Express spend $20 for 10c/L and stack to 14c/L in some cases. | Users need a "net price" view after realistic offers, not just pump price. |
| Budget Direct fuel app | Eligible customers can access Shell/Reddy discounts and stack with other offers up to advertised limits. | Insurance and financial services can act as fuel-savings channels. |
| OTR / Scan Pump $ave | Pay at pump and instant-win per-litre discounts through participating OTR and Reddy Express network. | Gamified savings and in-car payment can complement route planning, but risk cluttering the core decision. |

Sources: [7-Eleven My 7-Eleven](https://www.7eleven.com.au/my-7-eleven.html), [Ampol app](https://www.ampol.com.au/app), [BPme App Store](https://apps.apple.com/au/app/bpme/id1258154024), [Reddy Express fuel discounts](https://www.reddyexpress.com.au/fuels), [Shell digital fuel dockets](https://www.shell.com.au/motorists/go-well-content-hub/flybuys-and-digital-fuel-dockets-all-you-need-to-know.html), [Budget Direct fuel app](https://www.budgetdirect.com.au/existing-customers/fuel-app.html), [Scan Pump Save](https://scanpumpsave.com.au/).

## Overseas Inspiration

| Product | Useful pattern for Fuel Path |
| --- | --- |
| PetrolPrices UK Journey Planner | Best reference for route-first fuel UX. Users enter start and destination, see live-priced stations along the route, sort by price, distance or freshness, choose off-route search radius, add tank range, dim unreachable stations, split trip costs and reload recent journeys. |
| Waze gas stations | Navigation-native pattern. Waze supports gas station search on route, sorting by price, distance or brand, and community price updates when users are physically near a station. |
| Fuelio by Sygic | Combines fuel logging with route planning, vehicle range, preferred station criteria, stop recommendations and detailed route reports. |
| Roadtrip app | Strong trip-cost UX. Uses exact car model, route, fuel prices, cost splitting, CO2 and vehicle comparison. Good inspiration for pre-trip budgeting. |
| GasBuddy | Mature US fuel marketplace with trip cost calculator, prices along routes, payment card savings, deal alerts, receipt rewards and fuel availability tracker. Also a warning sign on privacy, payment and accuracy trust. |
| Upside | Cashback marketplace across fuel, groceries and dining. Strong model for adjacent offers and clear cash-out value, not just points. |
| ADAC Drive | German motoring club app combining fuel prices, price history, best-time recommendations, EV charging, international fuel prices and vehicle-specific route planning. |
| TollGuru | Combines fuel cost and toll cost by route, vehicle type and toll tag. Very relevant in Australian metro corridors where tolls change route economics. |

Sources: [PetrolPrices UK Journey Planner](https://petrolprices.co.uk/journey.php), [Waze gas station guide](https://www.waze.com/discuss/t/gas-stations/379637), [Fuelio route planning announcement](https://www.sygic.com/press/fuelio-introduced-its-premium-cost-saving-features-for-planning-fill-ups-on-the-route-smarter), [Roadtrip app](https://www.getroadtrip.app/), [GasBuddy trip calculator](https://www.gasbuddy.com/tripcostcalculator), [GasBuddy Google Play](https://play.google.com/store/apps/details?id=gbis.gbandroid), [Upside](https://www.upside.com/), [Upside Google Play](https://play.google.com/store/apps/details?id=com.upside.consumer.android), [ADAC Drive Google Play](https://play.google.com/store/apps/details?id=com.ptvag.android.adacgasprices), [TollGuru gas calculator](https://tollguru.com/gas-calculator).

## Customer Feedback Themes

### What customers value

- Savings are tangible. Petrol Spy and FuelCheck reviewers repeatedly describe saving meaningful money per tank or hundreds over time.
- People check before leaving home. This supports a "pre-trip decision" flow rather than only an in-car flow.
- Road trip and regional use matters. Fuel Map reviews show people use fuel apps to locate stations and plan fill intervals in remote areas.
- Trustworthy official data is valued. FuelCheck, FuelWatch, RACQ and RAA all benefit from government or motoring-club credibility.

### What frustrates customers

- Ads and clutter in map-first apps.
- Incorrect prices or missing freshness timestamps.
- Closed stations, missing opening hours or unavailable fuels.
- Membership-only prices, especially Costco-style traps, shown as if everyone can access them.
- Poor fuel-type filtering or trends that do not match the selected fuel type.
- Distance shown in a way that ignores route detour cost.
- Payment app issues, including pre-authorisation, lag, onboarding and station eligibility.
- Location permission and privacy anxiety, especially where the product asks for more information than the user expects.

### Evidence notes

App Store and Google Play reviews are directional, not statistically rigorous. They are still useful because the complaints cluster around the same product gaps: trust, freshness, detour logic, usability and net price.

Relevant sources include [Petrol Spy App Store reviews](https://apps.apple.com/au/app/petrol-spy-australia/id826254811), [Petrol Spy Google Play reviews](https://play.google.com/store/apps/details?id=com.pineconesoft.petrolspy), [Fuel Map Google Play reviews](https://play.google.com/store/apps/details?id=au.com.fuelmap), [Simples App Store reviews](https://apps.apple.com/au/app/simples-compare-save/id1475703699), [BPme App Store reviews](https://apps.apple.com/au/app/bpme/id1258154024), [CHOICE cheap fuel app review](https://www.choice.com.au/transport/cars/general/articles/cheap-fuel-apps-review), [NSW FuelCheck App Store reviews](https://apps.apple.com/au/app/nsw-fuelcheck/id1266569551).

## Gaps Worth Exploring

### 1. Net-Savings Route Planner

Most apps show pump price. Fuel Path should show net cost:

- pump price
- eligible loyalty and docket discount
- membership-only status
- detour distance and time
- fuel burned by the detour
- expected wait or stop convenience
- confidence / freshness score

Example output:

| Option | Decision |
| --- | --- |
| Fill now near home | Safe, saves $4.20 versus destination area, 2 min detour |
| Fill halfway at station X | Cheapest gross price, but only saves $1.10 after 8 min detour |
| Wait until tomorrow | Recommended if not driving tonight because WA/VIC/price-cycle data suggests lower price |

### 2. Smart Notifications

Current alerts tend to be static price thresholds or broad "best time to buy" prompts. Better alerts would be contextual:

- "You are driving to Parramatta tomorrow morning. Cheapest reachable U91 on route is 14c/L below your local average."
- "Your regular Tuesday commute passes a station that is 11c/L cheaper than near home."
- "FuelWatch says tomorrow's price is locked 18c/L higher near your route. Fill today if below half a tank."
- "Your 7-Eleven lock expires tonight and current local prices are rising."
- "You can reach the cheaper station, but not with your usual reserve. Top up before leaving."

### 3. Trust Layer

Fuel prices are only useful if users believe them. Add confidence cues:

- source: official API, retailer feed, user report, inferred, stale
- last updated time
- mismatch reports
- price age and volatility
- open now / opening soon
- fuel available / outage
- payment and discount eligibility
- membership required
- "do not rely if price older than X" warning in regional areas

### 4. Safe Regional Mode

For regional drives, the cheapest station is not always the best station. The app should support:

- minimum reserve range
- next fuel stop distance
- opening hours and after-hours access
- diesel, AdBlue and LPG availability
- remote coverage confidence
- "fill here even though not cheapest" safety recommendations

### 5. Offer Stacking And Adjacent Savings

Complementary offers that fit the fuel planning job:

- supermarket fuel dockets and Flybuys / Everyday Rewards
- 7-Eleven fuel lock reminders
- Ampol / NRMA / RAA / RACQ member discounts
- cashback offers and discounted fuel gift cards
- toll cost comparison
- parking near destination
- roadside assistance
- tyre pressure, servicing and fuel economy reminders
- car wash and coffee if useful, but keep secondary
- EV charging comparison for hybrid or household mixed-fleet users

The key is to calculate the realistic net price. Do not just list coupons.

## Suggested MVP

### Target user

Australian private motorists who already check fuel prices but find the process manual. Start with commuters, families and road-trippers. Treat rideshare, delivery drivers and tradies as heavier-use follow-on segments.

### MVP markets

1. NSW / ACT first, because FuelCheck is mature, popular and has an API.
2. TAS as a useful official-data extension through FuelCheck patterns.
3. QLD and SA next if official/approved feeds are accessible.
4. WA for "today versus tomorrow" planning because FuelWatch has a unique locked-price rule.
5. VIC requires separate data access validation because the current official product is Servo Saver in Service Victoria and the public API still needs approved access, schema, licence, caching and attribution evidence before implementation.
6. NT for regional mode, if the web data can be accessed reliably and lawfully.

### MVP features

- Destination search and route preview.
- Vehicle profile: fuel type, tank size, rough L/100km, preferred reserve.
- Current tank level input, simple buttons are enough at first.
- Station list along route with off-route radius.
- Net savings calculation after detour.
- Price freshness and source label.
- Open now / opening hours where available.
- Membership-only and discount eligibility flags.
- Smart recommendation: Fill now, fill later, fill on route, or skip.
- Save common routes.
- Alerts for price threshold, regular routes, tomorrow's price caps and price-cycle timing.
- Export directions to Apple Maps / Google Maps / Waze.

### What not to build first

- Full turn-by-turn navigation.
- A broad insurance/comparison marketplace.
- In-app fuel payment.
- Community price editing before the trust model is clear.
- Heavy social/gamification.

## Risks And Constraints

- Data rights vary by state and source. Some feeds are open, some are approved-publisher schemes, some are app-only or delayed.
- Fuel price mismatch can create user harm. The product needs disclaimers, freshness labels and quick correction/reporting flows.
- Discounts are conditional. Net price must not imply eligibility unless the user has configured the relevant membership, card or docket.
- Driving safety matters. The app should be strongest before the trip and hand off to navigation, not encourage active comparison while driving.
- Privacy matters. Route, location and fuel habits are sensitive enough that the app should minimise collection, explain value clearly and support manual route entry without always-on tracking.
- Monetisation can damage trust. Ads were a common complaint. A paid premium planner, affiliate offers, or privacy-safe partner offers are cleaner than intrusive advertising.

## Open Questions For Leo

1. Is the first product for daily commuters, road trips, or high-frequency earners like rideshare and delivery drivers?
2. Do you want Fuel Path to be a consumer app, a browser-based planning tool, or both?
3. Are you comfortable starting in NSW/ACT even though FuelCheck is strong there, or would you prefer a state with weaker route intelligence?
4. Is the intended business model subscription, ads, affiliate offers, data/API licensing, or a free utility first?
5. Should the app include discounts and rewards from day one, or stay price-only until the route recommendation works well?
6. Do you want this to eventually support EV charging and mixed petrol/EV households?

## Bottom Line

The market has data, maps and discounts. It lacks a calm, trusted decision layer.

Fuel Path should not ask users to hunt through dots. It should say, in plain language:

"For this trip, with your car and current tank, this is the best place to fuel. Here is why. Here is how much you actually save. Here is when to leave it alone."
