# Fuel Path Store, Privacy And Support Review

Reviewed: 2026-06-20
Reviewer: Leo Kesselring with Codex support
Status: blocked for beta/store readiness

## Decision

Do not mark store/privacy/support readiness as clear yet.

The privacy policy URL is live and the public copy includes sensible provider limitation language, but the release evidence is still missing the final monitored privacy/support contact, Apple App Store listing URL, Google Play listing URL, final Apple App Privacy review, final Google Data Safety review and support owner/contact review.

## Evidence Checked

- `web-demo/privacy.html`
- `PRIVACY-POLICY.md`
- `STORE-DATA-SAFETY.md`
- `SUPPORT-RUNBOOK.md`
- `STORE-READINESS-PLAN.md`
- Production privacy URL: https://fuel-path.vercel.app/web-demo/privacy

## What Is Ready

- Privacy policy source exists locally.
- Hosted privacy policy URL is Fuel Path-owned under the current production domain.
- Public copy avoids unsupported claims that live fuel prices are available everywhere in Australia.
- Public copy states provider usage, caching, attribution and public-sharing rights must be confirmed before public launch claims.
- Support runbook has the required sections and evidence-scope coverage for privacy/deletion, provider-price, map/location and alert-failure paths.

## What Is Still Blocked

- Final monitored privacy contact is not present in the policy.
- Final support contact is not present in the runbook.
- Accountable support owner is not present in the runbook.
- Apple App Store listing URL is not available.
- Google Play listing URL is not available.
- Apple App Privacy answers have not been checked against the exact final production build.
- Google Play Data Safety answers have not been checked against the exact final production build.
- Provider limitation disclosure has not been checked in final app-store listing copy because listing copy does not exist yet.

## Next Evidence To Collect

- Create or confirm a monitored Fuel Path-owned contact channel.
- Publish the same contact in privacy policy, support runbook and store evidence.
- Create draft Apple App Store and Google Play listings and record final URLs.
- Complete final Apple App Privacy and Google Data Safety reviews against the production native build.
- Record support owner, review date and support process reference.
- Re-run:

```sh
npm run check:store-publishing -- --evidence-json <store-publishing-evidence.json>
npm run check:support-readiness -- --support-contact <contact> --support-owner <owner> --reviewed-at <YYYY-MM-DD>
```
