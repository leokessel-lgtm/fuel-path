const assert = require("node:assert/strict");
const test = require("node:test");
const { createRetentionService } = require("../../api/_retentionService");

test("retention service normalises policy and keeps alert and prediction cleanup together", async () => {
  const calls = [];
  const service = createRetentionService({
    cronAuthorised: () => false,
    purgeAlertRetention: async (input) => (calls.push(["alerts", input]), { deleted: 1 }),
    purgePredictionBacktests: async (input) => (calls.push(["predictions", input]), { deleted: 2 }),
  });
  const result = await service.runRetentionCleanup({ now: "2026-07-11T00:00:00Z", dryRun: true, inactiveDeviceDays: 12 });
  assert.equal(result.policy.inactiveDeviceDays, 12);
  assert.equal(result.policy.predictionBacktestDays, 365);
  assert.equal(result.alerts.deleted, 1);
  assert.equal(result.predictions.deleted, 2);
  assert.equal(calls.length, 2);
});
