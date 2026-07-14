const {
  alertStorageStatus,
  appendRouteAlertEvaluation,
  claimDueSavedRoutes,
  completeSavedRouteAlertLease,
  counts: alertStorageCounts,
  deleteSavedRoute,
  listPendingPushTicketEvaluations,
  listPushDevices,
  listRouteAlertEvaluations,
  listSavedRoutes,
  retrySavedRouteAlertLease,
  savedRouteAlertLeaseActive,
  updatePushDeviceStatus,
  updateRouteAlertDelivery,
  updateSavedRouteLastAlert,
  upsertPushDevice,
  upsertSavedRoute,
} = require("./_alertStorage");
const {
  consumeAlertRateLimit,
  deleteInstallationAlertData,
  getAnonymousInstallation,
  registerAnonymousInstallation,
} = require("./_alertInstallationStorage");
const { fetchExpoPushReceipts, sendExpoPushMessages } = require("./_expoPush");
const {
  buildSavedRouteAlertEvaluation,
  isExpoPushToken,
  receiptStatus,
} = require("./_alertEvaluation");
const {
  normaliseBackendSavedRoute,
  normalisePushDevice,
} = require("./_alertRecords");
const { createScheduledRouteAlertRunner } = require("./_alertScheduler");
const { providerHealth } = require("./_providerRuntime");
const { createHash, createHmac, timingSafeEqual } = require("node:crypto");
const ALERT_MAX_RECORDS = 500;
const ALERT_CAPABILITY_SCOPE = "alerts-client-write-v1";
const ALERT_CAPABILITY_TTL_SECONDS = 15 * 60;
function createAlertOrchestration({ buildRoute, capabilitiesForPoints, loadStationData, predictionStatus, scoreRoute }) {
  let alertRouteScorerForTests;
  const runScheduledRouteAlertEvaluation = createScheduledRouteAlertRunner({
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
  });
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
    const cycleSignals = await alertCycleSignalStatus();
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
      cycleSignals,
      writeSecurity: alertsWriteSecurity(),
      pushProviderConfigured: pushDeliveryEnabled,
      cronConfigured,
      supportedDecisionStatuses: [
        "send_alert", "range_first", "alert_disabled", "quiet_today", "saving_below_threshold",
        "detour_above_threshold", "stale_price", "station_closed", "region_unsupported",
        "provider_access_pending", "missing_push_token", "permission_missing",
        "cycle_guidance_not_ready", "not_evaluated", "failed",
      ],
      supportedAlertOutcomes: ["send_alert", "watch_only", "skip_alert", "quiet_today", "range_first"],
      nextBuildStep: pushDeliveryEnabled
        ? "Connect scheduled evaluation to live route scoring and monitor Expo push receipts."
        : "Enable EXPO_PUSH_DELIVERY_ENABLED only after native device-token validation passes.",
    };
  }
  function alertPushDeliveryEnabled(userId = "") {
    if (process.env.EXPO_PUSH_DELIVERY_ENABLED !== "1") return false;
    const allowedUserIds = String(process.env.EXPO_PUSH_BETA_USER_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return userId ? allowedUserIds.includes(userId) : allowedUserIds.length > 0;
  }
  async function alertCycleSignalStatus() {
    const fallback = {
      mode: "background_measurement_only",
      cycleAlertsEnabled: false,
      userFacingPredictionEnabled: false,
      accuracyClaimsAllowed: false,
      readinessStatus: "measurement_only",
      blockers: ["prediction_status_unavailable"],
    };
    if (typeof predictionStatus !== "function") return fallback;
    try {
      const predictions = await predictionStatus();
      const readiness = predictions.readiness || {};
      const cycleAlertsEnabled =
        process.env.FUEL_PATH_CYCLE_ALERTS_ENABLED === "1" &&
        predictions.userFacingPredictionEnabled === true &&
        predictions.accuracyClaimsAllowed === true &&
        readiness.status === "ready_for_limited_cycle_guidance";
      return {
        mode: cycleAlertsEnabled ? "cycle_alerts_enabled" : "background_measurement_only",
        cycleAlertsEnabled,
        userFacingPredictionEnabled: predictions.userFacingPredictionEnabled === true,
        accuracyClaimsAllowed: predictions.accuracyClaimsAllowed === true,
        readinessStatus: readiness.status || "measurement_only",
        blockers: Array.isArray(readiness.blockers) ? readiness.blockers : [],
      };
    } catch (error) {
      return {
        ...fallback,
        lastError: error instanceof Error ? error.message : "Prediction status unavailable",
      };
    }
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
  function alertsAdminWriteAuthorised(req = {}) {
    const expectedToken = process.env.ALERTS_VALIDATION_TOKEN || process.env.ALERTS_WRITE_TOKEN;
    if (!expectedToken) return false;
    const headers = req.headers || {};
    const auth = headers.authorization || headers.Authorization || "";
    const direct = headers["x-fuel-path-alerts-token"] || headers["X-Fuel-Path-Alerts-Token"] || "";
    const supplied = String(auth).replace(/^Bearer\s+/i, "").trim() || String(direct).trim();
    return supplied === expectedToken;
  }
  function alertRecordsReadAuthorised(req = {}) {
    if (!process.env.ALERTS_WRITE_TOKEN) return false;
    const headers = req.headers || {};
    const auth = headers.authorization || headers.Authorization || "";
    const direct = headers["x-fuel-path-alerts-token"] || headers["X-Fuel-Path-Alerts-Token"] || "";
    const supplied = String(auth).replace(/^Bearer\s+/i, "").trim() || String(direct).trim();
    return supplied === process.env.ALERTS_WRITE_TOKEN;
  }
  async function issueAlertClientCapability({ installationId = "", installationSecret = "" } = {}, req = {}) {
    const security = alertsWriteSecurity();
    if (!security.clientTokenEnabled || !security.clientCapabilityConfigured) {
      return {
        accepted: false,
        error: "Alert client capability issuing is disabled.",
        alerts: security,
      };
    }
    const safeInstallationId = cleanInstallationId(installationId);
    const safeInstallationSecret = cleanInstallationSecret(installationSecret);
    if (!safeInstallationId || !safeInstallationSecret) {
      return {
        accepted: false,
        error: "Alert client capability requires an installation identity.",
        alerts: security,
      };
    }
    assertDurableAlertStorage();
    const rateKeys = capabilityRateKeys(req, safeInstallationId);
    const [networkRate, installationRate] = await Promise.all([
      consumeAlertRateLimit({
        rateKey: rateKeys.network,
        action: "issue-capability-network",
        limit: 30,
        windowSeconds: 60,
      }),
      consumeAlertRateLimit({
        rateKey: rateKeys.installation,
        action: "issue-capability-installation",
        limit: 10,
        windowSeconds: 60,
      }),
    ]);
    if (!networkRate.allowed || !installationRate.allowed) {
      return {
        accepted: false,
        error: "Too many alert capability requests. Try again shortly.",
        retryAfterSeconds: 60,
        alerts: security,
      };
    }
    const installation = await registerAnonymousInstallation({
      installationId: safeInstallationId,
      secretHash: installationSecretHash(safeInstallationSecret),
    });
    if (
      installation.revokedAt ||
      !timingSafeEqualText(installation.secretHash, installationSecretHash(safeInstallationSecret))
    ) {
      return {
        accepted: false,
        error: "Alert client capability is not available for this installation.",
        alerts: security,
      };
    }
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      scope: ALERT_CAPABILITY_SCOPE,
      installationId: safeInstallationId,
      capabilityVersion: Number(installation.capabilityVersion || 1),
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
  async function alertClientCapabilitySubject(req = {}) {
    const headers = req.headers || {};
    const auth = headers.authorization || headers.Authorization || "";
    const supplied = String(auth).replace(/^Bearer\s+/i, "").trim();
    const payload = verifyAlertClientCapability(supplied);
    if (!payload) return null;
    const installation = await getAnonymousInstallation(payload.installationId);
    if (
      !installation ||
      installation.revokedAt ||
      Number(installation.capabilityVersion || 1) !== Number(payload.capabilityVersion)
    ) return null;
    return { installationId: payload.installationId };
  }
  alertsWriteAuthorised.subjectFor = alertClientCapabilitySubject;
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
      typeof payload.installationId === "string" &&
      Boolean(cleanInstallationId(payload.installationId)) &&
      Number.isFinite(payload.exp) &&
      payload.exp > now &&
      Number.isFinite(payload.capabilityVersion)
    ) ? payload : null;
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
  async function deleteMyAlertData(installationId = "") {
    assertDurableAlertStorage();
    const deleted = await deleteInstallationAlertData(installationId);
    return {
      accepted: true,
      installationId,
      ...deleted,
    };
  }
  deleteBackendSavedRoute.allForInstallation = deleteMyAlertData;
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
    const pushDeliveryEnabled = alertPushDeliveryEnabled(route.userId);
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
  async function validateSavedRouteAlertDelivery({ routeId = "", userId = "", deviceId = "" } = {}) {
    assertDurableAlertStorage();
    if (process.env.EXPO_PUSH_VALIDATION_ENABLED !== "1") {
      return { accepted: false, deliveryStatus: "validation_delivery_disabled" };
    }
    const hasExplicitTarget = Boolean(routeId || userId || deviceId);
    if (hasExplicitTarget && (!routeId || !userId || !deviceId)) {
      return { accepted: false, deliveryStatus: "validation_target_incomplete" };
    }

    const routes = await listSavedRoutes({
      userId: hasExplicitTarget ? userId : "",
      enabledOnly: true,
      limit: hasExplicitTarget ? 50 : 2,
    });
    const route = hasExplicitTarget
      ? routes.find((item) => item.id === routeId && item.userId === userId)
      : routes.length === 1 ? routes[0] : null;
    if (!route) {
      return {
        accepted: false,
        deliveryStatus: hasExplicitTarget ? "validation_target_not_found" : "validation_target_ambiguous",
      };
    }

    const devices = await listPushDevices({
      userId: route.userId,
      status: "active",
      limit: hasExplicitTarget ? 50 : 2,
    });
    const device = hasExplicitTarget
      ? devices.find((item) => item.deviceId === deviceId && item.userId === userId)
      : devices.length === 1 ? devices[0] : null;
    if (!route || !device) {
      return {
        accepted: false,
        deliveryStatus: hasExplicitTarget ? "validation_target_not_found" : "validation_target_ambiguous",
      };
    }
    const now = new Date().toISOString();
    const validationRoute = { ...route, lastAlertSentAt: "" };
    const evaluation = buildSavedRouteAlertEvaluation({
      route: validationRoute,
      devices: [device],
      candidate: {
        stationCode: "validation-only",
        stationName: "Fuel Path validation",
        estimatedSavingDollars: Math.max(10, Number(route.minSavingDollars || 0) + 1),
        detourMinutes: 0,
        freshnessMinutes: 0,
        openNow: true,
      },
      notificationPermission: "granted",
      regionCapabilities: [{ region: "VALIDATION", capability: "live" }],
      now,
      pushDeliveryEnabled: true,
      idempotencyKey: `validation:${route.id}:${device.deviceId}:${now}`,
    });
    evaluation.messageTitle = "Fuel Path notification test";
    evaluation.messageBody = "Your Pixel is ready for saved-route alerts.";
    const recordedEvaluation = await appendRouteAlertEvaluation(evaluation);
    if (recordedEvaluation?._alreadyRecorded) {
      return { accepted: false, deliveryStatus: "skipped_duplicate_evaluation" };
    }
    const delivery = await deliverSavedRouteAlert({
      route: validationRoute,
      devices: [device],
      evaluation,
      pushDeliveryEnabled: true,
      recordLastAlert: false,
    });
    return {
      accepted: delivery.deliveryStatus === "sent_to_expo",
      deliveryStatus: delivery.deliveryStatus,
      evaluationId: evaluation.id,
      ticketAccepted: delivery.deliveryStatus === "sent_to_expo",
    };
  }
  async function deliverSavedRouteAlert({
    route,
    devices = [],
    evaluation,
    pushDeliveryEnabled,
    recordLastAlert = true,
  } = {}) {
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
      if (recordLastAlert) await updateSavedRouteLastAlert(route.id, evaluation.evaluatedAt, route.userId);
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
      const cycleSignals = await alertCycleSignalStatus();
      return {
        status: recommendation ? "scored" : "no_candidate",
        candidate: recommendation ? alertCandidateFromScore(recommendation, evaluatedAt, cycleSignals) : {},
        context: { ...scored.context, cycleSignals },
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
  function alertCandidateFromScore(recommendation, evaluatedAt, cycleSignals = {}) {
    const station = recommendation.station || {};
    return {
      stationCode: station.stationCode,
      stationName: station.name,
      alertBasis: "route_price_opportunity",
      cycleSignalMode: cycleSignals.mode || "background_measurement_only",
      cycleReadinessStatus: cycleSignals.readinessStatus || "measurement_only",
      cycleAlertsEnabled: cycleSignals.cycleAlertsEnabled === true,
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
    alertsAdminWriteAuthorised,
    alertRecordsReadAuthorised,
    alertsStatus,
    alertsWriteAuthorised,
    alertsWriteSecurity,
    checkPushReceipts,
    cronAuthorised,
    deleteBackendSavedRoute,
    evaluateSavedRouteAlert,
    validateSavedRouteAlertDelivery,
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
function cleanInstallationId(value) {
  const id = String(value || "").trim();
  return /^installation_[a-z0-9_-]{20,160}$/i.test(id) ? id : "";
}
function cleanInstallationSecret(value) {
  const secret = String(value || "").trim();
  return /^[a-z0-9_-]{32,256}$/i.test(secret) ? secret : "";
}
function installationSecretHash(value) {
  return createHash("sha256").update(value).digest("base64url");
}
function capabilityRateKeys(req, installationId) {
  const headers = req?.headers || {};
  const forwarded = String(headers["x-forwarded-for"] || headers["X-Forwarded-For"] || "").split(",")[0].trim();
  const remote = String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || "").trim();
  const network = forwarded || remote || "unknown";
  const digest = (value) => createHmac("sha256", alertClientCapabilitySecret())
    .update(value)
    .digest("base64url");
  return {
    network: digest(`network:${network}`),
    installation: digest(`installation:${installationId}`),
  };
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
