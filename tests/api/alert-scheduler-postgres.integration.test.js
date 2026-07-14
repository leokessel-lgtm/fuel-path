const assert = require("node:assert/strict");
const test = require("node:test");
const { Client } = require("pg");

const databaseUrl = process.env.FUEL_PATH_ALERT_SCHEDULER_TEST_DATABASE_URL || "";

test("Postgres alert scheduler claims oldest due rows atomically and recovers expired leases", {
  skip: databaseUrl ? false : "Set FUEL_PATH_ALERT_SCHEDULER_TEST_DATABASE_URL to run Postgres scheduler integration.",
}, async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousProductUrl = process.env.FUEL_PATH_PRODUCT_DATABASE_URL;
  process.env.FUEL_PATH_PRODUCT_DATABASE_URL = databaseUrl;
  delete process.env.DATABASE_URL;
  const runId = `scheduler_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("DELETE FROM fuel_path_saved_routes WHERE user_id LIKE 'scheduler\\_%' ESCAPE '\\'");
    await client.query(`
      INSERT INTO fuel_path_saved_routes (
        id, user_id, name, from_lat, from_lon, from_label, to_lat, to_lon, to_label,
        fuel, alert_enabled, alert_time_local, timezone, min_saving_dollars,
        max_detour_minutes, created_at, updated_at, raw, alert_next_evaluation_at
      )
      SELECT
        $1 || '_route_' || LPAD(value::text, 3, '0'),
        $1 || '_user_' || LPAD(value::text, 3, '0'),
        'Scheduler integration route',
        -33.8688, 151.2093, 'Origin', -33.815, 151.0011, 'Destination',
        'U91', true, '07:30', 'Australia/Sydney', 5, 8,
        NOW() - ((121 - value) * INTERVAL '1 minute'),
        NOW() - ((121 - value) * INTERVAL '1 minute'),
        '{"alertDays":["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
        NOW() - ((121 - value) * INTERVAL '1 minute')
      FROM generate_series(1, 120) AS value
    `, [runId]);

    delete require.cache[require.resolve("../../api/_alertStorage")];
    const { claimDueSavedRoutes } = require("../../api/_alertStorage");
    const now = new Date().toISOString();
    const [left, right] = await Promise.all([
      claimDueSavedRoutes({ limit: 50, now, leaseSeconds: 300 }),
      claimDueSavedRoutes({ limit: 50, now, leaseSeconds: 300 }),
    ]);
    const firstHundred = [...left, ...right];
    const remaining = await claimDueSavedRoutes({ limit: 50, now, leaseSeconds: 300 });

    assert.equal(firstHundred.length, 100);
    assert.equal(new Set(firstHundred.map((route) => `${route.userId}:${route.id}`)).size, 100);
    assert.equal(remaining.length, 20);
    assert.equal(
      new Set([...firstHundred, ...remaining].map((route) => `${route.userId}:${route.id}`)).size,
      120,
    );

    const expired = firstHundred[0];
    await client.query(`
      UPDATE fuel_path_saved_routes
      SET alert_lease_expires_at = NOW() - INTERVAL '1 second'
      WHERE user_id = $1 AND id = $2
    `, [expired.userId, expired.id]);
    const recovered = await claimDueSavedRoutes({ limit: 1, now: new Date().toISOString(), leaseSeconds: 300 });
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0].id, expired.id);
    assert.notEqual(recovered[0].alertLeaseToken, expired.alertLeaseToken);

    await client.query(`
      INSERT INTO fuel_path_saved_routes (
        id, user_id, name, from_lat, from_lon, from_label, to_lat, to_lon, to_label,
        fuel, alert_enabled, alert_time_local, timezone, min_saving_dollars,
        max_detour_minutes, created_at, updated_at, raw, alert_next_evaluation_at
      )
      SELECT
        $1 || '_scale_route_' || LPAD(value::text, 5, '0'),
        $1 || '_scale_user_' || LPAD(value::text, 5, '0'),
        'Scheduler scale route',
        -33.8688, 151.2093, 'Origin', -33.815, 151.0011, 'Destination',
        'U91', true, '07:30', 'Australia/Sydney', 5, 8,
        NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
        '{"alertDays":["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
        NOW() - INTERVAL '2 days'
      FROM generate_series(1, 10000) AS value
    `, [runId]);
    await client.query("ANALYZE fuel_path_saved_routes");
    const plan = await client.query(`
      EXPLAIN (FORMAT JSON)
      SELECT user_id, id
      FROM fuel_path_saved_routes
      WHERE alert_enabled = true
        AND (alert_lease_expires_at IS NULL OR alert_lease_expires_at <= NOW())
        AND (alert_next_evaluation_at IS NULL OR alert_next_evaluation_at <= NOW())
      ORDER BY alert_next_evaluation_at ASC NULLS FIRST, updated_at ASC, user_id ASC, id ASC
      LIMIT 500
    `);
    assert.match(JSON.stringify(plan.rows), /fuel_path_saved_routes_due_alert_idx/);
    const startedAt = performance.now();
    const scaleClaim = await claimDueSavedRoutes({ limit: 500, now: new Date().toISOString(), leaseSeconds: 300 });
    const claimDurationMs = performance.now() - startedAt;
    assert.equal(scaleClaim.length, 500);
    assert.equal(scaleClaim.every((item) => item.id.includes("_scale_route_")), true);
    assert.equal(claimDurationMs < 2000, true, `10,000-route claim took ${claimDurationMs.toFixed(1)} ms`);
  } finally {
    await client.query("DELETE FROM fuel_path_saved_routes WHERE user_id LIKE $1", [`${runId}%`]).catch(() => {});
    await client.end();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousProductUrl === undefined) delete process.env.FUEL_PATH_PRODUCT_DATABASE_URL;
    else process.env.FUEL_PATH_PRODUCT_DATABASE_URL = previousProductUrl;
  }
});
