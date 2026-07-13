# Fuel Path Project Vision

Last updated: 12 July 2026, Australia/Sydney

## TLDR

Fuel Path helps Australian drivers make the best fuel decision for a real trip:
fill now, wait, or fill on route. It is native iOS and Android software, built
local-first and without a mandatory account. Routine setup belongs to the
phone. Backend state exists only when a driver explicitly opts into smart
price alerts, and it is limited to delivering and safely evaluating that
service.

## Product Promise

Fuel Path is a route-first decision layer, not another fuel-price dot map. It
uses price freshness, eligibility, detour and safety to explain the best
action. The map is supporting evidence, not the product.

## Primary Users

- Commuters and high-frequency drivers who repeatedly decide whether to fill
  now or on their normal route.
- Fleet-lite users, later and only after consumer behaviour evidence supports
  a narrowly bounded pilot.

## Problem

Raw pump-price maps make drivers do the comparison work themselves. They do
not answer whether an apparently cheaper stop is worth the detour, applies to
the driver's fuel and discount eligibility, or is fresh enough to trust.

## Why Now

**Evidence held:** the native shell, route planning, local saved commutes and
backend-owned route evaluation already exist in this repository. Provider,
native-device, privacy and store evidence remain separate release gates. This
does not demonstrate adoption, provider approval, prediction readiness or
store readiness.

## What Fuel Path Does

- Keeps the core decision fast and native on iOS and Android.
- Stores vehicle preferences, saved places, saved routes and recent locations
  on the device by default.
- Keeps fuel-price/provider data, route computation, recommendation scoring
  and alert evaluation on the backend.
- Offers smart price alerts only after clear notification and backend-sync
  opt-in.
- Explains price freshness, eligibility, detour and limitations without
  presenting a forecast as fact.

## What Fuel Path Does Not Do

- It does not require an email address, name or password for normal use.
- It does not automatically back up, transfer or synchronise routine local
  state between phones.
- It does not collect continuous/background location to infer routes.
- It does not allow mobile clients to connect directly to the product database.
- It does not use the product-state database as G-NAF infrastructure.
- It does not change route scoring, rejection logic or user-facing savings
  claims through the data-architecture work described here.

## Current Product Truth

The app must state this plainly before a driver saves a route:

> Your saved routes are stored on this device. They will not automatically
> move to a new phone or return after deleting the app.

An anonymous installation identity is generated on first native launch. It is
not an account and is not a promise of recovery. If a device is lost, erased
or replaced, the new install is a new anonymous owner. A later account option
may be considered only for explicit backup, device transfer or multi-device
sync, never as a prerequisite for the core decision flow.

## Strategic Boundaries

| Boundary | Decision |
| --- | --- |
| Product-state data | Local-first; server copies only the minimum needed for an opted-in alert. |
| Identity | Anonymous installation owner, not `fuel_path_users` and not a person profile. |
| Security | Backend API is the only database boundary. It validates short-lived capability and installation ownership for every alert-state action. |
| Mapping | G-NAF remains separate infrastructure with separate storage, operations and retention. |
| Growth | Start with indexes, bounded work, idempotency and observable queues. Add partitions or new infrastructure only at named capacity triggers. |
| Data minimisation | No raw route history or continuous location collection. Alert route material exists only while the user has opted in and needs evaluation. |

## Release Gates

The account-free architecture is not a release approval. Before enabling
public backend alerts, Fuel Path needs the architecture and QA gates in
[`../01-architecture/ACCOUNT-FREE-NATIVE-DATA-ARCHITECTURE.md`](../01-architecture/ACCOUNT-FREE-NATIVE-DATA-ARCHITECTURE.md), plus the separate provider,
privacy, support and native-device gates routed from
[`../02-build-release/CURRENT-RELEASE-DECISION.md`](../02-build-release/CURRENT-RELEASE-DECISION.md).

## Strategic Bets

- The repeat value is a trusted route decision, not generic map parity.
- Local-first removes account friction and keeps routine personal setup out of
  the backend.
- Useful, sparse alerts are a stronger retention mechanism than generic fuel
  notifications.
- Prediction remains a future wedge only where measured back-testing supports
  it.

## Next 30/60/90 Days

The detailed, reviewable implementation sequence is in the account-free
architecture plan. At a high level:

- **30 days:** make the local/secure ownership boundary explicit and close
  authorisation and deletion gaps without changing recommendations.
- **60 days:** introduce the smallest safe anonymous alert-owner contract,
  token lifecycle and retention jobs in a preview-isolated environment.
- **90 days:** test real native builds, controlled alert volume and deletion
  behaviour; only then consider a narrow opt-in alert beta.

## Evidence And Assumptions

**Evidence held:** the current repository has native local persistence,
token-gated alert writes, backend alert storage, an idempotent baseline product
database migration, and documented retention intentions.

**Assumption:** Expo Push Service remains the initial delivery path. It must
be re-evaluated if product volume, controls or delivery requirements exceed
its documented operating model.

**Unknown / needs verification:** production notification credentials,
database topology, preview isolation, provider permissions, native device
behaviour, privacy-policy wording and store declarations. None is inferred by
this vision.
