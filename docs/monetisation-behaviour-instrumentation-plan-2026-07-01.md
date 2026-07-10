# Monetisation Behaviour Instrumentation Plan

Date: 2026-07-01
Status: design-ready, mobile wiring not started

## Purpose

Fuel Path should not treat route savings as monetisation-ready until real users show behaviour, not just interest.

This plan defines the first privacy-safe behaviour evidence needed before paid consumer features, fleet-lite pilots or public savings claims.

## Behaviour Questions

The first validation loop should answer:

- Do users plan the same or similar route more than once?
- Do users save a commute after seeing a recommendation?
- Do users opt into route alerts after understanding the saving and detour?
- Do users open navigation from the recommended station?
- Do high-frequency users behave differently from casual testers?

## Event Contract

Use aggregate behavioural events only. Do not log exact Home, Work, route geometry, raw addresses, registration numbers, push tokens or provider credentials.

Recommended event names:

| Event | Trigger | Required fields | Forbidden fields |
| --- | --- | --- | --- |
| `route_plan_completed` | Plan route returns a recommendation or useful blocked state | `sessionId`, `segment`, `regionSet`, `fuel`, `resultStatus`, `topRecommendationSourceType`, `bestPriceByCplBand`, `detourMinutesBand` | exact route labels, coordinates, station address |
| `route_plan_repeated` | Same anonymised user plans another route in the validation window | `sessionId`, `segment`, `repeatCountBand`, `daysSinceFirstPlanBand` | precise timestamp sequence tied to location |
| `saved_commute_created` | User saves a route or commute | `sessionId`, `segment`, `regionSet`, `fuel`, `routeDistanceKmBand` | saved route name, Home/Work label, coordinates |
| `route_alert_opt_in` | User enables or requests a saved-route alert | `sessionId`, `segment`, `alertUseCase`, `savingThresholdBand`, `detourThresholdBand` | push token, device identifier, exact route |
| `navigation_opened` | User opens directions from a recommendation | `sessionId`, `segment`, `stationRegion`, `recommendationRank`, `bestPriceByCplBand`, `detourMinutesBand` | destination coordinates, full station address |
| `recommendation_rejected` | User says they would not act on the recommendation in a session | `sessionId`, `segment`, `rejectionReason`, `minimumWorthwhileSavingBand`, `maximumAcceptableDetourBand` | personal explanation containing private address details |

## Bands

Use bands instead of raw values in validation evidence:

```text
bestPriceByCplBand: 0, 0-2, 2-5, 5-10, 10+
detourMinutesBand: 0, 0-2, 2-5, 5-10, 10+
routeDistanceKmBand: 0-10, 10-30, 30-80, 80-200, 200+
repeatCountBand: 1, 2, 3-5, 6+
daysSinceFirstPlanBand: same_day, 1-3, 4-7, 8-30
minimumWorthwhileSavingBand: 0-2, 2-5, 5-10, 10+
maximumAcceptableDetourBand: 0, 0-2, 2-5, 5-10, 10+
```

## Validation Thresholds

Minimum evidence before consumer monetisation:

- 7 real participant sessions completed through `docs/templates/VALIDATION-RESULTS.template.json`.
- At least 4 participants would change a real fuel decision or enable a useful route alert.
- At least 3 commuter or high-frequency users create or want a saved commute or saved-route alert.
- At least 3 users open or say they would open navigation from the recommendation.
- No unresolved privacy objection around route, location or alert tracking.

Minimum evidence before fleet-lite monetisation:

- At least 1 small operator or tradie agrees to a follow-up pilot.
- Fleet report assumptions are accepted as understandable.
- The buyer can name at least one recurring route, approved brand/card constraint or reporting need.

## Evidence File

Use:

```text
MONETISATION-BEHAVIOUR-EVIDENCE-YYYY-MM-DD.json
```

Start from:

```text
docs/templates/MONETISATION-BEHAVIOUR-EVIDENCE.template.json
```

## UI/UX Changes Not Yet Approved

The following would need Leo approval before implementation:

- adding a visible "save this commute" prompt after a recommendation
- adding a visible "track this route" or "alert me" prompt in Plan
- adding any analytics consent or beta telemetry notice in Account
- adding a post-navigation feedback prompt

## Current Recommendation

Start by collecting this contract through validation-session notes or a local evidence file. Wire automatic mobile events only after the validation flow proves which signals are worth keeping.
