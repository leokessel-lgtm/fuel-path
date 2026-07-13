async function orphanedInstallationRetentionCounts(sql, cutoff) {
  return sql`
    WITH orphaned AS (
      SELECT installation_id
      FROM fuel_path_alert_installations AS installation
      WHERE (
        installation.revoked_at IS NOT NULL
        AND installation.revoked_at < ${cutoff}
      ) OR (
        installation.revoked_at IS NULL
        AND installation.last_seen_at < ${cutoff}
        AND NOT EXISTS (
          SELECT 1 FROM fuel_path_saved_routes AS route
          WHERE route.user_id = installation.installation_id
            AND route.alert_enabled = true
        )
        AND NOT EXISTS (
          SELECT 1 FROM fuel_path_push_devices AS device
          WHERE device.user_id = installation.installation_id
            AND device.status = 'active'
        )
      )
    )
    SELECT
      (SELECT COUNT(*)::int FROM orphaned) AS installation_count,
      (SELECT COUNT(*)::int FROM fuel_path_push_devices AS device
        WHERE device.user_id IN (SELECT installation_id FROM orphaned)) AS device_count,
      (SELECT COUNT(*)::int FROM fuel_path_saved_routes AS route
        WHERE route.user_id IN (SELECT installation_id FROM orphaned)) AS route_count,
      (SELECT COUNT(*)::int FROM fuel_path_route_alert_evaluations AS evaluation
        WHERE evaluation.user_id IN (SELECT installation_id FROM orphaned)) AS evaluation_count
  `;
}

async function deleteOrphanedInstallationAlertData(sql, cutoff) {
  return sql`
    WITH orphaned AS (
      SELECT installation_id
      FROM fuel_path_alert_installations AS installation
      WHERE (
        installation.revoked_at IS NOT NULL
        AND installation.revoked_at < ${cutoff}
      ) OR (
        installation.revoked_at IS NULL
        AND installation.last_seen_at < ${cutoff}
        AND NOT EXISTS (
          SELECT 1 FROM fuel_path_saved_routes AS route
          WHERE route.user_id = installation.installation_id
            AND route.alert_enabled = true
        )
        AND NOT EXISTS (
          SELECT 1 FROM fuel_path_push_devices AS device
          WHERE device.user_id = installation.installation_id
            AND device.status = 'active'
        )
      )
    ),
    deleted_evaluations AS (
      DELETE FROM fuel_path_route_alert_evaluations AS evaluation
      WHERE evaluation.user_id IN (SELECT installation_id FROM orphaned)
      RETURNING id
    ), deleted_routes AS (
      DELETE FROM fuel_path_saved_routes AS route
      WHERE route.user_id IN (SELECT installation_id FROM orphaned)
      RETURNING id
    ), deleted_devices AS (
      DELETE FROM fuel_path_push_devices AS device
      WHERE device.user_id IN (SELECT installation_id FROM orphaned)
      RETURNING id
    ), deleted_installations AS (
      DELETE FROM fuel_path_alert_installations AS installation
      WHERE installation.installation_id IN (SELECT installation_id FROM orphaned)
      RETURNING installation_id
    )
    SELECT
      (SELECT COUNT(*)::int FROM deleted_installations) AS installation_count,
      (SELECT COUNT(*)::int FROM deleted_devices) AS device_count,
      (SELECT COUNT(*)::int FROM deleted_routes) AS route_count,
      (SELECT COUNT(*)::int FROM deleted_evaluations) AS evaluation_count
  `;
}

module.exports = {
  deleteOrphanedInstallationAlertData,
  orphanedInstallationRetentionCounts,
};
