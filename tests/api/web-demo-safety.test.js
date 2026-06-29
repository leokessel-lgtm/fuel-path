const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

test("web demo first viewport keeps controlled-validation boundary visible", () => {
  const html = fs.readFileSync(path.join(ROOT, "web-demo", "index.html"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "web-demo", "styles.css"), "utf8");

  assert.match(html, /Internal validation demo/);
  assert.match(html, /Controlled demo only/);
  assert.match(
    html,
    /Public beta remains blocked until provider terms, iOS validation,\s*store\/privacy evidence and support readiness are proven\. Android\s*physical performance evidence is captured for the current preview\./,
  );
  assert.match(styles, /\.validation-boundary/);
  assert.match(html, /styles\.css\?v=20260621-stability-pins/);
  assert.match(html, /app\.js\?v=20260621-stability-pins/);
});

test("web demo notification controls stay preview-only until native and alert gates pass", () => {
  const html = fs.readFileSync(path.join(ROOT, "web-demo", "index.html"), "utf8");
  const script = fs.readFileSync(path.join(ROOT, "web-demo", "app.js"), "utf8");

  assert.match(html, /Saved-route alert preview, no push sent/);
  assert.match(html, /Cycle alerts parked until measured evidence exists/);
  assert.match(html, /Discount reminders parked for later/);
  assert.match(script, /Price alert preview noted/);
  assert.match(script, /no alert was scheduled or sent/);
  assert.doesNotMatch(html, /Saved commute cycle alerts/);
  assert.doesNotMatch(html, /Discount eligibility reminders/);
  assert.doesNotMatch(script, /Price alert set for/);
});

test("saved route switches invalidate stale planned route geometry", () => {
  const script = fs.readFileSync(path.join(ROOT, "web-demo", "app.js"), "utf8");
  const match = script.match(/function applySavedCommute\(routeId\) \{([\s\S]*?)\n\}/);

  assert.ok(match, "applySavedCommute should exist");
  assert.match(match[1], /state\.plannedRoute = null;/);
  assert.match(match[1], /state\.activeRouteKey = "";/);
  assert.match(match[1], /render\(\)\.then\(focusRouteResults\);/);
});

test("saved route suggestion clicks apply before blur closes the menu", () => {
  const script = fs.readFileSync(path.join(ROOT, "web-demo", "app.js"), "utf8");
  const match = script.match(/els\.savedRouteSuggestions\.addEventListener\("pointerdown", \(event\) => \{([\s\S]*?)\n    \}\);/);

  assert.ok(match, "saved-route suggestions should handle pointerdown before blur");
  assert.match(match[1], /event\.target\.closest\("\[data-saved-route\]"\)/);
  assert.match(match[1], /event\.preventDefault\(\);/);
  assert.match(match[1], /applySavedCommute\(button\.dataset\.savedRoute\);/);
});

test("web demo map price pins stay out of the keyboard path", () => {
  const script = fs.readFileSync(path.join(ROOT, "web-demo", "app.js"), "utf8");

  assert.match(script, /function makeMapMarkerDecorative\(marker, dataset = \{\}\)/);
  assert.match(script, /markerElement\.tabIndex = -1;/);
  assert.match(script, /markerElement\.setAttribute\("aria-hidden", "true"\);/);
  assert.match(script, /markerElement\.removeAttribute\("title"\);/);
  assert.match(script, /keyboard: false,/);
});

test("web demo map price pins keep brand marks visibly bounded", () => {
  const script = fs.readFileSync(path.join(ROOT, "web-demo", "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "web-demo", "styles.css"), "utf8");

  assert.match(script, /brandMarkHtml\(station, brandClass\)/);
  assert.match(script, /class="\$\{labelClass\}">/);
  assert.match(script, /style="display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;border-radius:inherit;"/);
  assert.match(styles, /\.price-pin \.brand-mark-mini\.pin-brand img/);
  assert.match(styles, /width: 100% !important;/);
  assert.match(styles, /height: 100% !important;/);
  assert.match(styles, /object-fit: contain;/);
  assert.match(styles, /\.price-pin \.brand-mark-mini\.pin-brand:not\(\.has-brand-icon\)/);
});
