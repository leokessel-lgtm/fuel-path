const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const {
  addressIndexStatus,
  addressSearchNeedles,
  normaliseAddressText,
  searchAddressIndex,
  shouldSearchLargeSqliteIndex,
  sqliteFtsTermsForNeedle,
} = require("../../api/_addressIndex");
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

test("seeded AU address index handles abbreviations and suburb context", async () => {
  const suggestions = await searchAddressIndex("87a corea st sylvania nsw 2224", 3);

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
    const suggestions = await searchAddressIndex("66b easton ave sylvania", 3);

    assert.equal(status.mode, "sqlite");
    assert.equal(suggestions[0].label, "66B Easton Avenue, Sylvania NSW 2224");
    assert.equal(suggestions[0].provider, "fuel_path_gnaf");
  });
});

test("G-NAF Core shaped rows index unit and slash address variants", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-core-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-core.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      [
        "ADDRESS_DETAIL_PID",
        "ADDRESS_LABEL",
        "FLAT_TYPE",
        "FLAT_NUMBER",
        "NUMBER_FIRST",
        "NUMBER_FIRST_SUFFIX",
        "STREET_NAME",
        "STREET_TYPE",
        "LOCALITY_NAME",
        "STATE",
        "POSTCODE",
        "ALIAS_PRINCIPAL",
        "PRIMARY_SECONDARY",
        "GEOCODE_TYPE",
        "LONGITUDE",
        "LATITUDE",
      ].join("|"),
      [
        "GATEST0001",
        "Unit 5, 34 South Coast Highway, Karratha WA 6714",
        "Unit",
        "5",
        "34",
        "",
        "South Coast",
        "Highway",
        "Karratha",
        "WA",
        "6714",
        "PRINCIPAL",
        "SECONDARY",
        "PROPERTY CENTROID",
        "116.846",
        "-20.736",
      ].join("|"),
      [
        "GATEST0002",
        "87A Corea Street, Sylvania NSW 2224",
        "",
        "",
        "87",
        "A",
        "Corea",
        "Street",
        "Sylvania",
        "NSW",
        "2224",
        "PRINCIPAL",
        "PRIMARY",
        "PROPERTY CENTROID",
        "151.0997397",
        "-34.0153146",
      ].join("|"),
      [
        "GATEST0003",
        "51 Princes Highway, Sylvania NSW 2224",
        "",
        "",
        "51",
        "",
        "Princes",
        "Highway",
        "Sylvania",
        "NSW",
        "2224",
        "PRINCIPAL",
        "PRIMARY",
        "PROPERTY CENTROID",
        "151.11144796",
        "-34.00692907",
      ].join("|"),
      [
        "GATEST0004",
        "Adina Serviced Apartments Canberra James Court, Unit 77, 74 Northbourne Avenue, Braddon ACT 2612",
        "Unit",
        "77",
        "74",
        "",
        "Northbourne",
        "Avenue",
        "Braddon",
        "ACT",
        "2612",
        "PRINCIPAL",
        "SECONDARY",
        "PROPERTY CENTROID",
        "149.1323",
        "-35.2749",
      ].join("|"),
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
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath }, async () => {
    const unitSuggestions = await searchAddressIndex("5/34 south coast highway karratha", 3);
    const suffixSuggestions = await searchAddressIndex("87a corea street sylvania", 3);
    const highwaySuggestions = await searchAddressIndex("51 Princes Hwy, Sylvania NSW 2224", 3);
    const complexSuggestions = await searchAddressIndex(
      "Adina Serviced Apartments Canberra James Court Unit 77 74 Northbourne Ave Braddon ACT",
      3,
    );

    assert.equal(unitSuggestions[0].label, "Unit 5, 34 South Coast Highway, Karratha WA 6714");
    assert.equal(unitSuggestions[0].provider, "fuel_path_gnaf");
    assert.equal(unitSuggestions[0].displayTitle, "Unit 5");
    assert.equal(unitSuggestions[0].displaySubtitle, "34 South Coast Highway, Karratha WA 6714");
    assert.equal(unitSuggestions[0].sourceLabel, "Exact address");
    assert.equal(suffixSuggestions[0].label, "87A Corea Street, Sylvania NSW 2224");
    assert.equal(highwaySuggestions[0].label, "51 Princes Highway, Sylvania NSW 2224");
    assert.equal(highwaySuggestions[0].matchType, "exact_address");
    assert.equal(
      complexSuggestions[0].label,
      "Adina Serviced Apartments Canberra James Court, Unit 77, 74 Northbourne Avenue, Braddon ACT 2612",
    );
    assert.equal(complexSuggestions[0].provider, "fuel_path_gnaf");
    assert.equal(complexSuggestions[0].displayTitle, "Adina Serviced Apartments Canberra James Court, Unit 77");
    assert.equal(complexSuggestions[0].displaySubtitle, "74 Northbourne Avenue, Braddon ACT 2612");
  });
});

test("address normalisation covers common Australian street abbreviations", () => {
  assert.equal(normaliseAddressText("51 Princes Hwy, Sylvania NSW 2224"), "51 princes highway sylvania nsw 2224");
  assert.equal(normaliseAddressText("10 Smith Cct, Bruce ACT"), "10 smith circuit bruce act");
  assert.equal(normaliseAddressText("3 Harbour Tce & Cnr Bay Rd"), "3 harbour terrace corner bay road");
  assert.equal(normaliseAddressText("8 Ocean Pkwy, Mt Martha VIC"), "8 ocean parkway mount martha vic");
});

test("complex unit queries produce address-core search needles", () => {
  const needles = addressSearchNeedles(
    "Adina Serviced Apartments Canberra James Court Unit 77 74 Northbourne Ave Braddon ACT",
  ).map((item) => item.needle);

  assert.ok(needles.includes("unit 77 74 northbourne avenue braddon act"));
  assert.ok(needles.includes("74 northbourne avenue braddon act"));
});

test("large G-NAF SQLite searches skip broad prefixes and drop noisy address tokens", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-large-gate-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-large-gate.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|FLAT_TYPE|FLAT_NUMBER|NUMBER_FIRST|NUMBER_FIRST_SUFFIX|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GATEST0001|Unit 8, 21 Lanyon Drive, Tuggeranong ACT 2900|Unit|8|21||Lanyon|Drive|Tuggeranong|ACT|2900|PROPERTY CENTROID|149.065|-35.414",
      "GATEST0002|66B Easton Avenue, Sylvania NSW 2224|||66|B|Easton|Avenue|Sylvania|NSW|2224|PROPERTY CENTROID|151.0993847|-34.0114122",
      "GATEST0003|Townhouse 3, 44 Beltana Road, Pialligo ACT 2609|Townhouse|3|44||Beltana|Road|Pialligo|ACT|2609|PROPERTY CENTROID|149.181|-35.302",
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
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  assert.equal(shouldSearchLargeSqliteIndex("22 pat"), false);
  assert.equal(shouldSearchLargeSqliteIndex("22 paterson tennant"), true);
  assert.deepEqual(sqliteFtsTermsForNeedle("Townhouse 3 44 Beltana Road Pialligo"), ["44", "beltana", "pialligo"]);
  assert.deepEqual(sqliteFtsTermsForNeedle("8/21 Lanyon Drive Tuggeranong ACT"), ["21", "lanyon", "tuggeranong", "act"]);
  assert.deepEqual(sqliteFtsTermsForNeedle("Unit 1005 3-5 Gardiner Street Darwin City NT"), ["1005", "3", "5", "gardiner", "darwin", "city", "nt"]);

  await withEnv(
    {
      FUEL_PATH_GNAF_SQLITE_PATH: outputPath,
      FUEL_PATH_GNAF_LARGE_SQLITE_BYTES: "1",
    },
    async () => {
      assert.deepEqual(await searchAddressIndex("22 pat", 3), []);

      const unitSuggestions = await searchAddressIndex("8/21 Lanyon Drive Tuggeranong ACT", 3);
      const suffixSuggestions = await searchAddressIndex("66B Easton Avenue Sylvania", 3);
      const townhouseSuggestions = await searchAddressIndex("Townhouse 3 44 Beltana Road Pialligo", 3);

      assert.equal(unitSuggestions[0].label, "Unit 8, 21 Lanyon Drive, Tuggeranong ACT 2900");
      assert.equal(suffixSuggestions[0].label, "66B Easton Avenue, Sylvania NSW 2224");
      assert.equal(townhouseSuggestions[0].label, "Townhouse 3, 44 Beltana Road, Pialligo ACT 2609");
    },
  );
});

test("G-NAF SQLite exact address ranking beats nearby house numbers", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-exact-rank-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-exact-rank.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GATEST0012|12 Adelaide Street, Balgowlah Heights NSW 2093|12|Adelaide|Street|Balgowlah Heights|NSW|2093|PROPERTY CENTROID|151.2581|-33.8071",
      "GATEST0001|1 Adelaide Street, Balgowlah Heights NSW 2093|1|Adelaide|Street|Balgowlah Heights|NSW|2093|PROPERTY CENTROID|151.2589|-33.8079",
      "GATEST0011|11 Adelaide Street, Balgowlah Heights NSW 2093|11|Adelaide|Street|Balgowlah Heights|NSW|2093|PROPERTY CENTROID|151.2583|-33.8073",
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
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath }, async () => {
    const suggestions = await searchAddressIndex("1 Adelaide Street Balgowlah Heights NSW 2093", 3);

    assert.equal(suggestions[0].label, "1 Adelaide Street, Balgowlah Heights NSW 2093");
    assert.equal(suggestions[0].matchType, "exact_address");
  });
});

test("hybrid typeahead avoids same-street wrong locality and preserves exact unit intent", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-hybrid-safety-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-hybrid-safety.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      [
        "ADDRESS_DETAIL_PID",
        "ADDRESS_LABEL",
        "BUILDING_NAME",
        "FLAT_TYPE",
        "FLAT_NUMBER",
        "NUMBER_FIRST",
        "STREET_NAME",
        "STREET_TYPE",
        "LOCALITY_NAME",
        "STATE",
        "POSTCODE",
        "GEOCODE_TYPE",
        "LONGITUDE",
        "LATITUDE",
      ].join("|"),
      [
        "GAACT0201",
        "279 Canberra Avenue, Symonston ACT 2609",
        "",
        "",
        "",
        "279",
        "Canberra",
        "Avenue",
        "Symonston",
        "ACT",
        "2609",
        "PROPERTY CENTROID",
        "149.160",
        "-35.346",
      ].join("|"),
      [
        "GAACT0202",
        "279 Canberra Avenue, Fyshwick ACT 2609",
        "",
        "",
        "",
        "279",
        "Canberra",
        "Avenue",
        "Fyshwick",
        "ACT",
        "2609",
        "PROPERTY CENTROID",
        "149.171",
        "-35.331",
      ].join("|"),
      [
        "GAACT0203",
        "Canberra Lakes Estate, Unit 65, 11 Joy Cummings Place, Belconnen ACT 2617",
        "Canberra Lakes Estate",
        "Unit",
        "65",
        "11",
        "Joy Cummings",
        "Place",
        "Belconnen",
        "ACT",
        "2617",
        "PROPERTY CENTROID",
        "149.079",
        "-35.240",
      ].join("|"),
      [
        "GAACT0204",
        "Canberra Lakes Estate, Unit 8, 11 Joy Cummings Place, Belconnen ACT 2617",
        "Canberra Lakes Estate",
        "Unit",
        "8",
        "11",
        "Joy Cummings",
        "Place",
        "Belconnen",
        "ACT",
        "2617",
        "PROPERTY CENTROID",
        "149.080",
        "-35.241",
      ].join("|"),
      [
        "GANT0205",
        "100 Smith Street, Darwin City NT 0800",
        "",
        "",
        "",
        "100",
        "Smith",
        "Street",
        "Darwin City",
        "NT",
        "0800",
        "PROPERTY CENTROID",
        "130.841",
        "-12.463",
      ].join("|"),
      [
        "GAQLD0206",
        "Shop 8, 110 Queen Street, Brisbane City QLD 4000",
        "",
        "Shop",
        "8",
        "110",
        "Queen",
        "Street",
        "Brisbane City",
        "QLD",
        "4000",
        "PROPERTY CENTROID",
        "153.025",
        "-27.468",
      ].join("|"),
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
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath }, async () => {
    const symonstonSuggestions = await searchAddressIndex("279 Canberra Avenue Symonston", 3);
    const unitSuggestions = await searchAddressIndex("Canberra Lakes Estate Unit 65 11 Joy Cummings Place Belconnen", 3);
    const baseSuggestions = await searchAddressIndex("Canberra Lakes Estate", 3);
    const missingSmithSuggestions = await searchAddressIndex("10 Smith Street Darwin NT", 3);
    const missingQueenSuggestions = await searchAddressIndex("8 Queen Street Brisbane QLD", 3);

    assert.equal(symonstonSuggestions[0].label, "279 Canberra Avenue, Symonston ACT 2609");
    assert.equal(unitSuggestions[0].label, "Canberra Lakes Estate, Unit 65, 11 Joy Cummings Place, Belconnen ACT 2617");
    assert.equal(unitSuggestions[0].refineRequired, false);
    assert.equal(baseSuggestions[0].refineRequired, true);
    assert.equal(baseSuggestions[0].sourceLabel, "Building");
    assert.deepEqual(missingSmithSuggestions, []);
    assert.deepEqual(missingQueenSuggestions, []);
  });
});

test("geocode search context promotes nearby ambiguous G-NAF address", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-context-rank-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-context-rank.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GAWA1001|8 Chamberlain Place, Augusta WA 6290|8|Chamberlain|Place|Augusta|WA|6290|PROPERTY CENTROID|115.159|-34.315",
      "GAWA1002|8 Chamberlain Place, Heathridge WA 6027|8|Chamberlain|Place|Heathridge|WA|6027|PROPERTY CENTROID|115.763|-31.760",
      "GAACT1003|Rose Cottage Inn, 1 Isabella Drive, Tuggeranong ACT 2900|1|Isabella|Drive|Tuggeranong|ACT|2900|PROPERTY CENTROID|149.144|-35.405",
      "GAACT1004|Rose Cottage Inn, 1 Isabella Drive, Gilmore ACT 2905|1|Isabella|Drive|Gilmore|ACT|2905|PROPERTY CENTROID|149.142|-35.406",
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

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath, FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const uncontextualised = await geocode({
      query: "8 Chamberlain Place",
      limit: 2,
      sessionToken: "context-rank-none",
    });
    const contextualised = await geocode({
      query: "8 Chamberlain Place",
      limit: 2,
      sessionToken: "context-rank-near",
      searchContext: {
        nearLat: -31.760,
        nearLon: 115.763,
        nearRadiusKm: 40,
      },
    });
    const buildingNameContextualised = await geocode({
      query: "Rose Cottage Inn",
      limit: 2,
      sessionToken: "context-rank-building-name",
      searchContext: {
        nearLat: -35.405,
        nearLon: 149.144,
        nearRadiusKm: 40,
      },
    });

    assert.equal(uncontextualised.suggestions[0].label, "8 Chamberlain Place, Augusta WA 6290");
    assert.equal(contextualised.suggestions[0].label, "8 Chamberlain Place, Heathridge WA 6027");
    assert.equal(contextualised.suggestions[0].provider, "fuel_path_gnaf");
    assert.equal(buildingNameContextualised.suggestions[0].label, "Rose Cottage Inn, 1 Isabella Drive, Tuggeranong ACT 2900");
    assert.equal(buildingNameContextualised.suggestions[0].provider, "fuel_path_gnaf");
  });
});

test("geocode promotes base refine suggestion for ambiguous building prefixes", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-building-refine-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-building-refine.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|BUILDING_NAME|FLAT_TYPE|FLAT_NUMBER|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GAWA2001|Karratha City Plaza, Shop 9, 16 Sharpe Avenue, Karratha WA 6714|Karratha City Plaza|Shop|9|16|Sharpe|Avenue|Karratha|WA|6714|PROPERTY CENTROID|116.846|-20.736",
      "GAWA2002|Karratha City Plaza, Shop 11, 16 Sharpe Avenue, Karratha WA 6714|Karratha City Plaza|Shop|11|16|Sharpe|Avenue|Karratha|WA|6714|PROPERTY CENTROID|116.8461|-20.7361",
      "GAWA2003|Karratha City Plaza, Shop 14, 16 Sharpe Avenue, Karratha WA 6714|Karratha City Plaza|Shop|14|16|Sharpe|Avenue|Karratha|WA|6714|PROPERTY CENTROID|116.8462|-20.7362",
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

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath, FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const buildingOnly = await geocode({
      query: "Karratha City Plaza",
      limit: 3,
      sessionToken: "building-refine-only",
    });
    const exactShop = await geocode({
      query: "Karratha City Plaza Shop 14",
      limit: 3,
      sessionToken: "building-refine-shop",
    });

    assert.equal(buildingOnly.suggestions[0].label, "Karratha City Plaza, 16 Sharpe Avenue, Karratha WA 6714");
    assert.equal(buildingOnly.suggestions[0].refineRequired, true);
    assert.equal(buildingOnly.suggestions[0].matchType, "building_refine");
    assert.equal(exactShop.suggestions[0].label, "Karratha City Plaza, Shop 14, 16 Sharpe Avenue, Karratha WA 6714");
    assert.equal(exactShop.suggestions[0].refineRequired, false);
  });
});

test("number-first context keeps nearby exact address ahead of remote base refine", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-refine-number-context-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-refine-number-context.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|BUILDING_NAME|FLAT_TYPE|FLAT_NUMBER|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GANSW3001|Tamworth Shops, Shop 1, 93 Tamworth Street, Dubbo NSW 2830|Tamworth Shops|Shop|1|93|Tamworth|Street|Dubbo|NSW|2830|PROPERTY CENTROID|148.601|-32.244",
      "GANSW3002|Tamworth Shops, Shop 2, 93 Tamworth Street, Dubbo NSW 2830|Tamworth Shops|Shop|2|93|Tamworth|Street|Dubbo|NSW|2830|PROPERTY CENTROID|148.6011|-32.2441",
      "GANSW3003|Tamworth Shops, Shop 3, 93 Tamworth Street, Dubbo NSW 2830|Tamworth Shops|Shop|3|93|Tamworth|Street|Dubbo|NSW|2830|PROPERTY CENTROID|148.6012|-32.2442",
      "GANSW3004|93 Tamworth Street, Abermain NSW 2326||||93|Tamworth|Street|Abermain|NSW|2326|PROPERTY CENTROID|151.428|-32.807",
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

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath, FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const contextualised = await geocode({
      query: "93 Tamworth S",
      limit: 5,
      sessionToken: "refine-number-context",
      searchContext: {
        nearLat: -32.807,
        nearLon: 151.428,
        nearRadiusKm: 80,
      },
    });

    assert.equal(contextualised.suggestions[0].label, "93 Tamworth Street, Abermain NSW 2326");
    assert.equal(contextualised.suggestions[0].refineRequired, false);
    assert.ok(contextualised.suggestions.every((suggestion) => suggestion.label !== "Tamworth Shops, 93 Tamworth Street, Dubbo NSW 2830"));
  });
});

test("contextual unit prefixes use nearby prefix rows instead of broad typeahead", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-context-prefix-unit-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-context-prefix-unit.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|FLAT_TYPE|FLAT_NUMBER|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GAWA4001|Unit 1, 10 Roy Road, Coodanup WA 6210|Unit|1|10|Roy|Road|Coodanup|WA|6210|PROPERTY CENTROID|115.750|-32.550",
      "GAVIC4002|Unit 1, 10 Roseland Road, Wodonga VIC 3690|Unit|1|10|Roseland|Road|Wodonga|VIC|3690|PROPERTY CENTROID|146.887|-36.123",
      "GANSW4003|Unit 1, 10 Rocca Street, Ryde NSW 2112|Unit|1|10|Rocca|Street|Ryde|NSW|2112|PROPERTY CENTROID|151.105|-33.810",
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

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath, FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const contextualised = await geocode({
      query: "Unit 1 10 Ro",
      limit: 3,
      sessionToken: "context-prefix-unit",
      searchContext: {
        nearLat: -36.123,
        nearLon: 146.887,
        nearRadiusKm: 80,
      },
    });

    assert.equal(contextualised.suggestions[0].label, "Unit 1, 10 Roseland Road, Wodonga VIC 3690");
    assert.equal(contextualised.suggestions[0].refineRequired, false);
  });
});

test("building-first unit query can resolve exact unit from indexed base signature", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-exact-unit-refine-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-exact-unit-refine.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|BUILDING_NAME|FLAT_TYPE|FLAT_NUMBER|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GAACT5001|Tuggeranong Business Centre, Unit 1, 12 Kett Street, Kambah ACT 2902|Tuggeranong Business Centre|Unit|1|12|Kett|Street|Kambah|ACT|2902|PROPERTY CENTROID|149.063|-35.378",
      "GAACT5002|Tuggeranong Business Centre, Unit 2, 12 Kett Street, Kambah ACT 2902|Tuggeranong Business Centre|Unit|2|12|Kett|Street|Kambah|ACT|2902|PROPERTY CENTROID|149.064|-35.379",
      "GAACT5003|Tuggeranong Business Centre, Unit 3, 12 Kett Street, Kambah ACT 2902|Tuggeranong Business Centre|Unit|3|12|Kett|Street|Kambah|ACT|2902|PROPERTY CENTROID|149.065|-35.380",
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

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath, FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
    const sqlite = new DatabaseSync(outputPath, { readOnly: true });
    const indexSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get("address_typeahead_base_unit_idx").sql;
    sqlite.close();

    const indexResults = await searchAddressIndex("Tuggeranong Business Centre Unit 2 12 Kett Street Kambah ACT 2902", 3);
    const exactUnit = await geocode({
      query: "Tuggeranong Business Centre Unit 2 12 Kett Street Kambah ACT 2902",
      limit: 3,
      sessionToken: "exact-unit-refine",
      searchContext: {
        nearLat: -35.379,
        nearLon: 149.064,
        nearRadiusKm: 80,
      },
    });

    assert.match(indexSql, /WHERE entry_type = 'exact' AND unit <> ''/);
    assert.equal(indexResults[0].label, "Tuggeranong Business Centre, Unit 2, 12 Kett Street, Kambah ACT 2902");
    assert.equal(indexResults.length, 1);
    assert.equal(exactUnit.suggestions[0].label, "Tuggeranong Business Centre, Unit 2, 12 Kett Street, Kambah ACT 2902");
    assert.equal(exactUnit.suggestions[0].refineRequired, false);
  });
});

test("unit-like SQLite queries wait for a meaningful street token before typeahead", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-unit-readiness-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-unit-readiness.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|FLAT_TYPE|FLAT_NUMBER|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GAVIC3001|Unit 1, 1 Stott Court, Wodonga VIC 3690|Unit|1|1|Stott|Court|Wodonga|VIC|3690|PROPERTY CENTROID|146.886|-36.123",
      "GAVIC3002|Unit 2, 2 Stott Court, Wodonga VIC 3690|Unit|2|2|Stott|Court|Wodonga|VIC|3690|PROPERTY CENTROID|146.887|-36.124",
      "GAVIC3003|Unit 3, 5A Woodland Street, Wodonga VIC 3690|Unit|3|5A|Woodland|Street|Wodonga|VIC|3690|PROPERTY CENTROID|146.888|-36.125",
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

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath }, async () => {
    const broadUnit = await searchAddressIndex("Unit 2 2", 3);
    const shortStreetToken = await searchAddressIndex("Unit 3 5A Wo", 3);
    const exactUnit = await searchAddressIndex("Unit 2 2 Stott", 3);
    const baseRefine = await searchAddressIndex("2 Stott Court Wodonga", 3);
    const sqlite = new DatabaseSync(outputPath, { readOnly: true });
    const broadPrefixRows = sqlite.prepare("SELECT COUNT(*) AS count FROM address_prefix_entries WHERE prefix = ?").get("unit 2 2");
    const unitPrefixRows = sqlite.prepare("SELECT COUNT(*) AS count FROM address_prefix_entries WHERE prefix = ?").get("unit 3 5a wo");
    const typeaheadFtsSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get("address_typeahead_fts").sql;
    const typeaheadFtsColumns = sqlite.prepare("PRAGMA table_info(address_typeahead_fts)").all().map((row) => row.name);
    const prefixColumns = sqlite.prepare("PRAGMA table_info(address_prefix_entries)").all().map((row) => row.name);
    sqlite.close();

    assert.deepEqual(broadUnit, []);
    assert.equal(broadPrefixRows.count, 0);
    assert.equal(unitPrefixRows.count, 1);
    assert.match(typeaheadFtsSql, /detail=column/);
    assert.deepEqual(typeaheadFtsColumns, ["entry_id", "key_text"]);
    assert.deepEqual(prefixColumns, ["prefix", "entry_id"]);
    assert.equal(shortStreetToken[0].label, "Unit 3, 5A Woodland Street, Wodonga VIC 3690");
    assert.equal(exactUnit[0].label, "Unit 2, 2 Stott Court, Wodonga VIC 3690");
    assert.equal(baseRefine[0].label, "2 Stott Court, Wodonga VIC 3690");
    assert.equal(baseRefine[0].refineRequired, true);
  });
});

test("geocode cache separates seed-only and configured G-NAF index results", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-cache-mode-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-cache-mode.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|FLAT_TYPE|FLAT_NUMBER|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GAACT0001|Unit 8, 21 Lanyon Drive, Tuggeranong ACT 2900|Unit|8|21|Lanyon|Drive|Tuggeranong|ACT|2900|PROPERTY CENTROID|149.065|-35.414",
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
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  const mockFetch = installFetchMock();
  try {
    await withEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim" }, async () => {
      const seedOnly = await geocode({
        query: "8/21 Lanyon Drive Tuggeranong ACT",
        limit: 5,
        sessionToken: "gnaf-cache-mode-seed",
      });
      assert.notEqual(seedOnly.location?.label, "Unit 8, 21 Lanyon Drive, Tuggeranong ACT 2900");
      assert.notEqual(seedOnly.location?.provider, "fuel_path_gnaf");
    });

    await withEnv({ FUEL_PATH_GEOCODE_PROVIDER: "nominatim", FUEL_PATH_GNAF_SQLITE_PATH: outputPath }, async () => {
      const indexed = await geocode({
        query: "8/21 Lanyon Drive Tuggeranong ACT",
        limit: 5,
        sessionToken: "gnaf-cache-mode-sqlite",
      });
      assert.equal(indexed.location?.label, "Unit 8, 21 Lanyon Drive, Tuggeranong ACT 2900");
      assert.equal(indexed.location?.provider, "fuel_path_gnaf");
      assert.match(indexed.location?.matchType || "", /^address_/);
    });
  } finally {
    mockFetch.restore();
  }
});

test("G-NAF fuzzy lookup fails safe instead of returning wrong remote address", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-fail-safe-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf-core.sqlite");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GANT0001|34 Victoria Highway, Katherine South NT 0850|34|Victoria|Highway|Katherine South|NT|0850|PROPERTY CENTROID|132.266|-14.466",
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
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  await withEnv({ FUEL_PATH_GNAF_SQLITE_PATH: outputPath }, async () => {
    const suggestions = await searchAddressIndex("5/34 south coast highway karratha", 3);
    assert.deepEqual(suggestions, []);
  });
});


test("G-NAF Core rows can be exported for Postgres COPY loading", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-gnaf-copy-"));
  const inputPath = path.join(tempDir, "GNAF_CORE.psv");
  const outputPath = path.join(tempDir, "gnaf.copy.tsv");
  fs.writeFileSync(
    inputPath,
    [
      "ADDRESS_DETAIL_PID|ADDRESS_LABEL|NUMBER_FIRST|STREET_NAME|STREET_TYPE|LOCALITY_NAME|STATE|POSTCODE|GEOCODE_TYPE|LONGITUDE|LATITUDE",
      "GATEST0003|66B Easton Avenue, Sylvania NSW 2224|66|Easton|Avenue|Sylvania|NSW|2224|PROPERTY CENTROID|151.0993847|-34.0114122",
    ].join("\n"),
  );

  execFileSync(
    process.execPath,
    [
      "scripts/export-gnaf-core-postgres-copy.mjs",
      "--input",
      inputPath,
      "--output",
      outputPath,
    ],
    { cwd: path.resolve(__dirname, "../.."), stdio: "ignore" },
  );

  const lines = fs.readFileSync(outputPath, "utf8").trim().split(/\r?\n/);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^id\tlabel\tlat\tlon\tstate\tpostcode/);
  assert.match(lines[1], /^GATEST0003\t66B Easton Avenue, Sylvania NSW 2224\t-34\.0114122\t151\.0993847\tNSW\t2224/);
});

test("Oracle-hosted G-NAF API is preferred when configured", async () => {
  const api = await startMockGnafApi();
  await withEnv(
    {
      FUEL_PATH_GNAF_API_URL: api.url,
      FUEL_PATH_GNAF_API_TOKEN: "test-token",
    },
    async () => {
      const status = addressIndexStatus();
      const suggestions = await searchAddressIndex("87a corea street sylvania", 3);

      assert.equal(status.mode, "api");
      assert.equal(status.apiConfigured, true);
      assert.equal(suggestions[0].label, "87A Corea Street, Sylvania NSW 2224");
      assert.equal(suggestions[0].provider, "fuel_path_gnaf");
      assert.equal(suggestions[0].providerId, "GANSW_API_1");
      assert.equal(api.requests[0].authorization, "Bearer test-token");
    },
  );
  await api.close();
});

test("G-NAF API failure falls back to seed records", async () => {
  const api = await startMockGnafApi({ status: 503 });
  await withEnv(
    {
      FUEL_PATH_GNAF_API_URL: api.url,
      FUEL_PATH_GNAF_API_TOKEN: "test-token",
    },
    async () => {
      const suggestions = await searchAddressIndex("66b easton avenue sylvania", 3);

      assert.equal(suggestions[0].label, "66B Easton Avenue, Sylvania NSW 2224");
      assert.equal(suggestions[0].provider, "fuel_path_gnaf");
      assert.notEqual(suggestions[0].providerId, "GANSW_API_1");
    },
  );
  await api.close();
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

async function startMockGnafApi({ status = 200 } = {}) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({
      url: request.url,
      authorization: request.headers.authorization,
    });
    response.writeHead(status, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        ok: status === 200,
        suggestions:
          status === 200
            ? [
                {
                  id: "GANSW_API_1",
                  label: "87A Corea Street, Sylvania NSW 2224",
                  lat: -34.0153146,
                  lon: 151.0997397,
                  state: "NSW",
                  postcode: "2224",
                  accuracy: "PROPERTY CENTROID",
                  matchType: "exact_address",
                  score: 1000,
                },
              ]
            : [],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    requests,
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function withEnv(overrides, callback) {
  const keys = [
    "FUEL_PATH_GNAF_API_URL",
    "FUEL_PATH_GNAF_API_TOKEN",
    "FUEL_PATH_GNAF_SQLITE_PATH",
    "FUEL_PATH_GNAF_DATABASE_URL",
    "FUEL_PATH_GNAF_LARGE_SQLITE_BYTES",
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
