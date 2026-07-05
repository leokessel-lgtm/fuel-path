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
  savedCommutesHook: read("src/hooks/useSavedCommutes.ts"),
  accountDetail: read("src/components/settings/AccountDetailScreen.tsx"),
  app: read("App.tsx"),
  packageJson: read("package.json"),
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
