# Backend composition-root map

This is the source-of-truth map for reducing `api/_backend.js` without changing
public API contracts. The baseline was commit `2bee076` on `main`; update this
map in the same pull request whenever an export or responsibility moves or a
public handler changes its backend dependency.

## Current boundary

`api/_backend.js` remains the wiring point for routing, geocoding, fuel
providers, scoring and alerts, but still owns provider loading,
prediction-domain logic and retention orchestration. Run
`npm run check:backend-composition` for its current export, consumer and line
measurements. The committed contract fails when those boundaries drift.

Vercel treats ordinary JavaScript files under `api/` as deployable functions
unless its build recognises them as internal dependencies. New pure shared
modules should remain underscore-prefixed under `api/` or live under `shared/`;
every deployment must retain the Hobby-plan ceiling of 12 serverless functions.

## Responsibility slices

| Slice | Current location | Dependencies | Target boundary |
| --- | --- | --- | --- |
| Composition and adapter wiring | imports and service initialisation in `_backend.js` | routing, geocoder, alert orchestration and state fuel adapters | Remain in `_backend.js` |
| Inbound request utilities | `api/_request.js` | request and response objects | Extracted; re-exported unchanged from `_backend.js` |
| Outbound provider transport | `api/_providerHttp.js` | `fetch`, timeouts and provider responses | Extracted and injected through `_backend.js` |
| Station decoration and provider loading | `stationBrandText` through `providerFromSource` | discount registry, capabilities, provider adapters, cache and single-flight | Extract one provider-loading service injected with adapters |
| Prediction status and signals | `predictionStatus` through `normaliseCycleMarket` | prediction storage and capability state | Move behind a prediction service contract |
| Prediction collection and backtesting | `recordPredictionBacktest` through `listPredictionBacktests` | station loading, storage, time and market configuration | Move behind the same prediction service |
| Retention and write authorisation | prediction security through `isoDateTime` | alert storage, prediction storage and environment secrets | Extract security policy and retention orchestration separately |
| Compatibility exports | final `module.exports` block | all slices | Preserve names until every consumer migrates deliberately |

## Public consumers

| Consumer | Backend dependency groups |
| --- | --- |
| `api/alerts.js` | request helpers, alert security, saved routes, devices and evaluations |
| `api/cron/collect-predictions.js` | request helpers, cron security and prediction collection |
| `api/cron/evaluate-route-alerts.js` | request helpers, cron security and scheduled alert evaluation |
| `api/cron/geocode-health.js` | request helpers, cron security and geocode status/probe |
| `api/ev-chargers.js` | request helpers and routing |
| `api/geocode.js` | request helpers and geocoding |
| `api/jobs.js` | request helpers, alert/cron security, receipts, retention and scheduled alerts |
| `api/predictions.js` | request helpers, prediction security, status, signals and backtests |
| `api/push/register.js` | request helpers, alert security and device registration |
| `api/score.js` | request helpers, routing, station loading and route scoring |
| `api/stations.js` | request helpers, station loading/payloads, NT capability and prediction observations |
| `api/status.js` | request helpers, provider capabilities, geocode/routing, alerts and predictions |

## Contract rules

- Keep every export in `scripts/backend-composition-contract.json` available.
- Do not change handler status codes, payloads, headers, environment gates,
  provider order, cache keys or test seams in a structural extraction.
- Keep every discovered backend test required; quarantine remains zero.
- Add a focused direct test for each extracted module and retain handler-level
  coverage through `_backend.js`.
- Run `npm test`, `npm run check:architecture`, documentation checks, the mobile
  web build budget and the relevant rendered smoke before merge.
- Do not combine route scoring, recommendation wording or savings changes with
  composition-root extraction.

## Completed first implementation slice

Inbound request helpers are extracted into `api/_request.js` while their public
names remain re-exported from `_backend.js`:

- `applyCors`
- `sendJson`
- `methodAllowed`
- `numberParam`
- `stringParam`
- `boolParam`
- `setParam`

Outbound provider transport is isolated in `api/_providerHttp.js`:

- `fetchJson`

`pointFromQuery` and `routeFromPayload` remain in `_backend.js` because they
encode Fuel Path domain shapes rather than generic HTTP. No public handler
import changed. Provider loading is the next bounded extraction.

This is a classification improvement, not evidence of lower latency, smaller
functions or greater traffic capacity. Those claims require separate hosted
measurements.

## Completion condition

`_backend.js` is complete as a composition root when it contains dependency
construction, injected service wiring and compatibility exports only. Provider
loading, prediction calculations, retention policy and request implementation
must live behind named modules with direct tests. File size alone is not the
completion measure.
