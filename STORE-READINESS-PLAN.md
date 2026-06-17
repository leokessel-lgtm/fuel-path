# Apple And Android Store Readiness Plan

## Scope

Fuel Path is planned as a whole-of-Australia fuel decision app. Store readiness must cover the native mobile app, backend data providers, location use, saved-route alerts, prediction language and third-party map/search providers.

## Store Submission Goals

- Pass Apple App Review and Google Play review without hiding location, notification or fuel-data limitations.
- Keep the core route decision flow ad-free and lean.
- Avoid unsupported claims about prediction accuracy, public provider access or guaranteed savings.
- Ensure every provider limitation is visible in-app before users act on a recommendation.

## Required App Disclosures

| Area | Store disclosure | Product rule |
| --- | --- | --- |
| Location | Precise location may be used to find nearby stations, plan routes and save route context after user action. | No passive route inference. No background location in v1. |
| Notifications | Route alerts are opt-in and tied to saved routes. | Alerts send only after freshness, saving, region capability and duplicate-suppression gates pass. |
| User profile | Vehicle, fuel type, discounts, Home/Work and saved routes are used to calculate recommendations. | Pump price remains visible beside adjusted user price. |
| Fuel prices | Prices come from official or permitted provider feeds where available, with visible freshness/source status. | Stale, restricted or unsupported prices cannot silently win the top recommendation. |
| Predictions | Cycle guidance appears only where back-tested evidence supports it. | No accuracy claims without measured error evidence. |
| Maps/search | Map tiles, routing and autocomplete may use third-party providers through backend or native SDKs. | Provider keys stay backend-side where possible. Mobile keys must be restricted. |

## Privacy Checklist

- [ ] Privacy policy published and linked from store listings.
- [ ] Location purpose strings explain nearby search, route planning and saved-route alerts plainly.
- [ ] Notification purpose string explains saved-route fuel alerts, not generic marketing.
- [ ] No background location permission requested for v1.
- [ ] No contacts, photos, microphone, camera or tracking permission requested.
- [ ] Home/Work and recents have clear remove/clear controls.
- [ ] Logs exclude precise route, Home/Work, push tokens and provider secrets.
- [ ] Backend alert storage uses write tokens and does not expose public mutation endpoints.
- [ ] Data retention rule documented for saved routes, recents, prediction back-tests and alert records.

## API And Data Usage Constraints

| Provider/area | Before public release |
| --- | --- |
| NSW/ACT FuelCheck | Confirm app/commercial usage, caching, attribution and public-sharing conditions. |
| QLD Fuel Prices | Confirm licence obligations and attribution for public/commercial release. |
| WA FuelWatch | Confirm attribution and caching rules for today/tomorrow prices. |
| VIC Servo Saver | Implement only after approved API access and schema are available. |
| SA | Implement only after approved data/API path is confirmed. |
| TAS | Implement only after approved data/API path is confirmed. |
| NT MyFuel | Implement only after approved data/API path is confirmed. |
| Google Maps/Places/Routes | Use restricted keys, billing caps, session tokens, field masks and monitoring before live production enablement. |
| Nominatim | Keep as validation fallback only, not production autocomplete. |

## Native Build Gates

- [ ] EAS project id configured.
- [ ] Android Google Maps key restricted by package name and SHA certificate.
- [ ] iOS map configuration validated on device.
- [ ] Expo push token registration tested on physical iOS and Android devices.
- [ ] Notification permission states tested: undetermined, granted, denied and unavailable.
- [ ] Location permission states tested: undetermined, granted, denied, blocked and services off.
- [ ] Cold start, first map interaction and route planning performance baseline captured.
- [ ] App size baseline captured and dependency growth reviewed.

## Store Listing Guardrails

Use:

- "Find better-value fuel stops on your route."
- "Shows source, freshness and confidence before you drive."
- "Route alerts for saved trips when the saving is worth checking."

Avoid:

- "Always cheapest fuel."
- "Guaranteed savings."
- "Predicts fuel cycles accurately."
- "Live prices everywhere in Australia" until every jurisdiction is truly live.

## Release Test Regime

- Run mobile `npm test`, `npm run build:web` and backend API regression tests.
- Run the route-editor break-it matrix in `mobile-app/ROUTE-EDITOR-BREAK-IT-TESTS.md`.
- Run local and production browser smoke for Plan, Nearby and Account.
- Run native device checks for maps, location and notifications.
- Run provider capability checks for NSW, ACT, QLD, WA, VIC, SA, TAS and NT.
- Run privacy/security checks: no exposed keys, no sensitive logs, protected alert endpoints, production headers.
- Record failures as P0, P1 or P2 with region, fuel, route, viewport/device and provider context.

## Done Definition

Store readiness is done only when:

- Privacy policy and store data safety forms match actual app behaviour.
- Provider usage constraints are confirmed or blocked regions are labelled honestly.
- Native iOS and Android device validation passes.
- Push delivery remains disabled until token, permission, scheduler and cost gates are proven.
- No unsupported prediction, pricing, coverage or savings claim appears in the app or listing.
