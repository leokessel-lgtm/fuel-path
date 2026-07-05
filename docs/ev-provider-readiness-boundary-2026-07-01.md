# EV Provider Readiness Boundary

Date: 2026-07-01
Status: production claim boundary, no UI changes implemented

## Purpose

EV route planning must stay cautious until Fuel Path has approved provider terms, coverage evidence, pricing, availability semantics and commercial display rights.

This document defines what can and cannot be claimed.

## Current Position

EV charger discovery and route charging guidance can support prototype validation when provider provenance is visible.

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

Route charging guidance may show route distance versus selected EV range and compatible chargers near sampled route points. It must remain labelled as directory/prototype guidance unless the provider evidence checklist passes.

Provider selection must stay conservative: Google Places EV may be trialled first only behind explicit enablement and cost controls, Open Charge Map empty responses must not stop fallback lookup, OpenWeb Ninja remains demoted while rate-limit behaviour is unresolved, and API Ninjas is fallback coverage rather than the preferred production candidate.

Google Places EV uses a separate daily cap from Plan autocomplete via `FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP`.

For controlled launch, the production policy is:
- start with `FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP=250` for a low-risk cap window,
- keep quota key `google_places_ev`,
- keep durable quota storage enabled in production,
- confirm the Google key is restricted,
- confirm a billing budget alert exists.

If the cap is missing or exhausted, or if the hard-stop threshold (`FUEL_PATH_GOOGLE_PLACES_EV_HARD_STOP_PERCENT`, default 95) is reached, Google EV must fail closed before making a provider request and rely on fallback providers.

Use `FUEL_PATH_GOOGLE_PLACES_EV_SOFT_WARNING_PERCENT` (default 80) as the operational warning threshold. When the soft warning is active, status should keep Google EV ready but flag that paid lookup usage is above the monitoring threshold. The soft warning is not a user-facing state and must not block fallback directory guidance.

For a full production rollout, define a conservative stop-signal plan before enabling broad rollout:

- Start with a pilot cap such as 25 daily paid lookup calls in non-critical validation traffic only.
- Raise only after observed 30 days with low route lookup error, low fallback ratio, and approved budget checks.
- Increase only if billing remains within the published budget envelope.
- Treat `250/day` as a pilot cap, not the final app cap. A broader launch cap should be set from expected daily Plan EV traffic, accepted Google Places cost per lookup, and the daily budget envelope, with soft warning below the hard stop.

The `FUEL_PATH_GOOGLE_PLACES_EV_QUALITY_GUARD_ENABLED` stop-signal is operational guardrail even before route cost limits hit. If enabled, the guard can block paid Google EV lookups when route-quality thresholds are outside contract.
`status.evCharging.googlePlacesEvCostControls` also exposes `capUsed`, `capRemaining`, `fallbackCalls`, and `failedLookups` so operations can detect abnormal drift.
`status.releaseReadiness.evCharging.cap` exposes `usagePercent`, `softWarningActive`, `softWarningAtCalls`, `hardStopActive` and `hardStopAtCalls` so release checks can distinguish monitored spend pressure from an active paid-provider stop.

To protect from quality drift while a provider is live, route-quality guard signals are also tracked and enforced.
Set these controls in the same pass:

- `FUEL_PATH_GOOGLE_PLACES_EV_QUALITY_GUARD_ENABLED` (default `1`)
- `FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_SAMPLE_MIN` (default `100`)
- `FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_PASS_RATE_MIN_PERCENT` (default `85`)
- `FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_FALLBACK_RATIO_MAX_PERCENT` (default `65`)
- `FUEL_PATH_GOOGLE_PLACES_EV_SIGNAL_EMPTY_RESULT_MAX_PERCENT` (default `60`)

Guard blockers:

- `google_places_ev_pass_rate_below_threshold`
- `google_places_ev_fallback_ratio_above_threshold`
- `google_places_ev_empty_result_ratio_above_threshold`

`status.evCharging.googlePlacesEvCostControls` exposes:

- `routeChargingRequestSamples`
- `passRatePercent`
- `fallbackRatePercent`
- `emptyResultRatePercent`
- `signalBlockers`

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

Allowed:

```text
Trip looks within selected range
```

Allowed:

```text
Tight range, charging fallback recommended
```

Allowed:

```text
Charging stop likely needed
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
