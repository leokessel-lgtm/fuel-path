#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../mobile-app/node_modules/playwright");

const appUrl = process.env.FUEL_PATH_DENSITY_URL || "https://fuel-path.vercel.app/";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");
const screenshotDir = path.join(outputDir, `map-density-performance-stress-${runId}-screenshots`);
const viewports = [
  { id: "phone", width: 430, height: 900 },
  { id: "small-phone", width: 390, height: 780 },
];

const browser = await launchBrowser();
const results = [];
try {
  for (const viewport of viewports) {
    results.push(await runFuelDensity(viewport));
    results.push(await runEvDensity(viewport));
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
const jsonPath = path.join(outputDir, `map-density-performance-stress-${runId}.json`);
const reportPath = path.join(outputDir, `map-density-performance-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
if (failed.length) throw new Error(`${failed.length}/${results.length} map density/performance cases failed`);

async function runFuelDensity(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const row = baseRow(`fuel-density-${viewport.id}`, viewport);
  const consoleMessages = attachConsole(page);
  try {
    await mockStatus(page);
    await page.route("**/api/stations?**", async (route) => route.fulfill(jsonResponse({
      stations: denseStations(820),
      context: {
        fuel: "U91",
        source: "live",
        provider: "density_mock",
        radiusKm: 32,
        stationCount: 820,
        returnedCount: 820,
        generatedAt: new Date().toISOString(),
        warning: "Density stress mock.",
      },
    })));
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    const start = Date.now();
    await page.getByRole("button", { name: "Choose fuel or EV charging", exact: true }).waitFor({ timeout: 9000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-station-code]").length > 0, null, { timeout: 9000 });
    await page.waitForTimeout(1000);
    row.metrics = await densityMetrics(page);
    row.metrics.readyMs = Date.now() - start;
    row.failures.push(...densityAssertions(row.metrics, {
      maxReadyMs: 9000,
      minPriceMarkers: 8,
      maxPriceMarkers: 40,
      maxClusters: 24,
      requireFuel: true,
    }));
    await dragMap(page, viewport);
    const afterDrag = await densityMetrics(page);
    row.metrics.afterDragPriceMarkers = afterDrag.stationMarkers;
    row.metrics.afterDragClusters = afterDrag.clusters;
    if (afterDrag.stationMarkers < 1 && afterDrag.clusters < 1) row.failures.push("map drag left no visible fuel markers or clusters");
    row.screenshot = await capture(page, row.id);
    row.failures.push(...consoleFailures(consoleMessages));
  } catch (error) {
    row.failures.push(error instanceof Error ? error.message : String(error));
    row.screenshot = await capture(page, `${row.id}-error`).catch(() => "");
  } finally {
    await context.close();
  }
  row.status = row.failures.length ? "failed" : "passed";
  console.log(`${row.status === "passed" ? "OK" : "FAIL"} ${row.id}`);
  return row;
}

async function runEvDensity(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const row = baseRow(`ev-density-${viewport.id}`, viewport);
  const consoleMessages = attachConsole(page);
  try {
    await mockStatus(page);
    await page.route("**/api/stations?**", async (route) => route.fulfill(jsonResponse({
      stations: denseStations(120),
      context: { fuel: "U91", source: "live", provider: "density_mock", radiusKm: 32, stationCount: 120, returnedCount: 120, generatedAt: new Date().toISOString() },
    })));
    await page.route("**/api/ev-chargers?**", async (route) => route.fulfill(jsonResponse({
      chargers: denseChargers(360),
      context: {
        provider: "api_ninjas",
        source: "density_mock",
        capability: "prototype",
        radiusKm: 32,
        centre: { lat: -31.9523, lon: 115.8613, label: "Perth WA" },
        filters: { connectors: [], minPowerKw: 0, powerMode: "" },
        chargerCount: 360,
        returnedCount: 360,
        generatedAt: new Date().toISOString(),
        provenance: { source: "density_mock", label: "Charger data from density mock", licence: "test", realTimeAvailability: false },
        warning: "Density stress mock. Confirm availability before driving.",
      },
    })));
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    const start = Date.now();
    await page.getByRole("button", { name: "Choose fuel or EV charging", exact: true }).waitFor({ timeout: 9000 });
    await chooseFuelMode(page, "EV charge");
    await page.waitForFunction(() => document.querySelectorAll(".fuel-path-ev-marker").length > 0, null, { timeout: 9000 });
    await page.waitForTimeout(1000);
    row.metrics = await densityMetrics(page);
    row.metrics.readyMs = Date.now() - start;
    row.failures.push(...densityAssertions(row.metrics, {
      maxReadyMs: 10000,
      minEvMarkers: 6,
      maxEvMarkers: 18,
      requireEv: true,
    }));
    if (row.metrics.bodyText.includes("? kw")) row.failures.push("EV density view shows unknown power as ? kw");
    if (/available now/i.test(row.metrics.bodyText)) row.failures.push("EV density view overclaims live availability");
    row.screenshot = await capture(page, row.id);
    row.failures.push(...consoleFailures(consoleMessages));
  } catch (error) {
    row.failures.push(error instanceof Error ? error.message : String(error));
    row.screenshot = await capture(page, `${row.id}-error`).catch(() => "");
  } finally {
    await context.close();
  }
  row.status = row.failures.length ? "failed" : "passed";
  console.log(`${row.status === "passed" ? "OK" : "FAIL"} ${row.id}`);
  return row;
}

function baseRow(id, viewport) {
  return { id, viewport, status: "passed", failures: [], warnings: [], metrics: {}, screenshot: "" };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

function attachConsole(page) {
  const messages = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  return messages;
}

function consoleFailures(messages) {
  const actionable = messages.filter((entry) => !/favicon|ResizeObserver|tile.openstreetmap.org|Cannot record touch end without a touch start/i.test(entry));
  return actionable.length ? [`console/page errors: ${actionable.slice(0, 3).join(" | ")}`] : [];
}

async function mockStatus(page) {
  await page.route("**/api/status", async (route) => route.fulfill(jsonResponse({
    defaultSource: "live",
    credentialsConfigured: true,
    cacheSeconds: 300,
    fuelProviders: { selection: "live", capabilityLabels: [], capabilitySummary: {}, capabilities: [] },
    evCharging: { provider: "api_ninjas", configured: true, capability: "directory", defaultProvider: "api_ninjas", providerSelection: "api_ninjas", apiNinjasConfigured: true, openChargeMapConfigured: false, realTimeAvailability: false, liveAvailabilityClaimsAllowed: false, coverage: "directory", warning: "Directory data only." },
    geocoding: { activeProvider: "fuel_path_gnaf", activeMode: "hosted", recommendedProductionProvider: "fuel_path_gnaf", requestedProvider: "auto", backendProxyRequired: false, sessionTokenRequired: false, googlePlacesConfigured: false, mapboxConfigured: false },
  })));
}

async function chooseFuelMode(page, label) {
  await page.getByRole("button", { name: "Choose fuel or EV charging", exact: true }).click({ timeout: 5000 });
  await page.getByText(label, { exact: true }).click({ timeout: 5000 });
}

async function densityMetrics(page) {
  return page.evaluate(() => {
    const bodyText = document.body.innerText || "";
    const stations = document.querySelectorAll("[data-station-code]").length;
    const clusters = document.querySelectorAll(".fuel-path-marker-cluster").length;
    const evMarkers = document.querySelectorAll(".fuel-path-ev-marker").length;
    const evMarkerRects = [...document.querySelectorAll(".fuel-path-ev-marker")]
      .map((element) => element.getBoundingClientRect());
    const evOverlapPairs = evMarkerRects.reduce((count, left, leftIndex) =>
      count + evMarkerRects.slice(leftIndex + 1).filter((right) =>
        Math.min(left.right, right.right) - Math.max(left.left, right.left) > 12 &&
        Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 12,
      ).length, 0);
    const leafletMarkerIcons = document.querySelectorAll(".leaflet-marker-icon").length;
    const sheetTops = [...document.querySelectorAll("button, div")]
      .filter((el) => ["Closest", "Cheapest", "Best value", "Any", "AC", "Fast"].includes((el.innerText || el.textContent || "").trim()))
      .map((el) => Math.round(el.getBoundingClientRect().top))
      .filter((top) => Number.isFinite(top) && top > 0);
    return {
      bodyText,
      stationMarkers: stations,
      clusters,
      evMarkers,
      evOverlapPairs,
      leafletMarkerIcons,
      sheetTop: sheetTops.length ? Math.min(...sheetTops) : -1,
      hasZoomControls: Boolean(document.querySelector(".leaflet-control-zoom-in")) && Boolean(document.querySelector(".leaflet-control-zoom-out")),
    };
  });
}

function densityAssertions(metrics, options) {
  const visibleFuelTargets = metrics.stationMarkers + metrics.clusters;
  return checks([
    [metrics.readyMs <= options.maxReadyMs, `ready time ${metrics.readyMs}ms exceeded ${options.maxReadyMs}ms`],
    [!metrics.hasZoomControls, "Leaflet zoom controls returned"],
    [metrics.sheetTop > 0, "bottom controls/sheet controls not measurable"],
    [!metrics.bodyText.includes("Full list"), "Full list button text returned under density"],
    [!metrics.bodyText.includes("Browse view. Full list for more."), "old browse helper copy returned under density"],
    [options.requireFuel ? visibleFuelTargets >= options.minPriceMarkers : true, `expected at least ${options.minPriceMarkers} visible fuel markers or cluster pills, got ${visibleFuelTargets}`],
    [options.requireFuel ? metrics.stationMarkers <= options.maxPriceMarkers : true, `fuel price markers exceeded cap: ${metrics.stationMarkers}`],
    [options.requireFuel ? metrics.clusters <= options.maxClusters : true, `cluster markers exceeded cap: ${metrics.clusters}`],
    [options.requireEv ? metrics.evMarkers >= options.minEvMarkers : true, `expected at least ${options.minEvMarkers} EV markers, got ${metrics.evMarkers}`],
    [options.requireEv ? metrics.evMarkers <= options.maxEvMarkers : true, `EV markers exceeded cap: ${metrics.evMarkers}`],
    [options.requireEv ? metrics.evOverlapPairs <= 4 : true, `EV marker overlap remained unreadable: ${metrics.evOverlapPairs} overlapping pairs`],
  ]);
}

async function dragMap(page, viewport) {
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.width / 2 - 90, viewport.height / 2 + 60, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(800);
}

async function capture(page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const filePath = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

function denseStations(count) {
  const centre = { lat: -31.9523, lon: 115.8613 };
  return Array.from({ length: count }, (_, index) => {
    const ring = Math.floor(index / 36) + 1;
    const angle = (index % 36) * 10 * (Math.PI / 180);
    const radius = 0.0025 * ring;
    const lat = centre.lat + Math.sin(angle) * radius;
    const lon = centre.lon + Math.cos(angle) * radius;
    const price = 145 + (index % 60) * 0.7;
    return {
      stationCode: `DENSE-${index}`,
      name: `Density Fuel ${index}`,
      brand: ["Ampol", "Shell", "BP", "Metro", "Vibe"][index % 5],
      suburb: "Perth",
      address: `${index} Density Rd, Perth WA`,
      lat,
      lon,
      openNow: index % 17 !== 0,
      membershipRequired: false,
      updatedAt: "2026-06-29T00:00:00.000Z",
      source: "api_wa_fuelwatch",
      prices: { U91: Number(price.toFixed(1)), PDL: Number((price + 12).toFixed(1)), DL: Number((price + 6).toFixed(1)) },
      discounts: [],
    };
  });
}

function denseChargers(count) {
  const centre = { lat: -31.9523, lon: 115.8613 };
  return Array.from({ length: count }, (_, index) => {
    const ring = Math.floor(index / 30) + 1;
    const angle = (index % 30) * 12 * (Math.PI / 180);
    const radius = 0.003 * ring;
    const lat = centre.lat + Math.sin(angle) * radius;
    const lon = centre.lon + Math.cos(angle) * radius;
    const power = [7, 22, 50, 75, 150, 350][index % 6];
    const connector = power >= 50 ? "CCS2" : "TYPE2";
    return {
      id: `EV-DENSE-${index}`,
      name: `Density Charger ${index}`,
      operator: ["Chargefox", "Evie", "Tesla", "Council"][index % 4],
      address: `${index} Charger Lane, Perth WA`,
      suburb: "Perth",
      lat,
      lon,
      distanceKm: Number((index / 50 + 0.2).toFixed(1)),
      connectors: [connector],
      connections: [{ connector, connectorLabel: connector, powerKw: power, currentType: power >= 50 ? "DC" : "AC", quantity: 1, operational: true }],
      maxPowerKw: power,
      powerBand: power >= 150 ? "ultra_fast" : power >= 50 ? "dc_fast" : "ac",
      availability: "unknown",
      availabilityLabel: "Listed operational, live bay status unknown",
      pricing: "Check network app",
      updatedAt: "2026-06-29T00:00:00.000Z",
      source: "density_mock",
      provenance: "Charger data from density mock. Confirm availability before driving.",
    };
  });
}

function jsonResponse(payload, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(payload) };
}

function checks(items) {
  return items.filter(([ok]) => !ok).map(([, message]) => message).filter(Boolean);
}

function renderReport(summary, results) {
  return `# Map density and performance stress

Run: ${summary.runId}

## Summary

- App URL: ${summary.appUrl}
- Cases: ${summary.cases}
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Screenshots: ${summary.screenshotDir}

## Metrics

| Case | Ready ms | Fuel markers | Clusters | EV markers | Sheet top | Status |
|---|---:|---:|---:|---:|---:|---|
${results.map((result) => `| ${result.id} | ${result.metrics.readyMs ?? "-"} | ${result.metrics.stationMarkers ?? "-"} | ${result.metrics.clusters ?? "-"} | ${result.metrics.evMarkers ?? "-"} | ${result.metrics.sheetTop ?? "-"} | ${result.status.toUpperCase()} |`).join("\n")}

## Failures

${results.filter((result) => result.failures.length).map((result) => `- ${result.id}: ${result.failures.join("; ")}`).join("\n") || "- None"}

## Brutal read

${summary.failed ? "Map density or performance regressed under heavy mocked provider loads. Fix before trusting dense metro or EV overlay use." : "Map density/performance held under 820 fuel stations and 360 EV chargers across two mobile viewports, with bounded marker rendering and no obvious stale copy or live-availability overclaim."}
`;
}
