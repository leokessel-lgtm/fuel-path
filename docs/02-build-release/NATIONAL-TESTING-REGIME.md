# Fuel Path National Break-It Testing Regime

Last updated: 17 June 2026, Australia/Sydney

## Purpose

Fuel Path is a whole-of-Australia fuel decision app. Testing must prove that the app makes useful recommendations where data supports them, and fails honestly where data, access or confidence is weak.

This regime applies to every roadmap item before it can be marked done.

## Done Definition

A backlog item is done only when:

- user story and success metrics are documented
- backend or product decision rule is documented and implemented
- UX shows the rule outcome, limitation or blocked state where it affects the user
- happy path and break-it tests are added or manually recorded
- accessibility and performance impact are checked
- provider and capability limitations are visible to the user
- stale, restricted or unsupported data cannot silently drive a confident recommendation
- production smoke passes after deploy, when the change reaches production

## Implementation Rule

Every implementation must carry a product decision rule. The rule belongs in backend or product logic, not only in copy or layout. The frontend must then make the rule legible through the recommendation, station row, capability state, alert status, empty state or account setting that the user sees.

Each item must identify:

- user-visible promise
- backend or product rule
- UX surface
- blocked, downgraded or unavailable state
- break-it test proving the rule cannot be bypassed

## Required Test Gates During Implementation

### Contract Tests

Provider adapters must return normalised:

- station identity
- brand or network
- coordinates
- state or territory
- fuel type
- pump price
- source
- provider timestamp
- Fuel Path freshness status
- availability status where known
- capability status

Break cases:

- missing station id
- missing brand
- missing coordinates
- invalid coordinates
- missing fuel type
- unknown fuel type
- missing price
- negative price
- extreme price
- stale timestamp
- timezone mismatch
- duplicate station records

### Scoring Tests

Force cases where the obvious cheapest station should lose:

- stale cheap station
- closed station
- unavailable fuel type
- member-only station without user eligibility
- station too far off route
- station adds more detour cost than saving
- station cannot be reached within tank/reserve assumptions
- station is cheaper but wrong fuel type
- station has untrusted source or pending provider access

Expected result: the top recommendation must prefer a safe, fresh, eligible and reachable option, or show a clear no-recommendation state.

### API Failure Tests

Every backend provider and route/geocode path must handle:

- timeout
- 401 or 403
- 429
- 500
- partial response
- empty response
- bad JSON
- slow response
- DNS or network failure
- provider fallback
- cached response

Expected result: the API returns a useful status, never a misleading empty success.

### Frontend State Tests

Core screens must survive:

- fuel type change
- route reset
- selected marker change
- selected row change
- bottom-sheet collapse and expand
- empty result
- stale result
- provider-limited result
- retry after failure
- current-location permission denied
- notification permission denied
- offline-ish fetch failure
- dark mode
- light mode
- large text
- reduced motion

Expected result: the user always sees either a recommendation or a specific reason why one is unavailable.

### Accessibility Tests

Check:

- screen-reader names for buttons, filters, station rows, map actions and recommendation cards
- touch targets on mobile
- focus order on web preview
- keyboard navigation on web preview
- colour contrast
- colour-not-only meaning
- dynamic text
- reduced motion
- no text overlap
- no horizontal overflow

Expected result: all critical trip-planning, station-selection and account-preference actions remain usable without relying only on colour, tiny text or precise map tapping.

### Performance Tests

Check:

- route response time
- map render time
- marker count stress
- memory growth during map/list interaction
- app dependency diff
- bundle or build size baseline
- local saved-route read/write time

Targets:

- warm route planning under 3 seconds for common Australian metro and regional routes
- cold start under 2.5 seconds on a mid-range Android device after EAS baselines exist
- first map interaction under 1 second after screen render
- saved-route local reads under 100 ms
- unexplained native build size growth over 10 percent is flagged

### Privacy And Security Tests

Check:

- no exposed provider keys
- no unnecessary location retention
- no passive route inference in V1
- no sensitive data in logs
- security headers still present
- dependency audit clean for production
- backend status exposes capability without leaking secrets

Expected result: route, location, alert and vehicle preference data are treated as sensitive product data.

## Brute Scenario Matrix

Run broad combinations across these dimensions.

### Regions

- NSW
- ACT
- QLD
- VIC
- SA
- WA
- TAS
- NT

### Routes

- metro short
- commute
- suburb to suburb
- regional
- interstate
- cross-border
- very long
- no-route
- ambiguous address
- invalid address

### Fuels

- U91
- E10
- P95
- P98
- diesel
- premium diesel
- LPG
- EV or unsupported fuel where present

### Station States

- fresh
- stale
- closed
- unknown hours
- unavailable fuel
- member-only
- duplicate
- moved coordinates
- missing brand
- missing price

### User Profiles

- no profile
- wrong fuel type
- low tank
- high tank
- discount wallet
- no wallet
- fleet restrictions
- multiple vehicles

### Network States

- fast
- slow
- offline
- provider timeout
- rate limited
- cached response
- fallback provider

### UI Environments

- small mobile
- large mobile
- tablet or web preview
- dark mode
- light mode
- system theme
- large text
- reduced motion

## Release Gates

### Before Production Deploy

- typecheck passes
- API regression suite passes
- provider-routing tests pass for all supported regions
- local browser smoke passes
- mobile viewport matrix passes for Plan, Nearby and Account
- accessibility pass completes for core flows
- backend status confirms intended providers and cost modes
- audit and security checks pass with no known production vulnerabilities
- performance baseline is captured or compared
- manual destructive exploratory session is recorded

### After Production Deploy

Smoke:

- `/api/status`
- `/api/stations`
- `/api/route`
- `/api/score`
- `/api/geocode`

Route checks:

- one metro route
- one regional route
- one cross-border route
- one unsupported or limited-capability case

Confirm:

- stale or unsupported regions show honest state
- no blank success for provider gaps
- no browser console errors
- no fetch failures
- no broken map state
- no horizontal overflow
- production security headers remain present
- production dependency audit remains clean

## Failure Logging

Every failed break-it test should record:

- priority: P0, P1 or P2
- route
- region
- fuel
- provider
- user profile
- viewport or platform
- reproduction steps
- observed result
- expected result
- screenshot or response payload where useful
