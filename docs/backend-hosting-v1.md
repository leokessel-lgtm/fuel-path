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
  - Uses the configured provider.
  - Provider order in `auto`: Google Places, Mapbox, HERE, Geoapify, then Nominatim validation fallback.
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

Geocoding:

```text
FUEL_PATH_GEOCODE_PROVIDER=auto
FUEL_PATH_GOOGLE_PLACES_API_KEY
FUEL_PATH_MAPBOX_ACCESS_TOKEN
FUEL_PATH_HERE_API_KEY
FUEL_PATH_GEOAPIFY_API_KEY
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

Until then, native local daily reminders remain the only alert feature.

## Open Production Checks

- Confirm API.NSW public/commercial app usage.
- Confirm API.NSW caching and attribution terms.
- Confirm whether ACT records in the feed have the same usage terms as NSW records.
- Decide whether Google Places and Routes cost is acceptable for launch validation.
- Add persistent storage only when saved-route smart alerts are ready to leave the contract stage.
