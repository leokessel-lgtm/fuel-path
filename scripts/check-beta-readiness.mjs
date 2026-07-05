#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = resolve(".");
const providerTerms = readProviderTerms();
const nativeSmoke = readNativeSmoke();
const nativePerformanceSummary = readNativePerformanceSummary();
const nativeBlockerPacket = readNativeBlockerPacket();
const iosValidationReport = readIosValidationReport();
const store = readStoreStatus();
const support = readSupportStatus();
const evCharging = await readEvChargingStatus();

const native = buildNativeStatus(nativeSmoke, nativePerformanceSummary, nativeBlockerPacket, iosValidationReport);
const supportContactComparisonReady =
  Boolean(store.supportProcessReady) && Boolean(store.privacyContactConfirmed) && Boolean(support.supportContactReady);
const supportContactMatchesPrivacyContact = supportContactComparisonReady
  ? normaliseContact(store.privacyContact) === normaliseContact(support.supportContact)
  : false;
const directBlockers = [
  "privacy_contact_missing",
  "privacy_policy_url_missing",
  "store_listing_links_missing",
  "apple_privacy_review_missing",
  "google_data_safety_review_missing",
  "provider_limitations_disclosure_missing",
  "support_process_missing",
  "support_readiness_not_ready",
];
const blockers = [
  ...(!providerTerms.publicLivePriceClaimsAllowed ? ["provider_terms_not_confirmed"] : []),
  ...(evCharging.status === "blocked" ? ["ev_charging_budget_controls_not_ready"] : []),
  ...(!nativeSmoke ? ["android_preview_smoke_missing"] : []),
  ...(nativeSmoke && !native.androidMapTilesReady ? ["android_map_tiles_not_ready"] : []),
  ...(nativeSmoke && (!native.physicalDeviceEvidence || native.androidPhysicalDeviceReady === false)
    ? ["physical_device_validation_missing"]
    : []),
  ...(nativeSmoke && !native.performanceClaimAllowed ? ["native_performance_not_claimable"] : []),
  ...(!native.nativeBlockerPacketPresent ? ["native_blocker_packet_missing"] : []),
  ...(native.nativeBlockerPacketSynthetic ? ["native_blocker_packet_synthetic"] : []),
  ...(native.nativeBlockerPacketFresh === false ? ["native_blocker_packet_stale"] : []),
  ...(native.iosNativeValidationReady === false ? ["ios_native_validation_missing"] : []),
  ...(!store.privacyContactConfirmed ? ["privacy_contact_missing"] : []),
  ...(!store.privacyPolicyReady ? ["privacy_policy_url_missing"] : []),
  ...(!store.storeListingLinksConfirmed ? ["store_listing_links_missing"] : []),
  ...(!store.applePrivacyReviewReady ? ["apple_privacy_review_missing"] : []),
  ...(!store.googleDataSafetyReviewReady ? ["google_data_safety_review_missing"] : []),
  ...(!store.providerLimitationsDisclosureReady ? ["provider_limitations_disclosure_missing"] : []),
  ...(!store.supportProcessReady ? ["support_process_missing"] : []),
  ...(store.supportProcessReady && !support.ok ? ["support_readiness_not_ready"] : []),
  ...(support.ok && supportContactComparisonReady && !supportContactMatchesPrivacyContact
    ? ["support_contact_mismatch"]
    : []),
  ...(store.blockers || []).filter((item) => !directBlockers.includes(item)),
];

const payload = {
  ok: blockers.length === 0,
  status: blockers.length ? "blocked" : "ready",
  blockers,
  providerTerms: {
    status: providerTerms.status || "unknown",
    publicLivePriceClaimsAllowed: Boolean(providerTerms.publicLivePriceClaimsAllowed),
    blockers: providerTerms.blockers || [],
    evidenceBlockers: providerTerms.evidenceBlocked || [],
    accessBlockers: providerTerms.accessBlockers || [],
    publicLiveRegions: providerTerms.publicLiveRegions || [],
  },
  native,
  store,
  evCharging,
  support,
  supportContactComparisonReady,
  supportContactMatchesPrivacyContact,
  nextAction: blockers.length
    ? nextAction(blockers)
    : "Phase 0 beta readiness gates are clear for controlled real-user testing.",
};

console.log(JSON.stringify(payload, null, 2));
if (!payload.ok && !args.allowBlocked) process.exit(1);

function readProviderTerms() {
  const fixture = args.providerTermsJson;
  if (fixture) return JSON.parse(readFileSync(resolve(fixture), "utf8"));
  const commandArgs = ["scripts/check-provider-terms-readiness.mjs"];
  if (args.apiBase) commandArgs.push("--api-base", args.apiBase);
  if (args.providerTermsEvidenceJson) commandArgs.push("--evidence-json", args.providerTermsEvidenceJson);
  const stdout = execFileSync(process.execPath, commandArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

function readNativeSmoke() {
  const smokePath = args.nativeSmoke || latestNativeSmokePath();
  if (!smokePath || !existsSync(smokePath)) return null;
  return JSON.parse(readFileSync(resolve(smokePath), "utf8"));
}

function readNativePerformanceSummary() {
  const summaryPath = args.nativePerformanceSummary || latestNativePerformanceSummaryPath();
  if (!summaryPath || !existsSync(summaryPath)) return null;
  return JSON.parse(readFileSync(resolve(summaryPath), "utf8"));
}

function readNativeBlockerPacket() {
  const packetPath = nativeBlockerPacketPath();
  if (!packetPath || !existsSync(packetPath)) return null;
  return JSON.parse(readFileSync(resolve(packetPath), "utf8"));
}

function readIosValidationReport() {
  const reportPath = iosValidationReportPath();
  if (!reportPath || !existsSync(reportPath)) return null;
  return {
    ...JSON.parse(readFileSync(resolve(reportPath), "utf8")),
    __filePath: resolve(reportPath),
  };
}

function readStoreStatus() {
  const commandArgs = ["scripts/check-store-publishing-readiness.mjs", "--allow-blocked"];
  if (args.storeEvidenceJson) commandArgs.push("--evidence-json", args.storeEvidenceJson);
  const passthrough = [
    "privacy-contact",
    "privacy-policy-url",
    "privacy-policy-source",
    "app-store-url",
    "google-play-url",
    "privacy-contact-confirmed",
    "store-listing-links-confirmed",
    "apple-privacy-reviewed",
    "apple-privacy-review-reference",
    "google-data-safety-reviewed",
    "google-data-safety-review-reference",
    "provider-limitations-disclosed",
    "provider-limitations-disclosure-reference",
    "support-process-ready",
    "support-process-reference",
    "reviewed-at",
    "reviewer",
    "store-review-max-age-days",
  ];
  for (const key of passthrough) {
    if (args[key] === undefined) continue;
    commandArgs.push(`--${key}`);
    if (args[key] !== "1") commandArgs.push(args[key]);
  }
  const stdout = execFileSync(process.execPath, commandArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

function readSupportStatus() {
  const commandArgs = ["scripts/check-support-readiness.mjs", "--allow-blocked"];
  if (args.supportRunbook) commandArgs.push("--runbook", args.supportRunbook);
  if (args["support-contact"]) commandArgs.push("--support-contact", args["support-contact"]);
  if (args["support-owner"]) commandArgs.push("--support-owner", args["support-owner"]);
  if (args["reviewed-at"]) commandArgs.push("--reviewed-at", args["reviewed-at"]);
  if (args["support-reviewed-at"]) commandArgs.push("--reviewed-at", args["support-reviewed-at"]);
  if (args["support-review-max-age-days"]) {
    commandArgs.push("--support-review-max-age-days", args["support-review-max-age-days"]);
  }
  const stdout = execFileSync(process.execPath, commandArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

function readEvChargingStatus() {
  if (args.evChargingJson) {
    return JSON.parse(readFileSync(resolve(args.evChargingJson), "utf8"));
  }
  const apiBase = args.apiBase || process.env.FUEL_PATH_API_BASE || process.env.API_BASE_URL || "";
  if (!apiBase) {
    return {
      status: "not_checked",
      blockers: ["api_base_not_configured_for_ev_charging_readiness"],
      cap: {},
    };
  }
  return readEvChargingStatusFromApi(apiBase);
}

async function readEvChargingStatusFromApi(apiBase) {
  try {
    const response = await fetch(`${apiBase}/api/status`, {
      headers: {
        accept: "application/json",
      },
    });
    if (!response.ok) {
      return {
        status: "not_checked",
        blockers: [`ev_charging_status_http_${response.status}`],
        cap: {},
      };
    }
    const payload = await response.json();
    const release = payload?.releaseReadiness?.evCharging || {};
    const fallbackCostControls = payload?.evCharging?.googlePlacesEvCostControls || {};
    const releaseCap = release.cap || {};
    const fallbackCap = fallbackCostControls || {};
    const normalisedCap = {
      ...fallbackCap,
      ...releaseCap,
      googlePlacesDailyLookupCap:
        releaseCap.googlePlacesDailyLookupCap ?? releaseCap.hardLimit ?? fallbackCap.googlePlacesDailyLookupCap ?? 0,
      googlePlacesEvLookupsToday:
        releaseCap.googlePlacesEvLookupsToday ?? releaseCap.hardLimitUsed ?? fallbackCap.googlePlacesEvLookupsToday ?? 0,
      googlePlacesEvHardStopAt:
        releaseCap.googlePlacesEvHardStopAt ?? fallbackCap.googlePlacesEvHardStopAt ?? "",
      googlePlacesEvHysteresisEnabled:
        releaseCap.googlePlacesEvHysteresisEnabled ?? Boolean(fallbackCap.googlePlacesEvHysteresisEnabled) ?? false,
    };
    return {
      status: release.status || fallbackCostControls.status || "unknown",
      blockers: Array.isArray(release.blockers)
        ? release.blockers
        : Array.isArray(fallbackCostControls.blockers)
          ? fallbackCostControls.blockers
          : ["ev_charging_readiness_unknown"],
      cap: normalisedCap,
    };
  } catch {
    return {
      status: "not_checked",
      blockers: ["ev_charging_status_request_failed"],
      cap: {},
    };
  }
}

function latestNativeSmokePath() {
  const dir = resolve(root, "tmp", "native-smoke");
  if (!existsSync(dir)) return "";
  const files = readdirSync(dir)
    .filter((file) => /^android-preview-smoke-.*\.json$/.test(file))
    .sort();
  return files.length ? join(dir, files[files.length - 1]) : "";
}

function latestNativePerformanceSummaryPath() {
  const dir = resolve(root, "tmp", "native-smoke");
  if (!existsSync(dir)) return "";
  const files = readdirSync(dir)
    .filter((file) => /^android-performance-summary-.*\.json$/.test(file))
    .sort();
  return files.length ? join(dir, files[files.length - 1]) : "";
}

function iosValidationReportPath() {
  if (args.iosValidationReport) return args.iosValidationReport;
  const sidecar = latestSidecarIosValidationReportPath();
  if (sidecar) return sidecar;
  if (args.nativeSmoke || args.nativePerformanceSummary || args.nativeBlockerPacket) return "";
  return latestIosValidationReportPath(root);
}

function latestSidecarIosValidationReportPath() {
  const packetPath = nativeBlockerPacketPath();
  if (!packetPath) return "";
  return latestIosValidationReportPath(resolve(packetPath, ".."));
}

function latestIosValidationReportPath(dirRoot) {
  const dir = resolve(dirRoot, "tmp", "native-smoke");
  const candidateDir = existsSync(dir) ? dir : dirRoot;
  if (!existsSync(candidateDir)) return "";
  const files = readdirSync(candidateDir)
    .filter((file) => /^ios-validation-.*\.json$/.test(file))
    .sort();
  return files.length ? join(candidateDir, files[files.length - 1]) : "";
}

function nativeBlockerPacketPath() {
  if (args.nativeBlockerPacket) return args.nativeBlockerPacket;
  if (args.nativeSmoke || args.nativePerformanceSummary) return "";
  return latestNativeBlockerPacketPath();
}

function latestNativeBlockerPacketPath() {
  const dir = resolve(root, "tmp", "native-smoke");
  if (!existsSync(dir)) return "";
  const files = readdirSync(dir)
    .filter((file) => /^native-blocker-packet-.*\.json$/.test(file))
    .sort();
  for (const file of files.reverse()) {
    const candidate = join(dir, file);
    if (!syntheticNativeBlockerPacket(candidate)) return candidate;
  }
  return "";
}

function syntheticNativeBlockerPacket(filePath) {
  try {
    const packet = JSON.parse(readFileSync(filePath, "utf8"));
    const commandPaths = [
      packet.android?.adb,
      packet.ios?.developerPath,
      ...(packet.android?.devices || []).map((device) => device.detail),
    ]
      .filter(Boolean)
      .join("\n");
    return packet.synthetic === true || /fuel-path-native-blocker-|FUEL_PATH_.*_FOR_TESTS/i.test(commandPaths);
  } catch {
    return true;
  }
}

function buildNativeStatus(smoke, performanceSummary, blockerPacket, iosReport) {
  const packetPresent = Boolean(blockerPacket);
  const packetBlockers = blockerPacket?.blockers || [];
  const packetSynthetic = blockerPacket?.synthetic === true;
  const packetGeneratedAt = blockerPacket?.generatedAt || "";
  const packetAgeHours = packetGeneratedAt ? nativeBlockerPacketAgeHours(packetGeneratedAt) : null;
  const packetFresh = blockerPacket ? packetAgeHours !== null && packetAgeHours <= nativeBlockerPacketMaxAgeHours() : null;
  const iosValidation = iosValidationStatus(iosReport);
  const iosSetupReady = blockerPacket ? !packetBlockers.some((item) => item.startsWith("ios:")) : null;
  const iosNativeValidationReady = blockerPacket ? iosSetupReady && iosValidation.ready : null;
  const androidPhysicalDeviceReady = blockerPacket
    ? !packetBlockers.some((item) =>
      ["android:physical_android_missing", "android:physical_android_unauthorized", "android:physical_android_offline"].includes(item)
    )
    : null;
  const packetPath = blockerPacket ? nativeBlockerPacketPath() : "";
  if (!smoke) {
    return {
      androidPreviewSmoke: "missing",
      androidMapTilesReady: false,
      physicalDeviceEvidence: false,
      performanceClaimAllowed: false,
      nativeBlockerPacketFile: packetPath,
      nativeBlockerPacketPresent: packetPresent,
      nativeBlockerPacketStatus: blockerPacket?.status || "missing",
      nativeBlockerPacketGeneratedAt: packetGeneratedAt,
      nativeBlockerPacketAgeHours: packetAgeHours,
      nativeBlockerPacketFresh: packetFresh,
      nativeBlockerPacketSynthetic: packetSynthetic,
      nativeBlockerPacketBlockers: packetBlockers,
      iosValidationReportFile: iosReport ? iosValidationReportPath() : "",
      iosValidationStatus: iosValidation.status,
      iosValidationBlockers: iosValidation.blockers,
      iosNativeValidationReady,
      androidPhysicalDeviceReady,
    };
  }

  const mapTileSummaries = smoke.mapTileSummaries || [];
  const blankMaps = mapTileSummaries.filter((summary) => summary.blankMapLikely);
  const mapWarnings = smoke.mapWarningLines || [];
  const frameSummary = smoke.frameSummary || {};
  const avdName = smoke.avdName || "";
  const physicalDeviceEvidence = smoke.device?.type === "physical";
  const renderPassed = smoke.renderStatus === "passed" || smoke.status === "passed";
  const performancePassed = smoke.performanceStatus === "passed" || smoke.status === "passed";
  const attentionItems = smoke.attentionItems || [];
  const frameMetricsWithinClaimThreshold =
    Number(frameSummary.jankyPercent || 0) <= 20 && Number(frameSummary.percentile95Ms || 0) <= 80;
  const summaryBlockers = performanceSummary?.blockers || [];
  const performanceSummaryPath = performanceSummary
    ? args.nativePerformanceSummary || latestNativePerformanceSummaryPath()
    : "";
  const summaryMapEvidenceReady = performanceSummary
    ? physicalMapEvidenceReady(performanceSummary.mapTileSummaries || [], performanceSummaryPath)
    : false;
  const summarySourceMatches = performanceSummary ? performanceSummaryMatchesSmoke(performanceSummary, smoke) : false;
  const summaryPassed =
    performanceSummary?.status === "passed" &&
    summaryBlockers.length === 0 &&
    summaryMapEvidenceReady &&
    summarySourceMatches;
  const summaryDevice = performanceSummary?.device || null;
  const summaryPhysicalDeviceEvidence = summaryDevice?.type === "physical";
  const rawPerformanceClaimAllowed =
    physicalDeviceEvidence &&
    renderPassed &&
    performancePassed &&
    attentionItems.length === 0 &&
    frameMetricsWithinClaimThreshold;
  const performanceClaimAllowed = performanceSummary
    ? summaryPassed && summaryPhysicalDeviceEvidence
    : rawPerformanceClaimAllowed;

  return {
    androidPreviewSmoke: smoke.status || "unknown",
    evidenceFile: smoke.reportJson || args.nativeSmoke || latestNativeSmokePath(),
    artifact: smoke.artifactName || (smoke.artifact ? basename(smoke.artifact) : ""),
    performanceSummaryFile: performanceSummaryPath,
    avdName,
    device: smoke.device || null,
    performanceSummaryDevice: summaryDevice,
    renderPassed,
    performancePassed,
    androidMapTilesReady: mapTileSummaries.length > 0 && blankMaps.length === 0 && mapWarnings.length === 0,
    mapScreensChecked: mapTileSummaries.length,
    mapWarnings: mapWarnings.length,
    physicalDeviceEvidence,
    performanceClaimAllowed,
    frameSummary,
    attentionItems,
    performanceSummaryStatus: performanceSummary?.status || "missing",
    performanceSummaryBlockers: summaryBlockers,
    performanceSummaryMapScreensChecked: performanceSummary?.mapTileSummaries?.length || 0,
    performanceSummaryMapEvidenceReady: summaryMapEvidenceReady,
    performanceSummarySourceMatches: summarySourceMatches,
    nativeBlockerPacketFile: packetPath,
    nativeBlockerPacketPresent: packetPresent,
    nativeBlockerPacketStatus: blockerPacket?.status || "missing",
    nativeBlockerPacketGeneratedAt: packetGeneratedAt,
    nativeBlockerPacketAgeHours: packetAgeHours,
    nativeBlockerPacketFresh: packetFresh,
    nativeBlockerPacketSynthetic: packetSynthetic,
    nativeBlockerPacketBlockers: packetBlockers,
    iosValidationReportFile: iosReport ? iosValidationReportPath() : "",
    iosValidationStatus: iosValidation.status,
    iosValidationBlockers: iosValidation.blockers,
    iosNativeValidationReady,
    androidPhysicalDeviceReady,
  };
}

function iosValidationStatus(report) {
  if (!report) {
    return {
      ready: false,
      status: "missing",
      blockers: ["ios_validation_report_missing"],
    };
  }
  const requiredScreens = ["plan", "nearby", "account"];
  const screens = report.screens || report.renderedScreens || [];
  const screenNames = screens.map((screen) => String(screen.name || screen.screen || screen).toLowerCase());
  const missingScreens = requiredScreens.filter((screen) => !screenNames.includes(screen));
  const screensWithMissingScreenshots = screens.filter((screen) => {
    const name = String(screen.name || screen.screen || "").toLowerCase();
    if (!requiredScreens.includes(name)) return false;
    return !screen.screenshot || !iosEvidenceFileExists(screen.screenshot, report.__filePath);
  });
  const blockers = [
    ...(report.status !== "passed" ? ["ios_validation_not_passed"] : []),
    ...(report.platform && String(report.platform).toLowerCase() !== "ios" ? ["ios_validation_wrong_platform"] : []),
    ...(!report.device?.type && !report.simulator?.name ? ["ios_validation_target_missing"] : []),
    ...(missingScreens.length ? ["ios_validation_screens_incomplete"] : []),
    ...(screensWithMissingScreenshots.length ? ["ios_validation_screenshots_missing"] : []),
    ...((report.failureLines || []).length ? ["ios_validation_runtime_failures"] : []),
  ];
  return {
    ready: blockers.length === 0,
    status: blockers.length ? "blocked" : "passed",
    blockers,
  };
}

function iosEvidenceFileExists(filePath, reportPath = "") {
  const text = String(filePath || "").trim();
  if (!text) return false;
  const candidates = [
    resolve(root, text),
    reportPath ? resolve(reportPath, "..", text) : "",
  ].filter(Boolean);
  return candidates.some((candidate) => existsSync(candidate));
}

function performanceSummaryMatchesSmoke(summary, smoke) {
  const smokePath = smoke.reportJson || args.nativeSmoke || latestNativeSmokePath();
  const summarySource = summary.sourceReport || "";
  const smokeArtifact = smoke.artifactName || (smoke.artifact ? basename(smoke.artifact) : "");
  const summaryArtifact = summary.artifactName || "";
  const smokeSerial = smoke.device?.serial || "";
  const summarySerial = summary.device?.serial || "";
  return (
    Boolean(smokePath) &&
    Boolean(summarySource) &&
    resolve(root, summarySource) === resolve(root, smokePath) &&
    Boolean(smokeArtifact) &&
    summaryArtifact === smokeArtifact &&
    Boolean(smokeSerial) &&
    summarySerial === smokeSerial
  );
}

function nativeBlockerPacketAgeHours(generatedAt) {
  const timestamp = new Date(generatedAt).getTime();
  if (Number.isNaN(timestamp)) return null;
  const ageHours = (Date.now() - timestamp) / 36e5;
  if (ageHours < -0.1) return null;
  return Number(Math.max(0, ageHours).toFixed(2));
}

function nativeBlockerPacketMaxAgeHours() {
  const value = Number(args.nativeBlockerMaxAgeHours || process.env.FUEL_PATH_NATIVE_BLOCKER_MAX_AGE_HOURS || 24);
  return Number.isFinite(value) && value > 0 && value <= 72 ? value : 24;
}

function physicalMapEvidenceReady(mapTileSummaries, summaryPath = "") {
  const requiredMapScreens = ["plan", "nearby", "nearby-after-pan"];
  const mapScreenshotNames = mapTileSummaries.map((summary) => basename(summary.screenshot || ""));
  return (
    mapTileSummaries.length >= requiredMapScreens.length &&
    requiredMapScreens.every((screen) => mapScreenshotNames.some((name) => name.endsWith(`-${screen}.png`))) &&
    !mapTileSummaries.some((summary) => summary.blankMapLikely) &&
    mapTileSummaries.every((summary) => androidEvidenceFileExists(summary.screenshot, summaryPath))
  );
}

function androidEvidenceFileExists(filePath, summaryPath = "") {
  const text = String(filePath || "").trim();
  if (!text) return false;
  const candidates = [
    resolve(root, text),
    summaryPath ? resolve(summaryPath, "..", text) : "",
  ].filter(Boolean);
  return candidates.some((candidate) => existsSync(candidate));
}

function nextAction(items) {
  const actions = [];
  if (items.includes("provider_terms_not_confirmed")) {
    actions.push("confirm NSW/ACT, QLD and TAS usage, caching and attribution terms before public live-price claims");
  }
  if (items.includes("android_map_tiles_not_ready")) {
    actions.push("fix Android map rendering and rerun the installed preview APK smoke");
  }
  if (items.includes("physical_device_validation_missing")) {
    actions.push("run one credible physical-device native pass before real-user beta claims");
  }
  if (items.includes("native_performance_not_claimable")) {
    actions.push("capture a real-device or controlled mid-range Android performance pass before public performance claims");
  }
  if (items.includes("native_blocker_packet_missing")) {
    actions.push("run the native blocker packet so beta readiness reflects Android physical-device and iOS simulator state");
  }
  if (items.includes("native_blocker_packet_synthetic")) {
    actions.push("rerun the native blocker packet against real local Android and iOS tooling");
  }
  if (items.includes("native_blocker_packet_stale")) {
    actions.push("rerun the native blocker packet so beta readiness reflects the current Android device and iOS simulator state");
  }
  if (items.includes("ios_native_validation_missing")) {
    actions.push("install full Xcode/simctl or add iOS simulator/device validation evidence");
  }
  if (items.includes("privacy_contact_missing") || items.includes("store_listing_links_missing")) {
    actions.push("confirm the privacy contact method and store listing policy links before store publication");
  }
  if (
    items.includes("apple_privacy_review_missing") ||
    items.includes("google_data_safety_review_missing") ||
    items.includes("provider_limitations_disclosure_missing") ||
    items.includes("support_process_missing")
  ) {
    actions.push("complete Apple privacy, Google Data Safety, provider limitation and support-process review evidence");
  }
  if (items.includes("ev_charging_budget_controls_not_ready")) {
    actions.push("pause paid Google EV charging lookups until budget hard-stop/cap state is clear");
  }
  if (items.includes("support_contact_mismatch")) {
    actions.push("use the same monitored contact for privacy, store and support evidence before setting supportProcessReady");
  }
  if (items.includes("support_readiness_not_ready")) {
    actions.push("complete support contact, owner, review date and runbook coverage before setting supportProcessReady");
  }
  if (!actions.length) return "Clear the remaining beta readiness blockers.";
  return `Next actions: ${actions.join("; ")}.`;
}

function normaliseContact(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol === "https:") {
      const pathname = url.pathname.replace(/\/+$/, "") || "/";
      return `${url.protocol}//${url.hostname.toLowerCase()}${pathname.toLowerCase()}${url.hash.toLowerCase()}`;
    }
  } catch {
    // Fall through to plain contact normalisation for email-like values.
  }
  return text.toLowerCase();
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--api-base") {
      result.apiBase = values[index + 1] || "";
      index += 1;
    } else if (value === "--provider-terms-json") {
      result.providerTermsJson = values[index + 1] || "";
      index += 1;
    } else if (value === "--provider-terms-evidence-json") {
      result.providerTermsEvidenceJson = values[index + 1] || "";
      index += 1;
    } else if (value === "--native-smoke") {
      result.nativeSmoke = values[index + 1] || "";
      index += 1;
    } else if (value === "--native-performance-summary") {
      result.nativePerformanceSummary = values[index + 1] || "";
      index += 1;
    } else if (value === "--ios-validation-report") {
      result.iosValidationReport = values[index + 1] || "";
      index += 1;
    } else if (value === "--native-blocker-packet") {
      result.nativeBlockerPacket = values[index + 1] || "";
      index += 1;
    } else if (value === "--native-blocker-max-age-hours") {
      result.nativeBlockerMaxAgeHours = values[index + 1] || "";
      index += 1;
    } else if (value === "--store-evidence-json") {
      result.storeEvidenceJson = values[index + 1] || "";
      index += 1;
    } else if (value === "--store-review-max-age-days") {
      result["store-review-max-age-days"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--support-runbook") {
      result.supportRunbook = values[index + 1] || "";
      index += 1;
    } else if (value === "--allow-blocked") {
      result.allowBlocked = true;
    } else if (value === "--privacy-contact-confirmed") {
      result["privacy-contact-confirmed"] = "1";
    } else if (value === "--store-listing-links-confirmed") {
      result["store-listing-links-confirmed"] = "1";
    } else if (value === "--privacy-contact") {
      result["privacy-contact"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--app-store-url") {
      result["app-store-url"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--google-play-url") {
      result["google-play-url"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--privacy-policy-url") {
      result["privacy-policy-url"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--privacy-policy-source") {
      result["privacy-policy-source"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--apple-privacy-reviewed") {
      result["apple-privacy-reviewed"] = "1";
    } else if (value === "--apple-privacy-review-reference") {
      result["apple-privacy-review-reference"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--google-data-safety-reviewed") {
      result["google-data-safety-reviewed"] = "1";
    } else if (value === "--google-data-safety-review-reference") {
      result["google-data-safety-review-reference"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--provider-limitations-disclosed") {
      result["provider-limitations-disclosed"] = "1";
    } else if (value === "--provider-limitations-disclosure-reference") {
      result["provider-limitations-disclosure-reference"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--support-process-ready") {
      result["support-process-ready"] = "1";
    } else if (value === "--support-process-reference") {
      result["support-process-reference"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--support-contact") {
      result["support-contact"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--support-owner") {
      result["support-owner"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--support-reviewed-at") {
      result["support-reviewed-at"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--support-review-max-age-days") {
      result["support-review-max-age-days"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--reviewed-at") {
      result["reviewed-at"] = values[index + 1] || "";
      index += 1;
    } else if (value === "--ev-charging-json") {
      result.evChargingJson = values[index + 1] || "";
      index += 1;
    } else if (value === "--reviewer") {
      result.reviewer = values[index + 1] || "";
      index += 1;
    }
  }
  return result;
}
