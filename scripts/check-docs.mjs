import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const root = process.cwd();
const markdownFiles = trackedFiles("*.md");
const trackedDocumentFiles = trackedFiles("*.md", "*.json");
const failures = [];

const requiredDocuments = [
  "AGENTS.md",
  "README.md",
  "docs/README.md",
  "docs/catalog.md",
  "docs/route-recommendation-logic-rules.md",
  "docs/03-provider-data/README.md",
  "docs/03-provider-data/PROVIDER-ACCESS-READINESS.md",
];

const allowedRootMarkdown = new Set([
  "AGENTS.md",
  "BACKEND-PUSH-SCHEDULER-DESIGN.md",
  "BACKLOG-EVIDENCE-MATRIX.md",
  "DATA-RETENTION-RULES.md",
  "DESIGN-SYSTEM.md",
  "GOAL-1-EVIDENCE-GATE.md",
  "NATIONAL-TESTING-REGIME.md",
  "NATIVE-APP-DIRECTION.md",
  "ORACLE-ALWAYS-FREE-GNAF-HOSTING.md",
  "PERFORMANCE-GUARDRAILS.md",
  "PRIVACY-POLICY.md",
  "PRIVACY-PUBLISHING-CHECKLIST.md",
  "PROJECT-GOALS-ROADMAP.md",
  "README.md",
  "STORE-DATA-SAFETY.md",
  "STORE-READINESS-PLAN.md",
  "STORE-RELEASE-REVIEW-2026-06-20.md",
  "SUPPORT-RUNBOOK.md",
  "SYNTHETIC-VALIDATION-SESSIONS.md",
  "TODO.md",
  "VALIDATION-DEMO-PACK.md",
  "VALIDATION-PASS-2026-06-14.md",
  "VALIDATION-RECRUITMENT-PACK.md",
  "VALIDATION-SESSION-WORKBOOK.md",
  "VALIDATION-SYNTHESIS.md",
]);

for (const path of requiredDocuments) {
  if (!existsSync(resolve(root, path))) failures.push(`missing required document: ${path}`);
}

for (const path of markdownFiles) {
  if (!path.includes("/") && !allowedRootMarkdown.has(path)) {
    failures.push(`unapproved root Markdown document: ${path}`);
  }

  const text = readFileSync(resolve(root, path), "utf8");
  for (const link of markdownTargets(text)) {
    const localPath = localLinkPath(link);
    if (!localPath) continue;
    const resolvedPath = resolve(root, dirname(path), localPath);
    if (!existsSync(resolvedPath)) failures.push(`broken link: ${path} -> ${link}`);
  }
}

for (const path of trackedDocumentFiles) {
  if (path.startsWith("docs/templates/")) {
    const name = basename(path).toLowerCase();
    if (!name.includes("template") && !name.includes("sample")) {
      failures.push(`template folder contains an unlabelled artefact: ${path}`);
    }
  }

  if (path.startsWith("docs/03-provider-data/evidence/")) {
    const name = basename(path);
    if (/(?:API-NOTES|PROVIDER-DECISION|ADDRESS-LOOKUP|GNAF-NATIONAL-ADDRESS-INDEX|UNBLOCK-PLAN)/i.test(name)) {
      failures.push(`provider implementation or decision file is under evidence: ${path}`);
    }
  }
}

const providerIndexPath = resolve(root, "docs/03-provider-data/README.md");
if (existsSync(providerIndexPath)) {
  const providerIndex = readFileSync(providerIndexPath, "utf8");
  for (const state of ["request sent", "terms confirmed", "quality-ready", "beta-release-ready"]) {
    if (!providerIndex.includes(state)) failures.push(`provider index is missing readiness state: ${state}`);
  }
}

const stalePathFragments = [
  "../ADDRESS-LOOKUP-PROVIDERS.md",
  "../../../SA-FUEL-API-NOTES.md",
  "docs/provider-terms/",
  "../../provider-terms/",
  "](API-NSW-SUPPORT-NOTE.md)",
];

for (const path of trackedDocumentFiles) {
  const fullPath = resolve(root, path);
  let text = "";
  try {
    text = readFileSync(fullPath, "utf8");
  } catch {
    continue;
  }
  for (const fragment of stalePathFragments) {
    if (text.includes(fragment)) failures.push(`stale moved-path reference in ${path}: ${fragment}`);
  }
}

if (failures.length) {
  console.error(`Documentation check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Documentation check passed: ${markdownFiles.length} Markdown files, ${trackedDocumentFiles.length} tracked Markdown/JSON files.`,
);

function trackedFiles(...patterns) {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ...patterns], {
    cwd: root,
    encoding: "utf8",
  });
  return output.split("\0").filter(Boolean);
}

function markdownTargets(text) {
  const targets = [];
  const inlinePattern = /\[[^\]]*\]\(([^)]+)\)/g;
  const referencePattern = /^\[[^\]]+\]:\s*(\S+)/gm;
  for (const pattern of [inlinePattern, referencePattern]) {
    let match;
    while ((match = pattern.exec(text))) targets.push(match[1]);
  }
  return targets;
}

function localLinkPath(rawTarget) {
  let target = String(rawTarget || "").trim().replace(/^<|>$/g, "");
  target = target.split(/\s+["']/)[0];
  if (!target || /^(?:https?:|mailto:|tel:|data:|#)/i.test(target)) return "";
  target = target.split("#")[0].split("?")[0];
  if (!target) return "";
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}
