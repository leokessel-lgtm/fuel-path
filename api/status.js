const {
  alertsStatus,
  cacheSeconds,
  geocodeProviderStatus,
  hasAnyLiveCredentials,
  hasLiveCredentials,
  hasQldCredentials,
  hasVicCredentials,
  hasWaProvider,
  methodAllowed,
  routeProviderStatus,
  sendJson,
} = require("./_backend");

module.exports = function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  sendJson(res, 200, {
    api: "fuel-path-hosted-backend-v1",
    credentialsConfigured: hasAnyLiveCredentials(),
    defaultSource: hasAnyLiveCredentials() ? "live" : "sample",
    fuelProviders: {
      apiNswConfigured: hasLiveCredentials(),
      apiQldConfigured: hasQldCredentials(),
      apiWaConfigured: hasWaProvider(),
      apiVicConfigured: hasVicCredentials(),
      vicStatus: hasVicCredentials() ? "configured_pending_adapter_schema" : "needs_servo_saver_api_access",
      selection: "region-aware",
    },
    cacheSeconds: cacheSeconds(),
    maps: {
      provider: "osm",
      googleMapsConfigured: Boolean(process.env.FUEL_PATH_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
      googleDirectionsEnabled: Boolean(process.env.FUEL_PATH_GOOGLE_ROUTES_API_KEY || process.env.FUEL_PATH_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
      googleMapsApiKey: "",
    },
    geocoding: geocodeProviderStatus(),
    routing: routeProviderStatus(),
    alerts: alertsStatus(),
  });
};
