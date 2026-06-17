# Native Validation

Fuel Path is app-first, so iOS and Android builds need separate validation from the web preview.

## Current Status

Last local preflight: 2026-06-17.

- TypeScript: passed.
- Expo Doctor: passed, 21 of 21 checks.
- Expo dependency check: passed.
- EAS CLI: available as `eas-cli/20.2.0` when run with the repo-local npm cache.
- EAS account state: logged in as `leokessel`.
- EAS project: `@leokessel/fuel-path`, project id `240831fe-3325-4f8e-bbf5-2f4d82842f9f`.
- EAS preview env: production API URL and preview alerts validation token configured.
- Vercel production env: `ALERTS_CLIENT_WRITE_ENABLED` and `ALERTS_CLIENT_WRITE_TOKEN` configured for preview validation without reusing `ALERTS_WRITE_TOKEN`.
- Device validation: pending.
- Push-token readiness: native config now injects `extra.eas.projectId` when `EXPO_PUBLIC_EAS_PROJECT_ID`, `EAS_PROJECT_ID` or the static EAS project id is set; strict validation is blocked until the Android Maps key is present.

## Required Environment

Set the backend URL for physical device builds because phones cannot reach the Mac through `127.0.0.1`.

```sh
export EXPO_PUBLIC_FUEL_PATH_API_BASE_URL=http://YOUR-MAC-LAN-IP:4174
```

For backend push-token registration, set the EAS project id and preview-only alerts validation token before building:

```sh
export EXPO_PUBLIC_EAS_PROJECT_ID=YOUR_EAS_PROJECT_ID
export EXPO_PUBLIC_FUEL_PATH_ALERTS_VALIDATION_TOKEN=YOUR_PREVIEW_VALIDATION_TOKEN
```

The EAS project id is written into the native public config as `extra.eas.projectId`, which Expo push-token creation needs at runtime. Do not put the production `ALERTS_WRITE_TOKEN` into an `EXPO_PUBLIC_` variable; public mobile values are bundled into the app. Use a separate backend `ALERTS_CLIENT_WRITE_TOKEN` with `ALERTS_CLIENT_WRITE_ENABLED=1` for preview validation, then rotate or disable it before public release.

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
npm run native:preflight
npm_config_cache=.npm-cache npx expo-doctor
npm_config_cache=.npm-cache npx expo install --check
npm_config_cache=.npm-cache npx expo config --type public
```

Expected:

- no TypeScript errors
- `npm run native:preflight` passes in strict mode before device validation
- no Expo Doctor issues
- dependencies match Expo SDK 56
- public config shows `androidGoogleMapsApiKeyConfigured: true` when the Android Maps key is set
- public config shows `easProjectIdConfigured: true` and `extra.eas.projectId` when the EAS project id is set

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
- Expo push token is created only on a native build with notification permission and `extra.eas.projectId`.
- Backend saved-route sync registers the push token and returns `Price-triggered backend alert synced.`
- Turning the saved-route alert off disables the backend route and cancels the local reminder.
- Android 13+ shows the notification permission prompt after the `route-alerts` channel is created.

## First Baselines

Record these after the first successful preview builds:

```sh
npm run baseline:eas -- --platform android --build-id BUILD_ID --install-size-mb INSTALL_MB --download-size-mb DOWNLOAD_MB --cold-start-ms COLD_START_MS --notes "First preview APK"
npm run baseline:eas -- --platform ios --build-id BUILD_ID --install-size-mb INSTALL_MB --download-size-mb DOWNLOAD_MB --cold-start-ms COLD_START_MS --notes "First preview build"
```

Replace the placeholders with measured values before running. The records are stored in `build-baselines/eas-preview.json`; later entries warn when install or download size grows by more than 10 percent from the first platform baseline.

| Platform | Build ID | Install size | Download size | Cold start | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| iOS | Pending | Pending | Pending | Pending | Pending |
| Android | Pending | Pending | Pending | Pending | Pending |

Flag any later unexplained size growth over 10 percent.
