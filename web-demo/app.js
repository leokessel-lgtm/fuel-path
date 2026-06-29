const DATA_URLS = {
  routes: "/prototype/data/routes.json",
  stations: "/prototype/data/sample-stations.json",
};
const API_STATUS_URL = "/api/status";
const API_SCORE_URL = "/api/score";
const API_STATIONS_URL = "/api/stations";
const API_GEOCODE_URL = "/api/geocode";
const API_ROUTE_URL = "/api/route";

const GOOGLE_MAPS_SCRIPT_ID = "fuel-path-google-maps-script";
const GOOGLE_MAPS_CALLBACK = "__fuelPathGoogleMapsReady";
const SAMPLE_NOW = new Date("2026-06-13T08:00:00+10:00");
const ROUTE_RESULT_INITIAL_LIMIT = 8;
const ROUTE_RESULT_EXPANDED_LIMIT = 20;
const ADDRESS_SUGGESTION_MIN_LENGTH = 3;
const ADDRESS_SUGGESTION_DEBOUNCE_MS = 420;
const RECOMMENDATION_MAX_PRICE_AGE_HOURS = 48;
const DEFAULT_TRIP = {
  from: "Parramatta NSW",
  to: "Sydney CBD NSW",
  fuel: "U91",
  tankLitres: 55,
  economy: 8.2,
  tankPercent: 45,
  reserveKm: 35,
};
const FUELS = ["E10", "U91", "P95", "P98", "DL", "PDL"];
const BRAND_ICON_BASE_URL = "./assets/brand-icons/";
const BRAND_STYLES = {
  "eg ampol": {
    label: "EG Ampol",
    initials: "EG",
    color: "#173f8a",
    icon: "eg-ampol.png",
    aliases: ["eg australia", "eg fuel", "eg group"],
  },
  reddy: {
    label: "Reddy Express",
    initials: "R",
    color: "#df2f2f",
    icon: "reddy.ico",
    aliases: ["shell reddy", "reddy express", "coles express"],
  },
  ampol: { label: "Ampol", initials: "A", color: "#e53935", icon: "ampol.ico" },
  caltex: { label: "Caltex", initials: "C", color: "#1565c0", icon: "caltex.png" },
  shell: { label: "Shell", initials: "S", color: "#f6b800", icon: "shell.png" },
  bp: { label: "BP", initials: "BP", color: "#138a36", icon: "bp.ico", aliases: ["bp connect"] },
  "7-eleven": {
    label: "7-Eleven",
    initials: "7",
    color: "#ef6c00",
    icon: "seven-eleven.ico",
    aliases: ["7 eleven", "7eleven", "711"],
  },
  united: { label: "United", initials: "U", color: "#1e63b5", icon: "united.png" },
  metro: {
    label: "Metro",
    initials: "M",
    color: "#1b7f5c",
    icon: "metro.png",
    aliases: ["metro petroleum", "metro fuel"],
  },
  mobil: { label: "Mobil", initials: "M", color: "#1f4f9c", icon: "mobil.ico" },
  costco: {
    label: "Costco",
    initials: "C",
    color: "#005dab",
    icon: "costco.ico",
    aliases: ["costco fuel", "costco wholesale"],
  },
  speedway: { label: "Speedway", initials: "SW", color: "#5f2d86", icon: "speedway.png" },
  pearl: {
    label: "Pearl Energy",
    initials: "P",
    color: "#1597d3",
    icon: "pearl.png",
    aliases: ["pearl energy"],
  },
  "u-go": {
    label: "U-GO",
    initials: "UG",
    color: "#ff8200",
    icon: "ugo.png",
    aliases: ["u go", "ugo"],
  },
  enhance: { label: "Enhance", initials: "E", color: "#009b4d", icon: "enhance.png" },
  astron: { label: "ASTRON", initials: "A", color: "#f26b21", icon: "astron.png", aliases: ["astron energy"] },
  arko: {
    label: "ARKO Energy",
    initials: "AE",
    color: "#2f95c8",
    icon: "arko.png",
    aliases: ["arko energy"],
  },
  liberty: {
    label: "Liberty",
    initials: "L",
    color: "#0b5ea8",
    icon: "liberty.png",
    aliases: ["liberty oil", "liberty convenience"],
  },
  ultra: {
    label: "Ultra Petroleum",
    initials: "UP",
    color: "#f36b2a",
    icon: "ultra.png",
    aliases: ["ultra petroleum"],
  },
  apw: { label: "APW", initials: "AP", color: "#222970", icon: "apw.png", aliases: ["apw fuel"] },
  inland: {
    label: "Inland Petroleum",
    initials: "IP",
    color: "#b59a20",
    icon: "inland.png",
    aliases: ["inland petroleum"],
  },
  apco: { label: "APCO", initials: "AP", color: "#0072bc", icon: "apco.png" },
  budget: {
    label: "Budget",
    initials: "B",
    color: "#0f5c8c",
    icon: "budget.png",
    aliases: ["budget petrol"],
  },
  independent: {
    label: "Independent",
    initials: "I",
    color: "#2c5f5c",
    icon: "independent.png",
    aliases: [
      "apex petroleum",
      "aus petroleum",
      "fairfield fuel",
      "rebel petrol",
      "rural fuel",
      "south west",
      "transwest fuels",
      "woodham petroleum",
      "bargo petroleum",
      "bangalow general store",
      "bendalong general store",
      "bribbaree servo",
      "greens mandurama",
      "highland fuels",
      "hopefuel",
      "the major",
      "tinonee general store",
    ],
  },
  prime: { label: "Prime", initials: "P", color: "#247a4d", icon: "generic-fuel.png" },
  powerfuel: { label: "Powerfuel", initials: "PF", color: "#247a4d", icon: "generic-fuel.png" },
  supreme: {
    label: "Supreme Fuel",
    initials: "SF",
    color: "#247a4d",
    icon: "generic-fuel.png",
    aliases: ["supreme fuel", "supreme petroleum"],
  },
  temco: {
    label: "TEMCO Petroleum",
    initials: "TP",
    color: "#247a4d",
    icon: "generic-fuel.png",
    aliases: ["temco petroleum"],
  },
  "ez fuel": { label: "EZ Fuel", initials: "EZ", color: "#247a4d", icon: "generic-fuel.png" },
  coral: {
    label: "Coral Petroleum",
    initials: "CP",
    color: "#247a4d",
    icon: "generic-fuel.png",
    aliases: ["coral petroleum"],
  },
  payless: {
    label: "Payless Fuel",
    initials: "PF",
    color: "#247a4d",
    icon: "generic-fuel.png",
    aliases: ["payless fuel"],
  },
  matex: { label: "MATEX Fuel", initials: "MF", color: "#247a4d", icon: "generic-fuel.png", aliases: ["matex fuel"] },
  calvi: { label: "Calvi Petrol", initials: "CP", color: "#247a4d", icon: "generic-fuel.png", aliases: ["calvi petrol"] },
  westside: { label: "Westside", initials: "W", color: "#247a4d", icon: "generic-fuel.png" },
  boost: { label: "Boost Fuel", initials: "BF", color: "#247a4d", icon: "generic-fuel.png", aliases: ["boost fuel"] },
  roo: { label: "Roo Petroleum", initials: "RP", color: "#247a4d", icon: "generic-fuel.png", aliases: ["roo petroleum"] },
  npg: { label: "NPG Retail", initials: "N", color: "#247a4d", icon: "generic-fuel.png", aliases: ["npg retail"] },
  lowes: { label: "Lowes", initials: "L", color: "#247a4d", icon: "generic-fuel.png" },
  warehouse: { label: "Warehouse", initials: "W", color: "#6a4fb3", icon: "warehouse.svg" },
  highway: { label: "Highway", initials: "H", color: "#795548", icon: "highway.svg" },
  truck: { label: "Truck stop", initials: "T", color: "#795548", icon: "highway.svg" },
  regional: { label: "Regional", initials: "R", color: "#607d8b", icon: "regional.svg" },
  capital: { label: "Capital", initials: "C", color: "#607d8b", icon: "regional.svg" },
  service: { label: "Service", initials: "S", color: "#00838f", icon: "service.svg" },
  express: { label: "Express", initials: "EX", color: "#00838f", icon: "service.svg" },
  city: { label: "City", initials: "C", color: "#00838f", icon: "service.svg" },
  value: { label: "Value", initials: "V", color: "#247a4d", icon: "value.svg" },
};
const VEHICLE_PROFILES = {
  "NSW:FP123": {
    rego: "FP123",
    state: "NSW",
    name: "Toyota Corolla Ascent Sport",
    type: "Small car",
    fuel: "U91",
    tankLitres: 50,
    economy: 6.5,
    reserveKm: 35,
    tankPercent: 45,
  },
  "NSW:UTE456": {
    rego: "UTE456",
    state: "NSW",
    name: "Toyota HiLux dual cab",
    type: "Ute",
    fuel: "DL",
    tankLitres: 80,
    economy: 8.8,
    reserveKm: 60,
    tankPercent: 50,
  },
  "NSW:VAN789": {
    rego: "VAN789",
    state: "NSW",
    name: "Hyundai iLoad",
    type: "Van",
    fuel: "DL",
    tankLitres: 75,
    economy: 9.9,
    reserveKm: 55,
    tankPercent: 50,
  },
  "ACT:ACT321": {
    rego: "ACT321",
    state: "ACT",
    name: "Mazda CX-5",
    type: "SUV",
    fuel: "U91",
    tankLitres: 56,
    economy: 7.8,
    reserveKm: 45,
    tankPercent: 40,
  },
};
const DISCOUNT_PROGRAMS = {
  everyday_rewards: {
    id: "everyday_rewards",
    label: "Everyday Rewards",
    shortLabel: "Everyday Rewards",
    caveat: "Manual wallet flag. Usually offer-based and not assumed everywhere.",
  },
  flybuys: {
    id: "flybuys",
    label: "Flybuys docket",
    shortLabel: "Flybuys",
    caveat: "Manual docket or offer eligibility. Confirm at the pump.",
  },
  nrma_ampol: {
    id: "nrma_ampol",
    label: "NRMA / Ampol",
    shortLabel: "NRMA / Ampol",
    caveat: "Applies only where the configured member offer is accepted.",
  },
  fleet_card: {
    id: "fleet_card",
    label: "Fleet card",
    shortLabel: "Fleet card",
    caveat: "Represents an approved-card or negotiated fleet rule.",
  },
  linkt_rewards: {
    id: "linkt_rewards",
    label: "Linkt Rewards",
    shortLabel: "Linkt",
    caveat: "Offer-based toll account reward. Usually redeemed from the Linkt app.",
  },
  linkt_bonus: {
    id: "linkt_bonus",
    label: "Linkt toll-trip bonus",
    shortLabel: "Linkt bonus",
    caveat: "Time-limited toll-trip offer. Show only when the user confirms eligibility.",
  },
  etoll_account: {
    id: "etoll_account",
    label: "E-Toll account",
    shortLabel: "E-Toll",
    caveat: "Captured for toll cost/rebate logic. No automatic fuel c/L discount assumed.",
  },
};
const DISCOUNT_RULES = [
  {
    id: "everyday_rewards",
    label: "Everyday Rewards",
    centsPerLitre: 4.0,
    brandIncludes: ["eg ampol", "ampol", "caltex"],
  },
  {
    id: "flybuys",
    label: "Flybuys docket",
    centsPerLitre: 4.0,
    brandIncludes: ["shell", "reddy", "coles express"],
  },
  {
    id: "nrma_ampol",
    label: "NRMA / Ampol",
    centsPerLitre: 5.0,
    brandIncludes: ["ampol", "caltex"],
  },
  {
    id: "fleet_card",
    label: "Fleet card",
    centsPerLitre: 3.0,
    brandIncludes: ["ampol", "caltex", "bp", "shell", "reddy", "united", "metro", "mobil"],
  },
  {
    id: "linkt_rewards",
    label: "Linkt Rewards",
    centsPerLitre: 6.0,
    brandIncludes: ["7-eleven"],
  },
  {
    id: "linkt_bonus",
    label: "Linkt toll-trip bonus",
    centsPerLitre: 26.0,
    brandIncludes: ["7-eleven"],
  },
];
const SAVED_ROUTE_PROFILES = {
  "parramatta-cbd": {
    id: "parramatta-cbd",
    name: "Parramatta to Sydney CBD",
    from: "Parramatta NSW",
    to: "Sydney CBD NSW",
    fuel: "U91",
    tankPercent: 45,
    radiusKm: 8,
    cadence: "Weekdays before 7:30 am",
    mode: "Commute",
    strategy: "Alert when the saving beats the detour and your tank is below half.",
    alertRules: {
      minSavingDollars: 3,
      maxDetourMinutes: 6,
      tankBelowPercent: 55,
    },
  },
  "canberra-sydney": {
    id: "canberra-sydney",
    name: "Canberra to Sydney",
    from: "Canberra ACT",
    to: "Sydney CBD NSW",
    fuel: "U91",
    tankPercent: 40,
    radiusKm: 12,
    cadence: "Road trip check before departure",
    mode: "Safe regional",
    strategy: "No ACT cycle signal. Prioritise range, open stations and public prices.",
    alertRules: {
      minSavingDollars: 5,
      maxDetourMinutes: 8,
      tankBelowPercent: 60,
    },
  },
};

const state = {
  routes: [],
  stations: [],
  fuel: "U91",
  result: null,
  vehicleProfile: null,
  apiAvailable: false,
  apiDefaultSource: "sample",
  mapProvider: "osm",
  googleMapsApiKey: "",
  googleMapsPromise: null,
  googleMapsError: null,
  googleDirectionsEnabled: false,
  googleDirectionsService: null,
  googleDirectionsBlocked: false,
  googleRouteCache: new Map(),
  openRouteCache: new Map(),
  googleRouteError: null,
  routeResolveError: null,
  routeDirty: false,
  plannedRoute: null,
  tripPlaces: {
    from: null,
    to: null,
  },
  activeSavedRouteId: "parramatta-cbd",
  savedRouteSuggestionsOpen: false,
  activeAddressField: null,
  addressSuggestions: [],
  addressSuggestionQuery: "",
  addressSuggestionKind: null,
  addressSuggestionLoading: false,
  addressSuggestionError: "",
  addressSuggestionTimer: null,
  routeSearchExpanded: false,
  activeRouteKey: "",
  activeTab: "plan",
  activeView: "route",
  routeSort: "smart",
  routeResultsExpanded: false,
  nearbySort: "",
  brandFilterTouched: false,
  mapCentreMode: "route",
  deviceCentre: null,
  nearbyLocationState: "idle",
  nearbyFuel: "U91",
  nearbyDetailOpen: false,
  selectedBrands: new Set(),
  selectedStationCode: null,
  selectedRouteStationKey: null,
  exploreStations: [],
  routeContextStations: [],
  routeMap: null,
  routeMapProvider: null,
  routeMarkers: null,
  routePolyline: null,
  routeGoogleOverlays: [],
  routeInfoWindow: null,
  exploreMap: null,
  exploreMapProvider: null,
  exploreMarkers: null,
  exploreGoogleOverlays: [],
  exploreInfoWindow: null,
  routeMapFocusStationKey: null,
  focusRouteResultsAfterRender: false,
  stationCache: new Map(),
  forcePriceRefresh: false,
  renderId: 0,
};

const els = {
  fromAddress: document.querySelector("#fromAddress"),
  toAddress: document.querySelector("#toAddress"),
  demoAddressOptions: document.querySelector("#demoAddressOptions"),
  routeMatchStatus: document.querySelector("#routeMatchStatus"),
  planRoute: document.querySelector("#planRoute"),
  routeResultsPanel: document.querySelector("#routeResultsPanel"),
  routeSearchToggle: document.querySelector("#routeSearchToggle"),
  routeSearchExpanded: document.querySelector("#routeSearchExpanded"),
  routeSearchSummary: document.querySelector("#routeSearchSummary"),
  routeSearchMeta: document.querySelector("#routeSearchMeta"),
  savedRouteSelect: document.querySelector("#savedRouteSelect"),
  savedRouteSuggestions: document.querySelector("#savedRouteSuggestions"),
  fuelSelect: document.querySelector("#fuelSelect"),
  fuelButtons: document.querySelector("#fuelButtons"),
  planVehicleCard: document.querySelector("#planVehicleCard"),
  nearbyFuelSelect: document.querySelector("#nearbyFuelSelect"),
  nearbyCentreLabel: document.querySelector("#nearbyCentreLabel"),
  nearbyPanel: document.querySelector(".nearby-panel"),
  nearbySortTabs: document.querySelector("#nearbySortTabs"),
  brandFilters: document.querySelector("#brandFilters"),
  selectAllBrands: document.querySelector("#selectAllBrands"),
  clearBrands: document.querySelector("#clearBrands"),
  vehicleLookupForm: document.querySelector("#vehicleLookupForm"),
  regoState: document.querySelector("#regoState"),
  regoInput: document.querySelector("#regoInput"),
  vehicleLookupStatus: document.querySelector("#vehicleLookupStatus"),
  vehicleProfile: document.querySelector("#vehicleProfile"),
  vehicleProfileBadge: document.querySelector("#vehicleProfileBadge"),
  applyVehicle: document.querySelector("#applyVehicle"),
  clearVehicle: document.querySelector("#clearVehicle"),
  tankLitres: document.querySelector("#tankLitres"),
  economy: document.querySelector("#economy"),
  tankPercent: document.querySelector("#tankPercent"),
  tankPercentOutput: document.querySelector("#tankPercentOutput"),
  reserveKm: document.querySelector("#reserveKm"),
  corridorKm: document.querySelector("#corridorKm"),
  mapRadiusKm: document.querySelector("#mapRadiusKm"),
  nearbyRadiusKm: document.querySelector("#nearbyRadiusKm"),
  includeMemberPrices: document.querySelector("#includeMemberPrices"),
  includeClosed: document.querySelector("#includeClosed"),
  controls: document.querySelector("#controls"),
  workspaceTabs: document.querySelector("#workspaceTabs"),
  viewButtons: document.querySelector("#viewButtons"),
  mapPanelTitle: document.querySelector("#mapPanelTitle"),
  routeMapView: document.querySelector("#routeMapView"),
  exploreMapView: document.querySelector("#exploreMapView"),
  exploreMap: document.querySelector("#exploreMap"),
  centreNearbyLocation: document.querySelector("#centreNearbyLocation"),
  mapFallback: document.querySelector("#mapFallback"),
  selectedStation: document.querySelector("#selectedStation"),
  nearbyRows: document.querySelector("#nearbyRows"),
  modePill: document.querySelector("#modePill"),
  title: document.querySelector("#recommendationTitle"),
  reason: document.querySelector("#recommendationReason"),
  why: document.querySelector("#recommendationWhy"),
  explain: document.querySelector("#decisionExplain"),
  metrics: document.querySelector("#decisionMetrics"),
  warnings: document.querySelector("#decisionWarnings"),
  commuteInsight: document.querySelector("#commuteInsight"),
  commuteImpact: document.querySelector("#commuteImpact"),
  commuteTitle: document.querySelector("#commuteTitle"),
  applyCommute: document.querySelector("#applyCommute"),
  savedRouteSignal: document.querySelector("#savedRouteSignal"),
  savedRouteList: document.querySelector("#savedRouteList"),
  cycleTitle: document.querySelector("#cycleTitle"),
  cycleReason: document.querySelector("#cycleReason"),
  cycleConfidence: document.querySelector("#cycleConfidence"),
  sourceStatus: document.querySelector("#sourceStatus"),
  sourceDetails: document.querySelector("#sourceDetails"),
  summaryStats: document.querySelector("#summaryStats"),
  refreshPrices: document.querySelector("#refreshPrices"),
  rows: document.querySelector("#stationRows"),
  routeSelectedStation: document.querySelector("#routeSelectedStation"),
  routeSort: document.querySelector("#routeSort"),
  visual: document.querySelector("#routeVisual"),
  routeMapFallback: document.querySelector("#routeMapFallback"),
  debugButton: document.querySelector("#toggleDebug"),
  debugJson: document.querySelector("#debugJson"),
};

const tabPanels = {
  plan: document.querySelector("#panel-plan"),
  nearby: document.querySelector("#panel-nearby"),
  account: document.querySelector("#panel-account"),
};

function shouldUseGoogleMaps() {
  return state.mapProvider === "google" && Boolean(state.googleMapsApiKey) && !state.googleMapsError;
}

function mapProviderSummary() {
  if (state.mapProvider === "google" && !state.googleMapsError) {
    return "Google Maps";
  }
  if (state.googleMapsError) {
    return "OpenStreetMap fallback";
  }
  return "OpenStreetMap";
}

function loadGoogleMaps() {
  if (!state.googleMapsApiKey) {
    return Promise.reject(new Error("Google Maps key is not configured."));
  }
  if (window.google?.maps?.Map) {
    return Promise.resolve(window.google.maps);
  }
  if (state.googleMapsPromise) {
    return state.googleMapsPromise;
  }

  state.googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`#${GOOGLE_MAPS_SCRIPT_ID}`);
    window[GOOGLE_MAPS_CALLBACK] = () => {
      delete window[GOOGLE_MAPS_CALLBACK];
      if (window.google?.maps?.Map) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps loaded without the Maps library."));
      }
    };

    if (existingScript) {
      return;
    }

    const params = new URLSearchParams({
      key: state.googleMapsApiKey,
      v: "weekly",
      loading: "async",
      libraries: "marker,places",
      callback: GOOGLE_MAPS_CALLBACK,
    });
    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.onerror = () => {
      delete window[GOOGLE_MAPS_CALLBACK];
      reject(new Error("Google Maps could not load."));
    };
    document.head.append(script);
  });

  return state.googleMapsPromise;
}

function prepareMapContainer(kind, provider) {
  const element = kind === "route" ? els.visual : els.exploreMap;
  const mapKey = kind === "route" ? "routeMap" : "exploreMap";
  const markerKey = kind === "route" ? "routeMarkers" : "exploreMarkers";
  const providerKey = kind === "route" ? "routeMapProvider" : "exploreMapProvider";

  if (state[providerKey] === provider) {
    return;
  }

  if (state[providerKey] === "google") {
    clearGoogleOverlays(kind);
  }
  if (state[providerKey] === "osm" && state[mapKey]?.remove) {
    state[mapKey].remove();
  }

  element.innerHTML = "";
  state[mapKey] = null;
  state[markerKey] = null;
  state[providerKey] = provider;
}

function clearGoogleOverlays(kind) {
  const overlaysKey = kind === "route" ? "routeGoogleOverlays" : "exploreGoogleOverlays";
  state[overlaysKey].forEach((overlay) => {
    if (overlay?.setMap) {
      overlay.setMap(null);
    } else if (overlay && "map" in overlay) {
      overlay.map = null;
    }
  });
  state[overlaysKey] = [];

  const infoWindow = kind === "route" ? state.routeInfoWindow : state.exploreInfoWindow;
  infoWindow?.close?.();
}

function refreshMapSize(kind) {
  const map = kind === "route" ? state.routeMap : state.exploreMap;
  const provider = kind === "route" ? state.routeMapProvider : state.exploreMapProvider;
  if (!map) return;
  if (provider === "osm" && map.invalidateSize) {
    map.invalidateSize();
  }
  if (provider === "google" && window.google?.maps?.event) {
    window.google.maps.event.trigger(map, "resize");
  }
}

function googlePoint(point) {
  return { lat: Number(point.lat), lng: Number(point.lon) };
}

function mapPinColor(tone) {
  if (tone === "pin-selected") return "#17201b";
  if (tone === "pin-cheap") return "#247a4d";
  if (tone === "pin-route" || tone === "pin-standard") return "#2d5f9a";
  if (tone === "pin-nearby") return "#6e7d75";
  if (tone === "pin-risk") return "#a33a2a";
  if (tone === "pin-member") return "#b36b00";
  if (tone === "pin-muted") return "#7d8782";
  return "#2d5f9a";
}

function markerSvgUrl(tone, rank, price, station = null) {
  const fill = mapPinColor(tone);
  const style = brandStyle(station ? stationBrand(station) : "");
  const rankMarkup = rank
    ? `<text x="39" y="17" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="800">#${rank}</text>
      <text x="39" y="31" fill="white" font-family="Arial, sans-serif" font-size="13" font-weight="900">${price}</text>`
    : `<text x="39" y="26" fill="white" font-family="Arial, sans-serif" font-size="13" font-weight="900">${price}</text>`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="78" height="48" viewBox="0 0 78 48">
      <rect x="1" y="1" width="76" height="40" rx="20" fill="${fill}" stroke="white" stroke-width="2"/>
      <path d="M39 47 L31 40 H47 Z" fill="${fill}" stroke="white" stroke-width="2"/>
      <circle cx="18" cy="21" r="12" fill="white"/>
      <text x="18" y="25" text-anchor="middle" fill="${style.color}" font-family="Arial, sans-serif" font-size="10" font-weight="900">${style.initials}</text>
      ${rankMarkup}
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function mapPinLabelHtml(station, price, { rank = null, nearby = false } = {}) {
  const rankHtml = rank ? `<b>${escapeHtml(rank)}</b>` : "";
  const labelClass = nearby ? "route-pin-label nearby-pin-label" : "route-pin-label";
  const brandClass = nearby ? "pin-brand nearby-pin-brand" : "pin-brand";
  return `<span class="${labelClass}">${brandMarkHtml(station, brandClass)}${rankHtml}<em>${escapeHtml(price)}</em></span>`;
}

function googlePriceMarkerContent({ tone, label, rank = null, station, nearby = false }) {
  const content = document.createElement("div");
  content.className = `price-pin google-dom-price-pin ${tone} ${nearby ? "nearby-price-pin" : ""}`.trim();
  content.innerHTML = mapPinLabelHtml(station, label, { rank, nearby });
  return content;
}

function makeMapMarkerDecorative(marker, dataset = {}) {
  marker.on("add", () => {
    const markerElement = marker.getElement();
    if (!markerElement) return;
    Object.entries(dataset).forEach(([key, value]) => {
      markerElement.dataset[key] = value;
    });
    if (markerElement.title) {
      markerElement.dataset.markerTitle = markerElement.title;
      markerElement.removeAttribute("title");
    }
    markerElement.tabIndex = -1;
    markerElement.setAttribute("aria-hidden", "true");
  });
}

function createGooglePriceMarker({ map, position, tone, label, title, rank = null, station = null, nearby = false }) {
  const maps = window.google.maps;
  if (station && maps.marker?.AdvancedMarkerElement) {
    return new maps.marker.AdvancedMarkerElement({
      map,
      position,
      title,
      content: googlePriceMarkerContent({ tone, label, rank, station, nearby }),
      anchorLeft: "-50%",
      anchorTop: "-100%",
    });
  }
  if (station) {
    return new maps.Marker({
      map,
      position,
      title,
      icon: {
        url: markerSvgUrl(tone, rank, label, station),
        scaledSize: new maps.Size(78, 48),
        anchor: new maps.Point(39, 47),
      },
      optimized: false,
    });
  }
  return new maps.Marker({
    map,
    position,
    title,
    label: {
      text: label,
      color: "#ffffff",
      fontSize: "11px",
      fontWeight: "800",
      className: "google-price-label",
    },
    icon: {
      path: maps.SymbolPath.CIRCLE,
      fillColor: mapPinColor(tone),
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale: label.length > 4 ? 18 : 16,
    },
    optimized: false,
  });
}

function createGooglePointMarker({ map, position, title }) {
  const maps = window.google.maps;
  return new maps.Marker({
    map,
    position,
    title,
    icon: {
      path: maps.SymbolPath.CIRCLE,
      fillColor: "#ffffff",
      fillOpacity: 1,
      strokeColor: "#17201b",
      strokeWeight: 3,
      scale: 7,
    },
  });
}

function normaliseAddressText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function routeAddressOptions() {
  const places = new Map();
  state.routes.forEach((route) => {
    route.points.forEach((point) => {
      const key = normaliseAddressText(point.label);
      if (!places.has(key)) {
        places.set(key, {
          label: point.label,
          lat: Number(point.lat),
          lon: Number(point.lon),
        });
      }
    });
  });
  return Array.from(places.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function populateAddressOptions() {
  const options = [
    ...routeAddressOptions().map((place) => addressOptionValue(place)),
    ...state.addressSuggestions.map((place) => place.inputValue || place.label),
  ];
  const unique = Array.from(new Set(options.filter(Boolean)));
  els.demoAddressOptions.innerHTML = unique
    .map((place) => `<option value="${escapeHtml(addressOptionValue(place))}"></option>`)
    .join("");
}

function addressOptionValue(place) {
  if (typeof place === "string") return place;
  if (/\b(NSW|ACT|VIC|QLD|SA|WA|TAS|NT)\b/i.test(place.label)) {
    return place.label;
  }
  return `${place.label} ${stateCodeForPlace(place)}`;
}

function stateCodeForPlace(place) {
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  if (lat <= -35 && lat >= -36 && lon >= 148.5 && lon <= 149.5) {
    return "ACT";
  }
  return "NSW";
}

function placeForInput(kind) {
  const input = addressInputForKind(kind);
  const value = input.value.trim();
  const selectedPlace = state.tripPlaces[kind];
  if (selectedPlace && selectedPlace.inputValue === value) {
    return selectedPlace;
  }

  const normalised = normaliseAddressText(value);
  if (!normalised) return null;
  return routeAddressOptions().find((place) => {
    const label = normaliseAddressText(place.label);
    return normalised.includes(label) || label.includes(normalised);
  }) || null;
}

function distanceToRouteEndpoints(fromPoint, toPoint, route, reversed) {
  const points = reversed ? [...route.points].reverse() : route.points;
  const start = points[0];
  const end = points[points.length - 1];
  const fromDistance = fromPoint ? haversineKm(fromPoint, start) : 0;
  const toDistance = toPoint ? haversineKm(toPoint, end) : 0;
  return fromDistance + toDistance;
}

function resolveTripRoute() {
  const fallback = state.routes[0];
  if (!fallback) return null;

  const fromPoint = placeForInput("from");
  const toPoint = placeForInput("to");
  const fromText = els.fromAddress.value.trim() || DEFAULT_TRIP.from;
  const toText = els.toAddress.value.trim() || DEFAULT_TRIP.to;
  let best = {
    route: fallback,
    reversed: false,
    score: Number.POSITIVE_INFINITY,
  };

  state.routes.forEach((route) => {
    const directScore = distanceToRouteEndpoints(fromPoint, toPoint, route, false);
    if (directScore < best.score) {
      best = { route, reversed: false, score: directScore };
    }
    const reverseScore = distanceToRouteEndpoints(fromPoint, toPoint, route, true);
    if (reverseScore < best.score) {
      best = { route, reversed: true, score: reverseScore };
    }
  });

  const points = best.reversed ? [...best.route.points].reverse() : best.route.points;
  const route = {
    ...best.route,
    points,
    name: `${fromText} to ${toText}`,
    baseRouteName: best.route.name,
    localOnly: best.reversed,
  };
  updateResolvedRoute(route);
  return route;
}

function updateResolvedRoute(route) {
  state.plannedRoute = route;
  const routeKey = `${route.id}:${route.localOnly ? "reversed" : "direct"}`;
  if (state.activeRouteKey !== routeKey) {
    els.corridorKm.value = route.defaultCorridorKm;
    state.activeRouteKey = routeKey;
    state.selectedStationCode = null;
  }
  if (els.routeMatchStatus) {
    if (route.provider === "google") {
      const distance = route.googleDistanceKm ? `${route.googleDistanceKm.toFixed(1)} km` : "driving route";
      const duration = route.googleDurationMin ? `, ${Math.round(route.googleDurationMin)} min` : "";
      const cache = route.cacheHit ? " Cached route." : "";
      els.routeMatchStatus.textContent = `Using Google driving route: ${distance}${duration}. Prices are scored against stations near that route.${cache}`;
      return;
    }
    if (route.provider === "open") {
      const distance = route.googleDistanceKm ? `${route.googleDistanceKm.toFixed(1)} km` : "driving route";
      const duration = route.googleDurationMin ? `, ${Math.round(route.googleDurationMin)} min` : "";
      const googleNote = state.googleRouteError ? ` Google Directions unavailable: ${state.googleRouteError.message}.` : "";
      const cache = route.cacheHit ? " Cached route." : "";
      els.routeMatchStatus.textContent = `Using real address route: ${distance}${duration}.${googleNote}${cache}`;
      return;
    }
    const mode = route.localOnly ? "Using reversed sample corridor" : "Using sample corridor";
    const fallback = state.googleRouteError ? ` Google route unavailable: ${state.googleRouteError.message}.` : "";
    els.routeMatchStatus.textContent = `${mode}: ${route.baseRouteName}.${fallback}`;
  }
}

function markRoutePending() {
  state.routeDirty = true;
  state.selectedStationCode = null;
  state.stationCache.clear();
  if (els.routeMatchStatus) {
    els.routeMatchStatus.textContent = "Address changed. Click Plan route to resolve and score this drive.";
  }
  renderRouteSearchSummary();
  setModePill("Route not planned", "warn");
}

async function resolveTripRouteForRender() {
  if (state.routeDirty && state.plannedRoute) {
    return state.plannedRoute;
  }
  state.routeDirty = false;
  state.routeResolveError = null;
  let googleError = null;
  if (state.googleDirectionsEnabled && shouldUseGoogleMaps() && !state.googleDirectionsBlocked) {
    try {
      const route = await resolveGoogleDrivingRoute();
      state.googleRouteError = null;
      updateResolvedRoute(route);
      return route;
    } catch (error) {
      googleError = error;
      if (/REQUEST_DENIED|not available/i.test(error.message)) {
        state.googleDirectionsBlocked = true;
      }
    }
  }
  try {
    const route = await resolveOpenDrivingRoute();
    state.googleRouteError = googleError;
    updateResolvedRoute(route);
    return route;
  } catch (openError) {
    state.googleRouteError = googleError || openError;
  }
  const error = state.googleRouteError || new Error("Route could not be resolved.");
  state.routeResolveError = error;
  throw error;
}

function routeEndpointForGoogle(kind) {
  const input = kind === "from" ? els.fromAddress : els.toAddress;
  const text = input.value.trim();
  const place = state.tripPlaces[kind];
  if (place && place.inputValue === text && Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
    return { lat: place.lat, lng: place.lon };
  }
  return addressQuery(text);
}

function addressQuery(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const normalised = normaliseAddressText(text);
  if (normalised === "canberra nsw" || normalised === "canberra") {
    return "Canberra ACT, Australia";
  }
  if (/\b(australia|nsw|act|vic|qld|sa|wa|tas|nt)\b/i.test(text)) {
    return text;
  }
  return `${text}, Australia`;
}

function defaultCorridorKmForDistance(distanceKm, fallback = 2.5) {
  if (distanceKm >= 150) return 8;
  if (distanceKm >= 60) return Math.max(5, fallback);
  return fallback;
}

function defaultDetourSpeedKmhForDistance(distanceKm, fallback = 38) {
  return distanceKm >= 120 ? 70 : fallback;
}

async function resolveGoogleDrivingRoute() {
  const fromText = els.fromAddress.value.trim();
  const toText = els.toAddress.value.trim();
  if (!fromText || !toText) {
    throw new Error("Enter a start and destination.");
  }

  const cacheKey = `${normaliseAddressText(fromText)}|${normaliseAddressText(toText)}`;
  if (state.googleRouteCache.has(cacheKey)) {
    return { ...state.googleRouteCache.get(cacheKey), cacheHit: true };
  }

  const maps = await loadGoogleMaps();
  if (!maps.DirectionsService) {
    throw new Error("Google directions are not available.");
  }
  if (!state.googleDirectionsService) {
    state.googleDirectionsService = new maps.DirectionsService();
  }

  const response = await new Promise((resolve, reject) => {
    state.googleDirectionsService.route(
      {
        origin: routeEndpointForGoogle("from"),
        destination: routeEndpointForGoogle("to"),
        travelMode: maps.TravelMode.DRIVING,
        region: "AU",
        provideRouteAlternatives: false,
      },
      (result, status) => {
        if (status === "OK" && result?.routes?.[0]) {
          resolve(result);
          return;
        }
        reject(new Error(`Google directions ${status || "failed"}`));
      },
    );
  });

  const googleRoute = response.routes[0];
  const overviewPath = googleRoute.overview_path || [];
  if (overviewPath.length < 2) {
    throw new Error("Google directions returned no route line.");
  }
  const points = overviewPath.map((point) => ({
    lat: point.lat(),
    lon: point.lng(),
  }));
  points[0].label = fromText;
  points[points.length - 1].label = toText;

  const legs = googleRoute.legs || [];
  const googleDistanceKm =
    legs.reduce((sum, leg) => sum + Number(leg.distance?.value || 0), 0) / 1000;
  const googleDurationMin =
    legs.reduce((sum, leg) => sum + Number(leg.duration?.value || 0), 0) / 60;
  const route = {
    id: `google:${cacheKey}`,
    name: `${fromText} to ${toText}`,
    baseRouteName: googleRoute.summary || "Google driving route",
    provider: "google",
    routeType: "google-driving",
    localOnly: true,
    defaultCorridorKm: defaultCorridorKmForDistance(googleDistanceKm),
    defaultDetourSpeedKmh: defaultDetourSpeedKmhForDistance(googleDistanceKm),
    googleDistanceKm,
    googleDurationMin,
    points,
    cacheHit: false,
  };
  state.googleRouteCache.set(cacheKey, route);
  return route;
}

async function resolveOpenDrivingRoute() {
  const fromText = els.fromAddress.value.trim();
  const toText = els.toAddress.value.trim();
  if (!fromText || !toText) {
    throw new Error("Enter a start and destination.");
  }

  const cacheKey = `${normaliseAddressText(fromText)}|${normaliseAddressText(toText)}`;
  if (state.openRouteCache.has(cacheKey)) {
    return { ...state.openRouteCache.get(cacheKey), cacheHit: true };
  }

  const [fromLocation, toLocation] = await Promise.all([
    resolveRouteLocation("from"),
    resolveRouteLocation("to"),
  ]);
  const resolvedFromText = els.fromAddress.value.trim() || fromText;
  const resolvedToText = els.toAddress.value.trim() || toText;
  const params = new URLSearchParams({
    fromLat: String(fromLocation.lat),
    fromLon: String(fromLocation.lon),
    fromLabel: fromLocation.inputValue || fromLocation.label || resolvedFromText,
    toLat: String(toLocation.lat),
    toLon: String(toLocation.lon),
    toLabel: toLocation.inputValue || toLocation.label || resolvedToText,
  });
  const response = await fetch(`${API_ROUTE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Route request failed with ${response.status}`);
  }
  const route = {
    id: `open:${cacheKey}`,
    name: `${resolvedFromText} to ${resolvedToText}`,
    baseRouteName: "Open driving route",
    provider: "open",
    routeType: "open-driving",
    localOnly: true,
    defaultCorridorKm: defaultCorridorKmForDistance(Number(payload.distanceKm || 0)),
    defaultDetourSpeedKmh: defaultDetourSpeedKmhForDistance(Number(payload.distanceKm || 0)),
    googleDistanceKm: Number(payload.distanceKm || 0),
    googleDurationMin: Number(payload.durationMin || 0),
    points: payload.points || [],
    cacheHit: false,
  };
  if (route.points.length < 2) {
    throw new Error("Route returned no line.");
  }
  state.openRouteCache.set(cacheKey, route);
  return route;
}

async function resolveRouteLocation(kind) {
  const input = addressInputForKind(kind);
  const text = input.value.trim();
  const place = state.tripPlaces[kind];
  if (place && place.inputValue === text && Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
    return place;
  }
  const response = await fetch(API_GEOCODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    cache: "no-store",
    body: JSON.stringify({ q: addressQuery(text) }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Location request failed with ${response.status}`);
  }
  const location = payload.location;
  if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lon))) {
    throw new Error(`No location found for ${text}`);
  }
  const inputValue = canonicalAddressInputValue(text);
  if (inputValue !== text) {
    input.value = inputValue;
  }
  const resolved = {
    inputValue,
    label: location.label || inputValue,
    lat: Number(location.lat),
    lon: Number(location.lon),
  };
  state.tripPlaces[kind] = resolved;
  return resolved;
}

function canonicalAddressInputValue(value) {
  const text = String(value || "").trim();
  const normalised = normaliseAddressText(text);
  if (normalised === "canberra nsw" || normalised === "canberra") {
    return "Canberra ACT";
  }
  return text;
}

function addressInputForKind(kind) {
  return kind === "to" ? els.toAddress : els.fromAddress;
}

function addressKindForInput(input) {
  return input === els.toAddress ? "to" : "from";
}

function clearTripPlace(kind) {
  state.tripPlaces[kind] = null;
}

function setTripPlace(kind, place) {
  const input = kind === "from" ? els.fromAddress : els.toAddress;
  const label = place.formatted_address || place.name || input.value;
  const location = place.geometry?.location;
  if (!location) return;
  input.value = label;
  state.tripPlaces[kind] = {
    inputValue: label,
    label,
    lat: location.lat(),
    lon: location.lng(),
  };
}

async function initialisePlaceAutocomplete() {
  if (!state.googleMapsApiKey || !els.fromAddress || !els.toAddress) return;
  try {
    await loadGoogleMaps();
    const places = window.google?.maps?.places;
    const Autocomplete = places?.Autocomplete;
    if (!Autocomplete) return;

    [
      ["from", els.fromAddress],
      ["to", els.toAddress],
    ].forEach(([kind, input]) => {
      const autocomplete = new Autocomplete(input, {
        componentRestrictions: { country: "au" },
        fields: ["formatted_address", "geometry", "name"],
      });
      autocomplete.addListener("place_changed", () => {
        setTripPlace(kind, autocomplete.getPlace());
        markRoutePending();
      });
    });
  } catch {
    // Address fields still work as plain text in sample mode.
  }
}

function haversineKm(a, b) {
  const radiusKm = 6371.0088;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function toLocalXyKm(point, origin) {
  const kmPerDegreeLat = 111.32;
  const kmPerDegreeLon = 111.32 * Math.cos(toRad(origin.lat));
  return {
    x: (point.lon - origin.lon) * kmPerDegreeLon,
    y: (point.lat - origin.lat) * kmPerDegreeLat,
  };
}

function segmentLengths(points) {
  return points.slice(0, -1).map((point, index) => haversineKm(point, points[index + 1]));
}

function totalRouteKm(points) {
  return segmentLengths(points).reduce((sum, value) => sum + value, 0);
}

function nearestRoutePosition(station, points) {
  const lengths = segmentLengths(points);
  let accumulated = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestAlong = 0;

  lengths.forEach((lengthKm, index) => {
    const start = points[index];
    const end = points[index + 1];
    const stationXY = toLocalXyKm(station, start);
    const endXY = toLocalXyKm(end, start);
    const segmentLengthSq = endXY.x * endXY.x + endXY.y * endXY.y;
    const projected =
      segmentLengthSq === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, (stationXY.x * endXY.x + stationXY.y * endXY.y) / segmentLengthSq),
          );
    const px = projected * endXY.x;
    const py = projected * endXY.y;
    const distance = Math.hypot(stationXY.x - px, stationXY.y - py);
    const along = accumulated + projected * lengthKm;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestAlong = along;
    }
    accumulated += lengthKm;
  });

  return { distanceToRouteKm: bestDistance, distanceAlongRouteKm: bestAlong };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isLiveFuelCheckStation(station) {
  return station?.source === "api_nsw_fuelcheck";
}

function freshnessPenalty(updatedAt, referenceNow = SAMPLE_NOW) {
  if (!updatedAt) {
    return {
      penalty: 5,
      warning: "price timestamp missing",
      ageHours: Number.POSITIVE_INFINITY,
      recommendable: false,
    };
  }
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return {
      penalty: 5,
      warning: "price timestamp invalid",
      ageHours: Number.POSITIVE_INFINITY,
      recommendable: false,
    };
  }
  const hours = Math.max(0, (referenceNow.getTime() - parsed.getTime()) / 36e5);
  if (hours <= 2) return { penalty: 0, warning: null, ageHours: hours, recommendable: true };
  if (hours <= 8) {
    return { penalty: 0.75, warning: `price is ${hours.toFixed(1)} hours old`, ageHours: hours, recommendable: true };
  }
  if (hours <= 24) {
    return { penalty: 2, warning: `price is ${hours.toFixed(1)} hours old`, ageHours: hours, recommendable: true };
  }
  if (hours <= RECOMMENDATION_MAX_PRICE_AGE_HOURS) {
    return { penalty: 5, warning: `price is ${hours.toFixed(1)} hours old`, ageHours: hours, recommendable: true };
  }
  return { penalty: 10, warning: `price is ${hours.toFixed(1)} hours old`, ageHours: hours, recommendable: false };
}

function getInputs(routeOverride = null) {
  const route = routeOverride || resolveTripRoute();
  return {
    route,
    fuel: state.fuel,
    tankLitres: numberValue(els.tankLitres, 55),
    tankPercent: numberValue(els.tankPercent, 45),
    economy: numberValue(els.economy, 8.2),
    reserveKm: numberValue(els.reserveKm, 35),
    corridorKm: numberValue(els.corridorKm, 2.5),
    mapRadiusKm: numberValue(els.mapRadiusKm, 8),
    detourFactor: 1.35,
    eligibleDiscounts: selectedDiscountIds(),
    selectedBrands: getSelectedBrands(),
    filterBrands: state.brandFilterTouched,
    includeMemberPrices: els.includeMemberPrices.checked,
    includeClosed: els.includeClosed.checked,
  };
}

function getNearbyInputs(planInputs) {
  return {
    ...planInputs,
    fuel: state.nearbyFuel || planInputs.fuel,
    mapRadiusKm: numberValue(els.nearbyRadiusKm, planInputs.mapRadiusKm),
    nearbySort: state.nearbySort,
  };
}

function numberValue(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function selectedDiscountIds() {
  return new Set(
    Array.from(document.querySelectorAll('.discount-programs input[type="checkbox"]:checked'))
      .map((input) => input.value)
      .filter(Boolean),
  );
}

function stationDiscounts(station) {
  const existing = Array.isArray(station.discounts) ? station.discounts : [];
  const byId = new Map();
  existing.forEach((discount) => {
    if (discount?.id) byId.set(String(discount.id), discount);
  });
  inferredDiscountsForStation(station).forEach((discount) => {
    if (!byId.has(discount.id)) byId.set(discount.id, discount);
  });
  return Array.from(byId.values());
}

function inferredDiscountsForStation(station) {
  const text = `${stationBrand(station)} ${station?.name || ""}`.toLowerCase();
  return DISCOUNT_RULES.filter((rule) =>
    rule.brandIncludes.some((needle) => text.includes(needle)),
  ).map((rule) => ({
    id: rule.id,
    label: rule.label,
    centsPerLitre: rule.centsPerLitre,
    inferred: true,
  }));
}

function eligibleDiscount(station, eligibleDiscounts) {
  return stationDiscounts(station).reduce(
    (best, discount) => {
      if (eligibleDiscounts.has(discount.id)) {
        const cents = Number(discount.centsPerLitre || 0);
        if (cents <= best.cents) return best;
        return {
          cents,
          labels: [discount.label || discount.id],
        };
      }
      return best;
    },
    { cents: 0, labels: [] },
  );
}

function possibleDiscount(station, eligibleDiscounts) {
  return stationDiscounts(station).reduce(
    (best, discount) => {
      const id = String(discount.id || "");
      const cents = Number(discount.centsPerLitre || 0);
      if (!id || eligibleDiscounts.has(id) || cents <= best.cents) {
        return best;
      }
      return {
        cents,
        labels: [discount.label || DISCOUNT_PROGRAMS[id]?.label || id],
      };
    },
    { cents: 0, labels: [] },
  );
}

function discountLabelsFromWarnings(candidate) {
  const discountWarning = (candidate.warnings || []).find((warning) =>
    warning.startsWith("discount applied:"),
  );
  if (!discountWarning) return [];
  return discountWarning
    .replace("discount applied:", "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function candidatePriceView(candidate) {
  const confirmedCpl = Number(candidate.discountCpl || 0);
  const confirmedLabels =
    candidate.discountLabels?.length ? candidate.discountLabels : discountLabelsFromWarnings(candidate);
  const selected = selectedDiscountIds();
  const possible =
    candidate.possibleDiscountLabels?.length || Number(candidate.possibleDiscountCpl || 0) > 0
      ? {
          cents: Number(candidate.possibleDiscountCpl || 0),
          labels: candidate.possibleDiscountLabels || [],
        }
      : possibleDiscount(candidate.station || {}, selected);
  const hasPossibleLower = possible.cents > confirmedCpl;
  return {
    pumpCpl: Number(candidate.pumpCpl || 0),
    confirmedCpl,
    confirmedLabels,
    confirmedAdjustedCpl: Number(candidate.adjustedCpl || 0),
    possibleDiscountCpl: hasPossibleLower ? possible.cents : 0,
    possibleDiscountLabels: hasPossibleLower ? possible.labels : [],
    possibleAdjustedCpl: hasPossibleLower
      ? Math.max(0, Number(candidate.pumpCpl || 0) - possible.cents)
      : Number(candidate.adjustedCpl || 0),
  };
}

function stationBrand(station) {
  return station.brand || "Unknown";
}

function normaliseBrandKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function brandStyle(brandValue) {
  const brand = String(brandValue || "Unknown");
  const brandKey = normaliseBrandKey(brand);
  const match = Object.entries(BRAND_STYLES).find(([key, style]) => {
    const aliases = [key, style.label, ...(style.aliases || [])];
    return aliases.some((alias) => {
      const aliasKey = normaliseBrandKey(alias);
      return aliasKey && brandKey.includes(aliasKey);
    });
  });
  if (match) {
    return match[1];
  }
  const words = brand
    .replace(/sample/gi, "")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
  const initials = (words.length ? words : [brand])
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return {
    label: brand,
    initials: initials || "?",
    color: "#2d5f9a",
    icon: "",
  };
}

function brandMarkHtml(station, className = "") {
  const style = brandStyle(stationBrand(station));
  const classes = ["brand-mark-mini", style.icon ? "has-brand-icon" : "", className]
    .filter(Boolean)
    .join(" ");
  const content = style.icon
    ? `<img src="${BRAND_ICON_BASE_URL}${escapeHtml(style.icon)}" alt="" loading="lazy" decoding="async" style="display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;border-radius:inherit;" />`
    : escapeHtml(style.initials);
  return `<span class="${classes}" style="--brand-color:${escapeHtml(style.color)}" aria-label="${escapeHtml(style.label)}">${content}</span>`;
}

function allBrands(stations) {
  return Array.from(new Set(stations.map(stationBrand))).sort((a, b) => a.localeCompare(b));
}

function getSelectedBrands() {
  return new Set(
    Array.from(els.brandFilters.querySelectorAll('input[type="checkbox"]:checked')).map(
      (input) => input.value,
    ),
  );
}

function stationMatchesBrand(station, inputs) {
  return !inputs.filterBrands || inputs.selectedBrands.has(stationBrand(station));
}

function adaptiveCorridorAttempts(routeDistanceKm, requestedCorridorKm) {
  const requested = Number(requestedCorridorKm || 2.5);
  const attempts = [requested];
  if (routeDistanceKm >= 150) {
    attempts.push(5, 8, 12, 20);
  } else if (routeDistanceKm >= 50) {
    attempts.push(4, 6, 10);
  } else {
    attempts.push(3.5, 5);
  }
  return attempts.reduce((list, value) => {
    const rounded = Number(Math.max(requested, value).toFixed(1));
    if (!list.includes(rounded)) list.push(rounded);
    return list;
  }, []);
}

function annotateResultContext(result, inputs, requestedCorridorKm, attempts) {
  result.context.requestedCorridorKm = Number(requestedCorridorKm.toFixed(1));
  result.context.corridorAttempts = attempts;
  result.context.corridorExpanded = result.context.corridorKm > requestedCorridorKm;
  result.context.brandFilterActive = inputs.filterBrands;
  result.context.selectedBrandCount = inputs.selectedBrands.size;
  if (result.context.corridorExpanded) {
    result.context.corridorFallbackReason =
      "Expanded the route search because the first corridor returned no eligible stop.";
  }
  return result;
}

function scoreCandidates(inputs) {
  const requestedCorridorKm = Number(inputs.corridorKm || 2.5);
  const routeDistanceKm = inputs.route.googleDistanceKm || totalRouteKm(inputs.route.points);
  const attempts = adaptiveCorridorAttempts(routeDistanceKm, requestedCorridorKm);
  let firstContext = null;
  let lastResult = null;

  for (const corridorKm of attempts) {
    const result = scoreCandidatesForCorridor({ ...inputs, corridorKm });
    if (!firstContext) {
      firstContext = { ...result.context };
    }
    annotateResultContext(result, inputs, requestedCorridorKm, attempts);
    lastResult = result;
    if (result.recommendations.length) {
      return result;
    }
  }

  if (lastResult && firstContext) {
    lastResult.context.initialStationsInCorridor = firstContext.stationsInCorridor;
    lastResult.context.initialEligibleCandidates = firstContext.eligibleCandidates;
  }
  return lastResult || scoreCandidatesForCorridor(inputs);
}

function scoreCandidatesForCorridor(inputs) {
  const points = inputs.route.points;
  const detourSpeed = inputs.route.defaultDetourSpeedKmh || 45;
  const fillLitres = Math.max(5, inputs.tankLitres * (1 - inputs.tankPercent / 100));
  const stationPositions = new Map();
  const inCorridor = state.stations.filter((station) => {
    if (!stationMatchesBrand(station, inputs)) {
      return false;
    }
    if (!station.prices || !Object.prototype.hasOwnProperty.call(station.prices, inputs.fuel)) {
      return false;
    }
    const position = nearestRoutePosition(station, points);
    if (position.distanceToRouteKm <= inputs.corridorKm) {
      stationPositions.set(station.stationCode, position);
      return true;
    }
    return false;
  });

  const baselinePrices = inCorridor
    .filter((station) => {
      const open = station.openNow !== false;
      const eligible = inputs.includeMemberPrices || !station.membershipRequired;
      return open && eligible;
    })
    .map((station) => Number(station.prices[inputs.fuel]));
  const baselineCpl = median(baselinePrices);
  const currentFuelLitres = inputs.tankLitres * (inputs.tankPercent / 100);
  const tankRangeKm = (currentFuelLitres / inputs.economy) * 100;

  const candidates = inCorridor
    .map((station) => {
      const position = stationPositions.get(station.stationCode);
      const openNow = station.openNow !== false;
      const eligible = inputs.includeMemberPrices || !station.membershipRequired;
      if (!inputs.includeClosed && !openNow) return null;
      if (!eligible) return null;

      const pumpCpl = Number(station.prices[inputs.fuel]);
      const discount = eligibleDiscount(station, inputs.eligibleDiscounts);
      const possible = possibleDiscount(station, inputs.eligibleDiscounts);
      const possibleDiscountCpl = possible.cents > discount.cents ? possible.cents : 0;
      const adjustedCpl = Math.max(0, pumpCpl - discount.cents);
      const possibleAdjustedCpl = possibleDiscountCpl
        ? Math.max(0, pumpCpl - possibleDiscountCpl)
        : adjustedCpl;
      const detourKm = position.distanceToRouteKm * 2 * inputs.detourFactor;
      const detourMinutes = detourSpeed > 0 ? (detourKm / detourSpeed) * 60 : 0;
      const detourFuelLitres = (detourKm * inputs.economy) / 100;
      const detourCost = detourFuelLitres * (adjustedCpl / 100);
      const netSaving = fillLitres * ((baselineCpl - adjustedCpl) / 100) - detourCost;
      const reachNeededKm =
        position.distanceAlongRouteKm + position.distanceToRouteKm + inputs.reserveKm;
      const reachable = tankRangeKm >= reachNeededKm;
      const liveFuelCheck = isLiveFuelCheckStation(station);
      const fresh = freshnessPenalty(station.updatedAt, liveFuelCheck ? new Date() : SAMPLE_NOW);
      if (liveFuelCheck && !fresh.recommendable) return null;
      const warnings = [];

      if (discount.labels.length) {
        warnings.push(`discount applied: ${discount.labels.join(", ")}`);
      }
      if (station.membershipRequired) {
        warnings.push("membership-only price included");
      }
      if (!openNow) {
        warnings.push("station marked closed");
      }
      if (!reachable) {
        warnings.push(`range risk: needs ${reachNeededKm.toFixed(1)} km including reserve`);
      }
      if (fresh.warning) {
        warnings.push(fresh.warning);
      }

      let score = netSaving - detourMinutes * 0.08 - fresh.penalty;
      if (!openNow) score -= 100;
      if (!reachable) score -= 100;

      return {
        station,
        fuel: inputs.fuel,
        pumpCpl,
        adjustedCpl,
        discountCpl: discount.cents,
        discountLabels: discount.labels,
        possibleDiscountCpl,
        possibleDiscountLabels: possibleDiscountCpl ? possible.labels : [],
        possibleAdjustedCpl,
        detourKm,
        detourMinutes,
        detourCost,
        fillLitres,
        netSaving,
        reachable,
        openNow,
        eligible,
        score,
        warnings,
        distanceToRouteKm: position.distanceToRouteKm,
        distanceAlongRouteKm: position.distanceAlongRouteKm,
        reachNeededKm,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return {
    context: {
      routeId: inputs.route.id,
      routeName: inputs.route.name,
      routeType: inputs.route.routeType,
      routeProvider: inputs.route.provider || "sample",
      routeCacheHit: Boolean(inputs.route.cacheHit),
      fuel: inputs.fuel,
      routeDistanceKm: inputs.route.googleDistanceKm || totalRouteKm(points),
      routeDurationMin: inputs.route.googleDurationMin || null,
      corridorKm: inputs.corridorKm,
      brandFilterActive: inputs.filterBrands,
      selectedBrandCount: inputs.selectedBrands.size,
      baselineCpl,
      tankRangeKm,
      reserveKm: inputs.reserveKm,
      fillLitres,
      stationsInCorridor: inCorridor.length,
      eligibleCandidates: candidates.length,
    },
    recommendations: candidates,
  };
}

function cycleSignal(context) {
  if (context.routeError) {
    return {
      title: "No route signal",
      reason: "Resolve the route before using price-cycle or timing guidance.",
      tone: "muted",
      confidence: "Not available",
    };
  }
  const isUnleaded = ["E10", "U91", "P95", "P98"].includes(context.fuel);
  if (!isUnleaded) {
    return {
      title: "No cycle signal",
      reason: "Diesel and LPG do not use petrol-cycle guidance. Route economics still apply.",
      tone: "muted",
      confidence: "Not applicable",
    };
  }
  if (context.routeId === "canberra-to-sydney-cbd") {
    return {
      title: "ACT cycle off",
      reason: "Canberra is treated as shop-around only. Sydney-side route prices are still ranked.",
      tone: "muted",
      confidence: "Guide only",
    };
  }
  if (context.baselineCpl <= 188) {
    return {
      title: "Near recent low",
      reason: "Fill if your tank is low enough that waiting creates risk.",
      tone: "good",
      confidence: "Medium",
    };
  }
  if (context.baselineCpl >= 198) {
    return {
      title: "Elevated",
      reason: "Only fill what you need unless the route recommendation still saves enough.",
      tone: "warn",
      confidence: "Medium",
    };
  }
  return {
    title: "Mixed",
    reason: "Use the ranked route stops and avoid detours that erase the saving.",
    tone: "muted",
    confidence: "Low",
  };
}

async function render() {
  const renderId = ++state.renderId;
  const routeWasDirty = state.routeDirty;
  if (els.routeMatchStatus && shouldUseGoogleMaps() && !routeWasDirty) {
    els.routeMatchStatus.textContent = "Resolving Google driving route...";
  }
  let route;
  try {
    route = await resolveTripRouteForRender();
  } catch (error) {
    if (renderId !== state.renderId) return;
    renderRouteResolveError(error);
    return;
  }
  if (renderId !== state.renderId) return;
  const inputs = getInputs(route);
  let result;

  if (state.apiAvailable && canScoreWithApi(inputs.route)) {
    setModePill("Checking live", "muted");
    try {
      result = await scoreWithApi(inputs);
      if (renderId !== state.renderId) return;
      if (routeWasDirty) {
        setModePill("Route not planned", "warn");
      } else {
        setModePill(
          result.context.source === "api_nsw" ? "Live NSW API" : "Sample mode",
          result.context.source === "api_nsw" ? "" : "muted",
        );
      }
    } catch (error) {
      if (renderId !== state.renderId) return;
      result = scoreCandidates(inputs);
      result.context.source = "sample";
      result.context.apiError = error.message;
      setModePill("Sample fallback", "warn");
    }
  } else {
    result = scoreCandidates(inputs);
    result.context.source = "sample";
    const routeMode =
      inputs.route.provider === "google"
        ? "Google route + sample prices"
        : inputs.route.provider === "open"
          ? "Real route + sample prices"
          : "Sample mode";
    setModePill(routeWasDirty ? "Route not planned" : routeMode, routeWasDirty ? "warn" : "muted");
  }

  state.result = result;
  syncSelectedRouteStop(result);
  renderPlanVehicleCard();
  renderRouteSearchSummary();
  renderDecision(result);
  renderCycle(result.context);
  renderSavedRouteSelect(result);
  renderSavedRouteSuggestions(result);
  renderSavedCommute(result);
  renderSource(result);
  await renderRouteMap(inputs, result);
  renderTable(routeDisplayCandidates(result), result);
  renderRouteSelectedStation(result);
  renderSummary(result.context);
  await renderExplore(inputs, result, renderId);
  renderDebug(result);
  if (state.focusRouteResultsAfterRender && !routeWasDirty) {
    state.focusRouteResultsAfterRender = false;
    focusRouteResults();
  }
}

function routeErrorResult(error) {
  return {
    recommendations: [],
    contextStations: [],
    context: {
      source: state.apiDefaultSource === "live" ? "api_nsw" : "sample",
      routeProvider: "unresolved",
      routeError: error.message || "Route could not be resolved.",
      generatedAt: new Date().toISOString(),
      cacheSeconds: 0,
      routeDistanceKm: 0,
      stationsInCorridor: 0,
      eligibleCandidates: 0,
      corridorKm: numberValue(els.corridorKm, 2.5),
      requestedCorridorKm: numberValue(els.corridorKm, 2.5),
      brandFilterActive: state.brandFilterTouched,
      selectedBrandCount: getSelectedBrands().size,
    },
  };
}

function renderRouteResolveError(error) {
  const message = error.message || "Route could not be resolved.";
  const result = routeErrorResult(error);
  state.result = result;
  state.routeContextStations = [];
  state.selectedStationCode = null;
  state.selectedRouteStationKey = null;
  setModePill("Route not found", "warn");
  if (els.routeMatchStatus) {
    els.routeMatchStatus.textContent = `Route not found: ${message}. Check the address or choose a saved route.`;
  }
  renderPlanVehicleCard();
  renderRouteSearchSummary();
  renderDecision(result);
  renderCycle(result.context);
  renderSavedRouteSelect(result);
  renderSavedRouteSuggestions(result);
  renderSavedCommute(result);
  renderSource(result);
  renderRouteUnavailable(message);
  renderTable([], result);
  renderRouteSelectedStation(result);
  renderSummary(result.context);
  renderDebug(result);
}

function renderRouteUnavailable(message) {
  state.routeContextStations = [];
  if (state.routeMapProvider === "osm" && state.routeMap) {
    state.routeMarkers?.clearLayers();
  }
  if (state.routeMapProvider === "google") {
    clearGoogleOverlays("route");
  }
  if (els.visual) {
    els.visual.innerHTML = "";
  }
  if (els.routeMapFallback) {
    els.routeMapFallback.hidden = false;
    els.routeMapFallback.innerHTML = `
      <strong>Route not found</strong>
      <p>${escapeHtml(message)} Check the address spelling, try a suburb or landmark, or choose a saved route.</p>
    `;
  }
}

async function scoreWithApi(inputs) {
  if (inputs.route.localOnly || inputs.route.provider === "open" || inputs.route.provider === "google") {
    const response = await fetch(API_SCORE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        source: state.apiDefaultSource,
        route: routePayloadForApi(inputs.route),
        fuel: inputs.fuel,
        tankLitres: inputs.tankLitres,
        tankPercent: inputs.tankPercent,
        economy: inputs.economy,
        reserveKm: inputs.reserveKm,
        corridorKm: inputs.corridorKm,
        eligibleDiscounts: Array.from(inputs.eligibleDiscounts),
        includeMemberPrices: inputs.includeMemberPrices,
        includeClosed: inputs.includeClosed,
        brandFilter: inputs.filterBrands,
        brands: Array.from(inputs.selectedBrands),
        forceRefresh: state.forcePriceRefresh,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Score request failed with ${response.status}`);
    }
    return enrichApiScorePayload(payload, inputs);
  }

  const params = new URLSearchParams({
    source: state.apiDefaultSource,
    route: inputs.route.id,
    fuel: inputs.fuel,
    tankLitres: String(inputs.tankLitres),
    tankPercent: String(inputs.tankPercent),
    economy: String(inputs.economy),
    reserveKm: String(inputs.reserveKm),
    corridorKm: String(inputs.corridorKm),
    eligibleDiscounts: Array.from(inputs.eligibleDiscounts).join(","),
    includeMemberPrices: inputs.includeMemberPrices ? "1" : "0",
    includeClosed: inputs.includeClosed ? "1" : "0",
    forceRefresh: state.forcePriceRefresh ? "1" : "0",
  });
  if (inputs.filterBrands) {
    params.set("brandFilter", "1");
    params.set("brands", Array.from(inputs.selectedBrands).join(","));
  }
  const response = await fetch(`${API_SCORE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Score request failed with ${response.status}`);
  }
  return enrichApiScorePayload(payload, inputs);
}

function enrichApiScorePayload(payload, inputs) {
  payload.context = {
    ...(payload.context || {}),
    brandFilterActive: inputs.filterBrands,
    selectedBrandCount: inputs.selectedBrands.size,
    routeDistanceKm:
      Number(payload.context?.routeDistanceKm) ||
      inputs.route.googleDistanceKm ||
      totalRouteKm(inputs.route.points),
    routeDurationMin: inputs.route.googleDurationMin || payload.context?.routeDurationMin || null,
  };
  payload.recommendations = payload.recommendations || [];
  payload.contextStations = payload.contextStations || [];
  return payload;
}

function canScoreWithApi(route) {
  return Boolean(route?.points?.length >= 2);
}

function routePayloadForApi(route) {
  return {
    id: route.id,
    name: route.name,
    provider: route.provider || "sample",
    defaultCorridorKm: route.defaultCorridorKm || numberValue(els.corridorKm, 2.5),
    defaultDetourSpeedKmh: route.defaultDetourSpeedKmh || defaultDetourSpeedKmhForDistance(route.googleDistanceKm || 0),
    points: compactRoutePoints(route.points || []),
  };
}

function compactRoutePoints(points, maxPoints = 180) {
  const valid = points
    .filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
    .map((point) => ({
      lat: Number(point.lat),
      lon: Number(point.lon),
      label: point.label || "",
    }));
  if (valid.length <= maxPoints) return valid;
  const compacted = [];
  let previousIndex = -1;
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * (valid.length - 1));
    if (sourceIndex !== previousIndex) {
      compacted.push(valid[sourceIndex]);
      previousIndex = sourceIndex;
    }
  }
  return compacted;
}

function setModePill(label, tone) {
  if (!els.modePill) return;
  els.modePill.textContent = label;
  els.modePill.className = `status-pill ${tone || ""}`.trim();
}

function renderDecision(result) {
  const [best] = result.recommendations;
  if (!best) {
    const empty = emptyResultMessage(result);
    els.title.textContent = empty.title;
    els.reason.textContent = empty.reason;
    els.why.textContent = "";
    els.explain.innerHTML = "";
    els.metrics.innerHTML = "";
    if (els.warnings) {
      els.warnings.innerHTML = "";
    }
    return;
  }

  const decision = decisionForBest(best, result);
  const priceSummary = recommendationPriceSummary(best);
  const priceDelta = result.context.baselineCpl - best.adjustedCpl;
  const priceDeltaText =
    priceDelta === 0
      ? "matches the route median"
      : `${formatCplDelta(priceDelta)} versus the route median`;
  els.title.textContent = decision.title;
  els.reason.textContent = decision.reason;
  els.why.textContent = `${best.station.name}, ${best.station.suburb} | ${priceDeltaText}, ${best.distanceAlongRouteKm.toFixed(1)} km ahead.`;
  els.explain.innerHTML = decisionCards(best, result);
  els.metrics.innerHTML = [
    metric(priceSummary.label, priceSummary.value),
    metric("Net save", formatMoney(best.netSaving)),
    metric("Detour", `${best.detourMinutes.toFixed(1)} min`),
  ].join("");
  if (els.warnings) {
    els.warnings.innerHTML = "";
  }
}

function syncSelectedRouteStop(result) {
  const candidates = routeDisplayCandidates(result);
  const routeKeys = new Set(candidates.map(routeSelectionKey));
  if (!routeKeys.size) {
    state.selectedStationCode = null;
    state.selectedRouteStationKey = null;
    return;
  }
  if (!state.selectedStationCode || !state.selectedRouteStationKey || !routeKeys.has(state.selectedRouteStationKey)) {
    const first = candidates[0];
    state.selectedStationCode = first.station.stationCode;
    state.selectedRouteStationKey = routeSelectionKey(first);
    return;
  }
  const selected = candidates.find(routeItemMatchesSelection);
  if (selected) {
    state.selectedStationCode = selected.station.stationCode;
  }
}

function sortedRouteCandidates(result) {
  const candidates = [...(result?.recommendations || [])];
  if (state.routeSort === "price") {
    return candidates.sort((a, b) => a.adjustedCpl - b.adjustedCpl || a.detourMinutes - b.detourMinutes);
  }
  if (state.routeSort === "saving") {
    return candidates.sort((a, b) => b.netSaving - a.netSaving || a.detourMinutes - b.detourMinutes);
  }
  if (state.routeSort === "detour") {
    return candidates.sort((a, b) => a.detourMinutes - b.detourMinutes || a.adjustedCpl - b.adjustedCpl);
  }
  return candidates;
}

function routeResultLimit(result) {
  const available = (result?.recommendations || []).length;
  if (state.routeResultsExpanded) {
    return Math.min(ROUTE_RESULT_EXPANDED_LIMIT, available);
  }
  return Math.min(ROUTE_RESULT_INITIAL_LIMIT, available);
}

function routeDisplayCandidates(result) {
  return sortedRouteCandidates(result).slice(0, routeResultLimit(result));
}

function routeResultCountSummary(result) {
  const contextRanked = Number(result?.context?.eligibleCandidates || 0);
  const available = (result?.recommendations || []).length;
  const shown = routeDisplayCandidates(result).length;
  const total = Math.max(contextRanked, available);
  return { shown, available, total };
}

function routeSelectionKey(item) {
  const station = item.station || item;
  const code = station.stationCode || station.name || "station";
  const lat = Number(station.lat);
  const lon = Number(station.lon);
  const latPart = Number.isFinite(lat) ? lat.toFixed(5) : "na";
  const lonPart = Number.isFinite(lon) ? lon.toFixed(5) : "na";
  return `${code}|${latPart}|${lonPart}`;
}

function routeItemMatchesSelection(item) {
  return routeSelectionKey(item) === state.selectedRouteStationKey;
}

function conciseDecisionReason(best, result) {
  return decisionForBest(best, result).reason;
}

function recommendationPriceSummary(candidate) {
  const priceView = candidatePriceView(candidate);
  if (priceView.confirmedCpl > 0) {
    return {
      label: "Your price",
      value: `${candidate.adjustedCpl.toFixed(1)} c/L`,
      short: `${candidate.adjustedCpl.toFixed(1)} c/L after discount`,
      detail: `${priceView.confirmedLabels.join(", ")} applied. Pump price is ${candidate.pumpCpl.toFixed(1)} c/L.`,
    };
  }
  return {
    label: "Pump price",
    value: `${candidate.pumpCpl.toFixed(1)} c/L`,
    short: `${candidate.pumpCpl.toFixed(1)} c/L`,
    detail: "No selected discount changes this station price.",
  };
}

function decisionTimingChip(context) {
  const signal = cycleSignal(context);
  if (signal.title === "No cycle signal" || signal.title === "ACT cycle off") {
    return { label: "Timing", value: "No signal" };
  }
  if (signal.title === "Near recent low") {
    return { label: "Timing", value: "Favourable" };
  }
  if (signal.title === "Elevated") {
    return { label: "Timing", value: "Elevated" };
  }
  return { label: "Timing", value: "Mixed" };
}

function decisionForBest(best, result) {
  const place = `${best.station.name}, ${best.station.suburb}`;
  if (!best.reachable) {
    return {
      title: "Top up before chasing this stop",
      reason: `${place} is priced well, but your current range plus reserve is too tight.`,
    };
  }
  if (best.netSaving >= 4) {
    return {
      title: "Fill on route",
      reason: `${place} saves about ${formatMoney(best.netSaving)} after a ${best.detourMinutes.toFixed(1)} min detour.`,
    };
  }
  if (best.netSaving >= 1) {
    return {
      title: "Fill if it suits your trip",
      reason: `${place} saves about ${formatMoney(best.netSaving)}. Use it only if the ${best.detourMinutes.toFixed(1)} min detour suits.`,
    };
  }
  const cycle = cycleSignal(result.context);
  if (cycle.title === "Near recent low") {
    return {
      title: "Fill only if you need fuel",
      reason: `Prices look useful, but the best stop only saves ${formatMoney(best.netSaving)} after detour.`,
    };
  }
  return {
    title: "Skip the detour",
    reason: `Best option only saves ${formatMoney(best.netSaving)} after detour. Keep going unless you need fuel now.`,
  };
}

function decisionCards(best, result) {
  const priceView = candidatePriceView(best);
  const priceSummary = recommendationPriceSummary(best);
  const possibleText = priceView.possibleDiscountCpl
    ? `Another saved program could bring this to ${priceView.possibleAdjustedCpl.toFixed(1)} c/L: ${priceView.possibleDiscountLabels.join(", ")}.`
    : "";
  return [
    decisionCard("Why", `${best.detourMinutes.toFixed(1)} min detour, ${formatMoney(best.netSaving)} net saving after detour fuel.`),
    decisionCard("Price", `${priceSummary.detail}${possibleText ? ` ${possibleText}` : ""}`),
  ].join("");
}

function decisionCard(label, value) {
  return `<div class="decision-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function stationFreshnessLabel(station) {
  return station?.updatedAt ? `Updated ${formatDateTime(station.updatedAt)}` : "No timestamp";
}

function priceAgeHours(candidate) {
  const warning = (candidate.warnings || []).find((item) => /price is [0-9.]+ hours old/.test(item));
  if (warning) {
    const match = warning.match(/price is ([0-9.]+) hours old/);
    if (match) return Number(match[1]);
  }
  if (!candidate.station?.updatedAt) return Number.POSITIVE_INFINITY;
  const parsed = new Date(candidate.station.updatedAt);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - parsed.getTime()) / 36e5);
}

function freshnessTrustCue(candidate) {
  const hours = priceAgeHours(candidate);
  if (!Number.isFinite(hours)) {
    return {
      label: "No timestamp",
      detail: "missing",
      severity: "missing",
      tone: "warn",
    };
  }
  if (hours > 72) {
    return {
      label: "Very stale",
      detail: `${hours.toFixed(0)} hours old`,
      severity: "very-stale",
      tone: "warn",
    };
  }
  if (hours > 24) {
    return {
      label: "Stale",
      detail: `${hours.toFixed(0)} hours old`,
      severity: "stale",
      tone: "warn",
    };
  }
  if (hours > 8) {
    return {
      label: "Aged price",
      detail: `${hours.toFixed(0)} hours old`,
      severity: "aged",
      tone: "muted",
    };
  }
  if (hours > 2) {
    return {
      label: "Recent enough",
      detail: `${hours.toFixed(1)} hours old`,
      severity: "recent",
      tone: "good",
    };
  }
  return {
    label: "Fresh",
    detail: hours < 0.1 ? "just updated" : `${hours.toFixed(1)} hours old`,
    severity: "fresh",
    tone: "good",
  };
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderCycle(context) {
  if (!els.cycleTitle || !els.cycleReason || !els.cycleConfidence) return;
  const signal = cycleSignal(context);
  els.cycleTitle.textContent = signal.title;
  els.cycleReason.textContent = signal.reason;
  els.cycleConfidence.textContent = signal.confidence;
  els.cycleConfidence.className = `status-pill ${signal.tone === "warn" ? "warn" : "muted"}`;
}

function renderSavedCommute(result) {
  if (!els.commuteInsight || !els.commuteImpact) return;
  const profile = currentOrActiveSavedRouteProfile();
  const [best] = result.recommendations;
  if (els.commuteTitle) {
    els.commuteTitle.textContent = profile.name;
  }
  if (!currentTripMatchesProfile(profile)) {
    els.commuteInsight.textContent =
      "This saved route is not the active trip. Apply it to check its alert rules, or use Plan Trip for the current addresses.";
    els.commuteImpact.textContent = "Not active";
    els.commuteImpact.className = "status-pill muted";
    renderSavedRouteList(result);
    return;
  }
  if (!best) {
    els.commuteInsight.textContent = "No saved-route recommendation is available with the current filters.";
    els.commuteImpact.textContent = "No alert";
    els.commuteImpact.className = "status-pill muted";
    renderSavedRouteList(result);
    return;
  }

  const alert = savedRouteAlert(profile, result);
  els.commuteInsight.textContent = alert.body;
  els.commuteImpact.textContent = alert.label;
  els.commuteImpact.className = `status-pill ${alert.tone || "muted"}`;
  if (els.savedRouteSignal) {
    els.savedRouteSignal.textContent = alert.shortReason;
  }
  renderSavedRouteList(result);
}

function renderSavedRouteSelect(result = state.result) {
  if (!els.savedRouteSelect) return;
  const activeProfile = Object.values(SAVED_ROUTE_PROFILES).find(currentTripMatchesProfile);
  if (activeProfile) {
    state.activeSavedRouteId = activeProfile.id;
  }
  const selectedValue = activeProfile?.id || "";
  const alert = activeProfile && result ? savedRouteAlert(activeProfile, result) : null;
  els.savedRouteSelect.innerHTML = [
    `<option value="">Custom trip</option>`,
    ...Object.values(SAVED_ROUTE_PROFILES).map(
      (profile) =>
        `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)} - ${escapeHtml(profile.cadence)}</option>`,
    ),
  ].join("");
  els.savedRouteSelect.value = selectedValue;
  els.savedRouteSelect.title = alert ? alert.shortReason : "Choose a saved route";
}

function renderSavedRouteSuggestions(result = state.result) {
  if (!els.savedRouteSuggestions) return;
  if (!state.savedRouteSuggestionsOpen) {
    els.savedRouteSuggestions.hidden = true;
    els.savedRouteSuggestions.innerHTML = "";
    return;
  }

  const matches = savedRouteSuggestionMatches();
  const addressSuggestionHtml = renderAddressSuggestionGroup();
  const savedRouteHtml = matches.length
    ? `
      <span class="saved-route-suggestion-label">Saved destinations</span>
      ${matches
        .map((profile) => {
          const matchesCurrentTrip = currentTripMatchesProfile(profile);
          const isActive = profile.id === state.activeSavedRouteId && matchesCurrentTrip;
          const alert = isActive && result ? savedRouteAlert(profile, result) : null;
          const detail = alert ? alert.shortReason : `${profile.mode} | ${profile.cadence}`;
          return `
            <button
              class="saved-route-suggestion"
              type="button"
              data-saved-route="${escapeHtml(profile.id)}"
              aria-pressed="${isActive}"
            >
              <strong>${escapeHtml(profile.from)} to ${escapeHtml(profile.to)}</strong>
              <span>${escapeHtml(detail)}</span>
            </button>
          `;
        })
        .join("")}
    `
    : "";

  els.savedRouteSuggestions.hidden = false;
  if (!matches.length && !addressSuggestionHtml) {
    els.savedRouteSuggestions.innerHTML = `
      <span class="saved-route-suggestion-label">Saved destinations</span>
      <span class="saved-route-empty">No saved routes match this address yet.</span>
    `;
    return;
  }

  els.savedRouteSuggestions.innerHTML = `
    ${addressSuggestionHtml}
    ${savedRouteHtml}
  `;
}

function renderAddressSuggestionGroup() {
  const kind = state.activeAddressField;
  if (!kind || state.addressSuggestionKind !== kind) return "";
  const input = addressInputForKind(kind);
  const value = input?.value?.trim() || "";
  const canSuggest = normaliseAddressText(value).length >= ADDRESS_SUGGESTION_MIN_LENGTH;
  if (!canSuggest && !state.addressSuggestions.length && !state.addressSuggestionError) return "";

  const status = state.addressSuggestionLoading
    ? `<span class="saved-route-empty">Looking up Australian addresses...</span>`
    : state.addressSuggestionError
      ? `<span class="saved-route-empty">${escapeHtml(state.addressSuggestionError)}</span>`
      : !state.addressSuggestions.length
        ? `<span class="saved-route-empty">No address matches found yet.</span>`
        : "";

  return `
    <span class="saved-route-suggestion-label">${kind === "from" ? "From address lookup" : "Destination address lookup"}</span>
    ${state.addressSuggestions
      .map(
        (place, index) => `
          <button
            class="saved-route-suggestion address-suggestion"
            type="button"
            data-address-suggestion="${index}"
            data-address-kind="${escapeHtml(kind)}"
          >
            <strong>${escapeHtml(shortAddressSuggestionLabel(place))}</strong>
            <span>${escapeHtml(addressSuggestionDetail(place))}</span>
          </button>
        `,
      )
      .join("")}
    ${status}
  `;
}

function shortAddressSuggestionLabel(place) {
  return place.inputValue || place.label || "Address";
}

function addressSuggestionDetail(place) {
  const type = String(place.type || "place").replaceAll("_", " ");
  const parts = String(place.label || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const region = parts.slice(1, 3).join(", ");
  return [type, region].filter(Boolean).join(" | ");
}

function scheduleAddressSuggestions(kind, options = {}) {
  const input = addressInputForKind(kind);
  if (!input) return;
  window.clearTimeout(state.addressSuggestionTimer);
  state.activeAddressField = kind;
  state.addressSuggestionKind = kind;
  state.addressSuggestionQuery = input.value.trim();
  state.addressSuggestionError = "";

  if (normaliseAddressText(state.addressSuggestionQuery).length < ADDRESS_SUGGESTION_MIN_LENGTH) {
    state.addressSuggestions = [];
    state.addressSuggestionLoading = false;
    if (options.showShortQueryMessage) {
      state.addressSuggestionError = "Enter at least 3 characters to look up an address, suburb or place.";
    }
    populateAddressOptions();
    renderSavedRouteSuggestions();
    return;
  }

  state.addressSuggestionLoading = true;
  renderSavedRouteSuggestions();
  const delay = options.immediate ? 0 : ADDRESS_SUGGESTION_DEBOUNCE_MS;
  state.addressSuggestionTimer = window.setTimeout(() => {
    fetchAddressSuggestions(kind, state.addressSuggestionQuery);
  }, delay);
}

function lookupAddress(kind) {
  const input = addressInputForKind(kind);
  if (!input) return;
  setRouteSearchExpanded(true);
  state.activeAddressField = kind;
  state.savedRouteSuggestionsOpen = true;
  input.focus();
  scheduleAddressSuggestions(kind, {
    immediate: true,
    showShortQueryMessage: true,
  });
  renderSavedRouteSuggestions();
}

async function fetchAddressSuggestions(kind, rawQuery) {
  const query = rawQuery.trim();
  try {
    const response = await fetch(API_GEOCODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({ q: addressQuery(query), limit: 5 }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Address lookup failed with ${response.status}`);
    }
    if (
      state.addressSuggestionKind !== kind ||
      state.addressSuggestionQuery !== query ||
      addressInputForKind(kind).value.trim() !== query
    ) {
      return;
    }
    state.addressSuggestions = (payload.suggestions || []).map((place) =>
      normaliseAddressSuggestion(place, query),
    );
    state.addressSuggestionError = "";
  } catch (error) {
    if (state.addressSuggestionKind !== kind || state.addressSuggestionQuery !== query) return;
    state.addressSuggestions = [];
    state.addressSuggestionError = "Address lookup is unavailable. You can still type the address and plan the route.";
  } finally {
    if (state.addressSuggestionKind === kind && state.addressSuggestionQuery === query) {
      state.addressSuggestionLoading = false;
      populateAddressOptions();
      renderSavedRouteSuggestions();
    }
  }
}

function normaliseAddressSuggestion(place, query) {
  const label = String(place.label || query);
  return {
    inputValue: conciseAddressInput(label, query),
    label,
    lat: Number(place.lat),
    lon: Number(place.lon),
    type: place.type || "place",
  };
}

function conciseAddressInput(label, fallback) {
  const parts = String(label || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^australia$/i.test(item));
  if (!parts.length) return canonicalAddressInputValue(fallback);
  const stateInfo = stateInfoFromAddressParts(parts);
  const localityParts = parts
    .slice(1, stateInfo.index >= 0 ? stateInfo.index : parts.length)
    .filter((part) => !/^\d+$/.test(part))
    .filter((part) => !/^\d{4}$/.test(part))
    .filter((part) => !/\b(street|road|rd|st|avenue|ave|lane|drive|highway|hwy|place|pl|boulevard|bvd|crescent|court|ct|parade|pde|way)\b/i.test(part));
  const locality =
    localityParts.find((part) => /\bCBD\b/i.test(part)) ||
    localityParts.find((part) => /\b(Sydney|Canberra|Parramatta|Bondi|Goulburn|Wollongong|Newcastle)\b/i.test(part)) ||
    localityParts[localityParts.length - 1];
  const location = [locality, stateInfo.code].filter(Boolean).join(" ");
  const concise = [parts[0], location && location !== parts[0] ? location : ""]
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  return canonicalAddressInputValue(concise || parts.slice(0, 3).join(", "));
}

function stateInfoFromAddressParts(parts) {
  const names = {
    "new south wales": "NSW",
    "australian capital territory": "ACT",
    victoria: "VIC",
    queensland: "QLD",
    "south australia": "SA",
    "western australia": "WA",
    tasmania: "TAS",
    "northern territory": "NT",
  };
  for (const [index, part] of parts.entries()) {
    const text = part.toLowerCase();
    const direct = part.match(/\b(NSW|ACT|VIC|QLD|SA|WA|TAS|NT)\b/i)?.[1]?.toUpperCase();
    if (direct) return { code: direct, index };
    if (names[text]) return { code: names[text], index };
  }
  return { code: "", index: -1 };
}

function applyAddressSuggestion(kind, index) {
  const place = state.addressSuggestions[Number(index)];
  if (!place || state.addressSuggestionKind !== kind) return;
  const input = addressInputForKind(kind);
  input.value = place.inputValue;
  state.tripPlaces[kind] = place;
  state.addressSuggestions = [];
  state.addressSuggestionLoading = false;
  state.addressSuggestionError = "";
  state.savedRouteSuggestionsOpen = false;
  state.stationCache.clear();
  state.selectedStationCode = null;
  state.selectedRouteStationKey = null;
  markRoutePending();
  populateAddressOptions();
  renderSavedRouteSuggestions();
}

function savedRouteSuggestionMatches() {
  const query = normaliseAddressText(`${els.fromAddress.value} ${els.toAddress.value}`);
  const tokens = query
    .split(" ")
    .filter((token) => token.length >= 3 && !["nsw", "act", "australia"].includes(token));
  const profiles = Object.values(SAVED_ROUTE_PROFILES);
  if (!tokens.length) return profiles;
  const ranked = profiles
    .map((profile) => {
      const haystack = normaliseAddressText(
        `${profile.name} ${profile.from} ${profile.to} ${profile.cadence} ${profile.mode}`,
      );
      const score = tokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
      return { profile, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.profile.name.localeCompare(b.profile.name));
  return ranked.map((item) => item.profile);
}

function scheduleSavedRouteSuggestionsClose() {
  window.setTimeout(() => {
    const activeElement = document.activeElement;
    const shouldStayOpen =
      activeElement === els.fromAddress ||
      activeElement === els.toAddress ||
      els.savedRouteSuggestions?.contains(activeElement);
    if (shouldStayOpen) return;
    state.savedRouteSuggestionsOpen = false;
    renderSavedRouteSuggestions();
  }, 160);
}

function activeSavedRouteProfile() {
  return SAVED_ROUTE_PROFILES[state.activeSavedRouteId] || SAVED_ROUTE_PROFILES["parramatta-cbd"];
}

function currentOrActiveSavedRouteProfile() {
  const activeProfile = Object.values(SAVED_ROUTE_PROFILES).find(currentTripMatchesProfile);
  if (activeProfile) {
    state.activeSavedRouteId = activeProfile.id;
    return activeProfile;
  }
  return activeSavedRouteProfile();
}

function currentTripMatchesProfile(profile) {
  return (
    normaliseAddressText(els.fromAddress.value) === normaliseAddressText(profile.from) &&
    normaliseAddressText(els.toAddress.value) === normaliseAddressText(profile.to)
  );
}

function savedRouteAlert(profile, result) {
  const [best] = result.recommendations;
  if (!best) {
    return {
      label: "No alert",
      tone: "muted",
      body: `${profile.name} has no station that matches the current fuel and eligibility filters.`,
      shortReason: "No matching station for this saved route.",
    };
  }
  const rules = profile.alertRules;
  const cycle = cycleSignal(result.context);
  const tankPercent = numberValue(els.tankPercent, profile.tankPercent);
  const savingOk = best.netSaving >= rules.minSavingDollars;
  const detourOk = best.detourMinutes <= rules.maxDetourMinutes;
  const tankOk = tankPercent <= rules.tankBelowPercent;
  const routeName = `${best.station.suburb} ${formatMoney(best.netSaving)} after detour`;

  if (!best.reachable) {
    return {
      label: "Range first",
      tone: "warn",
      body: `${profile.name}: top up before chasing ${best.station.suburb}. Your reserve setting makes the best stop a range risk.`,
      shortReason: `Range risk before ${best.station.suburb}.`,
    };
  }
  if (savingOk && detourOk && tankOk) {
    return {
      label: "Send alert",
      tone: "",
      body: `${profile.name}: ${routeName}. ${cycle.title === "Near recent low" ? "Prices look close to a recent low." : cycle.reason}`,
      shortReason: `Alert: ${routeName}.`,
    };
  }
  if (savingOk && detourOk && !tankOk) {
    return {
      label: "Watch only",
      tone: "muted",
      body: `${profile.name}: the route has value at ${best.station.suburb}, but your tank is above the ${rules.tankBelowPercent}% alert threshold.`,
      shortReason: `Watch: saving is there, tank threshold not met.`,
    };
  }
  if (savingOk && !detourOk) {
    return {
      label: "Skip alert",
      tone: "muted",
      body: `${profile.name}: ${best.station.suburb} saves money, but the ${best.detourMinutes.toFixed(1)} min detour is above your ${rules.maxDetourMinutes} min rule.`,
      shortReason: `No alert: detour above tolerance.`,
    };
  }
  return {
    label: "Quiet today",
    tone: "muted",
    body: `${profile.name}: no alert. The best stop does not beat the ${formatMoney(rules.minSavingDollars)} saved-route threshold after detour.`,
    shortReason: `No alert: saving below threshold.`,
  };
}

function renderSavedRouteList(result = state.result) {
  if (!els.savedRouteList) return;
  els.savedRouteList.innerHTML = Object.values(SAVED_ROUTE_PROFILES)
    .map((profile) => {
      const isActive = profile.id === state.activeSavedRouteId;
      const matchesCurrentTrip = currentTripMatchesProfile(profile);
      const alert = isActive && matchesCurrentTrip && result ? savedRouteAlert(profile, result) : null;
      const rules = profile.alertRules;
      const signal = alert
        ? alert.shortReason
        : isActive
          ? "Selected saved route. Apply it to check live alert rules."
          : profile.strategy;
      return `
        <button class="saved-route-card" type="button" data-saved-route="${escapeHtml(profile.id)}" aria-pressed="${isActive}">
          <strong>${escapeHtml(profile.name)}</strong>
          <span>${escapeHtml(profile.cadence)} | ${escapeHtml(profile.mode)}</span>
          <b>${escapeHtml(signal)}</b>
          <em>Alert above ${formatMoney(rules.minSavingDollars)}, detour under ${rules.maxDetourMinutes} min, tank below ${rules.tankBelowPercent}%.</em>
        </button>
      `;
    })
    .join("");
}

function renderSource(result) {
  const [best] = result.recommendations;
  const isLive = result.context.source === "api_nsw";
  els.sourceStatus.textContent = isLive
    ? "Live NSW FuelCheck via local proxy"
    : "Sample data";
  const generated = result.context.generatedAt
    ? formatDateTime(result.context.generatedAt)
    : "local sample clock";
  const stationUpdated = best?.station?.updatedAt
    ? formatDateTime(best.station.updatedAt)
    : "not available";
  const caveat = isLive
    ? result.context.routeError
      ? "No station recommendation is shown until the route resolves."
      : "Internal validation only. Public use still needs API.NSW rights confirmation."
    : result.context.routeProvider === "google"
      ? "Real Google route with synthetic fuel prices for repeatable testing."
      : result.context.routeProvider === "open"
        ? "Real address route with synthetic fuel prices for repeatable testing."
        : result.context.routeError
          ? "No station recommendation is shown until the route resolves."
      : "Synthetic prices for repeatable testing.";
  els.sourceDetails.innerHTML = [
    sourceItem("Generated", generated),
    sourceItem(
      "Route",
      result.context.routeProvider === "google"
        ? "Google driving route"
        : result.context.routeProvider === "open"
          ? "Real address route"
          : result.context.routeError
            ? "Not resolved"
          : "Sample corridor",
    ),
    sourceItem("Route cache", result.context.routeCacheHit ? "Hit" : "New"),
    sourceItem("Best price updated", stationUpdated),
    sourceItem("Cache", `${result.context.cacheSeconds || 0}s`),
    sourceItem("Map", mapProviderSummary()),
    sourceItem("Status", caveat),
  ].join("");
}

function sourceItem(label, value) {
  return `<span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`;
}

function renderSummary(context) {
  if (context.routeError) {
    els.summaryStats.textContent = "Route not found | no stations scored";
    return;
  }
  const corridor = Number(context.corridorKm || 0).toFixed(1);
  const expanded = context.corridorExpanded ? ` | expanded from ${Number(context.requestedCorridorKm || 0).toFixed(1)} km` : "";
  const count = routeResultCountSummary(state.result);
  const display = count.total > count.shown ? `${count.shown} shown of ${count.total} ranked` : `${count.shown} ranked`;
  els.summaryStats.textContent = `${context.routeDistanceKm.toFixed(1)} km route | ${context.stationsInCorridor} in ${corridor} km corridor${expanded} | ${display}`;
}

function emptyResultMessage(result) {
  const context = result?.context || {};
  const corridor = Number(context.corridorKm || context.requestedCorridorKm || 0);
  const expanded = context.corridorExpanded
    ? ` We expanded the search to ${corridor.toFixed(1)} km from the route.`
    : "";
  if (context.routeError) {
    return {
      title: "Route not found",
      reason: "Check the address spelling, try a suburb or landmark, or choose a saved route.",
    };
  }
  if (state.routeDirty) {
    return {
      title: "Plan this route",
      reason: "Click Plan route to resolve the new addresses before scoring stations.",
    };
  }
  if (context.brandFilterActive && context.selectedBrandCount === 0) {
    return {
      title: "No brands selected",
      reason: "Select at least one brand in Account, or choose All, to show stations on this route.",
    };
  }
  if (context.stationsInCorridor === 0) {
    return {
      title: "No stations found on this route",
      reason: `${expanded || `We checked a ${corridor.toFixed(1)} km route corridor.`} Try another fuel type, check brand filters, or use Nearby around the start or destination.`,
    };
  }
  if (Number(context.staleExcludedCandidates || 0) > 0 && context.eligibleCandidates === 0) {
    return {
      title: "Prices need refresh",
      reason: `We found stations on this route, but their live FuelCheck prices are older than ${Number(
        context.freshnessCutoffHours || RECOMMENDATION_MAX_PRICE_AGE_HOURS,
      ).toFixed(0)} hours. They stay on the map, but are not ranked as recommendations.`,
    };
  }
  if (context.eligibleCandidates === 0) {
    return {
      title: "No eligible stations",
      reason: `${expanded} Current eligibility, closed-station or brand settings exclude the stations found on this route.`,
    };
  }
  return {
    title: "No worthwhile fuel decision",
    reason: `${expanded} The available options do not beat the detour cost. Keep driving unless you need fuel now.`,
  };
}

function renderTable(candidates, result) {
  if (!candidates.length) {
    const empty = emptyResultMessage(result);
    els.rows.innerHTML = `
      <div class="empty-table-cell">
        <strong>${escapeHtml(empty.title)}</strong>
        <span>${escapeHtml(empty.reason)}</span>
      </div>
    `;
    return;
  }
  const count = routeResultCountSummary(result);
  const toggle = count.available > ROUTE_RESULT_INITIAL_LIMIT
    ? `
      <div class="route-list-footer">
        <span>${count.shown} shown${count.total > count.shown ? ` of ${count.total}` : ""}</span>
        <button class="mini-button" type="button" data-route-results-toggle>
          ${state.routeResultsExpanded ? "Show fewer" : "Show more"}
        </button>
      </div>
    `
    : "";
  els.rows.innerHTML = candidates
    .map((candidate, index) => {
      const notes = candidateNotes(candidate);
      const why = candidateWhy(candidate, index);
      const savingClass = candidate.netSaving >= 0 ? "money-positive" : "money-negative";
      const priceView = candidatePriceView(candidate);
      const confirmedLabel = priceView.confirmedCpl
        ? `<span class="discount-line">${escapeHtml(priceView.confirmedLabels.join(", "))}</span>`
        : `<span class="discount-line muted">No selected discount</span>`;
      const possibleLabel = priceView.possibleDiscountCpl
        ? `<span class="route-stop-subtle">Possible ${priceView.possibleAdjustedCpl.toFixed(1)} c/L with ${escapeHtml(
            priceView.possibleDiscountLabels.join(", "),
          )}</span>`
        : "";
      const selected = routeItemMatchesSelection(candidate);
      const selectionKey = routeSelectionKey(candidate);
      return `
        <button class="route-stop-card" type="button" data-route-stop="${escapeHtml(selectionKey)}" data-station-code="${escapeHtml(candidate.station.stationCode)}" aria-pressed="${selected}">
          <span class="route-stop-rank">${index + 1}</span>
          <span class="route-stop-main">
            <strong>${brandMarkHtml(candidate.station)}${escapeHtml(candidate.station.name)}</strong>
            <span>${escapeHtml(candidate.station.brand)} | ${escapeHtml(candidate.station.suburb)} | ${candidate.detourMinutes.toFixed(1)} min detour</span>
            <em>${escapeHtml(why)}${notes ? ` | ${escapeHtml(notes)}` : ""}</em>
          </span>
          <span class="route-stop-price">
            <strong>${candidate.adjustedCpl.toFixed(1)} c/L</strong>
            <span>Pump ${candidate.pumpCpl.toFixed(1)} c/L</span>
            ${confirmedLabel}
            ${possibleLabel}
            <b class="${savingClass}">${formatMoney(candidate.netSaving)}</b>
          </span>
        </button>
      `;
    })
    .join("") + toggle;
}

function selectedRouteCandidate(result) {
  const candidates = sortedRouteCandidates(result);
  return (
    candidates.find(routeItemMatchesSelection) ||
    (state.routeContextStations || []).find(routeItemMatchesSelection) ||
    candidates[0] ||
    null
  );
}

function renderRouteSelectedStation(result) {
  if (!els.routeSelectedStation) return;
  const selected = selectedRouteCandidate(result);
  if (!selected) {
    els.routeSelectedStation.innerHTML = `<p class="empty-state">Select a station to see details.</p>`;
    return;
  }
  const priceView = candidatePriceView(selected);
  const openLabel = selected.station.openNow === false ? "Closed" : "Open";
  const memberLabel = selected.station.membershipRequired ? "Member price" : "Public price";
  const possible = priceView.possibleDiscountCpl
    ? `<span>Possible ${priceView.possibleAdjustedCpl.toFixed(1)} c/L with ${escapeHtml(priceView.possibleDiscountLabels.join(", "))}</span>`
    : `<span>No lower wallet price flagged</span>`;
  const fuels = Object.entries(selected.station.prices || {})
    .slice(0, 5)
    .map(([fuel, price]) => `<span>${escapeHtml(fuel)} ${Number(price).toFixed(1)}</span>`)
    .join("");
  els.routeSelectedStation.innerHTML = `
    <div class="station-detail-head" data-selected-station="${escapeHtml(selected.station.stationCode)}">
      ${brandMarkHtml(selected.station, "detail-brand")}
      <div>
        <strong>${escapeHtml(selected.station.name)}</strong>
        <span>${escapeHtml(stationBrand(selected.station))} | ${escapeHtml(selected.station.suburb || "")}</span>
      </div>
      <b>${selected.adjustedCpl.toFixed(1)} c/L</b>
    </div>
    <div class="station-detail-meta">
      <span>Pump ${selected.pumpCpl.toFixed(1)} c/L</span>
      <span>${formatMoney(selected.netSaving)} net</span>
      <span>${selected.detourMinutes.toFixed(1)} min detour</span>
      <span>${openLabel} | ${memberLabel}</span>
      <span>Last updated ${selected.station.updatedAt ? formatDateTime(selected.station.updatedAt) : "not available"}</span>
      ${possible}
    </div>
    <div class="station-fuel-strip">${fuels}</div>
    <div class="station-actions">
      <button class="mini-button" type="button" data-station-action="navigate" data-station-code="${escapeHtml(selected.station.stationCode)}">Navigate</button>
      <button class="mini-button" type="button" data-station-action="favourite" data-station-code="${escapeHtml(selected.station.stationCode)}">Favourite</button>
      <button class="mini-button" type="button" data-station-action="alert" data-station-code="${escapeHtml(selected.station.stationCode)}">Price alert</button>
      <button class="mini-button" type="button" data-station-action="report" data-station-code="${escapeHtml(selected.station.stationCode)}">Report price</button>
    </div>
    <p id="stationActionStatus" class="station-action-status">Demo actions mirror PetrolSpy/FuelCheck flows; no external submission is sent.</p>
  `;
}

function candidateWhy(candidate, index) {
  if (!candidate.reachable) {
    return "Range risk with reserve";
  }
  if (candidate.station.openNow === false) {
    return "Closed, shown only by eligibility setting";
  }
  if (index === 0 && candidate.netSaving >= 1) {
    return "Best score after detour";
  }
  if (candidate.discountCpl) {
    return "Discount improves net price";
  }
  if (candidate.detourMinutes <= 0.5) {
    return "Minimal detour";
  }
  if (candidate.netSaving < 0) {
    return "Not worth detour";
  }
  return "Viable backup";
}

function candidateNotes(candidate) {
  const notes = [];
  notes.push(candidate.reachable ? "Range OK" : "Range risk");
  notes.push(candidate.station.membershipRequired ? "Member price" : "Public price");
  if (candidate.warnings.length) {
    notes.push(
      ...candidate.warnings.filter(
        (warning) => !warning.startsWith("discount applied:") && !warning.startsWith("price is "),
      ),
    );
  }
  return notes.join("; ");
}

async function renderRouteMap(inputs, result) {
  const route = inputs.route;
  const candidates = routeDisplayCandidates(result);
  const routeItems = candidates
    .filter((candidate) => isMappable(candidate.station))
    .map((candidate, index) => ({
      ...candidate,
      mapKind: "route",
      rank: index + 1,
      distanceKm: candidate.distanceToRouteKm,
    }));
  const nearbyItems = routeNearbyStations(inputs, result, routeItems);
  const items = [...routeItems, ...nearbyItems];
  state.routeContextStations = items;

  if (
    state.selectedStationCode &&
    !items.some((item) => item.station.stationCode === state.selectedStationCode)
  ) {
    state.selectedStationCode = null;
  }

  if (shouldUseGoogleMaps()) {
    try {
      await renderRouteMapWithGoogle(route, items, routeItems);
      return;
    } catch (error) {
      state.googleMapsError = error;
      state.mapProvider = "osm";
      renderSource(result);
    }
  }

  renderRouteMapWithLeaflet(route, items, routeItems);
}

async function renderRouteMapWithGoogle(route, items, routeItems) {
  const maps = await loadGoogleMaps();
  prepareMapContainer("route", "google");
  els.visual.hidden = false;
  els.routeMapFallback.hidden = true;

  if (!state.routeMap) {
    state.routeMap = new maps.Map(els.visual, {
      center: googlePoint(route.points[0]),
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    state.routeInfoWindow = new maps.InfoWindow();
  }

  clearGoogleOverlays("route");
  const overlays = [];
  const path = route.points.map(googlePoint);
  const shadowLine = new maps.Polyline({
    map: state.routeMap,
    path,
    strokeColor: "#087a87",
    strokeOpacity: 0.16,
    strokeWeight: 18,
  });
  const routeLine = new maps.Polyline({
    map: state.routeMap,
    path,
    strokeColor: "#087a87",
    strokeOpacity: 0.9,
    strokeWeight: 6,
  });
  overlays.push(shadowLine, routeLine);

  [route.points[0], route.points[route.points.length - 1]].forEach((point) => {
    const marker = createGooglePointMarker({
      map: state.routeMap,
      position: googlePoint(point),
      title: point.label,
    });
    marker.addListener("click", () => {
      state.routeInfoWindow.setContent(escapeHtml(point.label));
      state.routeInfoWindow.open(state.routeMap, marker);
    });
    overlays.push(marker);
  });

  let focusedMarker = null;
  let focusedItem = null;
  items.forEach((item) => {
    const selectionKey = routeSelectionKey(item);
    const tone = routePinTone(item, routeItems);
    const marker = createGooglePriceMarker({
      map: state.routeMap,
      position: googlePoint(item.station),
      tone,
      label: item.adjustedCpl.toFixed(1),
      rank: item.mapKind === "route" ? item.rank : null,
      station: item.station,
      title: `${item.station.name} ${item.adjustedCpl.toFixed(1)} c/L`,
    });
    marker.addListener("click", () => {
      selectRouteStation(selectionKey, { focusMap: true });
    });
    if (selectionKey === state.routeMapFocusStationKey) {
      focusedMarker = marker;
      focusedItem = item;
    }
    overlays.push(marker);
  });

  const bounds = new maps.LatLngBounds();
  path.forEach((point) => bounds.extend(point));
  items.forEach((item) => bounds.extend(googlePoint(item.station)));
  state.routeMap.fitBounds(bounds, 28);
  state.routeGoogleOverlays = overlays;
  if (focusedMarker && focusedItem) {
    window.setTimeout(() => {
      state.routeMap?.panTo(googlePoint(focusedItem.station));
      state.routeInfoWindow?.setContent(routePopup(focusedItem));
      state.routeInfoWindow?.open(state.routeMap, focusedMarker);
      state.routeMapFocusStationKey = null;
    }, 0);
  } else if (state.routeMapFocusStationKey) {
    state.routeMapFocusStationKey = null;
  }
}

function renderRouteMapWithLeaflet(route, items, routeItems) {
  if (!window.L) {
    renderRouteMapFallback(route, items);
    return;
  }

  prepareMapContainer("route", "osm");
  els.visual.hidden = false;
  els.routeMapFallback.hidden = true;

  if (!state.routeMap) {
    state.routeMap = L.map(els.visual, {
      zoomControl: true,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(state.routeMap);
    state.routeMarkers = L.layerGroup().addTo(state.routeMap);
  }

  state.routeMarkers.clearLayers();
  const routeLatLngs = route.points.map((point) => [point.lat, point.lon]);
  L.polyline(routeLatLngs, {
    color: "#087a87",
    weight: 6,
    opacity: 0.9,
  }).addTo(state.routeMarkers);
  L.polyline(routeLatLngs, {
    color: "#087a87",
    weight: 18,
    opacity: 0.14,
  }).addTo(state.routeMarkers);

  [route.points[0], route.points[route.points.length - 1]].forEach((point) => {
    L.circleMarker([point.lat, point.lon], {
      radius: 7,
      weight: 3,
      color: "#17201b",
      fillColor: "#ffffff",
      fillOpacity: 1,
    })
      .bindPopup(escapeHtml(point.label))
      .addTo(state.routeMarkers);
  });

  let focusedMarker = null;
  let focusedItem = null;
  items.forEach((item) => {
    const selectionKey = routeSelectionKey(item);
    const markerHtml =
      item.mapKind === "route"
        ? mapPinLabelHtml(item.station, item.adjustedCpl.toFixed(1), { rank: item.rank })
        : mapPinLabelHtml(item.station, item.adjustedCpl.toFixed(1));
    const marker = L.marker([item.station.lat, item.station.lon], {
      icon: L.divIcon({
        className: `price-pin ${routePinTone(item, routeItems)} ${item.mapKind === "nearby" ? "context-pin" : ""}`,
        html: markerHtml,
        iconSize: [72, 34],
        iconAnchor: [36, 34],
      }),
      title: `${item.station.name} ${item.adjustedCpl.toFixed(1)} c/L`,
      keyboard: false,
    });
    marker.on("click", () => {
      selectRouteStation(selectionKey, { focusMap: true });
    });
    makeMapMarkerDecorative(marker, { routeStationKey: selectionKey });
    if (selectionKey === state.routeMapFocusStationKey) {
      focusedMarker = marker;
      focusedItem = item;
    }
    marker.bindPopup(routePopup(item)).addTo(state.routeMarkers);
  });

  const bounds = L.latLngBounds([
    ...routeLatLngs,
    ...items.map((item) => [item.station.lat, item.station.lon]),
  ]);
  state.routeMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
  window.setTimeout(() => state.routeMap?.invalidateSize(), 0);
  if (focusedMarker && focusedItem) {
    window.setTimeout(() => {
      state.routeMap?.panTo([focusedItem.station.lat, focusedItem.station.lon]);
      focusedMarker.openPopup();
      syncLeafletSelectedPins(routeSelectionKey(focusedItem));
      state.routeMapFocusStationKey = null;
    }, 0);
  } else if (state.routeMapFocusStationKey) {
    state.routeMapFocusStationKey = null;
  }
}

function routeNearbyStations(inputs, result, routeItems) {
  const routeCodes = new Set(
    (result.recommendations || []).map((item) => item.station.stationCode),
  );
  if (Array.isArray(result.contextStations) && result.contextStations.length) {
    return result.contextStations
      .filter((station) => {
        if (routeCodes.has(station.stationCode)) return false;
        if (!isMappable(station)) return false;
        if (!stationMatchesBrand(station, inputs)) return false;
        if (!station.prices || station.prices[inputs.fuel] === undefined) return false;
        return true;
      })
      .map((station) => {
        const discount = eligibleDiscount(station, inputs.eligibleDiscounts);
        const possible = possibleDiscount(station, inputs.eligibleDiscounts);
        const pumpCpl = Number(station.pumpCpl || station.prices[inputs.fuel]);
        const possibleDiscountCpl = possible.cents > discount.cents ? possible.cents : 0;
        const adjustedCpl = Math.max(0, pumpCpl - discount.cents);
        const distanceToRouteKm = Number(station.distanceToRouteKm || 0);
        const detourKm = distanceToRouteKm * 2 * inputs.detourFactor;
        const detourSpeed = inputs.route.defaultDetourSpeedKmh || 45;
        const detourMinutes = detourSpeed > 0 ? (detourKm / detourSpeed) * 60 : 0;
        const detourFuelLitres = (detourKm * inputs.economy) / 100;
        const detourCost = detourFuelLitres * (adjustedCpl / 100);
        const fillLitres = Math.max(5, inputs.tankLitres * (1 - inputs.tankPercent / 100));
        const baselineCpl = Number(result.context.baselineCpl || pumpCpl);
        const netSaving = fillLitres * ((baselineCpl - adjustedCpl) / 100) - detourCost;
        return {
          station,
          fuel: inputs.fuel,
          pumpCpl,
          adjustedCpl,
          discountCpl: discount.cents,
          discountLabels: discount.labels,
          possibleDiscountCpl,
          possibleDiscountLabels: possibleDiscountCpl ? possible.labels : [],
          possibleAdjustedCpl: possibleDiscountCpl
            ? Math.max(0, pumpCpl - possibleDiscountCpl)
            : adjustedCpl,
          mapKind: "nearby",
          distanceKm: distanceToRouteKm,
          distanceToRouteKm,
          distanceAlongRouteKm: Number(station.distanceAlongRouteKm || 0),
          detourKm,
          detourMinutes,
          detourCost,
          fillLitres,
          netSaving,
          reachable: true,
          openNow: station.openNow !== false,
          warnings: [],
        };
      })
      .sort((a, b) => a.distanceToRouteKm - b.distanceToRouteKm || a.adjustedCpl - b.adjustedCpl)
      .slice(0, 30);
  }
  const contextKm = Math.max(inputs.mapRadiusKm, inputs.corridorKm + 4);
  return state.stations
    .filter((station) => {
      if (routeCodes.has(station.stationCode)) return false;
      if (!isMappable(station)) return false;
      if (!stationMatchesBrand(station, inputs)) return false;
      if (!station.prices || station.prices[inputs.fuel] === undefined) return false;
      const position = nearestRoutePosition(station, inputs.route.points);
      return position.distanceToRouteKm <= contextKm;
    })
    .map((station) => {
      const position = nearestRoutePosition(station, inputs.route.points);
      const discount = eligibleDiscount(station, inputs.eligibleDiscounts);
      const possible = possibleDiscount(station, inputs.eligibleDiscounts);
      const pumpCpl = Number(station.prices[inputs.fuel]);
      const possibleDiscountCpl = possible.cents > discount.cents ? possible.cents : 0;
      const adjustedCpl = Math.max(0, pumpCpl - discount.cents);
      const detourKm = position.distanceToRouteKm * 2 * inputs.detourFactor;
      const detourSpeed = inputs.route.defaultDetourSpeedKmh || 45;
      const detourMinutes = detourSpeed > 0 ? (detourKm / detourSpeed) * 60 : 0;
      const detourFuelLitres = (detourKm * inputs.economy) / 100;
      const detourCost = detourFuelLitres * (adjustedCpl / 100);
      const fillLitres = Math.max(5, inputs.tankLitres * (1 - inputs.tankPercent / 100));
      const baselineCpl = Number(result.context.baselineCpl || pumpCpl);
      const netSaving = fillLitres * ((baselineCpl - adjustedCpl) / 100) - detourCost;
      return {
        station,
        fuel: inputs.fuel,
        pumpCpl,
        adjustedCpl,
        discountCpl: discount.cents,
        discountLabels: discount.labels,
        possibleDiscountCpl,
        possibleDiscountLabels: possibleDiscountCpl ? possible.labels : [],
        possibleAdjustedCpl: possibleDiscountCpl
          ? Math.max(0, pumpCpl - possibleDiscountCpl)
          : adjustedCpl,
        mapKind: "nearby",
        distanceKm: position.distanceToRouteKm,
        distanceToRouteKm: position.distanceToRouteKm,
        distanceAlongRouteKm: position.distanceAlongRouteKm,
        detourKm,
        detourMinutes,
        detourCost,
        fillLitres,
        netSaving,
        reachable: true,
        openNow: station.openNow !== false,
        warnings: [],
      };
    })
    .sort((a, b) => a.distanceToRouteKm - b.distanceToRouteKm || a.adjustedCpl - b.adjustedCpl)
    .slice(0, 30);
}

function isMappable(station) {
  return Number.isFinite(Number(station?.lat)) && Number.isFinite(Number(station?.lon));
}

function routePinTone(item, routeItems) {
  if (routeItemMatchesSelection(item)) return "pin-selected";
  if (item.station.openNow === false) return "pin-muted";
  if (item.station.membershipRequired) return "pin-member";
  if (item.mapKind === "nearby") return "pin-nearby";
  if (item.station.stationCode === routeItems[0]?.station.stationCode) return "pin-cheap";
  if (item.reachable === false) return "pin-risk";
  return "pin-route";
}

function syncLeafletSelectedPins(selectionKey) {
  document.querySelectorAll(".leaflet-marker-icon.price-pin.pin-selected").forEach((node) => {
    if (node.dataset.routeStationKey !== selectionKey) {
      node.classList.remove("pin-selected");
    }
  });
}

function routePopup(item) {
  const priceView = candidatePriceView(item);
  const role = item.mapKind === "route" ? `Ranked route stop #${item.rank}` : "Other nearby station";
  const distance =
    item.mapKind === "route"
      ? `${item.distanceToRouteKm.toFixed(1)} km from route`
      : `${item.distanceToRouteKm.toFixed(1)} km from route context`;
  const discount = priceView.confirmedCpl
    ? `<br>${escapeHtml(`${priceView.confirmedCpl.toFixed(1)} c/L confirmed: ${priceView.confirmedLabels.join(", ")}`)}`
    : "";
  const possible = priceView.possibleDiscountCpl
    ? `<br>${escapeHtml(`Possible ${priceView.possibleAdjustedCpl.toFixed(1)} c/L with ${priceView.possibleDiscountLabels.join(", ")}`)}`
    : "";
  const access = [
    item.station.openNow === false ? "Closed" : "Open",
    item.station.membershipRequired ? "Member price" : "Public price",
  ].join(" | ");
  return `
    <strong>${escapeHtml(item.station.name)}</strong><br>
    ${escapeHtml(stationBrand(item.station))} | ${escapeHtml(item.station.suburb || "")}<br>
    ${escapeHtml(role)}<br>
    Pump ${item.pumpCpl.toFixed(1)} c/L | Your price ${item.adjustedCpl.toFixed(1)} c/L${discount}${possible}<br>
    ${escapeHtml(distance)}<br>
    ${escapeHtml(access)}
  `;
}

function renderRouteMapFallback(route, items) {
  els.visual.hidden = true;
  els.routeMapFallback.hidden = false;
  els.routeMapFallback.innerHTML = `
    <strong>${escapeHtml(route.name)}</strong>
    <div class="fallback-pins">
      ${items
        .slice(0, 16)
        .map(
          (item) =>
            `<button type="button" data-station-code="${escapeHtml(item.station.stationCode)}">${escapeHtml(item.station.name)} ${item.adjustedCpl.toFixed(1)} c/L</button>`,
        )
        .join("")}
    </div>
  `;
}

async function renderExplore(inputs, result, renderId) {
  const nearbyInputs = getNearbyInputs(inputs);
  const source = result.context.source === "api_nsw" ? "live" : "sample";
  const centre = getMapCentre(nearbyInputs.route);
  let stations;

  try {
    stations = await loadNearbyStations(nearbyInputs, source, centre);
  } catch (error) {
    stations = localNearbyStations(nearbyInputs, centre);
    if (!stations.length) {
      els.mapFallback.hidden = false;
      els.mapFallback.textContent = `Nearby map unavailable: ${error.message}`;
    }
  }

  if (renderId !== state.renderId) return;

  syncBrandFilters(state.stations);
  const mapInputs = { ...nearbyInputs, selectedBrands: getSelectedBrands() };
  const scoredStations = scoreNearbyStations(stations, mapInputs, centre);
  state.exploreStations = scoredStations;
  renderNearbyMapChrome(centre);

  if (
    state.selectedStationCode &&
    !scoredStations.some((item) => item.station.stationCode === state.selectedStationCode)
  ) {
    state.selectedStationCode = null;
    state.nearbyDetailOpen = false;
  }
  if (!scoredStations.length) {
    state.nearbyDetailOpen = false;
  }

  renderNearbyList(scoredStations);
  renderSelectedStation(scoredStations);
  await renderExploreMarkers(scoredStations, centre);
}

function getMapCentre(route) {
  if (state.mapCentreMode === "device" && state.deviceCentre) {
    return state.deviceCentre;
  }
  const [start] = route.points;
  return {
    lat: start.lat,
    lon: start.lon,
    label: start.label || "Route start",
  };
}

function renderNearbyMapChrome(centre) {
  if (!els.nearbyCentreLabel) return;
  if (state.nearbyLocationState === "pending") {
    els.nearbyCentreLabel.textContent = "Locating...";
    return;
  }
  els.nearbyCentreLabel.textContent = shortCentreLabel(centre.label || "Current location");
}

function shortCentreLabel(label) {
  const clean = String(label || "Current location").trim();
  if (!clean || clean === "Route start") return "Current location";
  if (clean === "Your location") return clean;
  const parts = clean.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 2).join(", ");
  return clean.length > 30 ? `${clean.slice(0, 27)}...` : clean;
}

async function loadNearbyStations(inputs, source, centre) {
  const cacheKey = [
    source,
    inputs.fuel,
    centre.lat.toFixed(4),
    centre.lon.toFixed(4),
    inputs.mapRadiusKm,
    inputs.includeClosed ? "closed" : "open",
    inputs.includeMemberPrices ? "member" : "public",
  ].join("|");
  if (!state.forcePriceRefresh && state.stationCache.has(cacheKey)) {
    return state.stationCache.get(cacheKey);
  }

  if (!state.apiAvailable && source === "sample") {
    const stations = localNearbyStations(inputs, centre);
    state.stationCache.set(cacheKey, stations);
    return stations;
  }

  const params = new URLSearchParams({
    source,
    fuel: inputs.fuel,
    lat: String(centre.lat),
    lon: String(centre.lon),
    label: centre.label,
    radiusKm: String(inputs.mapRadiusKm),
    includeMemberPrices: inputs.includeMemberPrices ? "1" : "0",
    includeClosed: inputs.includeClosed ? "1" : "0",
    forceRefresh: state.forcePriceRefresh ? "1" : "0",
    limit: "250",
  });
  if (inputs.filterBrands) {
    params.set("brandFilter", "1");
    params.set("brands", Array.from(inputs.selectedBrands).join(","));
  }
  const response = await fetch(`${API_STATIONS_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Stations request failed with ${response.status}`);
  }
  state.stationCache.set(cacheKey, payload.stations || []);
  return payload.stations || [];
}

function localNearbyStations(inputs, centre) {
  return state.stations
    .filter((station) => {
      if (!station.prices || !Object.prototype.hasOwnProperty.call(station.prices, inputs.fuel)) {
        return false;
      }
      if (!inputs.includeClosed && station.openNow === false) {
        return false;
      }
      if (!inputs.includeMemberPrices && station.membershipRequired) {
        return false;
      }
      const distanceKm = haversineKm(centre, station);
      return distanceKm <= inputs.mapRadiusKm;
    })
    .map((station) => ({ ...station, distanceKm: round(haversineKm(centre, station), 2) }));
}

function scoreNearbyStations(stations, inputs, centre) {
  const items = stations
    .filter((station) => stationMatchesBrand(station, inputs))
    .filter((station) => station.prices && station.prices[inputs.fuel] !== undefined)
    .map((station) => {
      const pumpCpl = Number(station.prices[inputs.fuel]);
      const discount = eligibleDiscount(station, inputs.eligibleDiscounts);
      const possible = possibleDiscount(station, inputs.eligibleDiscounts);
      const possibleDiscountCpl = possible.cents > discount.cents ? possible.cents : 0;
      const adjustedCpl = Math.max(0, pumpCpl - discount.cents);
      const distanceKm =
        Number.isFinite(Number(station.distanceKm)) ? Number(station.distanceKm) : haversineKm(centre, station);
      return {
        station,
        pumpCpl,
        adjustedCpl,
        discountCpl: discount.cents,
        discountLabels: discount.labels,
        possibleDiscountCpl,
        possibleDiscountLabels: possibleDiscountCpl ? possible.labels : [],
        possibleAdjustedCpl: possibleDiscountCpl ? Math.max(0, pumpCpl - possibleDiscountCpl) : adjustedCpl,
        distanceKm,
      };
    });
  return sortNearbyStations(items, inputs);
}

function sortNearbyStations(items, inputs) {
  const sortMode = inputs.nearbySort || "value";
  return [...items].sort((a, b) => {
    if (sortMode === "distance") {
      return a.distanceKm - b.distanceKm || a.adjustedCpl - b.adjustedCpl;
    }
    if (sortMode === "price") {
      return a.adjustedCpl - b.adjustedCpl || a.distanceKm - b.distanceKm;
    }
    return (
      nearbyValueScore(a, inputs) - nearbyValueScore(b, inputs) ||
      a.adjustedCpl - b.adjustedCpl ||
      a.distanceKm - b.distanceKm
    );
  });
}

function nearbyValueScore(item, inputs) {
  const fillLitres = Math.max(25, Number(inputs.tankLitres || 55) * 0.75);
  const fuelCost = (item.adjustedCpl / 100) * fillLitres;
  const roundTripKm = item.distanceKm * 2;
  const travelLitres = (roundTripKm * Number(inputs.economy || 8.2)) / 100;
  const travelCost = travelLitres * (item.adjustedCpl / 100);
  return fuelCost + travelCost;
}

function renderNearbyList(stations) {
  updateNearbySortTabs();
  const listOpen = Boolean(state.nearbySort);
  if (els.nearbyPanel) {
    els.nearbyPanel.classList.toggle("is-map-only", !listOpen);
  }
  if (els.nearbyRows) {
    els.nearbyRows.hidden = !listOpen;
  }
  if (!listOpen) {
    els.nearbyRows.innerHTML = "";
    renderSelectedStation(stations);
    return;
  }
  if (!stations.length) {
    els.nearbyRows.innerHTML = `<p class="empty-state">No stations match the current fuel and brand filters.</p>`;
    renderSelectedStation(stations);
    return;
  }
  els.nearbyRows.innerHTML = stations
    .slice(0, 10)
    .map((item) => {
      const selected = item.station.stationCode === state.selectedStationCode;
      const priceView = candidatePriceView(item);
      const address = [item.station.address, item.station.suburb].filter(Boolean).join(" ");
      const walletLabel = priceView.confirmedCpl ? `Wallet price, pump ${priceView.pumpCpl.toFixed(1)}` : "Pump price";
      return `
        <button class="nearby-row" type="button" data-station-code="${escapeHtml(item.station.stationCode)}" aria-pressed="${selected}">
          <span class="nearby-price-tile">
            <b>${item.adjustedCpl.toFixed(1)}</b>
            <small>${escapeHtml(state.nearbyFuel || "Fuel")}</small>
          </span>
          <span class="nearby-row-main">
            <strong>${brandMarkHtml(item.station)}${escapeHtml(item.station.name)}</strong>
            <span>${escapeHtml(address || stationBrand(item.station))}</span>
            <em>${item.distanceKm.toFixed(1)} km</em>
          </span>
          <span class="nearby-row-action">
            <span>map</span>
            <small>${escapeHtml(walletLabel)}</small>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderSelectedStation(stations) {
  if (!els.selectedStation) return;
  const selected = stations.find((item) => item.station.stationCode === state.selectedStationCode);
  if (!state.nearbyDetailOpen || !selected) {
    els.selectedStation.hidden = true;
    els.selectedStation.innerHTML = "";
    return;
  }
  els.selectedStation.hidden = false;
  const openLabel = selected.station.openNow === false ? "Closed" : "Open";
  const memberLabel = selected.station.membershipRequired ? "Member price" : "Public price";
  const priceView = candidatePriceView(selected);
  const discountLabel = priceView.confirmedCpl
    ? `${priceView.confirmedCpl.toFixed(1)} c/L off: ${priceView.confirmedLabels.join(", ")}`
    : "No selected discount";
  const possibleLabel = priceView.possibleDiscountCpl
    ? `Possible ${priceView.possibleAdjustedCpl.toFixed(1)} c/L with ${priceView.possibleDiscountLabels.join(", ")}`
    : "No lower wallet price flagged";
  els.selectedStation.innerHTML = `
    <strong>${brandMarkHtml(selected.station)}${escapeHtml(selected.station.name)}</strong>
    <span>${escapeHtml(stationBrand(selected.station))} | ${escapeHtml(selected.station.suburb || "")}</span>
    <div class="selected-price">
      <span>Pump ${selected.pumpCpl.toFixed(1)} c/L</span>
      <b>Your price ${selected.adjustedCpl.toFixed(1)} c/L</b>
    </div>
    <span>${escapeHtml(discountLabel)}</span>
    <span>${escapeHtml(possibleLabel)}</span>
    <span>${selected.distanceKm.toFixed(1)} km from centre | ${openLabel} | ${memberLabel}</span>
    <span>Last updated ${selected.station.updatedAt ? formatDateTime(selected.station.updatedAt) : "not available"}</span>
  `;
}

async function renderExploreMarkers(stations, centre) {
  if (shouldUseGoogleMaps()) {
    try {
      await renderExploreMarkersWithGoogle(stations, centre);
      return;
    } catch (error) {
      state.googleMapsError = error;
      state.mapProvider = "osm";
      if (state.result) {
        renderSource(state.result);
      }
    }
  }

  renderExploreMarkersWithLeaflet(stations, centre);
}

async function renderExploreMarkersWithGoogle(stations, centre) {
  const maps = await loadGoogleMaps();
  prepareMapContainer("explore", "google");
  els.exploreMap.hidden = false;
  els.mapFallback.hidden = true;

  if (!state.exploreMap) {
    state.exploreMap = new maps.Map(els.exploreMap, {
      center: googlePoint(centre),
      zoom: mapZoomForRadius(numberValue(els.nearbyRadiusKm, 8)),
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    state.exploreInfoWindow = new maps.InfoWindow();
  }

  clearGoogleOverlays("explore");
  const overlays = [];
  state.exploreMap.setCenter(googlePoint(centre));
  state.exploreMap.setZoom(mapZoomForRadius(numberValue(els.nearbyRadiusKm, 8)));

  const centreMarker = createGooglePointMarker({
    map: state.exploreMap,
    position: googlePoint(centre),
    title: centre.label,
  });
  centreMarker.addListener("click", () => {
    state.exploreInfoWindow.setContent(escapeHtml(centre.label));
    state.exploreInfoWindow.open(state.exploreMap, centreMarker);
  });
  overlays.push(centreMarker);

  stations.forEach((item) => {
    const marker = createGooglePriceMarker({
      map: state.exploreMap,
      position: googlePoint(item.station),
      tone: pinTone(item, stations),
      label: item.adjustedCpl.toFixed(1),
      nearby: true,
      station: item.station,
      title: `${item.station.name} ${item.adjustedCpl.toFixed(1)} c/L`,
    });
    marker.addListener("click", () => {
      state.selectedStationCode = item.station.stationCode;
      state.nearbyDetailOpen = false;
      renderNearbyList(state.exploreStations);
      renderSelectedStation(state.exploreStations);
      state.exploreInfoWindow.setContent(
        `<strong>${escapeHtml(item.station.name)}</strong><br>${item.adjustedCpl.toFixed(1)} c/L ${escapeHtml(state.nearbyFuel)}`,
      );
      state.exploreInfoWindow.open(state.exploreMap, marker);
    });
    overlays.push(marker);
  });

  state.exploreGoogleOverlays = overlays;
}

function renderExploreMarkersWithLeaflet(stations, centre) {
  if (!window.L) {
    renderMapFallback(stations, centre);
    return;
  }
  prepareMapContainer("explore", "osm");
  els.exploreMap.hidden = false;
  els.mapFallback.hidden = true;

  if (!state.exploreMap) {
    state.exploreMap = L.map(els.exploreMap, {
      zoomControl: true,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(state.exploreMap);
    state.exploreMarkers = L.layerGroup().addTo(state.exploreMap);
  }

  state.exploreMap.setView([centre.lat, centre.lon], mapZoomForRadius(numberValue(els.nearbyRadiusKm, 8)));
  state.exploreMarkers.clearLayers();
  L.circleMarker([centre.lat, centre.lon], {
    radius: 7,
    weight: 3,
    color: "#17201b",
    fillColor: "#ffffff",
    fillOpacity: 1,
  })
    .bindPopup(escapeHtml(centre.label))
    .addTo(state.exploreMarkers);

  stations.forEach((item) => {
    const marker = L.marker([item.station.lat, item.station.lon], {
      icon: L.divIcon({
        className: `price-pin nearby-price-pin ${pinTone(item, stations)}`,
        html: mapPinLabelHtml(item.station, item.adjustedCpl.toFixed(1), { nearby: true }),
        iconSize: [88, 40],
        iconAnchor: [44, 40],
      }),
      title: `${item.station.name} ${item.adjustedCpl.toFixed(1)} c/L`,
      keyboard: false,
    });
    marker.on("click", () => {
      state.selectedStationCode = item.station.stationCode;
      state.nearbyDetailOpen = false;
      renderNearbyList(state.exploreStations);
      renderSelectedStation(state.exploreStations);
    });
    makeMapMarkerDecorative(marker);
    marker
      .bindPopup(
        `<strong>${escapeHtml(item.station.name)}</strong><br>${item.adjustedCpl.toFixed(1)} c/L ${escapeHtml(state.nearbyFuel)}`,
      )
      .addTo(state.exploreMarkers);
  });

  window.setTimeout(() => state.exploreMap?.invalidateSize(), 0);
}

function renderMapFallback(stations, centre) {
  els.exploreMap.hidden = true;
  els.mapFallback.hidden = false;
  els.mapFallback.innerHTML = `
    <strong>${escapeHtml(centre.label)}</strong>
    <div class="fallback-pins">
      ${stations
        .slice(0, 12)
        .map(
          (item) =>
            `<button type="button" data-station-code="${escapeHtml(item.station.stationCode)}">${escapeHtml(item.station.name)} ${item.adjustedCpl.toFixed(1)} c/L</button>`,
        )
        .join("")}
    </div>
  `;
}

function pinTone(item, stations) {
  if (item.station.stationCode === state.selectedStationCode) return "pin-selected";
  if (item.station.openNow === false) return "pin-muted";
  if (item.station.membershipRequired) return "pin-member";
  const cheapest = Math.min(...stations.map((station) => station.adjustedCpl));
  if (item.adjustedCpl <= cheapest + 1) return "pin-cheap";
  return "pin-standard";
}

function mapZoomForRadius(radiusKm) {
  if (radiusKm <= 3) return 14;
  if (radiusKm <= 8) return 12;
  if (radiusKm <= 18) return 11;
  return 9;
}

function selectExploreStation(stationCode, options = {}) {
  state.selectedStationCode = stationCode;
  state.selectedRouteStationKey = null;
  state.nearbyDetailOpen = options.showDetails !== false;
  renderNearbyList(state.exploreStations);
  renderSelectedStation(state.exploreStations);
  renderExploreMarkers(state.exploreStations, getMapCentre(getInputs().route)).catch(() => {
    renderMapFallback(state.exploreStations, getMapCentre(getInputs().route));
  });
}

function selectRouteStation(selection, options = {}) {
  const item = routeSelectionItem(selection);
  const selectionKey = item ? routeSelectionKey(item) : selection;
  state.selectedRouteStationKey = selectionKey;
  state.selectedStationCode = item?.station?.stationCode || selection;
  if (options.focusMap) {
    state.routeMapFocusStationKey = selectionKey;
  }
  if (state.result) {
    renderTable(routeDisplayCandidates(state.result), state.result);
    renderRouteSelectedStation(state.result);
    if (options.focusList !== false) {
      scrollSelectedRouteStopIntoView(selectionKey);
    }
    if (options.refreshMap !== false) {
      refreshRouteMapSelection();
    }
  }
}

function scrollSelectedRouteStopIntoView(selectionKey) {
  window.setTimeout(() => {
    const node = Array.from(els.rows?.querySelectorAll("[data-route-stop]") || []).find(
      (item) => item.dataset.routeStop === selectionKey,
    );
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, 0);
}

function routeSelectionItem(selection) {
  const candidates = state.result ? sortedRouteCandidates(state.result) : [];
  const contextItems = state.routeContextStations || [];
  return [...candidates, ...contextItems].find((item) => {
    return routeSelectionKey(item) === selection || item.station.stationCode === selection;
  }) || null;
}

function refreshRouteMapSelection() {
  if (!state.result) return;
  const route = state.plannedRoute || resolveTripRoute();
  renderRouteMap(getInputs(route), state.result).catch(() => {
    renderRouteMapFallback(route, state.routeContextStations || []);
  });
}

function renderDebug(result) {
  const payload = {
    context: result.context,
    recommendations: result.recommendations.slice(0, 6).map((candidate) => ({
      stationCode: candidate.station.stationCode,
      name: candidate.station.name,
      adjustedCpl: round(candidate.adjustedCpl, 1),
      detourMinutes: round(candidate.detourMinutes, 1),
      netSaving: round(candidate.netSaving, 2),
      reachable: candidate.reachable,
      warnings: candidate.warnings,
    })),
  };
  els.debugJson.textContent = JSON.stringify(payload, null, 2);
}

function handleStationAction(action, stationCode = null) {
  const status = document.querySelector("#stationActionStatus");
  const selected =
    state.result && stationCode
      ? routeDisplayCandidates(state.result).find(
          (candidate) => candidate.station.stationCode === stationCode,
        )
      : state.result
        ? selectedRouteCandidate(state.result)
        : null;
  if (!status || !selected) return;
  const name = selected.station.name;
  const messages = {
    navigate: `Navigation handoff prepared for ${name}.`,
    favourite: `${name} added to favourites for demo alerts.`,
    alert: `Price alert preview noted for ${name}. Demo only; no alert was scheduled or sent.`,
    report: `Report price flow opened for ${name}. Demo only; no external price was submitted.`,
  };
  status.textContent = messages[action] || "Demo action selected.";
}

function focusRouteResults() {
  const target = els.routeResultsPanel || els.routeMapView;
  if (!target) return;
  window.setTimeout(() => {
    const headerOffset = document.querySelector(".app-header")?.getBoundingClientRect().height || 0;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
    refreshMapSize("route");
  }, 80);
}

function normaliseRegistration(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function lookupVehicleProfile() {
  const rego = normaliseRegistration(els.regoInput.value);
  const stateCode = els.regoState.value;
  if (!rego) {
    setVehicleStatus("Enter a registration number.", "warn");
    return;
  }
  const profile = VEHICLE_PROFILES[`${stateCode}:${rego}`] || null;
  if (!profile) {
    state.vehicleProfile = null;
    renderVehicleProfile();
    setVehicleStatus("No demo match found. Try FP123, UTE456, VAN789 or ACT321.", "warn");
    return;
  }
  state.vehicleProfile = profile;
  els.regoInput.value = profile.rego;
  setVehicleStatus(`${profile.name} found.`, "");
  renderVehicleProfile();
}

function renderVehicleProfile() {
  const profile = state.vehicleProfile;
  if (!profile) {
    els.vehicleProfileBadge.textContent = "None";
    els.vehicleProfileBadge.className = "status-pill muted";
    els.vehicleProfile.innerHTML = `<p class="empty-state">No vehicle saved.</p>`;
    els.applyVehicle.disabled = true;
    els.clearVehicle.disabled = true;
    renderPlanVehicleCard();
    return;
  }

  els.vehicleProfileBadge.textContent = `${profile.state} ${profile.rego}`;
  els.vehicleProfileBadge.className = "status-pill";
  els.vehicleProfile.innerHTML = `
    <strong>${escapeHtml(profile.name)}</strong>
    <span>${escapeHtml(profile.type)}</span>
    <div class="vehicle-stats">
      ${vehicleStat("Fuel", profile.fuel)}
      ${vehicleStat("Tank", `${profile.tankLitres} L`)}
      ${vehicleStat("Economy", `${profile.economy} L/100 km`)}
      ${vehicleStat("Reserve", `${profile.reserveKm} km`)}
    </div>
  `;
  els.applyVehicle.disabled = false;
  els.clearVehicle.disabled = false;
  renderPlanVehicleCard();
}

function vehicleStat(label, value) {
  return `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`;
}

function renderPlanVehicleCard() {
  if (!els.planVehicleCard) return;
  const profile = state.vehicleProfile;
  if (!profile) {
    els.planVehicleCard.className = "plan-vehicle-card muted";
    els.planVehicleCard.innerHTML = `
      <div>
        <span class="eyebrow">Vehicle</span>
        <strong>Manual</strong>
      </div>
      <p>Set a vehicle once for better fuel defaults.</p>
      <div class="plan-vehicle-actions">
        <button class="mini-button" type="button" data-open-account="vehicle">Set up vehicle</button>
      </div>
    `;
    return;
  }

  const fuelMatches = state.fuel === profile.fuel;
  const tankMatches = numberValue(els.tankLitres, profile.tankLitres) === profile.tankLitres;
  const economyMatches = numberValue(els.economy, profile.economy) === profile.economy;
  const reserveMatches = numberValue(els.reserveKm, profile.reserveKm) === profile.reserveKm;
  const profileAligned = fuelMatches && tankMatches && economyMatches && reserveMatches;
  const status = !fuelMatches
    ? `Override: ${state.fuel}. Profile uses ${profile.fuel}.`
    : profileAligned
      ? `${profile.fuel} | ${profile.tankLitres} L | ${profile.economy} L/100 km.`
      : `${profile.fuel} fuel selected. Refresh vehicle defaults in Account.`;

  els.planVehicleCard.className = `plan-vehicle-card ${fuelMatches ? "" : "warn"}`.trim();
  els.planVehicleCard.innerHTML = `
    <div>
      <span class="eyebrow">Vehicle</span>
      <strong>${escapeHtml(profile.name)}</strong>
    </div>
    <span class="status-pill ${fuelMatches ? "muted" : "warn"}">${escapeHtml(profile.state)} ${escapeHtml(profile.rego)}</span>
    <p>${escapeHtml(status)}</p>
    <div class="plan-vehicle-actions">
      <button class="mini-button" type="button" data-open-account="vehicle">Manage in Account</button>
    </div>
  `;
}

function setRouteSearchExpanded(expanded) {
  state.routeSearchExpanded = Boolean(expanded);
  els.routeResultsPanel?.classList.toggle("is-editing-route", state.routeSearchExpanded);
  if (els.routeSearchExpanded) {
    els.routeSearchExpanded.hidden = !state.routeSearchExpanded;
  }
  if (els.routeSearchToggle) {
    els.routeSearchToggle.setAttribute("aria-expanded", String(state.routeSearchExpanded));
    els.routeSearchToggle.classList.toggle("is-expanded", state.routeSearchExpanded);
  }
  renderRouteSearchSummary();
}

function renderRouteSearchSummary() {
  if (!els.routeSearchSummary || !els.routeSearchMeta) return;
  const destination = els.toAddress?.value?.trim() || "Where to?";
  const origin = els.fromAddress?.value?.trim();
  const profile = state.vehicleProfile;
  const vehicleLabel = profile ? `${profile.state} ${profile.rego}` : "Manual vehicle";
  const sourceLabelText =
    state.result?.context?.source === "api_nsw"
      ? "Live FuelCheck"
      : state.routeDirty
        ? "Route changed"
        : "Planning";
  els.routeSearchSummary.textContent = destination;
  els.routeSearchMeta.textContent = [
    origin ? `From ${origin}` : "",
    state.fuel,
    vehicleLabel,
    sourceLabelText,
  ]
    .filter(Boolean)
    .join(" | ");
}

function applyVehicleProfile() {
  const profile = state.vehicleProfile;
  if (!profile) return;
  state.fuel = profile.fuel;
  state.nearbyFuel = profile.fuel;
  els.tankLitres.value = profile.tankLitres;
  els.economy.value = profile.economy;
  els.reserveKm.value = profile.reserveKm;
  els.tankPercent.value = profile.tankPercent;
  els.tankPercentOutput.textContent = `${profile.tankPercent}%`;
  updateFuelButtons();
  renderPlanVehicleCard();
  renderRouteSearchSummary();
  setVehicleStatus(`${profile.name} applied to planner.`, "");
  render();
}

function clearVehicleProfile() {
  state.vehicleProfile = null;
  setVehicleStatus("Vehicle cleared.", "muted");
  renderVehicleProfile();
  renderPlanVehicleCard();
}

function setVehicleStatus(message, tone) {
  els.vehicleLookupStatus.textContent = message;
  els.vehicleLookupStatus.className = `account-status ${tone || ""}`.trim();
}

function applySavedCommute(routeId) {
  const saved = SAVED_ROUTE_PROFILES[routeId];
  if (!saved) return;
  state.activeSavedRouteId = routeId;
  els.fromAddress.value = saved.from;
  els.toAddress.value = saved.to;
  els.tankPercent.value = saved.tankPercent;
  els.tankPercentOutput.textContent = `${saved.tankPercent}%`;
  els.mapRadiusKm.value = saved.radiusKm;
  els.nearbyRadiusKm.value = saved.radiusKm;
  state.fuel = saved.fuel;
  state.nearbyFuel = saved.fuel;
  state.tripPlaces.from = null;
  state.tripPlaces.to = null;
  state.plannedRoute = null;
  state.activeRouteKey = "";
  state.stationCache.clear();
  state.selectedStationCode = null;
  state.selectedRouteStationKey = null;
  state.routeResultsExpanded = false;
  state.routeDirty = false;
  state.savedRouteSuggestionsOpen = false;
  state.focusRouteResultsAfterRender = true;
  updateFuelButtons();
  setRouteSearchExpanded(false);
  renderRouteSearchSummary();
  renderSavedRouteSuggestions();
  render().then(focusRouteResults);
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatCplDelta(value) {
  if (value > 0) return `${value.toFixed(1)} c/L cheaper`;
  if (value < 0) return `${Math.abs(value).toFixed(1)} c/L above median`;
  return "Matches the route median";
}

function formatDateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function syncBrandFilters(stations, options = {}) {
  const brands = allBrands(stations);
  if (!brands.length) {
    els.brandFilters.innerHTML = `<p class="empty-state">No brands available for this view.</p>`;
    return;
  }

  if (!state.brandFilterTouched || options.reset) {
    state.selectedBrands = new Set(brands);
  } else {
    state.selectedBrands = getSelectedBrands();
  }

  els.brandFilters.innerHTML = brands
    .map((brand) => {
      const checked = state.selectedBrands.has(brand);
      return `
        <label>
          <input type="checkbox" value="${escapeHtml(brand)}" ${checked ? "checked" : ""} />
          <span>${escapeHtml(brand)}</span>
        </label>
      `;
    })
    .join("");
}

function renderDiscountPrograms() {
  const container = document.querySelector(".discount-programs");
  if (!container) return;
  container.innerHTML = `
    <legend>Active programs</legend>
    ${Object.values(DISCOUNT_PROGRAMS)
      .map(
        (program) => `
          <label class="program-option">
            <input type="checkbox" value="${escapeHtml(program.id)}" />
            <span>
              <strong>${escapeHtml(program.shortLabel)}</strong>
              <small>${escapeHtml(program.caveat)}</small>
            </span>
          </label>
        `,
      )
      .join("")}
  `;
}

function initialiseControls() {
  const initialParams = new URLSearchParams(window.location.search);
  state.googleDirectionsEnabled =
    state.googleDirectionsEnabled || initialParams.get("googleDirections") === "1";
  els.fromAddress.value = initialParams.get("from") || DEFAULT_TRIP.from;
  els.toAddress.value = initialParams.get("to") || DEFAULT_TRIP.to;
  els.tankLitres.value = DEFAULT_TRIP.tankLitres;
  els.economy.value = DEFAULT_TRIP.economy;
  els.tankPercent.value = DEFAULT_TRIP.tankPercent;
  els.tankPercentOutput.textContent = `${DEFAULT_TRIP.tankPercent}%`;
  els.reserveKm.value = DEFAULT_TRIP.reserveKm;
  els.nearbyRadiusKm.value = els.mapRadiusKm.value;
  state.fuel = DEFAULT_TRIP.fuel;
  state.nearbyFuel = DEFAULT_TRIP.fuel;
  populateAddressOptions();
  syncBrandFilters(state.stations, { reset: true });
  renderDiscountPrograms();
  renderSavedRouteSelect();
  renderSavedRouteList();
  renderPlanVehicleCard();
  renderRouteSearchSummary();
  setRouteSearchExpanded(false);

  const fuelOptions = FUELS.map((fuel) => `<option value="${fuel}">${fuel}</option>`).join("");
  els.fuelSelect.innerHTML = fuelOptions;
  els.fuelSelect.value = state.fuel;
  els.nearbyFuelSelect.innerHTML = fuelOptions;
  els.nearbyFuelSelect.value = state.nearbyFuel;

  [
    ["from", els.fromAddress],
    ["to", els.toAddress],
  ].forEach(([kind, input]) => {
    input.addEventListener("focus", () => {
      setRouteSearchExpanded(true);
      state.activeAddressField = kind;
      state.savedRouteSuggestionsOpen = true;
      scheduleAddressSuggestions(kind);
      renderSavedRouteSuggestions();
    });
    input.addEventListener("input", () => {
      clearTripPlace(kind);
      state.activeAddressField = kind;
      state.savedRouteSuggestionsOpen = true;
      scheduleAddressSuggestions(kind);
      renderSavedRouteSuggestions();
      markRoutePending();
      renderRouteSearchSummary();
    });
    input.addEventListener("change", () => {
      state.activeAddressField = kind;
      state.savedRouteSuggestionsOpen = true;
      scheduleAddressSuggestions(kind, { immediate: true });
      renderSavedRouteSuggestions();
      markRoutePending();
      renderRouteSearchSummary();
    });
    input.addEventListener("blur", scheduleSavedRouteSuggestionsClose);
  });

  if (els.savedRouteSuggestions) {
    els.savedRouteSuggestions.addEventListener("pointerdown", (event) => {
      const button = event.target.closest("[data-saved-route]");
      if (!button) return;
      event.preventDefault();
      applySavedCommute(button.dataset.savedRoute);
    });
    els.savedRouteSuggestions.addEventListener("focusin", () => {
      state.savedRouteSuggestionsOpen = true;
      renderSavedRouteSuggestions();
    });
    els.savedRouteSuggestions.addEventListener("focusout", scheduleSavedRouteSuggestionsClose);
  }

  resolveTripRoute();

  els.fuelSelect.addEventListener("change", () => {
    state.fuel = els.fuelSelect.value;
    updateFuelButtons();
    renderPlanVehicleCard();
    renderRouteSearchSummary();
    render();
  });

  if (els.routeSearchToggle) {
    els.routeSearchToggle.addEventListener("click", () => {
      setRouteSearchExpanded(!state.routeSearchExpanded);
      if (state.routeSearchExpanded && els.toAddress) {
        window.setTimeout(() => els.toAddress.focus(), 0);
      }
    });
  }

  els.planRoute.addEventListener("click", () => {
    state.routeDirty = false;
    ["from", "to"].forEach((kind) => {
      const input = addressInputForKind(kind);
      if (state.tripPlaces[kind]?.inputValue !== input.value.trim()) {
        state.tripPlaces[kind] = null;
      }
    });
    state.stationCache.clear();
    state.selectedStationCode = null;
    state.selectedRouteStationKey = null;
    state.routeResultsExpanded = false;
    state.focusRouteResultsAfterRender = true;
    setRouteSearchExpanded(false);
    render().then(focusRouteResults);
  });

  if (els.refreshPrices) {
    els.refreshPrices.addEventListener("click", () => {
      const originalLabel = els.refreshPrices.textContent.trim() || "Refresh prices";
      state.forcePriceRefresh = true;
      state.stationCache.clear();
      state.selectedStationCode = null;
      state.selectedRouteStationKey = null;
      state.nearbyDetailOpen = false;
      els.refreshPrices.disabled = true;
      els.refreshPrices.textContent = "Refreshing";
      render()
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          state.forcePriceRefresh = false;
          els.refreshPrices.disabled = false;
          els.refreshPrices.textContent = originalLabel;
        });
    });
  }

  els.nearbyFuelSelect.addEventListener("change", () => {
    state.nearbyFuel = els.nearbyFuelSelect.value;
    state.stationCache.clear();
    state.selectedStationCode = null;
    state.nearbyDetailOpen = false;
    updateFuelButtons();
    render();
  });

  els.nearbySortTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-nearby-sort]");
    if (!button) return;
    state.nearbySort = state.nearbySort === button.dataset.nearbySort ? "" : button.dataset.nearbySort;
    state.selectedStationCode = null;
    state.nearbyDetailOpen = false;
    updateNearbySortTabs();
    render();
  });

  els.centreNearbyLocation.addEventListener("click", () => {
    state.nearbyLocationState = "idle";
    state.nearbyDetailOpen = false;
    requestNearbyLocation({ force: true });
  });

  if (els.routeSort) {
    els.routeSort.addEventListener("change", () => {
      state.routeSort = els.routeSort.value || "smart";
      state.selectedStationCode = null;
      state.routeResultsExpanded = false;
      render();
    });
  }

  els.controls.addEventListener("input", (event) => {
    if (
      event.target === els.fromAddress ||
      event.target === els.toAddress ||
      event.target.closest("#brandFilters") ||
      event.target.closest("#vehicleLookupForm") ||
      event.target.closest(".notification-list")
    ) {
      return;
    }
    if (event.target.closest(".check-list")) {
      state.nearbyDetailOpen = false;
      render();
      return;
    }
    if (event.target === els.tankPercent) {
      els.tankPercentOutput.textContent = `${els.tankPercent.value}%`;
    }
    if (event.target === els.nearbyRadiusKm) {
      state.stationCache.clear();
      state.selectedStationCode = null;
      state.nearbyDetailOpen = false;
    }
    if (state.mapCentreMode === "route") {
      state.selectedStationCode = null;
    }
    render();
  });

  els.brandFilters.addEventListener("change", () => {
    state.brandFilterTouched = true;
    state.selectedBrands = getSelectedBrands();
    state.selectedStationCode = null;
    state.nearbyDetailOpen = false;
    render();
  });

  els.selectAllBrands.addEventListener("click", () => {
    state.brandFilterTouched = true;
    Array.from(els.brandFilters.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
      input.checked = true;
    });
    state.selectedBrands = getSelectedBrands();
    state.selectedStationCode = null;
    state.nearbyDetailOpen = false;
    render();
  });

  els.clearBrands.addEventListener("click", () => {
    state.brandFilterTouched = true;
    Array.from(els.brandFilters.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
      input.checked = false;
    });
    state.selectedBrands = getSelectedBrands();
    state.selectedStationCode = null;
    state.nearbyDetailOpen = false;
    render();
  });

  els.vehicleLookupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    lookupVehicleProfile();
  });

  els.applyVehicle.addEventListener("click", () => {
    applyVehicleProfile();
  });

  els.clearVehicle.addEventListener("click", () => {
    clearVehicleProfile();
  });

  if (els.savedRouteSelect) {
    els.savedRouteSelect.addEventListener("change", () => {
      if (!els.savedRouteSelect.value) return;
      applySavedCommute(els.savedRouteSelect.value);
    });
  }

  if (els.applyCommute) {
    els.applyCommute.addEventListener("click", () => {
      applySavedCommute(state.activeSavedRouteId);
    });
  }

  els.controls.addEventListener("click", (event) => {
    const accountLink = event.target.closest("[data-open-account]");
    if (accountLink) {
      openAccountArea(accountLink.dataset.openAccount);
      return;
    }
    const lookupButton = event.target.closest("[data-lookup-address]");
    if (lookupButton) {
      lookupAddress(lookupButton.dataset.lookupAddress);
      return;
    }
    const addressButton = event.target.closest("[data-address-suggestion]");
    if (addressButton) {
      applyAddressSuggestion(addressButton.dataset.addressKind, addressButton.dataset.addressSuggestion);
      return;
    }
    const button = event.target.closest("[data-saved-route]");
    if (!button) return;
    applySavedCommute(button.dataset.savedRoute);
    state.activeTab = "plan";
    updateWorkspaceTabs();
  });

  els.workspaceTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    state.activeTab = button.dataset.tab;
    updateWorkspaceTabs();
  });

  els.workspaceTabs.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(els.workspaceTabs.querySelectorAll("[data-tab]"));
    const currentIndex = buttons.findIndex((button) => button.dataset.tab === state.activeTab);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % buttons.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = buttons.length - 1;
    event.preventDefault();
    state.activeTab = buttons[nextIndex].dataset.tab;
    updateWorkspaceTabs();
    buttons[nextIndex].focus();
  });

  if (els.viewButtons) {
    els.viewButtons.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (!button) return;
      state.activeView = button.dataset.view;
      updateViewButtons();
      render();
    });
  }

  els.nearbyRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-station-code]");
    if (!button) return;
    selectExploreStation(button.dataset.stationCode, { showDetails: true });
  });

  els.mapFallback.addEventListener("click", (event) => {
    const button = event.target.closest("[data-station-code]");
    if (!button) return;
    selectExploreStation(button.dataset.stationCode, { showDetails: false });
  });

  els.rows.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-route-results-toggle]");
    if (toggle) {
      state.routeResultsExpanded = !state.routeResultsExpanded;
      state.selectedStationCode = null;
      state.selectedRouteStationKey = null;
      render();
      return;
    }
    const button = event.target.closest("[data-route-stop]");
    if (!button) return;
    selectRouteStation(button.dataset.routeStop, { focusMap: true });
  });

  if (els.routeSelectedStation) {
    els.routeSelectedStation.addEventListener("click", (event) => {
      const button = event.target.closest("[data-station-action]");
      if (!button) return;
      handleStationAction(button.dataset.stationAction, button.dataset.stationCode);
    });
  }

  els.routeMapFallback.addEventListener("click", (event) => {
    const button = event.target.closest("[data-station-code]");
    if (!button) return;
    selectRouteStation(button.dataset.stationCode, { focusMap: true });
  });

  els.debugButton.addEventListener("click", () => {
    const isHidden = els.debugJson.hidden;
    els.debugJson.hidden = !isHidden;
    els.debugButton.setAttribute("aria-expanded", String(isHidden));
    els.debugButton.textContent = isHidden ? "Hide debug JSON" : "Show debug JSON";
  });
}

function openAccountArea(target) {
  state.activeTab = "account";
  updateWorkspaceTabs();
  window.setTimeout(() => {
    if (target === "vehicle" && els.regoInput) {
      els.regoInput.focus();
      els.regoInput.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, 0);
}

function updateFuelButtons() {
  if (els.fuelSelect) {
    els.fuelSelect.value = state.fuel;
  }
  if (els.nearbyFuelSelect) {
    els.nearbyFuelSelect.value = state.nearbyFuel;
  }
  Array.from(els.fuelButtons?.querySelectorAll("button") || []).forEach((item) => {
    item.setAttribute("aria-pressed", String(item.dataset.fuel === state.fuel));
  });
}

function updateNearbySortTabs() {
  Array.from(els.nearbySortTabs?.querySelectorAll("[data-nearby-sort]") || []).forEach((item) => {
    item.setAttribute("aria-pressed", String(item.dataset.nearbySort === state.nearbySort));
  });
}

function prepareNearbyLocationForTab() {
  if (state.deviceCentre) {
    if (state.mapCentreMode !== "device") {
      state.mapCentreMode = "device";
      state.selectedStationCode = null;
      window.setTimeout(() => render(), 0);
    }
    return;
  }

  if (["pending", "blocked", "unavailable"].includes(state.nearbyLocationState)) {
    return;
  }

  requestNearbyLocation();
}

function requestNearbyLocation(options = {}) {
  if (state.nearbyLocationState === "pending" && !options.force) {
    return;
  }

  if (!navigator.geolocation) {
    state.nearbyLocationState = "unavailable";
    state.mapCentreMode = "route";
    return;
  }

  state.nearbyLocationState = "pending";
  updateNearbyLocationButton();
  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.deviceCentre = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        label: "Your location",
      };
      state.nearbyLocationState = "ready";
      state.mapCentreMode = "device";
      state.selectedStationCode = null;
      updateNearbyLocationButton();
      if (state.activeTab === "nearby") {
        render();
      }
    },
    () => {
      state.nearbyLocationState = "blocked";
      state.mapCentreMode = "route";
      state.selectedStationCode = null;
      updateNearbyLocationButton();
      if (state.activeTab === "nearby") {
        render();
      }
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
  );
}

function updateNearbyLocationButton() {
  if (!els.centreNearbyLocation) return;
  const pending = state.nearbyLocationState === "pending";
  els.centreNearbyLocation.setAttribute("aria-busy", String(pending));
}

function updateWorkspaceTabs() {
  Array.from(els.workspaceTabs.querySelectorAll("[data-tab]")).forEach((button) => {
    const selected = button.dataset.tab === state.activeTab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  Object.entries(tabPanels).forEach(([tab, panel]) => {
    if (panel) {
      panel.hidden = tab !== state.activeTab;
    }
  });
  if (state.activeTab === "plan") {
    window.setTimeout(() => {
      refreshMapSize("route");
    }, 0);
  } else if (state.activeTab === "nearby") {
    state.nearbySort = "";
    state.selectedStationCode = null;
    state.nearbyDetailOpen = false;
    updateNearbySortTabs();
    renderNearbyList(state.exploreStations || []);
    prepareNearbyLocationForTab();
    window.setTimeout(() => refreshMapSize("explore"), 0);
  }
}

function updateViewButtons() {
  if (els.mapPanelTitle) {
    els.mapPanelTitle.textContent = "Map and ranked stops";
  }
  if (els.routeMapView) {
    els.routeMapView.hidden = false;
  }
  if (els.exploreMapView) {
    els.exploreMapView.hidden = false;
  }
  if (els.viewButtons) {
    Array.from(els.viewButtons.querySelectorAll("button")).forEach((item) => {
      item.setAttribute("aria-pressed", String(item.dataset.view === state.activeView));
    });
  }
}

async function boot() {
  const [routesPayload, stationsPayload] = await Promise.all(
    Object.values(DATA_URLS).map((url) => fetch(url).then((response) => response.json())),
  );
  state.routes = routesPayload.routes;
  state.stations = stationsPayload.stations;
  await detectApi();
  initialiseControls();
  renderVehicleProfile();
  initialisePlaceAutocomplete();
  updateWorkspaceTabs();
  updateViewButtons();
  render();
}

async function detectApi() {
  try {
    const response = await fetch(API_STATUS_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload.api !== "fuel-path-local") return;
    state.apiAvailable = true;
    state.apiDefaultSource = payload.defaultSource || "sample";
    state.googleMapsApiKey = payload.maps?.googleMapsApiKey || "";
    state.googleDirectionsEnabled = Boolean(payload.maps?.googleDirectionsEnabled);
    state.mapProvider =
      payload.maps?.provider === "google" && state.googleMapsApiKey ? "google" : "osm";
  } catch {
    state.apiAvailable = false;
    state.apiDefaultSource = "sample";
    state.mapProvider = "osm";
  }
}

boot().catch((error) => {
  els.title.textContent = "Demo data failed to load";
  els.reason.textContent = error.message;
});
