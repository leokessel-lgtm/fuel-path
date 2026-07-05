import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const files = {
  currentLocationButton: read("src/components/CurrentLocationFieldButton.tsx"),
  nearbySearch: read("src/components/NearbyLocationSearch.tsx"),
  planEditor: read("src/components/PlanRouteEditorCard.tsx"),
  savedPlaceEditor: read("src/components/SavedPlaceEditor.tsx"),
  savedPlacesCard: read("src/components/SavedPlacesCard.tsx"),
  savedRouteAlertsCard: read("src/components/SavedRouteAlertsCard.tsx"),
  stationBrandsCard: read("src/components/StationBrandsCard.tsx"),
  savedCommutesHook: read("src/hooks/useSavedCommutes.ts"),
  settingsSections: read("src/components/settings/settingsSections.ts"),
  accountDetail: read("src/components/settings/AccountDetailScreen.tsx"),
  app: read("App.tsx"),
  packageJson: read("package.json"),
  brandAssets: read("src/data/brandAssets.ts"),
  nearbyStationSheet: read("src/components/NearbyStationSheet.tsx"),
  theme: read("src/theme.ts"),
  vercelBuildScript: read("../scripts/build-vercel-static.sh"),
};

const checks = [
  {
    label: "current-location field button is the single shared icon treatment",
    ok:
      files.currentLocationButton.includes("export function CurrentLocationFieldButton") &&
      files.currentLocationButton.includes("export const currentLocationFieldInset = 52;") &&
      files.currentLocationButton.includes('accessibilityRole="button"') &&
      files.currentLocationButton.includes("height: 44") &&
      files.currentLocationButton.includes("width: 44") &&
      files.currentLocationButton.includes('position: "absolute"') &&
      files.currentLocationButton.includes("right: spacing.xs") &&
      !files.currentLocationButton.includes("<Text"),
  },
  {
    label: "Plan and Nearby use the shared current-location field button",
    ok:
      files.planEditor.includes("CurrentLocationFieldButton") &&
      files.planEditor.includes("currentLocationFieldInset") &&
      files.planEditor.includes('accessibilityLabel="Use current location as start"') &&
      files.planEditor.includes("style={[styles.input, styles.inputWithIcon]}") &&
      files.nearbySearch.includes("CurrentLocationFieldButton") &&
      files.nearbySearch.includes("currentLocationFieldInset") &&
      files.nearbySearch.includes('accessibilityLabel="Use current location"') &&
      files.nearbySearch.includes("style={[styles.locationInput, styles.locationInputWithIcon]}"),
  },
  {
    label: "Home and Work editor keeps current location inside the address field",
    ok:
      files.savedPlaceEditor.includes("CurrentLocationFieldButton") &&
      files.savedPlaceEditor.includes("currentLocationFieldInset") &&
      files.savedPlaceEditor.includes("paddingRight: currentLocationFieldInset") &&
      files.savedPlaceEditor.includes("lookupSpinner") &&
      files.savedPlaceEditor.includes('accessibilityLabel={`Use current location for ${label.toLowerCase()}`}') &&
      !files.savedPlaceEditor.includes("Current location</Text>") &&
      !files.savedPlaceEditor.includes('{locating ? "Locating" : "Current location"}'),
  },
  {
    label: "saved route rename and remove are wired through Settings",
    ok:
      files.savedCommutesHook.includes("const renameCommute = useCallback") &&
      files.savedCommutesHook.includes("name: safeName || commuteName(commute.from, commute.to)") &&
      files.savedCommutesHook.includes("updatedAt: new Date().toISOString()") &&
      files.savedPlacesCard.includes("onRenameCommute") &&
      files.savedPlacesCard.includes("onRemoveCommute") &&
      files.savedPlacesCard.includes("TextInput") &&
      files.savedPlacesCard.includes("nameChanged") &&
      files.savedPlacesCard.includes("<Text style={[styles.renameButtonText") &&
      files.accountDetail.includes("onRenameCommute={onRenameCommute}") &&
      files.accountDetail.includes("onRemoveCommute={onRemoveCommute}") &&
      files.app.includes("renameCommute") &&
      files.app.includes("onRenameCommute={renameCommute}"),
  },
  {
    label: "Stations and brands settings use searchable preferred-brand controls",
    ok:
      files.settingsSections.includes('if (section === "stations") return "Stations & brands";') &&
      files.settingsSections.includes("stationBrandSettingsSummary") &&
      files.stationBrandsCard.includes("Search station brands") &&
      files.stationBrandsCard.includes("Preferred only") &&
      files.stationBrandsCard.includes("All brands") &&
      files.stationBrandsCard.includes("Select common station brands") &&
      files.stationBrandsCard.includes("Clear preferred station brands") &&
      files.accountDetail.includes("<StationBrandsCard") &&
      files.accountDetail.includes("onSetMode={onSetStationBrandMode}") &&
      files.accountDetail.includes("onToggleBrand={onTogglePreferredStationBrand}") &&
      files.app.includes("onSetStationBrandMode={setStationBrandMode}") &&
      files.app.includes("onTogglePreferredStationBrand={togglePreferredStationBrand}"),
  },
  {
    label: "Stations and brands settings have icon coverage for every first-class brand",
    ok: stationBrandIconCoverage(files.brandAssets).missing.length === 0 &&
      stationBrandIconCoverage(files.brandAssets).generic.length === 0,
  },
  {
    label: "Notifications settings use route-watch wording and compact controls",
    ok:
      files.settingsSections.includes('if (section === "alerts") return "Notifications";') &&
      files.settingsSections.includes("alerts only when worth it") &&
      files.savedRouteAlertsCard.includes("Watch saved routes") &&
      files.savedRouteAlertsCard.includes("Only alert when worth it") &&
      files.savedRouteAlertsCard.includes("Route notification settings") &&
      files.savedRouteAlertsCard.includes("Commute days") &&
      files.savedRouteAlertsCard.includes("Minimum saving") &&
      files.savedRouteAlertsCard.includes("Save a route from Plan to watch it for useful fuel alerts.") &&
      files.accountDetail.includes("onUpdateCommuteAlertSettings={onUpdateCommuteAlertSettings}") &&
      files.app.includes("onUpdateCommuteAlertSettings={updateCommuteAlertSettings}"),
  },
  {
    label: "new saved routes default to active vehicle and weekday route watches",
    ok:
      files.savedCommutesHook.includes("vehicleId") &&
      files.savedCommutesHook.includes("defaultCommuteAlertDays") &&
      files.app.includes("onSaveCommute={saveCommute}"),
  },
  {
    label: "bottom navigation exposes valid tablist semantics",
    ok:
      files.app.includes('<View role="banner" style={styles.header}>') &&
      files.app.includes('<View role="main" style={styles.content}>') &&
      files.app.includes('<View role="navigation">') &&
      files.app.includes('<View accessibilityRole="tablist" style={styles.tabBar}>') &&
      files.app.includes('accessibilityRole="tab"') &&
      files.app.includes("accessibilityState={{ selected }}"),
  },
  {
    label: "labelled app chrome pressables expose button semantics",
    ok:
      files.app.includes('accessibilityLabel={hasNamedVehicle ? "View vehicle profile" : "View fuel profile"}') &&
      files.app.includes('accessibilityRole="button"') &&
      files.nearbyStationSheet.includes("accessibilityLabel={option.accessibilityLabel}") &&
      files.nearbyStationSheet.includes('accessibilityRole="button"') &&
      files.nearbyStationSheet.includes("accessibilityState={{ selected: selectedSort }}"),
  },
  {
    label: "Nearby sort buttons keep visible button affordance",
    ok:
      files.nearbyStationSheet.includes("borderColor: colors.line") &&
      files.nearbyStationSheet.includes("borderWidth: 1") &&
      files.nearbyStationSheet.includes("borderColor: colors.black") &&
      files.nearbyStationSheet.includes('fontWeight: "700"'),
  },
  {
    label: "muted and amber text tokens meet AA contrast on app panels",
    ok:
      files.theme.includes('muted: "#5f6c65"') &&
      files.theme.includes('amber: "#9a5b00"'),
  },
  {
    label: "web release freshness check gives stale tabs a quiet refresh path",
    ok:
      files.vercelBuildScript.includes("EXPO_PUBLIC_FUEL_PATH_BUILD_ID=\"$BUILD_ID\"") &&
      files.vercelBuildScript.includes("public/build-version.json") &&
      files.app.includes("const releaseBuildId = process.env.EXPO_PUBLIC_FUEL_PATH_BUILD_ID || \"\";") &&
      files.app.includes("fetch(`/build-version.json?ts=${Date.now()}`, { cache: \"no-store\" })") &&
      files.app.includes("document.addEventListener(\"visibilitychange\", handleVisible)") &&
      files.app.includes("window.addEventListener(\"focus\", checkLatestRelease)") &&
      files.app.includes("<Text style={styles.releaseBannerText}>New version ready</Text>") &&
      files.app.includes('accessibilityLabel="Refresh Fuel Path"'),
  },
  {
    label: "Settings UX guards run in the mobile test chain",
    ok:
      files.packageJson.includes('"test:settings-ux": "node scripts/check-settings-ux-guards.mjs"') &&
      files.packageJson.includes("npm run test:settings-ux"),
  },
];

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`Settings UX guard check failed: ${failed.map((check) => check.label).join(", ")}`);
  process.exit(1);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function stationBrandIconCoverage(source) {
  const listMatch = source.match(/export const stationBrandStyles: BrandStyle\[] = \[([\s\S]*?)\];/);
  if (!listMatch) return { missing: ["stationBrandStyles"] };
  const blocks = Array.from(listMatch[1].matchAll(/\{\n\s*label: "([^"]+)"[\s\S]*?\n\s*\}/g)).map((match) => ({
    label: match[1],
    source: match[0],
  }));
  return {
    missing: blocks
      .filter((block) => !block.source.includes("icon: require("))
      .map((block) => block.label),
    generic: blocks
      .filter((block) => block.label !== "Fuel retailer" && block.source.includes("generic-fuel.png"))
      .map((block) => block.label),
  };
}
