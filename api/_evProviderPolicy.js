const { supportedEvProviders } = require("./_evOpenChargeMap");

const EV_PROVIDER_IDS = [
  "open_charge_map",
  "openweb_ninja",
  "api_ninjas",
  "plugshare",
  "here",
  "mapbox",
  "tomtom",
  "network_partner",
  "list",
];

function defaultEvProvider() {
  const configured = String(process.env.FUEL_PATH_EV_DEFAULT_PROVIDER || "").trim().toLowerCase();
  if (configured) return normaliseEvProvider(configured);
  if (process.env.API_NINJAS_API_KEY) return "api_ninjas";
  if (process.env.OPENWEB_NINJA_API_KEY) return "openweb_ninja";
  if (process.env.OPEN_CHARGE_MAP_API_KEY) return "open_charge_map";
  return "api_ninjas";
}

function normaliseEvProvider(value) {
  const provider = String(value || defaultEvProvider()).trim().toLowerCase();
  if (EV_PROVIDER_IDS.includes(provider)) return provider;
  throw new Error("provider must be open_charge_map, openweb_ninja, api_ninjas, plugshare, here, mapbox, tomtom, network_partner or list");
}

function evChargingStatus() {
  const provider = defaultEvProvider();
  const apiNinjasConfigured = Boolean(process.env.API_NINJAS_API_KEY);
  const openWebNinjaConfigured = Boolean(process.env.OPENWEB_NINJA_API_KEY);
  const openChargeMapConfigured = Boolean(process.env.OPEN_CHARGE_MAP_API_KEY);
  const configured = evProviderConfigured(provider);
  return {
    provider,
    configured,
    capability: configured ? "prototype_live_capable" : "prototype_not_configured",
    defaultProvider: provider,
    providerSelection: "api_ninjas_if_configured_else_openweb_ninja_if_configured_else_open_charge_map_if_configured_else_api_ninjas_not_configured",
    apiNinjasConfigured,
    openWebNinjaConfigured,
    openChargeMapConfigured,
    realTimeAvailability: false,
    liveAvailabilityClaimsAllowed: false,
    coverage: "EV charger directory search and sampled-route fallback. No live bay availability claims.",
    warning: configured
      ? "EV charger directory data is enabled, but power, tariff and live bay availability may be incomplete. Confirm in the charging network app before driving."
      : "No EV charger provider key is configured. API Ninjas is the default prototype path; add API_NINJAS_API_KEY for live directory results.",
    providers: supportedEvProviders(),
  };
}

function evProviderConfigured(provider) {
  if (provider === "api_ninjas") return Boolean(process.env.API_NINJAS_API_KEY);
  if (provider === "openweb_ninja") return Boolean(process.env.OPENWEB_NINJA_API_KEY);
  if (provider === "open_charge_map") return Boolean(process.env.OPEN_CHARGE_MAP_API_KEY);
  return false;
}

function fallbackEvProviders(provider) {
  const configured = String(process.env.FUEL_PATH_EV_CASCADE_PROVIDERS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map(normaliseEvProvider)
    .filter((item) => item !== "list");
  if (configured.length) return configured.filter((item) => item !== provider);
  return ["api_ninjas", "open_charge_map"].filter((item) => item !== provider);
}

module.exports = {
  defaultEvProvider,
  evChargingStatus,
  evProviderConfigured,
  fallbackEvProviders,
  normaliseEvProvider,
};
