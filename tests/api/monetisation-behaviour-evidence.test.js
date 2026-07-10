const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("monetisation behaviour template stays blocked until behaviour is recorded", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-monetisation-behaviour-evidence.mjs",
      "--evidence-json",
      "docs/templates/MONETISATION-BEHAVIOUR-EVIDENCE.template.json",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.counts.realEventCount, 0);
  assert.equal(payload.blockers.includes("review_metadata_missing"), true);
  assert.equal(payload.blockers.includes("behaviour_events_missing"), true);
  assert.equal(payload.blockers.includes("consumer_monetisation_behaviour_below_threshold"), true);
  assert.equal(payload.blockers.includes("fleet_lite_pilot_signal_missing"), true);
});

test("monetisation behaviour evidence rejects sensitive fields", async () => {
  const evidence = writeEvidence({
    events: [
      {
        ...baseEvent("E1", "S1", "route_plan_completed"),
        coordinates: [{ lat: -33.8, lon: 151.2 }],
      },
    ],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-monetisation-behaviour-evidence.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("sensitive_fields_present"), true);
  assert.deepEqual(payload.sensitiveIssues, [
    "events.0.coordinates",
    "events.0.coordinates.0.lat",
    "events.0.coordinates.0.lon",
  ]);
});

test("monetisation behaviour evidence rejects incomplete event evidence files", async () => {
  const evidence = writeEvidence({
    events: [baseEvent("E1", "S1", "route_plan_completed")],
  }, { omitEvidenceFiles: ["E1"] });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-monetisation-behaviour-evidence.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("event_evidence_incomplete"), true);
  assert.deepEqual(payload.evidenceIssues, [{ eventId: "E1", sessionId: "S1", eventName: "route_plan_completed" }]);
});

test("monetisation behaviour evidence passes when consumer and fleet thresholds are met", async () => {
  const events = [];
  for (let index = 1; index <= 7; index += 1) {
    const sessionId = `S${index}`;
    const segment = index <= 4 ? "commuter" : index === 5 ? "small_fleet" : "manual_price_shopper";
    events.push(baseEvent(`E${index}`, sessionId, "route_plan_completed", { segment }));
  }
  events.push(baseEvent("E8", "S1", "saved_commute_created", { routeDistanceKmBand: "10-30" }));
  events.push(baseEvent("E9", "S2", "route_alert_opt_in", { alertUseCase: "Commute fuel alert before the school run", savingThresholdBand: "5-10", detourThresholdBand: "2-5" }));
  events.push(baseEvent("E10", "S3", "route_alert_opt_in", { alertUseCase: "Work route alert before leaving home", savingThresholdBand: "5-10", detourThresholdBand: "2-5" }));
  events.push(baseEvent("E11", "S1", "navigation_opened", { stationRegion: "WA", recommendationRank: 1 }));
  events.push(baseEvent("E12", "S2", "navigation_opened", { stationRegion: "VIC", recommendationRank: 1 }));
  events.push(baseEvent("E13", "S3", "navigation_opened", { stationRegion: "SA", recommendationRank: 1 }));

  const evidence = writeEvidence({
    events,
    summary: {
      realParticipants: 7,
      routePlansCompleted: 7,
      repeatRoutePlanners: 0,
      savedCommutesCreated: 1,
      routeAlertOptIns: 2,
      navigationOpened: 3,
      recommendationRejected: 0,
      commuterOrHighFrequencyUsers: 4,
      commuterOrHighFrequencySavedRouteDemand: 3,
      smallOperatorPilotOrWtpFollowUps: 1,
      privacyObjectionsUnresolved: 0,
    },
    decision: {
      consumerMonetisationReady: true,
      fleetLitePilotReady: true,
      mainBlocker: "",
      nextAction: "Review objections before pricing.",
    },
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-monetisation-behaviour-evidence.mjs", "--evidence-json", evidence],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "passed");
  assert.equal(payload.readiness.consumerMonetisationReady, true);
  assert.equal(payload.readiness.fleetLitePilotReady, true);
  assert.equal(payload.counts.completedSessions, 7);
});

function writeEvidence(overrides = {}, { omitEvidenceFiles = [] } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-monetisation-evidence-"));
  const payload = {
    reviewedAt: "2026-06-30",
    reviewer: "Leo Kesselring",
    collectionMode: "manual_validation_notes",
    events: [],
    summary: {
      smallOperatorPilotOrWtpFollowUps: 0,
      privacyObjectionsUnresolved: 0,
    },
    decision: {
      consumerMonetisationReady: false,
      fleetLitePilotReady: false,
      mainBlocker: "",
      nextAction: "",
    },
    ...overrides,
  };

  for (const event of payload.events) {
    if (omitEvidenceFiles.includes(event.eventId)) continue;
    const evidenceFile = event.evidenceFile || `notes/${event.eventId}.md`;
    event.evidenceFile = evidenceFile;
    const evidencePath = path.join(tmp, evidenceFile);
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(evidencePath, `# ${event.eventId}\n\nSession: ${event.sessionId}\n\nBehaviour evidence recorded.\n`);
  }

  const filePath = path.join(tmp, "MONETISATION-BEHAVIOUR-EVIDENCE-2026-06-30.json");
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

function baseEvent(eventId, sessionId, eventName, overrides = {}) {
  return {
    eventId,
    sessionId,
    eventName,
    segment: "commuter",
    regionSet: ["WA"],
    fuel: "U91",
    resultStatus: "recommended",
    topRecommendationSourceType: "official_live",
    bestPriceByCplBand: "5-10",
    detourMinutesBand: "2-5",
    routeDistanceKmBand: "10-30",
    rejectionReason: "",
    alertUseCase: "",
    evidenceFile: `notes/${eventId}.md`,
    ...overrides,
  };
}
