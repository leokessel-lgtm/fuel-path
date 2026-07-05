# EV Commercial Provider Approval Checklist

Date: 2026-07-05
Status: operating checklist, not legal approval

## Current Technical State

Fuel Path can show EV route charger options using Google Places EV plus fallback providers under quota controls.

This is still directory route guidance, not production-grade EV route optimisation.

## Provider Approval Questions

Before EV copy moves beyond cautious route guidance, confirm these items for the chosen provider contract.

| Area | Required evidence | Current position |
| --- | --- | --- |
| Consumer app rights | Written confirmation that Fuel Path may display charger data in a public consumer app | Missing |
| Route recommendation rights | Written confirmation that charger rows may be used as route guidance, not only POI lookup | Missing |
| Attribution | Required map/data attribution text and logo placement | Partly known for Google; needs product/legal sign-off |
| Caching | Permitted cache duration and fields | Missing for EV response fields |
| Availability semantics | Whether availability fields are live, near-live, delayed, partial or station-reported | Missing for production claim |
| Pricing/tariffs | Whether tariff data may be shown, and its accuracy window | Not implemented |
| Australian coverage | State/territory coverage and regional/remote coverage evidence | Directional only |
| Fallback/provider mixing | Whether Google/HERE/TomTom/other data can be mixed in one displayed result | Missing |
| Cost envelope | Daily/monthly request budget and alert thresholds | Pilot controls exist |
| Support wording | Approved disclaimer and correction/escalation path | Missing |

## Provider Notes

Google Places EV:

- Google Places policies require attribution when displaying Places API data, including when displaying data without a Google Map.
- Google Maps Platform service terms require customers to follow documentation and attribution rules.
- Google Places EV fields can support charger directory data, but Fuel Path should not infer guaranteed availability, tariffs or best-stop optimisation from the current integration.

HERE EV:

- HERE EV Charge Points API v3 exposes locations, EVSEs, connectors, power, operator data and dynamic status fields.
- HERE docs say EV Charge Points API access requires HERE support to enable a commercial or evaluation licence.
- This remains the strongest candidate for a production-grade EV provider review, but not wired as the default route provider yet.

TomTom EV:

- TomTom's EV Charging Stations Availability API provides current availability grouped by connector type and power.
- TomTom availability can be useful as enrichment, but availability data alone is not enough to act as Fuel Path's sole charger directory source.

Mapbox EV:

- Mapbox EV Charge Finder exposes EV charge point search and connector filtering, with OCPI-shaped responses.
- Treat as a later candidate unless access and commercial terms are already available.

## Release Wording Boundary

Allowed now:

```text
Route charger options
```

Allowed now:

```text
Directory route guidance
```

Blocked until provider/legal approval:

```text
Best charger
```

Blocked until provider/legal approval:

```text
Guaranteed available
```

Blocked until provider/legal approval:

```text
Optimised EV charging route
```

Blocked until live availability semantics are approved:

```text
Available now
```

## Sources

- Google Places API policies: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Maps Platform service specific terms: https://cloud.google.com/maps-platform/terms/maps-service-terms
- HERE EV Charge Points API v3 introduction: https://docs.here.com/ev-products/docs/readme-guide
- HERE EV products quick start and access note: https://docs.here.com/ev-products/docs/here-ev-products-quick-start
- TomTom EV Charging Stations Availability API: https://developer.tomtom.com/ev-charging-stations-availability-api/documentation/ev-charging-stations-availability-api/ev-charging-stations-availability
- TomTom EV availability product introduction: https://developer.tomtom.com/ev-charging-stations-availability-api/documentation/product-information/introduction
- Mapbox EV Charge Finder API: https://docs.mapbox.com/api/navigation/ev-charge-finder/
