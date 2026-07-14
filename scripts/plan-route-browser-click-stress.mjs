import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("../mobile-app/node_modules/playwright");

const appUrl = process.env.FUEL_PATH_PLAN_BROWSER_STRESS_URL || "https://fuel-path.vercel.app/";
const pairCount = Number(process.env.FUEL_PATH_PLAN_BROWSER_STRESS_PAIRS || 30);
const clickCount = Number(process.env.FUEL_PATH_PLAN_BROWSER_STRESS_CLICK_STATIONS || 3);
const caseTimeoutMs = Number(process.env.FUEL_PATH_PLAN_BROWSER_STRESS_CASE_TIMEOUT_MS || 24000);
const resultTimeoutMs = Number(process.env.FUEL_PATH_PLAN_BROWSER_STRESS_RESULT_TIMEOUT_MS || 24000);
const snapshotCount = Number(process.env.FUEL_PATH_PLAN_BROWSER_STRESS_SNAPSHOTS || 0);
const pairFilter = String(process.env.FUEL_PATH_PLAN_BROWSER_STRESS_PAIR_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");
const screenshotDir = path.join(outputDir, `plan-route-browser-click-stress-${runId}-screenshots`);

const endpoints = [
  ep("syd-cbd", "Sydney CBD NSW", -33.8688, 151.2093, "NSW", "capital"),
  ep("sylvania", "Sylvania NSW 2224", -34.0128, 151.1033, "NSW", "suburb"),
  ep("newcastle", "Newcastle NSW", -32.9283, 151.7817, "NSW", "regional"),
  ep("dubbo", "Dubbo NSW", -32.2429, 148.6048, "NSW", "regional"),
  ep("moree", "Moree NSW", -29.4639, 149.843, "NSW", "remote"),
  ep("canberra", "Canberra ACT", -35.2809, 149.13, "ACT", "capital"),
  ep("mel-cbd", "Melbourne CBD VIC", -37.8136, 144.9631, "VIC", "capital"),
  ep("ballarat", "Ballarat VIC", -37.5622, 143.8503, "VIC", "regional"),
  ep("brisbane", "Brisbane CBD QLD", -27.4698, 153.0251, "QLD", "capital"),
  ep("longreach", "Longreach QLD", -23.44, 144.25, "QLD", "remote"),
  ep("perth", "Perth CBD WA", -31.9523, 115.8613, "WA", "capital"),
  ep("broome", "Broome WA", -17.9644, 122.2304, "WA", "remote"),
  ep("adelaide", "Adelaide CBD SA", -34.9285, 138.6007, "SA", "capital"),
  ep("coober-pedy", "Coober Pedy SA", -29.0139, 134.7544, "SA", "remote"),
  ep("hobart", "Hobart TAS", -42.8821, 147.3272, "TAS", "capital"),
  ep("strahan", "Strahan TAS", -42.1584, 145.355, "TAS", "remote"),
  ep("darwin", "Darwin NT", -12.4634, 130.8456, "NT", "capital"),
  ep("alice", "Alice Springs NT", -23.698, 133.8807, "NT", "remote"),
];

const builtPairs = buildRoutePairs(endpoints, pairCount);
const pairs = pairFilter.length
  ? builtPairs.filter((pair) => pairFilter.includes(`${pair.from.id}->${pair.to.id}`))
  : builtPairs;
if (pairFilter.length && pairs.length !== pairFilter.length) {
  throw new Error(`Found ${pairs.length}/${pairFilter.length} requested route-pair regressions`);
}
const results = [];
const apiCalls = [];
let currentPair = pairs[0];
let currentCaseIndex = 0;
let currentScore = scorePayload(currentPair, currentCaseIndex);

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}
const context = await browser.newContext({ viewport: { width: 430, height: 900 } });
const page = await context.newPage();
await installMocks(page);

try {
  for (const [index, pair] of pairs.entries()) {
    currentPair = pair;
    currentCaseIndex = index;
    currentScore = scorePayload(pair, index);
    const result = await withTimeout(
      runBrowserCase(page, pair, index),
      caseTimeoutMs,
      `case timeout after ${caseTimeoutMs}ms`,
    ).catch(async (error) => {
      const failureState = await captureFailureState(page, `case-${String(index + 1).padStart(3, "0")}-failure`);
      return {
        id: `${pair.from.id}->${pair.to.id}`,
        index: index + 1,
        from: pair.from,
        to: pair.to,
        status: "failed",
        failures: [error instanceof Error ? error.message : String(error)],
        screenshots: failureState.screenshot ? [failureState.screenshot] : [],
        visibleTextExcerpt: failureState.visibleTextExcerpt,
        stationClicks: [],
      };
    });
    results.push(result);
    console.log(`${result.status === "passed" ? "OK" : "FAIL"} ${result.index}/${pairs.length} ${result.id}`);
  }
} finally {
  if (results.length) writeRunReport({ preClose: true });
  await browser.close();
}

const { failed, summary } = writeRunReport();

if (failed.length) throw new Error(`${failed.length}/${results.length} browser route cases failed`);
if (summary.stationClicksFailed) throw new Error(`${summary.stationClicksFailed}/${summary.stationClicksRequested} station clicks failed`);

function writeRunReport({ preClose = false } = {}) {
  const failed = results.filter((item) => item.status === "failed");
  const summary = {
    runId,
    appUrl,
    routePairs: pairs.length,
    passed: results.length - failed.length,
    failed: failed.length,
    stationClicksRequested: pairs.length * clickCount,
    stationClicksPassed: results.reduce((sum, item) => sum + item.stationClicks.filter((click) => click.ok).length, 0),
    stationClicksFailed: results.reduce((sum, item) => sum + item.stationClicks.filter((click) => !click.ok).length, 0),
    screenshots: results.reduce((sum, item) => sum + (item.screenshots || []).length, 0),
    screenshotDir: undefined,
    stateCoverage: countBy(results.flatMap((item) => [item.from.state, item.to.state])),
    typeCoverage: countBy(results.flatMap((item) => [item.from.type, item.to.type])),
    apiCalls: countBy(apiCalls),
  };
  summary.screenshotDir = summary.screenshots > 0 ? screenshotDir : undefined;

  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `plan-route-browser-click-stress-${runId}.json`);
  const reportPath = path.join(outputDir, `plan-route-browser-click-stress-${runId}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
  fs.writeFileSync(reportPath, renderReport(summary, results));
  console.log(JSON.stringify({ ...summary, jsonPath, reportPath, preClose }, null, 2));
  return { failed, summary, jsonPath, reportPath };
}

async function runBrowserCase(activePage, pair, index) {
  const row = {
    id: `${pair.from.id}->${pair.to.id}`,
    index: index + 1,
    from: pair.from,
    to: pair.to,
    status: "passed",
    failures: [],
    screenshots: [],
    stationClicks: [],
  };
  try {
    await activePage.goto(appUrl, { waitUntil: "domcontentloaded" });
    await openPlanTab(activePage);
    await fillPlanField(activePage, 0, pair.from.label);
    await chooseSuggestion(activePage, pair.from.label);
    await fillPlanField(activePage, 1, pair.to.label);
    await chooseSuggestion(activePage, pair.to.label);
    await clickText(activePage, "Plan route");
    await waitForPlanResult(activePage);
    if (index < snapshotCount) {
      row.screenshots.push(await captureScreenshot(activePage, `case-${String(index + 1).padStart(3, "0")}-recommendation`));
    }

    const recommendationState = await extractVisibleState(activePage);
    if (!recommendationState.hasBestStopSummary) row.failures.push("Plan best-stop summary missing");
    if (recommendationState.hasBadZeroSavingsDetour) row.failures.push("visible recommendation shows zero best-price lead with savings-detour label");
    if (!recommendationState.hasWhyAction) row.failures.push("Plan evidence action missing");
    if (recommendationState.hasSuggestedFuelStops) row.failures.push("suggested fuel stops visible in Plan result");
    if (recommendationState.hasLargeNavigateButton) row.failures.push("large Navigate to this stop button visible");

    for (const [stationIndex, station] of currentScore.recommendations.slice(1, 1 + clickCount).entries()) {
      const clickResult = await clickStationAndCheck(activePage, station);
      row.stationClicks.push(clickResult);
      if (index < snapshotCount && stationIndex === 0 && clickResult.ok) {
        row.screenshots.push(await captureScreenshot(activePage, `case-${String(index + 1).padStart(3, "0")}-selected-station`));
      }
    }
  } catch (error) {
    row.status = "failed";
    row.failures.push(error instanceof Error ? error.message : String(error));
  }
  if (row.failures.length || row.stationClicks.some((item) => !item.ok)) row.status = "failed";
  return row;
}

async function captureScreenshot(activePage, name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const filePath = path.join(screenshotDir, `${name}.png`);
  await activePage.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

async function captureFailureState(activePage, name) {
  const state = { screenshot: "", visibleTextExcerpt: "" };
  try {
    state.screenshot = await captureScreenshot(activePage, name);
  } catch {}
  try {
    const text = await activePage.evaluate(() => document.body?.innerText || "");
    state.visibleTextExcerpt = text.replace(/\s+/g, " ").trim().slice(0, 1000);
  } catch {}
  return state;
}

async function clickStationAndCheck(activePage, station) {
  const check = { stationCode: station.station.stationCode, stationName: station.station.name, ok: true, errors: [] };
  try {
    await clickMarkerByStationCode(activePage, station.station.stationCode);
    await activePage.waitForTimeout(250);
    const state = await extractVisibleState(activePage);
    if (!state.text.includes(station.station.name)) check.errors.push("station name did not render after marker click");
    if (state.text.includes("STATION DETAIL")) check.errors.push("Station detail heading returned");
    if (state.hasLargeNavigateButton) check.errors.push("large Navigate to this stop button returned");
    if (state.text.includes(`${station.fuel} your adjusted price`)) check.errors.push("adjusted-price summary line returned");
    if (!state.text.includes("↗")) check.errors.push("arrow CTA missing");
    if (!state.text.includes(station.adjustedCpl.toFixed(1))) check.errors.push("selected station price missing");
  } catch (error) {
    check.errors.push(error instanceof Error ? error.message : String(error));
  }
  check.ok = check.errors.length === 0;
  return check;
}

async function installMocks(activePage) {
  await activePage.route("**/api/geocode**", async (route) => {
    apiCalls.push("geocode");
    const url = new URL(route.request().url());
    const body = route.request().method() === "POST" ? parseJson(route.request().postData() || "{}") : {};
    const q = normalise(body.q || url.searchParams.get("q") || "");
    const match = endpoints.find((item) => normalise(item.label) === q) || currentPair.from;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "browser_click_stress", lookupStatus: "ok", location: geocodeLocation(match), suggestions: [geocodeLocation(match)] }) });
  });
  await activePage.route("**/api/route?**", async (route) => {
    apiCalls.push("route");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(routePayload(currentPair)) });
  });
  await activePage.route("**/api/score", async (route) => {
    apiCalls.push("score");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        route: routePayload(currentPair),
        score: currentScore,
      }),
    });
  });
}

async function fillPlanField(activePage, index, value) {
  const label = index === 0 ? "From" : "To";
  const input = activePage.getByLabel(label, { exact: true });
  if (await input.count() !== 1) throw new Error(`expected one ${label} plan input`);
  await input.fill(value);
  await activePage.waitForTimeout(250);
}

async function openPlanTab(activePage) {
  const planTab = activePage.getByRole("tab", { name: "Plan", exact: true });
  await planTab.waitFor({ state: "visible", timeout: 7000 });
  if (await planTab.count() !== 1) throw new Error("expected one Plan navigation tab");
  await planTab.click({ timeout: 3000 });
  await Promise.all([
    activePage.getByLabel("From", { exact: true }).waitFor({ state: "visible", timeout: 7000 }),
    activePage.getByLabel("To", { exact: true }).waitFor({ state: "visible", timeout: 7000 }),
  ]);
}

async function chooseSuggestion(activePage, label) {
  const exact = activePage.getByText(label, { exact: true });
  if (await exact.count()) {
    await exact.first().click({ timeout: 1500 }).catch(() => {});
    await activePage.waitForTimeout(150);
  }
}

async function clickText(activePage, text) {
  const target = activePage.getByText(text, { exact: true });
  const count = await target.count();
  if (!count) throw new Error(`could not find text: ${text}`);
  await target.first().click({ timeout: 3000 });
}

async function waitForText(activePage, text) {
  await activePage.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 7000 });
}

async function waitForPlanResult(activePage) {
  await activePage.getByText("Why?", { exact: true }).first().waitFor({ state: "visible", timeout: resultTimeoutMs });
  await activePage.getByText("Best stop for this trip", { exact: false }).first().waitFor({ state: "visible", timeout: resultTimeoutMs });
}

async function clickMarkerByStationCode(activePage, stationCode) {
  const clicked = await activePage.evaluate((targetStationCode) => {
    const markerBody = document.querySelector(`[data-station-code="${CSS.escape(targetStationCode)}"]`);
    const target = markerBody?.closest(".leaflet-marker-icon") || markerBody;
    if (target instanceof HTMLElement) {
      target.click();
      return true;
    }
    return false;
  }, stationCode);
  if (!clicked) throw new Error(`could not click marker station ${stationCode}`);
}

async function extractVisibleState(activePage) {
  return activePage.evaluate(() => {
    const text = document.body?.innerText || "";
    return {
      text,
      hasBestStopSummary: text.includes("Best stop for this trip"),
      hasBadZeroSavingsDetour: text.includes("Best price by 0.0 c/L") && /savings detour/i.test(text),
      hasWhyAction: text.includes("Why?"),
      hasSuggestedFuelStops: text.includes("Suggested fuel stops"),
      hasLargeNavigateButton: text.includes("Navigate to this stop"),
    };
  });
}

function scorePayload(pair, index) {
  const route = routePayload(pair);
  const prices = [156.9, 160.9, 165.9, 171.9, 178.9].map((price) => price + (index % 4));
  const stations = prices.map((price, stationIndex) => scoreCandidate(pair, index, stationIndex, price));
  return {
    context: {
      source: "browser_click_stress",
      provider: "browser_click_stress",
      capability: "live",
      fuel: "PDL",
      routeDistanceKm: route.distanceKm,
      baselineCpl: 176.9,
      eligibleCandidates: stations.length,
      minSavingDollars: 1.5,
      maxDetourMinutes: 30,
      timingAdvice: { action: "fill_today_with_detour", visible: true, label: "Small savings detour", reason: "Mock route stress recommendation." },
      decisionSummary: {
        action: "fill_now",
        label: "Small savings detour",
        stationCode: stations[0].station.stationCode,
        stationName: stations[0].station.name,
        economics: {
          baselineCpl: 176.9,
          comparisonCpl: stations[1].adjustedCpl,
          comparisonKind: "next_best_viable",
          pumpCpl: stations[0].pumpCpl,
          adjustedCpl: stations[0].adjustedCpl,
          detourMinutes: stations[0].detourMinutes,
        },
        alternatives: [],
        trust: { source: "browser_click_stress", sourceType: "official_live", officialLive: true },
      },
      regionCapabilities: [],
    },
    recommendations: stations,
    contextStations: [],
  };
}

function scoreCandidate(pair, index, stationIndex, price) {
  const pointOnRoute = interpolate(pair.from, pair.to, 0.22 + stationIndex * 0.13);
  const adjustedCpl = Number(price.toFixed(1));
  return {
    station: {
      stationCode: `${pair.from.id}-${pair.to.id}-${index}-${stationIndex}`,
      name: `${["Budget", "Ampol", "Metro", "Shell", "EG Ampol"][stationIndex]} ${pair.to.label.split(" ")[0]} ${stationIndex + 1}`,
      brand: ["Budget", "Ampol", "Metro", "Shell", "EG Ampol"][stationIndex],
      suburb: pair.to.label.split(" ")[0],
      address: `${100 + index + stationIndex} Browser Stress Road, ${pair.to.label}`,
      lat: pointOnRoute.lat + stationIndex * 0.002,
      lon: pointOnRoute.lon + stationIndex * 0.002,
      openNow: true,
      updatedAt: "2026-06-28T08:00:00.000Z",
      source: "browser_click_stress",
      prices: { PDL: adjustedCpl },
      discounts: [],
      provenance: { source: "browser_click_stress", sourceType: "official_live", officialLive: true, requestedFuelAvailable: true },
    },
    fuel: "PDL",
    pumpCpl: adjustedCpl,
    adjustedCpl,
    discountCpl: 0,
    detourKm: Number((stationIndex * 0.3 + 0.2).toFixed(2)),
    detourMinutes: Number((stationIndex * 0.7 + 0.4).toFixed(1)),
    detourFuelLitres: 0.1,
    detourCost: 0.1,
    smartDetourLimitMinutes: 30,
    timeCost: 0.1,
    netAfterDetourAndTimeCost: 1,
    fillLitres: 40,
    netSaving: 1,
    reachable: true,
    matchesDecisionRule: true,
    openNow: true,
    eligible: true,
    score: 100 - stationIndex,
    warnings: [],
    distanceKm: Number((stationIndex * 0.4 + 0.2).toFixed(1)),
    distanceToRouteKm: Number((stationIndex * 0.4 + 0.2).toFixed(1)),
    distanceAlongRouteKm: Number((stationIndex * 3 + 2).toFixed(1)),
  };
}

function routePayload(pair) {
  const points = [point(pair.from), interpolate(pair.from, pair.to, 0.5), point(pair.to)];
  return { provider: "browser_click_stress", distanceKm: Number(distanceKm(pair.from, pair.to).toFixed(1)), durationMin: 35, points };
}

function geocodeLocation(endpoint) {
  return { label: endpoint.label, lat: endpoint.lat, lon: endpoint.lon, state: endpoint.state, provider: "browser_click_stress" };
}

function buildRoutePairs(items, count) {
  const pairs = [];
  for (let offset = 1; offset < items.length && pairs.length < count; offset += 1) {
    for (let index = 0; index < items.length && pairs.length < count; index += 1) {
      const from = items[index];
      const to = items[(index + offset) % items.length];
      if (from.id !== to.id) pairs.push({ from, to });
    }
  }
  if (pairs.length < count) {
    throw new Error(`Only built ${pairs.length} unique route pairs from ${items.length} endpoints, requested ${count}`);
  }
  return pairs;
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function ep(id, label, lat, lon, state, type) { return { id, label, lat, lon, state, type }; }
function point(endpoint) { return { lat: endpoint.lat, lon: endpoint.lon, label: endpoint.label }; }
function interpolate(from, to, ratio) { return { lat: round(from.lat + (to.lat - from.lat) * ratio, 6), lon: round(from.lon + (to.lon - from.lon) * ratio, 6), label: `${from.label} to ${to.label}` }; }
function distanceKm(a, b) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}
function normalise(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
function round(value, decimals = 0) { const factor = 10 ** decimals; return Math.round(Number(value) * factor) / factor; }
function countBy(values) { return values.reduce((counts, value) => { counts[value] = (counts[value] || 0) + 1; return counts; }, {}); }

function renderReport(summary, results) {
  const failedCases = results.filter((item) => item.status === "failed").map(renderFailedCase).join("\n") || "- None";
  return `# Plan route browser click stress\n\nRun: ${summary.runId}\n\n## Summary\n\n- Route pairs: ${summary.routePairs}\n- Passed: ${summary.passed}\n- Failed: ${summary.failed}\n- Station clicks requested: ${summary.stationClicksRequested}\n- Station clicks passed: ${summary.stationClicksPassed}\n- Station clicks failed: ${summary.stationClicksFailed}\n- Screenshots captured: ${summary.screenshots}${summary.screenshotDir ? `\n- Screenshot folder: ${summary.screenshotDir}` : ""}\n\n## Failed cases\n\n${failedCases}\n`;
}

function renderFailedCase(item) {
  const clickFailures = item.stationClicks.filter((click) => !click.ok).map((click) => `${click.stationName}: ${click.errors.join(", ")}`).join("; ");
  const screenshotLine = item.screenshots?.length ? `\n  Screenshot: ${item.screenshots.join(", ")}` : "";
  const textLine = item.visibleTextExcerpt ? `\n  Visible text: ${item.visibleTextExcerpt}` : "";
  return `- ${item.id}: ${item.failures.join("; ")} ${clickFailures}${screenshotLine}${textLine}`;
}
