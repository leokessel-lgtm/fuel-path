#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { fuelProviderCapabilityMatrix } = require("../api/_capabilities");

const args = parseArgs(process.argv.slice(2));
const apiBase = args.apiBase || "";
const evidence = readEvidence();
const enforcePublicLaunch = Boolean(args.enforcePublicLaunch);
const productionEnv = Boolean(args.production || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production");

const payload = apiBase ? await readHttpStatus(apiBase) : readLocalStatus({ productionEnv });
const readiness = buildProviderTermsReadiness(payload.fuelProviders?.capabilities || [], evidence);

console.log(JSON.stringify({
  ...readiness,
  mode: apiBase ? "http" : "local",
  source: apiBase || "local-capability-matrix",
}, null, 2));

if ((enforcePublicLaunch || productionEnv) && !readiness.publicLivePriceClaimsAllowed) {
  process.exit(1);
}

function readLocalStatus({ productionEnv }) {
  const previous = {
    FUEL_PATH_PRODUCTION_HARDENING: process.env.FUEL_PATH_PRODUCTION_HARDENING,
  };
  if (productionEnv) process.env.FUEL_PATH_PRODUCTION_HARDENING = "1";
  try {
    return {
      fuelProviders: {
        capabilities: fuelProviderCapabilityMatrix(),
      },
    };
  } finally {
    if (previous.FUEL_PATH_PRODUCTION_HARDENING === undefined) delete process.env.FUEL_PATH_PRODUCTION_HARDENING;
    else process.env.FUEL_PATH_PRODUCTION_HARDENING = previous.FUEL_PATH_PRODUCTION_HARDENING;
  }
}

async function readHttpStatus(apiBase) {
  const base = String(apiBase || "").replace(/\/$/, "");
  const response = await fetch(`${base}/api/status`);
  if (!response.ok) {
    throw new Error(`Status request failed: HTTP ${response.status}`);
  }
  return response.json();
}

function readEvidence() {
  const evidencePath = args.evidenceJson || process.env.FUEL_PATH_PROVIDER_TERMS_EVIDENCE_JSON || "";
  if (!evidencePath) return { provided: false, path: "" };
  const resolvedPath = resolve(evidencePath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Provider terms evidence file not found: ${evidencePath}`);
  }
  return {
    provided: true,
    path: evidencePath,
    resolvedPath,
    baseDir: dirname(resolvedPath),
    payload: JSON.parse(readFileSync(resolvedPath, "utf8")),
  };
}

function buildProviderTermsReadiness(capabilities, evidenceState = { provided: false, payload: {} }) {
  const regions = capabilities.map((entry) => ({
    region: entry.region,
    provider: entry.provider,
    capability: entry.capability,
    configured: Boolean(entry.configured),
    blocker: entry.blocker || "",
    nextAction: entry.nextAction || "",
  }));
  const termsBlocked = regions.filter((entry) =>
    entry.configured &&
    entry.capability === "limited" &&
    /usage|caching|attribution|terms/i.test(`${entry.blocker} ${entry.nextAction}`),
  );
  const accessBlocked = regions.filter((entry) =>
    entry.capability === "pending_access" &&
    /access|schema|api|configured/i.test(`${entry.blocker} ${entry.nextAction}`),
  );
  const evidenceBlocked = providerEvidenceBlockers(regions, evidenceState);
  const publicLiveRegions = regions.filter((entry) => entry.capability === "live").map((entry) => entry.region);
  const blockers = [
    ...termsBlocked.map((entry) => `${entry.region.toLowerCase()}_terms_not_confirmed`),
    ...evidenceBlocked.map((entry) => `${entry.region.toLowerCase()}_terms_evidence_missing`),
  ];

  return {
    ok: blockers.length === 0,
    publicLivePriceClaimsAllowed: blockers.length === 0,
    nationalLiveCoverageClaimsAllowed: blockers.length === 0 && accessBlocked.length === 0,
    status: blockers.length ? "blocked" : "ready",
    blockers,
    accessBlockers: accessBlocked.map((entry) => `${entry.region.toLowerCase()}_access_not_ready`),
    publicLiveRegions,
    termsBlocked,
    evidenceBlocked,
    accessBlocked,
    evidence: {
      provided: Boolean(evidenceState.provided),
      source: evidenceState.path || "",
    },
    confirmationChecklist: confirmationChecklist(termsBlocked),
    nextAction: blockers.length
      ? "Confirm provider usage, caching, attribution and access terms before public live-price claims."
      : "Provider terms and access gates are ready for current configured regions.",
  };
}

function providerEvidenceBlockers(regions, evidenceState) {
  const gatedRegions = regions.filter((entry) =>
    ["NSW", "ACT", "QLD", "TAS"].includes(entry.region) &&
    entry.configured &&
    entry.capability === "live"
  );
  if (!gatedRegions.length) return [];
  return gatedRegions.filter((entry) => !regionEvidenceReady(entry.region, evidenceState));
}

function regionEvidenceReady(region, evidenceState) {
  const evidence = evidenceState?.payload || {};
  const entry = evidence?.regions?.[region] || {};
  if (region === "QLD") {
    return [
      entry.signUpAccepted,
      entry.licenceTermsAccepted,
      entry.attributionDisclaimerReady,
      entry.cachePolicyCoversCurrencyObligations,
      entry.serverSideTokenOnly,
      entry.commercialConsumerAppUseConfirmed,
      concreteDate(entry.termsAcceptedAt),
      concretePositiveNumber(entry.priceCacheMaxAgeMinutes, { max: 30 }),
      concretePositiveNumber(entry.siteDataCacheMaxAgeHours, { max: 24 }),
      providerAttributionReady(region, entry.attributionDisclaimerWording),
      concreteEvidenceReference(region, entry.evidenceReference, entry.termsAcceptedAt),
      evidenceSourceReady(region, entry, evidenceState),
    ].every(Boolean);
  }
  if (region === "NSW" || region === "ACT") {
    return [
      entry.apiAccessApproved,
      entry.authorityTermsAccepted,
      entry.cachingDurationConfirmed,
      entry.attributionDisclaimerReady,
      entry.commercialConsumerAppUseConfirmed,
      concreteDate(entry.termsAcceptedAt),
      concretePositiveNumber(entry.cachingDurationMinutes),
      providerAttributionReady(region, entry.attributionDisclaimerWording),
      concreteEvidenceReference(region, entry.evidenceReference, entry.termsAcceptedAt),
      evidenceSourceReady(region, entry, evidenceState),
    ].every(Boolean);
  }
  if (region === "TAS") {
    return [
      entry.apiV2AccessApproved,
      entry.fuelCheckTasTermsAccepted,
      entry.cachingDurationConfirmed,
      entry.attributionDisclaimerReady,
      entry.commercialConsumerAppUseConfirmed,
      concreteDate(entry.termsAcceptedAt),
      concretePositiveNumber(entry.cachingDurationMinutes),
      providerAttributionReady(region, entry.attributionDisclaimerWording),
      concreteEvidenceReference(region, entry.evidenceReference, entry.termsAcceptedAt),
      evidenceSourceReady(region, entry, evidenceState),
    ].every(Boolean);
  }
  return false;
}

function evidenceSourceReady(region, entry, evidenceState) {
  const sourcePath = String(entry.evidenceSource || "").trim();
  if (!concreteText(sourcePath) || /placeholder|todo|tbc|example/i.test(sourcePath)) return false;
  const resolvedSourcePath = resolveEvidenceSourcePath(sourcePath, evidenceState);
  if (!resolvedSourcePath || !existsSync(resolvedSourcePath)) return false;

  let sourceText = "";
  try {
    sourceText = readFileSync(resolvedSourcePath, "utf8");
  } catch {
    return false;
  }

  if (containsProviderSecret(sourceText)) return false;
  const referenceDate = firstConcreteDate(entry.evidenceReference);
  if (!referenceDate) return false;
  const referenceDateText = referenceDate.toISOString().slice(0, 10);
  if (!sourceText.includes(referenceDateText)) return false;
  return providerEvidenceReferenceMatches(region, sourceText);
}

function resolveEvidenceSourcePath(sourcePath, evidenceState) {
  if (isAbsolute(sourcePath)) return sourcePath;
  const baseDir = evidenceState?.baseDir || process.cwd();
  return resolve(baseDir, sourcePath);
}

function containsProviderSecret(value) {
  const text = String(value || "");
  return /NSW_FUEL_API_(?:KEY|SECRET)\s*[:=]|QLD_FUEL_API_TOKEN\s*[:=]|client[_-]?secret\s*[:=]|api[_-]?secret\s*[:=]|bearer\s+[a-z0-9._~/-]{12,}/i.test(text);
}

function concreteEvidenceReference(region, value, termsAcceptedAt = "") {
  const text = String(value || "").trim();
  if (text.length < 16 || /placeholder|todo|tbc|example|checked|reviewed|done|yes/i.test(text)) return false;
  const referenceDate = firstConcreteDate(text);
  if (!referenceDate) return false;
  const acceptedDate = firstConcreteDate(termsAcceptedAt);
  if (acceptedDate && referenceDate.getTime() < acceptedDate.getTime()) return false;
  if (reviewAgeInDays(referenceDate) > providerTermsReviewMaxAgeDays()) return false;
  if (!/approval|email|licen[cs]e|terms|ticket|record|note|pdf|url|jira|linear|servicenow|service-now/i.test(text)) {
    return false;
  }
  return providerEvidenceReferenceMatches(region, text);
}

function providerEvidenceReferenceMatches(region, value) {
  const text = String(value || "");
  if (region === "QLD") return /qld[-_\s]?fuel[-_\s]?prices|queensland[-_\s]?fuel[-_\s]?prices|fuel[-_\s]?prices/i.test(text);
  if (region === "NSW" || region === "ACT" || region === "TAS") {
    return /fuelcheck|fuel[-_\s]?check|api[-_.\s]?nsw/i.test(text);
  }
  return false;
}

function concreteText(value) {
  const text = String(value || "").trim();
  return text.length >= 12 && !/placeholder|todo|tbc|example|confirm wording/i.test(text);
}

function providerAttributionReady(region, value) {
  if (!concreteText(value)) return false;
  const text = String(value || "");
  if (region === "QLD") return /qld fuel prices|queensland fuel prices|fuel prices/i.test(text);
  if (region === "NSW" || region === "ACT" || region === "TAS") {
    return /fuelcheck|api\.?nsw/i.test(text);
  }
  return false;
}

function concreteDate(value) {
  return Boolean(firstConcreteDate(value));
}

function firstConcreteDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  if (!match || match[0] === "0000-00-00") return null;
  const dateText = match[0];
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateText) return null;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return date.getTime() <= todayUtc.getTime() ? date : null;
}

function reviewAgeInDays(date) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dateUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return (todayUtc - dateUtc) / 864e5;
}

function providerTermsReviewMaxAgeDays() {
  const value = Number(
    args.providerTermsReviewMaxAgeDays || process.env.FUEL_PATH_PROVIDER_TERMS_REVIEW_MAX_AGE_DAYS || 90,
  );
  return Number.isFinite(value) && value > 0 && value <= 365 ? value : 90;
}

function concretePositiveNumber(value, { max = Number.POSITIVE_INFINITY } = {}) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= max;
}

function confirmationChecklist(termsBlocked) {
  return termsBlocked.map((entry) => {
    if (entry.region === "QLD") {
      return {
        region: entry.region,
        provider: entry.provider,
        flag: "FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED=1",
        requiredEvidence: [
          "publisher/data-consumer sign-up accepted",
          "Fuel Price Data Licence Terms of Service accepted for Fuel Path",
          "terms acceptance date recorded",
          "price cache max-age recorded at 30 minutes or less",
          "site-data cache max-age recorded at 24 hours or less",
          "attribution/disclaimer wording recorded where QLD data is displayed",
          "no direct end-user calls to the QLD API token",
        ],
      };
    }
    if (entry.region === "NSW" || entry.region === "ACT") {
      return {
        region: entry.region,
        provider: entry.provider,
        flag: "FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED=1 or FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED=1",
        requiredEvidence: [
          "API.NSW Fuel API subscription/access approved for Fuel Path",
          "authority-specific FuelCheck NSW/ACT usage terms accepted",
          "terms acceptance date recorded",
          "allowed caching duration recorded in minutes",
          "required attribution/disclaimer wording recorded",
          "commercial consumer-app use confirmed",
        ],
      };
    }
    if (entry.region === "TAS") {
      return {
        region: entry.region,
        provider: entry.provider,
        flag: "FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED=1 or FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED=1",
        requiredEvidence: [
          "API.NSW Fuel API v2 access approved for TAS use by Fuel Path",
          "FuelCheck TAS usage terms accepted",
          "terms acceptance date recorded",
          "allowed caching duration recorded in minutes",
          "required attribution/disclaimer wording recorded",
          "commercial consumer-app use confirmed",
        ],
      };
    }
    return {
      region: entry.region,
      provider: entry.provider,
      flag: "",
      requiredEvidence: ["usage, caching and attribution terms confirmed"],
    };
  });
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--api-base") {
      parsed.apiBase = values[index + 1] || "";
      index += 1;
    } else if (value === "--production") {
      parsed.production = true;
    } else if (value === "--enforce-public-launch") {
      parsed.enforcePublicLaunch = true;
    } else if (value === "--evidence-json") {
      parsed.evidenceJson = values[index + 1] || "";
      index += 1;
    } else if (value === "--provider-terms-review-max-age-days") {
      parsed.providerTermsReviewMaxAgeDays = values[index + 1] || "";
      index += 1;
    }
  }
  return parsed;
}
