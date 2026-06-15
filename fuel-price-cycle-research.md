# Fuel Price Cycle Research

Last researched: 13 June 2026, Australia/Sydney

## TLDR

Fuel price cycles are real in Australia, but they are narrower than many people assume.

They mainly apply to **regular unleaded petrol in Sydney, Melbourne, Brisbane, Adelaide and Perth**. ACCC says prices in those cities typically rise sharply, then fall more slowly before repeating. The cycles are driven by retailer pricing decisions, not by changes in wholesale fuel costs.

For Fuel Path:

- Use cycle logic for Sydney metro unleaded fuels first.
- Do not use cycle logic for diesel alerts.
- Do not use cycle logic for Canberra as a default, because ACCC says petrol price cycles do not occur in Canberra, Hobart and Darwin.
- Treat cycles as guidance, not certainty.
- Build alerts around confidence: "likely low", "rising now", "shop around now", "fill before next rise", not "price will definitely rise tomorrow".

## What A Petrol Price Cycle Is

ACCC describes a petrol price cycle as a movement from a low point to a high point and then down to the next low point.

The typical pattern is:

1. Prices fall gradually as retailers discount to compete.
2. One or more retailers lift prices sharply.
3. Other retailers progressively follow.
4. Prices then discount down again.

Important distinction:

- **Cycle movement:** local retailer pricing behaviour.
- **Underlying cost movement:** international benchmark prices, AUD/USD exchange rate, taxes, freight, storage, wages, rent and wholesale/retail margins.

ACCC says international benchmark prices and the Australian dollar have the most influence on the underlying fuel price Australians pay. For regular unleaded petrol, the benchmark is Singapore Mogas 95. ACCC also says benchmark price changes can take around 2 weeks to flow through Australian city supply chains, and longer in regional areas.

Sources: [ACCC what affects fuel prices](https://www.accc.gov.au/consumers/petrol-and-fuel/what-affects-fuel-prices), [ACCC petrol price cycles](https://www.accc.gov.au/consumers/petrol-and-fuel/petrol-price-cycles-in-the-5-largest-cities).

## Where Cycles Happen

| Market | Cycle status | Product implication |
| --- | --- | --- |
| Sydney | Yes | Enable cycle-aware alerts for unleaded fuels. |
| Melbourne | Yes | Useful later for national expansion. |
| Brisbane | Yes | Useful later for national expansion. |
| Adelaide | Yes | Shorter cycles, strong notification potential. |
| Perth | Yes | Highly useful because of regular weekly pattern and FuelWatch next-day price lock. |
| Canberra / ACT | No regular ACCC cycle | Use shop-around and route-corridor savings, not cycle prediction. |
| Hobart | No regular ACCC cycle | Use shop-around logic. |
| Darwin | No regular ACCC cycle | Use shop-around logic. |
| Most regional locations | Usually no cycle | Use route, freshness, availability and price-spread logic. |
| Some regional locations | Some have cycles | Enable only after local historical data proves a pattern. |
| Diesel | No petrol-style cycle | Use local spread, route economics and wholesale trend, not cycle alerts. |
| LPG | No petrol-style cycle | Use local spread and route economics. |

ACCC says buying tips are for regular unleaded petrol. The tips may also be applicable to E10, P95 and P98 because main unleaded grades tend to move similarly. ACCC says retail diesel and automotive LPG prices do not move in price cycles.

Source: [ACCC petrol price cycles](https://www.accc.gov.au/consumers/petrol-and-fuel/petrol-price-cycles-in-the-5-largest-cities).

## How Often Cycles Happen

ACCC published the following 2025 average cycle durations:

| City | 2025 average duration |
| --- | ---: |
| Sydney | around 5 weeks |
| Melbourne | around 6 weeks |
| Brisbane | around 6 and a half weeks |
| Adelaide | around 2 and a half weeks |
| Perth | around 1 week |

The cycle length varies by city and over time. ACCC also notes that historical data can only indicate or suggest future cheap and expensive days. It is not a guarantee.

Source: [ACCC petrol price cycles](https://www.accc.gov.au/consumers/petrol-and-fuel/petrol-price-cycles-in-the-5-largest-cities).

## Predictability

| Signal | Predictability | Why |
| --- | --- | --- |
| Perth weekly low/high | High | Recent ACCC tables show a 7-day pattern, with lows on Tuesday and highs on Wednesday. WA FuelWatch also publishes tomorrow's prices from 2:30pm and locks them for 24 hours from 6am. |
| Sydney broad cycle phase | Medium | The general pattern is visible, but cycles are multi-week and variable. ACCC says use historical data as a guide only. |
| Sydney exact trough day | Low to medium | The low point can be inferred late in the discounting phase, but exact timing is uncertain. |
| Sydney price-rise detection | Medium to high | ACCC says prices in Sydney, Melbourne and Brisbane can take up to 2 weeks to move from low to high, giving motorists time to notice and shop around. Fuel Path can detect early rises at some retailers. |
| Adelaide broad cycle phase | Medium to high | Shorter cycles create more frequent lows, but timing can still vary. |
| Diesel movement | Low as a cycle | Diesel does not follow petrol-style cycles. Use local station spread and underlying market trend instead. |
| Canberra cycle prediction | Low | ACCC says petrol price cycles do not occur in Canberra. |
| Public holiday price rise | Low as a separate signal | ACCC says average public holiday increases were no larger than usual cycle increases in the five largest cities. |

Sources: [ACCC petrol price cycles](https://www.accc.gov.au/consumers/petrol-and-fuel/petrol-price-cycles-in-the-5-largest-cities), [ACCC tools to save money on fuel](https://www.accc.gov.au/media-release/there-are-tools-available-to-save-money-on-fuel), [WA FuelWatch](https://www.consumerprotection.wa.gov.au/fuelwatch-and-fuel-prices).

## Why Cycles Are Hard To Predict

1. Not every retailer participates in the cycle.
2. Retailers do not all raise prices at the same time.
3. Sydney, Melbourne and Brisbane cycles have become longer in recent years.
4. Wholesale and global price changes can shift the whole price level while local cycles continue.
5. Local competition varies by suburb and corridor.
6. User fuel type matters. Diesel and LPG are different.
7. Regional locations can behave differently from capital city averages.

ACCC reported that from 2018 to 2023, average cycle duration in Sydney, Melbourne and Brisbane increased from around 4 weeks to around 7 weeks, making timing harder. But ACCC also said motorists can still save because many retailers do not increase at once, and apps can help find stations that have not yet lifted prices.

Source: [ACCC tools to save money on fuel](https://www.accc.gov.au/media-release/there-are-tools-available-to-save-money-on-fuel).

## Savings Potential

ACCC analysis for 2023 estimated that a motorist filling 50 litres of regular unleaded weekly, buying near cycle lows and shopping around, could have saved:

| City | Estimated 2023 annual saving |
| --- | ---: |
| Perth | around $740 |
| Adelaide | around $486 |
| Sydney | around $407 |
| Melbourne | around $333 |
| Brisbane | around $242 |

These are estimates, not promises. They show that timing plus shopping around can matter, especially for commuters and high-frequency drivers.

Source: [ACCC tools to save money on fuel](https://www.accc.gov.au/media-release/there-are-tools-available-to-save-money-on-fuel).

## NSW And ACT Implications

### NSW

Sydney is the key launch market for cycle-aware alerts.

FuelCheck price history datasets are especially useful because they provide station-level NSW historical prices. ACCC used FuelCheck NSW price history to analyse brand-level behaviour in Sydney. Data.NSW resources include fields such as service station name, address, suburb, postcode, brand, fuel code, price updated date and price.

That means Fuel Path can train a NSW-specific cycle model using public historical data before relying on live prediction.

Useful first data source:

- [Data.NSW FuelCheck dataset](https://data.nsw.gov.au/data/dataset/fuel-check)
- [FuelCheck Price History June 2025 example](https://data.nsw.gov.au/data/dataset/fuel-check/resource/df5c9553-433c-4a90-a5a9-de19ecc543f6)

### ACT

FuelCheck includes ACT station coverage, but ACCC says petrol price cycles do not occur in Canberra. For ACT users, Fuel Path should focus on:

- current cheapest route stop
- fuel type availability
- station freshness
- discount eligibility
- whether it is worth detouring before crossing into NSW

Do not show ACT users cycle alerts unless historical local data later proves a real pattern.

## How Fuel Path Should Model Cycles

### Phase 1: Rule-Based Cycle Awareness

Start with simple, explainable signals:

- current corridor average versus 7-day, 14-day, 30-day and 45-day local average
- current cheapest reachable station versus recent low
- share of stations on route that have started rising
- largest brand/station jump in the last 24-48 hours
- user's tank range and regular commute timing
- whether ACCC buying tip says prices are decreasing, increasing or near low/high

Example outputs:

- "Prices on your route are still falling. Fill only if you need to."
- "Several stations near your route have jumped. Fill at one that has not moved yet."
- "Your route is near a recent low. Worth filling before the next commute."
- "No cycle signal for diesel. Here is the cheapest worthwhile stop on your route."

### Phase 2: Corridor-Level Prediction

After enough history:

- Detect trough candidates.
- Detect first movers that trigger a likely rising phase.
- Estimate probability of a material rise in the next 24, 48 and 72 hours.
- Run this per corridor, not only city-wide.
- Track fuel-grade movement separately, but share the unleaded-cycle signal across E10, U91, P95 and P98 when correlation is high.

Do not optimise only for city average. A commuter cares about their route corridor.

### Phase 3: Personalised Alerts

Alerts should combine cycle phase with the user's fuel need:

- saved commute route
- tank estimate
- usual fill size
- usual fuel type
- tolerance for detour
- preferred brands and discounts
- fleet policy where relevant

Good alert:

> Sydney U91 is near a recent low on your Parramatta-CBD route. Fill at Auburn before tomorrow's commute if you are under half a tank.

Bad alert:

> Petrol will rise tomorrow.

The second claim is too absolute.

## Product Rules

1. Use "likely", "may", "near", "rising", "falling" and "based on recent prices".
2. Do not claim certainty about future prices.
3. Do not imply public holidays cause price rises.
4. Do not apply petrol cycle alerts to diesel.
5. Do not apply Sydney-cycle logic to Canberra.
6. Show confidence and reason.
7. Let users turn cycle alerts off.
8. Pair cycle logic with route economics. A cheap low-cycle station may still not be worth the detour.

## Suggested Feature Design

### Cycle Status Card

For eligible markets:

- "Sydney U91 cycle: falling"
- "Confidence: medium"
- "Current route average: 191.4 c/L"
- "Recent route low: 187.8 c/L"
- "Best reachable station: 184.9 c/L"
- "Recommendation: fill if under half a tank"

### Alert Types

| Alert | Trigger |
| --- | --- |
| Fill soon | Route corridor price is near recent low and user is likely to need fuel. |
| Shop around now | Some retailers have jumped, but cheaper stations remain on route. |
| Wait if safe | Prices are falling and tank/range allows waiting. |
| Skip detour | Cycle saving is smaller than detour cost. |
| No cycle signal | Diesel, ACT, or unsupported regional area. |

### Data Needed

- Live FuelCheck station prices.
- FuelCheck price history by station, brand, suburb and fuel code.
- Station coordinates and route corridor mapping.
- Optional ACCC buying-tip scrape/manual ingestion, subject to terms.
- User vehicle profile and tank estimate.
- Discount eligibility.

## Bottom Line

Fuel Path should not try to be a petrol-price fortune teller.

It should be a cycle-aware route planner:

> Prices on your route are low, rising, falling or uncertain. Given your tank and trip, this is the safest saving decision.

