# Fuel Path documentation context budget

Measured: 2026-07-11, Australia/Sydney

This budget measures repository-owned documentation only. It excludes system,
developer, user and conversation context, source files opened during a task and
tool output.

Estimated tokens use `ceil(UTF-8 text characters / 4)`. This is a transparent
planning estimate, not a model-tokenizer count.

Run:

```sh
npm run measure:doc-context
```

## Current profiles

| Profile | Files | Lines | Characters | Estimated tokens |
| --- | ---: | ---: | ---: | ---: |
| Root default | 1 | 23 | 914 | 229 |
| Mobile app default | 2 | 26 | 1,032 | 258 |
| Product orientation | 3 | 120 | 6,524 | 1,631 |
| Roadmap-first orientation comparator | 3 | 868 | 37,147 | 9,287 |
| Provider task | 3 | 157 | 7,384 | 1,846 |
| Backend API task | 3 | 78 | 4,008 | 1,002 |
| Release readiness | 4 | 140 | 7,056 | 1,764 |
| Route change | 3 | 725 | 51,189 | 12,798 |
| Full catalogue audit | 2 | 204 | 22,334 | 5,584 |

Profile membership is defined in `scripts/doc-context-profiles.json`.

## Interpretation

- The root repo-owned default is only `AGENTS.md`, estimated at 229 tokens.
  `docs/README.md` is task routing, not automatically loaded context.
- Routing product orientation through `docs/current-product.md` is estimated at
  1,631 tokens versus 9,287 for the roadmap-first comparator, an estimated 82%
  reduction for that specific reading path.
- This does not prove an 81% reduction for all Codex tasks. Most tasks will open
  source files and additional evidence.
- Provider orientation is estimated at 1,846 tokens before provider-specific
  evidence or source code is opened.
- Route changes remain deliberately expensive because the 667-line route rules
  are mandatory context for scoring, savings and recommendation wording work.
- Protected frequent/audit profiles must retain at least 15% headroom. This
  fails in CI, so gradual router growth cannot silently consume the ceiling.
  Required-member contracts prevent gaining headroom by hiding essential guidance.
- The full catalogue should be opened only for documentation audits. It is
  self-routing and does not require the routine task router to be loaded first.

## Budget rule

When adding a source-of-truth document or changing the task router:

1. update `scripts/doc-context-profiles.json` if profile membership changes;
2. run `npm run measure:doc-context`;
3. update this dated table;
4. describe reductions only for measured profiles;
5. do not present character-based estimates as exact billed or model tokens.

Do not raise a ceiling to resolve a failure. Split routing from detail, remove
unrelated profile members or seek an explicit, time-limited baseline exception.
