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

- [ ] Privacy policy published and linked from store listings. The policy page is live at `https://fuel-path.vercel.app/web-demo/privacy`; store publication remains blocked until the correct privacy contact method, Fuel Path-owned public policy URL, Apple App Store listing, Google Play listing, Apple privacy review, Google Data Safety review, provider limitation disclosure and support process are confirmed. Store data-safety preparation is in `STORE-DATA-SAFETY.md`; publication gates are tracked in `PRIVACY-PUBLISHING-CHECKLIST.md`.
- [x] Location purpose strings explain nearby search and route planning plainly in the Expo location plugin config.
- [x] Notification purpose is framed in-app as saved-route fuel alerts, not generic marketing.
- [x] No background location permission requested for v1.
- [x] No contacts, photos, microphone, camera or tracking permission requested.
- [x] Home/Work and recents have clear remove/clear controls. Home/Work clear from Account; persisted Plan recents support per-item remove and clear-all.
- [x] Logs and provenance telemetry exclude precise route, Home/Work, push tokens and provider secrets.
- [x] Backend alert storage uses write tokens and rejects unauthorised mutation requests.
- [x] Data retention rule documented for saved routes, recents, prediction back-tests and alert records in `DATA-RETENTION-RULES.md`; protected backend retention cleanup and explicit saved-route delete sync are implemented.

## API And Data Usage Constraints

| Provider/area | Before public release |
| --- | --- |
| NSW/ACT FuelCheck | Confirm app/commercial usage, caching, attribution and public-sharing conditions, then set `FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED=1`. Production is fail-closed until then. |
| QLD Fuel Prices | Confirm licence obligations and attribution for public/commercial release, then set `FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED=1`. Production is fail-closed until then. |
| WA FuelWatch | Confirm attribution and caching rules for today/tomorrow prices. |
| VIC Servo Saver | Live adapter is implemented. Keep API key server-side, preserve attribution/non-endorsement copy, and pass the provider evidence gate before public live-price claims. |
| SA | Implement only after approved data/API path is confirmed. |
| TAS | Confirm API.NSW/FuelCheck TAS usage, caching and attribution terms, then set `FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED=1`. Adapter exists for internal validation, but production is fail-closed until terms evidence passes. |
| NT MyFuel | Implement only after approved data/API path is confirmed. |
| Google Maps/Places/Routes | Use restricted keys, billing caps, session tokens, field masks and monitoring before live production enablement. |
| Nominatim | Keep as validation fallback only, not production autocomplete. |

Beta readiness audit:

```sh
npm run check:beta-readiness -- --api-base https://fuel-path.vercel.app --allow-blocked
```

Use this as the Phase 0 summary gate. It should remain blocked until provider terms evidence, a fresh Android installed-build/native-performance pass for the current build, privacy contact, public policy URL, store listing links and reviewed store disclosure evidence are all proven. Source-level iOS simulator validation is captured, but a signed iOS preview/development build is still required before notification, push-token or store-readiness claims.

Store/privacy evidence inputs:

Preferred evidence-file route:

```sh
npm run check:beta-readiness -- \
  --api-base https://fuel-path.vercel.app \
  --store-evidence-json <path-to-store-publishing-evidence.json> \
  --allow-blocked
```

Use `STORE-PUBLISHING-EVIDENCE.template.json` as the starting shape. Keep final evidence private if it contains non-public operational details before store publication.

Direct-value route:

```sh
npm run check:beta-readiness -- \
  --api-base https://fuel-path.vercel.app \
  --privacy-contact <final-public-privacy-contact> \
  --privacy-policy-url <final-public-privacy-policy-url> \
  --app-store-url <final-apple-app-store-listing-url> \
  --google-play-url <final-google-play-listing-url> \
  --apple-privacy-reviewed \
  --apple-privacy-review-reference <apple-privacy-review-source-or-note> \
  --google-data-safety-reviewed \
  --google-data-safety-review-reference <google-data-safety-review-source-or-note> \
  --provider-limitations-disclosed \
  --provider-limitations-disclosure-reference <provider-limitation-copy-source-or-url> \
  --support-process-ready \
  --support-process-reference <support-process-source-or-note> \
  --reviewed-at <YYYY-MM-DD> \
  --reviewer <release-reviewer-name> \
  --support-contact <final-public-support-contact> \
  --support-owner <support-owner> \
  --support-runbook <path-to-support-runbook-or-reviewed-source> \
  --support-reviewed-at <YYYY-MM-DD> \
  --allow-blocked
```

The dedicated store checker is:

```sh
npm run check:store-publishing -- \
  --evidence-json <path-to-store-publishing-evidence.json> \
  --allow-blocked
```

The dedicated support checker is:

```sh
npm run check:support-readiness -- \
  --support-contact <final-public-support-contact> \
  --support-owner <support-owner> \
  --runbook <path-to-support-runbook-or-reviewed-source> \
  --reviewed-at <YYYY-MM-DD> \
  --allow-blocked
```

The readiness scripts reject placeholder/example privacy contacts, public personal inboxes, non-public or third-party-hosted privacy policy URLs, policy sources that do not publish the final privacy contact, non-Apple listing URLs, non-Google Play listing URLs, placeholder listing identifiers, App Store slugs that do not match the native Expo slug in `mobile-app/app.json`, Google Play package IDs that do not match `mobile-app/app.json`, and generic reviewers such as "release owner". Manual confirmation flags are retained as audit notes only; they do not clear the privacy/store blockers without concrete values, reviewed disclosure evidence, dated source-like review references, non-future review date and accountable reviewer. Review references must point to something auditable, such as a data-safety document, app-listing disclosure ticket, provider-limitation note or support-runbook review note. Store support-process evidence must reference the support runbook or a runbook review source, not just an inbox confirmation. Beta readiness also consumes the support checker, so `--support-process-ready` must be backed by a concrete support contact, accountable owner, non-future review date and runbook coverage. The claimed support contact and owner must appear in the runbook or reviewed support source before support readiness can clear. The support contact must match the confirmed privacy contact so store, privacy and support evidence point users to one monitored channel; missing contacts are not treated as a clean match. The support checker rejects public personal inboxes and generic owners such as "support team" or "release owner". Store and support review evidence must be fresh: by default, review dates older than 30 days report `store_review_evidence_stale` or `support_review_date_stale`, and future review dates are treated as missing review metadata.

## Native Build Gates

- [x] EAS project id configured and strict native preflight passes.
- [ ] Android Google Maps key renders tiles in a fresh installed preview/localParity APK smoke for the current build; older APK evidence is historical only.
- [x] Source-level iOS simulator validation report captured through `npm run native:ios-validation-report`, with Plan, Nearby and Account screenshot evidence and no runtime failures.
- [ ] Signed iOS preview/development build validation captured before push, notification or store claims.
- [ ] Expo push token registration tested on physical iOS and Android devices.
- [ ] Notification permission states tested: undetermined, granted, denied and unavailable.
- [ ] Location permission states tested: undetermined, granted, denied, blocked and services off.
- [ ] Cold start, first map interaction and route planning performance baseline captured.
- [x] App size baseline captured and dependency growth reviewed through mobile `npm run verify` bundle budgets.

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
- Run provider terms readiness: `npm run check:provider-terms -- --api-base https://fuel-path.vercel.app --enforce-public-launch`.
- Run privacy/security checks: no exposed keys, no sensitive logs, protected alert endpoints, production headers.
- Record failures as P0, P1 or P2 with region, fuel, route, viewport/device and provider context.

## Done Definition

Store readiness is done only when:

- Privacy policy and store data safety forms match actual app behaviour.
- Provider usage constraints are confirmed or blocked regions are labelled honestly.
- Native iOS and Android device validation passes.
- Push delivery remains disabled until token, permission, scheduler and cost gates are proven.
- No unsupported prediction, pricing, coverage or savings claim appears in the app or listing.
