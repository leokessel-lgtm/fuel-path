# QLD Fuel Prices API Notes

## Access Status

- Access email received from Fuel Prices Qld Support on 2026-06-16.
- Production API base URL confirmed as `https://fppdirectapi-prod.fuelpricesqld.com.au`.
- Subscriber token stored locally in `prototype/.env`.
- Do not commit or print the token.
- The Postman collection attachment was present in the email, but it could not be read through the Gmail connector.

## Local Env

```text
QLD_FUEL_API_BASE_URL=https://fppdirectapi-prod.fuelpricesqld.com.au
QLD_FUEL_API_TOKEN=
```

## Validation

Run from the project root:

```bash
python3 prototype/scripts/validate_api_qld.py --env prototype/.env
```

Latest local validation result:

- Site detail endpoint: OK.
- Site detail rows: 64.
- Price endpoint: OK.
- Price rows: 233.
- Region tested: `countryId=21`, `geoRegionLevel=2`, `geoRegionId=16`.

Validated endpoints:

- `/Subscriber/GetFullSiteDetails`
- `/Price/GetSitesPrices`

The required request header is:

```text
Authorization: FPDAPI SubscriberToken=<token>
```

## Observed Payload Shape

Site details are returned under `S`.

Useful observed site fields:

- `S`: site ID.
- `N`: station name.
- `A`: address.
- `P`: postcode.
- `Lat`: latitude.
- `Lng`: longitude.
- `GPI`: Google place ID.

Prices are returned under `SitePrices`.

Useful observed price fields:

- `SiteId`
- `FuelId`
- `Price`
- `TransactionDateUtc`
- `CollectionMethod`

Assumption to confirm against the API manual or Postman collection:

- `Price` appears to be stored in tenths of cents per litre, for example `1695.0` means `169.5 c/L`.

## Integration Notes

Recommended next step is a small QLD provider adapter behind the existing backend station lookup path.

Keep it narrow:

- Add QLD as a source provider, not a new product flow.
- Confirm QLD fuel ID mapping before joining prices into Fuel Path fuel codes.
- Confirm region IDs needed for production coverage.
- Confirm brand/operator mapping before relying on icon matching.
- Keep smart saved-route alerts as a later backend scheduling concern.
