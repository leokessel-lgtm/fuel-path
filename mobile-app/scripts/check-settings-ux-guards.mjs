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
  vehicleFuelCard: read("src/components/VehicleFuelCard.tsx"),
  savedCommutesHook: read("src/hooks/useSavedCommutes.ts"),
  routeAlertsHook: read("src/hooks/useRouteAlerts.ts"),
  backendAlerts: read("src/services/backendAlerts.native.ts"),
  savedCommutesStore: read("src/services/savedCommutesStore.ts"),
  preferencesHook: read("src/hooks/useAppPreferences.ts"),
  preferencesStore: read("src/services/preferencesStore.ts"),
  recentLocationsStore: read("src/services/recentLocationsStore.ts"),
  types: read("src/types.ts"),
  nearbyScreenUtils: read("src/screens/NearbyScreen.utils.ts"),
  nearbyScreen: readScreenSource("src/screens/NearbyScreen.tsx", "src/screens/NearbyScreen.viewmodel.tsx"),
  planRouteSheet: read("src/components/PlanRouteSheet.tsx"),
  planScreen: readScreenSource("src/screens/PlanScreen.tsx", "src/screens/PlanScreen.viewmodel.tsx"),
  planScreenUtils: read("src/screens/PlanScreen.utils.ts"),
  settingsSections: read("src/components/settings/settingsSections.ts"),
  accountRoot: read("src/components/settings/AccountRootScreen.tsx"),
  accountDetail: read("src/components/settings/AccountDetailScreen.tsx"),
  settingsSectionHook: read("src/hooks/useSettingsSection.ts"),
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
    label: "neutral fields and secondary buttons use shared white surfaces",
    ok:
      files.theme.includes("field: {") &&
      files.theme.includes("secondaryAction: {") &&
      files.theme.includes("backgroundColor: colors.white") &&
      files.planEditor.includes("...surfaces.field") &&
      files.nearbySearch.includes("...surfaces.field") &&
      files.nearbySearch.includes("...surfaces.secondaryAction") &&
      files.currentLocationButton.includes("...surfaces.secondaryAction") &&
      files.savedPlaceEditor.includes("...surfaces.field") &&
      files.stationBrandsCard.includes("...surfaces.field") &&
      files.stationBrandsCard.includes("...surfaces.secondaryAction") &&
      files.vehicleFuelCard.includes("...surfaces.field") &&
      files.vehicleFuelCard.includes("...surfaces.secondaryAction") &&
      files.vehicleFuelCard.includes("...typography.fieldText") &&
      files.vehicleFuelCard.includes("...typography.sectionLabel") &&
      files.nearbyStationSheet.includes("...surfaces.secondaryAction"),
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
      files.savedRouteAlertsCard.includes("Local reminder") &&
      files.savedRouteAlertsCard.includes("localReminderEnabled") &&
      files.savedRouteAlertsCard.includes("Commute days") &&
      files.savedRouteAlertsCard.includes("Minimum saving") &&
      files.savedRouteAlertsCard.includes("Save a route from Plan to watch it for useful fuel alerts.") &&
      files.accountDetail.includes("onUpdateCommuteAlertSettings={onUpdateCommuteAlertSettings}") &&
      files.app.includes("onUpdateCommuteAlertSettings={updateCommuteAlertSettings}"),
  },
  {
    label: "Navigation app preference is saved and used before opening maps",
    ok:
      files.types.includes('export type NavigationAppPreference = "device_maps" | "ask" | "apple_maps" | "google_maps" | "waze";') &&
      files.types.includes("navigationApp: NavigationAppPreference;") &&
      files.preferencesStore.includes('navigationApp: "device_maps"') &&
      files.preferencesStore.includes("navigationAppPreferences.includes") &&
      files.preferencesHook.includes("const updateNavigationApp = useCallback") &&
      files.preferencesHook.includes("updateNavigationApp,") &&
      files.app.includes("onNavigationAppChange={updateNavigationApp}") &&
      files.accountDetail.includes("NavigationPreference") &&
      files.accountDetail.includes("onChange={onNavigationAppChange}") &&
      files.accountDetail.includes("Opens Apple Maps in the browser on Android.") &&
      !files.accountDetail.includes("platforms?: Array<typeof Platform.OS>;") &&
      !files.accountDetail.includes('platforms: ["ios"]') &&
      !files.accountDetail.includes("const options = navigationOptions.filter((option) => !option.platforms || option.platforms.includes(Platform.OS));") &&
      !files.settingsSections.includes('import { Platform } from "react-native";') &&
      files.settingsSections.includes('if (preferences.navigationApp === "apple_maps") return "Apple Maps";') &&
      files.accountDetail.includes("Ask every time") &&
      files.accountDetail.includes("Apple Maps") &&
      files.accountDetail.includes("Google Maps") &&
      files.accountDetail.includes("Waze") &&
      files.accountRoot.includes("navigationPreferenceSummary(preferences)") &&
      files.nearbyScreenUtils.includes("navigationApp !== \"ask\"") &&
      files.nearbyScreenUtils.includes("provider === navigationApp") &&
      files.nearbyScreenUtils.includes("function androidDeviceMapsIntent") &&
      files.nearbyScreenUtils.includes("androidIntent: androidDeviceMapsIntent(geoUrl)") &&
      files.nearbyScreenUtils.includes("androidIntent: androidGoogleMapsIntent(googleMapsUrl)") &&
      files.nearbyScreen.includes("preferences.navigationApp") &&
      files.planRouteSheet.includes("navigationApp: NavigationAppPreference") &&
      files.planScreen.includes("navigationApp={preferences.navigationApp}"),
  },
  {
    label: "new saved routes default to active vehicle and weekday route watches",
    ok:
      files.savedCommutesHook.includes("vehicleId") &&
      files.savedCommutesHook.includes("id: makeCommuteId(from, to, fuel, vehicleId)") &&
      files.savedCommutesHook.includes("function makeCommuteId(from: MapPoint, to: MapPoint, fuel: FuelCode, vehicleId?: string)") &&
      files.savedCommutesHook.includes("safeCommuteIdPart(vehicleId)") &&
      files.savedCommutesHook.includes("sameCommute(commute, { from, fuel, to, vehicleId })") &&
      files.savedCommutesHook.includes("function sameCommuteVehicle") &&
      files.savedCommutesHook.includes("sameCommuteVehicle(left.vehicleId, right.vehicleId)") &&
      files.planScreen.includes(
        "sameSavedCommuteRoute(commute, currentRouteEndpoints, preferences.fuel, preferences.activeVehicleId)",
      ) &&
      files.planScreenUtils.includes("vehicleId?: string") &&
      files.planScreenUtils.includes("sameSavedCommuteVehicle(commute.vehicleId, vehicleId)") &&
      files.planScreenUtils.includes("function sameSavedCommuteVehicle") &&
      files.savedCommutesHook.includes("defaultCommuteAlertDays") &&
      files.savedCommutesHook.includes("localReminderEnabled: false") &&
      files.app.includes("onSaveCommute={saveCommute}"),
  },
  {
    label: "native storage keeps recoverable saved routes, recent locations and saved places",
    ok:
      files.preferencesStore.includes("const lat = Number(point.lat);") &&
      files.preferencesStore.includes("const lon = Number(point.lon);") &&
      files.preferencesStore.includes("Number.isFinite(lat)") &&
      files.preferencesStore.includes("Number.isFinite(lon)") &&
      files.preferencesStore.includes("lat: Number(point.lat)") &&
      files.preferencesStore.includes("lon: Number(point.lon)") &&
      files.savedCommutesStore.includes("const lat = Number(point.lat);") &&
      files.savedCommutesStore.includes("const lon = Number(point.lon);") &&
      files.savedCommutesStore.includes("Number.isFinite(lat)") &&
      files.savedCommutesStore.includes("Number.isFinite(lon)") &&
      files.savedCommutesStore.includes("lat: Number(point.lat)") &&
      files.savedCommutesStore.includes("lon: Number(point.lon)") &&
      files.recentLocationsStore.includes("const lat = Number(point.lat);") &&
      files.recentLocationsStore.includes("const lon = Number(point.lon);") &&
      files.recentLocationsStore.includes("Number.isFinite(lat)") &&
      files.recentLocationsStore.includes("Number.isFinite(lon)") &&
      files.recentLocationsStore.includes("lat: Number(point.lat)") &&
      files.recentLocationsStore.includes("lon: Number(point.lon)"),
  },
  {
    label: "bottom navigation exposes valid tablist semantics",
    ok:
      files.app.includes("BackHandler") &&
      files.app.includes('if (Platform.OS === "web" || activeTab === "nearby") return undefined;') &&
      files.app.includes('BackHandler.addEventListener("hardwareBackPress", () => {') &&
      files.app.includes('setActiveTab("nearby");') &&
      files.settingsSectionHook.includes("BackHandler") &&
      files.settingsSectionHook.includes('BackHandler.addEventListener("hardwareBackPress", () => {') &&
      files.settingsSectionHook.includes("setActiveSection(null);") &&
      files.app.includes('<View role="banner" style={styles.header}>') &&
      files.app.includes('<View role="main" style={styles.content}>') &&
      files.app.includes('<View role="navigation">') &&
      files.app.includes('<View accessibilityRole="tablist" style={styles.tabBar}>') &&
      files.app.includes('accessibilityRole="tab"') &&
      files.app.includes("accessibilityState={{ selected }}") &&
      files.app.includes("aria-selected={selected}"),
  },
  {
    label: "labelled app chrome pressables expose button semantics",
    ok:
      files.app.includes('accessibilityLabel={canSwitchVehicles ? "Switch vehicle profile" : "View vehicle profile"}') &&
      files.app.includes('accessibilityState={{ expanded: vehicleSwitcherOpen }}') &&
      files.app.includes('"Fuel only"') &&
      files.app.includes("handleSelectHeaderVehicle") &&
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
    label: "account-free alert deletion and local-route loss copy stay user visible",
    ok:
      files.accountDetail.includes('accessibilityLabel="Delete my alert data"') &&
      files.accountDetail.includes("Your saved routes are stored on this device.") &&
      files.accountDetail.includes("will not automatically move to a new phone") &&
      files.backendAlerts.includes('action=delete-installation-data') &&
      files.routeAlertsHook.includes("deleteAllAlertData") &&
      files.routeAlertsHook.includes("subscribeToPushTokenChanges") &&
      files.routeAlertsHook.includes('backendSync.status !== "synced"') &&
      files.routeAlertsHook.includes("targetCommute.backendSyncedAt") &&
      files.routeAlertsHook.includes('state === "active"'),
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

function readScreenSource(defaultPath, viewModelPath) {
  const viewModelSource = path.join(root, viewModelPath);
  if (fs.existsSync(viewModelSource)) {
    return fs.readFileSync(viewModelSource, "utf8");
  }
  return read(defaultPath);
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
