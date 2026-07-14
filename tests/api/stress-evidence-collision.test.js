const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

for (const scriptName of [
  "plan-route-browser-click-stress.mjs",
  "map-density-performance-stress.mjs",
]) {
  test(`${scriptName} keeps parallel evidence filenames collision-safe`, () => {
    const source = fs.readFileSync(path.join(ROOT, "scripts", scriptName), "utf8");
    assert.match(source, /const runId = .*process\.pid/);
  });
}
