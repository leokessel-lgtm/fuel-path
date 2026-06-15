# Address Lookup Providers

## Current State

`/api/geocode` now has a backend provider adapter.

Supported providers:

- `auto`
- `google`
- `mapbox`
- `here`
- `geoapify`
- `nominatim`

Default local validation remains `nominatim` unless `FUEL_PATH_GEOCODE_PROVIDER` is set.

## Environment Variables

```sh
FUEL_PATH_GEOCODE_PROVIDER=auto
FUEL_PATH_GOOGLE_PLACES_API_KEY=
FUEL_PATH_MAPBOX_ACCESS_TOKEN=
FUEL_PATH_HERE_API_KEY=
FUEL_PATH_GEOAPIFY_API_KEY=
```

Provider aliases accepted by `/api/geocode?provider=`:

- Google: `google`, `google_places`, `google_places_autocomplete_new`
- Mapbox: `mapbox`
- HERE: `here`
- Geoapify: `geoapify`
- Nominatim: `nominatim`

## Provider Order For `auto`

When `provider=auto`, the backend chooses the first configured provider in this order:

1. Google Places
2. Mapbox
3. HERE
4. Geoapify
5. Nominatim

## Important Google Places Note

Google Places Autocomplete (New) returns place IDs, not coordinates.

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
