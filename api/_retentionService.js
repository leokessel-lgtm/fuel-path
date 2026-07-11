function createRetentionService({ purgeAlertRetention, purgePredictionBacktests, cronAuthorised }) {
  const defaults = {
    inactiveDeviceDays: 90,
    disabledRouteDays: 90,
    alertEvaluationDays: 180,
    predictionBacktestDays: 365,
  };

  async function runRetentionCleanup({ now, dryRun = false, ...input } = {}) {
    const safeNow = isoDateTime(now);
    const policy = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, positiveInteger(input[key], fallback)]));
    const [alerts, predictions] = await Promise.all([
      purgeAlertRetention({
        now: safeNow,
        dryRun,
        inactiveDeviceDays: policy.inactiveDeviceDays,
        disabledRouteDays: policy.disabledRouteDays,
        evaluationDays: policy.alertEvaluationDays,
      }),
      purgePredictionBacktests({ now: safeNow, dryRun, olderThanDays: policy.predictionBacktestDays }),
    ]);
    return { accepted: true, dryRun: Boolean(dryRun), now: safeNow, policy, alerts, predictions };
  }

  function retentionCleanupAuthorised(req = {}) {
    if (cronAuthorised(req)) return true;
    const expected = process.env.ALERTS_WRITE_TOKEN;
    if (!expected) return false;
    const headers = req.headers || {};
    const auth = headers.authorization || headers.Authorization || "";
    const direct = headers["x-fuel-path-alerts-token"] || headers["X-Fuel-Path-Alerts-Token"] || "";
    return (String(auth).replace(/^Bearer\s+/i, "").trim() || String(direct).trim()) === expected;
  }

  return { retentionCleanupAuthorised, runRetentionCleanup };
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function isoDateTime(value) {
  const parsed = new Date(value || new Date().toISOString());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

module.exports = { createRetentionService };
