# EV Provider Readiness Boundary

Date: 2026-07-01
Status: production claim boundary, no UI changes implemented

## Purpose

EV route planning must stay cautious until Fuel Path has approved provider terms, coverage evidence, pricing, availability semantics and commercial display rights.

This document defines what can and cannot be claimed.

## Current Position

EV charger discovery can support prototype validation when provider provenance is visible.

EV route-stop optimisation is not production-ready until a provider confirms:

- Australian public charger coverage
- NT and regional coverage
- connector fields
- charger power fields
- live or near-live availability semantics
- tariff or pricing fields, if shown
- cache and rate limits
- public display rights
- route-recommendation rights
- attribution or disclaimer wording
- commercial app permission
- server-side credential rules

## Allowed Copy

Allowed:

```text
Directory data can help find possible chargers. Confirm power, price and availability with the charging network before driving.
```

Allowed:

```text
EV route charging is not available yet. Use Nearby EV charging for compatible chargers while route charger planning is added.
```

Allowed:

```text
Charger availability is not guaranteed here.
```

## Blocked Copy

Do not claim:

- live bay availability
- guaranteed charger availability
- guaranteed tariff or charging price
- optimised EV charging route
- production-grade EV route planning
- national EV coverage
- NT EV coverage
- provider-approved route recommendations

Do not use:

```text
Live chargers available now
```

Do not use:

```text
Best charging stop for your route
```

Do not use:

```text
Guaranteed available charger
```

## Provider Evidence Checklist

| Evidence | Required before production claim |
| --- | --- |
| Commercial consumer-app permission | Yes |
| Public display rights | Yes |
| Route-recommendation rights | Yes |
| Attribution wording | Yes |
| Cache/rate limit terms | Yes |
| Australian coverage by state/territory | Yes |
| NT and regional coverage smoke | Yes |
| Connector fields | Yes |
| Power fields | Yes |
| Live availability semantics | Required before live-availability claims |
| Tariff/pricing fields | Required before price claims |
| Latency and rate-limit smoke | Yes |

## Break-It Evidence

Before EV copy is promoted, add or keep a guard that proves:

- unsupported commercial providers fail closed
- EV fallback metadata remains labelled as prototype or directory data
- user-facing copy does not claim live bay availability without provider evidence
- route fallback does not hard-wire a single provider
- connector filters are preserved

Current relevant areas:

- `docs/ev-provider-pricing-readiness-2026-06-27.md`
- `api/ev-chargers.js`
- `api/_evRouteFallback.js`
- `tests/api/ev-chargers.test.js`
- `scripts/claim-safety-audit-stress.mjs`

## UI/UX Changes Not Yet Approved

The following would need Leo approval before implementation:

- changing EV route empty-state copy
- adding EV provider confidence chips
- adding charger availability labels
- adding tariff or price labels
- adding an EV route recommendation card

## Decision

Keep EV as prototype/cautious until the provider evidence checklist passes. Do not let EV expansion distract from petrol/diesel route-decision validation.
