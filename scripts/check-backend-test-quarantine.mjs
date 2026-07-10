import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifestPath = "scripts/backend-test-manifest.json";
const current = JSON.parse(readFileSync(resolve(root, manifestPath), "utf8"));
const baseRef = process.env.FUEL_PATH_BASE_REF || "origin/main";
const base = readBaseManifest(baseRef);
const currentCount = Object.keys(current.quarantined || {}).length;

if (!base) {
  console.error(`Backend quarantine baseline is unavailable at ${baseRef}; refusing to establish an implicit baseline.`);
  process.exit(1);
}

const baseCount = Object.keys(base.quarantined || {}).length;
if (currentCount > baseCount) {
  console.error(`Backend test quarantine increased from ${baseCount} to ${currentCount}. Repair the test instead of expanding quarantine.`);
  process.exit(1);
}
console.log(`Backend test quarantine ratchet passed: ${currentCount} / ${baseCount}.`);

function readBaseManifest(ref) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${ref}:${manifestPath}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }));
  } catch {
    return null;
  }
}
