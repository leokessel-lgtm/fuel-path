# Fuel Path Privacy Publishing Checklist

Last updated: 20 June 2026

## Status

Privacy copy is complete for current v1 behaviour and the production privacy page is live at:

https://fuel-path.vercel.app/web-demo/privacy

Store publication is still blocked by release facts that are not present in the repo:

- correct privacy contact method
- final Fuel Path-owned public privacy policy URL confirmed for store use
- Apple App Store and Google Play listing links
- Apple App Privacy and Google Play Data Safety answers re-checked against the final app
- public provider limitation disclosure and support/contact handling confirmed

Do not mark privacy publication done, submit store listings or claim store readiness until these are confirmed.

## Beta Readiness Proof

Use concrete values. Manual confirmation flags are audit notes only and do not clear this gate.
Preferred path:

1. Copy `STORE-PUBLISHING-EVIDENCE.template.json` to a private or release-specific evidence file.
2. Fill in the final privacy contact, Fuel Path-owned public policy URL, Apple listing URL and Google Play listing URL.
3. Fill in concrete release-review references for Apple App Privacy, Google Play Data Safety, provider limitations disclosure and support process. Use source artefacts, public URLs, ticket IDs or dated review notes. Do not use "done", "checked" or placeholder text.
4. Set `reviewedAt` to the latest release review date. Store review evidence must be no older than 30 days by default when the gate runs.
5. Check support readiness against the runbook:

```sh
npm run check:support-readiness -- \
  --support-contact <final-public-support-contact> \
  --support-owner <support-owner> \
  --reviewed-at <YYYY-MM-DD> \
  --allow-blocked
```

6. Run:

```sh
npm run check:store-publishing -- \
  --evidence-json <path-to-store-publishing-evidence.json> \
  --allow-blocked
```

Then include the same evidence in the Phase 0 gate:

```sh
npm run check:beta-readiness -- \
  --api-base https://fuel-path.vercel.app \
  --store-evidence-json <path-to-store-publishing-evidence.json> \
  --allow-blocked
```

Direct-value equivalent:

```sh
npm run check:beta-readiness -- \
  --api-base https://fuel-path.vercel.app \
  --privacy-contact support@fuelpath.app \
  --privacy-policy-url https://fuel-path.vercel.app/web-demo/privacy \
  --privacy-policy-source web-demo/privacy.html \
  --app-store-url https://apps.apple.com/au/app/fuel-path/id6740012345 \
  --google-play-url https://play.google.com/store/apps/details?id=com.fuelpath.app \
  --apple-privacy-reviewed \
  --apple-privacy-review-reference "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20" \
  --google-data-safety-reviewed \
  --google-data-safety-review-reference "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20" \
  --provider-limitations-disclosed \
  --provider-limitations-disclosure-reference "Store listing provider limitations copy reviewed 2026-06-20" \
  --support-process-ready \
  --support-process-reference "Support inbox and response owner confirmed 2026-06-20" \
  --reviewed-at 2026-06-20 \
  --reviewer "Leo Kesselring" \
  --support-contact support@fuelpath.app \
  --support-owner "Leo Kesselring" \
  --support-reviewed-at 2026-06-20 \
  --allow-blocked
```

Environment variable equivalents:

```sh
FUEL_PATH_PRIVACY_CONTACT=support@fuelpath.app
FUEL_PATH_PRIVACY_POLICY_URL=https://fuel-path.vercel.app/web-demo/privacy
FUEL_PATH_PRIVACY_POLICY_SOURCE=web-demo/privacy.html
FUEL_PATH_APP_STORE_URL=https://apps.apple.com/au/app/fuel-path/id6740012345
FUEL_PATH_GOOGLE_PLAY_URL=https://play.google.com/store/apps/details?id=com.fuelpath.app
FUEL_PATH_APPLE_PRIVACY_REVIEWED=1
FUEL_PATH_APPLE_PRIVACY_REVIEW_REFERENCE="STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20"
FUEL_PATH_GOOGLE_DATA_SAFETY_REVIEWED=1
FUEL_PATH_GOOGLE_DATA_SAFETY_REVIEW_REFERENCE="STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20"
FUEL_PATH_PROVIDER_LIMITATIONS_DISCLOSED=1
FUEL_PATH_PROVIDER_LIMITATIONS_DISCLOSURE_REFERENCE="Store listing provider limitations copy reviewed 2026-06-20"
FUEL_PATH_SUPPORT_PROCESS_READY=1
FUEL_PATH_SUPPORT_PROCESS_REFERENCE="Support inbox and response owner confirmed 2026-06-20"
FUEL_PATH_STORE_REVIEWED_AT=2026-06-20
FUEL_PATH_STORE_REVIEWER="Leo Kesselring"
```

Do not use placeholder, example, public personal inbox or personal temporary contact details for the final gate.
The reviewer must be an accountable reviewer, not a generic label such as "release owner".
The support contact must be the same monitored contact shown in privacy and store evidence; avoid public personal inboxes such as Gmail or Outlook addresses.
The support owner must identify an accountable owner, not a generic role such as "support team" or "release owner".
The policy source must contain the final privacy contact and must not still carry the launch warning that the final contact is missing.
The template file intentionally stays blocked until real values are supplied. A flag-only run using
`--privacy-contact-confirmed` or `--store-listing-links-confirmed` must still report
`privacy_contact_missing` and `store_listing_links_missing`, and review flags must still be backed by the concrete policy/listing values plus review metadata.
Release review flags also require concrete reference fields for the Apple privacy review, Google data-safety review, provider limitation disclosure and support process.
Review metadata is freshness checked: stale release reviews report `store_review_evidence_stale`.

## Publication Steps

1. Keep `web-demo/privacy.html` hosted at `https://fuel-path.vercel.app/web-demo/privacy`.
2. Add the correct privacy contact method to `PRIVACY-POLICY.md` and the hosted page.
3. Re-check the final production app build against `PRIVACY-POLICY.md`.
4. Re-check Apple App Privacy and Google Play Data Safety answers against `STORE-DATA-SAFETY.md`.
5. Confirm provider usage, caching, attribution and public-sharing terms are reflected in public copy.
6. Confirm native location, notification, push-token and map behaviour on physical iOS and Android devices.
7. Link the hosted policy from Apple App Store and Google Play listings.
8. Confirm `SUPPORT-RUNBOOK.md` has a current owner, contact, review date and P0/P1/P2 handling path.

## Do Not Publish If

- backend saved-route alerts are enabled without durable storage and retention cleanup
- a marketing push path has been added but the policy still says alerts are saved-route only
- analytics, crash reporting, login, payments or ads have been added without updating the policy and store form answers
- public provider usage terms are still unconfirmed for a region that listing copy describes as live
- real-device permission prompts do not match the policy wording
