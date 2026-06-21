import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, "..");
const projectRoot = path.resolve(mobileRoot, "..");
const appUrl = process.env.FUEL_PATH_PLAN_SMOKE_URL || "http://127.0.0.1:8081/";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(projectRoot, "tmp");
const timeoutMs = Number(process.env.FUEL_PATH_PLAN_SMOKE_TIMEOUT_MS || 9000);

const points = {
  canberra: point("Canberra ACT", -35.2809, 149.13, "fuel_path_hint", "suburb"),
  sydney: point("Sydney CBD, Sydney NSW", -33.8688, 151.2093, "fuel_path_hint", "suburb"),
  sydneyAirport: point("Sydney Airport, Mascot NSW 2020", -33.9399, 151.1753, "fuel_path_hint", "airport"),
  melbourneAirport: point("Melbourne Airport, Melbourne VIC 3045", -37.669, 144.841, "fuel_path_hint", "airport"),
  artarmon: point("Artarmon NSW 2064", -33.8089, 151.1842, "fuel_path_hint", "suburb"),
  tennantCreekStreet: point("Paterson Street, Tennant Creek NT 0860", -19.649, 134.191, "fuel_path_regional_gazetteer", "street"),
};

const validationAddressSuggestions = [
  point("Parramatta Childrens Court, 12 George Street, Parramatta NSW 2150", -33.814, 151.005, "nominatim", "courthouse"),
  point("2, George Street, Sydney NSW 2000", -33.8642, 151.2082, "nominatim", "house"),
  point("2 George Street, Brisbane QLD 4000", -27.4716, 153.023, "nominatim", "house"),
];

const results = [];
const apiCalls = [];

let browser;
await assertAppReachable(appUrl);

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
  await recordCase("blank plan form stays disabled", async () => {
    await resetApp();
    await assertButtonDisabled("Plan route");
  });

  await recordCase("partial street input asks for suburb or postcode", async () => {
    await resetApp();
    await fillField("From", "45 Elizabeth Street");
    await assertText("Street found. Add suburb or postcode to choose the right area.");
    await assertText("Choose a start suggestion, or add suburb or postcode before planning.");
    await assertButtonDisabled("Plan route");
  });

  await recordCase("state-only address context is not enough", async () => {
    await resetApp();
    await fillField("From", "2 George Street NSW");
    await assertText("Choose a start suggestion, or add suburb or postcode before planning.");
    await assertButtonDisabled("Plan route");
  });

  await recordCase("locality-qualified typed address still needs suggestion confirmation", async () => {
    await resetApp();
    await selectSuggestion("From", "Canberra ACT", /Use Canberra ACT/);
    await fillField("To", "2 George Street Sydney NSW");
    await waitForSuggestion(/2, George Street, Sydney NSW 2000/);
    await assertText("Choose a destination suggestion to confirm this address.");
    await assertButtonDisabled("Plan route");
  });

  await recordCase("validation address rows are ranked above POI-like rows", async () => {
    await resetApp();
    await fillField("To", "2 George Street Sydney NSW");
    await waitForSuggestion(/2, George Street, Sydney NSW 2000/);
    const suggestionLabels = await visibleSuggestionLabels();
    assert(
      suggestionLabels[0]?.includes("2, George Street, Sydney NSW 2000"),
      `expected numbered address first, got ${suggestionLabels[0] || "nothing"}`,
    );
    assert(
      suggestionLabels.some((label) => label.includes("Parramatta Childrens Court")),
      "expected lower-ranked POI-like validation row to remain visible",
    );
  });

  await recordCase("validation rows keep unconfirmed evidence hidden", async () => {
    await resetApp();
    await fillField("To", "2 George Street Sydney NSW");
    await waitForSuggestion(/2, George Street, Sydney NSW 2000/);
    await assertHiddenText("Needs confirmation");
    await assertHiddenText("Not an exact address match. Confirm this row before planning.");
    await assertText("Choose a destination suggestion to confirm this address.");
  });

  await recordCase("street fallback rows keep street-only evidence hidden", async () => {
    await resetApp();
    await fillField("From", "22 Paterson Street Tennant Creek NT");
    await waitForSuggestion(/Paterson Street, Tennant Creek NT 0860/);
    await assertHiddenText("Street/area only");
    await assertHiddenText("Not an exact address. Use only if this street or area is enough.");
    await assertText("Choose a start suggestion to confirm this address.");
    await assertButtonDisabled("Plan route");
  });

  await recordCase("selecting confirmed From and To unlocks Plan route", async () => {
    await resetApp();
    await selectSuggestion("From", "Canberra ACT", /Use Canberra ACT/);
    await selectSuggestion("To", "2 George Street Sydney NSW", /Use 2, George Street, Sydney NSW 2000/);
    await assertButtonEnabled("Plan route");
  });

  await recordCase("selected broad capital pair can submit route", async () => {
    await resetApp();
    await selectSuggestion("From", "Canberra ACT", /Use Canberra ACT/);
    await selectSuggestion("To", "Sydney CBD NSW", /Use Sydney CBD, Sydney NSW/);
    await submitRouteAndAssertResults();
  });

  await recordCase("airport pair suggestions can submit route", async () => {
    await resetApp();
    await selectSuggestion("From", "Sydney Airport NSW", /Use Sydney Airport, Mascot NSW 2020/);
    await selectSuggestion("To", "Melbourne Airport VIC", /Use Melbourne Airport, Melbourne VIC 3045/);
    await submitRouteAndAssertResults();
  });

  await recordCase("editing after a planned route clears route results", async () => {
    await resetApp();
    await selectSuggestion("From", "Artamon NSW", /Use Artarmon NSW 2064/);
    await selectSuggestion("To", "Sydney CBD NSW", /Use Sydney CBD, Sydney NSW/);
    await submitRouteAndAssertResults();
    await page.getByRole("button", { name: "Edit planned route" }).click();
    await field("From").waitFor({ state: "visible", timeout: timeoutMs });
    await fillField("From", "Canberra ACT");
    await assertHiddenText("Suggested fuel stops");
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
const jsonPath = path.join(outputDir, `plan-field-browser-smoke-${runId}.json`);
const reportPath = path.join(outputDir, `plan-field-browser-smoke-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));

console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));

if (summary.failed) {
  throw new Error(`${summary.failed}/${summary.cases} Plan field browser smoke cases failed`);
}

async function installApiMocks(activePage) {
  await activePage.route("**/api/geocode?**", async (route) => {
    apiCalls.push("geocode");
    const url = new URL(route.request().url());
    const query = normalise(url.searchParams.get("q") || "");
    const suggestions = suggestionsForQuery(query);
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

  await activePage.route("**/api/route?**", async (route) => {
    apiCalls.push("route");
    const url = new URL(route.request().url());
    const from = {
      lat: Number(url.searchParams.get("fromLat")),
      lon: Number(url.searchParams.get("fromLon")),
      label: url.searchParams.get("fromLabel") || "Start",
    };
    const to = {
      lat: Number(url.searchParams.get("toLat")),
      lon: Number(url.searchParams.get("toLon")),
      label: url.searchParams.get("toLabel") || "Destination",
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "browser_smoke_mock",
        distanceKm: 286,
        durationMin: 210,
        points: [from, midpoint(from, to), to],
      }),
    });
  });

  await activePage.route("**/api/score", async (route) => {
    apiCalls.push("score");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(scorePayload()),
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
      `Plan field smoke could not reach ${url}. Start the Expo web app first: cd mobile-app && npm run web -- --port 8081. Original error: ${reason}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function resetApp() {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await field("From").waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByText("Plan trip").first().waitFor({ state: "visible", timeout: timeoutMs });
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

async function fillField(label, value) {
  const input = field(label);
  await input.click();
  await input.fill(value);
}

async function selectSuggestion(label, value, accessibleName) {
  await fillField(label, value);
  const suggestion = page.getByRole("button", { name: accessibleName }).first();
  await suggestion.waitFor({ state: "visible", timeout: timeoutMs });
  await suggestion.click();
}

async function submitRouteAndAssertResults() {
  await assertButtonEnabled("Plan route");
  await page.getByRole("button", { name: "Plan route" }).click();
  await assertText("Recommendation");
  await assertText("Metro Bexley");
  await assertText("Suggested fuel stops");
}

async function waitForSuggestion(namePattern) {
  await page.getByRole("button", { name: new RegExp(`Use .*${namePattern.source}`, "i") }).first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
}

async function visibleSuggestionLabels() {
  return page
    .getByRole("button", { name: /^Use / })
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute("aria-label") || node.textContent || "")
        .filter(Boolean),
    );
}

async function assertText(text) {
  await page.getByText(text, { exact: true }).first().waitFor({ state: "visible", timeout: timeoutMs });
}

async function assertHiddenText(text) {
  const count = await page.getByText(text, { exact: true }).count();
  assert(count === 0, `expected "${text}" to be hidden, found ${count} match(es)`);
}

async function assertButtonDisabled(name) {
  const disabled = await buttonDisabled(name);
  assert(disabled, `expected "${name}" to be disabled`);
}

async function assertButtonEnabled(name) {
  const disabled = await buttonDisabled(name);
  assert(!disabled, `expected "${name}" to be enabled`);
}

async function buttonDisabled(name) {
  const button = page.getByRole("button", { name }).first();
  await button.waitFor({ state: "visible", timeout: timeoutMs });
  return button.evaluate((element) => {
    const htmlElement = element;
    return (
      htmlElement.getAttribute("aria-disabled") === "true" ||
      htmlElement.getAttribute("disabled") !== null ||
      Boolean(htmlElement.disabled)
    );
  });
}

function field(label) {
  return page.getByLabel(label, { exact: true });
}

function suggestionsForQuery(query) {
  if (query === "canberra act") return [points.canberra];
  if (query === "sydney cbd nsw") return [points.sydney];
  if (query === "sydney airport nsw") return [points.sydneyAirport];
  if (query === "melbourne airport vic") return [points.melbourneAirport];
  if (query === "artamon nsw" || query === "artarmon nsw") return [points.artarmon];
  if (query === "2 george street sydney nsw") return validationAddressSuggestions;
  if (query === "22 paterson street tennant creek nt") return [points.tennantCreekStreet];
  return [];
}

function point(label, lat, lon, provider, type) {
  return {
    label,
    lat,
    lon,
    provider,
    type,
  };
}

function midpoint(from, to) {
  return {
    label: "Route midpoint",
    lat: (from.lat + to.lat) / 2,
    lon: (from.lon + to.lon) / 2,
  };
}

function scorePayload() {
  const station = {
    stationCode: "smoke-metro-bexley",
    name: "Metro Bexley",
    brand: "Metro Fuel",
    suburb: "Bexley",
    address: "630 Forest Road, Bexley NSW 2207",
    lat: -33.9594103,
    lon: 151.1177521,
    openNow: true,
    updatedAt: "2026-06-19T08:47:00+10:00",
    source: "browser_smoke_mock",
    prices: {
      E10: 149.9,
      U91: 154.9,
      P95: 169.9,
      P98: 177.9,
      DL: 185.9,
      PDL: 189.9,
    },
  };
  return {
    context: {
      routeName: "Browser smoke route",
      source: "browser_smoke_mock",
      provider: "browser_smoke_mock",
      capability: "live",
      fuel: "E10",
      routeDistanceKm: 286,
      baselineCpl: 162.9,
      eligibleCandidates: 1,
      timingAdvice: {
        action: "fill_today_on_route",
        visible: true,
        label: "Fill today on this route",
        reason: "Metro Bexley is the best value on this mocked route.",
      },
    },
    recommendations: [
      {
        station,
        pumpCpl: 149.9,
        adjustedCpl: 149.9,
        discountCpl: 0,
        distanceKm: 0.4,
        distanceToRouteKm: 0.4,
        distanceAlongRouteKm: 8,
        fuel: "E10",
        fillLitres: 30,
        reachable: true,
        warnings: [],
        netSaving: 4.2,
        detourMinutes: 1.1,
      },
    ],
    contextStations: [],
  };
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
  return `# Fuel Path Plan Field Browser Smoke

Run ID: ${summary.runId}

App URL: ${summary.appUrl}

Cases: ${summary.passed}/${summary.cases} passed

API calls: geocode ${summary.apiCalls.geocode || 0}, route ${summary.apiCalls.route || 0}, score ${summary.apiCalls.score || 0}

## Cases

case | status | elapsedMs | error
--- | --- | ---: | ---
${rows.map((row) => [row.name, row.status, row.elapsedMs, row.error || ""].map(markdownCell).join(" | ")).join("\n")}

## Scope

- Exercises the rendered Plan screen at mobile viewport size.
- Mocks API responses in-browser to keep the check deterministic.
- Covers disabled CTA states, suggestion confirmation, validation-provider ranking, unconfirmed evidence, route submission and route-edit recovery.
- Does not prove native iOS/Android behaviour or production provider precision.
`;
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}
