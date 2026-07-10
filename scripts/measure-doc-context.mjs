import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const configPath = resolve(root, process.argv[2] || "scripts/doc-context-profiles.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const baseRef = process.env.FUEL_PATH_BASE_REF || "origin/main";
const baseConfig = readBaseConfig(baseRef);
const exceptions = readExceptions();
const rows = Object.entries(config.profiles).map(([profile, files]) => measureProfile(profile, files));
const failures = [];
const minimumHeadroomPercent = Number(config.minimumHeadroomPercent);
const headroomProfiles = new Set(config.headroomProfiles || []);

console.log(`Estimated token method: ${config.estimationMethod}`);
console.log("");
console.log("| Profile | Files | Lines | Characters | Estimated tokens | Ceiling |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
for (const row of rows) {
  const ceiling = Number(config.maxEstimatedTokens?.[row.profile]);
  console.log(`| ${row.profile} | ${row.fileCount} | ${row.lines} | ${row.characters} | ${row.estimatedTokens} | ${ceiling || "missing"} |`);
  if (!Number.isFinite(ceiling) || ceiling <= 0) failures.push(`${row.profile}: missing positive ceiling`);
  else if (row.estimatedTokens > ceiling) failures.push(`${row.profile}: ${row.estimatedTokens} > ${ceiling}`);
  else if (headroomProfiles.has(row.profile)) {
    const headroomPercent = ((ceiling - row.estimatedTokens) / ceiling) * 100;
    if (!Number.isFinite(minimumHeadroomPercent) || minimumHeadroomPercent <= 0) {
      failures.push(`${row.profile}: missing positive minimum headroom percent`);
    } else if (headroomPercent < minimumHeadroomPercent) {
      failures.push(`${row.profile}: ${headroomPercent.toFixed(1)}% headroom < ${minimumHeadroomPercent}%`);
    }
  }
}

for (const profile of Object.keys(config.maxEstimatedTokens || {})) {
  if (!config.profiles[profile]) failures.push(`${profile}: ceiling has no profile`);
}

for (const profile of headroomProfiles) {
  if (!config.profiles[profile]) failures.push(`${profile}: headroom policy has no profile`);
}

for (const [profile, requiredFiles] of Object.entries(config.requiredProfileFiles || {})) {
  const files = new Set(config.profiles[profile] || []);
  for (const requiredFile of requiredFiles) {
    if (!files.has(requiredFile)) failures.push(`${profile}: required context missing: ${requiredFile}`);
  }
}

if (baseConfig) {
  for (const [profile, ceiling] of Object.entries(config.maxEstimatedTokens || {})) {
    const baseCeiling = Number(baseConfig.maxEstimatedTokens?.[profile]);
    if (Number.isFinite(baseCeiling) && Number(ceiling) > baseCeiling && !hasException("doc-context", profile, baseCeiling, Number(ceiling))) {
      failures.push(`${profile}: ceiling increased from base ${baseCeiling} to ${ceiling}`);
    }
  }
} else {
  console.log(`No documentation context baseline exists at ${baseRef}; current ceilings establish the initial baseline.`);
}

if (failures.length) {
  console.error(`Documentation context budget failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

function measureProfile(profile, files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error(`${profile}: profile must contain files`);
  if (new Set(files).size !== files.length) throw new Error(`${profile}: profile contains duplicate files`);
  const texts = files.map((file) => readFileSync(resolve(root, file), "utf8"));
  const characters = texts.reduce((sum, text) => sum + text.length, 0);
  const lines = texts.reduce((sum, text) => sum + lineCount(text), 0);
  return {
    profile,
    fileCount: files.length,
    lines,
    characters,
    estimatedTokens: Math.ceil(characters / 4),
  };
}

function lineCount(text) {
  if (!text) return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

function readBaseConfig(ref) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${ref}:scripts/doc-context-profiles.json`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }));
  } catch {
    return null;
  }
}

function readExceptions() {
  try {
    return JSON.parse(readFileSync(resolve(root, "scripts/quality-baseline-exceptions.json"), "utf8")).exceptions || [];
  } catch {
    return [];
  }
}

function hasException(scope, metric, from, to) {
  const today = new Date().toISOString().slice(0, 10);
  return exceptions.some((entry) => entry.scope === scope
    && entry.metric === metric
    && Number(entry.from) === from
    && Number(entry.to) === to
    && typeof entry.reason === "string" && entry.reason.trim().length >= 20
    && typeof entry.approvedBy === "string" && /^@[^\s]+$/.test(entry.approvedBy)
    && typeof entry.expires === "string" && entry.expires >= today);
}
