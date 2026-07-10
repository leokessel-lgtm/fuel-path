# Fuel Path Stabilisation Cut - 21 June 2026

## Branch

Current local branch:

```text
stabilise/latest-local-build
```

Use this branch as the latest local build branch while feature work is paused.

The repo-level split between this stabilisation slice, backlog/product-hardening work and generated artefacts is recorded in `docs/archive/repository/repo-change-split-2026-06-21.md`.

## Latest Local App Surface

Open:

```text
http://localhost:8081
```

The Expo/mobile app shell is the latest local app surface. It has the current Fuel Path logo, top-right vehicle shortcut into Account, and native-style Plan, Nearby and Account layout.

## Web Demo Validation Harness

Open:

```text
http://localhost:4175/web-demo/
```

The web demo is the local validation harness for route scoring, price markers, provider behaviour and web-specific safety checks. It is not the latest app shell and should not be used as visual proof of the newest app chrome.

## Stop Rule

Do not add new product or architecture feature scope until these surfaces have been rechecked:

- Plan route flow, ranked stops, map pins and saved-route switching
- Nearby map/list flow, brand filters and selected station detail
- Account vehicle, discount wallet, saved places, policy mode and saved-route alerts
- Mobile architecture guards and native map marker semantics
- Beta readiness blockers remain explicit rather than softened

## Current Stabilisation Fix

The web-demo map station logos were visually degraded because marker images could render at source dimensions inside a tiny Leaflet marker cell, and the local page could keep an old JS/CSS bundle due to stale cache keys.

Current fix:

- `web-demo/app.js` emits bounded inline dimensions for marker logo images
- `web-demo/styles.css` hard-scopes price-pin logo sizing
- `web-demo/index.html` versions local CSS and JS cache keys
- `tests/api/web-demo-safety.test.js` guards the marker logo and cache-key contract

Browser verification confirmed all `136/136` visible map marker logo images are bounded to the marker cell.

## Current Native Evidence

Android physical-device validation is current for the local parity APK:

- APK: `mobile-app/native-artifacts/fuel-path-preview-android-local-parity-8199f828.apk`
- Smoke: `tmp/native-smoke/android-preview-smoke-2026-06-20T20-59-06-687Z.md`
- Performance summary: `tmp/native-smoke/android-performance-summary-2026-06-20T21-12-06-531Z.md`
- Device: Pixel 9 Pro `49231FDAP0017N`
- Result: Plan, Nearby and Nearby-after-pan map screenshots non-blank, no Maps warning lines, 186 frames, 1 janky frame, p95 8 ms and p99 11 ms

Beta readiness now remains blocked on provider terms evidence, fresh Android installed-build/physical-performance evidence for the current build, privacy/store evidence and support readiness. Source-level iOS simulator validation is captured, but signed iOS preview/development and push-token validation remain future store-readiness work.

## Tree Simplification

Immediate cleanup already applied:

- local automation folders are ignored through `.gitignore`
- native build artefacts are ignored
- latest app shell and web-demo validation harness are documented separately

Next cleanup should be conservative:

- keep generated evidence in `tmp/` or dated docs, not mixed into source code changes
- move root-level narrative documents into `docs/` only after the stabilisation cut passes
- keep web-demo changes focused on visible validation behaviour
- avoid adding new mobile screen logic until existing Plan, Nearby and Account guards are green

## Verification Commands

```bash
node --test tests/api/web-demo-safety.test.js
npm run check:secret-hygiene
cd mobile-app && npm test
npm run check:beta-readiness -- --api-base https://fuel-path.vercel.app --store-evidence-json docs/templates/STORE-PUBLISHING-EVIDENCE.template.json --provider-terms-evidence-json docs/templates/PROVIDER-TERMS-EVIDENCE.template.json --allow-blocked
```
