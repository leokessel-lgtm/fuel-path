const DEFAULT_OPENWEB_COOLDOWN_MS = 300000;
const MIN_OPENWEB_COOLDOWN_MS = 15000;
const MAX_OPENWEB_COOLDOWN_MS = 24 * 60 * 60 * 1000;

let openWebNinjaRateLimitUntilMs = 0;
let openWebNinjaRateLimitReason = "";

function openWebNinjaRateLimitCooldownMs() {
  const configured = Number(process.env.FUEL_PATH_OPENWEB_NINJA_RATE_LIMIT_COOLDOWN_MS);
  const fallback = DEFAULT_OPENWEB_COOLDOWN_MS;
  if (!Number.isFinite(configured) || configured <= 0) return fallback;
  return Math.max(MIN_OPENWEB_COOLDOWN_MS, Math.min(MAX_OPENWEB_COOLDOWN_MS, Math.round(configured)));
}

function isOpenWebNinjaRateLimited() {
  return Date.now() < openWebNinjaRateLimitUntilMs;
}

function openWebNinjaRateLimitRemainingMs() {
  return Math.max(0, Math.round(openWebNinjaRateLimitUntilMs - Date.now()));
}

function openWebNinjaRateLimitUntilIso() {
  return openWebNinjaRateLimitUntilMs > 0
    ? new Date(openWebNinjaRateLimitUntilMs).toISOString()
    : "";
}

function markOpenWebNinjaRateLimit(reason = "") {
  const now = Date.now();
  const cooldownMs = openWebNinjaRateLimitCooldownMs();
  openWebNinjaRateLimitUntilMs = Math.max(openWebNinjaRateLimitUntilMs, now + cooldownMs);
  openWebNinjaRateLimitReason = String(reason || "").trim();
  return openWebNinjaRateLimitUntilMs;
}

function clearOpenWebNinjaRateLimit() {
  openWebNinjaRateLimitUntilMs = 0;
  openWebNinjaRateLimitReason = "";
}

module.exports = {
  clearOpenWebNinjaRateLimit,
  isOpenWebNinjaRateLimited,
  markOpenWebNinjaRateLimit,
  openWebNinjaRateLimitCooldownMs,
  openWebNinjaRateLimitRemainingMs,
  openWebNinjaRateLimitUntilIso,
  openWebNinjaRateLimitReason: () => openWebNinjaRateLimitReason,
};
