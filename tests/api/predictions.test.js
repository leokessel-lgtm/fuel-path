const assert = require("node:assert/strict");
const test = require("node:test");

const predictionsHandler = require("../../api/predictions");
const cronCollectPredictionsHandler = require("../../api/cron/collect-predictions");
const statusHandler = require("../../api/status");
const {
  recordPredictionMarketObservation,
  runPredictionMarketBacktestJob,
  setPredictionStorageForTests,
} = require("../../api/_backend");

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
    market: "Perth",
    fuel: "U91",
    historyDays: 90,
    observedPriceCount: 300,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.signal, "backtest_required");
  assert.equal(response.payload.market.timingScope, "supported_petrol_cycle_market");
  assert.equal(response.payload.market.marketLabel, "Perth/Mandurah");
  assert.equal(response.payload.userFacingPredictionEnabled, false);
  assert.equal(response.payload.accuracyClaimsAllowed, false);
});

test("prediction signal limits cycle guidance to supported Australian petrol markets", async () => {
  const regionalNsw = await callPredictions({
    mode: "signal",
    region: "NSW",
    market: "Dubbo",
    fuel: "U91",
    historyDays: 90,
    observedPriceCount: 300,
  });
  const canberra = await callPredictions({
    mode: "signal",
    region: "ACT",
    market: "Canberra",
    fuel: "U91",
    historyDays: 90,
    observedPriceCount: 300,
  });
  const sydneyDiesel = await callPredictions({
    mode: "signal",
    region: "NSW",
    market: "Sydney",
    fuel: "PDL",
    historyDays: 90,
    observedPriceCount: 300,
  });
  const stateOnly = await callPredictions({
    mode: "signal",
    region: "NSW",
    fuel: "U91",
    historyDays: 90,
    observedPriceCount: 300,
  });

  for (const response of [regionalNsw, canberra, sydneyDiesel, stateOnly]) {
    assert.equal(response.status, 200);
    assert.equal(response.payload.signal, "no_cycle_signal");
    assert.equal(response.payload.market.cycleSupported, false);
    assert.equal(response.payload.userFacingPredictionEnabled, false);
    assert.equal(response.payload.accuracyClaimsAllowed, false);
  }

  assert.equal(regionalNsw.payload.market.timingScope, "local_trend_only");
  assert.equal(canberra.payload.market.timingScope, "local_trend_only");
  assert.equal(sydneyDiesel.payload.market.reason, "diesel_or_lpg_trend_only");
  assert.equal(stateOnly.payload.market.reason, "unsupported_cycle_market");
});

test("prediction back-test records produce measurement summary", async () => {
  const first = await postPredictions({
    region: "WA",
    market: "Perth",
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
    market: "Perth",
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
  assert.equal(first.payload.record.market, "perth");
  assert.equal(first.payload.record.absoluteErrorCpl, 3.5);
  assert.equal(second.status, 202);
  assert.equal(list.status, 200);
  assert.ok(list.payload.records.length >= 2);
  assert.equal(list.payload.summary.completedSampleSize >= 2, true);
  assert.equal(list.payload.summary.marketScopedCompletedSampleSize >= 2, true);
  assert.equal(list.payload.summary.byMarket.perth >= 2, true);
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

test("prediction readiness still blocks claims when measured evidence is not market scoped", async () => {
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

    assert.equal(status.payload.predictions.readiness.status, "measurement_only");
    assert.equal(status.payload.predictions.accuracyClaimsAllowed, false);
    assert.equal(status.payload.predictions.userFacingPredictionEnabled, false);
    assert.deepEqual(status.payload.predictions.readiness.blockers, ["prediction_market_scope_missing"]);
    assert.ok(
      status.payload.predictions.readiness.blindSpots.includes(
        "Current back-test records are state/fuel scoped. Limited cycle guidance needs market/fuel scoped evidence before launch.",
      ),
    );
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

test("prediction readiness can clear only with durable market-scoped evidence", async () => {
  const original = process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
  process.env.PREDICTION_BACKTEST_WRITE_TOKEN = "durable-token";
  const records = Array.from({ length: 60 }, (_, index) => ({
    id: `market-ready-${index}`,
    region: "NSW",
    market: "sydney",
    fuel: "U91",
    predictionDate: "2026-06-01",
    targetDate: `2026-06-${String((index % 28) + 1).padStart(2, "0")}`,
    modelVersion: "market-scoped-ready-test",
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
    const sydneySignal = await callPredictions({
      mode: "signal",
      region: "NSW",
      market: "Sydney",
      fuel: "U91",
      historyDays: 90,
      observedPriceCount: 300,
    });
    const dubboSignal = await callPredictions({
      mode: "signal",
      region: "NSW",
      market: "Dubbo",
      fuel: "U91",
      historyDays: 90,
      observedPriceCount: 300,
    });
    const dieselSignal = await callPredictions({
      mode: "signal",
      region: "NSW",
      market: "Sydney",
      fuel: "PDL",
      historyDays: 90,
      observedPriceCount: 300,
    });

    assert.equal(status.payload.predictions.readiness.status, "ready_for_limited_cycle_guidance");
    assert.equal(status.payload.predictions.accuracyClaimsAllowed, true);
    assert.equal(status.payload.predictions.userFacingPredictionEnabled, false);
    assert.deepEqual(status.payload.predictions.readiness.blockers, []);
    assert.equal(status.payload.predictions.summary.marketScopedCompletedSampleSize, 60);
    assert.equal(status.payload.predictions.summary.byMarket.sydney, 60);
    assert.equal(sydneySignal.payload.signal, "backtest_required");
    assert.equal(sydneySignal.payload.market.cycleSupported, true);
    assert.equal(dubboSignal.payload.signal, "no_cycle_signal");
    assert.equal(dubboSignal.payload.market.cycleSupported, false);
    assert.equal(dieselSignal.payload.signal, "no_cycle_signal");
    assert.equal(dieselSignal.payload.market.reason, "diesel_or_lpg_trend_only");
  } finally {
    setPredictionStorageForTests(null);
    if (original === undefined) delete process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
    else process.env.PREDICTION_BACKTEST_WRITE_TOKEN = original;
  }
});

test("market back-test job seeds and completes market-scoped daily evidence", async () => {
  const records = [];
  const snapshots = [];
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
      const index = records.findIndex((existing) => existing.id === record.id);
      if (index >= 0) records[index] = { ...records[index], ...record };
      else records.push(record);
      return record;
    },
    async list({ region = "", fuel = "", limit = 50 } = {}) {
      return records
        .filter((record) => (!region || record.region === region) && (!fuel || record.fuel === fuel))
        .slice(-limit)
        .reverse();
    },
    async appendSnapshot(record) {
      snapshots.push(record);
      return record;
    },
    async listSnapshots() {
      return snapshots.slice().reverse();
    },
  });

  let basePrice = 155;
  const loadStationDataFn = async ({ fuels }) => ({
    provider: "test_provider",
    capability: "live",
    cacheMode: "test",
    cacheAgeSeconds: 0,
    stations: Array.from({ length: 10 }, (_, index) => ({
      id: `station-${index}`,
      prices: { [fuels[0]]: basePrice + index },
    })),
  });

  try {
    const first = await runPredictionMarketBacktestJob({
      now: "2026-07-05T08:00:00.000Z",
      limit: 1,
      loadStationDataFn,
    });
    basePrice = 159;
    const second = await runPredictionMarketBacktestJob({
      now: "2026-07-06T08:00:00.000Z",
      limit: 1,
      loadStationDataFn,
    });

    assert.equal(first.summary.seeded, 1);
    assert.equal(first.summary.snapshots, 1);
    assert.equal(first.summary.completed, 0);
    assert.equal(second.summary.seeded, 1);
    assert.equal(second.summary.completed, 1);
    assert.equal(snapshots.length, 2);
    assert.equal(records.length, 2);
    const completed = records.find((record) => record.targetDate === "2026-07-06");
    assert.ok(completed.id.startsWith("market:"));
    assert.ok(completed.region);
    assert.ok(completed.market);
    assert.ok(completed.fuel);
    assert.equal(completed.predictedCpl, 159.5);
    assert.equal(completed.actualCpl, 163.5);
    assert.equal(completed.actualDirection, "up");
    assert.equal(completed.directionMatched, false);
  } finally {
    setPredictionStorageForTests(null);
  }
});

test("market back-test job prioritises under-sampled markets using snapshot history", async () => {
  const records = [];
  const snapshots = [
    { market: "sydney", fuel: "E10", observedDate: "2026-07-05", observedAt: "2026-07-05T00:00:00.000Z" },
    { market: "sydney", fuel: "U91", observedDate: "2026-07-05", observedAt: "2026-07-05T00:00:00.000Z" },
    { market: "sydney", fuel: "P95", observedDate: "2026-07-05", observedAt: "2026-07-05T00:00:00.000Z" },
    { market: "sydney", fuel: "P98", observedDate: "2026-07-05", observedAt: "2026-07-05T00:00:00.000Z" },
  ];
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
    async list() {
      return records.slice().reverse();
    },
    async appendSnapshot(record) {
      snapshots.push(record);
      return record;
    },
    async listSnapshots() {
      return snapshots.slice().reverse();
    },
  });

  try {
    const result = await runPredictionMarketBacktestJob({
      now: "2026-07-05T08:00:00.000Z",
      limit: 2,
      loadStationDataFn: async ({ fuels }) => ({
        provider: "test_provider",
        stations: Array.from({ length: 10 }, (_, index) => ({
          id: `station-${fuels[0]}-${index}`,
          prices: { [fuels[0]]: 150 + index },
        })),
      }),
    });

    assert.equal(result.summary.snapshots, 2);
    assert.equal(result.results.some((item) => item.market !== "sydney"), true);
  } finally {
    setPredictionStorageForTests(null);
  }
});

test("NSW Sydney batching derives multiple petrol snapshots from one provider response", async () => {
  const records = [];
  const snapshots = ["melbourne", "brisbane", "adelaide", "perth"].flatMap((market) =>
    ["E10", "U91", "P95", "P98"].map((fuel) => ({
      market,
      fuel,
      observedDate: "2026-07-08",
      observedAt: "2026-07-08T00:00:00.000Z",
    })),
  );
  const calls = [];
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
    async list() {
      return records.slice().reverse();
    },
    async appendSnapshot(record) {
      snapshots.push(record);
      return record;
    },
    async listSnapshots() {
      return snapshots.slice().reverse();
    },
  });

  const loadStationDataFn = async ({ fuels }) => {
    calls.push([...fuels]);
    return {
      provider: "test_nsw",
      capability: "live",
      stations: Array.from({ length: 10 }, (_, index) => ({
        id: `sydney-${index}`,
        prices: {
          E10: 150 + index,
          U91: 152 + index,
          P95: 165 + index,
          P98: 171 + index,
        },
      })),
    };
  };

  try {
    const result = await runPredictionMarketBacktestJob({
      now: "2026-07-06T08:00:00.000Z",
      limit: 4,
      loadStationDataFn,
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].sort(), ["E10", "P95", "P98", "U91"]);
    assert.equal(result.results.length, 4);
    assert.equal(result.results.every((item) => item.batch === "sydney_nsw_pilot"), true);
    assert.equal(result.summary.snapshots, 4);
    assert.equal(snapshots.length, 20);
    assert.equal(records.length, 4);
  } finally {
    setPredictionStorageForTests(null);
  }
});

test("NSW Sydney batch group scheduler prioritises due grouped evidence off cadence", async () => {
  const records = ["E10", "U91", "P95", "P98"].map((fuel) => ({
    id: `market:sydney:${fuel}:2026-07-07`,
    region: "NSW",
    market: "sydney",
    fuel,
    predictionDate: "2026-07-06",
    targetDate: "2026-07-07",
    modelVersion: "market-median-persistence-v1",
    predictedCpl: 160,
    predictedDirection: "flat",
    actualDirection: "unknown",
    recordedAt: "2026-07-06T08:00:00.000Z",
  }));
  const snapshots = [];
  const calls = [];
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
      const index = records.findIndex((existing) => existing.id === record.id);
      if (index >= 0) records[index] = { ...records[index], ...record };
      else records.push(record);
      return record;
    },
    async list() {
      return records.slice().reverse();
    },
    async appendSnapshot(record) {
      snapshots.push(record);
      return record;
    },
    async listSnapshots() {
      return snapshots.slice().reverse();
    },
  });

  try {
    const result = await runPredictionMarketBacktestJob({
      now: "2026-07-07T08:00:00.000Z",
      limit: 4,
      loadStationDataFn: async ({ fuels }) => {
        calls.push([...fuels]);
        return {
          provider: "test_nsw",
          capability: "live",
          stations: Array.from({ length: 10 }, (_, index) => ({
            id: `sydney-due-${index}`,
            prices: Object.fromEntries(fuels.map((fuel) => [fuel, 160 + index])),
          })),
        };
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(result.results.length, 4);
    assert.equal(result.results.every((item) => item.batch === "sydney_nsw_pilot"), true);
    assert.equal(result.summary.completed, 4);
    assert.equal(result.summary.snapshots, 4);
  } finally {
    setPredictionStorageForTests(null);
  }
});

test("QLD Brisbane batching derives multiple petrol snapshots on its batch cadence", async () => {
  const records = [];
  const snapshots = [];
  const calls = [];
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
    async list() {
      return records.slice().reverse();
    },
    async appendSnapshot(record) {
      snapshots.push(record);
      return record;
    },
    async listSnapshots() {
      return snapshots.slice().reverse();
    },
  });

  try {
    const result = await runPredictionMarketBacktestJob({
      now: "2026-07-07T08:00:00.000Z",
      limit: 4,
      loadStationDataFn: async ({ points, fuels }) => {
        calls.push({ label: points[0].label, fuels: [...fuels] });
        return {
          provider: "test_qld",
          capability: "live",
          stations: Array.from({ length: 10 }, (_, index) => ({
            id: `brisbane-${index}`,
            prices: {
              E10: 151 + index,
              U91: 153 + index,
              P95: 166 + index,
              P98: 172 + index,
            },
          })),
        };
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].label, "Brisbane");
    assert.deepEqual(calls[0].fuels.sort(), ["E10", "P95", "P98", "U91"]);
    assert.equal(result.results.length, 4);
    assert.equal(result.results.every((item) => item.batch === "brisbane_qld_pilot"), true);
    assert.equal(result.summary.snapshots, 4);
    assert.equal(records.length, 4);
  } finally {
    setPredictionStorageForTests(null);
  }
});

test("SA Adelaide batching derives multiple petrol snapshots on its batch cadence", async () => {
  const records = [];
  const snapshots = [];
  const calls = [];
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
    async list() {
      return records.slice().reverse();
    },
    async appendSnapshot(record) {
      snapshots.push(record);
      return record;
    },
    async listSnapshots() {
      return snapshots.slice().reverse();
    },
  });

  try {
    const result = await runPredictionMarketBacktestJob({
      now: "2026-07-08T08:00:00.000Z",
      limit: 4,
      loadStationDataFn: async ({ points, fuels }) => {
        calls.push({ label: points[0].label, fuels: [...fuels] });
        return {
          provider: "test_sa",
          capability: "live",
          stations: Array.from({ length: 10 }, (_, index) => ({
            id: `adelaide-${index}`,
            prices: {
              E10: 152 + index,
              U91: 154 + index,
              P95: 167 + index,
              P98: 173 + index,
            },
          })),
        };
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].label, "Adelaide");
    assert.deepEqual(calls[0].fuels.sort(), ["E10", "P95", "P98", "U91"]);
    assert.equal(result.results.length, 4);
    assert.equal(result.results.every((item) => item.batch === "adelaide_sa_pilot"), true);
    assert.equal(result.summary.snapshots, 4);
    assert.equal(records.length, 4);
  } finally {
    setPredictionStorageForTests(null);
  }
});

test("passive market observations reuse station responses without provider calls", async () => {
  const snapshots = [];
  setPredictionStorageForTests({
    status({ maxRecords }) {
      return {
        mode: "postgres_neon",
        configured: true,
        durable: true,
        maxRecords,
        recordCount: 0,
        table: "fuel_path_prediction_backtests",
      };
    },
    async append(record) {
      return record;
    },
    async list() {
      return [];
    },
    async appendSnapshot(record) {
      snapshots.push(record);
      return record;
    },
    async listSnapshots() {
      return snapshots.slice().reverse();
    },
  });

  try {
    const result = await recordPredictionMarketObservation({
      now: "2026-07-05T09:00:00.000Z",
      points: [{ lat: -33.8688, lon: 151.2093, label: "Sydney" }],
      fuels: ["U91"],
      data: {
        provider: "test_provider",
        capability: "live",
        cacheMode: "cache",
        stations: Array.from({ length: 10 }, (_, index) => ({
          id: `passive-${index}`,
          prices: { U91: 160 + index },
        })),
      },
    });

    assert.equal(result.accepted, true);
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].id, "passive:sydney:U91:2026-07-05T09");
    assert.equal(snapshots[0].medianCpl, 164.5);
  } finally {
    setPredictionStorageForTests(null);
  }
});

test("market back-test job defaults to a small rotating daily cap", async () => {
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
    async list() {
      return records.slice().reverse();
    },
  });

  const seen = [];
  const loadStationDataFn = async ({ points, fuels }) => {
    seen.push(`${points[0].label}:${fuels[0]}`);
    return {
      provider: "test_provider",
      capability: "live",
      stations: Array.from({ length: 10 }, (_, index) => ({
        id: `station-${seen.length}-${index}`,
        prices: { [fuels[0]]: 150 + index },
      })),
    };
  };

  try {
    const first = await runPredictionMarketBacktestJob({
      now: "2026-07-05T08:00:00.000Z",
      loadStationDataFn,
    });
    const second = await runPredictionMarketBacktestJob({
      now: "2026-07-06T08:00:00.000Z",
      loadStationDataFn,
    });

    assert.equal(first.summary.limit, 5);
    assert.equal(first.summary.configuredMarkets, 20);
    assert.equal(first.results.length, 5);
    assert.equal(second.summary.limit, 5);
    assert.equal(second.results.length, 5);
    assert.ok(seen.length <= 10);
    assert.ok(seen.length < first.results.length + second.results.length);
  } finally {
    setPredictionStorageForTests(null);
  }
});

test("prediction collection endpoint is authorised and reuses predictions function", async () => {
  const original = process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
  process.env.PREDICTION_BACKTEST_WRITE_TOKEN = "collect-token";

  try {
    const rejected = await callPredictions({ mode: "collect", dryRun: "1", limit: "1" });
    const accepted = await callHandler(predictionsHandler, {
      method: "GET",
      query: { mode: "collect", dryRun: "1", limit: "1" },
      headers: { authorization: "Bearer collect-token" },
    });

    assert.equal(rejected.status, 401);
    assert.match(rejected.payload.error, /collection requires/);
    assert.equal(accepted.status, 202);
    assert.equal(accepted.payload.dryRun, true);
    assert.equal(accepted.payload.summary.limit, 1);
  } finally {
    if (original === undefined) delete process.env.PREDICTION_BACKTEST_WRITE_TOKEN;
    else process.env.PREDICTION_BACKTEST_WRITE_TOKEN = original;
  }
});

test("scheduled prediction collection uses a dedicated cron route", async () => {
  const original = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-token";

  try {
    const rejected = await callHandler(cronCollectPredictionsHandler, {
      method: "GET",
      query: { dryRun: "1", limit: "1" },
      headers: {},
    });
    const accepted = await callHandler(cronCollectPredictionsHandler, {
      method: "GET",
      query: { dryRun: "1", limit: "1" },
      headers: { authorization: "Bearer cron-token" },
    });

    assert.equal(rejected.status, 401);
    assert.match(rejected.payload.error, /CRON_SECRET/);
    assert.equal(accepted.status, 202);
    assert.equal(accepted.payload.dryRun, true);
    assert.equal(accepted.payload.summary.limit, 1);
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
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
