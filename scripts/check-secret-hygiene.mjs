#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || DEFAULT_ROOT);

const secretPatterns = [
  {
    label: "live-looking Neon password",
    pattern: /\bnpg_[A-Za-z0-9]{12,}\b/g,
  },
  {
    label: "OpenAI API key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g,
  },
  {
    label: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  },
  {
    label: "private key block",
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g,
  },
  {
    label: "live-looking Postgres URL",
    pattern: /\bpostgres(?:ql)?:\/\/[^\s"'`<>]+/g,
    validate: (value) => !isAllowedPostgresPlaceholder(value),
  },
];

const findings = [];

for (const file of filesToScan()) {
  if (shouldSkipFile(file)) continue;
  const absolute = path.join(root, file);
  const text = fs.readFileSync(absolute, "utf8");
  for (const rule of secretPatterns) {
    for (const match of text.matchAll(rule.pattern)) {
      const value = match[0];
      if (rule.validate && !rule.validate(value)) continue;
      findings.push({
        file,
        line: lineNumberAt(text, match.index || 0),
        label: rule.label,
        preview: redact(value),
      });
    }
  }
}

if (findings.length) {
  for (const finding of findings) {
    console.error(
      `FAIL ${finding.file}:${finding.line}: ${finding.label} (${finding.preview})`,
    );
  }
  console.error("Secret hygiene check failed. Rotate exposed values and replace tracked files with placeholders.");
  process.exit(1);
}

console.log("OK tracked and untracked non-ignored files contain no live-looking database URLs, API keys or private key blocks.");

function gitCandidateFiles() {
  const output = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  return output.split("\0").filter(Boolean);
}

function filesToScan() {
  if (args.file.length) return args.file;
  return gitCandidateFiles();
}

function shouldSkipFile(file) {
  const normalised = file.split(path.sep).join("/");
  if (normalised.includes("/node_modules/")) return true;
  if (normalised.startsWith("tmp/") || normalised.startsWith("var/") || normalised.startsWith("data/")) return true;
  if (normalised.endsWith("package-lock.json")) return true;
  if (normalised.endsWith(".png") || normalised.endsWith(".jpg") || normalised.endsWith(".jpeg")) return true;
  if (normalised.endsWith(".zip") || normalised.endsWith(".sqlite") || normalised.endsWith(".apk")) return true;
  return false;
}

function isAllowedPostgresPlaceholder(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const text = value.toLowerCase();
  const host = url.hostname.toLowerCase();
  const username = decodeURIComponent(url.username || "").toLowerCase();
  const password = decodeURIComponent(url.password || "").toLowerCase();
  if (host === "127.0.0.1" || host === "localhost") return true;
  if (host.endsWith(".example.test") || host.endsWith(".example.com")) return true;
  if (host === "..." || text.includes("postgres://...")) return true;
  if (["example", "test", "placeholder", "password", "change-this-password-before-loading"].includes(password)) return true;
  if (username.includes("example") || username.includes("test")) return true;
  return false;
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function redact(value) {
  if (value.length <= 16) return "[redacted]";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function parseArgs(values) {
  const parsed = { file: [], root: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--root") {
      parsed.root = values[index + 1] || "";
      index += 1;
      continue;
    }
    if (value === "--file") {
      parsed.file.push(values[index + 1] || "");
      index += 1;
    }
  }
  parsed.file = parsed.file.filter(Boolean);
  return parsed;
}
