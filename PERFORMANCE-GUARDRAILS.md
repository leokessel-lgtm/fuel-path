# Performance Guardrails

Last updated: 19 June 2026, Australia/Sydney

Performance is now a standing Fuel Path goal from prototype through store release.

## Product Principle

Fuel Path should feel like a quick driver utility, not a heavy dashboard.

Every dependency, asset, data cache and background feature should justify itself against one of the main product goals.

## Current Guardrails

- Keep saved commutes local and compact. Current cap: 20 routes.
- Keep provider credentials, route scoring and broad station analysis in the backend.
- Do not bundle national station datasets, provider payload archives or map tiles into the app.
- Do not bundle large logo packs into the app without optimisation.
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
- Route planning response: target under 3 seconds on a warm backend for common Australian metro and regional routes.
- Saved-route storage: cap at 20 routes until user research proves a higher limit is needed.
- Local persistence: keep Account and saved-route reads under 100 ms in normal use.

## Open Decisions

- Set real binary-size baselines after the first EAS preview builds.
- Decide whether price-triggered saved-route alerts are backend push notifications or a hybrid native/background model.
- Extend automated size checks from web/source assets to native preview binaries after the first EAS builds.
- Add national provider capability checks without increasing app bundle size materially.

## Backlog Guardrails From Architecture Review

- Production must not silently recommend from sample, demo, fallback or validation-provider data. Current status: production demo fallback is disabled for station/route recommendation paths.
- Provider calls need single-flight fetches, stale-while-revalidate behaviour, timeout budgets, retry budgets and circuit breakers before traffic increases. Current status: live fuel providers use single-flight fetches, timeout budgets, bounded retry attempts, stale-while-revalidate cache refresh and circuit-breaker cooldowns; regressions cover transient retry success and stale background revalidation.
- Route scoring needs spatial prefiltering before nearest-route checks so national station data does not scale as all stations by all route points. Current status: route envelope prefiltering is implemented and stress-tested with 250,000 station-like rows.
- Route providers need duplicate in-flight request protection before traffic increases. Current status: identical concurrent route builds are single-flighted; a stress probe of 500 identical metro route requests made 1 upstream call.
- Backend saved-route alerts need durable storage, idempotent evaluation and duplicate-suppression proof before push delivery is enabled. Current status: durable storage is mandatory and scheduled evaluations are idempotent for retry/cron-overlap cases.
- Bundle-size checks should cover native preview binaries, web export bundles, app icons and brand-logo assets. Current status: web export, source assets, brand-logo budgets and native artifact gates are automated; native artifact gates skip until CI downloads an APK/AAB/IPA into `mobile-app/dist-native`, `mobile-app/native-artifacts`, `mobile-app/build`, or passes `FUEL_PATH_NATIVE_ARTIFACT=/path/to/artifact`.
- Long-tail brand logos should not grow the app package unless they are compressed, generated, or loaded outside the core bundle. Current status: long-tail bundled logos now render as generated initial badges; the core bundled logo set is 20 images.
- Device performance checks must include older/mid-range Android map panning, marker selection, route redraw and cold start.
- Customer feedback risks to regression-test: stale prices, wrong fuel grade, bad distance, missing stations, out-of-fuel visibility, map sheet traps, location jumping and lost alert/reward state.
