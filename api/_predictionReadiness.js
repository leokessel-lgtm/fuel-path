function createPredictionReadiness({ REGION_ORDER, marketFuelKey, round }) {
  function predictionBacktestSummary(records = []) {
    const completed = records.filter((record) => Number.isFinite(record.absoluteErrorCpl));
    const marketScopedCompleted = completed.filter((record) => record.market);
    const mae =
      completed.length > 0
        ? round(
            completed.reduce((total, record) => total + Number(record.absoluteErrorCpl || 0), 0) / completed.length,
            2,
          )
        : undefined;
    const directionRecords = records.filter((record) => typeof record.directionMatched === "boolean");
    const directionAccuracy =
      directionRecords.length > 0
        ? round(directionRecords.filter((record) => record.directionMatched).length / directionRecords.length, 3)
        : undefined;
    const byRegion = {};
    for (const record of records) byRegion[record.region] = (byRegion[record.region] || 0) + 1;
    const byMarket = {};
    for (const record of records) {
      if (record.market) byMarket[record.market] = (byMarket[record.market] || 0) + 1;
    }
    return {
      sampleSize: records.length,
      completedSampleSize: completed.length,
      marketScopedCompletedSampleSize: marketScopedCompleted.length,
      meanAbsoluteErrorCpl: mae,
      directionSampleSize: directionRecords.length,
      directionAccuracy,
      byRegion,
      byMarket,
      accuracyClaimsAllowed: predictionReadiness(records, { durable: false }).accuracyClaimsAllowed,
    };
  }

  function predictionSnapshotSummary(snapshots = []) {
    const byMarket = {};
    const byFuel = {};
    let latestObservedAt = "";
    for (const snapshot of snapshots) {
      const key = marketFuelKey(snapshot);
      byMarket[key] = (byMarket[key] || 0) + 1;
      byFuel[snapshot.fuel] = (byFuel[snapshot.fuel] || 0) + 1;
      if (!latestObservedAt || String(snapshot.observedAt || "") > latestObservedAt) latestObservedAt = snapshot.observedAt || "";
    }
    return {
      sampleSize: snapshots.length,
      latestObservedAt,
      byMarket,
      byFuel,
    };
  }

  function predictionReadiness(records = [], storage = {}) {
    const completed = records.filter((record) => Number.isFinite(record.absoluteErrorCpl));
    const directionRecords = records.filter((record) => typeof record.directionMatched === "boolean");
    const marketScopedCompleted = completed.filter((record) => record.market);
    const marketScopedDirectionRecords = directionRecords.filter((record) => record.market);
    const meanAbsoluteErrorCpl = completed.length
      ? round(completed.reduce((total, record) => total + Number(record.absoluteErrorCpl || 0), 0) / completed.length, 2)
      : undefined;
    const directionAccuracy = directionRecords.length
      ? round(directionRecords.filter((record) => record.directionMatched).length / directionRecords.length, 3)
      : undefined;
    const thresholds = {
      completedSampleSize: 60,
      directionSampleSize: 60,
      maxMeanAbsoluteErrorCpl: 4,
      minDirectionAccuracy: 0.68,
    };
    const blockers = [
      ...(storage.durable ? [] : ["durable_prediction_storage_missing"]),
      ...(marketScopedCompleted.length >= thresholds.completedSampleSize &&
      marketScopedDirectionRecords.length >= thresholds.directionSampleSize
        ? []
        : ["prediction_market_scope_missing"]),
      ...(completed.length >= thresholds.completedSampleSize ? [] : ["prediction_completed_sample_below_threshold"]),
      ...(directionRecords.length >= thresholds.directionSampleSize ? [] : ["prediction_direction_sample_below_threshold"]),
      ...(Number.isFinite(meanAbsoluteErrorCpl) && meanAbsoluteErrorCpl <= thresholds.maxMeanAbsoluteErrorCpl ? [] : ["prediction_mae_above_threshold_or_missing"]),
      ...(Number.isFinite(directionAccuracy) && directionAccuracy >= thresholds.minDirectionAccuracy ? [] : ["prediction_direction_accuracy_below_threshold_or_missing"]),
    ];
    return {
      status: blockers.length ? "measurement_only" : "ready_for_limited_cycle_guidance",
      thresholds,
      completedSampleSize: completed.length,
      marketScopedCompletedSampleSize: marketScopedCompleted.length,
      directionSampleSize: directionRecords.length,
      marketScopedDirectionSampleSize: marketScopedDirectionRecords.length,
      meanAbsoluteErrorCpl,
      directionAccuracy,
      blockers,
      blindSpots: predictionBlindSpots({ records, storage, meanAbsoluteErrorCpl, directionAccuracy }),
      userFacingPredictionEnabled: false,
      accuracyClaimsAllowed: blockers.length === 0,
    };
  }

  function predictionBlindSpots({ records = [], storage = {}, meanAbsoluteErrorCpl, directionAccuracy } = {}) {
    const regions = Array.from(new Set(records.map((record) => record.region).filter(Boolean)));
    const fuels = Array.from(new Set(records.map((record) => record.fuel).filter(Boolean)));
    const missingRegions = REGION_ORDER.filter((region) => !regions.includes(region));
    const coreFuels = ["U91", "P95", "P98", "DL", "PDL"];
    const missingCoreFuels = coreFuels.filter((fuel) => !fuels.includes(fuel));
    const blindSpots = [
      "Predictions are blocked unless durable back-test storage is configured.",
      "Directional accuracy proves only up/down/flat direction, not the exact pump price a driver will see.",
      "Station-level prices can move differently from region averages and must not be presented as guaranteed.",
      "Provider outages, stale cache, delayed official feeds or station corrections can invalidate a cycle signal.",
      "Current back-test records are state/fuel scoped. Limited cycle guidance needs market/fuel scoped evidence before launch.",
      "WA tomorrow locked prices are official source data, not model prediction, and should be labelled separately.",
    ];
    if (!storage.durable) blindSpots.push("Current storage is not durable enough for public accuracy claims.");
    if (missingRegions.length) blindSpots.push(`No completed back-test coverage yet for ${missingRegions.join(", ")}.`);
    if (missingCoreFuels.length) blindSpots.push(`Sparse or missing fuel-grade coverage for ${missingCoreFuels.join(", ")}.`);
    if (!Number.isFinite(meanAbsoluteErrorCpl)) blindSpots.push("Mean absolute error is not measurable until completed prediction/actual pairs exist.");
    if (!Number.isFinite(directionAccuracy)) blindSpots.push("Directional accuracy is not measurable until direction-labelled back-tests exist.");
    return Array.from(new Set(blindSpots));
  }

  return { predictionBacktestSummary, predictionBlindSpots, predictionReadiness, predictionSnapshotSummary };
}

module.exports = { createPredictionReadiness };
