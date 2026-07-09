import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const appUrl = process.env.FUEL_PATH_STRESS_URL || "http://127.0.0.1:8081/";
const timeoutMs = Number(process.env.FUEL_PATH_STRESS_TIMEOUT_MS || 9000);
const nearbyCaseCount = Number(process.env.FUEL_PATH_NEARBY_STRESS_CASES || 100);
const settingsCaseCount = Number(process.env.FUEL_PATH_SETTINGS_STRESS_CASES || 100);
const outputDir = path.join(projectRoot, "tmp");
const runId = new Date().toISOString().replace(/[:.]/g, "-");

const preferencesKey = "fuel-path:preferences:v1";
const savedCommutesKey = "fuel-path:saved-commutes:v1";

const seedPreferences = {
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
  navigationApp: "ask",
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
  homeLocation: {
    lat: -31.9523,
    lon: 115.8613,
    label: "Perth WA 6000, Australia",
  },
  workLocation: {
    lat: -32.0569,
    lon: 115.7439,
    label: "Fremantle WA 6160",
  },
};

const seedCommute = {
  id: "commute:P98:-31.9523:115.8613:-32.0569:115.7439",
  name: "Perth to Freo",
  from: {
    lat: -31.9523,
    lon: 115.8613,
    label: "Perth WA 6000, Australia",
  },
  to: {
    lat: -32.0569,
    lon: 115.7439,
    label: "Fremantle WA 6160",
  },
  fuel: "P98",
  vehicleId: "petrol-car",
  alertEnabled: false,
  alertTime: "07:30",
  alertDays: ["mon", "tue", "wed", "thu", "fri"],
  localReminderEnabled: true,
  minSavingDollars: 5,
  tankThresholdPercent: 45,
  alertStatus: "off",
  alertStatusMessage: "Route alerts need an iOS or Android build.",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};

const mapSuggestions = [
  { id: "syd", query: "Sydney CBD NSW", label: "Sydney NSW", lat: -33.8688, lon: 151.2093, state: "NSW", type: "capital" },
  { id: "bondi", query: "Bondi Beach NSW", label: "Bondi NSW", lat: -33.8915, lon: 151.2767, state: "NSW", type: "suburb" },
  { id: "parr", query: "Parramatta NSW", label: "Parramatta NSW", lat: -33.8136, lon: 151.0034, state: "NSW", type: "suburb" },
  { id: "newcastle", query: "Newcastle NSW", label: "Newcastle NSW", lat: -32.9283, lon: 151.7817, state: "NSW", type: "regional" },
  { id: "woll", query: "Wollongong NSW", label: "Wollongong NSW", lat: -34.4278, lon: 150.8931, state: "NSW", type: "regional" },
  { id: "syd-air", query: "Sydney Airport NSW", label: "Sydney Airport, Mascot NSW 2020", lat: -33.9399, lon: 151.1753, state: "NSW", type: "airport" },
  { id: "syl", query: "66B Easton Avenue Sylvania NSW 2224", label: "Sylvania NSW 2224", lat: -34.0128, lon: 151.1033, state: "NSW", type: "address" },
  { id: "mel", query: "Melbourne CBD VIC", label: "Melbourne VIC", lat: -37.8136, lon: 144.9631, state: "VIC", type: "capital" },
  { id: "melb-air", query: "Melbourne Airport VIC", label: "Melbourne Airport, Melbourne VIC 3045", lat: -37.669, lon: 144.841, state: "VIC", type: "airport" },
  { id: "bris", query: "Brisbane CBD QLD", label: "Brisbane QLD", lat: -27.4698, lon: 153.0251, state: "QLD", type: "capital" },
  { id: "peri", query: "Perth CBD WA", label: "Perth WA", lat: -31.9523, lon: 115.8613, state: "WA", type: "capital" },
  { id: "frem", query: "Fremantle WA", label: "Fremantle WA", lat: -32.0569, lon: 115.7439, state: "WA", type: "suburb" },
  { id: "ad", query: "Adelaide CBD SA", label: "Adelaide SA", lat: -34.9285, lon: 138.6007, state: "SA", type: "capital" },
  { id: "adw", query: "Adelaide Airport SA", label: "Adelaide Airport SA", lat: -34.9442, lon: 138.5319, state: "SA", type: "airport" },
  { id: "hob", query: "Hobart CBD TAS", label: "Hobart TAS", lat: -42.8821, lon: 147.3272, state: "TAS", type: "capital" },
  { id: "dar", query: "Darwin CBD NT", label: "Darwin NT", lat: -12.4634, lon: 130.8456, state: "NT", type: "capital" },
  { id: "can", query: "Canberra ACT", label: "Canberra ACT", lat: -35.2809, lon: 149.13, state: "ACT", type: "capital" },
  { id: "canber", query: "Braddon ACT", label: "Braddon ACT", lat: -35.2705, lon: 149.135, state: "ACT", type: "suburb" },
  { id: "long", query: "Longreach NT", label: "Longreach NT", lat: -23.44, lon: 144.25, state: "NT", type: "remote" },
  { id: "cair", query: "Cairns QLD", label: "Cairns QLD", lat: -16.9203, lon: 145.771, state: "QLD", type: "regional" },
];

const brandNames = ["Ampol", "BP", "Shell", "Caltex", "7-Eleven", "Metro", "Coles Express", "7ELEVEN", "Costco", "Woolworths", "Gull"]; 
const alertTimes = ["06:30", "07:30", "08:30", "16:30", "17:30"];
const vehicleNames = ["Petrol hatch", "Diesel ute", "EV runabout"];
const energyOptions = ["Petrol", "Diesel", "EV"];
const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

const results = [];

await assertAppReachable(appUrl);

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

try {
  await seedState(page, seedPreferences, seedCommute);
  await installApiMocks(page);

  const nearbyCases = buildNearbyCases(nearbyCaseCount);
  const settingsCases = buildSettingsCases(settingsCaseCount);

  for (const item of nearbyCases) {
    await recordCase(`nearby-${item.index}`, async () => {
      await runNearbyCase(item);
    }, item);
  }

  for (const item of settingsCases) {
    await recordCase(`settings-${item.index}`, async () => {
      await runSettingsCase(item);
    }, item);
  }
} finally {
  await page.close();
  await context.close();
  await browser.close();
}

const summary = {
  runId,
  appUrl,
  nearbyCaseCount,
  settingsCaseCount,
  cases: results.length,
  passed: results.filter((result) => result.status === "passed").length,
  failed: results.filter((result) => result.status === "failed").length,
  suites: {
    nearby: {
      attempted: nearbyCaseCount,
      passed: results.filter((result) => result.suite === "nearby" && result.status === "passed").length,
      failed: results.filter((result) => result.suite === "nearby" && result.status === "failed").length,
    },
    settings: {
      attempted: settingsCaseCount,
      passed: results.filter((result) => result.suite === "settings" && result.status === "passed").length,
      failed: results.filter((result) => result.suite === "settings" && result.status === "failed").length,
    },
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `plan-nearby-settings-stress-${runId}.json`);
const reportPath = path.join(outputDir, `plan-nearby-settings-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));

console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));

if (summary.failed > 0) {
  const firstFailure = results.find((result) => result.status === "failed");
  throw new Error(`${summary.failed}/${summary.cases} case failures. First failure: ${firstFailure?.name || "unknown"}: ${firstFailure?.error}`);
}

async function seedState(activePage, preferences, commute) {
  await activePage.addInitScript(({ preferencesKey, savedCommutesKey, preferences, commute }) => {
    localStorage.clear();
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
    localStorage.setItem(savedCommutesKey, JSON.stringify([commute]));
  }, {
    preferencesKey,
    savedCommutesKey,
    preferences,
    commute,
  });

  await activePage.goto(appUrl, { waitUntil: "domcontentloaded" });
  await activePage.waitForTimeout(450);
}

async function installApiMocks(activePage) {
  await activePage.route("**/api/geocode", async (route) => {
    const body = requestJson(route.request());
    const query = normalise(body.q || body.query || body.input || "");
    const suggestions = suggestionsForQuery(query).slice(0, 8);
    const location = suggestions[0] || undefined;

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "stress_mock", 
        lookupStatus: suggestions.length ? "ok" : "no_match",
        location: location || { lat: -33.8688, lon: 151.2093, label: "Sydney NSW", type: "fallback" },
        suggestions: suggestions.length ? suggestions : [{ lat: -33.8688, lon: 151.2093, label: "Sydney NSW", type: "fallback" }],
      }),
    });
  });

  await activePage.route("**/api/stations?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        context: { capability: "live", fuel: "P98", provider: "settings_mock", source: "settings_mock" },
        stations: [
          {
            stationCode: "mock-bp",
            name: "BP Mock", brand: "BP", lat: -31.952, lon: 115.861,
            address: "BP Mock, Perth",
            openNow: true,
            source: "settings_mock",
            prices: { U91: 184.2, P95: 192.1, P98: 197.8, DL: 210.2 },
          },
          {
            stationCode: "mock-shell",
            name: "Shell Mock", brand: "Shell", lat: -31.953, lon: 115.863,
            address: "Shell Mock, Perth",
            openNow: true,
            source: "settings_mock",
            prices: { U91: 186.2, P95: 194.1, P98: 199.8, DL: 210.2 },
          },
        ],
      }),
    });
  });
}

async function runNearbyCase(caseData) {
  await switchTab("Nearby");
  await page.waitForTimeout(120);

  const input = page.getByLabel("Nearby location", { exact: false }).first();
  await input.click({ timeout: timeoutMs });
  await input.fill("");
  await page.waitForTimeout(120);

  if (caseData.mode === "quick") {
    const quick = await findVisibleCandidate(page, [
      'Use home location',
      'Use work location',
      'Use recent location',
    ]);
    if (!quick) {
      const fallbackQuery = variantQuery(caseData.queryBase, caseData.variation);
      await input.fill("");
      await input.pressSequentially(fallbackQuery, { delay: 1 });
      await page.waitForTimeout(180);
      const suggestion = page.locator('[aria-label^="Use search location"]').first();
      await suggestion.waitFor({ state: "visible", timeout: timeoutMs });
      await suggestion.click();
      await page.waitForTimeout(180);
    } else {
      await quick.click();
      await page.waitForTimeout(180);
    }
  } else {
    const typed = variantQuery(caseData.queryBase, caseData.variation);
    await input.click();
    await input.fill("");
    await input.pressSequentially(typed, { delay: 1 });
    await page.waitForTimeout(180);

    if (caseData.mode === "find") {
      const findButton = page.getByLabel("Find nearby location").first();
      await findButton.waitFor({ state: "visible", timeout: timeoutMs });
      await findButton.click();
      await page.waitForTimeout(200);
    } else {
      const suggestion = page.locator('[aria-label^="Use search location"]').first();
      await suggestion.waitFor({ state: "visible", timeout: timeoutMs });
      await suggestion.click();
      await page.waitForTimeout(180);
    }
  }

  const value = await input.inputValue();
  if (!value.trim()) {
    throw new Error("Nearby field did not receive applied query");
  }

  if (caseData.mode === "typed" || caseData.mode === "find") {
    const queryText = variantQuery(caseData.queryBase, caseData.variation);
    const hasValue = tokenMatch(value, queryText) ||
      value.toLowerCase().includes("darwin") ||
      value.toLowerCase().includes("sydney") ||
      value.toLowerCase().includes("melbourne") ||
      value.toLowerCase().includes("brisbane");
    if (!hasValue) {
      throw new Error(`Nearby applied value did not reflect query ${queryText}, was ${value}`);
    }
  }
}

async function runSettingsCase(caseData) {
  await ensureSettingsRoot();

  if (caseData.section === "vehicle") {
    await openSettingsSection("Vehicle & fuel");
    await page.waitForTimeout(150);

    const targetVehicle = vehicleNames[caseData.vehicleIndex];
    await tapControl(targetVehicle);
    await page.waitForTimeout(120);

    const targetEnergy = energyOptions[caseData.vehicleIndex % energyOptions.length];
    await tapControl(targetEnergy);
    await page.waitForTimeout(120);

    if (caseData.variant === 1) {
      await tapControl("Navigation app", ["button"]);
      await page.goBack();
    }
  }

  if (caseData.section === "stations") {
    await openSettingsSection("Stations");
    await page.waitForTimeout(120);

    const action = caseData.stationAction;
    const targetBrand = brandNames[caseData.stationIndex % brandNames.length];

    if (action === "search") {
      const brandSearch = page.getByLabel("Search station brands").first();
      await brandSearch.fill("");
      await brandSearch.fill(targetBrand);
      await page.waitForTimeout(150);

      const addButton = page.locator(`[aria-label^="Add ${targetBrand} preferred station brand"]`).first();
      await addButton.click({ timeout: timeoutMs });
      await page.waitForTimeout(150);
      await brandSearch.fill("");
    }

    if (action === "toggle") {
      const modeButton = caseData.toggleMode === "all" ? "All brands" : "Preferred only";
      await tapControl(modeButton, ["button"]);
      await page.waitForTimeout(80);
      await tapControl("Show all", ["button"]);
    }

    if (action === "clear") {
      await tapByAriaLabel("Clear preferred station brands", ["button"]);
      await page.waitForTimeout(80);
      await tapByAriaLabel("Select common station brands", ["button"]);
    }
  }

  if (caseData.section === "places") {
    await openSettingsSection("Places");
    await page.waitForTimeout(120);
    const label = caseData.placeKind;

    const editButtons = page.getByRole("button", { name: /Edit|Set/ });
    const editIndex = caseData.placeKind === "home" ? 0 : 1;
    if ((await editButtons.count()) > editIndex) {
      await editButtons.nth(editIndex).click();
    } else {
      await tapByAriaLabel("Set", ["button"]);
    }
    await page.waitForTimeout(120);

    const editorInput = page.getByLabel(`Search ${label} address or place`).first();
    await editorInput.fill("");
    const query = variantQuery(caseData.queryBase, caseData.variation);
    await editorInput.pressSequentially(query, { delay: 1 });
    const suggestion = page.locator(`[aria-label*=" as ${label}"]`).first();

    if (await suggestion.count()) {
      await suggestion.click({ timeout: timeoutMs });
    } else {
      await page.waitForTimeout(120);
      const fallback = page.locator('[aria-label^="Save "]').first();
      if (await fallback.count()) await fallback.click();
    }

    const value = await editorInput.inputValue();
    if (!value.trim()) {
      throw new Error(`Saved ${label} input did not keep a value`);
    }
  }

  if (caseData.section === "alerts") {
    await openSettingsSection("Alerts");
    await page.waitForTimeout(120);

    const editRoute = page.locator('[aria-label*="notification settings for "]').first();
    const hasEditableRoute = await editRoute.count();
    if (!hasEditableRoute) return;

    await editRoute.click();
    await page.waitForTimeout(120);

    if (caseData.alertAction === "time") {
      const targetTime = alertTimes[caseData.alertIndex % alertTimes.length];
      await tapByAriaLabelMaybe(`Set alert time to ${targetTime}`, ["button"]);
    }

    if (caseData.alertAction === "vehicle") {
      const targetVehicle = vehicleNames[caseData.alertIndex % vehicleNames.length];
      await tapByAriaLabelMaybe(`Use ${targetVehicle} for this route`, ["button"]);
    }

    if (caseData.alertAction === "days") {
      const day = weekdays[caseData.alertIndex % weekdays.length];
      await tapByAriaLabelMaybe(`Add ${day} alert day`, ["button"]);
    }

    if (caseData.alertAction === "reminder") {
      const remBtn = page.locator('[aria-label^="Turn on local reminder for "]').first();
      const onBtn = page.locator('[aria-label^="Turn off local reminder for "]').first();
      if (await remBtn.count()) {
        await remBtn.click();
      } else if (await onBtn.count()) {
        await onBtn.click();
      }
    }

    await tapByAriaLabel("Done", ["button"]);
  }

  if (caseData.section === "privacy") {
    await openSettingsSection("Support");
    await page.waitForTimeout(120);
    await tapSupportChoice(caseData.navChoice);
  }

  if (caseData.section === "savings") {
    await openSettingsSection("Savings");
    await page.waitForTimeout(120);
    const checkboxes = page.getByRole("checkbox");
    const count = await checkboxes.count();
    if (!count) return;
    const index = caseData.discountIndex % count;
    await checkboxes.nth(index).click({ timeout: timeoutMs });
    await page.waitForTimeout(120);
  }

  await ensureSettingsRoot();
}

function buildNearbyCases(count) {
  const cases = [];
  const modes = ["typed", "find", "quick", "typed"];
  for (let index = 0; index < count; index += 1) {
    const base = mapSuggestions[index % mapSuggestions.length];
    cases.push({
      index,
      name: `${index + 1}. nearby ${base.id}`,
      queryBase: base.query,
      variation: index % 5,
      mode: modes[index % modes.length],
    });
  }
  return cases;
}

function buildSettingsCases(count) {
  const sections = ["vehicle", "stations", "places", "alerts", "privacy", "savings"];
  const stationActions = ["search", "toggle", "clear"];
  const alertActions = ["time", "vehicle", "days", "reminder"];
  const navigationChoices = ["Device maps", "Apple Maps", "Google Maps", "Waze", "Ask every time"];

  const cases = [];
  for (let index = 0; index < count; index += 1) {
    const section = sections[index % sections.length];
    const variant = index % 6;
    const base = mapSuggestions[index % mapSuggestions.length];
    const caseItem = {
      index,
      name: `${index + 1}. ${section}`,
      section,
      variant,
      queryBase: base.query,
    };
    if (section === "vehicle") {
      caseItem.vehicleIndex = (index + 2) % vehicleNames.length;
      caseItem.variant = variant;
    }
    if (section === "stations") {
      caseItem.stationAction = stationActions[index % stationActions.length];
      caseItem.stationIndex = index;
      caseItem.toggleMode = index % 2 === 0 ? "all" : "preferred";
    }
    if (section === "places") {
      caseItem.placeKind = index % 2 === 0 ? "home" : "work";
    }
  if (section === "alerts") {
      caseItem.alertAction = alertActions[index % alertActions.length];
      caseItem.alertIndex = index;
    }
    if (section === "privacy") {
      caseItem.navChoice = navigationChoices[index % navigationChoices.length];
    }
    if (section === "savings") {
      caseItem.discountIndex = index;
      caseItem.discountAction = index % 2;
    }
    cases.push(caseItem);
  }
  return cases;
}

function tokenMatch(actual, expected) {
  const actualTokens = normalise(actual).split(" ").filter(Boolean);
  const expectedTokens = normalise(expected).split(" ").filter(Boolean);
  const matches = expectedTokens.filter((token) => actualTokens.includes(token));
  return matches.length >= Math.max(1, Math.ceil(expectedTokens.length / 2));
}

async function ensureSettingsRoot() {
  const rowSelector = '[role="button"][aria-label*="Active vehicle"], [role="button"][aria-label*="Discounts & eligibility"], [role="button"][aria-label*="Stations & brands"], [role="button"][aria-label*="Home, work & saved routes"], [role="button"][aria-label*="Notifications"], [role="button"][aria-label*="Privacy & support"]';
  const rootHit = await page.locator(rowSelector).count();
  if (rootHit >= 1) return;

  const settingsTextButton = page.getByText("Settings", { exact: false }).first();
  if (await settingsTextButton.count()) {
    await settingsTextButton.click({ timeout: timeoutMs });
    await page.waitForTimeout(120);
    const afterTextClick = await page.locator(rowSelector).count();
    if (afterTextClick >= 1) return;
  }

  const rootByText = await page.getByText("Vehicle & fuel", { exact: false }).count();
  if (rootByText) return;

  const backButton = page.getByRole("button", { name: "Back to settings" }).first();
  if (await backButton.count()) {
    await backButton.click({ timeout: timeoutMs });
    await page.waitForTimeout(120);
    const afterBack = await page.locator(rowSelector).count();
    if (afterBack >= 1) return;
  }

  const iosBack = page.getByRole("button", { name: "‹ Settings" }).first();
  if (await iosBack.count()) {
    await iosBack.click({ timeout: timeoutMs });
    await page.waitForTimeout(120);
    return;
  }

  const androidBack = page.getByRole("button", { name: "← Settings" }).first();
  if (await androidBack.count()) {
    await androidBack.click({ timeout: timeoutMs });
    await page.waitForTimeout(120);
    return;
  }

  throw new Error("Could not return to Settings root");
}

async function switchTab(label) {
  const visibleTabs = [
    { text: "Plan", y: 0 },
    { text: "Nearby", y: 0 },
    { text: "Settings", y: 0 },
  ];
  const target = visibleTabs.find((item) => item.text === label);
  if (!target) throw new Error(`Unknown tab ${label}`);
  const exact = page.getByRole("button", { name: new RegExp(`^${escapeRegExp(label)}$`, "i") });
  if (await exact.count()) {
    await exact.click({ timeout: timeoutMs });
    return;
  }
  const fallback = page.getByRole("button", { name: new RegExp(escapeRegExp(label), "i") });
  if (await fallback.count()) {
    await fallback.first().click({ timeout: timeoutMs });
    return;
  }
  await clickByTextRoleFallback(page, label);
}

async function openSettingsSection(label) {
  await ensureSettingsRoot();
  await tapSettingRow(label);
}

async function tapSettingRow(label) {
  const normalizedLabel = String(label || "").trim();
  const sectionAriaHints = {
    "Vehicle & fuel": ["Active vehicle", "Vehicle", "Fuel"],
    Stations: ["Stations & brands", "Stations", "Brands"],
    Places: ["Home, work & saved routes", "Home, work", "Places"],
    Alerts: ["Notifications", "Alerts", "notification"],
    Support: ["Privacy & support", "Support", "Device maps"],
    Savings: ["Discounts & eligibility", "Savings", "Discounts"],
  };

  const sectionExactSelectors = {
    "Vehicle & fuel": '[role="button"][aria-label*="Active vehicle"]',
    Stations: '[role="button"][aria-label*="Stations & brands"]',
    Places: '[role="button"][aria-label*="Home, work & saved routes"]',
    Alerts: '[role="button"][aria-label*="Notifications"]',
    Support: '[role="button"][aria-label*="Privacy & support"]',
    Savings: '[role="button"][aria-label*="Discounts & eligibility"]',
  };

  const exactSelector = sectionExactSelectors[normalizedLabel];
  if (exactSelector) {
    const exactMatch = page.locator(exactSelector);
    if (await exactMatch.count()) {
      await exactMatch.first().click({ timeout: timeoutMs });
      await page.waitForTimeout(120);
      return;
    }
  }

  for (const hint of sectionAriaHints[normalizedLabel] || [normalizedLabel]) {
    const exact = page.locator(`[role="button"][aria-label*="${cssEscape(hint)}"]`);
    if (await exact.count()) {
      await exact.first().click({ timeout: timeoutMs });
      await page.waitForTimeout(120);
      return;
    }
  }

  for (const hint of sectionAriaHints[normalizedLabel] || [normalizedLabel]) {
    const rowText = page.locator('[role="button"]', { hasText: new RegExp(escapeRegExp(hint), "i") });
    if (await rowText.count()) {
      const count = await rowText.count();
      for (let index = 0; index < count; index += 1) {
        const candidate = rowText.nth(index);
        const value = normalise(await candidate.textContent() || "");
        const hintValue = normalise(hint);
        if (value.includes(hintValue)) {
          await candidate.click({ timeout: timeoutMs });
          await page.waitForTimeout(120);
          return;
        }
      }
      await rowText.first().click({ timeout: timeoutMs });
      await page.waitForTimeout(120);
      return;
    }
  }

  const fallback = page.getByText(normalizedLabel, { exact: false });
  if (await fallback.count()) {
    await fallback.first().click({ timeout: timeoutMs });
    await page.waitForTimeout(120);
    return;
  }

  await clickByTextRoleFallback(page, normalizedLabel);
}

async function tapSupportChoice(choice) {
  const options = page.locator('[role="radio"]');
  const normalisedChoice = String(choice || "").trim();
  if (!normalisedChoice) return;
  const exact = options.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(normalisedChoice)}\\b`, "i") }).first();
  if (await exact.count()) {
    await exact.click({ timeout: timeoutMs });
    await page.waitForTimeout(120);
    return;
  }

  const withSummary = options.filter({ hasText: new RegExp(escapeRegExp(normalisedChoice), "i") }).first();
  if (await withSummary.count()) {
    await withSummary.click({ timeout: timeoutMs });
    await page.waitForTimeout(120);
    return;
  }

  const all = await options.count();
  for (let index = 0; index < all; index += 1) {
    const option = options.nth(index);
    const ariaLabel = (await option.getAttribute("aria-label")) || "";
    if (ariaLabel.toLowerCase().startsWith(normalisedChoice.toLowerCase())) {
      await option.click({ timeout: timeoutMs });
      await page.waitForTimeout(120);
      return;
    }
  }

  await clickByTextRoleFallback(page, choice);
}

function variantQuery(value, variant) {
  switch (variant % 5) {
    case 0:
      return value;
    case 1:
      return value.toUpperCase();
    case 2:
      return `  ${value.toLowerCase()} `;
    case 3:
      return value.replace(/ /g, "");
    default:
      return `${value}, ${value.includes(" NSW") ? "Australia" : ""}`.trim();
  }
}

async function assertAppReachable(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Nearby/settings stress could not reach ${url}. Start the Expo web app first. Original error: ${reason}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function recordCase(name, callback, metadata) {
  const started = Date.now();
  const suite = metadata.section ? "settings" : "nearby";
  const row = {
    name,
    suite,
    status: "passed",
    section: metadata.section || "nearby",
    query: metadata.queryBase || null,
    mode: metadata.mode || metadata.stationAction || metadata.alertAction || metadata.navChoice || null,
    elapsedMs: 0,
  };

  try {
    await callback();
    row.status = "passed";
    row.elapsedMs = Date.now() - started;
    console.log(`OK ${name}`);
  } catch (error) {
    row.status = "failed";
    row.elapsedMs = Date.now() - started;
    row.error = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${name}: ${row.error}`);
  }

  results.push(row);
}

async function tapControl(text, roles = ["button"]) {
  for (const role of roles) {
    const exact = page.getByRole(role, { name: new RegExp(`^${escapeRegExp(text)}$`, "i") });
    if (await exact.count()) {
      await exact.first().click({ timeout: timeoutMs });
      await page.waitForTimeout(120);
      return;
    }
    const loose = page.getByRole(role, { name: new RegExp(escapeRegExp(text), "i") });
    if (await loose.count()) {
      await loose.first().click({ timeout: timeoutMs });
      await page.waitForTimeout(120);
      return;
    }
  }
  const fallback = page.getByRole(roles[0], { hasText: text });
  if (await fallback.count()) {
    await fallback.first().click({ timeout: timeoutMs });
    await page.waitForTimeout(120);
    return;
  }
  await tapByAriaLabel(text, roles);
}

async function tapByAriaLabel(text, roles = ["button"]) {
  for (const role of roles) {
    const exact = page.locator(`[role=\"${role}\"][aria-label=\"${cssEscape(text)}\"]`).first();
    if (await exact.count()) {
      await exact.click({ timeout: timeoutMs });
      await page.waitForTimeout(120);
      return;
    }
    const fallback = page.locator(`[role=\"${role}\"]`).filter({ hasText: text }).first();
    if (await fallback.count()) {
      await fallback.click({ timeout: timeoutMs });
      await page.waitForTimeout(120);
      return;
    }
  }

  const byText = page.locator(`[role=\"button\"]`, { hasText: new RegExp(escapeRegExp(text), "i") }).first();
  if (await byText.count()) {
    await byText.click({ timeout: timeoutMs });
    await page.waitForTimeout(120);
    return;
  }

  await clickByTextRoleFallback(page, text);
}

async function tapByAriaLabelMaybe(text, roles = ["button"]) {
  try {
    await tapByAriaLabel(text, roles);
  } catch (error) {
    console.log(`Optional control not found, skipping: ${text}`);
  }
}

async function findVisibleCandidate(activePage, candidates) {
  for (const candidate of candidates) {
    const exact = activePage.locator('[role="button"]', { hasText: new RegExp(`\\b${escapeRegExp(candidate)}\\b`, "i") });
    if (await exact.count()) {
      return exact.first();
    }
    const aria = activePage.locator(`[role="button"][aria-label="${cssEscape(candidate)}"]`);
    if (await aria.count()) {
      return aria.first();
    }
    const partial = activePage.locator('[role="button"]', { hasText: new RegExp(escapeRegExp(candidate), "i") });
    if (await partial.count()) {
      return partial.first();
    }
  }
  return null;
}

async function clickByTextRoleFallback(activePage, text) {
  const candidate = await activePage.locator("*")
    .filter({ hasText: new RegExp(escapeRegExp(text), "i") })
    .first();
  if (!await candidate.count()) throw new Error(`Could not find visible click target: ${text}`);
  await candidate.click({ timeout: timeoutMs });
  await activePage.waitForTimeout(120);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssEscape(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, "\\\"")
    .replace(/\n/g, " ");
}

function requestJson(request) {
  try {
    return request.postDataJSON() || {};
  } catch {
    return {};
  }
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function suggestionsForQuery(query) {
  const queryNorm = normalise(query);
  const matches = mapSuggestions
    .filter((entry) => {
      const haystack = `${entry.query} ${entry.label} ${entry.state} ${entry.type}`.toLowerCase();
      return normalise(haystack).includes(queryNorm);
    })
    .map((entry) => ({
      lat: entry.lat,
      lon: entry.lon,
      label: entry.label,
      type: entry.type,
      state: entry.state,
      provider: "stress_mock",
    }));

  return matches.length ? matches : mapSuggestions
    .filter((entry) => entry.query.length > 0)
    .slice(0, 1)
    .map((entry) => ({
      lat: entry.lat,
      lon: entry.lon,
      label: entry.label,
      type: entry.type,
      state: entry.state,
      provider: "stress_mock",
    }));
}

function renderReport(summary, rows) {
  const failed = rows.filter((row) => row.status === "failed");
  return `# Plan, Nearby and Settings Stress Report

Run ID: ${summary.runId}

App URL: ${summary.appUrl}

Total cases: ${summary.cases}

Passed: ${summary.passed}

Failed: ${summary.failed}

Nearby cases passed/attempted: ${summary.suites.nearby.passed}/${summary.suites.nearby.attempted}

Settings cases passed/attempted: ${summary.suites.settings.passed}/${summary.suites.settings.attempted}

Failure preview:
${failed
  .slice(0, 12)
  .map((row) => `- ${row.name}: ${row.error}`)
  .join("\n")}

|name|suite|section|mode|status|elapsedMs|error|
|---|---|---|---|---|---:|---|
${rows
  .map((row) =>
    [
      row.name,
      row.suite,
      row.section,
      row.mode || "",
      row.status,
      row.elapsedMs,
      (row.error || "").replace(/\|/g, "\\|").replace(/\n/g, " "),
    ].join(" | "),
  )
  .join("\n")}
`;
}
