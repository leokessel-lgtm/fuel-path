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
const routeInputPrecision = read("src/utils/routeInputPrecision.ts");
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
const routeAlertsHook = read("src/hooks/useRouteAlerts.ts");
const alertDeviceSecurity = read("src/services/alertDeviceSecurity.native.ts");
const theme = read("src/theme.ts");
const typographyDoc = read("../docs/06-design-brand/typography-hierarchy.md");
const routeRecommendationRules = read("../docs/route-recommendation-logic-rules.md");
const nearbyScreen = readScreenSource("src/screens/NearbyScreen.tsx", "src/screens/NearbyScreen.viewmodel.tsx");
const nearbyScreenUtils = read("src/screens/NearbyScreen.utils.ts");
const androidIntentLauncher = read("src/services/androidIntentLauncher.ts");
const androidIntentLauncherWeb = read("src/services/androidIntentLauncher.web.ts");
const nearbyResults = read("src/hooks/useNearbyResults.ts");
const stationBrandFilterPill = read("src/components/StationBrandFilterPill.tsx");
const stationBrandFilterOverride = read("src/hooks/useStationBrandFilterOverride.ts");
const planScreen = readScreenSource("src/screens/PlanScreen.tsx", "src/screens/PlanScreen.viewmodel.tsx");
const beginAddressFieldSelectionSource = planScreen.slice(
  planScreen.indexOf("const beginAddressFieldSelection"),
  planScreen.indexOf("const handleAddressFieldBlur"),
);
const planRouteState = read("src/screens/PlanScreen.routeState.ts");
const planScreenUtils = read("src/screens/PlanScreen.utils.ts");
const accountScreen = read("src/screens/AccountScreen.tsx");
const stationRow = read("src/components/StationRow.tsx");
const brandBadge = read("src/components/BrandBadge.tsx");
const brandAssets = read("src/data/brandAssets.ts");
const androidMarkerOverlayDimensions = [
  "bp.png",
  "shell.png",
  "caltex.png",
  "eg-ampol.png",
].map((filename) => readPngDimensions(`assets/brand-marker-overlays/${filename}`));
const betaPrivacyCard = read("src/components/BetaPrivacyCard.tsx");
const discountPrograms = read("src/data/discountPrograms.ts");
const discountProgramAssets = read("src/data/discountProgramAssets.ts");
const discountProgramBadge = read("src/components/DiscountProgramBadge.tsx");
const discountRegistry = read("src/data/discountRegistry.generated.json");
const fuelPathApi = read("src/api/fuelPathApi.ts");
const userVisibleErrors = read("src/utils/userVisibleErrors.ts");
const types = read("src/types.ts");
const locationEvidence = read("src/utils/locationEvidence.ts");
const routeCameraInsets = read("src/utils/routeCameraInsets.ts");
const preferencesStore = read("src/services/preferencesStore.ts");
const recentLocationsStore = read("src/services/recentLocationsStore.ts");
const savedCommutesStore = read("src/services/savedCommutesStore.ts");
const backendAlerts = read("src/services/backendAlerts.native.ts");
const routeNotifications = read("src/services/routeNotifications.ts");
const currentLocation = read("src/services/currentLocation.ts");
const pricing = read("src/utils/pricing.ts");
const decisionEvidence = read("src/utils/decisionEvidence.ts");
const packageJson = read("package.json");
const appConfig = JSON.parse(read("app.json"));
const nativeGenerationContract = JSON.parse(read("native-generation-contract.json"));
const planFieldSmoke = read("scripts/smoke-plan-fields.mjs");
const nativeApiContracts = read("scripts/check-native-api-contracts.mjs");
const androidMapSmoke = read("scripts/native-android-map-smoke.mjs");
const androidLocalStandaloneBuild = read("scripts/build-android-local-standalone.mjs");
const androidPreviewSmoke = read("scripts/native-android-preview-smoke.mjs");
const androidPerformanceSummary = read("scripts/native-android-performance-summary.mjs");
const androidPerformanceCoverage = read("scripts/native-android-performance-coverage.mjs");
const androidNotificationReadiness = read("scripts/native-android-notification-readiness.mjs");
const androidAlertSyncSmoke = read("scripts/native-android-alert-sync-smoke.mjs");
const androidAlertDeliveryGate = read("scripts/native-android-alert-delivery-gate.mjs");
const androidNavigationIntents = read("scripts/native-android-navigation-intents.mjs");
const androidColdStartSmoke = read("scripts/native-android-cold-start-smoke.mjs");
const routeNotificationScheduleStress = read("scripts/stress-route-notification-schedule.mjs");
const androidMapsKeyFix = read("scripts/android-maps-key-fix-packet.mjs");
const nativeValidationPreflight = read("scripts/native-validation-preflight.mjs");
const nativeMapGeocodeParity = read("scripts/native-map-geocode-parity-check.mjs");
const nativeEvidenceAudit = read("scripts/native-current-evidence-audit.mjs");
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
      nearbyScreen.includes("gap: spacing.xs") &&
      nearbyScreen.includes("top: spacing.sm") &&
      nearbyLocationSearch.includes("padding: spacing.xs") &&
      nearbyLocationSearch.includes("paddingVertical: spacing.xs") &&
      nearbyEvControls.includes("const energySelectorMinWidth = 214;") &&
      nearbyEvControls.includes('alignSelf: "flex-start"') &&
      nearbyEvControls.includes("minWidth: energySelectorMinWidth") &&
      nearbyEvControls.includes("gap: spacing.lg") &&
      measuredControlBoundary.includes("topControlsBottom + spacing.xl") &&
      measuredControlBoundary.includes("bottom: 330"),
  },
  {
    label: "map chrome uses the shared control corner radius",
    ok:
      theme.includes("control: 22") &&
      nearbyLocationSearch.includes("borderRadius: radii.control") &&
      planRouteEditorCard.includes("borderRadius: radii.control") &&
      nearbyStationSheet.includes("borderRadius: radii.control") &&
      nearbyCombinedPanel.includes("borderRadius: radii.control") &&
      nearbyEvControls.includes("borderRadius: radii.control") &&
      planRouteSheet.includes("borderRadius: radii.control"),
  },
  {
    label: "typography hierarchy is tokenised and documented",
    ok:
      theme.includes("fieldText: {") &&
      theme.includes("buttonLabel: {") &&
      theme.includes("compactButtonLabel: {") &&
      theme.includes("sectionLabel: {") &&
      theme.includes("metric: {") &&
      theme.includes("metadataStrong: {") &&
      typographyDoc.includes("# Fuel Path Typography Hierarchy") &&
      typographyDoc.includes("typography.fieldText") &&
      typographyDoc.includes("typography.metric") &&
      nearbyLocationSearch.includes("...typography.fieldText") &&
      planRouteEditorCard.includes("...typography.fieldText") &&
      nearbyEvControls.includes("...typography.buttonLabel") &&
      stationRow.includes("...typography.metric") &&
      nearbyStationSheet.includes("...typography.metric"),
  },
  {
    label: "nearby screen keeps current location as a separate map pin",
    ok:
      appShell.includes("const [currentLocation, setCurrentLocation] = useState<MapPoint>();") &&
      appShell.includes("currentLocation={currentLocation}") &&
      appShell.includes("onCurrentLocationChange={setCurrentLocation}") &&
      nearbyScreen.includes("setCurrentLocation(nextCentre);") &&
      nearbyScreen.includes("userLocation={currentLocation}"),
  },
  {
    label: "native current location maps platform failures to safe recovery copy",
    ok:
      currentLocation.includes("async function nativeLocationPermission(requestPermission: boolean)") &&
      currentLocation.includes("Location permission could not be checked.") &&
      currentLocation.includes("async function safeLastKnownPosition()") &&
      currentLocation.includes("return null;") &&
      currentLocation.includes("async function safeCurrentPosition()") &&
      currentLocation.includes("Current location is unavailable on this device right now.") &&
      currentLocation.includes("Current location took too long. Try again near a window, or type a start address."),
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
    label: "native station markers keep web-parity price, logo tray and pointer",
    ok:
      nativeMap.includes("const defaultMarkerDensity = {") &&
      nativeMap.includes("maxPriceMarkers: 8,") &&
      nativeMap.includes("markerGridSize: 240,") &&
      nativeMap.includes("compactMarkerGridSize: 128,") &&
      nativeMap.includes("const tabletMarkerDensity = {") &&
      nativeMap.includes("maxPriceMarkers: 20,") &&
      nativeMap.includes("markerGridSize: 150,") &&
      nativeMap.includes("compactMarkerGridSize: 110,") &&
      nativeMap.includes("const compactMarkerDensity = {") &&
      nativeMap.includes("maxPriceMarkers: 3,") &&
      nativeMap.includes("markerGridSize: 390,") &&
      nativeMap.includes("compactMarkerGridSize: 230,") &&
      !nativeMap.includes("dotMarkers") &&
      !nativeMap.includes("compactPin") &&
      !nativeMap.includes("maxDotMarkers") &&
      nativeMap.includes("nativeMarkerDensity(width, Platform.OS === \"ios\" && Platform.isPad)") &&
      nativeMap.includes("function nativeMarkerDensity(width: number, isPad = false)") &&
      nativeMap.includes("if (isPad || width >= 700) return tabletMarkerDensity;") &&
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
      nativeMap.includes("regionForClusterZoom(cluster, currentRegion)") &&
      nativeMap.includes("function regionForClusterZoom(") &&
      nativeMap.includes("currentRegion.latitudeDelta * 0.55") &&
      nativeMap.includes("currentRegion.longitudeDelta * 0.55") &&
      nativeMap.includes("function boundsForCluster(cluster: ClusterMarker)") &&
      nativeMap.includes("styles.clusterPin") &&
      nativeMap.includes("styles.clusterCount") &&
      nativeMap.includes("tracksViewChanges={Platform.OS === \"android\"}") &&
      nativeMap.includes("styles.pinBrand") &&
      nativeMap.includes("styles.pinPointer") &&
      nativeMap.includes("<BrandBadge") &&
      nativeMap.includes("Platform.OS === \"android\" ? null") &&
      nativeMap.includes("brandStyle.markerIcon || brandStyle.icon") &&
      nativeMap.includes("const nativeBrandIcon =") &&
      nativeMap.includes("image={nativeBrandIcon}") &&
      nativeMap.includes("anchor={{ x: 0.5, y: 1.35 }}") &&
      nativeMap.includes("marker") &&
      nativeMap.includes("station={item.station}") &&
      nativeMap.includes("size={22}") &&
      nativeMap.includes("zIndex={selected ? 700 : subdued ? 420 : 500}") &&
      brandBadge.includes("const style = brandStyleForStation(station);") &&
      brandBadge.includes("marker = false") &&
      brandBadge.includes("const source = style.icon || (marker ? style.markerIcon : undefined);") &&
      brandBadge.includes("const imageSize = Math.max(12, size - 4);") &&
      brandBadge.includes("resizeMode=\"contain\"") &&
      brandAssets.includes("markerIcon?: ImageSourcePropType;") &&
      brandAssets.includes("markerIcon: require(\"../../assets/brand-marker-overlays/bp.png\")") &&
      androidMarkerOverlayDimensions.every(
        ({ width, height }) => width <= 20 && height <= 20,
      ) &&
      nativeMap.includes("backgroundColor: colors.greenDark") &&
      nativeMap.includes("backgroundColor: \"transparent\"") &&
      nativeMap.includes("borderRadius: radii.md") &&
      nativeMap.includes("height: 46") &&
      nativeMap.includes("minWidth: 54") &&
      nativeMap.includes("width: 54") &&
      nativeMap.includes("minHeight: 24") &&
      nativeMap.includes("size={22}") &&
      nativeMap.includes("borderLeftWidth: 6") &&
      nativeMap.includes("borderRightWidth: 6") &&
      nativeMap.includes("borderTopWidth: 8") &&
      nativeMap.includes("const routeStationCameraPoints = stations") &&
      nativeMap.includes(".slice(0, routePriceMarkerLimit)") &&
      nativeMap.includes("const routeChargerCameraPoints = prioritiseSelectedChargers(") &&
      nativeMap.includes("selectedChargerId,") &&
      nativeMap.includes(".slice(0, routeCameraChargerLimit)") &&
      nativeMap.includes("routeStationCameraPoints,") &&
      nativeMap.includes("routeChargerCameraPoints,") &&
      !nativeMap.includes("scale: 1.05") &&
      nativeMap.includes("const subdued = Boolean(") &&
      nativeMap.includes("routeEndpoints && selectedStationCode && !selected") &&
      !nativeMap.includes("showCallout(") &&
      !nativeMap.includes("markerRefs") &&
      nativeMap.includes("subdued && styles.pinSubdued") &&
      nativeMap.includes("pinSubdued: {") &&
      !nativeMap.includes("opacity: 0.68") &&
      nativeMap.includes("transform: [{ scale: 0.94 }]") &&
      nativeMap.includes("backgroundColor: colors.greenDark") &&
      nativeMap.includes("pinSelected: {\n    borderColor: colors.black") &&
      nativeMap.includes("pinPriceSelected: {") &&
      nativeMap.includes("backgroundColor: colors.black") &&
      nativeMap.includes("color: colors.white") &&
      nativeMap.includes("const nearbyInitialRegionDelta = 0.035;") &&
      nativeMap.includes("const nearbyInitialMarkerRadiusKm = 4.2;") &&
      nativeMap.includes("regionForPoint(centre, nearbyInitialRegionDelta)") &&
      nativeMap.includes("nearbyCameraPointsForCentre(centre, nearbyInitialMarkerRadiusKm)") &&
      nativeMap.includes("pinPointerSelected"),
  },
  {
    label: "native route maps render selectable EV charger markers",
    ok:
      nativeMap.includes("chargers = emptyChargers") &&
      nativeMap.includes("selectedChargerId") &&
      nativeMap.includes("onSelectCharger") &&
      nativeMap.includes("visibleChargers.map") &&
      nativeMap.includes("prioritiseSelectedChargers(chargers, selectedChargerId)") &&
      nativeMap.includes("accessibilityLabel={`Select charger ${charger.name}`}") &&
      nativeMap.includes("onPress={() => onSelectCharger?.(charger.id)}") &&
      nativeMap.includes("styles.evPin") &&
      nativeMap.includes("styles.evPinSelected") &&
      nativeMap.includes("lastSelectedChargerIdRef") &&
      nativeMap.includes("!previousSelectedChargerId") &&
      nativeMap.includes("previousSelectedChargerId === selectedChargerId") &&
      nativeMap.includes("animateCamera") &&
      nativeMap.includes("selected.lat") &&
      nativeMap.includes("selected.lon") &&
      webMap.includes("evChargerMarkerHtml") &&
      webMap.includes("prioritiseSelectedChargers(chargers, selectedChargerId)"),
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
    label: "app shell uses compact labelled bottom navigation",
    ok:
      appShell.includes("backgroundColor: colors.black") &&
      appShell.includes('width: "92%"') &&
      appShell.includes("maxWidth: 440") &&
      appShell.includes("minHeight: 44") &&
      appShell.includes("tabLabelSelected") &&
      !appShell.includes("function TabIcon") &&
      !appShell.includes("styles.tabIconShell") &&
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
      appShell.includes("accessibilityLabel={tab.label}") &&
      appShell.includes("aria-selected={selected}") &&
      appShell.includes("<Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{tab.label}</Text>"),
  },
  {
    label: "typography keeps normal text lighter than standout text",
    ok:
      theme.includes('fontWeight: "400" as const') &&
      theme.includes('fontWeight: "600" as const') &&
      theme.includes('fontWeight: "700" as const') &&
      appShell.includes('fontWeight: "700"') &&
      appShell.includes("fontSize: typeScale.caption") &&
      appShell.includes("fontSize: typeScale.body") &&
      !appShell.includes('fontWeight: "900"'),
  },
  {
    label: "nearby station sheet removes non-actionable notice cards",
    ok:
      nearbyScreen.includes("NearbyStationSheet") &&
      nearbyStationSheet.includes("const visibleStationNotice = fuelMismatchContextLine(stationContext);") &&
      !nearbyStationSheet.includes("fuelMismatchContextLine(stationContext) || stationNotice") &&
      nearbyCombinedPanel.includes('const fuelNotice = fuelMismatchContextLine(stationContext) || (!combinedRows.length ? stationNotice : "");') &&
      !nearbyCombinedPanel.includes("fuelMismatchContextLine(stationContext) || stationNotice ||") &&
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
      nearbyStationSheet.includes("maxHeight: 235") &&
      nearbyStationSheet.includes("maxHeight: 172") &&
      nearbyCombinedPanel.includes("maxHeight: 285") &&
      nearbyCombinedPanel.includes("maxHeight: 180") &&
      nearbyEvControls.includes("maxHeight: 275") &&
      nearbyEvControls.includes("maxHeight: 180") &&
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
      nearbyStationSheet.includes("paddingTop: spacing.xs") &&
      nearbyStationSheet.includes("minHeight: 24") &&
      nearbyStationSheet.includes("paddingVertical: 2") &&
      nearbyCombinedPanel.includes("paddingTop: spacing.xs") &&
      nearbyCombinedPanel.includes("minHeight: 24") &&
      nearbyCombinedPanel.includes("paddingVertical: 2") &&
      nearbyEvControls.includes("paddingTop: spacing.xs") &&
      nearbyEvControls.includes("minHeight: 24") &&
      nearbyEvControls.includes("paddingVertical: 2") &&
      nearbyStationSheet.includes('accessibilityRole="button"') &&
      nearbyStationSheet.includes("hitSlop={10}") &&
      nearbyStationSheet.includes('accessibilityLabel={sheetExpanded ? "Collapse station list" : "Expand station list"}'),
  },
  {
    label: "plan sheet has a minimised map state",
    ok:
      planScreen.includes("routeSheetMinimised") &&
      planScreen.includes("PlanRouteSheet") &&
      planRouteSheet.includes("styles.sheetMinimised") &&
      planRouteSheet.includes("height: 62") &&
      planRouteSheet.includes("paddingVertical: spacing.xs") &&
      planRouteEditorCard.includes("padding: spacing.xs") &&
      planRouteEditorCard.includes("paddingVertical: spacing.xs") &&
      planScreen.includes("topControlsOnly: {\n    top: spacing.sm"),
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
      planRouteSheet.includes("openPlanStationDirections(best, navigationApp, routeEndpoints)") &&
      planRouteSheet.includes("openPlanStationDirections(selected, navigationApp, routeEndpoints)") &&
      planRouteSheet.includes("Navigate via ${best.station.name} to ${routeEndpoints.to.label}") &&
      planScreen.includes("routeEndpoints={routeData.endpoints}") &&
      nearbyScreenUtils.includes('waypoints: stopValue') &&
      nearbyScreenUtils.includes('destination: destinationValue') &&
      nearbyScreenUtils.includes("Alert.alert(") &&
      nearbyScreenUtils.includes("ActionSheetIOS.showActionSheetWithOptions") &&
      nearbyScreenUtils.includes('title: "Navigate via fuel stop"') &&
      nearbyScreenUtils.includes("appleMapsRouteViaStopUrl(origin, stop, destination)") &&
      nearbyScreenUtils.includes("fallbackUrl: appleMapsUrl") &&
      nearbyScreenUtils.includes('{ label: "Apple Maps", provider: "apple_maps", url: appleMapsUrl }') &&
      nearbyScreenUtils.includes('{ label: "Waze to stop", provider: "waze"') &&
      nearbyScreenUtils.includes('{ label: "Google Maps", provider: "google_maps"') &&
      nearbyScreenUtils.includes('{ label: "Waze", provider: "waze"') &&
      nearbyScreenUtils.includes('import { startAndroidIntent } from "../services/androidIntentLauncher";') &&
      androidIntentLauncher.includes('import * as IntentLauncher from "expo-intent-launcher";') &&
      androidIntentLauncher.includes("IntentLauncher.startActivityAsync(action, options)") &&
      !androidIntentLauncherWeb.includes("expo-intent-launcher") &&
      nearbyScreenUtils.includes("androidIntent: androidDeviceMapsIntent(geoUrl)") &&
      nearbyScreenUtils.includes("androidIntent: androidGoogleMapsIntent(googleMapsUrl)") &&
      nearbyScreenUtils.includes('label: "Maps"') &&
      nearbyScreenUtils.includes('provider: "device_maps"') &&
      nearbyScreenUtils.includes("url: geoUrl") &&
      nearbyScreenUtils.includes("navigationApp !== \"ask\"") &&
      nearbyScreenUtils.includes("provider === navigationApp") &&
      nearbyScreenUtils.includes("async function openNavigationOption") &&
      nearbyScreenUtils.includes("startAndroidIntent(option.androidIntent.action") &&
      nearbyScreenUtils.includes("packageName: option.androidIntent.packageName") &&
      nearbyScreenUtils.includes("if (!option.fallbackUrl) throw error;") &&
      nearbyScreenUtils.includes("if (Platform.OS === \"android\")") &&
      nearbyScreenUtils.includes("function appleMapsRouteViaStopUrl") &&
      nearbyScreenUtils.includes('params.append("daddr", coordinateParam(stop.lat, stop.lon))') &&
      nearbyScreenUtils.includes('params.append("daddr", coordinateParam(destination.lat, destination.lon))') &&
      nearbyScreenUtils.includes("function androidGoogleNavigationUrl") &&
      nearbyScreenUtils.includes("google.navigation:q=${Number(lat)},${Number(lon)}&mode=d") &&
      nearbyScreenUtils.includes('const ANDROID_GOOGLE_MAPS_PACKAGE = "com.google.android.apps.maps";') &&
      nearbyScreenUtils.includes("function androidGoogleMapsIntent") &&
      nearbyScreenUtils.includes("packageName: ANDROID_GOOGLE_MAPS_PACKAGE") &&
      nearbyScreenUtils.includes("fallbackUrl: googleMapsUrl") &&
      nearbyScreenUtils.includes('const ANDROID_WAZE_PACKAGE = "com.waze";') &&
      nearbyScreenUtils.includes("function androidWazeUrl") &&
      nearbyScreenUtils.includes("function androidWazeIntent") &&
      nearbyScreenUtils.includes("packageName: ANDROID_WAZE_PACKAGE") &&
      nearbyScreenUtils.includes("waze://?ll=${Number(lat)},${Number(lon)}&navigate=yes&utm_source=fuelpath") &&
      nearbyScreenUtils.includes('Linking.canOpenURL("comgooglemapsurl://")') &&
      nearbyScreenUtils.includes("comgooglemapsurl://${googleMapsUrl.replace") &&
      nearbyScreenUtils.includes('Linking.canOpenURL("waze://")') &&
      nearbyScreenUtils.includes("https://waze.com/ul?ll=${safeLat},${safeLon}&navigate=yes&utm_source=fuelpath") &&
      appConfig.expo.ios.infoPlist.LSApplicationQueriesSchemes.includes("comgooglemapsurl") &&
      appConfig.expo.ios.infoPlist.LSApplicationQueriesSchemes.includes("waze"),
  },
  {
    label: "plan returns to recommended stop after alternative detail",
    ok:
      planScreen.includes('if (best) dispatchRoute({ type: "select-station", stationCode: best.station.stationCode });') &&
      planRouteSheet.includes('accessibilityLabel="Show recommended stop"') &&
      planRouteSheet.includes("<Text style={styles.textButtonLabel}>Recommended</Text>") &&
      !planRouteSheet.includes("<Text style={styles.textButtonLabel}>Stops</Text>"),
  },
  {
    label: "plan keeps map visible while route sheet stays hidden until route starts",
    ok:
      planScreen.includes("routeStarted,") &&
      planScreen.includes("const defaultPlanCentre: MapPoint") &&
      planScreen.includes('label: "Perth CBD WA 6000"') &&
      planScreen.includes("showCentreMarker={Boolean(fromPoint) && !fromPointIsCurrentLocation}") &&
      planScreen.includes("userLocation={fromPointIsCurrentLocation ? fromPoint : undefined}") &&
      planScreen.includes('dispatchRoute({ type: "start-loading" });') &&
      planRouteState.includes("routeStarted: false") &&
      planRouteState.includes("routeStarted: true") &&
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
      planRouteSheet.indexOf("styles.compactActionRow") < planRouteSheet.indexOf("styles.compactRecommendation") &&
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
    label: "plan sends active vehicle and decision rule inputs without user decision controls",
    ok:
      routeScoring.includes("ASSUMED_ROUTE_FILL_LITRES = 40") &&
      routeScoring.includes("function calculateRouteFillLitres({ tankLitres, tankPercent } = {})") &&
      routeScoring.includes("tankSize * (1 - Math.min(100, Math.max(0, currentPercent)) / 100)") &&
      routeScoring.includes("SMART_MAX_DETOUR_MINUTES = 30") &&
      routeScoring.includes("smartDetourLimitMinutesForSaving") &&
      routeScoring.includes("savingsDetourLabel") &&
      routeScoring.includes("Small savings detour") &&
      routeScoring.includes("Strong savings detour") &&
      fuelPathApi.includes("type RouteScoringPreferences = Pick<") &&
      fuelPathApi.includes("const defaultRouteScoringTankPercent = 45;") &&
      fuelPathApi.includes("const defaultRouteScoringReserveKm = 35;") &&
      fuelPathApi.includes("function routeScoringInputs(") &&
      fuelPathApi.includes("preferences: RouteScoringPreferences") &&
      fuelPathApi.includes("tankLitres: overrides?.fuelTankLitres || vehicle.fuelTankLitres || preferences.fuelTankLitres || 55") &&
      fuelPathApi.includes("tankPercent: defaultRouteScoringTankPercent") &&
      fuelPathApi.includes("reserveKm: defaultRouteScoringReserveKm") &&
      fuelPathApi.includes("minSavingDollars: preferences.minSavingDollars") &&
      fuelPathApi.includes("maxDetourMinutes: preferences.maxDetourMinutes") &&
      planScreen.includes("preferences.activeVehicleId") &&
      planScreen.includes("preferences.fuelTankLitres") &&
      planScreen.includes("preferences.minSavingDollars") &&
      planScreen.includes("preferences.maxDetourMinutes") &&
      fuelPathApi.includes('if (vehicle.vehicleEnergyType === "diesel") return 7.4;') &&
      nativeApiContracts.includes("await planFuelRoute({") &&
      nativeApiContracts.includes('assert.equal(call.url, "https://fuel-path.test/api/score");') &&
      nativeApiContracts.includes("assert.equal(body.tankLitres, 72);") &&
      nativeApiContracts.includes("assert.equal(body.tankPercent, 45);") &&
      nativeApiContracts.includes("assert.equal(body.economy, 7.4);") &&
      nativeApiContracts.includes("assert.equal(body.reserveKm, 35);") &&
      nativeApiContracts.includes("assert.equal(body.minSavingDollars, 5);") &&
      nativeApiContracts.includes("assert.equal(body.maxDetourMinutes, 8);") &&
      nativeApiContracts.includes("assert.deepEqual(body.eligibleDiscounts") &&
      nativeApiContracts.includes("assert.equal(body.brandFilter, true);") &&
      nativeApiContracts.includes('assert.equal("route" in body, false);') &&
      nativeApiContracts.includes("await checkSavedRouteAlertContract();") &&
      nativeApiContracts.includes("syncSavedRouteAlert,\n  } = loadTsModule(backendAlertsSourcePath") &&
      nativeApiContracts.includes("assert.equal(result.remoteDeliveryEnabled, false);") &&
      nativeApiContracts.includes('assert.equal(alertFetchCalls[1].url, "https://fuel-path.test/api/alerts?action=enrol-watch");') &&
      nativeApiContracts.includes("assert.equal(body.vehicleId, \"vehicle-diesel\");") &&
      nativeApiContracts.includes("assert.equal(body.vehicleEnergyType, \"diesel\");") &&
      nativeApiContracts.includes("assert.equal(body.fuel, \"PDL\");") &&
      nativeApiContracts.includes("assert.equal(body.tankPercent, 40);") &&
      packageJson.includes('"test:native-api-contracts": "node scripts/check-native-api-contracts.mjs"') &&
      packageJson.includes("npm run test:native-api-contracts") &&
      packageJson.includes("npm run test:map-camera") &&
      planScreen.includes("preferences,\n        stationBrands: preferredStationBrands") &&
      routeRecommendationRules.includes("Native live Plan requests must send the active vehicle tank size") &&
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
      planScreen.includes('dispatchRoute({ type: "edit" });') &&
      planScreen.includes('dispatchRoute({ type: "blocked", error: evRoutePlanningUnavailable });') &&
      planRouteState.includes("routeData: emptyRoute") &&
      planRouteState.includes("routeData: { ...state.routeData, points: [] }") &&
      planRouteState.includes("result: null"),
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
      preferencesStore.includes('activeVehicleId: activeVehicle ? activeVehicle.id : ""') &&
      appShell.includes('const [vehicleSwitcherOpen, setVehicleSwitcherOpen] = useState(false);') &&
      appShell.includes('const vehicleTitle = activeVehicle') &&
      appShell.includes('"Fuel only"') &&
      appShell.includes("const handleSelectHeaderVehicle = (vehicleId: string)") &&
      appShell.includes("updateFuel(preferences.fuel);") &&
      appShell.includes("updateVehicleFuel") &&
      routeRecommendationRules.includes("Manual fuel changes in Nearby or Plan clear the active vehicle context") &&
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
    label: "backend alert identity stays secure, anonymous and non-contact",
    ok:
      backendAlerts.includes('const ALERT_IDENTITY_KEY = "fuel-path-alert-installation-v3";') &&
      backendAlerts.includes("installationId: `installation_${await randomUuid()}`") &&
      backendAlerts.includes("installationSecret: await randomSecret()") &&
      alertDeviceSecurity.includes("Crypto.getRandomBytesAsync(32)") &&
      backendAlerts.includes("ALERT_INSTALL_MARKER_KEY") &&
      backendAlerts.includes("ALERT_BACKEND_ENROLLED_KEY") &&
      backendAlerts.includes("ALERT_LEGACY_IDENTITY_KEY") &&
      backendAlerts.includes("await secureSet(ALERT_IDENTITY_KEY, JSON.stringify(identity))") &&
      alertDeviceSecurity.includes("SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY") &&
      !backendAlerts.includes("vehicleRego") &&
      !backendAlerts.includes("privacyContact") &&
      !backendAlerts.includes("email"),
  },
  {
    label: "backend alert sync maps non-JSON responses to safe route-watch states",
    ok:
      backendAlerts.includes("const payload = await readAlertJson(response);") &&
      backendAlerts.includes("async function readAlertJson(response: Response)") &&
      backendAlerts.includes("const text = await response.text();") &&
      backendAlerts.includes("JSON.parse(text)") &&
      backendAlerts.includes("function normaliseAlertCapability(payload: unknown)") &&
      backendAlerts.includes("expiresAtMs - ALERT_CAPABILITY_REFRESH_BUFFER_MS <= Date.now()") &&
      backendAlerts.includes("await secureDelete(ALERT_CAPABILITY_KEY);") &&
      backendAlerts.includes("const capability = normaliseAlertCapability(payload);") &&
      backendAlerts.includes("Route watch could not update. Your saved route is still on this device, so you can try again.") &&
      backendAlerts.includes("Smart route watch could not update. Your saved route remains on this device.") &&
      backendAlerts.includes("Route watch delete failed. Saved route was kept so you can retry.") &&
      backendAlerts.includes("routeWatchRemoteDeliveryEnabled(savedRoute)") &&
      backendAlerts.includes("Smart route watch was saved, but push delivery is not enabled for this build yet.") &&
      backendAlerts.includes("pushDeliveryEnabled") &&
      nativeApiContracts.includes("expired-capability-token") &&
      nativeApiContracts.includes("assert.equal(expired.storage.has(\"fuel-path-alert-capability-v3\"), false);") &&
      routeNotifications.includes("Smart route notifications are ready for this build.") &&
      !backendAlerts.includes("Expo push delivery is disabled by environment gate.") &&
      !backendAlerts.includes("response.json()"),
  },
  {
    label: "address lookup autocomplete errors stay out of the UI",
    ok:
      !fuelPathApi.includes("Address lookup is busy right now") &&
      fuelPathApi.includes("locationLookupErrorMessage") &&
      fuelPathApi.includes("addressLookupErrorMessage") &&
      userVisibleErrors.includes("We could not check that address right now. Add suburb or postcode, or try again shortly.") &&
      routeAddressSuggestionHook.includes('setSuggestionsError("");') &&
      planScreen.includes("clearAddressSuggestionError();") &&
      nearbyScreen.includes('setLocationError("");'),
  },
  {
    label: "mobile API client maps non-JSON responses to safe surface copy",
    ok:
      fuelPathApi.includes("const payload = await readJsonResponse(response);") &&
      fuelPathApi.includes("async function readJsonResponse(response: Response)") &&
      fuelPathApi.includes("const text = await response.text();") &&
      fuelPathApi.includes("JSON.parse(text)") &&
      fuelPathApi.includes("if (!payload)") &&
      fuelPathApi.includes("apiErrorMessage(path, response.status || 502, null)") &&
      !fuelPathApi.includes("const payload = await response.json();") &&
      userVisibleErrors.includes("Route planning hit a temporary problem.") &&
      userVisibleErrors.includes("Fuel Path could not refresh nearby prices.") &&
      userVisibleErrors.includes("We could not check that address right now."),
  },
  {
    label: "partial street address lookup gives quiet locality guidance",
    ok:
      planScreen.includes("PlanRouteEditorCard") &&
      planRouteEditorCard.includes("AddressSuggestions") &&
      !planRouteEditorCard.includes("NearbyEnergySelector") &&
      planScreen.includes("NearbyEnergySelector") &&
      planScreen.includes('eyebrow=""') &&
      planScreen.includes("const handleAddressFieldBlur = (field: \"from\" | \"to\")") &&
      planScreen.includes("fromSelectionSuppressRef.current") &&
      planScreen.includes("toSelectionSuppressRef.current") &&
      planScreen.includes("const finishAddressFieldSelection = (field: \"from\" | \"to\")") &&
      planScreen.includes("finishAddressFieldSelection(field);") &&
      !planScreen.includes("fromSelectionSuppressTimerRef") &&
      !planScreen.includes("toSelectionSuppressTimerRef") &&
      planRouteEditorCard.includes('keyboardShouldPersistTaps="always"') &&
      routeAddressSuggestions.includes('keyboardShouldPersistTaps="always"') &&
      routeAddressSuggestions.includes("addressLocalityHint") &&
      routeInputPrecision.includes("Add suburb or postcode to narrow the address.") &&
      routeInputPrecision.includes("Street found. Add suburb or postcode to choose the right area.") &&
      planRouteEditorCard.includes("query={from}") &&
      planRouteEditorCard.includes("query={to}"),
  },
  {
    label: "typed address route planning rejects weak automatic area matches",
    ok:
      planScreen.includes("routeInputPrecisionHint") &&
      routeInputPrecision.includes("hasAddressLocalityContext") &&
      routeInputPrecision.includes('replace(/\\b(nsw|act|qld|vic|wa|sa|tas|nt)\\b/gi, " ")') &&
      planScreen.includes("routePrecisionHint") &&
      routeInputPrecision.includes("Choose a start suggestion, or add suburb or postcode before planning.") &&
      routeInputPrecision.includes("Choose a destination suggestion, or add suburb or postcode before planning.") &&
      routeInputPrecision.includes("Choose a start suggestion to confirm this address.") &&
      routeInputPrecision.includes("Choose a destination suggestion to confirm this address.") &&
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
    label: "Plan address suggestion press does not rerender before selection",
    ok:
      planScreen.includes('const beginAddressFieldSelection = (field: "from" | "to") => {') &&
      !beginAddressFieldSelectionSource.includes("markRouteEdited()") &&
      !beginAddressFieldSelectionSource.includes("setActiveAddressField(field)") &&
      !beginAddressFieldSelectionSource.includes("reopenRouteEditor()") &&
      routeAddressSuggestions.includes("onPressIn={onSelectStart}") &&
      routeAddressSuggestions.includes("onPress={() => onSelect(point)}"),
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
      locationEvidence.includes("Location lookup") &&
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
      discountWalletCard.includes("activeDirectDiscountPrograms") &&
      discountWalletCard.includes("<DiscountProgramBadge program={program} size={28} />") &&
      discountProgramBadge.includes("renderToHardwareTextureAndroid") &&
      discountProgramBadge.includes('resizeMode="contain"') &&
      discountProgramAssets.includes("discountProgramStyleFor") &&
      discountProgramAssets.includes('"../../assets/discount-icons/everyday-rewards.png"') &&
      discountProgramAssets.includes('"../../assets/discount-icons/flybuys.png"') &&
      discountProgramAssets.includes('"../../assets/discount-icons/nrma.png"') &&
      discountProgramAssets.includes('"../../assets/discount-icons/nab.png"'),
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
      discountPrograms.includes("program.nextReviewAt < todayIsoDate()") &&
      discountRegistry.includes('"id": "everyday_rewards"') &&
      discountRegistry.includes('"id": "flybuys"') &&
      !discountRegistry.includes('"id": "reddy_express_instore"') &&
      discountRegistry.includes('"id": "nrma_ampol"') &&
      discountRegistry.includes('"id": "rac_wa_caltex"') &&
      discountRegistry.includes('"expiryDate": "2026-06-30"') &&
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
      routeNotifications.includes("Could not check notification permission on this build. You can still save commutes.") &&
      routeNotifications.includes("Could not request notification permission on this build. You can still save commutes.") &&
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
      backendAlerts.includes("remoteDeliveryEnabled?: boolean;") &&
      backendAlerts.includes("routeWatchRemoteDeliveryEnabled") &&
      backendAlerts.includes("Smart route watch was saved, but push delivery is not enabled for this build yet.") &&
      backendAlerts.indexOf("routeWatchRemoteDeliveryEnabled(savedRoute)") <
        backendAlerts.indexOf("Smart route watch updated.") &&
      routeAlertsHook.includes("function smartRouteDeliveryReady") &&
      routeAlertsHook.includes('return result.status === "synced" || result.status === "skipped";') &&
      routeAlertsHook.includes("The gate controls sending, not whether this device and route were registered.") &&
      routeAlertsHook.includes("const backendSynced = smartRouteDeliveryReady(backendSync);") &&
      !routeAlertsHook.includes('backendSync.status === "synced";') &&
      routeNotifications.includes("Smart route notifications are ready for this build.") &&
      routeNotifications.includes("Could not get this device push token.") &&
      routeNotifications.includes("Enable notifications before smart route alerts can run.") &&
      routeNotifications.includes("Smart route notifications need an EAS project id in the native build.") &&
      routeNotifications.includes("Smart route notifications need a development or preview build, not Expo Go.") &&
      routeNotifications.includes("getExpoRoutePushToken") &&
      routeNotifications.includes("let expoPushTokenRequest: Promise<PushTokenResult> | null = null;") &&
      routeNotifications.includes("expoPushTokenRequest = getExpoRoutePushTokenOnce().finally") &&
      routeAlertsHook.includes("if (now - lastPushTokenRefreshAt < 30_000) return;") &&
      routeNotifications.includes("expoProjectId()") &&
      routeNotifications.includes("remotePushUnavailableInExpoGo()") &&
      routeNotifications.indexOf("await ensureRouteAlertChannel(Notifications);") <
        routeNotifications.indexOf("Notifications.setNotificationHandler") &&
      routeNotifications.indexOf("const token = await Notifications.getExpoPushTokenAsync({ projectId });") <
        routeNotifications.indexOf("Smart route notifications are ready for this build.") &&
      routeNotifications.includes("androidNotificationsUnavailableInExpoGo()") &&
      routeNotifications.includes("ensureRouteAlertChannel") &&
      routeNotifications.includes("ROUTE_ALERT_CHANNEL_ID") &&
      routeNotifications.includes("Notifications.AndroidImportance.DEFAULT") &&
      decisionEvidence.includes("Fuel Path checks watched routes for useful savings") &&
      !decisionEvidence.includes("delivery still needs native push"),
  },
  {
    label: "Android map smoke captures native render and frame evidence",
    ok:
      packageJson.includes('"native:android-map-smoke": "node scripts/native-android-map-smoke.mjs"') &&
      androidMapSmoke.includes("const scriptDir = dirname(fileURLToPath(import.meta.url));") &&
      androidMapSmoke.includes('const appRoot = resolve(scriptDir, "..");') &&
      androidMapSmoke.includes('const repoRoot = resolve(appRoot, "..");') &&
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
      androidPreviewSmoke.includes("const scriptDir = dirname(fileURLToPath(import.meta.url));") &&
      androidPreviewSmoke.includes('const mobileRoot = resolve(scriptDir, "..");') &&
      androidPreviewSmoke.includes('const repoRoot = resolve(mobileRoot, "..");') &&
      androidPreviewSmoke.includes("function resolveInputPath(value)") &&
      androidPreviewSmoke.includes("com.fuelpath.app/.MainActivity") &&
      androidPreviewSmoke.includes("Physical Android device required for performance validation") &&
      androidPreviewSmoke.includes('"verify", "--print-certs"') &&
      androidPreviewSmoke.includes("GoogleCertificatesRslt") &&
      androidPreviewSmoke.includes("blankMapLikely") &&
      androidPreviewSmoke.includes("Google map tiles appear blank") &&
      androidPreviewSmoke.includes("Application credential header not valid") &&
      androidPreviewSmoke.includes("renderSurfacePresent") &&
      androidPreviewSmoke.includes("viewRootCount") &&
      androidPreviewSmoke.includes("graphicsBufferCount") &&
      androidPreviewSmoke.includes("graphicsBufferEstimateKb") &&
      androidPreviewSmoke.includes("profileDataRows") &&
      androidPreviewSmoke.includes("Frame timing is unavailable from gfxinfo") &&
      androidPreviewSmoke.includes("Treat this as render evidence only") &&
      androidPreviewSmoke.includes("Render surface present") &&
      androidPreviewSmoke.includes('await tapLabel("Plan", "plan tab"') &&
      androidPreviewSmoke.includes('await tapLabel("Nearby", "nearby tab"') &&
      androidPreviewSmoke.includes('await tapLabel("Settings", "settings tab"') &&
      androidPreviewSmoke.includes("function tapLabel(text, label, fallback)") &&
      androidPreviewSmoke.includes("findNodeBoundsByText(readUiDump(), text)") &&
      androidPreviewSmoke.includes("function findNodeBoundsByText(xml, text)") &&
      androidPreviewSmoke.includes("function isMapCredentialWarningLine(line)") &&
      androidPreviewSmoke.includes("PhFlagUpdateRegistry|Phenotype") &&
      androidPreviewSmoke.includes("foreground recovery before ${name}") &&
      androidPreviewSmoke.includes("function isPreviewAppVisible()") &&
      androidPreviewSmoke.includes("readDeviceDiagnostics") &&
      androidPreviewSmoke.includes("Android Preview APK Smoke"),
  },
  {
    label: "Android local standalone build creates a no-Metro validation APK",
    ok:
      packageJson.includes('"native:android-local-standalone": "node scripts/build-android-local-standalone.mjs"') &&
      androidLocalStandaloneBuild.includes('execFileSync("./gradlew", gradleArgs') &&
      androidLocalStandaloneBuild.includes("enforceSupportedGradleWrapper()") &&
      androidLocalStandaloneBuild.includes("gradle-8.14.3-bin.zip") &&
      androidLocalStandaloneBuild.includes("FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY is required") &&
      androidLocalStandaloneBuild.includes("env.ANDROID_HOME") &&
      androidLocalStandaloneBuild.includes("env.ANDROID_SDK_ROOT") &&
      androidLocalStandaloneBuild.includes("https://fuel-path.vercel.app") &&
      androidLocalStandaloneBuild.includes("const architecture = args.has(\"--all-architectures\") ? \"\" : \"arm64-v8a\";") &&
      androidLocalStandaloneBuild.includes("const gradleArgs = [") &&
      androidLocalStandaloneBuild.includes("`-PreactNativeArchitectures=${architecture}`") &&
      androidLocalStandaloneBuild.includes("fuel-path-local-standalone-") &&
      androidLocalStandaloneBuild.includes("app/build/outputs/apk/release/app-release.apk") &&
      androidLocalStandaloneBuild.includes("Signing: local debug signing config for validation only"),
  },
  {
    label: "Android physical performance summary rejects emulator-only evidence",
    ok:
      packageJson.includes('"native:android-performance-summary": "node scripts/native-android-performance-summary.mjs"') &&
      androidPerformanceSummary.includes("const scriptDir = dirname(fileURLToPath(import.meta.url));") &&
      androidPerformanceSummary.includes('const mobileRoot = resolve(scriptDir, "..");') &&
      androidPerformanceSummary.includes('const repoRoot = resolve(mobileRoot, "..");') &&
      androidPerformanceSummary.includes("function resolveInputPath(value)") &&
      androidPerformanceSummary.includes('report.device.type !== "physical"') &&
      androidPerformanceSummary.includes("Source report is missing physical-device metadata") &&
      androidPerformanceSummary.includes("Source report is not from a physical Android device") &&
      androidPerformanceSummary.includes("Frame jank is above claim threshold") &&
      androidPerformanceSummary.includes("Frame p95 is above claim threshold") &&
      androidPerformanceSummary.includes("Android Physical Performance Summary"),
  },
  {
    label: "Android performance coverage separates Pixel beta evidence from broad claims",
    ok:
      packageJson.includes('"native:android-performance-coverage": "node scripts/native-android-performance-coverage.mjs"') &&
      androidPerformanceCoverage.includes("controlled_beta_only") &&
      androidPerformanceCoverage.includes("broad_candidate") &&
      androidPerformanceCoverage.includes("statSync(path).mtimeMs") &&
      androidPerformanceCoverage.includes("--require-broad") &&
      androidPerformanceCoverage.includes("Pixel 9 Pro or equivalent evidence is valid for controlled beta performance only.") &&
      androidPerformanceCoverage.includes("Broad Android performance claims need at least one current passing physical run from a lower or mid-range Android class.") &&
      nativeEvidenceAudit.includes("Android performance coverage") &&
      nativeEvidenceAudit.includes("latestAndroidPerformanceCoverage"),
  },
  {
    label: "Android notification readiness audits packaged permissions without writing routes",
    ok:
      packageJson.includes('"native:android-notification-readiness": "node scripts/native-android-notification-readiness.mjs"') &&
      androidNotificationReadiness.includes("android.permission.POST_NOTIFICATIONS") &&
      androidNotificationReadiness.includes("com.google.android.c2dm.permission.RECEIVE") &&
      androidNotificationReadiness.includes("android.permission.RECEIVE_BOOT_COMPLETED") &&
      androidNotificationReadiness.includes("EAS project id packaged for Expo push token") &&
      androidNotificationReadiness.includes("Notification channel id configured in app config") &&
      androidNotificationReadiness.includes("client-capability") &&
      androidNotificationReadiness.includes("scoped token omitted from report") &&
      androidNotificationReadiness.includes("dumpsys\", \"package\"") &&
      androidNotificationReadiness.includes("android.permission.POST_NOTIFICATIONS") &&
      androidNotificationReadiness.includes("dumpsys\", \"notification\", \"--noredact\"") &&
      androidNotificationReadiness.includes("NotificationChannel{mId='route-alerts'") &&
      androidNotificationReadiness.includes("mName=Saved route alerts") &&
      androidNotificationReadiness.includes("Installed app has Android route-alerts notification channel") &&
      androidNotificationReadiness.includes("Launch the installed app once so the channel can be created.") &&
      androidNotificationReadiness.includes("this also verifies the Android `route-alerts` notification channel exists on-device") &&
      androidNotificationReadiness.includes("It does not register a real Expo push token or prove a delivered push notification.") &&
      androidNotificationReadiness.includes("Backend saved-route sync is covered separately by `npm run native:android-alert-sync-smoke`.") &&
      androidNotificationReadiness.includes("Runtime permission and real Expo push-token creation still need an on-device flow after permission is granted."),
  },
  {
    label: "Android alert sync smoke proves scoped backend route-watch contract and cleanup",
    ok:
      packageJson.includes('"native:android-alert-sync-smoke": "node scripts/native-android-alert-sync-smoke.mjs"') &&
      androidAlertSyncSmoke.includes("/api/alerts?action=client-capability") &&
      androidAlertSyncSmoke.includes("`installation_readiness_${timestamp}`") &&
      androidAlertSyncSmoke.includes("installationId, installationSecret") &&
      androidAlertSyncSmoke.includes("/api/push/register") &&
      androidAlertSyncSmoke.includes("/api/saved-routes") &&
      androidAlertSyncSmoke.includes("fakeExpoPushToken") &&
      androidAlertSyncSmoke.includes("FUEL_PATH_ALLOW_PRODUCTION_ALERT_SMOKE") &&
      androidAlertSyncSmoke.includes("Temporary saved route watch cleanup succeeds") &&
      androidAlertSyncSmoke.includes("Temporary saved route watch is absent after cleanup") &&
      androidAlertSyncSmoke.includes("Temporary installation data is deleted atomically") &&
      androidAlertSyncSmoke.includes("Revoked installation capability cannot read saved routes") &&
      androidAlertSyncSmoke.includes("Installation secret, scoped capability and push token values are intentionally omitted from this report."),
  },
  {
    label: "Android alert delivery gate distinguishes backend sync from real push delivery",
    ok:
      packageJson.includes('"native:android-alert-delivery-gate": "node scripts/native-android-alert-delivery-gate.mjs"') &&
      androidAlertDeliveryGate.includes("/api/alerts") &&
      androidAlertDeliveryGate.includes("pushDeliveryEnabled") &&
      androidAlertDeliveryGate.includes("blocked_by_environment") &&
      androidAlertDeliveryGate.includes("--require-enabled") &&
      androidAlertDeliveryGate.includes("It does not create a device Expo push token, send a notification, or inspect a physical notification tray.") &&
      nativeEvidenceAudit.includes("Android alert delivery gate") &&
      nativeEvidenceAudit.includes("latestAndroidAlertDeliveryGate") &&
      nativeEvidenceAudit.includes("real delivered push-notification evidence"),
  },
  {
    label: "Android navigation intents keep device maps native-first",
    ok:
      packageJson.includes('"native:android-navigation-intents": "node scripts/native-android-navigation-intents.mjs"') &&
      androidNavigationIntents.includes("androidDeviceMapsIntent(geoUrl)") &&
      androidNavigationIntents.includes("androidGoogleMapsIntent(googleMapsUrl)") &&
      androidNavigationIntents.includes("androidGoogleNavigationUrl(safeLat, safeLon)") &&
      androidNavigationIntents.includes("ANDROID_WAZE_PACKAGE") &&
      androidNavigationIntents.includes("Apple Maps preference remains available on Android as web handoff") &&
      androidNavigationIntents.includes("browser URL only when a native intent fails") &&
      nativeEvidenceAudit.includes("Android navigation intents") &&
      nativeEvidenceAudit.includes("latestAndroidNavigationIntents"),
  },
  {
    label: "native single-point map camera uses a bounded region instead of fit-to-one-point",
    ok:
      nativeMap.includes("cameraCoordinates.length === 1") &&
      nativeMap.includes("regionForPoint(cameraCoordinates[0])") &&
      nativeMap.indexOf("cameraCoordinates.length === 1") < nativeMap.indexOf("fitToCoordinates"),
  },
  {
    label: "Android Maps key fix packet preserves exact package and fingerprint handoff",
    ok:
      packageJson.includes('"native:android-maps-key-fix": "node scripts/android-maps-key-fix-packet.mjs"') &&
      androidMapsKeyFix.includes("const scriptDir = dirname(fileURLToPath(import.meta.url));") &&
      androidMapsKeyFix.includes('const mobileRoot = resolve(scriptDir, "..");') &&
      androidMapsKeyFix.includes('const repoRoot = resolve(mobileRoot, "..");') &&
      androidMapsKeyFix.includes("function resolveInputPath(value)") &&
      androidMapsKeyFix.includes("Maps SDK for Android") &&
      androidMapsKeyFix.includes("sha1Fingerprint") &&
      androidMapsKeyFix.includes('"android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"') &&
      androidMapsKeyFix.includes("androidStudioJavaHome") &&
      androidMapsKeyFix.includes("same embedded key") &&
      androidMapsKeyFix.includes("GoogleCertificatesRslt") &&
      androidMapsKeyFix.includes("developers.google.com/maps/documentation/android-sdk/get-api-key"),
  },
  {
    label: "Android Gradle wrapper avoids current React Native Gradle 9 toolchain break",
    ok:
      nativeGenerationContract.android.supportedGradleMajor === 8 &&
      nativeValidationPreflight.includes("Tracked native generation contract requires Expo-compatible Gradle 8") &&
      nativeValidationPreflight.includes("Generated Android Gradle wrapper is available and matches the tracked contract") &&
      nativeValidationPreflight.includes("Gradle 9 currently breaks the React Native toolchain resolver") &&
      nativeValidationPreflight.includes("androidGradleWrapperIsCompatible"),
  },
  {
    label: "native map/geocode parity checker keeps screenshot and XML evidence paired",
    ok:
      nativeMapGeocodeParity.includes("siblingScreenshotForXml(xmlPath)") &&
      nativeMapGeocodeParity.includes("evidenceStem(screenshotPath) !== evidenceStem(xmlPath)") &&
      nativeMapGeocodeParity.includes("screenshot/XML evidence must come from the same packet stem") &&
      !nativeMapGeocodeParity.includes("/ev-route|route|plan|pixel/i"),
  },
  {
    label: "native evidence audit is cwd-independent and honest about missing artefacts",
    ok:
      packageJson.includes('"native:evidence-audit": "node scripts/native-current-evidence-audit.mjs"') &&
      nativeEvidenceAudit.includes("const scriptDir = path.dirname(fileURLToPath(import.meta.url));") &&
      nativeEvidenceAudit.includes('const mobileRoot = path.resolve(scriptDir, "..");') &&
      nativeEvidenceAudit.includes('const repoRoot = path.resolve(mobileRoot, "..");') &&
      nativeEvidenceAudit.includes("const artifactsDirs = [") &&
      nativeEvidenceAudit.includes('const localDebugApk = path.resolve(mobileRoot, "android/app/build/outputs/apk/debug/app-debug.apk");') &&
      nativeEvidenceAudit.includes("const latestAndroidDebugApks = existsSync(localDebugApk) ? [localDebugApk] : [];") &&
      nativeEvidenceAudit.includes("Android preview APK") &&
      nativeEvidenceAudit.includes("Android local standalone APK") &&
      nativeEvidenceAudit.includes("Android notification readiness") &&
      nativeEvidenceAudit.includes("Android route-watch backend sync smoke") &&
      nativeEvidenceAudit.includes("latestAndroidNotificationReadiness") &&
      nativeEvidenceAudit.includes("latestAndroidAlertSync") &&
      nativeEvidenceAudit.includes("latestExcludedProductionAlertSync") &&
      nativeEvidenceAudit.includes("It does not validate PR #30's account-free Preview contract.") &&
      nativeEvidenceAudit.includes("Production-targeted alert sync reports do not satisfy the account-free PR #30 Preview lane.") &&
      nativeEvidenceAudit.includes("fuel-path-local-standalone") &&
      nativeEvidenceAudit.includes("Android debug APK") &&
      nativeEvidenceAudit.includes('path.resolve(repoRoot, "native-artifacts")') &&
      nativeEvidenceAudit.includes('path.resolve(mobileRoot, "native-artifacts")') &&
      nativeEvidenceAudit.includes("A local Android debug APK is discoverable and hashable") &&
      nativeEvidenceAudit.includes("No local native APK or iOS simulator tarball artefact is currently discoverable") &&
      nativeEvidenceAudit.includes("Android notification readiness and route-watch backend sync evidence are separate from real delivered push-notification evidence."),
  },
  {
    label: "Android cold-start and route-notification stress evidence are cwd-independent",
    ok:
      packageJson.includes('"native:android-cold-start-smoke": "node scripts/native-android-cold-start-smoke.mjs"') &&
      packageJson.includes('"stress:route-notification-schedule": "node scripts/stress-route-notification-schedule.mjs"') &&
      androidColdStartSmoke.includes("const scriptDir = path.dirname(fileURLToPath(import.meta.url));") &&
      androidColdStartSmoke.includes('const mobileRoot = path.resolve(scriptDir, "..");') &&
      androidColdStartSmoke.includes('const repoRoot = path.resolve(mobileRoot, "..");') &&
      androidColdStartSmoke.includes("function resolveInputPath(value)") &&
      androidColdStartSmoke.includes("maxBuffer: 16 * 1024 * 1024") &&
      androidColdStartSmoke.includes("const allowDebugArtifact = args.has(\"--allow-debug-artifact\")") &&
      androidColdStartSmoke.includes("FUEL_PATH_ALLOW_DEBUG_COLD_START") &&
      androidColdStartSmoke.includes("Preview or release APK artifact required") &&
      androidColdStartSmoke.includes("Unable to load script") &&
      androidColdStartSmoke.includes("packager does not seem to be running") &&
      androidColdStartSmoke.includes("captureForegroundResume(timestamp, settleMs)") &&
      androidColdStartSmoke.includes('adbCommand(["shell", "input", "keyevent", "3"])') &&
      androidColdStartSmoke.includes("Foreground resume: ${resumeResult.status}") &&
      androidColdStartSmoke.includes("android-cold-start-smoke-${stamp}-foreground-resume.png") &&
      androidColdStartSmoke.includes("not a deep process-death restore test") &&
      androidColdStartSmoke.includes('Status: ${failureLines.length ? "failed"') &&
      androidColdStartSmoke.includes("function isMapCredentialWarningLine(line)") &&
      androidColdStartSmoke.includes("## Map warning lines") &&
      androidColdStartSmoke.includes('path.resolve(repoRoot, "native-artifacts")') &&
      androidColdStartSmoke.includes('path.resolve(mobileRoot, "native-artifacts")') &&
      androidColdStartSmoke.includes('const localDebugApk = path.resolve(mobileRoot, "android/app/build/outputs/apk/debug/app-debug.apk");') &&
      routeNotificationScheduleStress.includes("const scriptDir = path.dirname(fileURLToPath(import.meta.url));") &&
      routeNotificationScheduleStress.includes('const mobileRoot = path.resolve(scriptDir, "..");') &&
      routeNotificationScheduleStress.includes('const repoRoot = path.resolve(mobileRoot, "..");'),
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

function readPngDimensions(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error(`${relativePath} is not a PNG file.`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readScreenSource(defaultPath, viewModelPath) {
  const viewModelSource = path.join(root, viewModelPath);
  if (fs.existsSync(viewModelSource)) {
    return fs.readFileSync(viewModelSource, "utf8");
  }
  return read(defaultPath);
}
