const {
  alertsStatus,
  cacheSeconds,
  geocodeProviderStatus,
  hasAnyLiveCredentials,
  hasLiveCredentials,
  hasQldCredentials,
  hasVicCredentials,
  hasWaProvider,
  capabilitySummary,
  fuelProviderCapabilityMatrix,
  methodAllowed,
  predictionStatus,
  providerPublicClaimStatus,
  routeProviderStatus,
  sendJson,
} = require("./_backend");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  const providerCapabilities = fuelProviderCapabilityMatrix();
  const publicClaims = providerPublicClaimStatus(providerCapabilities);
  sendJson(res, 200, {
    api: "fuel-path-hosted-backend-v1",
    credentialsConfigured: hasAnyLiveCredentials(),
    defaultSource: hasAnyLiveCredentials() ? "live" : "sample",
    sourceScope: {
      defaultSourceMeaning: "coarse server diagnostic only; use fuelProviders.capabilities for region-level behaviour",
      regionalSelection: "region-aware",
      publicLivePriceClaimsAllowed: Boolean(publicClaims.publicLivePriceClaimsAllowed),
    },
    releaseReadiness: {
      publicBeta: {
        status: "blocked_until_external_evidence",
        summaryGate: "npm run check:beta-readiness -- --api-base https://fuel-path.vercel.app --allow-blocked",
        blockers: [
          "provider_terms_evidence",
          "physical_device_validation",
          "ios_validation",
          "privacy_store_evidence",
          "support_readiness",
        ],
      },
    },
    fuelProviders: {
      apiNswConfigured: hasLiveCredentials(),
      apiQldConfigured: hasQldCredentials(),
      apiWaConfigured: hasWaProvider(),
      apiVicConfigured: hasVicCredentials(),
      vicStatus: hasVicCredentials() ? "configured_pending_adapter_schema" : "needs_servo_saver_api_access",
      selection: "region-aware",
      capabilityLabels: ["live", "limited", "pending_access", "fallback", "unsupported"],
      capabilitySummary: capabilitySummary(providerCapabilities),
      capabilities: providerCapabilities,
      publicClaims,
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
    alerts: await alertsStatus(),
    predictions: await predictionStatus(),
  });
};
