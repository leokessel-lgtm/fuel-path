#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../mobile-app/node_modules/playwright");

const appUrl = process.env.FUEL_PATH_MAP_MOCKED_STRESS_URL || "https://fuel-path.vercel.app/";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");
const screenshotDir = path.join(outputDir, `map-interaction-mocked-stress-${runId}-screenshots`);
const viewports = [
  { id: "small-phone", width: 390, height: 780 },
  { id: "phone", width: 430, height: 900 },
  { id: "tablet", width: 768, height: 1024 },
];

const browser = await launchBrowser();
const results = [];
try {
  for (const viewport of viewports) results.push(await runViewport(viewport));
} finally {
  await browser.close();
}

const failed = results.filter((item) => item.status === "failed");
const summary = { runId, appUrl, viewports: results.length, passed: results.length - failed.length, failed: failed.length, failures: failed.map((item) => item.viewport.id), screenshotDir };
fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `map-interaction-mocked-stress-${runId}.json`);
const reportPath = path.join(outputDir, `map-interaction-mocked-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
if (failed.length) throw new Error(`${failed.length}/${results.length} mocked map interaction viewport(s) failed`);

async function runViewport(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleMessages = attachConsole(page);
  const row = { viewport, status: "passed", failures: [], warnings: [], metrics: {}, screenshots: [] };
  try {
    await installMocks(page);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.getByText("SHOW NEARBY", { exact: false }).first().waitFor({ timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-station-code]").length > 4, null, { timeout: 10000 });
    await page.waitForTimeout(700);
    row.metrics.default = await mapState(page);
    row.failures.push(...checks([
      [row.metrics.default.stationMarkers >= 8 || row.metrics.default.clusters >= 1, "fuel markers/clusters missing on default map"],
      [!row.metrics.default.hasZoomControls, "zoom controls returned on default map"],
      [row.metrics.default.sheetTop > viewport.height * 0.62, `collapsed Nearby controls too high: ${row.metrics.default.sheetTop}`],
      [!row.metrics.default.text.includes("Full list"), "Full list text returned in collapsed map"],
    ]));
    row.screenshots.push(await capture(page, `${viewport.id}-default`));

    await dragMap(page, viewport);
    row.metrics.afterDrag = await mapState(page);
    if (row.metrics.afterDrag.stationMarkers < 1 && row.metrics.afterDrag.clusters < 1) row.failures.push("drag left no visible fuel markers/clusters");

    const firstFuel = await firstStationCode(page);
    if (!firstFuel.code) row.failures.push("no clickable fuel marker found");
    else {
      await clickStation(page, firstFuel.code, firstFuel.x, firstFuel.y);
      await page.waitForTimeout(400);
      row.metrics.selectedFuel = await mapState(page);
      row.failures.push(...checks([
        [row.metrics.selectedFuel.text.includes("km"), "selected fuel card missing distance pill/text"],
        [!row.metrics.selectedFuel.text.includes("Navigate to this stop"), "large navigate button returned in selected fuel state"],
        [!row.metrics.selectedFuel.text.includes("STATION DETAIL"), "Station detail heading returned in selected fuel state"],
        [!row.metrics.selectedFuel.text.includes("your adjusted price"), "adjusted-price summary returned in selected fuel state"],
      ]));
      row.screenshots.push(await capture(page, `${viewport.id}-selected-fuel`));
    }

    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await chooseFuelMode(page, "EV charge");
    await page.waitForFunction(() => document.querySelectorAll(".fuel-path-ev-marker").length > 4, null, { timeout: 10000 });
    row.metrics.ev = await mapState(page);
    row.failures.push(...checks([
      [row.metrics.ev.evMarkers >= 8, `expected EV markers, got ${row.metrics.ev.evMarkers}`],
      [row.metrics.ev.text.includes("Any") && row.metrics.ev.text.includes("AC") && row.metrics.ev.text.includes("Fast"), "EV filter controls missing"],
      [!row.metrics.ev.text.includes("? kw"), "EV unknown power rendered as ? kw"],
      [!/available now/i.test(row.metrics.ev.text), "EV live availability overclaim returned"],
      [!row.metrics.ev.text.includes("Full list"), "Full list text returned in EV map"],
    ]));
    row.screenshots.push(await capture(page, `${viewport.id}-ev`));

    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await clickBottomTab(page, "Plan");
    await page.locator("input").nth(0).fill("Sydney NSW");
    await page.locator("input").nth(1).fill("Melbourne VIC");
    await page.getByText("Plan route", { exact: true }).first().click({ timeout: 5000 });
    await waitForPlanRecommendation(page);
    row.metrics.plan = await mapState(page);
    row.failures.push(...checks([
      [row.metrics.plan.stationMarkers >= 3, `expected Plan route markers, got ${row.metrics.plan.stationMarkers}`],
      [row.metrics.plan.text.includes("BEST PRICE BY") || row.metrics.plan.text.includes("Best price by") || row.metrics.plan.text.includes("Best route price"), "Plan best-price evidence missing"],
      [row.metrics.plan.text.includes("Why?"), "Plan evidence action missing"],
      [!row.metrics.plan.text.includes("Suggested fuel stops"), "Suggested fuel stops copy returned in Plan"],
      [!row.metrics.plan.text.includes("Navigate to this stop"), "large navigate button returned in Plan recommendation"],
      [!row.metrics.plan.text.includes("FUEL USED"), "Fuel used evidence returned in Plan"],
    ]));
    row.screenshots.push(await capture(page, `${viewport.id}-plan`));

    const actionableConsole = consoleFailures(consoleMessages);
    row.failures.push(...actionableConsole);
  } catch (error) {
    row.failures.push(error instanceof Error ? error.message : String(error));
    row.screenshots.push(await capture(page, `${viewport.id}-error`).catch(() => ""));
  } finally {
    await context.close();
  }
  row.status = row.failures.length ? "failed" : "passed";
  console.log(`${row.status === "passed" ? "OK" : "FAIL"} ${viewport.id}`);
  return row;
}

async function launchBrowser() { try { return await chromium.launch({ channel: "chrome", headless: true }); } catch { return chromium.launch({ headless: true }); } }

async function waitForPlanRecommendation(page) {
  await page.getByText("Why?", { exact: true }).first().waitFor({ state: "visible", timeout: 12000 });
  await page.getByText("BEST PRICE BY", { exact: false }).first().waitFor({ state: "visible", timeout: 12000 }).catch(async () => {
    await page.getByText("Best route price", { exact: false }).first().waitFor({ state: "visible", timeout: 12000 });
  });
}
function attachConsole(page) { const messages = []; page.on("console", (message) => { if (["error", "warning"].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`); }); page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`)); return messages; }
function consoleFailures(messages) { const actionable = messages.filter((entry) => !/favicon|ResizeObserver|tile.openstreetmap.org|Cannot record touch end without a touch start/i.test(entry)); return actionable.length ? [`console/page errors: ${actionable.slice(0, 3).join(" | ")}`] : []; }

async function installMocks(page) {
  await page.route("**/api/status", async (route) => route.fulfill(jsonResponse({ defaultSource: "live", credentialsConfigured: true, cacheSeconds: 300, fuelProviders: { selection: "live" }, evCharging: { provider: "api_ninjas", configured: true, capability: "directory", realTimeAvailability: false, liveAvailabilityClaimsAllowed: false }, geocoding: { activeProvider: "fuel_path_gnaf", activeMode: "hosted" } })));
  await page.route("**/api/stations?**", async (route) => route.fulfill(jsonResponse({ stations: fuelStations(96), context: { fuel: "PDL", provider: "map_mock", stationCount: 96, returnedCount: 96 } })));
  await page.route("**/api/ev-chargers?**", async (route) => route.fulfill(jsonResponse({ chargers: evChargers(96), context: { provider: "api_ninjas", source: "map_mock", capability: "directory", chargerCount: 96, returnedCount: 96, provenance: { realTimeAvailability: false } } })));
  await page.route("**/api/geocode**", async (route) => {
    const request = route.request();
    const postData = request.postDataJSON?.();
    const q = new URL(request.url()).searchParams.get("q") || postData?.q || "";
    const location = /sydney/i.test(q) ? { label: "Sydney NSW", lat: -33.8688, lon: 151.2093, state: "NSW", provider: "map_mock" } : { label: "Melbourne VIC", lat: -37.8136, lon: 144.9631, state: "VIC", provider: "map_mock" };
    await route.fulfill(jsonResponse({ provider: "map_mock", lookupStatus: "ok", location, suggestions: [location] }));
  });
  await page.route("**/api/route?**", async (route) => route.fulfill(jsonResponse(routePayload())));
  await page.route("**/api/score", async (route) => route.fulfill(jsonResponse({ route: routePayload(), score: scorePayload() })));
}

async function mapState(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || "";
    const sheetTops = [...document.querySelectorAll("button, div")].filter((el) => ["Closest", "Cheapest", "Best value", "Any", "AC", "Fast"].includes((el.innerText || el.textContent || "").trim())).map((el) => Math.round(el.getBoundingClientRect().top)).filter((top) => top > 0);
    return { text, stationMarkers: document.querySelectorAll("[data-station-code]").length, evMarkers: document.querySelectorAll(".fuel-path-ev-marker").length, clusters: document.querySelectorAll(".fuel-path-marker-cluster").length, hasZoomControls: Boolean(document.querySelector(".leaflet-control-zoom-in")) && Boolean(document.querySelector(".leaflet-control-zoom-out")), sheetTop: sheetTops.length ? Math.min(...sheetTops) : -1 };
  });
}
async function firstStationCode(page) {
  return page.evaluate(() => {
    const markers = [...document.querySelectorAll("[data-station-code]")]
      .map((markerNode) => {
        const target = markerNode.closest(".leaflet-marker-icon") || markerNode;
        if (!(target instanceof HTMLElement)) return null;
        const rect = target.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
        return { code: markerNode.getAttribute("data-station-code") || "", x, y };
      })
      .filter(Boolean)
      .sort((left, right) => right.y - left.y);
    return markers[0] || { code: "", x: 0, y: 0 };
  });
}
async function clickStation(page, code, x, y) {
  const box = await page.evaluate((stationCode) => {
    const marker = document.querySelector(`[data-station-code="${CSS.escape(stationCode)}"]`);
    const target = marker?.closest(".leaflet-marker-icon") || marker;
    if (!(target instanceof HTMLElement)) return null;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, code);
  const point = box || { x, y };
  if (typeof point.x !== "number" || typeof point.y !== "number") {
    throw new Error(`could not locate visible station ${code}`);
  }
  await page.mouse.click(point.x, point.y);
}
async function dragMap(page, viewport) { await page.mouse.move(viewport.width / 2, viewport.height / 2); await page.mouse.down(); await page.mouse.move(viewport.width / 2 - 95, viewport.height / 2 + 65, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(800); }
async function chooseFuelMode(page, label) { await page.getByRole("button", { name: "Choose fuel or EV charging", exact: true }).click({ timeout: 5000 }); await page.getByText(label, { exact: true }).click({ timeout: 5000 }); }
async function clickBottomTab(page, label) { await page.getByText(label, { exact: true }).last().click({ timeout: 5000 }); await page.waitForTimeout(350); }
async function capture(page, name) { fs.mkdirSync(screenshotDir, { recursive: true }); const filePath = path.join(screenshotDir, `${name}.png`); await page.screenshot({ path: filePath, fullPage: false }); return filePath; }

function fuelStations(count) { const centre = { lat: -31.9523, lon: 115.8613 }; return Array.from({ length: count }, (_, index) => ({ stationCode: `MAP-FUEL-${index}`, name: `${["Metro", "Shell", "Ampol", "BP", "United"][index % 5]} Map ${index}`, brand: ["Metro", "Shell", "Ampol", "BP", "United"][index % 5], suburb: "Perth", address: `${index} Map Rd, Perth WA`, lat: centre.lat + Math.sin(index) * 0.045 + Math.floor(index / 16) * 0.005, lon: centre.lon + Math.cos(index) * 0.045 + Math.floor(index / 16) * 0.005, openNow: index % 11 !== 0, membershipRequired: false, updatedAt: "2026-06-29T08:00:00.000Z", source: "map_mock", prices: { PDL: Number((152.9 + (index % 31)).toFixed(1)), U91: Number((141.9 + (index % 21)).toFixed(1)) }, discounts: [] })); }
function evChargers(count) { const centre = { lat: -31.9523, lon: 115.8613 }; return Array.from({ length: count }, (_, index) => { const power = [7, 22, 50, 75, 150, 350][index % 6]; return { id: `MAP-EV-${index}`, name: `Map Charger ${index}`, operator: ["Chargefox", "Evie", "Council", "Tesla"][index % 4], address: `${index} Map Charge Lane, Perth WA`, lat: centre.lat + Math.sin(index) * 0.048, lon: centre.lon + Math.cos(index) * 0.048, connectors: [power >= 50 ? "CCS2" : "TYPE2"], connections: [{ connector: power >= 50 ? "CCS2" : "TYPE2", connectorLabel: power >= 50 ? "CCS2" : "Type 2", powerKw: power, currentType: power >= 50 ? "DC" : "AC", operational: true }], maxPowerKw: power, powerBand: power >= 50 ? "dc_fast" : "ac", availability: "unknown", availabilityLabel: "Live bay status unknown", source: "map_mock", provenance: "Charger data from map mock. Confirm before driving." }; }); }
function scorePayload() { const recs = [candidate("MAP-PLAN-1", "Metro Craigieburn", "Metro", 156.9, -36.8, 145.4, 0.8), candidate("MAP-PLAN-2", "Ampol Lavington", "Ampol", 160.9, -36.05, 146.93, 2.4), candidate("MAP-PLAN-3", "Shell Chipping Norton", "Shell", 165.9, -33.91, 150.95, 3.7)]; return { context: { provider: "map_mock", fuel: "PDL", routeDistanceKm: 859, decisionSummary: { label: "Good savings detour", economics: { comparisonCpl: 176.9, comparisonKind: "next_best_viable", adjustedCpl: 156.9, pumpCpl: 159.9, detourMinutes: 0.8 } } }, recommendations: recs, contextStations: [] }; }
function routePayload() { return { provider: "map_mock", distanceKm: 859, durationMin: 540, points: [{ lat: -33.8688, lon: 151.2093, label: "Sydney NSW" }, { lat: -35.2809, lon: 149.13, label: "Canberra ACT" }, { lat: -37.8136, lon: 144.9631, label: "Melbourne VIC" }] }; }
function candidate(code, name, brand, adjustedCpl, lat, lon, detourMinutes) { return { station: { stationCode: code, name, brand, suburb: "Route", address: `${name} Road`, lat, lon, openNow: true, updatedAt: "2026-06-29T08:00:00.000Z", source: "map_mock", prices: { PDL: adjustedCpl + 3 }, discounts: [] }, fuel: "PDL", pumpCpl: adjustedCpl + 3, adjustedCpl, discountCpl: 3, detourMinutes, detourKm: 0.4, smartDetourLimitMinutes: 30, eligible: true, reachable: true, openNow: true, score: 100, distanceKm: 1.2, distanceToRouteKm: 0.4, distanceAlongRouteKm: 120 }; }
function jsonResponse(payload, status = 200) { return { status, contentType: "application/json", body: JSON.stringify(payload) }; }
function checks(items) { return items.filter(([ok]) => !ok).map(([, message]) => message); }
function renderReport(summary, results) { return `# Mocked map interaction stress\n\nRun: ${summary.runId}\n\n## Summary\n\n- App URL: ${summary.appUrl}\n- Viewports: ${summary.viewports}\n- Passed: ${summary.passed}\n- Failed: ${summary.failed}\n- Screenshots: ${summary.screenshotDir}\n\n## Failures\n\n${results.filter((item) => item.failures.length).map((item) => `- ${item.viewport.id}: ${item.failures.join("; ")}`).join("\n") || "- None"}\n\n## Brutal read\n\n${summary.failed ? "Map interaction still has deterministic UX or control failures under mocked fuel, EV and route data." : "Map interaction held across pan, zoom, station selection, EV switch and Plan route rendering on three responsive viewports with controlled dense-enough data."}\n`; }
