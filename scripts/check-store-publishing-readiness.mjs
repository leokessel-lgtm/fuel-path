#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const evidence = readEvidence();
const nativeAppConfig = readNativeAppConfig();
const store = buildStoreStatus(evidence.payload || {});
const blockers = [
  ...(!store.privacyContactConfirmed ? ["privacy_contact_missing"] : []),
  ...(!store.privacyPolicyReady ? ["privacy_policy_url_missing"] : []),
  ...(store.privacyContactConfirmed && store.privacyPolicyReady && !store.privacyPolicyContactPublished
    ? ["privacy_policy_contact_missing"]
    : []),
  ...(!store.storeListingLinksConfirmed ? ["store_listing_links_missing"] : []),
  ...(!store.applePrivacyReviewReady ? ["apple_privacy_review_missing"] : []),
  ...(!store.googleDataSafetyReviewReady ? ["google_data_safety_review_missing"] : []),
  ...(!store.providerLimitationsDisclosureReady ? ["provider_limitations_disclosure_missing"] : []),
  ...(!store.supportProcessReady ? ["support_process_missing"] : []),
  ...(store.applePrivacyReviewReady && !store.applePrivacyReviewEvidenceReady ? ["apple_privacy_review_evidence_missing"] : []),
  ...(store.googleDataSafetyReviewReady && !store.googleDataSafetyReviewEvidenceReady ? ["google_data_safety_review_evidence_missing"] : []),
  ...(store.providerLimitationsDisclosureReady && !store.providerLimitationsDisclosureEvidenceReady ? ["provider_limitations_disclosure_evidence_missing"] : []),
  ...(store.supportProcessReady && !store.supportProcessEvidenceReady ? ["support_process_evidence_missing"] : []),
  ...(store.reviewEvidenceRequired && !store.reviewEvidenceReady ? ["store_review_metadata_missing"] : []),
  ...(store.reviewEvidenceReady && !store.reviewFresh ? ["store_review_evidence_stale"] : []),
];

const payload = {
  ok: blockers.length === 0,
  status: blockers.length ? "blocked" : "ready",
  blockers,
  ...store,
  nextAction: blockers.length
    ? "Fill the concrete privacy contact, Fuel Path-owned public policy URL, store listing URLs and reviewed store disclosure evidence before publication."
    : "Store/privacy publishing evidence is ready for beta publication review.",
};

console.log(JSON.stringify(payload, null, 2));
if (!payload.ok && !args.allowBlocked) process.exit(1);

function readEvidence() {
  const evidencePath = args["evidence-json"] || args.evidenceJson || "";
  if (!evidencePath) return { payload: {}, baseDir: process.cwd() };
  const resolved = resolve(evidencePath);
  if (!existsSync(resolved)) {
    throw new Error(`Store publishing evidence file not found: ${evidencePath}`);
  }
  return {
    path: evidencePath,
    resolvedPath: resolved,
    baseDir: dirname(resolved),
    payload: JSON.parse(readFileSync(resolved, "utf8")),
  };
}

function buildStoreStatus(evidence = {}) {
  const privacyContact = textArg("privacy-contact", "FUEL_PATH_PRIVACY_CONTACT", evidence.privacyContact);
  const privacyPolicyUrl = textArg(
    "privacy-policy-url",
    "FUEL_PATH_PRIVACY_POLICY_URL",
    evidence.privacyPolicyUrl || "https://fuel-path.vercel.app/web-demo/privacy",
  );
  const privacyPolicySource = textArg(
    "privacy-policy-source",
    "FUEL_PATH_PRIVACY_POLICY_SOURCE",
    evidence.privacyPolicySource || defaultPrivacyPolicySource(privacyPolicyUrl),
  );
  const appStoreUrl = textArg("app-store-url", "FUEL_PATH_APP_STORE_URL", evidence.appStoreUrl);
  const googlePlayUrl = textArg("google-play-url", "FUEL_PATH_GOOGLE_PLAY_URL", evidence.googlePlayUrl);
  const manualPrivacyContactConfirmed = boolArg(
    "privacy-contact-confirmed",
    "FUEL_PATH_PRIVACY_CONTACT_CONFIRMED",
    evidence.privacyContactConfirmed,
  );
  const manualStoreListingLinksConfirmed = boolArg(
    "store-listing-links-confirmed",
    "FUEL_PATH_STORE_LISTING_LINKS_CONFIRMED",
    evidence.storeListingLinksConfirmed,
  );
  const privacyContactConfirmed = Boolean(validPrivacyContact(privacyContact));
  const privacyPolicyReady = Boolean(validPrivacyPolicyUrl(privacyPolicyUrl));
  const privacyPolicyContactPublished = privacyContactConfirmed
    ? policySourceContainsContact(privacyPolicySource, privacyContact)
    : false;
  const appStoreListingReady = Boolean(validAppStoreUrl(appStoreUrl, nativeAppConfig.appSlug));
  const googlePlayListingReady = Boolean(validGooglePlayUrl(googlePlayUrl, nativeAppConfig.androidPackage));
  const storeListingLinksConfirmed = appStoreListingReady && googlePlayListingReady;
  const applePrivacyReviewReady = boolArg(
    "apple-privacy-reviewed",
    "FUEL_PATH_APPLE_PRIVACY_REVIEWED",
    evidence.applePrivacyReviewed,
  );
  const googleDataSafetyReviewReady = boolArg(
    "google-data-safety-reviewed",
    "FUEL_PATH_GOOGLE_DATA_SAFETY_REVIEWED",
    evidence.googleDataSafetyReviewed,
  );
  const providerLimitationsDisclosureReady = boolArg(
    "provider-limitations-disclosed",
    "FUEL_PATH_PROVIDER_LIMITATIONS_DISCLOSED",
    evidence.providerLimitationsDisclosed,
  );
  const supportProcessReady = boolArg(
    "support-process-ready",
    "FUEL_PATH_SUPPORT_PROCESS_READY",
    evidence.supportProcessReady,
  );
  const applePrivacyReviewReference = textArg(
    "apple-privacy-review-reference",
    "FUEL_PATH_APPLE_PRIVACY_REVIEW_REFERENCE",
    evidence.applePrivacyReviewReference,
  );
  const googleDataSafetyReviewReference = textArg(
    "google-data-safety-review-reference",
    "FUEL_PATH_GOOGLE_DATA_SAFETY_REVIEW_REFERENCE",
    evidence.googleDataSafetyReviewReference,
  );
  const providerLimitationsDisclosureReference = textArg(
    "provider-limitations-disclosure-reference",
    "FUEL_PATH_PROVIDER_LIMITATIONS_DISCLOSURE_REFERENCE",
    evidence.providerLimitationsDisclosureReference,
  );
  const supportProcessReference = textArg(
    "support-process-reference",
    "FUEL_PATH_SUPPORT_PROCESS_REFERENCE",
    evidence.supportProcessReference,
  );
  const reviewedAt = textArg("reviewed-at", "FUEL_PATH_STORE_REVIEWED_AT", evidence.reviewedAt);
  const reviewer = textArg("reviewer", "FUEL_PATH_STORE_REVIEWER", evidence.reviewer);
  const applePrivacyReviewEvidenceReady = concreteReviewReference(applePrivacyReviewReference, "apple_privacy");
  const googleDataSafetyReviewEvidenceReady = concreteReviewReference(googleDataSafetyReviewReference, "google_data_safety");
  const providerLimitationsDisclosureEvidenceReady = concreteReviewReference(
    providerLimitationsDisclosureReference,
    "provider_limitations",
  );
  const supportProcessEvidenceReady = concreteReviewReference(supportProcessReference, "support_process");
  const reviewEvidenceRequired =
    applePrivacyReviewReady ||
    googleDataSafetyReviewReady ||
    providerLimitationsDisclosureReady ||
    supportProcessReady;
  const reviewAgeDays = reviewAgeInDays(reviewedAt);
  const reviewFresh = reviewAgeDays !== null && reviewAgeDays <= storeReviewMaxAgeDays();
  const reviewEvidenceReady = reviewAgeDays !== null && validReviewer(reviewer);

  return {
    privacyContact: privacyContact || "",
    privacyContactConfirmed,
    manualPrivacyContactConfirmed,
    privacyPolicyUrl: privacyPolicyUrl || "",
    privacyPolicyReady,
    privacyPolicySource: privacyPolicySource || "",
    privacyPolicyContactPublished,
    appStoreUrl: appStoreUrl || "",
    appStoreListingReady,
    googlePlayUrl: googlePlayUrl || "",
    googlePlayListingReady,
    expectedAppStoreSlug: nativeAppConfig.appSlug,
    expectedAndroidPackage: nativeAppConfig.androidPackage,
    expectedIosBundleIdentifier: nativeAppConfig.iosBundleIdentifier,
    storeListingLinksConfirmed,
    manualStoreListingLinksConfirmed,
    applePrivacyReviewReady,
    googleDataSafetyReviewReady,
    providerLimitationsDisclosureReady,
    supportProcessReady,
    applePrivacyReviewReference,
    applePrivacyReviewEvidenceReady,
    googleDataSafetyReviewReference,
    googleDataSafetyReviewEvidenceReady,
    providerLimitationsDisclosureReference,
    providerLimitationsDisclosureEvidenceReady,
    supportProcessReference,
    supportProcessEvidenceReady,
    reviewedAt,
    reviewer,
    reviewEvidenceRequired,
    reviewEvidenceReady,
    reviewAgeDays,
    reviewFresh,
    reviewMaxAgeDays: storeReviewMaxAgeDays(),
  };
}

function readNativeAppConfig() {
  const appJsonPath = resolve("mobile-app", "app.json");
  if (!existsSync(appJsonPath)) return { appSlug: "", androidPackage: "", iosBundleIdentifier: "" };
  try {
    const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));
    return {
      appSlug: String(appJson.expo?.slug || "").trim(),
      androidPackage: String(appJson.expo?.android?.package || "").trim(),
      iosBundleIdentifier: String(appJson.expo?.ios?.bundleIdentifier || "").trim(),
    };
  } catch {
    return { appSlug: "", androidPackage: "", iosBundleIdentifier: "" };
  }
}

function validPrivacyContact(value) {
  const text = String(value || "").trim();
  if (!text || placeholderLike(text)) return false;
  return validContactEmail(text) || validContactUrl(text);
}

function validContactEmail(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return false;
  const domain = text.split("@").pop();
  if (["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "example.com"].includes(domain)) {
    return false;
  }
  return true;
}

function validHttpsUrl(value) {
  try {
    const text = String(value || "").trim();
    if (!text || placeholderLike(text)) return false;
    const url = new URL(text);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function validContactUrl(value) {
  try {
    const text = String(value || "").trim();
    if (!validHttpsUrl(text)) return false;
    const url = new URL(text);
    return fuelPathHost(url.hostname);
  } catch {
    return false;
  }
}

function validPrivacyPolicyUrl(value) {
  try {
    const text = String(value || "").trim();
    if (!validHttpsUrl(text)) return false;
    const url = new URL(text);
    return fuelPathHost(url.hostname);
  } catch {
    return false;
  }
}

function fuelPathHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return (
    host === "fuelpath.app" ||
    host.endsWith(".fuelpath.app") ||
    host === "fuel-path.app" ||
    host.endsWith(".fuel-path.app") ||
    host === "fuel-path.vercel.app"
  );
}

function validUrl(value, requiredHost) {
  try {
    const text = String(value || "").trim();
    if (!text || placeholderLike(text)) return false;
    const url = new URL(text);
    return url.protocol === "https:" && (url.hostname === requiredHost || url.hostname.endsWith(`.${requiredHost}`));
  } catch {
    return false;
  }
}

function validAppStoreUrl(value, expectedSlug = "") {
  try {
    const url = new URL(String(value || "").trim());
    if (!validUrl(value, "apps.apple.com")) return false;
    const idMatch = url.pathname.match(/\/app\/([^/]+)\/id(\d+)$/);
    if (!idMatch) return false;
    const slug = idMatch[1];
    const appId = idMatch[2];
    if (/^1234567890$|^0+$/.test(appId)) return false;
    if (expectedSlug && slug !== expectedSlug) return false;
    return appId.length >= 9;
  } catch {
    return false;
  }
}

function validGooglePlayUrl(value, expectedPackage = "") {
  try {
    const url = new URL(String(value || "").trim());
    if (!validUrl(value, "play.google.com")) return false;
    const packageId = url.searchParams.get("id") || "";
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/i.test(packageId)) return false;
    if (/^(com\.example|com\.your|com\.test)/i.test(packageId)) return false;
    if (expectedPackage && packageId !== expectedPackage) return false;
    return true;
  } catch {
    return false;
  }
}

function defaultPrivacyPolicySource(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    if (parsed.hostname === "fuel-path.vercel.app" && parsed.pathname.replace(/\/$/, "") === "/web-demo/privacy") {
      return "web-demo/privacy.html";
    }
  } catch {
    return "";
  }
  return "";
}

function policySourceContainsContact(sourcePath, contact) {
  const resolved = resolve(String(sourcePath || ""));
  if (!sourcePath || !existsSync(resolved)) return false;
  const source = readFileSync(resolved, "utf8");
  const normalisedSource = normalisePolicyText(source);
  const normalisedContact = normalisePolicyText(contact);
  if (!normalisedSource.includes(normalisedContact)) return false;
  return !/final published policy must include|needs the final privacy contact method|correct Fuel Path privacy contact method/i.test(
    source,
  );
}

function normalisePolicyText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^mailto:/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function placeholderLike(value) {
  return /placeholder|example\.com|todo|tbc|to be confirmed|your_|your-|idYOUR|temporary/i.test(String(value || ""));
}

function validReviewDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function reviewAgeInDays(value) {
  if (!validReviewDate(value)) return null;
  const timestamp = new Date(`${String(value).trim()}T00:00:00Z`).getTime();
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (timestamp > todayUtc) return null;
  const ageDays = (todayUtc - timestamp) / 864e5;
  return Number(Math.max(0, ageDays).toFixed(1));
}

function storeReviewMaxAgeDays() {
  const value = Number(args["store-review-max-age-days"] || process.env.FUEL_PATH_STORE_REVIEW_MAX_AGE_DAYS || 30);
  return Number.isFinite(value) && value > 0 && value <= 90 ? value : 30;
}

function validReviewer(value) {
  const text = String(value || "").trim();
  if (text.length < 3 || placeholderLike(text)) return false;
  return !/^(owner|release owner|support owner|support team|team|admin|administrator|support|reviewer)$/i.test(text);
}

function concreteReviewReference(value, category = "general") {
  const text = String(value || "").trim();
  if (text.length < 8 || placeholderLike(text)) return false;
  if (/^(checked|reviewed|done|yes)$/i.test(text)) return false;
  if (/^(checked|reviewed|done|yes|launch checked)\s+\d{4}-\d{2}-\d{2}$/i.test(text)) return false;
  const referenceAgeDays = referenceAgeInDays(text);
  if (referenceAgeDays === null || referenceAgeDays > storeReviewMaxAgeDays()) return false;
  if (!/privacy|data safety|data-safety|store|listing|support|runbook|provider|limitation|disclosure|ticket|record|note|url|\.md|jira|linear|servicenow|service-now/i.test(text)) {
    return false;
  }
  return categoryReviewReferenceMatches(text, category) && reviewReferenceSourceReady(text, category);
}

function referenceAgeInDays(value) {
  const match = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  if (!match) return null;
  return reviewAgeInDays(match[0]);
}

function categoryReviewReferenceMatches(text, category) {
  if (category === "apple_privacy") return /apple|app privacy|privacy|store-data-safety|store data safety/i.test(text);
  if (category === "google_data_safety") return /google|play|data safety|data-safety|store-data-safety/i.test(text);
  if (category === "provider_limitations") return /provider|limitation|disclosure|listing/i.test(text);
  if (category === "support_process") return /support[-\s]?runbook|runbook|support[-\s]?process.*source/i.test(text);
  return true;
}

function reviewReferenceSourceReady(text, category) {
  const sourcePaths = markdownSourcePaths(text);
  if (!sourcePaths.length) return true;
  return sourcePaths.some((sourcePath) => {
    const resolved = resolveReviewSourcePath(sourcePath);
    if (!existsSync(resolved)) return false;
    let source = "";
    try {
      source = readFileSync(resolved, "utf8");
    } catch {
      return false;
    }
    if (containsSensitiveEvidence(source)) return false;
    return categoryReviewReferenceMatches(`${sourcePath} ${source}`, category);
  });
}

function markdownSourcePaths(text) {
  return [...String(text || "").matchAll(/(?:^|\s)([A-Za-z0-9._/-]+\.md)\b/g)]
    .map((match) => match[1])
    .filter(Boolean);
}

function resolveReviewSourcePath(sourcePath) {
  if (isAbsolute(sourcePath)) return sourcePath;
  const fromEvidence = evidence.baseDir ? resolve(evidence.baseDir, sourcePath) : "";
  if (fromEvidence && existsSync(fromEvidence)) return fromEvidence;
  const fromRoot = resolve(sourcePath);
  if (existsSync(fromRoot)) return fromRoot;
  const relocatedSourcePaths = {
    "STORE-DATA-SAFETY.md": "docs/02-build-release/STORE-DATA-SAFETY.md",
  };
  return resolve(relocatedSourcePaths[sourcePath] || sourcePath);
}

function containsSensitiveEvidence(value) {
  return /(?:API|TOKEN|SECRET|PASSWORD|CLIENT_SECRET|BEARER)\s*[:=]\s*\S+/i.test(String(value || ""));
}

function boolArg(name, envName, fallback) {
  if (args[name] !== undefined) return args[name] === "1" || args[name] === true;
  if (process.env[envName] !== undefined) return process.env[envName] === "1";
  return fallback === true || fallback === "1";
}

function textArg(name, envName, fallback = "") {
  if (args[name] !== undefined) return String(args[name] || "").trim();
  if (process.env[envName] !== undefined) return String(process.env[envName] || "").trim();
  return String(fallback || "").trim();
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--allow-blocked") {
      result.allowBlocked = true;
    } else if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = values[index + 1];
      if (!next || next.startsWith("--")) {
        result[key] = "1";
      } else {
        result[key] = next;
        index += 1;
      }
    }
  }
  return result;
}
