const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { geocode } = require("../../api/_backend");

test("validation geocode rate limits degrade without throwing", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Too many requests" } }, 429),
    );

    const result = await geocode({
      query: `13 Example Failure Street ${Date.now()}`,
      limit: 5,
      sessionToken: "rate-limit-session",
    });

    assert.equal(result.provider, "nominatim");
    assert.equal(result.providerMode, "validation");
    assert.equal(result.lookupStatus, "degraded");
    assert.equal(result.location, null);
    assert.deepEqual(result.suggestions, []);
    assert.match(result.warning, /rate-limited/i);
    assert.equal(result.degraded, true);
    assert.equal(result.cacheMode, "degraded");
    assert.equal(result.providerHealth.nominatim.status, "unavailable");
    assert.match(result.providerHealth.nominatim.lastError, /rate-limited/i);
    assert.equal(mockFetch.calls.length, 1);

    mockFetch.restore();
  });
});

test("transient geocode provider failure retries once before returning success", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "mapbox",
      FUEL_PATH_MAPBOX_ACCESS_TOKEN: "test-mapbox-token",
    },
    async () => {
    const query = `7 Retry Street ${Date.now()}`;
    let calls = 0;
    const mockFetch = installFetchMock(() => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse({ error: { message: "Provider temporarily unavailable" } }, 503);
      }
      return jsonResponse({
        features: [
          {
            geometry: { coordinates: [151.2, -33.9] },
            properties: {
              full_address: `${query}, Sydney NSW 2000, Australia`,
            },
          },
        ],
      });
    });

    const result = await geocode({
      query,
      limit: 5,
      sessionToken: "transient-success-session",
    });

    assert.equal(result.lookupStatus, "ok");
    assert.equal(result.location.provider, "mapbox");
    assert.equal(result.location.label, `${query}, Sydney NSW 2000, Australia`);
    assert.equal(result.degraded, false);
    assert.equal(mockFetch.calls.length, 2);

    mockFetch.restore();
  });
});

test("transient geocode provider failure retries once and then degrades", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "mapbox",
      FUEL_PATH_MAPBOX_ACCESS_TOKEN: "test-mapbox-token",
    },
    async () => {
    const query = `X${Date.now()}-non-match`;
    const mockFetch = installFetchMock(() => jsonResponse({ error: { message: "Downstream timeout" } }, 503));

    const result = await geocode({
      query,
      limit: 5,
      sessionToken: "transient-fail-session",
    });

    assert.equal(result.lookupStatus, "degraded");
    assert.equal(result.degraded, true);
    assert.equal(result.location, null);
    assert.equal(mockFetch.calls.length, 2);

    mockFetch.restore();
  });
});

test("geocode provider auth/key errors do not retry", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "mapbox",
      FUEL_PATH_MAPBOX_ACCESS_TOKEN: "test-mapbox-token",
    },
    async () => {
      const query = `Mapbox Auth Error ${Date.now()}`;
      const mockFetch = installFetchMock(() => jsonResponse({ message: "Invalid token" }, 401));

      const result = await geocode({
        query,
        limit: 5,
        sessionToken: "mapbox-auth-session",
      });

      assert.equal(result.lookupStatus, "degraded");
      assert.equal(result.degraded, true);
      assert.match(result.warning, /temporarily unavailable/);
      assert.equal(mockFetch.calls.length, 1);

      mockFetch.restore();
    },
  );
});

test("geocode provider quota errors do not retry", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "mapbox",
      FUEL_PATH_MAPBOX_ACCESS_TOKEN: "test-mapbox-token",
    },
    async () => {
      const query = `Mapbox Quota Error ${Date.now()}`;
      const mockFetch = installFetchMock(() => jsonResponse({ message: "quota exceeded for this key" }, 429));

      const result = await geocode({
        query,
        limit: 5,
        sessionToken: "mapbox-quota-session",
      });

      assert.equal(result.lookupStatus, "degraded");
      assert.equal(mockFetch.calls.length, 1);

      mockFetch.restore();
    },
  );
});

test("local geocode hints survive provider rate limiting", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Too many requests" } }, 429),
    );

    const result = await geocode({
      query: "100 Queen Street Brisbane QLD",
      limit: 5,
      sessionToken: "local-fallback-session",
    });

    assert.equal(result.lookupStatus, "local_fallback");
    assert.equal(result.location.label, "Queen Street, Brisbane QLD 4000");
    assert.equal(result.suggestions[0].provider, "fuel_path_hint");
    assert.match(result.warning, /rate-limited|cooling down/i);
    assert.equal(result.degraded, true);
    assert.equal(result.cacheMode, "local_fallback");
    assert.equal(result.providerHealth.nominatim.status, "degraded");

    mockFetch.restore();
  });
});

test("transient geocode provider failure falls back to local/G-NAF suggestions", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "mapbox",
      FUEL_PATH_MAPBOX_ACCESS_TOKEN: "test-mapbox-token",
    },
    async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Transient provider failure" } }, 500),
    );

    const result = await geocode({
      query: "100 Queen Street Brisbane QLD",
      limit: 5,
      sessionToken: "local-fallback-after-retry-session",
    });

    assert.equal(result.lookupStatus, "local_fallback");
    assert.equal(result.location.label, "Queen Street, Brisbane QLD 4000");
    assert.equal(result.location.provider, "fuel_path_hint");
    assert.equal(mockFetch.calls.length, 2);
    assert.equal(result.degraded, true);

    mockFetch.restore();
  });
});

test("geocode does not log raw address query from application code", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const query = `PII Street ${Date.now()}`;
    const mockFetch = installFetchMock(() => jsonResponse({ error: { message: "Too many requests" } }, 429));
    const spy = installConsoleSpy();
    try {
      const result = await geocode({
        query,
        limit: 5,
        sessionToken: "privacy-console-session",
      });

      assert.equal(result.lookupStatus, "degraded");
      assert.equal(spy.calls.some(({ args }) => args.some((arg) => String(arg).includes(query))), false);
      assert.equal(spy.calls.length, 0);
    } finally {
      spy.restore();
      mockFetch.restore();
    }
  });
});

test("strong local place hints do not call validation provider", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Unexpected provider call" } }, 500),
    );

    const result = await geocode({
      query: "Canberra Centre",
      limit: 5,
      sessionToken: "strong-local-session",
    });

    assert.equal(result.lookupStatus, "ok");
    assert.equal(result.location.label, "Canberra Centre, Canberra ACT 2601");
    assert.equal(result.location.provider, "fuel_path_hint");
    assert.equal(result.degraded, false);
    assert.equal(result.cacheMode, "refreshed");
    assert.equal(result.providerHealth.nominatim.status, "ok");
    assert.equal(mockFetch.calls.length, 0);

    mockFetch.restore();
  });
});

test("station geocode can be disabled for lookup-only benchmarks", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "nominatim",
      FUEL_PATH_DISABLE_STATION_GEOCODE: "1",
    },
    async () => {
      const mockFetch = installFetchMock(() =>
        jsonResponse({ error: { message: "Too many requests" } }, 429),
      );

      const result = await geocode({
        query: "fuel station karratha wa",
        limit: 5,
        sessionToken: "station-geocode-disabled-session",
      });

      assert.equal(result.lookupStatus, "local_fallback");
      assert.equal(
        mockFetch.calls.some((call) => String(call.input).includes("fuelwatch.wa.gov.au")),
        false,
      );
      assert.equal(mockFetch.calls.length, 0);

      mockFetch.restore();
    },
  );
});

test("local POI hints with street-name suffixes do not get filtered as fake localities", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Unexpected provider call" } }, 500),
    );

    const queenStreetMall = await geocode({
      query: "Queen Street Mall",
      limit: 5,
      sessionToken: "street-suffix-poi-session",
    });
    const romaStreetParkland = await geocode({
      query: "Roma Street Parkland",
      limit: 5,
      sessionToken: "street-suffix-parkland-session",
    });

    assert.equal(queenStreetMall.lookupStatus, "ok");
    assert.equal(queenStreetMall.location.label, "Queen Street Mall, Brisbane QLD 4000");
    assert.equal(queenStreetMall.location.provider, "fuel_path_hint");
    assert.equal(romaStreetParkland.lookupStatus, "ok");
    assert.equal(romaStreetParkland.location.label, "Roma Street Parkland, Brisbane QLD 4000");
    assert.equal(romaStreetParkland.location.provider, "fuel_path_hint");
    assert.equal(mockFetch.calls.length, 0);

    mockFetch.restore();
  });
});

test("place-word address-like queries still resolve exact G-NAF rows", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-place-intent-address-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-place-intent.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|BUILDING_NAME|FLAT_TYPE|FLAT_NUMBER|LEVEL_TYPE|LEVEL_NUMBER|NUMBER_FIRST|NUMBER_FIRST_SUFFIX|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GAPOS1001|Shell Service Station, Lot 1076, Searipple Road, Karratha WA 6714||| | | |1076| |Searipple|Road|Karratha|WA|6714|PROPERTY CENTROID|116.846|-20.736",
    ].join("\n"),
  );

  execFileSync(
    process.execPath,
    [
      "scripts/build-gnaf-address-index.mjs",
      "--input",
      inputPath,
      "--output",
      outputPath,
      "--omit-legacy-fts",
      "--omit-search-backstop",
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "nominatim",
      FUEL_PATH_GNAF_SQLITE_PATH: outputPath,
      FUEL_PATH_DISABLE_STATION_GEOCODE: "1",
    },
    async () => {
      const mockFetch = installFetchMock(() =>
        jsonResponse({ error: { message: "Should not call external provider when exact index match exists" } }, 500),
      );

      const result = await geocode({
        query: "Shell Service Station Lot 1076 Searipple Road Karratha WA 6714",
        limit: 5,
        sessionToken: "place-intent-address-session",
      });

      assert.equal(result.location.provider, "fuel_path_gnaf");
      assert.equal(result.location.matchType, "exact_address");
      assert.equal(result.location.label, "Shell Service Station, Lot 1076, Searipple Road, Karratha WA 6714");
      assert.equal(mockFetch.calls.length, 0);

      mockFetch.restore();
    },
  );
});

test("place-word address queries with house numbers still use G-NAF local index", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-place-intent-prefix-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-place-intent-prefix.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|BUILDING_NAME|FLAT_TYPE|FLAT_NUMBER|LEVEL_TYPE|LEVEL_NUMBER|NUMBER_FIRST|NUMBER_FIRST_SUFFIX|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GAACT1003|Tuggeranong Arts Centre, 137 Reid Street, Tuggeranong ACT 2900||| | | |137| |Reid|Street|Tuggeranong|ACT|2900|PROPERTY CENTROID|149.0667|-35.35",
    ].join("\n"),
  );

  execFileSync(
    process.execPath,
    [
      "scripts/build-gnaf-address-index.mjs",
      "--input",
      inputPath,
      "--output",
      outputPath,
      "--omit-legacy-fts",
      "--omit-search-backstop",
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "nominatim",
      FUEL_PATH_GNAF_SQLITE_PATH: outputPath,
      FUEL_PATH_DISABLE_STATION_GEOCODE: "1",
    },
    async () => {
      const mockFetch = installFetchMock(() =>
        jsonResponse({ error: { message: "Should not call external provider when local index returns index candidates" } }, 500),
      );

      const result = await geocode({
        query: "Tuggeranong Arts Centre 137 Reid",
        limit: 5,
        sessionToken: "place-intent-prefix-session",
      });

      assert.equal(result.location.provider, "fuel_path_gnaf");
      assert.equal(result.location.label, "Tuggeranong Arts Centre, 137 Reid Street, Tuggeranong ACT 2900");
      assert.equal(result.location.state, "ACT");
      assert.equal(mockFetch.calls.length, 0);

      mockFetch.restore();
    },
  );
});

test("ACT city-level locality does not block ACT street hints", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Unexpected provider call" } }, 500),
    );

    const result = await geocode({
      query: "2 Phillip Law Street Canberra ACT",
      limit: 5,
      sessionToken: "act-city-street-session",
    });

    assert.equal(result.lookupStatus, "local_fallback");
    assert.equal(result.location.label, "Phillip Law Street, Acton ACT 2601");
    assert.equal(result.location.provider, "fuel_path_hint");
    assert.ok(mockFetch.calls.length <= 1);

    mockFetch.restore();
  });
});

test("hospital-road with lot locality query does not get replaced by regional street fallback", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-place-intent-hospital-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-place-intent-hospital.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|BUILDING_NAME|FLAT_TYPE|FLAT_NUMBER|LEVEL_TYPE|LEVEL_NUMBER|NUMBER_FIRST|NUMBER_FIRST_SUFFIX|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GAPOS1002|Lot 89, Hospital Road, Coober Pedy SA 5723|||| | |89| |Hospital|Road|Coober Pedy|SA|5723|PROPERTY CENTROID|134.761| -29.0048",
    ].join("\n"),
  );

  execFileSync(
    process.execPath,
    [
      "scripts/build-gnaf-address-index.mjs",
      "--input",
      inputPath,
      "--output",
      outputPath,
      "--omit-legacy-fts",
      "--omit-search-backstop",
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "nominatim",
      FUEL_PATH_GNAF_SQLITE_PATH: outputPath,
      FUEL_PATH_DISABLE_STATION_GEOCODE: "1",
    },
    async () => {
      const mockFetch = installFetchMock(() =>
        jsonResponse({ error: { message: "Should not call external provider when exact index match exists" } }, 500),
      );

      const result = await geocode({
        query: "Lot 89 Hospital Road Coober Pedy SA 5723",
        limit: 5,
        sessionToken: "place-intent-hospital-session",
      });

      assert.equal(result.location.provider, "fuel_path_gnaf");
      assert.equal(result.location.matchType, "exact_address");
      assert.equal(result.location.label, "Lot 89, Hospital Road, Coober Pedy SA 5723");
      assert.equal(mockFetch.calls.length, 0);

      mockFetch.restore();
    },
  );
});

test("ambiguous multi-state Bowes Street unit query prefers exact state-locality match", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-place-intent-bowes-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-place-intent-bowes.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|BUILDING_NAME|FLAT_TYPE|FLAT_NUMBER|LEVEL_TYPE|LEVEL_NUMBER|NUMBER_FIRST|NUMBER_FIRST_SUFFIX|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GATAS700900001|Queenstown Scout Hall, 15 Bowes Street, Queenstown TAS 7467| | | | | |15| |Bowes|Street|Queenstown|TAS|7467|PROPERTY CENTROID|145.55966148|-42.0797863",
      "GAACT700900002|L 2, 15 Bowes Street, Phillip ACT 2606| | | |L|2|15| |Bowes|Street|Phillip|ACT|2606|PROPERTY CENTROID|149.0841|-35.3081",
    ].join("\n"),
  );

  execFileSync(
    process.execPath,
    [
      "scripts/build-gnaf-address-index.mjs",
      "--input",
      inputPath,
      "--output",
      outputPath,
      "--omit-legacy-fts",
      "--omit-search-backstop",
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "nominatim",
      FUEL_PATH_GNAF_SQLITE_PATH: outputPath,
      FUEL_PATH_DISABLE_STATION_GEOCODE: "1",
    },
    async () => {
      const mockFetch = installFetchMock(() =>
        jsonResponse({ error: { message: "Should not call external provider when exact index match exists" } }, 500),
      );

      const result = await geocode({
        query: "Queenstown Scout Hall 15 Bowes Street Queenstown TAS 7467",
        limit: 5,
        sessionToken: "place-intent-bowes-session",
      });

      assert.equal(result.location.provider, "fuel_path_gnaf");
      assert.equal(result.location.matchType, "exact_address");
      assert.equal(result.location.label, "Queenstown Scout Hall, 15 Bowes Street, Queenstown TAS 7467");
      assert.equal(result.location.state, "TAS");
      assert.equal(result.location.postcode, "7467");
      assert.equal(mockFetch.calls.length, 0);

      mockFetch.restore();
    },
  );
});

test("curated local hints outrank broad regional fallbacks", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Unexpected provider call" } }, 500),
    );

    const suburb = await geocode({
      query: "Mawson Lakes",
      limit: 5,
      sessionToken: "mawson-lakes-session",
    });
    const interchange = await geocode({
      query: "Mawson Lakes Interchange",
      limit: 5,
      sessionToken: "mawson-lakes-interchange-session",
    });

    assert.equal(suburb.lookupStatus, "ok");
    assert.equal(suburb.location.label, "Mawson Lakes SA 5095");
    assert.equal(suburb.location.provider, "fuel_path_hint");
    assert.equal(interchange.lookupStatus, "ok");
    assert.equal(interchange.location.label, "Mawson Lakes Interchange, Mawson Lakes SA 5095");
    assert.equal(interchange.location.provider, "fuel_path_hint");
    assert.equal(mockFetch.calls.length, 0);

    mockFetch.restore();
  });
});

test("configured production provider outranks street-level fallback for precise addresses", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "geoapify",
      FUEL_PATH_GEOAPIFY_API_KEY: "test-geoapify-key",
    },
    async () => {
      const mockFetch = installFetchMock(() =>
        jsonResponse({
          features: [
            {
              properties: {
                formatted: "100 Queen Street, Brisbane QLD 4000, Australia",
                lat: -27.4708,
                lon: 153.0245,
                result_type: "building",
                place_id: "geoapify-queen-street-100",
              },
            },
          ],
        }),
      );

      const result = await geocode({
        query: "100 Queen Street Brisbane QLD",
        limit: 5,
        sessionToken: "provider-first-session",
      });

      assert.equal(result.lookupStatus, "ok");
      assert.equal(result.location.label, "100 Queen Street, Brisbane QLD 4000, Australia");
      assert.equal(result.location.provider, "geoapify");
      assert.equal(result.suggestions[1].label, "Queen Street, Brisbane QLD 4000");
      assert.equal(mockFetch.calls.length, 1);

      mockFetch.restore();
    },
  );
});

test("regional gazetteer blocks same-state wrong-town street fallback", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Too many requests" } }, 429),
    );

    const result = await geocode({
      query: "1 Church Street Mudgee NSW",
      limit: 5,
      sessionToken: "regional-mudgee-session",
    });

    assert.equal(result.lookupStatus, "local_fallback");
    assert.equal(result.location.label, "Church Street, Mudgee NSW 2850");
    assert.equal(result.location.provider, "fuel_path_regional_gazetteer");
    assert.equal(result.location.matchType, "regional_street_locality");
    assert.equal(
      result.suggestions.some((item) => item.label === "Church Street, Parramatta NSW 2150"),
      false,
    );

    mockFetch.restore();
  });
});

test("regional street fallback waits for a specific locality prefix before suggesting a town", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Too many requests" } }, 429),
    );

    const weakCommercial = await geocode({
      query: "1 Commercial Street M",
      limit: 5,
      sessionToken: "regional-street-weak-commercial",
    });
    assert.equal(
      weakCommercial.suggestions.some((item) => item.type === "street" && /Armidale|Mudgee|Maitland/.test(item.label)),
      false,
    );

    const weakCuratedStreet = await geocode({
      query: "1 Flinders Street",
      limit: 5,
      sessionToken: "regional-street-weak-curated",
    });
    assert.equal(
      weakCuratedStreet.suggestions.some((item) => item.provider === "fuel_path_hint" && item.type === "street"),
      false,
    );

    const partialMurrayStreet = await geocode({
      query: "Murray S",
      limit: 5,
      sessionToken: "regional-street-partial-murray",
    });
    assert.equal(
      partialMurrayStreet.suggestions.some((item) => item.provider === "fuel_path_hint" && item.type === "street"),
      false,
    );

    const weakMurrayStreet = await geocode({
      query: "Murray Street Ga",
      limit: 5,
      sessionToken: "regional-street-weak-murray",
    });
    assert.equal(
      weakMurrayStreet.suggestions.some((item) => item.provider === "fuel_path_hint" && item.type === "street"),
      false,
    );

    const partialWallarooStreet = await geocode({
      query: "Murray Street Wa",
      limit: 5,
      sessionToken: "regional-street-partial-wallaroo",
    });
    assert.equal(
      partialWallarooStreet.suggestions.some((item) => item.label === "Murray Street, Perth WA 6000"),
      false,
    );

    const strongMurrayStreet = await geocode({
      query: "Murray Street Gaw",
      limit: 5,
      sessionToken: "regional-street-strong-murray",
    });
    assert.equal(strongMurrayStreet.lookupStatus, "local_fallback");
    assert.equal(strongMurrayStreet.location.label, "Murray Street, Gawler SA 5118");
    assert.equal(strongMurrayStreet.location.matchType, "regional_street_locality");

    const disambiguatedCuratedStreet = await geocode({
      query: "Murray Street Perth",
      limit: 5,
      sessionToken: "regional-street-disambiguated-murray",
    });
    assert.equal(disambiguatedCuratedStreet.location.label, "Murray Street, Perth WA 6000");
    assert.equal(disambiguatedCuratedStreet.location.provider, "fuel_path_hint");

    const stateDisambiguatedCuratedStreet = await geocode({
      query: "Murray Street WA",
      limit: 5,
      sessionToken: "regional-street-state-murray",
    });
    assert.equal(stateDisambiguatedCuratedStreet.location.label, "Murray Street, Perth WA 6000");
    assert.equal(stateDisambiguatedCuratedStreet.location.provider, "fuel_path_hint");

    const strongCommercial = await geocode({
      query: "1 Commercial Street Mount G",
      limit: 5,
      sessionToken: "regional-street-strong-commercial",
    });
    assert.equal(strongCommercial.lookupStatus, "local_fallback");
    assert.equal(strongCommercial.location.label, "Commercial Street, Mount Gambier SA 5290");
    assert.equal(strongCommercial.location.matchType, "regional_street_locality");

    const weakTownhouse = await geocode({
      query: "Townhouse 2 26 Hibberson Street B",
      limit: 5,
      sessionToken: "regional-street-weak-townhouse",
    });
    assert.equal(
      weakTownhouse.suggestions.some((item) => item.type === "street" && /Dubbo|Burnie|Bendigo/.test(item.label)),
      false,
    );

    const strongTownhouse = await geocode({
      query: "Townhouse 2 26 Hibberson Street Bel",
      limit: 5,
      sessionToken: "regional-street-strong-townhouse",
    });
    assert.equal(strongTownhouse.lookupStatus, "local_fallback");
    assert.equal(strongTownhouse.location.label, "Hibberson Street, Belconnen ACT 2617");
    assert.equal(strongTownhouse.location.matchType, "regional_street_locality");

    mockFetch.restore();
  });
});

test("regional gazetteer resolves hard rural broad searches and POIs without provider help", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Too many requests" } }, 429),
    );

    const town = await geocode({
      query: "Kalgoorlie WA",
      limit: 5,
      sessionToken: "regional-town-session",
    });
    const poi = await geocode({
      query: "Taronga Western Plains Zoo Dubbo",
      limit: 5,
      sessionToken: "regional-poi-session",
    });

    assert.equal(town.lookupStatus, "ok");
    assert.equal(town.location.label, "Kalgoorlie WA 6430");
    assert.equal(town.location.provider, "fuel_path_regional_gazetteer");

    assert.equal(poi.lookupStatus, "ok");
    assert.equal(poi.location.label, "Taronga Western Plains Zoo Dubbo");
    assert.equal(poi.location.provider, "fuel_path_regional_gazetteer");
    assert.equal(mockFetch.calls.length, 0);

    mockFetch.restore();
  });
});

test("regional POI names outrank their town fallback in benchmark-style queries", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Too many requests" } }, 429),
    );

    const cases = [
      ["National Arboretum Canberra near Stromlo", "National Arboretum Canberra, Stromlo ACT 2611"],
      ["Sovereign Hill Ballarat near Ballarat", "Sovereign Hill Ballarat"],
      ["Bairnsdale Regional Health Service Australia", "Bairnsdale Regional Health Service"],
      ["Smithton District Hospital TAS", "Smithton District Hospital"],
      ["Newcastle Airport Williamtown NSW", "Newcastle Airport Williamtown"],
      ["Sunshine Coast University Hospital QLD", "Sunshine Coast University Hospital"],
      ["Mandurah Forum WA", "Mandurah Forum"],
      ["Alice Springs Airport NT", "Alice Springs Airport"],
    ];

    for (const [query, expectedLabel] of cases) {
      const result = await geocode({
        query,
        limit: 5,
        sessionToken: `regional-poi-top-${query}`,
      });

      assert.equal(result.suggestions[0].label, expectedLabel);
      assert.equal(result.suggestions[0].provider, "fuel_path_regional_gazetteer");
      assert.equal(result.suggestions[0].type, "regional_poi");
    }

    mockFetch.restore();
  });
});

test("regional street fallback understands Australian street abbreviations", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Too many requests" } }, 429),
    );

    const cases = [
      ["Harbour Tce Wollongong NSW", "Harbour Terrace, Wollongong NSW 2500"],
      ["Ocean Pkwy Geelong VIC", "Ocean Parkway, Geelong VIC 3220"],
      ["Main Cct Belconnen ACT", "Main Circuit, Belconnen ACT 2617"],
      ["Foreshore Esp Devonport TAS", "Foreshore Esplanade, Devonport TAS 7310"],
    ];

    for (const [query, expectedLabel] of cases) {
      const result = await geocode({
        query,
        limit: 5,
        sessionToken: `regional-street-abbrev-${query}`,
      });

      assert.equal(result.suggestions[0].label, expectedLabel, query);
      assert.equal(result.suggestions[0].provider, "fuel_path_regional_gazetteer", query);
      assert.equal(result.suggestions[0].type, "street", query);
    }

    mockFetch.restore();
  });
});

test("hosted G-NAF address suggestions do not outrank exact regional POI names", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "nominatim",
      FUEL_PATH_GNAF_API_URL: "https://gnaf.example.test",
      FUEL_PATH_GNAF_API_TOKEN: "test-token",
    },
    async () => {
      const mockFetch = installFetchMock((input) => {
        const url = String(input);
        if (url.startsWith("https://gnaf.example.test/")) {
          const query = new URL(url).searchParams.get("q") || "";
          const wrongLabel = query.includes("Broome International Airport")
            ? "Sydney International Airport, 10 Arrival Court, Mascot NSW 2020"
            : query.includes("Willow Court New Norfolk")
              ? "26 Willow Court, Bega NSW 2550"
              : "6 Australia Avenue, Berrima NSW 2577";
          return jsonResponse({
            suggestions: [
              {
                id: "wrong-address",
                label: wrongLabel,
                lat: -34.491,
                lon: 150.338,
                state: "NSW",
                postcode: "2577",
                matchType: "address_fuzzy",
                score: 760,
              },
            ],
          });
        }
        return jsonResponse({ error: { message: "Too many requests" } }, 429);
      });

      const cases = [
        ["Jenolan Caves NSW Australia", "Jenolan Caves NSW"],
        ["Broome International Airport near Broome", "Broome International Airport"],
        ["Willow Court New Norfolk near New Norfolk", "Willow Court New Norfolk"],
      ];

      for (const [query, expectedTop] of cases) {
        const result = await geocode({
          query,
          limit: 5,
          sessionToken: `hosted-gnaf-poi-merge-${query}`,
        });

        assert.equal(result.suggestions[0].label, expectedTop, query);
        assert.equal(result.suggestions[0].provider, "fuel_path_regional_gazetteer", query);
        assert.equal(result.suggestions[0].type, "regional_poi", query);
        assert.notEqual(result.suggestions[0].providerId, "wrong-address", query);
        assert.ok(
          result.suggestions.some((item) => item.providerId === "wrong-address"),
          "keeps hosted address suggestions available without ranking them above the intended POI",
        );
      }

      mockFetch.restore();
    },
  );
});

test("state-suffixed local city and POI hints stay strong under provider outage", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Unexpected provider call" } }, 500),
    );

    const cases = [
      ["Melbourne CBD VIC", "Melbourne CBD, Melbourne VIC"],
      ["Brisbane CBD QLD", "Brisbane CBD, Brisbane QLD"],
      ["Perth CBD WA", "Perth CBD, Perth WA"],
      ["Adelaide CBD SA", "Adelaide CBD, Adelaide SA"],
      ["Hobart CBD TAS", "Hobart CBD, Hobart TAS"],
      ["Darwin CBD NT", "Darwin CBD, Darwin NT"],
      ["Sydney Airport NSW", "Sydney Airport, Mascot NSW 2020"],
      ["Artamon NSW", "Artarmon NSW 2064"],
    ];

    for (const [query, expectedLabel] of cases) {
      const result = await geocode({
        query,
        limit: 5,
        sessionToken: `state-suffix-${query}`,
      });
      assert.equal(result.lookupStatus, "ok", query);
      assert.equal(result.location.label, expectedLabel, query);
      assert.equal(result.location.provider, "fuel_path_hint", query);
      assert.equal(result.degraded, false, query);
    }

    assert.equal(mockFetch.calls.length, 0);
    mockFetch.restore();
  });
});

test("disambiguated POI and airport prefixes rank top under provider outage", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Unexpected provider call" } }, 500),
    );

    const cases = [
      ["Sydney Air", "Sydney Airport, Mascot NSW 2020"],
      ["Melbourne Air", "Melbourne Airport, Tullamarine VIC 3045"],
      ["Perth Air", "Perth Airport, Perth Airport WA 6105"],
      ["Canberra Ce", "Canberra Centre, Canberra ACT 2601"],
      ["Melbourne Cr", "Melbourne Cricket Ground, East Melbourne VIC 3002"],
    ];

    for (const [query, expectedLabel] of cases) {
      const result = await geocode({
        query,
        limit: 5,
        sessionToken: `intent-prefix-${query}`,
      });
      assert.equal(result.lookupStatus, "ok", query);
      assert.equal(result.location.label, expectedLabel, query);
      assert.equal(result.location.provider, "fuel_path_hint", query);
      assert.equal(result.location.matchType, "hint_prefix", query);
      assert.equal(result.degraded, false, query);
    }

    assert.equal(mockFetch.calls.length, 0);
    mockFetch.restore();
  });
});

test("local ranking favours visible primary names over alias-only prefix matches", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Unexpected provider call" } }, 500),
    );

    const broadCity = await geocode({
      query: "Can",
      limit: 5,
      sessionToken: "primary-name-broad-canberra",
    });
    const centre = await geocode({
      query: "Canberra C",
      limit: 5,
      sessionToken: "primary-name-canberra-centre",
    });
    const cityAlias = await geocode({
      query: "Canberra City",
      limit: 5,
      sessionToken: "primary-name-canberra-city",
    });

    assert.equal(broadCity.location.label, "Canberra ACT");
    assert.equal(centre.location.label, "Canberra Centre, Canberra ACT 2601");
    assert.equal(cityAlias.location.label, "Civic, Canberra ACT 2601");
    assert.equal(mockFetch.calls.length, 0);

    mockFetch.restore();
  });
});

test("generic regional prefixes prefer towns while explicit POI intent still wins", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Unexpected provider call" } }, 500),
    );

    const cases = [
      ["Ger", "Geraldton WA 6530"],
      ["Geraldton A", "Geraldton Airport"],
      ["Dev", "Devonport TAS 7310"],
      ["Sunshine", "Sunshine Coast QLD 4558"],
      ["Mel", "Melbourne CBD, Melbourne VIC"],
      ["Melbourne Cr", "Melbourne Cricket Ground, East Melbourne VIC 3002"],
    ];

    for (const [query, expectedLabel] of cases) {
      const result = await geocode({
        query,
        limit: 5,
        sessionToken: `generic-town-poi-intent-${query}`,
      });
      assert.equal(result.lookupStatus, "ok", query);
      assert.equal(result.location.label, expectedLabel, query);
      assert.equal(result.degraded, false, query);
    }

    assert.equal(mockFetch.calls.length, 0);
    mockFetch.restore();
  });
});

test("national regional towns resolve without validation provider availability", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Unexpected provider call" } }, 500),
    );

    const cases = [
      ["Wollongong NSW", "Wollongong NSW 2500"],
      ["Geelong VIC", "Geelong VIC 3220"],
      ["Ballarat VIC", "Ballarat VIC 3350"],
      ["Gold Coast QLD", "Gold Coast QLD"],
      ["Sunshine Coast QLD", "Sunshine Coast QLD 4558"],
      ["Launceston TAS", "Launceston TAS 7250"],
      ["Alice Springs NT", "Alice Springs NT 0870"],
      ["Katherine NT", "Katherine NT 0850"],
    ];

    for (const [query, expectedLabel] of cases) {
      const result = await geocode({
        query,
        limit: 5,
        sessionToken: `national-town-${query}`,
      });
      assert.equal(result.lookupStatus, "ok", query);
      assert.equal(result.location.label, expectedLabel, query);
      assert.equal(result.degraded, false, query);
      assert.match(result.location.provider, /fuel_path_(hint|regional_gazetteer)/, query);
    }

    assert.equal(mockFetch.calls.length, 0);
    mockFetch.restore();
  });
});

test("remote, island and generic town-centre lookups resolve from the no-cost gazetteer", async () => {
  await withGeocodeEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const mockFetch = installFetchMock(() =>
      jsonResponse({ error: { message: "Unexpected provider call" } }, 500),
    );

    const cases = [
      ["Lord Howe Island NSW Australia", "Lord Howe Island NSW 2898"],
      ["Thursday Island QLD", "Thursday Island QLD 4875"],
      ["Rottnest Island WA Australia", "Rottnest Island WA 6161"],
      ["Kangaroo Island SA", "Kangaroo Island SA 5223"],
      ["Nullarbor Roadhouse SA Australia", "Nullarbor Roadhouse SA 5690"],
      ["Roma town centre", "Roma QLD 4455"],
      ["Cotter Reserve ACT", "Cotter Reserve ACT"],
    ];

    for (const [query, expectedLabel] of cases) {
      const result = await geocode({
        query,
        limit: 5,
        sessionToken: `remote-gazetteer-${query}`,
      });
      assert.equal(result.lookupStatus, "ok", query);
      assert.equal(result.location.label, expectedLabel, query);
      assert.equal(result.location.provider, "fuel_path_regional_gazetteer", query);
      assert.equal(result.degraded, false, query);
    }

    assert.equal(mockFetch.calls.length, 0);
    mockFetch.restore();
  });
});

test("geocode cache avoids repeated provider calls for the same query", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "geoapify",
      FUEL_PATH_GEOAPIFY_API_KEY: "test-geoapify-key",
    },
    async () => {
    const query = `Cacheable Place ${Date.now()}`;
    const mockFetch = installFetchMock(() =>
      jsonResponse({
        features: [
          {
            properties: {
              formatted: "Cacheable Place, Sydney NSW, Australia",
              lat: -33.86,
              lon: 151.21,
              result_type: "amenity",
              place_id: "cacheable-place",
            },
          },
        ],
      }),
    );

    const first = await geocode({ query, limit: 5, sessionToken: "first" });
    const second = await geocode({ query, limit: 5, sessionToken: "second" });

    assert.equal(first.lookupStatus, "ok");
    assert.equal(second.cache, "hit");
    assert.equal(second.cacheMode, "fresh");
    assert.equal(second.providerHealth.geoapify.cacheMode, "fresh");
    assert.equal(second.degraded, false);
    assert.equal(second.sessionToken, "second");
    assert.equal(second.location.label, first.location.label);
    assert.equal(mockFetch.calls.length, 1);

    mockFetch.restore();
    },
  );
});

test("geocode cache trims oldest unique lookups when max entries is reached", async () => {
  await withGeocodeEnv(
    {
      FUEL_PATH_GEOCODE_PROVIDER: "geoapify",
      FUEL_PATH_GEOAPIFY_API_KEY: "test-geoapify-key",
      FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES: "1",
    },
    async () => {
      const suffix = Date.now();
      const queryA = `Cache Eviction Place A ${suffix}`;
      const queryB = `Cache Eviction Place B ${suffix}`;
      const mockFetch = installFetchMock((input) => {
        const url = new URL(String(input));
        const text = url.searchParams.get("text") || "Cache Eviction Place";
        return jsonResponse({
          features: [
            {
              properties: {
                formatted: `${text}, Sydney NSW, Australia`,
                lat: -33.86,
                lon: 151.21,
                result_type: "amenity",
                place_id: text,
              },
            },
          ],
        });
      });

      await geocode({ query: queryA, limit: 5, sessionToken: "first-a" });
      await geocode({ query: queryB, limit: 5, sessionToken: "first-b" });
      const secondA = await geocode({ query: queryA, limit: 5, sessionToken: "second-a" });

      assert.equal(secondA.cache, "miss");
      assert.equal(secondA.location.label, `${queryA}, Sydney NSW, Australia`);
      assert.equal(mockFetch.calls.length, 3);

      mockFetch.restore();
    },
  );
});

function installFetchMock(handler) {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (input, options = {}) => {
    calls.push({ input: String(input), options });
    return handler(input, options);
  };
  return {
    calls,
    restore() {
      global.fetch = originalFetch;
    },
  };
}

function installConsoleSpy() {
  const entries = [];
  const previous = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  const record = (level) => (...args) => {
    entries.push({ level, args });
  };

  console.log = record("log");
  console.warn = record("warn");
  console.error = record("error");
  console.info = record("info");
  console.debug = record("debug");

  return {
    calls: entries,
    restore() {
      console.log = previous.log;
      console.warn = previous.warn;
      console.error = previous.error;
      console.info = previous.info;
      console.debug = previous.debug;
    },
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    async text() {
      return JSON.stringify(payload);
    },
    async json() {
      return payload;
    },
  };
}

async function withGeocodeEnv(overrides, callback) {
  const keys = [
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
    "FUEL_PATH_GNAF_API_URL",
    "FUEL_PATH_GNAF_API_TOKEN",
    "FUEL_PATH_GNAF_DATABASE_URL",
    "FUEL_PATH_GNAF_SQLITE_PATH",
    "FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES",
    "FUEL_PATH_DISABLE_STATION_GEOCODE",
    "FUEL_PATH_WA_FUELWATCH_ENABLED",
  ];
  const originalEnv = {};
  for (const key of keys) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.FUEL_PATH_WA_FUELWATCH_ENABLED = "0";
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
