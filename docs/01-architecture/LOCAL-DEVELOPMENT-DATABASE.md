# Local development database

Fuel Path has two separate database concerns:

1. **Product-state Postgres** for saved routes, push devices, alert evaluations,
   prediction history and geocoding quota.
2. **G-NAF address infrastructure**, which remains separate. Do not point
   `DATABASE_URL` at the dedicated G-NAF database and do not load the national
   address index into this local developer database.

## Local setup

Docker and the `docker-compose` command must be available.

```sh
npm run db:up
npm run db:migrate:local
```

The local database listens on `127.0.0.1:54329` and uses the development-only
credentials in `.env.example`. It is deliberately not exposed on the usual
Postgres port so it is less likely to collide with another local project.
Fuel Path automatically uses its direct Postgres client for this loopback URL;
hosted Neon URLs keep using the serverless client.

To start again with an empty database:

```sh
npm run db:reset
```

To stop it while retaining data:

```sh
npm run db:down
```

## Inspect local data

List the tables in the local product-state database:

```sh
docker-compose -f docker-compose.yml exec postgres \
  psql -U fuel_path -d fuel_path -c "\\dt"
```

Run `SELECT *` against every Fuel Path product-state table:

```sh
docker-compose -f docker-compose.yml exec postgres \
  psql -U fuel_path -d fuel_path -c "SELECT * FROM fuel_path_push_devices;"

docker-compose -f docker-compose.yml exec postgres \
  psql -U fuel_path -d fuel_path -c "SELECT * FROM fuel_path_saved_routes;"

docker-compose -f docker-compose.yml exec postgres \
  psql -U fuel_path -d fuel_path -c "SELECT * FROM fuel_path_route_alert_evaluations;"

docker-compose -f docker-compose.yml exec postgres \
  psql -U fuel_path -d fuel_path -c "SELECT * FROM fuel_path_prediction_backtests;"

docker-compose -f docker-compose.yml exec postgres \
  psql -U fuel_path -d fuel_path -c "SELECT * FROM fuel_path_market_price_snapshots;"

docker-compose -f docker-compose.yml exec postgres \
  psql -U fuel_path -d fuel_path -c "SELECT * FROM fuel_path_geocode_quotas;"
```

For large local tables, prefer adding `LIMIT 50` rather than printing every
row. The migration ledger is available separately through `SELECT * FROM
pgmigrations;`.

## Migration rules

- Every product-state schema change gets a new forward-only migration under
  `db/migrations/`.
- Run `npm run db:migrate` with `DATABASE_URL` set for a shared or hosted
  environment. This command is intentionally explicit and never reads a G-NAF
  connection variable.
- The initial baseline is idempotent so it can adopt a pre-existing product
  database whose tables were created before migrations were introduced.
- Do not run schema-changing SQL in API request handling. Runtime checks only
  verify that required tables exist and direct the operator to the migration
  command when they do not.
- Production migrations are a separate, logged deployment step. Run them
  against the intended environment before publishing code that needs the new
  schema, then verify the application status and relevant storage flow.

## Environment variables

`DATABASE_URL` is the standard product-state connection variable. Alert and
prediction storage use it directly. Geocoding quota also honours
`FUEL_PATH_GEOCODE_QUOTA_DATABASE_URL` when that storage must be isolated.

The current API keeps its in-memory fallback only when no relevant database URL
is configured. When a URL is configured but migrations are missing, requests
fail with a clear migration instruction rather than creating tables at runtime.
