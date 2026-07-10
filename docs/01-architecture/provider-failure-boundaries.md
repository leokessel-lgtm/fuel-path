# Provider and failure boundaries

Provider behaviour is split across five concerns. Keep them separate during
future changes.

| Concern | Examples | Rule |
| --- | --- | --- |
| Credentials | `_providerCredentials.js` | Never expose keys in status or client payloads |
| Capability and public claims | `_capabilities.js`, readiness evidence | Technical access is not permission or release readiness |
| Runtime resilience | `_providerRuntime.js` | Timeouts, retry budgets, circuit breakers and single-flight are bounded |
| Adapter normalisation | provider-specific modules | Translate upstream shapes without leaking provider quirks into UI contracts |
| Observability | `_providerObservability.js`, response provenance | Report source, freshness, cache and degraded state without sensitive route data |

## Failure rules

- Fail closed when usage permission, durable quota or required credentials are
  missing.
- Use stale data only when the response labels its age and policy permits it.
- Do not retry non-transient failures indefinitely.
- Do not turn a validation provider into an invisible production substitute.
- Return plain-language recovery copy to users; retain technical detail in safe
  diagnostics.
- Treat cross-instance coordination as absent unless backed by durable storage.
