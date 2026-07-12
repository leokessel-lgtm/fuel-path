/*
 * Anonymous installation ownership for opt-in backend route alerts.
 * This is additive and intentionally forward-only. It contains no account or
 * person profile fields: only an opaque installation id and a secret verifier.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS fuel_path_alert_installations (
      installation_id TEXT PRIMARY KEY,
      secret_hash TEXT NOT NULL,
      secret_key_version TEXT NOT NULL DEFAULT 'v1',
      capability_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    )
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_alert_installations_active_idx
    ON fuel_path_alert_installations (last_seen_at DESC)
    WHERE revoked_at IS NULL
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS fuel_path_alert_rate_limits (
      rate_key TEXT NOT NULL,
      action TEXT NOT NULL,
      window_started_at TIMESTAMPTZ NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (rate_key, action)
    )
  `);
  pgm.sql(`
    ALTER TABLE fuel_path_saved_routes
    DROP CONSTRAINT IF EXISTS fuel_path_saved_routes_pkey
  `);
  pgm.sql(`
    ALTER TABLE fuel_path_saved_routes
    ADD CONSTRAINT fuel_path_saved_routes_pkey PRIMARY KEY (user_id, id)
  `);
  pgm.sql(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY expo_push_token ORDER BY last_seen_at DESC, id DESC
      ) AS position
      FROM fuel_path_push_devices
      WHERE status = 'active'
    )
    UPDATE fuel_path_push_devices AS device
    SET status = 'inactive', invalidated_at = NOW()
    FROM ranked
    WHERE device.id = ranked.id AND ranked.position > 1
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS fuel_path_push_devices_active_token_uidx
    ON fuel_path_push_devices (expo_push_token)
    WHERE status = 'active'
  `);
};

exports.down = () => {
  throw new Error("Anonymous alert installation ownership is forward-only. Restore from backup rather than dropping live tables.");
};
