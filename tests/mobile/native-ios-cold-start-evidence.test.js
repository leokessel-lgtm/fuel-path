const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const script = readFileSync(
  path.resolve(__dirname, "../../mobile-app/scripts/native-ios-cold-start-smoke.mjs"),
  "utf8",
);

test("iOS cold-start evidence names remain collision-safe for parallel devices", () => {
  assert.match(script, /const evidenceStem = .*requestedDeviceSlug.*process\.pid/);
  assert.match(script, /const report = path\.join\(smokeDir, `\$\{evidenceStem\}\.md`\)/);
  assert.match(script, /path\.join\(smokeDir, `\$\{evidenceStem\}-run-\$\{run\}\.png`\)/);
});
