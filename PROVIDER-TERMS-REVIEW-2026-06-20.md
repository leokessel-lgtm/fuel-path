# Fuel Path Provider Terms Review

Reviewed: 2026-06-20
Reviewer: Leo Kesselring with Codex support
Status: blocked for public live-price claims

## Decision

Do not enable public live-price claims for NSW, ACT, QLD, TAS or VIC yet.

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

### VIC Servo Saver

Source URLs reviewed:

- https://service.vic.gov.au/-/media/bb0b5dbe245f443db4a90263090b6d88.pdf
- https://service.vic.gov.au/find-services/transport-and-driving/servo-saver/help-centre/servo-saver-public-api/terms-and-acceptable-use-policy

Findings:

- Service Victoria provides a Servo Saver Open API for fuel price access.
- Fuel Path has received an API access email dated 2026-06-25.
- Leo confirmed agreement to the Servo Saver Terms and Acceptable Use policy on 2026-06-27.
- The public setup flow points developers to Servo Saver Open API documentation and a Terms and Acceptable Use policy.
- The API key must remain server-side only and must not be committed, logged or sent to end-user devices.
- The public Terms state Service Victoria Platform APIs are licensed under Creative Commons Attribution 4.0 International and any additional API licence terms notified before API use.
- The public Terms prohibit removing attribution notices, misleading or deceptive material, implying Victorian Government endorsement, individual tracking/profiling from the API data and disruptive commercial messaging.
- The reviewed public Terms allow Service Victoria to set and enforce API-use limits, but the reviewed page did not expose a specific price-cache duration.
- Fuel Path has recorded a conservative 5-minute maximum Servo Saver price cache as an operational policy.
- Fuel Path has recorded display wording: "Fuel price data from Service Victoria Servo Saver, licensed under CC BY 4.0. Service Victoria does not endorse Fuel Path. Prices may change; confirm before driving."

Open evidence gaps:

- Run the VIC live smoke matrix with the API key exported outside the repo.
- Add/confirm visible production UI placement for the full Service Victoria / Servo Saver attribution and non-endorsement wording.

### NT MyFuel

Source URLs reviewed:

- https://data.nt.gov.au/api/3/action/package_search?q=fuel%20price
- https://consumeraffairs.nt.gov.au/for-consumers/fuel-prices

Findings:

- The NTG Open Data portal lists MyFuel NT historical daily fuel price datasets.
- The listed datasets are historical monthly/yearly XLSX resources suitable for developer/data-analysis use, not a route-time live feed.
- The MyFuel NT consumer site is the current real-time government-led consumer surface.
- No direct official public REST API contract has been confirmed for Fuel Path live NT retail prices.
- Consumer Affairs fuel-prices pages may block automated access, which is another reason not to build a scraper path.
- Commercial aggregators may cover NT with live or near-real-time feeds, but Fuel Path needs a contract and terms review before relying on any aggregator API.

Open evidence gaps:

- Official MyFuel NT reuse/API approval or commercial aggregator contract.
- Live price schema, station directory schema, fuel-code mapping and outage/availability semantics.
- Licence, caching, rate-limit, attribution and commercial consumer-app terms.
- Server-side credential handling and no direct client token exposure.
- Live smoke evidence across Darwin, Palmerston, Katherine, Alice Springs, Tennant Creek and remote/outage cases.

## Release Gate Impact

Current beta/public launch status should remain blocked on:

- `nsw_terms_not_confirmed`
- `act_terms_not_confirmed`
- `qld_terms_not_confirmed`
- `tas_terms_not_confirmed`
- `vic_terms_evidence_missing`
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
