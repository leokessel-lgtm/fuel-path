import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const configPath = resolve(root, process.argv[2] || "scripts/doc-context-profiles.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const rows = Object.entries(config.profiles).map(([profile, files]) => measureProfile(profile, files));

console.log(`Estimated token method: ${config.estimationMethod}`);
console.log("");
console.log("| Profile | Files | Lines | Characters | Estimated tokens |");
console.log("| --- | ---: | ---: | ---: | ---: |");
for (const row of rows) {
  console.log(`| ${row.profile} | ${row.fileCount} | ${row.lines} | ${row.characters} | ${row.estimatedTokens} |`);
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
