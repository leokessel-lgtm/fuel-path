const { cronAuthorised, geocode, geocodeProviderStatus, methodAllowed, sendJson } = require("../_backend");

// A non-sensitive probe address that exists in the full hosted G-NAF index.
// This address is also in seed/local, so mode-check is required to avoid false positives.
const PROBE_QUERIES = [
 "87A Corea Street Sylvania NSW",
 "66B Easton Avenue Sylvania NSW",
];
const PROBE_QUERY = PROBE_QUERIES[Math.floor(Date.now() / 86400000) % PROBE_QUERIES.length];

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET"])) return;
  if (!cronAuthorised(req)) {
    sendJson(res, 401, { error: "Geocode health check requires CRON_SECRET authorisation." });
    return;
  }
  res.setHeader("Cache-Control", "no-store, private");
  const started = Date.now();
  const status = geocodeProviderStatus();
  const addressIndex = status.addressIndex || {};
  const readiness = status.lookupReadiness || {};
  const paidFallback = readiness.providerFallback || {};

  // Step 1: Check address index mode is hosted
  const hosted = addressIndex.mode === "api" || addressIndex.mode === "postgres";
  const production = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
  const localDev = !hosted && !production;
  // Step 2: Run geocode probe
  let probe;
  try {
    const result = await geocode({ query: PROBE_QUERY, limit: 1 });
    probe = {
      lookupStatus: result.lookupStatus,
      hasLocation: Boolean(result.location),
      provider: result.location?.provider || "",
      matchType: result.location?.matchType || "",
      sourceLabel: result.location?.sourceLabel || "",
      accuracy: result.location?.accuracy || "",
      cacheMode: result.cacheMode || "",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    probe = {
      lookupStatus: "error",
      hasLocation: false,
      provider: "",
      matchType: "",
      sourceLabel: "",
      accuracy: "",
      accuracy: "",
      cacheMode: "",
      latencyMs: Date.now() - started,
    };
  }

  // Step 3: Determine health
  const probeHealthy = probe.lookupStatus === "ok" && probe.hasLocation && probe.matchType === "exact_address";
  const hostedProbeHealthy = hosted && probeHealthy && probe.provider === "fuel_path_gnaf" && !String(probe.accuracy).includes("seed");
  const readinessHealthy = readiness.status === "ready";

  let healthy;
  let failureCategory = "";
  if (localDev) {
    // In local-dev mode, only check probe works and readiness is not blocking
    healthy = probeHealthy;
    if (!healthy) failureCategory = "probe_failed_local_dev";
  } else if (!hosted) {
    healthy = false;
    failureCategory = "address_index_not_hosted";
  } else if (!hostedProbeHealthy) {
    healthy = false;
    failureCategory = probe.lookupStatus === "error" ? "probe_error" : probe.lookupStatus === "degraded" ? "probe_degraded" : probe.provider !== "fuel_path_gnaf" ? "probe_wrong_provider" : "probe_not_exact";
  } else if (!readinessHealthy) {
    healthy = false;
    failureCategory = "readiness_not_ready";
  } else {
    healthy = true;
  }

  const payload = {
    event: "geocode_health_check",
    timestamp: new Date().toISOString(),
    healthy,
    failureCategory,
    probe,
    addressIndex: {
      mode: addressIndex.mode || "disabled",
      apiConfigured: Boolean(addressIndex.apiConfigured),
      postgresConfigured: Boolean(addressIndex.postgresConfigured),
    },
    readiness: {
      status: readiness.status || "unknown",
      blockers: readiness.blockers || [],
    },
    paidFallback: {
      enabled: Boolean(paidFallback.paidFallbackEnabled),
      quotaDurable: Boolean(paidFallback.quotaStorageDurable),
      tinyCapReady: Boolean(paidFallback.tinyDailyCapReady),
    },
  };

  if (process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS === "1") {
    console.log(JSON.stringify(payload));
  }

  // Alert webhook: POST redacted health payload to configured URL on failure
  const webhookUrl = process.env.FUEL_PATH_HEALTH_WEBHOOK_URL;
  if (!healthy && webhookUrl) {
    try { fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(function() {}); } catch (e) { /* best-effort */ }
  }

  sendJson(res, healthy ? 200 : 503, payload);
};
