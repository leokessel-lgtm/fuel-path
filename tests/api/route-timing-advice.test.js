const assert = require("node:assert/strict");
const test = require("node:test");

const { scoreRoute } = require("../../api/_backend");

test("route timing advice uses simple savings-detour labels when route value is strong and on-route", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: stationFixtures([
      ["cheap-on-route", "Metro Sylvania", 150, 0],
      ["mid-on-route", "BP Miranda", 180, 0.001],
      ["high-on-route", "Ampol Kirrawee", 190, -0.001],
    ]),
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(["fill_today_on_route", "fill_today_with_detour"].includes(scored.context.timingAdvice.action), true);
  assert.equal(scored.context.timingAdvice.visible, true);
  assert.equal(scored.context.timingAdvice.label, "Great savings detour");
  assert.match(scored.context.timingAdvice.reason, /on the route and saves/);
  assert.equal(scored.context.decisionSummary.action, "fill_on_route");
  assert.equal(scored.context.decisionSummary.stationName, "Metro Sylvania");
  assert.equal(scored.context.decisionSummary.decisionRule.minSavingDollars, 1.5);
  assert.equal(scored.context.decisionSummary.decisionRule.maxDetourMinutes, 30);
  assert.equal(scored.context.decisionSummary.economics.netSavingAfterDetourFuel, scored.candidates[0].netSaving);
  assert.equal(scored.context.decisionSummary.economics.detourFuelLitres, scored.candidates[0].detourFuelLitres);
  assert.equal(scored.context.decisionSummary.economics.detourCost, scored.candidates[0].detourCost);
  assert.equal(scored.context.decisionSummary.economics.timeCost, scored.candidates[0].timeCost);
  assert.equal(
    scored.context.decisionSummary.economics.netSavingAfterDetourFuelAndTime,
    scored.candidates[0].netAfterDetourAndTimeCost,
  );
  assert.equal(scored.context.decisionSummary.economics.timeCostDollarsPerMinute, 0.15);
  assert.equal(scored.context.decisionSummary.alternatives.length, 4);
  assert.deepEqual(
    scored.context.decisionSummary.alternatives.map((item) => item.kind),
    ["best_value", "cheapest", "closest", "safest"],
  );
  assert.equal(scored.context.decisionSummary.alternatives[0].selected, true);
  assert.equal(scored.context.decisionSummary.alternatives[0].netSaving, scored.candidates[0].netSaving);
  assert.equal(scored.context.decisionSummary.alternatives[0].detourFuelLitres, scored.candidates[0].detourFuelLitres);
  assert.equal(scored.context.decisionSummary.alternatives[0].timeCost, scored.candidates[0].timeCost);
  assert.equal(scored.context.decisionSummary.trust.source, "sample");
  assert.equal(scored.context.decisionSummary.trust.sourceType, "sample_or_demo");
  assert.equal(scored.candidates[0].station.provenance.source, "sample");
  assert.equal(scored.candidates[0].station.provenance.sourceType, "sample_or_demo");
  assert.equal(scored.candidates[0].station.provenance.requestedFuelAvailable, true);
  assert.equal("lat" in scored.candidates[0].station.provenance, false);
  assert.equal("lon" in scored.candidates[0].station.provenance, false);
});

test("route timing advice uses simple savings-detour labels when fill value is still worth checking", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: stationFixtures([
      ["cheap-detour", "BP Miranda", 155, 0.02],
      ["mid-on-route", "Metro Sylvania", 180, 0],
      ["high-on-route", "Ampol Kirrawee", 190, -0.001],
    ]),
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(["fill_today_on_route", "fill_today_with_detour"].includes(scored.context.timingAdvice.action), true);
  assert.equal(scored.context.timingAdvice.visible, true);
  assert.equal(scored.context.timingAdvice.label, "Good savings detour");
  assert.match(scored.context.timingAdvice.reason, /adds \d+\.\d min and saves/);
  assert.equal(scored.context.decisionSummary.action, "fill_now");
});

test("route decision summary explains why cheapest is not always the recommendation", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: stationFixtures([
      ["cheap-detour", "BP Miranda", 100, 0.2],
      ["best-on-route", "Metro Sylvania", 150, 0],
      ["high-on-route", "Ampol Kirrawee", 220, -0.001],
      ["high-two", "Shell Kirrawee", 222, 0.001],
      ["high-three", "United Caringbah", 224, 0.002],
    ]),
    fuel: "U91",
    tankLitres: 10,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 25,
    minSavingDollars: 2,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(scored.candidates[0].station.stationCode, "best-on-route");
  assert.equal(scored.context.decisionSummary.action, "fill_on_route");
  assert.match(scored.context.decisionSummary.whyNotCheapest, /BP Miranda is cheapest/);
  assert.match(scored.context.decisionSummary.whyNotCheapest, /detour fuel/);
  assert.equal(
    scored.context.decisionSummary.alternatives.find((item) => item.kind === "cheapest")?.stationCode,
    "cheap-detour",
  );
  assert.equal(
    scored.context.decisionSummary.alternatives.find((item) => item.kind === "best_value")?.stationCode,
    "best-on-route",
  );
});

test("route timing advice keeps low route value as a small savings detour", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: stationFixtures([
      ["one", "Metro Sylvania", 180, 0],
      ["two", "BP Miranda", 181, 0.001],
      ["three", "Ampol Kirrawee", 182, -0.001],
    ]),
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(scored.context.timingAdvice.action, "skip_detour");
  assert.equal(scored.context.timingAdvice.visible, true);
  assert.equal(scored.context.timingAdvice.label, "Small savings detour");
  assert.match(scored.context.timingAdvice.reason, /Probably not worth it/);
  assert.equal(scored.candidates[0].matchesDecisionRule, false);
  assert.equal(scored.context.minSavingDollars, 1.5);
  assert.equal(scored.context.maxDetourMinutes, 30);
});

test("route timing advice can recommend waiting only on locked official tomorrow prices", () => {
  const scored = scoreRoute({
    source: "api_wa_fuelwatch",
    route: routeFixture(),
    stations: stationFixtures([
      ["wait-stop", "Vibe Perth", 180, 0],
      ["mid-on-route", "BP Perth", 181, 0.001],
      ["high-on-route", "Ampol Perth", 182, -0.001],
    ]).map((station) =>
      station.stationCode === "wait-stop"
        ? {
            ...station,
            source: "api_wa_fuelwatch",
            futurePrices: {
              tomorrow: {
                label: "WA locked tomorrow price",
                effectiveFrom: "2026-06-18T00:00:00.000Z",
                prices: { U91: 150 },
              },
            },
          }
        : { ...station, source: "api_wa_fuelwatch" },
    ),
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(scored.context.timingAdvice.action, "wait_if_can");
  assert.equal(scored.context.timingAdvice.visible, true);
  assert.equal(scored.context.timingAdvice.label, "Wait if you can");
  assert.match(scored.context.timingAdvice.reason, /locked tomorrow price/);
  assert.equal(scored.context.decisionSummary.action, "wait");
  assert.equal(scored.context.decisionSummary.trust.officialLive, true);
  assert.equal(scored.candidates[0].station.provenance.futurePriceAvailable, true);
});

test("route timing advice does not recommend waiting from demo tomorrow prices", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: stationFixtures([
      ["wait-stop", "Demo Fuel", 180, 0],
      ["mid-on-route", "BP Demo", 181, 0.001],
      ["high-on-route", "Ampol Demo", 182, -0.001],
    ]).map((station) =>
      station.stationCode === "wait-stop"
        ? {
            ...station,
            futurePrices: {
              tomorrow: {
                label: "Demo tomorrow price",
                effectiveFrom: "2026-06-18T00:00:00.000Z",
                prices: { U91: 150 },
              },
            },
          }
        : station,
    ),
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(scored.context.timingAdvice.action, "skip_detour");
  assert.equal(scored.context.decisionSummary.action, "skip");
  assert.equal(scored.context.decisionSummary.trust.officialLive, false);
  assert.equal(scored.candidates[0].station.provenance.futurePriceAvailable, true);
});

test("route scoring does not add hidden fuel range rejection without a real range signal", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: stationFixtures([
      ["cheap-out-of-range", "Metro Sylvania", 140, 0],
      ["mid-out-of-range", "BP Miranda", 145, 0.001],
      ["high-out-of-range", "Ampol Kirrawee", 150, -0.001],
    ]),
    fuel: "U91",
    tankLitres: 40,
    tankPercent: 8,
    economy: 9.5,
    reserveKm: 80,
    corridorKm: 3,
    minSavingDollars: 1,
    maxDetourMinutes: 8,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(scored.candidates.length > 0, true);
  assert.equal(scored.candidates[0].reachable, true);
  assert.equal(scored.context.timingAdvice.action, "fill_today_on_route");
  assert.equal(scored.context.timingAdvice.visible, true);
  assert.notEqual(scored.context.decisionSummary.action, "range_first");
  assert.notEqual(scored.context.decisionSummary.alternatives.find((item) => item.kind === "safest")?.note, "Range risk");
});

test("route timing advice applies caller-provided decision rule thresholds", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: stationFixtures([
      ["cheap-detour", "BP Miranda", 120, 0.0004],
      ["mid-on-route", "Metro Sylvania", 180, 0],
      ["high-on-route", "Ampol Kirrawee", 190, -0.001],
    ]),
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    minSavingDollars: 3,
    maxDetourMinutes: 1,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(["fill_today_on_route", "fill_today_with_detour"].includes(scored.context.timingAdvice.action), true);
  assert.equal(scored.context.timingAdvice.visible, true);
  assert.match(scored.context.timingAdvice.reason, /Suggested detour adds|on the route and saves/);
  assert.equal(scored.candidates[0].matchesDecisionRule, true);
  assert.equal(scored.context.decisionSummary.decisionRule.minSavingDollars, 3);
  assert.equal(scored.context.decisionSummary.decisionRule.maxDetourMinutes, 1);
  assert.equal(
    scored.candidates[0].warnings.some((warning) => warning.includes("above 1 min detour rule")),
    false,
  );
});

test("route scoring prefilters stations outside the route envelope", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: [
      ...stationFixtures([
        ["near-one", "Metro Sylvania", 180, 0],
        ["near-two", "BP Miranda", 182, 0.001],
      ]),
      {
        stationCode: "far-cheap",
        name: "Far Cheap Fuel",
        brand: "Far",
        lat: -35,
        lon: 150,
        openNow: true,
        source: "sample",
        updatedAt: "2026-06-17T00:00:00.000Z",
        prices: { U91: 100 },
      },
    ],
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(scored.context.routePrefilteredStations, 1);
  assert.equal(scored.candidates.some((candidate) => candidate.station.stationCode === "far-cheap"), false);
});

test("route scoring does not recommend stations missing the requested fuel grade", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: stationFixtures([
      ["p98-only", "Metro Sylvania", 150, 0],
      ["also-p98-only", "BP Miranda", 160, 0.001],
    ]).map((station) => ({
      ...station,
      prices: { P98: station.prices.U91 },
    })),
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(scored.candidates.length, 0);
  assert.equal(scored.context.timingAdvice.action, "no_cycle_signal");
  assert.equal(scored.context.stationsInCorridor, 0);
});

test("route scoring keeps stale prices rankable but carries a warning", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: stationFixtures([
      ["stale-cheap", "Metro Sylvania", 120, 0],
      ["fresh-mid", "BP Miranda", 180, 0.001],
    ]).map((station) =>
      station.stationCode === "stale-cheap"
        ? { ...station, updatedAt: "2026-06-01T00:00:00.000Z" }
        : station,
    ),
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(scored.context.staleExcludedCandidates, 0);
  assert.equal(scored.candidates.some((candidate) => candidate.station.stationCode === "stale-cheap"), true);
  assert.equal(
    scored.candidates.find((candidate) => candidate.station.stationCode === "stale-cheap")?.warnings.some((warning) => /price is/i.test(warning)),
    true,
  );
  assert.equal(scored.candidates.some((candidate) => candidate.station.stationCode === "fresh-mid"), true);
});

test("route scoring freshness is driven by configurable sample clock", () => {
  const staleWarning = withEnv({ FUEL_PATH_SAMPLE_NOW: "2026-06-22T00:00:00.000Z" }, () => {
    const scored = scoreRoute({
      source: "sample",
      route: routeFixture(),
      stations: stationFixtures([
        ["stale-cheap", "Metro Sylvania", 120, 0],
        ["fresh-mid", "BP Miranda", 180, 0.001],
      ]).map((station) =>
        station.stationCode === "stale-cheap"
          ? { ...station, updatedAt: "2026-06-18T00:00:00.000Z" }
          : station,
      ),
      fuel: "U91",
      tankLitres: 55,
      tankPercent: 45,
      economy: 8.2,
      reserveKm: 35,
      corridorKm: 3,
      eligibleDiscounts: new Set(),
      includeMemberPrices: false,
      includeClosed: false,
    });

    const warning = scored.candidates.find((candidate) => candidate.station.stationCode === "stale-cheap")?.warnings;
    return Boolean(warning?.some((item) => /price is/i.test(item)));
  });

  const freshWarning = withEnv({ FUEL_PATH_SAMPLE_NOW: "2026-06-18T01:00:00.000Z" }, () => {
    const scored = scoreRoute({
      source: "sample",
      route: routeFixture(),
      stations: stationFixtures([
        ["stale-cheap", "Metro Sylvania", 120, 0],
        ["fresh-mid", "BP Miranda", 180, 0.001],
      ]).map((station) =>
        station.stationCode === "stale-cheap"
          ? { ...station, updatedAt: "2026-06-18T00:00:00.000Z" }
          : station,
      ),
      fuel: "U91",
      tankLitres: 55,
      tankPercent: 45,
      economy: 8.2,
      reserveKm: 35,
      corridorKm: 3,
      eligibleDiscounts: new Set(),
      includeMemberPrices: false,
      includeClosed: false,
    });

    const warning = scored.candidates.find((candidate) => candidate.station.stationCode === "stale-cheap")?.warnings;
    return Boolean(warning?.some((item) => /price is/i.test(item)));
  });

  assert.equal(staleWarning, true);
  assert.equal(freshWarning, false);
});

test("route scoring excludes unavailable or out-of-fuel prices from recommendations", () => {
  const scored = scoreRoute({
    source: "sample",
    route: routeFixture(),
    stations: [
      ...stationFixtures([
        ["zero-price", "Metro Sylvania", 0, 0],
        ["sentinel-price", "BP Miranda", 9999, 0.001],
        ["negative-price", "Ampol Kirrawee", -10, -0.001],
        ["fresh-mid", "United Caringbah", 180, 0.002],
      ]),
    ],
    fuel: "U91",
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    corridorKm: 3,
    eligibleDiscounts: new Set(),
    includeMemberPrices: false,
    includeClosed: false,
  });

  assert.equal(scored.context.invalidPriceExcludedCandidates, 3);
  assert.equal(scored.candidates.some((candidate) => candidate.station.stationCode === "zero-price"), false);
  assert.equal(scored.candidates.some((candidate) => candidate.station.stationCode === "sentinel-price"), false);
  assert.equal(scored.candidates.some((candidate) => candidate.station.stationCode === "negative-price"), false);
  assert.equal(scored.candidates.some((candidate) => candidate.station.stationCode === "fresh-mid"), true);
});

function routeFixture() {
  return {
    id: "timing-route",
    name: "Timing Route",
    defaultCorridorKm: 3,
    defaultDetourSpeedKmh: 80,
    points: [
      { lat: 0, lon: 0, label: "Start" },
      { lat: 0, lon: 0.1, label: "End" },
    ],
  };
}

function stationFixtures(rows) {
  return rows.map(([stationCode, name, price, latOffset]) => ({
    stationCode,
    name,
    brand: name.split(" ")[0],
    lat: Number(latOffset),
    lon: 0.05,
    openNow: true,
    source: "sample",
    updatedAt: "2026-06-17T00:00:00.000Z",
    prices: {
      U91: Number(price),
    },
  }));
}

function withEnv(overrides, action) {
  const previous = {};
  const keys = Object.keys(overrides);
  keys.forEach((key) => {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  });

  const restore = () => {
    keys.forEach((key) => {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    });
  };

  try {
    const result = action();
    if (result && typeof result.then === "function") {
      return result.finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}
