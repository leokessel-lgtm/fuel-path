const assert = require("node:assert/strict");
const test = require("node:test");

const { scoreRoute } = require("../../api/_backend");

test("official live FuelCheck effective dates older than 48 hours remain eligible", () => {
  const scored = scoreRoute({
    source: "live",
    route: {
      id: "official-live-route",
      name: "Official live route",
      defaultCorridorKm: 3,
      defaultDetourSpeedKmh: 80,
      points: [
        { lat: -34.18, lon: 150.7, label: "Douglas Park" },
        { lat: -34.2, lon: 150.74, label: "Appin" },
      ],
    },
    stations: [
      {
        stationCode: "20087",
        name: "Douglas Park Service Station",
        brand: "Independent",
        lat: -34.18239274,
        lon: 150.71142807,
        openNow: true,
        source: "api_nsw_fuelcheck",
        updatedAt: "2026-06-08T21:29:04+00:00",
        prices: {
          U91: 179.9,
        },
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

  assert.equal(scored.context.staleExcludedCandidates, 0);
  assert.equal(scored.candidates.length, 1);
  assert.equal(scored.candidates[0].station.stationCode, "20087");
});
