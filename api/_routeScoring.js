const {
  nearestRoutePosition,
  pointInRouteBounds,
  routeBounds,
  totalRouteKm,
} = require("./_geoMath");

const SAMPLE_NOW = new Date("2026-06-13T08:00:00+10:00");
const RECOMMENDATION_MAX_PRICE_AGE_HOURS = 48;
const ASSUMED_ROUTE_FILL_LITRES = 40;
const SMART_HARD_REJECT_SAVING_DOLLARS = 1.5;
const SMART_MAX_DETOUR_MINUTES = 30;
const TIME_COST_DOLLARS_PER_MINUTE = 0.15;
const OFFICIAL_LIVE_PRICE_SOURCES = new Set([
  "api_nsw_fuelcheck",
  "api_qld_fuelprices",
  "api_wa_fuelwatch",
  "api_vic_servo_saver",
  "api_sa_fuel_price_reporting",
  "api_tas_fuelcheck",
]);

function stationPayload(station, { fuel, distanceKm, routeDistance } = {}) {
  const prices = station.prices || {};
  const payload = {
    stationCode: station.stationCode,
    name: station.name,
    brand: station.brand || "Unknown",
    suburb: station.suburb,
    address: station.address,
    phone: station.phone,
    lat: Number(station.lat),
    lon: Number(station.lon),
    openNow: typeof station.openNow === "boolean" ? station.openNow : undefined,
    membershipRequired: Boolean(station.membershipRequired),
    updatedAt: station.updatedAt,
    source: station.source,
    prices,
    futurePrices: station.futurePrices || undefined,
    discounts: station.discounts || [],
    provenance: stationProvenance(station, fuel),
  };
  if (fuel && prices[fuel] !== undefined) payload.pumpCpl = round(Number(prices[fuel]), 1);
  if (distanceKm !== undefined) payload.distanceKm = round(distanceKm, 2);
  if (routeDistance) Object.assign(payload, routeDistance);
  return payload;
}

function priceAgeHours(updatedAt, now = new Date()) {
  if (!updatedAt) return Infinity;
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) return Infinity;
  return (now.getTime() - parsed.getTime()) / 3600000;
}

function isOfficialLivePriceSource(source) {
  return OFFICIAL_LIVE_PRICE_SOURCES.has(String(source || ""));
}

function stationProvenance(station, fuel) {
  const source = String(station?.source || "unknown");
  const updatedAt = validIsoDate(station?.updatedAt);
  return {
    source,
    sourceType: sourceType(source),
    officialLive: isOfficialLivePriceSource(source),
    updatedAt: updatedAt || undefined,
    freshnessMinutes: updatedAt ? Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000)) : undefined,
    requestedFuelAvailable: fuel ? station?.prices?.[fuel] !== undefined : undefined,
    futurePriceAvailable: fuel ? station?.futurePrices?.tomorrow?.prices?.[fuel] !== undefined : undefined,
  };
}

function sourceType(source) {
  const value = String(source || "");
  if (isOfficialLivePriceSource(value)) return "official_live";
  if (value.includes("sample") || value === "public_demo_snapshot") return "sample_or_demo";
  if (value.includes("fallback")) return "fallback";
  return "unknown";
}

function freshnessPenalty(updatedAt, now, source) {
  const hours = priceAgeHours(updatedAt, now);
  if (!Number.isFinite(hours)) return [1.5, "price timestamp missing or invalid"];
  if (isOfficialLivePriceSource(source)) return [0, ""];
  if (hours <= 6) return [0, ""];
  if (hours <= 24) return [0.5, `price is ${hours.toFixed(1)} hours old`];
  if (hours <= 48) return [1, `price is ${hours.toFixed(1)} hours old`];
  return [2, `price is ${hours.toFixed(1)} hours old`];
}

function median(values) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return 205;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function bestDiscount(station, eligibleDiscounts) {
  const eligible = (station.discounts || []).filter((discount) => eligibleDiscounts.has(discount.id));
  return eligible.sort((a, b) => Number(b.centsPerLitre) - Number(a.centsPerLitre))[0];
}

function adaptiveCorridorAttempts(routeDistanceKm, requestedCorridorKm) {
  const attempts = [requestedCorridorKm];
  if (routeDistanceKm >= 150) attempts.push(5, 8, 12, 20);
  else if (routeDistanceKm >= 50) attempts.push(4, 6, 10);
  else attempts.push(3.5, 5);
  return [...new Set(attempts.map((value) => round(Math.max(requestedCorridorKm, value), 1)))];
}

function scoreRoute({ source, route, stations, fuel, tankLitres, tankPercent, economy, reserveKm, corridorKm, eligibleDiscounts, includeMemberPrices, includeClosed, minSavingDollars, maxDetourMinutes }) {
  const decisionRule = normaliseDecisionRule({ minSavingDollars, maxDetourMinutes });
  const points = route.points || [];
  const routeKm = totalRouteKm(points);
  const attempts = adaptiveCorridorAttempts(routeKm, corridorKm || route.defaultCorridorKm || 2.5);
  let scored = null;
  for (const attempt of attempts) {
    scored = scoreRouteForCorridor({
      source,
      route,
      stations,
      fuel,
      tankLitres,
      tankPercent,
      economy,
      reserveKm,
      corridorKm: attempt,
      minSavingDollars: decisionRule.minSavingDollars,
      maxDetourMinutes: decisionRule.maxDetourMinutes,
      eligibleDiscounts,
      includeMemberPrices,
      includeClosed,
    });
    if (scored.candidates.length || attempt === attempts[attempts.length - 1]) break;
  }
  return scored;
}

function scoreRouteForCorridor({ source, route, stations, fuel, tankLitres, tankPercent, economy, reserveKm, corridorKm, minSavingDollars, maxDetourMinutes, eligibleDiscounts, includeMemberPrices, includeClosed }) {
  const points = route.points || [];
  const sampleClock = ["sample", "sample_fallback", "public_demo_snapshot"].includes(source);
  const now = sampleClock ? SAMPLE_NOW : new Date();
  const routePositions = new Map();
  const inCorridor = [];
  const bounds = routeBounds(points, Math.max(8, Number(corridorKm || 0) + 8));
  let prefilteredStations = 0;
  let invalidPriceExcludedCandidates = 0;
  for (const station of stations) {
    if (station.prices?.[fuel] === undefined) continue;
    if (!validPumpPriceCpl(station.prices[fuel])) {
      invalidPriceExcludedCandidates += 1;
      continue;
    }
    const point = { lat: Number(station.lat), lon: Number(station.lon) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    if (!pointInRouteBounds(point, bounds)) {
      prefilteredStations += 1;
      continue;
    }
    const [distanceToRouteKm, distanceAlongRouteKm] = nearestRoutePosition(point, points);
    if (distanceToRouteKm <= corridorKm) {
      inCorridor.push(station);
      routePositions.set(String(station.stationCode), { distanceToRouteKm, distanceAlongRouteKm });
    }
  }

  const availablePrices = inCorridor
    .filter((station) => station.openNow !== false && (includeMemberPrices || !station.membershipRequired))
    .map((station) => Number(station.prices?.[fuel]))
    .filter(validPumpPriceCpl);
  const baselineCpl = median(availablePrices);
  const fillLitres = ASSUMED_ROUTE_FILL_LITRES;
  const tankRangeKm = ((tankLitres * (tankPercent / 100)) / economy) * 100;
  let staleExcludedCandidates = 0;

  const candidates = [];
  for (const station of inCorridor) {
    const routeDistanceInfo = routePositions.get(String(station.stationCode));
    if (!routeDistanceInfo) continue;
    if (!includeClosed && station.openNow === false) continue;
    if (!includeMemberPrices && station.membershipRequired) continue;

    const pumpCpl = Number(station.prices[fuel]);
    const discount = bestDiscount(station, eligibleDiscounts);
    const discountCpl = Number(discount?.centsPerLitre || 0);
    const adjustedCpl = Math.max(0, pumpCpl - discountCpl);
    const detourKm = routeDistanceInfo.distanceToRouteKm * 2 * 1.35;
    const detourMinutes = (detourKm / Number(route.defaultDetourSpeedKmh || 45)) * 60;
    const detourFuelLitres = (detourKm * economy) / 100;
    const detourCost = detourFuelLitres * (adjustedCpl / 100);
    const netSaving = fillLitres * ((baselineCpl - adjustedCpl) / 100) - detourCost;
    const reachable = true;
    const [, freshWarning] = freshnessPenalty(station.updatedAt, now, station.source);
    const smartDetourLimitMinutes = smartDetourLimitMinutesForSaving(netSaving);
    const matchesSavingRule = netSaving > SMART_HARD_REJECT_SAVING_DOLLARS;
    const matchesDetourRule = detourMinutes <= smartDetourLimitMinutes;
    const matchesDecisionRule = matchesSavingRule && matchesDetourRule && reachable && station.openNow !== false;
    const warnings = [];
    if (discount) warnings.push(`discount applied: ${discount.label}`);
    if (station.membershipRequired) warnings.push("membership-only price included");
    if (station.openNow === false) warnings.push("station marked closed");
    if (!matchesSavingRule) warnings.push("small saving after detour fuel");
    if (!matchesDetourRule) warnings.push(`above ${smartDetourLimitMinutes} min smart detour for this saving`);
    if (freshWarning) warnings.push(freshWarning);

    const preferencePenalty = (matchesSavingRule ? 0 : 15) + (matchesDetourRule ? 0 : 15);
    const timeCost = detourMinutes * TIME_COST_DOLLARS_PER_MINUTE;
    const score = netSaving - timeCost - preferencePenalty - (station.openNow === false ? 100 : 0);
    candidates.push({
      station: stationPayload(station, { fuel }),
      fuel,
      pumpCpl: round(pumpCpl, 1),
      adjustedCpl: round(adjustedCpl, 1),
      discountCpl: round(discountCpl, 1),
      discountLabel: discount?.label,
      discountLabels: discount ? [discount.label] : [],
      detourKm: round(detourKm, 2),
      detourMinutes: round(detourMinutes, 1),
      detourFuelLitres: round(detourFuelLitres, 2),
      detourCost: round(detourCost, 2),
      smartDetourLimitMinutes,
      timeCost: round(timeCost, 2),
      netAfterDetourAndTimeCost: round(netSaving - timeCost, 2),
      fillLitres: round(fillLitres, 1),
      netSaving: round(netSaving, 2),
      reachable,
      matchesDecisionRule,
      openNow: station.openNow !== false,
      eligible: true,
      score: round(score, 2),
      warnings,
      distanceKm: round(routeDistanceInfo.distanceToRouteKm, 2),
      distanceToRouteKm: round(routeDistanceInfo.distanceToRouteKm, 2),
      distanceAlongRouteKm: round(routeDistanceInfo.distanceAlongRouteKm, 1),
    });
  }

  candidates.sort(routeRecommendationOrder);
  const timingAdvice = routeTimingAdvice(candidates[0], { minSavingDollars, maxDetourMinutes, fillLitres });
  return {
    candidates,
    context: {
      routeId: route.id,
      routeName: route.name,
      fuel,
      routeDistanceKm: round(totalRouteKm(points), 2),
      corridorKm,
      baselineCpl: round(baselineCpl, 1),
      tankRangeKm: round(tankRangeKm, 1),
      reserveKm,
      fillLitres: round(fillLitres, 1),
      stationsInCorridor: inCorridor.length,
      eligibleCandidates: candidates.length,
      routePrefilteredStations: prefilteredStations,
      invalidPriceExcludedCandidates,
      freshnessCutoffHours: RECOMMENDATION_MAX_PRICE_AGE_HOURS,
      staleExcludedCandidates,
      minSavingDollars,
      maxDetourMinutes,
      timingAdvice,
      decisionSummary: routeDecisionSummary(candidates, timingAdvice, {
        baselineCpl,
        fillLitres,
        minSavingDollars,
        maxDetourMinutes,
      }),
    },
  };
}

function routeDecisionSummary(candidates, timingAdvice, context = {}) {
  const best = candidates[0];
  if (!best) {
    return {
      action: "skip",
      label: "No eligible fuel stop",
      reason: "No station met the route, fuel, freshness and eligibility checks.",
      alternatives: [],
      whyNotCheapest: "",
      economics: null,
      decisionRule: {
        minSavingDollars: context.minSavingDollars,
        maxDetourMinutes: context.maxDetourMinutes,
      },
      trust: {
        source: "unknown",
        sourceType: "unknown",
        officialLive: false,
      },
    };
  }

  const cheapest = minBy(candidates, (candidate) => candidate.adjustedCpl);
  const closest = minBy(candidates, (candidate) => Number(candidate.detourMinutes ?? candidate.distanceKm ?? 0));
  const safest = safestCandidate(candidates);
  return {
    action: planDecisionAction(timingAdvice.action),
    label: planDecisionLabel(timingAdvice, best),
    reason: timingAdvice.reason || routeDecisionReason(best),
    stationCode: best.station.stationCode,
    stationName: best.station.name,
    economics: decisionEconomics(best, { ...context, candidates }),
    decisionRule: {
      minSavingDollars: context.minSavingDollars,
      maxDetourMinutes: context.maxDetourMinutes,
    },
    alternatives: [
      decisionAlternative("best_value", "Best value", best, routeValueSummary(best), best),
      decisionAlternative("cheapest", "Cheapest", cheapest, `${cheapest.adjustedCpl.toFixed(1)} c/L after wallet`, best),
      decisionAlternative("closest", "Closest", closest, `${Number(closest.detourMinutes || 0).toFixed(1)} min detour`, best),
      decisionAlternative("safest", "Safest", safest, safetySummary(safest), best),
    ],
    whyNotCheapest: whyNotCheapest(best, cheapest),
    trust: {
      source: best.station.provenance?.source || best.station.source || "unknown",
      sourceType: best.station.provenance?.sourceType || sourceType(best.station.source),
      officialLive: Boolean(best.station.provenance?.officialLive),
      updatedAt: best.station.provenance?.updatedAt,
      freshnessMinutes: best.station.provenance?.freshnessMinutes,
    },
  };
}

function planDecisionAction(action) {
  if (action === "fill_today_on_route") return "fill_on_route";
  if (action === "fill_today_with_detour") return "fill_now";
  if (action === "wait_if_can") return "wait";
  if (action === "range_first") return "range_first";
  return "skip";
}

function planDecisionLabel(timingAdvice, best) {
  if (timingAdvice.label) return timingAdvice.label;
  return savingsDetourLabel(Number(best.netSaving || 0));
}

function routeDecisionReason(candidate) {
  return `${candidate.station.name} is ${candidate.adjustedCpl.toFixed(1)} c/L after wallet with a ${Number(candidate.detourMinutes || 0).toFixed(1)} min detour.`;
}

function decisionAlternative(kind, label, candidate, note, selectedCandidate) {
  return {
    kind,
    label,
    stationCode: candidate.station.stationCode,
    stationName: candidate.station.name,
    note,
    adjustedCpl: candidate.adjustedCpl,
    netSaving: candidate.netSaving,
    detourMinutes: candidate.detourMinutes,
    detourFuelLitres: candidate.detourFuelLitres,
    timeCost: candidate.timeCost,
    netAfterDetourAndTimeCost: candidate.netAfterDetourAndTimeCost,
    selected: candidate.station.stationCode === selectedCandidate.station.stationCode,
  };
}

function decisionEconomics(candidate, { baselineCpl, fillLitres, candidates = [] } = {}) {
  const comparisonCpl = nextBestViableComparisonCpl(candidate, candidates);
  const grossFuelSaving = Number(fillLitres || 0) * ((Number(baselineCpl || 0) - Number(candidate.adjustedCpl || 0)) / 100);
  return {
    baselineCpl: round(baselineCpl, 1),
    comparisonCpl: Number.isFinite(comparisonCpl) ? round(comparisonCpl, 1) : undefined,
    comparisonKind: Number.isFinite(comparisonCpl) ? "next_best_viable" : "none",
    pumpCpl: candidate.pumpCpl,
    adjustedCpl: candidate.adjustedCpl,
    fillLitres: candidate.fillLitres,
    grossFuelSaving: round(grossFuelSaving, 2),
    detourKm: candidate.detourKm,
    detourMinutes: candidate.detourMinutes,
    detourFuelLitres: candidate.detourFuelLitres,
    detourCost: candidate.detourCost,
    timeCost: candidate.timeCost,
    timeCostDollarsPerMinute: TIME_COST_DOLLARS_PER_MINUTE,
    netSavingAfterDetourFuel: candidate.netSaving,
    netSavingAfterDetourFuelAndTime: candidate.netAfterDetourAndTimeCost,
  };
}

function nextBestViableComparisonCpl(selectedCandidate, candidates = []) {
  const selectedCode = selectedCandidate?.station?.stationCode;
  const selectedPrice = Number(selectedCandidate?.adjustedCpl);
  const alternatives = candidates
    .filter((candidate) => candidate?.station?.stationCode !== selectedCode)
    .filter((candidate) => candidate.station?.openNow !== false)
    .filter((candidate) => candidate.reachable !== false)
    .filter((candidate) => candidate.matchesDecisionRule !== false)
    .map((candidate) => Number(candidate.adjustedCpl))
    .filter(Number.isFinite)
    .filter((price) => !Number.isFinite(selectedPrice) || price >= selectedPrice)
    .sort((left, right) => left - right);
  return alternatives[0];
}

function routeRecommendationOrder(left, right) {
  const leftPriority = routeRecommendationPriority(left);
  const rightPriority = routeRecommendationPriority(right);
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  if (left.adjustedCpl !== right.adjustedCpl) return left.adjustedCpl - right.adjustedCpl;
  if (left.detourMinutes !== right.detourMinutes) return left.detourMinutes - right.detourMinutes;
  return right.score - left.score;
}

function routeRecommendationPriority(candidate) {
  return candidate.station?.openNow !== false &&
    candidate.reachable !== false &&
    candidate.matchesDecisionRule !== false
    ? 0
    : 1;
}

function routeValueSummary(candidate) {
  return `${candidate.adjustedCpl.toFixed(1)} c/L, ${Number(candidate.detourMinutes || 0).toFixed(1)} min detour`;
}

function safetySummary(candidate) {
  const warnings = candidate.warnings || [];
  if (candidate.reachable === false) return "Range risk";
  if (candidate.station.openNow === false) return "Closed";
  if (warnings.some((warning) => /stale|old|timestamp|fresh/i.test(warning))) return "Freshness caution";
  if (warnings.length) return "Check caveats";
  return "Open, reachable and clean";
}

function safestCandidate(candidates) {
  const safe = candidates.filter((candidate) => {
    const warnings = (candidate.warnings || []).join(" ");
    return candidate.reachable !== false && candidate.station.openNow !== false && !/range risk|closed|timestamp missing|price is/i.test(warnings);
  });
  return safe[0] || candidates[0];
}

function whyNotCheapest(best, cheapest) {
  if (!cheapest || cheapest.station.stationCode === best.station.stationCode) {
    return "Cheapest also wins because the route saving stays ahead after detour time and fuel used.";
  }
  return `${cheapest.station.name} is cheapest at ${cheapest.adjustedCpl.toFixed(1)} c/L, but nets ${formatMoney(cheapest.netSaving)} after ${Number(cheapest.detourMinutes || 0).toFixed(1)} min and ${Number(cheapest.detourFuelLitres || 0).toFixed(1)} L detour fuel.`;
}

function minBy(values, scorer) {
  return values.reduce((best, item) => (scorer(item) < scorer(best) ? item : best), values[0]);
}

function routeTimingAdvice(candidate, { minSavingDollars = SMART_HARD_REJECT_SAVING_DOLLARS, maxDetourMinutes = SMART_MAX_DETOUR_MINUTES, fillLitres = 0 } = {}) {
  if (!candidate) {
    return {
      action: "no_cycle_signal",
      visible: false,
      label: "",
      reason: "",
    };
  }

  const saving = Number(candidate.netSaving || 0);
  const detourMinutes = Number(candidate.detourMinutes || 0);
  const smartDetourLimitMinutes = smartDetourLimitMinutesForSaving(saving);
  const label = savingsDetourLabel(saving);
  if (candidate.reachable === false) {
    return {
      action: "range_first",
      visible: true,
      label: "Range-first",
      reason: `${candidate.station?.name || "This stop"} has range risk. Choose a closer stop before chasing price.`,
    };
  }
  if (detourMinutes > smartDetourLimitMinutes) {
    return {
      action: "skip_detour",
      visible: true,
      label,
      reason: `Probably not worth it: saves ${formatMoney(saving)} after ${detourMinutes.toFixed(1)} min.`,
    };
  }
  const waitCue = lockedTomorrowWaitCue(candidate, { fillLitres, minSavingDollars });
  if (waitCue) return waitCue;
  if (saving <= SMART_HARD_REJECT_SAVING_DOLLARS) {
    return {
      action: "skip_detour",
      visible: true,
      label,
      reason: `Probably not worth it: saves ${formatMoney(saving)} after ${detourMinutes.toFixed(1)} min.`,
    };
  }
  if (saving < 2) {
    return {
      action: "fill_today_with_detour",
      visible: true,
      label,
      reason: "Only worth it if you are already passing nearby.",
    };
  }
  if (detourMinutes <= 0.1) {
    return {
      action: "fill_today_on_route",
      visible: true,
      label,
      reason: `Suggested stop is on the route and saves ${formatMoney(saving)}.`,
    };
  }
  if (saving > SMART_HARD_REJECT_SAVING_DOLLARS) {
    return {
      action: "fill_today_with_detour",
      visible: true,
      label,
      reason: `Suggested detour adds ${detourMinutes.toFixed(1)} min and saves ${formatMoney(saving)}.`,
    };
  }
  return {
    action: "no_cycle_signal",
    visible: false,
    label: "",
    reason: "",
  };
}

function lockedTomorrowWaitCue(candidate, { fillLitres = 0, minSavingDollars = 5 } = {}) {
  const fuel = candidate.fuel;
  const tomorrowPumpCpl = Number(candidate.station?.futurePrices?.tomorrow?.prices?.[fuel]);
  if (!Number.isFinite(tomorrowPumpCpl)) return null;
  if (!candidate.station?.provenance?.officialLive) return null;
  const discountCpl = Number(candidate.discountCpl || 0);
  const tomorrowAdjustedCpl = Math.max(0, tomorrowPumpCpl - discountCpl);
  const todayAdjustedCpl = Number(candidate.adjustedCpl || 0);
  const cplDrop = todayAdjustedCpl - tomorrowAdjustedCpl;
  if (cplDrop <= 0) return null;
  const futureSaving = Number(fillLitres || candidate.fillLitres || 0) * (cplDrop / 100);
  if (futureSaving < minSavingDollars) return null;
  return {
    action: "wait_if_can",
    visible: true,
    label: "Wait if you can",
    reason: `${candidate.station?.name || "This stop"} has a locked tomorrow price about ${formatMoney(futureSaving)} lower for this fill.`,
  };
}

function normaliseDecisionRule({ minSavingDollars, maxDetourMinutes }) {
  return {
    minSavingDollars: SMART_HARD_REJECT_SAVING_DOLLARS,
    maxDetourMinutes: SMART_MAX_DETOUR_MINUTES,
  };
}

function smartDetourLimitMinutesForSaving(saving) {
  const value = Number(saving || 0);
  if (value <= SMART_HARD_REJECT_SAVING_DOLLARS) return 3;
  if (value < 5) return 5;
  if (value < 10) return 10;
  if (value < 20) return 18;
  return SMART_MAX_DETOUR_MINUTES;
}

function savingsDetourLabel(saving) {
  const value = Number(saving || 0);
  if (value < 2) return "Small savings detour";
  if (value < 5) return "Medium savings detour";
  if (value < 10) return "Good savings detour";
  if (value < 20) return "Great savings detour";
  return "Strong savings detour";
}

function boundedNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Number(value) || 0).toFixed(2)}`;
}

function routeContextStations({ route, stations, fuel, excludedCodes, corridorKm, includeMemberPrices, includeClosed, limit = 40 }) {
  const contextCorridorKm = Math.min(24, Math.max(8, corridorKm + 4, corridorKm * 1.8));
  const bounds = routeBounds(route.points || [], contextCorridorKm + 8);
  const rows = [];
  for (const station of stations) {
    const stationCode = String(station.stationCode);
    if (excludedCodes.has(stationCode) || station.prices?.[fuel] === undefined) continue;
    if (!validPumpPriceCpl(station.prices[fuel])) continue;
    if (!includeClosed && station.openNow === false) continue;
    if (!includeMemberPrices && station.membershipRequired) continue;
    if (!pointInRouteBounds(station, bounds)) continue;
    const [distanceToRouteKm, distanceAlongRouteKm] = nearestRoutePosition(station, route.points);
    if (distanceToRouteKm > contextCorridorKm) continue;
    rows.push({
      distanceToRouteKm,
      distanceAlongRouteKm,
      price: Number(station.prices[fuel]),
      station,
    });
  }
  rows.sort((left, right) => left.distanceToRouteKm - right.distanceToRouteKm || left.price - right.price || left.distanceAlongRouteKm - right.distanceAlongRouteKm);
  return rows.slice(0, limit).map((row) =>
    stationPayload(row.station, {
      fuel,
      routeDistance: {
        distanceToRouteKm: round(row.distanceToRouteKm, 2),
        distanceAlongRouteKm: round(row.distanceAlongRouteKm, 1),
      },
    }),
  );
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function validPumpPriceCpl(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 && price < 500;
}

function validIsoDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

module.exports = {
  isOfficialLivePriceSource,
  priceAgeHours,
  routeContextStations,
  scoreRoute,
  stationPayload,
};
