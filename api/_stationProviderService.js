function createStationProviderService({
  sampleStations,
  decorateStation,
  singleFlight,
  liveProviderKeysForArea,
  capabilitiesForPoints,
  capabilityWarning,
  primaryCapability,
  pointInProviderCoverage,
  hasAnyLiveCredentials,
  termsConfirmed,
  providerRegistry,
  sampleSourceAllowed,
  productionRuntime = defaultProductionRuntime,
} = {}) {
  function loadSampleStations() {
    return sampleStations().map(decorateStation);
  }

  async function loadLiveStationsForArea({ forceRefresh = false, points = [], radiusKm = 0, providers: requestedProviders, fuels = [] } = {}) {
    const providers = requestedProviders || liveProviderKeysForArea(points, radiusKm);
    validateSelectedProviders(providers);
    const regionCapabilities = capabilitiesForPoints(points);
    if (!providers.length) {
      return {
        stations: [],
        source: "unsupported_region",
        provider: "unsupported_region",
        capability: primaryCapability(regionCapabilities),
        regionCapabilities,
        cacheHit: false,
        cacheAgeSeconds: 0,
        cacheMode: "none",
        degraded: false,
        providerHealth: {},
        warning: capabilityWarning(regionCapabilities),
      };
    }

    const stations = [];
    const loadedProviders = [];
    const errors = [];
    const warnings = [];
    const providerHealthMap = {};
    const cacheModes = new Set();
    let cacheHit = true;
    let maxCacheAgeSeconds = 0;
    let degraded = false;

    const providerResults = await Promise.all(
      providers.map(async (provider) => {
        try {
          const result = await singleFlight(liveProviderFlightKey(provider, { forceRefresh, points, radiusKm, fuels }), async () => {
            enforceProviderTerms(provider);
            const registration = providerRegistry[provider];
            const live = await registration.load({ forceRefresh, points, radiusKm, fuels });
            return { loadedProvider: live ? registration.sourceId : "", live };
          });
          return { provider, loadedProvider: result.loadedProvider, live: result.live, error: "" };
        } catch (error) {
          return { provider, loadedProvider: "", live: null, error: error instanceof Error ? error.message : String(error) };
        }
      }),
    );

    for (const result of providerResults) {
      const { provider, loadedProvider, live, error } = result;
      if (error) {
        errors.push(`${provider}: ${error}`);
        providerHealthMap[provider] = unavailableProviderHealth(error);
        cacheHit = false;
        degraded = true;
        continue;
      }
      try {
        if (!live) continue;
        if (loadedProvider) loadedProviders.push(loadedProvider);
        stations.push(...live.stations);
        Object.assign(providerHealthMap, live.providerHealth || {});
        if (live.warning) warnings.push(live.warning);
        if (live.cacheMode) cacheModes.add(live.cacheMode);
        cacheHit = cacheHit && Boolean(live.cacheHit);
        if (Number.isFinite(Number(live.cacheAgeSeconds))) {
          maxCacheAgeSeconds = Math.max(maxCacheAgeSeconds, Number(live.cacheAgeSeconds));
        }
        degraded = degraded || Boolean(live.degraded || live.error || live.warning);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${provider}: ${message}`);
        providerHealthMap[provider] = unavailableProviderHealth(message);
        cacheHit = false;
        degraded = true;
      }
    }

    if (!stations.length && !loadedProviders.length) throw new Error(errors.join("; ") || "Live prices are not available for this area yet.");
    const byCode = new Map();
    for (const station of stations) byCode.set(String(station.stationCode), station);
    const cacheMode = cacheModes.has("stale") ? "stale" : cacheModes.has("refreshed") ? "refreshed" : cacheModes.has("fresh") ? "fresh" : "none";
    return {
      stations: [...byCode.values()],
      source: loadedProviders.join("+") || "live",
      provider: loadedProviders.join("+") || "live",
      capability: primaryCapability(regionCapabilities),
      regionCapabilities,
      cacheHit,
      cacheAgeSeconds: cacheHit ? maxCacheAgeSeconds : 0,
      cacheMode,
      degraded,
      providerHealth: providerHealthMap,
      warning: [...warnings, ...(errors.length ? ["Some live price sources are temporarily unavailable. Confirm prices before driving."] : [])].join(" "),
    };
  }

  async function loadStationData({ requestedSource = "auto", forceRefresh = false, points = [], radiusKm = 0, fuels = [] } = {}) {
    const source = resolveSource(requestedSource);
    if (source === "sample") return sampleResult(points);

    const requestedProvider = providerFromSource(source);
    if (requestedProvider && points.length && !points.some((point) => pointInProviderCoverage(requestedProvider, point))) {
      const regionCapabilities = capabilitiesForPoints(points);
      const warning = `Requested ${requestedProvider.toUpperCase()} fuel provider does not cover this area.`;
      return {
        stations: [], source: "unsupported_region", provider: requestedProvider,
        capability: primaryCapability(regionCapabilities), regionCapabilities,
        cacheHit: false, cacheAgeSeconds: 0, cacheMode: "none", degraded: true,
        providerHealth: { [requestedProvider]: { status: "unsupported_region", cacheMode: "none", cacheAgeSeconds: null, lastError: "", warning } },
        warning,
      };
    }

    try {
      return await loadLiveStationsForArea({ forceRefresh, points, radiusKm, fuels, providers: requestedProvider ? [requestedProvider] : undefined });
    } catch (error) {
      if (error?.name === "ProviderConfigurationError") throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (!sampleSourceAllowed()) {
        const provider = requestedProvider || "live";
        const regionCapabilities = capabilitiesForPoints(points);
        return {
          source: "live_unavailable", provider,
          capability: primaryCapability(regionCapabilities), regionCapabilities,
          stations: [], cacheHit: false, cacheAgeSeconds: 0, cacheMode: "none", degraded: true,
          providerHealth: { [provider]: unavailableProviderHealth(message) },
          warning: `Live fuel provider unavailable: ${message}`,
        };
      }
      return {
        source: "sample_fallback", provider: "public_demo_snapshot", capability: "fallback",
        regionCapabilities: capabilitiesForPoints(points), stations: loadSampleStations(),
        cacheHit: true, cacheAgeSeconds: null, cacheMode: "sample_fallback", degraded: true,
        providerHealth: { sample: { status: "degraded", cacheMode: "sample_fallback", cacheAgeSeconds: null, lastError: message, warning: "Live provider failed; serving demo fallback outside production." } },
        warning: `Live fuel provider unavailable: ${message}`,
      };
    }
  }

  function sampleResult(points) {
    const regionCapabilities = capabilitiesForPoints(points);
    if (!sampleSourceAllowed()) {
      return {
        source: "sample_disabled", provider: "public_demo_snapshot", capability: "fallback", regionCapabilities,
        stations: [], cacheHit: false, cacheAgeSeconds: null, cacheMode: "disabled", degraded: true,
        providerHealth: { sample: { status: "disabled", cacheMode: "disabled", cacheAgeSeconds: null, lastError: "", warning: "Demo fallback is disabled in production." } },
        warning: "Demo fallback is disabled in production; no sample prices were returned.",
      };
    }
    return {
      source: "sample", provider: "public_demo_snapshot", capability: "fallback", regionCapabilities,
      stations: loadSampleStations(), cacheHit: true, cacheAgeSeconds: null, cacheMode: "sample", degraded: true,
      providerHealth: { sample: { status: "degraded", cacheMode: "sample", cacheAgeSeconds: null, lastError: "", warning: "Demo data is not live fuel pricing." } },
      warning: points.length ? capabilityWarning(regionCapabilities.map((item) => ({ ...item, capability: "fallback" }))) : "",
    };
  }

  function resolveSource(source) {
    const value = source === "auto" || !source ? (hasAnyLiveCredentials() || !sampleSourceAllowed() ? "live" : "sample") : source;
    if (!["live", "sample", "nsw", "qld", "wa", "vic", "sa", "tas", "nt"].includes(value)) {
      throw new Error("source must be live, sample, nsw, qld, wa, vic, sa, tas, nt or auto");
    }
    return value;
  }

  function enforceProviderTerms(provider) {
    if (!productionRuntime()) return;
    if (provider === "qld" && !termsConfirmed.qld()) throw new Error("QLD Fuel Prices public usage, caching and attribution terms are not confirmed.");
    if (provider === "nsw" && !termsConfirmed.nswAct()) throw new Error("FuelCheck NSW/ACT public usage, caching and attribution terms are not confirmed.");
    if (provider === "tas" && !termsConfirmed.tas()) throw new Error("TAS FuelCheck public usage, caching and attribution terms are not confirmed.");
  }

  function validateSelectedProviders(providers) {
    for (const provider of providers) {
      const registration = providerRegistry?.[provider];
      if (!registration || typeof registration.load !== "function") {
        throw providerConfigurationError(`Selected provider ${provider} has no configured loader.`);
      }
      if (typeof registration.sourceId !== "string" || !registration.sourceId.trim()) {
        throw providerConfigurationError(`Selected provider ${provider} has no configured source ID.`);
      }
    }
  }

  return { loadStationData };
}

function providerConfigurationError(message) {
  const error = new Error(message);
  error.name = "ProviderConfigurationError";
  return error;
}

function liveProviderFlightKey(provider, { forceRefresh = false, points = [], radiusKm = 0, fuels = [] } = {}) {
  const pointKey = (points || []).map((point) => `${Number(point.lat || 0).toFixed(2)},${Number(point.lon || 0).toFixed(2)}`).join("|");
  const fuelKey = (fuels || []).map(String).sort().join(",");
  return ["live-provider", provider, forceRefresh ? "refresh" : "cached", Math.round(Number(radiusKm || 0)), fuelKey, pointKey].join(":");
}

function providerFromSource(source) {
  return ["nsw", "qld", "wa", "vic", "sa", "tas", "nt"].includes(source) ? source : "";
}

function unavailableProviderHealth(message) {
  return { status: "unavailable", cacheMode: "none", cacheAgeSeconds: null, lastError: message, warning: "" };
}

function defaultProductionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
}

module.exports = { createStationProviderService };
