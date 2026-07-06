const assert = require("node:assert/strict");
const test = require("node:test");

const {
  capabilitiesForPoints,
  capabilitySummary,
  fuelProviderCapabilityMatrix,
  liveProviderKeysForArea,
  loadStationData,
  normaliseNtPayload,
  normaliseNtReferencePayload,
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
      FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
      FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
      FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
      NT_MYFUEL_USERNAME: "test-nt-user",
      NT_MYFUEL_PASSWORD: "test-nt-password",
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
      assert.equal(capabilities.find((item) => item.region === "TAS")?.capability, "live");
      assert.equal(capabilities.find((item) => item.region === "NT")?.capability, "live");
      assert.match(
        capabilities.find((item) => item.region === "TAS")?.accessPath || "",
        /TAS nearby payloads/,
      );
      assert.match(
        capabilities.find((item) => item.region === "VIC")?.nextAction || "",
        /Servo Saver Public API access/,
      );
      assert.match(
        capabilities.find((item) => item.region === "NT")?.accessPath || "",
        /approved Fuel Path access to the MyFuel NT third-party API/,
      );
      assert.deepEqual(capabilitySummary(capabilities), { live: 7, pending_access: 1 });
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

test("VIC capability uses default Servo Saver base URL when only the API key is configured", () => {
  withEnv(
    {
      VIC_SERVO_SAVER_API_BASE_URL: "",
      VIC_SERVO_SAVER_API_KEY: "test-vic-key",
    },
    () => {
      const capabilities = fuelProviderCapabilityMatrix();
      const vic = capabilities.find((item) => item.region === "VIC");

      assert.equal(vic?.capability, "live");
      assert.equal(vic?.configured, true);
      assert.match(vic?.nextAction || "", /terms and attribution evidence/);
      assert.deepEqual(liveProviderKeysForArea([{ lat: -37.8136, lon: 144.9631 }], 8), ["vic"]);
    },
  );
});

test("NT capability uses MyFuel credentials and routes live provider selection", () => {
  withEnv(
    {
      NT_MYFUEL_USERNAME: "test-nt-user",
      NT_MYFUEL_PASSWORD: "test-nt-password",
    },
    () => {
      const capabilities = fuelProviderCapabilityMatrix();
      const nt = capabilities.find((item) => item.region === "NT");

      assert.equal(nt?.capability, "live");
      assert.equal(nt?.configured, true);
      assert.deepEqual(liveProviderKeysForArea([{ lat: -12.4634, lon: 130.8456 }], 8), ["nt"]);
    },
  );
});

test("status endpoint exposes the national capability contract", async () => {
  const response = await callStatus();

  assert.equal(response.status, 200);
  assert.equal(response.payload.sourceScope.defaultSourceMeaning.includes("coarse server diagnostic only"), true);
  assert.equal(response.payload.sourceScope.regionalSelection, "region-aware");
  assert.equal(
    response.payload.sourceScope.publicLivePriceClaimsAllowed,
    response.payload.fuelProviders.publicClaims.publicLivePriceClaimsAllowed,
  );
  assert.equal(response.payload.releaseReadiness.publicBeta.status, "blocked_until_external_evidence");
  assert.equal(
    response.payload.releaseReadiness.publicBeta.blockers.includes("physical_device_validation"),
    true,
  );
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
  assert.equal(typeof response.payload.fuelProviders.publicClaims, "object");
  assert.equal(Array.isArray(response.payload.fuelProviders.publicClaims.blockers), true);
});

test("status endpoint keeps provider and map secrets out of diagnostic payloads", async () => {
  await withEnv(
    {
      NSW_FUEL_API_KEY: "secret-nsw-key",
      NSW_FUEL_API_SECRET: "secret-nsw-secret",
      QLD_FUEL_API_TOKEN: "secret-qld-token",
      NT_MYFUEL_USERNAME: "secret-nt-user",
      NT_MYFUEL_PASSWORD: "secret-nt-password",
      FUEL_PATH_GOOGLE_MAPS_API_KEY: "secret-google-map-key",
      FUEL_PATH_GOOGLE_ROUTES_API_KEY: "secret-google-routes-key",
    },
    async () => {
      const response = await callStatus();
      const payloadText = JSON.stringify(response.payload);

      assert.equal(response.status, 200);
      assert.equal(response.payload.maps.googleMapsConfigured, true);
      assert.equal(response.payload.maps.googleDirectionsEnabled, true);
      assert.equal(response.payload.maps.googleMapsApiKey, "");
      assert.equal(payloadText.includes("secret-nsw-key"), false);
      assert.equal(payloadText.includes("secret-nsw-secret"), false);
      assert.equal(payloadText.includes("secret-qld-token"), false);
      assert.equal(payloadText.includes("secret-nt-user"), false);
      assert.equal(payloadText.includes("secret-nt-password"), false);
      assert.equal(payloadText.includes("secret-google-map-key"), false);
      assert.equal(payloadText.includes("secret-google-routes-key"), false);
    },
  );
});

test("MyFuel NT adapter loads Darwin prices through token, reference and postcode endpoints", async () => {
  await withEnv(
    {
      NT_MYFUEL_API_BASE_URL: "https://myfuelnt.nt.gov.au",
      NT_MYFUEL_USERNAME: "test-nt-user",
      NT_MYFUEL_PASSWORD: "test-nt-password",
    },
    async () => {
      const mockFetch = installFetchMock(async (url, options = {}) => {
        const parsed = new URL(String(url));
        if (parsed.pathname === "/api/token") {
          assert.equal(options.method, "POST");
          assert.match(String(options.body || ""), /grant_type=password/);
          return jsonResponse({ access_token: "nt-token", token_type: "Bearer", expires_in: 3600 });
        }
        if (parsed.pathname === "/api/v1/getReferenceData") {
          return jsonResponse(ntReferencePayload());
        }
        if (parsed.pathname === "/api/v1/getFuelPrice/postCode") {
          assert.equal(options.method, "POST");
          const postCode = JSON.parse(options.body).postCode;
          assert.match(postCode, /^\d{4}$/);
          return jsonResponse(postCode === "0800" ? ntPostcodePayload() : { Data: [] });
        }
        if (parsed.pathname === "/api/v1/getFuelPrice/fuelOutletIdentifier") {
          assert.equal(options.method, "POST");
          return jsonResponse({ Data: [] });
        }
        throw new Error(`Unexpected NT endpoint: ${parsed.pathname}`);
      });

      try {
        const data = await loadStationData({
          requestedSource: "nt",
          forceRefresh: true,
          points: [{ lat: -12.4634, lon: 130.8456 }],
          radiusKm: 8,
          fuels: ["U91", "DL"],
        });

        assert.equal(data.source, "api_nt");
        assert.equal(data.provider, "api_nt");
        assert.equal(data.capability, "live");
        assert.equal(data.degraded, false);
        assert.equal(data.providerHealth.nt.status, "ok");
        assert.equal(data.stations.length, 1);
        assert.equal(data.stations[0].stationCode, "NT-DAR-001");
        assert.equal(data.stations[0].source, "api_nt_myfuel");
        assert.equal(data.stations[0].prices.U91, 195.7);
        assert.equal(data.stations[0].prices.DL, 207.9);
        assert.equal(data.stations[0].suburb, "Darwin");
      } finally {
        mockFetch.restore();
      }
    },
  );
});

test("MyFuel NT adapter samples live prices across the territory", async () => {
  await withEnv(
    {
      NT_MYFUEL_API_BASE_URL: "https://myfuelnt.nt.gov.au",
      NT_MYFUEL_USERNAME: "test-nt-user",
      NT_MYFUEL_PASSWORD: "test-nt-password",
    },
    async () => {
      const mockFetch = installFetchMock(async (url, options = {}) => {
        const parsed = new URL(String(url));
        if (parsed.pathname === "/api/token") {
          return jsonResponse({ access_token: "nt-token-wide", token_type: "Bearer", expires_in: 3600 });
        }
        if (parsed.pathname === "/api/v1/getReferenceData") {
          return jsonResponse(ntTerritoryReferencePayload());
        }
        if (parsed.pathname === "/api/v1/getFuelPrice/postCode") {
          const postCode = JSON.parse(options.body).postCode;
          return jsonResponse(ntTerritoryPostcodePayload(postCode));
        }
        throw new Error(`Unexpected NT endpoint: ${parsed.pathname}`);
      });

      try {
        const data = await loadStationData({
          requestedSource: "nt",
          forceRefresh: true,
          points: [
            { lat: -12.4634, lon: 130.8456 },
            { lat: -12.486, lon: 130.9833 },
            { lat: -14.4652, lon: 132.2635 },
            { lat: -19.648, lon: 134.191 },
            { lat: -23.698, lon: 133.8807 },
            { lat: -25.242, lon: 130.9849 },
            { lat: -12.1884, lon: 136.782 },
          ],
          radiusKm: 35,
          fuels: ["U91"],
        });

        const stationCodes = data.stations.map((station) => station.stationCode).sort();
        assert.equal(data.source, "api_nt");
        assert.equal(data.capability, "live");
        assert.equal(data.degraded, false);
        assert.deepEqual(stationCodes, [
          "NT-ASP-001",
          "NT-DAR-001",
          "NT-KAT-001",
          "NT-NHU-001",
          "NT-PAL-001",
          "NT-TCK-001",
          "NT-YUL-001",
        ]);
        assert.equal(data.stations.every((station) => station.source === "api_nt_myfuel"), true);
        assert.equal(data.stations.every((station) => Number.isFinite(station.prices.U91)), true);
      } finally {
        mockFetch.restore();
      }
    },
  );
});

test("MyFuel NT normalisers accept production reference and AvailableFuel payload casing", () => {
  const referenceStations = normaliseNtReferencePayload({
    Brands: [{ BrandIdentifier: "MET", BrandName: "Metro" }],
    Fuels: [{ FuelCode: "U91", FuelDescription: "Unleaded 91" }],
    Outlets: [
      {
        FuelOutletIdentifier: "08000008",
        FuelOutletName: "Darwin Production Shape",
        BrandIdentifier: "MET",
        Suburb: "Darwin",
        Address: "1 Smith Street, Darwin NT 0800",
        PostCode: "0800",
        Location: { Latitude: -12.4634, Longitude: 130.8456 },
      },
    ],
  });
  const pricedStations = normaliseNtPayload({
    Data: [
      {
        FuelOutletIdentifier: "08000008",
        FuelOutletName: "Darwin Production Shape",
        Suburb: "Darwin",
        Address: "1 Smith Street, Darwin NT 0800",
        PostCode: "0800",
        Location: { Latitude: -12.4634, Longitude: 130.8456 },
        AvailableFuel: [
          { FuelCode: "U91", Price: 196.3, IsAvailable: true },
          { FuelCode: "DL", Price: 210.1, IsAvailable: false },
        ],
      },
    ],
  });
  const priceOnlyStations = normaliseNtPayload({
    Data: [
      {
        FuelOutletIdentifier: "08000008",
        AvailableFuel: [{ FuelCode: "U91", Price: 196.3, IsAvailable: true }],
      },
    ],
  }, { requireCoordinates: false });

  assert.equal(referenceStations.length, 1);
  assert.equal(referenceStations[0].stationCode, "NT-08000008");
  assert.equal(referenceStations[0].name, "Darwin Production Shape");
  assert.equal(referenceStations[0].postcode, "0800");
  assert.equal(pricedStations.length, 1);
  assert.equal(pricedStations[0].stationCode, "NT-08000008");
  assert.equal(pricedStations[0].prices.U91, 196.3);
  assert.equal(pricedStations[0].prices.DL, undefined);
  assert.equal(priceOnlyStations.length, 1);
  assert.equal(priceOnlyStations[0].prices.U91, 196.3);
});

test("status and station responses use live VIC Servo Saver when credentials are configured", async () => {
  await withEnv(
    {
      VIC_SERVO_SAVER_API_BASE_URL: "https://api.fuel.service.vic.gov.au/open-data/v1",
      VIC_SERVO_SAVER_API_KEY: "test-vic-key",
      FUEL_PATH_PRODUCTION_HARDENING: "1",
    },
    async () => {
      const mockFetch = installFetchMock((url) => {
        const parsed = new URL(String(url));
        const path = parsed.pathname.replace(/^\/+/, "/");
        if (path === "/open-data/v1/fuel/reference-data/brands") {
          return jsonResponse(vicBrandsPayload());
        }
        if (path === "/open-data/v1/fuel/reference-data/types") {
          return jsonResponse(vicTypePayload());
        }
        if (path === "/open-data/v1/fuel/reference-data/stations") {
          return jsonResponse(vicStationsPayload());
        }
        if (path === "/open-data/v1/fuel/prices") {
          return jsonResponse(vicPricePayload());
        }
        throw new Error(`Unexpected VIC endpoint: ${path}`);
      });

      try {
        const status = await callStatus();
        const vic = status.payload.fuelProviders.capabilities.find((item) => item.region === "VIC");

        assert.equal(status.payload.fuelProviders.apiVicConfigured, true);
        assert.equal(status.payload.fuelProviders.vicStatus, "configured_live");
        assert.equal(vic?.capability, "live");
        assert.equal(vic?.configured, true);
        assert.equal(status.payload.fuelProviders.publicClaims.publicLivePriceClaimsAllowed, false);
        assert.equal(status.payload.fuelProviders.publicClaims.blockers.includes("vic_terms_evidence_not_attested"), true);
        assert.equal(status.payload.fuelProviders.publicClaims.evidenceRequired.includes("VIC"), true);

        const vicStations = await loadStationData({
          requestedSource: "vic",
          points: [{ lat: -37.8136, lon: 144.9631 }],
          radiusKm: 8,
          fuels: ["U91", "DL"],
          forceRefresh: true,
        });

        assert.equal(vicStations.source, "api_vic");
        assert.equal(vicStations.provider, "api_vic");
        assert.equal(vicStations.capability, "live");
        assert.equal(vicStations.degraded, false);
        assert.equal(vicStations.stations.length, 1);
        assert.equal(vicStations.stations[0].stationCode, "VIC-901");
        assert.equal(vicStations.stations[0].source, "api_vic_servo_saver");
        assert.equal(vicStations.stations[0].prices.DL, 188.4);
        assert.equal(vicStations.stations[0].prices.U91, 204.5);
        assert.equal(vicStations.stations[0].suburb, "Southbank");
        assert.equal(mockFetch.calls.length, 4);
      } finally {
        mockFetch.restore();
      }
    },
  );
});

test("status endpoint separates technical live access from public live-price claim readiness", async () => {
  await withEnv(
    {
      NSW_FUEL_API_KEY: "test-key",
      NSW_FUEL_API_SECRET: "test-secret",
      QLD_FUEL_API_TOKEN: "test-token",
      FUEL_PATH_PRODUCTION_HARDENING: "1",
      FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "",
      FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "",
      FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "",
      FUEL_PATH_PROVIDER_TERMS_EVIDENCE_CONFIRMED: "",
      VIC_SERVO_SAVER_API_KEY: "",
    },
    async () => {
      const response = await callStatus();
      const claims = response.payload.fuelProviders.publicClaims;

      assert.equal(claims.status, "blocked");
      assert.equal(claims.publicLivePriceClaimsAllowed, false);
      assert.equal(claims.blockers.includes("nsw_terms_not_confirmed"), true);
      assert.equal(claims.blockers.includes("act_terms_not_confirmed"), true);
      assert.equal(claims.blockers.includes("qld_terms_not_confirmed"), true);
      assert.equal(claims.blockers.includes("tas_terms_not_confirmed"), true);
      assert.deepEqual(claims.termsBlocked.sort(), ["ACT", "NSW", "QLD", "TAS"].sort());
      assert.deepEqual(claims.evidenceRequired, []);
    },
  );

  await withEnv(
    {
      NSW_FUEL_API_KEY: "test-key",
      NSW_FUEL_API_SECRET: "test-secret",
      QLD_FUEL_API_TOKEN: "test-token",
      FUEL_PATH_PRODUCTION_HARDENING: "1",
      FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
      FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
      FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
      FUEL_PATH_PROVIDER_TERMS_EVIDENCE_CONFIRMED: "",
      VIC_SERVO_SAVER_API_KEY: "",
    },
    async () => {
      const response = await callStatus();
      const claims = response.payload.fuelProviders.publicClaims;

      assert.equal(claims.status, "blocked");
      assert.equal(claims.publicLivePriceClaimsAllowed, false);
      assert.equal(claims.blockers.includes("nsw_terms_evidence_not_attested"), true);
      assert.equal(claims.blockers.includes("act_terms_evidence_not_attested"), true);
      assert.equal(claims.blockers.includes("qld_terms_evidence_not_attested"), true);
      assert.equal(claims.blockers.includes("tas_terms_evidence_not_attested"), true);
      assert.deepEqual(claims.evidenceRequired.sort(), ["ACT", "NSW", "QLD", "TAS"].sort());
    },
  );
});

test("status endpoint allows public live-price claims only when provider terms evidence is attested", async () => {
  await withEnv(
    {
      NSW_FUEL_API_KEY: "test-key",
      NSW_FUEL_API_SECRET: "test-secret",
      QLD_FUEL_API_TOKEN: "test-token",
      FUEL_PATH_PRODUCTION_HARDENING: "1",
      FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
      FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
      FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
      FUEL_PATH_PROVIDER_TERMS_EVIDENCE_CONFIRMED: "1",
    },
    async () => {
      const response = await callStatus();
      const claims = response.payload.fuelProviders.publicClaims;

      assert.equal(claims.status, "blocked_until_release_evidence");
      assert.equal(claims.publicLivePriceClaimsAllowed, false);
      assert.deepEqual(claims.blockers, ["release_claims_evidence_not_reviewed"]);
      assert.deepEqual(claims.evidenceRequired, []);
      assert.equal(claims.evidenceAttested, true);
      assert.equal(response.payload.sourceScope.providerTermsGateAllowsClaims, true);
      assert.equal(response.payload.releaseReadiness.publicBeta.blockers.includes("provider_terms_evidence"), true);
    },
  );
});

test("status endpoint includes VIC in public live-price claim evidence gating", async () => {
  await withEnv(
    {
      VIC_SERVO_SAVER_API_KEY: "test-vic-key",
      FUEL_PATH_PROVIDER_TERMS_EVIDENCE_CONFIRMED: "",
    },
    async () => {
      const response = await callStatus();
      const claims = response.payload.fuelProviders.publicClaims;

      assert.equal(claims.status, "blocked");
      assert.equal(claims.publicLivePriceClaimsAllowed, false);
      assert.equal(claims.blockers.includes("vic_terms_evidence_not_attested"), true);
      assert.equal(claims.evidenceRequired.includes("VIC"), true);
    },
  );

  await withEnv(
    {
      VIC_SERVO_SAVER_API_KEY: "test-vic-key",
      FUEL_PATH_PROVIDER_TERMS_EVIDENCE_CONFIRMED: "1",
    },
    async () => {
      const response = await callStatus();
      const claims = response.payload.fuelProviders.publicClaims;

      assert.equal(claims.blockers.includes("vic_terms_evidence_not_attested"), false);
      assert.equal(claims.evidenceRequired.includes("VIC"), false);
    },
  );
});

test("ACT coordinates are treated as NSW provider coverage", () => {
  const canberra = { lat: -35.2809, lon: 149.13 };

  assert.equal(pointInAct(canberra), true);
  assert.equal(pointInVic(canberra), false);
  withEnv({ NSW_FUEL_API_KEY: "test-nsw-key", NSW_FUEL_API_SECRET: "test-nsw-secret" }, () => {
    assert.deepEqual(liveProviderKeysForArea([canberra], 8), ["nsw"]);
  });
});

test("NSW side of the VIC border remains on NSW provider coverage", () => {
  const albury = { lat: -36.0737, lon: 146.9135 };
  const moama = { lat: -36.1129, lon: 144.7605 };

  assert.equal(pointInVic(albury), false);
  assert.equal(pointInVic(moama), false);
  withEnv({ NSW_FUEL_API_KEY: "test-nsw-key", NSW_FUEL_API_SECRET: "test-nsw-secret" }, () => {
    assert.deepEqual(liveProviderKeysForArea([albury], 8), ["nsw"]);
    assert.deepEqual(liveProviderKeysForArea([moama], 8), ["nsw"]);
  });
});

test("VIC side of the border remains on VIC provider coverage", () => {
  const wodonga = { lat: -36.1241, lon: 146.8818 };
  const echuca = { lat: -36.1418, lon: 144.7511 };
  const melbourne = { lat: -37.8136, lon: 144.9631 };

  assert.equal(pointInVic(wodonga), true);
  assert.equal(pointInVic(echuca), true);
  assert.equal(pointInVic(melbourne), true);
  withEnv({ VIC_SERVO_SAVER_API_KEY: "test-vic-key" }, () => {
    assert.deepEqual(liveProviderKeysForArea([wodonga], 8), ["vic"]);
    assert.deepEqual(liveProviderKeysForArea([echuca], 8), ["vic"]);
    assert.deepEqual(liveProviderKeysForArea([melbourne], 8), ["vic"]);
  });
});

test("eastern NSW route points do not get misclassified as VIC", () => {
  const wollongong = { lat: -34.4278, lon: 150.8931 };
  const eden = { lat: -37.0659, lon: 149.9013 };

  assert.equal(pointInVic(wollongong), false);
  assert.equal(pointInVic(eden), false);
  withEnv({ NSW_FUEL_API_KEY: "test-nsw-key", NSW_FUEL_API_SECRET: "test-nsw-secret" }, () => {
    assert.deepEqual(liveProviderKeysForArea([wollongong], 8), ["nsw"]);
    assert.deepEqual(liveProviderKeysForArea([eden], 8), ["nsw"]);
  });
});

test("multi-point NSW/VIC routes include the correct live provider order", () => {
  const albury = { lat: -36.0737, lon: 146.9135 };
  const wodonga = { lat: -36.1241, lon: 146.8818 };

  withEnv({ NSW_FUEL_API_KEY: "test-nsw-key", NSW_FUEL_API_SECRET: "test-nsw-secret", VIC_SERVO_SAVER_API_KEY: "test-vic-key" }, () => {
    assert.deepEqual(liveProviderKeysForArea([albury, wodonga], 8), ["nsw", "vic"]);
  });
});

test("multi-state routes include every configured provider touched by route geometry", () => {
  const townsville = { lat: -19.259, lon: 146.8169 };
  const tennantCreek = { lat: -19.648, lon: 134.191 };
  const adelaide = { lat: -34.9285, lon: 138.6007 };
  const perth = { lat: -31.9523, lon: 115.8613 };
  const strahan = { lat: -42.154, lon: 145.327 };
  const melbourne = { lat: -37.8136, lon: 144.9631 };

  withEnv(
    {
      QLD_FUEL_API_TOKEN: "test-qld-token",
      SA_FUEL_API_TOKEN: "test-sa-token",
      FUEL_PATH_WA_FUELWATCH_ENABLED: "1",
      VIC_SERVO_SAVER_API_KEY: "test-vic-key",
      NSW_FUEL_API_KEY: "test-nsw-key",
      NSW_FUEL_API_SECRET: "test-nsw-secret",
      NT_MYFUEL_USERNAME: "test-nt-user",
      NT_MYFUEL_PASSWORD: "test-nt-password",
    },
    () => {
      assert.deepEqual(liveProviderKeysForArea([townsville, tennantCreek], 8), ["qld", "nt"]);
      assert.deepEqual(liveProviderKeysForArea([adelaide, perth], 8), ["wa", "sa"]);
      assert.deepEqual(liveProviderKeysForArea([strahan, melbourne], 8), ["vic", "tas"]);
    },
  );
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

test("production FuelCheck NSW and QLD routes fail closed until usage terms are confirmed", async () => {
  const sydney = { lat: -33.8688, lon: 151.2093 };
  const brisbane = { lat: -27.4698, lon: 153.0251 };

  await withEnv(
    {
      NSW_FUEL_API_KEY: "test-nsw-key",
      NSW_FUEL_API_SECRET: "test-nsw-secret",
      QLD_FUEL_API_TOKEN: "test-qld-token",
      FUEL_PATH_PRODUCTION_HARDENING: "1",
      FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "",
      FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "",
    },
    async () => {
      assert.deepEqual(liveProviderKeysForArea([sydney], 8), []);
      assert.deepEqual(liveProviderKeysForArea([brisbane], 8), []);
      assert.equal(capabilitiesForPoints([sydney])[0]?.capability, "limited");
      assert.equal(capabilitiesForPoints([brisbane])[0]?.capability, "limited");

      const nsw = await loadStationData({
        requestedSource: "nsw",
        forceRefresh: true,
        points: [sydney],
        radiusKm: 8,
        fuels: ["U91"],
      });
      const qld = await loadStationData({
        requestedSource: "qld",
        forceRefresh: true,
        points: [brisbane],
        radiusKm: 8,
        fuels: ["U91"],
      });

      assert.equal(nsw.source, "live_unavailable");
      assert.equal(nsw.provider, "nsw");
      assert.equal(nsw.stations.length, 0);
      assert.match(nsw.warning, /FuelCheck NSW\/ACT public usage, caching and attribution terms are not confirmed/);
      assert.equal(qld.source, "live_unavailable");
      assert.equal(qld.provider, "qld");
      assert.equal(qld.stations.length, 0);
      assert.match(qld.warning, /QLD Fuel Prices public usage, caching and attribution terms are not confirmed/);
    },
  );
});

test("production FuelCheck NSW and QLD routes enable only after usage terms flags", () => {
  const sydney = { lat: -33.8688, lon: 151.2093 };
  const brisbane = { lat: -27.4698, lon: 153.0251 };

  withEnv(
    {
      NSW_FUEL_API_KEY: "test-nsw-key",
      NSW_FUEL_API_SECRET: "test-nsw-secret",
      QLD_FUEL_API_TOKEN: "test-qld-token",
      FUEL_PATH_PRODUCTION_HARDENING: "1",
      FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
      FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
    },
    () => {
      assert.deepEqual(liveProviderKeysForArea([sydney], 8), ["nsw"]);
      assert.deepEqual(liveProviderKeysForArea([brisbane], 8), ["qld"]);
      assert.equal(capabilitiesForPoints([sydney])[0]?.capability, "live");
      assert.equal(capabilitiesForPoints([brisbane])[0]?.capability, "live");
    },
  );
});

test("TAS routes to API.NSW v2 only when FuelCheck credentials are configured", () => {
  const hobart = { lat: -42.8821, lon: 147.3272 };

  withEnv({ NSW_FUEL_API_KEY: "", NSW_FUEL_API_SECRET: "" }, () => {
    assert.deepEqual(liveProviderKeysForArea([hobart], 8), []);
    assert.equal(capabilitiesForPoints([hobart])[0]?.capability, "pending_access");
  });

  withEnv({ NSW_FUEL_API_KEY: "test-nsw-key", NSW_FUEL_API_SECRET: "test-nsw-secret" }, () => {
    assert.deepEqual(liveProviderKeysForArea([hobart], 8), ["tas"]);
    assert.equal(capabilitiesForPoints([hobart])[0]?.capability, "live");
  });

  withEnv({
    NSW_FUEL_API_KEY: "test-nsw-key",
    NSW_FUEL_API_SECRET: "test-nsw-secret",
    FUEL_PATH_PRODUCTION_HARDENING: "1",
  }, () => {
    assert.deepEqual(liveProviderKeysForArea([hobart], 8), []);
    assert.equal(capabilitiesForPoints([hobart])[0]?.capability, "limited");
  });

  withEnv({
    NSW_FUEL_API_KEY: "test-nsw-key",
    NSW_FUEL_API_SECRET: "test-nsw-secret",
    FUEL_PATH_PRODUCTION_HARDENING: "1",
    FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
  }, () => {
    assert.deepEqual(liveProviderKeysForArea([hobart], 8), ["tas"]);
    assert.equal(capabilitiesForPoints([hobart])[0]?.capability, "live");
  });
});

test("production TAS source fails closed until usage terms are confirmed", async () => {
  await withEnv(
    {
      NSW_FUEL_API_KEY: "test-nsw-key",
      NSW_FUEL_API_SECRET: "test-nsw-secret",
      FUEL_PATH_PRODUCTION_HARDENING: "1",
      FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "",
    },
    async () => {
      const data = await loadStationData({
        requestedSource: "tas",
        forceRefresh: true,
        points: [{ lat: -42.8821, lon: 147.3272 }],
        radiusKm: 8,
        fuels: ["U91"],
      });

      assert.equal(data.source, "live_unavailable");
      assert.equal(data.provider, "tas");
      assert.equal(data.degraded, true);
      assert.equal(data.stations.length, 0);
      assert.match(data.warning, /usage, caching and attribution terms are not confirmed/);
    },
  );
});

test("TAS FuelCheck adapter loads Hobart nearby prices through API.NSW v2", async () => {
  await withEnv(
    {
      NSW_FUEL_API_KEY: "test-nsw-key",
      NSW_FUEL_API_SECRET: "test-nsw-secret",
      NSW_FUEL_TAS_NEARBY_URL: "https://api.onegov.nsw.gov.au/FuelPriceCheck/v2/fuel/prices/nearby",
    },
    async () => {
      const mockFetch = installFetchMock(async (url, options = {}) => {
        const parsed = new URL(String(url));
        if (parsed.searchParams.get("grant_type") === "client_credentials") return jsonResponse({ access_token: "token" });
        assert.equal(parsed.pathname, "/FuelPriceCheck/v2/fuel/prices/nearby");
        assert.equal(options.method, "POST");
        const body = JSON.parse(options.body);
        assert.equal(body.fueltype, "U91");
        assert.equal(body.latitude, "-42.8821");
        assert.equal(body.longitude, "147.3272");
        return jsonResponse(tasNearbyPayload());
      });

      try {
        const data = await loadStationData({
          requestedSource: "tas",
          forceRefresh: true,
          points: [{ lat: -42.8821, lon: 147.3272 }],
          radiusKm: 8,
          fuels: ["U91"],
        });

        assert.equal(data.source, "api_tas");
        assert.equal(data.provider, "api_tas");
        assert.equal(data.capability, "live");
        assert.equal(data.degraded, false);
        assert.equal(data.providerHealth.tas.status, "ok");
        assert.equal(data.stations.length, 1);
        assert.equal(data.stations[0].stationCode, "TAS-95");
        assert.equal(data.stations[0].name, "United North Hobart");
        assert.equal(data.stations[0].suburb, "North Hobart");
        assert.equal(data.stations[0].prices.U91, 158.9);
        assert.equal(data.stations[0].source, "api_tas_fuelcheck");
        assert.equal(mockFetch.calls.length, 2);
      } finally {
        mockFetch.restore();
      }
    },
  );
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

test("forced NT source returns explicit unavailable context when MyFuel credentials are absent", async () => {
  await withEnv(
    {
      NT_MYFUEL_USERNAME: "",
      NT_MYFUEL_PASSWORD: "",
    },
    async () => {
      const response = await callStations({
        source: "nt",
        lat: -12.4634,
        lon: 130.8456,
        label: "Darwin NT",
        fuel: "U91",
        radiusKm: 8,
        limit: 5,
      });

      assert.equal(response.status, 200);
      assert.equal(response.payload.context.source, "sample_fallback");
      assert.equal(response.payload.context.provider, "public_demo_snapshot");
      assert.equal(response.payload.context.capability, "fallback");
      assert.equal(response.payload.context.regionCapabilities[0].region, "NT");
      assert.equal(response.payload.context.regionCapabilities[0].capability, "pending_access");
      assert.equal(response.payload.context.regionCapabilities[0].provider, "api_nt_myfuel");
      assert.match(response.payload.context.warning, /MyFuel NT credentials are not configured/);
    },
  );
});

test("NT station handler returns labelled available-fuel alternatives when requested fuel is unavailable", async () => {
  await withEnv(
    {
      NT_MYFUEL_API_BASE_URL: "https://myfuelnt.nt.gov.au",
      NT_MYFUEL_USERNAME: "test-nt-user",
      NT_MYFUEL_PASSWORD: "test-nt-password",
    },
    async () => {
      const mockFetch = installFetchMock(async (url, options = {}) => {
        const parsed = new URL(String(url));
        if (parsed.pathname === "/api/token") {
          return jsonResponse({ access_token: "nt-token", token_type: "Bearer", expires_in: 3600 });
        }
        if (parsed.pathname === "/api/v1/getReferenceData") {
          return jsonResponse(ntReferencePayload());
        }
        if (parsed.pathname === "/api/v1/getFuelPrice/postCode") {
          const postCode = JSON.parse(options.body).postCode;
          return jsonResponse(postCode === "0800" ? ntPostcodePayload() : { Data: [] });
        }
        if (parsed.pathname === "/api/v1/getFuelPrice/fuelOutletIdentifier") {
          return jsonResponse({ Data: [] });
        }
        throw new Error(`Unexpected NT endpoint: ${parsed.pathname}`);
      });

      try {
        const response = await callStations({
          source: "nt",
          lat: -12.4634,
          lon: 130.8456,
          label: "Darwin NT",
          fuel: "P98",
          radiusKm: 8,
          limit: 5,
          forceRefresh: "1",
        });

        assert.equal(response.status, 200);
        assert.equal(response.payload.context.provider, "api_nt");
        assert.equal(response.payload.context.fuelMatchMode, "alternative_available_fuel");
        assert.equal(response.payload.context.exactFuelMatch, false);
        assert.equal(response.payload.context.requestedFuelUnavailable, true);
        assert.equal(response.payload.context.exactStationCount, 0);
        assert.equal(response.payload.context.stationCount, 1);
        assert.deepEqual(response.payload.context.alternativeFuelCodes, ["U91"]);
        assert.match(response.payload.context.warning, /No P98 prices were found nearby/);
        assert.equal(response.payload.stations.length, 1);
        assert.equal(response.payload.stations[0].requestedFuel, "P98");
        assert.equal(response.payload.stations[0].matchedFuel, "U91");
        assert.equal(response.payload.stations[0].exactFuelMatch, false);
        assert.equal(response.payload.stations[0].pumpCpl, 195.7);
        assert.equal(response.payload.stations[0].prices.P98, undefined);
      } finally {
        mockFetch.restore();
      }
    },
  );
});

test("NT normaliser drops malformed rows and preserves usable fuel prices", () => {
  const stations = normaliseNtPayload({
    Data: [
      {
        fuelOutletIdentifier: "DAR-001",
        fuelOutletName: "Darwin MyFuel",
        brandName: "Metro",
        suburb: "Darwin",
        address: "1 Smith Street, Darwin NT 0800",
        postCode: "0800",
        latitude: -12.4634,
        longitude: 130.8456,
        fuelPrices: [
          { fuelType: "Unleaded 91", price: 195.7, lastUpdated: "2026-07-03T00:00:00Z" },
          { fuelType: "Diesel", price: "bad" },
        ],
      },
      {
        fuelOutletIdentifier: "NULL-001",
        fuelOutletName: "Null Island",
        latitude: 0,
        longitude: 0,
        fuelPrices: [{ fuelType: "Unleaded 91", price: 1 }],
      },
    ],
  });

  assert.equal(stations.length, 1);
  assert.equal(stations[0].stationCode, "NT-DAR-001");
  assert.equal(stations[0].prices.U91, 195.7);
  assert.equal(stations[0].prices.DL, undefined);
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

test("production hardening disables demo fallback responses", async () => {
  await withEnv(
    {
      FUEL_PATH_PRODUCTION_HARDENING: "1",
      FUEL_PATH_ALLOW_SAMPLE_SOURCE: "",
      VIC_SERVO_SAVER_API_KEY: "",
    },
    async () => {
    const sample = await loadStationData({
      requestedSource: "sample",
      points: [{ lat: -33.8688, lon: 151.2093 }],
      radiusKm: 8,
    });
    const liveUnavailable = await loadStationData({
      requestedSource: "vic",
      points: [{ lat: -37.8136, lon: 144.9631 }],
      radiusKm: 8,
    });

    assert.equal(sample.source, "sample_disabled");
    assert.equal(sample.stations.length, 0);
    assert.equal(sample.degraded, true);
    assert.match(sample.warning, /disabled in production/);
    assert.equal(liveUnavailable.source, "live_unavailable");
    assert.equal(liveUnavailable.stations.length, 0);
    assert.equal(liveUnavailable.degraded, true);
    assert.match(liveUnavailable.warning, /VIC Servo Saver API access is not configured/);
    },
  );
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
  assert.equal(response.payload.context.provenance.source, "unsupported_region");
  assert.equal(response.payload.context.provenance.provider, "unsupported_region");
  assert.equal(response.payload.context.provenance.cacheMode, "none");
  assert.equal(response.payload.context.provenance.degraded, false);
  assert.deepEqual(response.payload.context.provenance.providerStatuses, {});
  assert.equal(JSON.stringify(response.payload.context.provenance).includes("Null Island"), false);
  assert.match(response.payload.context.warning, /No live fuel provider covers this area yet/);
});

test("forced provider outside coverage returns explicit JSON instead of throwing", async () => {
  const forcedOutsideCoverage = [
    { source: "qld", lat: -33.86, lon: 151.2, expectedProvider: "qld" },
    { source: "wa", lat: -33.86, lon: 151.2, expectedProvider: "wa" },
    { source: "sa", lat: -33.86, lon: 151.2, expectedProvider: "sa" },
    { source: "nt", lat: -33.86, lon: 151.2, expectedProvider: "nt" },
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
  await withEnv({ VIC_SERVO_SAVER_API_KEY: "" }, async () => {
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

function tasNearbyPayload() {
  return {
    stations: [
      {
        brandid: "1-SVWL-138E",
        stationid: "5288-2M",
        brand: "United",
        code: 95,
        name: "United North Hobart",
        address: "353-357 Argyle Street, NORTH HOBART TAS 7000",
        location: {
          distance: 1.5,
          latitude: -42.870897,
          longitude: 147.317047,
        },
        state: "TAS",
      },
    ],
    prices: [
      {
        stationcode: 95,
        fueltype: "U91",
        price: 158.9,
        priceunit: "litre",
        lastupdated: "2026-06-19 04:45:08",
        state: "TAS",
      },
    ],
  };
}

function vicBrandsPayload() {
  return [
    {
      BrandId: "B-SHELL",
      brandName: "Shell",
      name: "Shell",
    },
  ];
}

function vicTypePayload() {
  return {
    fuelTypes: [
      {
        FuelTypeId: "DIE",
        name: "DSL",
      },
      {
        FuelTypeId: "ULP",
        name: "Unleaded 91",
      },
    ],
  };
}

function vicStationsPayload() {
  return {
    stations: [
      {
        id: "901",
        name: "Southbank Hub",
        address: "1 Bourke Street, Southbank VIC 3006",
        latitude: -37.8231,
        longitude: 144.964,
      },
    ],
  };
}

function vicPricePayload() {
  return {
    fuelPriceDetails: [
      {
        fuelStation: {
          id: "901",
          stationId: "901",
          name: "Southbank Hub",
          brandId: "B-SHELL",
          address: "1 Bourke Street, Southbank VIC 3006",
          location: {
            latitude: -37.8231,
            longitude: 144.964,
          },
        },
        fuelPrices: [
          {
            fuelType: "DIE",
            price: 188.4,
            updatedAt: "2026-06-25T08:22:00Z",
            isAvailable: true,
          },
          {
            fuelType: "U91",
            price: 204.5,
            updatedAt: "2026-06-25T08:22:00Z",
            isAvailable: true,
          },
        ],
      },
    ],
  };
}

function ntReferencePayload() {
  return {
    Data: [
      {
        fuelOutletIdentifier: "DAR-001",
        fuelOutletName: "Darwin MyFuel",
        brandName: "Metro",
        suburb: "Darwin",
        address: "1 Smith Street, Darwin NT 0800",
        postCode: "0800",
        latitude: -12.4634,
        longitude: 130.8456,
      },
      {
        fuelOutletIdentifier: "ASP-001",
        fuelOutletName: "Alice Springs MyFuel",
        brandName: "Ampol",
        suburb: "Alice Springs",
        address: "1 Todd Street, Alice Springs NT 0870",
        postCode: "0870",
        latitude: -23.698,
        longitude: 133.8807,
      },
    ],
  };
}

function ntPostcodePayload() {
  return {
    Data: [
      {
        fuelOutletIdentifier: "DAR-001",
        fuelOutletName: "Darwin MyFuel",
        brandName: "Metro",
        suburb: "Darwin",
        address: "1 Smith Street, Darwin NT 0800",
        postCode: "0800",
        latitude: -12.4634,
        longitude: 130.8456,
        fuelPrices: [
          {
            fuelType: "Unleaded 91",
            price: 195.7,
            lastUpdated: "2026-07-03T00:00:00Z",
          },
          {
            fuelType: "Diesel",
            price: 207.9,
            lastUpdated: "2026-07-03T00:00:00Z",
          },
        ],
      },
    ],
  };
}

function ntTerritoryReferencePayload() {
  return {
    Data: [
      ntReferenceRow("DAR-001", "Darwin", "0800", -12.4634, 130.8456),
      ntReferenceRow("PAL-001", "Palmerston", "0830", -12.486, 130.9833),
      ntReferenceRow("KAT-001", "Katherine", "0850", -14.4652, 132.2635),
      ntReferenceRow("TCK-001", "Tennant Creek", "0860", -19.648, 134.191),
      ntReferenceRow("ASP-001", "Alice Springs", "0870", -23.698, 133.8807),
      ntReferenceRow("YUL-001", "Yulara", "0872", -25.242, 130.9849),
      ntReferenceRow("NHU-001", "Nhulunbuy", "0880", -12.1884, 136.782),
    ],
  };
}

function ntTerritoryPostcodePayload(postCode) {
  const row = ntTerritoryReferencePayload().Data.find((item) => item.postCode === postCode);
  if (!row) return { Data: [] };
  return {
    Data: [
      {
        ...row,
        fuelPrices: [
          {
            fuelType: "Unleaded 91",
            price: 190 + Number(postCode.slice(-2)) / 10,
            lastUpdated: "2026-07-03T00:00:00Z",
          },
        ],
      },
    ],
  };
}

function ntReferenceRow(id, suburb, postCode, latitude, longitude) {
  return {
    fuelOutletIdentifier: id,
    fuelOutletName: `${suburb} MyFuel`,
    brandName: "Metro",
    suburb,
    address: `1 Main Street, ${suburb} NT ${postCode}`,
    postCode,
    latitude,
    longitude,
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    text: async () => JSON.stringify(payload),
  };
}

function installFetchMock(handler) {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return handler(url, options);
  };
  return {
    calls,
    restore() {
      global.fetch = originalFetch;
    },
  };
}

function withEnv(values, fn) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === "") delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    const result = fn();
    if (result && typeof result.then === "function") return result.finally(restore);
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }

  function restore() {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
