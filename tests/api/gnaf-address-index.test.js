const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { addressIndexStatus, searchAddressIndex } = require("../../api/_addressIndex");
const { geocode } = require("../../api/_backend");

test("seeded AU address index resolves full address before external geocoding", async () => {
  await withEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock();

    const result = await geocode({
      query: "87a corea street",
      limit: 5,
      sessionToken: "address-index-session",
    });

    assert.equal(result.lookupStatus, "ok");
    assert.equal(result.location.label, "87A Corea Street, Sylvania NSW 2224");
    assert.equal(result.location.provider, "fuel_path_gnaf");
    assert.equal(result.location.matchType, "exact_address");
    assert.equal(mockFetch.calls.length, 0);

    mockFetch.restore();
  });
});

test("seeded AU address index handles abbreviations and suburb context", () => {
  const suggestions = searchAddressIndex("87a corea st sylvania nsw 2224", 3);

  assert.equal(suggestions[0].label, "87A Corea Street, Sylvania NSW 2224");
  assert.equal(suggestions[0].confidence, "high");
});

test("G-NAF SQLite index can be built and queried without a paid provider", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-"));
  const outputPath = path.join(tempDir, "gnaf-addresses.sqlite");
  execFileSync(
    process.execPath,
    [
      "scripts/build-gnaf-address-index.mjs",
      "--input",
      "prototype/data/gnaf-addresses.seed.json",
      "--output",
      outputPath,
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath }, async () => {
    const status = addressIndexStatus();
    const suggestions = searchAddressIndex("66b easton ave sylvania", 3);

    assert.equal(status.mode, "sqlite");
    assert.equal(suggestions[0].label, "66B Easton Avenue, Sylvania NSW 2224");
    assert.equal(suggestions[0].provider, "fuel_path_gnaf");
  });
});

function installFetchMock() {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (input, options = {}) => {
    calls.push({ input: String(input), options });
    return {
      ok: false,
      status: 500,
      statusText: "Unexpected fetch",
      async text() {
        return JSON.stringify({ error: { message: "Unexpected fetch" } });
      },
    };
  };
  return {
    calls,
    restore() {
      global.fetch = originalFetch;
    },
  };
}

async function withEnv(overrides, callback) {
  const keys = [
    "FUEL_PATH_GNAF_SQLITE_PATH",
    "FUEL_PATH_GEOCODE_PROVIDER",
    "FUEL_PATH_GOOGLE_MAPS_API_KEY",
    "GOOGLE_MAPS_API_KEY",
    "FUEL_PATH_GOOGLE_PLACES_API_KEY",
    "FUEL_PATH_MAPBOX_ACCESS_TOKEN",
    "MAPBOX_ACCESS_TOKEN",
    "FUEL_PATH_HERE_API_KEY",
    "HERE_API_KEY",
    "FUEL_PATH_GEOAPIFY_API_KEY",
    "GEOAPIFY_API_KEY",
  ];
  const originalEnv = {};
  for (const key of keys) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
}
