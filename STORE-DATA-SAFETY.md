# Fuel Path Store Data Safety Preparation

Last updated: 19 June 2026

This maps current Fuel Path behaviour to Apple App Privacy and Google Play Data Safety preparation. It is ready as the source record for store-form completion, but the final answers must be checked against the exact production build, hosted privacy-policy URL and provider terms before submission.

## High-Level Position

- No third-party advertising SDKs are currently used.
- No contacts, photos, microphone or camera permissions are requested.
- No background location permission is requested in v1.
- Current location is requested only after user action.
- Push notifications are for opt-in saved-route fuel alerts, not generic marketing.
- Backend alert sync is token-gated and requires durable storage before public use.

## Data Categories

| Store category | Fuel Path data | Purpose | Stored where | User control | Notes |
| --- | --- | --- | --- | --- | --- |
| Location | Current location after tap, Home/Work, recent route locations, saved route endpoints | Nearby search, route planning, saved-route alerts | Device storage; backend only for saved-route alert sync | Deny permission, type manually, clear Home/Work, remove recents, remove saved commutes | No background location in v1. |
| User content / app activity | Saved commutes, selected fuel, selected discounts, discount redemption state | Recommendation calculation and alert settings | Device storage; backend only for alert-enabled/synced route records | Edit/remove in app or clear app data | Vehicle details are optional. |
| Device or other IDs | Generated local alert identity, Expo push token when alerts are enabled | Push delivery and duplicate suppression for saved-route alerts | Device storage and backend alert storage | Leave alerts off, turn alerts off, remove saved commute, uninstall/clear app data | Not an account identity. |
| Diagnostics / performance | Provider, source, cache, freshness, degraded-state and error-code metadata | Reliability and support | Backend/runtime logs or API responses | Not user-editable | Must exclude precise Home/Work, full route coordinates, push tokens and secrets. |
| Inferences | Recommendation score, savings estimate, freshness/capability status | Explain route recommendation | API response and app UI | Change route, fuel, discounts or source context | No prediction accuracy claims without back-test evidence. |

## Data Not Collected In Current V1 Scope

- contacts
- photos or videos
- audio
- camera input
- payment card or bank account details
- government identity documents
- advertising identifiers
- background location
- health or fitness data

## Sharing And Third Parties

Fuel Path may process data through:

- backend hosting/database services
- map, routing and address lookup providers
- permitted fuel-price data providers
- Expo push notification services when native route alerts are enabled

Google Places fallback must remain backend-controlled with session tokens, field masks, daily quota and durable production quota storage.

## Store Form Caveats

- Do not claim "data not collected" if backend saved-route alerts are enabled in the release build.
- Do not claim live Australia-wide prices until every jurisdiction is either live or clearly labelled as blocked/limited.
- Do not claim data is deleted automatically unless the relevant retention cleanup job is deployed and monitored.
- Do not claim notifications are transactional only if any marketing push path is added later.
- Update this preparation record if login, payments, analytics, crash reporting, ads or account deletion flows are added.

## Launch Checklist

- Keep the privacy policy published at `https://fuel-path.vercel.app/web-demo/privacy`.
- Add the correct privacy contact method to the published policy.
- Link the published privacy policy from Apple App Store and Google Play listings.
- Confirm App Store and Google Play data-safety answers against the exact production build.
- Confirm provider attribution and usage terms are reflected in listing copy.
- Confirm native iOS and Android permission prompts on real devices.
- Confirm backend retention cleanup is scheduled and monitored.
