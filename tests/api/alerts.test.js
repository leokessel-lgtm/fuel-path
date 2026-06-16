const assert = require("node:assert/strict");
const test = require("node:test");

const alertsHandler = require("../../api/alerts");
const pushRegisterHandler = require("../../api/push/register");
const savedRoutesHandler = require("../../api/saved-routes");
const statusHandler = require("../../api/status");
const { setAlertStorageForTests } = require("../../api/_backend");

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
  return {
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
      devices.push(record);
      return record;
    },
    async upsertSavedRoute(record) {
      routes.push(record);
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
  };
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
