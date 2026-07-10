# Address Autocomplete Provider Decision

Last updated: 19 June 2026, Australia/Sydney

**Classification:** source-of-truth for address-provider selection principles.
The implementation-status section is a dated snapshot; verify current behaviour
in `api/_geocode.js`, `api/_geocodeProviders.js` and `/api/status`.

## Decision

Use a **backend-side Australian address index based on G-NAF** as the first lookup layer for street addresses.

Use **Google Places Autocomplete (New)** only as the preferred production POI, landmark and rich fuzzy-search fallback, delivered through the Fuel Path backend and gated by explicit cost controls.

Evaluate **Addressr** as a G-NAF-backed address-provider candidate before committing to a full self-hosted national G-NAF production index.

Keep the current Nominatim-backed `/api/geocode` path for local validation only and never rely on it as the primary autocomplete service.

## Why G-NAF First For Addresses

- Fuel Path is an Australia-first product and G-NAF is the authoritative national address dataset.
- Local G-NAF search avoids per-keystroke provider costs during build and test.
- Exact street-address hits can resolve without calling any external geocoder.
- The backend can label confidence honestly as `exact_address`, `address_prefix` or `address_contains`.
- The app keeps a stable `/api/geocode` contract while the backend can swap seed, SQLite or hosted provider layers.

## Why Google As Controlled Fallback

- Fuel Path is already moving toward native maps with Google Maps on Android and Apple Maps on iOS through `react-native-maps`.
- The product needs addresses, suburbs, landmarks and POIs, not only postal addresses.
- Google Places has strong Australian POI coverage, which matters for queries such as "Sydney Opera House", shopping centres, service stations, airports and suburb names.
- Google supports session-token based autocomplete billing. The mobile app now passes session tokens through `/api/geocode`, so the backend can use the correct billing model once Google is wired.
- A single Google Cloud project can eventually cover Android maps, Places, geocoding and routing controls.
- Google Places must not become the default just because a key exists. Paid fallback must require an explicit backend flag and a durable daily cap in production.

## Provider Positioning

| Provider | Role | Notes |
| --- | --- | --- |
| Fuel Path G-NAF address index | First address layer | Best fit for AU street addresses during build and production. Uses local seed data now and can use a generated SQLite index from full G-NAF. |
| Fuel Path local hints, regional gazetteer and station matches | Second local layer | Best fit for known places, streets, stations and validation scenarios without paid provider calls. |
| Google Places Autocomplete (New) | Controlled production POI fallback | Best fit for suburb, landmark and POI search in a mainstream driver app. Requires explicit paid-fallback enablement, billing controls, API restrictions, session tokens, durable daily caps and strict field masks. |
| Addressr | G-NAF-backed address provider candidate | Open-source and self-hostable, with hosted RapidAPI option. Good candidate for Australian street addresses, but not a POI/landmark replacement. Requires real matrix testing before production selection. |
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
- skip paid providers unless `FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED` is explicitly enabled
- enforce a durable daily Google fallback cap before calling Google in production
- manage provider session tokens
- restrict fields returned from provider detail calls
- cache safe non-personal lookups where provider terms allow
- expose a stable Fuel Path response shape to the app
- preserve a Nominatim/local validation mode

## Implementation Snapshot At 19 June 2026

Done:

- Plan Trip From and To fields already show suggestions.
- Mobile app passes a distinct session token for From and To searches.
- `/api/geocode` accepts and echoes `sessionToken`.
- `/api/status` now exposes geocoding provider metadata.
- Backend remains the only address-search surface used by the app.
- `/api/geocode` queries a local AU address-index layer before Nominatim or commercial providers.
- `87A Corea Street, Sylvania NSW 2224` and `66B Easton Avenue, Sylvania NSW 2224` are seeded local validation addresses.
- `scripts/build-gnaf-address-index.mjs` can build a SQLite address index from seed JSON or compatible G-NAF Core-style PSV/CSV.
- `scripts/export-gnaf-core-postgres-copy.mjs` can export active G-NAF Core rows for efficient Postgres/Neon COPY loading.
- `scripts/build-gnaf-raw-address-index.mjs` can build a local SQLite address index directly from the public raw G-NAF ZIP.
- `scripts/load-gnaf-raw-postgres.mjs` can stream the public raw G-NAF ZIP into a dedicated hosted Postgres/Neon database.
- `scripts/sql/gnaf-address-index-postgres.sql` defines the hosted production address-index table and search indexes.
- `/api/geocode` can now query a hosted Postgres G-NAF index when `FUEL_PATH_GNAF_DATABASE_URL` is configured, then fall back to SQLite or seed records.
- G-NAF Core-shaped regression tests cover unit/slash address matching and alphanumeric street-number suffixes.
- The May 2026 GDA2020 public G-NAF ZIP has been downloaded locally and indexed into `data/gnaf/build/gnaf-addresses-national.sqlite` with 16,905,824 address records. The generated data is local-only and ignored by Git.
- Google Places Autocomplete (New) backend adapter contract exists behind provider/key gates and is covered by mocked API tests.
- Google Places fallback quota can be reserved through durable Postgres storage via `FUEL_PATH_GEOCODE_QUOTA_DATABASE_URL`; production hardening fails closed if paid fallback is enabled without durable quota storage.
- Addressr backend adapter contract exists behind provider/key gates and is covered by mocked API tests.
- Rollout backlog now treats hosted G-NAF-first lookup plus controlled Google fallback as a P0 Goal 1 item.

Not done:

- Full Google Places billing controls and production enablement.
- Loading the national G-NAF address index into a hosted production database.
- Creating and configuring a dedicated hosted `FUEL_PATH_GNAF_DATABASE_URL`.
- Running the full raw public G-NAF ZIP hosted load and creating hosted search indexes.
- Provider detail/resolve endpoint for selected suggestions if needed.
- Addressr RapidAPI key or self-hosted Addressr endpoint configuration.
- Addressr 600-case address benchmark against G-NAF, Google and current Fuel Path lookup.
- Cost guardrails, rate limits and monitoring.
- Device-build validation with native maps and autocomplete together.

## G-NAF Core Operating Path

Use `GNAF-NATIONAL-ADDRESS-INDEX.md` as the implementation handrail for download, local SQLite build, Postgres/Neon load, production configuration and refresh checks.

## Rollout Plan

1. Confirm the product rule in backend status: G-NAF primary, local hints second, Google controlled fallback, Nominatim validation only.
2. Complete hosted G-NAF production infrastructure using dedicated `FUEL_PATH_GNAF_DATABASE_URL`.
3. Load and index the national G-NAF dataset on the hosted database.
4. Run hosted smoke checks for exact, prefix, unit/slash, townhouse, regional, rural and remote address searches.
5. Change auto provider mode so Google is never selected solely because a key exists.
6. Add Google fallback guards: explicit enable flag, session token requirement, AU-only requests, minimum query length, cache policy, field mask and durable daily cap.
7. Add user-facing states for exact address, broad local match, Google POI fallback, no match, fallback disabled and quota/cost cap reached.
8. Run the national lookup benchmark before production enablement: 600 addresses and 300 POIs, with characters-to-correct-suggestion and provider-call counts.
9. Deploy in stages: local, preview, production with Google fallback disabled, then optional tiny-cap Google fallback.

## Billing And Safety Controls Required Before Wiring Google

- Use session tokens for autocomplete sessions.
- Terminate sessions with a details/resolve request only when the user selects a suggestion.
- Request only location fields needed for route planning.
- Restrict API keys by app/package where possible and keep server keys server-side.
- Add backend rate limits per device/session.
- Add a durable backend daily cap and fail closed when the cap is exhausted or durable quota storage is missing in production.
- Do not use Nominatim public API for production autocomplete.
- Do not send exact address searches to commercial providers when the G-NAF index already returned an exact match.

## Sources

- Google Autocomplete session pricing: https://developers.google.com/maps/documentation/places/web-service/session-pricing
- Google Maps Platform pricing: https://mapsplatform.google.com/pricing/
- Addressr: https://github.com/mountain-pass/addressr
- Mapbox Search Box API: https://docs.mapbox.com/api/search/search-box/
- HERE Geocoding and Search API v7: https://docs.here.com/geocoding-and-search/docs/introduction-to-here-geocoding-search-api-v7
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
