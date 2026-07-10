# System context

## Runtime surfaces

| Surface | Responsibility | Source |
| --- | --- | --- |
| Expo mobile app | Plan, Nearby, Settings, local preferences, saved routes and native permissions | `mobile-app/App.tsx`, `mobile-app/src/` |
| Vercel static web build | Browser preview and hosted privacy surface | `scripts/build-vercel-static.sh`, `web-demo/` |
| Vercel API functions | Stations, geocoding, routing/scoring, alerts, predictions, EV discovery and status | public files under `api/` |
| Provider adapters | Translate external fuel, route, geocode and EV services into internal contracts | underscore-prefixed provider modules under `api/` |
| Durable stores | Alert, prediction, quota and address-index state where configured | storage modules and hosted Postgres/G-NAF services |
| Scheduled jobs | Alert evaluation, prediction collection and geocode health | `api/cron/`, `vercel.json` |

## Composition

Most public handlers validate HTTP input and call exports from
`api/_backend.js`. Two current exceptions are explicit: `api/ev-chargers.js`
directly composes EV adapters and policy modules, while `api/status.js` directly
reads EV policy and provider observability. The architecture guard freezes those
known static-import exceptions but does not describe them as the target design.

`_backend.js` currently composes routing, geocoding, provider adapters, scoring,
alerts and prediction storage. It is a composition root with residual domain
logic, so reducing it is the first implementation refactor after this mapping PR.

The mobile app calls the backend through `mobile-app/src/api/fuelPathApi.ts`.
Screens and view models compose hooks, services and presentation components.
Platform-specific maps share contracts through `StationMap.tsx` while native and
web rendering remain separate.

## Trust boundaries

- Provider credentials stay server-side.
- Native permissions, push tokens and saved-route mutation require explicit user
  action and backend authorisation.
- Sample, demo and validation-provider data must remain visible and fail closed
  for production recommendation claims.
- Provider permission, technical capability and beta readiness are separate
  states.
