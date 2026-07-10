# API.NSW Support Note

Last updated: 14 June 2026, Australia/Sydney

Use this after rotating the API.NSW secret.

```text
Hello API.NSW team,

I am exploring a consumer and fleet-facing fuel planning product for NSW/ACT drivers. The concept uses FuelCheck pricing to recommend good fuel stops near a user's planned route, taking into account detour cost, fuel type, price freshness, range and route corridor.

We have subscribed to the Fuel API and validated local server-side access. In our runtime:

- `GET /oauth/client_credential/accesstoken?grant_type=client_credentials` returned an OAuth token.
- `POST /oauth/client_credential/accesstoken` with `grant_type=client_credentials` in the form body was echoed by the gateway and did not return token JSON.
- `GET /FuelPriceCheck/v1/fuel/prices` returned `stations` and `prices`.
- `GET /FuelPriceCheck/v2/fuel/prices` also worked.
- A later live Canberra check through the local proxy returned ACT station records from the Fuel API payload. Earlier validation missed them because station metadata detection was too narrow.

Could you please confirm:

1. Whether Fuel API data can be used in a public consumer app.
2. Whether commercial, freemium, subscription or fleet use is permitted.
3. Required attribution, display wording and brand or station restrictions.
4. Whether current prices can be cached, and for how long.
5. Whether historical snapshots can be stored for trend, alert and prediction features.
6. Whether derived recommendations such as "best stop", "net saving" and "detour-adjusted saving" are permitted.
7. Whether ACT station records exposed through the Fuel API have the same permitted usage, caching and attribution terms as NSW records.
8. Suitable rate limits or commercial access options for route-corridor queries.
9. Whether `GET /oauth/client_credential/accesstoken?grant_type=client_credentials` is the supported OAuth pattern for backend/server-to-server apps.

We will keep API credentials server-side and will not expose keys in the browser or mobile client.

Thank you.
```
