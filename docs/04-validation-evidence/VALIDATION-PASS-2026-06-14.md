# Fuel Path Validation Pass - 14 June 2026

Time: 19:08-19:16 AEST  
Type: internal prototype validation pass  
Status: completed

## Important Boundary

This was not real customer validation. It was an internal validation pass against the current prototype using the live local demo, browser interaction, API checks and mobile viewport checks.

Goal 1 is still not proven until recruited drivers test the recommendation and behaviour-change criteria in `VALIDATION-SESSION-WORKBOOK.md`.

## Environment

- Local demo: `http://127.0.0.1:4174/web-demo/`
- Route tested: `Canberra ACT` to `Sydney CBD NSW`
- Data mode: Live NSW API via local proxy
- Map mode: OpenStreetMap fallback
- Google Maps: not configured in this local run
- Fuel: U91

## Smoke Tests

Passed:

- `node --check web-demo/app.js`
- `PYTHONPATH=prototype/scripts python3 -m unittest prototype/scripts/test_score_route.py`
- `python3 -m py_compile web-demo/server.py prototype/scripts/score_route.py prototype/scripts/validate_api_nsw.py`

API status:

- Credentials configured: yes
- Default source: live
- Google Maps configured: no
- Cache: 300 seconds

## Address And Routing Checks

The local prototype currently uses:

- `/api/geocode` backed by Nominatim for typed-address geocoding
- `/api/route` backed by OSRM for route geometry

Successful geocode examples:

- `Sydney CBD NSW`
- `Canberra ACT`
- `Sydney Opera House`
- `Bondi Junction NSW`
- `Westfield Parramatta`
- `Goulburn NSW`

Successful route example:

- Sydney Opera House to Canberra Centre
- Provider: OSRM
- Distance: 283.32 km
- Duration: 207.0 min
- Route points: 2,943

Failure example:

- `zzzznotarealplace NSW`
- Result: no location found

## Goal 1 Findings

### What Passed

- Plan route CTA is visible on a 390px mobile viewport without long scrolling.
- Canberra to Sydney returns live ranked route results.
- After route planning, the map appears near the top of the mobile result state.
- Route list selection updates the selected station detail and selected map pin.
- Nearby tab behaves close to the PetrolSpy pattern:
  - map-first layout
  - floating fuel/location controls
  - floating result list
  - `Distance`, `Price`, and `km + $` sorting
- Nearby `Price` sort correctly promotes cheaper but farther stations.
- Nearby `km + $` sort returns closer value stations.
- Invalid address now blocks scoring instead of silently showing sample-corridor results.

### What Failed Or Needs Work

- Long routes can produce too many ranked cards. Canberra to Sydney returned 439 ranked stations, which creates a very long mobile page.
- The live route result exposed very stale price timestamps, for example prices more than 200 hours old. This is visible, but the recommendation still feels too confident.
- The recommendation still needs stronger treatment when the net saving is small, for example around $2.19 on a long trip.
- Account is functionally useful but too long as a mobile surface.
- Goal 2 does not fully work in live mode yet. Selecting NRMA/Ampol did not change the live route prices because live FuelCheck station payloads do not include discount eligibility.
- Goal 3 is only partially visible. Saved route alert rules exist, but the current UI mainly exposes alert status through the saved-route select title rather than a clear visible alert card.

## Trust And Safety Fix Applied

During this pass, the invalid-address path showed a major trust problem:

> When a typed route could not resolve, the app fell back to a sample corridor and still showed ranked stations.

This was fixed.

New behaviour:

- Mode changes to `Route not found`.
- Route status explains the address problem.
- No ranked stations are shown.
- Map fallback says route not found.
- Source details show `Route: Not resolved`.
- Summary says `Route not found | no stations scored`.

Files changed:

- `web-demo/app.js`
- `web-demo/index.html`

## Goal 2 Findings

The Discount Wallet concept is still strong, but the current implementation is only partly live-ready.

Current behaviour:

- Sample station fixtures can carry station-level discount objects.
- Live FuelCheck stations do not carry these discount objects.
- Therefore, selected programs do not affect most live route results.

Next implementation need:

- Add a brand/network discount rules layer on top of live station data.
- Keep pump price visible beside adjusted price.
- Show clear labels:
  - confirmed discount
  - possible discount
  - not eligible
  - eligibility unknown
- Do not infer eligibility from brand alone without a configured rule and warning.

## Goal 3 Findings

Saved route rules exist and are worth keeping.

Current behaviour:

- Saved route profile stores route, timing, fuel, tank threshold, minimum saving and maximum detour.
- Route alert logic can return statuses such as no alert, saving below threshold, or range-first.

Gap:

- The alert outcome is not visible enough in Plan.
- The Account notification controls are present, but they do not yet feel connected to a real notification outcome.

Next implementation need:

- Add a compact saved-route alert card in Plan.
- Show why an alert would or would not fire today.
- Add happy and unhappy alert test cases.

## Address API Recommendation

The current Nominatim plus OSRM path is acceptable for internal validation only. It is not the right production answer for a native app because Fuel Path needs:

- fast typeahead
- suburb, landmark and POI search
- AU restriction and location bias
- reliable place IDs
- predictable commercial terms
- mobile SDK support

Recommended next path:

1. Use Google Places Autocomplete for the next prototype if we stay with Google Maps.
2. Use Google Geocoding or Place Details only after the user selects a suggestion.
3. Keep route geometry behind the backend to control cost and avoid exposing routing strategy.
4. Compare Mapbox Search Box and HERE Geocoding/Search before committing to native app production.

Sources:

- Google Places Autocomplete: https://developers.google.com/maps/documentation/javascript/legacy/place-autocomplete
- Google Geocoding notes on ambiguous queries: https://developers.google.com/maps/documentation/geocoding/guides-v3/requests-geocoding
- Google Maps Platform pricing/free calls: https://mapsplatform.google.com/pricing/
- Mapbox Search Box API: https://docs.mapbox.com/api/search/search-box/
- Mapbox Geocoding API: https://docs.mapbox.com/api/search/geocoding/
- Mapbox Search JS pricing: https://docs.mapbox.com/mapbox-search-js/guides/pricing/
- HERE Geocoding and Search API v7: https://docs.here.com/geocoding-and-search/docs/introduction-to-here-geocoding-search-api-v7
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/

## Updated Priority Order

### P0 - Before Real Participant Sessions

1. Limit long-route ranked results to a useful decision set, with progressive expansion.
2. Make stale-price severity affect the recommendation confidence more strongly.
3. Add a visible saved-route alert card in Plan.
4. Add live brand/network discount rules for the Discount Wallet.
5. Replace free-text-only address entry with typeahead suggestions.

### P1 - Real Validation

1. Run 7 recruited sessions using the workbook.
2. Capture minimum saving threshold.
3. Capture maximum acceptable detour.
4. Capture trust threshold for stale price data.
5. Capture willingness to configure discounts and saved routes.

### P2 - Native App Transition

1. Keep web as the scoring harness.
2. Refine Plan, Nearby and Account as mobile app screens.
3. Move to Expo/React Native only after Goal 1 validation and the address/search provider decision.

## P0 Follow-up Fixes Applied

Applied after the validation pass:

- Long-route ranked results now show 8 cards by default, with progressive expansion to 20.
- Very stale live prices now downgrade the top recommendation to `Check before detouring`.
- Plan now has a visible saved-route alert card, and matching typed routes activate the right saved-route profile.
- Live FuelCheck stations now receive inferred brand/network discount rules for Everyday Rewards, Flybuys, NRMA/Ampol and Fleet card.
- Discount scoring uses the best single eligible discount rather than stacking multiple selected programs.
- From and To fields now show internal validation address suggestions from `/api/geocode?limit=5`.
- Route and Nearby labels now use concise selected-address text instead of raw geocoder display strings.

Smoke evidence after fixes:

- `node --check web-demo/app.js`
- `PYTHONPATH=prototype/scripts python3 -m unittest prototype/scripts/test_score_route.py`
- `python3 -m py_compile web-demo/server.py prototype/scripts/score_route.py prototype/scripts/validate_api_nsw.py`
- Browser validation on 390px mobile viewport confirmed Canberra to Sydney shows 8 ranked cards, visible saved-route alert status, list-to-map selection, live discount labels and address suggestion planning.
