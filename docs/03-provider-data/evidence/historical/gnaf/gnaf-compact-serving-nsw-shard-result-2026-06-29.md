# Compact hosted G-NAF NSW shard result

Date: 2026-06-29

## Result

Failed.

The compact serving-index trial also hit the current Neon project size limit before completing NSW.

## Command

```bash
npm run load:gnaf-compact-postgres -- --input data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip --states NSW --reset --skip-indexes --allow-compact-state-shard --storage-review docs/03-provider-data/evidence/historical/gnaf/gnaf-compact-serving-storage-review-2026-06-29.json --progress-json tmp/gnaf-compact-serving-load-NSW-shard-2026-06-29.json --run-id compact-NSW-shard-2026-06-29
```

## Evidence

- Progress file: `tmp/gnaf-compact-serving-load-NSW-shard-2026-06-29.json`
- Started: `2026-06-29T04:38:54.154Z`
- Failed: `2026-06-29T04:49:35.231Z`
- Compact rows loaded before failure: `1,588,000`
- Target shard: NSW
- Expected NSW rows: `5,206,855`
- Failure:

```text
could not extend file because project size limit (512 MB) has been exceeded
```

## Comparison with raw shard attempt

| Trial | Rows before failure | Indexes included during load | Result |
|---|---:|---|---|
| Raw hosted table | `1,655,000` | no | failed at 512 MB project limit |
| Compact serving table | `1,588,000` | no | failed at 512 MB project limit |

The compact serving columns did not materially improve capacity under the current Neon project limit.

## Cleanup

The failed compact partial table was reset back to an empty compact table:

```bash
npm run load:gnaf-compact-postgres -- --setup-only --reset --progress-json tmp/gnaf-compact-serving-reset-empty-2026-06-29.json --run-id compact-reset-empty-2026-06-29
```

The existing raw preview table remained intact and still reports:

- `80,000` rows
- expected hosted indexes present
- readiness blocked only by row count

## Decision impact

Do not retry NSW, compact NSW, or national G-NAF on the current Neon project limit.

Next decision must be a storage architecture decision, not another loader tweak.

## Brutal critique

- The current Neon project size limit is the dominant blocker. Compacting columns is not enough.
- The compact trial did not include indexes, so indexed storage would be even larger.
- Runtime switching to the compact table is not worth doing until storage can hold at least one indexed state shard.
- The compact loader is still useful as a future lower-footprint path, but it does not solve the current hosting tier.

## Recommendation

Choose one of these before retrying hosted G-NAF:

1. Upgrade Neon to a tier/storage limit that can hold at least NSW plus indexes, then rerun compact NSW first.
2. Move the hosted address index to a database/storage service sized for 60-125 GB plus indexes.
3. Build a non-Postgres search-serving architecture.

Do not approve public exact-address claims until a full hosted national benchmark passes.
