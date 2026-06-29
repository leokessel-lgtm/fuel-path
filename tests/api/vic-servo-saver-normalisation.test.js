const assert = require("node:assert/strict");
const test = require("node:test");

const { normaliseVicPayload } = require("../../api/_vicServoSaverProvider");

test("VIC normalisation maps reference fuel labels to canonical app fuel codes", () => {
  const [station] = normaliseVicPayload(
    {
      fuelPriceDetails: [
        {
          fuelStation: {
            id: "901",
            name: "Southbank Hub",
            brandId: "B-SHELL",
            address: "1 Bourke Street, Southbank VIC 3006, Australia",
            location: {
              latitude: -37.8231,
              longitude: 144.964,
            },
          },
          fuelPrices: [
            { fuelType: "ULP", price: 204.5, updatedAt: "2026-06-25T08:22:00Z", isAvailable: true },
            { fuelType: "P95REF", price: 218.9, updatedAt: "2026-06-25T08:23:00Z", isAvailable: true },
            { fuelType: "DIE", price: 188.4, updatedAt: "2026-06-25T08:24:00Z", isAvailable: true },
          ],
        },
      ],
    },
    {
      brands: new Map([["B-SHELL", "Shell"]]),
      types: new Map([
        ["ULP", "Unleaded 91"],
        ["P95REF", "Premium Unleaded 95"],
        ["DIE", "DSL"],
      ]),
    },
  );

  assert.equal(station.stationCode, "VIC-901");
  assert.equal(station.name, "Southbank Hub");
  assert.equal(station.brand, "Shell");
  assert.equal(station.address, "1 Bourke Street, Southbank VIC 3006");
  assert.equal(station.suburb, "Southbank");
  assert.equal(station.prices.U91, 204.5);
  assert.equal(station.prices.P95, 218.9);
  assert.equal(station.prices.DL, 188.4);
  assert.equal(station.updatedAt, "2026-06-25T08:24:00.000Z");
});

test("VIC normalisation falls back to reference station metadata for thin price rows", () => {
  const [station] = normaliseVicPayload(
    {
      fuelPriceDetails: [
        {
          fuelStation: {
            id: "902",
          },
          fuelPrices: [
            { fuelType: "ULP", price: 199.9, updatedAt: "2026-06-25T09:00:00Z", isAvailable: true },
          ],
        },
      ],
    },
    {
      brands: new Map([["B-UNITED", "United"]]),
      types: new Map([["ULP", "Unleaded 91"]]),
      stations: new Map([
        [
          "902",
          {
            name: "United Richmond",
            brandId: "B-UNITED",
            address: "22 Swan Street, Richmond VIC 3121",
            phone: "03 9000 0000",
            lat: -37.824,
            lon: 144.997,
            updatedAt: "2026-06-25T08:00:00.000Z",
          },
        ],
      ]),
    },
  );

  assert.equal(station.stationCode, "VIC-902");
  assert.equal(station.name, "United Richmond");
  assert.equal(station.brand, "United");
  assert.equal(station.suburb, "Richmond");
  assert.equal(station.address, "22 Swan Street, Richmond VIC 3121");
  assert.equal(station.phone, "03 9000 0000");
  assert.equal(station.lat, -37.824);
  assert.equal(station.lon, 144.997);
  assert.equal(station.prices.U91, 199.9);
  assert.equal(station.updatedAt, "2026-06-25T09:00:00.000Z");
});

test("VIC normalisation skips unavailable prices and stations without coordinates", () => {
  const stations = normaliseVicPayload(
    {
      fuelPriceDetails: [
        {
          fuelStation: {
            id: "903",
            name: "No Coordinate Fuel",
          },
          fuelPrices: [
            { fuelType: "ULP", price: 199.9, updatedAt: "2026-06-25T09:00:00Z", isAvailable: true },
          ],
        },
        {
          fuelStation: {
            id: "904",
            name: "Unavailable Fuel",
            latitude: -37.8,
            longitude: 144.9,
          },
          fuelPrices: [
            { fuelType: "ULP", price: 201.9, updatedAt: "2026-06-25T09:00:00Z", isAvailable: false },
          ],
        },
      ],
    },
    {
      types: new Map([["ULP", "Unleaded 91"]]),
    },
  );

  assert.equal(stations.length, 0);
});
