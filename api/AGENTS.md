# Fuel Path backend instructions

- Treat top-level public API files as transport adapters. Keep domain logic in
  underscore-prefixed modules and export it through `_backend.js` only where a
  handler needs it.
- Preserve response contracts, public error wording, provenance and capability
  state when extracting modules.
- Keep provider adapters separate from credentials, capability policy, caching,
  observability and public-claim readiness.
- Do not replace durable quota, alert or audit state with process memory.
- In-process caches and single-flight protection are per runtime instance. Do
  not describe them as cross-instance coordination.
- Add focused regression tests before splitting `_backend.js`, `_geocode.js` or
  `_addressIndex.js`.
- Update `docs/route-recommendation-logic-rules.md` with route scoring, ranking,
  rejection, detour, savings or recommendation-copy changes.
