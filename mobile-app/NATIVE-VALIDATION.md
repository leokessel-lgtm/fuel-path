# Native Validation

Fuel Path is app-first, so iOS and Android builds need separate validation from the web preview.

## Current Status

Last reviewed: 1 July 2026, Australia/Sydney.

- TypeScript: passed.
- Expo Doctor: passed, 21 of 21 checks.
- Expo dependency check: passed.
- EAS CLI: available as `eas-cli/20.2.0` when run with the repo-local npm cache.
- EAS account state: logged in as `leokessel`.
- EAS project: `@leokessel/fuel-path`, project id `240831fe-3325-4f8e-bbf5-2f4d82842f9f`.
- EAS preview env: production API URL, preview alerts validation token and Android Maps key configured.
- Vercel production env: `ALERTS_CLIENT_WRITE_ENABLED` and `ALERTS_CLIENT_WRITE_TOKEN` configured for preview validation without reusing `ALERTS_WRITE_TOKEN`.
- iOS source-level simulator validation: passed through `npm run native:ios-validation-report` on iPhone 17 Pro / iOS 26.5 simulator, with Plan, Nearby and Account screenshots. This is Expo Go/source evidence, not signed iOS preview-build evidence.
- Android installed APK validation: the current localParity build exists, but beta readiness still needs a fresh physical-device pass for that artefact. Older Android physical evidence remains useful history only.
- Device validation: source-level iOS simulator evidence exists; fresh Android installed-build and physical-device performance evidence remain active blockers for beta readiness.
- Push-token readiness: native config injects `extra.eas.projectId` when `EXPO_PUBLIC_EAS_PROJECT_ID`, `EAS_PROJECT_ID` or the static EAS project id is set; strict preview-environment preflight now passes through `npm run native:preflight`.
- Local shell strict preflight remains blocked unless `EXPO_PUBLIC_FUEL_PATH_API_BASE_URL`, `EXPO_PUBLIC_FUEL_PATH_ALERTS_VALIDATION_TOKEN` and `FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY` are exported locally.

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
- EAS Android signing certificate SHA-1: `cbd45223bd0f8a6791c9ab9d783ff895736ac39e`
- Maps SDK for Android only

## Local Preflight

From `mobile-app/`, the plain preflight command uses the EAS preview environment because the alerts validation token and Android Maps key are stored as sensitive EAS variables:

```sh
npm run typecheck
npm run perf:deps
npm run native:preflight
npm_config_cache=.npm-cache npx expo-doctor
npm_config_cache=.npm-cache npx expo install --check
npm_config_cache=.npm-cache npx expo config --type public
```

Local machine/device readiness is separate from EAS config readiness:

```sh
npm run native:readiness
npm run native:readiness -- --strict
```

Current local machine finding:

- Android SDK tooling exists under `~/Library/Android/sdk`; `npm run native:readiness` now finds `adb` and `emulator` without requiring them on PATH.
- Android SDK Command-line Tools are installed under `~/Library/Android/sdk/cmdline-tools/latest`.
- A local Temurin JDK is available under `var/tooling/java/` and is intentionally ignored by Git; the native readiness scripts auto-detect it so `sdkmanager` and `avdmanager` work without manually exporting `JAVA_HOME`.
- Android emulator was updated from the old `x86_64` binary to native `arm64` emulator `36.6.11`.
- Android AVDs are present: `Fuel_Path_Arm64_API_35`, `Medium_Phone_API_35` and `Pixel_Tablet_API_35`.
- `Fuel_Path_Arm64_API_35` uses `system-images;android-35;google_apis;arm64-v8a`, boots headless on this Mac and is visible to `adb` as `emulator-5554`.
- Android Expo Go smoke on `Fuel_Path_Arm64_API_35` now renders the Fuel Path Plan surface after gating Android Expo Go away from the unsupported `expo-notifications` module. Screenshot evidence: `tmp/native-smoke/android-expo-go-plan-clean-20260620T110645.png`.
- Android map/UI smoke now opens the exact local Expo project URL, rejects Expo Go shell captures, captures Plan/Nearby/pan/Account screenshots and records `dumpsys gfxinfo`. Latest corrected run: `tmp/native-smoke/android-map-smoke-2026-06-20T01-21-51-852Z.md`.
- Android EAS preview build `f67da375-ad46-484d-8fc8-d5fc71a52e07` completed and was downloaded to `mobile-app/native-artifacts/fuel-path-preview-android-f67da375.apk`. The APK budget passes at 70.68 MB against the 76.29 MB native budget.
- Installed preview APK physical smoke on Pixel 9 Pro `49231FDAP0017N` now runs through `npm run native:android-performance-smoke`. Latest report: `tmp/native-smoke/android-preview-smoke-2026-06-20T20-59-06-687Z.md`, status `passed`: Plan/Nearby/pan/Account screenshots were captured, Plan/Nearby/Nearby-after-pan all report `blank=false`, there are no Maps key warning lines, and the measured pass captured 186 frames, 1 janky frame, p90 7 ms, p95 8 ms and p99 11 ms. The APK signing SHA-1 is `cbd45223bd0f8a6791c9ab9d783ff895736ac39e`.
- Android Maps key fix packet now runs through `npm run native:android-maps-key-fix`. Latest packet: `tmp/native-smoke/android-maps-key-fix-2026-06-20T03-29-43-446Z.md`, status `ready_for_cloud_fix`. It records the current APK fingerprint and latest smoke context for any future Maps key changes, and its rerun commands now follow the selected APK artifact instead of pinning an older preview.
- Native warning overlay fixed by replacing deprecated React Native `SafeAreaView` with `react-native-safe-area-context`; the corrected Android smoke no longer captures the SafeArea warning screen.
- iOS simulator control is available through full Xcode at `/Applications/Xcode.app/Contents/Developer`.
- Local shell native env values are not exported; preview EAS env still passes `npm run native:preflight`.
- Latest Android physical readiness rerun with Pixel 9 Pro connected passes Android device detection. Current-build physical performance still needs to be rerun against the latest localParity APK.
- Latest Android ARM64 AVD setup plan: `npm run native:android-avd-plan` passes SDK root, Command-line Tools, Android 35 platform, Android 35 ARM64 image, ARM64-compatible AVD and Android emulator checks.
- Latest iOS simulator setup plan: `npm run native:ios-simulator-plan` passes with full Xcode and an iOS 26.5 simulator runtime. The matching source-level iOS validation report is `tmp/native-smoke/ios-validation-2026-06-30T23-16-23-867Z.md`.

This means Android emulator UI/map smoke and iOS source-level simulator validation are locally available. Backend push-token delivery still needs signed native-build validation with notification permission and backend sync enabled. Full all-platform native validation remains blocked on fresh Android installed-build/physical-performance evidence and signed iOS preview/development evidence, not app code alone.

To rerun the Android side on this Mac:

The local readiness script checks whether `sdkmanager` and `avdmanager` are available, and `npm run native:android-avd-plan` prints the current boot command for the ARM64 AVD:

```sh
npm run native:android-avd-plan
npm run native:android-map-smoke
FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-preview-android-local-parity-8199f828.apk npm run native:android-preview-smoke
npm run native:android-physical-readiness
FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-preview-android-local-parity-8199f828.apk npm run native:android-performance-smoke
npm run native:android-performance-summary
FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-preview-android-local-parity-8199f828.apk npm run native:android-maps-key-fix
npm run native:blocker-packet
npm run native:readiness -- --strict
```

The local iOS planner prints the current simulator setup path:

```sh
npm run native:ios-simulator-plan
```

After capturing iOS screenshots, write the report consumed by beta readiness:

```sh
npm run native:ios-validation-report -- \
  --simulator-name "iPhone 16" \
  --simulator-runtime "iOS 18.5" \
  --plan-screenshot <path-to-plan-screenshot.png> \
  --nearby-screenshot <path-to-nearby-screenshot.png> \
  --account-screenshot <path-to-account-screenshot.png> \
  --failure-log <optional-ios-runtime-log.txt>
```

The beta gate looks for an `ios-validation-*.json` report in `tmp/native-smoke/`, or beside an explicitly supplied native blocker packet. The report must have `status: "passed"`, `platform: "ios"`, a simulator or device target, rendered Plan/Nearby/Account screens, existing screenshot evidence for those screens and no runtime failure lines. This clears source-level iOS rendering only; signed iOS preview/development evidence is still needed for notification and push-token claims.

Use `npm run native:preflight:local` only when the three native variables have already been exported in the local shell.

Expected:

- no TypeScript errors
- `npm run native:preflight` passes in strict mode before device validation
- no Expo Doctor issues
- dependencies match Expo SDK 56
- public config shows `androidGoogleMapsApiKeyConfigured: true` when the Android Maps key is set
- public config shows `easProjectIdConfigured: true` and `extra.eas.projectId` when the EAS project id is set
- `npm run native:readiness -- --strict` passes on the machine used for real device/emulator validation

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

Latest Android preview build:

- Build id: `f67da375-ad46-484d-8fc8-d5fc71a52e07`
- EAS URL: `https://expo.dev/accounts/leokessel/projects/fuel-path/builds/f67da375-ad46-484d-8fc8-d5fc71a52e07`
- Artifact: `mobile-app/native-artifacts/fuel-path-preview-android-f67da375.apk`
- Artifact SHA-256: `377c0fed4a82f4a3e0a3c57f7837fc0bc64865b52080e930ae10de807dbcd6fd`
- APK signing SHA-1: `cbd45223bd0f8a6791c9ab9d783ff895736ac39e`
- APK signing SHA-256: `8af30be0bd2ec9740cfa2ed85392a52b0bf78f61a18e4a3074068dca656ab368`
- Current blocker: this APK is historical. Build/use the latest localParity APK, then rerun installed APK smoke and physical-device performance before relying on Android native claims.
- Cloud-side handoff packet for future Maps key changes: `tmp/native-smoke/android-maps-key-fix-2026-06-20T03-29-43-446Z.md`

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

## Android Performance Capture

Run this on a mid-range Android device or a deliberately modest AVD before store or public validation claims.

Target profile:

- Android 12 or later.
- 4 GB to 6 GB RAM class.
- 60 Hz screen.
- Fresh app install, no debugger attached for the measured pass.

The physical-device performance gate is:

```sh
npm run native:android-physical-readiness
FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-preview-android-local-parity-8199f828.apk npm run native:android-performance-smoke
npm run native:android-performance-summary
```

When a phone and emulator are both visible to adb, target the phone explicitly:

```sh
FUEL_PATH_ANDROID_DEVICE_SERIAL=<adb-device-serial> \
FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-preview-android-local-parity-8199f828.apk \
npm run native:android-performance-smoke
```

These commands refuse emulator-only validation. Use `native:android-preview-smoke` for emulator render evidence only. The blocker packet distinguishes missing, unauthorised and offline physical Android devices so USB-debugging setup problems are visible in beta readiness. The summary command reviews the latest physical smoke JSON and fails unless the source is a physical Android device, the installed APK artifact is identified, adb device serial/detail is present, render status passed, performance status passed, Plan/Nearby/Nearby-after-pan map screenshots are present as actual files and non-blank, and frame metrics stay within the claim thresholds.

Latest physical-device checks on 21 June 2026 local time remain historical: `npm run native:android-physical-readiness` saw Pixel 9 Pro `49231FDAP0017N`; `npm run native:android-performance-smoke -- --artifact native-artifacts/fuel-path-preview-android-local-parity-8199f828.apk --device-serial 49231FDAP0017N` wrote `tmp/native-smoke/android-preview-smoke-2026-06-20T20-59-06-687Z.md`, status `passed`; and `npm run native:android-performance-summary` wrote `tmp/native-smoke/android-performance-summary-2026-06-20T21-12-06-531Z.md`, status `passed`. Because the later simulator report found the local parity APK was stale relative to the current HTTPS profile and app-shell changes, rerun those checks with the current localParity APK before claiming current Android readiness.

Latest iOS simulator checks on 1 July 2026 local time: `npm run native:ios-simulator-plan` passed, and `tmp/native-smoke/ios-validation-2026-06-30T23-16-23-867Z.md` passed with Plan, Nearby and Account screenshots. Treat this as source-level simulator validation, not signed preview-build or push-token evidence.

Root-level readiness check on 20 June 2026: `node mobile-app/scripts/native-device-readiness.mjs --require-physical-android` now correctly resolves `mobile-app/app.json` and passes the EAS project id check from the repo root. Android physical-readiness mode now skips iOS simulator checks by default, so this command stays focused on Android beta evidence. It still blocks on no Android target connected and no physical Android device connected; local shell env values for device API URL, preview alert token and Android Maps key remain warnings because the EAS preview environment holds the sensitive values. Run with `--include-ios` or use `npm run native:ios-simulator-plan` when the validation scope includes iOS.

Scenarios:

| Scenario | Setup | Pass target | Capture |
| --- | --- | --- | --- |
| Nearby marker render | Sydney metro, 8 km radius, default fuel | map settles without blank tiles or obvious marker lag | station count, first usable map time, visible jank |
| Pan and zoom | drag map across dense metro results for 30 seconds | no trapped panel, no uncontrolled camera jump | dropped-frame feel, touch responsiveness |
| Station select | tap 10 different markers and list rows | selected marker/list state follows tap within about 500 ms | slowest observed selection |
| Route redraw | Sylvania to Parramatta, then Sydney to Canberra | route line and ranked stops redraw without stale markers | redraw time and stale-state notes |
| Alert sync path | save route, enable alert, restart app | saved route persists and sync state is honest | push-token/backend sync status |

Record each pass in the table below. Do not mark future performance claims done without current real-device evidence for the relevant build.

| Date | Device | Build ID | Scenario | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 20 Jun 2026 | `Fuel_Path_Arm64_API_35` ARM64 AVD | Expo Go local project | Plan, Nearby, pan, Account render | Partial pass | `tmp/native-smoke/android-map-smoke-2026-06-20T01-21-51-852Z.md`; app surfaces render and no fatal logs, but Expo Go tools overlay is visible, map tiles are mostly blank beige and frame metrics are not production-like. |
| 20 Jun 2026 | `Fuel_Path_Arm64_API_35` ARM64 AVD | Android preview APK `f67da375-ad46-484d-8fc8-d5fc71a52e07` | Plan, Nearby, pan, Account render | Partial pass | `tmp/native-smoke/android-preview-smoke-2026-06-20T03-18-45-402Z.md`; installed app opens and map screenshots are non-blank with no Maps warning lines. Partial remains because post-settle `dumpsys gfxinfo` reports 75.9% janky frames and p95 125 ms. Not acceptable for performance claims. |
| 21 Jun 2026 | Pixel 9 Pro `49231FDAP0017N` | Local parity APK `fuel-path-preview-android-local-parity-8199f828.apk` | Plan, Nearby, pan, Account render and measured list/map gesture pass | Pass | `tmp/native-smoke/android-preview-smoke-2026-06-20T20-59-06-687Z.md`; 186 rendered frames, 1 janky frame, 0.5% janky, p95 8 ms, p99 11 ms, non-blank map screenshots and no Maps warning lines. Summary: `tmp/native-smoke/android-performance-summary-2026-06-20T21-12-06-531Z.md`. |

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
| Android | `fuel-path-preview-android-local-parity-8199f828.apk` | Pixel 9 Pro `49231FDAP0017N` latest local parity pass complete | 70.68 MB | Passed on physical run | Local parity APK installed; map tiles render on physical Android; performance summary passes with 186 frames, 1 janky frame and p95 8 ms. Add lower-end Android coverage before broad public performance claims. |

Flag any later unexplained size growth over 10 percent.
