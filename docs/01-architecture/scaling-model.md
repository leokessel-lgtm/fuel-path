# Scaling model

Status: architecture target, not current capacity proof.

## Existing protections

- provider timeout and retry budgets
- circuit breakers and stale-while-revalidate paths
- identical-request single-flight within a runtime instance
- spatial prefiltering before route scoring
- durable production requirements for quota and alert state
- bounded mobile persistence, dependencies, assets and bundle checks

## Capacity questions still requiring evidence

- peak requests per second for stations, geocoding, Plan and alerts
- p50, p90 and p99 warm and cold latency by endpoint
- cache hit rate and upstream calls per user request
- serverless instance multiplication under bursts
- Postgres connection, transaction and pool limits
- provider daily quotas and per-second rate limits
- scheduled alert throughput, overlap and recovery time
- load shedding and user-visible behaviour during provider degradation

## Required load profiles

| Profile | Purpose | Evidence required |
| --- | --- | --- |
| Controlled beta | Establish normal request mix and latency | Hosted run with request counts, cache state and provider-call totals |
| 10x beta | Expose connection, cold-start and upstream amplification limits | Hosted or production-like run with p90/p99 and error rate |
| Degraded peak | Prove bounded behaviour when one or more providers fail | Circuit, retry, stale-data and recovery evidence |

## Initial service objectives to reconcile

The product guardrail targets common route planning under three seconds, while
the current live stress command permits higher p90 and p95 values. Before making
capacity claims, define separate warm, cold and degraded budgets and make the
tests enforce the same numbers.
