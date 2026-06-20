const { addressIndexStatus } = require("./_addressIndex");
const { additionalLocalGeocodeHintStatus } = require("./_geocodeHints");
const { createLookupReadiness } = require("./_lookupReadiness");
const { regionalGeocodeHintStatus } = require("./_regionalGeocodeHints");
const {
  addressrApiKey,
  addressrBaseUrl,
  geoapifyApiKey,
  googlePlacesApiKey,
  hereApiKey,
  mapboxAccessToken,
} = require("./_providerCredentials");

const RECOMMENDED_GEOCODE_PROVIDER = "google_places_autocomplete_new";
const DEFAULT_PAID_FALLBACK_PROVIDER = "google";
const GEOCODE_PROVIDER_ALIASES = {
  auto: "auto",
  google: "google",
  google_places: "google",
  google_places_autocomplete_new: "google",
  addressr: "addressr",
  mapbox: "mapbox",
  here: "here",
  geoapify: "geoapify",
  nominatim: "nominatim",
};

function normaliseGeocodeProvider(value) {
  const provider = GEOCODE_PROVIDER_ALIASES[String(value || "auto").trim().toLowerCase()];
  if (!provider) throw new Error("provider must be auto, google, addressr, mapbox, here, geoapify or nominatim");
  return provider;
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
}

function paidGeocodeFallbackEnabled() {
  return boolEnv("FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED") || boolEnv("FUEL_PATH_GOOGLE_PLACES_FALLBACK_ENABLED");
}

function paidFallbackProvider() {
  const requested = String(process.env.FUEL_PATH_PAID_GEOCODE_FALLBACK_PROVIDER || DEFAULT_PAID_FALLBACK_PROVIDER)
    .trim()
    .toLowerCase();
  return GEOCODE_PROVIDER_ALIASES[requested] || DEFAULT_PAID_FALLBACK_PROVIDER;
}

function googlePlacesDailyCap() {
  const value = Number(process.env.FUEL_PATH_GOOGLE_PLACES_DAILY_CAP || 1000);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 1000;
}

function googlePlacesMinQueryLength() {
  const value = Number(process.env.FUEL_PATH_GOOGLE_PLACES_MIN_QUERY_LENGTH || 4);
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 4;
}

function googlePlacesKeyRestricted() {
  return boolEnv("FUEL_PATH_GOOGLE_PLACES_KEY_RESTRICTED");
}

function googlePlacesBudgetAlertConfirmed() {
  return boolEnv("FUEL_PATH_GOOGLE_PLACES_BUDGET_ALERT_CONFIRMED");
}

function geocodeProviderConfigured(provider) {
  if (provider === "google") return Boolean(googlePlacesApiKey());
  if (provider === "addressr") return Boolean(addressrBaseUrl());
  if (provider === "mapbox") return Boolean(mapboxAccessToken());
  if (provider === "here") return Boolean(hereApiKey());
  if (provider === "geoapify") return Boolean(geoapifyApiKey());
  return provider === "nominatim";
}

function selectGeocodeProvider(value, { allowFallback = false } = {}) {
  const provider = normaliseGeocodeProvider(value);
  if (provider === "auto") {
    if (paidGeocodeFallbackEnabled()) {
      const fallbackProvider = paidFallbackProvider();
      if (geocodeProviderConfigured(fallbackProvider)) return fallbackProvider;
    }
    return "nominatim";
  }
  if (provider === "google" && !paidGeocodeFallbackEnabled()) {
    if (allowFallback) return "nominatim";
    throw new Error("google geocoding requires FUEL_PATH_PAID_GEOCODE_FALLBACK_ENABLED");
  }
  if (geocodeProviderConfigured(provider)) return provider;
  if (allowFallback) return "nominatim";
  throw new Error(`${provider} geocoding is not configured`);
}

function createGeocodeProviderStatus({ builtInLocalHintCount = 0, googlePlacesQuotaStorage = null } = {}) {
  const requestedProvider = process.env.FUEL_PATH_GEOCODE_PROVIDER || "auto";
  const activeProvider = selectGeocodeProvider(requestedProvider, { allowFallback: true });
  const googlePlacesConfigured = Boolean(googlePlacesApiKey());
  const paidFallbackEnabled = paidGeocodeFallbackEnabled();
  const billableRequestsEnabled = activeProvider === "google" && googlePlacesConfigured;
  const status = {
    primaryProvider: "fuel_path_gnaf",
    activeProvider,
    activeMode: activeProvider === "nominatim" ? "validation" : "production_candidate",
    costMode: billableRequestsEnabled ? "billable_provider_enabled" : "no_cost_validation",
    billableRequestsEnabled,
    recommendedProductionProvider: RECOMMENDED_GEOCODE_PROVIDER,
    requestedProvider,
    strategy: "gnaf_first_local_then_controlled_external_fallback",
    supportedProviders: ["google", "addressr", "mapbox", "here", "geoapify", "nominatim"],
    fallbackProvider: "nominatim",
    externalFallbackProvider: activeProvider,
    paidFallbackEnabled,
    paidFallbackProvider: paidFallbackProvider(),
    googlePlacesDailyCap: googlePlacesDailyCap(),
    googlePlacesMinQueryLength: googlePlacesMinQueryLength(),
    googlePlacesKeyRestricted: googlePlacesKeyRestricted(),
    googlePlacesBudgetAlertConfirmed: googlePlacesBudgetAlertConfirmed(),
    googlePlacesQuotaStorage: googlePlacesQuotaStorage || {
      mode: "",
      configured: false,
      durable: false,
    },
    cachePolicy: {
      successfulLookupTtlSeconds: 21600,
      degradedLookupTtlSeconds: 60,
      exactAddressSkipsExternalProviders: true,
      paidFallbackFailClosed: true,
    },
    addressIndex: addressIndexStatus(),
    localHints: {
      builtInRecords: builtInLocalHintCount,
      ...additionalLocalGeocodeHintStatus(),
      ...regionalGeocodeHintStatus(),
      provider: "fuel_path_hint",
    },
    backendProxyRequired: true,
    sessionTokenRequired: activeProvider === "google",
    googlePlacesConfigured,
    addressrConfigured: Boolean(addressrBaseUrl()),
    addressrMode: addressrApiKey() ? "rapidapi" : addressrBaseUrl() ? "self_hosted" : "unconfigured",
    mapboxConfigured: Boolean(mapboxAccessToken()),
    hereConfigured: Boolean(hereApiKey()),
    geoapifyConfigured: Boolean(geoapifyApiKey()),
  };
  return {
    ...status,
    lookupReadiness: createLookupReadiness(status),
  };
}

module.exports = {
  RECOMMENDED_GEOCODE_PROVIDER,
  createGeocodeProviderStatus,
  googlePlacesDailyCap,
  googlePlacesBudgetAlertConfirmed,
  googlePlacesKeyRestricted,
  googlePlacesMinQueryLength,
  paidGeocodeFallbackEnabled,
  selectGeocodeProvider,
};
