# Fuel Path Web Demo

This is a local web demo for the existing route-scoring prototype.

The first viewport intentionally labels the page as a controlled internal demo. Do not remove that boundary while provider terms, iOS validation, store/privacy evidence or support readiness remain blocked. Android physical performance evidence is captured for the current preview.

It can run in two modes:

- **Sample mode:** uses synthetic local data from `prototype/data/sample-stations.json`.
- **Live NSW API mode:** uses the local server-side proxy in `web-demo/server.py`.

API.NSW credentials must stay server-side. Do not put them in browser code.

Maps run in two provider modes:

- **Google Maps:** set `FUEL_PATH_GOOGLE_MAPS_API_KEY` or `GOOGLE_MAPS_API_KEY` before starting the local proxy.
- **OpenStreetMap fallback:** used automatically when no Google Maps browser key is configured or Google Maps fails to load.

The Google Maps key is a browser key, so it is visible to the page. Restrict it in Google Cloud to the required web origins, Maps JavaScript API and Places API.

Google Maps is used as the base map in local prototype mode. Route geometry uses the local open route proxy by default to avoid surprise Google Directions/Routes API calls. To deliberately test Google Directions later, set `FUEL_PATH_GOOGLE_DIRECTIONS_ENABLED=1` or add `googleDirections=1` to the demo URL.

## Run

Sample-only static mode:

```bash
python3 -m http.server 4175
```

Open:

```text
http://127.0.0.1:4175/web-demo/
```

Privacy policy:

```text
http://127.0.0.1:4175/web-demo/privacy.html
```

Production privacy policy:

```text
https://fuel-path.vercel.app/web-demo/privacy
```

Live local proxy mode:

```bash
set -a
. prototype/.env
set +a
python3 web-demo/server.py --port 4175
```

Optional Google Maps local run:

```bash
export FUEL_PATH_GOOGLE_MAPS_API_KEY="your-restricted-browser-key"
python3 web-demo/server.py --port 4175
```

Open:

```text
http://127.0.0.1:4175/web-demo/
```

Privacy policy:

```text
http://127.0.0.1:4175/web-demo/privacy.html
```

The page will show **Live NSW API** when the local proxy is available and credentials are configured. Otherwise it falls back to sample mode.

The Account data strip will show **Google Maps** when the Google Maps browser key is active. Otherwise it shows the OpenStreetMap fallback.

## What It Shows

- decision-first trip planning with real from/to address fields, optional Google Places autocomplete and typed-address geocoding
- fuel type selector
- Account-owned vehicle profile inputs with a simple daily tank-level control in Plan Trip
- discount eligibility
- best fuel decision: fill on route, fill if convenient, wait/skip, or top up before chasing a stop
- route median and detour-adjusted saving
- pump price, your price, discount labels, why-this/why-not context and trust chips
- possible lower price where an unselected wallet program could improve the result
- saved route alert profiles for commute and safe regional validation
- live/source freshness strip
- ranked station table
- Google/OpenStreetMap route corridor visual
- real route geometry through the local proxy to open geocoding/routing for prototype validation, with Google Directions available only when explicitly enabled
- classic Near Me map with fuel, radius and brand filters
- range, freshness, closed-station and membership warnings
- debug JSON

## Live Data Path

The browser calls:

```text
/api/score
```

The local server:

- loads API.NSW credentials from environment variables
- fetches live FuelCheck data server-side
- caches the live station dataset briefly
- scores recommendations using the Python route-scoring engine
- returns only the ranked recommendation payload to the browser

For real address routing in local prototype mode, the browser calls the local server:

```text
/api/geocode
/api/route
```

These endpoints proxy typed-address geocoding and route geometry for validation when the Google Maps Demo Key renders maps but does not permit Google Directions. `/api/geocode` supports provider adapters for Google Places, Mapbox, HERE, Geoapify and Nominatim. Production routing should use a properly configured and restricted paid Google Maps Platform key or another approved routing provider.

See `../ADDRESS-LOOKUP-PROVIDERS.md` for provider env vars, fallback order and the Google Places suggest/resolve production note.

The demo is intentionally cost-aware:

- address edits mark the route as pending
- `Plan route` is the only action that resolves a typed route
- route geometry is cached for repeated checks
- fuel, tank, brand and discount changes re-score the planned route without resolving a new route

The discount wallet is deliberately conservative:

- selected programs are treated as confirmed user price adjustments
- unselected station programs are shown as possible lower prices
- possible lower prices use the best single unselected program, not stacked discounts
- pump price remains visible beside any adjusted price

Saved routes are rule-based demo profiles:

- each saved route has a usual timing, fuel type, tank threshold, minimum saving and maximum detour rule
- commute alerts only fire when saving, detour and tank rules are all met
- safe regional routes prioritise range warnings and avoid petrol-cycle claims where the cycle signal does not apply

Notification controls are preview-only in this demo. They must not imply live push delivery, cycle alerts or discount reminders before the physical-device, iOS, backend-sync and validation gates are proven.

This is still a local prototype. Confirm API.NSW usage rights, caching rules, attribution and commercial/fleet permissions before sharing a public or hosted version.

## Validation Pack

Use:

- `VALIDATION-DEMO-PACK.md`
- `API-NSW-SUPPORT-NOTE.md`
