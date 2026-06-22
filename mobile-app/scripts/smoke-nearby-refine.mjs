import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, "..");
const projectRoot = path.resolve(mobileRoot, "..");
const appUrl = process.env.FUEL_PATH_NEARBY_SMOKE_URL || "http://127.0.0.1:8081/";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(projectRoot, "tmp");
const timeoutMs = Number(process.env.FUEL_PATH_NEARBY_SMOKE_TIMEOUT_MS || 9000);
const buildingRefineSuggestion = {
  label: "Cairns Central Shopping Centre, 1-21 Mcleod Street, Cairns City QLD 4870",
  displayTitle: "Cairns Central Shopping Centre",
  displaySubtitle: "1-21 Mcleod Street, Cairns City QLD 4870",
  lat: -16.925,
  lon: 145.776,
  provider: "fuel_path_gnaf",
  type: "address",
  matchType: "building_refine",
  refineRequired: true,
  suggestionType: "base_address",
};

const results = [];
const apiCalls = [];

await assertAppReachable(appUrl);
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
await installApiMocks(page);

try {
  await recordCase("Nearby building refine rows do not move search centre", async () => {
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.getByText("Nearby", { exact: true }).click();
    await page.getByLabel("Nearby location", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
    await page.getByLabel("Nearby location", { exact: true }).fill("Cairns Central Shopping Centre Shop 22");
    const suggestion = page.getByText("Cairns Central Shopping Centre", { exact: true }).first();
    await suggestion.waitFor({ state: "visible", timeout: timeoutMs });
    await assertText("Building");
    const stationCallsBeforeSelection = apiCalls.filter((call) => call === "stations").length;
    await suggestion.click();
    await assertText("Choose or type the exact unit before searching nearby.");
    const inputValue = await page.getByLabel("Nearby location", { exact: true }).inputValue();
    assert(
      inputValue === "Cairns Central Shopping Centre Shop 22",
      `expected query to remain for refinement, got ${inputValue}`,
    );
    assert(
      apiCalls.filter((call) => call === "stations").length === stationCallsBeforeSelection,
      `expected no station reload after refine selection, got ${apiCalls.filter((call) => call === "stations").length - stationCallsBeforeSelection} extra station calls`,
    );
  });
} finally {
  await page.close();
  await context.close();
  await browser.close();
}

const summary = {
  runId,
  appUrl,
  cases: results.length,
  passed: results.filter((result) => result.status === "passed").length,
  failed: results.filter((result) => result.status === "failed").length,
  apiCalls: apiCalls.reduce((counts, call) => {
    counts[call] = (counts[call] || 0) + 1;
    return counts;
  }, {}),
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `nearby-refine-browser-smoke-${runId}.json`);
const reportPath = path.join(outputDir, `nearby-refine-browser-smoke-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));

console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));

if (summary.failed) {
  throw new Error(`${summary.failed}/${summary.cases} Nearby refine browser smoke cases failed`);
}

async function installApiMocks(activePage) {
  await activePage.route("**/api/geocode?**", async (route) => {
    apiCalls.push("geocode");
    const url = new URL(route.request().url());
    const query = normalise(url.searchParams.get("q") || "");
    const suggestions = query === "cairns central shopping centre shop 22" ? [buildingRefineSuggestion] : [];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: suggestions[0]?.provider || "mock",
        lookupStatus: suggestions.length ? "ok" : "no_match",
        location: suggestions[0] || null,
        suggestions,
      }),
    });
  });

  await activePage.route("**/api/stations?**", async (route) => {
    apiCalls.push("stations");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        context: {
          source: "browser_smoke_mock",
          provider: "browser_smoke_mock",
          fuel: "E10",
        },
        stations: [
          {
            stationCode: "nearby-smoke-station",
            name: "Metro Cairns",
            brand: "Metro Fuel",
            suburb: "Cairns City",
            address: "1 Mcleod Street, Cairns City QLD 4870",
            lat: -16.924,
            lon: 145.775,
            openNow: true,
            updatedAt: "2026-06-22T08:00:00+10:00",
            source: "browser_smoke_mock",
            prices: {
              E10: 179.9,
              U91: 184.9,
            },
          },
        ],
      }),
    });
  });
}

async function assertAppReachable(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Nearby refine smoke could not reach ${url}. Start the Expo web app first: cd mobile-app && npm run web -- --port 8081. Original error: ${reason}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function recordCase(name, callback) {
  const started = Date.now();
  try {
    await callback();
    results.push({ name, status: "passed", elapsedMs: Date.now() - started });
    console.log(`OK ${name}`);
  } catch (error) {
    results.push({
      name,
      status: "failed",
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function assertText(text) {
  await page.getByText(text, { exact: true }).first().waitFor({ state: "visible", timeout: timeoutMs });
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function renderReport(summary, rows) {
  return `# Fuel Path Nearby Refine Browser Smoke

Run ID: ${summary.runId}

App URL: ${summary.appUrl}

Cases: ${summary.passed}/${summary.cases} passed

API calls: geocode ${summary.apiCalls.geocode || 0}, stations ${summary.apiCalls.stations || 0}

## Cases

${rows.map((row) => `- ${row.status === "passed" ? "PASS" : "FAIL"} ${row.name}${row.error ? ` - ${row.error}` : ""}`).join("\n")}

## Scope

- Exercises the rendered Nearby screen at mobile viewport size.
- Mocks API responses in-browser to isolate refine-required building/base selection behaviour.
- Verifies a selected base/building suggestion does not silently move the Nearby search centre.
- Does not prove native iOS/Android behaviour or production provider precision.
`;
}
