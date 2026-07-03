const {
  alertsStatus,
  cacheSeconds,
  geocodeProviderStatus,
  hasAnyLiveCredentials,
  hasLiveCredentials,
  hasNtCredentials,
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
const { evChargingStatus } = require("./_evProviderPolicy");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  const providerCapabilities = fuelProviderCapabilityMatrix();
  const publicClaims = providerPublicClaimStatus(providerCapabilities);
  const publicLaunchClaimsReviewed = process.env.FUEL_PATH_PUBLIC_LIVE_PRICE_CLAIMS_REVIEWED === "1";
  const releasePublicClaims = publicClaims.publicLivePriceClaimsAllowed
    ? publicLaunchClaimsReviewed
      ? publicClaims
      : {
          ...publicClaims,
          status: "blocked_until_release_evidence",
          publicLivePriceClaimsAllowed: false,
          blockers: Array.from(new Set([...publicClaims.blockers, "release_claims_evidence_not_reviewed"])),
        }
    : publicClaims;
  const publicBetaBlockers = [
    ...(!releasePublicClaims.publicLivePriceClaimsAllowed ? ["provider_terms_evidence"] : []),
    "physical_device_validation",
    "ios_validation",
    "privacy_store_evidence",
    "support_readiness",
  ];
  sendJson(res, 200, {
    api: "fuel-path-hosted-backend-v1",
    credentialsConfigured: hasAnyLiveCredentials(),
    defaultSource: hasAnyLiveCredentials() ? "live" : "sample",
    sourceScope: {
      defaultSourceMeaning: "coarse server diagnostic only; use fuelProviders.capabilities for region-level behaviour",
      regionalSelection: "region-aware",
      publicLivePriceClaimsAllowed: Boolean(releasePublicClaims.publicLivePriceClaimsAllowed),
      providerTermsGateAllowsClaims: Boolean(publicClaims.publicLivePriceClaimsAllowed),
      releaseEvidenceGate: publicLaunchClaimsReviewed ? "reviewed" : "not_reviewed",
    },
    releaseReadiness: {
      publicBeta: {
        status: publicBetaBlockers.length ? "blocked_until_external_evidence" : "ready",
        summaryGate: "npm run check:beta-readiness -- --api-base https://fuel-path.vercel.app --allow-blocked",
        blockers: publicBetaBlockers,
      },
    },
    fuelProviders: {
      apiNswConfigured: hasLiveCredentials(),
      apiQldConfigured: hasQldCredentials(),
      apiWaConfigured: hasWaProvider(),
      apiVicConfigured: hasVicCredentials(),
      apiNtConfigured: hasNtCredentials(),
      vicStatus: hasVicCredentials() ? "configured_live" : "needs_servo_saver_api_access",
      ntStatus: hasNtCredentials() ? "configured_live" : "needs_myfuel_nt_api_access",
      selection: "region-aware",
      capabilityLabels: ["live", "limited", "pending_access", "fallback", "unsupported"],
      capabilitySummary: capabilitySummary(providerCapabilities),
      capabilities: providerCapabilities,
      publicClaims: releasePublicClaims,
    },
    cacheSeconds: cacheSeconds(),
    maps: {
      provider: "osm",
      googleMapsConfigured: Boolean(process.env.FUEL_PATH_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
      googleDirectionsEnabled: Boolean(process.env.FUEL_PATH_GOOGLE_ROUTES_API_KEY || process.env.FUEL_PATH_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
      googleMapsApiKey: "",
    },
    geocoding: geocodeProviderStatus(),
    evCharging: evChargingStatus(),
    routing: routeProviderStatus(),
    alerts: await alertsStatus(),
    predictions: await predictionStatus(),
  });
};
