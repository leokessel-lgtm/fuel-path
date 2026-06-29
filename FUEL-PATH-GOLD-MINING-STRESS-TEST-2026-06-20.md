# Fuel Path Gold Mining Stress Test

Date: 20 June 2026, Australia/Sydney

Mode: full-gold-mining-run

## TLDR

Fuel Path is a promising validation candidate, not a validated business yet.

The strongest opportunity is still:

> Help repeat drivers make the cheapest safe fuel decision for a real route, using their vehicle, discounts, time cost and trust constraints.

The product has unusually strong technical proof for a prototype: national lookup, provider capability states, route-field stress, trust/freshness handling, privacy preparation, and backend gates are all much further along than the market proof. The main risk is now overbuilding around a good thesis before real drivers prove that the recommendation changes behaviour.

## Recommendation

Validate, do not broaden.

Keep the next external test narrow:

1. Sydney commuters who already check fuel prices.
2. High-frequency drivers: rideshare, delivery, tradies, field workers.
3. One small fleet or fleet-lite operator.

Defer broad road-trip mode, payment, cashback, partner integrations, EV charging, community editing and full fleet admin until the first validation loop proves a repeatable user or buyer path.

## Evidence Reviewed

Local evidence:

- `PRODUCT-IDEAS.md`
- `PROJECT-GOALS-ROADMAP.md`
- `TODO.md`
- `BACKLOG-EVIDENCE-MATRIX.md`
- `VALIDATION-SYNTHESIS.md`
- `VALIDATION-PASS-2026-06-14.md`
- `SYNTHETIC-VALIDATION-SESSIONS.md`
- `fuel-path-market-research.md`
- `fuel-path-deep-international-research.md`
- `FUEL-DISCOUNTS-AND-FLEET-CARDS.md`
- `MAP-UX-COMPETITOR-FUNCTIONALITY.md`
- `docs/fuelradar-competitor-analysis-2026-06-17.md`

Current web refresh:

- NSW FuelCheck listings and official pages confirm real-time NSW/ACT prices, favourite stations, alerts and My Trip route support.
- WA FuelWatch official pages confirm next-day prices are locked for 24 hours from 6am and published from 2:30pm.
- Service Victoria and Consumer Affairs Victoria confirm Servo Saver and mandatory Victorian reporting.
- FuelRadar currently markets national live prices, fill/wait/hold calls, alerts, trip use cases and prediction-style guidance.
- App Store, Google Play, Reddit, Trustpilot and review snippets still cluster around the same pain: ads, map clutter, stale or wrong prices, closed stations, membership-only traps, trust, payment problems, and route usefulness.

## Pain Model

### Core JTBD

When a driver is about to do a normal trip, shift, school run, job route or long drive, they want to know whether it is worth filling now, waiting, or stopping on route, but existing tools mostly make them inspect a map, mentally adjust for detour, discounts and stale data, then guess.

### Pain Clusters

| Pain | Evidence strength | Fuel Path fit |
| --- | --- | --- |
| Manual price comparison | Strong | Core wedge. Existing apps train users to compare dots; Fuel Path can remove the mental maths. |
| Detour cost hidden | Strong | Strong fit. Net saving after detour is the cleanest differentiator. |
| Trust and freshness | Strong | Strong fit, but must stay humble. Stale or wrong prices can kill the product. |
| Discount complexity | Strong | Strong fit if shown as confirmed vs possible. Dangerous if eligibility is implied. |
| Saved-route habit | Medium-strong | Strong candidate for validation. Public review mentions are lower, but repeat-route behaviour is obvious and testable. |
| Price-cycle timing | Medium | Useful where evidence exists, risky if overclaimed. |
| Safe regional/range mode | Medium | Valuable, but needs opening-hours and fuel-availability evidence before it leads. |
| Fleet-lite policy | Medium | Potential payer path, but can easily sprawl into enterprise fleet software. |
| Payment/cashback | Medium | Monetisable elsewhere, but high trust/support risk. Do not lead with it. |

## Buyer And Monetisation

### Consumer

User and payer are likely the same person. The strongest paid path is not ads. It is a premium utility once behaviour is proven:

- saved commute alerts
- discount wallet
- route-specific weekly savings
- family or multi-vehicle profiles
- no-ad trusted experience

Risk: petrol savings may be too small to support a subscription unless the user is high-frequency or the alert loop becomes habit-forming.

### High-frequency Drivers

This is the best early validation segment. Fuel exposure is high, behaviour is repeated, and they can quantify value in dollars per week or per shift.

Likely monetisation:

- low-cost premium app
- pro profile with thresholds, saved routes and receipt/export later
- possible partner discount offers after trust is established

Risk: time is expensive. A cheap stop that costs a fare, job delay or delivery window is not cheap.

### Fleet-lite

This is the clearest payer path, but should stay narrow:

- approved brands/cards
- cheapest in-policy stop
- weekly simple savings/compliance report
- driver prompts, not full fleet management

Risk: full fleet software is a different product with admin, billing, cards, compliance, role management and integrations.

## Distribution Wedge

Best wedges:

1. Direct outreach to recruited commuters and high-frequency drivers using real route examples.
2. SEO/web companion pages for route examples only after the recommendation works.
3. Partner/channel tests with gig-driver, tradie, motoring club or small-business communities.
4. Fleet-lite pilots with 1-3 small operators before building admin surfaces.

Weak wedges:

- broad App Store launch
- generic "save on fuel" content
- copying map-first fuel apps
- relying on prediction as a headline before back-testing

## Risks And Governance

Fuel Path touches location, route habits, saved home/work-style places, push tokens, commercial data feeds and potentially business/fleet rules.

Risk rules:

- Do not claim public live-price readiness until provider usage, caching and attribution terms are confirmed.
- Do not imply a discount is available unless the user configured it and the station/network rule supports it.
- Do not turn prediction into a primary claim until back-testing exists.
- Do not encourage active phone use while driving; position decisions before the trip and hand off to navigation.
- Keep route/location data minimised and avoid sensitive logs.
- Keep paid Google fallback disabled until quota, key restrictions, budget alert and device validation are confirmed.

## Scorecard

Scores are conservative. Local build proof improves solvability and risk handling, but does not count as market validation.

| Idea | Score | Decision | Why |
| --- | ---: | --- | --- |
| Goal 1: Best fuel decision for this drive | 78 | validate | Strong pain, strong differentiation and strong technical proof. Still needs real behaviour-change evidence. |
| Net-savings route ranking | 82 | validate | Clearest wedge. Users already compare price and distance manually; route economics is the missing layer. |
| Trust and freshness layer | 80 | validate | Not a standalone business, but essential to make the core decision believable. |
| Smart saved-route alerts | 74 | validate | Strong habit potential for commuters/high-frequency users. Main risk is alert fatigue. |
| Discount-aware net price / wallet | 73 | validate | Strong pain and differentiation, but rules/eligibility complexity can damage trust. |
| Account preference hub | 64 | niche down | Useful support layer, not the reason to install. Keep setup light and progressive. |
| Tank range and reserve safety | 63 | research more | Important for regional/high-frequency trust, but depends on user input and station availability confidence. |
| Fleet-lite policy mode | 66 | niche down | Best payer path, but must be a narrow pilot, not enterprise fleet software. |
| Prediction and cycle guidance | 58 | research more | Market interest exists, but FuelRadar is already strong here and prediction claims need back-testing. |
| Shop before the spike | 57 | research more | Good later alert pattern in cycle markets; not the lead wedge until price history is durable. |
| Safe regional mode | 56 | research more | Worth preserving, but opening hours, fuel availability and range evidence must improve first. |
| VIC and NT provider adapters | 52 | research more | Necessary for national completeness, but access/schema blockers make this an enablement task, not a validation lever. |
| Android/iOS native validation | 60 | validate | Needed before public mobile claims. Does not prove demand, but blocks credible product testing. |
| Payment/cashback marketplace | 42 | park | High support/privacy/trust risk. Validate route decision and discounts first. |
| Community price editing | 40 | park | Existing tools already do this. Adds trust, abuse and moderation cost before the core wedge is proven. |
| EV/mixed-fleet expansion | 38 | park | Adjacent future market, but splits focus away from the petrol/diesel wedge. |

## Decision

Validate the core route-decision product now.

Do not build broader feature surface until the validation thresholds pass.

Current state:

- Technical readiness: strong for lookup, route-entry resilience and backend gates.
- Market readiness: not proven.
- Launch readiness: blocked by real validation, provider terms, native map/device validation, store contact/listing items and remaining jurisdiction blockers.

## Validation Plan

### Experiment 1: Route Decision Behaviour Test

Audience:

- 4 commuters or high-frequency drivers who already use Petrol Spy, FuelCheck, FuelRadar, NRMA, FuelWatch or similar.

Task:

- Use their real route.
- Compare their normal choice against Fuel Path's top recommendation.
- Ask whether they would actually change where or when they fuel.

Pass threshold:

- 4 of 7 total participants say the recommendation would change a real decision.
- 4 of 7 understand the recommendation without explanation.
- At least 3 participants can explain why the cheapest pump price did or did not win.

Fail threshold:

- Users still open the map and ignore the recommendation.
- Savings are usually below their action threshold.
- Trust concerns dominate.

### Experiment 2: Saved-route Alert Test

Audience:

- 4 commuters/high-frequency drivers.

Task:

- Show 5 alert examples: send alert, watch only, skip alert, quiet today, range first.
- Ask which alerts they would keep enabled.

Pass threshold:

- 3 of 4 commuter/high-frequency participants want saved-route alerts.
- Users can set a minimum saving and max detour without confusion.

Fail threshold:

- Alerts feel like generic fuel spam.
- Users do not want to save routes or thresholds.

### Experiment 3: Discount Wallet Test

Audience:

- 5 users who use at least one discount, docket, motoring club, fuel lock, Costco, gig-driver offer or fleet card.

Task:

- Ask them to configure only what they already use.
- Show pump price, confirmed price and possible lower price.

Pass threshold:

- 4 of 5 understand the difference between pump price, their price and possible lower price.
- No participant believes an unconfirmed voucher is guaranteed.

Fail threshold:

- Users do not trust inferred eligibility.
- The wallet feels like too much setup before first value.

### Experiment 4: Fleet-lite Pilot Discovery

Audience:

- 2 small operators: tradie, service business, delivery operator, or small fleet manager.

Task:

- Show "cheapest in policy" with approved brands/cards and a simple weekly report.

Pass threshold:

- 1 operator agrees to a follow-up pilot or provides concrete willingness to pay.

Fail threshold:

- They need full fleet-card integration, payroll, finance, driver management or enterprise controls before the value is useful.

## What Would Change My Mind

I would upgrade from `validate` to `build` if:

- Real sessions hit the behaviour-change thresholds.
- At least 3 users ask to keep using saved-route alerts after the session.
- At least 5 users provide real discount/wallet configurations and understand confirmed vs possible savings.
- One fleet-lite operator agrees to a pilot with a concrete route, card/policy and reporting need.
- Provider terms and native map/device validation blockers are cleared enough for a controlled beta.

I would downgrade or park the core idea if:

- Users mostly prefer map-first scanning even after seeing the recommendation.
- Typical savings are under the user's action threshold.
- Trust in price freshness or station availability cannot be solved with labels.
- Setup friction kills first use.
- Provider terms materially prevent public route scoring in the strongest launch regions.

## Priority Order

1. Run the recruited validation sessions.
2. Fix Android map key/device validation enough for credible mobile testing.
3. Confirm NSW/ACT, QLD and TAS usage/caching/attribution terms before public live-price claims.
4. Keep Discount Wallet manual and conservative.
5. Keep fleet-lite to "approved stop plus weekly report" until a buyer asks for more.
6. Defer payment, cashback, EV expansion, community price editing and broad prediction marketing.

