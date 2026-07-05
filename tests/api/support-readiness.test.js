const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const READY_SUPPORT_RUNBOOK_SOURCE = path.join(ROOT, "tests", "fixtures", "support-runbook-ready.md");

test("support readiness blocks without contact owner and review date", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-support-readiness.mjs", "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("support_contact_missing"), true);
  assert.equal(payload.blockers.includes("support_owner_missing"), true);
  assert.equal(payload.blockers.includes("support_review_date_missing"), true);
  assert.deepEqual(payload.missingSections, []);
});

test("support readiness can load contact owner and review date from evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-support-readiness-"));
  const evidence = path.join(tmp, "support-evidence.json");
  fs.writeFileSync(
    evidence,
    JSON.stringify(
      {
        runbook: READY_SUPPORT_RUNBOOK_SOURCE,
        supportContact: "support@fuelpath.app",
        supportOwner: "Leo Kesselring",
        reviewedAt: "2026-06-20",
      },
      null,
      2,
    ),
  );

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-support-readiness.mjs", "--evidence-json", evidence],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "ready");
  assert.equal(payload.evidence.provided, true);
  assert.equal(payload.supportContact, "support@fuelpath.app");
  assert.equal(payload.supportOwner, "Leo Kesselring");
  assert.equal(payload.reviewedAt, "2026-06-20");
});

test("support readiness rejects incomplete runbooks", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-support-readiness-"));
  const runbook = path.join(tmp, "SUPPORT-RUNBOOK.md");
  fs.writeFileSync(runbook, "# Support\n\n## Intake\n\nBasic inbox only.\n");

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--runbook",
      runbook,
      "--support-contact",
      "support@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--reviewed-at",
      "2026-06-20",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("support_runbook_missing_triage"), true);
  assert.equal(payload.blockers.includes("support_triage_priorities_missing"), true);
});

test("support readiness requires actual markdown section headings", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-support-readiness-"));
  const runbook = path.join(tmp, "SUPPORT-RUNBOOK.md");
  fs.writeFileSync(
    runbook,
    [
      "# Support",
      "This placeholder mentions ## Intake, ## Triage, ## Escalation, ## Privacy And Data Requests,",
      "## Provider Price Issues, ## Native Device Issues and ## Evidence Logging but does not define sections.",
      "P0 P1 P2 privacy deletion fuel price map location alert failure.",
    ].join("\n"),
  );

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--runbook",
      runbook,
      "--support-contact",
      "support@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--reviewed-at",
      "2026-06-20",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("support_runbook_missing_intake"), true);
  assert.equal(payload.blockers.includes("support_runbook_missing_triage"), true);
  assert.deepEqual(payload.missingSections, [
    "## Intake",
    "## Triage",
    "## Escalation",
    "## Privacy And Data Requests",
    "## Provider Price Issues",
    "## Native Device Issues",
    "## Evidence Logging",
  ]);
});

test("support readiness requires every support evidence scope", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-support-readiness-"));
  const runbook = path.join(tmp, "SUPPORT-RUNBOOK.md");
  fs.writeFileSync(
    runbook,
    [
      "# Support",
      "## Intake",
      "Privacy and deletion requests are handled by the owner.",
      "## Triage",
      "P0 P1 P2",
      "## Escalation",
      "Escalate privacy incidents.",
      "## Privacy And Data Requests",
      "Record privacy and deletion requests.",
      "## Provider Price Issues",
      "Record incoming issues.",
      "## Native Device Issues",
      "Record incoming issues.",
      "## Evidence Logging",
      "Record privacy and deletion coverage.",
    ].join("\n\n"),
  );

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--runbook",
      runbook,
      "--support-contact",
      "support@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--reviewed-at",
      "2026-06-20",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.blockers.includes("support_evidence_scope_incomplete"), true);
  assert.deepEqual(payload.missingEvidenceScopes, ["provider-price", "map/location", "alert-failure"]);
});

test("support readiness rejects future review dates", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--support-contact",
      "support@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--reviewed-at",
      "2099-01-01",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.reviewDateReady, false);
  assert.equal(payload.reviewAgeDays, null);
  assert.equal(payload.blockers.includes("support_review_date_missing"), true);
});

test("support readiness rejects stale review dates", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--support-contact",
      "support@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--reviewed-at",
      "2026-01-01",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.reviewDateReady, false);
  assert.equal(payload.reviewFresh, false);
  assert.equal(payload.blockers.includes("support_review_date_stale"), true);
});

test("support readiness rejects vague owner and personal inbox evidence", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--support-contact",
      "fuelpath.support@gmail.com",
      "--support-owner",
      "support team",
      "--reviewed-at",
      "2026-06-20",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.supportContactReady, false);
  assert.equal(payload.supportOwnerReady, false);
  assert.equal(payload.blockers.includes("support_contact_missing"), true);
  assert.equal(payload.blockers.includes("support_owner_missing"), true);
});

test("support readiness rejects generic public support contact URLs", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--support-contact",
      "https://forms.gle/example-support",
      "--support-owner",
      "Leo Kesselring",
      "--reviewed-at",
      "2026-06-20",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.supportContactReady, false);
  assert.equal(payload.blockers.includes("support_contact_missing"), true);
});

test("support readiness accepts Fuel Path-owned support contact URLs", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-support-readiness-"));
  const runbook = path.join(tmp, "SUPPORT-RUNBOOK.md");
  fs.copyFileSync(READY_SUPPORT_RUNBOOK_SOURCE, runbook);
  fs.appendFileSync(runbook, "\nSupport URL: https://fuel-path.vercel.app/web-demo/privacy#contact\n");

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--runbook",
      runbook,
      "--support-contact",
      "https://fuel-path.vercel.app/web-demo/privacy#contact",
      "--support-owner",
      "Leo Kesselring",
      "--reviewed-at",
      "2026-06-20",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "ready");
  assert.equal(payload.supportContactReady, true);
});

test("support readiness requires claimed contact and owner in the runbook", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-support-readiness-"));
  const runbook = path.join(tmp, "SUPPORT-RUNBOOK.md");
  fs.copyFileSync(READY_SUPPORT_RUNBOOK_SOURCE, runbook);
  const withoutPublishedLines = fs
    .readFileSync(runbook, "utf8")
    .replace(/^Support contact:.*\n/gm, "")
    .replace(/^Support owner:.*\n/gm, "");
  fs.writeFileSync(runbook, withoutPublishedLines);

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--runbook",
      runbook,
      "--support-contact",
      "support@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--reviewed-at",
      "2026-06-20",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.supportContactReady, true);
  assert.equal(payload.supportOwnerReady, true);
  assert.equal(payload.runbookPublishesSupportContact, false);
  assert.equal(payload.runbookPublishesSupportOwner, false);
  assert.equal(payload.blockers.includes("support_contact_not_in_runbook"), true);
  assert.equal(payload.blockers.includes("support_owner_not_in_runbook"), true);
});

test("support readiness ignores contact and owner mentioned only in warnings", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-support-readiness-"));
  const runbook = path.join(tmp, "SUPPORT-RUNBOOK.md");
  fs.copyFileSync(READY_SUPPORT_RUNBOOK_SOURCE, runbook);
  const withoutPublishedLines = fs
    .readFileSync(runbook, "utf8")
    .replace(/^Support contact:.*\n/gm, "")
    .replace(/^Support owner:.*\n/gm, "");
  fs.writeFileSync(
    runbook,
    [
      withoutPublishedLines,
      "Do not treat support@fuelpath.app as published merely because it appears in a warning.",
      "Do not treat Leo Kesselring as the accountable owner unless the runbook labels that owner.",
    ].join("\n"),
  );

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--runbook",
      runbook,
      "--support-contact",
      "support@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--reviewed-at",
      "2026-06-20",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.supportContactReady, true);
  assert.equal(payload.supportOwnerReady, true);
  assert.equal(payload.runbookPublishesSupportContact, false);
  assert.equal(payload.runbookPublishesSupportOwner, false);
  assert.equal(payload.blockers.includes("support_contact_not_in_runbook"), true);
  assert.equal(payload.blockers.includes("support_owner_not_in_runbook"), true);
});

test("support readiness passes with runbook contact owner and review date", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-support-readiness.mjs",
      "--runbook",
      READY_SUPPORT_RUNBOOK_SOURCE,
      "--support-contact",
      "support@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--reviewed-at",
      "2026-06-20",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "ready");
  assert.deepEqual(payload.blockers, []);
  assert.equal(payload.supportContactReady, true);
  assert.equal(payload.supportOwnerReady, true);
  assert.equal(payload.reviewDateReady, true);
  assert.equal(payload.reviewFresh, true);
});
