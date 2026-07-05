const { geocode, methodAllowed, numberParam, sendJson, stringParam } = require("./_backend");

function diagnosticsEnabled() {
  return process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS === "1";
}

function warningCategory(warning) {
  if (!warning) return "";
  if (/rate.limited|cooling down/i.test(warning)) return "rate_limited";
  if (/timed out/i.test(warning)) return "timeout";
  if (/No strong location/i.test(warning)) return "no_match";
  if (/disabled by cost/i.test(warning)) return "cost_disabled";
  if (/session token/i.test(warning)) return "session_token";
  if (/cap.*reached|paused/i.test(warning)) return "cap_reached";
  if (/local address fallback/i.test(warning)) return "local_fallback";
  return "other";
}

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;
  const started = Date.now();
  try {
    const params = req.method === "POST" && req.body ? req.body : req.query;
    const q = stringParam(params.q).trim();
    if (!q) throw new Error("q is required");
    const limit = Math.max(1, Math.min(8, numberParam(params.limit, 5)));
    const payload = await geocode({
      query: q,
      limit,
      sessionToken: stringParam(params.sessionToken),
      provider: stringParam(params.provider),
      providerPlaceId: stringParam(params.providerPlaceId),
      purpose: stringParam(params.purpose),
      searchContext: {
        nearLat: numberParam(params.nearLat, NaN),
        nearLon: numberParam(params.nearLon, NaN),
        nearRadiusKm: numberParam(params.nearRadiusKm, NaN),
      },
    });
    res.setHeader("Cache-Control", "no-store, private");
    if (diagnosticsEnabled()) {
      console.log(JSON.stringify({
        event: "geocode_lookup",
        method: req.method,
        provider: payload.provider,
        lookupStatus: payload.lookupStatus,
        cacheMode: payload.cacheMode,
        degraded: payload.degraded,
        suggestionCount: (payload.suggestions || []).length,
        hasLocation: Boolean(payload.location),
        topMatchType: payload.location?.matchType || "",
        topProvider: payload.location?.provider || "",
        warningCategory: warningCategory(payload.warning),
        latencyMs: Date.now() - started,
      }));
    }
    sendJson(res, 200, payload);
  } catch (error) {
    res.setHeader("Cache-Control", "no-store, private");
    if (diagnosticsEnabled()) {
      console.log(JSON.stringify({
        event: "geocode_lookup",
        method: req.method,
        lookupStatus: "error",
        errorCategory: /q is required/i.test(String(error?.message)) ? "missing_query" : "handler_error",
        latencyMs: Date.now() - started,
      }));
    }
    sendJson(res, 404, {
      error: error instanceof Error ? error.message : "No location found",
    });
  }
};
