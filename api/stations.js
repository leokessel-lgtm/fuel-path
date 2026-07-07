const {
  distanceKm,
  boolParam,
  loadStationData,
  methodAllowed,
  pointInNt,
  recordPredictionMarketObservation,
  sendJson,
  setParam,
  stationPayload,
  stringParam,
} = require("./_backend");
const { publicErrorMessage } = require("./_publicErrors");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  try {
    const centre = {
      lat: coordinateParam(req.query.lat, "lat", -90, 90),
      lon: coordinateParam(req.query.lon, "lon", -180, 180),
      label: stringParam(req.query.label, "Map centre"),
    };
    const fuel = stringParam(req.query.fuel, "U91").toUpperCase();
    const radiusKm = boundedNumberParam(req.query.radiusKm, "radiusKm", 8, { min: 0.5, max: 100 });
    const limit = Math.round(boundedNumberParam(req.query.limit, "limit", 160, { min: 1, max: 420 }));
    const includeClosed = boolParam(req.query.includeClosed);
    const includeMemberPrices = boolParam(req.query.includeMemberPrices);
    const brandFilter = boolParam(req.query.brandFilter);
    const brands = setParam(req.query.brands);
    const requestedSource = stringParam(req.query.source, "auto");
    const allowNtAlternativeFuels = ntNearbySearch({ requestedSource, centre });
    const providerRadiusKm = allowNtAlternativeFuels ? ntExpandedAlternativeRadiusKm(radiusKm) : radiusKm;
    const data = await loadStationData({
      requestedSource,
      forceRefresh: boolParam(req.query.forceRefresh),
      points: [centre],
      radiusKm: providerRadiusKm,
      fuels: allowNtAlternativeFuels ? [] : [fuel],
    });
    if (!allowNtAlternativeFuels) {
      recordPredictionMarketObservation({
        points: [centre],
        fuels: [fuel],
        data,
      }).catch(() => {});
    }
    const stationPool = data.stations
      .map((station) => ({
        ...station,
        distanceKm: distanceKm(centre, station),
      }))
      .filter((station) => {
        if (!includeClosed && station.openNow === false) return false;
        if (!includeMemberPrices && station.membershipRequired) return false;
        return true;
      });
    const allCandidateStations = brandFilter
      ? stationPool.filter((station) => stationMatchesBrandFilter(station, brands))
      : stationPool;
    const brandHiddenCount = brandFilter
      ? stationPool.filter((station) => station.distanceKm <= radiusKm && !stationMatchesBrandFilter(station, brands)).length
      : 0;
    const candidateStations = allCandidateStations.filter((station) => station.distanceKm <= radiusKm);
    const exactStations = candidateStations
      .filter((station) => station.prices?.[fuel])
      .sort((left, right) => Number(left.prices[fuel]) - Number(right.prices[fuel]) || left.distanceKm - right.distanceKm);
    const useAlternativeFuelResults = exactStations.length === 0 && ntLiveResult(data);
    const expandedRadiusKm = useAlternativeFuelResults ? ntExpandedAlternativeRadiusKm(radiusKm) : radiusKm;
    const alternativeCandidateStations = useAlternativeFuelResults
      ? candidateStations.length
        ? candidateStations
        : allCandidateStations.filter((station) => station.distanceKm <= expandedRadiusKm)
      : [];
    const expandedAlternativeRadius = useAlternativeFuelResults && !candidateStations.length && alternativeCandidateStations.length > 0;
    const stations = useAlternativeFuelResults
      ? alternativeCandidateStations
        .map((station) => ({
          ...station,
          matchedFuel: bestAvailableFuel(station.prices || {}, fuel),
        }))
        .filter((station) => station.matchedFuel)
        .sort((left, right) => left.distanceKm - right.distanceKm || Number(left.prices[left.matchedFuel]) - Number(right.prices[right.matchedFuel]))
      : exactStations;
    const selected = stations.slice(0, limit);
    const alternativeFuelCodes = useAlternativeFuelResults
      ? [...new Set(stations.map((station) => station.matchedFuel).filter(Boolean))].sort()
      : [];
    const warning = [
      data.warning,
      useAlternativeFuelResults
        ? expandedAlternativeRadius
          ? `No ${fuel} prices were found within ${radiusKm} km in MyFuel NT; showing nearby stations with available fuel prices within ${expandedRadiusKm} km instead.`
          : `No ${fuel} prices were found nearby in MyFuel NT; showing nearby stations with available fuel prices instead.`
        : "",
    ].filter(Boolean).join(" ");

    sendJson(res, 200, {
      context: {
        fuel,
        requestedFuel: fuel,
        exactFuelMatch: !useAlternativeFuelResults,
        fuelMatchMode: useAlternativeFuelResults ? "alternative_available_fuel" : "exact",
        requestedFuelUnavailable: useAlternativeFuelResults,
        alternativeFuelCodes,
        alternativeRadiusKm: expandedAlternativeRadius ? expandedRadiusKm : radiusKm,
        expandedAlternativeRadius,
        source: data.source,
        provider: data.provider,
        capability: data.capability,
        regionCapabilities: data.regionCapabilities || [],
        radiusKm,
        centre,
        exactStationCount: exactStations.length,
        stationCount: stations.length,
        returnedCount: selected.length,
        brandFilter,
        brands: brandFilter ? Array.from(brands) : [],
        brandHiddenCount,
        generatedAt: new Date().toISOString(),
        cacheHit: data.cacheHit,
        cacheAgeSeconds: data.cacheAgeSeconds,
        cacheMode: data.cacheMode,
        degraded: Boolean(data.degraded),
        providerHealth: data.providerHealth || {},
        provenance: {
          source: data.source,
          provider: data.provider,
          cacheMode: data.cacheMode,
          degraded: Boolean(data.degraded),
          providerStatuses: providerStatuses(data.providerHealth),
        },
        warning,
      },
      stations: selected.map((station) => {
        const matchedFuel = station.matchedFuel || fuel;
        return {
          ...stationPayload(station, { fuel: matchedFuel, distanceKm: station.distanceKm }),
          requestedFuel: fuel,
          matchedFuel,
          exactFuelMatch: matchedFuel === fuel,
        };
      }),
    });
  } catch (error) {
    sendJson(res, 400, {
      error: publicErrorMessage(error, "nearby"),
    });
  }
};

function coordinateParam(value, name, min, max) {
  if (value === undefined || value === null || value === "") throw new Error(`${name} is required`);
  return boundedNumberParam(value, name, undefined, { min, max, clampMax: false });
}

function normaliseBrand(value) {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

function stationMatchesBrandFilter(station, brands) {
  const candidates = [station.brand, station.name].map(normaliseBrand).filter(Boolean);
  return Array.from(brands).some((brand) => {
    const normalised = normaliseBrand(brand);
    if (!normalised) return false;
    return candidates.some((candidate) => candidate === normalised || candidate.includes(normalised));
  });
}

function ntLiveResult(data) {
  const provider = String(data?.provider || data?.source || "");
  return provider.split("+").includes("api_nt") || provider === "api_nt";
}

function ntNearbySearch({ requestedSource, centre }) {
  const source = String(requestedSource || "").trim().toLowerCase();
  return source === "nt" || source === "api_nt" || source === "live" && pointInNt(centre) || source === "auto" && pointInNt(centre);
}

function ntExpandedAlternativeRadiusKm(radiusKm) {
  const value = Number(radiusKm || 0);
  return Math.round(Math.min(250, Math.max(value + 40, value * 1.5)) * 10) / 10;
}

function bestAvailableFuel(prices = {}, requestedFuel = "") {
  const fuelOrder = alternativeFuelOrder(requestedFuel);
  return fuelOrder.find((fuel) => Number.isFinite(Number(prices[fuel])));
}

function alternativeFuelOrder(requestedFuel) {
  const fuel = String(requestedFuel || "").toUpperCase();
  if (fuel === "P98") return ["P95", "U91", "DL", "PDL", "E10", "LPG"];
  if (fuel === "P95") return ["U91", "P98", "DL", "PDL", "E10", "LPG"];
  if (fuel === "U91") return ["P95", "P98", "E10", "DL", "PDL", "LPG"];
  if (fuel === "DL") return ["PDL", "U91", "P95", "P98", "E10", "LPG"];
  if (fuel === "PDL") return ["DL", "U91", "P95", "P98", "E10", "LPG"];
  return ["U91", "DL", "P95", "P98", "PDL", "E10", "LPG"];
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

function providerStatuses(providerHealth = {}) {
  return Object.fromEntries(
    Object.entries(providerHealth).map(([provider, health]) => [
      provider,
      {
        status: health?.status || "unknown",
        cacheMode: health?.cacheMode || "none",
        cacheAgeSeconds: Number.isFinite(Number(health?.cacheAgeSeconds)) ? Number(health.cacheAgeSeconds) : null,
      },
    ]),
  );
}
