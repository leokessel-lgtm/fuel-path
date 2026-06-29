#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../mobile-app/node_modules/playwright");

const appUrl = process.env.FUEL_PATH_MAP_STRESS_URL || "https://fuel-path.vercel.app/";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");
const screenshotDir = path.join(outputDir, `map-interaction-stress-${runId}-screenshots`);
const viewports = [
  { id: "phone", width: 430, height: 900 },
  { id: "small-phone", width: 390, height: 780 },
];

const results = [];
const browser = await launchBrowser();
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) consoleErrors.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
    results.push(await runViewport(page, viewport, consoleErrors));
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((item) => item.status === "failed");
const summary = {
  runId,
  appUrl,
  viewports: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed.map((item) => item.viewport),
  screenshots: results.reduce((total, item) => total + item.screenshots.length, 0),
  screenshotDir,
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `map-interaction-stress-${runId}.json`);
const reportPath = path.join(outputDir, `map-interaction-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));

if (failed.length) throw new Error(`${failed.length}/${results.length} map interaction viewport(s) failed`);

async function runViewport(page, viewport, consoleErrors) {
  const row = { viewport: viewport.id, status: "passed", failures: [], warnings: [], screenshots: [], metrics: {} };
  try {
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    await expectText(page, "Nearby");
    await expectText(page, "SHOW NEARBY");
    await capture(page, row, `${viewport.id}-nearby-default`);

    const defaultState = await mapState(page);
    row.metrics.defaultMarkers = defaultState.stationMarkers;
    row.metrics.defaultClusters = defaultState.clusters;
    row.metrics.defaultSheetTop = defaultState.sheetTop;
    if (defaultState.stationMarkers < 6) row.failures.push(`expected at least 6 fuel station markers, saw ${defaultState.stationMarkers}`);
    if (!defaultState.hasLeafletControls) row.failures.push("Leaflet zoom controls missing");
    if (defaultState.hasFullListText) row.failures.push("Full list text returned to collapsed Nearby sheet");
    if (defaultState.sheetTop < viewport.height * 0.55) row.failures.push(`collapsed Nearby sheet is too high: top=${defaultState.sheetTop}`);

    await clickZoom(page, "+");
    await clickZoom(page, "−");
    await dragMap(page, viewport);
    const afterMapMovement = await mapState(page);
    row.metrics.afterMovementMarkers = afterMapMovement.stationMarkers;
    if (afterMapMovement.stationMarkers < 1) row.warnings.push("map movement left the viewport without visible station markers");

    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);
    await expandList(page);
    await page.waitForTimeout(500);
    const expandedState = await mapState(page);
    row.metrics.expandedSheetTop = expandedState.sheetTop;
    if (expandedState.bodyText.includes("Full list")) row.failures.push("Full list button text returned in expanded Nearby list");
    if (!expandedState.bodyText.includes("Closest") || !expandedState.bodyText.includes("Cheapest") || !expandedState.bodyText.includes("Best value")) {
      row.failures.push("fuel sort controls not fully visible in expanded Nearby list");
    }
    if (expandedState.sheetTop > viewport.height * 0.42) row.failures.push(`expanded Nearby list starts too low for scanability: top=${expandedState.sheetTop}`);
    await capture(page, row, `${viewport.id}-list-expanded`);

    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);
    const firstStation = await firstStationCode(page);
    if (!firstStation) row.failures.push("no station marker with data-station-code found");
    else {
      await clickStation(page, firstStation);
      await page.waitForTimeout(350);
      const selectedState = await mapState(page);
      row.metrics.selectedSheetTop = selectedState.sheetTop;
      if (!selectedState.selectedMarker) row.warnings.push("station marker did not expose a selected marker class");
      if (!selectedState.bodyText.includes("km")) row.failures.push("selected station card missing distance context");
      if (!/Open now|Hours unknown|Closed/i.test(selectedState.bodyText)) row.failures.push("selected station card missing opening-hours context");
      if (selectedState.bodyText.includes("Navigate to this stop")) row.failures.push("large navigate button returned in map-selected station state");
      if (selectedState.bodyText.includes("STATION DETAIL")) row.failures.push("Station detail heading returned in selected station state");
      await capture(page, row, `${viewport.id}-station-selected`);
    }

    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1600);
    await chooseFuelMode(page, "EV charge");
    await page.waitForTimeout(1600);
    const evState = await mapState(page);
    row.metrics.evChargerMarkers = evState.chargerMarkers;
    if (!evState.bodyText.includes("EV charge")) row.failures.push("EV charge mode label missing after selection");
    if (!evState.bodyText.includes("Any") || !evState.bodyText.includes("AC") || !evState.bodyText.includes("Fast")) row.failures.push("EV simplified filter controls missing");
    if (evState.bodyText.includes("? kw")) row.failures.push("EV list still shows unknown power as ? kw");
    if ((evState.bodyText.match(/\bEV\b/g) || []).length > 8) row.warnings.push("EV label appears many times; check for repeated EV pin wording");
    await capture(page, row, `${viewport.id}-ev-mode`);

    const actionableConsoleErrors = consoleErrors.filter((entry) => !/favicon|ResizeObserver|tile.openstreetmap.org|Cannot record touch end without a touch start/i.test(entry));
    if (actionableConsoleErrors.length) row.failures.push(`console/page errors: ${actionableConsoleErrors.slice(0, 3).join(" | ")}`);
  } catch (error) {
    row.failures.push(error instanceof Error ? error.message : String(error));
  }
  if (row.failures.length) row.status = "failed";
  return row;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function mapState(page) {
  return page.evaluate(() => {
    const markerEls = [...document.querySelectorAll("[data-station-code]")];
    const chargerEls = [...document.querySelectorAll(".fuel-path-ev-marker")];
    const sortButtonTops = [...document.querySelectorAll("div, button")]
      .filter((el) => {
        const text = (el.innerText || el.textContent || "").trim();
        const label = el.getAttribute("aria-label") || "";
        return ["Closest", "Cheapest", "Best value", "Any", "AC", "Fast"].includes(text) ||
          label.startsWith("Sort by ") ||
          label === "Expand station list" ||
          label === "Expand charger list";
      })
      .map((el) => Math.round(el.getBoundingClientRect().top))
      .filter((top) => Number.isFinite(top) && top > 0);
    return {
      bodyText: document.body.innerText || "",
      stationMarkers: markerEls.length,
      chargerMarkers: chargerEls.length,
      clusters: document.querySelectorAll(".fuel-path-marker-cluster").length,
      selectedMarker: markerEls.some((el) => String(el.className || "").includes("is-selected")),
      hasLeafletControls: Boolean(document.querySelector(".leaflet-control-zoom-in")) && Boolean(document.querySelector(".leaflet-control-zoom-out")),
      hasFullListText: (document.body.innerText || "").includes("Full list"),
      sheetTop: sortButtonTops.length ? Math.min(...sortButtonTops) : -1,
    };
  });
}

async function firstStationCode(page) {
  return page.evaluate(() => document.querySelector("[data-station-code]")?.getAttribute("data-station-code") || "");
}

async function clickStation(page, stationCode) {
  const clicked = await page.evaluate((code) => {
    const markerBody = document.querySelector(`[data-station-code="${CSS.escape(code)}"]`);
    const target = markerBody?.closest(".leaflet-marker-icon") || markerBody;
    if (target instanceof HTMLElement) {
      target.click();
      return true;
    }
    return false;
  }, stationCode);
  if (!clicked) throw new Error(`could not click station marker ${stationCode}`);
}

async function clickZoom(page, label) {
  const selector = label === "+" ? ".leaflet-control-zoom-in" : ".leaflet-control-zoom-out";
  await page.locator(selector).click({ timeout: 3000 });
  await page.waitForTimeout(250);
}

async function dragMap(page, viewport) {
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.width / 2 - 70, viewport.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(700);
}

async function expandList(page) {
  const button = page.getByRole("button", { name: "Expand station list", exact: true });
  if (await button.count()) await button.click({ timeout: 3000 });
}

async function chooseFuelMode(page, label) {
  await page.getByRole("button", { name: "Choose fuel or EV charging", exact: true }).click({ timeout: 3000 });
  await page.getByText(label, { exact: true }).click({ timeout: 3000 });
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 8000 });
}

async function capture(page, row, name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const filePath = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  row.screenshots.push(filePath);
}

function renderReport(summary, results) {
  return `# Map interaction stress

Run: ${summary.runId}

## Summary

- Viewports: ${summary.viewports}
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Screenshots: ${summary.screenshots}

## Failures

${results.filter((item) => item.failures.length).map((item) => `- ${item.viewport}: ${item.failures.join("; ")}`).join("\n") || "- None"}

## Warnings

${results.filter((item) => item.warnings.length).map((item) => `- ${item.viewport}: ${item.warnings.join("; ")}`).join("\n") || "- None"}

## Metrics

${results.map((item) => `- ${item.viewport}: ${JSON.stringify(item.metrics)}`).join("\n")}
`;
}
