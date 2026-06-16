# Fuel Path TODO

## Next Decision

- [x] Prepare API.NSW unblock plan and credential validation script.
- [x] Register/subscribe for API.NSW Fuel API credentials.
- [x] Validate registered API.NSW credentials and live v1 price endpoint.
- [x] Validate QLD Fuel Prices Direct Outbound API production access.
- [x] Add local server-side proxy for live API.NSW scoring in the web demo.
- [x] Prepare validation demo pack and paste-ready API.NSW support note.
- [x] Stop and capture strategic reflection against initial objectives.
- [x] Run synthetic validation dry run across target participant segments.
- [x] Research consumer fuel discounts, loyalty offers and fleet cards.
- [x] Add classic around-me map view with fuel and brand filters to the demo.
- [x] Convert route view into an interactive map with highlighted route stops and nearby context stations.
- [x] Split the web demo into top-level Plan Trip, Near me and Account experiences.
- [x] Add Account tab with demo registration-based vehicle profile setup.
- [x] Add configurable Google Maps provider with OpenStreetMap fallback.
- [x] Replace route/scenario controls with From and To address fields.
- [x] Add cost-aware explicit route planning and route-cache status.
- [x] Add saved-route alert profiles for commute and safe regional examples.
- [x] Record the three main project goals and Goal 1 build roadmap.
- [x] Merge whole-of-Australia roadmap, success metrics and break-it testing regime into project docs.
- [ ] Prove Goal 1: Best Fuel Decision, Not Another Map.
- [x] Build national provider capability matrix for NSW, ACT, QLD, VIC, SA, WA, TAS and NT.
- [x] Expose regional capability state in backend `/api/status` and user-facing empty/limited states.
- [x] Add provider contract tests for capability labels: live, limited, pending_access, fallback and unsupported.
- [x] Fix empty-result handling for long routes such as Sydney to Canberra.
- [x] Connect ranked results and map markers both ways.
- [x] Simplify the recommendation card into one clear action, reason and trust cue.
- [x] Strengthen source, freshness, availability and eligibility warnings in the recommendation flow.
- [x] Add adaptive route-corridor scoring fallback and regression coverage.
- [x] Confirm ACT feed coverage is exposed through the live API.NSW FuelCheck feed.
- [x] Run first internal validation pass against the current prototype.
- [x] Fix invalid typed-route fallback so unresolved addresses do not show sample-corridor recommendations.
- [ ] Run real validation sessions with recruited participants.
- [ ] Confirm permitted app/commercial usage for FuelCheck data.
- [x] Build a small sample-data web demo around the existing route-scoring engine.
- [x] Add discount rules fixture to the web demo.
- [x] Show pump price, confirmed user price and possible lower price in demo search results.
- [ ] Confirm whether the live web demo can be shared publicly after usage rights are confirmed.
- [x] Add internal validation address typeahead suggestions for suburbs, addresses and POIs.
- [x] Limit long-route ranked results to a decision-sized set with progressive expansion.
- [x] Make stale-price severity reduce recommendation confidence more strongly.
- [x] Exclude live FuelCheck prices older than 48 hours from route recommendations while keeping them visible as map context.
- [x] Add live brand/network discount rules on top of FuelCheck station data.
- [x] Add visible saved-route alert card in Plan.
- [x] Apply map-first Plan UI and capture design system direction.
- [x] Create first Expo / React Native shell for Nearby, Plan and Account using the local Fuel Path backend.
- [x] Smoke test native web preview against live NSW/ACT FuelCheck responses.
- [ ] Smoke test native web preview across national capability cases, including live, limited, pending and unsupported regions.
- [x] Add working interactive map tiles and branded station pins to the Expo web preview.
- [x] Draw planned trips from real route geometry instead of a straight endpoint line.
- [x] Make Nearby location editable, defaulting to the Sylvania validation address and supporting independent suburb/address searches.
- [x] Rename Nearby sort controls to Closest, Cheapest and Best value, with Cheapest scoped to the current map view where available.
- [x] Convert Nearby to a full-map layout with a collapsible ranked-results sheet.
- [x] Add route-led map camera behaviour with dynamic breathing room and selected-station focus.
- [x] Add native `react-native-maps` provider behind the existing StationMap component for iOS/Android builds.
- [ ] Configure production Google Maps Android API key and run device builds for iOS/Android map validation.
- [x] Replace browser-only current-location shim with Expo Location foreground permission flow for Nearby and Plan Trip.
- [x] Choose Google Places Autocomplete (New) as the preferred production address/POI provider behind the Fuel Path backend.
- [x] Make Plan Trip address lookup session-token aware for future production autocomplete billing.
- [x] Add backend `/api/geocode` provider adapter for Google, Mapbox, HERE, Geoapify and Nominatim fallback.
- [ ] Implement Google Places Autocomplete (New) backend adapter after billing/API-key controls are approved.
- [x] Add QLD provider adapter after fuel ID and region mapping are confirmed.
- [x] Add first WA FuelWatch provider adapter for Perth/metro live Nearby and route scoring.
- [ ] Expand WA FuelWatch provider beyond metro queries without excessive provider requests.
- [ ] Apply for VIC Servo Saver Public API access and implement adapter after approved schema is available.
- [ ] Confirm SA fuel data/API access path and implement adapter after approved schema is available.
- [ ] Confirm TAS fuel data/API access path and implement adapter after approved schema is available.
- [ ] Confirm NT MyFuel data/API access path and implement adapter after approved schema is available.
- [ ] Add saved commutes and notification permission flow.
- [x] Design backend push scheduler for price-triggered saved-route alerts.
- [ ] Implement backend push scheduler for price-triggered saved-route alerts after native notification validation.
- [ ] Add prediction back-testing storage before any prominent user-facing prediction claim.
- [ ] Add no-cycle-signal states for unsupported fuels, regions and sparse histories.
- [ ] Add break-it test evidence to every new backlog item before marking it done.
- [ ] Prepare Apple/Android store readiness plan, including privacy disclosures and API usage constraints.

## External Blockers

- Real validation sessions need recruited participants and scheduled sessions.
- National provider usage, caching, attribution and public-sharing permissions need confirmation by jurisdiction.
- FuelCheck app/commercial usage, caching rules and public-sharing permission need API.NSW confirmation.
- QLD usage constraints still need confirmation against the licence terms before public/commercial launch.
- VIC Servo Saver live prices need approved API access and schema before implementation.
- SA fuel data/API access needs confirmation before implementation.
- TAS fuel data/API access needs confirmation before implementation.
- NT MyFuel data/API access needs confirmation before implementation.
- Google Places production autocomplete still needs billing controls, restricted keys, backend adapter and device validation.

## Done Gate

- Every new backlog item needs user story, success metrics and break-it test evidence.
- Use `NATIONAL-TESTING-REGIME.md` for feature, integration, accessibility, performance and post-deploy checks.
