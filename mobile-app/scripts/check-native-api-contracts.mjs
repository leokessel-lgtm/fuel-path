#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, "..");
const routeApiSourcePath = path.join(mobileRoot, "src/api/fuelPathApi.ts");
const backendAlertsSourcePath = path.join(mobileRoot, "src/services/backendAlerts.native.ts");

const routeFetchCalls = [];
const responsePayload = {
  route: {
    provider: "contract-smoke",
    distanceKm: 123,
    durationMin: 90,
    points: denseRoutePoints(1505),
  },
  score: {
    recommendations: [],
    alternatives: [],
    contextStations: [],
    context: {
      fuel: "P95",
      routeDistanceKm: 123,
    },
  },
};

function loadTsModule(sourcePath, { require: requireMock, context = {} }) {
  const source = readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: sourcePath,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(transpiled, {
    exports: module.exports,
    module,
    require: requireMock,
    ...context,
  }, { filename: sourcePath });
  return module.exports;
}

function routeApiRequire(request) {
  if (request === "../config") {
    return { API_BASE_URL: "https://fuel-path.test" };
  }
  if (request === "../data/brandAssets") {
    return {
      stationBrandFilterValues(labels) {
        return labels.flatMap((label) => [label, label.toLowerCase()]);
      },
    };
  }
  if (request === "../utils/userVisibleErrors") {
    return {
      addressLookupErrorMessage: () => "address error",
      nearbyFuelErrorMessage: () => "nearby error",
      routePlanningErrorMessage: () => "route error",
    };
  }
  return {};
}

const { planFuelRoute } = loadTsModule(routeApiSourcePath, {
  require: routeApiRequire,
  context: {
    fetch: async (url, init = {}) => {
      routeFetchCalls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(responsePayload),
      };
    },
  },
});

await checkPlanFuelRouteContract(planFuelRoute);
await checkSavedRouteAlertContract();

console.log("Native API contract smoke passed.");

async function checkPlanFuelRouteContract(planFuelRoute) {
  const from = { lat: -33.86, lon: 151.2, label: "Sydney NSW" };
  const to = { lat: -32.93, lon: 151.78, label: "Newcastle NSW" };
  const preferences = {
    activeVehicleId: "vehicle-diesel",
    evBatteryKwh: 70,
    evChargingPreference: "balanced",
    evConnectors: ["CCS2"],
    evRangeKm: 420,
    fuel: "P95",
    fuelTankLitres: 55,
    homeChargingAccess: "unknown",
    maxDetourMinutes: 8,
    minSavingDollars: 5,
    vehicleEnergyType: "petrol",
    vehicleName: "Default car",
    vehicles: [
      {
        id: "vehicle-diesel",
        name: "Tourer",
        rego: "",
        vehicleEnergyType: "diesel",
        fuel: "PDL",
        evConnectors: [],
        fuelTankLitres: 72,
        evBatteryKwh: 0,
        evRangeKm: 0,
        homeChargingAccess: "unknown",
        evChargingPreference: "balanced",
      },
    ],
  };

  const planned = await planFuelRoute({
    eligibleDiscounts: ["woolworths-everyday-rewards-4c"],
    from,
    fuel: "P95",
    preferences,
    stationBrands: ["BP"],
    to,
  });

  assert.equal(routeFetchCalls.length, 1);
  const call = routeFetchCalls[0];
  assert.equal(call.url, "https://fuel-path.test/api/score");
  assert.equal(call.init.method, "POST");

  const body = JSON.parse(call.init.body);
  assert.deepEqual(body.from, from);
  assert.deepEqual(body.to, to);
  assert.equal(body.source, "live");
  assert.equal(body.fuel, "P95");
  assert.equal(body.tankLitres, 72);
  assert.equal(body.tankPercent, 45);
  assert.equal(body.economy, 7.4);
  assert.equal(body.reserveKm, 35);
  assert.equal(body.minSavingDollars, 5);
  assert.equal(body.maxDetourMinutes, 8);
  assert.equal(body.corridorKm, 2.5);
  assert.equal(body.detourSpeedKmh, 80);
  assert.deepEqual(body.eligibleDiscounts, ["woolworths-everyday-rewards-4c"]);
  assert.equal(body.brandFilter, true);
  assert.deepEqual(body.brandLabels, ["BP"]);
  assert.deepEqual(body.brands, ["BP", "bp"]);
  assert.equal(body.includeMemberPrices, false);
  assert.equal(body.includeClosed, false);
  assert.equal("route" in body, false);

  assert.equal(planned.route.points.length, 1200);
  assert.equal(planned.route.points[0].lat, responsePayload.route.points[0].lat);
  assert.equal(planned.route.points[0].lon, responsePayload.route.points[0].lon);
  assert.equal(
    planned.route.points[planned.route.points.length - 1].lat,
    responsePayload.route.points[responsePayload.route.points.length - 1].lat,
  );
  assert.equal(
    planned.route.points[planned.route.points.length - 1].lon,
    responsePayload.route.points[responsePayload.route.points.length - 1].lon,
  );
}

function denseRoutePoints(count) {
  return Array.from({ length: count }, (_, index) => ({
    lat: -33.86 + index * 0.0001,
    lon: 151.2 + index * 0.0001,
  }));
}

async function checkSavedRouteAlertContract() {
  const commute = {
    id: "commute-1",
    name: "Morning commute",
    from: { lat: -31.95, lon: 115.86, label: "Perth WA" },
    to: { lat: -32.05, lon: 115.74, label: "Fremantle WA" },
    fuel: "P95",
    vehicleId: "vehicle-diesel",
    alertEnabled: true,
    alertTime: "07:30",
    alertDays: ["mon", "tue", "wed", "thu", "fri"],
    minSavingDollars: 6,
    maxDetourMinutes: 9,
    tankThresholdPercent: 40,
    createdAt: "2026-07-07T00:00:00.000Z",
  };
  const preferences = {
    activeVehicleId: "vehicle-petrol",
    evBatteryKwh: 70,
    evChargingPreference: "balanced",
    evConnectors: ["CCS2"],
    evRangeKm: 420,
    fuel: "P95",
    fuelTankLitres: 55,
    homeChargingAccess: "unknown",
    maxDetourMinutes: 8,
    minSavingDollars: 5,
    selectedDiscounts: ["eligible-4c"],
    discountRedemptions: {},
    vehicleEnergyType: "petrol",
    vehicleName: "Default car",
    vehicles: [
      {
        id: "vehicle-petrol",
        name: "City car",
        rego: "",
        vehicleEnergyType: "petrol",
        fuel: "P95",
        evConnectors: [],
        fuelTankLitres: 55,
        evBatteryKwh: 0,
        evRangeKm: 0,
        homeChargingAccess: "unknown",
        evChargingPreference: "balanced",
      },
      {
        id: "vehicle-diesel",
        name: "Tourer",
        rego: "",
        vehicleEnergyType: "diesel",
        fuel: "PDL",
        evConnectors: [],
        fuelTankLitres: 72,
        evBatteryKwh: 0,
        evRangeKm: 0,
        homeChargingAccess: "unknown",
        evChargingPreference: "balanced",
      },
    ],
  };

  const {
    alertFetchCalls,
    deleteMyAlertData,
    storage,
    syncSavedRouteAlert,
  } = loadBackendAlertContractModule({
    capabilityBody: { token: "capability-token", expiresAt: "2099-01-01T00:00:00.000Z" },
  });

  const result = await syncSavedRouteAlert({
    commute,
    enabled: true,
    preferences,
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.remoteDeliveryEnabled, false);
  assert.ok(result.syncedAt);
  assert.equal(alertFetchCalls.length, 2);
  assert.equal(alertFetchCalls[0].url, "https://fuel-path.test/api/alerts?action=client-capability");
  assert.equal(alertFetchCalls[1].url, "https://fuel-path.test/api/saved-routes");
  assert.equal(alertFetchCalls[1].init.headers.Authorization, "Bearer capability-token");

  const body = JSON.parse(alertFetchCalls[1].init.body);
  assert.equal(body.id, "commute-1");
  assert.equal(body.userId, undefined);
  assert.equal(body.vehicleId, "vehicle-diesel");
  assert.equal(body.vehicleEnergyType, "diesel");
  assert.equal(body.fuel, "PDL");
  assert.equal(body.alertEnabled, true);
  assert.equal(body.alertTimeLocal, "07:30");
  assert.deepEqual(body.alertDays, ["mon", "tue", "wed", "thu", "fri"]);
  assert.equal(body.minSavingDollars, 6);
  assert.equal(body.maxDetourMinutes, 9);
  assert.deepEqual(body.eligibleDiscounts, ["eligible-4c"]);
  assert.equal(body.tankLitres, 72);
  assert.equal(body.tankPercent, 40);
  assert.equal(body.economy, 7.4);
  assert.equal(body.reserveKm, 35);
  assert.equal(JSON.parse(storage.get("fuel-path:alert-capability:v2")).token, "capability-token");
  const deleted = await deleteMyAlertData();
  assert.equal(deleted.status, "synced");
  assert.equal(alertFetchCalls[2].url, "https://fuel-path.test/api/alerts?action=delete-installation-data");
  assert.equal(storage.has("fuel-path:alert-installation:v2"), false);
  assert.equal(storage.has("fuel-path:alert-capability:v2"), false);
  assert.equal(storage.has("fuel-path:alert-backend-enrolled:v1"), false);
  assert.equal(storage.has("fuel-path:install-marker:v1"), false);

  const expired = loadBackendAlertContractModule({
    capabilityBody: { token: "expired-capability-token", expiresAt: "2020-01-01T00:00:00.000Z" },
  });
  const expiredResult = await expired.syncSavedRouteAlert({
    commute,
    enabled: true,
    preferences,
  });

  assert.equal(expiredResult.status, "skipped");
  assert.equal(expiredResult.message, "Smart route checks need backend capability issuing.");
  assert.equal(expired.alertFetchCalls.length, 1);
  assert.equal(expired.alertFetchCalls[0].url, "https://fuel-path.test/api/alerts?action=client-capability");
  assert.equal(expired.storage.has("fuel-path:alert-capability:v2"), false);

  const expiredDisable = await expired.syncSavedRouteAlert({
    commute,
    enabled: false,
    preferences,
  });
  assert.equal(expiredDisable.status, "failed");
  assert.match(expiredDisable.message, /could not be turned off/i);

  const reinstalled = loadBackendAlertContractModule({
    capabilityBody: { token: "retirement-token", expiresAt: "2099-01-01T00:00:00.000Z" },
    initialStorage: {
      "fuel-path:alert-installation:v2": JSON.stringify({
        installationId: `installation_${"a".repeat(32)}`,
        installationSecret: `secret_${"b".repeat(48)}`,
      }),
      "fuel-path:alert-backend-enrolled:v1": "1",
    },
  });
  await Promise.all([
    reinstalled.initialiseAnonymousInstallation(),
    reinstalled.initialiseAnonymousInstallation(),
  ]);
  assert.equal(reinstalled.alertFetchCalls[0].url, "https://fuel-path.test/api/alerts?action=client-capability");
  assert.equal(reinstalled.alertFetchCalls[1].url, "https://fuel-path.test/api/alerts?action=delete-installation-data");
  assert.equal(JSON.parse(reinstalled.storage.get("fuel-path:alert-installation:v2")).installationId, "installation_uuid-contract");
  assert.equal(reinstalled.storage.get("fuel-path:install-marker:v1"), "uuid-contract");

  const neverEnrolled = loadBackendAlertContractModule({ capabilityBody: null });
  const neverEnrolledDelete = await neverEnrolled.deleteMyAlertData();
  assert.equal(neverEnrolledDelete.status, "synced");
  assert.equal(neverEnrolled.alertFetchCalls.length, 0);
}

function loadBackendAlertContractModule({ capabilityBody, initialStorage = {} }) {
  const alertFetchCalls = [];
  const storage = new Map(Object.entries(initialStorage));
  const AsyncStorage = {
    async getItem(key) {
      return storage.get(key) || null;
    },
    async setItem(key, value) {
      storage.set(key, value);
    },
    async removeItem(key) {
      storage.delete(key);
    },
  };
  const SecureStore = {
    async getItemAsync(key) {
      return storage.get(key) || null;
    },
    async setItemAsync(key, value) {
      storage.set(key, value);
    },
    async deleteItemAsync(key) {
      storage.delete(key);
    },
  };
  const {
    deleteMyAlertData,
    initialiseAnonymousInstallation,
    syncSavedRouteAlert,
  } = loadTsModule(backendAlertsSourcePath, {
    require(request) {
      if (request === "@react-native-async-storage/async-storage") {
        return { __esModule: true, default: AsyncStorage };
      }
      if (request === "expo-secure-store") {
        return SecureStore;
      }
      if (request === "expo-crypto") {
        return {
          randomUUID: () => "uuid-contract",
          getRandomBytesAsync: async (count) => new Uint8Array(count).fill(7),
        };
      }
      if (request === "./alertDeviceSecurity") {
        return {
          randomUuid: () => "uuid-contract",
          randomSecret: async () => "07".repeat(32),
          secureGet: (key) => SecureStore.getItemAsync(key),
          secureSet: (key, value) => SecureStore.setItemAsync(key, value),
          secureDelete: (key) => SecureStore.deleteItemAsync(key),
        };
      }
      if (request === "react-native") {
        return { Platform: { OS: "android" } };
      }
      if (request === "../config") {
        return { API_BASE_URL: "https://fuel-path.test", EAS_PROJECT_ID: "project-test" };
      }
      if (request === "../utils/discountRedemptions") {
        return { eligibleDiscountIds: () => ["eligible-4c"] };
      }
      return {};
    },
    context: {
      Intl,
      Date,
      URLSearchParams,
      Math,
      Number,
      globalThis: {
        crypto: {
          randomUUID: () => "uuid-contract",
        },
      },
      fetch: async (url, init = {}) => {
        alertFetchCalls.push({ url, init });
        const body = url.endsWith("/api/alerts?action=client-capability")
          ? capabilityBody
          : { accepted: true, alerts: { pushDeliveryEnabled: false } };
        return {
          ok: true,
          status: 202,
          text: async () => JSON.stringify(body),
        };
      },
    },
  });
  return {
    alertFetchCalls,
    deleteMyAlertData,
    initialiseAnonymousInstallation,
    storage,
    syncSavedRouteAlert,
  };
}
