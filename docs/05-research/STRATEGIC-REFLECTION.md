# Fuel Path Strategic Reflection

Last updated: 13 June 2026, Australia/Sydney

## TLDR

The original instinct was sound: Australia has plenty of fuel price data and fuel price maps, but motorists still do most of the thinking themselves.

The strongest opportunity is not another map. It is a trusted decision layer for:

- commuters
- high-frequency drivers
- small fleets
- road-trippers when range and availability matter

Fuel Path should stay focused on the promise:

> Plan the cheapest safe fill on your actual drive.

The live prototype now proves the core route-scoring idea can work with API.NSW data. The next risk is not code. It is whether users trust the recommendation, whether API.NSW permits the intended usage, and whether the decision is valuable enough to become a habit.

## Original Objectives

The starting goals were:

1. Map the Australian fuel-checker and fuel-saver market.
2. Look overseas for better UI, UX, data and notification patterns.
3. Read customer feedback and identify repeated pain points.
4. Understand Australian fuel price cycles and predictability.
5. Find market gaps and adjacent offers.
6. Explore NSW/ACT first.
7. Build towards a practical demo if the data path looked viable.

Those objectives have been met enough to stop broad research and move to validation.

## What The Research Confirmed

### 1. The Market Has Data, But Not Enough Decisioning

NSW FuelCheck, Petrol Spy, Fuel Map, My NRMA, Simples, RACQ, RAA and state schemes already help users see prices.

But the common pattern is still:

1. open a map
2. scan pins
3. compare prices
4. guess whether the detour is worth it
5. remember discounts
6. decide manually

Fuel Path's wedge remains valid because it can collapse that work into:

> Best stop, actual saving, risk and reason.

### 2. Route-Based Fuel Is Not Completely New

The research corrected an early assumption. Some tools already have trip or route features:

- NSW FuelCheck has My Trip.
- FuelCheck TAS has My Trip.
- Simples claims route-based fuel.
- PetrolPrices UK has a strong journey planner.
- Waze supports fuel stations in a navigation context.
- GasBuddy and Roadtrip support trip cost and route-style planning.

So the gap is narrower and sharper:

> Not route search, but route decisioning.

The product must beat existing route features by factoring in detour economics, range, freshness, eligibility and alerts.

### 3. Customer Pain Clusters Around Trust

The repeated feedback themes were:

- stale or wrong prices
- missing timestamps
- closed stations
- membership-only prices shown as normal prices
- bad distance or radius logic
- weak fuel-type filtering
- ads and clutter
- privacy/account friction
- unreliable payment, cashback or receipt flows

This points to a product truth:

> A fuel app wins or loses on trust before cleverness.

Fuel Path must make source, timestamp, freshness, eligibility and uncertainty visible by default.

### 4. Notifications Are Underdeveloped

Most alerts are generic:

- price threshold
- favourite station
- broad best-time-to-buy signal

The opportunity is contextual alerts:

- before a regular commute
- before a saved route
- when the user has enough range to wait
- when a route station is materially cheaper after detour
- when a cycle spike has started but cheaper stations remain
- when a discount or fuel lock is about to expire

This is where an app-first strategy makes sense.

### 5. Fuel Cycles Are Useful, But Easy To Overclaim

The fuel price cycle research matters because it defines where Fuel Path should be confident:

- use cycle logic first for Sydney unleaded
- do not apply petrol-cycle logic to diesel
- do not apply Sydney-cycle logic to Canberra
- treat cycles as guidance, not prediction
- combine cycle state with route economics and tank range

The winning experience is not "petrol will rise tomorrow".

It is:

> Prices on your route look low, rising, falling or uncertain. Given your tank and trip, here is the sensible action.

## What The Prototype Changed

### Access Risk Reduced

The biggest technical blocker was live NSW fuel data.

That is now materially reduced:

- registered API.NSW credentials validated
- OAuth works with the GET grant pattern
- v1 and v2 FuelPriceCheck endpoints return live data
- live route scoring works through a local server-side proxy
- browser does not receive API credentials

This is enough proof for a validation demo.

### ACT Coverage Confirmed For Local Validation

The research expected NSW/ACT as the starting geography. A later live app test confirmed ACT station records are exposed through the API.NSW FuelCheck feed used by the local proxy.

Evidence from 14 June 2026:

- the live Nearby app flow centred on Canberra returned ACT stations
- the live `/api/stations` proxy returned 47 stations within 12 km of Canberra, including 43 ACT-like station records
- the live `/api/stations` proxy returned 71 stations within 30 km of Canberra, including 57 ACT-like station records
- the credential validation helper now detects ACT examples in the live payload

Product implication:

- NSW/ACT remains a credible first geography for local validation
- Canberra can be used as a live Nearby and route-planning scenario
- public/commercial usage rights still need API.NSW confirmation before any shared or production use

### The Scoring Wedge Survived

The live demo showed 78 eligible U91 candidates on a Parramatta to Sydney CBD route and produced a top recommendation with:

- pump price
- route median
- detour minutes
- estimated net saving
- freshness warning
- source label

That proves the first decision model is not just a slide idea. It is runnable.

## Opportunity Map

### Primary Opportunity: Commuter Fuel Copilot

Best first customer:

- drives the same routes often
- already checks prices manually
- is price-sensitive but time-sensitive
- wants a recommendation before leaving, not while driving

Core loop:

1. save commute
2. set fuel type and rough tank level
3. get a recommendation
4. receive only meaningful alerts
5. see weekly estimated saving

Why this is strong:

- repeat usage
- habit-forming
- notification value
- Sydney price-cycle relevance
- low need for complex fleet admin early

### Secondary Opportunity: High-Frequency Driver Mode

Examples:

- rideshare
- delivery
- tradies
- sales reps

Needs:

- fast answer
- route-safe stop
- discount eligibility
- simple history/export
- low detour tolerance

This segment may have stronger willingness to pay, but also higher reliability expectations.

### Third Opportunity: Fleet-Lite

Small fleets are attractive, but should not drag v1 into enterprise software.

Best wedge:

- vehicles and fuel types
- approved brands/cards
- minimum reserve
- cheapest in-policy stop
- weekly saving and exception report

Avoid early:

- dispatch
- full telematics
- fuel-card issuing
- complex integrations

### Later Opportunity: Regional Safe Mode

Road trips and regional driving are emotionally strong, but less frequent.

The opportunity is not just saving money. It is:

- do not miss fuel
- do not rely on closed stations
- know where diesel, LPG or AdBlue is available
- preserve reserve range

This should become a product mode, not the launch wedge.

## Adjacent Offers Worth Keeping

Good complements:

- 7-Eleven fuel lock reminders and "should I lock now?"
- Everyday Rewards, Flybuys, NRMA/Ampol and motoring-club discounts
- cashback or discounted gift-card offers where terms are clear
- toll plus fuel route economics for Sydney
- fuel history and export for high-frequency drivers
- fleet-card eligibility for small fleets
- parking near destination later
- EV charging later for mixed households

Avoid early:

- in-app fuel payment
- intrusive advertising
- broad comparison marketplace
- community price editing before trust model is mature
- heavy gamification

## Strategic Positioning

Fuel Path should not say:

> We show fuel prices.

It should say:

> We tell you the best fuel decision for this trip.

The product language should stay practical:

- "Worth it"
- "Skip it"
- "Fill before this route"
- "Wait if you can"
- "Cheaper, but not worth the detour"
- "Range risk"
- "Stale price"
- "Member-only"

This keeps the product differentiated from maps and avoids overclaiming.

## Stop-Build Recommendation

Stop adding features for now.

The next work should be validation, not more product surface.

Reasons:

- the scoring concept is proven enough for live local demos
- the key remaining questions are external and behavioural
- more UI features may obscure whether the core recommendation is trusted
- API.NSW rights still need confirmation
- early testers should react to the smallest credible version

## Validation Plan

Run 5 to 8 short validation sessions using the live local demo.

Target mix:

- 2 commuters
- 2 high-frequency drivers
- 1 small fleet or tradie operator
- 1 road-trip/regional driver
- 1 price-conscious but non-technical motorist

Ask:

1. Would this change where or when you fuel?
2. Is the recommendation easier than using a map?
3. Is "net saving after detour" clear?
4. What would make you distrust it?
5. What minimum saving is worth a detour?
6. What alert would be useful enough to keep enabled?
7. Would you enter tank level manually?
8. Would you save a regular route?
9. Would loyalty/fuel-card settings matter?
10. Would you pay, tolerate partner offers, or expect it free?

Evidence to capture:

- quote
- route type
- fuel type
- whether top recommendation felt actionable
- saving threshold
- trust concern
- requested missing feature
- willingness to use weekly

## Decision Gates

Continue to app MVP if:

- users understand the recommendation without explanation
- at least half say it would change a real fuelling decision
- commuters want saved-route alerts
- high-frequency drivers care about net saving after detour
- users trust the source/freshness display
- API.NSW confirms public/commercial use path

Pause or pivot if:

- users still prefer a map-first workflow
- savings feel too small to matter
- trust concerns dominate
- API.NSW terms block commercial/public use
- other-state data access becomes too fragmented for launch

## Current Best Next Move

1. Rotate the API.NSW secret.
2. Send `docs/03-provider-data/evidence/API-NSW-SUPPORT-NOTE.md`.
3. Run validation sessions using `docs/04-validation-evidence/VALIDATION-DEMO-PACK.md`.
4. Do not build new features until the first validation notes are captured.
5. After validation, decide between:
   - mobile MVP design
   - fleet-lite validation
   - stronger cycle-alert model
   - broader data-source expansion

## Bottom Line

Fuel Path is most promising as a calm, trusted, route-aware decision engine.

The product should be judged on one question:

> Did it help a driver make a better fuel decision with less effort?

If yes, the app, alerts, fleet layer and offers can grow from there.

If no, more data and more maps will not save it.
