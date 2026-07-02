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
const READY_SUPPORT_RUNBOOK_SOURCE = path.join(ROOT, "tests", "fixtures", "support-runbook-ready.md");

test("beta readiness keeps emulator map smoke separate from physical-device readiness", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "blocked",
    publicLivePriceClaimsAllowed: false,
    blockers: ["nsw_terms_not_confirmed"],
    accessBlockers: ["vic_access_not_ready"],
    publicLiveRegions: ["WA", "SA"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "partial",
    artifactName: "fuel-path-preview-android.apk",
    avdName: "Fuel_Path_Arm64_API_35",
    mapWarningLines: [],
    mapTileSummaries: [
      { screenshot: "plan.png", blankMapLikely: false },
      { screenshot: "nearby.png", blankMapLikely: false },
    ],
    frameSummary: {
      jankyPercent: 68.6,
      percentile95Ms: 121,
    },
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.androidMapTilesReady, true);
  assert.equal(payload.native.physicalDeviceEvidence, false);
  assert.equal(payload.native.performanceClaimAllowed, false);
  assert.equal(payload.native.nativeBlockerPacketPresent, false);
  assert.deepEqual(payload.blockers, [
    "provider_terms_not_confirmed",
    "physical_device_validation_missing",
    "native_performance_not_claimable",
    "native_blocker_packet_missing",
    "privacy_contact_missing",
    "store_listing_links_missing",
    "apple_privacy_review_missing",
    "google_data_safety_review_missing",
    "provider_limitations_disclosure_missing",
    "support_process_missing",
  ]);
  assert.match(payload.nextAction, /confirm NSW\/ACT, QLD and TAS usage/i);
  assert.match(payload.nextAction, /physical-device native pass/i);
  assert.match(payload.nextAction, /native blocker packet/i);
  assert.match(payload.nextAction, /privacy contact method and store listing policy links/i);
  assert.match(payload.nextAction, /Apple privacy, Google Data Safety, provider limitation and support-process review evidence/i);
});

test("beta readiness passes when all Phase 0 gates are proven", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: [
      { screenshot: "android-preview-smoke-test-plan.png", blankMapLikely: false },
      { screenshot: "android-preview-smoke-test-nearby.png", blankMapLikely: false },
      { screenshot: "android-preview-smoke-test-nearby-after-pan.png", blankMapLikely: false },
    ],
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writeJson(path.join(tmp, "native-performance-summary.json"), {
    status: "passed",
    sourceReport: nativeSmoke,
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    mapTileSummaries: physicalMapTileSummaries(),
    blockers: [],
  });
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "ready");
  assert.deepEqual(payload.blockers, []);
  assert.equal(payload.native.physicalDeviceEvidence, true);
  assert.equal(payload.native.iosNativeValidationReady, true);
  assert.equal(payload.native.nativeBlockerPacketStatus, "ready");
  assert.equal(payload.store.privacyContactConfirmed, true);
  assert.equal(payload.store.storeListingLinksConfirmed, true);
});

test("beta readiness requires iOS validation evidence beyond setup tooling", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
    skipIosValidationReport: true,
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.nativeBlockerPacketStatus, "ready");
  assert.equal(payload.native.iosValidationStatus, "missing");
  assert.deepEqual(payload.native.iosValidationBlockers, ["ios_validation_report_missing"]);
  assert.equal(payload.native.iosNativeValidationReady, false);
  assert.deepEqual(payload.blockers, ["ios_native_validation_missing"]);
});

test("beta readiness surfaces iOS blockers from the native blocker packet", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: [
      { screenshot: "android-preview-smoke-test-plan.png", blankMapLikely: false },
      { screenshot: "android-preview-smoke-test-nearby.png", blankMapLikely: false },
      { screenshot: "android-preview-smoke-test-nearby-after-pan.png", blankMapLikely: false },
    ],
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "blocked",
    blockers: ["ios:full_xcode_missing", "ios:simctl_missing"],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.nativeBlockerPacketStatus, "blocked");
  assert.deepEqual(payload.native.nativeBlockerPacketBlockers, ["ios:full_xcode_missing", "ios:simctl_missing"]);
  assert.equal(payload.native.iosNativeValidationReady, false);
  assert.deepEqual(payload.blockers, ["ios_native_validation_missing"]);
});

test("beta readiness treats unauthorised physical Android packet evidence as not ready", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "blocked",
    android: {
      status: "blocked",
      devices: [{ ...physicalAndroidDevice(), connectionState: "unauthorized" }],
      physicalDevices: [],
      unauthorisedPhysicalDevices: [{ ...physicalAndroidDevice(), connectionState: "unauthorized" }],
      blockers: ["physical_android_unauthorized"],
    },
    blockers: ["android:physical_android_unauthorized"],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.native.nativeBlockerPacketBlockers, ["android:physical_android_unauthorized"]);
  assert.equal(payload.native.androidPhysicalDeviceReady, false);
  assert.deepEqual(payload.blockers, ["physical_device_validation_missing"]);
});

test("beta readiness rejects stale native blocker packets", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    generatedAt: new Date(Date.now() - 49 * 36e5).toISOString(),
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.nativeBlockerPacketStatus, "ready");
  assert.equal(payload.native.nativeBlockerPacketFresh, false);
  assert.equal(payload.native.iosNativeValidationReady, true);
  assert.deepEqual(payload.blockers, ["native_blocker_packet_stale"]);
});

test("beta readiness ignores excessive native blocker packet freshness windows", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    generatedAt: new Date(Date.now() - 49 * 36e5).toISOString(),
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--native-blocker-max-age-hours",
      "9999",
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.nativeBlockerPacketFresh, false);
  assert.deepEqual(payload.blockers, ["native_blocker_packet_stale"]);
});

test("beta readiness rejects synthetic native blocker packets", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    synthetic: true,
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.nativeBlockerPacketSynthetic, true);
  assert.equal(payload.native.nativeBlockerPacketStatus, "ready");
  assert.deepEqual(payload.blockers, ["native_blocker_packet_synthetic"]);
});

test("beta readiness validates concrete privacy contact and store listing links", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: [{ screenshot: "plan.png", blankMapLikely: false }],
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writeJson(path.join(tmp, "native-performance-summary.json"), {
    status: "passed",
    sourceReport: nativeSmoke,
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    mapTileSummaries: physicalMapTileSummaries(),
    blockers: [],
  });
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const blocked = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--privacy-contact",
      "privacy@example.com",
      "--app-store-url",
      "https://example.com/fuel-path",
      "--google-play-url",
      "https://play.google.com/store/apps/details?id=com.fuelpath.app",
      "--apple-privacy-reviewed",
      "--apple-privacy-review-reference",
      "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
      "--google-data-safety-reviewed",
      "--google-data-safety-review-reference",
      "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
      "--provider-limitations-disclosed",
      "--provider-limitations-disclosure-reference",
      "App listing provider limitations copy reviewed 2026-06-20",
      "--support-process-ready",
      "--support-process-reference",
      "SUPPORT-RUNBOOK.md support process review 2026-06-20",
      "--reviewed-at",
      "2026-06-20",
      "--reviewer",
      "Leo Kesselring",
      "--support-contact",
      "privacy@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--support-reviewed-at",
      "2026-06-20",
      "--support-runbook",
      READY_SUPPORT_RUNBOOK_SOURCE,
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const blockedPayload = JSON.parse(blocked.stdout);

  assert.equal(blockedPayload.store.privacyContactConfirmed, false);
  assert.equal(blockedPayload.store.appStoreListingReady, false);
  assert.equal(blockedPayload.store.googlePlayListingReady, true);
  assert.deepEqual(blockedPayload.blockers, [
    "privacy_contact_missing",
    "store_listing_links_missing",
  ]);

  const ready = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--privacy-contact",
      "privacy@fuelpath.app",
      "--privacy-policy-source",
      READY_PRIVACY_POLICY_SOURCE,
      "--app-store-url",
      "https://apps.apple.com/au/app/fuel-path/id6740012345",
      "--google-play-url",
      "https://play.google.com/store/apps/details?id=com.fuelpath.app",
      "--apple-privacy-reviewed",
      "--apple-privacy-review-reference",
      "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
      "--google-data-safety-reviewed",
      "--google-data-safety-review-reference",
      "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
      "--provider-limitations-disclosed",
      "--provider-limitations-disclosure-reference",
      "App listing provider limitations copy reviewed 2026-06-20",
      "--support-process-ready",
      "--support-process-reference",
      "SUPPORT-RUNBOOK.md support process review 2026-06-20",
      "--reviewed-at",
      "2026-06-20",
      "--reviewer",
      "Leo Kesselring",
      "--support-contact",
      "privacy@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--support-reviewed-at",
      "2026-06-20",
      "--support-runbook",
      READY_SUPPORT_RUNBOOK_SOURCE,
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const readyPayload = JSON.parse(ready.stdout);

  assert.equal(readyPayload.status, "ready");
  assert.equal(readyPayload.store.privacyContactConfirmed, true);
  assert.equal(readyPayload.store.appStoreListingReady, true);
  assert.equal(readyPayload.store.googlePlayListingReady, true);
});

test("beta readiness can load privacy contact and store links from an evidence file", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: { type: "physical", serial: "R5CT123456D" },
    mapWarningLines: [],
    mapTileSummaries: [{ screenshot: "plan.png", blankMapLikely: false }],
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });
  const storeEvidence = writeJson(path.join(tmp, "store-evidence.json"), {
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
    reviewedAt: "2026-06-19",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--store-evidence-json",
      storeEvidence,
      "--support-contact",
      "privacy@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--support-reviewed-at",
      "2026-06-20",
      "--support-runbook",
      READY_SUPPORT_RUNBOOK_SOURCE,
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "ready");
  assert.equal(payload.store.privacyContactConfirmed, true);
  assert.equal(payload.store.storeListingLinksConfirmed, true);
  assert.equal(payload.store.appStoreListingReady, true);
  assert.equal(payload.store.googlePlayListingReady, true);
});

test("beta readiness requires support readiness when support process is claimed ready", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--privacy-contact",
      "privacy@fuelpath.app",
      "--privacy-policy-url",
      "https://fuel-path.vercel.app/web-demo/privacy",
      "--privacy-policy-source",
      READY_PRIVACY_POLICY_SOURCE,
      "--app-store-url",
      "https://apps.apple.com/au/app/fuel-path/id6740012345",
      "--google-play-url",
      "https://play.google.com/store/apps/details?id=com.fuelpath.app",
      "--apple-privacy-reviewed",
      "--apple-privacy-review-reference",
      "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
      "--google-data-safety-reviewed",
      "--google-data-safety-review-reference",
      "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
      "--provider-limitations-disclosed",
      "--provider-limitations-disclosure-reference",
      "App listing provider limitations copy reviewed 2026-06-20",
      "--support-process-ready",
      "--support-process-reference",
      "SUPPORT-RUNBOOK.md support process review 2026-06-20",
      "--reviewed-at",
      "2026-06-20",
      "--reviewer",
      "Leo Kesselring",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.blockers, ["support_readiness_not_ready"]);
  assert.deepEqual(payload.support.blockers, [
    "support_contact_missing",
    "support_owner_missing",
    "support_review_date_missing",
  ]);
  assert.equal(payload.supportContactComparisonReady, false);
  assert.equal(payload.supportContactMatchesPrivacyContact, false);
});

test("beta readiness propagates stale support review evidence blockers", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--privacy-contact",
      "privacy@fuelpath.app",
      "--privacy-policy-url",
      "https://fuel-path.vercel.app/web-demo/privacy",
      "--privacy-policy-source",
      READY_PRIVACY_POLICY_SOURCE,
      "--app-store-url",
      "https://apps.apple.com/au/app/fuel-path/id6740012345",
      "--google-play-url",
      "https://play.google.com/store/apps/details?id=com.fuelpath.app",
      "--apple-privacy-reviewed",
      "--apple-privacy-review-reference",
      "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
      "--google-data-safety-reviewed",
      "--google-data-safety-review-reference",
      "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
      "--provider-limitations-disclosed",
      "--provider-limitations-disclosure-reference",
      "App listing provider limitations copy reviewed 2026-06-20",
      "--support-process-ready",
      "--support-process-reference",
      "SUPPORT-RUNBOOK.md support process review 2026-06-20",
      "--reviewed-at",
      "2026-06-20",
      "--reviewer",
      "Leo Kesselring",
      "--support-contact",
      "support@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--support-reviewed-at",
      "2026-01-01",
      "--support-runbook",
      READY_SUPPORT_RUNBOOK_SOURCE,
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.blockers, ["support_readiness_not_ready"]);
  assert.deepEqual(payload.support.blockers, ["support_review_date_stale"]);
  assert.equal(payload.support.reviewFresh, false);
});

test("beta readiness passes custom support review freshness into support gate", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--support-reviewed-at",
      "2026-06-19",
      "--support-review-max-age-days",
      "0.5",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.support.reviewMaxAgeDays, 0.5);
  assert.equal(payload.support.reviewDateReady, false);
  assert.equal(payload.support.reviewFresh, false);
  assert.deepEqual(payload.blockers, ["support_readiness_not_ready"]);
  assert.deepEqual(payload.support.blockers, ["support_review_date_stale"]);
});

test("beta readiness ignores excessive support review freshness windows", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--support-reviewed-at",
      "2026-01-01",
      "--support-review-max-age-days",
      "9999",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.support.reviewMaxAgeDays, 30);
  assert.equal(payload.support.reviewFresh, false);
  assert.deepEqual(payload.blockers, ["support_readiness_not_ready"]);
  assert.deepEqual(payload.support.blockers, ["support_review_date_stale"]);
});

test("beta readiness requires support contact to match privacy contact", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--privacy-contact",
      "privacy@fuelpath.app",
      "--privacy-policy-url",
      "https://fuel-path.vercel.app/web-demo/privacy",
      "--privacy-policy-source",
      READY_PRIVACY_POLICY_SOURCE,
      "--app-store-url",
      "https://apps.apple.com/au/app/fuel-path/id6740012345",
      "--google-play-url",
      "https://play.google.com/store/apps/details?id=com.fuelpath.app",
      "--apple-privacy-reviewed",
      "--apple-privacy-review-reference",
      "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
      "--google-data-safety-reviewed",
      "--google-data-safety-review-reference",
      "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
      "--provider-limitations-disclosed",
      "--provider-limitations-disclosure-reference",
      "App listing provider limitations copy reviewed 2026-06-20",
      "--support-process-ready",
      "--support-process-reference",
      "SUPPORT-RUNBOOK.md support process review 2026-06-20",
      "--reviewed-at",
      "2026-06-20",
      "--reviewer",
      "Leo Kesselring",
      "--support-contact",
      "support@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--support-reviewed-at",
      "2026-06-20",
      "--support-runbook",
      READY_SUPPORT_RUNBOOK_SOURCE,
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.deepEqual(payload.blockers, ["support_contact_mismatch"]);
  assert.equal(payload.support.ok, true);
  assert.equal(payload.supportContactComparisonReady, true);
  assert.equal(payload.supportContactMatchesPrivacyContact, false);
});

test("beta readiness treats equivalent Fuel Path contact URLs as matching", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });
  const policySource = path.join(tmp, "privacy.html");
  const supportRunbook = path.join(tmp, "support-runbook.md");
  fs.writeFileSync(policySource, "Contact privacy at https://fuel-path.vercel.app/web-demo/privacy#contact\n");
  fs.copyFileSync(READY_SUPPORT_RUNBOOK_SOURCE, supportRunbook);
  fs.appendFileSync(
    supportRunbook,
    "\nSupport URL: https://fuel-path.vercel.app/web-demo/privacy/?source=store#contact\n",
  );

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--privacy-contact",
      "https://fuel-path.vercel.app/web-demo/privacy#contact",
      "--privacy-policy-url",
      "https://fuel-path.vercel.app/web-demo/privacy",
      "--privacy-policy-source",
      policySource,
      "--app-store-url",
      "https://apps.apple.com/au/app/fuel-path/id6740012345",
      "--google-play-url",
      "https://play.google.com/store/apps/details?id=com.fuelpath.app",
      "--apple-privacy-reviewed",
      "--apple-privacy-review-reference",
      "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
      "--google-data-safety-reviewed",
      "--google-data-safety-review-reference",
      "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
      "--provider-limitations-disclosed",
      "--provider-limitations-disclosure-reference",
      "App listing provider limitations copy reviewed 2026-06-20",
      "--support-process-ready",
      "--support-process-reference",
      "SUPPORT-RUNBOOK.md support process review 2026-06-20",
      "--reviewed-at",
      "2026-06-20",
      "--reviewer",
      "Leo Kesselring",
      "--support-contact",
      "https://fuel-path.vercel.app/web-demo/privacy/?source=store#contact",
      "--support-owner",
      "Leo Kesselring",
      "--support-reviewed-at",
      "2026-06-20",
      "--support-runbook",
      supportRunbook,
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "ready");
  assert.equal(payload.support.ok, true);
  assert.equal(payload.supportContactComparisonReady, true);
  assert.equal(payload.supportContactMatchesPrivacyContact, true);
});

test("beta readiness still rejects different Fuel Path contact URL paths", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });
  const policySource = path.join(tmp, "privacy.html");
  const supportRunbook = path.join(tmp, "support-runbook.md");
  fs.writeFileSync(policySource, "Contact privacy at https://fuel-path.vercel.app/web-demo/privacy#contact\n");
  fs.copyFileSync(READY_SUPPORT_RUNBOOK_SOURCE, supportRunbook);
  fs.appendFileSync(supportRunbook, "\nSupport URL: https://fuel-path.vercel.app/web-demo/support#contact\n");

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--privacy-contact",
      "https://fuel-path.vercel.app/web-demo/privacy#contact",
      "--privacy-policy-url",
      "https://fuel-path.vercel.app/web-demo/privacy",
      "--privacy-policy-source",
      policySource,
      "--app-store-url",
      "https://apps.apple.com/au/app/fuel-path/id6740012345",
      "--google-play-url",
      "https://play.google.com/store/apps/details?id=com.fuelpath.app",
      "--apple-privacy-reviewed",
      "--apple-privacy-review-reference",
      "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
      "--google-data-safety-reviewed",
      "--google-data-safety-review-reference",
      "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
      "--provider-limitations-disclosed",
      "--provider-limitations-disclosure-reference",
      "App listing provider limitations copy reviewed 2026-06-20",
      "--support-process-ready",
      "--support-process-reference",
      "SUPPORT-RUNBOOK.md support process review 2026-06-20",
      "--reviewed-at",
      "2026-06-20",
      "--reviewer",
      "Leo Kesselring",
      "--support-contact",
      "https://fuel-path.vercel.app/web-demo/support#contact",
      "--support-owner",
      "Leo Kesselring",
      "--support-reviewed-at",
      "2026-06-20",
      "--support-runbook",
      supportRunbook,
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.support.ok, true);
  assert.equal(payload.supportContactComparisonReady, true);
  assert.equal(payload.supportContactMatchesPrivacyContact, false);
  assert.deepEqual(payload.blockers, ["support_contact_mismatch"]);
});

test("beta readiness propagates stale store review evidence blockers", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });
  const storeEvidence = writeJson(path.join(tmp, "store-evidence.json"), {
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
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--store-evidence-json",
      storeEvidence,
      "--support-contact",
      "privacy@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--support-reviewed-at",
      "2026-06-20",
      "--support-runbook",
      READY_SUPPORT_RUNBOOK_SOURCE,
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.store.reviewEvidenceReady, true);
  assert.equal(payload.store.reviewFresh, false);
  assert.deepEqual(payload.blockers, ["store_review_evidence_stale"]);
});

test("beta readiness passes custom store review freshness into store evidence gate", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });
  const storeEvidence = writeJson(path.join(tmp, "store-evidence.json"), {
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
    reviewedAt: "2026-06-19",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--store-evidence-json",
      storeEvidence,
      "--store-review-max-age-days",
      "0.5",
      "--support-contact",
      "privacy@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--support-reviewed-at",
      "2026-06-20",
      "--support-runbook",
      READY_SUPPORT_RUNBOOK_SOURCE,
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.store.reviewMaxAgeDays, 0.5);
  assert.equal(payload.store.reviewEvidenceReady, true);
  assert.equal(payload.store.reviewFresh, false);
  assert.deepEqual(payload.blockers, [
    "apple_privacy_review_evidence_missing",
    "google_data_safety_review_evidence_missing",
    "provider_limitations_disclosure_evidence_missing",
    "support_process_evidence_missing",
    "store_review_evidence_stale",
  ]);
});

test("beta readiness ignores excessive store review freshness windows", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });
  const storeEvidence = writeJson(path.join(tmp, "store-evidence.json"), {
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
    reviewedAt: "2026-01-01",
    reviewer: "Leo Kesselring",
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--store-evidence-json",
      storeEvidence,
      "--store-review-max-age-days",
      "9999",
      "--support-contact",
      "privacy@fuelpath.app",
      "--support-owner",
      "Leo Kesselring",
      "--support-reviewed-at",
      "2026-06-20",
      "--support-runbook",
      READY_SUPPORT_RUNBOOK_SOURCE,
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.store.reviewMaxAgeDays, 30);
  assert.equal(payload.store.reviewFresh, false);
  assert.deepEqual(payload.blockers, [
    "apple_privacy_review_evidence_missing",
    "google_data_safety_review_evidence_missing",
    "provider_limitations_disclosure_evidence_missing",
    "support_process_evidence_missing",
    "store_review_evidence_stale",
  ]);
});

test("store publishing evidence template keeps placeholder values blocked", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: { type: "physical", serial: "R5CT123456D" },
    mapWarningLines: [],
    mapTileSummaries: [{ screenshot: "plan.png", blankMapLikely: false }],
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--store-evidence-json",
      "STORE-PUBLISHING-EVIDENCE.template.json",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.store.privacyContactConfirmed, false);
  assert.equal(payload.store.storeListingLinksConfirmed, false);
  assert.deepEqual(payload.blockers, [
    "privacy_contact_missing",
    "store_listing_links_missing",
    "apple_privacy_review_missing",
    "google_data_safety_review_missing",
    "provider_limitations_disclosure_missing",
    "support_process_missing",
  ]);
});

test("beta readiness keeps manual store confirmation flags as audit-only", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: { type: "physical", serial: "R5CT123456D" },
    mapWarningLines: [],
    mapTileSummaries: [{ screenshot: "plan.png", blankMapLikely: false }],
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writePassedNativePerformanceSummary(tmp, nativeSmoke);
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      "--privacy-contact-confirmed",
      "--store-listing-links-confirmed",
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.store.manualPrivacyContactConfirmed, true);
  assert.equal(payload.store.manualStoreListingLinksConfirmed, true);
  assert.equal(payload.store.privacyContactConfirmed, false);
  assert.equal(payload.store.storeListingLinksConfirmed, false);
  assert.deepEqual(payload.blockers, [
    "privacy_contact_missing",
    "store_listing_links_missing",
    "apple_privacy_review_missing",
    "google_data_safety_review_missing",
    "provider_limitations_disclosure_missing",
    "support_process_missing",
  ]);
});

test("beta readiness rejects legacy physical flags without device metadata", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    artifactName: "fuel-path-preview-android.apk",
    physicalDeviceEvidence: true,
    mapWarningLines: [],
    mapTileSummaries: [{ screenshot: "plan.png", blankMapLikely: false }],
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.physicalDeviceEvidence, false);
  assert.equal(payload.native.performanceClaimAllowed, false);
  assert.deepEqual(payload.blockers, [
    "physical_device_validation_missing",
    "native_performance_not_claimable",
  ]);
});

test("beta readiness rejects physical smoke with remaining attention items", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "partial",
    renderStatus: "passed",
    performanceStatus: "needs_device_validation",
    artifactName: "fuel-path-preview-android.apk",
    device: { type: "physical", serial: "R5CT123456D" },
    mapWarningLines: [],
    mapTileSummaries: [{ screenshot: "plan.png", blankMapLikely: false }],
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: ["Frame timings need another pass."],
  });
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.physicalDeviceEvidence, true);
  assert.equal(payload.native.performanceClaimAllowed, false);
  assert.deepEqual(payload.blockers, ["native_performance_not_claimable"]);
});

test("beta readiness rejects passed performance summaries with incomplete physical map evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writeJson(path.join(tmp, "native-performance-summary.json"), {
    status: "passed",
    sourceReport: nativeSmoke,
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    mapTileSummaries: [{ screenshot: "android-preview-smoke-test-plan.png", blankMapLikely: false }],
    blockers: [],
  });
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.performanceSummaryStatus, "passed");
  assert.equal(payload.native.performanceSummaryMapEvidenceReady, false);
  assert.equal(payload.native.performanceClaimAllowed, false);
  assert.deepEqual(payload.blockers, ["native_performance_not_claimable"]);
});

test("beta readiness rejects performance summaries from a different smoke report", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const otherNativeSmoke = writeJson(path.join(tmp, "other-native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writeJson(path.join(tmp, "native-performance-summary.json"), {
    status: "passed",
    sourceReport: otherNativeSmoke,
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    mapTileSummaries: physicalMapTileSummaries(),
    blockers: [],
  });
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.performanceSummaryStatus, "passed");
  assert.equal(payload.native.performanceSummaryMapEvidenceReady, true);
  assert.equal(payload.native.performanceSummarySourceMatches, false);
  assert.equal(payload.native.performanceClaimAllowed, false);
  assert.deepEqual(payload.blockers, ["native_performance_not_claimable"]);
});

test("beta readiness rejects performance summaries with missing map screenshot files", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    mapWarningLines: [],
    mapTileSummaries: physicalMapTileSummaries(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writeJson(path.join(tmp, "native-performance-summary.json"), {
    status: "passed",
    sourceReport: nativeSmoke,
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    mapTileSummaries: [
      { screenshot: "missing-android-preview-smoke-test-plan.png", blankMapLikely: false },
      { screenshot: "missing-android-preview-smoke-test-nearby.png", blankMapLikely: false },
      { screenshot: "missing-android-preview-smoke-test-nearby-after-pan.png", blankMapLikely: false },
    ],
    blockers: [],
  });
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.performanceSummaryStatus, "passed");
  assert.equal(payload.native.performanceSummaryMapEvidenceReady, false);
  assert.equal(payload.native.performanceSummarySourceMatches, true);
  assert.equal(payload.native.performanceClaimAllowed, false);
  assert.deepEqual(payload.blockers, ["native_performance_not_claimable"]);
});

test("beta readiness honours blocking native performance summary", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-beta-readiness-"));
  const providerTerms = writeJson(path.join(tmp, "provider-terms.json"), {
    status: "ready",
    publicLivePriceClaimsAllowed: true,
    blockers: [],
    accessBlockers: [],
    publicLiveRegions: ["NSW", "ACT", "QLD", "WA", "SA", "TAS"],
  });
  const nativeSmoke = writeJson(path.join(tmp, "native-smoke.json"), {
    status: "passed",
    renderStatus: "passed",
    performanceStatus: "passed",
    artifactName: "fuel-path-preview-android.apk",
    device: { type: "physical", serial: "R5CT123456D" },
    mapWarningLines: [],
    mapTileSummaries: [{ screenshot: "plan.png", blankMapLikely: false }],
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    attentionItems: [],
  });
  const nativePerformanceSummary = writeJson(path.join(tmp, "native-performance-summary.json"), {
    status: "blocked",
    sourceReport: nativeSmoke,
    artifactName: "fuel-path-preview-android.apk",
    device: { type: "physical", serial: "R5CT123456D" },
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    mapTileSummaries: [{ screenshot: "plan.png", blankMapLikely: false }],
    blockers: ["Smoke report still has attention items: 1."],
  });
  const nativeBlockerPacket = writeNativeBlockerPacket(tmp, {
    status: "ready",
    blockers: [],
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-beta-readiness.mjs",
      "--provider-terms-json",
      providerTerms,
      "--native-smoke",
      nativeSmoke,
      "--native-performance-summary",
      nativePerformanceSummary,
      "--native-blocker-packet",
      nativeBlockerPacket,
      ...storeReadyArgs(),
      "--allow-blocked",
    ],
    { cwd: ROOT, timeout: 10_000 },
  );
  const payload = JSON.parse(stdout);

  assert.equal(payload.status, "blocked");
  assert.equal(payload.native.physicalDeviceEvidence, true);
  assert.equal(payload.native.performanceSummaryStatus, "blocked");
  assert.deepEqual(payload.native.performanceSummaryBlockers, ["Smoke report still has attention items: 1."]);
  assert.equal(payload.native.performanceClaimAllowed, false);
  assert.deepEqual(payload.blockers, ["native_performance_not_claimable"]);
});

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return filePath;
}

function writePassedNativePerformanceSummary(tmp, nativeSmoke) {
  return writeJson(path.join(tmp, "native-performance-summary.json"), {
    status: "passed",
    sourceReport: nativeSmoke,
    artifactName: "fuel-path-preview-android.apk",
    device: physicalAndroidDevice(),
    frameSummary: {
      jankyPercent: 3.2,
      percentile95Ms: 24,
    },
    mapTileSummaries: physicalMapTileSummaries(),
    blockers: [],
  });
}

function writeNativeBlockerPacket(tmp, overrides) {
  const blockers = overrides.blockers || [];
  if (!overrides.skipIosValidationReport) {
    writePassedIosValidationReport(tmp);
  }
  return writeJson(path.join(tmp, "native-blocker-packet.json"), {
    status: blockers.length ? "blocked" : "ready",
    generatedAt: new Date().toISOString(),
    android: {
      status: blockers.some((item) => item.startsWith("android:")) ? "blocked" : "ready",
      devices: [physicalAndroidDevice()],
      physicalDevices: [physicalAndroidDevice()],
      blockers: blockers
        .filter((item) => item.startsWith("android:"))
        .map((item) => item.replace("android:", "")),
    },
    ios: {
      status: blockers.some((item) => item.startsWith("ios:")) ? "blocked" : "ready",
      developerPath: "/Applications/Xcode.app/Contents/Developer",
      simctlAvailable: !blockers.includes("ios:simctl_missing"),
      iosRuntimes: blockers.includes("ios:ios_runtime_missing") ? [] : ["iOS 18.5 (available)"],
      simulators: blockers.includes("ios:ios_simulator_missing") ? [] : ["iPhone 16 (ABCD) (Shutdown)"],
      blockers: blockers
        .filter((item) => item.startsWith("ios:"))
        .map((item) => item.replace("ios:", "")),
    },
    ...overrides,
    blockers,
  });
}

function writePassedIosValidationReport(tmp) {
  const screenshots = {
    plan: path.join(tmp, "ios-plan.png"),
    nearby: path.join(tmp, "ios-nearby.png"),
    account: path.join(tmp, "ios-account.png"),
  };
  for (const screenshot of Object.values(screenshots)) {
    fs.writeFileSync(screenshot, "screenshot evidence");
  }
  return writeJson(path.join(tmp, "ios-validation-test.json"), {
    status: "passed",
    platform: "ios",
    simulator: {
      name: "iPhone 16",
      runtime: "iOS 18.5",
    },
    renderedScreens: [
      { name: "plan", screenshot: screenshots.plan },
      { name: "nearby", screenshot: screenshots.nearby },
      { name: "account", screenshot: screenshots.account },
    ],
    failureLines: [],
  });
}

function physicalAndroidDevice() {
  return {
    type: "physical",
    serial: "R5CT123456D",
    detail: "R5CT123456D device usb:336592896X product:a53x model:SM_A536B device:a53x transport_id:2",
  };
}

function physicalMapTileSummaries() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-android-map-evidence-"));
  const screenshots = {
    plan: path.join(tmp, "android-preview-smoke-test-plan.png"),
    nearby: path.join(tmp, "android-preview-smoke-test-nearby.png"),
    nearbyAfterPan: path.join(tmp, "android-preview-smoke-test-nearby-after-pan.png"),
  };
  for (const screenshot of Object.values(screenshots)) {
    fs.writeFileSync(screenshot, "screenshot evidence");
  }
  return [
    { screenshot: screenshots.plan, blankMapLikely: false },
    { screenshot: screenshots.nearby, blankMapLikely: false },
    { screenshot: screenshots.nearbyAfterPan, blankMapLikely: false },
  ];
}

function storeReadyArgs() {
  return [
    "--privacy-contact",
    "privacy@fuelpath.app",
    "--privacy-policy-url",
    "https://fuel-path.vercel.app/web-demo/privacy",
    "--privacy-policy-source",
    READY_PRIVACY_POLICY_SOURCE,
    "--app-store-url",
    "https://apps.apple.com/au/app/fuel-path/id6740012345",
    "--google-play-url",
    "https://play.google.com/store/apps/details?id=com.fuelpath.app",
    "--apple-privacy-reviewed",
    "--apple-privacy-review-reference",
    "STORE-DATA-SAFETY.md Apple App Privacy review 2026-06-20",
    "--google-data-safety-reviewed",
    "--google-data-safety-review-reference",
    "STORE-DATA-SAFETY.md Google Data Safety review 2026-06-20",
    "--provider-limitations-disclosed",
    "--provider-limitations-disclosure-reference",
    "App listing provider limitations copy reviewed 2026-06-20",
    "--support-process-ready",
    "--support-process-reference",
    "SUPPORT-RUNBOOK.md support process review 2026-06-20",
    "--reviewed-at",
    "2026-06-20",
    "--reviewer",
    "Leo Kesselring",
    "--support-contact",
    "privacy@fuelpath.app",
    "--support-owner",
    "Leo Kesselring",
    "--support-reviewed-at",
    "2026-06-20",
    "--support-runbook",
    READY_SUPPORT_RUNBOOK_SOURCE,
  ];
}
