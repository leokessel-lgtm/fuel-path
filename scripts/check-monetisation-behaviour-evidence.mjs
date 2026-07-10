#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const evidencePath = args.evidenceJson || "docs/templates/MONETISATION-BEHAVIOUR-EVIDENCE.template.json";
const resolvedEvidencePath = resolve(evidencePath);
const evidenceRoot = resolve(args.evidenceRoot || dirname(resolvedEvidencePath));

if (!existsSync(resolvedEvidencePath)) {
  throw new Error(`Monetisation behaviour evidence file not found: ${evidencePath}`);
}

const payload = JSON.parse(readFileSync(resolvedEvidencePath, "utf8"));
const events = Array.isArray(payload.events) ? payload.events : [];
const summary = payload.summary || {};
const decision = payload.decision || {};
const realEvents = events.filter((event) => concreteText(event.sessionId, { min: 2 }) && concreteText(event.eventName, { min: 8 }));
const eventIssues = realEvents.filter((event) => !eventReady(event));
const duplicateEventIds = duplicateIds(realEvents.map((event) => event.eventId));
const sensitiveIssues = sensitiveFieldIssues(payload);
const evidenceIssues = realEvents.filter((event) => !eventEvidenceReady(event));

const eventCounts = {
  routePlansCompleted: countEvents(realEvents, "route_plan_completed"),
  repeatRoutePlanners: uniqueSessionsFor("route_plan_repeated").size,
  savedCommutesCreated: countEvents(realEvents, "saved_commute_created"),
  routeAlertOptIns: countEvents(realEvents, "route_alert_opt_in"),
  navigationOpened: countEvents(realEvents, "navigation_opened"),
  recommendationRejected: countEvents(realEvents, "recommendation_rejected"),
};
const completedSessions = new Set(realEvents.map((event) => String(event.sessionId).trim()).filter(Boolean));
const commuterHighFrequencySessions = new Set(
  realEvents
    .filter((event) => ["commuter", "high_frequency", "gig_driver", "tradie", "service_worker"].includes(normalise(event.segment)))
    .map((event) => String(event.sessionId).trim())
    .filter(Boolean),
);
const commuterHighFrequencySavedRouteDemand = new Set(
  realEvents
    .filter((event) =>
      ["saved_commute_created", "route_alert_opt_in"].includes(event.eventName) &&
      ["commuter", "high_frequency", "gig_driver", "tradie", "service_worker"].includes(normalise(event.segment)),
    )
    .map((event) => String(event.sessionId).trim())
    .filter(Boolean),
);
const smallOperatorPilotOrWtpFollowUps = Number(summary.smallOperatorPilotOrWtpFollowUps || 0);
const privacyObjectionsUnresolved = Number(summary.privacyObjectionsUnresolved || 0);

const consumerReady = (
  completedSessions.size >= 7 &&
  eventCounts.routePlansCompleted >= 7 &&
  eventCounts.navigationOpened >= 3 &&
  commuterHighFrequencySavedRouteDemand.size >= 3 &&
  privacyObjectionsUnresolved === 0
);
const fleetReady = smallOperatorPilotOrWtpFollowUps >= 1 && privacyObjectionsUnresolved === 0;

const blockers = [
  ...(concreteDate(payload.reviewedAt, { allowFuture: false }) && concreteText(payload.reviewer, { min: 6 }) ? [] : ["review_metadata_missing"]),
  ...(realEvents.length ? [] : ["behaviour_events_missing"]),
  ...(eventIssues.length === 0 ? [] : ["behaviour_event_contract_invalid"]),
  ...(duplicateEventIds.length === 0 ? [] : ["duplicate_event_ids"]),
  ...(sensitiveIssues.length === 0 ? [] : ["sensitive_fields_present"]),
  ...(evidenceIssues.length === 0 ? [] : ["event_evidence_incomplete"]),
  ...(consumerReady ? [] : ["consumer_monetisation_behaviour_below_threshold"]),
  ...(fleetReady ? [] : ["fleet_lite_pilot_signal_missing"]),
];

const result = {
  ok: blockers.length === 0,
  status: blockers.length ? "blocked" : "passed",
  source: evidencePath,
  reviewedAt: payload.reviewedAt || "",
  reviewer: payload.reviewer || "",
  collectionMode: payload.collectionMode || "",
  counts: {
    realEventCount: realEvents.length,
    completedSessions: completedSessions.size,
    commuterHighFrequencySessions: commuterHighFrequencySessions.size,
    commuterHighFrequencySavedRouteDemand: commuterHighFrequencySavedRouteDemand.size,
    smallOperatorPilotOrWtpFollowUps,
    privacyObjectionsUnresolved,
    ...eventCounts,
  },
  readiness: {
    consumerMonetisationReady: consumerReady,
    fleetLitePilotReady: fleetReady,
    claimedConsumerMonetisationReady: decision.consumerMonetisationReady === true,
    claimedFleetLitePilotReady: decision.fleetLitePilotReady === true,
  },
  blockers,
  eventIssues: eventIssues.map(eventIssue),
  evidenceIssues: evidenceIssues.map(eventIssue),
  duplicateEventIds,
  sensitiveIssues,
  nextAction: blockers.length
    ? "Collect privacy-safe behaviour evidence before treating route savings as monetisation-ready."
    : "Behaviour evidence thresholds are met. Review objections before adding paid features.",
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok && !args.allowBlocked) process.exit(1);

function eventReady(event) {
  if (!concreteText(event.eventId, { min: 2 })) return false;
  if (!allowedEvents().has(event.eventName)) return false;
  if (!concreteText(event.segment, { min: 4 })) return false;
  if (!Array.isArray(event.regionSet) || event.regionSet.length === 0) return false;
  if (!concreteText(event.fuel, { min: 2 })) return false;
  if (!concreteText(event.evidenceFile, { min: 8 })) return false;

  if (event.eventName === "route_plan_completed") {
    return (
      concreteText(event.resultStatus, { min: 4 }) &&
      concreteText(event.topRecommendationSourceType, { min: 4 }) &&
      validBand(event.bestPriceByCplBand, ["0", "0-2", "2-5", "5-10", "10+"]) &&
      validBand(event.detourMinutesBand, ["0", "0-2", "2-5", "5-10", "10+"]) &&
      validBand(event.routeDistanceKmBand, ["0-10", "10-30", "30-80", "80-200", "200+"])
    );
  }

  if (event.eventName === "route_alert_opt_in") {
    return (
      concreteText(event.alertUseCase, { min: 12 }) &&
      validBand(event.savingThresholdBand || event.bestPriceByCplBand, ["0-2", "2-5", "5-10", "10+"]) &&
      validBand(event.detourThresholdBand || event.detourMinutesBand, ["0", "0-2", "2-5", "5-10", "10+"])
    );
  }

  if (event.eventName === "navigation_opened") {
    return (
      concreteText(event.stationRegion || event.regionSet?.[0], { min: 2 }) &&
      Number.isFinite(Number(event.recommendationRank || 1)) &&
      validBand(event.bestPriceByCplBand, ["0", "0-2", "2-5", "5-10", "10+"]) &&
      validBand(event.detourMinutesBand, ["0", "0-2", "2-5", "5-10", "10+"])
    );
  }

  if (event.eventName === "recommendation_rejected") {
    return concreteText(event.rejectionReason, { min: 12 });
  }

  if (event.eventName === "saved_commute_created") {
    return validBand(event.routeDistanceKmBand, ["0-10", "10-30", "30-80", "80-200", "200+"]);
  }

  return true;
}

function eventEvidenceReady(event) {
  const text = String(event.evidenceFile || "").trim();
  if (!concreteText(text, { min: 8 }) || isAbsolute(text)) return false;
  const filePath = resolve(evidenceRoot, text);
  const rootRelativePath = relative(evidenceRoot, filePath);
  if (rootRelativePath.startsWith("..") || isAbsolute(rootRelativePath)) return false;
  try {
    const stats = statSync(filePath);
    if (!stats.isFile() || stats.size <= 0) return false;
    const rawEvidence = readFileSync(filePath, "utf8");
    if (containsDirectContactDetail(rawEvidence) || sensitiveFieldIssues(JSON.parse(JSON.stringify({ rawEvidence }))).length) return false;
    const evidence = normaliseEvidenceText(rawEvidence);
    const sessionId = normaliseEvidenceText(event.sessionId);
    const eventId = normaliseEvidenceText(event.eventId);
    return Boolean(sessionId) && Boolean(eventId) && evidence.includes(sessionId) && evidence.includes(eventId);
  } catch {
    return false;
  }
}

function allowedEvents() {
  return new Set([
    "route_plan_completed",
    "route_plan_repeated",
    "saved_commute_created",
    "route_alert_opt_in",
    "navigation_opened",
    "recommendation_rejected",
  ]);
}

function sensitiveFieldIssues(value, path = []) {
  if (!value || typeof value !== "object") return [];
  const issues = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    if (sensitiveKey(key)) issues.push(childPath.join("."));
    if (child && typeof child === "object") issues.push(...sensitiveFieldIssues(child, childPath));
  }
  return issues;
}

function sensitiveKey(key) {
  return /^(lat|lon|lng|latitude|longitude|coordinates|routeGeometry|routePoints|pushToken|deviceId|registrationNumber|providerSecret|apiKey|apiSecret|homeAddress|workAddress|stationAddress|rawAddress|savedRouteName)$/i.test(String(key || ""));
}

function containsDirectContactDetail(value) {
  const text = String(value || "");
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return true;
  const phoneLike = text.match(/(?:\+?61|0)[\s-]?(?:4|2|3|7|8)[\d\s-]{7,12}/g) || [];
  return phoneLike.some((match) => match.replace(/\D/g, "").length >= 10);
}

function countEvents(rows, eventName) {
  return rows.filter((event) => event.eventName === eventName).length;
}

function uniqueSessionsFor(eventName) {
  return new Set(realEvents.filter((event) => event.eventName === eventName).map((event) => String(event.sessionId).trim()).filter(Boolean));
}

function validBand(value, allowed) {
  return allowed.includes(String(value || "").trim());
}

function eventIssue(event) {
  return {
    eventId: String(event.eventId || "").trim(),
    sessionId: String(event.sessionId || "").trim(),
    eventName: String(event.eventName || "").trim(),
  };
}

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function normaliseEvidenceText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function concreteText(value, { min = 1 } = {}) {
  const text = String(value || "").trim();
  return text.length >= min && !/placeholder|todo|tbc|example|synthetic|internal-only/i.test(text);
}

function concreteDate(value, { allowFuture = true } = {}) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return false;
  if (allowFuture) return true;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return date.getTime() <= todayUtc.getTime();
}

function duplicateIds(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    const id = String(value || "").trim();
    if (!id) continue;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--evidence-json") {
      parsed.evidenceJson = values[index + 1] || "";
      index += 1;
    } else if (value === "--evidence-root") {
      parsed.evidenceRoot = values[index + 1] || "";
      index += 1;
    } else if (value === "--allow-blocked") {
      parsed.allowBlocked = true;
    }
  }
  return parsed;
}
