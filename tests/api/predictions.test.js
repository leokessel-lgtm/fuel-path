const assert = require("node:assert/strict");
const test = require("node:test");

const predictionsHandler = require("../../api/predictions");
const statusHandler = require("../../api/status");
const { setPredictionStorageForTests } = require("../../api/_backend");

test("prediction status exposes measurement foundation without enabling claims", async () => {
  const response = await callStatus();

  assert.equal(response.status, 200);
  assert.equal(response.payload.predictions.mode, "measurement_foundation");
  assert.equal(response.payload.predictions.userFacingPredictionEnabled, false);
  assert.equal(response.payload.predictions.accuracyClaimsAllowed, false);
  assert.equal(response.payload.predictions.storage.durable, false);
  assert.equal(response.payload.predictions.storage.health, "ok");
  assert.equal(response.payload.predictions.writeSecurity.tokenRequired, false);
  assert.ok(response.payload.predictions.readiness.blindSpots.includes("Current storage is not durable enough for public accuracy claims."));
  assert.ok(
    response.payload.predictions.readiness.blindSpots.some((item) =>
      item.includes("Mean absolute error is not measurable"),
    ),
  );
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
    assert.ok(response.payload.readiness.blindSpots.length > 0);
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

test("prediction storage can run against a durable adapter contract", async () => {
  const original = process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
  process.env.PREDICTION_BACKTEST_WRITE_TOKEN = "durable-token";
  const records = [];
  setPredictionStorageForTests({
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
      records.push(record);
      return record;
    },
    async list({ region = "", fuel = "", limit = 50 } = {}) {
      return records
        .filter((record) => (!region || record.region === region) && (!fuel || record.fuel === fuel))
        .slice(-limit)
        .reverse();
    },
  });

  try {
    const created = await postPredictions({
      region: "QLD",
      fuel: "P95",
      predictionDate: "2026-06-17",
      targetDate: "2026-06-18",
      modelVersion: "durable-contract-test",
      predictedCpl: 181,
      actualCpl: 179,
    }, { authorization: "Bearer durable-token" });
    const listed = await callPredictions({ mode: "backtests", region: "QLD", fuel: "P95" });
    const status = await callStatus();

    assert.equal(created.status, 202);
    assert.equal(created.payload.storage.mode, "postgres_neon");
    assert.equal(created.payload.storage.durable, true);
    assert.equal(listed.payload.records.length, 1);
    assert.equal(listed.payload.summary.meanAbsoluteErrorCpl, 2);
    assert.equal(status.payload.predictions.storage.mode, "postgres_neon");
    assert.equal(status.payload.predictions.storage.durable, true);
    assert.equal(status.payload.predictions.writeSecurity.tokenRequired, true);
    assert.equal(status.payload.predictions.writeSecurity.writeEnabled, true);
    assert.equal(status.payload.predictions.accuracyClaimsAllowed, false);
  } finally {
    setPredictionStorageForTests(null);
    if (original === undefined) delete process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
    else process.env.PREDICTION_BACKTEST_WRITE_TOKEN = original;
  }
});

test("prediction readiness allows accuracy claims only after durable measured evidence thresholds", async () => {
  const original = process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
  process.env.PREDICTION_BACKTEST_WRITE_TOKEN = "durable-token";
  const records = Array.from({ length: 60 }, (_, index) => ({
    id: `ready-${index}`,
    region: "WA",
    fuel: "U91",
    predictionDate: "2026-06-01",
    targetDate: `2026-06-${String((index % 28) + 1).padStart(2, "0")}`,
    modelVersion: "measured-ready-test",
    predictedCpl: 170,
    actualCpl: 172,
    absoluteErrorCpl: 2,
    predictedDirection: index < 50 ? "up" : "down",
    actualDirection: "up",
    directionMatched: index < 50,
    recordedAt: "2026-06-30T00:00:00.000Z",
  }));
  setPredictionStorageForTests({
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
      records.push(record);
      return record;
    },
    async list({ region = "", fuel = "", limit = 50 } = {}) {
      return records
        .filter((record) => (!region || record.region === region) && (!fuel || record.fuel === fuel))
        .slice(-limit)
        .reverse();
    },
  });

  try {
    const status = await callStatus();
    const listed = await callPredictions({ mode: "backtests", region: "WA", fuel: "U91", limit: 60 });

    assert.equal(status.payload.predictions.readiness.status, "ready_for_limited_cycle_guidance");
    assert.equal(status.payload.predictions.accuracyClaimsAllowed, true);
    assert.equal(status.payload.predictions.userFacingPredictionEnabled, false);
    assert.deepEqual(status.payload.predictions.readiness.blockers, []);
    assert.ok(
      status.payload.predictions.readiness.blindSpots.includes(
        "WA tomorrow locked prices are official source data, not model prediction, and should be labelled separately.",
      ),
    );
    assert.ok(
      status.payload.predictions.readiness.blindSpots.some((item) =>
        item.includes("No completed back-test coverage yet for NSW"),
      ),
    );
    assert.equal(listed.payload.summary.completedSampleSize, 60);
  } finally {
    setPredictionStorageForTests(null);
    if (original === undefined) delete process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
    else process.env.PREDICTION_BACKTEST_WRITE_TOKEN = original;
  }
});

test("prediction back-test writes require a configured token", async () => {
  const original = process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
  process.env.PREDICTION_BACKTEST_WRITE_TOKEN = "secret-token";

  try {
    const rejected = await postPredictions({
      region: "WA",
      fuel: "U91",
      targetDate: "2026-06-18",
    });
    const accepted = await postPredictions(
      {
        region: "WA",
        fuel: "U91",
        targetDate: "2026-06-19",
      },
      { authorization: "Bearer secret-token" },
    );

    assert.equal(rejected.status, 401);
    assert.match(rejected.payload.error, /valid token/);
    assert.equal(rejected.payload.predictions.writeSecurity.tokenRequired, true);
    assert.equal(accepted.status, 202);
  } finally {
    if (original === undefined) delete process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
    else process.env.PREDICTION_BACKTEST_WRITE_TOKEN = original;
  }
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

function postPredictions(body, headers = {}) {
  return callHandler(predictionsHandler, { method: "POST", query: {}, body, headers });
}

function callStatus() {
  return callHandler(statusHandler, { method: "GET", query: {} });
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
