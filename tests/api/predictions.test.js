const assert = require("node:assert/strict");
const test = require("node:test");

const predictionsHandler = require("../../api/predictions");
const statusHandler = require("../../api/status");

test("prediction status exposes measurement foundation without enabling claims", async () => {
  const response = await callStatus();

  assert.equal(response.status, 200);
  assert.equal(response.payload.predictions.mode, "measurement_foundation");
  assert.equal(response.payload.predictions.userFacingPredictionEnabled, false);
  assert.equal(response.payload.predictions.accuracyClaimsAllowed, false);
  assert.equal(response.payload.predictions.storage.durable, false);
});

test("prediction signal returns no-cycle-signal for unsupported and sparse cases", async () => {
  const unsupportedRegion = await callPredictions({
    mode: "signal",
    region: "FR",
    fuel: "U91",
    historyDays: 90,
    observedPriceCount: 300,
  });
  const unsupportedFuel = await callPredictions({
    mode: "signal",
    region: "WA",
    fuel: "EV",
    historyDays: 90,
    observedPriceCount: 300,
  });
  const sparseHistory = await callPredictions({
    mode: "signal",
    region: "WA",
    fuel: "U91",
    historyDays: 7,
    observedPriceCount: 10,
  });

  for (const response of [unsupportedRegion, unsupportedFuel, sparseHistory]) {
    assert.equal(response.status, 200);
    assert.equal(response.payload.signal, "no_cycle_signal");
    assert.equal(response.payload.userFacingPredictionEnabled, false);
    assert.equal(response.payload.accuracyClaimsAllowed, false);
    assert.doesNotMatch(JSON.stringify(response.payload), /predicts|accurate/i);
  }
});

test("prediction signal requires back-testing even after history threshold", async () => {
  const response = await callPredictions({
    mode: "signal",
    region: "WA",
    fuel: "U91",
    historyDays: 90,
    observedPriceCount: 300,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.signal, "backtest_required");
  assert.equal(response.payload.userFacingPredictionEnabled, false);
  assert.equal(response.payload.accuracyClaimsAllowed, false);
});

test("prediction back-test records produce measurement summary", async () => {
  const first = await postPredictions({
    region: "WA",
    fuel: "U91",
    predictionDate: "2026-06-17",
    targetDate: "2026-06-18",
    modelVersion: "test-cycle-v1",
    predictedCpl: 170.0,
    actualCpl: 166.5,
    predictedDirection: "up",
    actualDirection: "up",
  });
  const second = await postPredictions({
    region: "WA",
    fuel: "U91",
    predictionDate: "2026-06-18",
    targetDate: "2026-06-19",
    modelVersion: "test-cycle-v1",
    predictedCpl: 165.0,
    actualCpl: 168.0,
    predictedDirection: "down",
    actualDirection: "up",
  });
  const list = await callPredictions({ mode: "backtests", region: "WA", fuel: "U91", limit: 10 });

  assert.equal(first.status, 202);
  assert.equal(first.payload.record.absoluteErrorCpl, 3.5);
  assert.equal(second.status, 202);
  assert.equal(list.status, 200);
  assert.ok(list.payload.records.length >= 2);
  assert.equal(list.payload.summary.completedSampleSize >= 2, true);
  assert.equal(typeof list.payload.summary.meanAbsoluteErrorCpl, "number");
  assert.equal(list.payload.summary.accuracyClaimsAllowed, false);
});

test("prediction back-test rejects unsupported payloads", async () => {
  const response = await postPredictions({
    region: "WA",
    fuel: "EV",
    targetDate: "2026-06-18",
  });

  assert.equal(response.status, 400);
  assert.match(response.payload.error, /fuel is not supported/);
  assert.equal(response.payload.predictions.accuracyClaimsAllowed, false);
});

function callPredictions(query) {
  return callHandler(predictionsHandler, { method: "GET", query });
}

function postPredictions(body) {
  return callHandler(predictionsHandler, { method: "POST", query: {}, body });
}

function callStatus() {
  return callHandler(statusHandler, { method: "GET", query: {} });
}

function callHandler(handler, req) {
  return new Promise((resolve) => {
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

    handler(req, res);
  });
}
