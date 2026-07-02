export type FuelCode = "E10" | "U91" | "P95" | "P98" | "DL" | "PDL";

export type FuelPathTab = "plan" | "nearby" | "account";

export type NearbySheetSnap = "peek" | "browse" | "full";

export type EvConnector = "CCS2" | "CHADEMO" | "TYPE2" | "TESLA" | "NACS";

export type EvPowerMode = "" | "ac" | "dc_fast" | "ultra_fast";

export type VehicleEnergyType = "petrol" | "diesel" | "hybrid" | "electric";

export type HomeChargingAccess = "unknown" | "yes" | "no";

export type EvChargingPreference = "balanced" | "cheap" | "fast" | "reliable" | "nearby";

export type AppPreferences = {
  vehicleName: string;
  vehicleRego: string;
  vehicleEnergyType: VehicleEnergyType;
  fuel: FuelCode;
  evConnectors: EvConnector[];
  fuelTankLitres: number;
  evBatteryKwh: number;
  evRangeKm: number;
  homeChargingAccess: HomeChargingAccess;
  evChargingPreference: EvChargingPreference;
  minSavingDollars: number;
  maxDetourMinutes: number;
  fuelPolicyEnabled: boolean;
  approvedPolicyBrands: string[];
  selectedDiscounts: string[];
  discountRedemptions?: Record<string, DiscountRedemptionState>;
  homeLocation?: MapPoint;
  workLocation?: MapPoint;
};

export type DiscountRedemptionStatus = "available" | "redeemed_today";

export type DiscountRedemptionState = {
  status: DiscountRedemptionStatus;
  updatedAt: string;
};

export type CommuteAlertStatus =
  | "off"
  | "scheduled"
  | "backend_synced"
  | "needs_permission"
  | "unavailable"
  | "failed";

export type SavedCommute = {
  id: string;
  name: string;
  from: MapPoint;
  to: MapPoint;
  fuel: FuelCode;
  alertEnabled: boolean;
  alertTime: string;
  minSavingDollars: number;
  maxDetourMinutes: number;
  tankThresholdPercent: number;
  alertStatus?: CommuteAlertStatus;
  alertStatusMessage?: string;
  backendSyncedAt?: string;
  createdAt: string;
  nextAlertAt?: string;
  scheduledNotificationId?: string;
  updatedAt?: string;
};

export type NotificationPermissionState =
  | "unknown"
  | "granted"
  | "denied"
  | "undetermined"
  | "unavailable";

export type DiscountRule = {
  id: string;
  label: string;
  shortLabel: string;
  centsPerLitre: number;
};

export type StationDiscount = {
  id: string;
  label: string;
  centsPerLitre: number;
  inferred?: boolean;
};

export type FuturePriceWindow = {
  effectiveFrom?: string;
  prices: Record<string, number>;
  label?: string;
};

export type Station = {
  stationCode: string;
  name: string;
  brand: string;
  suburb?: string;
  address?: string;
  phone?: string;
  lat: number;
  lon: number;
  openNow?: boolean;
  membershipRequired?: boolean;
  updatedAt?: string;
  source?: string;
  prices: Record<string, number>;
  futurePrices?: {
    tomorrow?: FuturePriceWindow;
  };
  discounts?: StationDiscount[];
  pumpCpl?: number;
  distanceKm?: number;
};

export type StationViewModel = {
  station: Station;
  pumpCpl: number;
  adjustedCpl: number;
  discountCpl: number;
  discountLabel?: string;
  possibleLowerCpl?: number;
  possibleLowerLabel?: string;
  possibleLowerDisclosure?: string;
  possibleDiscountCpl?: number;
  distanceKm: number;
  fuel?: string;
  score?: number;
  netSaving?: number;
  detourMinutes?: number;
  detourFuelLitres?: number;
  detourCost?: number;
  timeCost?: number;
  netAfterDetourAndTimeCost?: number;
  rank?: number;
  reachable?: boolean;
  warnings?: string[];
  matchesDecisionRule?: boolean;
};

export type MapPoint = {
  lat: number;
  lon: number;
  label: string;
  provider?: string;
  matchType?: string;
  confidence?: string;
  type?: string;
  lookupStatus?: string;
  sourceLabel?: string;
  displayTitle?: string;
  displaySubtitle?: string;
  suggestionType?: string;
  refineRequired?: boolean;
  refineHint?: string;
};

export type RegionCapabilityStatus =
  | "live"
  | "limited"
  | "pending_access"
  | "fallback"
  | "unsupported";

export type RegionCapability = {
  region: string;
  name: string;
  provider: string;
  capability: RegionCapabilityStatus;
  configured: boolean;
  liveData: boolean;
  coverage: string;
  blocker?: string;
};

export type RouteTimingAdvice = {
  action:
    | "fill_today_on_route"
    | "fill_today_with_detour"
    | "wait_if_can"
    | "range_first"
    | "skip_detour"
    | "neutral"
    | "no_cycle_signal";
  visible: boolean;
  label: string;
  reason?: string;
};

export type RouteDecisionSummary = {
  action: "fill_now" | "fill_on_route" | "wait" | "skip" | "range_first";
  label: string;
  reason?: string;
  stationCode?: string;
  stationName?: string;
  whyNotCheapest?: string;
  economics?: {
    baselineCpl?: number;
    comparisonCpl?: number;
    comparisonKind?: "next_best_viable" | "none";
    pumpCpl?: number;
    adjustedCpl?: number;
    fillLitres?: number;
    grossFuelSaving?: number;
    detourKm?: number;
    detourMinutes?: number;
    detourFuelLitres?: number;
    detourCost?: number;
    timeCost?: number;
    timeCostDollarsPerMinute?: number;
    netSavingAfterDetourFuel?: number;
    netSavingAfterDetourFuelAndTime?: number;
  } | null;
  decisionRule?: {
    minSavingDollars?: number;
    maxDetourMinutes?: number;
  };
  alternatives: {
    kind: "best_value" | "cheapest" | "closest" | "safest";
    label: string;
    note: string;
    selected: boolean;
    stationCode: string;
    stationName: string;
    adjustedCpl?: number;
    netSaving?: number;
    detourMinutes?: number;
    detourFuelLitres?: number;
    timeCost?: number;
    netAfterDetourAndTimeCost?: number;
  }[];
  trust: {
    source: string;
    sourceType: string;
    officialLive: boolean;
    updatedAt?: string;
    freshnessMinutes?: number;
  };
};

export type NearbyResponse = {
  context: {
    fuel: FuelCode;
    source: string;
    provider?: string;
    capability?: RegionCapabilityStatus;
    regionCapabilities?: RegionCapability[];
    radiusKm: number;
    stationCount: number;
    returnedCount: number;
    generatedAt: string;
    cacheAgeSeconds?: number;
    cacheMode?: string;
    degraded?: boolean;
    warning?: string;
  };
  stations: Station[];
};

export type EvChargerConnection = {
  connector: string;
  connectorLabel: string;
  powerKw?: number;
  currentType?: string;
  quantity?: number;
  status?: string;
  operational?: boolean;
};

export type EvCharger = {
  id: string;
  name: string;
  operator: string;
  address?: string;
  suburb?: string;
  lat: number;
  lon: number;
  distanceKm: number;
  distanceAlongRouteKm?: number;
  routeDetourDistanceKm?: number;
  routeDistanceKm?: number;
  routeDetourProvider?: string;
  routeDetourSource?: "route_engine" | "straight_line_estimate";
  routeDetourWarning?: string;
  routeDetourMinutes?: number;
  detourMinutes?: number;
  connectors: string[];
  connections: EvChargerConnection[];
  maxPowerKw?: number;
  powerBand: "ac" | "dc_fast" | "ultra_fast" | "unknown";
  availability: "unknown" | "unavailable";
  availabilityLabel: string;
  pricing?: string;
  updatedAt?: string;
  source: string;
  provenance: string;
};

export type EvChargerResponse = {
  context: {
    provider: string;
    source: string;
    capability: "prototype" | "pending_commercial_access";
    radiusKm: number;
    centre: MapPoint;
    filters: {
      connectors: string[];
      minPowerKw: number;
      powerMode: EvPowerMode;
    };
    chargerCount: number;
    returnedCount: number;
    generatedAt: string;
    cacheHit?: boolean;
    cacheAgeSeconds?: number;
    cacheMode?: string;
    degraded?: boolean;
    warning?: string;
    provenance: {
      source: string;
      label: string;
      licence: string;
      realTimeAvailability: boolean;
    };
  };
  chargers: EvCharger[];
};

export type ScoreCandidate = StationViewModel & {
  fuel: FuelCode;
  fillLitres: number;
  reachable: boolean;
  warnings: string[];
  discountLabels?: string[];
  distanceToRouteKm?: number;
  distanceAlongRouteKm: number;
};

export type ScoreResponse = {
  context: {
    routeName: string;
    source: string;
    provider?: string;
    capability?: RegionCapabilityStatus;
    regionCapabilities?: RegionCapability[];
    warning?: string;
    fuel: FuelCode;
    routeDistanceKm: number;
    baselineCpl: number;
    eligibleCandidates: number;
    minSavingDollars?: number;
    maxDetourMinutes?: number;
    brandFilter?: boolean;
    brands?: string[];
    staleExcludedCandidates?: number;
    freshnessCutoffHours?: number;
    timingAdvice?: RouteTimingAdvice;
    decisionSummary?: RouteDecisionSummary;
  };
  recommendations: ScoreCandidate[];
  contextStations: Station[];
};
