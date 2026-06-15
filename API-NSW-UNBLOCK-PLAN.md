# API.NSW Unblock Plan

Last updated: 13 June 2026, Australia/Sydney

## TLDR

The blocker is now narrowed. We need to separate it into three checks:

1. **Access:** technically validated with registered API.NSW app credentials.
2. **Rights:** confirm the FuelCheck data can be used in a public/commercial app and under what attribution/cache conditions.
3. **Coverage:** ACT station records are available through the same live API.NSW FuelCheck feed used by the local proxy.

Do not paste API keys or secrets into chat. Keep them in a local `.env` file or shell session.

If credentials have been pasted into chat, rotate or regenerate the secret in API.NSW before any production or shared-demo use.

## What We Know From Official Sources

- API.NSW says the Fuel API provides live fuel pricing across NSW service stations.
- v1 endpoints return NSW data.
- v2 endpoints currently support NSW and Tasmania.
- API.NSW says the public try-it credentials are limited to 5 calls per minute.
- The free registered tier is listed as 2,500 calls per month.
- API.NSW requires an OAuth call using a consumer key and secret, with an access token that lasts about 12 hours.
- API.NSW support says you create an app under **My Account**, select the API collection, then wait for approval.
- API.NSW terms say use of information may be governed by conditions from the authority administering the information.
- FuelCheck app listings and ACT Government material say FuelCheck covers ACT users/stations. A live app/API test on 14 June 2026 confirmed ACT records are exposed through the API.NSW FuelCheck feed used by this local proxy.
- The public **Try this API** credentials are shared trial credentials, limited to 5 calls per minute. They are useful only for request-shape testing, not for a product, distributed demo or backend integration.
- A local test with the public trial credentials failed before OAuth completed because API.NSW's edge protection returned Cloudflare 1010, "browser signature banned". This reinforces that we need registered app credentials and, if needed, API.NSW support help for server-side access.
- Registered API.NSW app credentials were validated locally on 13 June 2026.
- OAuth works from this runtime using `GET /oauth/client_credential/accesstoken?grant_type=client_credentials`.
- The documented POST form-body OAuth call was echoed back by the gateway in this runtime and did not return token JSON.
- `GET /FuelPriceCheck/v1/fuel/prices` returned top-level `stations` and `prices` collections.
- Earlier validation missed ACT records because the helper was not inspecting station metadata broadly enough. The validation helper has been updated and now detects ACT examples in the live payload.
- Live `/api/stations` proxy checks around Canberra returned 47 stations within 12 km, including 43 ACT-like records, and 71 stations within 30 km, including 57 ACT-like records.

Sources:

- https://api.nsw.gov.au/Product/Index/22
- https://api.nsw.gov.au/Support
- https://api.nsw.gov.au/Home/Terms
- https://yoursayconversations.act.gov.au/FuelCheck-ACT-users

## Step 1: Register And Subscribe

Status: done for the current registered app.

Leo action for any new or rotated app:

1. Go to https://api.nsw.gov.au/
2. Sign up or log in.
3. Open **My Account**.
4. Add a new app project.
5. Select or subscribe to the **Fuel API** collection.
6. Wait for approval if the app is pending.
7. Once approved, copy the API key and API secret into a local `.env` file.

Use the local template:

- [prototype/.env.example](prototype/.env.example)

Create:

```text
prototype/.env
```

Do not commit or share `prototype/.env`.

## Step 2: Ask The Usage-Rights Questions

If the portal does not clearly answer these, use API.NSW support before public release:

1. Can FuelCheck data from the Fuel API be used in a public consumer app?
2. Can it be used in a commercial app, freemium app, subscription app or fleet product?
3. What attribution is required?
4. Can current prices be cached? If yes, for how long?
5. Can historical snapshots be stored to support route scoring, trend detection and cycle alerts?
6. Are there limits on showing derived recommendations such as "best stop", "net saving" or "cycle-aware guidance"?
7. Are there brand, station or price display wording requirements?
8. Confirm whether API.NSW's permitted-use terms treat ACT records the same way as NSW records for app and commercial usage.
9. Are fuel unavailability or outage fields available through the API?
10. What rate limit is appropriate for a public app with route-corridor queries?

## Step 3: Validate Credentials Locally

Status: done for the current registered app.

After `prototype/.env` exists, run:

```bash
python3 prototype/scripts/validate_api_nsw.py --env prototype/.env
```

This checks:

- environment variables are present
- OAuth token can be obtained
- FuelCheck prices endpoint returns JSON
- top-level payload keys
- how many obvious ACT records appear in the response

The script redacts secrets and does not print the access token.

## Step 4: Inspect The Payload Shape

If validation succeeds, save a redacted sample:

```bash
python3 prototype/scripts/validate_api_nsw.py \
  --env prototype/.env \
  --save-sample prototype/data/live-sample-redacted.json
```

Then update:

- `normalise_nsw_payload` in [score_route.py](prototype/scripts/score_route.py)
- the web demo data connector

## Step 5: Decide The Live-Data Architecture

Status: implemented for the local web demo.

- Keep API keys server-side only.
- Use the small local API proxy in `web-demo/server.py`.
- Proxy normalises FuelCheck payloads into the same station shape as `sample-stations.json`.
- The browser never receives API.NSW credentials.
- `/api/score` returns scored recommendations, not the raw full FuelCheck payload.

Do not call API.NSW directly from the browser.

## If API Approval Is Delayed

Do not pause the product work. Split the next work into two tracks:

1. **Product validation track:** keep using synthetic NSW/ACT-style sample data to test route scoring, alerts, commuter workflows, fleet workflows and UI.
2. **Data access track:** progress API.NSW approval, usage rights, quota and public/commercial permissions separately.

Build the demo around a simple data adapter contract:

- `sample`: local sample data for demos and user testing
- `api_nsw`: registered API.NSW Fuel API data once approved
- `manual_csv`: temporary internal-only fixture for testing field mapping

Avoid scraping or republishing FuelCheck, PetrolSpy or other third-party data unless the source terms clearly allow it. That would create a worse blocker than the current API-access delay.

## Paste-Ready API.NSW Support Note

Standalone file:

- [API-NSW-SUPPORT-NOTE.md](API-NSW-SUPPORT-NOTE.md)

```text
Hello API.NSW team,

I am exploring a consumer and fleet-facing fuel planning product for NSW/ACT drivers. The concept uses FuelCheck pricing to recommend good fuel stops near a user's planned route, taking into account detour cost, fuel type, freshness and range.

Could you please confirm:

1. Whether Fuel API data can be used in a public consumer app.
2. Whether commercial, freemium, subscription or fleet use is permitted.
3. Required attribution, display wording and brand or station restrictions.
4. Whether current prices can be cached, and for how long.
5. Whether historical snapshots can be stored for trend, alert and prediction features.
6. Whether ACT station records exposed through the Fuel API have the same usage, caching and attribution terms as NSW records.
7. Suitable rate limits or commercial access options for route-corridor queries.
8. Whether `GET /oauth/client_credential/accesstoken?grant_type=client_credentials` is the supported OAuth pattern for backend/server-to-server apps. In this runtime, POST form-body OAuth calls were echoed by the gateway and did not return token JSON.

We will keep API credentials server-side and will not expose keys in the browser.

Thank you.
```

## Decision Gate

Proceed to live FuelCheck integration only when:

- OAuth works with registered credentials.
- Usage rights are clear enough for prototype/public demo use.
- permitted usage, caching and attribution are confirmed for NSW and ACT records.
- The real payload fields are mapped into the scoring engine.

Until then, keep the web demo on synthetic sample data.
