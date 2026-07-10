import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const baselinePath = path.join(root, "build-baselines", "web-bundle.json");
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const baseRef = process.env.FUEL_PATH_BASE_REF || "origin/main";
const baseBaseline = readBaseBaseline(baseRef);
const exceptions = readExceptions();
const files = listFiles(path.join(root, "dist"));
const metrics = {
  webDistTotalBytes: files.reduce((sum, file) => sum + file.size, 0),
  webLargestFileBytes: files.reduce((largest, file) => Math.max(largest, file.size), 0),
  webJsTotalBytes: files.filter((file) => file.path.endsWith(".js")).reduce((sum, file) => sum + file.size, 0),
};
const failures = [];

for (const [metric, actual] of Object.entries(metrics)) {
  const allowed = Number(baseline[metric]);
  const ok = Number.isFinite(allowed) && actual <= allowed;
  console.log(`${ok ? "OK" : "FAIL"} ${metric}: ${actual} / ${allowed}`);
  if (!ok) failures.push(metric);
  const baseAllowed = Number(baseBaseline?.[metric]);
  if (Number.isFinite(baseAllowed) && allowed > baseAllowed && !hasException("web-bundle", metric, baseAllowed, allowed)) {
    console.error(`FAIL ${metric} baseline increased from base ${baseAllowed} to ${allowed}`);
    failures.push(`${metric}_baseline_increase`);
  }
}

if (!baseBaseline) console.log(`No web bundle baseline exists at ${baseRef}; current values establish the initial baseline.`);

if (failures.length) {
  console.error(`Web bundle regression detected: ${failures.join(", ")}`);
  process.exit(1);
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target);
    if (!entry.isFile()) return [];
    return [{ path: target, size: fs.statSync(target).size }];
  });
}

function readBaseBaseline(ref) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${ref}:mobile-app/build-baselines/web-bundle.json`], {
      cwd: path.resolve(root, ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }));
  } catch {
    return null;
  }
}

function readExceptions() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(root, "../scripts/quality-baseline-exceptions.json"), "utf8")).exceptions || [];
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
