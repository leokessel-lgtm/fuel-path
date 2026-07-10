# G-NAF National Address Index

Last updated: 20 June 2026, Australia/Sydney

**Classification:** source-of-truth for the G-NAF-first address decision,
licence constraints and acceptance principles. Hosting commands and readiness
statements are dated implementation options. Current code supports hosted API,
Postgres, SQLite and seed modes through `api/_addressIndex.js`.

## Decision

Fuel Path should use **G-NAF Core** as the first national street-address lookup layer.

G-NAF Core is preferred over the full raw G-NAF tables for the first production implementation because it provides the useful address fields in a simplified pipe-separated table:

- `ADDRESS_DETAIL_PID`
- `ADDRESS_LABEL`
- flat/unit fields
- street number and street fields
- locality, state and postcode
- `LATITUDE` and `LONGITUDE`
- geocode type
- principal/alias and primary/secondary fields

Google Places remains the fallback for POIs, landmarks and natural-language searches.

## Official Sources

- data.gov.au G-NAF dataset: https://data.gov.au/data/dataset/geocoded-national-address-file-g-naf
- G-NAF Core documentation: https://docs.geoscape.com.au/projects/gnafcore_info/en/stable/
- Department of Industry overview: https://www.industry.gov.au/publications/geocoded-national-address-file-g-naf-and-administrative-boundaries-ab-data

## Licence And Product Constraints

- G-NAF is open data, but use is subject to the Open G-NAF End User Licence Agreement.
- Fuel Path must show or preserve attribution:
  - `G-NAF © Geoscape Australia licensed by the Commonwealth of Australia under the Open G-NAF End User Licence Agreement.`
- Fuel Path must not present G-NAF as proof that an address can receive mail.
- Fuel Path should use current active addresses for autocomplete.
- Retired addresses should stay out of normal autocomplete unless we intentionally add an old-address recovery feature.
- G-NAF is an address file, not a POI database. It will not replace Google for businesses, landmarks, parks, airports or service stations.

## Local Build

Download the latest G-NAF/G-NAF Core release from data.gov.au or Geoscape.

As of 18 June 2026, the public data.gov.au package exposes the full May 2026 G-NAF PSV ZIPs. The GDA2020 ZIP downloaded locally is:

```text
data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip
```

The local file is ignored by Git because it is large.

### Preferred G-NAF Core Path

If an active `GNAF_CORE` pipe-separated file is available, build a local SQLite autocomplete index:


```bash
npm run build:gnaf-sqlite -- \
  --input /path/to/GNAF_CORE.psv \
  --output prototype/data/gnaf-addresses.sqlite
```

### Public Raw G-NAF Path

If only the public raw G-NAF ZIP is available, build the index directly from the ZIP:

```bash
npm run build:gnaf-raw-sqlite -- \
  --input data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip \
  --output data/gnaf/build/gnaf-addresses-national.sqlite
```

This joins the raw state tables:

- `ADDRESS_DETAIL`
- `ADDRESS_DEFAULT_GEOCODE`
- `LOCALITY`
- `STREET_LOCALITY`

The first local full build from the May 2026 GDA2020 ZIP produced:

- `16,905,824` address records
- `12 GB` SQLite database
- states and territories: ACT, NSW, NT, OT, QLD, SA, TAS, VIC and WA

Run the backend against the local index:

```bash
FUEL_PATH_GNAF_SQLITE_PATH=prototype/data/gnaf-addresses.sqlite npm run test:geocode-prefix-600:local
```

The backend will report address-index mode as `sqlite` when `FUEL_PATH_GNAF_SQLITE_PATH` is configured.

Local SQLite is a validation and development asset. It is too large and too slow to ship inside Vercel functions or the native app. Production should use a hosted searchable database.

## Production Build

Create the hosted table and indexes:

```bash
psql "$FUEL_PATH_GNAF_DATABASE_URL" \
  -f scripts/sql/gnaf-address-index-postgres.sql
```

Export the G-NAF Core file to the normalised COPY format when using the Core path:

```bash
npm run export:gnaf-postgres-copy -- \
  --input /path/to/GNAF_CORE.psv \
  --output tmp/gnaf-addresses.copy.tsv
```

Load the file:

```bash
psql "$FUEL_PATH_GNAF_DATABASE_URL" \
  -c "\\copy fuel_path_gnaf_addresses (id,label,lat,lon,state,postcode,accuracy,locality,alias_principal,primary_secondary,geocode_type,search_text) FROM 'tmp/gnaf-addresses.copy.tsv' WITH (FORMAT csv, DELIMITER E'\\t', HEADER true)"
```

Configure production:

```bash
FUEL_PATH_GNAF_DATABASE_URL=postgres://...
```

The backend will report address-index mode as `postgres` when the database URL is configured.

### Public Raw ZIP To Hosted Postgres

When loading from the public raw G-NAF ZIP, use the streaming hosted loader:

```bash
FUEL_PATH_GNAF_DATABASE_URL=postgres://... \
  npm run load:gnaf-raw-postgres -- \
  --input data/gnaf/raw/g-naf_may26_allstates_gda2020_psv_1023.zip \
  --reset \
  --skip-indexes \
  --allow-large-load \
  --storage-review tmp/gnaf-hosted-storage-review-2026-06-19T16-25-39-760Z.json
```

Then create search indexes after the rows are loaded:

```bash
FUEL_PATH_GNAF_DATABASE_URL=postgres://... \
  npm run load:gnaf-raw-postgres -- \
  --setup-only \
  --create-indexes
```

For a small validation run:

```bash
npm run load:gnaf-raw-postgres -- \
  --dry-run \
  --states NSW \
  --limit-per-state 1000
```

Do not run the full hosted load against the generic app `DATABASE_URL`. Use a dedicated hosted G-NAF target because the full load is roughly 17 million address records and search indexes can be storage/cost heavy.

The loader refuses an unbounded hosted import by default. Use `--limit-per-state` for validation loads. Use `--allow-large-load` only after confirming the database plan and storage budget.

### Storage And Cost Review Gate

Before running the national hosted load, generate the load plan and storage/cost review:

```bash
npm run plan:gnaf-hosted-load -- --no-storage-review
npm run review:gnaf-hosted-storage -- --load-plan tmp/gnaf-hosted-load-plan-<run-id>.json --require-passed
npm run plan:gnaf-hosted-load
```

The latest passed review is:

```text
tmp/gnaf-hosted-storage-review-2026-06-19T16-25-39-760Z.md
```

It confirms only the storage/cost side of attempting the Oracle Always Free national load:

- 180 GB boot volume under the 200 GB Always Free block-storage limit
- no public Postgres
- no paid load balancer
- USD 1 budget alert assumption
- estimated hosted Postgres table/index range of 17.5-35 GB
- estimated load workspace of 48.8 GB with 87.2 GB headroom

The latest reviewed load plan is:

```text
tmp/gnaf-hosted-load-plan-2026-06-19T16-34-09-997Z.md
```

It is `ready_to_load`, not production-ready. The actual national hosted load, readiness check, hosted preview smoke and hosted national benchmark still need to run.

## Lookup Order

`/api/geocode` should resolve in this order:

1. Hosted G-NAF Postgres index, if configured.
2. Local G-NAF SQLite index, if configured.
3. Seed address file, for local validation.
4. Regional/remote Fuel Path gazetteer.
5. Google Places or other configured external provider.
6. Nominatim only for validation mode.

## Acceptance Checks

Before marking G-NAF production-ready:

- `87A Corea Street, Sylvania NSW 2224` resolves from G-NAF without external provider calls.
- `5/34 South Coast Highway, Karratha WA` resolves as a unit/slash address.
- `npm run check:gnaf-hosted:readiness` passes against the hosted target with:
  - at least `10,000,000` rows, or an explicitly reviewed higher/lower threshold through `FUEL_PATH_GNAF_MIN_ADDRESS_ROWS`
  - exact top-ranked smoke results for real G-NAF records in NSW, ACT, VIC, QLD, WA, SA, TAS and NT
  - `/search` rejecting missing and wrong bearer tokens
- Exact G-NAF address matches skip Google/Nominatim.
- Unit, flat and townhouse-style queries are labelled as exact only when the indexed address record supports that exact unit.
- Prefix search returns useful results before the full address is typed.
- Remote and rural addresses are covered through G-NAF, while non-address POIs fall through to Google.
- `/api/status` shows `addressIndex.mode` as `postgres` in production.
- `/api/status` shows `geocoding.lookupReadiness.publicExactAddressClaimsAllowed: true`.
- `npm run check:lookup-readiness` passes against the target environment or hosted URL.
- Attribution is preserved in backend status and any future legal/about surface.

## Refresh Process

G-NAF is updated quarterly.

Recommended refresh cycle:

1. Download the latest active G-NAF Core release.
2. Build SQLite locally.
3. Run:
   - `node --test tests/api/gnaf-address-index.test.js`
   - `npm run test:geocode-exact-address-readiness:local`
   - `npm run test:geocode-route-exact-addresses:local`
   - `npm run test:geocode-prefix-600:local`
4. Export Postgres COPY file.
5. Load into a staging or branch database.
6. Run `npm run check:gnaf-hosted:readiness` against the hosted database.
7. Run the hosted geocode preview smoke:

```bash
FUEL_PATH_API_BASE=https://your-preview-or-production-host.example \
  npm run test:geocode-hosted-preview
```

This writes a short JSON and Markdown release report for 20 high-risk exact-address, unit/slash, townhouse, rural, remote, island and POI queries.

8. Run the hosted national lookup benchmark:

```bash
FUEL_PATH_API_BASE=https://your-preview-or-production-host.example \
  npm run test:geocode-hosted-national
```

This samples `600` real address expectations from the local national G-NAF SQLite index and adds `300` POI/gazetteer cases. It writes JSON and CSV evidence under `tmp/`, including top-match rate, any-match rate, characters-to-correct-suggestion, final providers and observed fetch-call categories.

The local exact-address route-field fixture is intentionally tiny and only proves mechanics. Do not use its characters-to-exact numbers as production autocomplete precision evidence; use the hosted national benchmark for that claim.

9. Publish the readiness evidence from the two machine-generated JSON outputs:

```bash
npm run publish:lookup-readiness-evidence -- \
  --hosted-check tmp/gnaf-hosted-readiness.json \
  --benchmark tmp/geocode-hosted-national-benchmark-<run-id>.json \
  --out tmp/lookup-readiness.env
```

The publisher refuses to emit passing evidence unless hosted exact-address smoke, bearer-token rejection, national row count, benchmark thresholds and benchmark timestamp are all present.

10. Run the deploy gate:

```bash
set -a
source tmp/lookup-readiness.env
set +a
FUEL_PATH_API_BASE=https://your-preview-or-production-host.example \
  npm run check:lookup-readiness
```

11. Generate the combined lookup release evidence summary:

```bash
npm run summarise:lookup-release-evidence
```

This writes one JSON and Markdown release decision that separates local precision readiness from public launch readiness. Use `--require-launch-ready` in CI or release checks when a blocked summary should fail the job.

12. Promote the database connection after smoke checks, the readiness gate and the combined release summary pass.

## Known Gaps

- The current importer expects an extracted active G-NAF Core file, not a raw ZIP.
- `scripts/build-gnaf-raw-address-index.mjs` can build a local SQLite index directly from the public raw ZIP.
- `scripts/load-gnaf-raw-postgres.mjs` can stream the public raw G-NAF ZIP into a hosted Postgres/Neon database.
- The first production implementation uses one table and trigram search. That is enough for autocomplete v1, but we may later add suburb/street-specific indexes for faster ranking.
- G-NAF does not cover POI intent. Google Places remains required for landmarks and businesses.
