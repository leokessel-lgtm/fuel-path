# Address Autocomplete Provider Decision

Last updated: 15 June 2026, Australia/Sydney

## Decision

Use **Google Places Autocomplete (New)** as the preferred production address and POI autocomplete provider for Fuel Path, delivered through the Fuel Path backend.

Keep the current Nominatim-backed `/api/geocode` endpoint for local validation only.

## Why Google First

- Fuel Path is already moving toward native maps with Google Maps on Android and Apple Maps on iOS through `react-native-maps`.
- The product needs addresses, suburbs, landmarks and POIs, not only postal addresses.
- Google Places has strong Australian POI coverage, which matters for queries such as "Sydney Opera House", shopping centres, service stations, airports and suburb names.
- Google supports session-token based autocomplete billing. The mobile app now passes session tokens through `/api/geocode`, so the backend can use the correct billing model once Google is wired.
- A single Google Cloud project can eventually cover Android maps, Places, geocoding and routing controls.

## Provider Positioning

| Provider | Role | Notes |
| --- | --- | --- |
| Google Places Autocomplete (New) | Preferred production provider | Best fit for address, suburb and POI search in a mainstream driver app. Requires billing, API restrictions, session tokens and strict field masks. |
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

Not done:

- Google Places API key and billing controls.
- Google Places Autocomplete (New) backend adapter.
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

## Sources

- Google Autocomplete session pricing: https://developers.google.com/maps/documentation/places/web-service/session-pricing
- Google Maps Platform pricing: https://mapsplatform.google.com/pricing/
- Mapbox Search Box API: https://docs.mapbox.com/api/search/search-box/
- HERE Geocoding and Search API v7: https://docs.here.com/geocoding-and-search/docs/introduction-to-here-geocoding-search-api-v7
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
