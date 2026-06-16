const {
  distanceKm,
  boolParam,
  loadStationData,
  methodAllowed,
  sendJson,
  setParam,
  stationPayload,
  stringParam,
} = require("./_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  try {
    const centre = {
      lat: coordinateParam(req.query.lat, "lat", -90, 90),
      lon: coordinateParam(req.query.lon, "lon", -180, 180),
      label: stringParam(req.query.label, "Map centre"),
    };
    const fuel = stringParam(req.query.fuel, "U91");
    const radiusKm = boundedNumberParam(req.query.radiusKm, "radiusKm", 8, { min: 0.5, max: 100 });
    const limit = Math.round(boundedNumberParam(req.query.limit, "limit", 120, { min: 1, max: 120 }));
    const includeClosed = boolParam(req.query.includeClosed);
    const includeMemberPrices = boolParam(req.query.includeMemberPrices);
    const brandFilter = boolParam(req.query.brandFilter);
    const brands = setParam(req.query.brands);
    const data = await loadStationData({
      requestedSource: stringParam(req.query.source, "auto"),
      forceRefresh: boolParam(req.query.forceRefresh),
      points: [centre],
      radiusKm,
    });
    const stations = data.stations
      .map((station) => ({
        ...station,
        distanceKm: distanceKm(centre, station),
      }))
      .filter((station) => {
        if (!station.prices?.[fuel] || station.distanceKm > radiusKm) return false;
        if (!includeClosed && station.openNow === false) return false;
        if (!includeMemberPrices && station.membershipRequired) return false;
        if (brandFilter && !brands.has(String(station.brand || "Unknown"))) return false;
        return true;
      })
      .sort((left, right) => Number(left.prices[fuel]) - Number(right.prices[fuel]) || left.distanceKm - right.distanceKm);
    const selected = stations.slice(0, limit);

    sendJson(res, 200, {
      context: {
        fuel,
        source: data.source,
        provider: data.provider,
        radiusKm,
        centre,
        stationCount: stations.length,
        returnedCount: selected.length,
        generatedAt: new Date().toISOString(),
        cacheHit: data.cacheHit,
        cacheAgeSeconds: data.cacheAgeSeconds,
        warning: data.warning,
      },
      stations: selected.map((station) => stationPayload(station, { fuel, distanceKm: station.distanceKm })),
    });
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Invalid station query",
    });
  }
};

function coordinateParam(value, name, min, max) {
  if (value === undefined || value === null || value === "") throw new Error(`${name} is required`);
  return boundedNumberParam(value, name, undefined, { min, max, clampMax: false });
}

function boundedNumberParam(value, name, fallback, { min, max, clampMax = true }) {
  const raw = Array.isArray(value) ? value[0] : value;
  if ((raw === undefined || raw === null || raw === "") && fallback !== undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  if (parsed < min) throw new Error(`${name} must be at least ${min}`);
  if (!clampMax && parsed > max) throw new Error(`${name} must be at most ${max}`);
  return Math.min(parsed, max);
}
