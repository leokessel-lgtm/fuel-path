const {
  routeAlertWindowDue,
  scheduledRouteAlertIdempotencyKey,
} = require("./_alertEvaluation");
const { nextRouteAlertEvaluationAt } = require("./_alertSchedule");

function createScheduledRouteAlertRunner({
  alertsStatus,
  assertDurableAlertStorage,
  capabilitiesForPoints,
  claimDueSavedRoutes,
  completeSavedRouteAlertLease,
  evaluateSavedRouteAlert,
  listPushDevices,
  retrySavedRouteAlertLease,
  savedRouteAlertLeaseActive,
  scoreSavedRouteForAlert,
}) {
  return async function runScheduledRouteAlertEvaluation({ limit = 50, now, ignoreWindow = false } = {}) {
    assertDurableAlertStorage();
    const evaluatedAt = validIsoDate(now) || new Date().toISOString();
    const leaseSeconds = boundedInteger(process.env.ALERT_WORK_LEASE_SECONDS, 30, 1800, 600);
    const concurrency = boundedInteger(process.env.ALERT_WORKER_CONCURRENCY, 1, 10, 4);
    const routes = await claimDueSavedRoutes({ limit, now: evaluatedAt, leaseSeconds, ignoreWindow });
    const groups = groupRoutesByUser(routes);
    const groupedResults = await mapWithConcurrency(groups, concurrency, async (userRoutes) => {
      const devices = await listPushDevices({ userId: userRoutes[0].userId, status: "active", limit: 20 });
      let userAlertAlreadySent = false;
      const userResults = [];
      for (const route of userRoutes) {
        userResults.push(await evaluateClaimedRoute({ route, devices, evaluatedAt, ignoreWindow, userAlertAlreadySent }));
        if (userResults.at(-1).status === "send_alert") userAlertAlreadySent = true;
      }
      return userResults;
    });
    const results = groupedResults.flat();
    const oldestDueAt = routes.map((route) => route.alertNextEvaluationAt).filter(Boolean).sort()[0] || evaluatedAt;
    return {
      accepted: true,
      mode: "scheduled_saved_route_alert_evaluation",
      evaluatedAt,
      schedulingMode: "oldest_due_leased",
      workerConcurrency: concurrency,
      leaseSeconds,
      oldestClaimedDueAt: oldestDueAt,
      oldestClaimedQueueAgeMs: Math.max(0, new Date(evaluatedAt).getTime() - new Date(oldestDueAt).getTime()),
      routeCount: routes.length,
      claimedCount: routes.length,
      evaluatedCount: results.filter((item) => item.evaluationId).length,
      skippedCount: results.filter((item) => item.status === "skipped").length,
      cancelledCount: results.filter((item) => item.status === "cancelled").length,
      failedCount: results.filter((item) => item.status === "failed").length,
      sentCount: results.filter((item) => item.deliveryStatus === "sent_to_expo").length,
      results,
      alerts: await alertsStatus(),
    };
  };

  async function evaluateClaimedRoute({ route, devices, evaluatedAt, ignoreWindow, userAlertAlreadySent }) {
    try {
      if (!ignoreWindow && !routeAlertWindowDue(route, evaluatedAt)) {
        return completeSkippedRoute(route, evaluatedAt);
      }
      let scoredAlert = {
        status: "skipped_user_alert_cap",
        candidate: {},
        regionCapabilities: capabilitiesForPoints([route.from, route.to]),
      };
      if (!userAlertAlreadySent) scoredAlert = await scoreSavedRouteForAlert(route, evaluatedAt);
      const leaseActive = await savedRouteAlertLeaseActive({
        routeId: route.id,
        userId: route.userId,
        leaseToken: route.alertLeaseToken,
        now: evaluatedAt,
      });
      if (!leaseActive) {
        return { routeId: route.id, status: "cancelled", reason: "route_disabled_deleted_or_lease_lost", leaseStatus: "lost" };
      }
      const result = await evaluateSavedRouteAlert({
        route,
        devices,
        notificationPermission: devices.length ? "granted" : "unknown",
        candidate: scoredAlert.candidate,
        regionCapabilities: scoredAlert.regionCapabilities,
        now: evaluatedAt,
        idempotencyKey: scheduledRouteAlertIdempotencyKey(route, evaluatedAt),
        userAlertAlreadySent,
      });
      const nextEvaluationAt = nextRouteAlertEvaluationAt(route, evaluatedAt);
      const completed = await completeSavedRouteAlertLease({
        routeId: route.id,
        userId: route.userId,
        leaseToken: route.alertLeaseToken,
        evaluatedAt,
        nextEvaluationAt,
      });
      return {
        routeId: route.id,
        evaluationId: result.evaluation.id,
        status: result.evaluation.status,
        reason: result.evaluation.reason,
        deliveryStatus: result.deliveryStatus,
        idempotencyStatus: result.idempotencyStatus,
        scoringStatus: scoredAlert.status,
        nextEvaluationAt,
        leaseStatus: completed ? "completed" : "lost",
      };
    } catch (error) {
      return scheduleRetry(route, evaluatedAt, error);
    }
  }

  async function completeSkippedRoute(route, evaluatedAt) {
    const nextEvaluationAt = nextRouteAlertEvaluationAt(route, evaluatedAt);
    const completed = await completeSavedRouteAlertLease({
      routeId: route.id,
      userId: route.userId,
      leaseToken: route.alertLeaseToken,
      evaluatedAt,
      nextEvaluationAt,
    });
    return {
      routeId: route.id,
      status: "skipped",
      reason: "outside_alert_window",
      nextEvaluationAt,
      leaseStatus: completed ? "completed" : "lost",
    };
  }

  async function scheduleRetry(route, evaluatedAt, error) {
    const retryAt = new Date(new Date(evaluatedAt).getTime() + 5 * 60 * 1000).toISOString();
    const released = await retrySavedRouteAlertLease({
      routeId: route.id,
      userId: route.userId,
      leaseToken: route.alertLeaseToken,
      retryAt,
    }).catch(() => null);
    return {
      routeId: route.id,
      status: "failed",
      reason: "route_alert_evaluation_failed",
      error: error instanceof Error ? error.message : "Route alert evaluation failed",
      retryAt,
      leaseStatus: released ? "retry_scheduled" : "lost",
    };
  }
}

function groupRoutesByUser(routes) {
  const groups = new Map();
  for (const route of routes) {
    if (!groups.has(route.userId)) groups.set(route.userId, []);
    groups.get(route.userId).push(route);
  }
  return [...groups.values()];
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function validIsoDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

function boundedInteger(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

module.exports = { createScheduledRouteAlertRunner };
