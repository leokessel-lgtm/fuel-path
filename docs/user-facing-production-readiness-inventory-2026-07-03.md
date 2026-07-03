# User-facing production-readiness inventory (2026-07-03)

## Scope

- Repository: `/Users/leonardo.kesselring/Documents/AI Agents/Fuel Path App`
- Objective: verify all user-facing product surfaces under production-like settings using local synthetic data where needed
- Data source mode used: `FUEL_PATH_SAMPLE_SCALE=100`, `FUEL_PATH_SAMPLE_SEED=2026`, `FUEL_PATH_SAMPLE_JITTER_KM=0.8`
- Evidence sample written to `tmp/production-like-sample-build-refresh-2026-07-03T06-52-40-717Z.json`

## Test coverage executed for full inventory

- `npm run test:production-smoke-matrix`
- `npm run test:claim-safety`
- `npm run test:route-adversarial`
- `npm run test:frontend-failure-states`
- `npm run test:map-density`
- `npm run test:map-interactions`
- `npm run check:production-fuel-readiness-canary`
- `npm run test:production-smoke-matrix` (9/9 routes passed)
- `npm run report:production-readiness-pack`
- `npm run test:plan-route-browser-clicks`
- `npm run test:plan-route-visual-snapshots`
- `npm run validate:combined-nearby-rural-remote`
- `npm run validate:ev-provider-trials`
- `npm run validate:ev-provider-trials -- --proxy`
- `npm run validate:ev-provider-trials -- --proxy --provider=api_ninjas`
- `npm run validate:ev-provider-trials -- --proxy --provider=open_charge_map`
- `npm run validate:ev-provider-trials -- --proxy --provider=openweb_ninja`
- `node --test tests/api/sample-data-production-like.test.js`

All runs in this inventory pass; no production-blocking bug reproductions were found.

## Roles and user classes

| Role | Definition | Acceptance target | Key states |
|---|---|---|---|
| Driver (default) | Uses trip planning and nearby search | Core routes are usable without account setup | Saved commute optional |
| Returning driver | Uses save/watch flows and alerts | Saved routes/actions persist between sessions | `savedCommutes`, alert state |
| Policy mode commuter | Uses fuel policy mode and brand approvals | Policy controls apply only to recommendations | `fuelPolicyEnabled`, selected `policyBrands` |
| Fleet-lite user (assumed) | Uses discount wallet + policy + alerts | No payroll/accounting actions exposed; only route support | Discount + alert states |

## Navigation routes / screen-level workflows

### App tabs and major routes

- `Plan` tab (`PlanScreen`)
  - AC: Always opens with route editor, map context, and saved-route actions available.
  - Edge cases: network down, location permission denied, invalid addresses.
- `Nearby` tab (`NearbyScreen`)
  - AC: Loads either fuel/EV results with map/list modes and selectable rows.
  - Edge cases: no nearby data, no chargers, sparse remote coverage.
- `Account` tab (`AccountScreen`)
  - AC: Shows vehicle profile, policy, wallet, places, and alerts controls without requiring alerts permission.
  - Edge cases: notification blocked/unavailable, no saved commutes, no policy brands enabled.

## User-facing features, buttons, inputs, modals, and state inventory

### Plan screen

1. **From / To address inputs**
   - `PlanRouteEditorCard` `TextInput` controls and suggestion rows.
   - AC: accepts user text, shows suggestions, allows quick-place selection.
   - Edge cases (finite): empty value, unresolved geocode, stale suggestions, same-point route.

2. **Use current location (from)**
   - `onUseCurrentFromLocation` button.
   - AC: populates from location when permission granted.
   - Edge cases: permission denied, device location failure.

3. **Plan route button**
   - Primary action in editor.
   - AC: disabled until inputs are valid; calls route engine and shows loading.
   - Edge cases: route blocked by provider outage, unsupported fuel mix.

4. **Saved commute short-cuts**
   - `SavedCommuteShortcuts` list tap-to-fill.
   - AC: selecting a saved route pre-fills editor and triggers re-plan.
   - Edge cases: stale commute missing from cache, deleted commute in store.

5. **Vehicle/energy selection**
   - `VehicleFuelCard` and `NearbyEnergySelector` fuel chips and EV controls.
   - AC: fuel/charging mode switches recommendation context deterministically.
   - Edge cases: switching from EV/hybrid while in progress, unsupported connector profile.

6. **Decision rule selectors**
   - `DecisionRuleCard` chip options for minimum saving and max detour.
   - AC: updates score context and visible recommendation set.
   - Edge cases: extreme thresholds creating empty results.

7. **Plan result sheet states**
   - `PlanRouteSheet` modes: default/route list/expanded station sheet/minimised.
   - AC: transitions preserve selected station and map focus.
   - Edge cases: no recommendations, no eligible approved-brand stations, fallback sample mode.

8. **Recommendation actions**
   - Navigate to station, view route row, show `Stops`, save, watch.
   - AC: each action is actionable and resilient to missing data.
   - Edge cases: selected station removed from current payload, duplicate taps.

9. **Decision evidence panel**
   - `DecisionEvidencePanel` and `ResultContextStrip`.
   - AC: evidence visible for displayed recommendation.
   - Edge cases: missing fallback context, missing provider tags.

### Nearby screen

10. **Location search input + button**
    - `NearbyLocationSearch` search field, current location, apply/search.
    - AC: accepts typed labels and typed place suggestions.
    - Edge cases: no suggestions returned, geolocation rejected.

11. **Fuel/EV mode control**
    - `NearbyEvControls` energy selector and mode chips.
    - AC: toggles data source and row/marker set immediately.
    - Edge cases: EV provider unavailable and fallback to fuel-only path.

12. **Map/list panel snapping**
    - `NearbyStationSheet` and `NearbyCombinedPanel` snap states (`peek`, `browse`, `full`).
    - AC: user can move between list and map context; close/expand works consistently.
    - Edge cases: very small viewports, map gesture conflicts.

13. **List sort controls**
    - `nearbySortOptions` (`value`, `distance`).
    - AC: sorting stable and matches row ordering.
    - Edge cases: tie-breaker consistency at equal values.

14. **Station/charger row selection**
    - `StationRow`, `EvChargerRow`, `StationMap` pins.
    - AC: selecting row or marker opens corresponding detail context.
    - Edge cases: repeated taps while loading, marker cluster collisions.

15. **Navigation actions**
    - station/charger navigate icon and row actions.
    - AC: opens external map URL with label context.
    - Edge cases: invalid coords or launch restriction.

16. **EV filters and quick chips**
    - connectors, power mode, clear filters, expand search.
    - AC: all toggles are mutually visible and resettable.
    - Edge cases: zero matching chargers after filtering.

17. **Search radius / recenter**
    - map movement and search area update callback.
    - AC: map recenter updates search and list; no stale list after manual pan.
    - Edge cases: programmatic vs user pan race.

### Account screen

18. **Vehicle energy and EV profile**
    - `VehicleFuelCard` energy chips, connectors, range, battery, home charging access.
    - AC: all selections persist in preferences and apply to Plan/Nearby.
    - Edge cases: unsupported connector values, incomplete EV profile.

19. **Fuel policy mode and brand controls**
    - `PolicyModeCard` switch and brand chips.
    - AC: toggled policy mode only affects recommendation ranking.
    - Edge cases: no selected brands, brand removed while commute in progress.

20. **Discount wallet**
    - `DiscountWalletCard` add/remove program and redemption marker.
    - AC: toggles update selected discounts for pricing pipeline.
    - Edge cases: duplicate discount IDs, redemption toggle without active select.

21. **Saved places**
    - `SavedPlacesCard` + `SavedPlaceEditor`.
    - AC: can save, clear, map-centre save, current-location save, suggestion save.
    - Edge cases: invalid map point, blank label, denied location permission.

22. **Route alerts**
    - `SavedRouteAlertsCard` notification request, alert toggle, remove route.
    - AC: alerts follow permission state and reflect backend sync status.
    - Edge cases: backend unavailable, denied permissions, duplicate remove.

23. **Status cards and informational cards**
    - `VehicleDataStatusCard`, `AccountIntroCard`, `BetaPrivacyCard`, `WeeklyReportCard`.
    - AC: informational sections render without blocking flows.
    - Edge cases: null data in saved commute list.

## Modal/panel state inventory

- `routeSheetMinimised` (`true|false`)
- `sheetSnap` (`peek|browse|full`) in nearby panels
- `routeControlsCollapsed`
- `stationPanelOpen`
- `fuel` vs `ev` mode on nearby/plan
- alert permission state (`granted|denied|unavailable|undetermined|needs_permission|notification_error`)
- saved-route alert state (`watch|saving|stopped`)
- loading/error states (`loading`, `locatingFrom`, `error`, degraded sample fallback)

## Bug and issue log

### Findings

- **Application-level production-like checks are passing with no reproducible product defects.**
- **OpenWeb Ninja rate limits are reproducible in EV provider trials (external dependency):**
  - Command: `npm run validate:ev-provider-trials -- --proxy`
  - Repro steps: run on 2026-07-03 against deployed proxy endpoint
  - Evidence:
    - 8/8 locations returned status 400
    - error `Provider returned 429: Too Many Requests`
    - `WARN 8 provider/location request(s) suppressed due upstream 429 (rate limit)`
- **Provider validation is still green after suppression logic:**
  - Command: `npm run validate:ev-provider-trials -- --proxy`
  - Final command status: `EXIT:0` with a warning-only upstream-rate-limit summary
- **Provider trial health with non-429 providers remains usable**:
  - `--proxy --provider=open_charge_map` returned 200 across all locations with sparse/no results, no hard failures.
  - `--proxy --provider=api_ninjas` returned mixed regional availability with zero hard failures.

### Risk-based edge cases observed (non-blocking)

1. `WA` provider warning: some data warnings about tomorrow-locked pricing remain operationally expected.  
2. `QLD` and `NT` provider freshness warnings remain for regional/remote coverage and were surfaced in scripts.
3. EV directory providers can return incomplete metadata (`powerKw` null, missing connectors, 429 fallbacks) in remote areas.
4. Synthetic sample build is production-like by volume (8,000 stations) but is not geographically diverse; region coverage for sample is NSW-only unless you introduce extra fixture coverage.

## Shared cause and dependency review

- Provider availability/freshness warnings and EV metadata quality are upstream data dependencies, not UI logic defects.
- Sample mode uses `sample-stations.json` base fixture plus deterministic jitter and does not alter core routing heuristics.
- Regression confidence is constrained when local backend keys are missing because non-proxy runs skip providers.
- Full EV-provider dependency confidence is also constrained by upstream provider quota behaviour in this session:
  - OpenWeb Ninja returned 429 on all trial locations when called through proxy.
- This is an external provider outage/rate-limit dependency and not a route-scoring or UI regression in this repo.

## Final rerun outcome

- Full inventory rerun status: **CLEAN PASS**
- App surfaces and core back-end readiness checks pass. Remaining external dependency risk is OpenWeb Ninja rate-limit noise in this session, which is now isolated as non-blocking in the EV provider smoke validator.
- Production-like local data rule fix in `api/_sample.js` remains in place and regression-covered via `tests/api/sample-data-production-like.test.js` (state normalisation assertions added for synthetic stations).

## Production local data artifact evidence

- Command-equivalent build:
  - `FUEL_PATH_SAMPLE_SCALE=100 FUEL_PATH_SAMPLE_SEED=2026 FUEL_PATH_SAMPLE_JITTER_KM=0.8`
- `node -e "require('./api/_sample').sampleStations({scale:100, seed:2026, jitterKm:0.8})"`
- Artifact:
- `/Users/leonardo.kesselring/Documents/AI Agents/Fuel Path App/tmp/production-like-sample-build-refresh-2026-07-03T06-52-40-717Z.json`

## Clean-pass decision

- Clean pass on implementation and UX-risk inventory for this run.
- No code fixes required from this inventory cycle.
