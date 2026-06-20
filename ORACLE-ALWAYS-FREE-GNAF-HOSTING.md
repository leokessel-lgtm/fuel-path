# Oracle Always Free G-NAF Hosting

Last updated: 20 June 2026, Australia/Sydney

## Current Status

- Oracle email confirmed the `leokessel` cloud account is fully provisioned.
- Console login works with identity domain `Default`.
- The saved Resource Manager stack `fuel-path-gnaf-vm-always-free-template` has been updated to use an Oracle Linux 9.6 aarch64 image and has successfully created the G-NAF VM.
- Created VM:
  - instance OCID: `ocid1.instance.oc1.ap-sydney-1.anzxsljrqg2bidicwxaxotcw7cw2dhd52bhfet5qjtulxznyq7cmckqee3qq`
  - public IP: `152.69.175.222`
  - private IP: `10.0.1.218`
  - display name: `fuel-path-gnaf-vm`
  - image: Oracle Linux 9.6 aarch64
  - shape: `VM.Standard.A1.Flex`
  - OCPU: `1`
  - memory: `6 GB`
  - boot volume: `180 GB`
  - public IPv4 enabled
  - no separate block volume, reserved public IP or load balancer
- Stack source package:
  - local path: `oracle-stack/fuel-path-gnaf-vm-ol9-aarch64/fuel-path-gnaf-vm-ol9-aarch64.zip`
  - SHA-256: `b67779faf8a41575fa2adc1f8afb4d75e79c2fbb7605a44125b965d3214f7ff9`
- Guarded plan job `plan-ol9-aarch64-1781897731` succeeded:
  - job OCID: `ocid1.ormjob.oc1.ap-sydney-1.amaaaaaaqg2bidiaxfy6y4acwn3mffm7mtry7zqb2ysue5dli5yjkwf2twoq`
  - `VM.Standard.A1.Flex`
  - `1` OCPU
  - `6 GB` memory
  - `180 GB` boot volume
  - public IPv4 enabled
  - `Plan: 1 to add, 0 to change, 0 to destroy`
  - no separate block volume, reserved public IP or load balancer
- Guarded apply job `apply-ol9-aarch64-1781897908` succeeded:
  - job OCID: `ocid1.ormjob.oc1.ap-sydney-1.amaaaaaaqg2bidiarpi24bjq64yzdizegshcp7jsm2rlxyn5jkcmiwn6mc4q`
  - result: `Apply complete! Resources: 1 added, 0 changed, 0 destroyed.`
- SSH works with local key `~/.ssh/fuel_path_oracle_gnaf_ed25519` and user `opc`.
- Host bootstrap has completed on Oracle Linux 9.6:
  - Postgres installed and running locally.
  - Node.js `22.23.0` installed.
  - Caddy installed.
  - `/opt/fuel-path` created and owned for the app runtime.
  - `/etc/fuel-path/gnaf-api.env` created with generated secrets.
  - `fuel-path-gnaf-api.service` installed and enabled.
  - API is bound to `127.0.0.1:8787`, not the public interface.
- Boot volume expansion has been completed with `oci-growfs`:
  - `/dev/sda`: `180 GB`
  - `/dev/sda3`: `177.9 GB`
  - root logical volume: `162.9 GB`
  - root filesystem available space after bootstrap: `152 GB`
- Current API pre-load checks:
  - superseded by the completed national load below.
- National G-NAF load completed on 20 June 2026:
  - source: `data/gnaf/build/gnaf-addresses-national.sqlite`
  - loaded rows: `16,905,824`
  - database size after indexes: about `8.7 GB`
  - root filesystem after load: `163 GB` total, about `143 GB` free
  - table: `fuel_path_gnaf_addresses`
  - required indexes:
    - `fuel_path_gnaf_addresses_pkey`
    - `fuel_path_gnaf_addresses_search_prefix_idx`
    - `fuel_path_gnaf_addresses_search_trgm_idx`
    - `fuel_path_gnaf_addresses_state_postcode_idx`
    - `fuel_path_gnaf_addresses_locality_idx`
- Loaded row counts by region:
  - ACT: `282,553`
  - NSW: `5,206,855`
  - NT: `119,401`
  - OT: `5,186`
  - QLD: `3,566,078`
  - SA: `1,282,166`
  - TAS: `375,613`
  - VIC: `4,394,828`
  - WA: `1,673,144`
- Current API post-load checks through local SSH tunnel `http://127.0.0.1:8789`:
  - `GET /health` returns HTTP `200`, `tableExists:true`, `addressRows:16905824`, `indexReady:true`.
  - unauthenticated `/search` rejects missing and wrong tokens.
  - `87A Corea Street Sylvania` returns `87A Corea Street, Sylvania NSW 2224`.
  - exact-prefix timing examples on the VM:
    - `87A Corea Street Sylvania`: HTTP `200`, about `0.05s`
    - `87A Corea`: HTTP `200`, about `0.006s`
    - `corea sylvania`: HTTP `200`, about `0.99s`
    - `1 Macquarie Street Sydney`: HTTP `200`, about `0.01s`
- Readiness checks:
  - `npm run check:gnaf-hosted:readiness` passed against the Oracle API via SSH tunnel with database env blanked.
  - `npm run test:geocode-hosted-national -- --mode module --address-count 32 --poi-count 0 --delay-ms 0 --min-poi-top-rate 0 --min-address-prefix 30 --max-address-p90-chars 80` passed:
    - `32/32` final top matches
    - `100%` top match rate
    - `4/4` sampled cases passed for each of ACT, NSW, NT, QLD, SA, TAS, VIC and WA
    - output: `tmp/geocode-hosted-national-benchmark-2026-06-19T20-28-00-348Z.json`
- Public HTTPS endpoint is live:
  - temporary host: `https://gnaf.152.69.175.222.sslip.io`
  - Caddy reverse proxy: `/etc/caddy/Caddyfile`
  - local config source: `scripts/oracle/Caddyfile.gnaf`
  - Caddy proxies only to `127.0.0.1:8787`
  - OCI security list allows TCP `80` for ACME and TCP `443` for HTTPS API access
  - `GET /health` returns HTTP `200`, `addressRows:16905824`, `indexReady:true`
- Vercel production configuration is active:
  - `FUEL_PATH_GNAF_API_URL=https://gnaf.152.69.175.222.sslip.io`
  - `FUEL_PATH_GNAF_API_TOKEN` set as a sensitive production env var
  - production `FUEL_PATH_GNAF_DATABASE_URL` removed so Vercel cannot fall back to the old 80,000-row staging database
  - production deploy `dpl_BugNdQLNK889kFiV3uerxCFNSAoj` is live at `https://fuel-path.vercel.app`
- Public hosted G-NAF readiness passed:
  - evidence: `tmp/gnaf-hosted-readiness-2026-06-19T20-59-public-api.json`
  - row count: `16,905,824`
  - all expected indexes present
  - missing-token and wrong-token `/search` requests are rejected
  - exact smoke passed for NSW, ACT, VIC, QLD, WA, SA, TAS and NT
- Production lookup checks:
  - `GET /api/status` reports `geocoding.addressIndex.mode: api` and `source: https://gnaf.152.69.175.222.sslip.io`
  - `GET /api/geocode?q=87A%20Corea%20Street%20Sylvania&limit=5` returns `87A Corea Street, Sylvania NSW 2224` from `fuel_path_gnaf`
  - hosted preview smoke passed `20/20`: `tmp/geocode-hosted-preview-smoke-2026-06-19T20-50-09-349Z.json`
  - hosted national benchmark passed the address slice but failed the broader POI release gate:
    - evidence: `tmp/geocode-hosted-national-benchmark-2026-06-19T20-59-29-051Z.json`
    - addresses: `600/600` top matches, p90 any-match chars `30`
    - POIs: `257/300` top matches, below the `98%` release threshold
    - current blocker is POI coverage/ranking, not G-NAF address hosting
- Storage/cost review has passed for attempting the national G-NAF load on the reviewed Always Free shape. Evidence:
  - `tmp/gnaf-hosted-storage-review-2026-06-19T16-25-39-760Z.md`
  - `tmp/gnaf-hosted-load-plan-2026-06-19T16-34-09-997Z.md`
  - reviewed load plan status: `ready_to_load`
  - reviewed estimated hosted storage: `17.5-35 GB`
  - hosted smoke database remains staging-only at `80,000` rows

## Decision

Use **Oracle Cloud Always Free Compute** as the production-sized no-hosting-fee path for the national G-NAF address lookup layer.

Fuel Path should not expose Postgres directly to Vercel or the mobile app. Instead:

1. Run Postgres on an Oracle Always Free VM.
2. Load `fuel_path_gnaf_addresses` into that local Postgres database.
3. Run the small Fuel Path G-NAF API on the VM.
4. Point Vercel to the API with:

```text
FUEL_PATH_GNAF_API_URL=https://gnaf.your-domain.example
FUEL_PATH_GNAF_API_TOKEN=...
```

The existing backend then resolves addresses in this order:

1. Oracle-hosted G-NAF API.
2. Hosted Postgres URL, if configured.
3. Local SQLite index, if configured.
4. Seed records.
5. External providers.

## Current Official Free Limits To Design Around

Oracle documentation checked on 20 June 2026 lists:

- Ampere A1 Always Free compute: `1,500 OCPU hours` and `9,000 GB hours` per month, equivalent to `2 OCPUs` and `12 GB RAM`.
- Always Free block volume storage: `200 GB` total for boot and block volumes.
- Default compute boot volume is described as `50 GB` in the block-volume section; the compute section also references a `47 GB` minimum boot volume. Treat `50 GB` as the conservative planning floor.
- Outbound data transfer: `10 TB/month`.
- Idle Always Free compute instances can be reclaimed if CPU, network and memory utilisation stay low over a 7-day period.

Older blog posts and guides often mention `4 OCPUs` and `24 GB RAM`; do not design around that unless the OCI console for Leo's tenancy explicitly labels it Always Free.

## Billing Guardrails

Oracle signup requires a real credit/debit card for identity checks. Oracle says temporary authorisation holds may appear and are removed by the bank.

Budgets are useful, but they are **soft alerts**, not a hard spending cap. Treat the console's **Always Free-eligible** label as the source of truth before creating resources.

Hard rules for this project:

- Create resources only in the tenancy home region.
- Use one `VM.Standard.A1.Flex` instance marked Always Free.
- Keep total boot/block storage below `180 GB`, leaving headroom under the `200 GB` allowance.
- Do not create a paid load balancer.
- Do not expose Postgres to the public internet.
- Use HTTPS for the G-NAF API.
- Protect `/search` with `FUEL_PATH_GNAF_API_TOKEN`.
- Set a monthly budget alert at `$1` or the lowest allowed value.

## Storage And Cost Review

The current review command is:

```bash
npm run review:gnaf-hosted-storage -- \
  --load-plan tmp/gnaf-hosted-load-plan-2026-06-19T16-25-01-136Z.json \
  --require-passed
```

The review currently passes with:

- target: `oracle_always_free_compute`
- boot volume: `180 GB`
- attached block volume: `0 GB`
- Always Free block storage limit: `200 GB`
- usable disk after OS/Postgres reserve: `136 GB`
- estimated load workspace: `48.8 GB`
- load disk headroom: `87.2 GB`
- public Postgres: not allowed
- paid load balancer: not allowed
- budget alert: `USD 1`

This is only storage/cost clearance to attempt the load. It does not prove national hosted coverage, API readiness, preview smoke, production smoke or public launch readiness.

## Created VM Shape

```text
Shape: VM.Standard.A1.Flex
OCPUs: 1
Memory: 6 GB
Image: Oracle Linux 9.6 aarch64
Boot volume: 180 GB total
Public IPv4: yes, for HTTPS API access
```

The previous A1 capacity blocker is resolved. Keep the VM on this free-eligible shape unless a reviewed cost decision changes it.

## VM Setup

SSH command:

```bash
ssh -i ~/.ssh/fuel_path_oracle_gnaf_ed25519 opc@152.69.175.222
```

Bootstrap has already been run. For rebuilds, after SSHing into it, copy the Oracle scripts and bootstrap:

```bash
sudo mkdir -p /opt/fuel-path/scripts/oracle
sudo chown -R opc:opc /opt/fuel-path
```

From the local project root:

```bash
rsync -av -e "ssh -i ~/.ssh/fuel_path_oracle_gnaf_ed25519" \
  scripts/oracle/ opc@152.69.175.222:/opt/fuel-path/scripts/oracle/
rsync -av -e "ssh -i ~/.ssh/fuel_path_oracle_gnaf_ed25519" \
  package.json package-lock.json opc@152.69.175.222:/opt/fuel-path/
```

Then on the VM:

```bash
sudo bash /opt/fuel-path/scripts/oracle/bootstrap-gnaf-vm.sh
cd /opt/fuel-path
sudo npm ci --omit=dev
sudo chown -R fuelpath:fuelpath /opt/fuel-path
```

Completed runtime setup on the VM:

```bash
sudo bash /opt/fuel-path/scripts/oracle/bootstrap-gnaf-vm.sh
cd /opt/fuel-path
sudo npm ci --omit=dev
sudo chown -R fuelpath:fuelpath /opt/fuel-path
sudo cp /opt/fuel-path/scripts/oracle/fuel-path-gnaf-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fuel-path-gnaf-api
```

Completed public endpoint setup:

1. Caddy reverse proxy is installed and serving `https://gnaf.152.69.175.222.sslip.io`.
2. Vercel production has `FUEL_PATH_GNAF_API_URL` and `FUEL_PATH_GNAF_API_TOKEN`.
3. Hosted G-NAF readiness and production address benchmark checks have passed.

Remaining release work:

1. Move from the temporary `sslip.io` host to a controlled Fuel Path domain when DNS is available.
2. Fix POI lookup coverage/ranking before marking the full 900-case lookup release gate ready.
3. Publish lookup readiness evidence env vars only after both hosted address and POI benchmark thresholds pass.

Useful service commands:

```bash
sudo systemctl status fuel-path-gnaf-api
curl http://127.0.0.1:8787/health
```

## HTTPS

Use Caddy or another reverse proxy on the VM:

```text
gnaf.152.69.175.222.sslip.io {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8787
}
```

Only expose ports `22`, `80` and `443` in OCI security rules. Restrict SSH to Leo's current IP where practical.

## App Configuration

Set these in Vercel:

```text
FUEL_PATH_GNAF_API_URL=https://gnaf.152.69.175.222.sslip.io
FUEL_PATH_GNAF_API_TOKEN=the-same-long-random-token
```

Keep `FUEL_PATH_GNAF_DATABASE_URL` unset in Vercel for Oracle mode. The database stays private on the VM.

## Acceptance Checks

Run after deployment:

```bash
curl https://gnaf.152.69.175.222.sslip.io/health
curl -H "Authorization: Bearer $FUEL_PATH_GNAF_API_TOKEN" \
  "https://gnaf.152.69.175.222.sslip.io/search?q=87A%20Corea%20Street%20Sylvania&limit=5"
```

Then run locally or in CI:

```bash
node --test tests/api/gnaf-address-index.test.js
npm run test:geocode-exact-address-readiness:local
npm run test:geocode-prefix-600:local
npm run check:gnaf-hosted:readiness
```

Hosted G-NAF address production readiness is met when:

- `/health` reports the expected row count, currently at least `10,000,000` rows unless `FUEL_PATH_GNAF_MIN_ADDRESS_ROWS` is deliberately changed for a reviewed staging gate.
- `/search` rejects missing or wrong tokens.
- The hosted readiness checker gets exact top-ranked `/search` results for real G-NAF smoke addresses in NSW, ACT, VIC, QLD, WA, SA, TAS and NT.
- The address slice of the hosted national benchmark passes against production.
- Vercel `/api/status` shows `addressIndex.mode` as `api`.

Full lookup release readiness is not met until POI lookup also passes the hosted national benchmark threshold.

## Sources

- Oracle Always Free Resources: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Oracle Cloud Free Tier FAQ: https://www.oracle.com/cloud/free/
- Oracle Budgets: https://docs.oracle.com/en-us/iaas/Content/Billing/Concepts/budgetsoverview.htm
