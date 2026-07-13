# Account-Free Native Data Architecture

Last updated: 13 July 2026, Australia/Sydney

## Purpose And Decision

This is the implementation plan for a durable, local-first iOS and Android
data model. It is deliberately separate from PR #29's local Postgres,
migrations and runtime-schema-check foundation. It does not authorise a hosted
database migration, change route scoring, or change user-facing savings logic.

**Decision:** no mandatory account. On first native launch, create a random
anonymous installation owner. Local routine state is not mirrored to the
backend. A server record is created only after explicit smart-alert opt-in.

## Current Evidence And Gap Assessment

| Area | Evidence held | Gap to close before public alert use |
| --- | --- | --- |
| Product DB | `db/migrations/1762948800000_product_state_baseline.js` creates product-state tables and `api/_productDatabase.js` checks them at runtime. | Never run the plan against the shared Preview/Production Neon target. Provision a distinct preview target first. |
| Local app state | Preferences, recents and saved commutes currently use `AsyncStorage`; saved commutes are capped at 20. | Keep routine data local but give the user an explicit local-data clear path and loss wording. |
| Alert identity | `backendAlerts.native.ts` now creates an `installationId` plus secret and keeps it and the capability in SecureStore on native builds. | Physical iOS/Android lifecycle validation remains required. |
| Alert API | Native alert writes derive the owner from a short-lived, server-revocable capability; shared client tokens cannot perform owner-bound mutations or internal evaluation jobs. | Add a general mutation-idempotency table before expanding beyond the current naturally idempotent upserts/deletes. |
| Push storage | Active push tokens are unique, saved-route keys are owner-scoped, token rotation is reconciled and delete-my-alert-data removes the installation's alert rows atomically. | Collect physical-device lifecycle evidence and extend scheduled retention to revoked installation tombstones and stale rate-limit counters before public alert use. |

## Data Classification

| Class | Examples | Storage and rule |
| --- | --- | --- |
| Local routine state | Vehicle/fuel preferences, discounts, saved places, saved routes, recent locations, local alert UI settings | Device storage. Cap and compact it. Never sync by default. |
| Secure local secrets | `installation_id`, opaque installation secret, current scoped capability | Secure device storage only. Keep small values only. Never log. |
| Anonymous backend alert state | Alert-enabled route snapshot, thresholds, time zone, active push token, delivery state | Product database only after explicit opt-in. Owned by `installation_id`; delete or disable on opt-out. |
| Backend operational data | Price/provider caches, route computation intermediates, evaluation/audit outcomes, quotas | Server-side with bounded retention and no personal route history. |
| Never collect | Email/name/password, contacts, advertising ID, payment data, continuous background location, raw route history, backup copy of all local settings | Do not introduce a field, SDK event or log for these. |

`user_id` in the existing alert tables means anonymous installation owner. Do
not add `fuel_path_users`. In the first ownership-hardening migration, rename
the database columns to `installation_id` or, if a low-risk compatibility
window is required, add and backfill `installation_id`, use it everywhere,
then remove `user_id` in a later forward-only migration. The plan recommends
the add/backfill path because PR #29 establishes a forward-only baseline.

## Ownership And Capability Contract

1. On first native launch, generate an opaque UUID `installation_id` and a
   high-entropy installation secret. Store both in `expo-secure-store`, not
   AsyncStorage. Do not derive either from hardware identifiers.
2. The app calls `POST /api/alerts?action=client-capability` only when it needs an
   opted-in alert operation. The request proves possession of the secret; the
   server returns a short-lived, audience-scoped capability with the
   installation as subject.
3. Every mobile alert endpoint derives `installation_id` solely from that
   capability. Route IDs are owner-scoped by the composite database key and
   queried with both route and installation predicates. Operator endpoints
   remain separately authorised.
4. Capabilities are never database credentials. The device cannot query Neon
   or Postgres directly. API service credentials remain server-only.
5. Secret loss or SecureStore invalidation creates a new anonymous
   installation. If native SecureStore survives a reinstall while its
   non-secret AsyncStorage marker does not, treat it as the same opaque alert
   installation so route-watch history is not silently deleted. Recreate only
   the marker. Do not restore routine local state or saved routes, and make
   the explicit Privacy action the only way to delete the surviving alert
   installation's backend data.

Use server-side hashed secret verifiers, key identifiers and rotation metadata,
not plaintext installation secrets. Rate-limit capability issuance and alert
writes by installation, IP and endpoint with conservative burst limits that
are measured and tuned after controlled traffic.

## Native Storage And Lifecycle

| Event | Required behaviour |
| --- | --- |
| First launch | Create the anonymous installation owner before alert opt-in; no backend registration is necessary yet. |
| Normal update | Retain local routine state and secure identity where the platform does. Refresh capability only when needed. |
| iOS uninstall/reinstall | Expo SecureStore uses Keychain and may persist for the same bundle ID, but Expo says not to rely on this. If its opaque alert identity survives while the non-secret marker does not, recreate the marker and continue that alert installation only. Do not restore routine local state or saved routes. The explicit Privacy action deletes its backend alert records. |
| Android uninstall/restore | SecureStore data is not preserved on uninstall. Its Android backup entries need exclusion because restored encrypted entries cannot be decrypted. Treat restore/reinstall as new installation. |
| Device replacement | New installation, new local setup. No automatic transfer. Accounts are a later explicit feature for backup/transfer/sync only. |
| Notification denied/revoked | Do not register/retain a newly acquired token. Mark existing push device inactive at the next authenticated app contact and stop evaluation/delivery for it. Local saved route remains local. |
| Token rotation | Register at app foreground and through Expo's push-token listener. Upsert atomically, retire superseded token, and retry registration with backoff when offline. |
| Push `DeviceNotRegistered` receipt | Invalidate the token immediately, halt sends and retain only minimal invalidation metadata until cleanup. |
| Turn off route watch | Save that owned backend route with `alertEnabled=false`. Preserve the anonymous installation, device and evaluation history. |
| Delete alert data | Revoke server capability, immediately delete opted-in backend routes/devices/evaluations, clear local alert identity/capability and local alert schedules, then display completion/failure truthfully. The retention job physically removes the revoked anonymous installation after 90 days. |

Expo SDK 56 guidance supports this plan: SecureStore is encrypted key-value
storage, iOS Keychain persistence across uninstall is possible but not
guaranteed, and Android secure entries do not survive uninstall. Its config
plugin handles the required Android backup exclusion when no custom backup
configuration exists. See [SecureStore v56](https://docs.expo.dev/versions/v56.0.0/sdk/securestore/).

For notifications, SDK 56 requires a development build for Android remote
push, requires an Android channel before token acquisition on Android 13, and
exposes `addPushTokenListener` for token changes. See
[Expo Notifications v56](https://docs.expo.dev/versions/v56.0.0/sdk/notifications/).

## API Boundary

| Endpoint family | Mobile request | Server rule |
| --- | --- | --- |
| Capability | Installation proof only | Issue a 15-minute scoped token after durable network and installation rate checks; reject revoked or version-mismatched installations. |
| Push registration | Token, platform, app version, idempotency key | Capability subject supplies owner. Upsert by installation and token; never accept owner from JSON. |
| Alert route create/update | Minimal alert route snapshot, threshold, local time zone, idempotency key | Validate bounds, enforce owner predicate and store only alert-needed fields. |
| Alert route delete / delete-my-alert-data | Route ID or deletion request, capability | Delete only subject-owned records; make deletion idempotent and return a deletion receipt. |
| Alert status | Capability | Return only the subject's state, never arbitrary owner records. |
| Operator/cron | Separate service/cron authorisation | No mobile capability can invoke operator reads, evaluation or receipts. |

Use a request ID and an idempotency key for every mutation. Store the key,
installation, endpoint/action, request digest, outcome and expiry. Same key
with the same payload returns the prior outcome; same key with different
payload returns conflict. For evaluation and delivery, use deterministic work
keys and database uniqueness so cron overlap, retries and concurrent workers
cannot create duplicate alerts.

## Backend Model, Indexes And Retention

Keep product-state tables separate from G-NAF. The former contains only alert
and operational records; the latter remains mapping infrastructure with its
own deployment, access and operational plan.

The first ownership-hardening migration now adds:

- `fuel_path_alert_installations`: opaque `installation_id`, secret verifier/key
  version, created/last-seen/revoked timestamps. No name, email or device
  fingerprint.
- `fuel_path_alert_rate_limits`: bounded capability-issuance counters keyed by
  HMAC-derived network and installation keys, without retaining raw IP values.
- A composite `(user_id, id)` saved-route primary key so deterministic local
  route IDs cannot collide across anonymous installations.

Follow-up migrations should add:
- `installation_id` to the existing alert tables, initially backfilled from
  `user_id`; follow with `NOT NULL`, owner-based foreign keys where suitable,
  and later removal of obsolete aliases.
- A unique active-token guard. Prefer a normalised token hash unique index,
  retaining the delivery token only where the sender needs it. A registration
  transaction must retire an old row before accepting a token claimed by
  another installation.
- Unique evaluation/work indexes such as `(saved_route_id, evaluation_window,
  rule_version)` and ticket/receipt lookup indexes. Keep the existing owner
  and descending-time indexes, renamed as ownership changes.
- An `idempotency_requests` table with a unique `(installation_id, action,
  idempotency_key)` key and a short, documented retention period.

## Implemented Foundation Slice

The current uncommitted slice implements SecureStore identity and capability
storage, cryptographic Expo UUID/secret generation, a non-secret reinstall
marker, single-flight identity initialisation, capability version revocation,
durable capability rate limits, owner-scoped route keys, internal-only
evaluation jobs, atomic delete-my-alert-data, notification-permission
reconciliation and push-token rotation refresh. Physical-device lifecycle
evidence and hosted environment isolation remain release blockers.

Suggested initial retention is deliberately conservative and must align with
the published policy before public use:

| Record | Rule |
| --- | --- |
| Active opted-in route and token | Keep only while alert subscription is enabled and token is active. |
| Inactive token | Exclude immediately; purge after 90 days. |
| Disabled route | Stop evaluation immediately; purge after 90 days unless deleted sooner. |
| Evaluation/delivery audit | Keep 180 days for duplicate/delivery troubleshooting, then purge or aggregate. |
| Idempotency records | Keep 7 days, then purge. |
| Revoked installation tombstone and stale rate-limit counter | Keep only for a documented abuse/retry window, then purge the secret verifier and counter. The first foundation slice does not yet schedule this purge. |
| Aggregated operational metrics | Keep only non-identifying aggregates for capacity and cost decisions. |

The cleanup job must be scheduled, authenticated, observable and covered by a
dry-run mode. Deletion is not complete until its local and server outcomes are
recorded. Do not retain raw saved-route coordinates in logs; redact route
labels, tokens, capabilities and secrets.

## Alert Execution, Scale And Cost Controls

The scheduler evaluates only alert-enabled routes near their selected travel
window. It must not poll every route continuously or move price work to the
phone. Price/provider fetches, route calculations and scoring remain
backend-owned and use existing freshness/eligibility safeguards unchanged.

1. Select due routes with a time-window index and claim rows using
   `FOR UPDATE SKIP LOCKED` or an equivalent lease. A worker has a bounded
   batch size and lease expiry.
2. Group due work by region/fuel/route-cache key where this does not alter
   recommendation semantics. Reuse provider/cache results within their
   existing freshness policy.
3. Create evaluation/audit records idempotently before queueing delivery.
   Update route cooldown only after a durable send decision.
4. Queue delivery separately from evaluation. Expo Push Service delivery is
   at-least-once to downstream providers, so client-visible duplicate
   suppression must remain server-owned.
5. Send in batches with concurrency limits, exponential backoff on transient
   failure and no retry for malformed payloads or invalid tokens. Fetch and
   process receipts after the documented delay; invalidate on
   `DeviceNotRegistered`.

Expo documents a 600 notifications/second per-project limit, recommends
throttling/retries, and recommends receipt checks after about 15 minutes. The
initial worker should operate far below that ceiling and measure queue age,
send rate and error rate before any increase. See
[Expo push FAQ](https://docs.expo.dev/push-notifications/faq/) and
[reliable delivery guidance](https://docs.expo.dev/push-notifications/sending-notifications/).

### Capacity Triggers

| Signal | Response |
| --- | --- |
| DB connection waiting, connection errors or serverless connection churn | Put a pooler/proxy in front of Postgres, cap application pool size, reuse clients and measure checkout wait. Do not create a per-request pool. |
| Due-alert batch exceeds one worker's safe window or queue age threatens travel time | Add bounded workers and leases, then inspect duplicate and cost metrics before increasing concurrency. |
| Tables exceed operational vacuum/index budget or retention deletes affect latency | Partition evaluation/audit data monthly first; archive/aggregate expired partitions. Do not partition small transactional tables prematurely. |
| Alert delivery reaches a sustained material fraction of Expo limits, or receipt failures rise | Add queue rate controls, per-installation daily cap and circuit breaker; assess direct APNs/FCM only with a separate design decision. |
| Provider/routing cost grows faster than opt-in route volume | Tighten due windows, cache/group work, cap active alert routes per installation and publish a cost dashboard. |

Run a daily/weekly capacity review from coarse metrics: active installations
with alerts, active routes, due/evaluated/sent counts, queue age, provider
calls/cache hit rate, DB latency/connection wait, token invalidations, retry
rate, deletion latency and storage growth. Metrics must not include raw token,
address or route values.

## Migration, Deployment And Rollback

1. Keep PR #29 unchanged and merge/review it independently.
2. Create a new database target for Preview before any migration. Preview and
   Production must never share the effective product database target during
   this rollout. Preview uses the Preview-only
   `FUEL_PATH_PRODUCT_DATABASE_URL` override; Production continues to use its
   managed `DATABASE_URL`.
3. Treat the owner-scoped saved-route primary-key change as a forward-only
   constraint migration, not a purely additive change. Rehearse its lock time,
   existing-row reconciliation and corrective forward migration on the isolated
   Preview database before Production. The migration purges legacy `local_*`
   alert owners before duplicate route IDs become valid, and the native upgrade
   removes the matching v1 local identity/capability keys before minting v2.
4. Run migrations once in controlled CI/deploy step, not from every mobile
   request. Retain the runtime schema check as a fail-closed diagnostic.
5. Deploy with client alert capability issuing and delivery disabled. The
   shared product-schema check must not require alert-only tables, so dormant
   code cannot break unrelated database paths before the migration. Migrate the
   isolated target, verify it, then enable a small internal installation
   allowlist for preview-only tests.
6. Roll back behaviour with flags and disable scheduler/delivery first. Do
   not run destructive down migrations on production; restore from backup or
   issue a corrective forward migration.

Before any hosted migration, verify the Vercel Preview and Production effective
product database targets, database roles, connection-pooling posture,
backup/restore evidence and who is permitted to run migrations. A schema-only
Neon `preview` branch and Preview-only product database override now exist, but
their isolation, least-privilege role, backup/restore path and migration
rehearsal still require verification before any hosted migration.

## QA And Regression Gates

| Gate | Required proof |
| --- | --- |
| Migration | Empty DB, PR #29 baseline adoption, composite-key constraint rehearsal, bounded reconciliation, rerun/idempotency and corrective-forward rollback path. |
| API ownership | Cross-installation read/update/delete attempts fail; caller-supplied owner fields are ignored/rejected; capability expiry, replay and rate limits are covered. |
| Deletion | Route delete, whole alert-data delete, retry after timeout, local clear and backend purge all pass without re-creating the subscription. |
| iOS device | First install, upgrade, uninstall/reinstall with persisted-keychain edge case, permission denial/revoke, token rotation and notification tap on physical build. |
| Android device | First install, uninstall/reinstall, backup/restore behaviour, Android 13 permission/channel flow, token rotation, device receipt invalidation and notification tap on physical build. |
| Load/concurrency | Concurrent route mutations, duplicate scheduler leases, evaluation retry, delivery retry, receipt processing and connection-pool limits pass at expected beta volume plus headroom. |
| Privacy/logging | Automated log/redaction fixtures show no token, capability, secret, precise coordinates or route label leak. Store disclosures are reviewed against the exact build. |
| Regression | Existing recommendation, provider, alert duplicate-suppression, retention, migration and native-source guards remain green. |

No device simulator, local Postgres pass or web preview is evidence of public
push readiness by itself.

## Incremental Reviewable PR Sequence

| Timing | Small safe PR | Exit criteria |
| --- | --- | --- |
| Days 0-30 | Documentation and threat-model acceptance | This plan and canonical vision approved. |
| Days 0-30 | Local identity boundary | Implemented in the first account-free foundation slice: SecureStore installation secret/ID, local marker, deletion UX/copy and unit tests. No hosted alert enablement. |
| Days 0-30 | API ownership hardening | Implemented in the first account-free foundation slice: capability-derived ownership, protected list/delete tests and durable rate limits. |
| Days 31-60 | Preview-isolated schema | Additive migration, migration CI, preview-only database, backfill/reconciliation tests. |
| Days 31-60 | Push lifecycle | Token listener, registration idempotency, receipt handling, invalidation and controlled internal allowlist. |
| Days 31-60 | Retention/deletion job | Dry run, schedule, metrics, deletion receipt and regression suite. |
| Days 61-90 | Controlled native alert test | Physical iOS/Android evidence, load/concurrency run and review of opt-out/deletion support outcomes. |
| Days 61-90 | Narrow alert beta decision | Enable only if separate provider, privacy, support, native and architecture gates are green. Otherwise keep backend delivery off. |

## Brutal Self-Review And Repairs

**Risk found:** treating a generated `userId` as a person or silently
recovering it after reinstall would contradict the no-account promise.
**Repair:** this plan defines it as an anonymous installation owner, calls for
`installation_id` migration and requires conservative invalidation on
ambiguous install state.

**Risk found:** a signed client capability is insufficient if endpoints still
trust `userId` supplied in query/body fields. **Repair:** all mobile ownership
must be capability-derived; cross-owner tests are a blocking gate.

**Risk found:** durable alert tables alone do not protect scale, duplicate
delivery or cost. **Repair:** work leases, idempotency keys, queue separation,
receipt processing, explicit capacity triggers and connection pooling are now
required before expansion.

**Risk found:** describing local-first without device-loss wording can mislead
drivers. **Repair:** canonical copy now says saved routes do not move to a new
phone or return after deletion.

**Risk found:** sharing a Neon target between Preview and Production makes a
preview-first rollout unsafe. **Repair:** preview database isolation is an
explicit precondition and this task made no hosted mutation.

## Assumptions, Unknowns And Non-Claims

- **Evidence held:** PR #29 baseline migration, local product-database checks,
  local persistence, alert storage and scheduler code exist in the repository.
- **Assumption:** Expo Push Service is suitable for the first controlled alert
  delivery path. It is not an availability guarantee or a scale commitment.
- **Unknown / needs verification:** exact production/Postgres connection
  topology, Vercel environment separation, backup recovery, actual alert
  demand, provider terms, native credentials and store data declarations.
- This plan does not claim user adoption, provider approval, prediction
  readiness, store readiness or deployed migration status.
