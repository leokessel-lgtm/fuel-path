# QLD Fuel Prices API Notes

**Classification:** source-of-truth for the QLD adapter contract. Access email,
row counts and validation results below are dated evidence, not current health
or public-use permission.

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
- Site detail rows: 1803.
- Price endpoint: OK.
- Price rows: 6980.
- Region tested: `countryId=21`, `geoRegionLevel=3`, `geoRegionId=1`.

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

Confirmed against the API manual:

- `geoRegionLevel=3` and `geoRegionId=1` returns Queensland.
- `Price` is stored in tenths of cents per litre, for example `1679` means `167.9 c/L`.
- `9999` means the product is currently unavailable at that site.

Confirmed against the live reference table:

- Fuel ID `2`: `U91`.
- Fuel ID `3`: `DL`.
- Fuel ID `4`: `LPG`.
- Fuel ID `5`: `P95`.
- Fuel ID `8`: `P98`.
- Fuel ID `12`: `E10`.
- Fuel ID `14`: `PDL`.

Observed in the live QLD price feed on 2026-07-09 but not exposed as primary app fuel options:

- Fuel ID `19`: `e85`.
- Fuel ID `21`: `OPAL`.

## Integration Notes

The QLD provider adapter is now implemented behind the existing backend station lookup path.

Keep it narrow:

- QLD is a source provider, not a new product flow.
- Backend source selection is region-aware: NSW/ACT uses API.NSW, QLD uses Fuel Prices QLD, and QLD border searches can merge nearby NSW stations.
- Brand and region reference tables are used for station normalisation.
- Keep smart saved-route alerts as a later backend scheduling concern.
