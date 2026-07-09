# Fuel Path Mobile App

First Expo / React Native shell for Fuel Path.

## What It Includes

- Nearby, Plan and Account app screens.
- Live station data via the local Fuel Path backend.
- Editable Nearby location search for address, suburb or place checks outside trip planning.
- Nearby sorting by Closest, Cheapest and Best value.
- Full-map Nearby layout with a collapsible ranked-results sheet.
- Interactive Leaflet/OpenStreetMap web preview with branded station price pins and real route geometry.
- Discount-adjusted station prices using the current demo wallet.
- Brand icons copied from the web prototype asset set.
- Session-token aware Plan Trip address lookup, ready for a production backend autocomplete provider.
- Saved commute shortcuts from Plan Trip.
- Compact local persistence for saved commutes.
- Route alert permission flow, saved-route toggles and native daily local notification scheduling.
- Web preview support for fast validation.

## Run Locally

Start the local Fuel Path API from the project root:

```sh
python3 web-demo/server.py --host 127.0.0.1 --port 4174 --env prototype/.env
```

For local web preview to use that local backend, set the public API base URL when starting Expo:

```sh
EXPO_PUBLIC_FUEL_PATH_API_BASE_URL=http://127.0.0.1:4174 npm run web -- --port 8081
```

If you leave it unset, localhost web defaults to the production API (`https://fuel-path.vercel.app`).

Start the native app preview from this folder:

```sh
npm run web -- --port 8081
```

Open:

```text
http://127.0.0.1:8081
```

## Device Testing Note

Physical phones cannot use `127.0.0.1` to reach the Mac. For Expo Go or a device build, set:

```sh
EXPO_PUBLIC_FUEL_PATH_API_BASE_URL=http://YOUR-MAC-LAN-IP:4174
```

Android emulator defaults to `http://10.0.2.2:4174`.

For Android preview builds with Google Maps, set a restricted Maps SDK for Android key before building:

```sh
export FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY=YOUR_RESTRICTED_ANDROID_MAPS_KEY
```

Before creating an EAS preview build, run the strict native validation gate:

```sh
npm run native:preflight
```

That gate checks the EAS project id, backend alert capability issuing, device-reachable API URL and Android Maps key needed for route-alert push-token validation.

See `NATIVE-VALIDATION.md` for the native build checklist, EAS commands and first build-size baseline table.

## Next Native Steps

- Validate iOS and Android preview builds using `NATIVE-VALIDATION.md`.
- Implement the Google Places Autocomplete backend adapter behind `/api/geocode`.
- Validate local saved-route notifications and Expo push-token registration on real iOS and Android builds.
- Capture first EAS preview build size baselines for the performance guardrails.
- Confirm FuelCheck commercial/public app usage rules before public release.
