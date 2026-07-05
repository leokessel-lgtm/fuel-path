import { SavedCommute, Weekday } from "../types";

export const ROUTE_ALERT_CHANNEL_ID = "route-alerts";

export const allRouteAlertWeekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export type RouteAlertScheduleInput = {
  day: Weekday;
  hour: number;
  minute: number;
  weekday: number;
};

export function routeAlertScheduleInputs(commute: SavedCommute): RouteAlertScheduleInput[] {
  const { hour, minute } = parseRouteAlertTime(commute.alertTime);
  return normaliseRouteAlertDays(commute.alertDays).map((day) => ({
    day,
    hour,
    minute,
    weekday: expoRouteAlertWeekday(day),
  }));
}

export function nextRouteAlertAt(
  alertTime: string,
  alertDays: Weekday[] | undefined,
  now = new Date(),
) {
  const { hour, minute } = parseRouteAlertTime(alertTime);
  const selectedExpoDays = new Set(normaliseRouteAlertDays(alertDays).map(expoRouteAlertWeekday));
  for (let offset = 0; offset <= 7; offset += 1) {
    const next = new Date(now);
    next.setDate(now.getDate() + offset);
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) continue;
    if (selectedExpoDays.has(jsDateToExpoRouteAlertWeekday(next))) return next;
  }
  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 1);
  fallback.setHours(hour, minute, 0, 0);
  return fallback;
}

export function scheduledRouteNotificationIds(commute: SavedCommute) {
  return [
    ...(Array.isArray(commute.scheduledNotificationIds) ? commute.scheduledNotificationIds : []),
    commute.scheduledNotificationId,
  ].filter((id): id is string => Boolean(id));
}

export function normaliseRouteAlertDays(days: Weekday[] | undefined) {
  if (!Array.isArray(days) || days.length === 0) return allRouteAlertWeekdays;
  const selected = new Set(days);
  const normalised = allRouteAlertWeekdays.filter((day) => selected.has(day));
  return normalised.length ? normalised : allRouteAlertWeekdays;
}

export function parseRouteAlertTime(value: string) {
  const [hourValue, minuteValue] = value.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);

  if (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  ) {
    return { hour, minute };
  }

  return { hour: 7, minute: 30 };
}

export function expoRouteAlertWeekday(day: Weekday) {
  const weekdays: Record<Weekday, number> = {
    sun: 1,
    mon: 2,
    tue: 3,
    wed: 4,
    thu: 5,
    fri: 6,
    sat: 7,
  };
  return weekdays[day];
}

function jsDateToExpoRouteAlertWeekday(value: Date) {
  return value.getDay() + 1;
}
