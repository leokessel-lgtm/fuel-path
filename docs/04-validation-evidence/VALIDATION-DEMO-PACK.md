# Fuel Path Validation Demo Pack

Last updated: 13 June 2026, Australia/Sydney

## TLDR

Fuel Path has moved from research concept to working live local prototype for NSW routes.

The current demo can:

- call API.NSW FuelCheck server-side
- keep API credentials out of the browser
- score stations near a route corridor
- rank stops by net saving after detour cost
- show route median, price freshness, range risk and top recommendation
- fall back to sample data when the local proxy is unavailable

The demo is not ready for public sharing until API.NSW confirms usage rights, caching rules, attribution and ACT coverage.

Strategic reflection:

- `docs/05-research/STRATEGIC-REFLECTION.md`

Session materials:

- `VALIDATION-SESSION-WORKBOOK.md`
- `SYNTHETIC-VALIDATION-SESSIONS.md`

## Demo URL

Local live proxy:

```text
http://127.0.0.1:4174/web-demo/
```

Run command:

```bash
set -a
. prototype/.env
set +a
python3 web-demo/server.py --port 4174
```

Sample-only fallback:

```bash
python3 -m http.server 4173
```

```text
http://127.0.0.1:4173/web-demo/
```

## Current Evidence

Technical proof:

- Registered API.NSW credentials validated locally.
- OAuth works with `GET /oauth/client_credential/accesstoken?grant_type=client_credentials`.
- `GET /FuelPriceCheck/v1/fuel/prices` returns `stations` and `prices`.
- `GET /FuelPriceCheck/v2/fuel/prices` also validates.
- Live web demo returns scored route recommendations through `/api/score`.
- The browser receives ranked recommendations, not API.NSW credentials.

Observed live test:

- Route: Parramatta to Sydney CBD
- Fuel: U91
- Corridor: 2.5 km
- Eligible candidates: 78
- Top recommendation in the latest validation run: Metro Petroleum Croydon

Known limits:

- ACT records were not obvious in v1 or v2 validation snapshots.
- Opening hours are not confirmed from the API payload.
- Discount eligibility is still modelled, not connected to real loyalty entitlements.
- Route geometry is still a saved sample route, not live Google/Mapbox routing.
- Fuel cycle signal is currently rule-of-thumb guidance, not a trained prediction model.

## Demo Scenarios

Use the three scenario presets in the left panel:

- **Commuter:** Parramatta to Sydney CBD, U91, normal tank and tight corridor.
- **Fleet:** Penrith to Sydney CBD, diesel, larger tank and wider corridor.
- **Road trip:** Canberra to Sydney CBD, U91, lower tank and higher reserve.

For each scenario, observe:

- whether the top recommendation feels actionable
- whether the detour trade-off is easy to understand
- whether the source/freshness strip creates trust or concern
- whether the route median and net saving are clearer than a map of dots
- whether range risk changes the decision in a believable way

## User Validation Questions

Ask drivers:

1. Would this change where or when you fuel?
2. Do you trust a ranked recommendation more than a price map?
3. Is "net saving after detour" clear enough?
4. What would make you ignore the recommendation?
5. What alerts would be worth receiving?
6. How much saving would justify a detour?
7. Would you connect loyalty/fleet cards for better recommendations?
8. For commuters, should the app learn routine routes automatically?
9. For fleets, what reporting or policy controls would be needed?
10. Would you pay for this as a consumer, fleet operator, or not at all?

## Product Decision Gates

Proceed to hosted MVP only when:

- API.NSW confirms permitted public/commercial/fleet usage.
- Caching and attribution rules are clear.
- ACT coverage is either confirmed or explicitly excluded from MVP.
- API credentials have been rotated and stored outside source files.
- The live data proxy has basic request logging, rate limiting and error handling.

Proceed to mobile app design when:

- repeated route use cases test well with drivers
- users understand net saving after detour without explanation
- alerts test as useful rather than noisy
- fleet and high-frequency driver workflows show stronger willingness to pay

## MVP Shape

Recommended MVP scope:

- NSW-first
- saved home/work/common routes
- route-corridor ranking
- tank/range profile
- fuel type preference
- source freshness and confidence display
- cycle-aware fill timing for Sydney petrol users
- push alerts for saved routes
- fleet mode as a separate workflow, not mixed into consumer UX

Hold for later:

- live ACT support unless authorised feed is confirmed
- automatic loyalty account linking
- historical prediction model
- full navigation app replacement
- public crowdsourcing

## Open Risks

- API.NSW usage rights may restrict public or commercial use.
- Caching rules may limit alerting and historical trend features.
- ACT may need a separate data relationship.
- Price freshness may be uneven by station.
- Some users may care more about convenience, brand or loyalty points than net saving.
- Fleet buying decisions may depend on reporting, policy and integration features beyond route recommendations.

## Next Practical Move

Send the API.NSW support note, rotate credentials, then run 5 to 8 validation sessions using the live local demo.

Capture for each session:

- driver type
- route type
- usual fuel behaviour
- whether the top recommendation changed their decision
- minimum saving threshold
- alert preference
- trust concerns
- suggested missing features
