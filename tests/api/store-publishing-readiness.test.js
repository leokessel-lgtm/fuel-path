const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const READY_PRIVACY_POLICY_SOURCE = path.join(ROOT, "tests", "fixtures", "privacy-policy-ready.html");

test("store publishing readiness blocks placeholder template evidence", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-store-publishing-readiness.mjs",
      "--evidence-json",
      "STORE-PUBLISHING-EVIDENCE.template.json",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.privacyPolicyReady, true);
  assert.match(payload.nextAction, /Fuel Path-owned public policy URL/);
  assert.deepEqual(payload.blockers, [
    "privacy_contact_missing",
    "store_listing_links_missing",
    "apple_privacy_review_missing",
    "google_data_safety_review_missing",
    "provider_limitations_disclosure_missing",
    "support_process_missing",
  ]);
});

test("store publishing readiness rejects non-public policy URLs and placeholder contacts", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@example.com",
    privacyPolicyUrl: "http://localhost:3000/privacy",
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.privacyContactConfirmed, false);
  assert.equal(payload.privacyPolicyReady, false);
  assert.deepEqual(payload.blockers, ["privacy_contact_missing", "privacy_policy_url_missing"]);
});

test("store publishing readiness rejects third-party hosted privacy policy URLs", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const policySource = path.join(tmp, "privacy.html");
  fs.writeFileSync(policySource, "Contact privacy at privacy@fuelpath.app\n");
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://notion.site/fuel-path-privacy",
    privacyPolicySource: policySource,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.privacyContactConfirmed, true);
  assert.equal(payload.privacyPolicyReady, false);
  assert.deepEqual(payload.blockers, ["privacy_policy_url_missing"]);
});

test("store publishing readiness requires review metadata when release flags are set", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.reviewEvidenceRequired, true);
  assert.equal(payload.reviewEvidenceReady, false);
  assert.deepEqual(payload.blockers, ["store_review_metadata_missing"]);
});

test("store publishing readiness rejects personal inboxes and generic reviewers", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "fuelpath.privacy@gmail.com",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "release owner",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.privacyContactConfirmed, false);
  assert.equal(payload.reviewEvidenceReady, false);
  assert.deepEqual(payload.blockers, ["privacy_contact_missing", "store_review_metadata_missing"]);
});

test("store publishing readiness rejects generic public privacy contact URLs", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "https://forms.gle/example-support",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.privacyContactConfirmed, false);
  assert.deepEqual(payload.blockers, ["privacy_contact_missing"]);
});

test("store publishing readiness accepts Fuel Path-owned privacy contact URLs", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const policySource = path.join(tmp, "privacy.html");
  fs.writeFileSync(policySource, "Contact privacy at https://fuel-path.vercel.app/web-demo/privacy#contact\n");
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "https://fuel-path.vercel.app/web-demo/privacy#contact",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: policySource,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "ready");
  assert.equal(payload.privacyContactConfirmed, true);
  assert.equal(payload.privacyPolicyContactPublished, true);
});

test("store publishing readiness requires concrete release review references", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "done",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "todo",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "",
    supportProcessReady: true,
    supportProcessReference: "checked",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.blockers, [
    "apple_privacy_review_evidence_missing",
    "google_data_safety_review_evidence_missing",
    "provider_limitations_disclosure_evidence_missing",
    "support_process_evidence_missing",
  ]);
});

test("store publishing readiness rejects vague dated review references", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "reviewed 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "done 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "launch checked 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "yes 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.blockers, [
    "apple_privacy_review_evidence_missing",
    "google_data_safety_review_evidence_missing",
    "provider_limitations_disclosure_evidence_missing",
    "support_process_evidence_missing",
  ]);
});

test("store publishing readiness rejects release references filed under the wrong evidence category", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "support-runbook-review-note-2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "App listing provider limitations copy reviewed 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.blockers, [
    "apple_privacy_review_evidence_missing",
    "google_data_safety_review_evidence_missing",
    "provider_limitations_disclosure_evidence_missing",
    "support_process_evidence_missing",
  ]);
});

test("store publishing readiness requires support-process evidence to reference the runbook source", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "Support inbox and response owner confirmed 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.supportProcessReady, true);
  assert.equal(payload.supportProcessEvidenceReady, false);
  assert.deepEqual(payload.blockers, ["support_process_evidence_missing"]);
});

test("store publishing readiness rejects stale release review evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-01-01",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.reviewEvidenceReady, true);
  assert.equal(payload.reviewFresh, false);
  assert.deepEqual(payload.blockers, ["store_review_evidence_stale"]);
});

test("store publishing readiness rejects future release review dates", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2099-01-01",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.reviewEvidenceReady, false);
  assert.equal(payload.reviewFresh, false);
  assert.deepEqual(payload.blockers, ["store_review_metadata_missing"]);
});

test("store publishing readiness rejects future-dated release review references", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2099-01-01",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2099-01-01",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2099-01-01",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2099-01-01",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.blockers, [
    "apple_privacy_review_evidence_missing",
    "google_data_safety_review_evidence_missing",
    "provider_limitations_disclosure_evidence_missing",
    "support_process_evidence_missing",
  ]);
});

test("store publishing readiness rejects stale release review references", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-01-01",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-01-01",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-01-01",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-01-01",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.blockers, [
    "apple_privacy_review_evidence_missing",
    "google_data_safety_review_evidence_missing",
    "provider_limitations_disclosure_evidence_missing",
    "support_process_evidence_missing",
  ]);
});

test("store publishing readiness rejects missing markdown review sources", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "missing-store-data-safety.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.blockers, ["apple_privacy_review_evidence_missing"]);
});

test("store publishing readiness rejects markdown review sources with sensitive values", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const source = path.join(tmp, "store-data-safety-review.md");
  fs.writeFileSync(
    source,
    [
      "# Store Data Safety Review",
      "Apple App Privacy review for Fuel Path.",
      "Google Data Safety answers checked.",
      "API_TOKEN: should-not-be-in-review-evidence",
    ].join("\n"),
  );
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "store-data-safety-review.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.blockers, ["apple_privacy_review_evidence_missing"]);
});

test("store publishing readiness requires the privacy contact in the policy source", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: "web-demo/privacy.html",
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.privacyContactConfirmed, true);
  assert.equal(payload.privacyPolicyContactPublished, false);
  assert.deepEqual(payload.blockers, ["privacy_policy_contact_missing"]);
});

test("store publishing readiness rejects placeholder store listing identifiers", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id1234567890",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.example.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.appStoreListingReady, false);
  assert.equal(payload.googlePlayListingReady, false);
  assert.deepEqual(payload.blockers, ["store_listing_links_missing"]);
});

test("store publishing readiness rejects lookalike store listing hostnames", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://fakeapps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://fakeplay.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.appStoreListingReady, false);
  assert.equal(payload.googlePlayListingReady, false);
  assert.deepEqual(payload.blockers, ["store_listing_links_missing"]);
});

test("store publishing readiness requires Google Play package to match native config", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=app.fuelpath.mobile",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.expectedAndroidPackage, "com.fuelpath.app");
  assert.equal(payload.appStoreListingReady, true);
  assert.equal(payload.googlePlayListingReady, false);
  assert.deepEqual(payload.blockers, ["store_listing_links_missing"]);
});

test("store publishing readiness requires App Store slug to match native config", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/other-fuel-app/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence, "--allow-blocked"],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.expectedAppStoreSlug, "fuel-path");
  assert.equal(payload.appStoreListingReady, false);
  assert.equal(payload.googlePlayListingReady, true);
  assert.deepEqual(payload.blockers, ["store_listing_links_missing"]);
});

test("store publishing readiness passes with concrete contact, listing links and reviewed disclosures", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-store-readiness-"));
  const evidence = writeJson(path.join(tmp, "store-evidence.json"), {
    privacyContact: "privacy@fuelpath.app",
    privacyPolicyUrl: "https://fuel-path.vercel.app/web-demo/privacy",
    privacyPolicySource: READY_PRIVACY_POLICY_SOURCE,
    appStoreUrl: "https://apps.apple.com/au/app/fuel-path/id6740012345",
    googlePlayUrl: "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    applePrivacyReviewed: true,
    applePrivacyReviewReference: "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    googleDataSafetyReviewed: true,
    googleDataSafetyReviewReference: "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    providerLimitationsDisclosed: true,
    providerLimitationsDisclosureReference: "App listing provider limitations copy reviewed 2026-06-20",
    supportProcessReady: true,
    supportProcessReference: "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    reviewedAt: "2026-06-20",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/check-store-publishing-readiness.mjs", "--evidence-json", evidence],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "ready");
  assert.deepEqual(payload.blockers, []);
  assert.equal(payload.privacyContactConfirmed, true);
  assert.equal(payload.privacyPolicyReady, true);
  assert.equal(payload.privacyPolicyContactPublished, true);
  assert.equal(payload.expectedAndroidPackage, "com.fuelpath.app");
  assert.equal(payload.storeListingLinksConfirmed, true);
});

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return filePath;
}
