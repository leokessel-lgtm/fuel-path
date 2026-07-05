import { chromium } from "playwright";

const baseUrl = process.env.FUEL_PATH_LOCAL_URL || "http://localhost:8097/?local_vehicle_profiles=1";
const viewport = { width: 390, height: 844 };
const preferencesKey = "fuel-path:preferences:v1";
const savedCommutesKey = "fuel-path:saved-commutes:v1";

const homeLocation = {
  lat: -31.9523,
  lon: 115.8613,
  label: "Perth WA 6000, Australia",
};
const workLocation = {
  lat: -32.0569,
  lon: 115.7439,
  label: "Fremantle WA 6160",
};

const seededPreferences = {
  vehicleName: "Petrol hatch",
  vehicleRego: "PET123",
  vehicleEnergyType: "petrol",
  fuel: "P98",
  evConnectors: [],
  fuelTankLitres: 55,
  evBatteryKwh: 75,
  evRangeKm: 400,
  homeChargingAccess: "unknown",
  evChargingPreference: "balanced",
  minSavingDollars: 5,
  maxDetourMinutes: 8,
  fuelPolicyEnabled: false,
  approvedPolicyBrands: ["Ampol", "BP", "Shell"],
  stationBrandMode: "preferred_only",
  preferredStationBrands: ["BP", "Shell"],
  activeVehicleId: "petrol-car",
  vehicles: [
    {
      id: "petrol-car",
      name: "Petrol hatch",
      rego: "PET123",
      vehicleEnergyType: "petrol",
      fuel: "P98",
      evConnectors: [],
      fuelTankLitres: 55,
      evBatteryKwh: 75,
      evRangeKm: 400,
      homeChargingAccess: "unknown",
      evChargingPreference: "balanced",
    },
    {
      id: "diesel-ute",
      name: "Diesel ute",
      rego: "DSL456",
      vehicleEnergyType: "diesel",
      fuel: "DL",
      evConnectors: [],
      fuelTankLitres: 80,
      evBatteryKwh: 75,
      evRangeKm: 400,
      homeChargingAccess: "unknown",
      evChargingPreference: "balanced",
    },
    {
      id: "ev-car",
      name: "EV runabout",
      rego: "EV789",
      vehicleEnergyType: "electric",
      fuel: "U91",
      evConnectors: ["CCS2", "TYPE2"],
      fuelTankLitres: 55,
      evBatteryKwh: 70,
      evRangeKm: 420,
      homeChargingAccess: "yes",
      evChargingPreference: "fast",
    },
  ],
  selectedDiscounts: ["everyday_rewards"],
  homeLocation,
  workLocation,
};

const seededCommute = {
  id: "commute:P98:-31.9523:115.8613:-32.0569:115.7439",
  name: "Perth to Freo",
  from: homeLocation,
  to: workLocation,
  fuel: "P98",
  vehicleId: "petrol-car",
  alertEnabled: false,
  alertTime: "07:30",
  alertDays: ["mon", "tue", "wed", "thu", "fri"],
  localReminderEnabled: true,
  minSavingDollars: 5,
  maxDetourMinutes: 8,
  tankThresholdPercent: 45,
  alertStatus: "off",
  alertStatusMessage: "Route alert is off.",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport });
  await installSeedState(page);
  await seedState(page);

  const vehicleResults = await exerciseVehicleSwitching(page);
  const stationBrandResults = await exerciseStationBrands(page);
  const routeResults = await exerciseSavedRouteAlerts(page);

  console.log(JSON.stringify({
    ok: true,
    stationBrandResults,
    vehicleResults,
    routeResults,
  }, null, 2));
} finally {
  await browser.close();
}

async function seedState(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
}

async function installSeedState(page) {
  await page.addInitScript(({ preferencesKey, savedCommutesKey, preferences, commute }) => {
    localStorage.clear();
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
    localStorage.setItem(savedCommutesKey, JSON.stringify([commute]));
  }, {
    preferencesKey,
    savedCommutesKey,
    preferences: seededPreferences,
    commute: seededCommute,
  });
}

async function exerciseVehicleSwitching(page) {
  await openSettingsSection(page, "Vehicle & fuel");
  await assertText(page, "Petrol hatch");
  await assertText(page, "P98");
  await clickVisible(page, "Diesel ute");
  await waitForStorage(page, preferencesKey, (preferences) =>
    preferences.activeVehicleId === "diesel-ute" &&
    preferences.fuel === "DL" &&
    preferences.homeLocation?.label === "Perth WA 6000, Australia" &&
    preferences.workLocation?.label === "Fremantle WA 6160" &&
    preferences.selectedDiscounts?.includes("everyday_rewards"));

  await clickVisible(page, "EV runabout");
  await waitForStorage(page, preferencesKey, (preferences) =>
    preferences.activeVehicleId === "ev-car" &&
    preferences.vehicleEnergyType === "electric" &&
    preferences.evRangeKm === 420 &&
    preferences.evConnectors?.includes("CCS2") &&
    preferences.evConnectors?.includes("TYPE2") &&
    preferences.homeLocation?.label === "Perth WA 6000, Australia" &&
    preferences.workLocation?.label === "Fremantle WA 6160" &&
    preferences.selectedDiscounts?.includes("everyday_rewards"));

  await clickVisible(page, "Plan", viewport.height - 130);
  const planText = await visibleText(page);
  assertIncludes(planText, "EV");
  assertIncludes(planText, "Check route range");

  await clickVisible(page, "Nearby", viewport.height - 130);
  const nearbyText = await visibleText(page);
  assertIncludes(nearbyText, "EV");

  const preferences = await storageJson(page, preferencesKey);
  return {
    activeVehicleId: preferences.activeVehicleId,
    vehicleEnergyType: preferences.vehicleEnergyType,
    evConnectors: preferences.evConnectors,
    evRangeKm: preferences.evRangeKm,
    accountDataStillPresent: Boolean(preferences.homeLocation && preferences.workLocation && preferences.selectedDiscounts?.length),
  };
}

async function exerciseSavedRouteAlerts(page) {
  await openSettingsSection(page, "Places");
  const routeNameInput = page.locator('input[aria-label="Favourite route name Perth to Freo"]');
  await routeNameInput.waitFor({ state: "visible", timeout: 5_000 });
  await routeNameInput.fill("Renamed Freo run");
  await clickVisible(page, "Save");
  await waitForStorage(page, savedCommutesKey, (commutes) => commutes[0]?.name === "Renamed Freo run");

  await clickVisible(page, "← Settings");
  await openSettingsSection(page, "Alerts");
  await assertText(page, "Renamed Freo run");
  await page.locator('[aria-label="Edit notification settings for Renamed Freo run"]').click({ timeout: 5_000 });
  await assertText(page, "Route notification settings");
  await page.locator('[aria-label="Use DSL456 for this route"]').click({ timeout: 5_000 });
  await page.locator('[aria-label="Set alert time to 08:30"]').click({ timeout: 5_000 });
  await page.locator('[aria-label="Increase minimum saving"]').click({ timeout: 5_000 });
  await waitForStorage(page, savedCommutesKey, (commutes) =>
    commutes[0]?.vehicleId === "diesel-ute" &&
    commutes[0]?.alertTime === "08:30" &&
    commutes[0]?.minSavingDollars === 6);

  await page.locator('[aria-label="Watch Renamed Freo run"]').click({ timeout: 5_000 });
  await waitForStorage(page, savedCommutesKey, (commutes) =>
    commutes[0]?.name === "Renamed Freo run" &&
    commutes[0]?.alertEnabled === false &&
    commutes[0]?.alertStatus === "unavailable");
  await assertText(page, "Route alerts need an iOS or Android build.");

  await page.locator('[aria-label="Remove saved route Renamed Freo run"]').click({ timeout: 5_000 });
  await waitForStorage(page, savedCommutesKey, (commutes) => Array.isArray(commutes) && commutes.length === 0);
  await clickVisible(page, "← Settings");
  await openSettingsSection(page, "Places");
  await assertText(page, "0/20 saved");
  await assertText(page, "No favourite routes yet");

  const commutes = await storageJson(page, savedCommutesKey);
  return {
    remainingRoutes: commutes.length,
    removedFromAlertsAlsoClearsPlaces: commutes.length === 0,
    routeAlertSettingsEdited: true,
    webAlertToggleBlockedAsExpected: true,
  };
}

async function exerciseStationBrands(page) {
  await openSettingsSection(page, "Stations");
  await assertText(page, "Choose what appears on the map");
  await assertText(page, "BP");
  await assertText(page, "Shell");

  await page.locator('input[aria-label="Search station brands"]').fill("Ampol");
  await page.locator('[aria-label="Add Ampol preferred station brand"]').click({ timeout: 5_000 });
  await waitForStorage(page, preferencesKey, (preferences) =>
    preferences.stationBrandMode === "preferred_only" &&
    preferences.preferredStationBrands?.includes("Ampol"));

  await page.locator('[aria-label="Clear preferred station brands"]').click({ timeout: 5_000 });
  await waitForStorage(page, preferencesKey, (preferences) =>
    preferences.stationBrandMode === "all" &&
    Array.isArray(preferences.preferredStationBrands) &&
    preferences.preferredStationBrands.length === 0);

  await page.locator('[aria-label="Preferred only"]').click({ timeout: 5_000 });
  await waitForStorage(page, preferencesKey, (preferences) =>
    preferences.stationBrandMode === "preferred_only" &&
    preferences.preferredStationBrands?.includes("Ampol") &&
    preferences.preferredStationBrands?.includes("BP") &&
    preferences.preferredStationBrands?.includes("Shell"));

  await clickVisible(page, "← Settings");
  await openSettingsSection(page, "Vehicle & fuel");
  await clickVisible(page, "Petrol hatch");
  await waitForStorage(page, preferencesKey, (preferences) => preferences.activeVehicleId === "petrol-car");

  await clickVisible(page, "Nearby", viewport.height - 130);
  await page.locator('[aria-label="Show all station brands once"]').waitFor({ state: "visible", timeout: 15_000 });
  await assertText(page, "5 preferred brands");
  await page.locator('[aria-label="Show all station brands once"]').click({ timeout: 5_000 });
  await page.locator('[aria-label="Use preferred station brands"]').waitFor({ state: "visible", timeout: 15_000 });
  await waitForVisibleText(page, "All brands for this search");

  const preferences = await storageJson(page, preferencesKey);
  return {
    mode: preferences.stationBrandMode,
    preferredBrands: preferences.preferredStationBrands,
    nearbyOverrideVisible: true,
    searchableBrandAdded: preferences.preferredStationBrands.includes("Ampol"),
  };
}

async function openSettingsSection(page, label) {
  await clickVisible(page, "Settings", viewport.height - 130);
  await page.waitForTimeout(250);
  await clickVisible(page, label);
  await page.waitForTimeout(350);
}

async function clickVisible(page, text, minY = 0) {
  const target = await page.evaluate(({ text, minY }) => {
    const candidates = [];
    for (const el of document.querySelectorAll("*")) {
      const label = el.getAttribute?.("aria-label") || "";
      const value = (el.textContent || "").trim();
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.y < minY) continue;
      if (value === text || value.includes(text) || label === text || label.includes(text)) {
        candidates.push({
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          area: rect.width * rect.height,
          exact: value === text || label === text,
        });
      }
    }
    candidates.sort((a, b) => Number(b.exact) - Number(a.exact) || a.area - b.area);
    return candidates[0] || null;
  }, { text, minY });
  if (!target) throw new Error(`Could not find visible target: ${text}`);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(250);
}

async function waitForStorage(page, key, predicate) {
  await page.waitForFunction(({ key, predicateSource }) => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const value = JSON.parse(raw);
    return Function("value", `return (${predicateSource})(value);`)(value);
  }, { key, predicateSource: predicate.toString() }, { timeout: 5_000 });
}

async function storageJson(page, key) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), key);
}

async function visibleText(page) {
  await page.waitForTimeout(300);
  return page.evaluate(() => document.body.innerText || "");
}

async function assertText(page, text) {
  const body = await visibleText(page);
  assertIncludes(body, text);
}

async function waitForVisibleText(page, text) {
  await page.waitForFunction(
    (expected) => (document.body.innerText || "").includes(expected),
    text,
    { timeout: 15_000 },
  );
}

function assertIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`Expected visible text to include ${JSON.stringify(expected)}. Visible text:\n${value.slice(0, 2_000)}`);
  }
}
