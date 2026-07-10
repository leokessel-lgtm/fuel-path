const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.join(__dirname, "..", "..");

test("Vercel static build publishes the privacy policy and its styles", () => {
  const buildScript = fs.readFileSync(path.join(repoRoot, "scripts", "build-vercel-static.sh"), "utf8");

  assert.match(buildScript, /mkdir -p public\/web-demo/);
  assert.match(buildScript, /cp web-demo\/privacy\.html public\/web-demo\/privacy\.html/);
  assert.match(buildScript, /cp web-demo\/styles\.css public\/web-demo\/styles\.css/);
});

test("privacy publication docs keep URL, contact and store-listing gates explicit", () => {
  const checklist = fs.readFileSync(path.join(repoRoot, "PRIVACY-PUBLISHING-CHECKLIST.md"), "utf8");
  const policy = fs.readFileSync(path.join(repoRoot, "PRIVACY-POLICY.md"), "utf8");
  const storeReadiness = fs.readFileSync(
    path.join(repoRoot, "docs/02-build-release/STORE-READINESS-PLAN.md"),
    "utf8",
  );
  const privacyHtml = fs.readFileSync(path.join(repoRoot, "web-demo", "privacy.html"), "utf8");

  assert.match(checklist, /https:\/\/fuel-path\.vercel\.app\/web-demo\/privacy/);
  assert.match(checklist, /correct privacy contact method/i);
  assert.match(checklist, /Link the hosted policy from Apple App Store and Google Play listings/i);

  assert.match(policy, /correct privacy contact method/i);
  assert.match(policy, /https:\/\/fuel-path\.vercel\.app\/web-demo\/privacy/);
  assert.match(storeReadiness, /Privacy policy published and linked from store listings/i);
  assert.match(
    privacyHtml.replace(/\s+/g, " "),
    /correct privacy contact method/i,
  );
  assert.match(privacyHtml.replace(/\s+/g, " "), /store-listing links/i);
  assert.doesNotMatch(privacyHtml, /production URL/i);
});
