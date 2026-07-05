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
const { evChargingStatusWithTelemetry } = require("./_evProviderPolicy");
const { providerObservabilityStatus } = require("./_providerObservability");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  const providerCapabilities = fuelProviderCapabilityMatrix();
  const publicClaims = providerPublicClaimStatus(providerCapabilities);
  const evCharging = await evChargingStatusWithTelemetry();
  const geocoding = geocodeProviderStatus();
  const providerObservability = await providerObservabilityStatus({ evCharging, geocoding });
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
  const evChargingReadinessBlockers = Array.from(
    new Set(
      [
        ...(evCharging.googlePlacesEvCostControls?.hardStop?.active ? ["google_places_ev_hard_stop_reached"] : []),
        ...(evCharging.googlePlacesEvCostControls?.blockers || []),
      ].filter(Boolean),
    ),
  );
  const evChargingReadiness = {
    status: evChargingReadinessBlockers.length ? "blocked" : "ready",
    blockers: evChargingReadinessBlockers,
    summary: evChargingReadinessBlockers.length
      ? "Google Places EV controls are currently preventing additional paid route lookup."
      : evCharging.googlePlacesEvCostControls?.softWarning?.active
        ? "Google Places EV paid lookup usage is above the soft warning threshold; monitor spend before increasing traffic."
        : "EV provider budget controls are within limit.",
    cap: {
      hardLimit: evCharging.googlePlacesEvCostControls?.dailyCap || 0,
      hardLimitUsed: evCharging.googlePlacesEvCostControls?.capUsed || 0,
      hardLimitRemaining: evCharging.googlePlacesEvCostControls?.capRemaining || 0,
      usagePercent: evCharging.googlePlacesEvCostControls?.capUsagePercent || 0,
      softWarningActive: Boolean(evCharging.googlePlacesEvCostControls?.softWarning?.active),
      softWarningAtCalls: evCharging.googlePlacesEvCostControls?.softWarning?.warnAtCalls || 0,
      hardStopActive: Boolean(evCharging.googlePlacesEvCostControls?.hardStop?.active),
      hardStopAtCalls: evCharging.googlePlacesEvCostControls?.hardStop?.hardStopAtCalls || 0,
      passRatePercent: evCharging.googlePlacesEvCostControls?.passRatePercent || 0,
      fallbackRatePercent: evCharging.googlePlacesEvCostControls?.fallbackRatePercent || 0,
      emptyResultRatePercent: evCharging.googlePlacesEvCostControls?.emptyResultRatePercent || 0,
      signalSampleMinimum: evCharging.googlePlacesEvCostControls?.signalThresholds?.sampleMinimum || 0,
      signalBlockers: evCharging.googlePlacesEvCostControls?.signalBlockers || [],
    },
  };
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
      evCharging: evChargingReadiness,
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
    geocoding,
    evCharging,
    providerObservability,
    routing: routeProviderStatus(),
    alerts: await alertsStatus(),
    predictions: await predictionStatus(),
  });
};
