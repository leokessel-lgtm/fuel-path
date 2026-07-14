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
const densitySource = readFileSync(
  join(repoRoot, "mobile-app/src/components/stationMapDensity.js"),
  "utf8",
);
const {
  maxVisibleEvMarkers,
  prioritiseSelectedChargers,
  spatiallySeparatedEvChargers,
} = require("../../mobile-app/src/components/stationMapDensity.js");

test("map marker state protects selected fuel and EV markers before marker limits", () => {
  for (const source of [nativeMapSource, webMapSource, nativePlatformMapSource]) {
    assert.match(source, /function prioritiseSelectedStations/);
    assert.match(source, /selectedStationCode/);
    assert.match(source, /selectedChargerId/);
  }

  assert.match(nativeMapSource, /prioritiseSelectedStations\([\s\S]*\)\.slice\(/);
  assert.match(nativeMapSource, /prioritiseSelectedChargers\([\s\S]*\)\.slice\(/);
  assert.match(webMapSource, /spatiallySeparatedEvChargers\(chargers/);
  assert.match(nativePlatformMapSource, /spatiallySeparatedEvChargers\(/);
  assert.match(densitySource, /overlaps && charger\.id !== selectedChargerId/);

  assert.match(nativeMapSource, /pinSelected:[\s\S]*zIndex:\s*70/);
  assert.match(nativeMapSource, /evPinSelected:[\s\S]*zIndex:\s*80/);
  assert.match(webMapSource, /zIndexOffset:\s*selected \? 640 : subdued \? 320 : 400/);
  assert.match(webMapSource, /zIndexOffset:\s*selected \? 760 : 620/);
  assert.match(nativePlatformMapSource, /zIndex=\{selected \? 760 : 560\}/);
});

test("EV marker density preserves the selected charger and enforces spacing and limits", () => {
  const chargers = Array.from({ length: 30 }, (_, index) => ({
    id: `charger-${index}`,
    lat: 0,
    lon: 0,
  }));
  const positions = new Map(chargers.map((charger, index) => [charger.id, { x: index * 10, y: 0 }]));
  positions.set("charger-29", { x: 5, y: 0 });

  assert.equal(maxVisibleEvMarkers, 18);
  assert.equal(prioritiseSelectedChargers(chargers, "charger-29")[0].id, "charger-29");

  const visible = spatiallySeparatedEvChargers(
    chargers,
    "charger-29",
    (charger) => positions.get(charger.id),
  );
  assert.equal(visible[0].id, "charger-29");
  assert.ok(visible.length <= maxVisibleEvMarkers);
  for (let index = 0; index < visible.length; index += 1) {
    for (let other = index + 1; other < visible.length; other += 1) {
      const first = positions.get(visible[index].id);
      const second = positions.get(visible[other].id);
      assert.ok(Math.hypot(first.x - second.x, first.y - second.y) >= 58);
    }
  }
});
