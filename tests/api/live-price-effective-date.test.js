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

test("official live SA prices older than 48 hours remain eligible", () => {
  const scored = scoreRoute({
    source: "live",
    route: {
      id: "official-sa-route",
      name: "Official SA route",
      defaultCorridorKm: 3,
      defaultDetourSpeedKmh: 80,
      points: [
        { lat: -34.9285, lon: 138.6007, label: "Adelaide" },
        { lat: -34.9228, lon: 138.6027, label: "Rundle Mall" },
      ],
    },
    stations: [
      {
        stationCode: "SA-123",
        name: "Adelaide Reliable Fuel",
        brand: "Independent",
        lat: -34.925,
        lon: 138.601,
        openNow: true,
        source: "api_sa_fuel_price_reporting",
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
  assert.equal(scored.candidates[0].station.stationCode, "SA-123");
});

test("official live NT prices older than 48 hours remain eligible", () => {
  const scored = scoreRoute({
    source: "live",
    route: {
      id: "official-nt-route",
      name: "Official NT route",
      defaultCorridorKm: 3,
      defaultDetourSpeedKmh: 80,
      points: [
        { lat: -12.4634, lon: 130.8456, label: "Darwin" },
        { lat: -12.486, lon: 130.9833, label: "Palmerston" },
      ],
    },
    stations: [
      {
        stationCode: "NT-DAR-123",
        name: "Darwin Reliable Fuel",
        brand: "Independent",
        lat: -12.4634,
        lon: 130.8456,
        openNow: true,
        source: "api_nt_myfuel",
        updatedAt: "2026-06-08T21:29:04+00:00",
        prices: {
          U91: 195.7,
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
  assert.equal(scored.candidates[0].station.stationCode, "NT-DAR-123");
});
