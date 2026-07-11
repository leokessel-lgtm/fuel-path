function createPredictionMarketPolicy({ REGION_ORDER, predictionReadiness }) {
  function predictionSignal({ region = "", market = "", fuel = "", historyDays = 0, observedPriceCount = 0 } = {}) {
    const safeRegion = String(region || "").trim().toUpperCase();
    const safeMarket = String(market || "").trim();
    const safeFuel = String(fuel || "").trim().toUpperCase();
    const marketProfile = predictionMarketProfile({ region: safeRegion, market: safeMarket, fuel: safeFuel });

    if (!REGION_ORDER.includes(safeRegion)) return noCycleSignal({ region: safeRegion || "UNKNOWN", fuel: safeFuel, reason: "unsupported_region" });
    if (!marketProfile.supportedFuel) return noCycleSignal({ region: safeRegion, fuel: safeFuel || "UNKNOWN", reason: "unsupported_fuel" });
    if (!marketProfile.cycleSupported) return noCycleSignal({ region: safeRegion, fuel: safeFuel, reason: marketProfile.reason, market: marketProfile });
    if (Number(historyDays || 0) < 28 || Number(observedPriceCount || 0) < 56) {
      return noCycleSignal({ region: safeRegion, fuel: safeFuel, reason: "sparse_history", market: marketProfile });
    }

    const readiness = predictionReadiness([], { durable: false });
    return {
      region: safeRegion,
      fuel: safeFuel,
      market: marketProfile,
      signal: "backtest_required",
      confidence: "low",
      reasons: ["history threshold met, but measured back-test evidence is still required before guidance is enabled"],
      userFacingCopy: "No cycle guidance yet.",
      userFacingPredictionEnabled: readiness.userFacingPredictionEnabled,
      accuracyClaimsAllowed: readiness.accuracyClaimsAllowed,
      readiness,
    };
  }

  function noCycleSignal({ region, fuel, reason, market }) {
    const labels = {
      unsupported_region: "Fuel Path does not have cycle evidence for this region.",
      unsupported_fuel: "Fuel Path does not have cycle evidence for this fuel.",
      unsupported_cycle_market: "Fuel Path only treats Sydney, Melbourne, Brisbane, Adelaide and Perth/Mandurah as petrol cycle markets.",
      trend_only_market: "Fuel Path may measure local price movement here, but should not call it a petrol price cycle.",
      diesel_or_lpg_trend_only: "Diesel and LPG should use local trend or current-price comparison, not petrol cycle guidance.",
      sparse_history: "Fuel Path needs more price history before showing cycle guidance.",
    };
    return {
      region,
      fuel,
      market: market || predictionMarketProfile({ region, fuel }),
      signal: "no_cycle_signal",
      confidence: "low",
      reasons: [labels[reason] || "Fuel Path does not have enough evidence for cycle guidance."],
      userFacingCopy: "No cycle signal.",
      userFacingPredictionEnabled: false,
      accuracyClaimsAllowed: false,
      readiness: predictionReadiness([], { durable: false }),
    };
  }

  function predictionMarketProfile({ region = "", market = "", fuel = "" } = {}) {
    const safeRegion = String(region || "").trim().toUpperCase();
    const safeMarket = normaliseCycleMarket(market);
    const safeFuel = String(fuel || "").trim().toUpperCase();
    const unleadedPetrol = ["E10", "U91", "P95", "P98"];
    const trendOnlyFuels = ["DL", "PDL", "LPG"];
    const supportedFuel = [...unleadedPetrol, ...trendOnlyFuels].includes(safeFuel);
    const cycleMarkets = {
      NSW: { labels: ["sydney"], display: "Sydney" },
      VIC: { labels: ["melbourne"], display: "Melbourne" },
      QLD: { labels: ["brisbane"], display: "Brisbane" },
      SA: { labels: ["adelaide"], display: "Adelaide" },
      WA: { labels: ["perth", "mandurah", "perth mandurah"], display: "Perth/Mandurah" },
    };
    const nonCycleCapitals = { ACT: "Canberra", TAS: "Hobart", NT: "Darwin" };

    if (!supportedFuel) return { region: safeRegion, fuel: safeFuel, supportedFuel: false, cycleSupported: false, timingScope: "unsupported_fuel", reason: "unsupported_fuel", marketLabel: safeMarket };
    if (trendOnlyFuels.includes(safeFuel)) return { region: safeRegion, fuel: safeFuel, supportedFuel: true, cycleSupported: false, timingScope: "local_trend_only", reason: "diesel_or_lpg_trend_only", marketLabel: safeMarket || nonCycleCapitals[safeRegion] || safeRegion };

    const supportedMarket = cycleMarkets[safeRegion];
    if (supportedMarket?.labels.includes(safeMarket)) {
      return {
        region: safeRegion,
        fuel: safeFuel,
        supportedFuel: true,
        cycleSupported: true,
        timingScope: "supported_petrol_cycle_market",
        reason: "",
        marketLabel: supportedMarket.display,
        caution: safeRegion === "WA"
          ? "WA tomorrow locked prices are official FuelWatch data and must be labelled separately from prediction."
          : "Cycle timing varies and must be backed by measured city-market evidence before user-facing guidance.",
      };
    }
    return { region: safeRegion, fuel: safeFuel, supportedFuel: true, cycleSupported: false, timingScope: "local_trend_only", reason: nonCycleCapitals[safeRegion] || safeMarket ? "trend_only_market" : "unsupported_cycle_market", marketLabel: safeMarket || nonCycleCapitals[safeRegion] || safeRegion };
  }

  function normaliseCycleMarket(value = "") {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  return { normaliseCycleMarket, predictionMarketProfile, predictionSignal };
}

module.exports = { createPredictionMarketPolicy };
