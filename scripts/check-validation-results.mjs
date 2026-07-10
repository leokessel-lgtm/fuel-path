#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const resultsPath = args.resultsJson || "docs/templates/VALIDATION-RESULTS.template.json";
const resolvedResultsPath = resolve(resultsPath);
const evidenceRoot = resolve(args.evidenceRoot || dirname(resolvedResultsPath));

if (!existsSync(resolvedResultsPath)) {
  throw new Error(`Validation results file not found: ${resultsPath}`);
}

const payload = JSON.parse(readFileSync(resolvedResultsPath, "utf8"));
const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
const realSessions = sessions.filter((session) => session.realParticipant === true && session.synthetic !== true);
const completed = realSessions.filter((session) => session.completed === true);
const incompleteEvidenceSessions = completed.filter((session) => !sessionEvidenceReady(session));
const duplicateSessionIds = duplicateIds(completed.map((session) => session.sessionId));
const commuterHighFrequency = completed.filter((session) =>
  ["commuter", "high_frequency", "gig_driver", "tradie", "service_worker"].includes(normalise(session.segment)),
);
const discountUsers = completed.filter((session) => session.discountUser === true);
const smallOperators = completed.filter((session) =>
  ["small_fleet", "small_operator", "tradie", "service_worker"].includes(normalise(session.segment)),
);

const behaviourChangeCount = count(completed, "wouldChangeRealDecision");
const netSavingUnderstandingCount = count(completed, "understoodNetSavingWithoutExplanation");
const understoodTopCount = count(completed, "understoodTopRecommendationWithoutExplanation");
const alertWantedCount = count(commuterHighFrequency, "wantsSavedRouteAlerts");
const alertSpamCount = count(completed, "describedAlertsAsSpam");
const priceSplitCount = count(discountUsers, "understoodPumpVsConfirmedVsPossible");
const possibleMistakeCount = count(discountUsers, "mistookPossibleOfferAsGuaranteed");
const smallOperatorPilotCount = count(smallOperators, "pilotOrWtpFollowUp");

const blockers = [
  ...(completed.length >= 7 ? [] : ["real_sessions_below_7"]),
  ...(incompleteEvidenceSessions.length === 0 ? [] : ["completed_session_evidence_incomplete"]),
  ...(duplicateSessionIds.length === 0 ? [] : ["duplicate_session_ids"]),
  ...(behaviourChangeCount >= 4 ? [] : ["phase1_behaviour_change_below_4_of_7"]),
  ...(netSavingUnderstandingCount >= 5 ? [] : ["phase1_net_saving_understanding_below_5_of_7"]),
  ...(understoodTopCount >= 4 ? [] : ["phase1_understanding_below_4_of_7"]),
  ...(commuterHighFrequency.length >= 4 ? [] : ["phase2_commuter_high_frequency_below_4"]),
  ...(alertWantedCount >= 3 ? [] : ["phase2_alert_demand_below_3_of_4"]),
  ...(alertSpamCount === 0 ? [] : ["phase2_alerts_described_as_spam"]),
  ...(discountUsers.length >= 5 ? [] : ["phase3_discount_users_below_5"]),
  ...(priceSplitCount >= 4 ? [] : ["phase3_price_split_understanding_below_4_of_5"]),
  ...(possibleMistakeCount === 0 ? [] : ["phase3_possible_offer_mistaken_as_guaranteed"]),
  ...(smallOperatorPilotCount >= 1 ? [] : ["phase4_small_operator_pilot_or_wtp_missing"]),
];

const result = {
  ok: blockers.length === 0,
  status: blockers.length ? "blocked" : "passed",
  source: resultsPath,
  counts: {
    completedRealSessions: completed.length,
    incompleteEvidenceSessions: incompleteEvidenceSessions.length,
    duplicateSessionIds: duplicateSessionIds.length,
    behaviourChangeCount,
    netSavingUnderstandingCount,
    understoodTopRecommendationCount: understoodTopCount,
    commuterHighFrequencySessions: commuterHighFrequency.length,
    savedRouteAlertDemandCount: alertWantedCount,
    alertSpamCount,
    discountUserSessions: discountUsers.length,
    priceSplitUnderstandingCount: priceSplitCount,
    possibleOfferMistakeCount: possibleMistakeCount,
    smallOperatorPilotOrWtpCount: smallOperatorPilotCount,
  },
  blockers,
  evidenceIssues: incompleteEvidenceSessions.map((session) => ({
    sessionId: String(session.sessionId || "").trim(),
    segment: normalise(session.segment),
  })),
  duplicateSessionIds,
  nextAction: blockers.length
    ? "Run real validation sessions and record structured outcomes before treating the roadmap gates as proven."
    : "Validation gates are met. Review verbatim objections before widening the roadmap.",
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok && !args.allowBlocked) process.exit(1);

function count(rows, field) {
  return rows.filter((row) => row[field] === true).length;
}

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function sessionEvidenceReady(session) {
  const segment = normalise(session.segment);
  const commuterLike = ["commuter", "high_frequency", "gig_driver", "tradie", "service_worker"].includes(segment);
  return (
    concreteText(session.sessionId, { min: 2 }) &&
    concreteDate(session.sessionDate, { allowFuture: false }) &&
    concreteText(session.segment, { min: 4 }) &&
    concreteText(session.evidenceFile, { min: 8 }) &&
    evidenceFileReady(session.evidenceFile, session) &&
    concreteText(session.quote, { min: 12 }) &&
    concreteText(session.mainTrustObjection, { min: 20 }) &&
    concreteText(session.recommendationExplanation, { min: 20 }) &&
    concreteText(session.netSavingExplanation, { min: 20 }) &&
    (!commuterLike || concreteText(session.alertUseCase, { min: 20 })) &&
    (!session.discountUser || concreteText(session.discountPriceExplanation, { min: 20 })) &&
    (!session.discountUser || concreteText(session.possibleOfferInterpretation, { min: 20 })) &&
    Number.isFinite(Number(session.minimumWorthwhileSavingDollars)) &&
    Number(session.minimumWorthwhileSavingDollars) >= 0 &&
    Number.isFinite(Number(session.maximumAcceptableDetourMinutes)) &&
    Number(session.maximumAcceptableDetourMinutes) >= 0
  );
}

function evidenceFileReady(value, session = {}) {
  const text = String(value || "").trim();
  if (!concreteText(text, { min: 8 }) || isAbsolute(text)) return false;
  const filePath = resolve(evidenceRoot, text);
  const rootRelativePath = relative(evidenceRoot, filePath);
  if (rootRelativePath.startsWith("..") || isAbsolute(rootRelativePath)) return false;
  try {
    const stats = statSync(filePath);
    if (!stats.isFile() || stats.size <= 0) return false;
    const rawEvidence = readFileSync(filePath, "utf8");
    if (containsDirectContactDetail(rawEvidence)) return false;
    const evidence = normaliseEvidenceText(rawEvidence);
    const sessionId = normaliseEvidenceText(session.sessionId);
    const sessionDate = normaliseEvidenceText(session.sessionDate);
    const quote = normaliseEvidenceText(session.quote);
    return (
      Boolean(sessionId) &&
      Boolean(sessionDate) &&
      Boolean(quote) &&
      evidence.includes(sessionId) &&
      evidence.includes(sessionDate) &&
      evidence.includes(quote)
    );
  } catch {
    return false;
  }
}

function normaliseEvidenceText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function containsDirectContactDetail(value) {
  const text = String(value || "");
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return true;
  const phoneLike = text.match(/(?:\+?61|0)[\s-]?(?:4|2|3|7|8)[\d\s-]{7,12}/g) || [];
  return phoneLike.some((match) => match.replace(/\D/g, "").length >= 10);
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
    if (value === "--results-json") {
      parsed.resultsJson = values[index + 1] || "";
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
