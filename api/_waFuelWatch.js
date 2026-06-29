const { distanceKm } = require("./_geoMath");
const { hasWaProvider, pointInWa } = require("./_capabilities");
const {
  appendWarning,
  providerCooldownError,
  providerCooldownWarning,
  providerResult,
  providerTimeoutMs,
  recordProviderFailure,
  recordProviderSuccess,
  singleFlight,
  staleProviderResult,
  staleRevalidatingProviderResult,
  withProviderRetries,
} = require("./_providerRuntime");

const DEFAULT_CACHE_SECONDS = 300;
const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";
const DEFAULT_WA_FUELWATCH_RSS_URL = "https://www.fuelwatch.wa.gov.au/fuelwatch/fuelWatchRSS";
const WA_DEFAULT_MAX_REGION_IDS = 18;
const WA_DEFAULT_FETCH_CONCURRENCY = 6;
const WA_FUELWATCH_PRODUCTS = [
  ["U91", 1],
  ["P95", 2],
  ["DL", 4],
  ["LPG", 5],
  ["P98", 6],
  ["E85", 10],
  ["PDL", 11],
];
const WA_FUELWATCH_PRODUCT_BY_CODE = new Map(WA_FUELWATCH_PRODUCTS);
const WA_DEFAULT_METRO_REGION_IDS = [25, 26, 27];
const WA_FUELWATCH_REGIONS = [
  { id: 1, name: "Boulder", lat: -30.782, lon: 121.491 },
  { id: 2, name: "Broome", lat: -17.961, lon: 122.236 },
  { id: 3, name: "Busselton Townsite", lat: -33.652, lon: 115.345 },
  { id: 4, name: "Carnarvon", lat: -24.884, lon: 113.657 },
  { id: 5, name: "Collie", lat: -33.36, lon: 116.156 },
  { id: 6, name: "Dampier", lat: -20.662, lon: 116.711 },
  { id: 7, name: "Esperance", lat: -33.86, lon: 121.889 },
  { id: 8, name: "Kalgoorlie", lat: -30.749, lon: 121.466 },
  { id: 9, name: "Karratha", lat: -20.736, lon: 116.846 },
  { id: 10, name: "Kununurra", lat: -15.779, lon: 128.741 },
  { id: 11, name: "Narrogin", lat: -32.933, lon: 117.178 },
  { id: 12, name: "Northam", lat: -31.653, lon: 116.671 },
  { id: 13, name: "Port Hedland", lat: -20.312, lon: 118.61 },
  { id: 14, name: "South Hedland", lat: -20.407, lon: 118.6 },
  { id: 15, name: "Albany", lat: -35.027, lon: 117.884 },
  { id: 16, name: "Bunbury", lat: -33.327, lon: 115.641 },
  { id: 17, name: "Geraldton", lat: -28.777, lon: 114.614 },
  { id: 18, name: "Mandurah", lat: -32.536, lon: 115.743 },
  { id: 19, name: "Capel", lat: -33.558, lon: 115.562 },
  { id: 20, name: "Dardanup", lat: -33.397, lon: 115.755 },
  { id: 21, name: "Greenough", lat: -28.956, lon: 114.735 },
  { id: 22, name: "Harvey", lat: -33.08, lon: 115.893 },
  { id: 23, name: "Murray", lat: -32.629, lon: 115.874 },
  { id: 24, name: "Waroona", lat: -32.844, lon: 115.923 },
  { id: 25, name: "Metro North of River", lat: -31.89, lon: 115.84, metro: true },
  { id: 26, name: "Metro South of River", lat: -32.08, lon: 115.86, metro: true },
  { id: 27, name: "Metro East/Hills", lat: -31.98, lon: 116.03, metro: true },
  { id: 28, name: "Augusta Margaret River", lat: -33.953, lon: 115.073 },
  { id: 29, name: "Busselton Shire", lat: -33.652, lon: 115.345 },
  { id: 30, name: "Bridgetown Greenbushes", lat: -33.959, lon: 116.137 },
  { id: 31, name: "Donnybrook Balingup", lat: -33.572, lon: 115.824 },
  { id: 32, name: "Manjimup", lat: -34.241, lon: 116.146 },
  { id: 33, name: "Cataby", lat: -30.744, lon: 115.551 },
  { id: 34, name: "Coolgardie", lat: -30.954, lon: 121.163 },
  { id: 35, name: "Cunderdin", lat: -31.652, lon: 117.242 },
  { id: 36, name: "Dalwallinu", lat: -30.278, lon: 116.66 },
  { id: 37, name: "Denmark", lat: -34.961, lon: 117.353 },
  { id: 38, name: "Derby", lat: -17.303, lon: 123.629 },
  { id: 39, name: "Dongara", lat: -29.252, lon: 114.932 },
  { id: 40, name: "Exmouth", lat: -21.93, lon: 114.126 },
  { id: 41, name: "Fitzroy Crossing", lat: -18.197, lon: 125.567 },
  { id: 42, name: "Jurien", lat: -30.305, lon: 115.039 },
  { id: 43, name: "Kambalda", lat: -31.206, lon: 121.66 },
  { id: 44, name: "Kellerberrin", lat: -31.634, lon: 117.72 },
  { id: 45, name: "Kojonup", lat: -33.833, lon: 117.159 },
  { id: 46, name: "Meekatharra", lat: -26.593, lon: 118.495 },
  { id: 47, name: "Moora", lat: -30.64, lon: 116.008 },
  { id: 48, name: "Mount Barker", lat: -34.63, lon: 117.666 },
  { id: 49, name: "Newman", lat: -23.357, lon: 119.735 },
  { id: 50, name: "Norseman", lat: -32.197, lon: 121.779 },
  { id: 51, name: "Ravensthorpe", lat: -33.582, lon: 120.046 },
  { id: 53, name: "Tammin", lat: -31.641, lon: 117.484 },
  { id: 54, name: "Williams", lat: -33.027, lon: 116.88 },
  { id: 55, name: "Wubin", lat: -30.106, lon: 116.629 },
  { id: 56, name: "York", lat: -31.888, lon: 116.769 },
  { id: 57, name: "Regans Ford", lat: -30.98, lon: 115.695 },
  { id: 58, name: "Meckering", lat: -31.632, lon: 117.008 },
  { id: 59, name: "Wundowie", lat: -31.76, lon: 116.379 },
  { id: 60, name: "North Bannister", lat: -32.582, lon: 116.451 },
  { id: 61, name: "Munglinup", lat: -33.714, lon: 120.865 },
  { id: 62, name: "Northam Shire", lat: -31.653, lon: 116.671 },
  { id: 63, name: "Bodallin", lat: -31.37, lon: 118.861 },
];

function createWaFuelWatchAdapter({ decorateStation = (station) => station } = {}) {
  const waLiveCache = {
    entries: new Map(),
    payloads: new Map(),
    lastError: "",
  };

  async function loadLiveWaStations({ forceRefresh = false, points = [], radiusKm = 0, fuels = [], now = new Date() } = {}) {
    if (!hasWaProvider()) throw new Error("WA FuelWatch provider is disabled");
    const plan = waFuelWatchRequestPlan({ points, radiusKm, fuels, now });
    if (!plan.products.length) {
      return providerResult("wa", {
        stations: [],
        cacheHit: true,
        cacheAgeSeconds: 0,
        cacheMode: "unsupported_fuel",
        degraded: true,
        error: "",
        warning: `WA FuelWatch does not publish ${plan.requestedFuelCodes.join("/") || "the requested fuel"} in the current Fuel Path product map.`,
        metadata: plan,
      });
    }

    const cacheKey = [
      plan.regionIds.join(","),
      plan.products.map((item) => item.fuelCode).join(","),
      plan.days.join(","),
    ].join("|");
    const cached = waLiveCache.entries.get(cacheKey);
    const ageMs = Date.now() - Number(cached?.loadedAtMs || 0);
    const ttlMs = cacheSeconds() * 1000;
    const flightKey = `provider:wa:${cacheKey}`;
    const refresh = () =>
      withProviderRetries("wa", async () => {
        const requests = plan.regionIds.flatMap((regionId) =>
          plan.products.flatMap(({ fuelCode, product }) =>
            plan.days.map((day) => ({
              day,
              fuelCode,
              product,
              regionId,
            })),
          ),
        );
        const productPayloads = (await mapWithConcurrency(requests, waFetchConcurrency(), (request) => fetchWaFuelWatchPayload(request, { forceRefresh }))).filter(
          (payload) => payload.xml,
        );
        if (!productPayloads.length && requests.length) {
          throw new Error("WA FuelWatch returned no usable regional payloads");
        }
        const stations = normaliseWaFuelWatchPayloads(productPayloads).map(decorateStation);
        const cacheHits = productPayloads.filter((payload) => payload.cacheHit).length;
        const warning = waFuelWatchPlanWarning(plan);
        waLiveCache.entries.set(cacheKey, {
          stations,
          warning,
          metadata: plan,
          loadedAtMs: Date.now(),
        });
        waLiveCache.lastError = "";
        return providerResult("wa", {
          stations,
          cacheHit: Boolean(productPayloads.length) && cacheHits === productPayloads.length,
          cacheAgeSeconds: 0,
          cacheMode: cacheHits && cacheHits === productPayloads.length ? "fresh" : "refreshed",
          error: "",
          warning,
          metadata: plan,
        });
      });
    if (!forceRefresh && cached?.stations && ageMs < ttlMs) {
      return providerResult("wa", {
        stations: cached.stations,
        cacheHit: true,
        cacheAgeSeconds: Math.round(ageMs / 1000),
        cacheMode: "fresh",
        error: "",
        warning: cached.warning || "",
        metadata: cached.metadata || plan,
      });
    }
    if (!forceRefresh && cached?.stations?.length) {
      refreshProviderCacheInBackground("wa", flightKey, refresh, waLiveCache);
      return staleRevalidatingProviderResult("wa", cached, {
        warning: appendWarning(cached.warning, "WA cached fuel prices are stale; refreshing in background."),
        metadata: cached.metadata || plan,
      });
    }

    const cooldownError = providerCooldownError("wa");
    if (cooldownError) {
      if (cached?.stations?.length) {
        return staleProviderResult("wa", cached, cooldownError, {
          warning: appendWarning(cached.warning, providerCooldownWarning("wa")),
          metadata: cached.metadata || plan,
        });
      }
      throw cooldownError;
    }

    try {
      return await singleFlight(flightKey, refresh, providerFlightHooks("wa", waLiveCache));
    } catch (error) {
      waLiveCache.lastError = error instanceof Error ? error.message : String(error);
      if (cached?.stations?.length) {
        return staleProviderResult("wa", cached, error, {
          warning: cached.warning || "WA FuelWatch provider unavailable; using stale cached prices.",
          metadata: cached.metadata || plan,
        });
      }
      throw error;
    }
  }

  async function fetchWaFuelWatchPayload({ product, regionId, fuelCode, day = "today" }, { forceRefresh = false } = {}) {
    const cacheKey = `${regionId || "all"}:${product}:${day}`;
    const cached = waLiveCache.payloads.get(cacheKey);
    const ageMs = Date.now() - Number(cached?.loadedAtMs || 0);
    if (!forceRefresh && cached?.xml && ageMs < cacheSeconds() * 1000) {
      return {
        day,
        fuelCode,
        product,
        regionId,
        xml: cached.xml,
        cacheHit: true,
      };
    }

    const xml = await fetchWaFuelWatchRss(product, regionId, day);
    waLiveCache.payloads.set(cacheKey, {
      xml,
      loadedAtMs: Date.now(),
    });
    return {
      day,
      fuelCode,
      product,
      regionId,
      xml,
      cacheHit: false,
    };
  }

  return {
    loadLiveWaStations,
    normaliseWaFuelWatchPayloads,
    waFuelWatchRequestPlan,
    waRegionPlanForArea,
    waTomorrowPriceAvailable,
  };
}

async function fetchWaFuelWatchRss(product, regionId, day = "today") {
  const baseUrl = process.env.WA_FUELWATCH_RSS_URL || DEFAULT_WA_FUELWATCH_RSS_URL;
  const url = new URL(baseUrl);
  url.searchParams.set("Product", String(product));
  if (regionId) url.searchParams.set("Region", String(regionId));
  url.searchParams.set("Day", day === "tomorrow" ? "tomorrow" : "today");
  try {
    return await fetchText(url.toString(), { timeoutMs: providerTimeoutMs("wa", 30000) });
  } catch (error) {
    if (!regionId) throw error;
    console.warn?.(
      `WA FuelWatch region ${regionId} product ${product} unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return "";
  }
}

function waFuelWatchRequestPlan({ points = [], radiusKm = 0, fuels = [], now = new Date() } = {}) {
  const regionPlan = waRegionPlanForArea(points, radiusKm);
  const products = waFuelWatchProductsForRequest(fuels);
  const days = ["today"];
  if (waTomorrowPriceAvailable(now) && process.env.FUEL_PATH_WA_FETCH_TOMORROW !== "0") days.push("tomorrow");
  return {
    ...regionPlan,
    days,
    products,
    requestedFuelCodes: requestedFuelCodes(fuels),
    requestCount: regionPlan.regionIds.length * products.length * days.length,
    fetchConcurrency: waFetchConcurrency(),
  };
}

function waRegionPlanForArea(points = [], radiusKm = 0) {
  const waPoints = samplePointsForProvider(points.filter(pointInWa), 32);
  const maxRegionIds = waMaxRegionIds();
  if (!waPoints.length) {
    return {
      regionIds: [...WA_DEFAULT_METRO_REGION_IDS],
      capped: false,
      maxRegionIds,
      sampledPointCount: 0,
      matchedRegionCount: WA_DEFAULT_METRO_REGION_IDS.length,
      defaultedToMetro: true,
    };
  }

  const byId = new Map();
  const perth = { lat: -31.9523, lon: 115.8613 };
  const searchKm = Math.max(35, Math.min(160, Number(radiusKm || 0) * 2));
  for (let pointIndex = 0; pointIndex < waPoints.length; pointIndex += 1) {
    const point = waPoints[pointIndex];
    if (distanceKm(point, perth) <= 85) {
      for (const id of WA_DEFAULT_METRO_REGION_IDS) addWaRegionCandidate(byId, id, 0, pointIndex);
    }
    const ranked = WA_FUELWATCH_REGIONS.map((region) => ({
      region,
      distance: distanceKm(point, region),
    })).sort((left, right) => left.distance - right.distance);

    if (ranked[0]) addWaRegionCandidate(byId, ranked[0].region.id, ranked[0].distance, pointIndex);
    for (const item of ranked) {
      if (item.distance <= searchKm) addWaRegionCandidate(byId, item.region.id, item.distance, pointIndex);
    }
  }

  const rankedRegionIds = [...byId.values()]
    .sort((left, right) => left.score - right.score || left.id - right.id)
    .map((item) => item.id);
  const regionIds = rankedRegionIds.slice(0, maxRegionIds).sort((left, right) => left - right);
  return {
    regionIds,
    capped: rankedRegionIds.length > maxRegionIds,
    maxRegionIds,
    sampledPointCount: waPoints.length,
    matchedRegionCount: rankedRegionIds.length,
    defaultedToMetro: false,
  };
}

function addWaRegionCandidate(byId, id, distance, pointIndex) {
  const existing = byId.get(id);
  const score = Number(distance) + pointIndex * 0.02;
  if (!existing || score < existing.score) {
    byId.set(id, { id, score });
  }
}

function waFuelWatchProductsForRequest(fuels = []) {
  const codes = requestedFuelCodes(fuels);
  const usableCodes = codes.length ? codes : WA_FUELWATCH_PRODUCTS.map(([fuelCode]) => fuelCode);
  const products = [];
  const seen = new Set();
  for (const fuelCode of usableCodes) {
    const product = WA_FUELWATCH_PRODUCT_BY_CODE.get(fuelCode);
    if (product === undefined || seen.has(fuelCode)) continue;
    seen.add(fuelCode);
    products.push({ fuelCode, product });
  }
  return products;
}

function requestedFuelCodes(fuels = []) {
  return [...new Set((Array.isArray(fuels) ? fuels : [fuels]).map((fuel) => String(fuel || "").trim().toUpperCase()).filter(Boolean))];
}

function waTomorrowPriceAvailable(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return false;
  const awstMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + 8 * 60;
  const minutesToday = ((awstMinutes % 1440) + 1440) % 1440;
  return minutesToday >= 14 * 60 + 30;
}

function waFuelWatchPlanWarning(plan) {
  const warnings = [];
  if (plan.capped) {
    warnings.push(`WA FuelWatch request budget selected ${plan.regionIds.length} of ${plan.matchedRegionCount} matched regions.`);
  }
  if (!plan.days.includes("tomorrow")) {
    warnings.push("WA tomorrow locked prices are checked after 2:30pm AWST.");
  }
  return warnings.join(" ");
}

function normaliseWaFuelWatchPayloads(productPayloads) {
  const stations = new Map();
  for (const { fuelCode, xml, day = "today" } of productPayloads) {
    for (const item of waFuelWatchItems(xml)) {
      const lat = Number(item.latitude);
      const lon = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || (!lat && !lon)) continue;
      const stationCode = waStationCode(item);
      const updatedAt = normaliseWaDate(item.date);
      const existing =
        stations.get(stationCode) ||
        {
          stationCode,
          name: item["trading-name"] || item.title?.replace(/^[0-9.]+:\s*/, "") || stationCode,
          brand: item.brand || "Unknown",
          suburb: titleCase(item.location || ""),
          address: [item.address, item.location, "WA"].filter(Boolean).join(", "),
          phone: stationPhone(item),
          lat,
          lon,
          openNow: waOpenNow(item["site-features"]),
          membershipRequired: waMembershipRequired(item.restrictions),
          updatedAt: day === "today" ? updatedAt : undefined,
          source: "api_wa_fuelwatch",
          prices: {},
          futurePrices: {},
          discounts: [],
        };
      const price = Number(item.price);
      if (fuelCode && Number.isFinite(price) && day === "today") existing.prices[fuelCode] = price;
      if (fuelCode && Number.isFinite(price) && day === "tomorrow") {
        existing.futurePrices.tomorrow = existing.futurePrices.tomorrow || {
          effectiveFrom: updatedAt,
          prices: {},
          label: "WA locked tomorrow price",
        };
        existing.futurePrices.tomorrow.prices[fuelCode] = price;
        if (updatedAt && (!existing.futurePrices.tomorrow.effectiveFrom || updatedAt > existing.futurePrices.tomorrow.effectiveFrom)) {
          existing.futurePrices.tomorrow.effectiveFrom = updatedAt;
        }
      }
      if (day === "today" && updatedAt && (!existing.updatedAt || updatedAt > String(existing.updatedAt))) {
        existing.updatedAt = updatedAt;
      }
      stations.set(stationCode, existing);
    }
  }
  return [...stations.values()].filter((station) => Object.keys(station.prices || {}).length);
}

function waFuelWatchItems(xml) {
  const cleaned = String(xml || "").replace(/^\uFEFF/, "");
  const matches = cleaned.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  return [...matches].map((match) => {
    const body = match[1];
    const item = {};
    for (const tag of [
      "title",
      "description",
      "brand",
      "date",
      "price",
      "trading-name",
      "location",
      "address",
      "phone",
      "latitude",
      "longitude",
      "site-features",
      "restrictions",
    ]) {
      item[tag] = xmlDecode(firstXmlTagValue(body, tag));
    }
    return item;
  });
}

function firstXmlTagValue(xml, tag) {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = pattern.exec(xml);
  return match ? match[1] : "";
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function waStationCode(item) {
  const raw = `${item.brand || ""}|${item["trading-name"] || ""}|${item.address || ""}|${item.location || ""}`;
  const slug = raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `WA-${slug || `${item.latitude}-${item.longitude}`}`;
}

function normaliseWaDate(value) {
  if (!value) return undefined;
  const text = String(value).trim();
  const parsed = new Date(`${text}T06:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function waOpenNow(siteFeatures) {
  const text = String(siteFeatures || "");
  if (/open\s+24\s+hours/i.test(text)) return true;
  return undefined;
}

function waMembershipRequired(restrictions) {
  return /member|membership|card\s+only/i.test(String(restrictions || ""));
}

function stationPhone(row) {
  const value =
    row.phone ||
    row.Phone ||
    row.telephone ||
    row.Telephone ||
    row.contactNumber ||
    row.ContactNumber ||
    row.phoneNumber ||
    row.PhoneNumber ||
    row.contact ||
    row.Contact;
  const phone = String(value || "").trim();
  return phone || undefined;
}

function titleCase(value) {
  return String(value).toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

async function fetchText(url, { headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": DEFAULT_USER_AGENT,
        ...headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Provider returned ${response.status}: ${text.slice(0, 120)}`);
    return text;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Provider request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function samplePointsForProvider(points, limit) {
  if (points.length <= limit) return points;
  const sampled = [];
  let previousIndex = -1;
  for (let index = 0; index < limit; index += 1) {
    const sourceIndex = Math.round((index / (limit - 1)) * (points.length - 1));
    if (sourceIndex !== previousIndex) {
      sampled.push(points[sourceIndex]);
      previousIndex = sourceIndex;
    }
  }
  return sampled;
}

function cacheSeconds() {
  return Math.max(60, Number(process.env.FUEL_PATH_LIVE_CACHE_SECONDS || DEFAULT_CACHE_SECONDS));
}

function waMaxRegionIds() {
  return boundedIntegerEnv("FUEL_PATH_WA_MAX_REGION_IDS", WA_DEFAULT_MAX_REGION_IDS, { min: 3, max: 40 });
}

function waFetchConcurrency() {
  return boundedIntegerEnv("FUEL_PATH_WA_FETCH_CONCURRENCY", WA_DEFAULT_FETCH_CONCURRENCY, { min: 1, max: 12 });
}

function boundedIntegerEnv(name, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function providerFlightHooks(provider, cache) {
  return {
    onSuccess: () => recordProviderSuccess(provider),
    onFailure: (error) => {
      recordProviderFailure(provider, error);
      if (cache) cache.lastError = error instanceof Error ? error.message : String(error);
    },
  };
}

function refreshProviderCacheInBackground(provider, flightKey, refresh, cache) {
  void singleFlight(flightKey, refresh, providerFlightHooks(provider, cache)).catch((error) => {
    if (cache) cache.lastError = error instanceof Error ? error.message : String(error);
  });
}

module.exports = {
  createWaFuelWatchAdapter,
};
