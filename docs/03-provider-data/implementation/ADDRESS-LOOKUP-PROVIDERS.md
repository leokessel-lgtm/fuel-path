# Address Lookup Providers

**Classification:** source-of-truth for the current external-provider and
fallback contract. Local G-NAF and hint layers run before the selected external
provider; see `api/_geocode.js` and `api/_geocodeProviders.js`.

## Current State

`/api/geocode` now has a backend provider adapter.

Supported providers:

- `auto`
- `google`
- `addressr`
- `mapbox`
- `here`
- `geoapify`
- `nominatim`

The default request mode is `auto`. In `auto`, local G-NAF and hint layers run
first. The external fallback remains Nominatim unless paid fallback is explicitly
enabled and its configured provider is available.

## Environment Variables

```sh
FUEL_PATH_GEOCODE_PROVIDER=auto
FUEL_PATH_GOOGLE_PLACES_API_KEY=
FUEL_PATH_GEOCODE_QUOTA_DATABASE_URL=
FUEL_PATH_GOOGLE_PLACES_DAILY_CAP=25
FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED=1
FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED=1
FUEL_PATH_ADDRESSR_BASE_URL=
FUEL_PATH_ADDRESSR_RAPIDAPI_KEY=
FUEL_PATH_ADDRESSR_RAPIDAPI_HOST=addressr.p.rapidapi.com
FUEL_PATH_MAPBOX_ACCESS_TOKEN=
FUEL_PATH_HERE_API_KEY=
FUEL_PATH_GEOAPIFY_API_KEY=
```

Provider aliases accepted by `/api/geocode?provider=`:

- Google: `google`, `google_places`, `google_places_autocomplete_new`
- Addressr: `addressr`
- Mapbox: `mapbox`
- HERE: `here`
- Geoapify: `geoapify`
- Nominatim: `nominatim`

## Provider Order For `auto`

When `provider=auto`, the backend:

1. searches local G-NAF, local hints, regional hints and station matches;
2. uses the provider selected by `FUEL_PATH_PAID_GEOCODE_FALLBACK_PROVIDER` only
   when paid fallback is explicitly enabled and that provider is configured;
3. otherwise uses Nominatim as the validation fallback.

It does not select a paid provider merely because a key exists.

## Addressr Note

Addressr is a G-NAF-backed Australian address search candidate. It can run self-hosted behind `FUEL_PATH_ADDRESSR_BASE_URL`, or through RapidAPI with `FUEL_PATH_ADDRESSR_RAPIDAPI_KEY`.

The backend uses Addressr as a two-step provider:

1. `/addresses?q=` returns address labels and detail links.
2. `/addresses/{pid}` resolves detail records to coordinates when Addressr geocodes are enabled.

Addressr should be treated as an address provider, not a POI provider. Google Places remains the stronger candidate for landmarks, businesses and map-style place search.

## Important Google Places Note

Google Places Autocomplete (New) returns place IDs, not coordinates.

Do not enable paid Google Places fallback in production until all billable controls are true:

- durable quota storage is configured through `FUEL_PATH_GEOCODE_QUOTA_DATABASE_URL` or another production database URL
- `FUEL_PATH_GOOGLE_PLACES_DAILY_CAP` is a tiny validation cap, currently 25 or lower
- `FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED=1` after Google Cloud key restrictions are confirmed
- `FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED=1` after the budget alert is confirmed

The current prototype keeps the existing flat `/api/geocode` response shape by resolving each suggestion to coordinates server-side. This is useful for validation but is not the final cost-optimised production flow.

Production should move to:

1. `/api/geocode/suggest` returns prediction labels and provider IDs.
2. `/api/geocode/resolve` resolves one selected provider ID to coordinates.

That avoids resolving every visible suggestion and gives better control over Places session billing.

## Nominatim Boundary

Nominatim is validation-only here. Do not use the public Nominatim service for production mobile autocomplete or high-volume traffic.

## API Examples

```text
/api/geocode?q=Miranda%20NSW&limit=5&provider=auto
/api/geocode?q=Miranda%20NSW&limit=5&provider=mapbox
/api/geocode?q=Miranda%20NSW&limit=5&provider=geoapify
```

Response shape stays compatible with the mobile app:

```json
{
  "provider": "nominatim",
  "providerMode": "validation",
  "requestedProvider": "auto",
  "location": {
    "label": "Miranda, Sutherland Shire, New South Wales, 2228, Australia",
    "lat": -34.0335434,
    "lon": 151.1037193,
    "type": "administrative",
    "provider": "nominatim",
    "providerId": "relation:5661124"
  },
  "suggestions": []
}
```
