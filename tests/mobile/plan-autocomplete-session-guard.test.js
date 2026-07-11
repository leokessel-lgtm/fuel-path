const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const repoRoot = join(__dirname, "../..");
const hookSource = readFileSync(
  join(repoRoot, "mobile-app/src/hooks/useRouteAddressSuggestions.ts"),
  "utf8",
);
const planScreenSource = readScreenSource(
  "mobile-app/src/screens/PlanScreen.tsx",
  "mobile-app/src/screens/PlanScreen.viewmodel.tsx",
);

test("Plan autocomplete keeps provider sessions field-scoped and commit-bounded", () => {
  assert.match(hookSource, /addressSessionTokensRef\s*=\s*useRef\(\{\s*from:\s*makeLocationSessionToken\(\),\s*to:\s*makeLocationSessionToken\(\),/s);
  assert.match(hookSource, /activeAddressFieldRef\s*=\s*useRef<RouteAddressField \| null>\(null\)/);
  assert.match(hookSource, /activeAddressFieldRef\.current !== field[\s\S]*resetAddressSessionToken\(field\)/);
  assert.match(hookSource, /searchLocations\([\s\S]*addressSessionTokensRef\.current\[field\][\s\S]*purpose:\s*"plan_autocomplete"/);

  assert.match(planScreenSource, /geocodeAddress\(from,\s*getAddressSessionToken\("from"\)/);
  assert.match(planScreenSource, /geocodeAddress\(to,\s*getAddressSessionToken\("to"\)/);
  assert.match(planScreenSource, /geocodeAddress\(point\.label,\s*getAddressSessionToken\(field\)/);
  assert.match(planScreenSource, /if \(!value\.trim\(\)\) resetAddressSessionToken\("from"\)/);
  assert.match(planScreenSource, /if \(!value\.trim\(\)\) resetAddressSessionToken\("to"\)/);
  assert.match(planScreenSource, /resetAddressSessionToken\("from"\);[\s\S]*resetAddressSessionToken\("to"\);/);
  assert.match(planScreenSource, /resetAddressSessionToken\(field\)/);
});

function readScreenSource(defaultPath, viewModelPath) {
  try {
    return readFileSync(join(repoRoot, viewModelPath), "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return readFileSync(join(repoRoot, defaultPath), "utf8");
  }
}
