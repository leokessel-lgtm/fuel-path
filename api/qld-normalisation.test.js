const assert = require("node:assert/strict");
const test = require("node:test");

const { normaliseQldPayload } = require("./_backend");

const brandPayload = {
  Brands: [
    { BrandId: 5, Name: "BP" },
    { BrandId: 86, Name: "Liberty" },
    { BrandId: 12, Name: "Independent" },
  ],
};

const regionPayload = {
  GeographicRegions: [
    { GeoRegionLevel: 2, GeoRegionId: 152, Name: "Wodonga", GeoRegionParentId: 3 },
    { GeoRegionLevel: 2, GeoRegionId: 158, Name: "Sale", GeoRegionParentId: 3 },
    { GeoRegionLevel: 1, GeoRegionId: 364, Name: "Hawthorne", GeoRegionParentId: 1 },
    { GeoRegionLevel: 3, GeoRegionId: 1, Name: "QUEENSLAND", GeoRegionParentId: null },
  ],
};

test("QLD normalisation ignores non-locality region names", () => {
  const [station] = normaliseQldPayload(
    {
      S: [
        {
          S: 61401106,
          A: "20 Commercial Rd & Stratton St",
          N: "BP Newstead",
          B: 5,
          P: "4006",
          G1: 152,
          G2: 1,
          Lat: -27.452584,
          Lng: 153.041807,
        },
      ],
    },
    { SitePrices: [{ SiteId: 61401106, FuelId: 2, Price: 1789, TransactionDateUtc: "2026-06-16T00:15:00" }] },
    brandPayload,
    regionPayload,
  );

  assert.equal(station.suburb, "Newstead");
  assert.equal(station.address, "20 Commercial Rd & Stratton St, Newstead, QLD 4006");
  assert.notEqual(station.suburb, "Wodonga");
});

test("QLD normalisation extracts suburb from full address before bad region", () => {
  const [station] = normaliseQldPayload(
    {
      S: [
        {
          S: 61401117,
          A: "22 Gladstone Rd, Highgate Hill QLD 4101, Australia",
          N: "Liberty Highgate Hill",
          B: 86,
          P: "4101",
          G1: 158,
          G2: 1,
          Lat: -27.483409881192497,
          Lng: 153.0197200841747,
        },
      ],
    },
    { SitePrices: [{ SiteId: 61401117, FuelId: 12, Price: 1765, TransactionDateUtc: "2026-06-16T00:15:00" }] },
    brandPayload,
    regionPayload,
  );

  assert.equal(station.suburb, "Highgate Hill");
  assert.equal(station.address, "22 Gladstone Rd, Highgate Hill QLD 4101");
  assert.notEqual(station.suburb, "Sale");
});

test("QLD normalisation keeps genuine level-one locality regions", () => {
  const [station] = normaliseQldPayload(
    {
      S: [
        {
          S: 61401131,
          A: "1 Hawthorne Rd",
          N: "Quill Petroleum Hawthorne",
          B: 12,
          P: "4171",
          G1: 364,
          G2: 1,
          Lat: -27.472295835233435,
          Lng: 153.05950272883607,
        },
      ],
    },
    { SitePrices: [{ SiteId: 61401131, FuelId: 2, Price: 1719, TransactionDateUtc: "2026-06-16T00:15:00" }] },
    brandPayload,
    regionPayload,
  );

  assert.equal(station.suburb, "Hawthorne");
  assert.equal(station.address, "1 Hawthorne Rd, Hawthorne, QLD 4171");
  assert.equal(station.prices.U91, 171.9);
}
);

