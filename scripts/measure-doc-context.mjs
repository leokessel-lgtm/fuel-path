import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const configPath = resolve(root, process.argv[2] || "scripts/doc-context-profiles.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const rows = Object.entries(config.profiles).map(([profile, files]) => measureProfile(profile, files));
const failures = [];

console.log(`Estimated token method: ${config.estimationMethod}`);
console.log("");
console.log("| Profile | Files | Lines | Characters | Estimated tokens | Ceiling |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
for (const row of rows) {
  const ceiling = Number(config.maxEstimatedTokens?.[row.profile]);
  console.log(`| ${row.profile} | ${row.fileCount} | ${row.lines} | ${row.characters} | ${row.estimatedTokens} | ${ceiling || "missing"} |`);
  if (!Number.isFinite(ceiling) || ceiling <= 0) failures.push(`${row.profile}: missing positive ceiling`);
  else if (row.estimatedTokens > ceiling) failures.push(`${row.profile}: ${row.estimatedTokens} > ${ceiling}`);
}

for (const profile of Object.keys(config.maxEstimatedTokens || {})) {
  if (!config.profiles[profile]) failures.push(`${profile}: ceiling has no profile`);
}

if (failures.length) {
  console.error(`Documentation context budget failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

function measureProfile(profile, files) {
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
