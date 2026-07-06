import AsyncStorage from "@react-native-async-storage/async-storage";

const EVENTS_KEY = "fuelpath.monetisationBehaviour.events.v1";
const SESSION_KEY = "fuelpath.monetisationBehaviour.sessionId.v1";
const MAX_EVENTS = 500;

export type MonetisationBehaviourEventName =
  | "route_plan_completed"
  | "saved_commute_created"
  | "route_alert_opt_in"
  | "navigation_opened";

export type MonetisationBehaviourEvent = {
  eventId: string;
  eventName: MonetisationBehaviourEventName;
  occurredAt: string;
  sessionId: string;
  fuel?: string;
  regionSet?: string[];
  routeDistanceKmBand?: string;
  detourMinutesBand?: string;
  bestPriceByCplBand?: string;
  savingThresholdBand?: string;
  detourThresholdBand?: string;
  resultStatus?: "recommendation" | "no_recommendation" | "error";
  topRecommendationSourceType?: string;
  savedRouteCountBand?: string;
  alertUseCase?: "commute" | "fleet_lite" | "unknown";
  stationSource?: string;
  stationFreshnessBand?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function recordMonetisationBehaviourEvent(
  event: Omit<MonetisationBehaviourEvent, "eventId" | "occurredAt" | "sessionId">,
) {
  try {
    const sessionId = await getOrCreateSessionId();
    const stored = await readEvents();
    const nextEvent: MonetisationBehaviourEvent = {
      ...event,
      eventId: createEventId(),
      occurredAt: new Date().toISOString(),
      sessionId,
    };
    const nextEvents = [...stored, nextEvent].slice(-MAX_EVENTS);
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(nextEvents));
  } catch {
    // Behaviour evidence must never block route planning, saving, alerts or navigation.
  }
}

async function readMonetisationBehaviourEvents() {
  return readEvents();
}

export function cplBand(value?: number | null) {
  if (!Number.isFinite(Number(value))) return "unknown";
  const cpl = Number(value);
  if (cpl <= 0) return "0";
  if (cpl < 2) return "0-2";
  if (cpl < 5) return "2-5";
  if (cpl < 10) return "5-10";
  if (cpl < 20) return "10-20";
  return "20+";
}

export function dollarsBand(value?: number | null) {
  if (!Number.isFinite(Number(value))) return "unknown";
  const dollars = Number(value);
  if (dollars <= 0) return "$0";
  if (dollars < 2) return "$0-2";
  if (dollars < 5) return "$2-5";
  if (dollars < 10) return "$5-10";
  if (dollars < 20) return "$10-20";
  return "$20+";
}

export function minutesBand(value?: number | null) {
  if (!Number.isFinite(Number(value))) return "unknown";
  const minutes = Number(value);
  if (minutes <= 0) return "0";
  if (minutes < 3) return "0-3";
  if (minutes < 5) return "3-5";
  if (minutes < 10) return "5-10";
  if (minutes < 20) return "10-20";
  return "20+";
}

export function distanceBand(value?: number | null) {
  if (!Number.isFinite(Number(value))) return "unknown";
  const km = Number(value);
  if (km < 5) return "0-5";
  if (km < 15) return "5-15";
  if (km < 50) return "15-50";
  if (km < 150) return "50-150";
  if (km < 500) return "150-500";
  return "500+";
}

export function countBand(value?: number | null) {
  if (!Number.isFinite(Number(value))) return "unknown";
  const count = Number(value);
  if (count <= 0) return "0";
  if (count === 1) return "1";
  if (count <= 3) return "2-3";
  if (count <= 10) return "4-10";
  return "10+";
}

export function freshnessBandFromUpdatedAt(updatedAt?: string) {
  if (!updatedAt) return "unknown";
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return "unknown";
  const ageMinutes = Math.max(0, (Date.now() - timestamp) / 60000);
  if (ageMinutes < 15) return "0-15m";
  if (ageMinutes < 60) return "15-60m";
  if (ageMinutes < 180) return "1-3h";
  if (ageMinutes < 720) return "3-12h";
  if (ageMinutes < 1440) return "12-24h";
  return "24h+";
}

export type PersonalisedCommuteReadiness = {
  status: "insufficient_evidence" | "ready_for_local_personalisation";
  blockers: string[];
  counts: {
    routePlans: number;
    savedCommutes: number;
    routeAlertOptIns: number;
    navigationOpens: number;
  };
  guidance: string;
};

function personalisedCommuteReadiness(
  events: MonetisationBehaviourEvent[],
  savedCommuteCount: number,
): PersonalisedCommuteReadiness {
  const counts = {
    routePlans: events.filter((event) => event.eventName === "route_plan_completed").length,
    savedCommutes: Math.max(savedCommuteCount, events.filter((event) => event.eventName === "saved_commute_created").length),
    routeAlertOptIns: events.filter((event) => event.eventName === "route_alert_opt_in").length,
    navigationOpens: events.filter((event) => event.eventName === "navigation_opened").length,
  };
  const blockers = [
    ...(counts.routePlans >= 3 ? [] : ["repeat_route_plans_below_threshold"]),
    ...(counts.savedCommutes >= 1 ? [] : ["saved_commute_missing"]),
    ...(counts.routeAlertOptIns + counts.navigationOpens >= 2 ? [] : ["route_follow_through_below_threshold"]),
  ];
  return {
    status: blockers.length ? "insufficient_evidence" : "ready_for_local_personalisation",
    blockers,
    counts,
    guidance: blockers.length
      ? "Keep recommendations generic until repeated route behaviour is observed."
      : "Local personalisation can prioritise saved commute context without sending exact addresses or route geometry.",
  };
}

async function readEvents() {
  const raw = await AsyncStorage.getItem(EVENTS_KEY);
  if (!raw) return [] as MonetisationBehaviourEvent[];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.filter(isBehaviourEvent) : [];
}

async function getOrCreateSessionId() {
  const existing = await AsyncStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = createEventId();
  await AsyncStorage.setItem(SESSION_KEY, next);
  return next;
}

function createEventId() {
  return `mb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isBehaviourEvent(value: unknown): value is MonetisationBehaviourEvent {
  return Boolean(
    value &&
      typeof value === "object" &&
      "eventName" in value &&
      "occurredAt" in value &&
      "sessionId" in value,
  );
}
