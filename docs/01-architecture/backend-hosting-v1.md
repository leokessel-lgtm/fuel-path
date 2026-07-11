# Fuel Path Hosted Backend v1

Fuel Path's public web build now uses Vercel functions as a lean hosted backend.

The goal for v1 is live-enough product validation without building the later saved-route alert platform too early.

## Current Scope

- Keep API.NSW credentials server-side.
- Cache live fuel data before serving app requests.
- Proxy address lookup through the backend.
- Use server-side route geometry for Plan and scoring.
- Keep the decision engine behind `/api/score`.
- Expose `/api/status` so the app and smoke tests can see provider mode.
- Keep smart saved-route alerts as a backend contract only.

## Endpoints

- `/api/status`
  - Reports live credentials, cache TTL, geocoding provider, routing provider and alert readiness.
- `/api/stations`
  - Live-first station lookup when API.NSW credentials are configured.
  - Falls back to the public demo snapshot when live data is unavailable.
- `/api/geocode`
  - Uses G-NAF first for exact Australian addresses.
  - Uses local/regional gazetteer hints for known places, towns, streets and landmarks.
  - In `auto`, paid fallback stays disabled unless `FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED` and a configured provider are present.
  - Google Places is the recommended paid fallback, but it must stay behind session tokens, a tiny daily cap, durable quota storage, restricted API keys and budget-alert evidence.
  - Nominatim remains validation fallback only.
- `/api/route`
  - Uses Google Routes if configured.
  - Falls back to OSRM validation routing.
- `/api/score`
  - Scores stations against route geometry, discounts, freshness and detour cost.
- `/api/alerts`
  - Contract marker only.
  - Returns `501` for smart alert registration until storage, scheduling and push tokens exist.

## Required Production Env Vars

Minimum live fuel setup:

```text
NSW_FUEL_API_KEY
NSW_FUEL_API_SECRET
NSW_FUEL_TOKEN_URL
NSW_FUEL_PRICES_URL
FUEL_PATH_LIVE_CACHE_SECONDS
```

Queensland production access:

```text
QLD_FUEL_API_BASE_URL
QLD_FUEL_API_TOKEN
```

South Australia production access:

```text
SA_FUEL_API_BASE_URL
SA_FUEL_API_TOKEN
```

Northern Territory production access:

```text
NT_MYFUEL_API_BASE_URL
NT_MYFUEL_TOKEN_URL
NT_MYFUEL_REFERENCE_URL
NT_MYFUEL_POSTCODE_URL
NT_MYFUEL_OUTLET_URL
NT_MYFUEL_USERNAME
NT_MYFUEL_PASSWORD
```

Geocoding:

```text
FUEL_PATH_GEOCODE_PROVIDER=auto
FUEL_PATH_GOOGLE_PLACES_API_KEY
FUEL_PATH_MAPBOX_ACCESS_TOKEN
FUEL_PATH_HERE_API_KEY
FUEL_PATH_GEOAPIFY_API_KEY
FUEL_PATH_TOMTOM_API_KEY
```

Named POI provider evaluation:

```text
npm run test:named-poi-provider-bakeoff
```

The bake-off compares Google Places, HERE and TomTom for named Plan destinations such as schools, hotels, parks, hospitals, shopping centres, airports and civic locations. It skips providers without keys, keeps Google Place Details disabled unless explicitly enabled, and only fills cost estimates when current per-1,000 pricing is provided through:

```text
FUEL_PATH_GOOGLE_PLACES_AUTOCOMPLETE_PER_1000_USD
FUEL_PATH_GOOGLE_PLACE_DETAILS_PER_1000_USD
FUEL_PATH_HERE_SEARCH_PER_1000_USD
FUEL_PATH_TOMTOM_SEARCH_PER_1000_USD
```

Routing:

```text
FUEL_PATH_ROUTE_PROVIDER=auto
FUEL_PATH_GOOGLE_ROUTES_API_KEY
```

Optional shared Google key:

```text
FUEL_PATH_GOOGLE_MAPS_API_KEY
```

Prefer narrower keys for production.

## Alert Boundary

Do not add phone-side polling.

The smart alert platform should only be enabled after:

- user account or anonymous device identity is designed
- saved routes are stored server-side
- push tokens are registered server-side
- route alert rules have quiet hours and duplicate suppression
- a scheduled backend evaluator exists
- provider and notification costs are understood

Until then, native local reminders must remain explicitly user-enabled. The default alert path is a smart saved-route watch, and daily local reminders must not be created silently. Fuel-cycle alert intelligence should run only in backend scheduled jobs and prediction collection, not phone-side background polling. Cycle-specific push delivery must stay disabled until measured prediction readiness, product copy review and the explicit cycle-alert environment gate are all clear.

## Open Production Checks

- Confirm API.NSW public/commercial app usage.
- Confirm API.NSW caching and attribution terms.
- Confirm whether ACT records in the feed have the same usage terms as NSW records.
- Decide whether Google Places and Routes cost is acceptable for launch validation, and keep Places fallback disabled until quota, cap, key restriction and budget-alert gates are proven.
- Add persistent storage only when saved-route smart alerts are ready to leave the contract stage.
