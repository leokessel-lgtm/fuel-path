# Provider And Store Readiness Summary

Date: 2026-07-05
Status: public-safe summary, not provider approval evidence

## Summary

Fuel Path now has local evidence notes and readiness checks for provider terms, store publishing, privacy contact and support ownership. This summary is safe to keep in Git because it excludes credentials, mailbox message IDs, private thread contents and raw provider tokens.

Do not treat this document as legal approval, provider approval or store publication proof.

## Store And Privacy

Current state:

- Privacy contact is published as `support@fuelpath.app`.
- Public privacy page resolves at `https://fuel-path.vercel.app/web-demo/privacy`.
- The privacy page includes the published support contact.
- Store disclosure review references exist locally.

Blocked before claiming store listing readiness:

- App Store listing URL did not resolve publicly during review.
- Google Play listing URL did not resolve publicly during review.
- Store listing links should not be marked confirmed until both public listings resolve or an accepted store-console record is captured.

Next action:

- Capture public App Store and Google Play listing evidence after the listings are live, or store-console evidence if the listings are still pre-public.

## Provider Terms

Current state:

- WA remains the only public-live region that can be treated as currently available in the local capability matrix.
- NSW, ACT, QLD, VIC, SA, TAS and NT still require access and/or terms confirmation before broader live-price coverage claims.
- Local notes indicate QLD and VIC API access evidence exists, but terms/caching/attribution and route-based consumer-app use are not fully confirmed.
- Local notes indicate API.NSW, QLD and VIC confirmation requests were sent on 2026-07-05.

Blocked before public live-price claims for additional regions:

- Provider usage terms must explicitly cover Fuel Path's public consumer-app use.
- Route-based fuel recommendation use must be confirmed.
- Caching duration and freshness obligations must be confirmed.
- Required attribution or disclaimer wording must be confirmed.
- Rate limits, quotas or budget requirements must be confirmed where applicable.

Next action:

- Wait for provider replies or capture portal/licence records.
- Convert any accepted terms into a dated, source-backed public summary without credentials or internal mailbox identifiers.

## Evidence Handling Rules

Keep local or private:

- raw Gmail thread excerpts
- mailbox message IDs
- provider credentials, tokens or subscriber identifiers
- screenshots containing account-only console details
- raw store-console drafts if they expose internal account metadata

Safe for Git after review:

- high-level request summaries
- provider names and public support/contact channels
- public documentation URLs
- confirmed public listing URLs
- dated readiness summaries with explicit caveats

## Current Decision

Do not commit the raw provider/store evidence files as publication evidence yet.

Commit only sanitised summaries until the store listings resolve publicly and provider replies or portal records confirm the missing terms.
