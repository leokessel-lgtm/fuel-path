import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const webMap = read("src/components/StationMap.web.tsx");
const nativeMap = read("src/components/StationMap.native.tsx");
const appShell = read("App.tsx");
const fuelPathLogo = read("src/components/FuelPathLogo.tsx");
const locationEvidenceChip = read("src/components/LocationEvidenceChip.tsx");
const decisionEvidencePanel = read("src/components/DecisionEvidencePanel.tsx");
const discountWalletCard = read("src/components/DiscountWalletCard.tsx");
const quickPlaceShortcuts = read("src/components/QuickPlaceShortcuts.tsx");
const routeAddressSuggestions = read("src/components/RouteAddressSuggestions.tsx");
const savedCommuteShortcuts = read("src/components/SavedCommuteShortcuts.tsx");
const planRouteSheet = read("src/components/PlanRouteSheet.tsx");
const planRouteEditorCard = read("src/components/PlanRouteEditorCard.tsx");
const policyModeCard = read("src/components/PolicyModeCard.tsx");
const nearbyLocationSearch = read("src/components/NearbyLocationSearch.tsx");
const nearbyStationSheet = read("src/components/NearbyStationSheet.tsx");
const savedPlaceEditor = read("src/components/SavedPlaceEditor.tsx");
const savedRouteAlertsCard = read("src/components/SavedRouteAlertsCard.tsx");
const weeklyReportCard = read("src/components/WeeklyReportCard.tsx");
const routeAddressSuggestionHook = read("src/hooks/useRouteAddressSuggestions.ts");
const theme = read("src/theme.ts");
const nearbyScreen = read("src/screens/NearbyScreen.tsx");
const planScreen = read("src/screens/PlanScreen.tsx");
const accountScreen = read("src/screens/AccountScreen.tsx");
const stationRow = read("src/components/StationRow.tsx");
const brandBadge = read("src/components/BrandBadge.tsx");
const discountPrograms = read("src/data/discountPrograms.ts");
const fuelPathApi = read("src/api/fuelPathApi.ts");
const types = read("src/types.ts");
const locationEvidence = read("src/utils/locationEvidence.ts");
const preferencesStore = read("src/services/preferencesStore.ts");
const recentLocationsStore = read("src/services/recentLocationsStore.ts");
const savedCommutesStore = read("src/services/savedCommutesStore.ts");
const backendAlerts = read("src/services/backendAlerts.ts");
const routeNotifications = read("src/services/routeNotifications.ts");
const pricing = read("src/utils/pricing.ts");
const decisionEvidence = read("src/utils/decisionEvidence.ts");
const packageJson = read("package.json");
const planFieldSmoke = read("scripts/smoke-plan-fields.mjs");
const androidMapSmoke = read("scripts/native-android-map-smoke.mjs");
const androidPreviewSmoke = read("scripts/native-android-preview-smoke.mjs");
const androidPerformanceSummary = read("scripts/native-android-performance-summary.mjs");
const androidMapsKeyFix = read("scripts/android-maps-key-fix-packet.mjs");

const checks = [
  {
    label: "web programmatic moves clear on moveend",
    ok: webMap.includes('map.once("moveend", finishProgrammaticMove);'),
  },
  {
    label: "web programmatic moves clear on zoomend",
    ok: webMap.includes('map.once("zoomend", finishProgrammaticMove);'),
  },
  {
    label: "web map-area search ignores programmatic movement",
    ok: webMap.includes("userMovedMapRef.current && !programmaticMoveRef.current"),
  },
  {
    label: "web explicit camera changes reset reported map-area centre",
    ok: webMap.includes('lastReportedUserCentreKeyRef.current = "";'),
  },
  {
    label: "native map-area search requires a real pan gesture",
    ok: nativeMap.includes("!programmaticMoveRef.current && userGestureStartedRef.current"),
  },
  {
    label: "native explicit camera changes clear stale pan gesture state",
    ok: nativeMap.includes("userGestureStartedRef.current = false;"),
  },
  {
    label: "nearby screen keeps map-area search wired",
    ok: nearbyScreen.includes("onMapSearchAreaChange={handleMapSearchAreaChange}"),
  },
  {
    label: "nearby screen keeps current location as a separate map pin",
    ok:
      nearbyScreen.includes("const [currentLocation, setCurrentLocation] = useState<MapPoint>();") &&
      nearbyScreen.includes("setCurrentLocation(nextCentre);") &&
      nearbyScreen.includes("userLocation={currentLocation}"),
  },
  {
    label: "web and native maps render a dedicated my-location pin",
    ok:
      webMap.includes("fuel-path-user-location-pin") &&
      nativeMap.includes("styles.userLocationPin") &&
      nativeMap.includes('title="My location"'),
  },
  {
    label: "web map station pins stay decorative while the station list owns semantics",
    ok:
      webMap.includes("keyboard: false") &&
      webMap.includes('alt: ""') &&
      webMap.includes('aria-hidden="true"') &&
      !webMap.includes('role="button" aria-label="${escapeHtml(accessibilityLabel)}"') &&
      !webMap.includes("title: accessibilityLabel"),
  },
  {
    label: "web station markers stay price-first and density limited",
    ok:
      webMap.includes("const maxPriceMarkers = 22;") &&
      webMap.includes("const maxExtraPriceMarkers = 28;") &&
      webMap.includes("const markerGridSize = 108;") &&
      webMap.includes("const minClusterStationCount = 4;") &&
      webMap.includes("fuel-path-marker-cluster") &&
      webMap.includes("lowest ${cluster.minPrice.toFixed(1)} c/L") &&
      webMap.includes('<span class="fuel-path-marker-price">') &&
      webMap.includes('<span class="fuel-path-marker-brand">') &&
      webMap.includes(".fuel-path-marker::after") &&
      webMap.includes("border-top: 8px solid ${colors.white};") &&
      webMap.includes("border-left: 6px solid transparent;") &&
      webMap.includes("bottom: -7px;") &&
      webMap.includes("overflow: visible;") &&
      webMap.includes("border-bottom-left-radius: 12px;") &&
      webMap.includes("min-height: 23px;") &&
      webMap.includes("flex: 0 0 23px;") &&
      webMap.includes("width: 100%;") &&
      webMap.includes("height: 20px;") &&
      webMap.includes("width: 36px;") &&
      webMap.includes(".fuel-path-marker-logo {") &&
      webMap.includes("flex-basis: 38px;") &&
      webMap.includes("min-width: 38px;") &&
      webMap.includes("max-width: 38px;") &&
      webMap.includes(".fuel-path-marker-initials {") &&
      webMap.includes("object-fit: contain;") &&
      webMap.includes(".fuel-path-marker.is-selected .fuel-path-marker-price") &&
      webMap.includes("background: ${colors.black};") &&
      webMap.includes("tooltipAnchor: [0, -58]") &&
      webMap.includes("marker.bindTooltip(item.station.name") &&
      webMap.includes('className: "fuel-path-marker-tooltip"') &&
      webMap.includes(".fuel-path-marker-tooltip {") &&
      !webMap.includes('`${item.station.name} - ${item.adjustedCpl.toFixed(1)} c/L`') &&
      webMap.includes("nearestStationsForCamera(stations, centre, 12)") &&
      webMap.includes("showCentreMarker ? 15 : 14") &&
      webMap.includes(".filter((items) => items.length >= minClusterStationCount)") &&
      !webMap.includes("transform: scale(1.12)") &&
      !webMap.includes(".fuel-path-marker-cluster::after"),
  },
  {
    label: "native station pins stay decorative while station rows own semantics",
    ok:
      nativeMap.includes("decorativeStationMarkerAccessibility") &&
      nativeMap.includes("accessibilityElementsHidden: true") &&
      nativeMap.includes('importantForAccessibility: "no-hide-descendants"') &&
      nativeMap.includes("{...decorativeStationMarkerAccessibility}") &&
      !nativeMap.includes("title={item.station.name}") &&
      !nativeMap.includes("description={`${item.adjustedCpl.toFixed(1)} c/L`}") &&
      stationRow.includes("stationRowAccessibilityLabel") &&
      stationRow.includes('accessibilityRole="button"') &&
      stationRow.includes("accessibilityState={{ selected }}") &&
      stationRow.includes("styles.priceTile") &&
      stationRow.includes("styles.fuelLabel") &&
      stationRow.includes("styles.titleRow") &&
      stationRow.includes("<BrandBadge station={item.station} size={28} />") &&
      stationRow.includes("styles.mapAction") &&
      stationRow.includes("styles.mapActionCircle") &&
      stationRow.includes("styles.mapActionIcon") &&
      stationRow.includes("styles.actionDistancePill") &&
      stationRow.includes("styles.actionDistanceText") &&
      stationRow.includes("{item.distanceKm.toFixed(1)} km") &&
      stationRow.includes(">↗<") &&
      !stationRow.includes("mapActionText") &&
      !stationRow.includes("styles.priceUnit") &&
      !stationRow.includes("styles.distanceText") &&
      stationRow.indexOf("styles.priceTile") < stationRow.indexOf("styles.titleRow") &&
      stationRow.indexOf("styles.titleRow") < stationRow.indexOf("styles.mapAction") &&
      stationRow.includes("stationEvidenceLine(item)") &&
      stationRow.includes("Possible lower price, not guaranteed"),
  },
  {
    label: "native station markers stay price-first and density limited",
    ok:
      nativeMap.includes("const maxPriceMarkers = 24;") &&
      nativeMap.includes("const markerGridSize = 108;") &&
      nativeMap.includes("styles.pinBrand") &&
      nativeMap.includes("styles.pinPointer") &&
      nativeMap.includes("borderTopColor: colors.white") &&
      nativeMap.includes("borderTopWidth: 8") &&
      nativeMap.includes('borderLeftColor: "transparent"') &&
      nativeMap.includes("width: 54") &&
      nativeMap.includes("height: 46") &&
      nativeMap.includes("minHeight: 24") &&
      nativeMap.includes("<BrandBadge station={item.station} size={22} />") &&
      brandBadge.includes('resizeMode="contain"') &&
      !nativeMap.includes("scale: 1.05") &&
      nativeMap.includes("backgroundColor: colors.greenDark") &&
      nativeMap.includes("pinSelected: {\n    borderColor: colors.black") &&
      nativeMap.includes("pinPriceSelected: {\n    backgroundColor: colors.black") &&
      nativeMap.includes("nearestStationsForCamera(stations, centre, 12)") &&
      nativeMap.indexOf("<Text style={[styles.pinPrice") <
        nativeMap.indexOf("<View style={styles.pinBrand}>") &&
      nativeMap.includes("pinPointerSelected"),
  },
  {
    label: "app shell uses the Fuel Path logo lockup",
    ok:
      appShell.includes("FuelPathLogo") &&
      appShell.includes("styles.brandLockup") &&
      fuelPathLogo.includes("colors.route") &&
      fuelPathLogo.includes("styles.pinCentre") &&
      fuelPathLogo.includes("styles.pinDot"),
  },
  {
    label: "app shell uses dark icon-first bottom navigation",
    ok:
      appShell.includes("function TabIcon") &&
      appShell.includes("backgroundColor: colors.black") &&
      appShell.includes("styles.tabIconShell") &&
      appShell.includes("styles.nearbyPin") &&
      !appShell.includes("styles.tabHint"),
  },
  {
    label: "typography keeps normal text lighter than standout text",
    ok:
      theme.includes('fontWeight: "400" as const') &&
      theme.includes('fontWeight: "600" as const') &&
      theme.includes('fontWeight: "700" as const') &&
      appShell.includes('fontWeight: "500"') &&
      appShell.includes('fontWeight: "700"') &&
      !appShell.includes('fontWeight: "900"'),
  },
  {
    label: "nearby collapsed sheet hides notice cards from map view",
    ok:
      nearbyScreen.includes("NearbyStationSheet") &&
      nearbyStationSheet.includes("sheetExpanded && stationNotice && stations.length"),
  },
  {
    label: "nearby map selection clears sort highlight and uses row-style selected card",
    ok:
      nearbyScreen.includes("const [sortMode, setSortMode] = useState<NearbySortMode | undefined>(defaultNearbySortMode);") &&
      nearbyScreen.includes("setSortMode(undefined);") &&
      nearbyStationSheet.includes("sortMode?: NearbySortMode;") &&
      nearbyStationSheet.includes("styles.selectedPriceTile") &&
      nearbyStationSheet.includes("styles.selectedFuelLabel") &&
      nearbyStationSheet.includes("styles.selectedTitleRow") &&
      nearbyStationSheet.includes("<BrandBadge station={selected.station} size={28} />") &&
      nearbyStationSheet.includes("styles.selectedActionColumn") &&
      nearbyStationSheet.includes("styles.distanceBadge") &&
      nearbyStationSheet.includes("styles.selectedCardShell") &&
      nearbyStationSheet.includes('alignSelf: "flex-end"') &&
      nearbyStationSheet.includes("stationEvidenceLine(selected)") &&
      !nearbyStationSheet.includes("selectedActions") &&
      !nearbyStationSheet.includes("selectedPumpPrice") &&
      !nearbyStationSheet.includes("paddingRight: 30"),
  },
  {
    label: "official price timestamps use age-aware unchanged copy",
    ok:
      decisionEvidence.includes("function priceUnchangedLine(value: string, now = new Date())") &&
      decisionEvidence.includes("Price unchanged since ${formatTimeOfDay(parsed)}") &&
      decisionEvidence.includes("Price unchanged for ${ageDays} ${ageDays === 1 ? \"day\" : \"days\"}") &&
      decisionEvidence.includes('return weeks === 1 ? "a week" : `${weeks} weeks`;') &&
      decisionEvidence.includes('return months === 1 ? "a month" : `${months} months`;') &&
      decisionEvidence.includes('return years === 1 ? "a year" : `${years} years`;') &&
      !decisionEvidence.includes("formatUpdatedAt"),
  },
  {
    label: "nearby expanded station list removes duplicate selected card and reaches higher",
    ok:
      nearbyStationSheet.includes("{selected && !sheetExpanded ? (") &&
      nearbyStationSheet.includes('height: "78%"') &&
      !nearbyStationSheet.includes("sheetExpanded={sheetExpanded}") &&
      !nearbyStationSheet.includes("selected,\n  sheetExpanded,"),
  },
  {
    label: "nearby grabber is an accessible recovery control",
    ok:
      nearbyStationSheet.includes("clampSheetDrag") &&
      nearbyStationSheet.includes("responderPageY") &&
      nearbyStationSheet.includes("webDragProps") &&
      nearbyStationSheet.includes("onMouseDown") &&
      nearbyStationSheet.includes("onTouchStart") &&
      nearbyStationSheet.includes("finishWebDrag") &&
      nearbyStationSheet.includes("suppressNextPressRef") &&
      nearbyStationSheet.includes("onStartShouldSetResponder={() => true}") &&
      nearbyStationSheet.includes("onResponderMove") &&
      nearbyStationSheet.includes("onResponderRelease") &&
      nearbyStationSheet.includes("sheetDismissDragPx") &&
      nearbyStationSheet.includes("dy > sheetDismissDragPx") &&
      nearbyStationSheet.includes("if (selected && !sheetExpanded) onCloseSelectedStation();") &&
      nearbyStationSheet.includes('accessibilityRole="button"') &&
      nearbyStationSheet.includes("hitSlop={10}") &&
      nearbyStationSheet.includes('accessibilityLabel={sheetExpanded ? "Collapse station list" : "Expand station list"}'),
  },
  {
    label: "plan sheet has a minimised map state",
    ok:
      planScreen.includes("routeSheetMinimised") &&
      planScreen.includes("PlanRouteSheet") &&
      planRouteSheet.includes("styles.sheetMinimised"),
  },
  {
    label: "plan keeps map visible while route sheet stays hidden until route starts",
    ok:
      planScreen.includes("const [routeStarted, setRouteStarted] = useState(false);") &&
      planScreen.includes("const defaultPlanCentre: MapPoint") &&
      planScreen.includes('label: "66B Easton Ave, Sylvania NSW 2224"') &&
      planScreen.includes("setRouteStarted(true);") &&
      planScreen.includes("setRouteStarted(false);") &&
      planScreen.includes("const showPlanningShortcuts = routeStarted;") &&
      planScreen.includes("<View style={styles.mapLayer}>") &&
      planScreen.includes("{routeStarted ? (") &&
      planScreen.includes("!routeStarted && styles.topControlsOnly"),
  },
  {
    label: "plan sheet exposes map and stops recovery controls",
    ok:
      planScreen.includes("onMinimise") &&
      planScreen.includes("onShowStops") &&
      planRouteSheet.includes('accessibilityLabel="Show more map"') &&
      planRouteSheet.includes("const routeSheetRestoreLabel = stationPanelOpen") &&
      planRouteSheet.includes("Show suggested fuel stops") &&
      planRouteSheet.includes("Show route panel"),
  },
  {
    label: "plan recommendation explains best value versus cheapest closest and safest",
    ok:
      planScreen.includes("routeDecisionAlternatives") &&
      planRouteSheet.includes("DecisionEvidencePanel") &&
      planScreen.includes("cheapestTradeOffExplanation") &&
      decisionEvidencePanel.includes("Decision trade-offs") &&
      decisionEvidencePanel.includes("decisionAlternativeLabel") &&
      decisionEvidencePanel.includes('decisionAlternative("Cheapest"') &&
      decisionEvidencePanel.includes('decisionAlternative("Closest"') &&
      decisionEvidencePanel.includes('decisionAlternative("Safest"') &&
      decisionEvidencePanel.includes("No range/open warning") &&
      decisionEvidencePanel.includes("tradeOffItemSelected") &&
      decisionEvidencePanel.includes("Cheapest also wins because") &&
      decisionEvidencePanel.includes("but nets") &&
      decisionEvidencePanel.includes("detour fuel"),
  },
  {
    label: "plan evidence exposes detour fuel and time cost",
    ok:
      types.includes("detourFuelLitres?: number") &&
      types.includes("timeCost?: number") &&
      types.includes("netAfterDetourAndTimeCost?: number") &&
      planScreen.includes("detourFuelLitres") &&
      decisionEvidencePanel.includes("decisionSummary?.economics") &&
      decisionEvidencePanel.includes('label="Fuel used"') &&
      decisionEvidencePanel.includes('label="Time cost"') &&
      decisionEvidencePanel.includes('label="After time"') &&
      decisionEvidencePanel.includes("detourFuel.toFixed(1)"),
  },
  {
    label: "plan uses lightweight saving and detour preferences in scoring",
    ok:
      types.includes("minSavingDollars: number") &&
      types.includes("maxDetourMinutes: number") &&
      preferencesStore.includes("minSavingDollars: 5") &&
      preferencesStore.includes("maxDetourMinutes: 8") &&
      fuelPathApi.includes("minSavingDollars") &&
      fuelPathApi.includes("maxDetourMinutes") &&
      planScreen.includes("preferences.minSavingDollars") &&
      planScreen.includes("preferences.maxDetourMinutes") &&
      backendAlerts.includes("commute.minSavingDollars ?? preferences.minSavingDollars") &&
      backendAlerts.includes("commute.maxDetourMinutes ?? preferences.maxDetourMinutes"),
  },
  {
    label: "plan route requests ignore stale success and error responses after edits",
    ok:
      planScreen.includes("const routeEditVersionRef = useRef(0);") &&
      planScreen.includes("const routeRequestIdRef = useRef(0);") &&
      planScreen.includes("const requestId = routeRequestIdRef.current + 1;") &&
      planScreen.includes("const editVersionAtStart = routeEditVersionRef.current;") &&
      planScreen.includes("routeRequestIdRef.current = requestId;") &&
      planScreen.includes("requestId !== routeRequestIdRef.current") &&
      planScreen.includes("editVersionAtStart !== routeEditVersionRef.current") &&
      planScreen.includes("routeEditVersionRef.current += 1;") &&
      planScreen.includes("setRouteEndpoints(undefined);") &&
      planScreen.includes("setRoutePoints([]);") &&
      planScreen.includes("setResult(null);"),
  },
  {
    label: "mobile saved commute route switch replans from selected commute points",
    ok:
      planScreen.includes("const applySavedCommute = (commute: SavedCommute) =>") &&
      planScreen.includes("markRouteEdited();") &&
      planScreen.includes("setFromPoint(commute.from);") &&
      planScreen.includes("setToPoint(commute.to);") &&
      planScreen.includes('clearAddressSuggestions("from");') &&
      planScreen.includes('clearAddressSuggestions("to");') &&
      planScreen.includes("overrideFromPoint: commute.from") &&
      planScreen.includes("overrideToPoint: commute.to"),
  },
  {
    label: "plan current-location errors stay visible before route starts",
    ok:
      planScreen.includes('routeError={!routeStarted ? error : ""}') &&
      planRouteEditorCard.includes("routeError: string;") &&
      planRouteEditorCard.includes('accessibilityRole="alert"') &&
      planRouteEditorCard.includes("styles.routeError"),
  },
  {
    label: "fleet-lite policy mode filters route scoring to approved brands",
    ok:
      types.includes("fuelPolicyEnabled: boolean") &&
      types.includes("approvedPolicyBrands: string[]") &&
      preferencesStore.includes('fuelPolicyEnabled: false') &&
      preferencesStore.includes('approvedPolicyBrands: ["Ampol", "BP", "Shell"]') &&
      accountScreen.includes("PolicyModeCard") &&
      policyModeCard.includes("Policy mode") &&
      policyModeCard.includes("Approved fuel stops") &&
      policyModeCard.includes("onToggleFuelPolicy") &&
      policyModeCard.includes("onTogglePolicyBrand") &&
      fuelPathApi.includes("approvedPolicyBrands") &&
      fuelPathApi.includes("brandFilter: policyBrands.length > 0") &&
      fuelPathApi.includes("brands: policyBrands") &&
      planScreen.includes("Policy mode active") &&
      decisionEvidencePanel.includes('label="Policy"') &&
      appShell.includes("toggleFuelPolicy") &&
      appShell.includes("togglePolicyBrand"),
  },
  {
    label: "fleet-lite weekly report stays driver-facing and outcome based",
    ok:
      decisionEvidence.includes("weeklyFleetLiteReportSummary") &&
      decisionEvidence.includes("send alert, watch only, skip alert, quiet today, range first") &&
      decisionEvidence.includes("activeRouteCount") &&
      decisionEvidence.includes("backendSyncedRouteCount") &&
      decisionEvidence.includes("localOnlyRouteCount") &&
      accountScreen.includes("WeeklyReportCard") &&
      weeklyReportCard.includes("Weekly report") &&
      weeklyReportCard.includes("Fleet-lite summary") &&
      weeklyReportCard.includes("No payroll, accounting or admin tools") &&
      weeklyReportCard.includes("WeeklyReportMetric") &&
      weeklyReportCard.includes("Policy brands:"),
  },
  {
    label: "saved route alerts expose per-route saving detour and tank rules",
    ok:
      types.includes("tankThresholdPercent: number") &&
      accountScreen.includes("SavedRouteAlertsCard") &&
      savedRouteAlertsCard.includes("RouteAlertRuleSelector") &&
      savedRouteAlertsCard.includes("ruleKey=\"minSavingDollars\"") &&
      savedRouteAlertsCard.includes("ruleKey=\"maxDetourMinutes\"") &&
      savedRouteAlertsCard.includes("ruleKey=\"tankThresholdPercent\"") &&
      appShell.includes("updateCommuteAlertRule") &&
      backendAlerts.includes("commute.minSavingDollars") &&
      backendAlerts.includes("commute.maxDetourMinutes") &&
      backendAlerts.includes("commute.tankThresholdPercent") &&
      decisionEvidence.includes("one alert per run"),
  },
  {
    label: "local route data retention caps match privacy policy",
    ok:
      recentLocationsStore.includes("export const MAX_RECENT_LOCATIONS = 8;") &&
      recentLocationsStore.includes("return compact.slice(0, MAX_RECENT_LOCATIONS);") &&
      recentLocationsStore.includes("JSON.stringify(normaliseRecentLocations(locations))") &&
      savedCommutesStore.includes("const MAX_SAVED_COMMUTES = 20;") &&
      savedCommutesStore.includes(".slice(0, MAX_SAVED_COMMUTES)") &&
      savedCommutesStore.includes("JSON.stringify(compactCommutes)") &&
      quickPlaceShortcuts.includes('accessibilityLabel="Clear recent route locations"') &&
      quickPlaceShortcuts.includes("onRemoveRecent") &&
      planScreen.includes("onRemoveRecentLocation") &&
      accountScreen.includes("onRemoveCommute"),
  },
  {
    label: "backend alert identity stays local generated and non-contact",
    ok:
      backendAlerts.includes('const ALERT_IDENTITY_KEY = "fuel-path:alert-identity:v1";') &&
      backendAlerts.includes("userId: `local_${randomId()}`") &&
      backendAlerts.includes("deviceId: `device_${randomId()}`") &&
      backendAlerts.includes("AsyncStorage.setItem(ALERT_IDENTITY_KEY, JSON.stringify(identity))") &&
      !backendAlerts.includes("vehicleRego") &&
      !backendAlerts.includes("privacyContact") &&
      !backendAlerts.includes("email"),
  },
  {
    label: "address lookup autocomplete errors stay out of the UI",
    ok:
      !fuelPathApi.includes("Address lookup is busy right now") &&
      fuelPathApi.includes("locationLookupErrorMessage") &&
      fuelPathApi.includes("We couldn't check that address right now. Add suburb or postcode, or try again shortly.") &&
      fuelPathApi.includes("We couldn't find that address. Try a fuller address, suburb or postcode.") &&
      routeAddressSuggestionHook.includes('setSuggestionsError("");') &&
      planScreen.includes("clearAddressSuggestionError();") &&
      nearbyScreen.includes('setLocationError("");'),
  },
  {
    label: "partial street address lookup gives quiet locality guidance",
    ok:
      planScreen.includes("PlanRouteEditorCard") &&
      planRouteEditorCard.includes("AddressSuggestions") &&
      routeAddressSuggestions.includes("addressLocalityHint") &&
      routeAddressSuggestions.includes("Add suburb or postcode to narrow the address.") &&
      routeAddressSuggestions.includes("Street found. Add suburb or postcode to choose the right area.") &&
      planRouteEditorCard.includes("query={from}") &&
      planRouteEditorCard.includes("query={to}"),
  },
  {
    label: "typed address route planning rejects weak automatic area matches",
    ok:
      planScreen.includes("routeInputPrecisionHint") &&
      routeAddressSuggestions.includes("hasAddressLocalityContext") &&
      routeAddressSuggestions.includes('replace(/\\b(nsw|act|qld|vic|wa|sa|tas|nt)\\b/gi, " ")') &&
      planScreen.includes("routePrecisionHint") &&
      routeAddressSuggestions.includes("Choose a start suggestion, or add suburb or postcode before planning.") &&
      routeAddressSuggestions.includes("Choose a destination suggestion, or add suburb or postcode before planning.") &&
      routeAddressSuggestions.includes("Choose a start suggestion to confirm this address.") &&
      routeAddressSuggestions.includes("Choose a destination suggestion to confirm this address.") &&
      planScreen.includes('routeInputPrecisionHint("start", fromLabel)') &&
      planScreen.includes('routeInputPrecisionHint("destination", toLabel)') &&
      planScreen.includes('routeInputPrecisionHint("start", from)') &&
      planScreen.includes('routeInputPrecisionHint("destination", to)') &&
      planScreen.includes("&& !routePrecisionHint") &&
      fuelPathApi.includes("addressLikeQuery(label)") &&
      fuelPathApi.includes("weakAutoRouteLocation(suggestions[0])") &&
      fuelPathApi.includes("Choose a suggestion to confirm this address, or add suburb or postcode.") &&
      fuelPathApi.includes('point.sourceLabel === "Needs confirmation"') &&
      fuelPathApi.includes('point.sourceLabel === "Street/area only"') &&
      fuelPathApi.includes('point.sourceLabel === "Approx. area"'),
  },
  {
    label: "plan field browser smoke covers rendered precision states",
    ok:
      packageJson.includes('"smoke:plan-fields": "node scripts/smoke-plan-fields.mjs"') &&
      planFieldSmoke.includes("blank plan form stays disabled") &&
      planFieldSmoke.includes("partial street input asks for suburb or postcode") &&
      planFieldSmoke.includes("state-only address context is not enough") &&
      planFieldSmoke.includes("locality-qualified typed address still needs suggestion confirmation") &&
      planFieldSmoke.includes("validation address rows are ranked above POI-like rows") &&
      planFieldSmoke.includes("validation rows show unconfirmed evidence") &&
      planFieldSmoke.includes("street fallback rows show street-only evidence") &&
      planFieldSmoke.includes("Street/area only") &&
      planFieldSmoke.includes("Not an exact address. Use only if this street or area is enough.") &&
      planFieldSmoke.includes("selecting confirmed From and To unlocks Plan route") &&
      planFieldSmoke.includes("selected broad capital pair can submit route") &&
      planFieldSmoke.includes("airport pair suggestions can submit route") &&
      planFieldSmoke.includes("editing after a planned route clears route results") &&
      planFieldSmoke.includes("Parramatta Childrens Court") &&
      planFieldSmoke.includes("Needs confirmation") &&
      planFieldSmoke.includes("Not an exact address match. Confirm this row before planning.") &&
      planFieldSmoke.includes("Choose a destination suggestion to confirm this address.") &&
      planFieldSmoke.includes("Plan field smoke could not reach") &&
      planFieldSmoke.includes("npm run web -- --port 8081") &&
      planFieldSmoke.includes("Does not prove native iOS/Android behaviour or production provider precision."),
  },
  {
    label: "location suggestions show honest confidence chips",
    ok:
      locationEvidence.includes("Exact address") &&
      locationEvidence.includes("Address match") &&
      locationEvidence.includes("Approx. area") &&
      locationEvidence.includes("External lookup") &&
      locationEvidence.includes("Lookup limited") &&
      locationEvidence.includes("Needs confirmation") &&
      locationEvidence.includes("Street/area only") &&
      locationEvidence.includes("Not an exact address. Use only if this street or area is enough.") &&
      locationEvidence.includes("Not an exact address match. Confirm this row before planning.") &&
      locationEvidenceChip.includes("LocationEvidenceChip") &&
      locationEvidenceChip.includes("styles.chipStreet") &&
      locationEvidenceChip.includes("styles.chipUnconfirmed") &&
      planRouteEditorCard.includes("selectedLocationEvidence") &&
      routeAddressSuggestions.includes("<LocationEvidenceChip point={point}") &&
      routeAddressSuggestions.includes("suggestionNeedsPrecisionDetail(point)") &&
      savedPlaceEditor.includes("<LocationEvidenceChip") &&
      savedPlaceEditor.includes("point={suggestion}") &&
      savedPlaceEditor.includes("suggestionNeedsPrecisionDetail(suggestion)") &&
      fuelPathApi.includes("rankLocationSuggestions") &&
      fuelPathApi.includes("addressSuggestionScore") &&
      fuelPathApi.includes('return "Needs confirmation";') &&
      fuelPathApi.includes('return "Street/area only";') &&
      fuelPathApi.includes('return "Approx. area";') &&
      !routeAddressSuggestions.includes("${point.sourceLabel} | ${place}") &&
      !nearbyLocationSearch.includes("${point.sourceLabel} | ${place}") &&
      !savedPlaceEditor.includes("${point.sourceLabel} | ${place}"),
  },
  {
    label: "nearby address search stays clean and pins selected places",
    ok:
      nearbyScreen.includes("const selectedPlaceActive = locationQuery.trim().length > 0 && locationQuery.trim() === centre.label;") &&
      nearbyScreen.includes("showCentreMarker={selectedPlaceActive}") &&
      nearbyLocationSearch.includes("styles.inputShell") &&
      nearbyLocationSearch.includes("styles.currentLocationButton") &&
      nearbyLocationSearch.includes("locationInputWithIcon") &&
      nearbyLocationSearch.includes("titleConsumesStreetNumber(parts)") &&
      nearbyLocationSearch.includes("isStreetNumberFragment") &&
      !nearbyLocationSearch.includes("LocationEvidenceChip") &&
      !nearbyLocationSearch.includes("lookupResultEvidence") &&
      !nearbyLocationSearch.includes("suggestionNeedsPrecisionDetail"),
  },
  {
    label: "discount redemption state is normalised before persistence",
    ok:
      preferencesStore.includes("normaliseDiscountRedemptions") &&
      preferencesStore.includes("candidate.status !== \"available\"") &&
      preferencesStore.includes("candidate.status !== \"redeemed_today\""),
  },
  {
    label: "redeemed discounts are excluded from displayed and synced prices",
    ok:
      pricing.includes("eligibleDiscountIds(preferences)") &&
      planScreen.includes("eligiblePreferenceDiscounts") &&
      backendAlerts.includes("eligibleDiscountIds(preferences)"),
  },
  {
    label: "account wallet separates discount selection from redemption state",
    ok:
      accountScreen.includes("DiscountWalletCard") &&
      discountWalletCard.includes("onToggleDiscountRedemption") &&
      discountWalletCard.includes("discountRedemptionLabel") &&
      discountWalletCard.includes("Used today"),
  },
  {
    label: "wallet separates pump confirmed and possible lower prices",
    ok:
      types.includes("possibleLowerCpl?: number") &&
      types.includes("possibleLowerDisclosure?: string") &&
      pricing.includes("bestPossibleDiscount") &&
      pricing.includes("if (preferences.selectedDiscounts.length === 0) return undefined;") &&
      pricing.includes("possible if configured, not guaranteed") &&
      pricing.includes("possible if unused, not guaranteed") &&
      pricing.includes("Possible lower price, not guaranteed.") &&
      stationRow.includes("Confirmed:") &&
      stationRow.includes("Possible, not guaranteed:") &&
      stationRow.includes("possible only") &&
      planRouteSheet.includes(">Possible only<") &&
      discountWalletCard.includes("pump price, confirmed wallet price") &&
      discountPrograms.includes("costco_member") &&
      discountPrograms.includes("seven_eleven_lock") &&
      discountPrograms.includes("rac_member"),
  },
  {
    label: "manual discount wallet stays scoped to starter programs",
    ok:
      discountPrograms.includes("everyday_rewards") &&
      discountPrograms.includes("flybuys") &&
      discountPrograms.includes("nrma_ampol") &&
      discountPrograms.includes("rac_member") &&
      discountPrograms.includes("costco_member") &&
      discountPrograms.includes("seven_eleven_lock") &&
      discountPrograms.includes("fleet_card") &&
      !discountPrograms.includes("linkt_rewards") &&
      !discountPrograms.toLowerCase().includes("oauth") &&
      !discountPrograms.toLowerCase().includes("cashback"),
  },
  {
    label: "Android Expo Go skips unsupported notifications module",
    ok:
      routeNotifications.includes("androidNotificationsUnavailableInExpoGo") &&
      routeNotifications.includes('Platform.OS === "android" && Constants.appOwnership === "expo"') &&
      routeNotifications.includes("Android Expo Go cannot run route notifications. Use a development or preview build.") &&
      routeNotifications.includes("Android Expo Go cannot schedule route notifications. Use a development or preview build.") &&
      routeNotifications.includes("remotePushUnavailableInExpoGo") &&
      routeNotifications.includes('Constants.appOwnership === "expo"') &&
      routeNotifications.includes("Backend push alerts need a development or preview build, not Expo Go.") &&
      routeNotifications.includes("Route alert permission is enabled on this validation build.") &&
      routeNotifications.includes("Validation push token ready for backend alert sync.") &&
      savedRouteAlertsCard.includes('? "Permission enabled"') &&
      !savedRouteAlertsCard.includes('? "Alerts enabled"') &&
      !routeNotifications.includes("Push token ready.") &&
      !routeNotifications.includes("Route alerts are enabled for this device.") &&
      routeNotifications.indexOf("androidNotificationsUnavailableInExpoGo()") <
        routeNotifications.indexOf('await import("expo-notifications")', routeNotifications.indexOf("configureRouteNotificationHandler")) &&
      routeNotifications.indexOf("androidNotificationsUnavailableInExpoGo()") <
        routeNotifications.indexOf('await import("expo-notifications")', routeNotifications.indexOf("getRouteNotificationPermission")) &&
      routeNotifications.indexOf("androidNotificationsUnavailableInExpoGo()") <
        routeNotifications.indexOf('await import("expo-notifications")', routeNotifications.indexOf("requestRouteNotificationPermission")) &&
      routeNotifications.indexOf("androidNotificationsUnavailableInExpoGo()") <
        routeNotifications.indexOf('await import("expo-notifications")', routeNotifications.indexOf("scheduleSavedCommuteAlert")) &&
      routeNotifications.indexOf("remotePushUnavailableInExpoGo()") <
        routeNotifications.indexOf('await import("expo-notifications")', routeNotifications.indexOf("getExpoRoutePushToken")),
  },
  {
    label: "native saved-route alert labels avoid delivery overclaim",
    ok:
      savedCommuteShortcuts.includes('"Watching route"') &&
      savedCommuteShortcuts.includes('"Not watching"') &&
      !planScreen.includes('"Alerts on"') &&
      !savedCommuteShortcuts.includes('"Alerts on"') &&
      savedRouteAlertsCard.includes('? "Watching"') &&
      decisionEvidence.includes("Route watches are on this device; delivery still needs native push and backend evidence before beta.") &&
      !decisionEvidence.includes("Alerts can send only when route value"),
  },
  {
    label: "Android map smoke captures native render and frame evidence",
    ok:
      packageJson.includes('"native:android-map-smoke": "node scripts/native-android-map-smoke.mjs"') &&
      androidMapSmoke.includes("Fuel_Path_Arm64_API_35") &&
      androidMapSmoke.includes("dumpsys\", \"gfxinfo\", \"host.exp.exponent\"") &&
      androidMapSmoke.includes("screencap") &&
      androidMapSmoke.includes("nearby-after-pan") &&
      androidMapSmoke.includes("Expo Go smoke proves Android render/navigation/pan only") &&
      androidMapSmoke.includes("Push-token delivery still needs a development or EAS preview build"),
  },
  {
    label: "Android preview APK smoke captures installed-build render, frame and key evidence",
    ok:
      packageJson.includes('"native:android-preview-smoke": "node scripts/native-android-preview-smoke.mjs"') &&
      packageJson.includes('"native:android-performance-smoke": "node scripts/native-android-preview-smoke.mjs --require-physical --map-settle-ms 10000"') &&
      androidPreviewSmoke.includes("com.fuelpath.app/.MainActivity") &&
      androidPreviewSmoke.includes("Physical Android device required for performance validation") &&
      androidPreviewSmoke.includes('"verify", "--print-certs"') &&
      androidPreviewSmoke.includes("GoogleCertificatesRslt") &&
      androidPreviewSmoke.includes("blankMapLikely") &&
      androidPreviewSmoke.includes("Google map tiles appear blank") &&
      androidPreviewSmoke.includes("Application credential header not valid") &&
      androidPreviewSmoke.includes("readDeviceDiagnostics") &&
      androidPreviewSmoke.includes("Android Preview APK Smoke"),
  },
  {
    label: "Android physical performance summary rejects emulator-only evidence",
    ok:
      packageJson.includes('"native:android-performance-summary": "node scripts/native-android-performance-summary.mjs"') &&
      androidPerformanceSummary.includes('report.device.type !== "physical"') &&
      androidPerformanceSummary.includes("Source report is missing physical-device metadata") &&
      androidPerformanceSummary.includes("Source report is not from a physical Android device") &&
      androidPerformanceSummary.includes("Frame jank is above claim threshold") &&
      androidPerformanceSummary.includes("Frame p95 is above claim threshold") &&
      androidPerformanceSummary.includes("Android Physical Performance Summary"),
  },
  {
    label: "native single-point map camera uses a bounded region instead of fit-to-one-point",
    ok:
      nativeMap.includes("cameraCoordinates.length === 1") &&
      nativeMap.includes("animateToRegion(regionForPoint(cameraCoordinates[0]), 260)") &&
      nativeMap.indexOf("cameraCoordinates.length === 1") < nativeMap.indexOf("fitToCoordinates"),
  },
  {
    label: "Android Maps key fix packet preserves exact package and fingerprint handoff",
    ok:
      packageJson.includes('"native:android-maps-key-fix": "node scripts/android-maps-key-fix-packet.mjs"') &&
      androidMapsKeyFix.includes("Maps SDK for Android") &&
      androidMapsKeyFix.includes("sha1Fingerprint") &&
      androidMapsKeyFix.includes("same embedded key") &&
      androidMapsKeyFix.includes("GoogleCertificatesRslt") &&
      androidMapsKeyFix.includes("developers.google.com/maps/documentation/android-sdk/get-api-key"),
  },
];

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`Map camera guard check failed: ${failed.map((check) => check.label).join(", ")}`);
  process.exit(1);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
