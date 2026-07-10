# Fuel Discounts And Fleet Cards Research

Last researched: 13 June 2026, Australia/Sydney

## TLDR

Showing discounts inside Fuel Path search results is a strong differentiator, but only if it is done as a **net eligible price**, not a generic coupon list.

The market has many overlapping discount types:

- supermarket dockets
- app-only discounts
- motoring-club discounts
- seniors-card discounts
- energy/insurance customer offers
- gig-driver and delivery-driver offers
- member-only fuel pricing
- fuel locks
- points programs
- fleet/fuel-card negotiated rates

Most existing fuel apps show pump price first and leave users to mentally apply discounts. Fuel Path can stand out by showing:

> Best price for you, on this route, after eligible discounts and detour cost.

But eligibility is messy. Fuel Path must not imply a user can get a discount unless they have configured the membership, voucher, card or app condition.

## Product Recommendation

Build a **Discount Wallet** and use it inside ranked results.

Each result should show:

- pump price
- eligible discount applied
- adjusted price
- detour-adjusted saving
- discount condition
- expiry or once-per-day limit where relevant
- source confidence

Example:

```text
Metro Croydon
149.9 c/L pump
No eligible discount
$2.95 net saving after detour
```

```text
Ampol Foodary
168.9 c/L pump
NRMA 5c + Everyday Rewards 4c eligible
159.9 c/L adjusted
Only if voucher is available
```

## Discount Types

| Type | Examples | Can Fuel Path calculate? | Product rule |
| --- | --- | --- | --- |
| Always-on member discount | RACQ/Caltex, RAC/Caltex, RAA/Caltex, AANT/United, RACV/EG Ampol | Yes, if user has membership and station participates | Show adjusted price only for configured memberships |
| Supermarket docket | Woolworths/Everyday Rewards at EG/Ampol, Coles/Flybuys at Shell/Reddy Express | Partly | Show "eligible if voucher available"; do not assume voucher exists |
| In-store spend offer | EG $5 in-store for 4c/L, Reddy Express $20 in-store for 10c/L | Partly | Show separately because it requires extra spend |
| App/payment offer | Ampol FuelPay, Scan Pump Save, 7-Eleven Fuel Lock | Partly or no | Show as possible offer, not guaranteed net price unless user has active lock/offer |
| Energy/insurance customer offer | Ampol Energy, Origin, Budget Direct | Yes, if user has account/offer | Show only after user configures entitlement |
| Gig-driver offer | Uber Pro / Uber Eats Pro at bp | Yes, if user has driver tier | Show only in high-frequency driver profile |
| Points program | BP Rewards/Qantas, Everyday Rewards, Flybuys | Only with user-set point value | Keep separate from c/L discount unless user chooses a value |
| Member-only fuel price | Costco | Yes as eligibility filter | Default exclude or flag member-only |
| Fleet card rate | AmpolCard, BP Plus, Shell Card, WEX Motorpass, FleetCard, United Card, Metro Fuel Card, 7-Eleven Fuel Pass | Yes, if business profile includes card/rate | Show "in-policy adjusted price" and card acceptance |

## Consumer Discount Landscape

### Woolworths / Everyday Rewards / EG Ampol / Ampol

Current patterns:

- Everyday Rewards members can redeem 4c/L fuel vouchers after eligible Woolworths spend.
- EG Ampol says Everyday Rewards is accepted at all EG Ampol sites, with 1 point per dollar and 4c/L fuel discount redemption.
- EG also advertises 4c/L off when spending at least $5 in-store.
- Ampol Foodary supports Everyday Rewards at participating locations.
- Ampol app supports FuelPay and first-fill style app discounts, but says discounts cannot be stacked and best available offer is applied.
- Ampol Energy customers can save 10c/L on eligible fuels at participating Ampol locations, up to an annual litre cap, when paying through the Ampol app.

Fuel Path implication:

- Treat EG Ampol and Ampol Foodary separately.
- Everyday Rewards voucher should be `conditional_voucher`.
- EG in-store spend offer should be `requires_extra_spend`.
- Ampol app and Ampol Energy should be `app_payment_required`.
- Do not stack Ampol app discounts unless terms explicitly allow it.

Sources: [Everyday Rewards EG Ampol](https://www.everyday.com.au/rewards/partners/eg-ampol.html), [EG Rewards](https://eg-australia.com/rewards/), [Ampol Everyday Rewards](https://www.ampol.com.au/convenience/everyday-rewards), [Ampol App](https://www.ampol.com.au/app), [Ampol Energy](https://energy.ampol.com.au/campaigns/backyard).

### Coles / Flybuys / Shell / Reddy Express / OTR

Current patterns:

- Flybuys fuel dockets can provide 4c/L off Shell fuel or 8 Flybuys points per litre at Shell Reddy Express.
- Reddy Express advertises 10c/L off after spending $20 in-store.
- Reddy Express says the $20 in-store discount can stack with a Coles 4c/L docket for up to 14c/L.
- Scan Pump Save / OTR offers pay-at-pump and instant-win discounts such as 2c, 6c, 10c, 20c/L or free tank promotions, subject to promotion terms.
- Shell Card can pay in-app for Scan Pump Save but the Scan Pump Save discount may not apply on those transactions.

Fuel Path implication:

- Coles/Flybuys docket is `conditional_voucher`.
- Reddy in-store spend is `requires_extra_spend`.
- Stackable combinations must be shown only when both conditions are met.
- Scan Pump Save is not deterministic enough to show as guaranteed net price.
- Fleet cards and consumer app offers may conflict.

Sources: [Shell Flybuys digital dockets](https://www.shell.com.au/motorists/go-well-content-hub/flybuys-and-digital-fuel-dockets-all-you-need-to-know.html), [Flybuys Shell Reddy Express](https://experience.flybuys.com.au/partners/shell-reddy-express/), [Reddy Express fuel discounts](https://www.reddyexpress.com.au/fuels), [Reddy Express partners](https://www.reddyexpress.com.au/partners), [Scan Pump Save](https://scanpumpsave.com.au/), [OTR Scan Pump Save](https://www.otr.com.au/otr-app/scan-pump-save/).

### 7-Eleven

Current patterns:

- My 7-Eleven Fuel Price Lock lets users lock a local price for 7 days.
- 7-Eleven says the discount is the difference between the locked price and pump price, capped at up to 25c/L.
- Google Play listing says lock can be used at any 7-Eleven and fill up with Mobil fuel.
- There have been recent public complaints about price locks disappearing or being inaccessible during price spikes.

Fuel Path implication:

- Fuel Lock cannot be calculated from public pump price alone.
- Fuel Path can show "Fuel Lock may beat current price if you have an active lock".
- Later, allow user to manually enter active locked price and expiry.
- Trust wording matters because lock reliability complaints create user anxiety.

Sources: [My 7-Eleven FAQs](https://www.7eleven.com.au/my-7-eleven/my-7-eleven-faqs.html), [My 7-Eleven Google Play](https://play.google.com/store/apps/details?id=au.com.fuel7eleven), [News.com.au lock complaints](https://www.news.com.au/finance/money/costs/australian-motorists-blast-7eleven-after-reports-fuel-price-lock-app-disappears-during-skyrocketing-prices/news-story/c99c60471a6ee7f1f05772df2fbb03ce).

### BP Rewards / BPme

Current patterns:

- BP Rewards earns 2 points per litre on BP Ultimate Unleaded and 1 point per litre on other fuels.
- Users can choose BP Rewards or Qantas Points.
- Qantas says BP Rewards members can earn 2 Qantas Points per litre of BP Ultimate Unleaded and 1 Qantas Point per litre of other fuel.
- BPme supports payment and BP/Qantas point earning.

Fuel Path implication:

- BP Rewards is mainly a points value, not a direct c/L discount.
- Default UI should show "points earn" separately from adjusted price.
- If the user sets a point valuation, Fuel Path can calculate an equivalent value and label it clearly.

Sources: [BP Rewards](https://bprewards.com.au/), [BP Rewards about](https://bprewards.com.au/about), [Qantas BP partner page](https://www.qantas.com/au/en/frequent-flyer/partners/bp.html), [BPme](https://www.bp.com/en_au/australia/home/products-services/bpme.html).

### High-Frequency Driver And Gig Offers

Current patterns:

- Uber Pro in Australia advertises bp fuel savings and bp pulse EV charging savings by tier.
- Uber Eats Pro advertises bp fuel discounts for delivery people, also tiered.
- These offers are valuable because rideshare and delivery drivers have high fuel exposure and repeat-route behaviour.
- Recent fuel-price pressure has also led to temporary surcharges or relief-style programs in rideshare/delivery markets, but those are not station-level discounts.

Fuel Path implication:

- Add a `gig_driver_profile` option later, separate from the general consumer wallet.
- Show bp/Uber discounts only when the user identifies as eligible and selects their tier.
- Do not mix fuel surcharge income with fuel discount savings. It is income support, not a cheaper pump price.
- This segment is a strong validation group because they feel fuel-price volatility quickly and can quantify weekly savings.

Sources: [Uber Pro Australia](https://www.uber.com/au/en/drive/uber-pro/), [Uber Eats Pro Australia](https://www.uber.com/au/en/deliver/uber-eats-pro/), [Uber bp fuel discount announcement](https://www.uber.com/au/en/newsroom/bp-uber-fuel-discount-australia/), [Guardian Australia on temporary fuel surcharges](https://www.theguardian.com/australia-news/2026/apr/13/uber-fuel-surcharge-australia-petrol-prices).

### Motoring Club Discounts

| Program | Network | Published discount pattern | Notes |
| --- | --- | --- | --- |
| My NRMA | Ampol Foodary | Up to 5c/L, stackable with Everyday Rewards in some cases up to 13c/L | Not available everywhere; needs app QR code |
| RACV | EG Ampol | 5c/L standalone, stack examples up to 10c/L | Stack rules have changed over time; verify terms |
| RACQ | Caltex / Pacific Fuel Solutions | 4c/L at participating Caltex and Pacific Fuel Solutions | Max litre caps and station exclusions apply |
| RAC WA | Caltex and Better Choice | 4c/L | Max 120L per transaction |
| RAA | participating SA fuel stations / Caltex | RAA currently advertises 10c/L at participating SA stations; Caltex pages also show 4c national member discount wording | Needs station-level participation validation |
| AANT | United | Up to 8c/L at participating United stations | NT-specific member value |

Fuel Path implication:

- These are high-value for "user-specific adjusted price".
- Require a `motoring_club_memberships` wallet section.
- Station participation is the hard part. Need a participation table by brand/site.
- Always show unadjusted pump price next to member price to avoid "discount hides high base price" complaints.

Sources: [NRMA fuel benefits](https://benefits.mynrma.com.au/en/listing/fuel), [RACV fuel discount](https://www.racv.com.au/membership/member-discounts/motoring/fuel-vouchers.html), [RACQ fuel prices](https://www.racq.com.au/car/queensland-fuel-prices), [RAC WA Caltex](https://rac.com.au/membership-benefits/discounts-and-special-offers/member-benefit-caltex), [RAC WA Better Choice](https://rac.com.au/membership-benefits/discounts-and-special-offers/member-benefit-better-choice-fuel), [RAA fuel discounts](https://our.raa.com.au/membership/member-discounts-and-offers/fuel-discounts), [AANT terms PDF](https://www.aant.com.au/media/2043).

### Seniors, Community, Insurance And Energy Offers

| Offer | Network | Published value | Product notes |
| --- | --- | ---: | --- |
| United fuel discount program | United | 4c/L for eligible partners; UP Community 2c/L plus 2c/L community rebate | Many partner eligibility paths |
| NSW Seniors / Senior Savers | United | 4c/L, up to 150L once daily | Strong demographic fit |
| VIC/WA/SA Seniors | United | 4c/L via United app/card | Needs state-card eligibility |
| Budget Direct fuel app | Shell Reddy Express / participating Shell | 4c/L base for eligible customers; Budget Direct advertises up to 18c/L when combined with eligible Coles docket and Reddy in-store spend | Insurance/roadside customers; stack logic needed |
| Origin Rewards fuel offer | EG Australia | 4c/L, with additional 4c/L if $5 in-store | Energy-customer entitlement |
| Ampol Energy | Ampol Foodary | 10c/L, annual litre cap, app FuelPay required | Large discount but may expire with plan/account changes |
| Costco Fuel | Costco fuel stations | Member-only low price, not a c/L voucher | Treat as member-only pricing and route/detour check |

Fuel Path implication:

- These offers make the "discount wallet" much more valuable than a generic loyalty toggle.
- Energy/insurance offers should be `account_required`.
- Seniors/community offers should be `eligibility_required`.
- Costco should be a station eligibility filter, not a discount amount.

Sources: [United fuel discount cards](https://www.unitedpetroleum.com.au/fuel-discount-cards/), [NSW Seniors fuel discount](https://www.nsw.gov.au/media-releases/fuel-discount-helps-seniors), [VIC Seniors United](https://www.seniorsonline.vic.gov.au/united-fuel-discount), [WA Seniors United](https://www.wa.gov.au/government/announcements/wa-seniors-card-members-save-fuel), [Budget Direct Fuel Discounts](https://www.budgetdirect.com.au/existing-customers/fuel-app.html), [Origin fuel offer](https://www.originenergy.com.au/help-support/earn-rewards/origin-rewards/origin-fuel-offer), [Ampol Energy](https://energy.ampol.com.au/campaigns/backyard), [Costco Fuel](https://www.costco.com.au/fuel-station).

## Fleet And Fuel Card Landscape

### Major Fleet Cards

| Card | Network / coverage | Discount / value pattern | Controls and admin | Fuel Path opportunity |
| --- | --- | --- | --- | --- |
| AmpolCard | Ampol network | Ampol currently advertises application offers such as 8c/L for 10 months or 6c/L for 18 months, with exclusions | myAmpol, reporting, fuel selections, spend limits, odometer/PIN patterns | Good for Ampol-heavy businesses and Everyday Rewards tie-in |
| BP Plus | BP network, 1,400+ sites per Qantas page | Ongoing fuel discounts, Qantas Business Rewards earn, EV charging via bp pulse | GST substantiated statement, Xero feed, online reporting and controls | Good BP/fleet profile and Qantas points option |
| Shell Card | Shell, Reddy Express, OTR, Liberty/Shell networks | Personalised offers, Shell fuel discounts | Shell Card Portal, reports, card controls, anti-fraud settings | Useful for Viva/Shell/Reddy/OTR route filters |
| WEX Motorpass | 6,500+ fuel stations, 95% of Australian service stations | Broad acceptance, partner discounts, driver app | Spend controls, reporting, EV charging access, fees/transaction fees | Best for "accepted here" coverage logic |
| FleetCard | 6,100+ fuel sites and 6,000+ partners | Broad partner discounts, accepted across many brands | Single tax invoice, restrictions, spend controls | Fleet-lite opportunity: "cheapest in policy" |
| Fleetcare Fuel Cards | 4,500+ filling stations per Fleetcare | Discounted fuel and nationwide coverage | Consolidated monthly billing, itemised statements, reporting and e-TAG management | Good small-business fleet management comparator |
| Caltex StarCard | Caltex and StarCard merchant network | Fuel and non-fuel perks; partner offers vary | Purchase controls, perks, account portal | Relevant for RACQ/RAC/RAA and Caltex-heavy fleets |
| United Card | United network | United advertises 7c/L for first six months, then 2c/L ongoing, with card fees | Business fuel account | Useful for regional/independent fuel users |
| Metro Fuel Card | Metro network | Metro advertises 7c/L for first three months | Low fees and business account | Useful where Metro is materially cheaper on route |
| 7-Eleven Fuel Pass | 7-Eleven network | Business/fuel-card offers vary; public comparison pages show promotional discounts | Online account, card management | Good for businesses already using 7-Eleven network |
| EG Fuel Card | EG Ampol plus wider FleetCard-style acceptance through partner products | Everyday Rewards/EG stacking may apply in some products | Fleet card controls via partner platforms | Important if user already uses EG/Woolworths economics |
| IOR Diesel Network / Fuelcharge | IOR diesel stops and 130+ Fuelcharge locations | Wholesale diesel pricing, fixed weekly for IOR diesel stops | RFID/PIN tags, 24/7 unmanned diesel stops, portal reporting and account controls | Important for heavy vehicles, regional freight and diesel-only routing |
| SG Fleet fuel management | Fleet-management service rather than a retail fuel card | Pre-negotiated fuel cards and fuel management through fleet programs | Fuel usage reporting, lost/stolen card support, vehicle/fleet reporting | Relevant for enterprise buyers and salary-packaged/novated users |
| Toyota Fleet Management fuel management | Fleet-management service rather than a retail fuel card | Market-leading fuel-card options and shop-a-docket savings at Woolworths sites | Reporting, purchase restrictions, vehicle/fleet fuel management | Relevant for managed fleets, not consumer MVP |

Sources: [AmpolCard](https://www.ampol.com.au/business/products-and-services/fuel-cards/ampolcard), [BP Plus](https://www.bpplus.com.au/), [BP Plus Qantas Business Rewards](https://www.qantas.com/business-rewards/en-au/earn-points-on-business-expenses/bp), [Shell Card FAQ](https://www.vivaenergy.com.au/business/shell-card/frequently-asked-questions), [Shell Card Australia](https://www.shell.com.au/business-customers/shell-fuel-card.html), [WEX Motorpass](https://www.wexinc.com/motorpass/), [WEX locations](https://www.wexinc.com/motorpass/motorpass-locations/), [FleetCard](https://www.fleetcard.com.au/), [Fleetcare Fuel Cards](https://www.fleetcare.com.au/fuel-cards), [Caltex StarCard perks](https://www.caltex.com/au/business-solutions/starcard/caltex-starcard-perks-and-discounts.html), [United Fuel Card](https://www.unitedpetroleum.com.au/united-fuel-card/), [Metro Fuel Card](https://metropetroleum.com.au/metro-fuel-card/), [7-Eleven Fuel Pass FAQs](https://www.7eleven.com.au/fuel/7-Eleven-fuel-pass/7-eleven-fuel-pass-faqs.html), [EG Fuel Card](https://www.bfcards.com.au/egfuelcard/), [IOR Diesel Stops](https://www.ior.com.au/fuel-solutions/diesel-stops/), [IOR Fuelcharge](https://www.ior.com.au/credit-card-payment-terminals/), [SG Fleet fleet management](https://www.sgfleet.com/au/fleet-management), [Toyota Fleet Management fuel overview PDF](https://www.toyotafleetmanagement.com.au/content/dam/tfm/downloads/pdf/fleet-services/tfm043-fuel-management-overview-online-version.pdf).

### Fleet Card Pain Points

Fleet cards solve real admin problems:

- consolidated GST/tax statements
- purchase controls
- card-level fuel type and spend limits
- odometer capture
- reporting
- reduced reimbursement handling
- accepted-location management

But they create product pain:

- fees can erase savings for small operators
- discounts vary by brand, card, period and negotiated deal
- station acceptance is not universal
- payment and customer-service issues are common review themes
- some discounts do not stack with app/consumer offers
- the best "headline c/L off" may still lose if the station pump price is higher

Sources: [WEX charges](https://www.wexinc.com/motorpass/charges-explained/), [WEX comparison](https://www.wexinc.com/motorpass/compare-fuel-cards/), [FleetCard Trustpilot](https://www.trustpilot.com/review/www.fleetcard.com.au), [WEX Trustpilot](https://au.trustpilot.com/review/wexinc.com), [BP Australia ProductReview](https://www.productreview.com.au/listings/bp-australia), [AutoGuru BP Plus](https://www.autoguru.com.au/car-advice/fleet/bp-plus-fuel-card-review), [AutoGuru Shell Fuel Card](https://www.autoguru.com.au/car-advice/fleet/shell-fuel-card-review).

## Fuel Path Search Result Design

### Result Card Fields

Each station row should support:

```json
{
  "pumpCpl": 169.9,
  "eligibleDiscounts": [
    {
      "program": "My NRMA",
      "valueCpl": 5,
      "condition": "Scan My NRMA QR code",
      "confidence": "configured_user_membership"
    }
  ],
  "conditionalDiscounts": [
    {
      "program": "Everyday Rewards",
      "valueCpl": 4,
      "condition": "Requires active Woolworths fuel voucher"
    }
  ],
  "adjustedCpl": 164.9,
  "netSavingAfterDetour": 3.85,
  "warnings": [
    "Everyday voucher not confirmed",
    "Not available with selected fleet card"
  ]
}
```

### Recommended UI Labels

Use plain labels:

- `Pump price`
- `Your price`
- `Voucher needed`
- `Member price`
- `Fleet card accepted`
- `Not in your wallet`
- `May stack`
- `Cannot stack`
- `Requires in-store spend`
- `App payment required`
- `Points only`

Avoid:

- implying a discount is guaranteed when it depends on a voucher
- hiding the pump price
- mixing points and cents without explanation
- counting discounts that require extra in-store spend as free savings
- showing fleet-card prices to consumer users by default

### Three Price Tiers

Fuel Path should show three different price ideas:

1. **Pump price:** official price from FuelCheck.
2. **Your confirmed price:** discounts the user has configured and that appear eligible.
3. **Possible lower price:** conditional offers not yet confirmed, such as vouchers, in-store spend, fuel lock or random app offers.

This prevents trust damage.

## Discount Wallet Data Model

Suggested wallet categories:

```text
consumer_memberships:
  - everyday_rewards
  - flybuys
  - my_nrma
  - racv
  - racq
  - rac_wa
  - raa
  - aant
  - seniors_card
  - costco
  - uber_pro
  - uber_eats_pro

retailer_apps:
  - my_7_eleven
  - ampol_app
  - bpme
  - otr_scan_pump_save
  - united_app

account_offers:
  - ampol_energy
  - origin_rewards
  - budget_direct

fleet_cards:
  - ampolcard
  - bp_plus
  - shell_card
  - wex_motorpass
  - fleetcard
  - fleetcare
  - caltex_starcard
  - united_card
  - metro_fuel_card
  - seven_eleven_fuel_pass
  - eg_fuel_card
  - ior_diesel_network
  - sg_fleet
  - toyota_fleet_management

user_preferences:
  - point_value_bp
  - point_value_qantas
  - point_value_flybuys
  - minimum_saving_to_detour
  - maximum_detour_minutes
```

## Scoring Rules

### Base Formula

```text
adjusted_cpl = pump_cpl - confirmed_cpl_discounts
fill_saving = fill_litres * ((route_baseline_cpl - adjusted_cpl) / 100)
detour_cost = detour_fuel_litres * (adjusted_cpl / 100)
net_saving = fill_saving - detour_cost
```

### Conditional Offer Handling

- Confirmed discounts affect `adjusted_cpl`.
- Conditional discounts appear as "possible lower price".
- Points earn appears as "points value" only if user sets valuation.
- In-store spend offers should show effective value only if the user planned that spend anyway.
- Fleet card fees should not be allocated per fill unless the user chooses a business-cost mode.

### Stacking Rules

Discount stack logic needs an explicit rules table:

```text
program_a + program_b = allowed | not_allowed | unknown | conditionally_allowed
```

Examples:

- Reddy $20 in-store + Coles 4c docket: advertised stack path.
- Ampol app says best offer applied and discounts cannot be stacked.
- Some fleet card and app discounts conflict.
- RACV/Everyday/EG stacking has changed over time and needs rule refresh.

## MVP Recommendation

### Phase 1: Manual Discount Wallet

Build:

- user toggles memberships/offers
- basic c/L discounts
- station brand/network matching
- confirmed vs possible price display
- discount warnings
- no account linking

Start with:

- Everyday Rewards
- Flybuys
- My NRMA
- RACV
- RACQ/RAC/RAA/AANT as state expansion entries
- Budget Direct
- Origin
- Ampol Energy
- 7-Eleven Fuel Lock manual entry
- Costco membership flag
- AmpolCard, BP Plus, Shell Card, WEX Motorpass, FleetCard, United Card

### Phase 2: Smarter Eligibility

Add:

- voucher expiry fields
- active 7-Eleven fuel lock price
- point valuation settings
- stackability rules engine
- station participation table
- fleet policy filters
- approved brands/cards

### Phase 3: Partner Integrations

Only after validation:

- OAuth/account linking where partners allow it
- verified voucher wallet
- fleet-card acceptance feeds
- partner offer marketplace
- export/reporting for fleets

## Unique Proposition

Most fuel apps can show:

> This station is 159.9 c/L.

Fuel Path can show:

> This station is 159.9 c/L, but it is not the best for you. Your Ampol route stop is 164.9 c/L after NRMA, adds 1 minute, and saves $3.80 after detour. Your Shell option could be lower if you have an active Coles docket.

That is a meaningful product difference.

## Open Questions

1. Should discount wallet be mandatory in onboarding or prompted after first route result?
2. Should the MVP ask users to enter active vouchers manually?
3. Should fleet card mode be a separate profile type from consumer mode?
4. How often should stackability rules be refreshed?
5. Can API.NSW or station metadata identify brands precisely enough for discount matching?
6. Are any discount partners willing to provide station participation feeds?
7. How should Fuel Path value points without creating misleading savings claims?

## Next Build Implication

Do not add account integrations yet.

Add a **discount rules fixture** and update the demo search results to show:

- pump price
- adjusted price
- applied discount labels
- possible discount labels
- warnings when eligibility is unknown

This can be tested with sample rules before partner integration.
