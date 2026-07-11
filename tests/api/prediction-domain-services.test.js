const assert = require("node:assert/strict");
const test = require("node:test");

const { createPredictionBacktestService } = require("../../api/_predictionBacktestService");
const { createPredictionMarketPolicy } = require("../../api/_predictionMarketPolicy");

test("prediction market policy keeps petrol-cycle claims market scoped", () => {
  const policy = createPredictionMarketPolicy({
    REGION_ORDER: ["NSW", "WA"],
    predictionReadiness: () => ({ userFacingPredictionEnabled: false, accuracyClaimsAllowed: false }),
  });
  assert.equal(policy.predictionSignal({ region: "NSW", market: "Sydney", fuel: "U91", historyDays: 90, observedPriceCount: 100 }).signal, "backtest_required");
  assert.equal(policy.predictionSignal({ region: "NSW", market: "Dubbo", fuel: "U91", historyDays: 90, observedPriceCount: 100 }).signal, "no_cycle_signal");
  assert.equal(policy.predictionSignal({ region: "WA", market: "Perth", fuel: "PDL", historyDays: 90, observedPriceCount: 100 }).market.reason, "diesel_or_lpg_trend_only");
});

test("prediction backtest service validates and persists through its adapter contract", async () => {
  const records = [];
  const service = createPredictionBacktestService({
    REGION_ORDER: ["NSW"],
    appendPredictionBacktestRecord: async (record) => records.push(record),
    getPredictionStatus: async () => ({ storage: { durable: true } }),
    listPredictionBacktestRecords: async () => records,
    normaliseCycleMarket: (value) => String(value).toLowerCase(),
    predictionBacktestSummary: (items) => ({ sampleSize: items.length }),
  });
  const result = await service.recordPredictionBacktest({ region: "NSW", market: "Sydney", fuel: "U91", targetDate: "2026-07-12", predictedCpl: 170, actualCpl: 168 });
  assert.equal(result.record.absoluteErrorCpl, 2);
  assert.equal(result.summary.sampleSize, 1);
  await assert.rejects(() => service.recordPredictionBacktest({ region: "XX", fuel: "U91", targetDate: "2026-07-12" }), /region must be/);
});
