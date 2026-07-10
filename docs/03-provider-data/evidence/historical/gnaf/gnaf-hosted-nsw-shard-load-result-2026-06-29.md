# Hosted G-NAF NSW shard load result

Date: 2026-06-29

## Result

Failed.

The staged NSW hosted shard load proved the current Neon hosted target is not large enough for a single full NSW shard, let alone national G-NAF.

## Command

```bash
npm run load:gnaf-raw-postgres -- --input data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip --states NSW --reset --skip-indexes --allow-state-shard --storage-review docs/03-provider-data/evidence/historical/gnaf/gnaf-hosted-storage-review-2026-06-29.json --progress-json tmp/gnaf-raw-postgres-load-2026-06-29T02-52-32-960Z-NSW-shard.json --run-id 2026-06-29T02-52-32-960Z-NSW-shard
```

## Evidence

- Progress file: `tmp/gnaf-raw-postgres-load-2026-06-29T02-52-32-960Z-NSW-shard.json`
- Started: `2026-06-29T03:00:24.980Z`
- Failed: `2026-06-29T03:20:52.362Z`
- Rows loaded before failure: `1,655,000`
- Target shard: NSW
- Expected NSW rows: `5,206,855`
- Failure:

```text
could not extend file because project size limit (512 MB) has been exceeded
```

## Hosted readiness after failure

Readiness command:

```bash
npm run check:gnaf-hosted:readiness
```

Result:

- Status: not ready
- Hosted rows: `1,654,500`
- Missing search indexes:
  - `fuel_path_gnaf_addresses_search_prefix_idx`
  - `fuel_path_gnaf_addresses_search_trgm_idx`
  - `fuel_path_gnaf_addresses_state_postcode_idx`
  - `fuel_path_gnaf_addresses_locality_idx`
- Readiness problems:
  - `database_row_count_below_threshold`
  - `database_search_indexes_missing`

## Rollback

The partial shard state was rolled back to the preview-sized hosted dataset.

Rollback commands:

```bash
npm run load:gnaf-raw-postgres -- --input data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip --states ACT,NSW,NT,QLD,SA,TAS,VIC,WA --limit-per-state 10000 --reset --progress-json tmp/gnaf-raw-postgres-load-rollback-preview-explicit-states-2026-06-29.json --run-id rollback-preview-explicit-states-2026-06-29
npm run load:gnaf-raw-postgres -- --setup-only --create-indexes
```

Rollback result:

- Status: completed
- Rows restored: `80,000`
- State slices restored:
  - ACT: `10,000`
  - NSW: `10,000`
  - NT: `10,000`
  - QLD: `10,000`
  - SA: `10,000`
  - TAS: `10,000`
  - VIC: `10,000`
  - WA: `10,000`
- Indexes recreated: yes

Hosted readiness after rollback:

- Status: not ready
- Hosted rows: `80,000`
- Missing indexes: none
- Readiness problem: `database_row_count_below_threshold`

This restores the previous preview posture while keeping public exact-address claims blocked.

## Decision impact

Do not run:

- national hosted G-NAF load
- hosted 900-case national benchmark
- production public exact-address green claim

until the hosted storage tier is upgraded or a different hosted storage architecture is approved.

## Brutal critique

- The current Neon target is too small for the job. It failed before completing one state shard.
- The previous estimated hosted national storage range of `62.7-125.5 GB` is directionally useful, but the operational reality is harsher: the current project limit is `512 MB`.
- The table was reset before loading, so the hosted target is now a partial NSW load without search indexes. Treat it as failed evidence, not a preview index.
- Rollback worked, but it was manual and required an explicit state list to avoid a stuck `OT` source bucket. This should be scripted before another hosted write attempt.

## Recommendation

Upgrade or replace the hosted storage target before retrying.

Minimum approval criteria before the next hosted write:

- storage limit comfortably above the expected national indexed size
- explicit monthly cost acceptance
- rollback command scripted
- state-shard load retry plan
- readiness and benchmark commands run after index creation
