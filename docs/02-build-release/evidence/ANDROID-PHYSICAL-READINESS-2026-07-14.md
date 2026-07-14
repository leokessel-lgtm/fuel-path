# Android physical readiness evidence

Date: 2026-07-14 (Australia/Sydney)

## Scope

- Device: Pixel 9 Pro, Android 17, serial `49231FDAP0017N`
- App source: `9c2c20ba9a2bd5ed27dbe2c22e89c0fdce6a4470`
- EAS build: `b1117016-23f5-412c-bdb3-aa81f6a8666d`
- Profile: `localParity`
- APK: `mobile-app/native-artifacts/fuel-path-localParity-9c2c20ba-b1117016.apk`
- SHA-256: `e806ac034b594d8d217db1414741bfda65bbfa31b41397e3a6d367d6514223d8`
- API base: `https://fuel-path.vercel.app`

The existing app was removed before this exact APK was installed. The APK and
source revision match the station-marker repair under test.

## Passed evidence

- The physical Preview smoke passed Plan, Nearby, map pan, Settings and a
  measured Nearby frame with no fatal or map-authorisation warnings.
- The measured map run rendered 353 frames with 7 janky frames (2.0%), p90
  8 ms, p95 12 ms and p99 26 ms.
- Station price markers, logos and cluster pills rendered without the earlier
  BP/Shell overlap or floating-logo association error in the reviewed frames.
- Five cold launches and one foreground resume completed with no runtime
  failure or Google Maps warning. Launch-command p50 was 280 ms and p90 was
  302 ms.
- Android navigation-intent contracts passed for device maps, Google Maps,
  Waze and browser fallback.
- The installed app exposes the `route-alerts` notification channel. The
  Android notification permission prompt was exercised and permission was
  granted on the device.
- Device-local persistence passed a physical process-death check. The active
  vehicle name was changed, the app process was force-stopped, and the value
  returned after relaunch. The test value was then removed, the app was killed
  again, and the original `My vehicle` fallback returned.
- The current evidence audit now discovers and hashes the source-bound
  `localParity` APK instead of silently preferring an older preview artefact.

Local generated evidence:

- `tmp/native-smoke/android-preview-smoke-2026-07-14T12-44-01-277Z.md`
- `tmp/native-smoke/android-performance-summary-2026-07-14T12-47-02-188Z.md`
- `tmp/native-smoke/android-cold-start-smoke-2026-07-14T12-47-05-472Z.md`
- `tmp/native-smoke/android-navigation-intents-2026-07-14T12-48-45-731Z.md`
- `tmp/native-smoke/android-notification-readiness-2026-07-14T12-51-20-873Z.md`
- `tmp/native-smoke/android-alert-delivery-gate-2026-07-14T12-53-40-429Z.md`
- `tmp/native-smoke/native-current-evidence-audit-2026-07-14T12-52-40.624Z.md`

## Limits and blockers

- Performance coverage is `controlled_beta_only`. All current measurements are
  from a high-end Pixel. Broad Android claims still require a current lower or
  mid-range physical device run.
- Real push delivery is not testable while the Production Expo delivery gate
  remains disabled. The readiness probe also correctly refuses an unscoped
  capability request without an installation identity. No synthetic route or
  alert write was sent to Production.
- The Pixel's raw ADB screenshot path alternated between clean frames and
  frames with black Google Maps compositor regions even when the live UI was
  unchanged. Four one-second static captures reproduced clean, black, clean,
  black output while the accessibility structure remained stable. Cold-start
  process and log evidence passed, but raw screenshot completeness must not be
  treated as an automated visual assertion until the harness accounts for this
  platform capture behaviour.
- This evidence does not prove Play signing, Play Console readiness, Android
  tablet layout quality, lower-end performance or delivered notifications.

## Decision

The exact current-source Android APK is suitable for controlled internal
testing on the Pixel 9 Pro. It is not sufficient for broad Android release or
public store approval.
