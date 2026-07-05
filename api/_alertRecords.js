function normalisePushDevice(input) {
  const userId = requiredText(input.userId, "userId");
  const deviceId = requiredText(input.deviceId || input.id, "deviceId");
  const expoPushToken = requiredText(input.expoPushToken || input.pushToken, "expoPushToken");
  const platform = cleanString(input.platform || "unknown").slice(0, 30) || "unknown";
  const now = new Date().toISOString();
  return {
    id: `pd_${stableId(`${userId}:${deviceId}`)}`,
    userId,
    deviceId,
    platform,
    expoPushToken,
    appVersion: cleanString(input.appVersion).slice(0, 40),
    status: ["active", "inactive"].includes(input.status) ? input.status : "active",
    lastSeenAt: validIsoDate(input.lastSeenAt) || now,
    invalidatedAt: validIsoDate(input.invalidatedAt) || undefined,
  };
}

function normaliseBackendSavedRoute(input) {
  const userId = requiredText(input.userId, "userId");
  const id = cleanString(input.id) || `sr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const route = {
    id: id.slice(0, 80),
    userId,
    name: requiredText(input.name, "name").slice(0, 120),
    from: normaliseRoutePoint(input.from, "from"),
    to: normaliseRoutePoint(input.to, "to"),
    fuel: String(input.fuel || "").trim().toUpperCase(),
    vehicleId: cleanString(input.vehicleId).slice(0, 80),
    vehicleEnergyType: cleanString(input.vehicleEnergyType || "petrol").slice(0, 30),
    alertEnabled: Boolean(input.alertEnabled),
    alertTimeLocal: normaliseAlertTime(input.alertTimeLocal || input.alertTime),
    alertDays: normaliseAlertDays(input.alertDays),
    timezone: cleanString(input.timezone || "Australia/Sydney").slice(0, 80),
    minSavingDollars: boundedNumber(input.minSavingDollars, 1, 100, 5),
    maxDetourMinutes: boundedNumber(input.maxDetourMinutes, 0, 60, 8),
    eligibleDiscounts: Array.isArray(input.eligibleDiscounts)
      ? input.eligibleDiscounts.map(cleanString).filter(Boolean).slice(0, 20)
      : [],
    tankLitres: boundedNumber(input.tankLitres, 20, 180, 55),
    tankPercent: boundedNumber(input.tankPercent, 1, 100, 45),
    economy: boundedNumber(input.economy, 2, 30, 8.2),
    reserveKm: boundedNumber(input.reserveKm, 0, 250, 35),
    evBatteryKwh: boundedNumber(input.evBatteryKwh, 0, 200, 0),
    evRangeKm: boundedNumber(input.evRangeKm, 0, 1000, 0),
    evConnectors: Array.isArray(input.evConnectors)
      ? input.evConnectors.map(cleanString).filter(Boolean).slice(0, 8)
      : [],
    pausedUntil: validIsoDate(input.pausedUntil) || undefined,
    lastAlertSentAt: validIsoDate(input.lastAlertSentAt) || undefined,
    createdAt: validIsoDate(input.createdAt) || now,
    updatedAt: now,
  };
  if (!["E10", "U91", "P95", "P98", "DL", "PDL", "LPG", "E85"].includes(route.fuel)) {
    throw new Error("fuel is not supported for saved-route alerts");
  }
  return route;
}

function normaliseRoutePoint(value, field) {
  const point = value || {};
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  if (!Number.isFinite(lat) || lat < -44 || lat > -9) throw new Error(`${field}.lat must be an Australian latitude`);
  if (!Number.isFinite(lon) || lon < 112 || lon > 154.5) throw new Error(`${field}.lon must be an Australian longitude`);
  return {
    lat,
    lon,
    label: cleanString(point.label || "Saved location").slice(0, 160),
  };
}

function normaliseAlertTime(value) {
  const text = cleanString(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "07:30";
}

function normaliseAlertDays(value) {
  const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  if (!Array.isArray(value)) return weekdays;
  const selected = new Set(value.map(cleanString).filter((day) => weekdays.includes(day)));
  const days = weekdays.filter((day) => selected.has(day));
  return days.length ? days : weekdays;
}

function requiredText(value, field) {
  const text = cleanString(value);
  if (!text) throw new Error(`${field} is required`);
  return text;
}

function cleanString(value) {
  return String(value || "").trim();
}

function boundedNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function validIsoDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function stableId(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

module.exports = {
  normaliseBackendSavedRoute,
  normalisePushDevice,
};
