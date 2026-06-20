const assert = require("node:assert/strict");
const test = require("node:test");

const {
  loadLiveWaStations,
  normaliseWaFuelWatchPayloads,
  waFuelWatchRequestPlan,
  waRegionPlanForArea,
  waTomorrowPriceAvailable,
} = require("../../api/_backend");

test("WA FuelWatch planner covers metro and regional WA without defaulting every query to Perth", () => {
  withEnv({ FUEL_PATH_WA_MAX_REGION_IDS: "18" }, () => {
    const perth = waRegionPlanForArea([{ lat: -31.9523, lon: 115.8613 }], 8);
    const broome = waRegionPlanForArea([{ lat: -17.961, lon: 122.236 }], 8);
    const nullarbor = waRegionPlanForArea([{ lat: -32.197, lon: 121.779 }], 8);

    assert.deepEqual(perth.regionIds.filter((id) => [25, 26, 27].includes(id)), [25, 26, 27]);
    assert.equal(broome.regionIds.includes(2), true);
    assert.equal(broome.regionIds.some((id) => [25, 26, 27].includes(id)), false);
    assert.equal(nullarbor.regionIds.includes(50), true);
  });
});

test("WA FuelWatch route planning caps broad regional request fan-out", () => {
  withEnv({ FUEL_PATH_WA_MAX_REGION_IDS: "6" }, () => {
    const longRoute = [
      { lat: -31.9523, lon: 115.8613 },
      { lat: -30.64, lon: 116.008 },
      { lat: -28.777, lon: 114.614 },
      { lat: -24.884, lon: 113.657 },
      { lat: -21.93, lon: 114.126 },
      { lat: -20.736, lon: 116.846 },
      { lat: -20.312, lon: 118.61 },
      { lat: -17.961, lon: 122.236 },
    ];
    const plan = waFuelWatchRequestPlan({
      points: longRoute,
      radiusKm: 80,
      fuels: ["U91"],
      now: new Date("2026-06-17T08:00:00Z"),
    });

    assert.equal(plan.capped, true);
    assert.equal(plan.regionIds.length, 6);
    assert.equal(plan.products.length, 1);
    assert.deepEqual(plan.days, ["today", "tomorrow"]);
    assert.equal(plan.requestCount, 12);
  });
});

test("WA FuelWatch tomorrow availability follows the 2:30pm AWST publication window", () => {
  assert.equal(waTomorrowPriceAvailable(new Date("2026-06-17T06:29:00Z")), false);
  assert.equal(waTomorrowPriceAvailable(new Date("2026-06-17T06:30:00Z")), true);
});

test("WA FuelWatch normalisation keeps today pump prices separate from tomorrow locked prices", () => {
  const todayXml = waRssItem({
    date: "2026-06-17",
    price: "148.9",
    title: "148.9: Vibe Charles St",
    tradingName: "Vibe Charles St",
  });
  const tomorrowXml = waRssItem({
    date: "2026-06-18",
    price: "169.9",
    title: "169.9: Vibe Charles St",
    tradingName: "Vibe Charles St",
  });

  const [station] = normaliseWaFuelWatchPayloads([
    { day: "today", fuelCode: "U91", xml: todayXml },
    { day: "tomorrow", fuelCode: "U91", xml: tomorrowXml },
  ]);

  assert.equal(station.prices.U91, 148.9);
  assert.equal(station.futurePrices.tomorrow.prices.U91, 169.9);
  assert.equal(station.updatedAt, "2026-06-16T22:00:00.000Z");
  assert.equal(station.futurePrices.tomorrow.effectiveFrom, "2026-06-17T22:00:00.000Z");
});

test("WA FuelWatch live loader requests only the requested fuel and caches region/product/day payloads", async () => {
  await withEnvAsync(
    {
      FUEL_PATH_WA_MAX_REGION_IDS: "6",
      FUEL_PATH_LIVE_CACHE_SECONDS: "600",
      FUEL_PATH_WA_FUELWATCH_ENABLED: "1",
    },
    async () => {
      const previousFetch = global.fetch;
      const urls = [];
      global.fetch = async (url) => {
        urls.push(String(url));
        const parsed = new URL(String(url));
        const day = parsed.searchParams.get("Day") || "today";
        const date = day === "tomorrow" ? "2026-06-18" : "2026-06-17";
        const price = day === "tomorrow" ? "169.9" : "148.9";
        return {
          ok: true,
          text: async () =>
            waRssItem({
              date,
              price,
              title: `${price}: Broome Fuel`,
              tradingName: "Broome Fuel",
              location: "BROOME",
              address: "1 Cable Beach Rd",
              latitude: "-17.961",
              longitude: "122.236",
            }),
        };
      };

      try {
        const first = await loadLiveWaStations({
          forceRefresh: true,
          points: [{ lat: -17.961, lon: 122.236 }],
          radiusKm: 8,
          fuels: ["U91"],
          now: new Date("2026-06-17T08:00:00Z"),
        });
        const second = await loadLiveWaStations({
          points: [{ lat: -17.961, lon: 122.236 }],
          radiusKm: 8,
          fuels: ["U91"],
          now: new Date("2026-06-17T08:00:00Z"),
        });

        assert.equal(first.stations.length, 1);
        assert.equal(first.stations[0].prices.U91, 148.9);
        assert.equal(first.stations[0].futurePrices.tomorrow.prices.U91, 169.9);
        assert.equal(urls.length, 2);
        assert.equal(urls.every((url) => new URL(url).searchParams.get("Product") === "1"), true);
        assert.deepEqual(
          urls.map((url) => new URL(url).searchParams.get("Day")).sort(),
          ["today", "tomorrow"],
        );
        assert.equal(second.cacheHit, true);
        assert.equal(urls.length, 2);
      } finally {
        global.fetch = previousFetch;
      }
    },
  );
});

test("WA FuelWatch cooldown serves stale cache instead of hammering a failing provider", async () => {
  await withEnvAsync(
    {
      FUEL_PATH_WA_MAX_REGION_IDS: "6",
      FUEL_PATH_LIVE_CACHE_SECONDS: "600",
      FUEL_PATH_PROVIDER_FAILURE_THRESHOLD: "2",
      FUEL_PATH_PROVIDER_COOLDOWN_SECONDS: "120",
      FUEL_PATH_WA_FUELWATCH_ENABLED: "1",
    },
    async () => {
      const previousFetch = global.fetch;
      const previousWarn = console.warn;
      let failProvider = false;
      let upstreamCalls = 0;
      console.warn = () => {};
      global.fetch = async (url) => {
        upstreamCalls += 1;
        if (failProvider) {
          return {
            ok: false,
            status: 503,
            text: async () => "provider unavailable",
          };
        }

        const parsed = new URL(String(url));
        const day = parsed.searchParams.get("Day") || "today";
        return {
          ok: true,
          text: async () =>
            waRssItem({
              date: day === "tomorrow" ? "2026-06-18" : "2026-06-17",
              price: day === "tomorrow" ? "169.9" : "148.9",
              title: "148.9: Broome Cooldown Fuel",
              tradingName: "Broome Cooldown Fuel",
              location: "BROOME",
              address: "1 Cable Beach Rd",
              latitude: "-17.961",
              longitude: "122.236",
            }),
        };
      };

      try {
        const request = {
          forceRefresh: true,
          points: [{ lat: -17.961, lon: 122.236 }],
          radiusKm: 8,
          fuels: ["U91"],
          now: new Date("2026-06-17T08:00:00Z"),
        };
        const seeded = await loadLiveWaStations(request);
        assert.equal(seeded.stations.length, 1);
        assert.equal(upstreamCalls, 2);

        failProvider = true;
        const [firstFailure, parallelFailure] = await Promise.all([
          loadLiveWaStations(request),
          loadLiveWaStations(request),
        ]);
        const callsAfterSharedFailure = upstreamCalls;
        const secondFailure = await loadLiveWaStations(request);
        const callsAfterCircuitOpened = upstreamCalls;
        const cooledDown = await loadLiveWaStations(request);

        assert.equal(firstFailure.cacheMode, "stale");
        assert.equal(parallelFailure.cacheMode, "stale");
        assert.equal(secondFailure.cacheMode, "stale");
        assert.equal(cooledDown.cacheMode, "stale");
        assert.equal(cooledDown.degraded, true);
        assert.match(cooledDown.warning, /cooling down/);
        assert.equal(callsAfterSharedFailure, 4);
        assert.equal(upstreamCalls, callsAfterCircuitOpened);
      } finally {
        global.fetch = previousFetch;
        console.warn = previousWarn;
      }
    },
  );
});

function waRssItem({
  date,
  price,
  title,
  tradingName,
  brand = "Vibe",
  location = "NORTH PERTH",
  address = "427 Charles St",
  phone = "(08) 9242 2704",
  latitude = "-31.92231200",
  longitude = "115.85026400",
}) {
  return `<?xml version="1.0"?><rss version="2.0"><channel><item>
    <title>${title}</title>
    <description>Address: ${address}, ${location}, Phone: ${phone}</description>
    <brand>${brand}</brand>
    <date>${date}</date>
    <price>${price}</price>
    <trading-name>${tradingName}</trading-name>
    <location>${location}</location>
    <address>${address}</address>
    <phone>${phone}</phone>
    <latitude>${latitude}</latitude>
    <longitude>${longitude}</longitude>
    <site-features>Open 24 hours</site-features>
    <restrictions></restrictions>
  </item></channel></rss>`;
}

function withEnv(values, fn) {
  const previous = setEnv(values);
  try {
    return fn();
  } finally {
    restoreEnv(previous);
  }
}

async function withEnvAsync(values, fn) {
  const previous = setEnv(values);
  try {
    return await fn();
  } finally {
    restoreEnv(previous);
  }
}

function setEnv(values) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === "") delete process.env[key];
    else process.env[key] = values[key];
  }
  return previous;
}

function restoreEnv(previous) {
  for (const key of Object.keys(previous)) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}
