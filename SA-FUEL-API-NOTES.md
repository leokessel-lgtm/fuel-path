# SA Fuel Pricing Information Scheme API Notes

## Access Status

- Access email received from Fuel Prices SA Support on 2026-06-18.
- Data Publisher registration was confirmed successful.
- Production API base URL confirmed as `https://fppdirectapi-prod.safuelpricinginformation.com.au`.
- Subscriber token must stay server-side. Do not commit or print the token.
- The email says the token may take overnight to activate, but also says the credentials were confirmed against the production API.
- The email included a production Postman collection. The Gmail connector exposed the attachment metadata but not a clean attachment download.

## Production Env

```text
SA_FUEL_API_BASE_URL=https://fppdirectapi-prod.safuelpricinginformation.com.au
SA_FUEL_API_TOKEN=
```

## API Contract

The SA Direct API is server-to-server and must not be called directly from the mobile app or browser.

Required request header:

```text
Authorization: FPDAPI SubscriberToken=<subscriber-token>
Content-Type: application/json
```

State-level SA parameters:

```text
countryId=21
geoRegionLevel=3
geoRegionId=4
```

Validated implementation endpoints:

- `/Subscriber/GetCountryBrands`
- `/Subscriber/GetCountryGeographicRegions`
- `/Subscriber/GetFullSiteDetails`
- `/Price/GetSitesPrices`

Implementation rules:

- Prices are returned in tenths of a cent, so `1859` becomes `185.9 c/L`.
- Price value `9999` means the product is unavailable and must not be shown as a pump price.
- The FPP Direct fuel mapping used by QLD/SA includes Fuel ID `4` as `LPG`; Fuel Path may expose LPG through the same fuel-vehicle flow as petrol and diesel grades.
- Site detail data should be cached daily where practical.
- Price retrieval should not be called more often than once per minute.
- Fuel Path keeps the normal backend cache guard in front of live SA calls.
