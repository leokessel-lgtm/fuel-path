import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const files = {
  nearbyEv: path.join(root, "mobile-app/src/components/NearbyEvControls.tsx"),
  planRoute: path.join(root, "mobile-app/src/components/PlanRouteSheet.tsx"),
  planSummary: path.join(root, "mobile-app/src/components/PlanRouteSummaryCard.tsx"),
  nearbyStation: path.join(root, "mobile-app/src/components/NearbyStationSheet.tsx"),
  stationRow: path.join(root, "mobile-app/src/components/StationRow.tsx"),
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, filePath]) => [key, fs.readFileSync(filePath, "utf8")]),
);

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert(
  !/evConfidenceBadge>\s*Directory data/.test(source.nearbyEv),
  "Nearby EV cards must not show Directory data as a primary chip.",
);
assert(
  !/directory chargers/.test(source.nearbyEv),
  "Nearby EV panels must not expose directory as the primary charger count label.",
);
assert(
  /Check charger details in the network app before driving/.test(source.nearbyEv),
  "Prototype EV notices should collapse to compact user-action copy.",
);
assert(
  !/Directory data only\. Confirm access, tariff and live bay status/.test(source.nearbyEv),
  "Nearby EV panels must not keep verbose directory-only caution copy.",
);
assert(
  !/evWhyLine\(charger\)/.test(source.nearbyEv),
  "Nearby EV cards must not repeat connector, kW and distance in a second why line.",
);
assert(
  /Number\(distanceKm\) < 0\.05/.test(source.nearbyEv),
  "Nearby EV distance labels must collapse near-zero distances to a human label.",
);
assert(
  !/chargerProviderConfidence/.test(source.planRoute),
  "Plan EV charger rows must not show internal provider confidence as primary copy.",
);
assert(
  !/Check access, pricing and live bays in the network app/.test(source.planRoute),
  "Plan EV charger rows must not repeat live-bay caution copy in the primary card.",
);
assert(
  /fallbackNavigateButton/.test(source.planRoute) && /Navigate to \$\{charger\.name\}/.test(source.planRoute),
  "Plan EV charger rows must expose a compact navigation action.",
);
assert(
  /fallbackConnectorWarning/.test(source.planRoute),
  "Plan EV charger rows should warn when no connector preference is set.",
);
assert(
  !/>Plan trip</i.test(source.planSummary),
  "Collapsed Plan summary must not show the old PLAN TRIP eyebrow.",
);
assert(
  !/vehicleSummary/.test(source.planSummary),
  "Collapsed Plan summary must not repeat vehicle details above the map.",
);
assert(
  !/selectedTomorrow/.test(source.nearbyStation),
  "Selected Nearby station cards must not duplicate tomorrow price copy in the action column.",
);
assert(
  !/selectedMetaRest/.test(source.nearbyStation),
  "Selected Nearby station cards must not show timestamp/freshness copy in the primary body.",
);
assert(
  !/showAttentionCue/.test(source.stationRow),
  "Station rows must not add a separate visible attention chip beside the distance badge.",
);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: Object.keys(files) }, null, 2));
