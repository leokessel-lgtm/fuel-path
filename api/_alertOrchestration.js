const {
  alertStorageStatus,
  appendRouteAlertEvaluation,
  counts: alertStorageCounts,
  deleteSavedRoute,
  listPendingPushTicketEvaluations,
  listPushDevices,
  listRouteAlertEvaluations,
  listSavedRoutes,
  updatePushDeviceStatus,
  updateRouteAlertDelivery,
  updateSavedRouteLastAlert,
  upsertPushDevice,
  upsertSavedRoute,
} = require("./_alertStorage");
const { fetchExpoPushReceipts, sendExpoPushMessages } = require("./_expoPush");
const {
  buildSavedRouteAlertEvaluation,
  isExpoPushToken,
  receiptStatus,
  routeAlertWindowDue,
  scheduledRouteAlertIdempotencyKey,
} = require("./_alertEvaluation");
const {
  normaliseBackendSavedRoute,
  normalisePushDevice,
} = require("./_alertRecords");
const { providerHealth } = require("./_providerRuntime");
const { createHmac, timingSafeEqual } = require("node:crypto");

const ALERT_MAX_RECORDS = 500;
const ALERT_CAPABILITY_SCOPE = "alerts-client-write-v1";
const ALERT_CAPABILITY_TTL_SECONDS = 60 * 60 * 24 * 30;

function createAlertOrchestration({ buildRoute, capabilitiesForPoints, loadStationData, scoreRoute }) {
  let alertRouteScorerForTests;

  async function alertsStatus() {
    const storage = alertStorageStatus({ maxRecords: ALERT_MAX_RECORDS });
    const cronConfigured = Boolean(process.env.CRON_SECRET);
    const pushDeliveryEnabled = alertPushDeliveryEnabled();
    let storageCounts = {};
    let storageError = "";
    try {
      storageCounts = await alertStorageCounts();
    } catch (error) {
      storageError = error instanceof Error ? error.message : "Alert storage is unavailable";
    }
    const degraded = Boolean(storageError);
    return {
      mode: "backend_foundation",
      degraded,
      schedulerEnabled: cronConfigured,
      evaluatorEnabled: true,
      pushDeliveryEnabled,
      deliveryMode: pushDeliveryEnabled ? "expo_push_service" : "disabled_env_gate",
      receiptCheckingEnabled: pushDeliveryEnabled,
      storageConfigured: Boolean(storage.configured),
      storage: {
        ...storage,
        ...storageCounts,
        health: storageError ? "error" : "ok",
        lastError: storageError,
      },
      providerHealth: providerHealth("alerts", {
        status: storageError ? "unavailable" : "ok",
        cacheMode: "none",
        cacheAgeSeconds: null,
        error: storageError,
        warning: pushDeliveryEnabled ? "" : "Expo push delivery is disabled by environment gate.",
      }),
      writeSecurity: alertsWriteSecurity(),
      pushProviderConfigured: pushDeliveryEnabled,
      cronConfigured,
      supportedDecisionStatuses: [
        "send_alert",
        "range_first",
        "alert_disabled",
        "quiet_today",
        "saving_below_threshold",
        "detour_above_threshold",
        "stale_price",
        "station_closed",
        "region_unsupported",
        "provider_access_pending",
        "missing_push_token",
        "permission_missing",
        "not_evaluated",
        "failed",
      ],
      supportedAlertOutcomes: [
        "send_alert",
        "watch_only",
        "skip_alert",
        "quiet_today",
        "range_first",
      ],
      nextBuildStep: pushDeliveryEnabled
        ? "Connect scheduled evaluation to live route scoring and monitor Expo push receipts."
        : "Enable EXPO_PUSH_DELIVERY_ENABLED only after native device-token validation passes.",
    };
  }

  function alertPushDeliveryEnabled() {
    return process.env.EXPO_PUSH_DELIVERY_ENABLED === "1";
  }

  function alertsWriteSecurity() {
    const adminTokenConfigured = Boolean(process.env.ALERTS_WRITE_TOKEN);
    const clientTokenEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED === "1";
    const clientTokenConfigured = clientTokenEnabled && Boolean(process.env.ALERTS_CLIENT_WRITE_TOKEN);
    const clientCapabilityConfigured = clientTokenEnabled && Boolean(alertClientCapabilitySecret());
    const tokenConfigured = adminTokenConfigured || clientTokenConfigured;
    const storage = alertStorageStatus({ maxRecords: ALERT_MAX_RECORDS });
    const tokenRequired = tokenConfigured || Boolean(storage.durable);
    return {
      tokenConfigured,
      adminTokenConfigured,
      clientTokenEnabled,
      clientTokenConfigured,
      clientCapabilityConfigured,
      tokenRequired,
      writeEnabled: !tokenRequired || tokenConfigured || clientCapabilityConfigured,
      acceptedHeaders: ["Authorization: Bearer <token>", "X-Fuel-Path-Alerts-Token"],
    };
  }

  function alertsWriteAuthorised(req = {}) {
    const security = alertsWriteSecurity();
    if (!security.tokenRequired) return true;
    if (!security.writeEnabled) return false;
    const headers = req.headers || {};
    const auth = headers.authorization || headers.Authorization || "";
    const direct = headers["x-fuel-path-alerts-token"] || headers["X-Fuel-Path-Alerts-Token"] || "";
    const bearer = String(auth).replace(/^Bearer\s+/i, "").trim();
    const supplied = bearer || String(direct).trim();
    if (process.env.ALERTS_WRITE_TOKEN && supplied === process.env.ALERTS_WRITE_TOKEN) return true;
    if (verifyAlertClientCapability(supplied)) return true;
    return (
      security.clientTokenConfigured &&
      Boolean(process.env.ALERTS_CLIENT_WRITE_TOKEN) &&
      supplied === process.env.ALERTS_CLIENT_WRITE_TOKEN
    );
  }

  function issueAlertClientCapability({ userId = "", deviceId = "" } = {}) {
    const security = alertsWriteSecurity();
    if (!security.clientTokenEnabled || !security.clientCapabilityConfigured) {
      return {
        accepted: false,
        error: "Alert client capability issuing is disabled.",
        alerts: security,
      };
    }
    const safeUserId = cleanCapabilityText(userId);
    const safeDeviceId = cleanCapabilityText(deviceId);
    if (!safeUserId || !safeDeviceId) {
      return {
        accepted: false,
        error: "Alert client capability requires userId and deviceId.",
        alerts: security,
      };
    }
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      scope: ALERT_CAPABILITY_SCOPE,
      userId: safeUserId,
      deviceId: safeDeviceId,
      iat: now,
      exp: now + ALERT_CAPABILITY_TTL_SECONDS,
    };
    return {
      accepted: true,
      token: signAlertClientCapability(payload),
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      scope: ALERT_CAPABILITY_SCOPE,
      alerts: security,
    };
  }

  function verifyAlertClientCapability(token = "") {
    if (!token || !alertClientCapabilitySecret()) return false;
    const [encodedPayload, suppliedSignature] = String(token).split(".");
    if (!encodedPayload || !suppliedSignature) return false;
    const expectedSignature = signCapabilityPart(encodedPayload);
    if (!timingSafeEqualText(suppliedSignature, expectedSignature)) return false;
    let payload;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    } catch {
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return (
      payload?.scope === ALERT_CAPABILITY_SCOPE &&
      typeof payload.userId === "string" &&
      typeof payload.deviceId === "string" &&
      Number.isFinite(payload.exp) &&
      payload.exp > now
    );
  }

  function assertDurableAlertStorage() {
    const storage = alertStorageStatus({ maxRecords: ALERT_MAX_RECORDS });
    if (storage.durable) return;
    throw new Error("Backend alert sync requires durable alert storage. Set DATABASE_URL or NEON_DATABASE_URL before syncing saved routes, devices or scheduled evaluations.");
  }

  function cronAuthorised(req = {}) {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false;
    const headers = req.headers || {};
    const auth = headers.authorization || headers.Authorization || "";
    const bearer = String(auth).replace(/^Bearer\s+/i, "").trim();
    return bearer === expected;
  }

  async function registerPushDevice(input = {}) {
    assertDurableAlertStorage();
    const record = normalisePushDevice(input);
    await upsertPushDevice(record);
    return {
      accepted: true,
      device: record,
      alerts: await alertsStatus(),
    };
  }

  async function saveBackendSavedRoute(input = {}) {
    assertDurableAlertStorage();
    const route = normaliseBackendSavedRoute(input);
    await upsertSavedRoute(route);
    return {
      accepted: true,
      route,
      alerts: await alertsStatus(),
    };
  }

  async function deleteBackendSavedRoute({ routeId = "", userId = "" } = {}) {
    assertDurableAlertStorage();
    const deleted = await deleteSavedRoute({ routeId, userId });
    return {
      accepted: true,
      deleted: Boolean(deleted),
      route: deleted,
      routeId,
      alerts: await alertsStatus(),
    };
  }

  async function listBackendSavedRoutes({ userId = "", enabledOnly = false, limit = 50 } = {}) {
    assertDurableAlertStorage();
    const routes = await listSavedRoutes({ userId, enabledOnly, limit });
    return {
      routes,
      alerts: await alertsStatus(),
    };
  }

  async function listBackendPushDevices({ userId = "", status = "active", limit = 50 } = {}) {
    assertDurableAlertStorage();
    const devices = await listPushDevices({ userId, status, limit });
    return {
      devices,
      alerts: await alertsStatus(),
    };
  }

  async function listBackendAlertEvaluations({ routeId = "", userId = "", limit = 50 } = {}) {
    assertDurableAlertStorage();
    const evaluations = await listRouteAlertEvaluations({ routeId, userId, limit });
    return {
      evaluations,
      alerts: await alertsStatus(),
    };
  }

  async function evaluateSavedRouteAlert(input = {}) {
    assertDurableAlertStorage();
    const route = normaliseBackendSavedRoute(input.route || input);
    const devices = input.devices || (await listPushDevices({ userId: route.userId, status: "active", limit: 20 }));
    const pushDeliveryEnabled = alertPushDeliveryEnabled();
    const evaluation = buildSavedRouteAlertEvaluation({
      route,
      devices,
      candidate: input.candidate || input.recommendation || {},
      notificationPermission: input.notificationPermission,
      regionCapabilities: input.regionCapabilities,
      now: input.now,
      pushDeliveryEnabled,
      idempotencyKey: input.idempotencyKey,
      userAlertAlreadySent: input.userAlertAlreadySent,
    });
    const recordedEvaluation = await appendRouteAlertEvaluation(evaluation);
    if (recordedEvaluation?._alreadyRecorded) {
      return {
        evaluation: recordedEvaluation,
        pushDeliveryEnabled,
        idempotencyStatus: "already_recorded",
        deliveryStatus: "skipped_duplicate_evaluation",
        alerts: await alertsStatus(),
      };
    }
    const delivery = await deliverSavedRouteAlert({ route, devices, evaluation, pushDeliveryEnabled });
    return {
      evaluation,
      pushDeliveryEnabled,
      idempotencyStatus: "recorded",
      ...delivery,
      alerts: await alertsStatus(),
    };
  }

  async function deliverSavedRouteAlert({ route, devices = [], evaluation, pushDeliveryEnabled } = {}) {
    if (evaluation.status !== "send_alert") return { deliveryStatus: "not_applicable" };
    if (!pushDeliveryEnabled) return { deliveryStatus: "not_sent_push_provider_disabled" };

    const activeDevices = devices.filter((device) => device.status !== "inactive" && isExpoPushToken(device.expoPushToken));
    if (!activeDevices.length) return { deliveryStatus: "not_sent_no_valid_expo_token" };

    try {
      const messages = activeDevices.map((device) => ({
        to: device.expoPushToken,
        title: evaluation.messageTitle,
        body: evaluation.messageBody,
        sound: "default",
        data: {
          type: "saved-route-alert",
          routeId: route.id,
          evaluationId: evaluation.id,
          stationCode: evaluation.stationCode,
          fuel: route.fuel,
        },
      }));
      const tickets = await sendExpoPushMessages(messages);
      const okTickets = tickets.filter((ticket) => ticket.status === "ok" && ticket.id);
      for (const ticket of tickets) {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          await updatePushDeviceStatus({
            deviceId: ticket.to,
            status: "inactive",
            invalidatedAt: evaluation.evaluatedAt,
          });
        }
      }
      if (!okTickets.length) {
        await updateRouteAlertDelivery({
          evaluationId: evaluation.id,
          pushReceiptStatus: "ticket_error",
        });
        return { deliveryStatus: "expo_ticket_error", pushTickets: tickets };
      }

      const pushTicketId = okTickets.map((ticket) => ticket.id).join(",");
      evaluation.pushTicketId = pushTicketId;
      await updateRouteAlertDelivery({ evaluationId: evaluation.id, pushTicketId });
      await updateSavedRouteLastAlert(route.id, evaluation.evaluatedAt);
      return { deliveryStatus: "sent_to_expo", pushTickets: tickets };
    } catch (error) {
      await updateRouteAlertDelivery({
        evaluationId: evaluation.id,
        pushReceiptStatus: "delivery_error",
      });
      return {
        deliveryStatus: "expo_delivery_failed",
        deliveryError: error instanceof Error ? error.message : "Expo push delivery failed",
      };
    }
  }

  async function runScheduledRouteAlertEvaluation({ limit = 50, now, ignoreWindow = false } = {}) {
    assertDurableAlertStorage();
    const evaluatedAt = validIsoDate(now) || new Date().toISOString();
    const routes = await listSavedRoutes({ enabledOnly: true, limit });
    const results = [];
    const alertedUserIds = new Set();

    for (const route of routes) {
      if (!ignoreWindow && !routeAlertWindowDue(route, evaluatedAt)) {
        results.push({ routeId: route.id, status: "skipped", reason: "outside_alert_window" });
        continue;
      }
      const devices = await listPushDevices({ userId: route.userId, status: "active", limit: 20 });
      if (alertedUserIds.has(route.userId)) {
        const result = await evaluateSavedRouteAlert({
          route,
          devices,
          notificationPermission: devices.length ? "granted" : "unknown",
          candidate: {},
          regionCapabilities: capabilitiesForPoints([route.from, route.to]),
          now: evaluatedAt,
          idempotencyKey: scheduledRouteAlertIdempotencyKey(route, evaluatedAt),
          userAlertAlreadySent: true,
        });
        results.push({
          routeId: route.id,
          evaluationId: result.evaluation.id,
          status: result.evaluation.status,
          reason: result.evaluation.reason,
          deliveryStatus: result.deliveryStatus,
          idempotencyStatus: result.idempotencyStatus,
          scoringStatus: "skipped_user_alert_cap",
        });
        continue;
      }
      const scoredAlert = await scoreSavedRouteForAlert(route, evaluatedAt);
      const result = await evaluateSavedRouteAlert({
        route,
        devices,
        notificationPermission: devices.length ? "granted" : "unknown",
        candidate: scoredAlert.candidate,
        regionCapabilities: scoredAlert.regionCapabilities,
        now: evaluatedAt,
        idempotencyKey: scheduledRouteAlertIdempotencyKey(route, evaluatedAt),
      });
      results.push({
        routeId: route.id,
        evaluationId: result.evaluation.id,
        status: result.evaluation.status,
        reason: result.evaluation.reason,
        deliveryStatus: result.deliveryStatus,
        idempotencyStatus: result.idempotencyStatus,
        scoringStatus: scoredAlert.status,
      });
      if (result.evaluation.status === "send_alert") alertedUserIds.add(route.userId);
    }

    return {
      accepted: true,
      mode: "scheduled_saved_route_alert_evaluation",
      evaluatedAt,
      routeCount: routes.length,
      evaluatedCount: results.filter((item) => item.evaluationId).length,
      skippedCount: results.filter((item) => item.status === "skipped").length,
      sentCount: results.filter((item) => item.deliveryStatus === "sent_to_expo").length,
      results,
      alerts: await alertsStatus(),
    };
  }

  async function scoreSavedRouteForAlert(route, evaluatedAt) {
    if (alertRouteScorerForTests) return alertRouteScorerForTests(route, evaluatedAt);

    const fallbackCapabilities = capabilitiesForPoints([route.from, route.to]);
    try {
      const plannedRoute = await buildRoute({ from: route.from, to: route.to });
      const routeForScore = {
        id: route.id,
        name: route.name,
        provider: plannedRoute.provider,
        defaultCorridorKm: 2.5,
        defaultDetourSpeedKmh: 80,
        points: plannedRoute.points || [route.from, route.to],
      };
      const data = await loadStationData({
        requestedSource: "live",
        points: routeForScore.points,
        fuels: [route.fuel],
      });
      const scored = scoreRoute({
        source: data.source,
        route: routeForScore,
        stations: data.stations,
        fuel: route.fuel,
        tankLitres: route.tankLitres || 55,
        tankPercent: route.tankPercent || 45,
        economy: route.economy || 8.2,
        reserveKm: route.reserveKm || 35,
        corridorKm: 2.5,
        minSavingDollars: route.minSavingDollars,
        maxDetourMinutes: route.maxDetourMinutes,
        eligibleDiscounts: new Set(route.eligibleDiscounts || []),
        includeMemberPrices: false,
        includeClosed: false,
      });
      const recommendation = scored.candidates[0];
      return {
        status: recommendation ? "scored" : "no_candidate",
        candidate: recommendation ? alertCandidateFromScore(recommendation, evaluatedAt) : {},
        context: scored.context,
        regionCapabilities: data.regionCapabilities || fallbackCapabilities,
      };
    } catch (error) {
      return {
        status: "failed",
        candidate: {},
        error: error instanceof Error ? error.message : "Route alert scoring failed",
        regionCapabilities: fallbackCapabilities,
      };
    }
  }

  function alertCandidateFromScore(recommendation, evaluatedAt) {
    const station = recommendation.station || {};
    return {
      stationCode: station.stationCode,
      stationName: station.name,
      estimatedSavingDollars: recommendation.netSaving,
      detourMinutes: recommendation.detourMinutes,
      freshnessMinutes: minutesSince(station.updatedAt, evaluatedAt),
      openNow: recommendation.openNow !== false && station.openNow !== false,
      reachable: recommendation.reachable !== false,
    };
  }

  function setAlertRouteScorerForTests(scorer) {
    alertRouteScorerForTests = typeof scorer === "function" ? scorer : null;
  }

  async function checkPushReceipts({ limit = 100 } = {}) {
    assertDurableAlertStorage();
    const pending = await listPendingPushTicketEvaluations({ limit });
    const ids = pending.flatMap((evaluation) => String(evaluation.pushTicketId || "").split(",").map((id) => id.trim()).filter(Boolean));
    if (!ids.length) {
      return {
        accepted: true,
        checkedCount: 0,
        updatedCount: 0,
        receipts: {},
        alerts: await alertsStatus(),
      };
    }

    const receipts = await fetchExpoPushReceipts(ids);
    let updatedCount = 0;
    for (const evaluation of pending) {
      const ticketIds = String(evaluation.pushTicketId || "").split(",").map((id) => id.trim()).filter(Boolean);
      const statuses = ticketIds.map((id) => receiptStatus(receipts[id])).filter(Boolean);
      if (!statuses.length) continue;
      await updateRouteAlertDelivery({
        evaluationId: evaluation.id,
        pushReceiptStatus: [...new Set(statuses)].join(","),
      });
      updatedCount += 1;
    }

    return {
      accepted: true,
      checkedCount: ids.length,
      updatedCount,
      receipts,
      alerts: await alertsStatus(),
    };
  }

  function validIsoDate(value) {
    if (!value) return "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }

  function hoursBetween(start, end) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return Infinity;
    return Math.abs(endMs - startMs) / 36e5;
  }

  function minutesSince(start, end) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;
    return Math.max(0, Math.round((endMs - startMs) / 60000));
  }

  return {
    alertsStatus,
    alertsWriteAuthorised,
    alertsWriteSecurity,
    checkPushReceipts,
    cronAuthorised,
    deleteBackendSavedRoute,
    evaluateSavedRouteAlert,
    issueAlertClientCapability,
    listBackendAlertEvaluations,
    listBackendPushDevices,
    listBackendSavedRoutes,
    registerPushDevice,
    runScheduledRouteAlertEvaluation,
    saveBackendSavedRoute,
    setAlertRouteScorerForTests,
  };
}

function alertClientCapabilitySecret() {
  return process.env.ALERTS_CLIENT_CAPABILITY_SECRET || process.env.ALERTS_CLIENT_WRITE_TOKEN || "";
}

function cleanCapabilityText(value) {
  return String(value || "").trim().slice(0, 160);
}

function signAlertClientCapability(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signCapabilityPart(encodedPayload)}`;
}

function signCapabilityPart(encodedPayload) {
  return createHmac("sha256", alertClientCapabilitySecret())
    .update(encodedPayload)
    .digest("base64url");
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
  createAlertOrchestration,
};
