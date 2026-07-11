# EV Charging Provider Pricing And Readiness

Reviewed: 2026-06-30
Status: prototype cascade live, no paid provider approved yet

## Recommendation

Keep the EV UI unchanged and make the backend provider-swappable.

Commercial outreach priority:

1. OpenWeb Ninja EV Charge Finder
2. API Ninjas EV Charger API
3. PlugShare
4. HERE EV Charge Points
5. Mapbox Charge Finder
6. TomTom EV Charging Stations Availability
7. Chargefox/Evie network-specific partnerships

## Pricing Readout

| Provider | Pricing visibility | Product fit | Current decision |
| --- | --- | --- | --- |
| Open Charge Map | Free/open API path, but current site is unreliable and an API key is still required | Good prototype directory, weak live availability/pricing guarantees | Keep as open prototype provider only. Do not rely on it as sole production EV source. |
| OpenWeb Ninja EV Charge Finder | Visible free tier and low-cost monthly plans, but trial endpoint returned no useful rows | Not viable from the current trial endpoint/account state | Do not build adapter unless the provider confirms a different endpoint, account setting or coverage path that returns Australian charger rows. |
| API Ninjas EV Charger API | Free key path and paid tiers, but coverage, pagination and field meanings need confirmation | Useful cheap discovery fallback candidate | Second cheap trial. Test Australian and NT coverage before treating as useful. |
| PlugShare | Sales/contact-gated commercial API pricing | Strong broad station directory candidate | First commercial enquiry. Need quote, Australia coverage, live status terms and route-recommendation rights. |
| HERE EV Charge Points | HERE platform pricing/sales-gated for EV charge-point product usage | Strong map/routing-grade provider candidate | Second enquiry. Useful if we want EV routing-grade data and status by EVSE/connector group. |
| Mapbox Charge Finder | Commercial/private-preview style product access | Strong map-native candidate if access is available | Keep as later commercial option, especially if Mapbox is already in the stack. |
| TomTom EV Charging Stations Availability | Public developer pricing exists for TomTom APIs, but EV availability cost still needs plan/usage confirmation | Strong availability-specific candidate | Third enquiry. May pair well with another station directory source. |
| Chargefox/Evie | Network-specific, not a national public directory API | Useful direct network status if partnership exists | Later partnership path, not the first national provider. |

## Approval Questions Before Any Paid Integration

- Australian coverage count by state/territory.
- NT coverage specifically, including Darwin, Palmerston, Katherine, Alice Springs, Tennant Creek and remote highway locations.
- Connector fields for CCS2, CHAdeMO, Type 2, Tesla/NACS.
- Power fields in kW and whether values are per connector or per site.
- Live or near-live availability, including timestamp and meaning of unavailable/outage.
- Price/tariff fields, if available.
- Cache duration and rate limits.
- Public display rights in a consumer app.
- Route-recommendation rights.
- Attribution/disclaimer wording.
- Commercial consumer-app permission.
- Server-side credential requirements.
- Startup/mobile-app pricing and minimum monthly commitment.

## Paste-Ready Commercial Enquiry

```text
Hello,

I am evaluating EV charging data for Fuel Path, an Australian route-based fuel decision app.

Could you confirm whether your API can support:

- Australian public EV charger directory coverage
- NT coverage specifically, including Darwin, Palmerston, Katherine, Alice Springs, Tennant Creek and remote highway locations
- connector fields for CCS2, CHAdeMO, Type 2 and Tesla/NACS
- charger power in kW
- live or near-live availability/outage status with timestamps
- tariff/pricing fields, if available
- public display of charger data in a consumer app
- use of charger data in route-based recommendations
- cache and rate limits
- attribution or disclaimer requirements
- server-side credential use
- commercial terms and pricing for a startup/mobile-app use case
- sample payloads or API documentation

Thanks,
Leo
```

## Build Decision

The app should support these provider IDs behind the same EV UI:

- `open_charge_map`
- `openweb_ninja`
- `api_ninjas`
- `plugshare`
- `here`
- `mapbox`
- `tomtom`
- `network_partner`

`open_charge_map`, `api_ninjas` and `openweb_ninja` have prototype adapters today. `api_ninjas` is still the cheap first-choice prototype source where configured. `openweb_ninja` is useful as an optional enrichment/fallback source when it returns Australian rows, but the trial API is rate-limit sensitive and must not be treated as a sole production source. Other provider IDs should fail closed until credentials, contract and schema are approved.

## Prototype Cascade Rules

- Default EV search should use the configured default provider first.
- Fallback providers may run when the first provider returns no chargers or thin metadata.
- Thin metadata means low power/operator coverage or an explicit power filter that the first provider cannot confidently satisfy.
- If a fallback/enrichment provider fails but the cascade already has usable charger rows, keep the result healthy and add an optional enrichment warning.
- If no provider returns usable charger rows and one or more providers fail, return a degraded no-result response.
- Do not make live bay availability claims unless the provider gives live availability with clear timestamp semantics.
- Keep EV provenance cautious: directory data can guide discovery, but users should confirm power, tariff and live availability with the charging network before driving.

## Cheap Trial Smoke Test

Use the smoke runner before building either cheap-provider adapter:

```bash
OPENWEB_NINJA_API_KEY=... API_NINJAS_API_KEY=... npm run validate:ev-provider-trials
```

The runner checks Darwin, Palmerston, Katherine, Alice Springs, Tennant Creek, Melbourne, Bendigo and Horsham. Treat a provider as worth adapter work only if it returns useful NT coverage, connector fields, power/status fields and acceptable latency without breaching free-tier limits.

API Ninjas first smoke, 2026-06-27:

- Covered 6 of 8 locations.
- Covered 3 of 5 NT locations: Darwin, Palmerston and Alice Springs.
- Missed Katherine and Tennant Creek.
- p90 latency was 2,990 ms, driven by Darwin first request.
- Returned useful name, address, coordinates, active flag and connector fields.
- Did not return reliable kW power, tariff or live bay availability fields in the sampled rows.
- Decision: build only as a hidden prototype adapter and keep all user-facing claims cautious.

OpenWeb Ninja first smoke, 2026-06-27:

- Covered 0 of 8 Australian test locations.
- Covered 0 of 5 NT locations.
- Returned 200 OK with empty `data` arrays for Darwin, Palmerston, Katherine, Alice Springs, Tennant Creek, Melbourne, Bendigo and Horsham.
- p90 latency was 22,043 ms.
- Control request using the vendor quickstart shape for `San Francisco, CA, USA` also returned 200 OK with an empty `data` array.
- Decision: do not build an adapter from the current trial endpoint/account state.

Production cascade smoke, 2026-06-30:

- Default EV endpoint covered 6 of 8 locations with charger rows.
- Covered 3 of 5 NT locations: Darwin, Palmerston and Alice Springs.
- Missed Katherine and Tennant Creek with the current cheap-provider cascade.
- Usable rows were returned healthy, not degraded, when OpenWeb enrichment was rate-limited.
- OpenWeb direct/provider-proxy calls returned useful rows for 4 of 5 NT locations earlier in the run but then hit `429 Too Many Requests`, confirming it is useful but fragile under trial limits.
- Decision: keep API Ninjas first and OpenWeb as optional enrichment/fallback. Do not promote either to approved production-grade EV data without rate-limit, commercial-use, attribution, availability and coverage terms.
