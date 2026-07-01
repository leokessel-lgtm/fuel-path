# Native simulator launch-readiness stress report - 1 July 2026

## Scope

This report records the Android and iOS simulator checks run after Xcode and iOS 26.5 simulator installation. The test posture was deliberately launch-week critical: prove what works, name what does not, and avoid treating Expo Go or stale APK evidence as production-grade native proof.

## Environment

- iOS simulator: iPhone 17 Pro, iOS 26.5, booted through full Xcode at `/Applications/Xcode.app/Contents/Developer`.
- Android emulator: `Fuel_Path_Arm64_API_35`, ARM64 Android 35, visible as `emulator-5554`.
- Production backend: `https://fuel-path.vercel.app`.
- Source app validation: Expo SDK 56.

## Code and configuration changes made

- Fixed iOS top safe-area handling in the app shell so the header no longer clips under the Dynamic Island/status area.
- Added a test-only `EXPO_PUBLIC_FUEL_PATH_INITIAL_TAB` switch for simulator evidence capture. If unset, the app still defaults to Nearby.
- Corrected the local parity Android build profile so future APKs use `https://fuel-path.vercel.app`, not a private HTTP LAN URL.
- Updated iOS runtime parsing in native setup/blocker scripts for Xcode 26 output, where available runtimes are not always labelled with `(available)`.

## Validation commands and results

| Check | Result | Evidence |
| --- | --- | --- |
| Mobile app verify suite | Pass | `npm run verify` in `mobile-app/` |
| EAS preview native preflight | Pass | `npm run native:preflight` |
| Strict local native readiness | Pass | `EXPO_PUBLIC_FUEL_PATH_API_BASE_URL=https://fuel-path.vercel.app EXPO_PUBLIC_FUEL_PATH_ALERTS_VALIDATION_TOKEN=local-validation-placeholder npm run native:readiness -- --strict` |
| iOS simulator setup plan | Pass | `npm run native:ios-simulator-plan` |
| iOS simulator render validation | Pass | `tmp/native-smoke/ios-validation-2026-06-30T23-16-23-867Z.md` |
| Android source-level Expo Go map smoke | Partial | `tmp/native-smoke/android-map-smoke-2026-06-30T23-12-13-493Z.md` |
| Android installed preview APK smoke | Partial | `tmp/native-smoke/android-preview-smoke-2026-06-30T22-49-34-729Z.md` |
| Fresh Android localParity EAS build | Finished | Build `4839ead1-efe2-43fa-9ab3-1a4aa192030b`; artifact `mobile-app/native-artifacts/fuel-path-preview-android-localParity-4839ead1.apk` |
| Fresh Android installed APK smoke | Partial | `tmp/native-smoke/android-preview-smoke-2026-06-30T23-33-35-695Z.md` |
| Plan route production latency budget | Pass | `tmp/plan-route-live-api-stress-2026-06-30T23-12-13-923Z.md` |
| 200 POI route journey stress | Pass | `tmp/poi-route-journey-stress-2026-06-30T23-12-15-549Z.md` |
| Beta readiness gate | Blocked | `provider_terms_not_confirmed`, `android_map_tiles_not_ready`, `physical_device_validation_missing`, `native_performance_not_claimable`, store/privacy/support blockers |
| Production smoke matrix after Plan mock-contract fix | Pass | `tmp/production-smoke-matrix-stress-2026-06-30T23-42-23-275Z.md` |

## iOS simulator findings

Status: source-level simulator validation passed.

Evidence:

- Plan: `tmp/native-smoke/ios-expo-go-plan-2026-07-01.png`
- Nearby: `tmp/native-smoke/ios-expo-go-nearby-2026-07-01.png`
- Account: `tmp/native-smoke/ios-expo-go-account-2026-07-01.png`

What worked:

- App launches through Expo Go on the iPhone 17 Pro simulator using LAN host mode.
- Apple map tiles render.
- Nearby station pins render.
- Plan, Nearby and Account screens render and are readable.
- The safe-area patch fixed the header clipping under the Dynamic Island.
- iOS validation report passes with Plan, Nearby and Account screenshots.

Brutal critique:

- This is still Expo Go evidence, not a signed iOS preview build.
- Expo Go’s floating tools button contaminates screenshots and partially covers the vehicle pill. It should not exist in a signed preview build, but it means Expo Go screenshots are not final UX evidence.
- Notification and push-token behaviour cannot be validated honestly in Expo Go. A native development or preview build is still required for notification claims.
- Marker density on iOS Nearby is high. It works, but visual clutter is obvious at dense metro zoom levels. Marker decluttering/clustering remains a UX improvement area.

## Android simulator findings

Status: simulator evidence is not launch-grade.

Evidence:

- Source-level Expo Go smoke: `tmp/native-smoke/android-map-smoke-2026-06-30T23-12-13-493Z.md`
- Installed preview APK smoke: `tmp/native-smoke/android-preview-smoke-2026-06-30T22-49-34-729Z.md`
- Fresh installed APK smoke after HTTPS profile fix: `tmp/native-smoke/android-preview-smoke-2026-06-30T23-33-35-695Z.md`

What worked:

- Android ARM64 emulator boots and is visible to adb.
- Source-level Expo Go can open the app and navigate Plan, Nearby, pan and Account.
- Installed preview APK opens and renders real Google map tiles on Plan.
- Fresh localParity Android build `4839ead1-efe2-43fa-9ab3-1a4aa192030b` completed successfully.
- Fresh APK `fuel-path-preview-android-localParity-4839ead1.apk` no longer has the HTTP cleartext failure.
- Fresh APK smoke has non-blank Google map tiles, visible station markers and no map warning lines.
- The installed preview APK is within the native APK size budget.

Brutal critique:

- Source-level Android Expo Go smoke has very poor frame evidence: 76 percent janky frames and p95 around 2250 ms. This cannot support any performance claim.
- Android Expo Go map screenshot was mostly blank/beige with a Google logo and no useful station marker evidence. Treat Expo Go on Android as weak render evidence only.
- The installed APK smoke used `fuel-path-preview-android-local-parity-8199f828.apk`, which was built with an HTTP LAN backend. Nearby failed with Android cleartext blocking: `CLEARTEXT communication to 192.168.86.47 not permitted by network security policy`.
- That APK is stale relative to current app/runtime decisions. It still showed older Plan/fuel-chip UI behaviour, so it cannot be treated as current launch evidence.
- The fresh APK fixed the cleartext and map-warning issues, but emulator performance remains poor: 112 frames, 91.1 percent janky, p90 950 ms, p95 1200 ms and p99 1350 ms.
- Android performance evidence from the older physical Pixel pass is useful historical evidence but does not match the latest source/config state.

Required Android next proof:

- Run physical-device performance smoke on the fresh `fuel-path-preview-android-localParity-4839ead1.apk` artifact, preferably on a mid-range device as well as the Pixel 9 Pro if available.
- Only then make Android native map/performance claims.

## Traffic-volume and backend route findings

Plan route budget:

- 12/12 journeys passed.
- Total latency p50: 1553 ms.
- Total latency p90: 3925 ms.
- Total latency p95: 5266 ms.
- Max: 5266 ms.
- State/type coverage included capital, suburb, regional and remote journeys.

POI route journey stress:

- 200/200 journeys passed.
- Zero geocode failures.
- Zero route failures.
- Zero score failures.
- Recommendations returned: 200/200.
- p50: 1018 ms.
- p90: 1862 ms.
- p95: 2414 ms.
- Max: 4940 ms.

Critique:

- POI route journeys are now strong.
- Broad Plan routes are acceptable against current guardrails, but not instant. p90 near 4 seconds is fine for beta route planning, not yet a polished consumer-speed benchmark.
- The next latency target should be broad Plan route speed, not POI reliability.

## Current launch-readiness judgement

Not ready to claim native launch readiness yet.

Green or materially improved:

- iOS simulator setup and source-level render validation.
- Production route and POI journey stress reliability.
- EAS preview native preflight.
- Mobile app verify suite.
- App shell safe-area behaviour on iOS.

Still blocking launch-quality native claims:

- Fresh Android physical-device evidence for `fuel-path-preview-android-localParity-4839ead1.apk`.
- Android physical-device performance evidence for the current build.
- Signed iOS preview/development build evidence, especially notification/push behaviour.
- Store/privacy/support readiness evidence.
- Provider terms evidence for public live-price claims.

## Recommended next moves

1. Rerun Android physical performance smoke with `native-artifacts/fuel-path-preview-android-localParity-4839ead1.apk`.
2. Create/run an iOS signed preview or development build and repeat Plan/Nearby/Account plus notification permission checks.
3. Add marker decluttering/clustering stress work for dense Nearby maps.
4. Keep Plan route latency optimisation as the next backend performance priority.

## Follow-up correction

After this report was first written, the production smoke matrix exposed a harness mismatch rather than a product route failure: the mocked `/api/score` endpoint returned the old score-only payload while the current app expects the combined `{ route, score }` contract.

The production smoke, mocked map interaction stress and browser route-click stress harnesses now return the combined payload, and `tests/api/browser-harness-contract.test.js` guards that contract. The refreshed production smoke matrix passed 9/9.

## Follow-up signed iOS simulator build - 1 July 2026

A dedicated EAS iOS simulator build profile was added and built successfully.

Evidence:

- Build id: `64c4bf74-77d3-4281-bddb-f8945b6789e6`
- Build profile: `iosSimulator`
- Artifact: `mobile-app/native-artifacts/fuel-path-ios-simulator-64c4bf74.tar.gz`
- App bundle: `mobile-app/native-artifacts/ios-simulator-64c4bf74/FuelPath.app`
- Artifact SHA-256: `17e35a4320a336348f4d827e23e199073529b4be63b36dc13a3fa5e4dc31dade`
- Screenshot: `tmp/native-smoke/ios-simulator-build-nearby-64c4bf74.png`

Result:

- The signed iOS simulator build installs into the booted iPhone 17 Pro simulator.
- Bundle `com.fuelpath.app` launches successfully.
- Nearby renders without the Expo Go developer-tools overlay.
- Apple map tiles and station markers render.
- Header safe-area remains correct under the Dynamic Island.

Critique:

- This upgrades iOS evidence from Expo Go source smoke to signed simulator-build smoke for Nearby.
- Plan and Account were already captured through Expo Go source-level validation, but clean signed-build Plan and Account screenshots still require either macOS assistive access for simulator tapping or separate test builds with different compiled initial tabs.
- Notification and push-token behaviour are still not proven by an iOS simulator build. That remains a real device or signed preview-device validation item.

Current iOS judgement:

- iOS simulator launch/render risk is materially reduced.
- iOS store/beta readiness is not fully proven until signed-device notification behaviour is validated.

## Native marker density iteration - 1 July 2026

The signed iOS simulator screenshot showed that dense metro maps still looked crowded even after the previous marker guardrails. Native marker budgets were tightened in `StationMap.native.tsx`:

- Full price markers reduced from 18 to 12.
- Dot markers reduced from 56 to 28.
- Price-marker grid spacing increased from 132 to 172.
- Compact-marker grid spacing increased from 48 to 84.

Intent:

- Preserve selected, cheapest, closest and best-value visibility.
- Reduce metro visual clutter on iOS and Android native map surfaces.
- Keep the list/bottom sheet as the primary place for full station comparison rather than trying to show every station as a full card on the map.

Follow-up evidence still needed:

- Rebuild or source-run native screenshots after this change to confirm the visual density reduction on both iOS and Android.
- Re-run native map guard tests after the code change.

Second marker-density iteration:

The first native density reduction still left too many overlapping full price cards in Perth metro. Native map thresholds were tightened again:

- Full price markers reduced from 12 to 8.
- Dot markers reduced from 28 to 18.
- Price-marker grid spacing increased from 172 to 240.
- Compact-marker grid spacing increased from 84 to 128.

This makes the map a quick orientation surface, not the full comparison surface. Full comparison remains in the bottom list.

## Post-density signed build evidence - 1 July 2026

Fresh native artifacts were produced after the second marker-density iteration.

Android:

- Build id: `09af9d73-1d61-430b-872c-a333043c2146`
- Artifact: `mobile-app/native-artifacts/fuel-path-preview-android-localParity-09af9d73.apk`
- SHA-256: `34360e2072aa2fb0e89c537a762c7004f906b237ed4593f7cd9d39ea05c0d171`
- Smoke report: `tmp/native-smoke/android-preview-smoke-2026-07-01T00-16-53-475Z.md`

I strongly separate Android render from Android performance:

- Render/map result: useful but still partial.
- Map warning lines: none.
- Map tiles: non-blank.
- Performance result: not claimable on emulator; p95 and jank remain too high.

IOS simulator:

- Build id: `b325801b-e958-4044-8283-8ed47003ba14`
- Artifact: `mobile-app/native-artifacts/fuel-path-ios-simulator-b325801b.tar.gz`
- App bundle: `mobile-app/native-artifacts/ios-simulator-b325801b/FuelPath.app`
- SHA-256: `c781246b50714abdae145af134399a3072d0683344bcf3bbd068af524fdffbf5`
- Screenshot: `tmp/native-smoke/ios-simulator-build-nearby-b325801b.png`

The post-density iOS simulator build confirms the app launches as `com.fuelpath.app` and renders the native map surface. Full launch readiness still needs physical Android performance and device-level iOS notification validation.

## Xcode-ready iOS simulator rerun - 1 July 2026

After Xcode installation completed, the signed post-density iOS simulator build was rerun through Xcode 26.6 with the iOS 26.5 runtime.

Environment:

- Xcode: 26.6, build `17F113`.
- iOS runtime: iOS 26.5.
- App bundle: `mobile-app/native-artifacts/ios-simulator-b325801b/FuelPath.app`.

## Current evidence audit and iOS cold-start smoke - 1 July 2026

Two small native evidence helpers were added so current launch claims do not drift back to stale Expo Go screenshots or old APKs:

- `mobile-app/scripts/native-current-evidence-audit.mjs`
- `mobile-app/scripts/native-ios-cold-start-smoke.mjs`

Package scripts added:

- `npm run native:evidence-audit`
- `npm run native:ios-cold-start-smoke`

Current artefact audit:

- Report: `tmp/native-smoke/native-current-evidence-audit-2026-07-01T04-43-09.384Z.md`
- Latest Android APK listed: `mobile-app/native-artifacts/fuel-path-preview-android-localParity-0e5f2daa.apk`
- Latest Android APK SHA-256: `583cf679ea180e86e269476d5128098704bb5812787085c00d2e538172c3d97d`
- Recent iOS simulator tarballs listed for Plan, Nearby and Account evidence, rather than pretending one tarball proves all tabs.

iOS cold-start smoke:

- Report: `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T04-39-10.248Z.md`
- App bundle: `mobile-app/native-artifacts/ios-simulator-plan-ccbe4bd0/FuelPath.app`
- Device: iPhone 17 Pro simulator.
- Runs: 5.
- Result: passed, 5/5 settled screenshots above minimum size.
- Launch command p50: 234 ms.
- Launch command p90: 259 ms.
- Screenshots:
  - `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T04-39-10.248Z-run-1.png`
  - `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T04-39-10.248Z-run-2.png`
  - `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T04-39-10.248Z-run-3.png`
  - `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T04-39-10.248Z-run-4.png`
  - `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T04-39-10.248Z-run-5.png`

Visual sample judgement:

- Apple map tiles rendered consistently after the settle window.
- The Plan layout is stable across repeated launches.
- Fixed header and bottom navigation are readable.
- The clean-install Plan state shows `Add vehicle / Set fuel`; this is acceptable for first-run simulator evidence but should not be confused with a seeded account/profile state.

Validation after adding the helpers:

- `npm run verify`: pass.
- `node scripts/native-validation-preflight.mjs`: pass, with expected local warnings for alerts token, physical-device API URL and Android Maps key.
- `npm run native:evidence-audit`: pass.

Backend and traffic-volume rerun:

- Plan route latency report: `tmp/plan-route-live-api-stress-2026-07-01T04-43-45-706Z.md`
- Plan route result: 12/12 passed, p50 1554 ms, p90 4030 ms, p95 5496 ms, max 5496 ms, 11/12 recommendations.
- POI route journey report: `tmp/poi-route-journey-stress-2026-07-01T04-44-09-000Z.md`
- POI route journey result: 200/200 passed, zero geocode failures, zero route failures, zero score failures, p50 1165 ms, p90 2601 ms, p95 3676 ms, max 6293 ms, 178/200 recommendations.

Brutal critique:

- iOS signed simulator launch repeatability is now stronger, but it still does not prove real-device permissions, notifications or TestFlight behaviour.
- Android remains the weakest native platform because current physical-device performance evidence is missing and emulator jank remains too high to use for launch claims.
- POI journey correctness is strong. Recommendation coverage is not universal, and that is acceptable only if no-recommendation cases are intentionally handled in the UI.
- Broad Plan route latency is reliable but not elegant. p95 around 5.5 seconds is beta-acceptable, not consumer-polished.

## Android cold-start repeatability smoke - 1 July 2026

A dedicated Android cold-start repeatability helper was added:

- `mobile-app/scripts/native-android-cold-start-smoke.mjs`
- Package script: `npm run native:android-cold-start-smoke`

Purpose:

- Repeatedly force-stop and launch the installed preview APK.
- Wait for map settle.
- Capture screenshots across repeated cold starts.
- Report runtime failures and Google Maps warning lines.
- Avoid mistaking a single lucky launch for native stability.

Evidence:

- Corrected report: `tmp/native-smoke/android-cold-start-smoke-2026-07-01T04-55-42-065Z.md`
- APK: `mobile-app/native-artifacts/fuel-path-preview-android-localParity-0e5f2daa.apk`
- Device: Android emulator `emulator-5554`.
- Runs: 3.
- Result: 3/3 screenshots above minimum size.
- Runtime failure lines: 0.
- Map warning lines: 4.
- Status: partial.
- Screenshots:
  - `tmp/native-smoke/android-cold-start-smoke-2026-07-01T04-55-42-065Z-run-1.png`
  - `tmp/native-smoke/android-cold-start-smoke-2026-07-01T04-55-42-065Z-run-2.png`
  - `tmp/native-smoke/android-cold-start-smoke-2026-07-01T04-55-42-065Z-run-3.png`

Visual sample judgement:

- Google map tiles rendered.
- Nearby loaded by default.
- Station pins rendered.
- Bottom Nearby sheet and bottom nav were stable.
- Header was readable.

Validation:

- `npm run verify`: pass after adding the Android cold-start helper and current-evidence audit integration.
- Current evidence audit: `tmp/native-smoke/native-current-evidence-audit-2026-07-01T04-57-21.541Z.md`

Brutal critique:

- This is a meaningful improvement over earlier Android emulator evidence because repeated launch/render is now stable.
- It is still not a launch-grade Android performance claim.
- The report is intentionally partial because Google Maps warning lines remain present.
- The selected device is an emulator. A current physical Android performance run is still required before Android native readiness can be called green.

## Sequential signed iOS all-tab cold-start evidence - 1 July 2026

An attempted parallel iOS run exposed an evidence-quality problem: the Plan/Nearby/Account simulator bundles share the same bundle id, so parallel runs can overwrite the installed app and pollute screenshots. Those reports are invalid and must not be cited:

- `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T05-00-52.063Z.md`
- `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T05-00-52.064Z.md`

The current evidence audit excludes those files.

Clean sequential iOS cold-start reports:

- Plan: `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T04-39-10.248Z.md`
- Nearby: `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T05-03-46.487Z.md`
- Account: `tmp/native-smoke/ios-cold-start-smoke-2026-07-01T05-06-22.774Z.md`

Results:

- Plan: 5/5 settled screenshots above minimum size, launch command p50 234 ms, p90 259 ms.
- Nearby: 5/5 settled screenshots above minimum size, launch command p50 195 ms, p90 206 ms.
- Account: 5/5 settled screenshots above minimum size, launch command p50 192 ms, p90 192 ms.

Visual sample judgement:

- Nearby renders Apple map tiles, station markers, the search box, the fuel dropdown and the bottom Nearby sheet.
- Account renders the vehicle setup screen clearly.
- Header and bottom navigation are readable in all sampled states.
- No Expo Go overlay is present because these are signed simulator bundles.

Validation:

- `npm run verify`: pass after the all-tab evidence pass.
- `npm run test:map-camera`: pass after the audit exclusion change.
- Current evidence audit: `tmp/native-smoke/native-current-evidence-audit-2026-07-01T05-12-54.094Z.md`

Brutal critique:

- iOS signed simulator launch/render is now strong for Plan, Nearby and Account.
- This still does not prove notification permissions, push registration, TestFlight install behaviour or physical-device performance.
- The harness lesson is important: do not run same-bundle-id iOS simulator evidence captures in parallel.
- Bundle id: `com.fuelpath.app`.

Phone evidence:

- Device: iPhone 17 Pro.
- Screenshot: `tmp/native-smoke/ios-simulator-build-iphone-17-pro-b325801b.png`.
- Result: app launches, Nearby renders, Apple map tiles load, station markers render, and bottom navigation is usable.

Tablet evidence:

- Device: iPad Air 11-inch (M4).
- First screenshot: `tmp/native-smoke/ios-simulator-build-ipad-air-11-b325801b.png`.
- Settled screenshot: `tmp/native-smoke/ios-simulator-build-ipad-air-11-b325801b-settled.png`.
- Result: app launches and renders on iPad. The first capture showed grid-only Apple map tiles during first-run tile loading; after a longer settle, map tiles loaded correctly.

Brutal critique:

- iPhone signed-simulator rendering is now good enough for simulator launch evidence.
- iPad is functional, but not a polished tablet experience. The UI is effectively a wide phone layout rather than a purpose-built tablet layout.
- iPad map tiles may need a longer first-run settle before evidence capture. This is acceptable for simulator testing, but it is not proof of perfect first-open perceived performance.
- None of this replaces real-device iOS checks for permissions, notifications or production TestFlight behaviour.

Updated iOS judgement:

- Signed iOS simulator launch/render evidence is green for phone and functional for tablet.
- iOS device-level readiness remains incomplete until a signed device build is tested on real hardware.

## Android simulator/tooling status - 1 July 2026

Current local Android state:

- Android emulator tooling is available through the project scripts.
- Available AVDs: `Fuel_Path_Arm64_API_35`, `Medium_Phone_API_35`, `Pixel_Tablet_API_35`.
- The direct shell does not currently expose `adb` on `PATH`, but the project readiness script can still find Android Debug Bridge.
- `npm run native:android-physical-readiness` remains blocked because no physical Android device is attached and authorised.

Current Android judgement:

- Android emulator coverage can continue.
- Android performance claims remain blocked until a real Android device is connected and tested against the current APK.

## Android smoke harness hardening and rerun - 1 July 2026

The Android preview smoke harness exposed two automation weaknesses during launch-week simulator testing:

- `uiautomator dump` can hang on the emulator even when the app is foreground and screenshot capture is still possible.
- `--keep-emulator` could leave the Node smoke process alive because the spawned emulator child process was still referenced.

The harness was updated so that:

- Android UI hierarchy dumps have explicit timeouts.
- Screenshot capture falls back to Android window-focus checks when UI hierarchy dump is unreliable.
- UI dump failures are recorded in the generated report rather than freezing the run.
- Kept emulator child processes are unreferenced so the smoke command exits normally.

Fresh current-APK smoke evidence:

- Report: `tmp/native-smoke/android-preview-smoke-2026-07-01T01-14-42-861Z.md`.
- Artifact: `mobile-app/native-artifacts/fuel-path-preview-android-localParity-09af9d73.apk`.
- Device: `Fuel_Path_Arm64_API_35`, visible as `emulator-5554`.
- Status: partial.
- Map tiles: non-blank.
- Map warning lines: none.
- Total frames: 371.
- Janky frames: 325.
- Janky percent: 87.6 percent.
- p90: 57 ms.
- p95: 65 ms.
- p99: 81 ms.

Brutal critique:

- Android current APK render is now proven on the compatible ARM64 phone emulator.
- Android simulator automation is now more robust, but UI hierarchy extraction remains unreliable on this emulator.
- Android emulator performance is still not launch-claimable. The frame p95 is better than prior runs, but 87.6 percent janky frames is too high to call smooth.
- This should not block continued product work, but it does block any public Android performance claim.

Android tablet/alternate AVD coverage:

- `Fuel_Path_Arm64_API_35` is ARM64 and runnable on this Apple Silicon host.
- `Medium_Phone_API_35` is x86_64 and not runnable on this Apple Silicon host.
- `Pixel_Tablet_API_35` is x86_64 and not runnable on this Apple Silicon host.
- Attempting to boot `Pixel_Tablet_API_35` failed with: `Avd's CPU Architecture 'x86_64' is not supported by the QEMU2 emulator on aarch64 host`.

Updated Android judgement:

- Android phone-emulator render evidence is useful and current.
- Android tablet simulator evidence is blocked until an ARM64 tablet AVD is created.
- Android launch/performance readiness still requires a real Android device run.

## Android ARM64 tablet simulator evidence - 1 July 2026

An ARM64 tablet AVD was created to replace the unusable x86_64 tablet simulator:

- New AVD: `Fuel_Path_Arm64_Tablet_API_35`.
- Device profile: Pixel Tablet.
- System image: `system-images;android-35;google_apis;arm64-v8a`.
- Host compatibility: runnable on Apple Silicon.

Tablet smoke evidence:

- Report: `tmp/native-smoke/android-preview-smoke-2026-07-01T01-25-05-996Z.md`.
- Clean post-modal screenshot: `tmp/native-smoke/android-arm64-tablet-nearby-after-system-modal-dismiss-2026-07-01T01-30-02Z.png`.
- Status: partial.
- Map tiles: non-blank.
- Total frames: 35.
- Janky frames: 33.
- Janky percent: 94.3 percent.
- p90: 4950 ms.
- p95: 4950 ms.
- p99: 4950 ms.

Tablet-specific critique:

- The app launches and renders on an Android tablet-class simulator.
- The first tablet run was contaminated by Android's own `See and do more` system modal. A clean screenshot was captured after dismissing it.
- The app is not tablet-optimised. It renders as a narrow phone layout with large side gutters rather than using tablet width intentionally.
- Tablet emulator performance is not usable evidence. The frame data is too poor and UI hierarchy dump was unreliable.
- If tablet support is part of the launch promise, this needs a dedicated responsive layout pass. If not, tablet should be treated as compatible but not optimised.

Updated cross-platform simulator judgement:

- iOS phone simulator: green for signed simulator render.
- iOS tablet simulator: functional, not tablet-optimised.
- Android phone emulator: render proven, performance not claimable.
- Android tablet emulator: render proven after creating an ARM64 AVD, performance not claimable, UX not tablet-optimised.

Verification after harness changes:

- `npm run verify` in `mobile-app/`: pass.

## Tablet launch-scope correction - 1 July 2026

The simulator evidence showed that both iPad and Android tablet surfaces are functional but not tablet-optimised. The launch-week decision is therefore to treat Fuel Path as a phone-first app, not a tablet app.

Config change:

- `mobile-app/app.json`: `ios.supportsTablet` changed from `true` to `false`.
- `mobile-app/scripts/native-validation-preflight.mjs`: added a guard requiring `ios.supportsTablet === false` until a dedicated tablet UX pass is validated.

Why:

- iPad renders, but uses a wide phone-style layout rather than a purpose-built tablet layout.
- Android tablet renders, but presents as a portrait phone app inside a tablet display with large side gutters.
- Claiming tablet support this week would overstate the current UX quality.

Validation:

- `npm run verify` in `mobile-app/`: pass.
- `node scripts/native-validation-preflight.mjs` in `mobile-app/`: pass with expected local-shell warnings for validation token, physical-device API URL and Android Maps key.
- `npm run native:preflight:local` in `mobile-app/`: fails only on the expected strict env blockers; the new iPhone-only launch guard passes.

Updated launch-scope judgement:

- Launch target should be phone-first on iOS and Android.
- Tablet simulator results remain useful compatibility evidence only.
- Do not market or imply tablet-optimised support until a responsive tablet UX pass is designed, built and validated.

## Small-phone iOS simulator and marker-density iteration - 1 July 2026

Additional signed iOS simulator coverage was run on the smaller phone target:

- Device: iPhone 17e, iOS 26.5.
- App bundle: `mobile-app/native-artifacts/ios-simulator-b325801b/FuelPath.app`.
- Screenshot: `tmp/native-smoke/ios-simulator-build-iphone-17e-b325801b.png`.

Result:

- Signed app launches.
- Apple map tiles load.
- Header, fuel dropdown and bottom navigation stay usable.

Brutal critique:

- The iPhone 17e render exposed excessive native map marker crowding. The app worked, but the map looked too busy for a small-phone launch surface.
- This was not a crash or blocker, but it was a launch-quality UX issue.

Iteration:

- `mobile-app/src/components/StationMap.native.tsx` now uses adaptive native marker density.
- Widths at or below `430` use a compact marker budget:
  - price markers: 5
  - dot markers: 12
  - price marker grid: 310
  - compact marker grid: 170
- Wider native layouts retain the default budget:
  - price markers: 8
  - dot markers: 18
  - price marker grid: 240
  - compact marker grid: 128
- Protected station markers, including selected, cheapest, closest and best-value candidates, remain protected from being lost.
- `mobile-app/scripts/check-map-camera-guards.mjs` now guards this adaptive density rule.

Validation:

- `npm run verify` in `mobile-app/`: pass.

Caveat:

- The adaptive marker-density fix is source-verified and guard-backed, but it is not yet proven in a fresh signed iOS or Android native artifact. The previous signed simulator screenshots are useful as bug evidence, not proof that the new density fix renders correctly.

## Latest production traffic-volume stress - 1 July 2026

Plan route latency budget:

- Command: `npm run check:plan-route-latency-budget`.
- Report: `tmp/plan-route-live-api-stress-2026-07-01T01-52-28-216Z.md`.
- Result: 12/12 passed.
- Recommendations returned: 12/12.
- Total p50: 1346 ms.
- Total p90: 3922 ms.
- Total p95: 6155 ms.
- Max: 6155 ms.
- Coverage included NSW, ACT, VIC, QLD, WA and SA with capital, suburb, regional and remote journeys.

POI route journey stress:

- Command: `npm run test:poi-route-journeys`.
- Report: `tmp/poi-route-journey-stress-2026-07-01T01-52-28-594Z.md`.
- Result: 200/200 passed.
- Geocode failures: 0.
- Route failures: 0.
- Score failures: 0.
- Recommendations returned: 200/200.
- p50: 1140 ms.
- p90: 2141 ms.
- p95: 2856 ms.
- Max: 4535 ms.

Production smoke matrix:

- Command: `npm run test:production-smoke-matrix`.
- Report: `tmp/production-smoke-matrix-stress-2026-07-01T01-52-28-795Z.md`.
- Result: 9/9 passed.
- Covered fuel, EV and route flows across small-phone, phone and tablet web viewport scenarios.

Map density/performance stress:

- Command: `npm run test:map-density`.
- Report: `tmp/map-density-performance-stress-2026-07-01T01-52-30-304Z.md`.
- Result: 4/4 passed.
- Covered fuel and EV density cases for phone and small-phone web viewport scenarios.

Traffic-volume judgement:

- Production-facing route and POI reliability are strong for beta.
- POI route journeys are materially better than earlier runs and now look launch-ready from an API reliability perspective.
- Broad Plan route latency is acceptable for beta but not instant. p90 around 3.9 seconds and p95 around 6.2 seconds are still noticeable to users.
- Traffic stress does not replace native-device performance validation.

## Final-density signed simulator evidence - 1 July 2026

A final compact native marker-density pass was validated after the earlier iPhone 17e evidence still showed too much metro marker crowding.

Final marker-density intent:

- Phone-sized native maps are orientation surfaces, not full comparison tables.
- The bottom sheet remains the primary comparison surface.
- Small phones should show only the most useful full price markers and fewer dot markers.
- Protected markers, including selected, cheapest, closest and best-value candidates, remain prioritised.

Final iOS simulator artifact:

- Build id: `ce959229-f9f9-4598-a73c-9cf79772e109`.
- Build profile: `iosSimulator`.
- Artifact: `mobile-app/native-artifacts/fuel-path-ios-simulator-ce959229.tar.gz`.
- App bundle: `mobile-app/native-artifacts/ios-simulator-ce959229/FuelPath.app`.
- SHA-256: `038d9c825870093d474c099531bac86ee08b00caf4ee502e7ebc95dd4f619551`.
- Screenshot: `tmp/native-smoke/ios-simulator-build-iphone-17e-ce959229-density.png`.

Final Android simulator artifact:

- Build id: `39a2e460-f8e5-4246-89f4-00fdafb97454`.
- Build profile: `localParity`.
- Artifact: `mobile-app/native-artifacts/fuel-path-preview-android-localParity-39a2e460.apk`.
- SHA-256: `2f3d90a5e1b991fe881747f5a3664e89d59ab0a56d2c0ce134a4c928a5c561e5`.
- Smoke report: `tmp/native-smoke/android-preview-smoke-2026-07-01T02-33-43-013Z.md`.
- Screenshots:
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T02-33-43-013Z-plan.png`.
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T02-33-43-013Z-nearby.png`.
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T02-33-43-013Z-nearby-after-pan.png`.
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T02-33-43-013Z-account.png`.

Latest local checks:

- `npm run native:ios-simulator-plan`: pass.
- `node scripts/native-validation-preflight.mjs`: pass with expected local-shell warnings for alerts token, physical-device API URL and Android Maps key.
- Last full `npm run verify` after the compact-density source changes: pass.

Final iOS simulator judgement:

- iOS 26.5 simulator runtime is installed and usable through Xcode.
- Signed iOS simulator app launches successfully.
- iPhone phone-sized render is acceptable after compact marker-density tuning.
- iPad remains compatibility-only because the app is intentionally phone-first for launch and `ios.supportsTablet` is now false.
- Real-device iOS notification and permission behaviour remains unproven and must not be claimed from simulator evidence.

Final Android simulator judgement:

- Android phone emulator render is proven on the final-density APK.
- Google map tiles are non-blank.
- Nearby and Plan surfaces render with reduced marker density.
- The Android smoke status is still partial because UI hierarchy dumps were unreliable and frame performance was poor.
- Latest Android emulator frame evidence: 330 total frames, 314 janky frames, 95.2 percent janky, p90 85 ms, p95 89 ms and p99 105 ms.
- Android emulator performance is not launch-claimable. Use real Android device performance before making user-facing smoothness claims.

Brutal launch judgement after final simulator pass:

- Simulator render evidence is now good enough to support continued beta preparation.
- iOS simulator readiness is green for phone render.
- Android simulator readiness is green for render but red for performance claims.
- Tablet support should remain out of launch scope.
- Native launch readiness is still not complete until real iOS and Android devices validate permissions, notifications, map behaviour and performance on current builds.

## Signed iOS all-main-tabs validation - 1 July 2026

The earlier signed iOS simulator evidence covered the default Nearby launch state, but Plan and Account still depended on older Expo Go screenshots or manual simulator interaction. macOS accessibility automation was attempted for simulator tapping and blocked because `osascript` does not have assistive access on this machine.

Harness improvement:

- `mobile-app/eas.json` now includes `iosSimulatorPlan` and `iosSimulatorAccount` profiles.
- These profiles extend the signed simulator build profile and bake `EXPO_PUBLIC_FUEL_PATH_INITIAL_TAB` into the native JS bundle.
- This makes clean signed Plan and Account simulator evidence reproducible without manual tapping or macOS accessibility permissions.

Validation after profile change:

- `npm run verify` in `mobile-app/`: pass.
- `node scripts/native-validation-preflight.mjs` in `mobile-app/`: pass with the expected local-shell warnings for alerts token, physical-device API URL and Android Maps key.

Plan signed simulator evidence:

- Build id: `5102f1a8-e1bf-41d1-ae74-d074bd1a9f7b`.
- Build profile: `iosSimulatorPlan`.
- Artifact: `mobile-app/native-artifacts/fuel-path-ios-simulator-plan-5102f1a8.tar.gz`.
- App bundle: `mobile-app/native-artifacts/ios-simulator-plan-5102f1a8/FuelPath.app`.
- SHA-256: `74e6fe3b6b0cda1cc8cb84a1eccd157aeb1837ac7460a4a1c8d44a83b2099287`.
- Screenshot: `tmp/native-smoke/ios-simulator-build-iphone-17e-plan-5102f1a8.png`.

Account signed simulator evidence:

- Build id: `8f18a731-e73c-4744-b3c9-f2cbf2ae2d3d`.
- Build profile: `iosSimulatorAccount`.
- Artifact: `mobile-app/native-artifacts/fuel-path-ios-simulator-account-8f18a731.tar.gz`.
- App bundle: `mobile-app/native-artifacts/ios-simulator-account-8f18a731/FuelPath.app`.
- SHA-256: `2a99c257bad44a2428ae05c47b1cc5123174c4cb9aadee0059cbe9695870f2e3`.
- Screenshot: `tmp/native-smoke/ios-simulator-build-iphone-17e-account-8f18a731.png`.

All-main-tabs iOS validation report:

- Latest report: `tmp/native-smoke/ios-validation-2026-07-01T03-08-10-192Z.md`.
- Earlier equivalent report: `tmp/native-smoke/ios-validation-2026-07-01T03-02-58-234Z.md`.
- Target: iPhone 17e, iOS 26.5.
- Screens covered with signed simulator screenshots: Plan, Nearby and Account.
- Result: pass.

Brutal iOS critique:

- Signed simulator render is now green for the three main tabs on a phone target.
- The Plan placeholder text is visually pale on the translucent card. It is not a launch blocker, but it is a polish item.
- Account is readable and much simpler than previous iterations.
- This still does not prove real-device notification permission, push token registration, TestFlight installation behaviour or actual device performance.

## Latest Android emulator reproducibility run - 1 July 2026

Fresh Android emulator checks were rerun against the current final-density APK after the iOS profile work.

Setup/readiness:

- `npm run native:android-avd-plan`: pass.
- ARM64-compatible AVDs available: `Fuel_Path_Arm64_API_35`, `Fuel_Path_Arm64_Tablet_API_35`.
- `npm run native:android-physical-readiness`: blocked because no authorised physical Android device is attached.

Latest emulator smoke:

- Command: `FUEL_PATH_ANDROID_AVD=Fuel_Path_Arm64_API_35 npm run native:android-preview-smoke -- --artifact native-artifacts/fuel-path-preview-android-localParity-39a2e460.apk --map-settle-ms 6000`.
- Report: `tmp/native-smoke/android-preview-smoke-2026-07-01T03-04-21-451Z.md`.
- Artifact: `mobile-app/native-artifacts/fuel-path-preview-android-localParity-39a2e460.apk`.
- Device: `emulator-5554`, ARM64 Android 35 emulator.
- Status: partial.
- Render status: passed.
- Performance status: needs device validation.
- Map warning lines: none.
- Map tiles: non-blank.
- Frame summary: 352 total frames, 331 janky frames, 94 percent janky, p90 65 ms, p95 77 ms, p99 85 ms.
- UI hierarchy dump warnings: 3 timeout/fallback captures.
- Screenshots:
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T03-04-21-451Z-plan.png`.
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T03-04-21-451Z-nearby.png`.
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T03-04-21-451Z-nearby-after-pan.png`.
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T03-04-21-451Z-account.png`.

Brutal Android critique:

- Android emulator render is reproducibly green enough for simulator proof.
- Android map key/API warnings are not present in the latest smoke.
- The Android UI automation layer remains flaky because `uiautomator dump` times out even when screenshot capture succeeds via foreground fallback.
- Android emulator performance remains red. The latest 94 percent jank result is too high to call smooth.
- Android launch performance must be validated on a real authorised Android phone before any launch-week performance claim.

Updated native launch judgement:

- iOS signed simulator render: green for phone Plan, Nearby and Account.
- Android emulator render: green for current APK Plan, Nearby and Account screenshots.
- Android emulator performance: red for performance claims.
- Android physical-device validation: still blocked by missing authorised device.
- iOS physical-device notification and permission validation: still missing.
- The goal should remain active until real-device iOS and Android checks close those native launch gaps.

## Current Android tablet emulator run and iOS accessibility stress - 1 July 2026

Additional simulator-only launch-week stress was run after the signed iOS all-tabs validation.

### Current Android tablet emulator evidence

The current final-density APK was rerun on the ARM64 tablet-class AVD.

- AVD: `Fuel_Path_Arm64_Tablet_API_35`.
- Artifact: `mobile-app/native-artifacts/fuel-path-preview-android-localParity-39a2e460.apk`.
- Report: `tmp/native-smoke/android-preview-smoke-2026-07-01T03-11-39-551Z.md`.
- Status: partial.
- Render status: passed.
- Performance status: needs device validation.
- Map tiles: non-blank.
- Map warning lines: none.
- Frame summary: 344 total frames, 334 janky frames, 97.1 percent janky, p90 121 ms, p95 150 ms, p99 200 ms.
- UI hierarchy dump warnings: 5 timeout/fallback captures.
- Screenshots:
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T03-11-39-551Z-plan.png`.
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T03-11-39-551Z-nearby.png`.
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T03-11-39-551Z-account.png`.

Brutal tablet critique:

- The current APK renders on the tablet emulator, so tablet-class devices are not obviously crash-broken.
- The UX is still a phone-first app inside a tablet canvas, with large side gutters rather than a tablet-optimised layout.
- Performance evidence is worse than the phone emulator and cannot support any launch performance claim.
- This confirms the launch-scope decision: do not market tablet support. Treat tablet as compatibility-only until a real responsive tablet design pass exists.

### iOS Dynamic Type and appearance stress

A signed Account simulator build was stressed with iOS `accessibility-extra-extra-large` content size and light/dark appearance.

Initial failure evidence before fix:

- Light screenshot: `tmp/native-smoke/ios-simulator-account-accessibility-xxl-8f18a731.png`.
- Dark screenshot: `tmp/native-smoke/ios-simulator-account-dark-accessibility-xxl-8f18a731.png`.

Failure critique:

- The app chrome was not usable at extreme text size.
- Header text split vertically and consumed the top of the screen.
- Bottom navigation labels overflowed and wrapped badly.
- This was a real launch-quality accessibility issue, not polish.

Fix:

- `mobile-app/App.tsx` now caps fixed app chrome text with `maxFontSizeMultiplier={chromeTextScale}` and `numberOfLines={1}`.
- The cap applies only to fixed chrome: brand title/subtitle, vehicle pill text and bottom navigation labels.
- Page content still responds to large Dynamic Type.
- `mobile-app/scripts/check-map-camera-guards.mjs` now has a regression guard: `app shell caps fixed chrome text scaling for accessibility`.

Post-fix signed evidence:

- Build id: `be496b19-9880-4f97-a588-a081e580edd9`.
- Build profile: `iosSimulatorAccount`.
- Artifact: `mobile-app/native-artifacts/fuel-path-ios-simulator-account-be496b19.tar.gz`.
- App bundle: `mobile-app/native-artifacts/ios-simulator-account-be496b19/FuelPath.app`.
- SHA-256: `2a4df9670ffe3f59d09bc6349e3999cf931264576597eacb42f57f387591a2f9`.
- Light screenshot: `tmp/native-smoke/ios-simulator-account-accessibility-xxl-be496b19.png`.
- Dark screenshot: `tmp/native-smoke/ios-simulator-account-dark-accessibility-xxl-be496b19.png`.
- Accessibility validation report: `tmp/native-smoke/ios-validation-2026-07-01T03-28-48-873Z.md`.

Post-fix critique:

- Header and bottom navigation remain usable at extreme Dynamic Type.
- Account content becomes very large, which is expected and acceptable for accessibility scaling.
- The top content card is scroll-dependent at this size, but navigation recovery is intact.
- Dark appearance does not currently change the visual palette materially because the app uses explicit light surfaces. That is acceptable if the product is intentionally light-only, but it should not be marketed as dark-mode optimised.

Validation after fix:

- `npm run verify` in `mobile-app/`: pass.
- `node scripts/native-validation-preflight.mjs` in `mobile-app/`: pass with expected local-shell warnings.
- Accessibility report with signed screenshots: pass.

Updated launch judgement after accessibility stress:

- A genuine iOS accessibility chrome failure was found and fixed.
- Simulator evidence now covers signed iOS Plan, Nearby, Account, extreme text Account and dark-appearance Account.
- Remaining native launch blockers are still real-device items: Android physical performance and iOS real-device permission/notification behaviour.

## Current post-accessibility-fix native artefacts - 1 July 2026

After fixing fixed-chrome Dynamic Type scaling, the previous Android APK plus iOS Plan/Nearby simulator builds were stale. Current native artefacts were rebuilt and revalidated so the launch-readiness evidence matches the current code.

### Current Android APK

Build:

- Build id: `0e5f2daa-bb25-414f-909f-6eaf5fc04ea7`.
- Build profile: `localParity`.
- Artifact: `mobile-app/native-artifacts/fuel-path-preview-android-localParity-0e5f2daa.apk`.
- SHA-256: `583cf679ea180e86e269476d5128098704bb5812787085c00d2e538172c3d97d`.

Phone emulator smoke:

- Report: `tmp/native-smoke/android-preview-smoke-2026-07-01T03-41-24-429Z.md`.
- Status: partial.
- Render status: passed.
- Performance status: needs device validation.
- Map tiles: non-blank.
- Frame summary: 373 total frames, 338 janky frames, 90.6 percent janky, p90 65 ms, p95 65 ms, p99 77 ms.
- Attention items: UI hierarchy dump fallback, Google Play services credential warnings, high frame jank.
- Screenshot: `tmp/native-smoke/android-preview-smoke-2026-07-01T03-41-24-429Z-nearby.png`.

Android judgement:

- Current APK render is still green on the ARM64 phone emulator.
- Current APK performance remains not launch-claimable on emulator.
- Google/Play-services warnings reappeared in this run even though map tiles rendered. Treat this as a configuration/watch item for real device validation, not a visual map failure.

### Current signed iOS simulator artefacts

Nearby/default build:

- Build id: `d8cbc9a4-b779-4d62-9b3d-e463ecaba73f`.
- Build profile: `iosSimulator`.
- Artifact: `mobile-app/native-artifacts/fuel-path-ios-simulator-d8cbc9a4.tar.gz`.
- App bundle: `mobile-app/native-artifacts/ios-simulator-d8cbc9a4/FuelPath.app`.
- SHA-256: `a099f30374cb98c636dfa194c32c92851260196e01abe16c84002df8ec9ddbac`.
- Screenshot: `tmp/native-smoke/ios-simulator-build-iphone-17e-nearby-d8cbc9a4.png`.

Plan build:

- Build id: `ccbe4bd0-c8b3-47dc-b797-ef6f53a89dcb`.
- Build profile: `iosSimulatorPlan`.
- Artifact: `mobile-app/native-artifacts/fuel-path-ios-simulator-plan-ccbe4bd0.tar.gz`.
- App bundle: `mobile-app/native-artifacts/ios-simulator-plan-ccbe4bd0/FuelPath.app`.
- SHA-256: `5fc01a1c9ca23aa305dd7541eaf2e9f86437a502778b2c864b979dc768c58116`.
- Screenshot: `tmp/native-smoke/ios-simulator-build-iphone-17e-plan-ccbe4bd0.png`.

Account build:

- Build id: `be496b19-9880-4f97-a588-a081e580edd9`.
- Build profile: `iosSimulatorAccount`.
- Artifact: `mobile-app/native-artifacts/fuel-path-ios-simulator-account-be496b19.tar.gz`.
- App bundle: `mobile-app/native-artifacts/ios-simulator-account-be496b19/FuelPath.app`.
- SHA-256: `2a4df9670ffe3f59d09bc6349e3999cf931264576597eacb42f57f387591a2f9`.
- Normal-size screenshot: `tmp/native-smoke/ios-simulator-build-iphone-17e-account-be496b19.png`.
- Accessibility screenshots:
  - `tmp/native-smoke/ios-simulator-account-accessibility-xxl-be496b19.png`.
  - `tmp/native-smoke/ios-simulator-account-dark-accessibility-xxl-be496b19.png`.

Current all-tabs validation:

- Report: `tmp/native-smoke/ios-validation-2026-07-01T04-00-28-295Z.md`.
- Target: iPhone 17e, iOS 26.5, current post-accessibility-fix artefacts.
- Screens: Plan, Nearby and Account.
- Result: pass.

Validation:

- `npm run verify` in `mobile-app/`: pass.
- Native APK size budget now evaluates the current `fuel-path-preview-android-localParity-0e5f2daa.apk`: pass at 70.76 MB / 76.29 MB.

Current brutal launch judgement:

- Current signed iOS simulator evidence is green for Plan, Nearby and Account.
- Current iOS accessibility chrome fix is verified on signed simulator evidence.
- Current Android APK render is green on the phone emulator.
- Android emulator performance remains red for launch claims.
- Android physical-device performance remains missing.
- iOS real-device notification, permission and TestFlight-style behaviour remain missing.
- Goal remains active until those real-device launch blockers are closed or explicitly accepted as out of scope.

## Large-phone and rotation/orientation stress - 1 July 2026

Additional platform UX stress was run against the current post-accessibility-fix native artefacts.

Declared orientation:

- `mobile-app/app.json` declares `expo.orientation` as `portrait`.
- Therefore rotation testing is interpreted as portrait-lock safety, not landscape-layout support.

### iOS large-phone simulator

Current Nearby/default signed iOS simulator build was installed on iPhone 17 Pro Max.

Evidence:

- Device: iPhone 17 Pro Max, iOS 26.5.
- Build id: `d8cbc9a4-b779-4d62-9b3d-e463ecaba73f`.
- First screenshot: `tmp/native-smoke/ios-simulator-build-iphone-17-pro-max-nearby-d8cbc9a4.png`.
- Settled screenshot: `tmp/native-smoke/ios-simulator-build-iphone-17-pro-max-nearby-d8cbc9a4-settled.png`.

Result:

- App launches on the larger phone target.
- Header, vehicle pill, search, fuel dropdown, bottom sheet and bottom navigation remain usable.
- The first screenshot showed Apple Maps grid-only tiles while markers had already rendered.
- After an additional settle period, Apple map tiles loaded correctly.

Brutal critique:

- iPhone 17 Pro Max layout is usable and not visibly broken.
- Apple map tile warm-up can be slow on first simulator launch. This is not a product crash, but it is a perceived-performance watch item.
- Marker density on the larger phone shows more full markers than the iPhone 17e compact state. It is acceptable for orientation, but still not as calm as the smaller-phone tuned view.

### iOS rotation attempt

A rotation command was attempted through `simctl io`, but this Xcode/simctl version does not expose a supported `rotate` operation.

Evidence:

- Relaunch screenshot after unsupported rotation attempt: `tmp/native-smoke/ios-simulator-build-iphone-17e-rotated-nearby-d8cbc9a4.png`.

Result:

- The app remained in portrait and rendered normally.
- This is useful as a relaunch sanity check, not strong rotation evidence.

### Android portrait-lock rotation request

A focused Android emulator rotation request was run against the current APK.

Evidence:

- APK: `mobile-app/native-artifacts/fuel-path-preview-android-localParity-0e5f2daa.apk`.
- Portrait screenshot: `tmp/native-smoke/android-current-phone-portrait-0e5f2daa.png`.
- Rotation-request screenshot: `tmp/native-smoke/android-current-phone-rotation-request-0e5f2daa.png`.

Result:

- Screenshots remained at portrait dimensions after requesting Android `user_rotation=1`, consistent with the app's portrait lock.
- The first portrait screenshot caught a transient loading state with a black map region.
- The rotation-request screenshot showed Google map tiles and portrait chrome, but still caught station loading.
- The emulator disappeared before a settled post-rotation recapture could be taken, so the check is not strong enough to call Android rotation fully green.

Brutal critique:

- Android portrait lock appears to hold.
- Android emulator instability continues to reduce confidence in simulator-only UX claims.
- This reinforces the existing conclusion: Android render can be smoke-tested in simulator, but launch confidence needs a real device.

Updated orientation judgement:

- iOS large-phone render is green after tile settle.
- iOS rotation remains limited by simulator tooling, but the app is intentionally portrait-only.
- Android portrait-lock behaviour is directionally OK but not fully proven because the emulator dropped before a settled recapture.
- No code change was made from this slice.

## Current traffic-volume and Android tablet rerun - 1 July 2026

A fresh production-facing traffic suite was run after the current native artefact rebuilds. These tests validate production web/API behaviour, not native-device performance, but they are part of launch-week readiness because native clients rely on the same live services.

### Production Plan route latency stress

- Command: `npm run check:plan-route-latency-budget`.
- Report: `tmp/plan-route-live-api-stress-2026-07-01T04-23-33-210Z.md`.
- Result: pass.
- Journeys: 12/12 passed.
- Recommendations returned: 11/12.
- Total p50: 1619 ms.
- Total p90: 3832 ms.
- Total p95: 5291 ms.
- Max: 5291 ms.
- Coverage: NSW, ACT, VIC, QLD, WA and SA, including capital, suburb, regional and remote journeys.

Critique:

- Reliability is green for this suite.
- Latency is acceptable for beta route planning, not instant consumer-grade.
- One journey returned no recommendation. This stayed within the budget, but it is a watch item for recommendation availability.

### POI route journey stress

- Command: `npm run test:poi-route-journeys`.
- Report: `tmp/poi-route-journey-stress-2026-07-01T04-23-33-214Z.md`.
- Result: pass.
- Journeys: 200/200 passed.
- Geocode failures: 0.
- Route failures: 0.
- Score failures: 0.
- Recommendations returned: 178/200.
- p50: 1151 ms.
- p90: 2302 ms.
- p95: 2898 ms.
- Max: 5449 ms.

Critique:

- POI journey reliability is now strong.
- Recommendation coverage is not universal. That may be correct if no qualifying fuel stop exists, but it should keep being tracked because users experience missing recommendations as weak intelligence.
- p90 around 2.3 seconds is good enough for beta POI route planning.

### Production smoke matrix

- Command: `npm run test:production-smoke-matrix`.
- Report: `tmp/production-smoke-matrix-stress-2026-07-01T04-23-35-729Z.md`.
- Result: pass.
- Cases: 9/9 passed.
- Coverage: Nearby fuel, Nearby EV and Plan route across small-phone, phone and tablet web viewports.

### Map density/performance stress

- Command: `npm run test:map-density`.
- Report: `tmp/map-density-performance-stress-2026-07-01T04-23-35-732Z.md`.
- Result: pass.
- Cases: 4/4 passed.
- Coverage: fuel and EV density cases for phone and small-phone web viewport scenarios.

### Current Android tablet rerun

The current APK was rerun on the ARM64 Android tablet AVD so tablet evidence matches the latest `0e5f2daa` build.

- AVD: `Fuel_Path_Arm64_Tablet_API_35`.
- APK: `mobile-app/native-artifacts/fuel-path-preview-android-localParity-0e5f2daa.apk`.
- Report: `tmp/native-smoke/android-preview-smoke-2026-07-01T04-26-31-197Z.md`.
- Status: partial.
- Render status: passed.
- Performance status: needs device validation.
- Map tiles: non-blank.
- Map warning lines: none.
- Frame summary: 168 total frames, 164 janky frames, 97.6 percent janky, p90 450 ms, p95 650 ms, p99 1100 ms.
- Screenshots:
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T04-26-31-197Z-plan.png`.
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T04-26-31-197Z-nearby.png`.
  - `tmp/native-smoke/android-preview-smoke-2026-07-01T04-26-31-197Z-account.png`.

Tablet critique:

- Current APK renders on tablet-class Android simulator.
- UX remains phone-first with black side gutters and no tablet-optimised layout.
- Performance is not launch-claimable and is worse than phone emulator evidence.
- This confirms again that tablet should stay outside launch claims.

Updated service-readiness judgement:

- Production service reliability is green for the current stress suite.
- POI and route journey stress are strong enough for beta evidence.
- Broad route planning is acceptable but still not instant.
- Native Android performance remains the biggest unresolved launch-readiness gap.
