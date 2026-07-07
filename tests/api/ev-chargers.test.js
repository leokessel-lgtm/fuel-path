const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resetMemoryGeocodeQuotaForTests,
  setGeocodeQuotaStorageForTests,
} = require("../../api/_geocodeQuotaStorage");
const {
  normaliseOpenChargeMapPayload,
  supportedEvProviders,
  unsupportedEvProviderResult,
} = require("../../api/_evOpenChargeMap");
const { normaliseApiNinjasPayload } = require("../../api/_evApiNinjas");
const { normaliseOpenWebNinjaPayload } = require("../../api/_evOpenWebNinja");
const { normaliseGooglePlacesEvPayload } = require("../../api/_evGooglePlaces");
const {
  clearOpenWebNinjaRateLimit,
  markOpenWebNinjaRateLimit,
} = require("../../api/_evProviderState");
const { createLocalPrototypeEvDirectoryAdapter } = require("../../api/_evLocalPrototypeDirectory");
const {
  defaultEvProvider,
  evChargingStatus,
  fallbackEvProviders,
  normaliseEvProvider,
} = require("../../api/_evProviderPolicy");
const {
  createEvRouteFallbackScorer,
  evRouteChargerScore,
  providerTraceFromResponses,
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
    ["google_places_ev", "open_charge_map", "openweb_ninja", "api_ninjas", "plugshare", "here", "mapbox", "tomtom", "network_partner"],
  );
  assert.equal(providers.find((item) => item.id === "google_places_ev")?.status, "trial_candidate_flagged");
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

test("EV provider policy keeps API Ninjas as fallback behind explicit EV candidates", () => {
  withEnv({
    API_NINJAS_API_KEY: "test-key",
    FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
    FUEL_PATH_GOOGLE_PLACES_API_KEY: "google-key",
    OPEN_CHARGE_MAP_API_KEY: "",
    OPENWEB_NINJA_API_KEY: "",
    FUEL_PATH_EV_DEFAULT_PROVIDER: "",
  }, () => {
    assert.equal(defaultEvProvider(), "google_places_ev");
    assert.equal(normaliseEvProvider(""), "google_places_ev");
    const status = evChargingStatus();
    assert.equal(status.provider, "google_places_ev");
    assert.equal(status.configured, true);
    assert.equal(status.apiNinjasConfigured, true);
    assert.equal(status.realTimeAvailability, false);
    assert.equal(status.liveAvailabilityClaimsAllowed, false);
    assert.match(status.warning, /directory data/);
  });

  withEnv({
    API_NINJAS_API_KEY: "test-key",
    FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "",
    FUEL_PATH_GOOGLE_PLACES_API_KEY: "",
    OPEN_CHARGE_MAP_API_KEY: "",
    OPENWEB_NINJA_API_KEY: "",
    FUEL_PATH_EV_DEFAULT_PROVIDER: "",
  }, () => {
    assert.equal(defaultEvProvider(), "api_ninjas");
    const status = evChargingStatus();
    assert.equal(status.provider, "api_ninjas");
    assert.equal(status.configured, true);
    assert.equal(status.realTimeAvailability, false);
    assert.equal(status.liveAvailabilityClaimsAllowed, false);
    assert.match(status.warning, /directory data/);
  });
});

test("EV provider policy prefers Open Charge Map before API Ninjas, with OpenWeb demoted", () => {
  withEnv({ API_NINJAS_API_KEY: "api-key", OPEN_CHARGE_MAP_API_KEY: "ocm-key", OPENWEB_NINJA_API_KEY: "openweb-key", FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "", FUEL_PATH_EV_DEFAULT_PROVIDER: "" }, () => {
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

test("EV fallback providers try real candidates before API Ninjas unless explicitly configured", () => {
  withEnv({ FUEL_PATH_EV_CASCADE_PROVIDERS: "" }, () => {
    assert.deepEqual(fallbackEvProviders("open_charge_map"), ["google_places_ev", "openweb_ninja", "api_ninjas"]);
  });
  withEnv({ FUEL_PATH_EV_CASCADE_PROVIDERS: "openweb_ninja,open_charge_map" }, () => {
    assert.deepEqual(fallbackEvProviders("api_ninjas"), ["openweb_ninja", "open_charge_map"]);
  });
});

test("local prototype EV directory returns route-corridor rows when no live provider is configured", async () => {
  const { loadEvChargers } = createLocalPrototypeEvDirectoryAdapter();
  const result = await loadEvChargers({
    centre: { lat: -33.3082, lon: 151.4205, label: "Tuggerah corridor" },
    radiusKm: 30,
    limit: 5,
    connectors: [],
  });

  assert.equal(result.context.provider, "local_prototype_directory");
  assert.equal(result.context.provenance.realTimeAvailability, false);
  assert.match(result.context.warning, /sanitised local prototype EV charger data/);
  assert.equal(result.chargers.length > 0, true);
  assert.equal(result.chargers[0].source, "local_prototype_directory");
  assert.match(result.chargers[0].availabilityLabel, /live bay status unknown/);
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

test("EV route charger score favours lower-detour powered mid-route options when range is tight", () => {
  const awkwardEarly = evCharger({
    id: "awkward-early",
    lat: -31.95,
    lon: 115.86,
    maxPowerKw: 22,
  });
  const betterMidRoute = evCharger({
    id: "better-mid-route",
    lat: -31.95,
    lon: 115.91,
    maxPowerKw: 150,
  });

  const awkwardScore = evRouteChargerScore({
    ...awkwardEarly,
    distanceAlongRouteKm: 2,
    routeProgressRatio: 0.08,
    routeDetourDistanceKm: 14,
    routeDetourMinutes: 18,
    routeSegment: "near_origin",
  }, { rangeStatus: "tight", routeDistanceKm: 100 });
  const betterScore = evRouteChargerScore({
    ...betterMidRoute,
    distanceAlongRouteKm: 55,
    routeProgressRatio: 0.55,
    routeDetourDistanceKm: 5,
    routeDetourMinutes: 8,
    routeSegment: "mid_route",
  }, { rangeStatus: "tight", routeDistanceKm: 100 });

  assert.equal(betterScore < awkwardScore, true);
});

test("EV route charging keeps lower-detour mid-route charger above earlier awkward charger", async () => {
  const scorer = createEvRouteFallbackScorer({
    buildRoute: async ({ to }) => {
      if (/Awkward/i.test(to.label)) return { distanceKm: 7, durationMin: 9, provider: "test_routes", points: [] };
      return { distanceKm: 2.5, durationMin: 4, provider: "test_routes", points: [] };
    },
    loadEvChargers: async () => ({
      context: { provider: "mock_ev", source: "mock_ev" },
      chargers: [
        evCharger({ id: "awkward-origin", name: "Awkward origin charger", lat: -31.95, lon: 115.86, maxPowerKw: 22 }),
        evCharger({ id: "better-mid", name: "Better mid-route charger", lat: -31.95, lon: 115.9, maxPowerKw: 150 }),
      ],
    }),
  });

  const result = await scorer.scoreEvRouteFallback({
    connectors: ["TYPE2"],
    limit: 2,
    route: {
      distanceKm: 100,
      points: [
        { lat: -31.95, lon: 115.85, label: "Start" },
        { lat: -31.95, lon: 115.95, label: "End" },
      ],
    },
    selectedRangeKm: 105,
  });

  assert.equal(result.context.rangeStatus, "tight");
  assert.equal(result.chargers[0].id, "better-mid");
  assert.equal(result.chargers[0].routeSegment, "mid_route");
  assert.equal(typeof result.chargers[0].routeScore, "number");
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
      context: {
        provider: "mock_local_provider",
        source: "mock",
      },
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
    selectedRangeKm: 120,
    route: {
      distanceKm: 22,
      points: [
        { lat: -31.95, lon: 115.85, label: "Start" },
        { lat: -31.95, lon: 115.95, label: "End" },
      ],
    },
  });

  assert.equal(result.context.capability, "prototype");
  assert.equal(result.context.planMode, "route_charging");
  assert.equal(result.context.provider, "mock_local_provider");
  assert.equal(result.context.rangeStatus, "comfortable");
  assert.equal(result.context.routeDistanceKm, 22);
  assert.equal(result.context.selectedRangeKm, 120);
  assert.deepEqual(result.context.filters.connectors, ["TYPE2"]);
  assert.equal(result.context.fallbackMode, "sampled_route_corridor");
  assert.equal(result.context.routeEstimatedCount > 0, true);
  assert.equal(result.context.provenance.realTimeAvailability, false);
  assert.match(result.context.warning, /directory data and route-corridor scoring/);
  assert.equal(result.chargers.length > 0, true);
  assert.equal(result.chargers[0].routeDetourSource, "route_engine");
  assert.equal(result.chargers[0].routeDetourMinutes, 8);
  assert.equal(result.chargers[0].routeDetourDistanceKm, 4.8);
});

test("EV route fallback provider trace dedupes provider chains from sampled route points", () => {
  const providerTrace = providerTraceFromResponses([
    { context: { provider: "google_places_ev" } },
    { context: { provider: "google_places_ev+api_ninjas" } },
    { context: { source: "openweb_ninja" } },
    { context: { provider: "api_ninjas" } },
  ]);

  assert.deepEqual(providerTrace, ["google_places_ev", "api_ninjas", "openweb_ninja"]);
});

test("EV route charging classifies tight and charging-needed range states", async () => {
  const scorer = createEvRouteFallbackScorer({
    buildRoute: async () => { throw new Error("not used"); },
    loadEvChargers: async () => ({ chargers: [] }),
  });
  const tight = await scorer.scoreEvRouteFallback({
    route: { distanceKm: 95, points: twoPointRoute() },
    selectedRangeKm: 100,
  });
  const chargingNeeded = await scorer.scoreEvRouteFallback({
    route: { distanceKm: 140, points: twoPointRoute() },
    selectedRangeKm: 100,
  });

  assert.equal(tight.context.rangeStatus, "tight");
  assert.equal(tight.context.recommendedChargeCount, 0);
  assert.match(tight.context.warnings[0], /margin is tight/);
  assert.equal(chargingNeeded.context.rangeStatus, "charging_needed");
  assert.equal(chargingNeeded.context.recommendedChargeCount, 1);
  assert.match(chargingNeeded.context.warnings[0], /above selected EV range/);
});

test("EV route charging keeps route result when provider lookup fails", async () => {
  const scorer = createEvRouteFallbackScorer({
    buildRoute: async () => { throw new Error("not used"); },
    loadEvChargers: async () => { throw new Error("rate limited"); },
  });

  const result = await scorer.scoreEvRouteFallback({
    route: { distanceKm: 60, points: twoPointRoute() },
    selectedRangeKm: 100,
  });

  assert.equal(result.context.rangeStatus, "tight");
  assert.equal(result.context.degraded, true);
  assert.match(result.context.warnings.join(" "), /rate limited/);
  assert.equal(result.chargers.length, 0);
});

test("Google Places EV normalisation maps connector aggregations without guaranteed live claims", () => {
  const chargers = normaliseGooglePlacesEvPayload(googlePlacesEvPayload(), {
    centre: { lat: -33.8688, lon: 151.2093 },
    radiusKm: 10,
    filters: { connectors: ["CCS2"], minPowerKw: 50, powerMode: "dc_fast" },
  });

  assert.equal(chargers.length, 1);
  assert.equal(chargers[0].source, "google_places_ev");
  assert.deepEqual(chargers[0].connectors, ["CCS2"]);
  assert.equal(chargers[0].maxPowerKw, 150);
  assert.equal(chargers[0].availableConnectorCount, 2);
  assert.match(chargers[0].availabilityLabel, /confirm in the network app/);
  assert.match(chargers[0].provenance, /Confirm tariff, access and live bay status/);
});

test("Google Places EV result does not expose live availability claims unless explicitly approved", async () => {
  const { createGooglePlacesEvAdapter } = require("../../api/_evGooglePlaces");
  const { loadEvChargers } = createGooglePlacesEvAdapter({
    fetchJson: async () => googlePlacesEvPayload(),
  });

  await withEnvAsync({
    FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
    FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
    FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "5",
    FUEL_PATH_GOOGLE_PLACES_EV_LIVE_AVAILABILITY_CLAIMS_ALLOWED: "",
  }, async () => {
    resetMemoryGeocodeQuotaForTests();
    const result = await loadEvChargers({
      centre: { lat: -33.8688, lon: 151.2093, label: "Sydney" },
      radiusKm: 10,
      connectors: ["CCS2"],
    });

    assert.equal(result.context.provider, "google_places_ev");
    assert.equal(result.context.provenance.realTimeAvailability, false);
    assert.match(result.context.warning, /trial data path/);
    assert.equal(result.chargers.length, 1);
  });
});

test("Google Places EV is fail-closed before provider calls when the daily cap is not set", async () => {
  const { createGooglePlacesEvAdapter } = require("../../api/_evGooglePlaces");
  let providerCalls = 0;
  const { loadEvChargers } = createGooglePlacesEvAdapter({
    fetchJson: async () => {
      providerCalls += 1;
      return googlePlacesEvPayload();
    },
  });

  await withEnvAsync({
    FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
    FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
    FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "",
  }, async () => {
    resetMemoryGeocodeQuotaForTests();
    await assert.rejects(
      () => loadEvChargers({
        centre: { lat: -33.8688, lon: 151.2093, label: "Sydney" },
        radiusKm: 10,
      }),
      /daily cap reached/,
    );
  });

  assert.equal(providerCalls, 0);
});

test("Google Places EV uses its own quota key before provider calls", async () => {
  const { createGooglePlacesEvAdapter } = require("../../api/_evGooglePlaces");
  const quotaStore = durableQuotaStore();
  setGeocodeQuotaStorageForTests(quotaStore);
  let providerCalls = 0;
  const { loadEvChargers } = createGooglePlacesEvAdapter({
    fetchJson: async () => {
      providerCalls += 1;
      return googlePlacesEvPayload();
    },
  });

  await withEnvAsync({
    FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
    FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
    FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "1",
  }, async () => {
    const first = await loadEvChargers({
      centre: { lat: -33.8688, lon: 151.2093, label: "Sydney" },
      radiusKm: 10,
    });
    assert.equal(first.chargers.length, 1);
    await assert.rejects(
      () => loadEvChargers({
        centre: { lat: -33.8688, lon: 151.2093, label: "Sydney" },
        radiusKm: 10,
        forceRefresh: true,
      }),
      /daily cap reached/,
    );
  });

  assert.equal(quotaStore.calls, 1);
  assert.equal(quotaStore.denied, 1);
  assert.deepEqual(quotaStore.keys, ["google_places_ev", "google_places_ev"]);
  assert.equal(providerCalls, 1);
  setGeocodeQuotaStorageForTests(null);
});

test("Google Places EV hard-stop default is enforced before provider calls", async () => {
  const { createGooglePlacesEvAdapter } = require("../../api/_evGooglePlaces");
  let providerCalls = 0;
  const { loadEvChargers } = createGooglePlacesEvAdapter({
    fetchJson: async () => {
      providerCalls += 1;
      return googlePlacesEvPayload();
    },
  });

  try {
    setGeocodeQuotaStorageForTests({
      status() {
        return {
          mode: "postgres_neon",
          configured: true,
          durable: true,
          table: "fuel_path_geocode_quotas",
          warning: "",
        };
      },
      async usage({ quotaKey, date }) {
        return { quotaKey, date, calls: 10, durable: true };
      },
      async reserve() {
        throw new Error("quota reserve should not run after the hard stop");
      },
    });
    await withEnvAsync({
      FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
      FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
      FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "10",
      FUEL_PATH_GOOGLE_PLACES_EV_HARD_STOP_PERCENT: "",
    }, async () => {
      await assert.rejects(
        () => loadEvChargers({
          centre: { lat: -33.8688, lon: 151.2093, label: "Sydney" },
          radiusKm: 10,
        }),
        /daily cap reached/,
      );
    });

    assert.equal(providerCalls, 0);
  } finally {
    setGeocodeQuotaStorageForTests(null);
  }
});

test("EV charging status exposes Google EV cap readiness separately from autocomplete", () => {
  withEnv({
    FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "",
    FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
    FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "5",
    FUEL_PATH_EV_DEFAULT_PROVIDER: "",
  }, () => {
    const disabled = evChargingStatus();
    assert.equal(disabled.googlePlacesEvCostControls.enabled, false);
    assert.equal(disabled.googlePlacesEvCostControls.status, "disabled");
    assert.deepEqual(disabled.googlePlacesEvCostControls.blockers, []);
  });

  withEnv({
    FUEL_PATH_GOOGLE_PLACES_EV_ENABLED: "1",
    FUEL_PATH_GOOGLE_PLACES_EV_API_KEY: "google-ev-test",
    FUEL_PATH_GOOGLE_PLACES_EV_DAILY_CAP: "0",
    FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED: "",
    FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED: "",
    FUEL_PATH_EV_DEFAULT_PROVIDER: "",
  }, () => {
    const status = evChargingStatus();
    assert.equal(status.provider, "google_places_ev");
    assert.equal(status.googlePlacesEvCostControls.enabled, true);
    assert.equal(status.googlePlacesEvCostControls.dailyCap, 0);
    assert.equal(status.googlePlacesEvCostControls.status, "blocked");
    assert.equal(status.googlePlacesEvCostControls.blockers.includes("google_places_ev_daily_cap_not_set"), true);
    assert.equal(status.googlePlacesEvCostControls.blockers.includes("google_places_ev_key_restriction_not_confirmed"), true);
    assert.equal(status.googlePlacesEvCostControls.blockers.includes("google_places_ev_budget_alert_not_confirmed"), true);
  });
});

test("EV route fallback POST uses provider cascade after API Ninjas returns no chargers", async () => {
  const handlerPath = require.resolve("../../api/ev-chargers");
  delete require.cache[handlerPath];
  const previousEnv = {
    API_NINJAS_API_KEY: process.env.API_NINJAS_API_KEY,
    OPENWEB_NINJA_API_KEY: process.env.OPENWEB_NINJA_API_KEY,
    API_NINJAS_EV_CHARGER_API_BASE_URL: process.env.API_NINJAS_EV_CHARGER_API_BASE_URL,
    OPENWEB_NINJA_EV_CHARGE_API_BASE_URL: process.env.OPENWEB_NINJA_EV_CHARGE_API_BASE_URL,
    FUEL_PATH_EV_DEFAULT_PROVIDER: process.env.FUEL_PATH_EV_DEFAULT_PROVIDER,
    FUEL_PATH_EV_CASCADE_PROVIDERS: process.env.FUEL_PATH_EV_CASCADE_PROVIDERS,
  };
  const previousFetch = global.fetch;
  process.env.API_NINJAS_API_KEY = "api-ninjas-test";
  process.env.OPENWEB_NINJA_API_KEY = "openweb-test";
  process.env.API_NINJAS_EV_CHARGER_API_BASE_URL = "https://api-ninjas.test/evcharger";
  process.env.OPENWEB_NINJA_EV_CHARGE_API_BASE_URL = "https://openweb.test/ev-charge-finder/search-by-location";
  process.env.FUEL_PATH_EV_DEFAULT_PROVIDER = "api_ninjas";
  process.env.FUEL_PATH_EV_CASCADE_PROVIDERS = "openweb_ninja";
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith("https://api-ninjas.test/")) {
      return jsonResponse([]);
    }
    if (String(url).startsWith("https://openweb.test/")) {
      return jsonResponse(openWebNinjaPayload());
    }
    throw new Error(`Unexpected fetch ${url}`);
  };

  try {
    const handler = require("../../api/ev-chargers");
    const payload = await invokeHandler(handler, {
      method: "POST",
      body: {
        mode: "route_charging",
        connectors: ["CCS2"],
        radiusKm: 35,
        limit: 3,
        route: {
          points: [
            { lat: -20.7364, lon: 116.8463, label: "Karratha" },
            { lat: -21.9303, lon: 114.1240, label: "Exmouth" },
          ],
          distanceKm: 180,
        },
        selectedRangeKm: 280,
      },
    });

    assert.equal(payload.statusCode, 200);
    assert.equal(payload.body.context.planMode, "route_charging");
    assert.equal(payload.body.context.rangeStatus, "comfortable");
    assert.equal(payload.body.context.provider, "api_ninjas+openweb_ninja");
    assert.equal(payload.body.context.fallbackMode, "sampled_route_corridor");
    assert.equal(payload.body.chargers.length > 0, true);
    assert.equal(payload.body.chargers[0].source, "openweb_ninja");
    assert.equal(calls.some((url) => url.startsWith("https://api-ninjas.test/")), true);
    assert.equal(calls.some((url) => url.startsWith("https://openweb.test/")), true);
  } finally {
    global.fetch = previousFetch;
    delete require.cache[handlerPath];
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("EV provider cascade treats Open Charge Map empty rows as not useful and falls through to API Ninjas", async () => {
  const handlerPath = require.resolve("../../api/ev-chargers");
  delete require.cache[handlerPath];
  const previousEnv = {
    API_NINJAS_API_KEY: process.env.API_NINJAS_API_KEY,
    OPEN_CHARGE_MAP_API_KEY: process.env.OPEN_CHARGE_MAP_API_KEY,
    API_NINJAS_EV_CHARGER_API_BASE_URL: process.env.API_NINJAS_EV_CHARGER_API_BASE_URL,
    OPEN_CHARGE_MAP_API_BASE_URL: process.env.OPEN_CHARGE_MAP_API_BASE_URL,
    FUEL_PATH_EV_DEFAULT_PROVIDER: process.env.FUEL_PATH_EV_DEFAULT_PROVIDER,
    FUEL_PATH_EV_CASCADE_PROVIDERS: process.env.FUEL_PATH_EV_CASCADE_PROVIDERS,
  };
  const previousFetch = global.fetch;
  process.env.API_NINJAS_API_KEY = "api-ninjas-test";
  process.env.OPEN_CHARGE_MAP_API_KEY = "ocm-test";
  process.env.API_NINJAS_EV_CHARGER_API_BASE_URL = "https://api-ninjas.test/evcharger";
  process.env.OPEN_CHARGE_MAP_API_BASE_URL = "https://ocm.test/v3";
  process.env.FUEL_PATH_EV_DEFAULT_PROVIDER = "open_charge_map";
  process.env.FUEL_PATH_EV_CASCADE_PROVIDERS = "api_ninjas";
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith("https://ocm.test/")) return jsonResponse([]);
    if (String(url).startsWith("https://api-ninjas.test/")) return jsonResponse(apiNinjasPayload());
    throw new Error(`Unexpected fetch ${url}`);
  };

  try {
    const handler = require("../../api/ev-chargers");
    const payload = await invokeHandler(handler, {
      method: "GET",
      query: {
        lat: "-12.4634",
        lon: "130.8456",
        label: "Darwin NT",
        radiusKm: "20",
        limit: "8",
        connectors: "TYPE2",
      },
    });

    assert.equal(payload.statusCode, 200);
    assert.equal(payload.body.context.provider, "open_charge_map+api_ninjas");
    assert.equal(payload.body.chargers.some((charger) => charger.source === "api_ninjas"), true);
    assert.equal(calls.some((url) => url.startsWith("https://ocm.test/")), true);
    assert.equal(calls.some((url) => url.startsWith("https://api-ninjas.test/")), true);
  } finally {
    global.fetch = previousFetch;
    delete require.cache[handlerPath];
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("EV provider cascade labels an exhausted Open Charge Map empty result as not useful", async () => {
  const handlerPath = require.resolve("../../api/ev-chargers");
  delete require.cache[handlerPath];
  const previousEnv = {
    API_NINJAS_API_KEY: process.env.API_NINJAS_API_KEY,
    OPEN_CHARGE_MAP_API_KEY: process.env.OPEN_CHARGE_MAP_API_KEY,
    OPEN_CHARGE_MAP_API_BASE_URL: process.env.OPEN_CHARGE_MAP_API_BASE_URL,
    FUEL_PATH_EV_DEFAULT_PROVIDER: process.env.FUEL_PATH_EV_DEFAULT_PROVIDER,
    FUEL_PATH_EV_CASCADE_PROVIDERS: process.env.FUEL_PATH_EV_CASCADE_PROVIDERS,
  };
  const previousFetch = global.fetch;
  process.env.API_NINJAS_API_KEY = "";
  process.env.OPEN_CHARGE_MAP_API_KEY = "ocm-test";
  process.env.OPEN_CHARGE_MAP_API_BASE_URL = "https://ocm.test/v3";
  process.env.FUEL_PATH_EV_DEFAULT_PROVIDER = "open_charge_map";
  process.env.FUEL_PATH_EV_CASCADE_PROVIDERS = "";
  global.fetch = async (url) => {
    if (String(url).startsWith("https://ocm.test/")) return jsonResponse([]);
    throw new Error(`Unexpected fetch ${url}`);
  };

  try {
    const handler = require("../../api/ev-chargers");
    const payload = await invokeHandler(handler, {
      method: "GET",
      query: {
        lat: "-12.4634",
        lon: "130.8456",
        label: "Darwin NT",
        radiusKm: "20",
        limit: "8",
      },
    });

    assert.equal(payload.statusCode, 200);
    assert.equal(payload.body.context.provider.includes("open_charge_map"), true);
    assert.equal(payload.body.chargers.length, 0);
    assert.match(payload.body.context.warning, /Some charger directories did not return usable rows/);
  } finally {
    global.fetch = previousFetch;
    delete require.cache[handlerPath];
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("EV default provider cascade enriches thin API Ninjas charger metadata when OpenWeb is configured", async () => {
  const handlerPath = require.resolve("../../api/ev-chargers");
  delete require.cache[handlerPath];
  const previousEnv = {
    API_NINJAS_API_KEY: process.env.API_NINJAS_API_KEY,
    OPENWEB_NINJA_API_KEY: process.env.OPENWEB_NINJA_API_KEY,
    API_NINJAS_EV_CHARGER_API_BASE_URL: process.env.API_NINJAS_EV_CHARGER_API_BASE_URL,
    OPENWEB_NINJA_EV_CHARGE_API_BASE_URL: process.env.OPENWEB_NINJA_EV_CHARGE_API_BASE_URL,
    FUEL_PATH_EV_DEFAULT_PROVIDER: process.env.FUEL_PATH_EV_DEFAULT_PROVIDER,
    FUEL_PATH_EV_CASCADE_PROVIDERS: process.env.FUEL_PATH_EV_CASCADE_PROVIDERS,
  };
  const previousFetch = global.fetch;
  process.env.API_NINJAS_API_KEY = "api-ninjas-test";
  process.env.OPENWEB_NINJA_API_KEY = "openweb-test";
  process.env.API_NINJAS_EV_CHARGER_API_BASE_URL = "https://api-ninjas.test/evcharger";
  process.env.OPENWEB_NINJA_EV_CHARGE_API_BASE_URL = "https://openweb.test/ev-charge-finder/search-by-location";
  process.env.FUEL_PATH_EV_DEFAULT_PROVIDER = "api_ninjas";
  process.env.FUEL_PATH_EV_CASCADE_PROVIDERS = "openweb_ninja";
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith("https://api-ninjas.test/")) return jsonResponse(apiNinjasThinKarrathaPayload());
    if (String(url).startsWith("https://openweb.test/")) return jsonResponse(openWebNinjaPayload());
    throw new Error(`Unexpected fetch ${url}`);
  };

  try {
    const handler = require("../../api/ev-chargers");
    const payload = await invokeHandler(handler, {
      method: "GET",
      query: {
        lat: "-20.7364",
        lon: "116.8463",
        label: "Karratha WA",
        radiusKm: "20",
        limit: "8",
      },
    });

    assert.equal(payload.statusCode, 200);
    assert.equal(payload.body.context.provider, "api_ninjas+openweb_ninja");
    assert.equal(payload.body.chargers.some((charger) => charger.source === "api_ninjas"), true);
    assert.equal(payload.body.chargers.some((charger) => charger.source === "openweb_ninja" && charger.maxPowerKw === 50), true);
    assert.equal(calls.some((url) => url.startsWith("https://api-ninjas.test/")), true);
    assert.equal(calls.some((url) => url.startsWith("https://openweb.test/")), true);
  } finally {
    global.fetch = previousFetch;
    delete require.cache[handlerPath];
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("EV default provider cascade keeps usable rows healthy when optional enrichment is rate limited", async () => {
  const handlerPath = require.resolve("../../api/ev-chargers");
  delete require.cache[handlerPath];
  const previousEnv = {
    API_NINJAS_API_KEY: process.env.API_NINJAS_API_KEY,
    OPENWEB_NINJA_API_KEY: process.env.OPENWEB_NINJA_API_KEY,
    API_NINJAS_EV_CHARGER_API_BASE_URL: process.env.API_NINJAS_EV_CHARGER_API_BASE_URL,
    OPENWEB_NINJA_EV_CHARGE_API_BASE_URL: process.env.OPENWEB_NINJA_EV_CHARGE_API_BASE_URL,
    FUEL_PATH_EV_DEFAULT_PROVIDER: process.env.FUEL_PATH_EV_DEFAULT_PROVIDER,
    FUEL_PATH_EV_CASCADE_PROVIDERS: process.env.FUEL_PATH_EV_CASCADE_PROVIDERS,
  };
  const previousFetch = global.fetch;
  process.env.API_NINJAS_API_KEY = "api-ninjas-test";
  process.env.OPENWEB_NINJA_API_KEY = "openweb-test";
  process.env.API_NINJAS_EV_CHARGER_API_BASE_URL = "https://api-ninjas.test/evcharger";
  process.env.OPENWEB_NINJA_EV_CHARGE_API_BASE_URL = "https://openweb.test/ev-charge-finder/search-by-location";
  process.env.FUEL_PATH_EV_DEFAULT_PROVIDER = "api_ninjas";
  process.env.FUEL_PATH_EV_CASCADE_PROVIDERS = "openweb_ninja";
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith("https://api-ninjas.test/")) return jsonResponse(apiNinjasThinKarrathaPayload());
    if (String(url).startsWith("https://openweb.test/")) {
      return jsonResponse({ error: { message: "Rate limit exceeded" } }, 429);
    }
    throw new Error(`Unexpected fetch ${url}`);
  };

  try {
    const handler = require("../../api/ev-chargers");
    const payload = await invokeHandler(handler, {
      method: "GET",
      query: {
        lat: "-20.7364",
        lon: "116.8463",
        label: "Karratha WA",
        radiusKm: "20",
        limit: "8",
      },
    });

    assert.equal(payload.statusCode, 200);
    assert.equal(payload.body.context.provider, "api_ninjas+openweb_ninja");
    assert.equal(payload.body.context.degraded, false);
    assert.match(payload.body.context.warning, /Some charger data is temporarily busy/);
    assert.equal(payload.body.chargers.some((charger) => charger.source === "api_ninjas"), true);
    assert.equal(calls.some((url) => url.startsWith("https://api-ninjas.test/")), true);
    assert.equal(calls.some((url) => url.startsWith("https://openweb.test/")), true);
  } finally {
    global.fetch = previousFetch;
    delete require.cache[handlerPath];
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("EV provider cooldown skips OpenWeb Ninja after a rate-limit error", async () => {
  const handlerPath = require.resolve("../../api/ev-chargers");
  delete require.cache[handlerPath];
  const previousEnv = {
    API_NINJAS_API_KEY: process.env.API_NINJAS_API_KEY,
    OPENWEB_NINJA_API_KEY: process.env.OPENWEB_NINJA_API_KEY,
    API_NINJAS_EV_CHARGER_API_BASE_URL: process.env.API_NINJAS_EV_CHARGER_API_BASE_URL,
    OPENWEB_NINJA_EV_CHARGE_API_BASE_URL: process.env.OPENWEB_NINJA_EV_CHARGE_API_BASE_URL,
    FUEL_PATH_EV_DEFAULT_PROVIDER: process.env.FUEL_PATH_EV_DEFAULT_PROVIDER,
    FUEL_PATH_EV_CASCADE_PROVIDERS: process.env.FUEL_PATH_EV_CASCADE_PROVIDERS,
    FUEL_PATH_OPENWEB_NINJA_RATE_LIMIT_COOLDOWN_MS: process.env.FUEL_PATH_OPENWEB_NINJA_RATE_LIMIT_COOLDOWN_MS,
  };
  const previousFetch = global.fetch;
  clearOpenWebNinjaRateLimit();
  process.env.API_NINJAS_API_KEY = "api-ninjas-test";
  process.env.OPENWEB_NINJA_API_KEY = "openweb-test";
  process.env.API_NINJAS_EV_CHARGER_API_BASE_URL = "https://api-ninjas.test/evcharger";
  process.env.OPENWEB_NINJA_EV_CHARGE_API_BASE_URL = "https://openweb.test/ev-charge-finder/search-by-location";
  process.env.FUEL_PATH_EV_DEFAULT_PROVIDER = "api_ninjas";
  process.env.FUEL_PATH_EV_CASCADE_PROVIDERS = "openweb_ninja";
  process.env.FUEL_PATH_OPENWEB_NINJA_RATE_LIMIT_COOLDOWN_MS = "30000";

  const calls = [];
  let openWebCallCount = 0;
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith("https://api-ninjas.test/")) return jsonResponse(apiNinjasThinKarrathaPayload());
    if (String(url).startsWith("https://openweb.test/")) {
      openWebCallCount += 1;
      return jsonResponse({ error: "Rate limit exceeded" }, 429);
    }
    throw new Error(`Unexpected fetch ${url}`);
  };

  try {
    const handler = require("../../api/ev-chargers");
    const first = await invokeHandler(handler, {
      method: "GET",
      query: {
        lat: "-20.7364",
        lon: "116.8463",
        label: "Karratha WA",
        radiusKm: "20",
        limit: "8",
      },
    });
    const second = await invokeHandler(handler, {
      method: "GET",
      query: {
        lat: "-20.7364",
        lon: "116.8463",
        label: "Karratha WA",
        radiusKm: "20",
        limit: "8",
      },
    });

    assert.equal(first.statusCode, 200);
    assert.equal(first.body.context.provider, "api_ninjas+openweb_ninja");
    assert.equal(first.body.context.degraded, false);
    assert.equal(openWebCallCount, 1);
    assert.equal(second.statusCode, 200);
    assert.equal(second.body.context.provider, "api_ninjas");
    assert.equal(openWebCallCount, 1);
    assert.equal(calls.filter((url) => url.startsWith("https://openweb.test/")).length, 1);
    assert.equal(second.body.context.degraded, false);
  } finally {
    global.fetch = previousFetch;
    delete require.cache[handlerPath];
    clearOpenWebNinjaRateLimit();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("EV charging status exposes OpenWeb rate-limit cooldown state", () => {
  clearOpenWebNinjaRateLimit();
  try {
    markOpenWebNinjaRateLimit("provider test rate limit hit");
    const status = evChargingStatus();
    assert.equal(status.openWebNinjaRateLimited, true);
    assert.equal(status.openWebNinjaRateLimitReason.includes("provider test rate limit hit"), true);
    assert.equal(status.openWebNinjaRateLimitRemainingMs > 0, true);
  } finally {
    clearOpenWebNinjaRateLimit();
  }
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

function apiNinjasThinKarrathaPayload() {
  return [
    {
      is_active: true,
      name: "Karratha Shopping Centre AC",
      address: "Welcome Road",
      city: "Karratha",
      region: "WA",
      country: "AU",
      latitude: -20.7362,
      longitude: 116.8461,
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

function googlePlacesEvPayload() {
  return {
    places: [
      {
        id: "places-fast-1",
        displayName: { text: "Harbour Fast Charge" },
        formattedAddress: "1 George Street, Sydney NSW",
        location: { latitude: -33.8687, longitude: 151.2094 },
        evChargeOptions: {
          connectorCount: 4,
          connectorAggregation: [
            {
              type: "EV_CONNECTOR_TYPE_CCS_COMBO_2",
              maxChargeRateKw: 150,
              count: 4,
              availableCount: 2,
              outOfServiceCount: 0,
              availabilityLastUpdateTime: "2026-07-03T01:00:00Z",
            },
          ],
        },
      },
    ],
  };
}

function twoPointRoute() {
  return [
    { lat: -31.95, lon: 115.85, label: "Start" },
    { lat: -31.95, lon: 115.95, label: "End" },
  ];
}

function evCharger({
  id,
  lat,
  lon,
  distanceKm = 0,
  maxPowerKw,
  name,
}) {
  return {
    id,
    name: name || id,
    operator: "Test",
    lat,
    lon,
    distanceKm,
    connectors: ["TYPE2"],
    connections: [{ connector: "TYPE2", connectorLabel: "Type 2", powerKw: maxPowerKw }],
    maxPowerKw,
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

async function withEnvAsync(values, callback) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    await callback();
  } finally {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => "application/json",
    },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function durableQuotaStore() {
  return {
    calls: 0,
    denied: 0,
    keys: [],
    status() {
      return {
        mode: "postgres_neon",
        configured: true,
        durable: true,
        table: "fuel_path_geocode_quotas",
        warning: "",
      };
    },
    async reserve({ quotaKey, cap, date }) {
      this.keys.push(quotaKey);
      if (this.calls >= cap) {
        this.denied += 1;
        return { allowed: false, calls: this.calls, cap, date, durable: true };
      }
      this.calls += 1;
      return { allowed: true, calls: this.calls, cap, date, durable: true };
    },
  };
}

function invokeHandler(handler, req) {
  return new Promise((resolve) => {
    const response = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(name, value) {
        this.headers[name] = value;
      },
      json(body) {
        resolve({ statusCode: this.statusCode, headers: this.headers, body });
      },
      end(body) {
        resolve({ statusCode: this.statusCode, headers: this.headers, body });
      },
    };
    handler({ query: {}, ...req }, response);
  });
}
