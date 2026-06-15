# Native Validation

Fuel Path is app-first, so iOS and Android builds need separate validation from the web preview.

## Current Status

Last local preflight: 2026-06-15.

- TypeScript: passed.
- Expo Doctor: passed, 21 of 21 checks.
- Expo dependency check: passed.
- EAS CLI: available as `eas-cli/20.1.0` when run with the repo-local npm cache.
- EAS account state: not logged in on this machine, so cloud build creation and build history checks are blocked.
- Device validation: pending.

## Required Environment

Set the backend URL for physical device builds because phones cannot reach the Mac through `127.0.0.1`.

```sh
export EXPO_PUBLIC_FUEL_PATH_API_BASE_URL=http://YOUR-MAC-LAN-IP:4174
```

For Android builds using Google Maps, set a restricted Maps SDK for Android key before building:

```sh
export FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY=YOUR_RESTRICTED_ANDROID_MAPS_KEY
```

The key should be restricted to:

- package name: `com.fuelpath.app`
- EAS Android signing certificate SHA-1
- Maps SDK for Android only

## Local Preflight

From `mobile-app/`:

```sh
npm run typecheck
npm run perf:deps
npm_config_cache=.npm-cache npx expo-doctor
npm_config_cache=.npm-cache npx expo install --check
npm_config_cache=.npm-cache npx expo config --type public
```

Expected:

- no TypeScript errors
- no Expo Doctor issues
- dependencies match Expo SDK 56
- public config shows `androidGoogleMapsApiKeyConfigured: true` when the Android Maps key is set

## Preview Builds

Log in to EAS first:

```sh
npm_config_cache=.npm-cache npx eas-cli login
```

Then build:

```sh
npm_config_cache=.npm-cache npx eas-cli build --profile preview --platform android
npm_config_cache=.npm-cache npx eas-cli build --profile preview --platform ios
```

Use the `preview` profile for internal validation. Android is configured as an APK to keep first install testing simple.

## Device Smoke Test

Run these checks on both iOS and Android:

- App opens to Nearby without a blank screen.
- Nearby map renders tiles and station price markers.
- Nearby search field is empty by default.
- Current-location icon prompts only when tapped and recentres the map after permission.
- Fuel selector changes prices without crashing.
- Plan can use current location for From after permission.
- Plan can resolve From and To, draw route geometry, and show ranked stops.
- Save commute from Plan.
- Account shows saved commute after app restart.
- Notification permission flow is honest for the platform.
- Daily local route reminder can be scheduled for a saved commute.

## First Baselines

Record these after the first successful preview builds:

| Platform | Build ID | Install size | Download size | Cold start | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| iOS | Pending | Pending | Pending | Pending | Pending |
| Android | Pending | Pending | Pending | Pending | Pending |

Flag any later unexplained size growth over 10 percent.
