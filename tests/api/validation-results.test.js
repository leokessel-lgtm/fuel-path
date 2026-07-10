const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("validation results template stays blocked until real sessions are recorded", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", "docs/templates/VALIDATION-RESULTS.template.json", "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.counts.completedRealSessions, 0);
  assert.equal(payload.blockers.includes("real_sessions_below_7"), true);
  assert.equal(payload.blockers.includes("completed_session_evidence_incomplete"), false);
  assert.equal(payload.blockers.includes("phase1_behaviour_change_below_4_of_7"), true);
  assert.equal(payload.blockers.includes("phase1_net_saving_understanding_below_5_of_7"), true);
  assert.equal(payload.blockers.includes("phase3_discount_users_below_5"), true);
});

test("validation results ignore synthetic sessions and block spam feedback", async () => {
  const results = writeResults([
    ...passingSessions().map((session) => ({ ...session, synthetic: true })),
    {
      ...session("real-spam", "commuter"),
      completed: true,
      realParticipant: true,
      wouldChangeRealDecision: true,
      understoodTopRecommendationWithoutExplanation: true,
      wantsSavedRouteAlerts: true,
      describedAlertsAsSpam: true,
      discountUser: true,
      understoodPumpVsConfirmedVsPossible: true,
    },
  ]);

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.counts.completedRealSessions, 1);
  assert.equal(payload.blockers.includes("completed_session_evidence_incomplete"), false);
  assert.equal(payload.blockers.includes("phase2_alerts_described_as_spam"), true);
  assert.equal(payload.blockers.includes("real_sessions_below_7"), true);
});

test("validation results require concrete evidence for each completed real session", async () => {
  const rows = passingSessions();
  rows[0] = {
    ...rows[0],
    evidenceFile: "",
    quote: "nice app",
    minimumWorthwhileSavingDollars: null,
  };
  const results = writeResults(rows);

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("completed_session_evidence_incomplete"), true);
  assert.equal(payload.counts.incompleteEvidenceSessions, 1);
  assert.deepEqual(payload.evidenceIssues, [{ sessionId: "S1", segment: "commuter" }]);
});

test("validation results require referenced evidence files to exist", async () => {
  const rows = passingSessions();
  const results = writeResults(rows, { omitEvidenceFiles: ["S1"] });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("completed_session_evidence_incomplete"), true);
  assert.equal(payload.counts.incompleteEvidenceSessions, 1);
  assert.deepEqual(payload.evidenceIssues, [{ sessionId: "S1", segment: "commuter" }]);
});

test("validation results require evidence files to support the matching session row", async () => {
  const rows = passingSessions();
  const results = writeResults(rows, {
    evidenceOverrides: {
      S1: "# S9\n\nThis unrelated note does not support the recorded participant quote.\n",
    },
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("completed_session_evidence_incomplete"), true);
  assert.equal(payload.counts.incompleteEvidenceSessions, 1);
  assert.deepEqual(payload.evidenceIssues, [{ sessionId: "S1", segment: "commuter" }]);
});

test("validation results require evidence files to include the matching session date", async () => {
  const rows = passingSessions();
  const results = writeResults(rows, {
    evidenceOverrides: {
      S1: `# S1\n\n${rows[0].quote}\n`,
    },
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("completed_session_evidence_incomplete"), true);
  assert.equal(payload.counts.incompleteEvidenceSessions, 1);
  assert.deepEqual(payload.evidenceIssues, [{ sessionId: "S1", segment: "commuter" }]);
});

test("validation results reject evidence files with direct contact details", async () => {
  const rows = passingSessions();
  const results = writeResults(rows, {
    evidenceOverrides: {
      S1: `# S1\n\nDate: 2026-06-20\n\nParticipant: person@example.com 0400 123 456\n\n${rows[0].quote}\n`,
    },
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("completed_session_evidence_incomplete"), true);
  assert.equal(payload.counts.incompleteEvidenceSessions, 1);
  assert.deepEqual(payload.evidenceIssues, [{ sessionId: "S1", segment: "commuter" }]);
});

test("validation results reject future-dated completed sessions", async () => {
  const rows = passingSessions();
  rows[0] = { ...rows[0], sessionDate: "2099-01-01" };
  const results = writeResults(rows);

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("completed_session_evidence_incomplete"), true);
  assert.equal(payload.counts.incompleteEvidenceSessions, 1);
  assert.deepEqual(payload.evidenceIssues, [{ sessionId: "S1", segment: "commuter" }]);
});

test("validation results reject duplicate completed session IDs", async () => {
  const rows = passingSessions();
  rows[1] = { ...rows[1], sessionId: "S1" };
  const results = writeResults(rows);

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("duplicate_session_ids"), true);
  assert.deepEqual(payload.duplicateSessionIds, ["S1"]);
});

test("validation results require explanation notes behind discount understanding booleans", async () => {
  const rows = passingSessions();
  rows[0] = {
    ...rows[0],
    discountPriceExplanation: "",
    possibleOfferInterpretation: "",
  };
  const results = writeResults(rows);

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("completed_session_evidence_incomplete"), true);
  assert.equal(payload.counts.incompleteEvidenceSessions, 1);
  assert.deepEqual(payload.evidenceIssues, [{ sessionId: "S1", segment: "commuter" }]);
});

test("validation results require a concrete trust objection for each completed session", async () => {
  const rows = passingSessions();
  rows[0] = {
    ...rows[0],
    mainTrustObjection: "",
  };
  const results = writeResults(rows);

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("completed_session_evidence_incomplete"), true);
  assert.equal(payload.counts.incompleteEvidenceSessions, 1);
  assert.deepEqual(payload.evidenceIssues, [{ sessionId: "S1", segment: "commuter" }]);
});

test("validation results require 5 of 7 to understand net saving", async () => {
  const rows = passingSessions().map((session) => ({
    ...session,
    understoodNetSavingWithoutExplanation: false,
  }));
  rows[0].understoodNetSavingWithoutExplanation = true;
  rows[1].understoodNetSavingWithoutExplanation = true;
  rows[2].understoodNetSavingWithoutExplanation = true;
  rows[3].understoodNetSavingWithoutExplanation = true;
  const results = writeResults(rows);

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.counts.netSavingUnderstandingCount, 4);
  assert.deepEqual(payload.blockers, ["phase1_net_saving_understanding_below_5_of_7"]);
});

test("validation results pass only when every roadmap gate is met", async () => {
  const results = writeResults(passingSessions());

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-validation-results.mjs", "--results-json", results],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "passed");
  assert.deepEqual(payload.blockers, []);
  assert.equal(payload.counts.completedRealSessions, 7);
  assert.equal(payload.counts.incompleteEvidenceSessions, 0);
  assert.equal(payload.counts.duplicateSessionIds, 0);
  assert.equal(payload.counts.behaviourChangeCount, 5);
  assert.equal(payload.counts.netSavingUnderstandingCount, 5);
  assert.equal(payload.counts.understoodTopRecommendationCount, 5);
  assert.equal(payload.counts.commuterHighFrequencySessions, 4);
  assert.equal(payload.counts.savedRouteAlertDemandCount, 3);
  assert.equal(payload.counts.discountUserSessions, 5);
  assert.equal(payload.counts.priceSplitUnderstandingCount, 4);
  assert.equal(payload.counts.possibleOfferMistakeCount, 0);
  assert.equal(payload.counts.smallOperatorPilotOrWtpCount, 1);
});

function passingSessions() {
  return [
    {
      ...session("S1", "commuter"),
      wouldChangeRealDecision: true,
      understoodNetSavingWithoutExplanation: true,
      understoodTopRecommendationWithoutExplanation: true,
      wantsSavedRouteAlerts: true,
      discountUser: true,
      understoodPumpVsConfirmedVsPossible: true,
    },
    {
      ...session("S2", "commuter"),
      wouldChangeRealDecision: true,
      understoodNetSavingWithoutExplanation: true,
      understoodTopRecommendationWithoutExplanation: true,
      wantsSavedRouteAlerts: true,
      discountUser: true,
      understoodPumpVsConfirmedVsPossible: true,
    },
    {
      ...session("S3", "high_frequency"),
      wouldChangeRealDecision: true,
      understoodNetSavingWithoutExplanation: true,
      understoodTopRecommendationWithoutExplanation: true,
      wantsSavedRouteAlerts: true,
      discountUser: true,
      understoodPumpVsConfirmedVsPossible: true,
    },
    {
      ...session("S4", "tradie"),
      wouldChangeRealDecision: false,
      understoodNetSavingWithoutExplanation: true,
      understoodTopRecommendationWithoutExplanation: true,
      wantsSavedRouteAlerts: false,
      discountUser: true,
      understoodPumpVsConfirmedVsPossible: true,
      pilotOrWtpFollowUp: true,
    },
    {
      ...session("S5", "small_fleet"),
      wouldChangeRealDecision: true,
      understoodNetSavingWithoutExplanation: true,
      understoodTopRecommendationWithoutExplanation: false,
      discountUser: true,
      understoodPumpVsConfirmedVsPossible: false,
    },
    {
      ...session("S6", "road_trip"),
      wouldChangeRealDecision: false,
      understoodTopRecommendationWithoutExplanation: true,
    },
    {
      ...session("S7", "manual_price_shopper"),
      wouldChangeRealDecision: true,
      understoodTopRecommendationWithoutExplanation: false,
    },
  ];
}

function session(sessionId, segment) {
  return {
    sessionId,
    sessionDate: "2026-06-20",
    segment,
    completed: true,
    realParticipant: true,
    synthetic: false,
    discountUser: false,
    wouldChangeRealDecision: false,
    understoodNetSavingWithoutExplanation: false,
    understoodTopRecommendationWithoutExplanation: false,
    wantsSavedRouteAlerts: false,
    describedAlertsAsSpam: false,
    understoodPumpVsConfirmedVsPossible: false,
    mistookPossibleOfferAsGuaranteed: false,
    pilotOrWtpFollowUp: false,
    minimumWorthwhileSavingDollars: 5,
    maximumAcceptableDetourMinutes: 8,
    mainTrustObjection: "Needs source and freshness to be obvious before driving.",
    recommendationExplanation: "Participant explained the top stop, route reason and main caveat without moderator rescue.",
    netSavingExplanation: "Participant explained saving after detour, fuel used and time trade-off without moderator rescue.",
    alertUseCase: "Participant described a saved commute or regular route alert they would keep enabled.",
    discountPriceExplanation: "Participant explained pump price, confirmed wallet price and possible lower price separately.",
    possibleOfferInterpretation: "Participant said the possible lower price was not guaranteed unless configured and unused.",
    quote: `I would check this before a real ${segment.replace(/_/g, " ")} trip.`,
    evidenceFile: `validation-notes/${sessionId}.md`,
  };
}

function writeResults(sessions, options = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-validation-results-"));
  const filePath = path.join(tmp, "results.json");
  fs.writeFileSync(filePath, `${JSON.stringify({ sessions }, null, 2)}\n`);
  const omitted = new Set(options.omitEvidenceFiles || []);
  for (const row of sessions) {
    if (!row.evidenceFile || omitted.has(row.sessionId)) continue;
    const evidencePath = path.join(tmp, row.evidenceFile);
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(
      evidencePath,
      options.evidenceOverrides?.[row.sessionId] || `# ${row.sessionId}\n\nDate: ${row.sessionDate}\n\n${row.quote}\n`,
    );
  }
  return filePath;
}
