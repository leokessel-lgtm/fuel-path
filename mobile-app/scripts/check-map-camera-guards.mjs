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
const locationSuggestionDisplay = read("src/utils/locationSuggestionDisplay.ts");
const savedCommuteShortcuts = read("src/components/SavedCommuteShortcuts.tsx");
const planRouteSheet = read("src/components/PlanRouteSheet.tsx");
const planRouteEditorCard = read("src/components/PlanRouteEditorCard.tsx");
const nearbyLocationSearch = read("src/components/NearbyLocationSearch.tsx");
const nearbyStationSheet = read("src/components/NearbyStationSheet.tsx");
const nearbyCombinedPanel = read("src/components/NearbyCombinedPanel.tsx");
const nearbyEvControls = read("src/components/NearbyEvControls.tsx");
const measuredControlBoundary = read("src/hooks/useMeasuredControlBoundary.ts");
const planCameraInsets = read("src/hooks/usePlanCameraInsets.ts");
const savedPlaceEditor = read("src/components/SavedPlaceEditor.tsx");
const savedPlacesCard = read("src/components/SavedPlacesCard.tsx");
const savedRouteAlertsCard = read("src/components/SavedRouteAlertsCard.tsx");
const vehicleFuelCard = read("src/components/VehicleFuelCard.tsx");
const accountDetailScreen = read("src/components/settings/AccountDetailScreen.tsx");
const weeklyReportCard = read("src/components/WeeklyReportCard.tsx");
const routeAddressSuggestionHook = read("src/hooks/useRouteAddressSuggestions.ts");
const theme = read("src/theme.ts");
const nearbyScreen = read("src/screens/NearbyScreen.tsx");
const nearbyScreenUtils = read("src/screens/NearbyScreen.utils.ts");
const nearbyResults = read("src/hooks/useNearbyResults.ts");
const stationBrandFilterPill = read("src/components/StationBrandFilterPill.tsx");
const stationBrandFilterOverride = read("src/hooks/useStationBrandFilterOverride.ts");
const planScreen = read("src/screens/PlanScreen.tsx");
const planScreenUtils = read("src/screens/PlanScreen.utils.ts");
const accountScreen = read("src/screens/AccountScreen.tsx");
const stationRow = read("src/components/StationRow.tsx");
const brandBadge = read("src/components/BrandBadge.tsx");
const betaPrivacyCard = read("src/components/BetaPrivacyCard.tsx");
const discountPrograms = read("src/data/discountPrograms.ts");
const discountRegistry = read("src/data/discountRegistry.generated.json");
const fuelPathApi = read("src/api/fuelPathApi.ts");
const types = read("src/types.ts");
const locationEvidence = read("src/utils/locationEvidence.ts");
const routeCameraInsets = read("src/utils/routeCameraInsets.ts");
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
const routeScoring = read("../api/_routeScoring.js");

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
    label: "web map-area search requires user movement and ignores programmatic movement",
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
    label: "nearby map keeps cluster pills clear of top controls",
    ok:
      nearbyScreen.includes("const { expandedSheetTop, nearbyCameraInsets, onTopControlsLayout } = useMeasuredControlBoundary();") &&
      nearbyScreen.includes("onLayout={onTopControlsLayout}") &&
      measuredControlBoundary.includes("topControlsBottom + spacing.xl") &&
      measuredControlBoundary.includes("bottom: 330"),
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
    label: "web station markers keep price caps but represent viewport overflow as clusters",
    ok:
      webMap.includes("const maxPriceMarkers = 14;") &&
      webMap.includes("const markerGridSize = 132;") &&
      webMap.includes("fuel-path-marker-cluster") &&
      webMap.includes("lowest ${cluster.minPrice.toFixed(1)} c/L") &&
      webMap.includes("map.fitBounds(") &&
      webMap.includes("clusterFitsInteractiveMapArea(map, cluster, activeInsets)") &&
      webMap.includes("if (items.length === 1)") &&
      webMap.includes("priceMarkers.push(...singletonMarkers)") &&
      webMap.includes("const visibleStations = stations.filter((item) => bounds.contains([item.station.lat, item.station.lon]));") &&
      webMap.includes("for (const items of clusterGroups.values())") &&
      !webMap.includes(".filter((items) => items.length >= minClusterStationCount)") &&
      !webMap.includes(".slice(0, maxClusterMarkers)") &&
      webMap.includes("if (!routeEndpoints && userMovedMapRef.current && !programmaticMoveRef.current)") &&
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
      webMap.includes("const subdued = Boolean(routeEndpoints && selectedStationCode && !selected);") &&
      webMap.includes('subdued ? "is-subdued" : ""') &&
      webMap.includes(".fuel-path-marker.is-subdued") &&
      webMap.includes("opacity: 0.66;") &&
      webMap.includes("transform: scale(0.92);") &&
      webMap.includes("tooltipAnchor: [0, -58]") &&
      webMap.includes("marker.bindTooltip(item.station.name") &&
      webMap.includes('className: "fuel-path-marker-tooltip"') &&
      webMap.includes(".fuel-path-marker-tooltip {") &&
      webMap.includes("const routeStationCameraPoints = routeEndpoints") &&
      webMap.includes("...routeStationCameraPoints") &&
      webMap.includes("const fitCameraPoints = routeEndpoints ? [...fitPoints, ...routeStationCameraPoints] : cameraPoints") &&
      webMap.includes("map.panInside([selected.station.lat, selected.station.lon]") &&
      webMap.includes("map.panInside([item.station.lat, item.station.lon]") &&
      webMap.includes("map.panInside([selectedCharger.lat, selectedCharger.lon]") &&
      webMap.includes("map.panInside([charger.lat, charger.lon]") &&
      !webMap.includes('`${item.station.name} - ${item.adjustedCpl.toFixed(1)} c/L`') &&
      webMap.includes("const nearbyInitialCameraZoom = 12.5;") &&
      webMap.includes("const nearbyInitialMarkerRadiusKm = 4.2;") &&
      webMap.includes("map.setView([centre.lat, centre.lon], nearbyInitialCameraZoom") &&
      webMap.includes("nearbyCameraPointsForCentre(centre, nearbyInitialMarkerRadiusKm)") &&
      webMap.includes("transform: translateY(-4px);") &&
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
      !stationRow.includes("Possible lower price, not guaranteed"),
  },
  {
    label: "native station markers keep price caps but represent viewport overflow",
    ok:
      nativeMap.includes("const defaultMarkerDensity = {") &&
      nativeMap.includes("maxPriceMarkers: 8,") &&
      nativeMap.includes("maxDotMarkers: 18,") &&
      nativeMap.includes("markerGridSize: 240,") &&
      nativeMap.includes("compactMarkerGridSize: 128,") &&
      nativeMap.includes("const compactMarkerDensity = {") &&
      nativeMap.includes("maxPriceMarkers: 3,") &&
      nativeMap.includes("maxDotMarkers: 8,") &&
      nativeMap.includes("markerGridSize: 390,") &&
      nativeMap.includes("compactMarkerGridSize: 230,") &&
      nativeMap.includes("function nativeMarkerDensity(width: number)") &&
      nativeMap.includes("return width <= 430 ? compactMarkerDensity : defaultMarkerDensity;") &&
      nativeMap.includes("type ClusterMarker = {") &&
      nativeMap.includes("items: StationViewModel[];") &&
      nativeMap.includes("fitToCoordinates(") &&
      nativeMap.includes("if (items.length === 1)") &&
      nativeMap.includes("priceMarkers.push(...singletonMarkers)") &&
      nativeMap.includes("clusterGroups") &&
      nativeMap.includes("stationInRegion(item, region)") &&
      nativeMap.includes("clusterMarkerForItems") &&
      nativeMap.includes("clusterFitsInteractiveRegion(cluster, currentRegion, activeInsets)") &&
      nativeMap.includes("styles.clusterPin") &&
      nativeMap.includes("styles.clusterCount") &&
      nativeMap.includes("styles.pinBrand") &&
      nativeMap.includes("styles.pinPointer") &&
      nativeMap.includes("borderTopColor: colors.white") &&
      nativeMap.includes("borderTopWidth: 8") &&
      nativeMap.includes('borderLeftColor: "transparent"') &&
      nativeMap.includes("width: 54") &&
      nativeMap.includes("height: 46") &&
      nativeMap.includes("minHeight: 24") &&
      nativeMap.includes("<BrandBadge station={item.station} size={22} />") &&
      nativeMap.includes("const routeStationCameraPoints = stations.slice(0, routePriceMarkerLimit).map") &&
      nativeMap.includes("return [...visibleRoutePoints, ...routeStationCameraPoints]") &&
      brandBadge.includes('resizeMode="contain"') &&
      !nativeMap.includes("scale: 1.05") &&
      nativeMap.includes("const subdued = Boolean(routeEndpoints && selectedStationCode && !selected);") &&
      nativeMap.includes("subdued && styles.pinSubdued") &&
      nativeMap.includes("pinSubdued: {") &&
      nativeMap.includes("opacity: 0.68") &&
      nativeMap.includes("transform: [{ scale: 0.94 }]") &&
      nativeMap.includes("backgroundColor: colors.greenDark") &&
      nativeMap.includes("pinSelected: {\n    borderColor: colors.black") &&
      nativeMap.includes("pinPriceSelected: {\n    backgroundColor: colors.black") &&
      nativeMap.includes("const nearbyInitialRegionDelta = 0.035;") &&
      nativeMap.includes("const nearbyInitialMarkerRadiusKm = 4.2;") &&
      nativeMap.includes("regionForPoint(centre, nearbyInitialRegionDelta)") &&
      nativeMap.includes("nearbyCameraPointsForCentre(centre, nearbyInitialMarkerRadiusKm)") &&
      nativeMap.indexOf("<Text style={[styles.pinPrice") <
        nativeMap.indexOf("<View style={styles.pinBrand}>") &&
      nativeMap.includes("pinPointerSelected"),
  },
  {
    label: "nearby cluster pill only drills into the map",
    ok:
      webMap.includes("map.fitBounds(") &&
      nativeMap.includes("fitToCoordinates(") &&
      !webMap.includes("onSelectCluster") &&
      !nativeMap.includes("onSelectCluster") &&
      !nearbyScreen.includes("useNearbyClusterSelection") &&
      !nearbyScreen.includes("onSelectCluster={handleMapClusterSelect}") &&
      !nearbyScreen.includes("handleMapClusterSelect") &&
      !nearbyScreen.includes("selectedCluster") &&
      !nearbyScreen.includes("NearbyClusterContextCard"),
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
    label: "app shell caps fixed chrome text scaling for accessibility",
    ok:
      appShell.includes("const chromeTextScale = 1.2;") &&
      appShell.includes("<Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={styles.brand}>Fuel Path</Text>") &&
      appShell.includes("<Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={styles.subhead}>Live fuel decisions</Text>") &&
      appShell.includes("<Text maxFontSizeMultiplier={chromeTextScale} style={styles.vehicleIconText}>{vehicleInitials}</Text>") &&
      appShell.includes("<Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={styles.vehiclePrimary}>") &&
      appShell.includes("<Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={styles.vehicleSecondary}>") &&
      appShell.includes("<Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{tab.label}</Text>"),
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
    label: "nearby station sheet removes non-actionable notice cards",
    ok:
      nearbyScreen.includes("NearbyStationSheet") &&
      !nearbyStationSheet.includes("Check price freshness") &&
      !nearbyStationSheet.includes("stationNotice && stations.length") &&
      !nearbyStationSheet.includes("styles.noticeCard") &&
      !nearbyStationSheet.includes("noticeText"),
  },
  {
    label: "nearby station sheet shows map escape only when the list is exposed",
    ok:
      nearbyStationSheet.includes("const requestMap = () => {") &&
      nearbyStationSheet.includes('requestSnap("browse");') &&
      nearbyStationSheet.includes("isFull ? (") &&
      nearbyStationSheet.includes('accessibilityLabel="Show map"') &&
      nearbyStationSheet.includes("styles.headerActions") &&
      nearbyStationSheet.includes("<Text style={styles.mapButtonText}>Map</Text>") &&
      !nearbyStationSheet.includes("Dismiss station list and show map"),
  },
  {
    label: "fresh degraded provider warnings do not masquerade as stale cache",
    ok:
      nearbyResults.includes('if (context.cacheMode !== "stale") return false;') &&
      nearbyResults.includes("return Number.isFinite(age) && age >= 30 * 60;") &&
      !nearbyResults.includes("context.degraded === true") &&
      !nearbyResults.includes("Price feed is degraded or stale."),
  },
  {
    label: "nearby map and dismissed list states clear sort highlight",
    ok:
      nearbyScreen.includes("const [sortMode, setSortMode] = useState<NearbySortMode | undefined>(undefined);") &&
      nearbyScreen.includes("const setNearbySheetSnap = (snap: NearbySheetSnap) => {") &&
      nearbyScreen.includes('if (snap !== "full") setSortMode(undefined);') &&
      nearbyScreen.includes('const setSheetExpanded = (expanded: boolean) => setNearbySheetSnap(expanded ? "full" : "browse");') &&
      nearbyScreen.includes('setNearbySheetSnap("full");') &&
      countOccurrences(nearbyScreen, "onSnapChange={setNearbySheetSnap}") >= 3 &&
      nearbyScreen.includes("setSortMode(undefined);") &&
      nearbyStationSheet.includes("sortMode?: NearbySortMode;") &&
      nearbyStationSheet.includes("styles.selectedPriceTile") &&
      nearbyStationSheet.includes("styles.selectedFuelLabel") &&
      nearbyStationSheet.includes("styles.selectedTitleRow") &&
      nearbyStationSheet.includes("<BrandBadge station={selected.station} size={28} />") &&
      nearbyStationSheet.includes("styles.selectedActionColumn") &&
      nearbyStationSheet.includes("styles.distanceBadge") &&
      nearbyStationSheet.includes('accessibilityLabel="Close selected station"') &&
      nearbyStationSheet.includes("<Text style={styles.mapButtonText}>Close</Text>") &&
      nearbyStationSheet.includes("styles.selectedCardShell") &&
      !nearbyStationSheet.includes("styles.closeButton") &&
      !nearbyStationSheet.includes("closeButtonText") &&
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
    label: "nearby expanded station list removes duplicate selected card and grows upward",
    ok:
      measuredControlBoundary.includes("export function useMeasuredControlBoundary()") &&
      measuredControlBoundary.includes("topControlsBottom + spacing.lg") &&
      nearbyScreen.includes("expandedSheetTop={expandedSheetTop}") &&
      nearbyStationSheet.includes("{ top: expandedSheetTop }") &&
      nearbyCombinedPanel.includes("{ top: expandedSheetTop }") &&
      nearbyEvControls.includes("{ top: expandedSheetTop }") &&
      nearbyStationSheet.includes("{selected && !sheetExpanded ? (") &&
      nearbyStationSheet.includes("sheetExpanded: {") &&
      nearbyStationSheet.includes("bottom: 8") &&
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
    label: "plan route map uses measured chrome insets",
    ok:
      planCameraInsets.includes("export function usePlanCameraInsets") &&
      planCameraInsets.includes("setTopControlsBottom(Math.ceil(y + height + spacing.sm));") &&
      planCameraInsets.includes("setRouteSheetHeight(Math.ceil(event.nativeEvent.layout.height + spacing.lg));") &&
      routeCameraInsets.includes("topControlsBottom = 0") &&
      routeCameraInsets.includes("routeSheetHeight = 0") &&
      planScreen.includes("usePlanCameraInsets({") &&
      planScreen.includes("onLayout={onTopControlsLayout}") &&
      planScreen.includes("onLayout={onRouteSheetLayout}"),
  },
  {
    label: "plan route line uses contrast casing and selected stop treatment",
    ok:
      theme.includes('routeCasing: "rgba(17, 20, 18, 0.82)"') &&
      webMap.includes('className: "fuel-path-route-line-casing"') &&
      webMap.includes("color: mapSkin.routeCasing") &&
      webMap.includes("weight: 10") &&
      nativeMap.includes("strokeColor={mapSkin.routeCasing}") &&
      nativeMap.includes("strokeWidth={10}") &&
      webMap.includes("fuel-path-marker.is-selected") &&
      nativeMap.includes("styles.pinSelected") &&
      !webMap.includes("fuel-path-marker-stop") &&
      !webMap.includes(">VIA<") &&
      !nativeMap.includes("routeStopBadge") &&
      !nativeMap.includes(">VIA<"),
  },
  {
    label: "plan route maps show broad route price coverage",
    ok:
      webMap.includes("const routeMaxPriceMarkers = 18;") &&
      webMap.includes("markerStations.slice(0, routeMaxPriceMarkers)") &&
      nativeMap.includes("const routeMaxPriceMarkers = 18;") &&
      nativeMap.includes("const compactRouteMaxPriceMarkers = 14;") &&
      nativeMap.includes("nativeRoutePriceMarkerLimit(width)") &&
      planScreen.includes("const candidates = useMemo(() => routeRecommendations.slice(0, 10), [routeRecommendations]);") &&
      planScreen.includes("routeMapStations(uniqueStations([...routeRecommendations, ...contextStations]), selectedCode)") &&
      planScreenUtils.includes("export function routeMapStations") &&
      planScreenUtils.includes("Array.from({ length: 12 }") &&
      planScreenUtils.includes("routeMarkerDisplayOrder"),
  },
  {
    label: "native Plan route keeps enough geometry to follow roads",
    ok:
      fuelPathApi.includes("function compactPoints(points: MapPoint[], maxPoints = 1200)") &&
      nativeMap.includes("sampleRoutePoints(routePoints, 1200)") &&
      !nativeMap.includes("sampleRoutePoints(routePoints, 180)"),
  },
  {
    label: "native map avoids startup-crashing mapPadding prop",
    ok:
      !nativeMap.includes("mapPadding={activeInsets}") &&
      nativeMap.includes("edgePadding: activeInsets"),
  },
  {
    label: "plan navigation arrow carries route waypoint to final destination",
    ok:
      planRouteSheet.includes("openRouteDirectionsViaStop") &&
      planRouteSheet.includes("openPlanStationDirections(best, routeEndpoints)") &&
      planRouteSheet.includes("openPlanStationDirections(selected, routeEndpoints)") &&
      planRouteSheet.includes("Navigate via ${best.station.name} to ${routeEndpoints.to.label}") &&
      planScreen.includes("routeEndpoints={routeData.endpoints}") &&
      nearbyScreenUtils.includes('waypoints: stopValue') &&
      nearbyScreenUtils.includes('destination: destinationValue'),
  },
  {
    label: "plan returns to recommended stop after alternative detail",
    ok:
      planScreen.includes("if (best) setSelectedCode(best.station.stationCode);") &&
      planRouteSheet.includes('accessibilityLabel="Show recommended stop"') &&
      planRouteSheet.includes("<Text style={styles.textButtonLabel}>Recommended</Text>") &&
      !planRouteSheet.includes("<Text style={styles.textButtonLabel}>Stops</Text>"),
  },
  {
    label: "plan keeps map visible while route sheet stays hidden until route starts",
    ok:
      planScreen.includes("const [routeStarted, setRouteStarted] = useState(false);") &&
      planScreen.includes("const defaultPlanCentre: MapPoint") &&
      planScreen.includes('label: "Perth CBD WA 6000"') &&
      planScreen.includes("showCentreMarker={Boolean(fromPoint)}") &&
      planScreen.includes("setRouteStarted(true);") &&
      planScreen.includes("setRouteStarted(false);") &&
      planScreen.includes("const showPlanningShortcuts = routeStarted;") &&
      planScreen.includes("cameraInsets: routeCameraInsets") &&
      routeCameraInsets.includes("const routeHorizontalInset = 26;") &&
      routeCameraInsets.includes("const routeMapGap = 12;") &&
      routeCameraInsets.includes("const routeStationMarkerHeight = 64;") &&
      routeCameraInsets.includes("const routeResultsSheetInset = 302;") &&
      routeCameraInsets.includes("routeSummaryOverlayHeight + routeStationMarkerHeight + routeMapGap") &&
      planScreen.includes("<View style={styles.mapLayer}>") &&
      planScreen.includes("{routeStarted ? (") &&
      planScreen.includes("!routeStarted && styles.topControlsOnly"),
  },
  {
    label: "plan sheet exposes map and recommended-stop recovery controls",
    ok:
      planScreen.includes("onMinimise") &&
      planScreen.includes("onShowStops") &&
      planRouteSheet.includes('accessibilityLabel="Show more map"') &&
      planRouteSheet.includes("const routeSheetRestoreLabel = stationPanelOpen") &&
      planRouteSheet.includes("Show recommended stop") &&
      planRouteSheet.includes("Show route panel"),
  },
  {
    label: "plan recommendation keeps the route result simple",
    ok:
      planRouteSheet.includes("DecisionEvidencePanel") &&
      planRouteSheet.includes("BrandBadge") &&
      planRouteSheet.includes("recommendationPriceTile") &&
      planRouteSheet.includes("recommendationStationName") &&
      planRouteSheet.includes("recommendationRouteValue") &&
      !decisionEvidencePanel.includes("Decision trade-offs") &&
      !planScreen.includes("routeDecisionAlternatives") &&
      !planScreen.includes("cheapestTradeOffExplanation"),
  },
  {
    label: "plan evidence shows four compact route decision metrics",
    ok:
      types.includes("decisionSummary?: RouteDecisionSummary;") &&
      decisionEvidencePanel.includes("const economics = decisionSummary?.economics;") &&
      decisionEvidencePanel.includes('label="Pump"') &&
      decisionEvidencePanel.includes('label="Your price"') &&
      decisionEvidencePanel.includes('label="Best price by"') &&
      decisionEvidencePanel.includes("routeDetourEvidenceMetricLabel(candidate)") &&
      decisionEvidencePanel.includes('label="Pump price"') &&
      decisionEvidencePanel.includes("routeComparisonCpl") &&
      decisionEvidencePanel.includes("savingCpl.toFixed(1)} c/L") &&
      !decisionEvidencePanel.includes('label="Fuel used"') &&
      !decisionEvidencePanel.includes('label="Time cost"') &&
      !decisionEvidencePanel.includes('label="After time"'),
  },
  {
    label: "plan uses internal smart detour scoring without user decision controls",
    ok:
      routeScoring.includes("ASSUMED_ROUTE_FILL_LITRES = 40") &&
      routeScoring.includes("SMART_MAX_DETOUR_MINUTES = 30") &&
      routeScoring.includes("smartDetourLimitMinutesForSaving") &&
      routeScoring.includes("savingsDetourLabel") &&
      routeScoring.includes("Small savings detour") &&
      routeScoring.includes("Strong savings detour") &&
      !fuelPathApi.includes("minSavingDollars,") &&
      !fuelPathApi.includes("maxDetourMinutes,") &&
      !planScreen.includes("preferences.minSavingDollars") &&
      !planScreen.includes("preferences.maxDetourMinutes") &&
      !accountScreen.includes("DecisionRuleCard"),
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
      planScreen.includes("setRouteData(emptyRoute);") &&
      planScreen.includes("setRouteData((current) => ({ ...current, points: [] }))") &&
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
    label: "settings keep vehicle profiles lightweight and account-level places separate",
    ok:
      types.includes("export type VehicleProfile = {") &&
      types.includes("activeVehicleId: string;") &&
      types.includes("vehicles: VehicleProfile[];") &&
      preferencesStore.includes("const vehicles = normaliseVehicleProfiles(preferences.vehicles, legacyVehicle);") &&
      preferencesStore.includes("fuelPolicyEnabled: false") &&
      preferencesStore.includes("activeVehicleId: activeVehicle.id") &&
      vehicleFuelCard.includes("const maxVehicleProfiles = 5;") &&
      vehicleFuelCard.includes("preferences.vehicles.map") &&
      vehicleFuelCard.includes("onSelectVehicle(vehicle.id)") &&
      vehicleFuelCard.includes("Five vehicles keeps switching quick") &&
      accountDetailScreen.includes("<VehicleFuelCard") &&
      accountDetailScreen.includes("<SavedPlacesCard") &&
      savedPlacesCard.includes("Favourite routes") &&
      savedPlacesCard.includes("onRenameCommute") &&
      savedPlacesCard.includes("onSaveNamedPlace(\"home\", commute.from)") &&
      savedPlacesCard.includes("onSaveNamedPlace(\"work\", commute.to)") &&
      !accountScreen.includes("PolicyModeCard") &&
      !appShell.includes("toggleFuelPolicy") &&
      !appShell.includes("togglePolicyBrand"),
  },
  {
    label: "legacy weekly report stays unmounted from streamlined Settings",
    ok:
      weeklyReportCard.includes("Weekly report") &&
      weeklyReportCard.includes("No payroll, accounting or admin tools") &&
      !accountScreen.includes("WeeklyReportCard") &&
      !accountDetailScreen.includes("WeeklyReportCard"),
  },
  {
    label: "saved route alerts expose compact route watch controls",
    ok:
      accountDetailScreen.includes("SavedRouteAlertsCard") &&
      savedRouteAlertsCard.includes("Route notification settings") &&
      savedRouteAlertsCard.includes("Commute days") &&
      savedRouteAlertsCard.includes("Minimum saving") &&
      savedRouteAlertsCard.includes("Vehicle") &&
      !savedRouteAlertsCard.includes("RouteAlertRuleSelector") &&
      !savedRouteAlertsCard.includes("ruleKey=\"tankThresholdPercent\"") &&
      appShell.includes("onUpdateCommuteAlertSettings") &&
      decisionEvidence.includes("Only alerts when the saving clears your rule"),
  },
  {
    label: "station brand preferences filter Nearby and Plan without reviving policy controls",
    ok:
      preferencesStore.includes("stationBrandMode") &&
      preferencesStore.includes("preferredStationBrands") &&
      stationBrandFilterPill.includes("Show all station brands once") &&
      stationBrandFilterOverride.includes("preferredStationBrandSummary") &&
      nearbyResults.includes("activePreferredStationBrands") &&
      nearbyResults.includes("filterStationsByPreferredBrands") &&
      planScreen.includes("stationBrands: preferredStationBrands") &&
      planScreenUtils.includes("Filtered to") &&
      fuelPathApi.includes("brandFilter: selectedBrands.length > 0") &&
      !appShell.includes("toggleFuelPolicy") &&
      !appShell.includes("togglePolicyBrand"),
  },
  {
    label: "plan recommendation follow-up keeps save before watch",
    ok:
      planRouteSheet.includes("Save this commute") &&
      planRouteSheet.includes("Watch this route") &&
      planRouteSheet.includes("Watching this route") &&
      planRouteSheet.includes("currentRouteSaved") &&
      planRouteSheet.includes("watchRouteEnabled") &&
      planScreen.includes("currentSavedCommute") &&
      planScreen.includes("onToggleCommuteAlert(currentSavedCommute.id)") &&
      appShell.includes("onToggleCommuteAlert={toggleCommuteAlert}"),
  },
  {
    label: "support settings copy excludes sensitive route data collection claims",
    ok:
      accountDetailScreen.includes("Privacy & support") &&
      accountDetailScreen.includes("Data used for better route decisions") &&
      accountDetailScreen.includes("aggregate product signals like saved routes, route watches and navigation opens") &&
      !accountDetailScreen.includes("route geometry") &&
      !accountDetailScreen.includes("push tokens"),
  },
  {
    label: "EV fallback confidence chips avoid live availability claims",
    ok:
      planRouteSheet.includes("Route charger options") &&
      planRouteSheet.includes("Use Nearby EV charging or your network app before driving.") &&
      planRouteSheet.includes("Set your EV connectors in Settings for better matching.") &&
      planRouteSheet.includes('return "Here";') &&
      !planRouteSheet.includes("Live chargers available now") &&
      !planRouteSheet.includes("Best charging stop for your route") &&
      !planRouteSheet.includes("Guaranteed available charger"),
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
      accountDetailScreen.includes("onRemoveCommute"),
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
      planScreen.includes("!routePrecisionHint") &&
      fuelPathApi.includes("addressLikeQuery(label)") &&
      fuelPathApi.includes("weakAutoRouteLocation(suggestions[0])") &&
      fuelPathApi.includes("Choose a suggestion to confirm this address, or add suburb or postcode.") &&
      fuelPathApi.includes('point.sourceLabel === "Needs confirmation"') &&
      fuelPathApi.includes('point.sourceLabel === "Street/road"') &&
      fuelPathApi.includes('point.sourceLabel === "Suburb/area"'),
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
      planFieldSmoke.includes("validation rows keep unconfirmed evidence hidden") &&
      planFieldSmoke.includes("street fallback rows keep street-only evidence hidden") &&
      planFieldSmoke.includes('assertHiddenText("Street/road")') &&
      planFieldSmoke.includes('assertHiddenText("Not an exact address. Use only if this street or area is enough.")') &&
      planFieldSmoke.includes("selecting confirmed From and To unlocks Plan route") &&
      planFieldSmoke.includes("selected broad capital pair can submit route") &&
      planFieldSmoke.includes("airport pair suggestions can submit route") &&
      planFieldSmoke.includes("editing after a planned route clears route results") &&
      planFieldSmoke.includes("Parramatta Childrens Court") &&
      planFieldSmoke.includes('assertHiddenText("Needs confirmation")') &&
      planFieldSmoke.includes('assertHiddenText("Not an exact address match. Confirm this row before planning.")') &&
      planFieldSmoke.includes("Choose a destination suggestion to confirm this address.") &&
      planFieldSmoke.includes("Plan field smoke could not reach") &&
      planFieldSmoke.includes("npm run web -- --port 8081") &&
      planFieldSmoke.includes("Does not prove native iOS/Android behaviour or production provider precision."),
  },
  {
    label: "location evidence stays available while route suggestions stay clean",
    ok:
      locationEvidence.includes("Exact address") &&
      locationEvidence.includes("Near address match") &&
      locationEvidence.includes("Suburb/area") &&
      locationEvidence.includes("External lookup") &&
      locationEvidence.includes("Lookup limited") &&
      locationEvidence.includes("Needs confirmation") &&
      locationEvidence.includes("Street/road") &&
      locationEvidence.includes("Place/landmark") &&
      locationEvidence.includes("Fuel station") &&
      locationEvidence.includes("Not an exact address. Use only if this street or area is enough.") &&
      locationEvidence.includes("Not an exact address match. Confirm this row before planning.") &&
      locationEvidenceChip.includes("LocationEvidenceChip") &&
      locationEvidenceChip.includes("styles.chipStreet") &&
      locationEvidenceChip.includes("styles.chipUnconfirmed") &&
      !planRouteEditorCard.includes("LocationEvidenceChip") &&
      !planRouteEditorCard.includes("selectedLocationEvidence") &&
      !routeAddressSuggestions.includes("LocationEvidenceChip") &&
      !routeAddressSuggestions.includes("suggestionNeedsPrecisionDetail") &&
      locationSuggestionDisplay.includes("titleConsumesStreetNumber(parts)") &&
      locationSuggestionDisplay.includes("isStreetNumberFragment") &&
      savedPlaceEditor.includes("<LocationEvidenceChip") &&
      savedPlaceEditor.includes("point={suggestion}") &&
      savedPlaceEditor.includes("suggestionNeedsPrecisionDetail(suggestion)") &&
      fuelPathApi.includes("rankLocationSuggestions") &&
      fuelPathApi.includes("addressSuggestionScore") &&
      fuelPathApi.includes('"Needs confirmation"') &&
      fuelPathApi.includes('"Street/road"') &&
      fuelPathApi.includes('"Suburb/area"') &&
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
      nearbyLocationSearch.includes("CurrentLocationFieldButton") &&
      nearbyLocationSearch.includes("locationInputWithIcon") &&
      locationSuggestionDisplay.includes("titleConsumesStreetNumber(parts)") &&
      locationSuggestionDisplay.includes("isStreetNumberFragment") &&
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
      accountDetailScreen.includes("DiscountWalletCard") &&
      discountWalletCard.includes("onToggleDiscountRedemption") &&
      discountWalletCard.includes("onToggleDiscountRedemption: _onToggleDiscountRedemption") &&
      discountWalletCard.includes("activeDirectDiscountPrograms"),
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
      !stationRow.includes("Possible, not guaranteed:") &&
      !stationRow.includes("possible only") &&
      !planRouteSheet.includes(">Possible only<") &&
      discountWalletCard.includes("Turn on the offers you can actually use") &&
      discountRegistry.includes('"id": "linkt_7eleven"') &&
      discountRegistry.includes('"id": "rac_wa_caltex"'),
  },
  {
    label: "discount wallet uses active direct programmes from generated registry",
    ok:
      discountPrograms.includes("discountRegistry.generated.json") &&
      discountPrograms.includes('program.discountType !== "direct_cpl"') &&
      discountRegistry.includes('"id": "everyday_rewards"') &&
      discountRegistry.includes('"id": "flybuys"') &&
      discountRegistry.includes('"id": "nrma_ampol"') &&
      discountRegistry.includes('"id": "rac_wa_caltex"') &&
      discountRegistry.includes('"id": "linkt_7eleven"') &&
      !discountRegistry.includes('"id": "fleet_card"') &&
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
      routeNotifications.includes("Smart route notifications need a development or preview build, not Expo Go.") &&
      routeNotifications.includes("Route alert permission is enabled on this validation build.") &&
      routeNotifications.includes("Smart route notifications are ready for this build.") &&
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
      decisionEvidence.includes("Fuel Path checks watched routes for useful savings") &&
      !decisionEvidence.includes("delivery still needs native push"),
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

function countOccurrences(value, pattern) {
  return value.split(pattern).length - 1;
}
