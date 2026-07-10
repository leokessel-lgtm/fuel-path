import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const quarantineCheck = spawnSync(process.execPath, ["scripts/check-backend-test-quarantine.mjs"], { cwd: root, stdio: "inherit" });
if (quarantineCheck.error) throw quarantineCheck.error;
if (quarantineCheck.status !== 0) process.exit(quarantineCheck.status ?? 1);
const manifest = JSON.parse(readFileSync(resolve(root, "scripts/backend-test-manifest.json"), "utf8"));
const quarantined = manifest.quarantined || {};
const discovered = readdirSync(resolve(root, "tests/api"))
  .filter((file) => file.endsWith(".test.js"))
  .map((file) => `tests/api/${file}`)
  .sort();
const unknownQuarantines = Object.keys(quarantined).filter((file) => !discovered.includes(file));

if (unknownQuarantines.length) {
  console.error(`Backend test manifest names missing files: ${unknownQuarantines.join(", ")}`);
  process.exit(1);
}

for (const [file, reason] of Object.entries(quarantined)) {
  if (typeof reason !== "string" || reason.trim().length < 20) {
    console.error(`Backend test quarantine requires a concrete reason: ${file}`);
    process.exit(1);
  }
}

const stable = discovered.filter((file) => !quarantined[file]);
console.log(`Backend test inventory: ${discovered.length} files; ${stable.length} required; ${Object.keys(quarantined).length} quarantined.`);
for (const [file, reason] of Object.entries(quarantined)) console.log(`QUARANTINED ${file}: ${reason}`);

const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...stable], {
  cwd: root,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
