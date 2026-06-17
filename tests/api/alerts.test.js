const assert = require("node:assert/strict");
const test = require("node:test");

const alertsHandler = require("../../api/alerts");
const cronEvaluateHandler = require("../../api/cron/evaluate-route-alerts");
const internalEvaluateHandler = require("../../api/internal/jobs/evaluate-route-alerts");
const internalReceiptsHandler = require("../../api/internal/jobs/check-push-receipts");
const pushRegisterHandler = require("../../api/push/register");
const savedRoutesHandler = require("../../api/saved-routes");
const statusHandler = require("../../api/status");
const { setAlertRouteScorerForTests, setAlertStorageForTests } = require("../../api/_backend");
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
  assert.equal(response.payload.alerts.storage.durable, false);
  assert.equal(response.payload.alerts.writeSecurity.tokenRequired, false);
});

test("saved-route alert foundation stores route, device and sendable evaluation", async () => {
  const saved = await callSavedRoutes("POST", {}, route);
  const registered = await callPushRegister(device);
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
  });
  const routes = await callSavedRoutes("GET", { userId: "user-test" });
  const evaluations = await callAlerts("GET", { mode: "evaluations", routeId: route.id });

  assert.equal(saved.status, 202);
  assert.equal(saved.payload.route.alertEnabled, true);
  assert.equal(registered.status, 202);
  assert.equal(evaluated.status, 202);
  assert.equal(evaluated.payload.evaluation.status, "send_alert");
  assert.equal(evaluated.payload.deliveryStatus, "not_sent_push_provider_disabled");
  assert.equal(evaluated.payload.evaluation.pushDeliveryEnabled, false);
  assert.equal(routes.payload.routes.some((item) => item.id === route.id), true);
  assert.equal(evaluations.payload.evaluations.some((item) => item.routeId === route.id), true);
});

test("alert evaluator blocks noisy or unsafe unhappy paths", async () => {
  const cases = [
    {
      name: "missing permission",
      input: { notificationPermission: "denied", devices: [device], candidate: freshCandidate() },
      expected: "permission_missing",
    },
    {
      name: "missing token",
      input: { notificationPermission: "granted", devices: [], candidate: freshCandidate() },
      expected: "missing_push_token",
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
    },
    {
      name: "stale price",
      input: { notificationPermission: "granted", devices: [device], candidate: freshCandidate({ freshnessMinutes: 240 }) },
      expected: "stale_price",
    },
    {
      name: "saving below threshold",
      input: { notificationPermission: "granted", devices: [device], candidate: freshCandidate({ estimatedSavingDollars: 2 }) },
      expected: "saving_below_threshold",
    },
    {
      name: "detour above threshold",
      input: { notificationPermission: "granted", devices: [device], candidate: freshCandidate({ detourMinutes: 20 }) },
      expected: "detour_above_threshold",
    },
  ];

  for (const item of cases) {
    const response = await callAlerts("POST", { action: "evaluate" }, {
      route,
      regionCapabilities: [{ region: "NSW", capability: "live" }],
      ...item.input,
    });
    assert.equal(response.status, 202, item.name);
    assert.equal(response.payload.evaluation.status, item.expected, item.name);
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
    assert.match(rejected.payload.error, /valid token/);
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

test("Expo push delivery persists tickets only when delivery gate is enabled", async () => {
  const originalToken = process.env.ALERTS_WRITE_TOKEN;
  const originalDelivery = process.env.EXPO_PUSH_DELIVERY_ENABLED;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  process.env.EXPO_PUSH_DELIVERY_ENABLED = "1";
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
    const receipts = await callHandler(internalReceiptsHandler, {
      method: "POST",
      query: {},
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
  }
});

test("internal evaluator accepts write token without exposing public cron access", async () => {
  const originalToken = process.env.ALERTS_WRITE_TOKEN;
  process.env.ALERTS_WRITE_TOKEN = "alert-token";
  const store = memoryDurableStore();
  setAlertStorageForTests(store);

  try {
    await store.upsertSavedRoute(route);
    const rejected = await callHandler(internalEvaluateHandler, { method: "POST", query: {}, body: {}, headers: {} });
    const accepted = await callHandler(internalEvaluateHandler, {
      method: "POST",
      query: { ignoreWindow: "1" },
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
      upsert(devices, record);
      return record;
    },
    async upsertSavedRoute(record) {
      upsert(routes, record);
      return record;
    },
    async appendRouteAlertEvaluation(record) {
      evaluations.push(record);
      return record;
    },
    async listPushDevices() {
      return devices;
    },
    async listSavedRoutes() {
      return routes;
    },
    async listRouteAlertEvaluations() {
      return evaluations;
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
    async updateSavedRouteLastAlert(routeId, sentAt) {
      const record = routes.find((item) => item.id === routeId);
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
  };
  return store;
}

function upsert(records, record) {
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.push(record);
}

function callStatus() {
  return callHandler(statusHandler, { method: "GET", query: {}, headers: {} });
}

function callAlerts(method, query = {}, body, headers = {}) {
  return callHandler(alertsHandler, { method, query, body, headers });
}

function callSavedRoutes(method, query = {}, body, headers = {}) {
  return callHandler(savedRoutesHandler, { method, query, body, headers });
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
