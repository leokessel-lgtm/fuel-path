#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createNswFuelCheckAdapter } = require("../api/_nswFuelCheck");
const { createWaFuelWatchAdapter } = require("../api/_waFuelWatch");
const { normaliseVicPayload } = require("../api/_vicServoSaverProvider");
const { createFppDirectProvider } = require("../api/_fppDirectProvider");

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("tmp");
const { normaliseNswPayload, normaliseTasPayload } = createNswFuelCheckAdapter();
const { normaliseWaFuelWatchPayloads } = createWaFuelWatchAdapter();
const { normaliseQldPayload, normaliseSaPayload } = createFppDirectProvider();

const cases = [
  localCase("nsw-drops-zero-coords-price-only-and-invalid-prices", assertNswMalformedPayload),
  localCase("tas-state-filter-prefixes-and-drops-malformed-rows", assertTasMalformedPayload),
  localCase("wa-rss-drops-bad-items-and-preserves-tomorrow-prices", assertWaMalformedPayload),
  localCase("vic-reference-merge-aliases-and-drops-unusable-rows", assertVicMalformedPayload),
  localCase("qld-fpp-direct-drops-price-only-zero-coord-and-unavailable-prices", assertQldMalformedPayload),
  localCase("sa-fpp-direct-drops-price-only-zero-coord-and-unavailable-prices", assertSaMalformedPayload),
  localCase("all-state-normalisers-never-return-non-finite-prices-or-null-island", assertGlobalInvariants),
];

const results = cases.map(runCase);
const failed = results.filter((result) => result.status === "failed");
const summary = {
  runId,
  cases: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failures: failed.map((result) => result.id),
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `state-fuel-provider-chaos-stress-${runId}.json`);
const reportPath = path.join(outputDir, `state-fuel-provider-chaos-stress-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
fs.writeFileSync(reportPath, renderReport(summary, results));

for (const result of results) console.log(`${result.status === "passed" ? "OK" : "FAIL"} ${result.id}`);
console.log(JSON.stringify({ ...summary, jsonPath, reportPath }, null, 2));

if (failed.length) throw new Error(`${failed.length}/${results.length} state fuel provider chaos cases failed`);

function localCase(id, assert) {
  return { id, assert };
}

function runCase(entry) {
  const started = Date.now();
  try {
    const outcome = entry.assert();
    const failures = outcome.failures || [];
    return {
      id: entry.id,
      status: failures.length ? "failed" : "passed",
      latencyMs: Date.now() - started,
      failures,
      observations: outcome.observations || {},
    };
  } catch (error) {
    return {
      id: entry.id,
      status: "failed",
      latencyMs: Date.now() - started,
      failures: [`unexpected throw: ${error?.stack || error?.message || error}`],
      observations: {},
    };
  }
}

function assertNswMalformedPayload() {
  const stations = normaliseNswPayload({
    stations: [
      stationRow("NSW-GOOD", "Metro Valid NSW", "Metro", -33.8688, 151.2093, "1 George St, Sydney NSW 2000"),
      stationRow("NSW-ZERO", "Zero Coord NSW", "Ghost", 0, 0, "Null Island"),
      stationRow("NSW-NOPRICE", "No Price NSW", "Ghost", -33.86, 151.2, "No Price"),
      null,
      "not an object",
    ],
    prices: [
      priceRow("NSW-GOOD", "U91", 181.9, "29/06/2026 08:00:00"),
      priceRow("NSW-GOOD", "P95", "not-a-price", "29/06/2026 08:05:00"),
      priceRow("NSW-ZERO", "U91", 149.9),
      priceRow("NSW-PRICE-ONLY", "DL", 177.7),
      { stationcode: "NSW-GOOD", fueltype: "", price: 99.9 },
    ],
  });
  return providerChecks("nsw", stations, {
    expectedCodes: ["NSW-GOOD"],
    expectedPrice: ["NSW-GOOD", "U91", 181.9],
    absentCodes: ["NSW-ZERO", "NSW-NOPRICE", "NSW-PRICE-ONLY"],
    observations: { count: stations.length, stationCodes: stations.map((station) => station.stationCode) },
  });
}

function assertTasMalformedPayload() {
  const stations = normaliseTasPayload({
    stations: [
      { ...stationRow("TAS-GOOD", "Tas Valid", "Ampol", -42.8821, 147.3272, "1 Elizabeth St, Hobart TAS 7000"), state: "TAS" },
      { ...stationRow("TAS-ZERO", "Tas Zero", "Ghost", 0, 0, "Null Island"), state: "TAS" },
      { ...stationRow("NSW-LEAK", "Wrong State", "Ghost", -33.86, 151.2, "Wrong State"), state: "NSW" },
    ],
    FuelPrice: [
      { ...priceRow("TAS-GOOD", "DL", 199.5), state: "TAS" },
      { ...priceRow("TAS-GOOD", "P98", "bad"), state: "TAS" },
      { ...priceRow("TAS-ZERO", "DL", 188.8), state: "TAS" },
      { ...priceRow("TAS-PRICE-ONLY", "U91", 177.7), state: "TAS" },
      { ...priceRow("NSW-LEAK", "U91", 111.1), state: "NSW" },
    ],
  });
  return providerChecks("tas", stations, {
    expectedCodes: ["TAS-TAS-GOOD"],
    expectedPrice: ["TAS-TAS-GOOD", "DL", 199.5],
    absentCodes: ["TAS-TAS-ZERO", "TAS-TAS-PRICE-ONLY", "TAS-NSW-LEAK"],
    observations: { count: stations.length, stationCodes: stations.map((station) => station.stationCode) },
  });
}

function assertWaMalformedPayload() {
  const today = waXml([
    waItem({ brand: "Metro", name: "Metro Valid WA", address: "1 Hay St", location: "Perth", price: "171.5", lat: "-31.9523", lon: "115.8613" }),
    waItem({ brand: "Ghost", name: "WA Zero", address: "Null", location: "Ocean", price: "99.9", lat: "0", lon: "0" }),
    waItem({ brand: "Ghost", name: "WA Bad Price", address: "2 Hay St", location: "Perth", price: "bad", lat: "-31.95", lon: "115.86" }),
    "not xml",
  ]);
  const tomorrow = waXml([
    waItem({ brand: "Metro", name: "Metro Valid WA", address: "1 Hay St", location: "Perth", price: "169.9", lat: "-31.9523", lon: "115.8613", date: "30/06/2026" }),
  ]);
  const stations = normaliseWaFuelWatchPayloads([
    { fuelCode: "U91", day: "today", xml: today },
    { fuelCode: "U91", day: "tomorrow", xml: tomorrow },
  ]);
  const station = stations[0];
  const failures = providerChecks("wa", stations, {
    expectedCodes: [station?.stationCode].filter(Boolean),
    expectedPrice: [station?.stationCode, "U91", 171.5],
    observations: { count: stations.length, stationCodes: stations.map((item) => item.stationCode), futurePrices: station?.futurePrices || {} },
  }).failures;
  return {
    failures: checks([
      [failures.length === 0, failures.join("; ")],
      [stations.length === 1, `expected one valid WA station, got ${stations.length}`],
      [station?.futurePrices?.tomorrow?.prices?.U91 === 169.9, `expected tomorrow U91 169.9, got ${station?.futurePrices?.tomorrow?.prices?.U91}`],
    ]),
    observations: { count: stations.length, stationCodes: stations.map((item) => item.stationCode), futurePrices: station?.futurePrices || {} },
  };
}

function assertVicMalformedPayload() {
  const brands = new Map([["1", "Ampol"], ["2", "Ghost"]]);
  const types = new Map([["100", "Premium Diesel"], ["101", "Premium Unleaded 98"]]);
  const referenceStations = new Map([
    ["VIC-GOOD", { name: "Ampol Valid VIC", brandId: "1", lat: -37.8136, lon: 144.9631, address: "1 Collins St, Melbourne VIC 3000" }],
    ["VIC-ZERO", { name: "Vic Zero", brandId: "2", lat: 0, lon: 0, address: "Null Island" }],
  ]);
  const stations = normaliseVicPayload({
    fuelPriceDetails: [
      { fuelStation: { id: "VIC-GOOD" }, fuelPrices: [{ fuelType: "100", price: 189.9, isAvailable: true, updatedAt: "2026-06-29T00:00:00Z" }] },
      { fuelStation: { id: "VIC-GOOD" }, fuelPrices: [{ fuelType: "101", price: "bad", isAvailable: true }] },
      { fuelStation: { id: "VIC-ZERO" }, fuelPrices: [{ fuelType: "100", price: 111.1, isAvailable: true }] },
      { fuelStation: { id: "VIC-PRICE-ONLY", name: "No Coords" }, fuelPrices: [{ fuelType: "100", price: 123.4, isAvailable: true }] },
      { fuelStation: { id: "VIC-UNAVAILABLE", latitude: -37.8, longitude: 144.9 }, fuelPrices: [{ fuelType: "100", price: 140.1, isAvailable: false }] },
    ],
  }, { brands, types, stations: referenceStations });
  return providerChecks("vic", stations, {
    expectedCodes: ["VIC-VIC-GOOD"],
    expectedPrice: ["VIC-VIC-GOOD", "PDL", 189.9],
    absentCodes: ["VIC-VIC-ZERO", "VIC-VIC-PRICE-ONLY", "VIC-VIC-UNAVAILABLE"],
    observations: { count: stations.length, stationCodes: stations.map((station) => station.stationCode), prices: stations[0]?.prices || {} },
  });
}

function assertQldMalformedPayload() {
  const stations = normaliseQldPayload(
    fppSites("QLD", [
      fppSite("100", "Metro Valid QLD", "1", -27.4698, 153.0251, "1 Queen St, Brisbane QLD 4000", "4000", "10"),
      fppSite("200", "QLD Zero", "2", 0, 0, "Null Island", "0000", "10"),
      fppSite("300", "QLD No Price", "1", -27.4, 153.0, "No Price", "4000", "10"),
    ]),
    fppPrices([
      fppPrice("100", 2, 1849),
      fppPrice("100", 5, 9999),
      fppPrice("200", 2, 1111),
      fppPrice("999", 3, 1777),
      fppPrice("100", 999, 1000),
    ]),
    fppBrands(),
    fppRegions("Queensland", "Brisbane", "10"),
  );
  return providerChecks("qld", stations, {
    expectedCodes: ["QLD-100"],
    expectedPrice: ["QLD-100", "U91", 184.9],
    absentCodes: ["QLD-200", "QLD-300", "QLD-999"],
    observations: { count: stations.length, stationCodes: stations.map((station) => station.stationCode), prices: stations[0]?.prices || {} },
  });
}

function assertSaMalformedPayload() {
  const stations = normaliseSaPayload(
    fppSites("SA", [
      fppSite("100", "Metro Valid SA", "1", -34.9285, 138.6007, "1 King William St, Adelaide SA 5000", "5000", "20"),
      fppSite("200", "SA Zero", "2", 0, 0, "Null Island", "0000", "20"),
      fppSite("300", "SA No Price", "1", -34.9, 138.6, "No Price", "5000", "20"),
    ]),
    fppPrices([
      fppPrice("100", 3, 1899),
      fppPrice("100", 5, 9999),
      fppPrice("200", 3, 1111),
      fppPrice("999", 2, 1777),
      fppPrice("100", 999, 1000),
    ]),
    fppBrands(),
    fppRegions("South Australia", "Adelaide", "20"),
  );
  return providerChecks("sa", stations, {
    expectedCodes: ["SA-100"],
    expectedPrice: ["SA-100", "DL", 189.9],
    absentCodes: ["SA-200", "SA-300", "SA-999"],
    observations: { count: stations.length, stationCodes: stations.map((station) => station.stationCode), prices: stations[0]?.prices || {} },
  });
}

function assertGlobalInvariants() {
  const providers = [
    ["nsw", assertNswMalformedPayload().observations],
    ["tas", assertTasMalformedPayload().observations],
    ["wa", assertWaMalformedPayload().observations],
    ["vic", assertVicMalformedPayload().observations],
    ["qld", assertQldMalformedPayload().observations],
    ["sa", assertSaMalformedPayload().observations],
  ];
  const snapshots = {
    nsw: normaliseNswPayload({ stations: [stationRow("A", "A", "A", 0, 0)], prices: [priceRow("A", "U91", 1)] }),
    tas: normaliseTasPayload({ stations: [{ ...stationRow("A", "A", "A", 0, 0), state: "TAS" }], prices: [{ ...priceRow("A", "U91", 1), state: "TAS" }] }),
    wa: normaliseWaFuelWatchPayloads([{ fuelCode: "U91", xml: waXml([waItem({ lat: "0", lon: "0", price: "1" })]) }]),
    vic: normaliseVicPayload({ fuelPriceDetails: [{ fuelStation: { id: "A", latitude: 0, longitude: 0 }, fuelPrices: [{ fuelTypeCode: "U91", price: 1 }] }] }),
    qld: normaliseQldPayload(fppSites("QLD", [fppSite("A", "A", "1", 0, 0)]), fppPrices([fppPrice("A", 2, 1)]), fppBrands(), fppRegions("Queensland", "Brisbane", "10")),
    sa: normaliseSaPayload(fppSites("SA", [fppSite("A", "A", "1", 0, 0)]), fppPrices([fppPrice("A", 2, 1)]), fppBrands(), fppRegions("South Australia", "Adelaide", "20")),
  };
  const failures = [];
  for (const [provider, stations] of Object.entries(snapshots)) {
    for (const station of stations) {
      if (!station.lat && !station.lon) failures.push(`${provider} returned null-island station ${station.stationCode}`);
      for (const [fuel, price] of Object.entries(station.prices || {})) {
        if (!Number.isFinite(Number(price))) failures.push(`${provider} returned non-finite ${fuel} price for ${station.stationCode}`);
      }
    }
  }
  return { failures, observations: Object.fromEntries(providers) };
}

function providerChecks(provider, stations, { expectedCodes = [], absentCodes = [], expectedPrice, observations = {} }) {
  const byCode = new Map(stations.map((station) => [station.stationCode, station]));
  const failures = checks([
    [Array.isArray(stations), `${provider} did not return an array`],
    [stations.every((station) => Object.keys(station.prices || {}).length > 0), `${provider} returned station without prices`],
    [stations.every((station) => Number.isFinite(station.lat) && Number.isFinite(station.lon) && (station.lat || station.lon)), `${provider} returned station with unusable coordinates`],
    [stations.every((station) => Object.values(station.prices || {}).every((price) => Number.isFinite(Number(price)))), `${provider} returned non-finite price`],
    ...expectedCodes.map((code) => [byCode.has(code), `${provider} missing expected station ${code}`]),
    ...absentCodes.map((code) => [!byCode.has(code), `${provider} should have dropped ${code}`]),
  ]);
  if (expectedPrice) {
    const [code, fuel, expected] = expectedPrice;
    failures.push(...checks([
      [byCode.get(code)?.prices?.[fuel] === expected, `${provider} expected ${code} ${fuel} ${expected}, got ${byCode.get(code)?.prices?.[fuel]}`],
    ]));
  }
  return { failures, observations };
}

function stationRow(code, name, brand, lat, lon, address = "") {
  return { code, name, brand, latitude: lat, longitude: lon, address };
}

function priceRow(stationcode, fueltype, price, lastupdated = "2026-06-29T00:00:00Z") {
  return { stationcode, fueltype, price, lastupdated };
}

function waXml(items) {
  return `<rss><channel>${items.join("\n")}</channel></rss>`;
}

function waItem({ brand = "Metro", name = "WA Station", address = "1 Test St", location = "Perth", price = "171.5", lat = "-31.9523", lon = "115.8613", date = "29/06/2026" } = {}) {
  return `<item><title>${price}: ${name}</title><brand>${brand}</brand><date>${date}</date><price>${price}</price><trading-name>${name}</trading-name><location>${location}</location><address>${address}</address><latitude>${lat}</latitude><longitude>${lon}</longitude><site-features>Open 24 hours</site-features><restrictions></restrictions></item>`;
}

function fppSites(state, rows) {
  return { S: rows.map((row) => ({ ...row, State: state })) };
}

function fppSite(S, N, B, Lat, Lng, A = "1 Test St", P = "4000", G1 = "10") {
  return { S, N, B, Lat, Lng, A, P, G1, M: "2026-06-29T00:00:00" };
}

function fppPrices(rows) {
  return { SitePrices: rows };
}

function fppPrice(SiteId, FuelId, Price) {
  return { SiteId, FuelId, Price, TransactionDateUtc: "2026-06-29T00:00:00" };
}

function fppBrands() {
  return { Brands: [{ BrandId: "1", Name: "Metro" }, { BrandId: "2", Name: "Ghost" }] };
}

function fppRegions(stateName, regionName, id) {
  return { GeographicRegions: [{ GeoRegionId: id, GeoRegionLevel: 1, Name: regionName }, { GeoRegionId: "1", GeoRegionLevel: 0, Name: stateName }] };
}

function checks(items) {
  return items.filter(([ok]) => !ok).map(([, message]) => message).filter(Boolean);
}

function renderReport(summary, results) {
  return `# State fuel provider malformed-payload chaos stress

Run: ${summary.runId}

## Summary

- Cases: ${summary.cases}
- Passed: ${summary.passed}
- Failed: ${summary.failed}

## Failures

${results.filter((result) => result.failures.length).map((result) => `- ${result.id}: ${result.failures.join("; ")}`).join("\n") || "- None"}

## Observations

${results.map((result) => `- ${result.id}: ${JSON.stringify(result.observations)}`).join("\n")}

## Brutal read

${summary.failed ? "Malformed provider payloads still leak unsafe data. Do not treat state-provider resilience as release-safe until fixed and rerun." : "State fuel provider normalisers held against malformed payloads for NSW, TAS, WA, VIC, QLD and SA. The strongest remaining risk is live provider schema drift beyond these known contract families."}
`;
}
