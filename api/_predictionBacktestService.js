function createPredictionBacktestService({
  REGION_ORDER,
  appendPredictionBacktestRecord,
  getPredictionStatus,
  listPredictionBacktestRecords,
  normaliseCycleMarket,
  predictionBacktestSummary,
  maxRecords = 500,
}) {
  async function recordPredictionBacktest(input = {}) {
    const record = normalisePredictionBacktestRecord(input);
    await appendPredictionBacktestRecord(record, { maxRecords });
    const records = await listPredictionBacktestRecords({ limit: maxRecords });
    return { accepted: true, record, summary: predictionBacktestSummary(records), storage: (await getPredictionStatus()).storage };
  }

  async function listPredictionBacktests({ region = "", fuel = "", limit = 50 } = {}) {
    const safeRegion = String(region || "").trim().toUpperCase();
    const safeFuel = String(fuel || "").trim().toUpperCase();
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
    const records = await listPredictionBacktestRecords({ region: safeRegion, fuel: safeFuel, limit: safeLimit });
    return { records, summary: predictionBacktestSummary(records), storage: (await getPredictionStatus()).storage };
  }

  function normalisePredictionBacktestRecord(input) {
    const id = String(input.id || `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).trim();
    const region = String(input.region || "").trim().toUpperCase();
    const market = normaliseCycleMarket(input.market || "");
    const fuel = String(input.fuel || "").trim().toUpperCase();
    const targetDate = normaliseDateOnly(input.targetDate);
    if (!REGION_ORDER.includes(region)) throw new Error("region must be NSW, ACT, QLD, WA, VIC, SA, TAS or NT");
    if (!["E10", "U91", "P95", "P98", "DL", "PDL", "LPG", "E85"].includes(fuel)) throw new Error("fuel is not supported for prediction back-testing");
    if (!targetDate) throw new Error("targetDate must be YYYY-MM-DD");

    const predictedCpl = optionalNumber(input.predictedCpl);
    const actualCpl = optionalNumber(input.actualCpl);
    const predictedDirection = normaliseDirection(input.predictedDirection);
    const actualDirection = normaliseDirection(input.actualDirection);
    return {
      id: /^[a-zA-Z0-9:_-]{8,120}$/.test(id) ? id : `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      region,
      market,
      fuel,
      targetDate,
      predictionDate: normaliseDateOnly(input.predictionDate) || new Date().toISOString().slice(0, 10),
      modelVersion: String(input.modelVersion || "manual-baseline").slice(0, 60),
      predictedCpl,
      actualCpl,
      absoluteErrorCpl: Number.isFinite(predictedCpl) && Number.isFinite(actualCpl) ? round(Math.abs(predictedCpl - actualCpl), 2) : undefined,
      predictedDirection,
      actualDirection,
      directionMatched: predictedDirection !== "unknown" && actualDirection !== "unknown" ? predictedDirection === actualDirection : undefined,
      recordedAt: new Date().toISOString(),
    };
  }

  return { listPredictionBacktests, normalisePredictionBacktestRecord, recordPredictionBacktest };
}

function normaliseDateOnly(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "" : text;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normaliseDirection(value) {
  const direction = String(value || "unknown").trim().toLowerCase();
  return ["up", "down", "flat", "unknown"].includes(direction) ? direction : "unknown";
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

module.exports = { createPredictionBacktestService };
