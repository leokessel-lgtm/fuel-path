# Fuel Path Provider Terms Review

Reviewed: 2026-06-20
Reviewer: Leo Kesselring with Codex support
Status: blocked for public live-price claims

## Decision

Do not enable public live-price claims for NSW, ACT, QLD or TAS yet.

This review found current official source context, but it does not prove that Fuel Path has accepted the relevant terms, received account/API approval for production use, confirmed caching obligations, or approved final attribution/disclaimer wording.

## Official Source Facts

### NSW / ACT / TAS via API.NSW Fuel API

Source URLs reviewed:

- https://api.nsw.gov.au/Product/Index/22
- https://api.nsw.gov.au/Documentation/GenerateHar/22
- https://api.nsw.gov.au/Home/Terms
- https://yoursayconversations.act.gov.au/FuelCheck-ACT-users
- https://cbos.tas.gov.au/topics/products-services/fuelchecktas-retailer

Findings:

- API.NSW describes the Fuel API as providing live fuel pricing across NSW service stations.
- API.NSW v2 reference and price endpoints can return NSW and TAS data.
- API.NSW notes all-prices calls may have restrictions on request frequency.
- API.NSW terms place responsibility on the user to keep API keys, user IDs and passwords secure.
- ACT publicly describes FuelCheck as covering ACT and NSW.
- TAS public retailer guidance states FuelCheck TAS prices and availability are updated within 30 minutes of changes by retailers.

Open evidence gaps:

- API.NSW Fuel API subscription/access approved specifically for Fuel Path production use.
- Authority-specific FuelCheck NSW/ACT usage terms accepted.
- FuelCheck TAS/API.NSW v2 production use accepted.
- Allowed cache duration recorded for Fuel Path.
- Required attribution/disclaimer wording recorded.
- Commercial consumer-app use confirmed.

### QLD Fuel Prices

Source URLs reviewed:

- https://www.treasury.qld.gov.au/research-and-publications/fuel-price-data/
- https://www.data.qld.gov.au/dataset/fuel-price-reporting-2025/resource/807810a0-d5c3-44b7-9251-84ad80d459f4
- https://www.fuelpricesqld.com.au/

Findings:

- Queensland Treasury states fuel price publishers, fuel reporting app owners and app developers can sign up to access fuel price data.
- Queensland Treasury states that once signed up and terms of service are accepted, access instructions and security tokens are provided by email.
- The Queensland open data portal points data consumers to the Fuel Prices Queensland sign-up site for technical information, terms of service and API access.
- The open data portal resource lists Creative Commons Attribution 4.0 for the sign-up website resource metadata, but this does not by itself prove Fuel Path has accepted the API terms or received production tokens.

Open evidence gaps:

- Fuel Path publisher/data-consumer sign-up accepted.
- Fuel Price Data Licence Terms of Service accepted.
- Terms acceptance date recorded.
- Price cache max-age recorded at 30 minutes or less.
- Site-data cache max-age recorded at 24 hours or less.
- Attribution/disclaimer wording recorded where QLD data is displayed.
- Confirmation that the QLD API token is never called from end-user devices.

## Release Gate Impact

Current beta/public launch status should remain blocked on:

- `nsw_terms_not_confirmed`
- `act_terms_not_confirmed`
- `qld_terms_not_confirmed`
- `tas_terms_not_confirmed`
- `vic_access_not_ready`
- `nt_access_not_ready`

## Next Evidence To Collect

- Export or save provider approval emails/portal confirmations without secrets.
- Record terms acceptance date per provider family.
- Record permitted caching durations and attribution/disclaimer wording.
- Store the evidence in a private release-specific provider terms JSON, not in the public template.
- Re-run:

```sh
npm run check:provider-terms -- --api-base https://fuel-path.vercel.app --evidence-json <provider-terms-evidence.json> --enforce-public-launch
```
