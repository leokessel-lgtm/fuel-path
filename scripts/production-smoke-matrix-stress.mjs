#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../mobile-app/node_modules/playwright");

const appUrl = process.env.FUEL_PATH_PRODUCTION_SMOKE_URL || "https://fuel-path.vercel.app/";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");
const screenshotDir = path.join(outputDir, `production-smoke-matrix-stress-${runId}-screenshots`);
const viewports = [
  { id: "small-phone", width: 390, height: 780 },
  { id: "phone", width: 430, height: 900 },
  { id: "tablet", width: 768, height: 1024 },
];

const browser = await launchBrowser();
const results = [];
try {
  for (const viewport of viewports) {
    results.push(await runCase(viewport, "nearby-fuel", smokeNearbyFuel));
    results.push(await runCase(viewport, "nearby-ev", smokeNearbyEv));
    results.push(await runCase(viewport, "plan-route", smokePlanRoute));
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => result.status === "failed");
const summary = {
  runId,
  appUrl,
  cases: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed.map((result) => result.id),
  screenshotDir,
};
fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `production-smoke-matrix-stress-${runId}.json`);
const reportPath = path.join(outputDir, `production-smoke-matrix-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
if (failed.length) throw new Error(`${failed.length}/${results.length} production smoke case(s) failed`);

async function runCase(viewport, name, fn) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleMessages = attachConsole(page);
  const row = { id: `${name}-${viewport.id}`, viewport, status: "passed", failures: [], warnings: [], metrics: {}, screenshot: "", textSample: "" };
  try {
    await installCommonMocks(page);
    await fn(page, row);
    row.failures.push(...consoleFailures(consoleMessages));
    row.failures.push(...await rawLeakFailures(page));
    row.textSample = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 700);
    row.screenshot = await capture(page, row.id);
  } catch (error) {
    row.failures.push(error instanceof Error ? error.message : String(error));
    row.screenshot = await capture(page, `${row.id}-error`).catch(() => "");
    row.textSample = await page.locator("body").innerText().then((text) => text.replace(/\s+/g, " ").slice(0, 700)).catch(() => "");
    row.metrics = await uiState(page).catch(() => row.metrics);
  } finally {
    await context.close();
  }
  row.status = row.failures.length ? "failed" : "passed";
  console.log(`${row.status === "passed" ? "OK" : "FAIL"} ${row.id}`);
  return row;
}

async function smokeNearbyFuel(page, row) {
  await page.route("**/api/stations?**", async (route) => route.fulfill(jsonResponse({
    stations: fuelStations(42),
    context: { fuel: "PDL", source: "live", provider: "smoke_mock", radiusKm: 16, stationCount: 42, returnedCount: 42, generatedAt: new Date().toISOString() },
  })));
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByText("SHOW NEARBY", { exact: false }).first().waitFor({ timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-station-code]").length > 0, null, { timeout: 10000 });
  await page.waitForTimeout(800);
  const state = await uiState(page);
  row.metrics = state;
  row.failures.push(...checks([
    [state.text.includes("Nearby"), "Nearby tab text missing"],
    [state.text.includes("Closest") && state.text.includes("Cheapest") && state.text.includes("Best value"), "fuel sort controls missing"],
    [state.stationMarkers >= 6, `expected visible fuel markers, got ${state.stationMarkers}`],
    [state.hasZoomControls, "Leaflet zoom controls missing"],
    [!state.text.includes("Full list"), "removed Full list copy returned"],
    [!state.text.includes("WA tomorrow locked prices"), "state timing banner returned"],
    [!state.text.includes("Suggested fuel stops"), "suggested fuel stops copy leaked into Nearby"],
  ]));
}

async function smokeNearbyEv(page, row) {
  await page.route("**/api/stations?**", async (route) => route.fulfill(jsonResponse({ stations: fuelStations(12), context: { provider: "smoke_mock" } })));
  await page.route("**/api/ev-chargers?**", async (route) => route.fulfill(jsonResponse({
    chargers: evChargers(48),
    context: { provider: "api_ninjas", source: "smoke_mock", capability: "directory", radiusKm: 24, chargerCount: 48, returnedCount: 48, provenance: { source: "smoke_mock", label: "Charger data from smoke mock", realTimeAvailability: false } },
  })));
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByText("SHOW NEARBY", { exact: false }).first().waitFor({ timeout: 10000 });
  await chooseFuelMode(page, "EV charge");
  await page.waitForFunction(() => document.querySelectorAll(".fuel-path-ev-marker").length > 0, null, { timeout: 10000 });
  await page.waitForTimeout(800);
  const state = await uiState(page);
  row.metrics = state;
  row.failures.push(...checks([
    [state.text.includes("EV charge"), "EV mode label missing"],
    [state.text.includes("Any") && state.text.includes("AC") && state.text.includes("Fast"), "EV simplified filters missing"],
    [state.evMarkers >= 6, `expected visible EV markers, got ${state.evMarkers}`],
    [!state.text.includes("? kw"), "unknown EV power rendered as ? kw"],
    [!/available now/i.test(state.text), "EV overclaims live availability"],
    [!state.text.includes("Full list"), "removed Full list copy returned in EV mode"],
  ]));
}

async function smokePlanRoute(page, row) {
  await installPlanMocks(page);
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await clickBottomTab(page, "Plan");
  await page.locator("input").nth(0).fill("Sydney NSW");
  await page.waitForTimeout(250);
  await page.locator("input").nth(1).fill("Melbourne VIC");
  await page.waitForTimeout(250);
  await page.getByText("Plan route", { exact: true }).first().click({ timeout: 5000 });
  await page.getByText("Why this stop", { exact: false }).first().waitFor({ timeout: 12000 });
  await page.waitForTimeout(800);
  const state = await uiState(page);
  row.metrics = state;
  row.failures.push(...checks([
    [/savings detour/i.test(state.text), "detour recommendation label missing"],
    [state.text.includes("BEST PRICE BY") || state.text.includes("Best price by") || state.text.includes("Best route price"), "best-price evidence missing"],
    [state.stationMarkers >= 3, `expected route station markers, got ${state.stationMarkers}`],
    [!state.text.includes("Suggested fuel stops"), "retired Suggested fuel stops copy returned"],
    [!state.text.includes("Navigate to this stop"), "large navigate button returned"],
    [!state.text.includes("FUEL USED"), "retired Fuel used evidence returned"],
    [!state.text.includes("Route saving"), "retired route saving label returned"],
    [!state.text.includes("Fuel scoring uses smart detour rules"), "retired generic scoring message returned"],
  ]));
}

async function launchBrowser() {
  try { return await chromium.launch({ channel: "chrome", headless: true }); }
  catch { return chromium.launch({ headless: true }); }
}

function attachConsole(page) {
  const messages = [];
  page.on("console", (message) => { if (["error", "warning"].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`); });
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  return messages;
}

function consoleFailures(messages) {
  const actionable = messages.filter((entry) => !/favicon|ResizeObserver|tile.openstreetmap.org|Cannot record touch end without a touch start/i.test(entry));
  return actionable.length ? [`console/page errors: ${actionable.slice(0, 3).join(" | ")}`] : [];
}

async function rawLeakFailures(page) {
  const text = await page.locator("body").innerText();
  return [/node:internal/i, /webpack/i, /TypeError:/i, /ReferenceError:/i, /SyntaxError:/i].filter((pattern) => pattern.test(text)).map((pattern) => `raw failure leak matched ${pattern}`);
}

async function installCommonMocks(page) {
  await page.route("**/api/status", async (route) => route.fulfill(jsonResponse({
    defaultSource: "live",
    credentialsConfigured: true,
    cacheSeconds: 300,
    fuelProviders: { selection: "live", capabilityLabels: [], capabilitySummary: {}, capabilities: [] },
    evCharging: { provider: "api_ninjas", configured: true, capability: "directory", defaultProvider: "api_ninjas", providerSelection: "api_ninjas", apiNinjasConfigured: true, realTimeAvailability: false, liveAvailabilityClaimsAllowed: false, coverage: "directory" },
    geocoding: { activeProvider: "fuel_path_gnaf", activeMode: "hosted", recommendedProductionProvider: "fuel_path_gnaf" },
  })));
}

async function installPlanMocks(page) {
  await page.route("**/api/geocode?**", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") || "";
    const isSydney = /sydney/i.test(q);
    const location = isSydney ? { label: "Sydney NSW", lat: -33.8688, lon: 151.2093, state: "NSW", provider: "smoke_mock" } : { label: "Melbourne VIC", lat: -37.8136, lon: 144.9631, state: "VIC", provider: "smoke_mock" };
    await route.fulfill(jsonResponse({ provider: "smoke_mock", lookupStatus: "ok", location, suggestions: [location] }));
  });
  await page.route("**/api/route?**", async (route) => route.fulfill(jsonResponse(routePayload())));
  await page.route("**/api/score", async (route) => route.fulfill(jsonResponse({
    route: routePayload(),
    score: scorePayload(),
  })));
}

async function chooseFuelMode(page, label) {
  await page.getByRole("button", { name: "Choose fuel or EV charging", exact: true }).click({ timeout: 5000 });
  await page.getByText(label, { exact: true }).click({ timeout: 5000 });
}

async function clickBottomTab(page, label) {
  await page.getByText(label, { exact: true }).last().click({ timeout: 5000 });
  await page.waitForTimeout(350);
}

async function uiState(page) {
  return page.evaluate(() => ({
    text: document.body.innerText || "",
    stationMarkers: document.querySelectorAll("[data-station-code]").length,
    evMarkers: document.querySelectorAll(".fuel-path-ev-marker").length,
    clusters: document.querySelectorAll(".fuel-path-marker-cluster").length,
    hasZoomControls: Boolean(document.querySelector(".leaflet-control-zoom-in")) && Boolean(document.querySelector(".leaflet-control-zoom-out")),
  }));
}

async function capture(page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const filePath = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

function fuelStations(count) {
  const centre = { lat: -31.9523, lon: 115.8613 };
  return Array.from({ length: count }, (_, index) => {
    const lat = centre.lat + Math.sin(index) * 0.025 + Math.floor(index / 12) * 0.006;
    const lon = centre.lon + Math.cos(index) * 0.025 + Math.floor(index / 12) * 0.006;
    return {
      stationCode: `SMOKE-FUEL-${index}`,
      name: `${["Metro", "Shell", "Ampol", "BP", "United"][index % 5]} Smoke ${index}`,
      brand: ["Metro", "Shell", "Ampol", "BP", "United"][index % 5],
      suburb: "Perth",
      address: `${index} Smoke Rd, Perth WA`,
      lat,
      lon,
      openNow: true,
      membershipRequired: false,
      updatedAt: "2026-06-29T08:00:00.000Z",
      source: "smoke_mock",
      prices: { PDL: Number((156.9 + (index % 13)).toFixed(1)), U91: Number((145.9 + (index % 9)).toFixed(1)) },
      discounts: [],
    };
  });
}

function evChargers(count) {
  const centre = { lat: -31.9523, lon: 115.8613 };
  return Array.from({ length: count }, (_, index) => {
    const power = [7, 22, 50, 150][index % 4];
    return {
      id: `SMOKE-EV-${index}`,
      name: `Smoke Charger ${index}`,
      operator: ["Chargefox", "Evie", "Council"][index % 3],
      address: `${index} Charge Lane, Perth WA`,
      lat: centre.lat + Math.sin(index) * 0.03,
      lon: centre.lon + Math.cos(index) * 0.03,
      connectors: [power >= 50 ? "CCS2" : "TYPE2"],
      connections: [{ connector: power >= 50 ? "CCS2" : "TYPE2", connectorLabel: power >= 50 ? "CCS2" : "Type 2", powerKw: power, currentType: power >= 50 ? "DC" : "AC", operational: true }],
      maxPowerKw: power,
      powerBand: power >= 50 ? "dc_fast" : "ac",
      availability: "unknown",
      availabilityLabel: "Live bay status unknown",
      source: "smoke_mock",
      provenance: "Charger data from smoke mock. Confirm before driving.",
    };
  });
}

function scorePayload() {
  const stations = [
    scoreCandidate("SMOKE-PLAN-1", "Metro Craigieburn", "Metro", 156.9, -36.8, 145.4, 0.8, 20),
    scoreCandidate("SMOKE-PLAN-2", "Ampol Lavington", "Ampol", 160.9, -36.05, 146.93, 2.4, 16),
    scoreCandidate("SMOKE-PLAN-3", "Shell Chipping Norton", "Shell", 165.9, -33.91, 150.95, 3.7, 11),
  ];
  return {
    context: {
      source: "smoke_mock",
      provider: "smoke_mock",
      fuel: "PDL",
      routeDistanceKm: 859,
      decisionSummary: {
        label: "Good savings detour",
        economics: { comparisonCpl: 176.9, comparisonKind: "next_best_viable", adjustedCpl: 156.9, pumpCpl: 159.9, detourMinutes: 0.8 },
      },
    },
    recommendations: stations,
    contextStations: [],
  };
}

function routePayload() {
  return {
    provider: "smoke_mock",
    distanceKm: 859,
    durationMin: 540,
    points: [
      { lat: -33.8688, lon: 151.2093, label: "Sydney NSW" },
      { lat: -35.2809, lon: 149.13, label: "Canberra ACT" },
      { lat: -37.8136, lon: 144.9631, label: "Melbourne VIC" },
    ],
  };
}

function scoreCandidate(code, name, brand, adjustedCpl, lat, lon, detourMinutes, bestBy) {
  return {
    station: { stationCode: code, name, brand, suburb: "Route", address: `${name} Road`, lat, lon, openNow: true, updatedAt: "2026-06-29T08:00:00.000Z", source: "smoke_mock", prices: { PDL: adjustedCpl + 3 }, discounts: [] },
    fuel: "PDL",
    pumpCpl: adjustedCpl + 3,
    adjustedCpl,
    discountCpl: 3,
    detourMinutes,
    detourKm: 0.4,
    smartDetourLimitMinutes: 30,
    eligible: true,
    reachable: true,
    openNow: true,
    score: bestBy,
    bestPriceByCpl: bestBy,
    distanceKm: 1.2,
    distanceToRouteKm: 0.4,
    distanceAlongRouteKm: 120,
  };
}

function jsonResponse(payload, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(payload) };
}

function checks(items) {
  return items.filter(([ok]) => !ok).map(([, message]) => message);
}

function renderReport(summary, results) {
  return `# Production smoke matrix stress\n\nRun: ${summary.runId}\n\n## Summary\n\n- App URL: ${summary.appUrl}\n- Cases: ${summary.cases}\n- Passed: ${summary.passed}\n- Failed: ${summary.failed}\n- Screenshots: ${summary.screenshotDir}\n\n## Failures\n\n${results.filter((result) => result.failures.length).map((result) => `- ${result.id}: ${result.failures.join("; ")}`).join("\n") || "- None"}\n\n## Brutal read\n\n${summary.failed ? "Production bundle failed a deterministic smoke path. Treat production as not evidence-ready until fixed." : "Production bundle passed deterministic smoke across fuel Nearby, EV Nearby and Plan route states on three responsive viewports. This proves the deployed UI bundle is coherent under controlled API data, not that every live provider is healthy."}\n`;
}
