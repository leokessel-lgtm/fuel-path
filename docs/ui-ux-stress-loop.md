# UI/UX Stress Loop

This loop turns the existing Fuel Path stress scripts into a ranked product UX pass.
It is meant to answer four questions:

- Can users complete the major happy paths?
- Can users recover from broken, stale, empty or ambiguous states?
- Do maps, suggestions, rankings, labels and recommendations behave under pressure?
- What is the highest-harm issue to fix next?

## Commands

```sh
npm run test:ui-ux-stress-loop:list
npm run test:ui-ux-stress-loop:quick
npm run test:ui-ux-stress-loop
npm run test:ui-ux-stress-loop:full
npm run test:ui-ux-stress-loop:native
```

The default profile is `broad`.

Use a different target with:

```sh
npm run test:ui-ux-stress-loop -- --app-url https://fuel-path.vercel.app/
```

## Profiles

- `quick`: fast hosted-compatible gate for core tests, unhappy paths, mocked maps, Plan route result clicks, adversarial recommendation rules and copy safety.
- `broad`: wider product pass across settings, route watch, provider chaos, state/fuel chaos, dense maps, production smoke and recommendation volume.
- `full`: heavy national and live-API pass for route recommendations, POI journeys and higher-volume Plan route checks.
- `native`: physical-device readiness and preview APK smoke. Pass `--native-artifact` or set `FUEL_PATH_NATIVE_ARTIFACT`.

## Evidence

Each run writes:

```text
tmp/ui-ux-stress-loop-<run-id>.json
tmp/ui-ux-stress-loop-<run-id>.md
```

The report includes:

- issues ranked by harm
- fixes still needed
- evidence table
- explicit exceptions
- untested needs

The loop does not silence failures, add exclusions, relax rules or hide output. A `P0 blocker` stops the run by default.

## Local-only Exception

`plan-field-entry-stress` uses local Expo/web mocks and editable-field oracles. It is intentionally skipped for hosted production URLs because production checks should not fail on stale local-only labels.

Run it against local Expo web when validating field-level suggestion behaviour:

```sh
cd mobile-app
npm run web -- --port 8081
cd ..
npm run test:ui-ux-stress-loop:quick -- --app-url http://127.0.0.1:8081/
```

