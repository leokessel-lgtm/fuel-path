# Performance Guardrails

Performance is now a standing Fuel Path goal from prototype through store release.

## Product Principle

Fuel Path should feel like a quick driver utility, not a heavy dashboard.

Every dependency, asset, data cache and background feature should justify itself against one of the main product goals.

## Current Guardrails

- Keep saved commutes local and compact. Current cap: 20 routes.
- Keep API.NSW credentials, route scoring and broad station analysis in the backend.
- Do not bundle station datasets, map tiles or large logo packs into the app.
- Add native SDKs only when they directly support Plan, Nearby, Account, maps, location, alerts or store readiness.
- Optimise brand assets before adding them to the native bundle.
- Prefer server-side price-cycle and saved-route price checks over phone-side background polling.
- Treat web preview bundle size as a warning signal, but use real iOS/Android builds as the release benchmark.

## Metrics To Track

Set exact baselines after the first EAS preview builds.

- App download size: baseline each iOS and Android preview build, then flag any unexplained growth over 10%.
- Cold start: target under 2.5 seconds on a mid-range Android device.
- First map interaction: target under 1 second after screen render.
- Map movement: keep panning and marker selection visually smooth on supported devices.
- Route planning response: target under 3 seconds on a warm backend for common NSW/ACT routes.
- Saved-route storage: cap at 20 routes until user research proves a higher limit is needed.
- Local persistence: keep Account and saved-route reads under 100 ms in normal use.

## Open Decisions

- Set real binary-size baselines after the first EAS preview builds.
- Decide whether price-triggered saved-route alerts are backend push notifications or a hybrid native/background model.
- Add automated bundle-size checks once the build pipeline is stable.
