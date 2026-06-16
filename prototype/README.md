# Fuel Path Prototype

This is a feasibility prototype for Fuel Path's core decision engine.

It does not build a mobile app yet. It tests whether we can score stations along a route by:

- pump price
- detour distance and time
- extra fuel burned by the detour
- eligible discounts
- current tank range and reserve
- open/closed state
- price freshness
- membership-only eligibility

## Current Status

Working:

- Offline sample scoring for NSW/ACT-style corridors.
- Synthetic commuter, high-frequency and road-trip routes.
- Synthetic station dataset for repeatable tests.
- CLI output and JSON output.
- Basic tests for membership-only exclusion, discounts and range risk.
- Registered API.NSW v1 credential validation.
- Live CLI scoring against API.NSW v1 FuelPriceCheck data.
- Local web demo live scoring through a server-side proxy.
- Live Canberra/ACT station records through the local proxy.

Not yet live:

- Hosted/public live API.NSW ingestion.
- Google/Mapbox real route geometry.
- Real opening hours.
- Real discount eligibility.
- Confirmed API.NSW public/commercial usage and ACT record terms.

## API.NSW Findings

Official API.NSW pages confirm:

- Fuel API provides live pricing for NSW service stations.
- v1 endpoints return NSW data.
- v2 endpoints currently support NSW and TAS.
- Public try-it usage is limited to 5 calls per minute.
- Free registered tier is listed as 2,500 calls per month.
- OAuth client-credentials authentication is required.
- Access tokens last approximately 12 hours.
- API.NSW can vary endpoint request limits by agreement.
- Terms say use of information may be governed by conditions from the authority administering the information.

Sources:

- https://api.nsw.gov.au/Product/Index/22
- https://api.nsw.gov.au/Documentation/GenerateHar/22
- https://api.nsw.gov.au/Home/Terms

Local live-access attempt:

- Python request to the OAuth endpoint received a 403 edge response.
- Curl reached the endpoint, but the public try-it credential flow returned the submitted grant body rather than an access-token JSON payload from this runtime.
- Conclusion: do not block prototype work on public try-it credentials. Use registered API.NSW credentials for the next live-data test.

Registered credential validation:

- OAuth works with `GET /oauth/client_credential/accesstoken?grant_type=client_credentials`.
- The documented POST form-body OAuth call was echoed back by the gateway from this runtime.
- `GET /FuelPriceCheck/v1/fuel/prices` returned `stations` and `prices`.
- The live CLI route scorer successfully joined stations and prices for the sample Parramatta to Sydney CBD route.
- The local web demo server can now score live recommendations without exposing API.NSW credentials to the browser.
- Live Canberra checks through the local proxy returned ACT station records from the Fuel API payload.

## Run The Prototype

From the project root:

```bash
python3 prototype/scripts/score_route.py
```

Example commuter route:

```bash
python3 prototype/scripts/score_route.py \
  --route parramatta-to-sydney-cbd \
  --fuel U91 \
  --eligible-discounts everyday_rewards,nrma_ampol,flybuys \
  --tank-percent 45
```

Example regional/range-sensitive route:

```bash
python3 prototype/scripts/score_route.py \
  --route canberra-to-sydney-cbd \
  --fuel DL \
  --tank-litres 70 \
  --tank-percent 35 \
  --economy 9.5 \
  --reserve-km 80 \
  --eligible-discounts everyday_rewards \
  --limit 6
```

JSON output:

```bash
python3 prototype/scripts/score_route.py \
  --route parramatta-to-sydney-cbd \
  --fuel U91 \
  --json
```

Run tests:

```bash
python3 prototype/scripts/test_score_route.py
```

## Live API Mode

First validate API.NSW access without exposing secrets:

```bash
cp prototype/.env.example prototype/.env
```

Fill in `prototype/.env` locally, then run:

```bash
python3 prototype/scripts/validate_api_nsw.py --env prototype/.env
```

If validation succeeds, save a redacted sample:

```bash
python3 prototype/scripts/validate_api_nsw.py \
  --env prototype/.env \
  --save-sample prototype/data/live-sample-redacted.json
```

Validate Queensland Fuel Prices Direct Outbound API access:

```bash
python3 prototype/scripts/validate_api_qld.py --env prototype/.env
```

The scoring script also includes a live mode stub:

```bash
set -a
. prototype/.env
set +a
python3 prototype/scripts/score_route.py --live --route parramatta-to-sydney-cbd --fuel U91
```

Before relying on this:

1. Register or log in at API.NSW.
2. Subscribe to the Fuel API.
3. Confirm permitted commercial/public-app usage.
4. Confirm whether ACT records exposed through the FuelCheck feed have the same permitted usage, caching and attribution terms as NSW records.
5. Inspect the real payload and adjust `normalise_nsw_payload` if field names differ.

## Routes Included

- `parramatta-to-sydney-cbd`
- `penrith-to-sydney-cbd`
- `canberra-to-sydney-cbd`

## Discount IDs In Sample Data

- `everyday_rewards`
- `flybuys`
- `nrma_ampol`
- `fleet_card`

## What The Prototype Proves

The core product idea is feasible as an algorithm:

- A cheaper station can lose if the detour wipes out the saving.
- A lower headline price can be excluded if it is membership-only.
- A discounted station can become the best net option when the user is eligible.
- A later cheap station can be downgraded when the current tank cannot reach it with reserve.

This supports the product wedge from the research:

> decision, not dots.

## Next Build Step

Build a web demo around this engine before committing to full app UI:

- route selector
- vehicle/tank inputs
- top recommendation card
- ranked station list
- warnings for range, freshness and eligibility
- JSON panel for debugging

The web demo can use sample data first, then switch to live FuelCheck data once API.NSW credentials are confirmed.
