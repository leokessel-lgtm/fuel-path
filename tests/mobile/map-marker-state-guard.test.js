const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const repoRoot = join(__dirname, "../..");
const nativeMapSource = readFileSync(
  join(repoRoot, "mobile-app/src/components/StationMap.tsx"),
  "utf8",
);
const webMapSource = readFileSync(
  join(repoRoot, "mobile-app/src/components/StationMap.web.tsx"),
  "utf8",
);
const nativePlatformMapSource = readFileSync(
  join(repoRoot, "mobile-app/src/components/StationMap.native.tsx"),
  "utf8",
);

test("map marker state protects selected fuel and EV markers before marker limits", () => {
  for (const source of [nativeMapSource, webMapSource, nativePlatformMapSource]) {
    assert.match(source, /function prioritiseSelectedStations/);
    assert.match(source, /function prioritiseSelectedChargers/);
    assert.match(source, /selectedStationCode/);
    assert.match(source, /selectedChargerId/);
  }

  assert.match(nativeMapSource, /prioritiseSelectedStations\([\s\S]*\)\.slice\(/);
  assert.match(nativeMapSource, /prioritiseSelectedChargers\([\s\S]*\)\.slice\(/);
  assert.match(webMapSource, /function visibleEvChargers\(/);
  assert.match(webMapSource, /overlaps && charger\.id !== selectedChargerId/);
  assert.match(nativePlatformMapSource, /function spatiallySeparatedChargers\(/);
  assert.match(nativePlatformMapSource, /overlaps && charger\.id !== selectedChargerId/);

  assert.match(nativeMapSource, /pinSelected:[\s\S]*zIndex:\s*70/);
  assert.match(nativeMapSource, /evPinSelected:[\s\S]*zIndex:\s*80/);
  assert.match(webMapSource, /zIndexOffset:\s*selected \? 640 : subdued \? 320 : 400/);
  assert.match(webMapSource, /zIndexOffset:\s*selected \? 760 : 620/);
  assert.match(nativePlatformMapSource, /zIndex=\{selected \? 760 : 560\}/);
});
