const assert = require("node:assert/strict");
const test = require("node:test");
const { createGeocodeCache } = require("../../api/_geocodeCache");

test("geocode cache separates durable and degraded writes and evicts oldest entries", () => {
  const original = process.env.FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES;
  process.env.FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES = "1";
  try {
    const cache = createGeocodeCache();
    cache.write("first", { value: 1 }, true);
    cache.write("second", { value: 2 }, false);
    assert.equal(cache.read("first"), null);
    assert.deepEqual(cache.read("second"), { value: 2 });
  } finally {
    if (original === undefined) delete process.env.FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES;
    else process.env.FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES = original;
  }
});
