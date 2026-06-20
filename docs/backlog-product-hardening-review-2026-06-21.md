# Backlog Product-Hardening Review - 21 June 2026

Branches pointing at this snapshot:

```text
backlog/product-hardening-review
latest/local-app-current
```

This snapshot preserves the broad backlog and product-hardening work that was separated from the clean stabilisation cut. It also contains the current local app shell visible at `http://localhost:8081`.

Status:

- unreviewed snapshot
- not beta-ready
- not the narrow stabilisation cut
- requires smaller follow-up review slices before merge

The clean web-demo stabilisation cut is:

```text
stabilise/latest-local-build
```

Current local app shell:

```text
http://localhost:8081
```

Web-demo validation harness:

```text
http://localhost:4175/web-demo/
```

## Review Order

Review this branch in smaller slices:

1. backend provider/runtime extraction and route scoring
2. G-NAF, Oracle, hosted lookup and Supabase decision gates
3. native app architecture extraction and screen complexity guards
4. privacy, store, provider terms, support and beta-readiness gates
5. validation, research, partner brief and backlog evidence documents

## Merge Rule

Do not merge this branch whole into the stabilisation branch. Cherry-pick or PR smaller reviewed slices after their tests and evidence are current. Keep `latest/local-app-current` pointing at the currently accepted local app snapshot until a cleaner reviewed app branch replaces it.
