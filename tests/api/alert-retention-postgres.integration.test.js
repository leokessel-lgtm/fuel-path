const assert = require("node:assert/strict");
const test = require("node:test");
const { Client } = require("pg");

const {
  deleteOrphanedInstallationAlertData,
  orphanedInstallationRetentionCounts,
  deleteStaleAlertRateLimits,
  staleAlertRateLimitCount,
} = require("../../api/_orphanedAlertRetention");

const connectionString = process.env.FUEL_PATH_ALERT_RETENTION_TEST_DATABASE_URL || "";

test(
  "Postgres retention removes only stale orphaned or revoked anonymous alert installations",
  { skip: connectionString ? false : "Set FUEL_PATH_ALERT_RETENTION_TEST_DATABASE_URL to run the Postgres contract." },
  async () => {
    const client = new Client({ connectionString });
    await client.connect();
    const sql = async (strings, ...values) => {
      const text = strings.reduce(
        (query, segment, index) => query + segment + (index < values.length ? `$${index + 1}` : ""),
        "",
      );
      return (await client.query(text, values)).rows;
    };

    try {
      await client.query(`
        CREATE TEMP TABLE fuel_path_alert_installations (
          installation_id TEXT PRIMARY KEY,
          last_seen_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ
        );
        CREATE TEMP TABLE fuel_path_push_devices (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL
        );
        CREATE TEMP TABLE fuel_path_saved_routes (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          alert_enabled BOOLEAN NOT NULL
        );
        CREATE TEMP TABLE fuel_path_route_alert_evaluations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL
        );
        CREATE TEMP TABLE fuel_path_alert_rate_limits (
          rate_key TEXT NOT NULL,
          action TEXT NOT NULL,
          window_started_at TIMESTAMPTZ NOT NULL,
          request_count INTEGER NOT NULL,
          PRIMARY KEY (rate_key, action)
        );
      `);
      await client.query(`
        INSERT INTO fuel_path_alert_installations (installation_id, last_seen_at, revoked_at) VALUES
          ('orphaned', '2026-01-01T00:00:00.000Z', NULL),
          ('revoked', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'),
          ('active', '2026-01-01T00:00:00.000Z', NULL),
          ('recent', '2026-06-18T00:00:00.000Z', NULL);
        INSERT INTO fuel_path_push_devices (id, user_id, status) VALUES
          ('device-orphaned', 'orphaned', 'inactive'),
          ('device-revoked', 'revoked', 'inactive'),
          ('device-active', 'active', 'active');
        INSERT INTO fuel_path_saved_routes (id, user_id, alert_enabled) VALUES
          ('route-orphaned', 'orphaned', false),
          ('route-revoked', 'revoked', false),
          ('route-active', 'active', true);
        INSERT INTO fuel_path_route_alert_evaluations (id, user_id) VALUES
          ('evaluation-orphaned', 'orphaned'),
          ('evaluation-revoked', 'revoked'),
          ('evaluation-active', 'active');
        INSERT INTO fuel_path_alert_rate_limits (rate_key, action, window_started_at, request_count) VALUES
          ('old-counter', 'issue-capability-network', '2026-01-01T00:00:00.000Z', 1),
          ('current-counter', 'issue-capability-network', '2026-06-18T00:00:00.000Z', 1);
      `);

      const cutoff = "2026-03-21T00:00:00.000Z";
      const [dryRun] = await orphanedInstallationRetentionCounts(sql, cutoff);
      assert.deepEqual(dryRun, {
        installation_count: 2,
        device_count: 2,
        route_count: 2,
        evaluation_count: 2,
      });
      const [staleRateLimits] = await staleAlertRateLimitCount(sql, cutoff);
      assert.equal(staleRateLimits.count, 1);

      const [deleted] = await deleteOrphanedInstallationAlertData(sql, cutoff);
      assert.deepEqual(deleted, {
        installation_count: 2,
        device_count: 2,
        route_count: 2,
        evaluation_count: 2,
      });

      const installations = await client.query(
        "SELECT installation_id FROM fuel_path_alert_installations ORDER BY installation_id",
      );
      const devices = await client.query("SELECT user_id FROM fuel_path_push_devices ORDER BY user_id");
      const routes = await client.query("SELECT user_id FROM fuel_path_saved_routes ORDER BY user_id");
      const evaluations = await client.query(
        "SELECT user_id FROM fuel_path_route_alert_evaluations ORDER BY user_id",
      );
      assert.deepEqual(installations.rows, [{ installation_id: "active" }, { installation_id: "recent" }]);
      assert.deepEqual(devices.rows, [{ user_id: "active" }]);
      assert.deepEqual(routes.rows, [{ user_id: "active" }]);
      assert.deepEqual(evaluations.rows, [{ user_id: "active" }]);
      const deletedRateLimits = await deleteStaleAlertRateLimits(sql, cutoff);
      assert.equal(deletedRateLimits.length, 1);
      const rateLimits = await client.query("SELECT rate_key FROM fuel_path_alert_rate_limits ORDER BY rate_key");
      assert.deepEqual(rateLimits.rows, [{ rate_key: "current-counter" }]);
    } finally {
      await client.end();
    }
  },
);
