const assert = require("node:assert/strict");
const test = require("node:test");

const { scoreRoute } = require("../../api/_backend");

test("route timing advice promotes fill today when route value is strong and on-route", () => {
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

  assert.equal(scored.context.timingAdvice.action, "fill_today_on_route");
  assert.equal(scored.context.timingAdvice.visible, true);
  assert.equal(scored.context.timingAdvice.label, "Fill today on this route");
  assert.match(scored.context.timingAdvice.reason, /Metro Sylvania/);
});

test("route timing advice explains detour when fill value is still worth checking", () => {
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

  assert.equal(scored.context.timingAdvice.action, "fill_today_with_detour");
  assert.equal(scored.context.timingAdvice.visible, true);
  assert.equal(scored.context.timingAdvice.label, "Fill today, but check the detour");
  assert.match(scored.context.timingAdvice.reason, /after \d+\.\d min detour/);
});

test("route timing advice stays hidden when route value is not useful", () => {
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

  assert.equal(scored.context.timingAdvice.action, "no_cycle_signal");
  assert.equal(scored.context.timingAdvice.visible, false);
  assert.equal(scored.context.timingAdvice.label, "");
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
