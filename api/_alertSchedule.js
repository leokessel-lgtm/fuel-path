const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function nextRouteAlertEvaluationAt(route, now, { windowMinutes = alertWindowMinutes() } = {}) {
  const instant = validDate(now) || new Date();
  const timezone = cleanText(route?.timezone) || "Australia/Sydney";
  const localNow = zonedParts(instant, timezone);
  if (!localNow) return new Date(instant.getTime() + DAY_MS).toISOString();

  const [hour, minute] = normaliseAlertTime(route?.alertTimeLocal).split(":").map(Number);
  const alertDays = normaliseAlertDays(route?.alertDays);
  const localDate = Date.UTC(localNow.year, localNow.month - 1, localNow.day);
  const notBefore = instant.getTime() + 60 * 1000;

  for (let offset = 0; offset <= 8; offset += 1) {
    const candidateDate = new Date(localDate + offset * DAY_MS);
    const weekday = WEEKDAYS[candidateDate.getUTCDay()];
    if (!alertDays.has(weekday)) continue;
    const target = zonedLocalToUtc({
      year: candidateDate.getUTCFullYear(),
      month: candidateDate.getUTCMonth() + 1,
      day: candidateDate.getUTCDate(),
      hour,
      minute,
    }, timezone);
    if (!target) continue;
    const dueAt = target.getTime() - windowMinutes * 60 * 1000;
    if (dueAt >= notBefore) return new Date(dueAt).toISOString();
  }

  return new Date(instant.getTime() + DAY_MS).toISOString();
}

function routeAlertDaySelected(route, now) {
  const instant = validDate(now);
  if (!instant) return true;
  const timezone = cleanText(route?.timezone) || "Australia/Sydney";
  try {
    const weekday = new Intl.DateTimeFormat("en-AU", { timeZone: timezone, weekday: "short" })
      .format(instant)
      .slice(0, 3)
      .toLowerCase();
    return normaliseAlertDays(route?.alertDays).has(weekday);
  } catch {
    return true;
  }
}

function alertWindowMinutes() {
  return boundedNumber(process.env.ALERT_SCHEDULE_WINDOW_MINUTES, 5, 720, 90);
}

function normaliseAlertTime(value) {
  const text = cleanText(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "07:30";
}

function normaliseAlertDays(value) {
  const selected = Array.isArray(value) ? value.map(cleanText).filter((day) => WEEKDAYS.includes(day)) : [];
  return new Set(selected.length ? selected : WEEKDAYS);
}

function zonedLocalToUtc(local, timezone) {
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0);
  let guess = new Date(localAsUtc);
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = zonedParts(guess, timezone);
    if (!parts) return null;
    const renderedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const offset = renderedAsUtc - guess.getTime();
    const next = new Date(localAsUtc - offset);
    if (Math.abs(next.getTime() - guess.getTime()) < 1000) return next;
    guess = next;
  }
  return guess;
}

function zonedParts(value, timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(value);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      year: Number(byType.year),
      month: Number(byType.month),
      day: Number(byType.day),
      hour: Number(byType.hour) === 24 ? 0 : Number(byType.hour),
      minute: Number(byType.minute),
      second: Number(byType.second),
    };
  } catch {
    return null;
  }
}

function validDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? null : date;
}

function boundedNumber(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function cleanText(value) {
  return String(value || "").trim().toLowerCase();
}

module.exports = {
  alertWindowMinutes,
  nextRouteAlertEvaluationAt,
  routeAlertDaySelected,
};
