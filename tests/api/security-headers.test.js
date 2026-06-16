const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("Vercel production config includes baseline browser security headers", () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "vercel.json"), "utf8"));
  const globalHeaderRule = config.headers.find((rule) => rule.source === "/(.*)");
  assert.ok(globalHeaderRule, "global header rule is required");

  const headers = Object.fromEntries(globalHeaderRule.headers.map((header) => [header.key.toLowerCase(), header.value]));

  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(headers["cross-origin-opener-policy"], /^same-origin$/);
  assert.match(headers["permissions-policy"], /camera=\(\)/);
  assert.match(headers["permissions-policy"], /microphone=\(\)/);
  assert.match(headers["permissions-policy"], /geolocation=\(self\)/);

  const csp = headers["content-security-policy"];
  assert.ok(csp, "content security policy is required");
  for (const directive of [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
  ]) {
    assert.match(csp, new RegExp(escapeRegExp(directive)), directive);
  }

  for (const endpoint of [
    "'self'",
    "https://*.tile.openstreetmap.org",
    "https://router.project-osrm.org",
    "https://nominatim.openstreetmap.org",
    "https://places.googleapis.com",
    "https://routes.googleapis.com",
    "https://api.mapbox.com",
    "https://autosuggest.search.hereapi.com",
    "https://api.geoapify.com",
    "https://exp.host",
  ]) {
    assert.match(csp, new RegExp(`connect-src[^;]*${escapeRegExp(endpoint)}`), endpoint);
  }
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
