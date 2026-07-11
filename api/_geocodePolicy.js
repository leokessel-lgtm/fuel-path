const { providerHealth } = require("./_providerRuntime");

function geocodeCacheMode(status) {
  return { ok: "refreshed", local_fallback: "local_fallback", degraded: "degraded", no_match: "no_match" }[status] || "none";
}

function isRateLimitError(error) {
  return String(error?.message || error).includes("429");
}

function isRetriableGeocodeError(error, provider) {
  const message = String(error?.message || error || "");
  if (/No location found for|too short|session token|daily fallback cap|disabled by cost controls|requires durable quota storage|quota|cap reached|not configured/i.test(message)) return false;
  const status = /Provider returned (\d{3})/i.exec(message)?.[1];
  if (status) {
    const code = Number(status);
    if (code === 408) return true;
    if (code === 429) return String(provider || "").toLowerCase() !== "nominatim";
    return code >= 500;
  }
  return /timed out|network|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket/i.test(message);
}

function geocodeProviderHealth(provider, lookupStatus, warning = "", cacheMode = "none") {
  const status = lookupStatus === "ok" ? "ok" : lookupStatus === "degraded" ? "unavailable" : "degraded";
  return providerHealth(provider || "geocode", { status, cacheMode, cacheAgeSeconds: cacheMode === "fresh" ? 0 : null, error: lookupStatus === "degraded" ? warning : "", warning });
}

function geocodeProviderWarning(error) {
  const message = String(error?.message || error || "");
  if (isRateLimitError(error) || /cooling down|rate limit/i.test(message)) return "Address lookup is temporarily busy. Try a fuller address, suburb or postcode.";
  if (/abort|timeout/i.test(message)) return "Address lookup took too long. Try a fuller address, suburb or postcode.";
  if (/No location found/i.test(message)) return "No strong location match found. Try a fuller address, suburb or postcode.";
  if (/disabled by cost controls/i.test(message)) return "Address lookup is limited right now. Try a fuller address, suburb or exact street address.";
  if (/session token/i.test(message)) return "Address lookup needs a new search session. Edit the address and try again.";
  if (/too short/i.test(message)) return "Type more of the address before searching.";
  if (/daily fallback cap/i.test(message)) return "Address lookup is paused for now. Try a fuller address, suburb or postcode.";
  if (/durable quota storage/i.test(message)) return "Address lookup is limited right now. Try a fuller address, suburb or postcode.";
  return "Address lookup is temporarily unavailable. Try a fuller address, suburb or postcode.";
}

function productionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
}

module.exports = { geocodeCacheMode, geocodeProviderHealth, geocodeProviderWarning, isRateLimitError, isRetriableGeocodeError, productionRuntime };
