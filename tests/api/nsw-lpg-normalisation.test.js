const assert = require("node:assert/strict");
const test = require("node:test");

const { createNswFuelCheckAdapter } = require("../../api/_nswFuelCheck");

test("NSW FuelCheck normalisation passes LPG fuel prices through", () => {
  const { normaliseNswPayload } = createNswFuelCheckAdapter();
  const [station] = normaliseNswPayload({
    stations: [
      {
        code: "1234",
        name: "FuelCheck LPG",
        brand: "Independent",
        address: "1 Example St, Sydney NSW 2000",
        location: { latitude: -33.8688, longitude: 151.2093 },
      },
    ],
    prices: [
      {
        stationcode: "1234",
        fueltype: "LPG",
        price: 108.7,
        lastupdated: "2026-07-09 10:30:00",
      },
    ],
  });

  assert.equal(station.stationCode, "1234");
  assert.equal(station.prices.LPG, 108.7);
  assert.equal(station.updatedAt, "2026-07-09T00:30:00.000Z");
});
