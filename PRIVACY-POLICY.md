# Fuel Path Privacy Policy

Last updated: 19 June 2026

## Release Status

This policy reflects the current Fuel Path v1 product behaviour and launch path. It is hosted at:

https://fuel-path.vercel.app/web-demo/privacy

It must not be submitted to app stores or described as store-linked until:

- the correct privacy contact method is added
- the final production build, store listings and provider usage terms have been checked against this policy

## Summary

Fuel Path helps drivers compare fuel stops near them and along planned routes. The app is designed to work without passive location tracking, advertising tracking, contact access, photo access, microphone access or camera access.

Fuel Path uses the minimum location, route, vehicle and alert data needed to calculate fuel recommendations, show saved places and send opt-in saved-route alerts.

## Information Fuel Path Uses

### Location

Fuel Path may use your current location when you tap a current-location control. This is used to:

- show nearby fuel stations
- start trip planning from your current position
- save a location or route when you choose to do so

Fuel Path does not request background location permission in v1 and does not infer routine routes from passive movement.

You can deny location permission and type locations manually.

### Saved Places, Routes And Recents

You can save Home, Work, recent locations and commute routes. These are used to make route planning faster and to calculate fuel recommendations.

Current local limits:

- Home and Work are stored on your device until you edit or clear them.
- Recent route locations are limited to the latest 8 unique locations and can be removed individually or cleared.
- Saved commutes are limited to the latest 20 routes and can be removed from Account.

Saved commute routes may be synced to the Fuel Path backend only when backend route-alert sync is configured for a validation or production build.

### Vehicle, Fuel And Discounts

Fuel Path may store your selected fuel type, optional vehicle details, selected discount programs and discount redemption state on your device. These are used to calculate route recommendations and adjusted fuel prices.

Fuel Path does not need payment card details, bank details or government identity documents.

### Notifications And Push Tokens

Saved-route alerts are opt-in. If you enable route alerts on a native iOS or Android build, Fuel Path may request notification permission and create an Expo push token for that device.

Push tokens are used only to deliver saved-route fuel alerts. They are not used for generic marketing.

### Backend Alert Records

When backend alert sync is enabled, Fuel Path may store:

- a generated local user/device identity
- saved route details needed to evaluate route alerts
- push device token and platform
- alert evaluation records, delivery status and duplicate-suppression evidence

The generated alert identity is not an account login and should not contain contact, payment or government identity information.

### Prediction Back-Tests

Fuel Path stores fuel-cycle prediction back-test records for measurement. These records contain model, region, fuel, predicted value, actual value and error metrics. They do not store Home, Work, route coordinates, push tokens or device identity.

## Third-Party Services

Fuel Path may use third-party services for maps, routing, address lookup, fuel data, hosting, push delivery and database storage.

Current or planned services include:

- official or permitted Australian fuel-price providers, where access and terms are confirmed
- map and routing providers
- backend address lookup providers, including Google Places only behind explicit cost, quota and session-token controls
- Expo push notification services for saved-route alerts
- hosted backend/database services for route alerts, retention cleanup and prediction back-tests

Provider usage, caching, attribution and public-sharing rights must be confirmed before public launch claims are made for live provider coverage.

## Retention

Fuel Path retention rules are documented in `docs/02-build-release/DATA-RETENTION-RULES.md`.

Current retention rules include:

- local profile, Home/Work, saved routes and recents stay on device until edited, removed, cleared, app data is cleared or the app is uninstalled
- backend invalidated or inactive push devices are removed by retention cleanup after 90 days
- backend disabled saved routes are removed by retention cleanup after 90 days
- old backend alert evaluations are removed after 180 days
- old prediction back-tests are removed after 12 months

## Controls

You can:

- deny location permission and enter locations manually
- clear Home and Work in Account
- remove individual recent route locations or clear all persisted route recents in Plan
- remove saved commutes in Account
- leave route alerts off
- turn route alerts off for a saved route
- clear app data or uninstall the app to remove local app storage

When backend alert sync is configured, removing a saved commute also attempts to remove the matching backend saved-route record.

## Security

Fuel Path keeps provider keys server-side where possible. Backend saved-route alert mutation endpoints require write tokens. Production logs and provenance telemetry must not include precise Home/Work labels or coordinates, full saved-route coordinates, push tokens, local alert identities or provider secrets.

## Data Fuel Path Does Not Need In V1

Fuel Path does not need:

- contacts
- photos or videos
- microphone or camera access
- payment card or bank details
- government identity documents
- advertising identifiers
- background location

## Claims Fuel Path Does Not Make In V1

Fuel Path does not claim:

- live fuel prices are available everywhere in Australia
- the cheapest fuel is always the best decision
- prediction accuracy without measured back-test evidence
- alerts will be sent when a region, provider, route, token or freshness gate blocks them

## Children

Fuel Path is designed for licensed drivers and fuel-planning users. It is not designed for children.

## Policy Changes

This policy should be updated before release whenever Fuel Path adds login, payments, analytics, crash reporting, advertising, account deletion, background location, new data providers or new push-notification purposes.

## Contact

For privacy requests and data questions, contact: **support@fuelpath.app**.
