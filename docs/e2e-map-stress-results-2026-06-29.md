# E2E journey and map interaction stress results

Date: 2026-06-29

## Scope

This pass covered the first two product-system stress groups:

1. End-to-end journey stress tests.
2. Map interaction stress tests.

The goal was to find architecture, UX, integration and map-experience weaknesses using existing stress scripts first, then add focused coverage where the repo had a gap.

## E2E journey stress results

### Plan route browser journey

Command:

```bash
FUEL_PATH_PLAN_BROWSER_STRESS_PAIRS=30 FUEL_PATH_PLAN_BROWSER_STRESS_SNAPSHOTS=4 npm run test:plan-route-browser-clicks
```

Result: pass.

Evidence:

- JSON: `tmp/plan-route-browser-click-stress-2026-06-29T09-27-28-863Z.json`
- Report: `tmp/plan-route-browser-click-stress-2026-06-29T09-27-28-863Z.md`
- Screenshots: `tmp/plan-route-browser-click-stress-2026-06-29T09-27-28-863Z-screenshots/`

Coverage:

- 30 route pairs.
- 30 passed, 0 failed.
- 90 station marker selections requested.
- 90 station marker selections passed.
- State coverage included NSW, ACT, VIC, QLD, WA, SA, TAS and NT.
- Type coverage included capital, suburb, regional and remote routes.

Brutal read:

- The Plan journey is currently strong.
- Recent Plan-card regressions did not reappear: no giant `Navigate to this stop`, no `Suggested fuel stops`, no zero-value savings detour label.
- The journey still depends on mocked route/score responses, so it proves UI behaviour under controlled scenarios, not provider freshness.

### Plan route live API journey

Command:

```bash
FUEL_PATH_PLAN_LIVE_STRESS_PAIRS=30 npm run test:plan-route-live-api
```

Result: pass.

Evidence:

- JSON: `tmp/plan-route-live-api-stress-2026-06-29T09-27-29-047Z.json`
- Report: `tmp/plan-route-live-api-stress-2026-06-29T09-27-29-047Z.md`

Coverage:

- 30 live route pairs.
- 30 passed, 0 failed.
- 29 recommendations returned.
- 1 no-recommendation warning.
- No case recommended a more expensive station while a cheaper viable station existed under the current rules.

Brutal read:

- Backend route scoring is behaving defensibly across the tested national set.
- The one no-recommendation warning needs periodic review, but it is not currently a failure because remote/provider gaps are valid outcomes.

### Combined nearby rural/remote journey

Command:

```bash
npm run validate:combined-nearby-rural-remote
```

Initial result: failed.

Initial finding:

- `nt-tennant-creek` returned no fuel stations and no EV chargers.
- Both provider calls were structurally healthy, but the script treated a confirmed no-coverage location as a hard failure.

Iteration:

- Updated `scripts/validate-combined-nearby-rural-remote-smoke.mjs` to distinguish:
  - `pass`: at least one usable fuel or charger result.
  - `coverage_gap`: provider calls succeed but no fuel or charger results are available.
  - `fail`: HTTP/provider/malformed-response failure.
- Added JSON and Markdown evidence output.

Final result: pass with explicit coverage gap.

Evidence:

- JSON: `tmp/combined-nearby-rural-remote-smoke-2026-06-29T09-31-45-056Z.json`
- Report: `tmp/combined-nearby-rural-remote-smoke-2026-06-29T09-31-45-056Z.md`

Final coverage:

- 12 rural/remote cases.
- 11 passed with fuel or charger results.
- 0 provider failures.
- 1 coverage gap: `nt-tennant-creek`.
- 9 locations had charger results.
- 3 locations had no charger results.
- 0 poor EV metadata locations among locations with charger results.

Brutal read:

- Rural/remote combined coverage is mostly useful, but not universal.
- Tennant Creek must be treated as a deliberate empty/no-coverage journey, not a product promise gap hidden by optimistic UI.
- EV metadata remains thin: many locations have connector data but no power data.

### EV provider trial journey

Command:

```bash
npm run validate:ev-provider-trials -- --limit=8
```

Result: skipped.

Reason:

- `OPENWEB_NINJA_API_KEY` was not set locally.
- `API_NINJAS_API_KEY` was not set locally.

Brutal read:

- Local direct-provider trial validation is not currently reproducible without local keys.
- Production-backed EV validation is partially covered by the combined nearby rural/remote smoke.
- Next hardening step should make direct EV provider trial keys available through a safe local env path or add a production-only EV endpoint stress that does not require local provider secrets.

## Map interaction stress results

### Existing map camera/architecture guards

Command:

```bash
cd mobile-app && npm run test:map-camera
```

Result: pass.

Coverage includes:

- Web and native programmatic camera move guards.
- User-pan-only map-area search.
- Current-location pin separation.
- Station marker density limits.
- Nearby selected station card structure.
- Plan sheet map recovery controls.
- Android map smoke evidence guards.

Brutal read:

- The static architecture guard suite is broad and valuable.
- It does not replace browser-level map interaction coverage because it mostly checks implementation contracts, not live interaction behaviour.

### New live map interaction stress

Added:

```bash
npm run test:map-interactions
```

Script:

- `scripts/map-interaction-stress.mjs`

Final result: pass.

Evidence:

- JSON: `tmp/map-interaction-stress-2026-06-29T09-42-55-427Z.json`
- Report: `tmp/map-interaction-stress-2026-06-29T09-42-55-427Z.md`
- Screenshots: `tmp/map-interaction-stress-2026-06-29T09-42-55-427Z-screenshots/`

Coverage:

- 2 mobile viewports: `430x900` and `390x780`.
- Nearby default map state.
- Leaflet zoom controls.
- User drag/pan behaviour.
- Expanded station list state.
- Station marker selection.
- EV charge mode.
- EV simplified filters: `Any`, `AC`, `Fast`.
- Regression checks for old full-list copy, giant navigate button, station-detail heading, and `? kw` EV power display.

Initial findings and iterations:

- First run failed because the script measured the whole app shell as the sheet and mixed multiple map states together.
- Second run exposed a real leftover copy issue: selected Nearby state still included `Browse view. Full list for more.`
- Removed that old copy from `NearbyStationSheet`.
- Restructured the map stress into separate clean journeys so default-map, full-list, selected-card and EV states do not interfere with each other.

Brutal read:

- The map now has a reusable live interaction stress gate.
- Fuel Nearby map/list behaviour is much better protected than before.
- EV mode still looks less mature than fuel mode. It passes the stress gate, but the live UI still carries more directory/provenance noise and thinner metadata than fuel.
- The map stress currently checks behaviour and obvious text regressions, not visual quality scoring. Screenshot review is still manual.

## Code changes from this pass

- Added `scripts/map-interaction-stress.mjs`.
- Added package script `test:map-interactions`.
- Improved `scripts/validate-combined-nearby-rural-remote-smoke.mjs` with coverage-gap classification and evidence files.
- Removed old selected Nearby copy from `mobile-app/src/components/NearbyStationSheet.tsx`.

## Recommended next stress group

Next priority: provider integration chaos tests.

Why:

- E2E and map interaction are now covered.
- The app still depends on many external surfaces: state fuel providers, EV provider, G-NAF, geocoder fallback and route scoring.
- Provider failure behaviour is the next highest-risk architecture area.

Recommended chaos cases:

- EV provider timeout.
- EV provider returns no chargers.
- Fuel provider returns no stations.
- Fuel provider returns malformed station coordinates.
- G-NAF API unavailable.
- External geocoder slow or rate-limited.
- One state provider down while another works.
- Provider returns stale but usable price data.

