# Fuel Path documentation context budget

Measured: 2026-07-10, Australia/Sydney

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
| Product orientation | 3 | 132 | 6,997 | 1,750 |
| Roadmap-first orientation comparator | 3 | 880 | 37,527 | 9,382 |
| Provider task | 4 | 200 | 10,339 | 2,585 |
| Route change | 3 | 737 | 51,677 | 12,920 |
| Full catalogue audit | 3 | 237 | 22,457 | 5,615 |

Profile membership is defined in `scripts/doc-context-profiles.json`.

## Interpretation

- The root repo-owned default is only `AGENTS.md`, estimated at 229 tokens.
  `docs/README.md` is task routing, not automatically loaded context.
- Routing product orientation through `docs/current-product.md` is estimated at
  1,750 tokens versus 9,382 for the roadmap-first comparator, an estimated 81%
  reduction for that specific reading path.
- This does not prove an 81% reduction for all Codex tasks. Most tasks will open
  source files and additional evidence.
- Provider orientation is estimated at 2,585 tokens before provider-specific
  evidence or source code is opened.
- Route changes remain deliberately expensive because the 667-line route rules
  are mandatory context for scoring, savings and recommendation wording work.
- The full catalogue should be opened only for documentation audits.

## Budget rule

When adding a source-of-truth document or changing the task router:

1. update `scripts/doc-context-profiles.json` if profile membership changes;
2. run `npm run measure:doc-context`;
3. update this dated table;
4. describe reductions only for measured profiles;
5. do not present character-based estimates as exact billed or model tokens.
