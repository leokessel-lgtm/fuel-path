# Prediction Back-Test Proof Gate

Date: 2026-07-03

Production surface: https://fuel-path.vercel.app

Raw evidence: `tmp/prediction-backtest-proof-2026-07-03T06-11-26-914Z.json`

## TLDR

Do not add Fuel Path prediction or cycle guidance to the user-facing product yet.

Current readiness is `measurement_only`. Public prediction is disabled and accuracy claims are blocked by the API gate. FuelRadar has a stronger public prediction story, but Fuel Path should only copy that product shape after back-tested directional accuracy, price-error performance and blind spots are visible in this report.

## Proof Gate

| Check | Current evidence |
| --- | --- |
| Readiness | measurement_only |
| Public prediction enabled | No |
| Accuracy claims allowed | No |
| Durable storage | Yes |
| Completed back-tests | 1 / 60 |
| Direction-labelled back-tests | 1 / 60 |
| Mean absolute error | 1.5 c/L (max 4.0 c/L) |
| Directional accuracy | 100% (min 68%) |

## Blockers

- prediction_completed_sample_below_threshold
- prediction_direction_sample_below_threshold

## API Blind-Spot Exposure

- No blind spots reported by the production API. Treat this as a validation failure before any prediction launch.

## Required Blind Spots Before Any Launch

- Predictions are blocked unless durable back-test storage is configured.
- Directional accuracy proves only up/down/flat direction, not the exact pump price a driver will see.
- Station-level prices can move differently from region averages and must not be presented as guaranteed.
- Provider outages, stale cache, delayed official feeds or station corrections can invalidate a cycle signal.
- WA tomorrow locked prices are official source data, not model prediction, and should be labelled separately.
- Uncovered or sparse regions and fuel grades must remain outside any prediction claim.

## National Signal Probe

This probe asks the production prediction API for the national scenario regions and U91/PDL with enough synthetic history to pass the initial history threshold. A `backtest_required` result is acceptable; it means the product still refuses guidance until measured records pass the proof gate.

| Region | Fuel | Signal | Reason |
| --- | --- | --- | --- |
| NSW | U91 | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| NSW | PDL | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| ACT | U91 | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| ACT | PDL | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| VIC | U91 | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| VIC | PDL | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| QLD | U91 | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| QLD | PDL | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| WA | U91 | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| WA | PDL | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| SA | U91 | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| SA | PDL | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| TAS | U91 | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| TAS | PDL | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| NT | U91 | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |
| NT | PDL | backtest_required | history threshold met, but measured back-test evidence is still required before guidance is enabled |

## Product Rule

- Do not add prediction copy to Nearby, Plan, route alerts, saved routes or marketing pages while `userFacingPredictionEnabled` is false.
- Do not make accuracy claims while `accuracyClaimsAllowed` is false.
- Before any limited launch, rerun this report and require durable storage, enough completed back-tests, measured directional accuracy, measured mean absolute error and named blind spots.
- WA tomorrow prices must stay labelled as official locked source data, not Fuel Path prediction.
