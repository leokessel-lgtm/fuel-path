const { capabilitiesForPoints } = require("./_capabilities");
const { routeAlertDaySelected } = require("./_alertSchedule");

const ALERT_FRESHNESS_MAX_MINUTES = 120;
const ALERT_DUPLICATE_COOLDOWN_HOURS = 72;

function buildSavedRouteAlertEvaluation({
  route,
  devices = [],
  candidate = {},
  notificationPermission = "granted",
  regionCapabilities = [],
  now,
  pushDeliveryEnabled = false,
  idempotencyKey = "",
  userAlertAlreadySent = false,
} = {}) {
  const evaluatedAt = validIsoDate(now) || new Date().toISOString();
  const capabilities = Array.isArray(regionCapabilities) && regionCapabilities.length
    ? regionCapabilities
    : capabilitiesForPoints([route.from, route.to]);
  const activeDevices = Array.isArray(devices) ? devices.filter((device) => device.status !== "inactive" && isExpoPushToken(device.expoPushToken)) : [];

  let status = "send_alert";
  let reason = "saving_above_threshold";
  if (!route.alertEnabled) [status, reason] = ["alert_disabled", "route_alert_disabled"];
  else if (route.pausedUntil && new Date(route.pausedUntil).getTime() > new Date(evaluatedAt).getTime()) [status, reason] = ["quiet_today", "route_paused"];
  else if (route.lastAlertSentAt && hoursBetween(route.lastAlertSentAt, evaluatedAt) < ALERT_DUPLICATE_COOLDOWN_HOURS) [status, reason] = ["quiet_today", "duplicate_cooldown"];
  else if (userAlertAlreadySent) [status, reason] = ["quiet_today", "user_alert_cap"];
  else if (notificationPermission !== "granted") [status, reason] = ["permission_missing", "notification_permission_missing"];
  else if (!activeDevices.length) [status, reason] = ["missing_push_token", "no_active_push_device"];
  else if (capabilities.some((item) => item.capability === "unsupported")) [status, reason] = ["region_unsupported", "route_region_unsupported"];
  else if (capabilities.some((item) => item.capability === "pending_access")) [status, reason] = ["provider_access_pending", "route_provider_access_pending"];
  else if (candidate.alertBasis === "fuel_cycle" && candidate.cycleAlertsEnabled !== true) [status, reason] = ["cycle_guidance_not_ready", "cycle_guidance_gate_closed"];
  else if (!candidate.stationCode) [status, reason] = ["not_evaluated", "route_scoring_not_available"];
  else if (candidate.reachable === false) [status, reason] = ["range_first", "candidate_range_risk"];
  else if (candidate.openNow === false) [status, reason] = ["station_closed", "candidate_station_closed"];
  else if (!Number.isFinite(optionalNumber(candidate.freshnessMinutes)) || optionalNumber(candidate.freshnessMinutes) > ALERT_FRESHNESS_MAX_MINUTES) [status, reason] = ["stale_price", "candidate_price_stale"];
  else if (!Number.isFinite(optionalNumber(candidate.estimatedSavingDollars)) || optionalNumber(candidate.estimatedSavingDollars) < route.minSavingDollars) [status, reason] = ["saving_below_threshold", "saving_below_route_threshold"];
  else if (Number.isFinite(optionalNumber(candidate.detourMinutes)) && optionalNumber(candidate.detourMinutes) > route.maxDetourMinutes) [status, reason] = ["detour_above_threshold", "detour_above_route_threshold"];

  const outcome = alertOutcome(status);
  const outcomeDetail = alertOutcomeDetail({ outcome, status, reason, route, candidate });
  return {
    id: alertEvaluationId({ route, evaluatedAt, idempotencyKey }),
    routeId: route.id,
    userId: route.userId,
    status,
    reason,
    outcome,
    outcomeLabel: outcomeDetail.label,
    outcomeSummary: outcomeDetail.summary,
    stationCode: cleanString(candidate.stationCode),
    stationName: cleanString(candidate.stationName),
    alertBasis: cleanString(candidate.alertBasis || "route_price_opportunity"),
    cycleSignalMode: cleanString(candidate.cycleSignalMode),
    cycleReadinessStatus: cleanString(candidate.cycleReadinessStatus),
    cycleAlertsEnabled: candidate.cycleAlertsEnabled === true,
    estimatedSavingDollars: optionalNumber(candidate.estimatedSavingDollars),
    detourMinutes: optionalNumber(candidate.detourMinutes),
    freshnessMinutes: optionalNumber(candidate.freshnessMinutes),
    messageTitle: status === "send_alert" ? "Fuel worth checking before your drive" : undefined,
    messageBody: status === "send_alert"
      ? alertMessageBody({ route, candidate })
      : undefined,
    evaluatedAt,
    pushDeliveryEnabled,
    pushTicketId: undefined,
    pushReceiptStatus: undefined,
    idempotencyKey: cleanString(idempotencyKey),
  };
}

function alertOutcome(status) {
  if (status === "send_alert") return "send_alert";
  if (status === "quiet_today") return "quiet_today";
  if (status === "range_first") return "range_first";
  if ([
    "saving_below_threshold",
    "detour_above_threshold",
    "stale_price",
    "station_closed",
    "region_unsupported",
    "provider_access_pending",
    "alert_disabled",
    "cycle_guidance_not_ready",
  ].includes(status)) return "skip_alert";
  return "watch_only";
}

function alertOutcomeDetail({ outcome, status, route = {}, candidate = {} } = {}) {
  const station = candidate.stationName || "the best stop";
  const saving = optionalNumber(candidate.estimatedSavingDollars);
  const detour = optionalNumber(candidate.detourMinutes);
  if (outcome === "send_alert") {
    return {
      label: "Send alert",
      summary: Number.isFinite(saving)
        ? `${station} is worth checking: about ${formatMoney(saving)} after ${formatMinutes(detour)} detour.`
        : `${station} is worth checking before your ${route.alertTimeLocal || "usual"} drive.`,
    };
  }
  if (outcome === "quiet_today") {
    return {
      label: "Quiet today",
      summary: status === "quiet_today"
        ? "No duplicate alert today because this route is paused, cooled down or already covered."
        : "No alert today.",
    };
  }
  if (outcome === "range_first") {
    return {
      label: "Range first",
      summary: `${station} has range risk. Top up safely before chasing the saving.`,
    };
  }
  if (outcome === "skip_alert") {
    return {
      label: "Skip alert",
      summary: skipAlertSummary(status, { route, candidate }),
    };
  }
  return {
    label: "Watch only",
    summary: watchOnlySummary(status),
  };
}

function alertMessageBody({ route = {}, candidate = {} } = {}) {
  const station = candidate.stationName ? ` near ${candidate.stationName}` : "";
  const saving = optionalNumber(candidate.estimatedSavingDollars);
  const detour = optionalNumber(candidate.detourMinutes);
  if (Number.isFinite(saving)) {
    return `${route.fuel} may save about ${formatMoney(saving)}${Number.isFinite(detour) ? ` after ${formatMinutes(detour)} detour` : ""}${station}.`;
  }
  return `${route.fuel} is worth checking${station} before your ${route.alertTimeLocal || "usual"} drive.`;
}

function skipAlertSummary(status, { route = {}, candidate = {} } = {}) {
  if (status === "saving_below_threshold") {
    const saving = optionalNumber(candidate.estimatedSavingDollars);
    return Number.isFinite(saving)
      ? `Saving is ${formatMoney(saving)}, below the route rule of ${formatMoney(route.minSavingDollars)}.`
      : "Saving is below the route rule.";
  }
  if (status === "detour_above_threshold") {
    const detour = optionalNumber(candidate.detourMinutes);
    return Number.isFinite(detour)
      ? `Detour is ${formatMinutes(detour)}, above the route rule of ${formatMinutes(route.maxDetourMinutes)}.`
      : "Detour is above the route rule.";
  }
  if (status === "stale_price") return "Price freshness is too weak for an alert.";
  if (status === "station_closed") return "The candidate station is marked closed.";
  if (status === "region_unsupported") return "This route is outside supported live provider coverage.";
  if (status === "provider_access_pending") return "Provider access is pending for this route.";
  if (status === "alert_disabled") return "Alerts are turned off for this saved route.";
  if (status === "cycle_guidance_not_ready") return "Fuel-cycle alerts are still in background measurement mode.";
  return "This route should not send an alert right now.";
}

function watchOnlySummary(status) {
  if (status === "permission_missing") return "Notification permission is missing, so Fuel Path can only watch this route.";
  if (status === "missing_push_token") return "No active push token is available, so Fuel Path can only watch this route.";
  if (status === "not_evaluated") return "Route scoring was unavailable, so Fuel Path can only watch this route.";
  return "Fuel Path can watch this route, but should not send a push alert.";
}

function alertEvaluationId({ route, evaluatedAt, idempotencyKey = "" } = {}) {
  const key = cleanString(idempotencyKey);
  if (key) return `rae_${stableId(key)}`;
  return `rae_${route?.id || "route"}_${stableId(`${evaluatedAt}:${Math.random()}`)}`;
}

function scheduledRouteAlertIdempotencyKey(route, evaluatedAt) {
  return [
    "scheduled-route-alert",
    route.id,
    route.userId,
    route.alertTimeLocal || "07:30",
    routeAlertLocalDate(route, evaluatedAt),
    routeAlertLocalBucket(route, evaluatedAt),
  ].join(":");
}

function routeAlertWindowDue(route, now) {
  if (!routeAlertDaySelected(route, now)) return false;
  const target = route.alertTimeLocal || "07:30";
  const local = localTimeParts(now, route.timezone || "Australia/Sydney");
  if (!local) return true;
  const [targetHour, targetMinute] = target.split(":").map(Number);
  const targetMinutes = targetHour * 60 + targetMinute;
  const localMinutes = local.hour * 60 + local.minute;
  const diff = Math.abs(localMinutes - targetMinutes);
  const wrappedDiff = Math.min(diff, 1440 - diff);
  const windowMinutes = boundedNumber(process.env.ALERT_SCHEDULE_WINDOW_MINUTES, 5, 720, 90);
  return wrappedDiff <= windowMinutes;
}

function receiptStatus(receipt) {
  if (!receipt) return "";
  if (receipt.status === "ok") return "ok";
  if (receipt.status === "error") return receipt.details?.error || receipt.message || "error";
  return String(receipt.status || "");
}

function isExpoPushToken(value) {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(String(value || "").trim());
}

function routeAlertLocalDate(route, evaluatedAt) {
  const timeZone = route.timezone || "Australia/Sydney";
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(evaluatedAt));
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    return String(evaluatedAt || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  }
}

function routeAlertLocalBucket(route, evaluatedAt) {
  const local = localTimeParts(evaluatedAt, route.timezone || "Australia/Sydney");
  if (!local) return "unknown";
  const windowMinutes = boundedNumber(process.env.ALERT_IDEMPOTENCY_WINDOW_MINUTES, 1, 60, 10);
  const localMinutes = local.hour * 60 + local.minute;
  return String(Math.floor(localMinutes / windowMinutes)).padStart(4, "0");
}

function localTimeParts(value, timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(value));
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { hour: hour === 24 ? 0 : hour, minute };
  } catch {
    return null;
  }
}

function cleanString(value) {
  return String(value || "").trim();
}

function formatMoney(value) {
  const amount = Number(value || 0);
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

function formatMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return "unknown min";
  return `${minutes.toFixed(minutes % 1 === 0 ? 0 : 1)} min`;
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

function hoursBetween(start, end) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return Infinity;
  return Math.abs(endMs - startMs) / 36e5;
}

function stableId(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

module.exports = {
  buildSavedRouteAlertEvaluation,
  isExpoPushToken,
  receiptStatus,
  routeAlertWindowDue,
  scheduledRouteAlertIdempotencyKey,
};
