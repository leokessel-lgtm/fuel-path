import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = process.cwd();
const repoRoot = resolve(appRoot, "..");
const validationPath = resolve(appRoot, "NATIVE-VALIDATION.md");
const screenshotPath = resolve(repoRoot, "tmp/native-smoke/android-pixel-ev-route-result-2026-07-05.png");
const xmlPath = resolve(repoRoot, "tmp/native-smoke/android-pixel-ev-route-result-2026-07-05.xml");

const failures = [];

function requireFile(path, label) {
  if (!existsSync(path)) failures.push(`${label} missing: ${path}`);
}

function requireText(source, pattern, label) {
  if (!pattern.test(source)) failures.push(label);
}

requireFile(validationPath, "Native validation document");
requireFile(screenshotPath, "Android EV Plan route screenshot evidence");
requireFile(xmlPath, "Android EV Plan route accessibility dump");

const validation = existsSync(validationPath) ? readFileSync(validationPath, "utf8") : "";
const xml = existsSync(xmlPath) ? readFileSync(xmlPath, "utf8") : "";

requireText(validation, /Pixel 9 Pro/i, "Native validation must identify the physical Android device.");
requireText(validation, /EV was selectable from `PLAN WITH` as `EV charge`/i, "Native validation must cover EV in Plan mode.");
requireText(validation, /Sylvania NSW and Newcastle NSW suggestions appeared/i, "Native validation must cover Plan From/To suggestion behaviour.");
requireText(validation, /Route charger options/i, "Native validation must cover EV route charger results.");
requireText(validation, /10 options/i, "Native validation must record charger option count evidence.");
requireText(validation, /179 km route\. 400 km selected range/i, "Native validation must record route distance and selected EV range evidence.");

requireText(xml, /Sylvania/i, "Android XML evidence must show Sylvania route endpoint text.");
requireText(xml, /Newcastle/i, "Android XML evidence must show Newcastle route endpoint text.");
requireText(xml, /Route charger options/i, "Android XML evidence must show route charger options text.");

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checked: {
    validationPath,
    screenshotPath,
    xmlPath,
  },
  coverage: [
    "physical Android device named",
    "EV Plan selector visible",
    "Plan From/To suggestions evidenced",
    "EV route charger result evidenced",
    "charger count and route range evidenced",
  ],
}, null, 2));
