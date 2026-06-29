#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const runbookPath = args.runbook || "SUPPORT-RUNBOOK.md";
const resolvedRunbook = resolve(runbookPath);
const runbook = existsSync(resolvedRunbook) ? readFileSync(resolvedRunbook, "utf8") : "";
const supportContact = textArg("support-contact", "FUEL_PATH_SUPPORT_CONTACT", "");
const supportOwner = textArg("support-owner", "FUEL_PATH_SUPPORT_OWNER", "");
const reviewedAt = textArg("reviewed-at", "FUEL_PATH_SUPPORT_REVIEWED_AT", "");
const reviewAgeDays = reviewAgeInDays(reviewedAt);
const reviewFresh = reviewAgeDays !== null && reviewAgeDays <= supportReviewMaxAgeDays();
const supportContactReady = validSupportContact(supportContact);
const supportOwnerReady = validSupportOwner(supportOwner);
const runbookPublishesSupportContact = supportContactReady && runbookPublishesContact(supportContact);
const runbookPublishesSupportOwner = supportOwnerReady && runbookPublishesOwner(supportOwner);

const requiredSections = [
  "## Intake",
  "## Triage",
  "## Escalation",
  "## Privacy And Data Requests",
  "## Provider Price Issues",
  "## Native Device Issues",
  "## Evidence Logging",
];

const missingSections = requiredSections.filter((section) => !runbookHasSection(section));
const requiredEvidenceScopes = [
  {
    id: "privacy_deletion",
    label: "privacy/deletion",
    pattern: /privacy[\s\S]*deletion|deletion[\s\S]*privacy/i,
  },
  {
    id: "provider_price",
    label: "provider-price",
    pattern: /fuel[\s-]?price|price[\s-]?accuracy|price[\s-]?mismatch|station[\s-]?data/i,
  },
  {
    id: "map_location",
    label: "map/location",
    pattern: /map[\s/,-]*location|location[\s/,-]*map|device[\s\S]*(map|location)/i,
  },
  {
    id: "alert_failure",
    label: "alert-failure",
    pattern: /alert[\s-]?failure|alert[\s\S]*(sent|stale|unsupported|duplicate)/i,
  },
];
const flattenedRunbook = runbook.replace(/\s+/g, " ");
const missingEvidenceScopes = requiredEvidenceScopes.filter((scope) => !scope.pattern.test(flattenedRunbook));
const blockers = [
  ...(!runbook ? ["support_runbook_missing"] : []),
  ...missingSections.map((section) => `support_runbook_missing_${slug(section)}`),
  ...(!supportContactReady ? ["support_contact_missing"] : []),
  ...(supportContactReady && !runbookPublishesSupportContact ? ["support_contact_not_in_runbook"] : []),
  ...(!supportOwnerReady ? ["support_owner_missing"] : []),
  ...(supportOwnerReady && !runbookPublishesSupportOwner ? ["support_owner_not_in_runbook"] : []),
  ...(reviewAgeDays === null ? ["support_review_date_missing"] : []),
  ...(reviewAgeDays !== null && !reviewFresh ? ["support_review_date_stale"] : []),
  ...(!runbook.includes("P0") || !runbook.includes("P1") || !runbook.includes("P2")
    ? ["support_triage_priorities_missing"]
    : []),
  ...(missingEvidenceScopes.length ? ["support_evidence_scope_incomplete"] : []),
];

const payload = {
  ok: blockers.length === 0,
  status: blockers.length ? "blocked" : "ready",
  blockers,
  runbook: runbookPath,
  requiredSections,
  missingSections,
  requiredEvidenceScopes: requiredEvidenceScopes.map((scope) => scope.label),
  missingEvidenceScopes: missingEvidenceScopes.map((scope) => scope.label),
  supportContact,
  supportContactReady,
  runbookPublishesSupportContact,
  supportOwner,
  supportOwnerReady,
  runbookPublishesSupportOwner,
  reviewedAt,
  reviewDateReady: reviewFresh,
  reviewAgeDays,
  reviewFresh,
  reviewMaxAgeDays: supportReviewMaxAgeDays(),
  nextAction: blockers.length
    ? "Complete support contact, owner, fresh review date and runbook coverage before setting supportProcessReady."
    : "Support runbook and ownership evidence are ready for store/beta review.",
};

console.log(JSON.stringify(payload, null, 2));
if (!payload.ok && !args.allowBlocked) process.exit(1);

function validSupportContact(value) {
  const text = String(value || "").trim();
  if (!concreteText(text, { min: 6 })) return false;
  return validSupportEmail(text) || validSupportUrl(text);
}

function validSupportEmail(value) {
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
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function validSupportUrl(value) {
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

function validSupportOwner(value) {
  if (!concreteText(value, { min: 3 })) return false;
  return !/^(owner|release owner|support owner|support team|team|admin|administrator|support|reviewer)$/i.test(
    String(value || "").trim(),
  );
}

function runbookHasSection(section) {
  const heading = String(section || "")
    .replace(/^#+\s*/, "")
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+${heading}\\s*$`, "im").test(runbook);
}

function runbookPublishesContact(value) {
  return labelledRunbookValueMatches(value, [
    "support contact",
    "privacy and support contact",
    "support url",
    "support contact url",
  ]);
}

function runbookPublishesOwner(value) {
  return labelledRunbookValueMatches(value, [
    "support owner",
    "accountable owner",
    "release support owner",
  ]);
}

function labelledRunbookValueMatches(value, labels) {
  const needle = normaliseRunbookValue(value);
  if (!needle || !runbook) return false;
  return runbook
    .split("\n")
    .map((line) => line.trim())
    .some((line) => {
      const match = line.match(/^([^:]{3,80}):\s*(.+)$/);
      if (!match) return false;
      const label = normaliseRunbookValue(match[1]);
      if (!labels.some((allowed) => label === normaliseRunbookValue(allowed))) return false;
      return normaliseRunbookValue(match[2]).includes(needle);
    });
}

function normaliseRunbookValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^mailto:/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function concreteText(value, { min = 1 } = {}) {
  const text = String(value || "").trim();
  return text.length >= min && !/placeholder|todo|tbc|example\.com|temporary|your_|your-|checked|done/i.test(text);
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
  return Number(((todayUtc - timestamp) / 864e5).toFixed(1));
}

function supportReviewMaxAgeDays() {
  const value = Number(args["support-review-max-age-days"] || process.env.FUEL_PATH_SUPPORT_REVIEW_MAX_AGE_DAYS || 30);
  return Number.isFinite(value) && value > 0 && value <= 90 ? value : 30;
}

function textArg(name, envName, fallback = "") {
  if (args[name] !== undefined) return String(args[name] || "").trim();
  if (process.env[envName] !== undefined) return String(process.env[envName] || "").trim();
  return String(fallback || "").trim();
}

function slug(value) {
  return String(value || "")
    .replace(/^#+\s*/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--allow-blocked") {
      parsed.allowBlocked = true;
    } else if (value.startsWith("--")) {
      const key = value.slice(2);
      parsed[key] = values[index + 1] || "";
      index += 1;
    }
  }
  return parsed;
}
