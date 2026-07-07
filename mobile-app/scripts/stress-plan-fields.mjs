import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, "..");
const projectRoot = path.resolve(mobileRoot, "..");
const appUrl = process.env.FUEL_PATH_PLAN_STRESS_URL || "http://127.0.0.1:8081/";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(projectRoot, "tmp");
const timeoutMs = Number(process.env.FUEL_PATH_PLAN_STRESS_TIMEOUT_MS || 9000);
const pairCount = Number(process.env.FUEL_PATH_PLAN_STRESS_ROUTE_PAIRS || 100);
const submitEvery = Number(process.env.FUEL_PATH_PLAN_STRESS_SUBMIT_EVERY || 25);

const endpoints = [
  ep("syd-cbd", "Sydney CBD NSW", -33.8688, 151.2093, "NSW", "capital"),
  ep("bondi", "Bondi Beach NSW", -33.8915, 151.2767, "NSW", "poi"),
  ep("parramatta", "Parramatta NSW", -33.8136, 151.0034, "NSW", "regional"),
  ep("newcastle", "Newcastle NSW", -32.9283, 151.7817, "NSW", "regional"),
  ep("wollongong", "Wollongong NSW", -34.4278, 150.8931, "NSW", "regional"),
  ep("dubbo", "Dubbo NSW", -32.2429, 148.6048, "NSW", "regional"),
  ep("coffs", "Coffs Harbour NSW", -30.2963, 153.1135, "NSW", "regional"),
  ep("syd-airport", "Sydney Airport NSW", -33.9399, 151.1753, "NSW", "airport", "Sydney Airport, Mascot NSW 2020"),
  ep("sylvania-addr", "66B Easton Avenue Sylvania NSW 2224", -34.0128, 151.1033, "NSW", "address", "66B Easton Avenue, Sylvania NSW 2224"),
  ep("artarmon-typo", "Artamon NSW", -33.8089, 151.1842, "NSW", "typo", "Artarmon NSW 2064"),
  ep("moree", "Moree NSW", -29.4639, 149.843, "NSW", "remote"),
  ep("canberra", "Canberra ACT", -35.2809, 149.13, "ACT", "capital"),
  ep("canberra-centre", "Canberra Centre ACT", -35.2792, 149.1326, "ACT", "poi"),
  ep("braddon", "Braddon ACT", -35.2705, 149.135, "ACT", "suburb"),
  ep("belconnen", "Belconnen ACT", -35.2386, 149.0669, "ACT", "suburb"),
  ep("tuggeranong", "Tuggeranong ACT", -35.4244, 149.0888, "ACT", "suburb"),
  ep("mel-cbd", "Melbourne CBD VIC", -37.8136, 144.9631, "VIC", "capital"),
  ep("mel-airport", "Melbourne Airport VIC", -37.669, 144.841, "VIC", "airport", "Melbourne Airport, Melbourne VIC 3045"),
  ep("geelong", "Geelong VIC", -38.1499, 144.3617, "VIC", "regional"),
  ep("ballarat", "Ballarat VIC", -37.5622, 143.8503, "VIC", "regional"),
  ep("bendigo", "Bendigo VIC", -36.757, 144.2794, "VIC", "regional"),
  ep("mcg", "Melbourne Cricket Ground VIC", -37.8199, 144.9834, "VIC", "poi"),
  ep("flinders", "Flinders Street Station VIC", -37.8183, 144.9671, "VIC", "poi"),
  ep("brisbane", "Brisbane CBD QLD", -27.4698, 153.0251, "QLD", "capital"),
  ep("gold-coast", "Gold Coast QLD", -28.0167, 153.4, "QLD", "regional"),
  ep("sunshine-coast", "Sunshine Coast QLD", -26.65, 153.0667, "QLD", "regional"),
  ep("longreach", "Longreach QLD", -23.44, 144.25, "QLD", "remote"),
  ep("longreach-unit", "Unit 3, 15 Wonga Street, Longreach QLD 4730", -23.44, 144.25, "QLD", "unit-address", "3/15 Wonga Street, Longreach QLD 4730"),
  ep("longreach-unit-2", "Unit 9, 16 Wonga Street, Longreach QLD 4730", -23.44, 144.25, "QLD", "unit-address", "9/16 Wonga Street Longreach QLD 4730"),
  ep("cairns", "Cairns QLD", -16.9203, 145.771, "QLD", "regional"),
  ep("townsville", "Townsville QLD", -19.2589, 146.8169, "QLD", "regional"),
  ep("toowoomba", "Toowoomba QLD", -27.5598, 151.9507, "QLD", "regional"),
  ep("mount-isa", "Mount Isa QLD", -20.7268, 139.4955, "QLD", "remote"),
  ep("bris-airport", "Brisbane Airport QLD", -27.3942, 153.1218, "QLD", "airport"),
  ep("perth", "Perth CBD WA", -31.9523, 115.8613, "WA", "capital"),
  ep("fremantle", "Fremantle WA", -32.0569, 115.7439, "WA", "regional"),
  ep("bunbury", "Bunbury WA", -33.3271, 115.6414, "WA", "regional"),
  ep("geraldton", "Geraldton WA", -28.7774, 114.6149, "WA", "regional"),
  ep("kalgoorlie", "Kalgoorlie WA", -30.7479, 121.4728, "WA", "regional"),
  ep("broome", "Broome WA", -17.9644, 122.2304, "WA", "remote"),
  ep("broome-remote", "18 Robinson Street, Broome WA 6725", -17.961, 122.236, "WA", "remote"),
  ep("broome-unit", "Unit 7, 18 Robinson Street, Broome WA 6725", -17.961, 122.236, "WA", "unit-address", "7/18 Robinson Street, Broome WA 6725"),
  ep("broome-unit-2", "Unit 1, 19 Robinson Street, Broome WA 6725", -17.9608, 122.2351, "WA", "unit-address", "1/19 Robinson Street, Broome WA 6725"),
  ep("newman", "Newman WA", -23.36, 119.74, "WA", "remote"),
  ep("perth-airport", "Perth Airport WA", -31.9403, 115.9669, "WA", "airport"),
  ep("adelaide", "Adelaide CBD SA", -34.9285, 138.6007, "SA", "capital"),
  ep("mount-gambier", "Mount Gambier SA", -37.8284, 140.7804, "SA", "regional"),
  ep("coober-unit", "Unit 2, 12 Hutchison Street, Coober Pedy SA 5723", -29.0139, 134.7544, "SA", "unit-address", "2/12 Hutchison Street, Coober Pedy SA 5723"),
  ep("coober-unit-2", "Unit 4, 24 Hutchison Street, Coober Pedy SA 5723", -29.0141, 134.7539, "SA", "unit-address", "4/24 Hutchison Street, Coober Pedy SA 5723"),
  ep("port-augusta", "Port Augusta SA", -32.4952, 137.7894, "SA", "regional"),
  ep("whyalla", "Whyalla SA", -33.0333, 137.5833, "SA", "regional"),
  ep("coober-pedy", "Coober Pedy SA", -29.0139, 134.7544, "SA", "remote"),
  ep("rundle", "Rundle Mall Adelaide SA", -34.9228, 138.6037, "SA", "poi"),
  ep("port-lincoln", "Port Lincoln SA", -34.7244, 135.8618, "SA", "remote"),
  ep("hobart", "Hobart CBD TAS", -42.8821, 147.3272, "TAS", "capital"),
  ep("launceston", "Launceston TAS", -41.4332, 147.1441, "TAS", "regional"),
  ep("devonport", "Devonport TAS", -41.1769, 146.3515, "TAS", "regional"),
  ep("burnie", "Burnie TAS", -41.0529, 145.9063, "TAS", "regional"),
  ep("hobart-airport", "Hobart Airport TAS", -42.8361, 147.5103, "TAS", "airport"),
  ep("strahan", "Strahan TAS", -42.1584, 145.355, "TAS", "remote"),
  ep("darwin", "Darwin CBD NT", -12.4634, 130.8456, "NT", "capital"),
  ep("alice", "Alice Springs NT", -23.698, 133.8807, "NT", "remote"),
  ep("alice-remote-unit", "Unit 2, 6 Gunya Place, Alice Springs NT 0870", -23.697, 133.881, "NT", "unit-address", "2/6 Gunya Place, Alice Springs NT 0870"),
  ep("tennant-remote-unit", "Unit 2, 22 Paterson Street, Tennant Creek NT 0860", -19.649, 134.191, "NT", "unit-address", "2/22 Paterson Street Tennant Creek NT 0860"),
  ep("katherine", "Katherine NT", -14.4652, 132.2635, "NT", "regional"),
  ep("tennant-unit", "Unit 2, 22 Paterson Street, Tennant Creek NT 0860", -19.648, 134.191, "NT", "unit-address", "2/22 Paterson Street, Tennant Creek NT 0860"),
  ep("palmerston", "Palmerston NT", -12.486, 130.9833, "NT", "regional"),
  ep("darwin-airport", "Darwin Airport NT", -12.4147, 130.8811, "NT", "airport"),
];

const results = [];
const apiCalls = [];
const pairs = buildRoutePairs(endpoints, pairCount);

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
  for (const [index, pair] of pairs.entries()) {
    const shouldSubmit = submitEvery > 0 && index % submitEvery === 0;
    await recordCase(`${index + 1}. ${pair.from.id} to ${pair.to.id}`, async () => {
      await resetApp();
      await selectEndpoint("From", pair.from);
      await selectEndpoint("To", pair.to);
      await assertButtonEnabled("Plan route");
      if (shouldSubmit) {
        await submitRouteAndAssertResults();
      }
    }, pair, shouldSubmit);
  }
} finally {
  await page.close();
  await context.close();
  await browser.close();
}

const summary = {
  runId,
  appUrl,
  routePairs: pairs.length,
  uniqueRoutePairs: new Set(pairs.map((pair) => `${pair.from.id}->${pair.to.id}`)).size,
  cases: results.length,
  passed: results.filter((result) => result.status === "passed").length,
  failed: results.filter((result) => result.status === "failed").length,
  submittedRoutes: results.filter((result) => result.submitted).length,
  endpointCoverage: unique(results.flatMap((result) => [result.fromId, result.toId]).filter(Boolean)).length,
  stateCoverage: countBy(results.flatMap((result) => [result.fromState, result.toState]).filter(Boolean)),
  typeCoverage: countBy(results.flatMap((result) => [result.fromType, result.toType]).filter(Boolean)),
  apiCalls: apiCalls.reduce((counts, call) => {
    counts[call] = (counts[call] || 0) + 1;
    return counts;
  }, {}),
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `plan-field-browser-stress-${runId}.json`);
const reportPath = path.join(outputDir, `plan-field-browser-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));

console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));

if (summary.failed) {
  throw new Error(`${summary.failed}/${summary.cases} Plan field browser stress cases failed`);
}
if (summary.uniqueRoutePairs !== summary.routePairs) {
  throw new Error(`Expected ${summary.routePairs}/${summary.routePairs} unique route pairs, got ${summary.uniqueRoutePairs}`);
}
if (summary.endpointCoverage !== endpoints.length) {
  throw new Error(`Expected ${endpoints.length}/${endpoints.length} endpoint coverage, got ${summary.endpointCoverage}`);
}

async function installApiMocks(activePage) {
  await activePage.route("**/api/geocode**", async (route) => {
    apiCalls.push("geocode");
    const url = new URL(route.request().url());
    const body = requestJson(route.request());
    const query = normalise(url.searchParams.get("q") || body.q || body.query || body.input || body.address || body.text || "");
    const suggestions = suggestionsForQuery(query);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: suggestions[0]?.provider || "browser_stress_mock",
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
        provider: "browser_stress_mock",
        distanceKm: distanceKm(from, to),
        durationMin: 180,
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

function requestJson(request) {
  try {
    return request.postDataJSON() || {};
  } catch {
    return {};
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
      `Plan field stress could not reach ${url}. Start the Expo web app first: cd mobile-app && npm run web -- --port 8081. Original error: ${reason}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function resetApp() {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Plan" }).click({ timeout: timeoutMs });
  await field("From").waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByRole("button", { name: "Plan route" }).waitFor({ state: "visible", timeout: timeoutMs });
}

async function recordCase(name, callback, pair, submitted) {
  const started = Date.now();
  const row = {
    name,
    fromId: pair.from.id,
    fromState: pair.from.state,
    fromType: pair.from.type,
    toId: pair.to.id,
    toState: pair.to.state,
    toType: pair.to.type,
    submitted,
  };
  try {
    await callback();
    results.push({ ...row, status: "passed", elapsedMs: Date.now() - started });
    console.log(`OK ${name}`);
  } catch (error) {
    results.push({
      ...row,
      status: "failed",
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function selectEndpoint(label, endpoint) {
  await fillField(label, endpoint.query);
  const suggestion = page.getByText(new RegExp(escapeRegExp(primarySuggestionLabel(endpoint.label)), "i"), { exact: false }).first();
  await suggestion.waitFor({ state: "visible", timeout: timeoutMs });
  await suggestion.click();
}

async function fillField(label, value) {
  const input = field(label);
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 1 });
}

async function submitRouteAndAssertResults() {
  await page.getByRole("button", { name: "Plan route" }).click();
  await page.getByText("Metro Bexley", { exact: true }).first().waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByRole("button", { name: "Show route evidence" }).click();
  await page.getByText("Why this stop", { exact: true }).first().waitFor({ state: "visible", timeout: timeoutMs });
}

async function assertButtonEnabled(name) {
  const button = page.getByRole("button", { name }).first();
  await button.waitFor({ state: "visible", timeout: timeoutMs });
  const disabled = await button.evaluate((element) => {
    const htmlElement = element;
    return (
      htmlElement.getAttribute("aria-disabled") === "true" ||
      htmlElement.getAttribute("disabled") !== null ||
      Boolean(htmlElement.disabled)
    );
  });
  if (disabled) throw new Error(`expected "${name}" to be enabled`);
}

function field(label) {
  if (label === "From") return page.getByPlaceholder(/Start address, suburb or place/i).first();
  if (label === "To") return page.getByPlaceholder(/Destination address, suburb or place/i).first();
  return page.getByLabel(label, { exact: true });
}

function suggestionsForQuery(query) {
  const matches = endpoints
    .filter((endpoint) => normalise(endpoint.query) === query || normalise(endpoint.label) === query)
    .map((endpoint) => point(endpoint));
  return matches.length ? matches : [];
}

function ep(id, query, lat, lon, state, type, label = query) {
  return { id, query, label, lat, lon, state, type };
}

function point(endpoint) {
  return {
    label: endpoint.label,
    lat: endpoint.lat,
    lon: endpoint.lon,
    provider: endpoint.type === "address" ? "fuel_path_gnaf" : "fuel_path_hint",
    type: endpoint.type,
    state: endpoint.state,
  };
}

function buildRoutePairs(items, count) {
  const pairs = [];
  const seen = new Set();
  const offsets = [13, 7, 23, 17, 31, 5, 29, 11, 37, 19, 41, 3, 43, 2, 47];
  for (const offset of offsets) {
    for (let index = 0; index < items.length && pairs.length < count; index += 1) {
      const from = items[index];
      const to = items[(index + offset) % items.length];
      const key = `${from.id}->${to.id}`;
      if (from.id === to.id || seen.has(key)) continue;
      seen.add(key);
      pairs.push({ from, to });
    }
  }
  if (pairs.length < count) {
    throw new Error(`Only built ${pairs.length}/${count} unique route pairs`);
  }
  return pairs;
}

function scorePayload() {
  const station = {
    stationCode: "stress-metro-bexley",
    name: "Metro Bexley",
    brand: "Metro Fuel",
    suburb: "Bexley",
    address: "630 Forest Road, Bexley NSW 2207",
    lat: -33.9594103,
    lon: 151.1177521,
    openNow: true,
    updatedAt: "2026-06-19T08:47:00+10:00",
    source: "browser_stress_mock",
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
      routeName: "Browser stress route",
      source: "browser_stress_mock",
      provider: "browser_stress_mock",
      capability: "live",
      fuel: "E10",
      routeDistanceKm: 286,
      baselineCpl: 162.9,
      eligibleCandidates: 1,
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

function midpoint(from, to) {
  return {
    label: "Route midpoint",
    lat: (from.lat + to.lat) / 2,
    lon: (from.lon + to.lon) / 2,
  };
}

function distanceKm(left, right) {
  const lat = left.lat - right.lat;
  const lon = left.lon - right.lon;
  return Number((Math.sqrt(lat * lat + lon * lon) * 111).toFixed(1));
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function unique(values) {
  return [...new Set(values)];
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function primarySuggestionLabel(label) {
  return String(label)
    .split(",")[0]
    .replace(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderReport(summary, rows) {
  return `# Fuel Path Plan Field Browser Stress

Run ID: ${summary.runId}

App URL: ${summary.appUrl}

Route pairs: ${summary.passed}/${summary.cases} passed

Unique route pairs: ${summary.uniqueRoutePairs}/${summary.routePairs}

Endpoint coverage: ${summary.endpointCoverage}/${endpoints.length}

Submitted routes: ${summary.submittedRoutes}

API calls: geocode ${summary.apiCalls.geocode || 0}, route ${summary.apiCalls.route || 0}, score ${summary.apiCalls.score || 0}

## Coverage

State coverage: ${Object.entries(summary.stateCoverage).map(([key, value]) => `${key} ${value}`).join(", ")}

Type coverage: ${Object.entries(summary.typeCoverage).map(([key, value]) => `${key} ${value}`).join(", ")}

## Cases

case | status | from | to | submitted | elapsedMs | error
--- | --- | --- | --- | --- | ---: | ---
${rows.map((row) => [
  row.name,
  row.status,
  row.fromId,
  row.toId,
  row.submitted ? "yes" : "no",
  row.elapsedMs,
  row.error || "",
].map(markdownCell).join(" | ")).join("\n")}

## Scope

- Exercises the rendered Plan screen at mobile viewport size across 100 national From/To pairs.
- Mocks API responses in-browser to isolate Plan-field selection, state recovery and CTA enablement.
- Submits every ${submitEvery}th route to prove selected pairs can leave the editor and render recommendations.
- Does not prove native iOS/Android controls or production provider precision.
`;
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}
