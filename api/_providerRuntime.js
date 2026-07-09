const providerFlights = new Map();
const providerFailureState = new Map();

function cacheAgeSeconds(cache) {
  const loadedAtMs = Number(cache?.loadedAtMs || 0);
  return loadedAtMs ? Math.max(0, Math.round((Date.now() - loadedAtMs) / 1000)) : null;
}

function providerHealth(provider, { status = "ok", cacheMode = "none", cacheAgeSeconds = null, error = "", warning = "" } = {}) {
  return {
    [provider]: {
      status,
      cacheMode,
      cacheAgeSeconds,
      lastError: error || "",
      warning: warning || "",
    },
  };
}

function providerResult(provider, result) {
  const cacheAge = result.cacheAgeSeconds ?? null;
  const cacheMode = result.cacheMode || (result.cacheHit ? "fresh" : "refreshed");
  const degraded = Boolean(result.degraded || result.error || result.warning);
  return {
    ...result,
    providerHealth: result.providerHealth || providerHealth(provider, {
      status: result.error ? "unavailable" : degraded ? "degraded" : "ok",
      cacheMode,
      cacheAgeSeconds: cacheAge,
      error: result.error,
      warning: result.warning,
    }),
    cacheMode,
    degraded,
  };
}

function staleProviderResult(provider, cache, error, extra = {}) {
  const message = error instanceof Error ? error.message : String(error || "");
  return providerResult(provider, {
    ...extra,
    stations: cache.stations || [],
    cacheHit: true,
    cacheAgeSeconds: cacheAgeSeconds(cache),
    cacheMode: "stale",
    degraded: true,
    error: message,
    warning: extra.warning || "Live prices are temporarily unavailable, so Fuel Path is using saved price data. Confirm prices before driving.",
  });
}

function staleRevalidatingProviderResult(provider, cache, extra = {}) {
  return providerResult(provider, {
    ...extra,
    stations: cache.stations || [],
    cacheHit: true,
    cacheAgeSeconds: cacheAgeSeconds(cache),
    cacheMode: "stale",
    degraded: true,
    error: "",
    warning: extra.warning || `${String(provider).toUpperCase()} cached fuel prices are stale; refreshing in background.`,
  });
}

function providerFailureThreshold() {
  const parsed = Number(process.env.FUEL_PATH_PROVIDER_FAILURE_THRESHOLD || 3);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(20, Math.round(parsed)));
}

function providerCooldownMs() {
  const parsed = Number(process.env.FUEL_PATH_PROVIDER_COOLDOWN_SECONDS || 60);
  if (!Number.isFinite(parsed)) return 60 * 1000;
  return Math.max(5, Math.min(900, Math.round(parsed))) * 1000;
}

function providerState(provider) {
  const key = String(provider || "unknown").toLowerCase();
  if (!providerFailureState.has(key)) {
    providerFailureState.set(key, { consecutiveFailures: 0, lastError: "", openUntilMs: 0 });
  }
  return providerFailureState.get(key);
}

function providerCooldownError(provider) {
  const state = providerState(provider);
  const now = Date.now();
  if (!state.openUntilMs || state.openUntilMs <= now) {
    if (state.openUntilMs) {
      state.openUntilMs = 0;
      state.consecutiveFailures = 0;
    }
    return null;
  }
  const remainingSeconds = Math.max(1, Math.ceil((state.openUntilMs - now) / 1000));
  return new Error(`${String(provider).toUpperCase()} provider cooldown active for ${remainingSeconds}s after repeated failures`);
}

function providerCooldownWarning(provider) {
  return "Live prices are temporarily busy, so Fuel Path is using saved price data. Confirm prices before driving.";
}

function appendWarning(...warnings) {
  return warnings.map((warning) => String(warning || "").trim()).filter(Boolean).join(" ");
}

function recordProviderSuccess(provider) {
  providerFailureState.set(String(provider || "unknown").toLowerCase(), {
    consecutiveFailures: 0,
    lastError: "",
    openUntilMs: 0,
  });
}

function recordProviderFailure(provider, error) {
  const state = providerState(provider);
  state.consecutiveFailures += 1;
  state.lastError = error instanceof Error ? error.message : String(error || "");
  if (state.consecutiveFailures >= providerFailureThreshold()) {
    state.openUntilMs = Date.now() + providerCooldownMs();
  }
}

function providerTimeoutMs(provider, fallback) {
  const key = String(provider || "provider").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const specific = cleanString(process.env[`FUEL_PATH_${key}_TIMEOUT_MS`]);
  const globalValue = cleanString(process.env.FUEL_PATH_PROVIDER_TIMEOUT_MS);
  return boundedNumber(specific || globalValue, 25, 120000, fallback);
}

function providerRetryAttempts(provider) {
  const key = String(provider || "provider").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const specific = cleanString(process.env[`FUEL_PATH_${key}_RETRY_ATTEMPTS`]);
  const globalValue = cleanString(process.env.FUEL_PATH_PROVIDER_RETRY_ATTEMPTS);
  return Math.round(boundedNumber(specific || globalValue, 0, 3, 1));
}

function providerRetryDelayMs(provider) {
  const key = String(provider || "provider").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const specific = cleanString(process.env[`FUEL_PATH_${key}_RETRY_DELAY_MS`]);
  const globalValue = cleanString(process.env.FUEL_PATH_PROVIDER_RETRY_DELAY_MS);
  return Math.round(boundedNumber(specific || globalValue, 0, 2000, 50));
}

async function withProviderRetries(
  provider,
  load,
  {
    retries = providerRetryAttempts(provider),
    delayMs = providerRetryDelayMs(provider),
    isRetriableError = isRetriableProviderError,
  } = {},
) {
  let lastError;
  const attempts = Math.max(1, Math.min(4, Math.round(Number(retries) || 0) + 1));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await load(attempt);
      if (result && typeof result === "object" && !Array.isArray(result)) result.providerAttempts = attempt;
      return result;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetriableError(error)) throw error;
      if (delayMs > 0) await delay(delayMs);
    }
  }
  throw lastError;
}

function isRetriableProviderError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/credentials? are not configured|token is not configured|api key is not configured/i.test(message)) return false;
  const status = /Provider returned (\d{3})/i.exec(message)?.[1];
  if (status) {
    const code = Number(status);
    return code === 408 || code === 429 || code >= 500;
  }
  return /timed out|network|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket/i.test(message);
}

async function singleFlight(key, load, { onSuccess, onFailure } = {}) {
  if (providerFlights.has(key)) return providerFlights.get(key);
  const flight = Promise.resolve()
    .then(load)
    .then(
      (result) => {
        onSuccess?.(result);
        return result;
      },
      (error) => {
        onFailure?.(error);
        throw error;
      },
    )
    .finally(() => providerFlights.delete(key));
  providerFlights.set(key, flight);
  return flight;
}

function cleanString(value) {
  return String(value || "").trim();
}

function boundedNumber(value, min, max, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  appendWarning,
  providerCooldownError,
  providerCooldownWarning,
  providerHealth,
  providerResult,
  providerTimeoutMs,
  recordProviderFailure,
  recordProviderSuccess,
  singleFlight,
  staleRevalidatingProviderResult,
  staleProviderResult,
  withProviderRetries,
};
