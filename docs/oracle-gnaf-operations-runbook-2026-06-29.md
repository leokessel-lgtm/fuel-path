# Oracle G-NAF operations runbook

Date: 2026-06-29

## Purpose

This runbook covers the non-blocking operational work around the live Oracle-hosted G-NAF service.

It does not replace the readiness gates in `docs/oracle-gnaf-live-architecture-2026-06-29.md`. Those gates remain the source of truth for whether production can make exact-address lookup claims.

## Current operating posture

Oracle G-NAF is production-capable for the current Fuel Path web runtime.

Current assumptions:

- Oracle VM serves the G-NAF API behind Caddy HTTPS.
- Vercel calls the G-NAF API using a server-side token.
- Browser clients never receive the G-NAF API token.
- Production readiness is checked through `/api/status` and the production lookup monitor.
- Scheduled monitoring runs from GitHub Actions every 30 minutes.

## Ownership

Operational owner: Leo / Fuel Path project owner until replaced.

Primary systems:

- Fuel Path production app: `https://fuel-path.vercel.app`
- Oracle G-NAF API endpoint: configured in Vercel as `FUEL_PATH_GNAF_API_URL`
- Oracle API token: configured in Vercel as `FUEL_PATH_GNAF_API_TOKEN`
- GitHub monitor: `.github/workflows/production-lookup-monitor.yml`

Do not record secrets in this document.

## Routine monitoring

The scheduled production monitor checks:

- `/api/status` reports lookup readiness as `ready`.
- Public exact-address claims are allowed.
- Oracle G-NAF API health reports index ready and at least 10 million address rows.
- Oracle API rejects unauthenticated and wrong-token lookup requests.
- Focused regional/unit/rural regression cases still pass against production.

Monitor artefacts:

- Each GitHub Actions run uploads the monitor JSON files from `tmp/`.
- Local monitor runs write to `tmp/production-lookup-monitor-*.json`.

Manual command:

```bash
npm run check:production-lookup-monitor -- --api-base https://fuel-path.vercel.app
```

## Escalation policy

If the scheduled monitor fails:

1. Open the failed GitHub Actions run.
2. Download the `production-lookup-monitor` artefact.
3. Check which monitor section failed:
   - `status_lookup_readiness`
   - `oracle_gnaf_api_health_and_auth`
   - `focused_lookup_regressions`
4. If `/api/status` is blocked, do not claim exact-address readiness publicly.
5. If Oracle API health fails, inspect Oracle VM service, Caddy and Postgres before changing app code.
6. If focused regressions fail but health is green, treat it as a ranking/regression bug and avoid changing infra first.

Escalation target:

- Until a formal support channel exists, Leo owns triage and recovery.
- Once a support inbox/on-call channel exists, add it here and to the beta readiness evidence.

## Oracle VM recovery checklist

Use this checklist when the Oracle G-NAF API is down or degraded.

1. Confirm the app symptom:

```bash
npm run check:production-lookup-monitor -- --api-base https://fuel-path.vercel.app
```

2. Confirm `/api/status` lookup readiness and blockers.

3. On the Oracle VM, check:

```bash
systemctl status fuel-path-gnaf-api
systemctl status caddy
systemctl status postgresql
```

4. If the API service is stopped, restart it:

```bash
sudo systemctl restart fuel-path-gnaf-api
```

5. If HTTPS/proxy is failing, check Caddy:

```bash
sudo systemctl restart caddy
sudo journalctl -u caddy -n 100 --no-pager
```

6. If Postgres is failing, inspect disk and service health before restarting:

```bash
df -h
sudo systemctl status postgresql
sudo journalctl -u postgresql -n 100 --no-pager
```

7. After recovery, rerun:

```bash
npm run check:production-lookup-monitor -- --api-base https://fuel-path.vercel.app
```

## Backup and snapshot policy

Minimum acceptable posture:

- Keep an Oracle VM boot-volume backup or snapshot before major OS, Postgres, Caddy or API changes.
- Keep the G-NAF load scripts and schema in Git as the rebuild path.
- Treat the Oracle Postgres database as rebuildable from official G-NAF source plus project load scripts, not as the only source of truth.

Recommended cadence:

- Monthly VM snapshot while Oracle remains the live G-NAF host.
- Snapshot before every G-NAF data refresh.
- Snapshot before changing Caddy, Postgres tuning, API service unit, firewall or token auth.

Restore target:

- Recovery target is lookup service restored and monitor passing, not exact byte-for-byte database restore.

## Data refresh plan

Refresh G-NAF when a new official release is adopted by the project, or at least quarterly while public exact-address claims depend on it.

Refresh sequence:

1. Download/prepare the new official G-NAF source outside Git.
2. Build or stage the updated index using existing G-NAF scripts.
3. Load to Oracle Postgres using the documented Oracle load path.
4. Confirm row count remains above the readiness threshold.
5. Run focused regressions against the Oracle path.
6. Run the 900-case hosted national benchmark against production or a production-equivalent endpoint.
7. Update Vercel readiness evidence variables only after benchmark evidence passes.
8. Add a short dated refresh note under `docs/` with source date, row count, benchmark file and decision.

Required commands after refresh:

```bash
npm run check:lookup-readiness -- --api-base https://fuel-path.vercel.app
npm run test:geocode-focused-regression -- --api-base https://fuel-path.vercel.app
npm run test:geocode-hosted-national -- --mode http --api-base https://fuel-path.vercel.app --address-count 600 --poi-count 300 --profile rural-unit --case-context --delay-ms 250
npm run check:production-lookup-monitor -- --api-base https://fuel-path.vercel.app
```

## Secret rotation plan

Rotate `FUEL_PATH_GNAF_API_TOKEN` when:

- There is any suspicion of exposure.
- Someone with access leaves the project.
- The token has not been rotated in 90 days.
- The Oracle API auth implementation changes.

Rotation sequence:

1. Generate a new strong token outside Git.
2. Update the Oracle API service environment.
3. Restart `fuel-path-gnaf-api`.
4. Update Vercel production `FUEL_PATH_GNAF_API_TOKEN`.
5. Redeploy or ensure runtime picks up the new env value.
6. Run the production monitor.
7. Remove the old token from every runtime surface.

Post-rotation acceptance:

```bash
npm run check:production-lookup-monitor -- --api-base https://fuel-path.vercel.app
```

The monitor must confirm both authorised app lookup readiness and unauthorised Oracle API rejection behaviour.

## Cost and ownership note

Record these outside secrets:

- Oracle account owner.
- VM region and shape.
- Expected monthly cost.
- Backup/snapshot cost posture.
- Renewal or free-tier risk.
- Who can access Oracle console.
- Who can access Vercel production env vars.
- Who can access GitHub Actions and repository settings.

Do not include Oracle login details, SSH keys, API tokens or database passwords.

## Change control

Update this runbook when any of these change:

- Oracle endpoint or hostname.
- VM service name.
- Caddy configuration.
- Postgres schema or load path.
- G-NAF refresh cadence.
- Token rotation cadence.
- Monitor schedule or checks.
- Escalation owner/channel.
