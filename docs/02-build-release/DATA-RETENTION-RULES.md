# Fuel Path Data Retention Rules

## Scope

These rules cover the current validation build and the launch path for saved routes, recent locations, prediction back-tests and alert records. They are product and engineering rules, not a published privacy policy.

## Retention Summary

| Data area | Stored where | Current limit | Retention rule | Public-launch gap |
| --- | --- | --- | --- | --- |
| Home/Work, vehicle, fuel and discounts | Device `AsyncStorage` preferences | One local profile | Keep on device until the user edits, clears the place, clears app data or uninstalls. Do not sync by default. | Privacy policy and store data-safety copy must match this behaviour. |
| Recent locations | Device `AsyncStorage` recents | Latest 8 unique coordinate matches | Keep only the latest 8. Users must be able to remove individual recents and clear the list. | Keep remove/clear controls visible in Nearby and Plan route entry surfaces. |
| Saved commutes | Device `AsyncStorage` saved commutes | Latest 20 local saved routes | Keep until the user removes the commute, clears app data or uninstalls. Turning alerts off must not silently delete the local route. | Account provides removal and backend delete sync; native device validation still needs a real-device pass. |
| Alert identity | Device `AsyncStorage` alert identity | One random local user/device identity | Keep until app data is cleared or the app is reinstalled. It must not contain account, contact or payment identity. | Privacy copy must describe this as a generated alert identity if backend sync is enabled. |
| Push devices | Backend alert storage | Active devices listed through bounded queries | Keep active tokens while alerts are enabled. Invalidated tokens must be excluded from sends immediately. | Retention cleanup job removes invalidated or inactive devices older than 90 days. |
| Backend saved routes | Backend alert storage | Bounded reads, durable table when configured | Keep while backend route alerts are enabled or validation sync is active. Disabled/deleted routes should stop evaluation immediately. | Delete sync removes explicit saved-route deletes; retention cleanup removes disabled routes older than 90 days. |
| Alert evaluations | Backend alert storage | Latest 500 in memory; bounded durable reads | Keep enough audit history to prove duplicate suppression, push delivery and recommendation reasons. | Retention cleanup job removes alert evaluations older than 180 days while preserving recent delivery audit. |
| Prediction back-tests | Prediction storage | Latest 500 in memory; bounded durable reads | Keep model, region, fuel, prediction, actual and error records for accuracy evidence. Do not store route, Home/Work, push token or device identity. | Retention cleanup job removes prediction back-tests older than 12 months. |

## Logging Rule

Production logs must not include:

- precise Home/Work labels or coordinates
- full saved-route coordinates
- push tokens or local alert identities
- provider secrets, API keys or access tokens
- raw third-party payloads that contain user-entered address text beyond the request needed for debugging

Operational logs may include coarse provider, source, freshness, region, degraded-state and error-code metadata.

## Launch Gate

Before public launch:

- publish the privacy policy and store data-safety declarations against this rule
- keep local clear/remove controls available for Home/Work, recents and saved commutes
- keep backend delete sync for saved-route alert records covered by regression tests
- run the protected retention cleanup job for invalidated push devices, disabled backend routes, old alert evaluations and old prediction back-tests
- keep retention cleanup covered by backend regression tests before enabling public backend alert sync
