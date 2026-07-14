#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../mobile-app/node_modules/playwright");

const appUrl = process.env.FUEL_PATH_FAILURE_UX_URL || "https://fuel-path.vercel.app/";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");
const screenshotDir = path.join(outputDir, `frontend-failure-state-stress-${runId}-screenshots`);
const viewport = { width: 430, height: 900 };
const scenarioTimeoutMs = Number(process.env.FUEL_PATH_FAILURE_STATE_SCENARIO_TIMEOUT_MS || 25000);

const scenarios = [
  {
    id: "nearby-fuel-empty-unsupported-region",
    setup: async (page) => {
      await mockStatus(page);
      await page.route("**/api/stations?**", async (route) => route.fulfill(jsonResponse({
        stations: [],
        context: {
          source: "live",
          provider: "unsupported_region",
          warning: "Live prices are not available for this area yet.",
          stationCount: 0,
          degraded: true,
        },
      })));
    },
    run: async (page) => {
      await page.goto(appUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1800);
    },
    expect: async (page) => assertVisibleState(page, ["No priced stations found", "Live prices are not available for this area yet."], ["Could not load stations", "No live fuel provider"]),
  },
  {
    id: "nearby-fuel-provider-error",
    setup: async (page) => {
      await mockStatus(page);
      await page.route("**/api/stations?**", async (route) => route.fulfill(jsonResponse({ error: "Provider returned 503: upstream timeout" }, 503)));
    },
    run: async (page) => {
      await page.goto(appUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1800);
    },
    expect: async (page) => assertVisibleState(page, ["Could not load stations", "Prices for this fuel are not available here right now"], ["Provider returned", "upstream timeout", "No priced stations found"]),
  },
  {
    id: "ev-empty-directory-results",
    setup: async (page) => {
      await mockStatus(page);
      await page.route("**/api/stations?**", async (route) => route.fulfill(jsonResponse({ stations: [], context: { warning: "Fuel hidden for EV test." } })));
      await page.route("**/api/ev-chargers?**", async (route) => route.fulfill(jsonResponse({
        chargers: [],
        context: {
          provider: "api_ninjas",
          warning: "Charger directory coverage is patchy in this area. Confirm before driving.",
          degraded: false,
          provenance: { realTimeAvailability: false },
        },
      })));
    },
    run: async (page) => {
      await page.goto(appUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      await chooseFuelMode(page, "EV charge");
      await page.waitForTimeout(1200);
    },
    expect: async (page) => assertVisibleState(page, ["No matching chargers", "Wider area"], ["? kw", "available now", "Live bay"]),
  },
  {
    id: "ev-provider-error-expanded-list",
    setup: async (page) => {
      await mockStatus(page);
      await page.route("**/api/stations?**", async (route) => route.fulfill(jsonResponse({ stations: [], context: { warning: "Fuel hidden for EV test." } })));
      await page.route("**/api/ev-chargers?**", async (route) => route.fulfill(jsonResponse({ error: "EV charger provider is temporarily unavailable." }, 503)));
    },
    run: async (page) => {
      await page.goto(appUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      await chooseFuelMode(page, "EV charge");
      await page.waitForTimeout(800);
      await maybeClick(page.getByRole("button", { name: "Show charger list", exact: true }));
      await page.waitForTimeout(600);
    },
    expect: async (page) => assertVisibleState(page, ["We could not load charger options right now"], ["EV charger provider", "No matching chargers", "available now", "node:internal"]),
  },
  {
    id: "plan-geocode-provider-failure",
    setup: async (page) => {
      await mockStatus(page);
      await page.route("**/api/geocode", async (route) => route.fulfill(jsonResponse({ error: "nominatim lookup timed out" }, 503)));
    },
    run: async (page) => {
      await page.goto(appUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);
      await clickBottomTab(page, "Plan");
      await page.getByRole("textbox", { name: "From", exact: true }).fill("Sydney NSW");
      await page.getByRole("textbox", { name: "To", exact: true }).fill("Melbourne CBD VIC");
      await page.getByRole("button", { name: "Plan route", exact: true }).click();
      await page.waitForTimeout(1200);
    },
    expect: async (page) => assertVisibleState(page, ["We could not find that address"], ["nominatim lookup timed out", "node:internal", "TypeError"]),
  },
  {
    id: "plan-route-provider-failure",
    setup: async (page) => {
      await mockStatus(page);
      await mockGeocode(page);
      await page.route("**/api/score", async (route) => route.fulfill(jsonResponse({ error: "Route engine temporarily unavailable." }, 503)));
    },
    run: async (page) => {
      await planSimpleRoute(page);
    },
    expect: async (page) => assertVisibleState(page, ["We could not plan that drive right now"], ["Route engine", "node:internal", "Cannot read", "Suggested stop"]),
  },
  {
    id: "plan-score-empty-results",
    setup: async (page) => {
      await mockStatus(page);
      await mockGeocode(page);
      await mockRoute(page);
      await page.route("**/api/score", async (route) => route.fulfill(jsonResponse({
        recommendations: [],
        contextStations: [],
        context: {
          warning: "No useful fuel stop was found on this route. Try a different fuel, widen the trip, or check Nearby fuel.",
          stationCount: 0,
          source: "live",
          provider: "live",
          decisionSummary: { economics: { comparisonCpl: 0, detourMinutes: 0 } },
        },
      })));
    },
    run: async (page) => {
      await planSimpleRoute(page);
    },
    expect: async (page) => assertVisibleState(page, ["No fuel stops found", "No useful fuel stop was found"], ["Route found, but no eligible stations", "Suggested fuel stops", "Best price by", "undefined"]),
  },
];

const browser = await launchBrowser();
const results = [];
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleMessages = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) consoleMessages.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleMessages.push(`pageerror: ${error.message}`));
    results.push(await runScenario(page, scenario, consoleMessages));
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => result.status === "failed");
const summary = {
  runId,
  appUrl,
  scenarios: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed.map((result) => result.id),
  screenshotDir,
};
fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `frontend-failure-state-stress-${runId}.json`);
const reportPath = path.join(outputDir, `frontend-failure-state-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));
if (failed.length) throw new Error(`${failed.length}/${results.length} frontend failure-state scenario(s) failed`);

async function runScenario(page, scenario, consoleMessages) {
  const started = Date.now();
  const row = { id: scenario.id, status: "passed", latencyMs: 0, failures: [], warnings: [], screenshot: "", textSample: "" };
  try {
    await withTimeout((async () => {
      await scenario.setup(page);
      await scenario.run(page);
      row.failures.push(...await scenario.expect(page));
      const actionableConsole = consoleMessages.filter((entry) => !/favicon|File not found|ResizeObserver|tile.openstreetmap.org|Cannot record touch end without a touch start|Failed to load resource: (?:the server responded with a status of 503|net::ERR_NAME_NOT_RESOLVED)/i.test(entry));
      if (actionableConsole.length) row.failures.push(`console/page errors: ${actionableConsole.slice(0, 3).join(" | ")}`);
      row.failures.push(...await assertNoRawFailureLeak(page));
      row.screenshot = await capture(page, scenario.id);
      row.textSample = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 700);
    })(), scenarioTimeoutMs, `${scenario.id} exceeded ${scenarioTimeoutMs}ms failure-state timeout`);
  } catch (error) {
    row.failures.push(error instanceof Error ? error.message : String(error));
    try {
      row.screenshot = await capture(page, `${scenario.id}-error`);
      row.textSample = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 700);
    } catch {}
  }
  row.latencyMs = Date.now() - started;
  if (row.failures.length) row.status = "failed";
  console.log(`${row.status === "passed" ? "OK" : "FAIL"} ${scenario.id}`);
  return row;
}

async function withTimeout(promise, timeoutMs, message) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function mockStatus(page) {
  await page.route("**/api/status", async (route) => route.fulfill(jsonResponse({
    defaultSource: "live",
    credentialsConfigured: true,
    cacheSeconds: 300,
    fuelProviders: { selection: "live", capabilityLabels: [], capabilitySummary: {}, capabilities: [] },
    evCharging: {
      provider: "api_ninjas",
      configured: true,
      capability: "directory",
      defaultProvider: "api_ninjas",
      providerSelection: "api_ninjas",
      apiNinjasConfigured: true,
      openChargeMapConfigured: false,
      realTimeAvailability: false,
      liveAvailabilityClaimsAllowed: false,
      coverage: "directory",
      warning: "Directory data only.",
    },
    geocoding: { activeProvider: "fuel_path_gnaf", activeMode: "hosted", recommendedProductionProvider: "fuel_path_gnaf", requestedProvider: "auto", backendProxyRequired: false, sessionTokenRequired: false, googlePlacesConfigured: false, mapboxConfigured: false },
  })));
}

async function mockGeocode(page) {
  await page.route("**/api/geocode**", async (route) => {
    const body = route.request().postDataJSON?.() || {};
    const query = String(body.q || "").toLowerCase();
    const isFrom = query.includes("sydney") || query.includes("sylvania") || query.includes("george");
    const point = isFrom
      ? { lat: -33.8688, lon: 151.2093, label: "Sydney NSW", provider: "fuel_path_gnaf", type: "address", matchType: "exact_address", sourceLabel: "Exact address" }
      : { lat: -37.8136, lon: 144.9631, label: "Melbourne VIC", provider: "fuel_path_gnaf", type: "address", matchType: "exact_address", sourceLabel: "Exact address" };
    await route.fulfill(jsonResponse({ lookupStatus: "ok", location: point, suggestions: [point] }));
  });
}

async function mockRoute(page) {
  await page.route("**/api/route?**", async (route) => route.fulfill(jsonResponse({
    provider: "mock_route",
    distanceKm: 859,
    durationMin: 540,
    points: [
      { lat: -33.8688, lon: 151.2093, label: "Sydney NSW" },
      { lat: -35.2809, lon: 149.13, label: "Canberra ACT" },
      { lat: -37.8136, lon: 144.9631, label: "Melbourne VIC" },
    ],
  })));
}

async function planSimpleRoute(page) {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await clickBottomTab(page, "Plan");
  await page.getByRole("textbox", { name: "From", exact: true }).fill("Sydney NSW");
  await page.getByRole("textbox", { name: "To", exact: true }).fill("Melbourne VIC");
  await page.getByRole("button", { name: "Plan route", exact: true }).click();
  await page.waitForTimeout(1600);
}

async function clickBottomTab(page, label) {
  const target = page.getByText(label, { exact: true }).last();
  await target.click({ timeout: 5000 });
  await page.waitForTimeout(350);
}

async function chooseFuelMode(page, label) {
  await page.getByRole("button", { name: "Choose fuel or EV charging", exact: true }).click({ timeout: 4000 });
  await page.getByText(label, { exact: true }).click({ timeout: 4000 });
}

async function maybeClick(locator) {
  if (await locator.count()) await locator.click({ timeout: 4000 });
}

async function assertVisibleState(page, requiredTexts, forbiddenTexts) {
  const bodyText = await page.locator("body").innerText();
  return [
    ...requiredTexts.filter((text) => !bodyText.includes(text)).map((text) => `missing visible text: ${text}`),
    ...forbiddenTexts.filter((text) => bodyText.includes(text)).map((text) => `forbidden visible text present: ${text}`),
  ];
}

async function assertNoRawFailureLeak(page) {
  const bodyText = await page.locator("body").innerText();
  const patterns = [/node:internal/i, /webpack/i, /\.tsx?:\d+/i, /TypeError:/i, /ReferenceError:/i, /SyntaxError:/i, /\bat\s+\w+\s*\(/i];
  return patterns.filter((pattern) => pattern.test(bodyText)).map((pattern) => `raw failure leak matched ${pattern}`);
}

async function capture(page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const filePath = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

function jsonResponse(payload, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  };
}

function renderReport(summary, results) {
  return `# Frontend failure-state UX stress

Run: ${summary.runId}

## Summary

- App URL: ${summary.appUrl}
- Scenarios: ${summary.scenarios}
- Passed: ${summary.passed}
- Failed: ${summary.failed}
- Screenshots: ${summary.screenshotDir}

## Failures

${results.filter((result) => result.failures.length).map((result) => `- ${result.id}: ${result.failures.join("; ")}`).join("\n") || "- None"}

## Scenario text samples

${results.map((result) => `- ${result.id}: ${result.textSample}`).join("\n")}

## Brutal read

${summary.failed ? "Failure-state UX is still user-hostile in at least one mocked outage/empty state. Fix before calling the app resilient." : "Failure-state UX held across mocked empty, unavailable, geocode, route and score failures. Remaining risk is visual polish and provider-specific real outage copy, not catastrophic blank/error states."}
`;
}
