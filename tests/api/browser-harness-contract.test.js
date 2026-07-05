const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

test("browser Plan harnesses mock the combined score endpoint contract", () => {
  const harnesses = [
    "scripts/production-smoke-matrix-stress.mjs",
    "scripts/map-interaction-mocked-stress.mjs",
    "scripts/plan-route-browser-click-stress.mjs",
  ];

  for (const harness of harnesses) {
    const source = fs.readFileSync(path.join(ROOT, harness), "utf8");
    assert.match(source, /["']\*\*\/api\/score["']/);
    assert.match(source, /route:\s*routePayload\(/, `${harness} must return a route from the mocked /api/score endpoint`);
    assert.match(source, /score:\s*(scorePayload\(|currentScore)/, `${harness} must return score data from the mocked /api/score endpoint`);
  }
});
