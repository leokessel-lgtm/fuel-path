const assert = require("node:assert/strict");
const test = require("node:test");

const alertsHandler = require("../../api/alerts");
const cronEvaluateHandler = require("../../api/cron/evaluate-route-alerts");
const internalJobsHandler = require("../../api/jobs");
const pushRegisterHandler = require("../../api/push/register");
const statusHandler = require("../../api/status");
const { setAlertRouteScorerForTests, setAlertStorageForTests, setPredictionStorageForTests } = require("../../api/_backend");
const {
  listSavedRoutes: listStoredSavedRoutes,
  updateSavedRouteLastAlert: updateStoredSavedRouteLastAlert,
  upsertSavedRoute: upsertStoredSavedRoute,
} = require("../../api/_alertStorage");
const { setExpoPushClientForTests } = require("../../api/_expoPush");

const route = {
  id: "route-sylvania-cbd",
  userId: "user-test",
  name: "Sylvania to CBD",
  from: { lat: -34.012, lon: 151.108, label: "Sylvania" },
  to: { lat: -33.8688, lon: 151.2093, label: "Sydney CBD" },
  fuel: "U91",
  alertEnabled: true,
  alertTimeLocal: "07:30",
  timezone: "Australia/Sydney",
  minSavingDollars: 5,
  maxDetourMinutes: 8,
};

const device = {
  userId: "user-test",
  deviceId: "ios-1",
  platform: "ios",
  expoPushToken: "ExponentPushToken[test-token]",
  appVersion: "1.0.0",
};

test("alerts status exposes backend foundation without enabling push delivery", async () => {
  const response = await callStatus();

  assert.equal(response.status, 200);
  assert.equal(response.payload.alerts.mode, "backend_foundation");
  assert.equal(response.payload.alerts.evaluatorEnabled, true);
  assert.equal(response.payload.alerts.schedulerEnabled, false);
  assert.equal(response.payload.alerts.pushDeliveryEnabled, false);
  assert.equal(response.payload.alerts.cycleSignals.mode, "background_measurement_only");
  assert.equal(response.payload.alerts.cycleSignals.cycleAlertsEnabled, false);
  assert.equal(response.payload.alerts.cycleSignals.userFacingPredictionEnabled, false);
  assert.equal(response.payload.alerts.degraded, false);
  assert.equal(response.payload.alerts.providerHealth.alerts.status, "ok");
  assert.equal(response.payload.alerts.providerHealth.alerts.cacheMode, "none");
  assert.match(response.payload.alerts.providerHealth.alerts.warning, /push delivery is disabled/i);
  assert.deepEqual(response.payload.alerts.supportedAlertOutcomes, [
    "send_alert",
    "watch_only",
    "skip_alert",
    "quiet_today",
    "range_first",
  ]);
  assert.equal(response.payload.alerts.storage.configured, false);
  assert.equal(response.payload.alerts.storage.durable, false);
  assert.equal(response.payload.alerts.writeSecurity.tokenRequired, false);
});

test("backend alert sync rejects ephemeral memory storage", async () => {
  const saved = await callSavedRoutes("POST", {}, route);
  const registered = await callPushRegister(device);

  assert.equal(saved.status, 401);
  assert.match(saved.payload.error, /installation capability/i);
  assert.equal(registered.status, 401);
  assert.match(registered.payload.error, /installation capability/i);
});

test("saved-route alert foundation stores route, device and sendable evaluation", async () => {
  const original = process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);

  try {
    const headers = { authorization: "Bearer alert-token" };
    const saved = await callSavedRoutes("POST", {}, route, headers);
    const registered = await callPushRegister(device, headers);
    const evaluated = await callAlerts("POST", { action: "evaluate" }, {
      route,
      devices: [registered.payload.device],
      notificationPermission: "granted",
      regionCapabilities: [{ region: "NSW", capability: "live" }],
      candidate: {
        stationCode: "station-1",
        stationName: "Taren Point Fuel",
        estimatedSavingDollars: 8.25,
        detourMinutes: 4,
        freshnessMinutes: 35,
        openNow: true,
      },
    }, headers);
    const routes = await callSavedRoutes("GET", { userId: "user-test" }, {}, headers);
    const evaluations = await callAlerts("GET", { mode: "evaluations", routeId: route.id }, {}, headers);

    assert.equal(saved.status, 202);
    assert.equal(saved.payload.route.alertEnabled, true);
    assert.equal(registered.status, 202);
    assert.equal(evaluated.status, 202);
    assert.equal(evaluated.payload.evaluation.status, "send_alert");
    assert.equal(evaluated.payload.evaluation.outcome, "send_alert");
    assert.equal(evaluated.payload.evaluation.outcomeLabel, "Send alert");
    assert.match(evaluated.payload.evaluation.outcomeSummary, /worth checking/i);
    assert.equal(evaluated.payload.deliveryStatus, "not_sent_push_provider_disabled");
    assert.equal(evaluated.payload.evaluation.pushDeliveryEnabled, false);
    assert.equal(routes.payload.routes.some((item) => item.id === route.id), true);
    assert.equal(evaluations.payload.evaluations.some((item) => item.routeId === route.id), true);
  } finally {
    setAlertStorageForTests(null);
    if (original === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = original;
  }
});

test("route-watch enrolment persists the device and route through one storage boundary", async () => {
  const originalEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED;
  const originalSecret = process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
  process.env.ALERTS_CLIENT_WRITE_ENABLED = "1";
  process.env.ALERTS_CLIENT_CAPABILITY_SECRET = "preview-capability-secret";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  try {
    const capability = await callAlerts("POST", { action: "client-capability" }, anonymousInstallation("w"));
    const enrolled = await callAlerts("POST", { action: "enrol-watch" }, { ...route, ...device }, {
      authorization: `Bearer ${capability.payload.token}`,
    });

    assert.equal(enrolled.status, 202);
    assert.equal(enrolled.payload.code, "watch_enabled");
    assert.equal(store.devices.length, 1);
    assert.equal(store.routes.length, 1);
  } finally {
    setAlertStorageForTests(null);
    if (originalEnabled === undefined) delete process.env.ALERTS_CLIENT_WRITE_ENABLED;
    else process.env.ALERTS_CLIENT_WRITE_ENABLED = originalEnabled;
    if (originalSecret === undefined) delete process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
    else process.env.ALERTS_CLIENT_CAPABILITY_SECRET = originalSecret;
  }
});

test("turning off the final route watch preserves the installation device and evaluation history", async () => {
  const originalEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED;
  const originalSecret = process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
  process.env.ALERTS_CLIENT_WRITE_ENABLED = "1";
  process.env.ALERTS_CLIENT_CAPABILITY_SECRET = "preview-capability-secret";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  try {
    const installation = anonymousInstallation("f");
    const capability = await callAlerts("POST", { action: "client-capability" }, installation);
    const headers = { authorization: `Bearer ${capability.payload.token}` };
    await callAlerts("POST", { action: "enrol-watch" }, { ...route, ...device }, headers);
    await store.appendRouteAlertEvaluation({
      id: "evaluation-final-watch",
      routeId: route.id,
      userId: installation.installationId,
      evaluatedAt: "2026-07-13T00:00:00.000Z",
    });

    const disabled = await callSavedRoutes("POST", {}, { ...route, alertEnabled: false }, headers);

    assert.equal(disabled.status, 202);
    assert.equal(disabled.payload.route.alertEnabled, false);
    assert.equal(store.__alertInstallations.size, 1);
    assert.equal(store.devices.length, 1);
    assert.equal(store.routes.length, 1);
    assert.equal(store.routes[0].alertEnabled, false);
    assert.equal(store.evaluations.length, 1);
  } finally {
    setAlertStorageForTests(null);
    if (originalEnabled === undefined) delete process.env.ALERTS_CLIENT_WRITE_ENABLED;
    else process.env.ALERTS_CLIENT_WRITE_ENABLED = originalEnabled;
    if (originalSecret === undefined) delete process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
    else process.env.ALERTS_CLIENT_CAPABILITY_SECRET = originalSecret;
  }
});

test("route-watch re-enrolment is idempotent for one anonymous installation", async () => {
  const originalEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED;
  const originalSecret = process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
  process.env.ALERTS_CLIENT_WRITE_ENABLED = "1";
  process.env.ALERTS_CLIENT_CAPABILITY_SECRET = "preview-capability-secret";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  try {
    const installation = anonymousInstallation("r");
    const capability = await callAlerts("POST", { action: "client-capability" }, installation);
    const headers = { authorization: `Bearer ${capability.payload.token}` };
    const [first, second] = await Promise.all([
      callAlerts("POST", { action: "enrol-watch" }, { ...route, ...device }, headers),
      callAlerts("POST", { action: "enrol-watch" }, { ...route, ...device }, headers),
    ]);

    assert.equal(first.status, 202);
    assert.equal(second.status, 202);
    assert.equal(store.__alertInstallations.size, 1);
    assert.equal(store.devices.length, 1);
    assert.equal(store.routes.length, 1);
    assert.equal(store.routes[0].userId, installation.installationId);
  } finally {
    setAlertStorageForTests(null);
    if (originalEnabled === undefined) delete process.env.ALERTS_CLIENT_WRITE_ENABLED;
    else process.env.ALERTS_CLIENT_WRITE_ENABLED = originalEnabled;
    if (originalSecret === undefined) delete process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
    else process.env.ALERTS_CLIENT_CAPABILITY_SECRET = originalSecret;
  }
});

test("route-watch enrolment leaves no partial records when its storage operation fails", async () => {
  const originalEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED;
  const originalSecret = process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
  process.env.ALERTS_CLIENT_WRITE_ENABLED = "1";
  process.env.ALERTS_CLIENT_CAPABILITY_SECRET = "preview-capability-secret";
  const store = memoryDurableStore();
  let enrolmentCalls = 0;
  store.enrolPushDeviceAndSavedRoute = async () => {
    enrolmentCalls += 1;
    throw new Error("simulated atomic enrolment failure");
  };
  setAlertStorageForTests(store);
  try {
    const capability = await callAlerts("POST", { action: "client-capability" }, anonymousInstallation("x"));
    const rejected = await callAlerts("POST", { action: "enrol-watch" }, { ...route, ...device }, {
      authorization: `Bearer ${capability.payload.token}`,
    });

    assert.equal(rejected.status, 400);
    assert.equal(enrolmentCalls, 1);
    assert.equal(store.devices.length, 0);
    assert.equal(store.routes.length, 0);
  } finally {
    setAlertStorageForTests(null);
    if (originalEnabled === undefined) delete process.env.ALERTS_CLIENT_WRITE_ENABLED;
    else process.env.ALERTS_CLIENT_WRITE_ENABLED = originalEnabled;
    if (originalSecret === undefined) delete process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
    else process.env.ALERTS_CLIENT_CAPABILITY_SECRET = originalSecret;
  }
});

test("alert record listings require the operator token and never accept validation credentials", async () => {
  const originalWrite = process.env.ALERTS_WRITE_TOKEN;
  const originalValidation = process.env.ALERTS_VALIDATION_TOKEN;
  process.env.ALERTS_WRITE_TOKEN = "operator-token";
  process.env.ALERTS_VALIDATION_TOKEN = "validation-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  try {
    await store.upsertPushDevice(device);
    const publicRead = await callAlerts("GET", { mode: "devices" });
    const validationRead = await callAlerts("GET", { mode: "devices" }, {}, {
      authorization: "Bearer validation-token",
    });
    const operatorRead = await callAlerts("GET", { mode: "devices" }, {}, {
      authorization: "Bearer operator-token",
    });
    assert.equal(publicRead.status, 401);
    assert.equal(validationRead.status, 401);
    assert.equal(operatorRead.status, 200);
    assert.equal(operatorRead.payload.devices.length, 1);
  } finally {
    setAlertStorageForTests(null);
    if (originalWrite === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalWrite;
    if (originalValidation === undefined) delete process.env.ALERTS_VALIDATION_TOKEN;
    else process.env.ALERTS_VALIDATION_TOKEN = originalValidation;
  }
});

test("alert evaluator blocks noisy or unsafe unhappy paths", async () => {
  const originalToken = process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  const cases = [
    {
      name: "paused route",
      route: { ...route, pausedUntil: "2099-06-18T00:00:00.000Z" },
      input: { notificationPermission: "granted", devices: [device], candidate: freshCandidate() },
      expected: "quiet_today",
      expectedOutcome: "quiet_today",
      expectedLabel: "Quiet today",
    },
    {
      name: "missing permission",
      input: { notificationPermission: "denied", devices: [device], candidate: freshCandidate() },
      expected: "permission_missing",
      expectedOutcome: "watch_only",
      expectedLabel: "Watch only",
    },
    {
      name: "missing token",
      input: { notificationPermission: "granted", devices: [], candidate: freshCandidate() },
      expected: "missing_push_token",
      expectedOutcome: "watch_only",
      expectedLabel: "Watch only",
    },
    {
      name: "invalid token",
      input: {
        notificationPermission: "granted",
        devices: [{ ...device, expoPushToken: "not-an-expo-token" }],
        candidate: freshCandidate(),
      },
      expected: "missing_push_token",
      expectedOutcome: "watch_only",
      expectedLabel: "Watch only",
    },
    {
      name: "not evaluated",
      input: { notificationPermission: "granted", devices: [device], candidate: {} },
      expected: "not_evaluated",
      expectedOutcome: "watch_only",
      expectedLabel: "Watch only",
    },
    {
      name: "pending provider",
      input: {
        notificationPermission: "granted",
        devices: [device],
        regionCapabilities: [{ region: "SA", capability: "pending_access" }],
        candidate: freshCandidate(),
      },
      expected: "provider_access_pending",
      expectedOutcome: "skip_alert",
      expectedLabel: "Skip alert",
    },
    {
      name: "stale price",
      input: { notificationPermission: "granted", devices: [device], candidate: freshCandidate({ freshnessMinutes: 240 }) },
      expected: "stale_price",
      expectedOutcome: "skip_alert",
      expectedLabel: "Skip alert",
    },
    {
      name: "range first",
      input: { notificationPermission: "granted", devices: [device], candidate: freshCandidate({ reachable: false }) },
      expected: "range_first",
      expectedOutcome: "range_first",
      expectedLabel: "Range first",
    },
    {
      name: "saving below threshold",
      input: { notificationPermission: "granted", devices: [device], candidate: freshCandidate({ estimatedSavingDollars: 2 }) },
      expected: "saving_below_threshold",
      expectedOutcome: "skip_alert",
      expectedLabel: "Skip alert",
    },
    {
      name: "detour above threshold",
      input: { notificationPermission: "granted", devices: [device], candidate: freshCandidate({ detourMinutes: 20 }) },
      expected: "detour_above_threshold",
      expectedOutcome: "skip_alert",
      expectedLabel: "Skip alert",
    },
  ];

  try {
    for (const item of cases) {
      const response = await callAlerts("POST", { action: "evaluate" }, {
        route: item.route || route,
        regionCapabilities: [{ region: "NSW", capability: "live" }],
        ...item.input,
      }, { authorization: "Bearer alert-token" });
      assert.equal(response.status, 202, item.name);
      assert.equal(response.payload.evaluation.status, item.expected, item.name);
      assert.equal(response.payload.evaluation.outcome, item.expectedOutcome, item.name);
      assert.equal(response.payload.evaluation.outcomeLabel, item.expectedLabel, item.name);
      assert.equal(typeof response.payload.evaluation.outcomeSummary, "string", item.name);
      assert.equal(response.payload.evaluation.outcomeSummary.length > 12, true, item.name);
    }
  } finally {
    setAlertStorageForTests(null);
    if (originalToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalToken;
  }
});

test("fuel-cycle alert candidates stay blocked until prediction guidance is approved", async () => {
  const originalToken = process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);

  try {
    const evaluated = await callAlerts("POST", { action: "evaluate" }, {
      route,
      devices: [device],
      notificationPermission: "granted",
      regionCapabilities: [{ region: "NSW", capability: "live" }],
      candidate: {
        ...freshCandidate({ estimatedSavingDollars: 12, freshnessMinutes: 10 }),
        alertBasis: "fuel_cycle",
        cycleSignalMode: "background_measurement_only",
        cycleReadinessStatus: "measurement_only",
        cycleAlertsEnabled: false,
      },
    }, { authorization: "Bearer alert-token" });

    assert.equal(evaluated.status, 202);
    assert.equal(evaluated.payload.evaluation.status, "cycle_guidance_not_ready");
    assert.equal(evaluated.payload.evaluation.reason, "cycle_guidance_gate_closed");
    assert.equal(evaluated.payload.evaluation.outcome, "skip_alert");
    assert.equal(evaluated.payload.evaluation.alertBasis, "fuel_cycle");
    assert.equal(evaluated.payload.evaluation.cycleSignalMode, "background_measurement_only");
    assert.equal(evaluated.payload.evaluation.cycleReadinessStatus, "measurement_only");
    assert.equal(evaluated.payload.deliveryStatus, "not_applicable");
  } finally {
    setAlertStorageForTests(null);
    if (originalToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalToken;
  }
});

test("durable alert storage requires write token and keeps push disabled", async () => {
  const original = process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);

  try {
    const rejected = await callSavedRoutes("POST", {}, route);
    const accepted = await callSavedRoutes("POST", {}, route, { authorization: "Bearer alert-token" });
    const status = await callStatus();

    assert.equal(rejected.status, 401);
    assert.match(rejected.payload.error, /Saved route sync is not available in this session/);
    assert.equal(accepted.status, 202);
    assert.equal(status.payload.alerts.storage.mode, "postgres_neon");
    assert.equal(status.payload.alerts.storage.durable, true);
    assert.equal(status.payload.alerts.writeSecurity.tokenRequired, true);
    assert.equal(status.payload.alerts.writeSecurity.writeEnabled, true);
    assert.equal(status.payload.alerts.pushDeliveryEnabled, false);
  } finally {
    setAlertStorageForTests(null);
    if (original === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = original;
  }
});

test("durable alert storage rejects a shared client token without an installation capability", async () => {
  const originalAdminToken = process.env.ALERTS_WRITE_TOKEN;
  const originalClientEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED;
  const originalClientToken = process.env.ALERTS_CLIENT_WRITE_TOKEN;
  delete process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_CLIENT_WRITE_ENABLED = "1";
  process.env.ALERTS_CLIENT_WRITE_TOKEN = "preview-client-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);

  try {
    const rejected = await callSavedRoutes("POST", {}, route, { authorization: "Bearer wrong-token" });
    const accepted = await callSavedRoutes("POST", {}, route, { authorization: "Bearer preview-client-token" });
    const status = await callStatus();

    assert.equal(rejected.status, 401);
    assert.equal(accepted.status, 401);
    assert.equal(status.payload.alerts.writeSecurity.adminTokenConfigured, false);
    assert.equal(status.payload.alerts.writeSecurity.clientTokenEnabled, true);
    assert.equal(status.payload.alerts.writeSecurity.clientTokenConfigured, true);
    assert.equal(status.payload.alerts.writeSecurity.writeEnabled, true);
  } finally {
    setAlertStorageForTests(null);
    if (originalAdminToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalAdminToken;
    if (originalClientEnabled === undefined) delete process.env.ALERTS_CLIENT_WRITE_ENABLED;
    else process.env.ALERTS_CLIENT_WRITE_ENABLED = originalClientEnabled;
    if (originalClientToken === undefined) delete process.env.ALERTS_CLIENT_WRITE_TOKEN;
    else process.env.ALERTS_CLIENT_WRITE_TOKEN = originalClientToken;
  }
});

test("backend mints scoped client capability for saved-route sync without exposing public token", async () => {
  const originalAdminToken = process.env.ALERTS_WRITE_TOKEN;
  const originalClientEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED;
  const originalClientToken = process.env.ALERTS_CLIENT_WRITE_TOKEN;
  const originalCapabilitySecret = process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
  delete process.env.ALERTS_WRITE_TOKEN;
  delete process.env.ALERTS_CLIENT_WRITE_TOKEN;
  process.env.ALERTS_CLIENT_WRITE_ENABLED = "1";
  process.env.ALERTS_CLIENT_CAPABILITY_SECRET = "preview-capability-secret";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);

  try {
    const rejected = await callSavedRoutes("POST", {}, route);
    const installation = anonymousInstallation();
    const capability = await callAlerts("POST", { action: "client-capability" }, installation);
    const headers = { authorization: `Bearer ${capability.payload.token}` };
    const accepted = await callSavedRoutes("POST", {}, { ...route, userId: "forged-owner" }, headers);
    const registered = await callPushRegister(device, headers);
    const status = await callStatus();

    assert.equal(rejected.status, 401);
    assert.equal(capability.status, 202);
    assert.equal(capability.payload.accepted, true);
    assert.equal(typeof capability.payload.token, "string");
    assert.match(capability.payload.token, /\./);
    const capabilityPayload = JSON.parse(Buffer.from(capability.payload.token.split(".")[0], "base64url").toString("utf8"));
    assert.equal(capabilityPayload.exp - capabilityPayload.iat, 15 * 60);
    assert.equal(capabilityPayload.capabilityVersion, 1);
    assert.equal(accepted.status, 202);
    assert.equal(accepted.payload.route.userId, installation.installationId);
    assert.equal(registered.status, 202);
    assert.equal(status.payload.alerts.writeSecurity.clientCapabilityConfigured, true);
    assert.equal(status.payload.alerts.writeSecurity.clientTokenConfigured, false);
    assert.equal(status.payload.alerts.writeSecurity.writeEnabled, true);
  } finally {
    setAlertStorageForTests(null);
    if (originalAdminToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalAdminToken;
    if (originalClientEnabled === undefined) delete process.env.ALERTS_CLIENT_WRITE_ENABLED;
    else process.env.ALERTS_CLIENT_WRITE_ENABLED = originalClientEnabled;
    if (originalClientToken === undefined) delete process.env.ALERTS_CLIENT_WRITE_TOKEN;
    else process.env.ALERTS_CLIENT_WRITE_TOKEN = originalClientToken;
    if (originalCapabilitySecret === undefined) delete process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
    else process.env.ALERTS_CLIENT_CAPABILITY_SECRET = originalCapabilitySecret;
  }
});

test("installation capabilities isolate identical deterministic route ids", async () => {
  const originalEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED;
  const originalSecret = process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
  const originalWriteToken = process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_CLIENT_WRITE_ENABLED = "1";
  process.env.ALERTS_CLIENT_CAPABILITY_SECRET = "preview-capability-secret";
  process.env.ALERTS_WRITE_TOKEN = "operator-alert-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  try {
    const firstInstallation = anonymousInstallation("a");
    const secondInstallation = anonymousInstallation("c");
    const firstCapability = await callAlerts("POST", { action: "client-capability" }, firstInstallation);
    const secondCapability = await callAlerts("POST", { action: "client-capability" }, secondInstallation);
    const firstHeaders = { authorization: `Bearer ${firstCapability.payload.token}` };
    const secondHeaders = { authorization: `Bearer ${secondCapability.payload.token}` };

    const first = await callSavedRoutes("POST", {}, { ...route, name: "First owner" }, firstHeaders);
    const second = await callSavedRoutes("POST", {}, { ...route, name: "Second owner" }, secondHeaders);
    const firstList = await callSavedRoutes("GET", {}, {}, firstHeaders);
    const secondList = await callSavedRoutes("GET", {}, {}, secondHeaders);
    const firstName = firstList.payload.routes.find((item) => item.userId === firstInstallation.installationId)?.name;
    const secondName = secondList.payload.routes.find((item) => item.userId === secondInstallation.installationId)?.name;
    await store.updateSavedRouteLastAlert(route.id, "2026-07-12T08:00:00.000Z", firstInstallation.installationId);
    assert.equal(store.routes.find((item) => item.userId === firstInstallation.installationId)?.lastAlertSentAt, "2026-07-12T08:00:00.000Z");
    assert.equal(store.routes.find((item) => item.userId === secondInstallation.installationId)?.lastAlertSentAt, undefined);
    const ambiguousOperatorDelete = await callSavedRoutes(
      "DELETE",
      { routeId: route.id },
      {},
      { authorization: "Bearer operator-alert-token" },
    );
    assert.equal(ambiguousOperatorDelete.status, 400);
    assert.equal(store.routes.length, 2);
    await callSavedRoutes("DELETE", { routeId: route.id }, {}, firstHeaders);
    const secondAfterDelete = await callSavedRoutes("GET", {}, {}, secondHeaders);

    assert.equal(first.status, 202);
    assert.equal(second.status, 202);
    assert.equal(firstName, "First owner");
    assert.equal(secondName, "Second owner");
    assert.equal(secondAfterDelete.payload.routes[0].name, "Second owner");
  } finally {
    setAlertStorageForTests(null);
    if (originalEnabled === undefined) delete process.env.ALERTS_CLIENT_WRITE_ENABLED;
    else process.env.ALERTS_CLIENT_WRITE_ENABLED = originalEnabled;
    if (originalSecret === undefined) delete process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
    else process.env.ALERTS_CLIENT_CAPABILITY_SECRET = originalSecret;
    if (originalWriteToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalWriteToken;
  }
});

test("client capability cannot invoke evaluation or internal jobs", async () => {
  const originalEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED;
  const originalSecret = process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
  process.env.ALERTS_CLIENT_WRITE_ENABLED = "1";
  process.env.ALERTS_CLIENT_CAPABILITY_SECRET = "preview-capability-secret";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  try {
    const capability = await callAlerts("POST", { action: "client-capability" }, anonymousInstallation("d"));
    const headers = { authorization: `Bearer ${capability.payload.token}` };
    const evaluation = await callAlerts("POST", { action: "evaluate" }, { route }, headers);
    const job = await callHandler(internalJobsHandler, {
      method: "POST",
      query: { job: "evaluate-route-alerts" },
      body: {},
      headers,
    });
    assert.equal(evaluation.status, 401);
    assert.equal(job.status, 401);
  } finally {
    setAlertStorageForTests(null);
    if (originalEnabled === undefined) delete process.env.ALERTS_CLIENT_WRITE_ENABLED;
    else process.env.ALERTS_CLIENT_WRITE_ENABLED = originalEnabled;
    if (originalSecret === undefined) delete process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
    else process.env.ALERTS_CLIENT_CAPABILITY_SECRET = originalSecret;
  }
});

test("delete-my-alert-data is atomic and revokes the existing capability", async () => {
  const originalEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED;
  const originalSecret = process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
  process.env.ALERTS_CLIENT_WRITE_ENABLED = "1";
  process.env.ALERTS_CLIENT_CAPABILITY_SECRET = "preview-capability-secret";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  try {
    const installation = anonymousInstallation("e");
    const capability = await callAlerts("POST", { action: "client-capability" }, installation);
    const headers = { authorization: `Bearer ${capability.payload.token}` };
    await callSavedRoutes("POST", {}, route, headers);
    await callPushRegister(device, headers);
    await store.appendRouteAlertEvaluation({
      id: "evaluation-delete-all",
      routeId: route.id,
      userId: installation.installationId,
      evaluatedAt: "2026-07-13T00:00:00.000Z",
    });
    const deleted = await callAlerts("POST", { action: "delete-installation-data" }, {}, headers);
    const retryWrite = await callSavedRoutes("POST", {}, route, headers);

    assert.equal(deleted.status, 202);
    assert.equal(deleted.payload.deletedRouteCount, 1);
    assert.equal(deleted.payload.deletedDeviceCount, 1);
    assert.equal(deleted.payload.deletedEvaluationCount, 1);
    assert.equal(deleted.payload.revoked, true);
    assert.equal(retryWrite.status, 401);
    assert.equal(store.routes.length, 0);
    assert.equal(store.devices.length, 0);
    assert.equal(store.evaluations.length, 0);
  } finally {
    setAlertStorageForTests(null);
    if (originalEnabled === undefined) delete process.env.ALERTS_CLIENT_WRITE_ENABLED;
    else process.env.ALERTS_CLIENT_WRITE_ENABLED = originalEnabled;
    if (originalSecret === undefined) delete process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
    else process.env.ALERTS_CLIENT_CAPABILITY_SECRET = originalSecret;
  }
});

test("push-token registration keeps one active anonymous owner", async () => {
  const originalToken = process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_WRITE_TOKEN = "operator-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  try {
    const headers = { authorization: "Bearer operator-token" };
    await callPushRegister({ ...device, userId: "installation-first", deviceId: "first" }, headers);
    await callPushRegister({ ...device, userId: "installation-second", deviceId: "second" }, headers);
    const active = store.devices.filter((item) => item.expoPushToken === device.expoPushToken && item.status === "active");
    const inactive = store.devices.filter((item) => item.expoPushToken === device.expoPushToken && item.status === "inactive");
    assert.equal(active.length, 1);
    assert.equal(active[0].userId, "installation-second");
    assert.equal(inactive.length, 1);
  } finally {
    setAlertStorageForTests(null);
    if (originalToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalToken;
  }
});

test("capability issuance is durably rate limited", async () => {
  const originalEnabled = process.env.ALERTS_CLIENT_WRITE_ENABLED;
  const originalSecret = process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
  process.env.ALERTS_CLIENT_WRITE_ENABLED = "1";
  process.env.ALERTS_CLIENT_CAPABILITY_SECRET = "preview-capability-secret";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  try {
    const installation = anonymousInstallation("f");
    const responses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(await callAlerts("POST", { action: "client-capability" }, installation));
    }
    assert.equal(responses.slice(0, 10).every((response) => response.status === 202), true);
    assert.equal(responses[10].status, 429);
    assert.match(responses[10].payload.error, /too many/i);
  } finally {
    setAlertStorageForTests(null);
    if (originalEnabled === undefined) delete process.env.ALERTS_CLIENT_WRITE_ENABLED;
    else process.env.ALERTS_CLIENT_WRITE_ENABLED = originalEnabled;
    if (originalSecret === undefined) delete process.env.ALERTS_CLIENT_CAPABILITY_SECRET;
    else process.env.ALERTS_CLIENT_CAPABILITY_SECRET = originalSecret;
  }
});

test("saved-route delete removes backend route behind write token", async () => {
  const original = process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);

  try {
    const headers = { authorization: "Bearer alert-token" };
    const saved = await callSavedRoutes("POST", {}, route, headers);
    const rejected = await callSavedRoutes("DELETE", { routeId: route.id, userId: route.userId });
    const deleted = await callSavedRoutes("DELETE", { routeId: route.id, userId: route.userId }, {}, headers);
    const listed = await callSavedRoutes("GET", { userId: route.userId }, {}, headers);

    assert.equal(saved.status, 202);
    assert.equal(rejected.status, 401);
    assert.equal(deleted.status, 202);
    assert.equal(deleted.payload.deleted, true);
    assert.equal(listed.payload.routes.some((item) => item.id === route.id), false);
  } finally {
    setAlertStorageForTests(null);
    if (original === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = original;
  }
});

test("saved-route edits preserve alert audit state", async () => {
  setAlertStorageForTests(null);
  const sentAt = "2026-06-17T07:32:00.000Z";
  const original = {
    ...route,
    id: "route-edit-preserves-alert-audit",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
  const edited = {
    ...original,
    name: "Updated commute",
    minSavingDollars: 7,
    lastAlertSentAt: undefined,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };

  await upsertStoredSavedRoute(original);
  await updateStoredSavedRouteLastAlert(original.id, sentAt, original.userId);
  const stored = await upsertStoredSavedRoute(edited);
  const listed = await listStoredSavedRoutes({ userId: route.userId, limit: 100 });
  const persisted = listed.find((item) => item.id === original.id);

  assert.equal(stored.name, "Updated commute");
  assert.equal(stored.minSavingDollars, 7);
  assert.equal(stored.createdAt, original.createdAt);
  assert.equal(stored.lastAlertSentAt, sentAt);
  assert.equal(persisted.lastAlertSentAt, sentAt);
});

test("scheduled evaluator requires cron authorisation and records not-evaluated routes safely", async () => {
  const originalCron = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);

  try {
    await store.upsertSavedRoute(route);
    await store.upsertPushDevice(device);

    const rejected = await callHandler(cronEvaluateHandler, { method: "GET", query: {}, headers: {} });
    const accepted = await callHandler(cronEvaluateHandler, {
      method: "GET",
      query: { ignoreWindow: "1" },
      headers: { authorization: "Bearer cron-token" },
    });

    assert.equal(rejected.status, 401);
    assert.equal(accepted.status, 202);
    assert.equal(accepted.payload.evaluatedCount, 1);
    assert.equal(accepted.payload.sentCount, 0);
    assert.notEqual(accepted.payload.results[0].status, "send_alert");
    assert.match(accepted.payload.results[0].reason, /provider|route_scoring|unsupported|missing/);
  } finally {
    setAlertStorageForTests(null);
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
  }
});

test("scheduled evaluator scores saved routes before deciding whether to alert", async () => {
  const originalCron = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  setAlertRouteScorerForTests(async () => ({
    status: "scored",
    regionCapabilities: [{ region: "NSW", capability: "live" }],
    candidate: freshCandidate({ estimatedSavingDollars: 9, detourMinutes: 3, freshnessMinutes: 20 }),
  }));

  try {
    await store.upsertSavedRoute(route);
    await store.upsertPushDevice(device);

    const accepted = await callHandler(cronEvaluateHandler, {
      method: "GET",
      query: { ignoreWindow: "1" },
      headers: { authorization: "Bearer cron-token" },
    });

    assert.equal(accepted.status, 202);
    assert.equal(accepted.payload.evaluatedCount, 1);
    assert.equal(accepted.payload.results[0].status, "send_alert");
    assert.equal(accepted.payload.results[0].scoringStatus, "scored");
    assert.equal(accepted.payload.results[0].deliveryStatus, "not_sent_push_provider_disabled");
    assert.equal(store.evaluations[0].stationCode, "station-1");
  } finally {
    setAlertRouteScorerForTests(null);
    setAlertStorageForTests(null);
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
  }
});

test("scheduled evaluator suppresses stale and duplicate route alerts", async () => {
  const originalCron = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);

  try {
    await store.upsertPushDevice(device);
    await store.upsertSavedRoute({
      ...route,
      id: "stale-route",
      lastAlertSentAt: undefined,
    });
    setAlertRouteScorerForTests(async () => ({
      status: "scored",
      regionCapabilities: [{ region: "NSW", capability: "live" }],
      candidate: freshCandidate({ freshnessMinutes: 240 }),
    }));
    const stale = await callHandler(cronEvaluateHandler, {
      method: "GET",
      query: { ignoreWindow: "1" },
      headers: { authorization: "Bearer cron-token" },
    });

    await store.upsertSavedRoute({
      ...route,
      id: "duplicate-route",
      lastAlertSentAt: "2026-06-17T07:00:00.000Z",
    });
    setAlertRouteScorerForTests(async () => ({
      status: "scored",
      regionCapabilities: [{ region: "NSW", capability: "live" }],
      candidate: freshCandidate({ freshnessMinutes: 15 }),
    }));
    const duplicate = await callHandler(cronEvaluateHandler, {
      method: "GET",
      query: { ignoreWindow: "1", now: "2026-06-17T08:00:00.000Z" },
      headers: { authorization: "Bearer cron-token" },
    });

    assert.equal(stale.status, 202);
    assert.equal(stale.payload.results[0].status, "stale_price");
    assert.equal(duplicate.status, 202);
    assert.equal(duplicate.payload.results.some((item) => item.routeId === "duplicate-route" && item.status === "quiet_today"), true);
  } finally {
    setAlertRouteScorerForTests(null);
    setAlertStorageForTests(null);
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
  }
});

test("scheduled evaluator caps sendable alerts to one per user per run", async () => {
  const originalCron = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-token";
  const store = memoryDurableStore();
  let scoreCount = 0;
  setAlertStorageForTests(store);
  setAlertRouteScorerForTests(async () => {
    scoreCount += 1;
    return {
      status: "scored",
      regionCapabilities: [{ region: "NSW", capability: "live" }],
      candidate: freshCandidate({ estimatedSavingDollars: 9, detourMinutes: 3, freshnessMinutes: 15 }),
    };
  });

  try {
    await store.upsertPushDevice(device);
    await store.upsertSavedRoute({ ...route, id: "morning-commute", name: "Morning commute" });
    await store.upsertSavedRoute({ ...route, id: "school-run", name: "School run" });

    const accepted = await callHandler(cronEvaluateHandler, {
      method: "GET",
      query: { ignoreWindow: "1", now: "2026-06-17T07:25:00.000+10:00" },
      headers: { authorization: "Bearer cron-token" },
    });

    assert.equal(accepted.status, 202);
    assert.equal(accepted.payload.evaluatedCount, 2);
    assert.equal(accepted.payload.sentCount, 0);
    assert.equal(accepted.payload.results.filter((item) => item.status === "send_alert").length, 1);
    assert.equal(accepted.payload.results.filter((item) => item.reason === "user_alert_cap").length, 1);
    assert.equal(
      accepted.payload.results.some((item) => item.scoringStatus === "skipped_user_alert_cap"),
      true,
    );
    assert.equal(scoreCount, 1);
    assert.equal(store.evaluations.filter((item) => item.status === "send_alert").length, 1);
    assert.equal(store.evaluations.filter((item) => item.reason === "user_alert_cap").length, 1);
  } finally {
    setAlertRouteScorerForTests(null);
    setAlertStorageForTests(null);
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
  }
});

test("scheduled evaluator keeps a saved route quiet for 72 hours after an alert", async () => {
  const originalCron = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  setAlertRouteScorerForTests(async () => ({
    status: "scored",
    regionCapabilities: [{ region: "NSW", capability: "live" }],
    candidate: freshCandidate({ estimatedSavingDollars: 9, detourMinutes: 3, freshnessMinutes: 15 }),
  }));

  try {
    await store.upsertPushDevice(device);
    await store.upsertSavedRoute({
      ...route,
      id: "recent-alert-route",
      lastAlertSentAt: "2026-06-17T07:00:00.000+10:00",
    });
    await store.upsertSavedRoute({
      ...route,
      id: "cooled-alert-route",
      lastAlertSentAt: "2026-06-16T06:00:00.000+10:00",
    });

    const accepted = await callHandler(cronEvaluateHandler, {
      method: "GET",
      query: { ignoreWindow: "1", now: "2026-06-19T07:00:00.000+10:00" },
      headers: { authorization: "Bearer cron-token" },
    });

    assert.equal(accepted.status, 202);
    assert.equal(
      accepted.payload.results.some((item) =>
        item.routeId === "recent-alert-route" &&
        item.status === "quiet_today" &&
        item.reason === "duplicate_cooldown"
      ),
      true,
    );
    assert.equal(
      accepted.payload.results.some((item) =>
        item.routeId === "cooled-alert-route" &&
        item.status === "send_alert"
      ),
      true,
    );
  } finally {
    setAlertRouteScorerForTests(null);
    setAlertStorageForTests(null);
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
  }
});

test("Expo push delivery persists tickets only when delivery gate is enabled", async () => {
  const originalToken = process.env.ALERTS_WRITE_TOKEN;
  const originalDelivery = process.env.EXPO_PUSH_DELIVERY_ENABLED;
  const originalAllowlist = process.env.EXPO_PUSH_BETA_USER_IDS;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  process.env.EXPO_PUSH_DELIVERY_ENABLED = "1";
  process.env.EXPO_PUSH_BETA_USER_IDS = route.userId;
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  setExpoPushClientForTests({
    async sendExpoPushMessages(messages) {
      assert.equal(messages.length, 1);
      assert.equal(messages[0].to, device.expoPushToken);
      return [{ status: "ok", id: "ticket-1", to: messages[0].to }];
    },
    async fetchExpoPushReceipts(ids) {
      assert.deepEqual(ids, ["ticket-1"]);
      return { "ticket-1": { status: "ok" } };
    },
  });

  try {
    await callSavedRoutes("POST", {}, route, { authorization: "Bearer alert-token" });
    const evaluated = await callAlerts("POST", { action: "evaluate" }, {
      route,
      devices: [device],
      notificationPermission: "granted",
      regionCapabilities: [{ region: "NSW", capability: "live" }],
      candidate: freshCandidate(),
    }, { authorization: "Bearer alert-token" });
    const receipts = await callHandler(internalJobsHandler, {
      method: "POST",
      query: { job: "check-push-receipts" },
      body: {},
      headers: { authorization: "Bearer alert-token" },
    });

    assert.equal(evaluated.status, 202);
    assert.equal(evaluated.payload.deliveryStatus, "sent_to_expo");
    assert.equal(evaluated.payload.evaluation.pushDeliveryEnabled, true);
    assert.equal(evaluated.payload.evaluation.pushTicketId, "ticket-1");
    assert.equal(store.evaluations[0].pushTicketId, "ticket-1");
    assert.equal(store.routes[0].lastAlertSentAt, evaluated.payload.evaluation.evaluatedAt);
    assert.equal(receipts.status, 202);
    assert.equal(receipts.payload.checkedCount, 1);
    assert.equal(receipts.payload.updatedCount, 1);
    assert.equal(store.evaluations[0].pushReceiptStatus, "ok");
  } finally {
    setAlertStorageForTests(null);
    setExpoPushClientForTests(null);
    if (originalToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalToken;
    if (originalDelivery === undefined) delete process.env.EXPO_PUSH_DELIVERY_ENABLED;
    else process.env.EXPO_PUSH_DELIVERY_ENABLED = originalDelivery;
    if (originalAllowlist === undefined) delete process.env.EXPO_PUSH_BETA_USER_IDS;
    else process.env.EXPO_PUSH_BETA_USER_IDS = originalAllowlist;
  }
});

test("validation delivery sends to one stored device without enabling global push", async () => {
  const originalToken = process.env.ALERTS_WRITE_TOKEN;
  const originalValidation = process.env.EXPO_PUSH_VALIDATION_ENABLED;
  const originalDelivery = process.env.EXPO_PUSH_DELIVERY_ENABLED;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  process.env.EXPO_PUSH_VALIDATION_ENABLED = "1";
  delete process.env.EXPO_PUSH_DELIVERY_ENABLED;
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  let sentMessages = [];
  setExpoPushClientForTests({
    async sendExpoPushMessages(messages) {
      sentMessages = messages;
      return [{ status: "ok", id: "validation-ticket", to: messages[0].to }];
    },
  });

  try {
    const headers = { authorization: "Bearer alert-token" };
    await callSavedRoutes("POST", {}, route, headers);
    await callPushRegister(device, headers);
    const denied = await callAlerts("POST", { action: "validation-delivery" }, {
      routeId: route.id,
      userId: route.userId,
      deviceId: device.deviceId,
    });
    const accepted = await callAlerts("POST", { action: "validation-delivery" }, {
      routeId: route.id,
      userId: route.userId,
      deviceId: device.deviceId,
    }, headers);

    assert.equal(denied.status, 401);
    assert.equal(accepted.status, 202);
    assert.equal(accepted.payload.deliveryStatus, "sent_to_expo");
    assert.equal(accepted.payload.ticketAccepted, true);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, device.expoPushToken);
    assert.equal(store.routes[0].lastAlertSentAt, undefined);
    assert.equal(process.env.EXPO_PUSH_DELIVERY_ENABLED, undefined);
  } finally {
    setAlertStorageForTests(null);
    setExpoPushClientForTests(null);
    if (originalToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalToken;
    if (originalValidation === undefined) delete process.env.EXPO_PUSH_VALIDATION_ENABLED;
    else process.env.EXPO_PUSH_VALIDATION_ENABLED = originalValidation;
    if (originalDelivery === undefined) delete process.env.EXPO_PUSH_DELIVERY_ENABLED;
    else process.env.EXPO_PUSH_DELIVERY_ENABLED = originalDelivery;
  }
});

test("validation delivery refuses automatic selection unless exactly one route and device are active", async () => {
  const originalToken = process.env.ALERTS_WRITE_TOKEN;
  const originalValidation = process.env.EXPO_PUSH_VALIDATION_ENABLED;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  process.env.EXPO_PUSH_VALIDATION_ENABLED = "1";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);
  let sentCount = 0;
  setExpoPushClientForTests({
    async sendExpoPushMessages(messages) {
      sentCount += messages.length;
      return messages.map((message, index) => ({ status: "ok", id: `validation-${index}`, to: message.to }));
    },
  });

  try {
    const headers = { authorization: "Bearer alert-token" };
    await callSavedRoutes("POST", {}, route, headers);
    await callPushRegister(device, headers);
    const selected = await callAlerts("POST", { action: "validation-delivery" }, {}, headers);
    assert.equal(selected.status, 202);
    assert.equal(selected.payload.deliveryStatus, "sent_to_expo");
    assert.equal(sentCount, 1);

    await callSavedRoutes("POST", {}, { ...route, id: "route-second" }, headers);
    const ambiguous = await callAlerts("POST", { action: "validation-delivery" }, {}, headers);
    assert.equal(ambiguous.status, 409);
    assert.equal(ambiguous.payload.deliveryStatus, "validation_target_ambiguous");
    assert.equal(sentCount, 1);
  } finally {
    setAlertStorageForTests(null);
    setExpoPushClientForTests(null);
    if (originalToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalToken;
    if (originalValidation === undefined) delete process.env.EXPO_PUSH_VALIDATION_ENABLED;
    else process.env.EXPO_PUSH_VALIDATION_ENABLED = originalValidation;
  }
});

test("scheduled evaluator is idempotent across cron overlap and retry", async () => {
  const originalCron = process.env.CRON_SECRET;
  const originalDelivery = process.env.EXPO_PUSH_DELIVERY_ENABLED;
  const originalAllowlist = process.env.EXPO_PUSH_BETA_USER_IDS;
  process.env.CRON_SECRET = "cron-token";
  process.env.EXPO_PUSH_DELIVERY_ENABLED = "1";
  process.env.EXPO_PUSH_BETA_USER_IDS = route.userId;
  const store = memoryDurableStore();
  let sendCount = 0;
  setAlertStorageForTests(store);
  setAlertRouteScorerForTests(async () => ({
    status: "scored",
    regionCapabilities: [{ region: "NSW", capability: "live" }],
    candidate: freshCandidate({ estimatedSavingDollars: 9, detourMinutes: 3, freshnessMinutes: 15 }),
  }));
  setExpoPushClientForTests({
    async sendExpoPushMessages(messages) {
      sendCount += 1;
      assert.equal(messages.length, 1);
      return [{ status: "ok", id: `ticket-${sendCount}`, to: messages[0].to }];
    },
  });

  try {
    await store.upsertSavedRoute(route);
    await store.upsertPushDevice(device);

    const first = await callHandler(cronEvaluateHandler, {
      method: "GET",
      query: { ignoreWindow: "1", now: "2026-06-17T07:25:00.000+10:00" },
      headers: { authorization: "Bearer cron-token" },
    });
    const retry = await callHandler(cronEvaluateHandler, {
      method: "GET",
      query: { ignoreWindow: "1", now: "2026-06-17T07:26:00.000+10:00" },
      headers: { authorization: "Bearer cron-token" },
    });
    const later = await callHandler(cronEvaluateHandler, {
      method: "GET",
      query: { ignoreWindow: "1", now: "2026-06-17T07:41:00.000+10:00" },
      headers: { authorization: "Bearer cron-token" },
    });

    assert.equal(first.status, 202);
    assert.equal(retry.status, 202);
    assert.equal(later.status, 202);
    assert.equal(first.payload.results[0].idempotencyStatus, "recorded");
    assert.equal(retry.payload.results[0].idempotencyStatus, "already_recorded");
    assert.equal(retry.payload.results[0].deliveryStatus, "skipped_duplicate_evaluation");
    assert.equal(later.payload.results[0].idempotencyStatus, "recorded");
    assert.equal(later.payload.results[0].status, "quiet_today");
    assert.equal(store.evaluations.length, 2);
    assert.equal(sendCount, 1);
    assert.equal(store.evaluations[0].pushTicketId, "ticket-1");
  } finally {
    setAlertRouteScorerForTests(null);
    setAlertStorageForTests(null);
    setExpoPushClientForTests(null);
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
    if (originalDelivery === undefined) delete process.env.EXPO_PUSH_DELIVERY_ENABLED;
    else process.env.EXPO_PUSH_DELIVERY_ENABLED = originalDelivery;
    if (originalAllowlist === undefined) delete process.env.EXPO_PUSH_BETA_USER_IDS;
    else process.env.EXPO_PUSH_BETA_USER_IDS = originalAllowlist;
  }
});

test("internal evaluator accepts write token without exposing public cron access", async () => {
  const originalToken = process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);

  try {
    await store.upsertSavedRoute(route);
    const rejected = await callHandler(internalJobsHandler, {
      method: "POST",
      query: { job: "evaluate-route-alerts" },
      body: {},
      headers: {},
    });
    const accepted = await callHandler(internalJobsHandler, {
      method: "POST",
      query: { job: "evaluate-route-alerts", ignoreWindow: "1" },
      body: {},
      headers: { authorization: "Bearer alert-token" },
    });

    assert.equal(rejected.status, 401);
    assert.equal(accepted.status, 202);
    assert.equal(accepted.payload.evaluatedCount, 1);
    assert.equal(accepted.payload.results[0].status, "permission_missing");
  } finally {
    setAlertStorageForTests(null);
    if (originalToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalToken;
  }
});

test("retention cleanup job purges expired backend records only", async () => {
  const originalToken = process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  const store = memoryDurableStore();
  const predictionStore = memoryPredictionStore();
  setAlertStorageForTests(store);
  setPredictionStorageForTests(predictionStore);
  const now = "2026-06-19T00:00:00.000Z";

  try {
    await store.upsertPushDevice({
      ...device,
      id: "device-old-invalid",
      status: "invalid",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      invalidatedAt: "2026-01-02T00:00:00.000Z",
    });
    await store.upsertPushDevice({
      ...device,
      id: "device-recent-invalid",
      status: "invalid",
      lastSeenAt: "2026-06-01T00:00:00.000Z",
      invalidatedAt: "2026-06-02T00:00:00.000Z",
    });
    await store.upsertPushDevice({
      ...device,
      id: "device-old-active",
      status: "active",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
    });
    await store.upsertSavedRoute({
      ...route,
      id: "route-old-disabled",
      alertEnabled: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await store.upsertSavedRoute({
      ...route,
      id: "route-recent-disabled",
      alertEnabled: false,
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    await store.upsertSavedRoute({
      ...route,
      id: "route-old-enabled",
      alertEnabled: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await store.appendRouteAlertEvaluation({
      id: "eval-old",
      routeId: "route-old-disabled",
      userId: route.userId,
      status: "permission_missing",
      reason: "test",
      evaluatedAt: "2025-01-01T00:00:00.000Z",
      pushDeliveryEnabled: false,
    });
    await store.appendRouteAlertEvaluation({
      id: "eval-recent",
      routeId: "route-recent-disabled",
      userId: route.userId,
      status: "permission_missing",
      reason: "test",
      evaluatedAt: "2026-06-01T00:00:00.000Z",
      pushDeliveryEnabled: false,
    });
    await predictionStore.append({
      id: "prediction-old",
      region: "WA",
      fuel: "U91",
      targetDate: "2024-01-02",
      predictionDate: "2024-01-01",
      modelVersion: "test",
      predictedDirection: "unknown",
      actualDirection: "unknown",
      recordedAt: "2024-01-01T00:00:00.000Z",
    });
    await predictionStore.append({
      id: "prediction-recent",
      region: "WA",
      fuel: "U91",
      targetDate: "2026-06-02",
      predictionDate: "2026-06-01",
      modelVersion: "test",
      predictedDirection: "unknown",
      actualDirection: "unknown",
      recordedAt: "2026-06-01T00:00:00.000Z",
    });

    const rejected = await callHandler(internalJobsHandler, {
      method: "POST",
      query: { job: "retention-cleanup" },
      body: {},
      headers: {},
    });
    const dryRun = await callHandler(internalJobsHandler, {
      method: "POST",
      query: { job: "retention-cleanup", dryRun: "1", now },
      body: {},
      headers: { authorization: "Bearer alert-token" },
    });

    assert.equal(rejected.status, 401);
    assert.equal(dryRun.status, 202);
    assert.equal(dryRun.payload.dryRun, true);
    assert.equal(dryRun.payload.alerts.deletedDeviceCount, 1);
    assert.equal(dryRun.payload.alerts.deletedRouteCount, 1);
    assert.equal(dryRun.payload.alerts.deletedEvaluationCount, 1);
    assert.equal(dryRun.payload.predictions.deletedCount, 1);
    assert.equal(store.devices.some((item) => item.id === "device-old-invalid"), true);
    assert.equal(predictionStore.records.some((item) => item.id === "prediction-old"), true);

    const cleaned = await callHandler(internalJobsHandler, {
      method: "POST",
      query: { job: "retention-cleanup", now },
      body: {},
      headers: { authorization: "Bearer alert-token" },
    });

    assert.equal(cleaned.status, 202);
    assert.equal(cleaned.payload.dryRun, false);
    assert.equal(store.devices.some((item) => item.id === "device-old-invalid"), false);
    assert.equal(store.devices.some((item) => item.id === "device-recent-invalid"), true);
    assert.equal(store.devices.some((item) => item.id === "device-old-active"), true);
    assert.equal(store.routes.some((item) => item.id === "route-old-disabled"), false);
    assert.equal(store.routes.some((item) => item.id === "route-recent-disabled"), true);
    assert.equal(store.routes.some((item) => item.id === "route-old-enabled"), true);
    assert.equal(store.evaluations.some((item) => item.id === "eval-old"), false);
    assert.equal(store.evaluations.some((item) => item.id === "eval-recent"), true);
    assert.equal(predictionStore.records.some((item) => item.id === "prediction-old"), false);
    assert.equal(predictionStore.records.some((item) => item.id === "prediction-recent"), true);
  } finally {
    setAlertStorageForTests(null);
    setPredictionStorageForTests(null);
    if (originalToken === undefined) delete process.env.ALERTS_WRITE_TOKEN;
    else process.env.ALERTS_WRITE_TOKEN = originalToken;
  }
});

function freshCandidate(overrides = {}) {
  return {
    stationCode: "station-1",
    stationName: "Taren Point Fuel",
    estimatedSavingDollars: 8,
    detourMinutes: 4,
    freshnessMinutes: 30,
    openNow: true,
    ...overrides,
  };
}

function anonymousInstallation(seed = "a") {
  return {
    installationId: `installation_${seed.repeat(32)}`,
    installationSecret: `secret_${seed.repeat(48)}`,
  };
}

function memoryDurableStore() {
  const devices = [];
  const routes = [];
  const evaluations = [];
  const store = {
    devices,
    routes,
    evaluations,
    status({ maxRecords }) {
      return {
        mode: "postgres_neon",
        configured: true,
        durable: true,
        maxRecords,
        deviceCount: devices.length,
        routeCount: routes.length,
        evaluationCount: evaluations.length,
      };
    },
    async counts() {
      return { deviceCount: devices.length, routeCount: routes.length, evaluationCount: evaluations.length };
    },
    async upsertPushDevice(record) {
      for (const item of devices) {
        if (item.id !== record.id && item.expoPushToken === record.expoPushToken && item.status === "active") {
          item.status = "inactive";
          item.invalidatedAt = record.lastSeenAt;
        }
      }
      upsert(devices, record);
      return record;
    },
    async upsertSavedRoute(record) {
      const index = routes.findIndex((item) => item.id === record.id && item.userId === record.userId);
      if (index >= 0) routes[index] = record;
      else routes.push(record);
      return record;
    },
    async enrolPushDeviceAndSavedRoute({ device, route }) {
      const deviceSnapshot = devices.map((record) => ({ ...record }));
      const routeSnapshot = routes.map((record) => ({ ...record }));
      try {
        await store.upsertPushDevice(device);
        await store.upsertSavedRoute(route);
        return { device, route };
      } catch (error) {
        devices.splice(0, devices.length, ...deviceSnapshot);
        routes.splice(0, routes.length, ...routeSnapshot);
        throw error;
      }
    },
    async deleteSavedRoute({ routeId, userId = "" }) {
      const index = routes.findIndex((item) => item.id === routeId && (!userId || item.userId === userId));
      if (index < 0) return null;
      const [deleted] = routes.splice(index, 1);
      return deleted || null;
    },
    async appendRouteAlertEvaluation(record) {
      const existing = evaluations.find((item) => item.id === record.id);
      if (existing) return { ...existing, _alreadyRecorded: true };
      evaluations.push(record);
      return record;
    },
    async listPushDevices({ userId = "", status = "" } = {}) {
      return devices.filter((item) =>
        (!userId || item.userId === userId)
        && (!status || item.status === status || (!item.status && status === "active"))
      );
    },
    async listSavedRoutes({ userId = "", enabledOnly = false } = {}) {
      return routes.filter((item) => (!userId || item.userId === userId) && (!enabledOnly || item.alertEnabled));
    },
    async listRouteAlertEvaluations({ routeId = "", userId = "" } = {}) {
      return evaluations.filter((item) => (!routeId || item.routeId === routeId) && (!userId || item.userId === userId));
    },
    async listPendingPushTicketEvaluations() {
      return evaluations.filter((record) => record.pushTicketId && !record.pushReceiptStatus);
    },
    async updateRouteAlertDelivery({ evaluationId, pushTicketId = "", pushReceiptStatus = "" }) {
      const record = evaluations.find((item) => item.id === evaluationId);
      if (record) {
        if (pushTicketId) record.pushTicketId = pushTicketId;
        if (pushReceiptStatus) record.pushReceiptStatus = pushReceiptStatus;
      }
      return record || null;
    },
    async updateSavedRouteLastAlert(routeId, sentAt, userId = "") {
      const record = routes.find((item) => item.id === routeId && (!userId || item.userId === userId));
      if (record) record.lastAlertSentAt = sentAt;
      return record || null;
    },
    async updatePushDeviceStatus({ deviceId, status, invalidatedAt }) {
      const record = devices.find((item) => item.id === deviceId || item.expoPushToken === deviceId);
      if (record) {
        record.status = status;
        record.invalidatedAt = invalidatedAt;
      }
      return record || null;
    },
    async purgeAlertRetention({ now, dryRun, inactiveDeviceDays, disabledRouteDays, evaluationDays }) {
      const deviceCutoff = daysBefore(now, inactiveDeviceDays);
      const routeCutoff = daysBefore(now, disabledRouteDays);
      const evaluationCutoff = daysBefore(now, evaluationDays);
      const staleDevice = (record) => record.status !== "active" && olderThan(record.invalidatedAt || record.lastSeenAt, deviceCutoff);
      const staleRoute = (record) => record.alertEnabled === false && olderThan(record.updatedAt, routeCutoff);
      const staleEvaluation = (record) => olderThan(record.evaluatedAt, evaluationCutoff);
      const deletedDeviceCount = devices.filter(staleDevice).length;
      const deletedRouteCount = routes.filter(staleRoute).length;
      const deletedEvaluationCount = evaluations.filter(staleEvaluation).length;
      if (!dryRun) {
        removeWhere(devices, staleDevice);
        removeWhere(routes, staleRoute);
        removeWhere(evaluations, staleEvaluation);
      }
      return {
        dryRun,
        inactiveDeviceCutoff: deviceCutoff,
        disabledRouteCutoff: routeCutoff,
        evaluationCutoff,
        deletedDeviceCount,
        deletedRouteCount,
        deletedEvaluationCount,
      };
    },
  };
  return store;
}

function memoryPredictionStore() {
  const records = [];
  return {
    records,
    status({ maxRecords }) {
      return {
        mode: "postgres_neon",
        configured: true,
        durable: true,
        maxRecords,
        recordCount: records.length,
        table: "fuel_path_prediction_backtests",
      };
    },
    async append(record) {
      upsert(records, record);
      return record;
    },
    async list({ region = "", fuel = "", limit = 50 } = {}) {
      return records
        .filter((record) => (!region || record.region === region) && (!fuel || record.fuel === fuel))
        .slice(-limit)
        .reverse();
    },
    async purgePredictionBacktests({ now, dryRun, olderThanDays }) {
      const cutoff = daysBefore(now, olderThanDays);
      const staleRecord = (record) => olderThan(record.recordedAt, cutoff);
      const deletedCount = records.filter(staleRecord).length;
      if (!dryRun) removeWhere(records, staleRecord);
      return { dryRun, cutoff, deletedCount };
    },
  };
}

function upsert(records, record) {
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.push(record);
}

function daysBefore(now, days) {
  return new Date(new Date(now).getTime() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
}

function olderThan(value, cutoff) {
  return new Date(value).getTime() < new Date(cutoff).getTime();
}

function removeWhere(records, predicate) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (predicate(records[index])) records.splice(index, 1);
  }
}

function callStatus() {
  return callHandler(statusHandler, { method: "GET", query: {}, headers: {} });
}

function callAlerts(method, query = {}, body, headers = {}) {
  return callHandler(alertsHandler, { method, query, body, headers });
}

function callSavedRoutes(method, query = {}, body, headers = {}) {
  return callHandler(alertsHandler, { method, query: { ...query, __endpoint: "saved-routes" }, body, headers });
}

function callPushRegister(body, headers = {}) {
  return callHandler(pushRegisterHandler, { method: "POST", query: {}, body, headers });
}

function callHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, payload });
      },
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}
