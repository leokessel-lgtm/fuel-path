# Repo Change Split - 21 June 2026

This branch is the latest local build branch:

```text
stabilise/latest-local-build
```

The purpose of this split is to stop new build flows from blending with the backlog while keeping the latest local app shell visible at:

```text
http://localhost:8081
```

The local web-demo validation harness remains available at:

```text
http://localhost:4175/web-demo/
```

## Review Surfaces

Use Git's index as the temporary separation surface:

- staged changes: latest local stabilisation cut
- unstaged tracked changes: broader product/backlog work already in progress
- untracked files: new backlog evidence, new gates, extracted modules and generated support files that still need their own review slice

Useful commands:

```bash
git diff --cached --stat
git diff --cached --name-only
git diff --stat
git ls-files --others --exclude-standard
```

## Stabilisation Cut

Keep this slice small and review first.

Files in scope:

- `.gitignore`
- `README.md`
- `docs/04-validation-evidence/historical/stabilisation-cut-2026-06-21.md`
- `docs/archive/repository/repo-change-split-2026-06-21.md`
- `mobile-app/NATIVE-VALIDATION.md`
- `web-demo/README.md`
- `web-demo/app.js`
- `web-demo/index.html`
- `web-demo/styles.css`
- `tests/api/web-demo-safety.test.js`

Reason:

- restore visible web-demo station logos
- document the current local branch, latest app shell URL and web-demo validation URL separately
- record the refreshed Android physical-device evidence
- keep beta readiness blocked on provider terms, fresh Android installed-build/physical-performance evidence, privacy/store evidence and support readiness while treating source-level iOS simulator validation separately from signed iOS push/store evidence
- ignore local/generated artefact noise such as `var/`

Verification:

```bash
node --test tests/api/web-demo-safety.test.js
cd mobile-app && npm test
npm run check:secret-hygiene
npm run check:beta-readiness -- --api-base https://fuel-path.vercel.app --store-evidence-json docs/templates/STORE-PUBLISHING-EVIDENCE.template.json --provider-terms-evidence-json docs/templates/PROVIDER-TERMS-EVIDENCE.template.json --allow-blocked
```

## Backlog And Product-Hardening Slice

This is valuable work, but it should not be reviewed as part of the stabilisation cut.

Main areas:

- backend provider/runtime extraction and reliability gates
- hosted G-NAF lookup, Oracle infrastructure and Supabase review gates
- provider terms, store readiness, privacy and support readiness checkers
- native screen/module extraction and app architecture hardening
- validation recruitment, results templates and evidence matrices
- `TODO.md`, because it mixes roadmap and stabilisation notes
- retention cleanup, backend alert orchestration and prediction/back-test storage
- native Android/iOS readiness scripts and tests
- product research, partner brief and gold-mining stress-test documents
- `BACKLOG-EVIDENCE-MATRIX.md`, which is the cross-slice evidence register rather than a narrow stabilisation patch

Review this in smaller follow-up slices, preferably:

1. backend provider/runtime split
2. lookup/G-NAF platform and Supabase decision gates
3. native app architecture extraction
4. privacy, store, support and validation readiness gates
5. docs/research/backlog evidence pack

## Generated Or Local Artefacts

Keep generated evidence in `tmp/` or ignored local folders. Keep build artefacts out of Git unless they are intentionally tiny fixtures.

Ignored or local-only examples:

- `tmp/`
- `var/`
- `.playwright-cli/`
- `mobile-app/native-artifacts/`
- local env files and local database/tooling folders

## Stop Rule

Do not merge or present the backlog slice as beta-ready until the readiness gate still reports only the intended external blockers and the relevant slice has its own tests/evidence.
