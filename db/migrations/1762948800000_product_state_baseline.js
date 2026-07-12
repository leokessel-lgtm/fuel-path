/*
 * Baseline for the product-state database. This deliberately uses idempotent
 * Postgres statements so it can adopt an existing database that was created
 * by Fuel Path's pre-migration runtime schema setup.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS fuel_path_push_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      expo_push_token TEXT NOT NULL,
      app_version TEXT,
      status TEXT NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL,
      invalidated_at TIMESTAMPTZ,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_push_devices_user_status_idx
    ON fuel_path_push_devices (user_id, status, last_seen_at DESC)
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS fuel_path_saved_routes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      from_lat DOUBLE PRECISION NOT NULL,
      from_lon DOUBLE PRECISION NOT NULL,
      from_label TEXT NOT NULL,
      to_lat DOUBLE PRECISION NOT NULL,
      to_lon DOUBLE PRECISION NOT NULL,
      to_label TEXT NOT NULL,
      fuel TEXT NOT NULL,
      alert_enabled BOOLEAN NOT NULL,
      alert_time_local TEXT NOT NULL,
      timezone TEXT NOT NULL,
      min_saving_dollars DOUBLE PRECISION NOT NULL,
      max_detour_minutes DOUBLE PRECISION NOT NULL,
      paused_until TIMESTAMPTZ,
      last_alert_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_saved_routes_user_enabled_idx
    ON fuel_path_saved_routes (user_id, alert_enabled, updated_at DESC)
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS fuel_path_route_alert_evaluations (
      id TEXT PRIMARY KEY,
      saved_route_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      station_code TEXT,
      station_name TEXT,
      estimated_saving_dollars DOUBLE PRECISION,
      detour_minutes DOUBLE PRECISION,
      freshness_minutes DOUBLE PRECISION,
      message_title TEXT,
      message_body TEXT,
      evaluated_at TIMESTAMPTZ NOT NULL,
      push_delivery_enabled BOOLEAN NOT NULL,
      push_ticket_id TEXT,
      push_receipt_status TEXT,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_route_alert_evaluations_route_idx
    ON fuel_path_route_alert_evaluations (saved_route_id, evaluated_at DESC)
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_route_alert_evaluations_user_idx
    ON fuel_path_route_alert_evaluations (user_id, evaluated_at DESC)
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS fuel_path_prediction_backtests (
      id TEXT PRIMARY KEY,
      region TEXT NOT NULL,
      market TEXT NOT NULL DEFAULT '',
      fuel TEXT NOT NULL,
      target_date DATE NOT NULL,
      prediction_date DATE NOT NULL,
      model_version TEXT NOT NULL,
      predicted_cpl DOUBLE PRECISION,
      actual_cpl DOUBLE PRECISION,
      absolute_error_cpl DOUBLE PRECISION,
      predicted_direction TEXT NOT NULL DEFAULT 'unknown',
      actual_direction TEXT NOT NULL DEFAULT 'unknown',
      direction_matched BOOLEAN,
      recorded_at TIMESTAMPTZ NOT NULL,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  pgm.sql(`
    ALTER TABLE fuel_path_prediction_backtests
    ADD COLUMN IF NOT EXISTS market TEXT NOT NULL DEFAULT ''
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_prediction_backtests_region_fuel_target_idx
    ON fuel_path_prediction_backtests (region, fuel, target_date DESC)
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_prediction_backtests_market_fuel_target_idx
    ON fuel_path_prediction_backtests (market, fuel, target_date DESC)
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_prediction_backtests_recorded_at_idx
    ON fuel_path_prediction_backtests (recorded_at DESC)
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS fuel_path_market_price_snapshots (
      id TEXT PRIMARY KEY,
      region TEXT NOT NULL,
      market TEXT NOT NULL,
      fuel TEXT NOT NULL,
      observed_date DATE NOT NULL,
      observed_at TIMESTAMPTZ NOT NULL,
      median_cpl DOUBLE PRECISION,
      low_cpl DOUBLE PRECISION,
      high_cpl DOUBLE PRECISION,
      exact_price_count INTEGER NOT NULL DEFAULT 0,
      provider TEXT NOT NULL DEFAULT '',
      capability TEXT NOT NULL DEFAULT '',
      cache_mode TEXT NOT NULL DEFAULT '',
      cache_age_seconds DOUBLE PRECISION,
      warning TEXT NOT NULL DEFAULT '',
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_market_price_snapshots_market_fuel_date_idx
    ON fuel_path_market_price_snapshots (market, fuel, observed_date DESC)
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_market_price_snapshots_observed_at_idx
    ON fuel_path_market_price_snapshots (observed_at DESC)
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS fuel_path_geocode_quotas (
      quota_key TEXT NOT NULL,
      quota_date DATE NOT NULL,
      calls INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (quota_key, quota_date)
    )
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_geocode_quotas_updated_at_idx
    ON fuel_path_geocode_quotas (updated_at DESC)
  `);
};

exports.down = () => {
  throw new Error("The product-state baseline is intentionally forward-only. Restore from backup rather than dropping live tables.");
};
