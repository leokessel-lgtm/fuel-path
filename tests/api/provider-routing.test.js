const assert = require("node:assert/strict");
const test = require("node:test");

const {
  capabilitiesForPoints,
  capabilitySummary,
  fuelProviderCapabilityMatrix,
  liveProviderKeysForArea,
  loadStationData,
  pointInAct,
  pointInVic,
} = require("../../api/_backend");
const stationsHandler = require("../../api/stations");
const statusHandler = require("../../api/status");

test("national capability matrix covers every Australian state and territory", () => {
  withEnv(
    {
      NSW_FUEL_API_KEY: "test-key",
      NSW_FUEL_API_SECRET: "test-secret",
      QLD_FUEL_API_TOKEN: "test-token",
      SA_FUEL_API_TOKEN: "test-sa-token",
      FUEL_PATH_WA_FUELWATCH_ENABLED: "1",
      VIC_SERVO_SAVER_API_BASE_URL: "",
      VIC_SERVO_SAVER_API_KEY: "",
    },
    () => {
      const capabilities = fuelProviderCapabilityMatrix();

      assert.deepEqual(
        capabilities.map((item) => item.region),
        ["NSW", "ACT", "QLD", "WA", "VIC", "SA", "TAS", "NT"],
      );
      assert.equal(capabilities.every((item) => item.provider && item.name && item.coverage), true);
      assert.equal(capabilities.find((item) => item.region === "NSW")?.capability, "live");
      assert.equal(capabilities.find((item) => item.region === "ACT")?.capability, "live");
      assert.equal(capabilities.find((item) => item.region === "QLD")?.capability, "live");
      assert.equal(capabilities.find((item) => item.region === "WA")?.capability, "live");
      assert.equal(capabilities.find((item) => item.region === "VIC")?.capability, "pending_access");
      assert.equal(capabilities.find((item) => item.region === "SA")?.capability, "live");
      assert.equal(capabilities.find((item) => item.region === "TAS")?.capability, "pending_access");
      assert.equal(capabilities.find((item) => item.region === "NT")?.capability, "pending_access");
      assert.deepEqual(capabilitySummary(capabilities), { live: 5, pending_access: 3 });
    },
  );
});

test("point capabilities distinguish pending national regions from unsupported areas", () => {
  assert.equal(capabilitiesForPoints([{ lat: -34.9285, lon: 138.6007 }])[0]?.region, "SA");
  assert.equal(capabilitiesForPoints([{ lat: -34.9285, lon: 138.6007 }])[0]?.capability, "pending_access");
  assert.equal(capabilitiesForPoints([{ lat: -42.8821, lon: 147.3272 }])[0]?.region, "TAS");
  assert.equal(capabilitiesForPoints([{ lat: -12.4634, lon: 130.8456 }])[0]?.region, "NT");
  assert.equal(capabilitiesForPoints([{ lat: 0, lon: 0 }])[0]?.capability, "unsupported");
});

test("status endpoint exposes the national capability contract", async () => {
  const response = await callStatus();

  assert.equal(response.status, 200);
  assert.deepEqual(response.payload.fuelProviders.capabilityLabels, [
    "live",
    "limited",
    "pending_access",
    "fallback",
    "unsupported",
  ]);
  assert.equal(response.payload.fuelProviders.capabilities.length, 8);
  assert.equal(response.payload.fuelProviders.capabilities.some((item) => item.region === "SA"), true);
  assert.equal(typeof response.payload.fuelProviders.capabilitySummary, "object");
});

test("ACT coordinates are treated as NSW provider coverage", () => {
  const canberra = { lat: -35.2809, lon: 149.13 };

  assert.equal(pointInAct(canberra), true);
  assert.equal(pointInVic(canberra), false);
  assert.deepEqual(liveProviderKeysForArea([canberra], 8), ["nsw"]);
});

test("NSW side of the VIC border remains on NSW provider coverage", () => {
  const albury = { lat: -36.0737, lon: 146.9135 };
  const moama = { lat: -36.1129, lon: 144.7605 };

  assert.equal(pointInVic(albury), false);
  assert.equal(pointInVic(moama), false);
  assert.deepEqual(liveProviderKeysForArea([albury], 8), ["nsw"]);
  assert.deepEqual(liveProviderKeysForArea([moama], 8), ["nsw"]);
});

test("VIC side of the border remains on VIC provider coverage", () => {
  const wodonga = { lat: -36.1241, lon: 146.8818 };
  const echuca = { lat: -36.1418, lon: 144.7511 };
  const melbourne = { lat: -37.8136, lon: 144.9631 };

  assert.equal(pointInVic(wodonga), true);
  assert.equal(pointInVic(echuca), true);
  assert.equal(pointInVic(melbourne), true);
  assert.deepEqual(liveProviderKeysForArea([wodonga], 8), ["vic"]);
  assert.deepEqual(liveProviderKeysForArea([echuca], 8), ["vic"]);
  assert.deepEqual(liveProviderKeysForArea([melbourne], 8), ["vic"]);
});

test("eastern NSW route points do not get misclassified as VIC", () => {
  const wollongong = { lat: -34.4278, lon: 150.8931 };
  const eden = { lat: -37.0659, lon: 149.9013 };

  assert.equal(pointInVic(wollongong), false);
  assert.equal(pointInVic(eden), false);
  assert.deepEqual(liveProviderKeysForArea([wollongong], 8), ["nsw"]);
  assert.deepEqual(liveProviderKeysForArea([eden], 8), ["nsw"]);
});

test("multi-point NSW/VIC routes include the correct live provider order", () => {
  const albury = { lat: -36.0737, lon: 146.9135 };
  const wodonga = { lat: -36.1241, lon: 146.8818 };

  assert.deepEqual(liveProviderKeysForArea([albury, wodonga], 8), ["vic", "nsw"]);
});

test("unsupported geographies do not fall through to NSW", () => {
  const unsupported = [
    { name: "Adelaide SA", point: { lat: -34.9285, lon: 138.6007 } },
    { name: "Darwin NT", point: { lat: -12.4634, lon: 130.8456 } },
    { name: "Alice Springs NT", point: { lat: -23.698, lon: 133.8807 } },
    { name: "Hobart TAS", point: { lat: -42.8821, lon: 147.3272 } },
    { name: "Null Island", point: { lat: 0, lon: 0 } },
    { name: "Pacific Ocean east of NSW", point: { lat: -34, lon: 154.5 } },
  ];

  for (const { name, point } of unsupported) {
    assert.deepEqual(liveProviderKeysForArea([point], 8), [], name);
  }
});

test("SA routes to live provider only when token is configured", () => {
  const adelaide = { lat: -34.9285, lon: 138.6007 };

  withEnv({ SA_FUEL_API_TOKEN: "" }, () => {
    assert.deepEqual(liveProviderKeysForArea([adelaide], 8), []);
    assert.equal(capabilitiesForPoints([adelaide])[0]?.capability, "pending_access");
  });

  withEnv({ SA_FUEL_API_TOKEN: "test-sa-token" }, () => {
    assert.deepEqual(liveProviderKeysForArea([adelaide], 8), ["sa"]);
    assert.equal(capabilitiesForPoints([adelaide])[0]?.capability, "live");
  });
});

test("unsupported station loads return explicit empty unsupported context", async () => {
  const data = await loadStationData({
    requestedSource: "auto",
    points: [{ lat: 0, lon: 0 }],
    radiusKm: 8,
  });

  assert.equal(data.source, "unsupported_region");
  assert.equal(data.provider, "unsupported_region");
  assert.equal(data.stations.length, 0);
  assert.match(data.warning, /No live fuel provider covers this area yet/);
});

test("pending national regions return explicit capability context", async () => {
  const data = await loadStationData({
    requestedSource: "auto",
    points: [{ lat: -34.9285, lon: 138.6007 }],
    radiusKm: 8,
  });

  assert.equal(data.source, "unsupported_region");
  assert.equal(data.capability, "pending_access");
  assert.equal(data.regionCapabilities[0].region, "SA");
  assert.match(data.warning, /SA in the national provider matrix/);
});

test("sample fallback marks data as fallback capability", async () => {
  const data = await loadStationData({
    requestedSource: "sample",
    points: [{ lat: -42.8821, lon: 147.3272 }],
    radiusKm: 8,
  });

  assert.equal(data.source, "sample");
  assert.equal(data.capability, "fallback");
  assert.equal(data.regionCapabilities[0].region, "TAS");
  assert.match(data.warning, /fallback data for TAS/);
});

test("unsupported station handler response stays explicit", async () => {
  const response = await callStations({
    lat: 0,
    lon: 0,
    label: "Null Island",
    fuel: "U91",
    radiusKm: 8,
    limit: 5,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.context.source, "unsupported_region");
  assert.equal(response.payload.context.provider, "unsupported_region");
  assert.equal(response.payload.context.stationCount, 0);
  assert.equal(response.payload.context.returnedCount, 0);
  assert.equal(response.payload.stations.length, 0);
  assert.match(response.payload.context.warning, /No live fuel provider covers this area yet/);
});

test("forced provider outside coverage returns explicit JSON instead of throwing", async () => {
  const forcedOutsideCoverage = [
    { source: "qld", lat: -33.86, lon: 151.2, expectedProvider: "qld" },
    { source: "wa", lat: -33.86, lon: 151.2, expectedProvider: "wa" },
    { source: "sa", lat: -33.86, lon: 151.2, expectedProvider: "sa" },
    { source: "nsw", lat: -27.4698, lon: 153.0251, expectedProvider: "nsw" },
  ];

  for (const item of forcedOutsideCoverage) {
    const response = await callStations({
      source: item.source,
      lat: item.lat,
      lon: item.lon,
      fuel: "U91",
      radiusKm: 8,
      limit: 5,
    });

    assert.equal(response.status, 200, item.source);
    assert.equal(response.payload.context.source, "unsupported_region", item.source);
    assert.equal(response.payload.context.provider, item.expectedProvider, item.source);
    assert.equal(response.payload.context.stationCount, 0, item.source);
    assert.equal(response.payload.stations.length, 0, item.source);
    assert.match(response.payload.context.warning, /does not cover this area/, item.source);
  }
});

test("forced VIC provider failure returns fallback JSON instead of throwing", async () => {
  const response = await callStations({
    source: "vic",
    lat: -37.8136,
    lon: 144.9631,
    fuel: "U91",
    radiusKm: 8,
    limit: 5,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.context.source, "sample_fallback");
  assert.equal(response.payload.context.provider, "public_demo_snapshot");
  assert.match(response.payload.context.warning, /VIC Servo Saver API access is not configured/);
});

function callStations(query) {
  return new Promise((resolve) => {
    const req = { method: "GET", query };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, payload });
      },
    };

    stationsHandler(req, res);
  });
}

function callStatus() {
  return new Promise((resolve) => {
    const req = { method: "GET", query: {} };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, payload });
      },
    };

    statusHandler(req, res);
  });
}

function withEnv(values, fn) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === "") delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
