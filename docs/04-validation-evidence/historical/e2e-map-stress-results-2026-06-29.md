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


## Provider integration chaos stress results

Command:

```bash
npm run test:provider-chaos
```

Script:

- `scripts/provider-integration-chaos-stress.mjs`

Result: pass.

Evidence:

- JSON: `tmp/provider-integration-chaos-stress-2026-06-29T10-14-57-328Z.json`
- Report: `tmp/provider-integration-chaos-stress-2026-06-29T10-14-57-328Z.md`

Coverage:

- Production `/api/status` lookup readiness.
- Invalid station coordinates return clean client errors without stack leakage.
- NT fuel coverage gap returns explicit unsupported-region context, not a provider crash.
- Production sample fallback is disabled or explicit, with no accidental demo-price leakage.
- EV provider list exposes expected provider candidates.
- Unsupported commercial EV provider, PlugShare, returns pending-commercial-access context and no live availability claim.
- Invalid EV provider returns clean client error.
- Open Charge Map missing-key/live contract stays explicit and avoids live bay availability claims.
- Empty geocode query returns clean not-found error.
- G-NAF exact-address geocode still resolves as `fuel_path_gnaf` / `exact_address`.
- Missing route destination returns clean client error.
- Route score with impossible brand filter returns zero recommendations without crashing and preserves brand-filter context.
- API Ninjas EV malformed payload normalisation drops invalid rows, keeps valid connectors, and does not invent unknown power.
- Open Charge Map malformed payload normalisation drops invalid rows, keeps valid power/connector data, and avoids live availability overclaim.
- Simulated API Ninjas timeout throws a provider timeout error through the adapter layer.

Brutal read:

- Provider degradation contracts held in this run.
- The suite now covers both live-safe production behaviour and local injected EV adapter chaos.
- This still does not fully simulate every state fuel provider returning malformed payloads. NSW/WA/VIC/SA/TAS provider-specific malformed payload tests should be the next depth upgrade if provider chaos becomes a release blocker.
- NT remains a deliberate coverage-gap problem, not an integration crash.
- Open Charge Map remains not configured in production, so EV live data currently depends on the configured production EV provider path rather than OCM.

## State fuel provider malformed-payload chaos stress results

Command:

```bash
npm run test:state-fuel-chaos
```

Script:

- `scripts/state-fuel-provider-chaos-stress.mjs`

Final result: pass.

Evidence:

- JSON: `tmp/state-fuel-provider-chaos-stress-2026-06-29T11-04-15-119Z.json`
- Report: `tmp/state-fuel-provider-chaos-stress-2026-06-29T11-04-15-119Z.md`

Coverage:

- NSW FuelCheck malformed station and price rows.
- TAS FuelCheck state filtering, station-code prefixing and malformed rows.
- WA FuelWatch RSS malformed XML items, zero coordinates and tomorrow prices.
- VIC Servo Saver reference merging, fuel-type aliases, unavailable prices and unusable rows.
- QLD FPP Direct missing site rows, zero coordinates, unavailable prices and unknown fuel IDs.
- SA FPP Direct missing site rows, zero coordinates, unavailable prices and unknown fuel IDs.
- Cross-provider invariant: no returned station may have zero/zero coordinates, no prices, or non-finite price values.

Initial findings and iterations:

- First run failed on VIC because the fixture did not match the normaliser's actual fuel-type contract closely enough.
- After tightening the VIC fixture, the suite exposed a real aliasing issue: `Premium Diesel` normalised to `PREMIUM DIESEL` instead of `PDL`.
- NSW/TAS normalisation was hardened before the run so malformed price-only and `0,0` rows cannot appear as valid map stations.
- VIC fuel aliases now map `Premium Diesel` to `PDL`.

Brutal read:

- This materially improves backend resilience for live state provider data.
- The test is still contract-synthetic, not a replay of captured raw provider payloads. It covers known malformed-payload families, but not every possible future schema drift.
- WA, VIC, QLD and SA already had strong coordinate guards; NSW/TAS were the weaker edge and are now aligned with the rest of the provider layer.
- The next weakness is user-facing failure behaviour when these providers are unavailable, slow or empty, which belongs in the frontend failure-state UX stress pass.

## Frontend failure-state UX stress results

Command:

```bash
npm run test:frontend-failure-states
```

Script:

- `scripts/frontend-failure-state-stress.mjs`

Final result: pass.

Evidence:

- JSON: `tmp/frontend-failure-state-stress-2026-06-29T11-14-41-081Z.json`
- Report: `tmp/frontend-failure-state-stress-2026-06-29T11-14-41-081Z.md`
- Screenshots: `tmp/frontend-failure-state-stress-2026-06-29T11-14-41-081Z-screenshots/`

Coverage:

- Nearby fuel empty unsupported-region response.
- Nearby fuel provider error response.
- EV empty directory result.
- EV provider error in expanded charger list.
- Plan geocode provider failure.
- Plan route provider failure.
- Plan score empty eligible-station result.
- Cross-scenario guard for raw stack traces, TypeErrors, source-file leakage and misleading EV availability claims.

Initial findings and iterations:

- First run failed 5 of 7 scenarios.
- Two failures were harness false positives caused by expected browser 503 console noise, while the app rendered useful copy.
- Three Plan failures were harness navigation problems because the bottom tab is not exposed as a standard role button in this web build.
- After fixing tab navigation, one Plan geocode scenario still failed because the test used an exact-address-looking query and the app correctly blocked planning until the user confirmed a suggestion.
- The final scenario now uses place/suburb-style input to exercise the geocode outage path directly.

Brutal read:

- The app now has automated protection against catastrophic blank/error states for the main failure families.
- The copy is serviceable but not beautiful. It prevents confusion, but some outage messages are still generic rather than highly contextual.
- The script checks rendered text and raw-error leakage, not detailed visual quality.
- This pass increases confidence that provider and route failures do not strand users, but it does not prove every real provider outage will have perfect wording.

## Route recommendation adversarial stress results

Command:

```bash
npm run test:route-adversarial
```

Script:

- `scripts/route-recommendation-adversarial-stress.mjs`

Final result: pass.

Evidence:

- JSON: `tmp/route-recommendation-adversarial-stress-2026-06-29T11-20-33-953Z.json`
- Report: `tmp/route-recommendation-adversarial-stress-2026-06-29T11-20-33-953Z.md`

Coverage:

- Cheaper open viable station wins.
- Closed cheapest station loses and is absent when closed stations are excluded.
- Cheapest station outside smart detour threshold loses.
- Equal adjusted price favours shorter detour.
- Stale non-official price does not down-rank a cheaper viable station.
- Membership-only station is excluded by default.
- Invalid price and invalid coordinates are dropped.
- Zero c/L best-price lead receives neutral `Best route price` labelling rather than a savings-detour label.

Initial findings and iterations:

- First run failed the closed-cheapest case because the harness expected a closed station to remain present but rejected.
- The scorer actually excludes closed stations entirely when `includeClosed=false`, which matches the product rule.
- The assertion was corrected to require absence from candidates rather than rejected presence.

Brutal read:

- The focused recommendation rules held under adversarial fixtures.
- This is stronger than broad route-pair stress because it targets the exact ways the recommendation could feel wrong or misleading.
- The test does not prove real-world station freshness or opening-hours data is correct. It proves the scorer obeys the intended decision hierarchy when those fields are present.
- The backend decision summary can still internally call a zero-best-price route a saving via dollar economics, but the Plan UI rule is to override that with `Best route price`; this remains an important claim-safety audit item.

## Map density and performance stress results

Command:

```bash
FUEL_PATH_DENSITY_URL=http://localhost:8099 npm run test:map-density
```

Script:

- `scripts/map-density-performance-stress.mjs`

Final result: pass against local patched web app.

Evidence:

- JSON: `tmp/map-density-performance-stress-2026-06-29T11-28-20-823Z.json`
- Report: `tmp/map-density-performance-stress-2026-06-29T11-28-20-823Z.md`
- Screenshots: `tmp/map-density-performance-stress-2026-06-29T11-28-20-823Z-screenshots/`

Additional validation:

```bash
cd mobile-app && npm run typecheck
```

Result: pass.

Coverage:

- 2 mobile viewports: `430x900` and `390x780`.
- Dense fuel response with 820 mocked stations.
- Dense EV response with 360 mocked chargers.
- Marker cap enforcement for direct fuel price markers, clusters and EV markers.
- Leaflet zoom controls remain present.
- Bottom controls remain measurable and visible.
- Map drag after dense fuel rendering still leaves visible markers/clusters.
- EV density state does not show `? kw` and does not claim `available now`.

Initial findings and iterations:

- First production-targeted density run failed EV density because production still contains stale EV sheet copy: `Full list` and `Browse view. Full list for more.`
- The EV sheet was aligned with the newer Nearby fuel behaviour by removing the stale EV list-toggle copy and old browse helper line.
- The density test was rerun against a local patched web server because production does not yet include the local change.
- The local patched run passed 4/4 density cases.
- A local rerun of the older `test:map-interactions` gate failed because the local dev app did not receive live station data and the error sheet covered the zoom controls. That gate remains useful against production/live data or a future mocked-data variant, but it was not the acceptance gate for this local density patch.

Brutal read:

- Fuel density is in good shape: direct marker rendering stayed bounded and clustered under large metro-like loads.
- EV marker rendering is bounded at the current `maxStationMarkers` cap, but 240 EV markers is still visually noisy. It passes performance, not taste.
- EV UI consistency improved by removing stale `Full list` / browse-helper copy.
- The app still needs a mocked version of the broad map-interaction gate so local UI changes can be validated without relying on production provider availability.

## Claim-safety audit stress results

Command:

```bash
npm run test:claim-safety
```

Script:

- `scripts/claim-safety-audit-stress.mjs`

Final result: pass.

Evidence:

- JSON: `tmp/claim-safety-audit-stress-2026-06-29T11-42-13-367Z.json`
- Report: `tmp/claim-safety-audit-stress-2026-06-29T11-42-13-367Z.md`

Additional validation:

```bash
cd mobile-app && npm run typecheck
```

Result: pass.

Coverage:

- Plan UI does not mention `Suggested fuel stops`.
- Plan UI does not mention `Decision trade-offs`.
- Plan UI does not show `Fuel used`.
- Plan route notice does not mention `standard fill estimate`.
- Plan UI does not use `Route saving` as the displayed label.
- Plan UI does not show guaranteed total dollar saving copy.
- Plan recommendation uses `Best price by`.
- `Why this stop` uses `Best price by` and compares against the next-best route option.
- Selected Plan station detail hides the generic station-row `your adjusted price` line.
- EV UI does not show stale `Full list` helper copy.
- EV UI does not show `available now` claims.
- EV UI does not show unknown power as `? kw`.
- EV provider wording keeps `live bay status unknown` / no-live-availability-claim language.
- Logic document records next-best viable comparison, no total-dollar saving claims, and stale-price non-penalty.

Initial findings and iterations:

- First audit failed because stale Plan strings still existed: hidden `Suggested fuel stops`, `Fuel used` / route-saving language in unused evidence helpers, and dollar-saving recommendation reasons.
- Removed stale exported helper functions from `DecisionEvidencePanel` because they were unreferenced and carried retired claim wording.
- Changed Plan station-detail accessibility wording from `Show suggested fuel stops` to `Show route options`.
- Removed dollar-saving recommendation reasons from `PlanScreen.utils` and replaced them with route-price / detour-safe language.
- Updated `docs/route-recommendation-logic-rules.md` wording examples to use `Best price by` and next-best route option language.

Brutal read:

- The highest-risk visible claim surfaces now have a repeatable static audit.
- This does not replace rendered smoke testing after deployment; it prevents risky copy from being reintroduced into the source files.
- Backend route scoring still carries internal dollar economics for ranking. That is acceptable only while the UI and public copy avoid presenting it as a guaranteed user saving.

## Production smoke, mocked map interaction and wider stress rerun

Run window: 2026-06-29 12:10-13:08 AEST.

### Iterations forced by the stress work

- Production smoke initially failed EV Nearby because EV charger rows with missing `distanceKm` crashed the web UI. Fixed by rendering `Distance unknown` instead of calling `toFixed` on missing provider distance.
- Mocked map interaction initially exposed Leaflet zoom controls being blocked by the bottom sheet on phone/tablet. Fixed by raising the web zoom control above the lower sheet.
- Frontend failure-state stress initially hid EV provider errors behind a `0 chargers nearby` message. Fixed by showing EV provider errors in the visible charger sheet, not only the full sheet.

### Final passing evidence

| Gate | Evidence | Result |
|---|---|---:|
| Production smoke matrix | `tmp/production-smoke-matrix-stress-2026-06-29T12-52-28-760Z.json` | 9/9 pass |
| Mocked map interaction stress | `tmp/map-interaction-mocked-stress-2026-06-29T12-52-29-153Z.json` | 3/3 pass |
| Full Plan browser click stress | `tmp/plan-route-browser-click-stress-2026-06-29T12-20-52-635Z.json` | 300/300 routes, 900/900 station clicks pass |
| Full live Plan API stress | `tmp/plan-route-live-api-stress-2026-06-29T12-54-39-174Z.json` | 300/300 pass, 1 NT coverage warning |
| Map density and performance | `tmp/map-density-performance-stress-2026-06-29T12-46-53-110Z.json` | 4/4 pass |
| Frontend failure-state UX | `tmp/frontend-failure-state-stress-2026-06-29T12-51-06-689Z.json` | 7/7 pass |
| Provider integration chaos | `tmp/provider-integration-chaos-stress-2026-06-29T12-46-18-375Z.json` | 15/15 pass |
| State fuel provider malformed payload chaos | `tmp/state-fuel-provider-chaos-stress-2026-06-29T12-46-18-381Z.json` | 7/7 pass |
| Route recommendation adversarial scoring | `tmp/route-recommendation-adversarial-stress-2026-06-29T12-46-18-763Z.json` | 8/8 pass |
| Module-level Plan route recommendation stress | `tmp/plan-route-recommendation-stress-2026-06-29T12-46-19-713Z.json` | 300/300 pass |
| Claim-safety audit | `tmp/claim-safety-audit-stress-2026-06-29T12-46-19-701Z.json` | 20/20 pass |
| Rural/remote combined nearby smoke | `tmp/combined-nearby-rural-remote-smoke-2026-06-29T12-54-00-253Z.json` | 11/12 pass, 1 expected coverage gap |
| Mobile app typecheck | `cd mobile-app && npm run typecheck` | pass |

### Brutal critique after this pass

- The app is much more resilient than before this run: the stress work found and fixed one real EV runtime crash, one real map-control overlap, and one real EV outage-message visibility issue.
- The strongest remaining product limitation is not route/scoring stability. It is data coverage and quality: NT live fuel remains unavailable, Tennant Creek is a combined fuel/EV coverage gap, and API Ninjas EV metadata is often thin with missing power values.
- The EV provider trial script is not useful from this terminal without local `OPENWEB_NINJA_API_KEY` or `API_NINJAS_API_KEY`; production EV results do work through deployed server configuration, but local provider-trial evidence remains skipped.
- Browser stress is now strong for controlled UI states and route journeys, but not yet a substitute for physical-device native map smoke.

## Limitations follow-up: EV cascade and rural/remote coverage

Run window: 2026-06-29 17:57-18:11 AEST.

### Changes made

- Nearby EV app calls no longer hard-pin `api_ninjas`; the backend can now use its configured default provider and zero-result cascade.
- EV provider fallback now tries configured OpenWeb Ninja when the primary provider returns zero chargers, before Open Charge Map.
- EV charger sorting now tolerates missing `distanceKm` instead of producing unstable ordering.
- EV provider trial smoke can run in `--proxy` mode against the deployed `/api/ev-chargers` endpoint, so local terminal secrets are not required for coverage evidence.
- Rural/remote combined smoke now performs and reports an expanded 100 km search before declaring a true coverage gap.

### Evidence

| Gate | Evidence | Result |
|---|---|---:|
| EV provider proxy comparison | `node scripts/validate-ev-provider-trial-smoke.mjs --proxy --provider=openweb_ninja,open_charge_map,api_ninjas --limit=5` | OpenWeb Ninja 5/5 NT, API Ninjas 3/5 NT, OCM 0/5 NT |
| Rural/remote combined nearby smoke | `tmp/combined-nearby-rural-remote-smoke-2026-06-29T18-04-17-232Z.json` | 12/12 pass, 0 coverage gaps |
| Tennant Creek default EV cascade probe | `/api/ev-chargers` with no provider override | provider `api_ninjas+openweb_ninja`, 2 chargers |
| EV provider unit tests | `node --test tests/api/ev-chargers.test.js` | 12/12 pass |
| Mobile app typecheck | `cd mobile-app && npm run typecheck` | pass |
| Production smoke matrix | `tmp/production-smoke-matrix-stress-2026-06-29T18-09-46-483Z.json` | 9/9 pass |
| Frontend failure-state UX | `tmp/frontend-failure-state-stress-2026-06-29T18-10-58-983Z.json` | 7/7 pass |
| Provider integration chaos | `tmp/provider-integration-chaos-stress-2026-06-29T18-05-11-381Z.json` | 15/15 pass |
| Claim-safety audit | `tmp/claim-safety-audit-stress-2026-06-29T18-05-11-264Z.json` | 20/20 pass |

### Brutal read

- The Tennant Creek combined coverage gap is addressed for EV: production default search now falls through to OpenWeb Ninja and returns two charger candidates.
- NT live fuel pricing is still not addressed. The app remains honest about this: NT fuel returns the national-provider-matrix warning until a live NT fuel source is approved.
- EV metadata is materially better in fallback cases like Mount Isa, Coober Pedy and Tennant Creek because OpenWeb rows include power values, but API Ninjas-only locations still often have thin power metadata.
- OpenWeb Ninja is slower than API Ninjas in the proxy comparison, so the fallback should remain zero-result recovery rather than first-choice everywhere unless we later optimise or pay for a better provider.
