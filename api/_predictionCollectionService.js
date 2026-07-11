const { createPredictionReadiness } = require("./_predictionReadiness");
const { createPredictionMarketPolicy } = require("./_predictionMarketPolicy");
const { createPredictionBacktestService } = require("./_predictionBacktestService");
const { createPredictionSecurity } = require("./_predictionSecurity");
function createPredictionCollectionService({
  REGION_ORDER,
  appendPredictionBacktestRecord,
  appendPredictionMarketSnapshotRecord,
  distanceKm,
  listPredictionBacktestRecords,
  listPredictionMarketSnapshotRecords,
  loadStationData,
  predictionStorageStatus,
  tokenAuthorised,
  tokenSecurity,
}) {
  const PREDICTION_BACKTEST_MAX_RECORDS = 500;
  const { predictionWriteAuthorised, predictionWriteSecurity } = createPredictionSecurity({
    predictionStorageStatus,
    tokenAuthorised,
    tokenSecurity,
    maxRecords: PREDICTION_BACKTEST_MAX_RECORDS,
  });
  const {
    predictionBacktestSummary,
    predictionReadiness,
    predictionSnapshotSummary,
  } = createPredictionReadiness({ REGION_ORDER, marketFuelKey, round });
  const { normaliseCycleMarket, predictionSignal } = createPredictionMarketPolicy({ REGION_ORDER, predictionReadiness });
  const { listPredictionBacktests, recordPredictionBacktest } = createPredictionBacktestService({
    REGION_ORDER,
    appendPredictionBacktestRecord,
    getPredictionStatus: () => predictionStatus(),
    listPredictionBacktestRecords,
    normaliseCycleMarket,
    predictionBacktestSummary,
    maxRecords: PREDICTION_BACKTEST_MAX_RECORDS,
  });
  async function predictionStatus() {
    const storage = predictionStorageStatus({ maxRecords: PREDICTION_BACKTEST_MAX_RECORDS });
    let records = [];
    let snapshots = [];
    let storageError = "";
    try {
      records = await listPredictionBacktestRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
      snapshots = await listPredictionMarketSnapshotRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
    } catch (error) {
      storageError = error instanceof Error ? error.message : "Prediction storage is unavailable";
    }
    const readiness = predictionReadiness(records, storage);
    return {
      mode: "measurement_foundation",
      storage: {
        ...storage,
        recordCount: storageError ? storage.recordCount : records.length,
        health: storageError ? "error" : "ok",
        lastError: storageError,
      },
      writeSecurity: predictionWriteSecurity(),
      userFacingPredictionEnabled: readiness.userFacingPredictionEnabled,
      accuracyClaimsAllowed: readiness.accuracyClaimsAllowed,
      supportedSignalLabels: ["no_cycle_signal", "backtest_required", "measured_cycle_signal_ready"],
      readiness,
      summary: predictionBacktestSummary(records),
      snapshots: predictionSnapshotSummary(snapshots),
    };
  }

  async function runPredictionMarketBacktestJob({
    limit,
    now = new Date().toISOString(),
    forceRefresh = false,
    dryRun = false,
    loadStationDataFn = loadStationData,
  } = {}) {
    const safeNow = isoDateTime(now);
    const today = safeNow.slice(0, 10);
    const tomorrow = dateOffset(today, 1);
    const previousDay = dateOffset(today, -1);
    const allMarkets = predictionMarketBacktestMarkets();
    const requestedLimit = limit === undefined || limit === null || limit === ""
      ? predictionBacktestDailyLimit()
      : Number(limit);
    const safeLimit = Math.max(1, Math.min(allMarkets.length, Number(requestedLimit || predictionBacktestDailyLimit())));
    const results = [];
    const existingRecords = await listPredictionBacktestRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
    const existingSnapshots = await listPredictionMarketSnapshotRecords({ limit: PREDICTION_BACKTEST_MAX_RECORDS });
    const dueKeys = new Set(
      existingRecords
        .filter((record) => record.targetDate === today && Number.isFinite(Number(record.predictedCpl)))
        .map((record) => marketFuelKey(record)),
    );
    const dueMarkets = allMarkets.filter((marketConfig) => dueKeys.has(marketFuelKey(marketConfig)));
    const snapshotStats = predictionSnapshotStats(existingSnapshots);
    const rotatedMarkets = rotateByDay(allMarkets, today)
      .filter((marketConfig) => !dueKeys.has(marketFuelKey(marketConfig)))
      .sort((left, right) => predictionMarketPriority(left, right, snapshotStats, today));
    const markets = selectPredictionCollectionMarkets({
      allMarkets,
      dueMarkets,
      rotatedMarkets,
      dueKeys,
      snapshotStats,
      today,
      limit: safeLimit,
    });
    const batchResult = await maybeRunPredictionMarketBatch({
      markets,
      today,
      tomorrow,
      previousDay,
      safeNow,
      forceRefresh,
      dryRun,
      loadStationDataFn,
      existingRecords,
    });
    if (batchResult) {
      results.push(...batchResult.results);
      const handledKeys = new Set(batchResult.results.map(marketFuelKey));
      markets.splice(0, markets.length, ...markets.filter((marketConfig) => !handledKeys.has(marketFuelKey(marketConfig))));
    }

    for (const marketConfig of markets) {
      try {
        const snapshot = await predictionMarketPriceSnapshot({ marketConfig, forceRefresh, loadStationDataFn });
        if (!snapshot.usable) {
          results.push({ ...marketConfigSummary(marketConfig), status: "skipped", reason: snapshot.reason, snapshot });
          continue;
        }

        results.push(await processPredictionMarketSnapshot({
          marketConfig,
          snapshot,
          today,
          tomorrow,
          previousDay,
          safeNow,
          dryRun,
          existingRecords,
        }));
      } catch (error) {
        results.push({
          ...marketConfigSummary(marketConfig),
          status: "error",
          reason: error instanceof Error ? error.message : "Market back-test failed",
        });
      }
    }

    return {
      accepted: true,
      dryRun: Boolean(dryRun),
      now: safeNow,
      today,
      tomorrow,
      modelVersion: "market-median-persistence-v1",
      results,
      summary: {
        markets: results.length,
        configuredMarkets: allMarkets.length,
        limit: safeLimit,
        ok: results.filter((result) => result.status === "ok").length,
        skipped: results.filter((result) => result.status === "skipped").length,
        errors: results.filter((result) => result.status === "error").length,
        completed: results.filter((result) => result.completedBacktest).length,
        seeded: results.filter((result) => result.seededBacktest).length,
        snapshots: results.filter((result) => result.snapshotId).length,
        status: results.some((result) => result.status === "error")
          ? "degraded"
          : results.every((result) => result.status === "skipped")
            ? "skipped"
            : "ok",
      },
      predictions: await predictionStatus(),
    };
  }

  async function recordPredictionMarketObservation({
    points = [],
    fuels = [],
    data = {},
    now = new Date().toISOString(),
  } = {}) {
    if (!points.length || !fuels.length || !Array.isArray(data.stations) || !data.stations.length) {
      return { accepted: false, reason: "no_reusable_market_station_data", snapshots: [] };
    }
    const safeNow = isoDateTime(now);
    const fuelSet = new Set(fuels.map((fuel) => String(fuel || "").toUpperCase()));
    const snapshots = [];
    const markets = predictionMarketBacktestMarkets().filter((marketConfig) =>
      fuelSet.has(marketConfig.fuel) &&
      points.some((point) => distanceKm(point, marketConfig) <= Math.max(12, marketConfig.radiusKm)),
    );

    for (const marketConfig of markets) {
      const snapshot = predictionMarketSnapshotFromStationData({ marketConfig, data });
      if (!snapshot.usable) continue;
      const record = {
        ...predictionMarketSnapshotRecord({ marketConfig, snapshot, observedAt: safeNow }),
        id: `passive:${marketConfig.market}:${marketConfig.fuel}:${safeNow.slice(0, 13)}`,
      };
      await appendPredictionMarketSnapshotRecord(record);
      snapshots.push(record);
    }

    return {
      accepted: snapshots.length > 0,
      reason: snapshots.length ? "" : "no_supported_market_snapshot_from_reused_data",
      snapshots,
    };
  }

  async function maybeRunPredictionMarketBatch({
    markets = [],
    today,
    tomorrow,
    previousDay,
    safeNow,
    forceRefresh = false,
    dryRun = false,
    loadStationDataFn = loadStationData,
    existingRecords = [],
  } = {}) {
    const results = [];
    let providerCalls = 0;
    for (const group of predictionMarketBatchGroups()) {
      const groupMarkets = markets.filter((marketConfig) => batchGroupIncludesMarket(group, marketConfig));
      if (groupMarkets.length < 2) continue;
      const fuels = [...new Set(groupMarkets.map((marketConfig) => marketConfig.fuel))];
      const base = groupMarkets[0];
      const data = await loadStationDataFn({
        requestedSource: "auto",
        forceRefresh: Boolean(forceRefresh),
        points: [{ lat: base.lat, lon: base.lon, label: base.label }],
        radiusKm: base.radiusKm,
        fuels,
      });
      providerCalls += 1;
      for (const marketConfig of groupMarkets) {
        const snapshot = predictionMarketSnapshotFromStationData({ marketConfig, data });
        if (!snapshot.usable) {
          results.push({ ...marketConfigSummary(marketConfig), status: "skipped", reason: snapshot.reason, snapshot, batch: group.id });
          continue;
        }
        const processed = await processPredictionMarketSnapshot({
          marketConfig,
          snapshot: { ...snapshot, batchProvider: group.id },
          today,
          tomorrow,
          previousDay,
          safeNow,
          dryRun,
          existingRecords,
        });
        results.push({ ...processed, batch: group.id });
      }
    }
    if (!results.length) return null;
    return {
      providerCalls,
      results,
    };
  }

  async function processPredictionMarketSnapshot({
    marketConfig,
    snapshot,
    today,
    tomorrow,
    previousDay,
    safeNow,
    dryRun = false,
    existingRecords = [],
  } = {}) {
    const snapshotRecord = predictionMarketSnapshotRecord({ marketConfig, snapshot, observedAt: safeNow });
    if (!dryRun) await appendPredictionMarketSnapshotRecord(snapshotRecord);

    const dueId = predictionMarketBacktestId({ market: marketConfig.market, fuel: marketConfig.fuel, targetDate: today });
    const due = existingRecords.find((record) => record.id === dueId);
    let completed = null;
    if (due?.predictedCpl && !dryRun) {
      completed = await recordPredictionBacktest({
        id: due.id,
        region: marketConfig.region,
        market: marketConfig.market,
        fuel: marketConfig.fuel,
        predictionDate: due.predictionDate || previousDay,
        targetDate: today,
        modelVersion: due.modelVersion || "market-median-persistence-v1",
        predictedCpl: due.predictedCpl,
        actualCpl: snapshot.medianCpl,
        predictedDirection: due.predictedDirection || "flat",
        actualDirection: directionFromDelta(snapshot.medianCpl - Number(due.predictedCpl)),
      });
    }

    const seedId = predictionMarketBacktestId({ market: marketConfig.market, fuel: marketConfig.fuel, targetDate: tomorrow });
    const alreadySeeded = existingRecords.some((record) => record.id === seedId);
    let seeded = null;
    if (!alreadySeeded && !dryRun) {
      seeded = await recordPredictionBacktest({
        id: seedId,
        region: marketConfig.region,
        market: marketConfig.market,
        fuel: marketConfig.fuel,
        predictionDate: today,
        targetDate: tomorrow,
        modelVersion: "market-median-persistence-v1",
        predictedCpl: snapshot.medianCpl,
        predictedDirection: "flat",
      });
    }

    return {
      ...marketConfigSummary(marketConfig),
      status: "ok",
      snapshot,
      completedBacktest: completed ? completed.record.id : due?.predictedCpl ? "dry_run" : "",
      seededBacktest: seeded ? seeded.record.id : alreadySeeded ? "already_seeded" : dryRun ? "dry_run" : "",
      snapshotId: dryRun ? "dry_run" : snapshotRecord.id,
    };
  }

  function predictionMarketBacktestMarkets() {
    return [
      market("NSW", "sydney", "Sydney", -33.8688, 151.2093),
      market("VIC", "melbourne", "Melbourne", -37.8136, 144.9631),
      market("QLD", "brisbane", "Brisbane", -27.4698, 153.0251),
      market("SA", "adelaide", "Adelaide", -34.9285, 138.6007),
      market("WA", "perth", "Perth/Mandurah", -31.9523, 115.8613),
    ].flatMap((base) => ["E10", "U91", "P95", "P98"].map((fuel) => ({ ...base, fuel })));
  }

  function selectPredictionCollectionMarkets({
    allMarkets = [],
    dueMarkets = [],
    rotatedMarkets = [],
    dueKeys = new Set(),
    snapshotStats = {},
    today = "",
    limit = 5,
  } = {}) {
    const selected = [];
    const selectedKeys = new Set();
    const safeLimit = Math.max(1, Math.min(allMarkets.length || 1, Number(limit || 5)));

    for (const group of predictionMarketBatchGroups()) {
      const groupMarkets = allMarkets.filter((marketConfig) => batchGroupIncludesMarket(group, marketConfig));
      if (!groupMarkets.length || groupMarkets.length > safeLimit) continue;
      const groupDue = groupMarkets.some((marketConfig) => dueKeys.has(marketFuelKey(marketConfig)));
      const groupScheduled = predictionBatchGroupScheduledToday(group, today);
      const groupStale = groupMarkets.some((marketConfig) => (snapshotStats[marketFuelKey(marketConfig)] || {}).latestDate !== today);
      if ((groupDue || groupScheduled && groupStale) && selected.length + groupMarkets.length <= safeLimit) {
        for (const marketConfig of groupMarkets) {
          const key = marketFuelKey(marketConfig);
          selected.push(marketConfig);
          selectedKeys.add(key);
        }
      }
    }

    for (const marketConfig of [...dueMarkets, ...rotatedMarkets]) {
      if (selected.length >= safeLimit) break;
      const key = marketFuelKey(marketConfig);
      if (selectedKeys.has(key)) continue;
      selected.push(marketConfig);
      selectedKeys.add(key);
    }

    return selected;
  }

  function predictionMarketBatchGroups() {
    return [
      {
        id: "sydney_nsw_pilot",
        region: "NSW",
        market: "sydney",
        fuels: ["E10", "U91", "P95", "P98"],
        intervalDays: 4,
        offset: 0,
      },
      {
        id: "brisbane_qld_pilot",
        region: "QLD",
        market: "brisbane",
        fuels: ["E10", "U91", "P95", "P98"],
        intervalDays: 4,
        offset: 3,
      },
      {
        id: "adelaide_sa_pilot",
        region: "SA",
        market: "adelaide",
        fuels: ["E10", "U91", "P95", "P98"],
        intervalDays: 4,
        offset: 2,
      },
    ];
  }

  function batchGroupIncludesMarket(group, marketConfig) {
    return (
      marketConfig.region === group.region &&
      marketConfig.market === group.market &&
      group.fuels.includes(marketConfig.fuel)
    );
  }

  function predictionBatchGroupScheduledToday(group, today) {
    const parsed = new Date(`${today}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return false;
    const dayIndex = Math.floor(parsed.getTime() / 86400000);
    return (dayIndex + Number(group.offset || 0)) % Math.max(1, Number(group.intervalDays || 1)) === 0;
  }

  function market(region, market, label, lat, lon) {
    return {
      region,
      market,
      label,
      lat,
      lon,
      radiusKm: region === "WA" ? 45 : 35,
    };
  }

  async function predictionMarketPriceSnapshot({ marketConfig, forceRefresh = false, loadStationDataFn = loadStationData }) {
    const data = await loadStationDataFn({
      requestedSource: "auto",
      forceRefresh: Boolean(forceRefresh),
      points: [{ lat: marketConfig.lat, lon: marketConfig.lon, label: marketConfig.label }],
      radiusKm: marketConfig.radiusKm,
      fuels: [marketConfig.fuel],
    });
    return predictionMarketSnapshotFromStationData({ marketConfig, data });
  }

  function predictionMarketSnapshotFromStationData({ marketConfig, data }) {
    const prices = (data.stations || [])
      .map((station) => Number(station?.prices?.[marketConfig.fuel]))
      .filter((price) => Number.isFinite(price) && price > 0)
      .sort((left, right) => left - right);
    if (prices.length < 8) {
      return {
        usable: false,
        reason: "insufficient_exact_market_prices",
        exactPriceCount: prices.length,
        provider: data.provider || data.source || "",
        cacheMode: data.cacheMode || "",
        warning: data.warning || "",
      };
    }
    return {
      usable: true,
      exactPriceCount: prices.length,
      medianCpl: median(prices),
      lowCpl: prices[0],
      highCpl: prices[prices.length - 1],
      provider: data.provider || data.source || "",
      capability: data.capability || "",
      cacheMode: data.cacheMode || "",
      cacheAgeSeconds: Number.isFinite(Number(data.cacheAgeSeconds)) ? Number(data.cacheAgeSeconds) : null,
      warning: data.warning || "",
    };
  }

  function predictionMarketBacktestId({ market, fuel, targetDate }) {
    return `market:${normaliseCycleMarket(market)}:${String(fuel || "").toUpperCase()}:${targetDate}`;
  }

  function predictionMarketSnapshotRecord({ marketConfig, snapshot, observedAt }) {
    const observedDate = String(observedAt || new Date().toISOString()).slice(0, 10);
    return {
      id: `snapshot:${marketConfig.market}:${marketConfig.fuel}:${observedDate}`,
      region: marketConfig.region,
      market: marketConfig.market,
      fuel: marketConfig.fuel,
      observedDate,
      observedAt,
      medianCpl: snapshot.medianCpl,
      lowCpl: snapshot.lowCpl,
      highCpl: snapshot.highCpl,
      exactPriceCount: snapshot.exactPriceCount,
      provider: snapshot.provider || "",
      capability: snapshot.capability || "",
      cacheMode: snapshot.cacheMode || "",
      cacheAgeSeconds: snapshot.cacheAgeSeconds,
      warning: snapshot.warning || "",
    };
  }

  function predictionBacktestDailyLimit() {
    const configured = Number(process.env.FUEL_PATH_PREDICTION_BACKTEST_DAILY_LIMIT || 5);
    return Number.isFinite(configured) ? Math.max(1, Math.min(20, Math.floor(configured))) : 5;
  }

  function rotateByDay(items = [], dateOnlyValue = "") {
    if (!items.length) return [];
    const parsed = new Date(`${dateOnlyValue}T00:00:00Z`);
    const dayIndex = Number.isNaN(parsed.getTime()) ? 0 : Math.floor(parsed.getTime() / 86400000);
    const offset = dayIndex % items.length;
    return [...items.slice(offset), ...items.slice(0, offset)];
  }

  function marketConfigSummary(config) {
    return {
      region: config.region,
      market: config.market,
      label: config.label,
      fuel: config.fuel,
    };
  }

  function marketFuelKey(value = {}) {
    return `${normaliseCycleMarket(value.market)}:${String(value.fuel || "").toUpperCase()}`;
  }

  function predictionSnapshotStats(snapshots = []) {
    const stats = {};
    for (const snapshot of snapshots) {
      const key = marketFuelKey(snapshot);
      const current = stats[key] || { count: 0, latestDate: "" };
      current.count += 1;
      if (!current.latestDate || String(snapshot.observedDate || "") > current.latestDate) {
        current.latestDate = snapshot.observedDate || "";
      }
      stats[key] = current;
    }
    return stats;
  }

  function predictionMarketPriority(left, right, snapshotStats, today) {
    const leftStats = snapshotStats[marketFuelKey(left)] || { count: 0, latestDate: "" };
    const rightStats = snapshotStats[marketFuelKey(right)] || { count: 0, latestDate: "" };
    const leftObservedToday = leftStats.latestDate === today ? 1 : 0;
    const rightObservedToday = rightStats.latestDate === today ? 1 : 0;
    return leftObservedToday - rightObservedToday || leftStats.count - rightStats.count;
  }

  function median(values = []) {
    if (!values.length) return undefined;
    const midpoint = Math.floor(values.length / 2);
    const value = values.length % 2 ? values[midpoint] : (values[midpoint - 1] + values[midpoint]) / 2;
    return round(value, 2);
  }

  function directionFromDelta(delta) {
    if (!Number.isFinite(delta)) return "unknown";
    if (delta > 1) return "up";
    if (delta < -1) return "down";
    return "flat";
  }

  function dateOffset(dateOnlyValue, days) {
    const parsed = new Date(`${dateOnlyValue}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
    parsed.setUTCDate(parsed.getUTCDate() + Number(days || 0));
    return parsed.toISOString().slice(0, 10);
  }

  function isoDateTime(value) {
    const parsed = new Date(value || new Date().toISOString());
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  function round(value, decimals = 0) {
    const factor = 10 ** decimals;
    return Math.round(Number(value) * factor) / factor;
  }
  return {
    listPredictionBacktests,
    predictionSignal,
    predictionStatus,
    predictionWriteAuthorised,
    predictionWriteSecurity,
    recordPredictionBacktest,
    recordPredictionMarketObservation,
    runPredictionMarketBacktestJob,
  };
}

module.exports = { createPredictionCollectionService };
