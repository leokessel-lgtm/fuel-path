const assert = require("node:assert/strict");
const test = require("node:test");

const { normaliseSaPayload } = require("../../api/_backend");

const brandPayload = {
  Brands: [
    { BrandId: 169, Name: "OTR" },
    { BrandId: 5, Name: "BP" },
  ],
};

const regionPayload = {
  GeographicRegions: [
    { GeoRegionLevel: 3, GeoRegionId: 4, Name: "South Australia", GeoRegionParentId: null },
    { GeoRegionLevel: 2, GeoRegionId: 189, Name: "Adelaide", GeoRegionParentId: 4 },
    { GeoRegionLevel: 1, GeoRegionId: 611, Name: "Thorngate", GeoRegionParentId: 189 },
  ],
};

test("SA normalisation joins site details and live prices", () => {
  const [station] = normaliseSaPayload(
    {
      S: [
        {
          S: 61501045,
          A: "20A Main North Rd & Carter St",
          N: "OTR Thorngate",
          B: 169,
          P: "5082",
          G1: 611,
          G2: 189,
          G3: 4,
          Lat: -34.896251,
          Lng: 138.599507,
          M: "2026-06-18T00:00:00",
          MO: "00:00",
          MC: "23:59",
        },
      ],
    },
    {
      SitePrices: [
        {
          SiteId: 61501045,
          FuelId: 14,
          CollectionMethod: "T",
          TransactionDateUtc: "2026-06-18T00:15:00",
          Price: 1859,
        },
      ],
    },
    brandPayload,
    regionPayload,
  );

  assert.equal(station.stationCode, "SA-61501045");
  assert.equal(station.name, "OTR Thorngate");
  assert.equal(station.brand, "OTR");
  assert.equal(station.suburb, "Thorngate");
  assert.equal(station.address, "20A Main North Rd & Carter St, Thorngate, SA 5082");
  assert.equal(station.source, "api_sa_fuel_price_reporting");
  assert.equal(station.prices.PDL, 185.9);
  assert.equal(station.updatedAt, "2026-06-18T00:15:00.000Z");
});

test("SA normalisation skips unavailable 9999 prices", () => {
  const stations = normaliseSaPayload(
    {
      S: [
        {
          S: 61501046,
          A: "1 Example Rd",
          N: "BP Example",
          B: 5,
          P: "5000",
          G1: 611,
          G2: 189,
          G3: 4,
          Lat: -34.93,
          Lng: 138.6,
        },
      ],
    },
    {
      SitePrices: [
        {
          SiteId: 61501046,
          FuelId: 2,
          TransactionDateUtc: "2026-06-18T00:15:00",
          Price: 9999,
        },
      ],
    },
    brandPayload,
    regionPayload,
  );

  assert.equal(stations.length, 0);
});
