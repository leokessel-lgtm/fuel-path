# Runtime and data flow

## Plan request

1. The mobile Plan view model resolves From/To input through `fuelPathApi.ts`.
2. `/api/geocode` calls the geocoder composed by `_backend.js`.
3. `/api/route` rewrites to `/api/score?__endpoint=route`.
4. Routing builds route geometry; station loading selects providers by region and
   capability; route scoring spatially prefilters and ranks candidates.
5. The response carries provider, freshness, cache and decision evidence back to
   the mobile result components.

## Nearby request

The client requests stations or EV chargers for a bounded area. Provider policy
selects live, limited, fallback or unsupported behaviour. The client renders
source and limitation evidence rather than silently treating fallback data as
official live coverage.

## Saved-route alerts

Saved routes and push devices are persisted through the alert storage boundary.
Scheduled evaluation rebuilds and scores routes, applies eligibility and
freshness gates, suppresses duplicates and records the outcome before delivery.

## State classes

| State | Expected durability |
| --- | --- |
| UI preferences, recent locations and compact saved-route state | device local |
| Provider response caches and single-flight maps | process local unless a durable adapter explicitly says otherwise |
| Paid-provider quota reservations | durable in production |
| Saved routes, push devices and alert audit records | durable in production |
| Prediction back-tests and market snapshots | durable where production evidence is claimed |
| Raw stress and browser output | scratch unless deliberately promoted to dated evidence |
