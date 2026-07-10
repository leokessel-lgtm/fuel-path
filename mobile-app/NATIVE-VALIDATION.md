# Native Validation

Fuel Path is app-first, so iOS and Android builds need separate validation from the web preview.

## Current Status

Last reviewed: 8 July 2026, Australia/Sydney.

- TypeScript: passed.
- Expo Doctor: passed, 21 of 21 checks.
- Expo dependency check: passed.
- EAS CLI: available as `eas-cli/20.2.0` when run with the repo-local npm cache.
- EAS account state: logged in as `leokessel`.
- EAS project: `@leokessel/fuel-path`, project id `240831fe-3325-4f8e-bbf5-2f4d82842f9f`.
- EAS preview env: production API URL, backend alert capability issuing and Android Maps key configured.
- Vercel production env: `ALERTS_CLIENT_WRITE_ENABLED` and `ALERTS_CLIENT_WRITE_TOKEN` configured for preview validation without reusing `ALERTS_WRITE_TOKEN`.
- iOS source-level simulator validation: passed through `npm run native:ios-validation-report` on iPhone 17 Pro / iOS 26.5 simulator, with Plan, Nearby and Account screenshots. This is Expo Go/source evidence, not signed iOS preview-build evidence.
- Android local debug validation: current checkout builds and installs on Pixel 9 Pro `49231FDAP0017N` after pinning the Android wrapper to Gradle `8.14.3`; fresh evidence is `mobile-app/tmp/native-smoke/pixel-current-build-installed-20260708.png` and `.xml`.
- Android installed APK validation: physical-device smoke passed on Pixel 9 Pro `49231FDAP0017N` for EAS localParity build `81613239-1a07-4dfc-84f5-64e71c883458`, downloaded as `fuel-path-preview-android-localParity-81613239.apk`; local debug evidence is newer but is not release-equivalent.
- Device validation: source-level iOS simulator evidence exists; Android physical-device container, map/performance and EV Plan route evidence are current as of 8 July 2026.
- Push-token readiness: native config injects `extra.eas.projectId` when `EXPO_PUBLIC_EAS_PROJECT_ID`, `EAS_PROJECT_ID` or the static EAS project id is set; strict preview-environment preflight now passes through `npm run native:preflight`.
- Local shell strict preflight passes all local build/map checks when `.env.local` is loaded, but remains blocked for backend alert capability issuing unless the preview backend secret env is exported locally.

## Required Environment

Set the backend URL for physical device builds because phones cannot reach the Mac through `127.0.0.1`.

```sh
export EXPO_PUBLIC_FUEL_PATH_API_BASE_URL=http://YOUR-MAC-LAN-IP:4174
```

For backend push-token registration, set the EAS project id for the app and keep the alert capability secret in the backend environment:

```sh
export EXPO_PUBLIC_EAS_PROJECT_ID=YOUR_EAS_PROJECT_ID
export ALERTS_CLIENT_WRITE_ENABLED=1
export ALERTS_CLIENT_CAPABILITY_SECRET=YOUR_BACKEND_ONLY_CAPABILITY_SECRET
```

The EAS project id is written into the native public config as `extra.eas.projectId`, which Expo push-token creation needs at runtime. Do not put `ALERTS_WRITE_TOKEN`, `ALERTS_CLIENT_WRITE_TOKEN` or any alert capability secret into an `EXPO_PUBLIC_` variable; public mobile values are bundled into the app. The app requests a scoped alert capability from the backend, and the signing secret must stay server-side.

For Android builds using Google Maps, set a restricted Maps SDK for Android key before building:

```sh
export FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY=YOUR_RESTRICTED_ANDROID_MAPS_KEY
```

The key should be restricted to:

- package name: `com.fuelpath.app`
- EAS Android signing certificate SHA-1: `cbd45223bd0f8a6791c9ab9d783ff895736ac39e`
- Local debug signing certificate SHA-1, for local Pixel debug builds only: `5e8f16062ea3cd2c4a0d547876baa6f38cabf625`
- Maps SDK for Android only

## Local Preflight

From `mobile-app/`, the plain preflight command uses the EAS preview environment because the alert capability secret and Android Maps key are stored as sensitive EAS variables:

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
- Latest Android physical readiness rerun with Pixel 9 Pro connected passes Android device detection.
- Current checkout local Pixel debug build: `npm run android` now succeeds with `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home`, `ANDROID_SERIAL=49231FDAP0017N`, local `.env.local` loaded, and Android wrapper pinned to Gradle `8.14.3`. It installed at `2026-07-08 00:06:37` on Pixel 9 Pro `49231FDAP0017N`.
- Fresh local Pixel debug screenshot/XML: `mobile-app/tmp/native-smoke/pixel-current-build-installed-20260708.png` and `mobile-app/tmp/native-smoke/pixel-current-build-installed-20260708.xml`. The capture shows the current build on Nearby with visible Google map tiles, EV charger markers, EV charge selector, bottom sheet and bottom navigation, with no React Native warning overlay.
- Fresh local Pixel debug log caveat: `mobile-app/tmp/native-smoke/pixel-current-build-installed-20260708.log-snippet.txt` contains `GoogleCertificatesRslt` for local debug SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Because tiles rendered, this is not a current black-map failure, but the local debug Maps key restriction should include local debug SHA-1 `5e8f16062ea3cd2c4a0d547876baa6f38cabf625` if local debug builds are used for Android map validation.
- Latest Android Maps key fix packet: `tmp/native-smoke/android-maps-key-fix-2026-07-07T14-09-17-957Z.md`, status `ready_for_cloud_fix`. The packet script now falls back to `android/app/build/outputs/apk/debug/app-debug.apk` when no downloaded preview APK is available and uses Android Studio's bundled Java runtime for certificate extraction.
- Latest Android EAS localParity build: `0c679a29-86c0-4141-bffd-19b4c690485e`, completed 5 July 2026, downloaded to `mobile-app/native-artifacts/fuel-path-preview-android-localParity-0c679a29.apk`.
- Latest Android installed notification-preview APK physical smoke on Pixel 9 Pro `49231FDAP0017N`: `tmp/native-smoke/android-preview-smoke-2026-07-05T20-59-03-701Z.md`, status `passed`. Artifact `fuel-path-notifications-883d2176.apk`, package `com.fuelpath.app`, SHA-1 `cbd45223bd0f8a6791c9ab9d783ff895736ac39e`, SHA-256 `2612c6af4fe3b19ce0d01026966092e86163fb92c01d90e5ef1a7f188c171b17`. Plan, Nearby, Nearby-after-pan and Account screenshots were captured. Plan/Nearby/Nearby-after-pan map screenshots all report `blank=false`; there were no Maps key warning lines; measured frame evidence was 194 total frames, 1 janky frame, 0.5% jank, p90 7 ms, p95 9 ms and p99 22 ms. Performance summary `tmp/native-smoke/android-performance-summary-2026-07-05T21-00-11-713Z.md` passed with no blockers and matched the same source smoke report.
- The earlier root beta-readiness pass after this physical Android run is now superseded. The current gate uses `docs/02-build-release/evidence/STORE-PUBLISHING-EVIDENCE-2026-07-10.json` and is blocked by native evidence freshness/source matching, missing iOS validation, missing public store listings and missing final listing-disclosure proof. See `docs/02-build-release/CURRENT-RELEASE-DECISION.md`. Public live-region claims remain WA-only.
- Latest Android installed preview APK physical smoke on Pixel 9 Pro `49231FDAP0017N`: `tmp/native-smoke/android-preview-smoke-2026-07-05T05-44-27-665Z.md`, status `passed`. Artifact `fuel-path-preview-android-localParity-0c679a29.apk`, package `com.fuelpath.app`, SHA-1 `cbd45223bd0f8a6791c9ab9d783ff895736ac39e`, SHA-256 `8af30be0bd2ec9740cfa2ed85392a52b0bf78f61a18e4a3074068dca656ab368`. Plan, Nearby, Nearby-after-pan and Account screenshots were captured. Plan/Nearby/Nearby-after-pan map screenshots all report `blank=false`; there were no Maps key warning lines; measured frame evidence was 191 total frames, 2 janky frames, 1% jank, p90 8 ms, p95 9 ms and p99 17 ms. Performance summary `tmp/native-smoke/android-performance-summary-2026-07-05T05-45-27-984Z.md` also passed with no blockers.
- Lock-screen caveat: an earlier run of the same fresh APK, `tmp/native-smoke/android-preview-smoke-2026-07-05T04-28-44-304Z.md`, reported `partial` because the Pixel was dozing and `NotificationShade` had focus. After waking/dismissing the keyguard, the same APK passed. Treat the `partial` result as invalid smoke setup evidence, not an app render failure.
- Latest Android EV Plan native route check on Pixel 9 Pro `49231FDAP0017N`: `mobile-app/tmp/native-smoke/fuelpath-ev-route-pins-framed-20260707.png` and `mobile-app/tmp/native-smoke/fuelpath-ev-route-pins-framed-20260707.xml`. EV was selectable from `PLAN WITH` as `EV charge`; the vehicle chip displayed `EV | 400 km | Connectors not set`; Sylvania NSW and Newcastle NSW suggestions appeared; `Check route range` returned `Route charger options`, `10 options`, `178 km route. 400 km selected range`, a connector setup warning, visible charger rows with power, connector, detour estimate and navigation arrow, and native EV charger markers on the route map.
- Native route camera parity guard: `npm run test:map-camera` now verifies Android route camera points prioritise the selected EV charger before applying the native charger camera limit, so selected route chargers are not dropped from the initial fit.
- Native Plan route and alert API contract guard: `npm run test:native-api-contracts` now verifies live Plan uses combined `/api/score` with `from` and `to`, sends the active vehicle economics inputs, omits the legacy pre-built route payload, and caps dense combined route geometry to 1,200 points while preserving the first and last route point for native map rendering. `npm run test:map-camera` also verifies visible Plan results re-run when active vehicle economics or decision thresholds change, so Android does not leave a stale recommendation on screen. The API contract also verifies Android saved-route alert sync sends active vehicle and route-watch payload fields, treats disabled push delivery as a skipped remote-delivery state, and refuses to cache already-expired scoped alert capabilities.
- Native storage resilience guard: `npm run test:settings-ux` now verifies saved routes, recent locations and Home/Work saved places keep recoverable coordinate values by accepting numeric coordinate strings from persisted Android storage and normalising them back to numbers, rather than silently dropping those saved items.
- Android hardware Back guard: `npm run test:settings-ux` now verifies Settings detail screens consume hardware Back to return to Settings root, while Plan and Settings root consume hardware Back to return to the main Nearby map instead of immediately exiting the app.
- Historical Android EV Plan native route check on Pixel 9 Pro: `tmp/native-smoke/android-pixel-ev-route-result-2026-07-05.png` and `tmp/native-smoke/android-pixel-ev-route-result-2026-07-05.xml`. The same flow returned `179 km route. 400 km selected range` on the older packet.
- Latest local standalone Android APK from the current checkout: `mobile-app/native-artifacts/fuel-path-local-standalone-arm64-v8a-2026-07-07T16-35-09-516Z.apk`, 31.24 MB, SHA-256 `83790f7902c3fbd4f5540ca221956024be606824abd793387208598e7e856ebf`. It is a release-style APK with the JS bundle packaged, arm64-only for Pixel validation, and debug-signed for local validation only.
- Latest local standalone Android physical performance smoke on Pixel 9 Pro `49231FDAP0017N`: `tmp/native-smoke/android-preview-smoke-2026-07-07T15-03-36-958Z.md`, status `passed`. Plan, Nearby, Nearby-after-pan, Account and measured-frame screenshots were captured; map screens report `blank=false`; there were no Maps warning lines; measured frame evidence was 352 total frames, 3 janky frames, 0.9% jank, p90 8 ms, p95 10 ms and p99 16 ms. Summary: `tmp/native-smoke/android-performance-summary-2026-07-07T15-05-22-989Z.md`, status `passed`.
- Latest local standalone Android cold-start/lifecycle smoke on Pixel 9 Pro `49231FDAP0017N`: `tmp/native-smoke/android-cold-start-smoke-2026-07-07T16-35-25-287Z.md`, status `passed`. It installed the current local standalone APK, captured 2 of 2 fresh launches above the screenshot-size threshold, captured a foreground resume after Android Home/background, and recorded zero runtime failure lines and zero Maps warning lines. This is repeated launch and foreground-resume evidence only; it is not a deep process-death restore test.
- Latest Android physical performance coverage: `tmp/native-smoke/android-performance-coverage-2026-07-07T15-35-13-588Z.md`, status `controlled_beta_only`. The latest passing physical performance reports are all Pixel 9 Pro-class, so the evidence supports controlled beta performance only. Broad Android performance claims need at least one current lower or mid-range physical Android pass.
- Latest Android navigation intent contract: `tmp/native-smoke/android-navigation-intents-2026-07-07T16-46-29-292Z.md`, status `passed`. Android direct-station Device maps uses a native `geo:` VIEW intent, route-via-stop Device Maps and Google Maps target the Google Maps package before falling back to web, Google Maps direct navigation uses `google.navigation:`, Waze uses its package-targeted native intent, and Apple Maps remains selectable on Android as a browser handoff rather than a fake native app.
- Latest local standalone Android notification readiness on Pixel 9 Pro `49231FDAP0017N`: `tmp/native-smoke/android-notification-readiness-2026-07-07T16-25-11-110Z.md`, status `passed`. The APK packages `POST_NOTIFICATIONS`, FCM receive and boot-completed permissions, targets SDK 36, packages `extra.eas.projectId`, configures `route-alerts`, verifies backend client capability issuing without printing or storing the scoped token, confirms the selected Pixel has the package installed, observes `POST_NOTIFICATIONS` in the device package state, and verifies the installed app has the Android `route-alerts` notification channel with `Saved route alerts` name and the expected vibration pattern. The app initialises this channel when the notification handler is configured, before any saved-route alert is toggled. This does not register a real Expo push token or prove delivered push notifications; backend saved-route sync is covered by `npm run native:android-alert-sync-smoke`.
- Latest Android route-watch backend sync smoke against hosted backend: `tmp/native-smoke/android-alert-sync-smoke-2026-07-07T15-32-00-926Z.md`, status `passed`. It issued a scoped client capability, registered an Android push-device payload with a token-shaped test value, saved a temporary P95 route watch, listed it back, deleted it, and verified it was absent after cleanup. This proves the Android backend sync contract without sending a real push notification or exposing scoped capability/token values.
- Latest Android alert delivery gate check against hosted backend: `tmp/native-smoke/android-alert-delivery-gate-2026-07-07T15-31-16-938Z.md`, status `blocked_by_environment`. The backend is reachable and durable alert storage is configured, but Expo push delivery is disabled by environment gate. Android now treats an explicitly disabled remote-delivery gate as not active smart-alert delivery instead of overclaiming that remote alerts are watching.
- Native map/geocode parity evidence is guarded by `npm run native:map-geocode-parity`. By default this now requires a fresh Android Pixel evidence packet and reports the exact screenshot/XML it checked. To audit the historical 5 July packet only, run `npm run native:map-geocode-parity -- --allow-stale --screenshot ../tmp/native-smoke/android-pixel-ev-route-result-2026-07-05.png --xml ../tmp/native-smoke/android-pixel-ev-route-result-2026-07-05.xml`.
- Latest Android ARM64 AVD setup plan: `npm run native:android-avd-plan` passes SDK root, Command-line Tools, Android 35 platform, Android 35 ARM64 image, ARM64-compatible AVD and Android emulator checks.
- Latest iOS simulator setup plan: `npm run native:ios-simulator-plan` passes with full Xcode and an iOS 26.5 simulator runtime. The matching source-level iOS validation report is `tmp/native-smoke/ios-validation-2026-06-30T23-16-23-867Z.md`.

This means Android emulator UI/map smoke, current Android standalone installed-build/performance evidence, current Android notification packaging/capability evidence, Android route-watch backend sync evidence and iOS source-level simulator validation are locally available. Delivered push notifications are currently blocked by the hosted backend delivery gate and then still need an on-device route-watch flow after permission is granted. Full all-platform native validation remains blocked on signed iOS preview/development evidence, not app code alone.

To rerun the Android side on this Mac:

The local readiness script checks whether `sdkmanager` and `avdmanager` are available, and `npm run native:android-avd-plan` prints the current boot command for the ARM64 AVD:

```sh
npm run native:android-local-standalone
npm run native:android-avd-plan
npm run native:android-map-smoke
FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-local-standalone-YYYY-MM-DDTHH-MM-SS-msZ.apk npm run native:android-preview-smoke
npm run native:android-physical-readiness
FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-local-standalone-YYYY-MM-DDTHH-MM-SS-msZ.apk npm run native:android-performance-smoke
npm run native:android-performance-summary
npm run native:android-performance-coverage
FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-local-standalone-YYYY-MM-DDTHH-MM-SS-msZ.apk npm run native:android-cold-start-smoke
npm run native:android-navigation-intents
FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-local-standalone-YYYY-MM-DDTHH-MM-SS-msZ.apk npm run native:android-notification-readiness
npm run native:android-alert-sync-smoke
npm run native:android-alert-delivery-gate
FUEL_PATH_NATIVE_ARTIFACT=native-artifacts/fuel-path-local-standalone-YYYY-MM-DDTHH-MM-SS-msZ.apk npm run native:android-maps-key-fix
npm run native:map-geocode-parity
npm run native:blocker-packet
npm run native:readiness -- --strict
```

`npm run native:android-local-standalone` creates a local release-style APK with the JS bundle packaged, so it does not depend on Metro. It loads local `.env.local` values, requires `FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY`, defaults the native API base URL to `https://fuel-path.vercel.app` when not set, and writes the APK to `mobile-app/native-artifacts/fuel-path-local-standalone-*.apk`. By default it builds `arm64-v8a`, which matches the connected Pixel validation device and avoids a universal APK size penalty. Pass `-- --all-architectures` only when a universal local APK is explicitly needed. It still uses the local debug signing config, so treat it as standalone validation evidence only, not store-release signing evidence.

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
| 6 Jul 2026 | Pixel 9 Pro `49231FDAP0017N` | Notification preview APK `fuel-path-notifications-883d2176.apk` | Plan, Nearby, pan, Account render and measured list/map gesture pass | Pass | `tmp/native-smoke/android-preview-smoke-2026-07-05T20-59-03-701Z.md`; 194 rendered frames, 1 janky frame, 0.5% janky, p95 9 ms, p99 22 ms, non-blank Plan/Nearby/Nearby-after-pan map screenshots and no Maps warning lines. Summary: `tmp/native-smoke/android-performance-summary-2026-07-05T21-00-11-713Z.md`. |
| 8 Jul 2026 | Pixel 9 Pro `49231FDAP0017N` | Local debug build from current checkout | Nearby render after refreshed install | Smoke pass | `tmp/native-smoke/pixel-refreshed-plan-scoring-20260708.png` and `.xml`; installed via `npm run android`, app process alive, native map tiles render, station markers show price caps, logo badges and pointers, and XML confirms search, fuel selector, sort buttons and bottom navigation. This is render evidence, not a measured performance pass. |
| 8 Jul 2026 | `Fuel_Path_Arm64_Tablet_API_35` ARM64 tablet AVD | Local standalone APK `fuel-path-local-standalone-arm64-v8a-2026-07-07T15-00-00-286Z.apk` | Plan, Nearby, pan and Settings render | Partial pass | `tmp/native-smoke/android-preview-smoke-2026-07-07T15-57-50-094Z.md`; render passed, Plan/Nearby/Settings tab taps targeted UI labels from the accessibility dump, map screenshots were non-blank and no map warning lines were captured. Partial remains because emulator `gfxinfo` returned 0 rendered frames, so this is Android tablet render/layout evidence, not performance evidence. |
| 8 Jul 2026 | Pixel 9 Pro `49231FDAP0017N` | Local standalone APK `fuel-path-local-standalone-arm64-v8a-2026-07-07T15-00-00-286Z.apk` | Plan, Nearby, pan and Settings render with label-targeted tab taps | Partial pass | `tmp/native-smoke/android-preview-smoke-2026-07-07T16-11-37-378Z.md`; render passed, Plan/Nearby/Settings tab taps targeted UI labels from the accessibility dump, map screenshots were non-blank and no map warning lines were captured. Partial remains because Android `gfxinfo` returned 0 counted frames, but the report records 1 ViewRootImpl, 86 attached views and 8 graphics buffers, so this is current physical render-surface evidence, not a measured performance pass. |

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
| Android | `fuel-path-notifications-883d2176.apk` | Pixel 9 Pro `49231FDAP0017N` latest notification-preview pass complete | 70.82 MB | Passed on physical run | Notification preview APK installed; map tiles render on physical Android; performance summary passes with 194 frames, 1 janky frame and p95 9 ms. Add lower-end Android coverage before broad public performance claims. |

Flag any later unexplained size growth over 10 percent.
