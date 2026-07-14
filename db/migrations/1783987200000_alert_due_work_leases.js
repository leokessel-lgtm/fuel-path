/*
 * Starvation-safe scheduling for saved-route alerts. Workers atomically claim
 * oldest-due rows, while expiring leases make abandoned work recoverable.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE fuel_path_saved_routes
      ADD COLUMN IF NOT EXISTS alert_next_evaluation_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS alert_last_evaluated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS alert_lease_token TEXT,
      ADD COLUMN IF NOT EXISTS alert_lease_expires_at TIMESTAMPTZ
  `);
  pgm.sql(`
    UPDATE fuel_path_saved_routes
    SET alert_next_evaluation_at = NOW()
    WHERE alert_enabled = true AND alert_next_evaluation_at IS NULL
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_saved_routes_due_alert_idx
    ON fuel_path_saved_routes (alert_next_evaluation_at ASC NULLS FIRST, updated_at, user_id, id)
    WHERE alert_enabled = true
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS fuel_path_saved_routes_alert_lease_idx
    ON fuel_path_saved_routes (alert_lease_expires_at)
    WHERE alert_lease_token IS NOT NULL
  `);
};

exports.down = () => {
  throw new Error("Alert due-work leases are forward-only. Apply a corrective migration instead of removing live scheduling state.");
};
