# Fuel Path Support Runbook

Last updated: 20 June 2026

## Status

Support readiness is not yet cleared for public beta. This runbook defines the minimum operating process that must be reviewed before `supportProcessReady` can be set in store or beta evidence.

## Intake

Support contact must be a monitored Fuel Path contact method, not a personal temporary address or generic public form URL. URL contacts must be on a Fuel Path-owned host. The same contact must appear in the privacy policy, store listings and support evidence file.
Do not clear support readiness with a public personal inbox or a generic owner such as "support team" or "release owner"; the review must identify an accountable owner. The final runbook must publish the values on labelled lines such as `Support contact:` and `Support owner:` so warning/example mentions cannot clear the gate.

Support contact: support@fuelpath.app
Support owner: Leo Kesselring

Every inbound issue should capture:

- date received
- reply owner
- user-visible platform: iOS, Android, web demo or unknown
- app version or build identifier where available
- region, fuel type and route context at suburb/state level only
- whether the issue involves privacy, provider price accuracy, billing, device permissions, alerts or safety

Do not ask users to send exact home/work addresses, registration numbers, push tokens, API keys, screenshots containing precise saved routes, or payment details.

## Triage

Use these queues:

| Priority | Use when | Target response |
| --- | --- | --- |
| P0 | Privacy incident, exposed secret, misleading public live-price claim, repeated crash at launch, or alert sent from stale/unsupported data | Same day |
| P1 | Wrong recommendation caused by source/freshness/range issue, broken map tiles on a supported device, failed delete/removal request, or support contact failure | 1 business day |
| P2 | Confusing wording, stale listing copy, single-station price mismatch, non-blocking UX issue or feature request | 3 business days |

## Escalation

Escalate immediately when:

- public copy claims live coverage where provider terms are unconfirmed
- a saved-route alert was sent when region, provider, freshness, saving or duplicate-suppression gates should have blocked it
- a provider credential, token, push token or exact saved route appears in logs
- app-store review feedback contradicts the current privacy or data-safety record
- a real-device map, location or notification failure affects a validation participant

## Privacy And Data Requests

Before public beta, verify the support contact can handle:

- privacy questions
- deletion/removal requests for saved route or alert records
- correction requests for incorrect profile or saved-route data
- requests for a plain-language explanation of what data is stored locally and what is synced to the backend

Deletion requests should be logged by request date, owner, data type and completion date. Do not record unnecessary personal details in the support log.

## Provider Price Issues

For fuel-price or station-data reports:

- record region, source, fuel type, station name/suburb and timestamp
- check whether the recommendation used live, limited, fallback, stale or sample data
- do not promise price correction unless the provider terms and API support a correction path
- if the region is terms-blocked, explain that public live-price claims are not enabled for that region

## Native Device Issues

For map, location, notification or push-token reports:

- record device model, OS version and app build where available
- confirm whether the issue is from Expo Go, preview APK, TestFlight/App Store, Google Play or web demo
- ask for permission state screenshots only when necessary and safe
- link repeated issues to the native validation evidence pack

## Evidence Logging

Each release review should record:

- support contact used
- reviewer
- reviewed date
- runbook version or commit
- whether P0/P1/P2 queues have an owner
- whether privacy, deletion, provider-price, map/location and alert-failure paths were checked

Use this runbook as the default `supportProcessReference` only after the monitored contact, owner and non-future review date are filled in the store publishing evidence. Refresh the review before beta or store submission if it is more than 30 days old. Any custom freshness window is capped at 90 days.
