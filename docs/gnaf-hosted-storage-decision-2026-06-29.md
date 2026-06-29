# Hosted G-NAF storage decision

Date: 2026-06-29

## Recommendation

Use the existing dedicated Neon `fuel_path_gnaf` target for staged hosted G-NAF validation, but do not approve the full national hosted load yet.

Approve this sequence:

1. Keep the current 80,000-row hosted preview in Neon.
2. Load one large state shard first, preferably NSW, because it is the largest state in the local index.
3. Run hosted readiness and benchmark checks against that shard.
4. Only approve the national load after the state-shard evidence proves query latency, index size, write time, rollback and cost are acceptable.

Do not migrate to Supabase or Vercel storage for this step.

## 2026-06-29 update

The NSW state-shard load was attempted and failed because the current Neon project size limit is 512 MB.

Evidence:

- Result file: `docs/gnaf-hosted-nsw-shard-load-result-2026-06-29.md`
- Rows loaded before failure: `1,655,000`
- Expected NSW rows: `5,206,855`
- Failure: `could not extend file because project size limit (512 MB) has been exceeded`

Updated decision:

- Current Neon target is not sufficient for the NSW shard.
- Full national hosted load remains blocked.
- Hosted 900-case national benchmark remains blocked.
- Public exact-address claims remain blocked.
- Next storage decision must approve a larger Neon tier or a replacement architecture before another hosted write attempt.
- The failed partial shard load was rolled back to the indexed 80,000-row preview posture.
- Recommended next step is not an immediate paid upgrade. Build and trial the compact serving index documented in `docs/gnaf-compact-serving-index-plan-2026-06-29.md`.
- Compact serving-index NSW trial also failed on the current Neon project limit after `1,588,000` rows. Current target should not be retried for hosted G-NAF without a storage tier or architecture change.

## Current evidence

Source: `tmp/gnaf-hosted-load-plan-2026-06-29T00-19-56-270Z.json`

- Raw G-NAF ZIP: 1.59 GB.
- Local national SQLite: 41.83 GB.
- Local rows: 16,900,638.
- Current hosted Neon target: reachable dedicated database, 80,000 rows loaded, expected indexes present.
- Estimated hosted Postgres storage: 62.7-125.5 GB.
- Row gap to readiness threshold: 9,920,000 rows.

## Current pricing evidence

Neon:

- Free plan storage is 0.5 GB per project.
- Launch storage is $0.35 per GB-month.
- Launch compute is $0.106 per CU-hour.
- Source: https://neon.com/pricing

Supabase:

- Paid projects use dedicated Postgres instances.
- Medium compute is about $60/month and is recommended up to 100 GB database size.
- Large compute is about $110/month and is recommended up to 200 GB database size.
- General Purpose disk includes 8 GB, then charges $0.125 per GB.
- Source: https://supabase.com/docs/guides/platform/compute-and-disk

Vercel:

- Vercel Postgres is no longer available for new projects. Vercel now connects external Postgres providers through Marketplace.
- Source: https://vercel.com/docs/postgres
- Vercel Blob is cheap for object storage, but it is not a replacement for indexed address autocomplete queries.
- Source: https://vercel.com/pricing

## Cost shape

Neon storage-only estimate:

- 62.7 GB x $0.35 = about $21.95/month.
- 125.5 GB x $0.35 = about $43.93/month.
- Compute, transfer, branching, backups/time-travel and query volume are additional.

Supabase rough database path:

- 62.7 GB would likely require at least Medium-class compute for headroom.
- 125.5 GB points closer to Large-class compute if the full index is queried directly.
- Disk overage may be cheaper than Neon storage, but Supabase adds a platform migration and operational change, and compute does not scale to zero.

## Decision

Chosen path for now: Neon staged validation.

Why:

- The codebase already has a dedicated Neon target and load/readiness scripts.
- The hosted target is already reachable and has the expected indexes.
- The main uncertainty is not whether data can be loaded. It is whether full national query performance and ongoing storage/compute cost are worth it.
- A provider migration before proving the shard economics would add risk without answering the core question.

What is approved:

- Preview and shard-level hosted tests on Neon.
- State-shard load and benchmark work.
- Benchmark/reporting improvements.

What is not approved:

- Full national load.
- Public national exact-address claims.
- Migrating to Supabase.
- Replacing indexed Postgres search with object storage.

## Brutal critique

The current national-load plan is technically plausible but commercially under-evidenced.

Weak points:

- The 62.7-125.5 GB estimate is too wide for a confident spend decision.
- The current hosted sample is only 80,000 rows, which proves plumbing, not national performance.
- The plan does not yet prove p90/p95 query latency under realistic autocomplete traffic.
- Full national load could create a slow, expensive database that still does not feel Google-grade to users.
- Supabase looks cheaper on disk, but that comparison is incomplete unless compute, downtime, migration, indexes, pooling and rollback are included.
- Actual NSW shard loading failed at the current 512 MB project limit before reaching even half the state shard.
- Rollback was successful, but still too manual and should be scripted before retrying hosted writes.
- A compact serving table may still fail once indexed, so the compact NSW trial is evidence gathering, not an approval to ship public exact-address claims.
- The compact trial failed before index creation, so the current storage limit is conclusively too small for this approach.

Required iteration before full load:

- Measure actual table and index growth after a large state shard.
- Benchmark prefix, exact-address, unit, rural/remote and POI-like queries against the shard.
- Record p50, p90, p95, slowest queries and query plan regressions.
- Estimate national cost from observed shard expansion, not only from SQLite-size multiplication.
- Add a rollback path before any national reset/load.

## Acceptance criteria for moving from shard to national

All must be true:

- State shard load completes without manual DB repair.
- Required indexes are present after load.
- Hosted readiness check passes for the shard.
- Representative hosted benchmark passes with no correctness regressions.
- p90 query latency is acceptable for typeahead.
- Estimated national monthly cost is explicitly accepted.
- Rollback/export path is documented.
- `FUEL_PATH_GNAF_STORAGE_REVIEW_CONFIRMED=1` is only set after the above evidence is held.
