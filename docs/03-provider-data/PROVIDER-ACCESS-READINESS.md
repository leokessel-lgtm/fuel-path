# Provider Access Readiness

Last checked: 26 June 2026, Australia/Sydney.

## Summary

| Region | Current product/source | Fuel Path status | Next action |
| --- | --- | --- | --- |
| NSW/ACT | FuelCheck through API.NSW Fuel API | Internal live adapter implemented; public production is fail-closed until authority-specific terms are confirmed | Confirm API.NSW/FuelCheck NSW/ACT usage, caching, attribution and commercial consumer-app terms, then set `FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED=1`. |
| QLD | Fuel Prices Direct Outbound API | Internal live adapter implemented; public production is fail-closed until licence acceptance and obligations are confirmed | Complete/confirm publisher or data-consumer sign-up, accept the Fuel Price Data Licence Terms of Service, add required attribution/disclaimer handling, then set `FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED=1`. |
| VIC | Service Victoria Servo Saver Public API | Live adapter implemented, production env configured, terms/evidence attested | Keep live smoke and terms evidence current. |
| TAS | FuelCheck TAS through API.NSW Fuel API v2 | Internal live adapter implemented; public production is fail-closed until authority-specific terms are confirmed | Confirm API.NSW/FuelCheck TAS usage, caching, attribution and commercial consumer-app terms, then set `FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED=1`. |
| NT | MyFuel NT web app publishes real-time fuel data; NTG Open Data publishes historical daily datasets | Historical developer access confirmed; no confirmed official real-time REST API contract | Use NTG Open Data for historical analytics. For live consumer-app prices, choose between requesting NT Consumer Affairs/MyFuel NT reuse terms and schema, or contracting a commercial aggregator such as Check Petrol for live NT retail prices and outages. |

## Production Usage Gates

Fuel Path can run internal live validation for configured providers, but production/public live use is fail-closed where usage terms are not confirmed.

| Provider | Production enablement flag | Default production behaviour |
| --- | --- | --- |
| NSW/ACT FuelCheck | `FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED=1` or shared `FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED=1` | No live NSW/ACT prices returned. |
| TAS FuelCheck | `FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED=1` or shared `FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED=1` | No live TAS prices returned. |
| QLD Fuel Prices | `FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED=1` | No live QLD prices returned. |

Regression coverage:

- `production FuelCheck NSW and QLD routes fail closed until usage terms are confirmed`
- `production TAS source fails closed until usage terms are confirmed`
- `provider terms readiness blocks public launch when configured terms are missing`
- `provider terms readiness passes when configured provider terms are confirmed`

## VIC Servo Saver runtime/deployment checklist

When VIC is credentialed but schema work is not finished, Fuel Path must stay in configured-only mode.

- Local setup:
  - `VIC_SERVO_SAVER_API_BASE_URL=https://api.fuel.service.vic.gov.au/open-data/v1`
  - `VIC_SERVO_SAVER_API_KEY=<api-key-from-service-victoria>`
- Vercel deployment setup:
  - Add both variables in the production and preview environments:
    - `VIC_SERVO_SAVER_API_BASE_URL`
    - `VIC_SERVO_SAVER_API_KEY`
  - Keep values in Vercel secret/config UI only; never commit secrets in markdown or status JSON.
  - Redeploy and run a status smoke before public-live release.

Smoke check:

```sh
curl -sS https://fuel-path.vercel.app/api/status | jq '.fuelProviders.apiVicConfigured, .fuelProviders.vicStatus, .fuelProviders.capabilities[] | select(.region == "VIC")'
```

Expected with VIC credentials set but no VIC adapter:

- `fuelProviders.apiVicConfigured` is `true`
- `fuelProviders.vicStatus` is `configured_pending_adapter_schema`
- VIC capability entry shows `capability: "pending_access"`

Release gate:

```sh
npm run check:provider-terms -- --api-base https://fuel-path.vercel.app
```

Use `--enforce-public-launch` when this check should fail the build or release step. Once any NSW/ACT, QLD or TAS terms flag is set, also pass a completed evidence file copied from `docs/templates/PROVIDER-TERMS-EVIDENCE.template.json`:

```sh
npm run check:provider-terms -- --api-base https://fuel-path.vercel.app --evidence-json PROVIDER-TERMS-EVIDENCE-YYYY-MM-DD.json --enforce-public-launch
```

The command reports usage-term blockers, evidence blockers and access blockers separately, so pending VIC/NT access does not get confused with configured-provider terms.

The command emits a `confirmationChecklist` for each terms blocker. Treat a provider as production-ready only when the checklist evidence is held and recorded, not merely when credentials work or an env flag has been set.

Completed evidence must be concrete enough to audit. Boolean confirmations alone are not enough. For NSW/ACT and TAS, record the non-future terms acceptance date, allowed cache duration in minutes, attribution/disclaimer wording and evidence reference. For QLD, record the non-future terms acceptance date, price cache max-age in minutes, site-data cache max-age in hours, attribution/disclaimer wording and evidence reference. Attribution/disclaimer wording must name the relevant provider or source family, such as FuelCheck/API.NSW for NSW/ACT/TAS or Queensland/QLD/Fuel Prices for QLD. The evidence reference must be a dated source-like reference, such as an approval email, licence record, terms review ticket or dated provider-terms note. The release gate rejects placeholder wording, generic attribution claims, missing or future dates, stale evidence references older than 90 days by default, vague references, and cache limits that exceed the recorded provider obligation. Any custom provider-terms freshness window is capped at 365 days.

Runtime status surface:

`/api/status` now exposes `fuelProviders.publicClaims` separately from technical provider capability. This keeps "adapter can technically return live data" separate from "Fuel Path can safely make public live-price claims".

Public live-price claims remain blocked when:

- NSW/ACT, QLD or TAS credentials are configured but terms flags are missing.
- terms flags are set but written evidence has not been attested.

### NT MyFuel

Current evidence:

- MyFuel NT is the NT Government consumer surface for real-time retail fuel prices.
- The NTG Open Data portal publishes MyFuel NT historical daily fuel price datasets, usually as monthly/yearly XLSX files.
- Historical developer/data-analysis access is confirmed through NTG Open Data downloads.
- No direct official public REST API contract has been confirmed for Fuel Path live NT retail prices.
- Scraping the MyFuel NT consumer app is not approved as a Fuel Path production integration path.
- A third-party commercial aggregator such as Check Petrol may be a viable live-feed path only after contract, licence, coverage, outage fields, cache/rate limits, attribution and redistribution terms are confirmed.

Current product behaviour:

- NT remains `pending_access` in `/api/status`.
- `source=nt` is accepted as an explicit source request but returns an empty pending-access context until an approved live provider exists.
- NT must not be included in national live-coverage claims.
- Historical NT datasets are suitable for analytics/back-testing imports only, not route-time live price recommendations.

Required before NT can become live:

- Confirm chosen live provider path: official NT/MyFuel reuse approval or commercial aggregator contract.
- Record API/schema documentation, fuel-code mapping, station identity model and outage/availability fields if used.
- Record licence, caching, rate-limit, attribution and commercial consumer-app terms.
- Add server-side credential handling only; no client-side provider tokens.
- Add normalisation tests, routing tests, live smoke checks for Darwin, Palmerston, Katherine, Alice Springs, Tennant Creek and remote/outage cases.

After the completed evidence file has passed the release gate, set the runtime attestation flag with the release environment values:

```sh
FUEL_PATH_PROVIDER_TERMS_EVIDENCE_CONFIRMED=1
```

Do not set this flag from memory or intent. It is only a runtime pointer that the written evidence exists and has already passed:

```sh
npm run check:provider-terms -- \
  --api-base https://fuel-path.vercel.app \
  --evidence-json PROVIDER-TERMS-EVIDENCE-YYYY-MM-DD.json \
  --enforce-public-launch
```

## Official Terms Findings, 20 June 2026

### NSW/ACT FuelCheck via API.NSW

Current evidence:

- API.NSW Fuel API says v1 supports NSW and v2 supports NSW and Tasmania. It also says all-prices endpoints may have restrictions on request frequency.
- API.NSW general terms say information use may be governed by terms stipulated by the authority administering the information, and users need to be aware of and agree to those conditions before using the service.
- ACCC research says a publicly available interface allows third-party apps and websites to access and use FuelCheck NSW information, but this is secondary evidence and does not replace Fuel Path holding the applicable API.NSW/FuelCheck terms.

Required before setting `FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED=1`:

- API.NSW Fuel API subscription/access approved for Fuel Path.
- Authority-specific FuelCheck NSW/ACT usage terms accepted.
- Terms acceptance date recorded.
- Allowed caching duration recorded in minutes.
- Required attribution/disclaimer wording recorded.
- Commercial consumer-app use confirmed.

### QLD Fuel Prices

Current evidence:

- Queensland Open Data points publishers and data consumers to the Fuel Prices Queensland API sign-up site for technical information, terms of service and API access.
- Fuel Prices Queensland says publishers/data consumers receive access after sign-up and terms acceptance.
- The published Fuel Price Data Licence Terms and Conditions allow publishers to publish licensed data and licensed data products, but require current and accurate publication: price changes within 30 minutes and other published site data within 24 hours of a change.
- The licence requires attribution/disclaimer notices on copied/redisplayed data and on data products.
- The Direct API guide says server-to-server use is intended and it is not intended for large numbers of end users to call directly from apps or websites.

Required before setting `FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED=1`:

- Fuel Path publisher/data-consumer sign-up accepted.
- Fuel Price Data Licence Terms of Service accepted for Fuel Path.
- Terms acceptance date recorded.
- Price cache max-age recorded at 30 minutes or less.
- Site-data cache max-age recorded at 24 hours or less.
- Required attribution/disclaimer wording recorded where QLD data is displayed.
- QLD API token remains server-side only, with no direct end-user calls.

### TAS FuelCheck via API.NSW v2

Current evidence:

- API.NSW Fuel API says v2 supports NSW and TAS.
- ACCC research says an API allows third-party apps and websites to access and use FuelCheck TAS information, but this is secondary evidence and does not replace Fuel Path holding the applicable API.NSW/FuelCheck TAS terms.
- API.NSW general terms still point to authority-administered information terms.

Required before setting `FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED=1`:

- API.NSW Fuel API v2 access approved for TAS use by Fuel Path.
- FuelCheck TAS usage terms accepted.
- Terms acceptance date recorded.
- Allowed caching duration recorded in minutes.
- Required attribution/disclaimer wording recorded.
- Commercial consumer-app use confirmed.

## VIC Servo Saver

Official finding, refreshed 26 June 2026:

- Service Victoria now lists a Servo Saver Public API for digital access to Victorian fuel price data for third-party apps, researchers and tools.
- Consumer Affairs Victoria says fuel price information is published on Servo Saver and that retailers must report price changes within 30 minutes.
- Consumer Affairs Victoria also says tomorrow cap submissions are due between 8:30 am and 2 pm and published on Servo Saver by 4 pm.
- Servo Saver prices are standard pump prices before discounts or loyalty offers.
- Service Victoria API base path is now documented as `https://api.fuel.service.vic.gov.au/open-data/v1`.
- Service Victoria confirmed API access via the Fuel Program email on 26 June 2026 and provided approval details for Fuel Path setup.
- Public Open Data calls currently require `x-consumer-id` and `x-transactionid` headers, plus a normal User-Agent.

Implementation gate:

- Do not enable a VIC adapter until approved Servo Saver Public API access, response schema, licence, caching and attribution terms are held.

Paste-ready ask:

```text
Hello Service Victoria team,

I am building Fuel Path, an Australian route-based fuel decision app. Could you confirm the Servo Saver Public API access path and terms for a third-party consumer app?

I am seeking:
- Public API access/application instructions
- response schema and sample payloads
- update frequency and latency expectations
- permitted commercial/app use
- caching, attribution and redistribution terms
- whether tomorrow price cap data can be used in consumer route recommendations

Thanks,
Leo
```

## TAS FuelCheck

Official finding:

- API.NSW Fuel API v2 states that reference data, all prices, new prices, nearby prices and location prices currently support NSW and TAS.
- FuelCheck TAS retailer guidance confirms Tasmanian retailers must register and update price changes within 30 minutes.
- FuelCheck TAS technical support points to `FuelcheckTas@customerservice.nsw.gov.au`.

Implementation status:

- TAS nearby live adapter is implemented through API.NSW v2 and reuses the existing server-side FuelCheck credential path.
- Backend provider routing treats TAS as internal live validation when API.NSW credentials are configured.
- Public/production TAS live routing is fail-closed unless `FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED=1` is set.
- Station IDs are namespaced as `TAS-{code}` to avoid national collisions.
- TAS station payloads map `state`, `stationid`, `code`, `brand`, `brandid`, `name`, `address`, `location`, fuel code, price and last-updated fields into the existing station contract.
- Live adapter smoke on 19 June 2026 returned `api_tas`, 20 Hobart U91 stations, `cacheMode: refreshed`, `degraded: false`.
- Usage, caching, attribution and public/commercial terms still need API.NSW/FuelCheck TAS confirmation before enabling the production flag.

Live validation result, 19 June 2026:

- `prototype/.env` contains approved API.NSW credentials.
- OAuth succeeded against `https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken`.
- API.NSW v2 reference, all-prices, new-prices and nearby endpoints returned successfully.
- Hobart nearby validation returned 40 TAS record hints with `state`, `stationid`, `code`, `brand`, `brandid`, `name`, `address` and `location` station fields.
- Backend adapter live smoke returned 20 usable U91 stations after applying the requested fuel/radius filter.
- Redacted local samples were written under `provider-samples/api-nsw-v2-tas/`; the folder is git-ignored and should not be committed unless terms allow retained samples.
- API.NSW product documentation confirms v2 nearby, location, prices and new-prices endpoints currently support NSW and TAS.
- API.NSW terms say use of information may be governed by conditions stipulated by the authority administering the information; no TAS-specific caching, attribution or public/commercial usage permission was confirmed on-page.
- Production fail-closed guard added: TAS live provider returns no production data until `FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED=1` is configured.

Local validation command:

```sh
npm run validate:tas-v2 -- --env prototype/.env --save-dir provider-samples/api-nsw-v2-tas
```

Use `--dry-run` to print the official v2 endpoints without credentials. The live run redacts saved payloads and checks reference, all-prices, new-prices and Hobart nearby responses for TAS record hints.

Production enablement command after written terms confirmation:

```sh
FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED=1
```

Paste-ready ask:

```text
Hello FuelCheck TAS / API.NSW team,

I am building Fuel Path, an Australian route-based fuel decision app. The API.NSW Fuel API page says v2 supports NSW and TAS. Could you confirm the required API.NSW subscription/access path and any TAS-specific terms for a third-party consumer app?

I am seeking:
- confirmation that the validated API.NSW v2 access path is approved for TAS third-party use
- official reference, prices, nearby and new-prices schema notes for TAS
- TAS fuel code and station identifier differences from NSW
- allowed caching duration and attribution wording
- commercial/app usage constraints
- whether price mismatch, availability or trading-hour fields are included

Thanks,
Leo
```

## NT MyFuel

Official finding:

- MyFuel NT publishes all fuel price data in real time through its official web app.
- NTG Open Data publishes historical daily MyFuel NT price datasets as downloadable XLSX files.
- Historical datasets are appropriate for analytics/back-testing, not live consumer recommendations.
- The official NT surfaces reviewed do not confirm a direct public REST API contract for live feeds.
- Commercial aggregator APIs may provide live NT data every 30 to 180 minutes, but need contract and terms review before integration.
- NT Consumer Affairs lists `consumer@nt.gov.au`, `08 8999 1999` and `1800 019 319` for general enquiries.

Implementation gate:

- Do not scrape or reverse-engineer the web app for production.
- Use NTG Open Data only for historical analytics/back-testing imports unless live-use terms are separately confirmed.
- Confirm a permitted live API/data access path before enabling NT route-time recommendations.

Paste-ready ask:

```text
Hello NT Consumer Affairs team,

I am building Fuel Path, an Australian route-based fuel decision app. I can see NTG Open Data provides historical MyFuel NT datasets. Could you confirm whether live or near-real-time MyFuel NT fuel price data is available to third-party apps through an API, data feed or approved reuse process?

I am seeking:
- permitted access method for live or regularly updated station fuel prices, if available
- whether historical NTG Open Data datasets may be used for analytics/back-testing
- response schema or sample data
- usage, caching, attribution and redistribution terms
- whether commercial consumer-app use is permitted
- contact point for technical onboarding

Thanks,
Leo
```

## Sources

- VIC mandatory fuel price reporting: https://www.consumer.vic.gov.au/consumers-and-businesses/products-and-services/mandatory-fuel-price-reporting
- Service Victoria Servo Saver Public API: https://service.vic.gov.au/find-services/transport-and-driving/servo-saver/help-centre/servo-saver-public-api
- Victorian Government Data Vic Servo Saver Public API dataset: https://discover.data.vic.gov.au/dataset/servo-saver-public-api
- Queensland Treasury fuel price data: https://www.treasury.qld.gov.au/research-and-publications/fuel-price-data/
- Fuel Prices Queensland: https://www.fuelpricesqld.com.au/
- Queensland Open Data fuel price publisher and data consumer sign-up resource: https://www.data.qld.gov.au/dataset/fuel-price-reporting-2025/resource/807810a0-d5c3-44b7-9251-84ad80d459f4
- API.NSW Fuel API: https://api.nsw.gov.au/Product/Index/22
- API.NSW terms: https://api.nsw.gov.au/Home/Terms
- API.NSW code samples: https://api.nsw.gov.au/Documentation/GenerateHar/22
- FuelCheck TAS retailer guidance: https://cbos.tas.gov.au/topics/products-services/fuelchecktas-retailer
- MyFuel NT: https://consumeraffairs.nt.gov.au/myfuel-nt
