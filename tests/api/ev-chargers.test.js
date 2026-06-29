const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normaliseOpenChargeMapPayload,
  supportedEvProviders,
  unsupportedEvProviderResult,
} = require("../../api/_evOpenChargeMap");
const { normaliseApiNinjasPayload } = require("../../api/_evApiNinjas");
const { normaliseOpenWebNinjaPayload } = require("../../api/_evOpenWebNinja");
const {
  defaultEvProvider,
  evChargingStatus,
  fallbackEvProviders,
  normaliseEvProvider,
} = require("../../api/_evProviderPolicy");
const {
  createEvRouteFallbackScorer,
  scoreRouteFallbackChargers,
} = require("../../api/_evRouteFallback");

test("Open Charge Map normalisation maps connector, power and cautious availability with fast including ultra-fast", () => {
  const chargers = normaliseOpenChargeMapPayload(openChargeMapPayload(), {
    centre: { lat: -37.8136, lon: 144.9631 },
    radiusKm: 20,
    filters: { connectors: ["CCS2"], minPowerKw: 50, powerMode: "dc_fast" },
  });

  assert.equal(chargers.length, 2);
  const fastCharger = chargers.find((charger) => charger.id === "OCM-1001");
  const ultraFastCharger = chargers.find((charger) => charger.id === "OCM-1002");
  assert.ok(fastCharger);
  assert.ok(ultraFastCharger);
  assert.equal(fastCharger.name, "CBD Fast Charger");
  assert.equal(fastCharger.operator, "Charge Example");
  assert.equal(fastCharger.connectors.includes("CCS2"), true);
  assert.equal(fastCharger.connectors.includes("CHADEMO"), true);
  assert.equal(fastCharger.maxPowerKw, 75);
  assert.equal(fastCharger.powerBand, "dc_fast");
  assert.equal(fastCharger.availability, "unknown");
  assert.match(fastCharger.availabilityLabel, /live bay status unknown/);
  assert.match(fastCharger.provenance, /Open Charge Map/);
  assert.equal(ultraFastCharger.powerBand, "ultra_fast");
});

test("Open Charge Map normalisation supports ultra-fast power filtering", () => {
  const chargers = normaliseOpenChargeMapPayload(openChargeMapPayload(), {
    centre: { lat: -37.8136, lon: 144.9631 },
    radiusKm: 20,
    filters: { connectors: ["CCS2"], minPowerKw: 150, powerMode: "ultra_fast" },
  });

  assert.equal(chargers.length, 1);
  assert.equal(chargers[0].id, "OCM-1002");
  assert.equal(chargers[0].maxPowerKw, 350);
  assert.equal(chargers[0].powerBand, "ultra_fast");
});

test("EV provider contract exposes pricing-first commercial candidates", () => {
  const providers = supportedEvProviders();
  assert.deepEqual(
    providers.map((item) => item.id),
    ["open_charge_map", "openweb_ninja", "api_ninjas", "plugshare", "here", "mapbox", "tomtom", "network_partner"],
  );
  assert.equal(providers.find((item) => item.id === "openweb_ninja")?.status, "wired_trial_candidate");
  assert.match(providers.find((item) => item.id === "api_ninjas")?.nextAction || "", /AU\/NT/);
  assert.equal(providers.find((item) => item.id === "plugshare")?.status, "pricing_required");
  assert.match(providers.find((item) => item.id === "here")?.nextAction || "", /pricing/);
  assert.match(providers.find((item) => item.id === "mapbox")?.pricing || "", /pricing requires confirmation/);
});

test("unsupported commercial EV providers fail closed without live availability claims", () => {
  const result = unsupportedEvProviderResult({
    provider: "api_ninjas",
    centre: { lat: -37.8136, lon: 144.9631, label: "Melbourne" },
    radiusKm: 12,
    filters: { connectors: ["CCS2"], minPowerKw: 50, powerMode: "dc_fast" },
  });

  assert.equal(result.context.provider, "api_ninjas");
  assert.equal(result.context.capability, "pending_commercial_access");
  assert.equal(result.context.provenance.realTimeAvailability, false);
  assert.equal(result.chargers.length, 0);
  assert.match(result.context.warning, /commercial access, pricing, licence terms and schema are not approved yet/);
});

test("EV provider policy defaults to API Ninjas when configured", () => {
  withEnv({ API_NINJAS_API_KEY: "test-key", OPEN_CHARGE_MAP_API_KEY: "", FUEL_PATH_EV_DEFAULT_PROVIDER: "" }, () => {
    assert.equal(defaultEvProvider(), "api_ninjas");
    assert.equal(normaliseEvProvider(""), "api_ninjas");
    const status = evChargingStatus();
    assert.equal(status.provider, "api_ninjas");
    assert.equal(status.configured, true);
    assert.equal(status.realTimeAvailability, false);
    assert.equal(status.liveAvailabilityClaimsAllowed, false);
    assert.match(status.warning, /directory data/);
  });
});

test("EV provider policy falls back to configured Open Charge Map before not-configured API Ninjas", () => {
  withEnv({ API_NINJAS_API_KEY: "", OPEN_CHARGE_MAP_API_KEY: "ocm-key", FUEL_PATH_EV_DEFAULT_PROVIDER: "" }, () => {
    assert.equal(defaultEvProvider(), "open_charge_map");
    assert.equal(evChargingStatus().configured, true);
  });

  withEnv({ API_NINJAS_API_KEY: "", OPENWEB_NINJA_API_KEY: "openweb-key", OPEN_CHARGE_MAP_API_KEY: "", FUEL_PATH_EV_DEFAULT_PROVIDER: "" }, () => {
    assert.equal(defaultEvProvider(), "openweb_ninja");
    const status = evChargingStatus();
    assert.equal(status.configured, true);
    assert.equal(status.openWebNinjaConfigured, true);
  });

  withEnv({ API_NINJAS_API_KEY: "", OPEN_CHARGE_MAP_API_KEY: "", FUEL_PATH_EV_DEFAULT_PROVIDER: "" }, () => {
    assert.equal(defaultEvProvider(), "api_ninjas");
    const status = evChargingStatus();
    assert.equal(status.provider, "api_ninjas");
    assert.equal(status.configured, false);
    assert.match(status.warning, /API_NINJAS_API_KEY/);
  });
});

test("EV fallback providers avoid slow OpenWeb unless explicitly configured", () => {
  withEnv({ FUEL_PATH_EV_CASCADE_PROVIDERS: "" }, () => {
    assert.deepEqual(fallbackEvProviders("api_ninjas"), ["open_charge_map"]);
  });
  withEnv({ FUEL_PATH_EV_CASCADE_PROVIDERS: "openweb_ninja,open_charge_map" }, () => {
    assert.deepEqual(fallbackEvProviders("api_ninjas"), ["openweb_ninja", "open_charge_map"]);
  });
});

test("OpenWeb Ninja normalisation maps flexible rows without live availability claims", () => {
  const chargers = normaliseOpenWebNinjaPayload(openWebNinjaPayload(), {
    centre: { lat: -20.7364, lon: 116.8463 },
    radiusKm: 10,
    filters: { connectors: ["CCS2"], minPowerKw: 0, powerMode: "" },
  });

  assert.equal(chargers.length, 1);
  assert.equal(chargers[0].id, "OPENWEB_NINJA-ow-karratha");
  assert.equal(chargers[0].name, "Karratha WA EV Network");
  assert.deepEqual(chargers[0].connectors, ["CCS2", "TYPE2"]);
  assert.equal(chargers[0].maxPowerKw, 50);
  assert.equal(chargers[0].powerBand, "dc_fast");
  assert.equal(chargers[0].availability, "unknown");
  assert.match(chargers[0].provenance, /OpenWeb Ninja/);
});

test("API Ninjas normalisation maps directory fields without live availability claims", () => {
  const chargers = normaliseApiNinjasPayload(apiNinjasPayload(), {
    centre: { lat: -12.4634, lon: 130.8456 },
    radiusKm: 20,
    filters: { connectors: ["TYPE2"], minPowerKw: 0, powerMode: "ac" },
  });

  assert.equal(chargers.length, 1);
  assert.equal(chargers[0].id, "API_NINJAS-Charles Darwin University - Car Park Orange C");
  assert.equal(chargers[0].name, "Charles Darwin University - Car Park Orange C");
  assert.equal(chargers[0].suburb, "Darwin");
  assert.deepEqual(chargers[0].connectors, ["TYPE2"]);
  assert.equal(chargers[0].connections[1].connectorLabel, "Type 1 (J1772)");
  assert.equal(chargers[0].powerBand, "ac");
  assert.equal(chargers[0].availability, "unknown");
  assert.match(chargers[0].availabilityLabel, /live bay status unknown/);
  assert.match(chargers[0].provenance, /API Ninjas/);
});

test("API Ninjas compact connector filters apply vehicle profile compatibility", () => {
  const chargers = normaliseApiNinjasPayload(apiNinjasMixedPayload(), {
    centre: { lat: -31.9523, lon: 115.8613 },
    radiusKm: 30,
    filters: { connectors: ["TYPE2"], minPowerKw: 0, powerMode: "" },
  });

  assert.equal(chargers.length, 1);
  assert.equal(chargers[0].name, "Compatible Type 2 Charger");
  assert.deepEqual(chargers[0].connectors, ["TYPE2"]);
});

test("EV route fallback ranks by approximate off-route distance before query distance", () => {
  const routePoints = [
    { lat: -31.95, lon: 115.85, label: "Start" },
    { lat: -31.95, lon: 115.95, label: "End" },
  ];
  const chargers = scoreRouteFallbackChargers({
    routePoints,
    chargers: [
      evCharger({ id: "far-from-route", lat: -31.9, lon: 115.9, distanceKm: 1 }),
      evCharger({ id: "near-route", lat: -31.951, lon: 115.9, distanceKm: 10 }),
    ],
  });

  assert.equal(chargers[0].id, "near-route");
  assert.equal(chargers[0].routeDistanceKm < 0.2, true);
  assert.equal(Number.isFinite(chargers[0].routeDetourMinutes), true);
});

test("EV route fallback scorer returns cautious prototype metadata", async () => {
  const scorer = createEvRouteFallbackScorer({
    buildRoute: async () => ({
      distanceKm: 2.4,
      durationMin: 4.2,
      provider: "test_routes",
      points: [],
    }),
    loadEvChargers: async ({ centre }) => ({
      chargers: [
        evCharger({
          id: `charger-${centre.label}`,
          lat: centre.lat,
          lon: centre.lon,
        }),
      ],
    }),
  });

  const result = await scorer.scoreEvRouteFallback({
    connectors: ["TYPE2"],
    route: {
      points: [
        { lat: -31.95, lon: 115.85, label: "Start" },
        { lat: -31.95, lon: 115.95, label: "End" },
      ],
    },
  });

  assert.equal(result.context.capability, "prototype");
  assert.equal(result.context.fallbackMode, "sampled_route_corridor");
  assert.equal(result.context.routeEstimatedCount > 0, true);
  assert.equal(result.context.provenance.realTimeAvailability, false);
  assert.match(result.context.warning, /directory data and route-corridor scoring/);
  assert.equal(result.chargers.length > 0, true);
  assert.equal(result.chargers[0].routeDetourSource, "route_engine");
  assert.equal(result.chargers[0].routeDetourMinutes, 8);
  assert.equal(result.chargers[0].routeDetourDistanceKm, 4.8);
});

function openChargeMapPayload() {
  return [
    {
      ID: 1001,
      DateLastStatusUpdate: "2026-06-25T02:00:00Z",
      OperatorInfo: { Title: "Charge Example" },
      UsageCost: "$0.60/kWh",
      AddressInfo: {
        Title: "CBD Fast Charger",
        AddressLine1: "1 Collins Street",
        Town: "Melbourne",
        StateOrProvince: "VIC",
        Postcode: "3000",
        Latitude: -37.8137,
        Longitude: 144.9632,
      },
      Connections: [
        {
          ConnectionType: { Title: "CCS (Type 2)" },
          CurrentType: { Title: "DC" },
          PowerKW: 75,
          Quantity: 2,
          StatusType: { Title: "Operational", IsOperational: true },
        },
        {
          ConnectionType: { Title: "CHAdeMO" },
          CurrentType: { Title: "DC" },
          PowerKW: 50,
          Quantity: 1,
          StatusType: { Title: "Operational", IsOperational: true },
        },
      ],
    },
    {
      ID: 1002,
      OperatorInfo: { Title: "Ultra Example" },
      AddressInfo: {
        Title: "Ultra Charge",
        AddressLine1: "2 Bourke Street",
        Town: "Melbourne",
        StateOrProvince: "VIC",
        Postcode: "3000",
        Latitude: -37.814,
        Longitude: 144.964,
      },
      Connections: [
        {
          ConnectionType: { Title: "CCS (Type 2)" },
          CurrentType: { Title: "DC" },
          PowerKW: 350,
          Quantity: 4,
          StatusType: { Title: "Operational", IsOperational: true },
        },
      ],
    },
  ];
}

function apiNinjasPayload() {
  return [
    {
      is_active: true,
      name: "Charles Darwin University - Car Park Orange C",
      address: "77 Lakeside Avenue",
      city: "Darwin",
      region: "NT",
      country: "AU",
      latitude: -12.374576,
      longitude: 130.869764,
      connections: [
        {
          type_name: "Type 2 (Socket Only)",
          type_official: "IEC 62196-2 Type 2",
          level: 2,
          num_connectors: 2,
        },
        {
          type_name: "Type 1 (J1772)",
          type_official: "SAE J1772-2009",
          level: 2,
          num_connectors: 6,
        },
      ],
    },
  ];
}

function apiNinjasMixedPayload() {
  return [
    {
      is_active: true,
      name: "Type 1 Only Charger",
      address: "1 The Avenue",
      city: "Leederville",
      region: "WA",
      country: "AU",
      latitude: -31.941,
      longitude: 115.841,
      connections: [
        {
          type_name: "Type 1 (J1772)",
          type_official: "SAE J1772-2009",
          level: 2,
          num_connectors: 1,
        },
      ],
    },
    {
      is_active: true,
      name: "Compatible Type 2 Charger",
      address: "17 Dick Perry Ave",
      city: "Kensington",
      region: "WA",
      country: "AU",
      latitude: -31.988,
      longitude: 115.887,
      connections: [
        {
          type_name: "Type 2 (Socket Only)",
          type_official: "IEC 62196-2 Type 2",
          level: 2,
          num_connectors: 2,
        },
      ],
    },
  ];
}

function openWebNinjaPayload() {
  return {
    data: [
      {
        id: "ow-karratha",
        name: "Karratha WA EV Network",
        operator: "WA EV Network",
        address: "Welcome Road",
        city: "Karratha",
        region: "WA",
        latitude: -20.7359,
        longitude: 116.8468,
        connectors: [
          { type: "CCS Type 2", power_kw: 50, current_type: "DC" },
          { type: "Type 2", power_kw: 22, current_type: "AC" },
        ],
      },
      {
        id: "ow-type1",
        name: "Type 1 only",
        latitude: -20.7359,
        longitude: 116.8468,
        connectors: [{ type: "Type 1", power_kw: 7 }],
      },
    ],
  };
}

function evCharger({
  id,
  lat,
  lon,
  distanceKm = 0,
}) {
  return {
    id,
    name: id,
    operator: "Test",
    lat,
    lon,
    distanceKm,
    connectors: ["TYPE2"],
    connections: [{ connector: "TYPE2", connectorLabel: "Type 2" }],
    powerBand: "ac",
    availability: "unknown",
    availabilityLabel: "Listed active, live bay status unknown",
    source: "test",
    provenance: "Test charger",
  };
}

function withEnv(values, callback) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    callback();
  } finally {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
