# Address Autocomplete Provider Decision

Last updated: 17 June 2026, Australia/Sydney

## Decision

Use a **backend-side Australian address index based on G-NAF** as the first lookup layer for street addresses.

Use **Google Places Autocomplete (New)** as the preferred production POI, landmark and rich fuzzy-search provider later, delivered through the Fuel Path backend.

Keep the current Nominatim-backed `/api/geocode` path for local validation only and never rely on it as the primary autocomplete service.

## Why G-NAF First For Addresses

- Fuel Path is an Australia-first product and G-NAF is the authoritative national address dataset.
- Local G-NAF search avoids per-keystroke provider costs during build and test.
- Exact street-address hits can resolve without calling any external geocoder.
- The backend can label confidence honestly as `exact_address`, `address_prefix` or `address_contains`.
- The app keeps a stable `/api/geocode` contract while the backend can swap seed, SQLite or hosted provider layers.

## Why Google First

- Fuel Path is already moving toward native maps with Google Maps on Android and Apple Maps on iOS through `react-native-maps`.
- The product needs addresses, suburbs, landmarks and POIs, not only postal addresses.
- Google Places has strong Australian POI coverage, which matters for queries such as "Sydney Opera House", shopping centres, service stations, airports and suburb names.
- Google supports session-token based autocomplete billing. The mobile app now passes session tokens through `/api/geocode`, so the backend can use the correct billing model once Google is wired.
- A single Google Cloud project can eventually cover Android maps, Places, geocoding and routing controls.

## Provider Positioning

| Provider | Role | Notes |
| --- | --- | --- |
| Fuel Path G-NAF address index | First address layer | Best fit for AU street addresses during build and production. Uses local seed data now and can use a generated SQLite index from full G-NAF. |
| Google Places Autocomplete (New) | Preferred production POI provider | Best fit for suburb, landmark and POI search in a mainstream driver app. Requires billing, API restrictions, session tokens and strict field masks. |
| Mapbox Search Box | Commercial fallback | Strong developer UX and session-based Search Box flow. Worth comparing if Google costs or terms become unattractive. |
| HERE Geocoding and Search | Enterprise/fleet fallback | Good automotive/logistics fit, but likely heavier for the first consumer app slice. |
| Nominatim public API | Validation only | Useful for local testing, but not suitable for production autocomplete. |

## Architecture Rule

The mobile app must not call Google, Mapbox or HERE directly for production address search.

The app should call Fuel Path endpoints only:

- `/api/geocode` for suggestions and typed lookup
- future `/api/geocode/resolve` if a provider returns unresolved suggestion IDs

The backend should:

- hold provider API keys
- apply AU country restrictions
- query the local G-NAF address index before external providers
- skip external providers when the local index returns an exact address match
- manage provider session tokens
- restrict fields returned from provider detail calls
- cache safe non-personal lookups where provider terms allow
- expose a stable Fuel Path response shape to the app
- preserve a Nominatim/local validation mode

## Current Implementation State

Done:

- Plan Trip From and To fields already show suggestions.
- Mobile app passes a distinct session token for From and To searches.
- `/api/geocode` accepts and echoes `sessionToken`.
- `/api/status` now exposes geocoding provider metadata.
- Backend remains the only address-search surface used by the app.
- `/api/geocode` queries a local AU address-index layer before Nominatim or commercial providers.
- `87A Corea Street, Sylvania NSW 2224` and `66B Easton Avenue, Sylvania NSW 2224` are seeded local validation addresses.
- `scripts/build-gnaf-address-index.mjs` can build a SQLite address index from seed JSON or compatible G-NAF-style PSV/CSV.
- Google Places Autocomplete (New) backend adapter contract exists behind provider/key gates and is covered by mocked API tests.

Not done:

- Google Places API key and billing controls.
- Full G-NAF dataset import into a local/prod SQLite index.
- Provider detail/resolve endpoint for selected suggestions if needed.
- Cost guardrails, rate limits and monitoring.
- Device-build validation with native maps and autocomplete together.

## Billing And Safety Controls Required Before Wiring Google

- Use session tokens for autocomplete sessions.
- Terminate sessions with a details/resolve request only when the user selects a suggestion.
- Request only location fields needed for route planning.
- Restrict API keys by app/package where possible and keep server keys server-side.
- Add backend rate limits per device/session.
- Do not use Nominatim public API for production autocomplete.
- Do not send exact address searches to commercial providers when the G-NAF index already returned an exact match.

## Sources

- Google Autocomplete session pricing: https://developers.google.com/maps/documentation/places/web-service/session-pricing
- Google Maps Platform pricing: https://mapsplatform.google.com/pricing/
- Mapbox Search Box API: https://docs.mapbox.com/api/search/search-box/
- HERE Geocoding and Search API v7: https://docs.here.com/geocoding-and-search/docs/introduction-to-here-geocoding-search-api-v7
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
