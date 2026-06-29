# Compact hosted G-NAF serving index plan

Date: 2026-06-29

## Decision

Build and trial a compact hosted G-NAF serving index before approving any paid national hosted storage upgrade.

The raw hosted NSW shard failed at `1,655,000` rows because the current Neon project size limit is `512 MB`. That proves the current raw-table approach is not viable on the current target.

## Recommendation

Use a separate compact serving table first:

```text
fuel_path_gnaf_address_serving
```

This table is intentionally smaller than `fuel_path_gnaf_addresses`. It keeps only runtime autocomplete fields:

- `id`
- `label`
- `lat`
- `lon`
- `state`
- `postcode`
- `locality`
- `address_kind`
- `search_prefix`
- `search_text`

It omits raw/source-oriented fields such as:

- `accuracy`
- `alias_principal`
- `primary_secondary`
- `geocode_type`
- raw display/refinement columns
- intermediate lookup tables

## Why not upgrade storage immediately

The previous local national SQLite is `41.83 GB`, and the hosted raw Postgres estimate was `62.7-125.5 GB` before we hit the current `512 MB` Neon limit.

Upgrading before compacting risks paying for a database shape we already know is inefficient.

## Approved next command

Run a compact NSW shard trial only:

```bash
npm run load:gnaf-compact-postgres -- --input data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip --states NSW --reset --skip-indexes --allow-compact-state-shard --storage-review docs/gnaf-compact-serving-storage-review-2026-06-29.json --progress-json tmp/gnaf-compact-serving-load-NSW-shard.json --run-id compact-NSW-shard
npm run load:gnaf-compact-postgres -- --setup-only --create-indexes
```

## Pass criteria

The compact NSW shard can only be considered promising if all are true:

- NSW load completes without hitting project size limits.
- Index creation completes.
- Progress JSON records row count and storage snapshot.
- Storage per row is materially lower than the raw failed approach.
- Projected national storage is commercially acceptable.
- Query benchmark passes for exact, unit, rural/remote, suburb, POI-like and numeric-address-like queries.

## What this does not approve

- Full national compact load.
- Runtime switch from `fuel_path_gnaf_addresses` to `fuel_path_gnaf_address_serving`.
- Paid storage upgrade.
- Public exact-address green claim.

## Brutal critique

- This compact table may still be too large once trigram indexes are added.
- It does not yet include the full rebuilt SQLite typeahead/refinement model, so runtime quality must be benchmarked before any switch.
- It adds a second hosted table path, which increases operational complexity.
- If compact NSW still fails under the current limit, the next decision is storage architecture, not another loader tweak.

## Next decision after trial

If compact NSW succeeds, use the measured storage per row to estimate national storage.

If compact NSW fails, stop using the current Neon project for hosted G-NAF and decide between:

- a paid Neon tier sized for national indexed storage
- Supabase Postgres with explicit disk/compute sizing
- a non-Postgres search-serving architecture
