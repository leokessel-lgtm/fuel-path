# Backend Push Scheduler Design

## Decision

Smart saved-route alerts should be backend scheduled push notifications.

The mobile app should not poll FuelCheck or run price-decision jobs in the background. The app owns consent, saved-route setup and push-token registration. The backend owns route evaluation, price freshness, alert suppression and push delivery.

## V1 Alert Promise

Only notify when a saved route is likely worth checking before the user's normal travel window.

Good alert:

> Your Sylvania to CBD route has U91 worth checking near Taren Point before your 7:30 commute.

Bad alert:

> Fuel prices changed near you.

National guardrail: only send where the route's region capability, provider terms and freshness support a safe recommendation.

## Inputs

Per user:

- notification permission state
- Expo push token or native push token
- fuel type
- discount wallet
- vehicle profile where needed for range or litres assumptions

Per saved route:

- route id
- from and to points
- route geometry or route cache key
- region and route-crossing capability status
- fuel type
- usual alert time
- alert enabled state
- minimum saving threshold
- maximum detour threshold
- quiet-days or paused state

Per evaluation:

- current FuelCheck station prices
- relevant state or territory provider capability
- station freshness
- route-corridor candidates
- discount-adjusted user price
- detour time estimate
- last alert sent for this route

## Core Jobs

### 1. Token Registration

Mobile app sends push-token updates after notification permission is granted.

Backend stores:

- user id
- device id
- push token
- platform
- app version
- token status
- updated time

If push receipts later report an invalid token, mark it inactive and stop sending to it.

### 2. Saved Route Sync

Mobile app syncs saved routes and alert preferences to the backend.

The current AsyncStorage saved-commute model is good enough for local prototype state, but backend alerts need server copies of alert-enabled routes.

### 3. Route Evaluation Scheduler

Run every 5 to 15 minutes.

The implemented worker does not scan the newest fixed set of routes. It stores
the next due evaluation time on each alert-enabled route and atomically claims
the oldest due rows with `FOR UPDATE SKIP LOCKED`. Each claim receives an
expiring lease. A crashed worker therefore cannot strand the route, and an
overlapping cron invocation cannot process the same live lease.

Work is grouped by anonymous installation. Routes for one installation run in
sequence so the one-alert-per-user cap remains deterministic. Different
installations run with bounded concurrency, controlled by
`ALERT_WORKER_CONCURRENCY` (default 4, maximum 10). Failed route work releases
its lease onto a five-minute retry schedule. Successful and intentionally
skipped work advances to the next selected local alert day and window, including
timezone and daylight-saving conversion.

Each run reports claimed count, failed count, lease duration, worker
concurrency, oldest claimed due time and queue age. These are coarse operational
signals only and must not include route coordinates, labels, tokens or lease
tokens.

For each enabled saved route where the local travel window is approaching:

- refresh or reuse route geometry
- fetch or read cached live station prices
- score route candidates using the same backend scoring logic as Plan
- apply alert eligibility rules
- enqueue a push if the result beats the route threshold

Do not evaluate every route constantly. Evaluate only routes whose alert window is near.

### 4. Push Delivery

Send through Expo Push Service first, because the mobile app already uses Expo Notifications.

Backend should:

- require both the global delivery gate and an explicit internal-beta user allowlist before normal delivery
- chunk notifications
- persist push tickets
- check receipts after the recommended delay
- mark invalid tokens inactive
- retry only transient failures

The validation-only delivery path must not inherit or update a saved route's normal alert cooldown.
On Vercel Hobby, cron jobs are limited to daily cadence. A 5 to 15 minute commuter-alert schedule therefore requires an approved Vercel Pro upgrade or an approved external scheduler before normal delivery can be considered operationally ready.

### 5. Suppression

Suppress alerts when:

- the same route already alerted recently
- saving is below threshold
- detour is above threshold
- best price is stale beyond the trust cutoff
- station appears closed
- route region is unsupported, pending access or not permitted for alerts
- notification permission or token is missing
- user has paused the route

## Alert Decision Contract

Backend response for an evaluated route should stay flat:

```json
{
  "routeId": "commute-123",
  "status": "send_alert",
  "reason": "saving_above_threshold",
  "outcome": "send_alert",
  "outcomeLabel": "Send alert",
  "outcomeSummary": "U-Go Taren Point is worth checking: about $7.40 after 3.2 min detour.",
  "stationCode": "12345",
  "stationName": "U-Go Taren Point",
  "adjustedCpl": 155.9,
  "estimatedSavingDollars": 7.4,
  "detourMinutes": 3.2,
  "freshnessMinutes": 42,
  "messageTitle": "Fuel worth checking before your commute",
  "messageBody": "U91 is worth checking near Taren Point before your 7:30 drive."
}
```

Non-send statuses:

- `quiet_today`
- `saving_below_threshold`
- `detour_above_threshold`
- `stale_price`
- `station_closed`
- `region_unsupported`
- `provider_access_pending`
- `provider_terms_blocked`
- `range_first`
- `missing_push_token`
- `permission_missing`
- `failed`

Outcome buckets stay user-facing and flat:

- `send_alert`
- `watch_only`
- `skip_alert`
- `quiet_today`
- `range_first`

## Data Model Sketch

### `users`

- `id`
- `created_at`
- `updated_at`

### `push_devices`

- `id`
- `user_id`
- `platform`
- `expo_push_token`
- `app_version`
- `status`
- `last_seen_at`
- `invalidated_at`

### `saved_routes`

- `id`
- `user_id`
- `name`
- `from_lat`
- `from_lon`
- `from_label`
- `to_lat`
- `to_lon`
- `to_label`
- `fuel`
- `route_geometry`
- `alert_enabled`
- `alert_time_local`
- `timezone`
- `min_saving_dollars`
- `max_detour_minutes`
- `last_alert_sent_at`
- `created_at`
- `updated_at`

### `route_alert_evaluations`

- `id`
- `saved_route_id`
- `status`
- `reason`
- `station_code`
- `estimated_saving_dollars`
- `detour_minutes`
- `freshness_minutes`
- `evaluated_at`
- `push_ticket_id`
- `push_receipt_status`

## API Surface

Mobile to backend:

- `POST /api/push/register`
- `POST /api/saved-routes`
- `PATCH /api/saved-routes/:id/alerts`
- `DELETE /api/push/devices/:id`

Backend internal:

- `POST /internal/jobs/evaluate-route-alerts`
- `POST /internal/jobs/check-push-receipts`

## Privacy And Governance Boundaries

- Do not infer routine routes from passive location tracking in V1.
- Do not collect continuous location.
- Only evaluate routes the user explicitly saved.
- Keep alert copy explainable and non-promissory.
- Treat FuelCheck price freshness and permitted caching/storage rules as launch blockers until confirmed.
- Do not imply Service NSW, NSW Government or API.NSW approval from use of live data.

## Implementation Order

1. Add push-token registration in the mobile app after native notification validation passes.
2. Add backend storage for saved routes and push devices.
3. Move saved-route alert preferences from local-only state to backend sync.
4. Reuse existing route scoring to produce `route_alert_evaluations`.
5. Send Expo push notifications for `send_alert` outcomes.
6. Add receipt checking and invalid-token cleanup.
7. Add suppression and audit logs before any public beta.

## Open Decisions

- Confirm FuelCheck commercial use, caching and historical snapshot permissions.
- Decide auth identity before storing user/device records.
- Decide whether Expo Push Service is enough for V1 or whether direct APNs/FCM is needed later.
- Validate notification copy with real commuters before enabling broad alerts.
