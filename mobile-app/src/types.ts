export type FuelCode = "E10" | "U91" | "P95" | "P98" | "DL" | "PDL";

export type FuelPathTab = "plan" | "nearby" | "account";

export type AppPreferences = {
  vehicleName: string;
  vehicleRego: string;
  fuel: FuelCode;
  selectedDiscounts: string[];
};

export type CommuteAlertStatus =
  | "off"
  | "scheduled"
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
  alertStatus?: CommuteAlertStatus;
  alertStatusMessage?: string;
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
  distanceKm: number;
  score?: number;
  netSaving?: number;
  detourMinutes?: number;
  rank?: number;
};

export type MapPoint = {
  lat: number;
  lon: number;
  label: string;
};

export type NearbyResponse = {
  context: {
    fuel: FuelCode;
    source: string;
    radiusKm: number;
    stationCount: number;
    returnedCount: number;
    generatedAt: string;
  };
  stations: Station[];
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
    fuel: FuelCode;
    routeDistanceKm: number;
    baselineCpl: number;
    eligibleCandidates: number;
    staleExcludedCandidates?: number;
    freshnessCutoffHours?: number;
  };
  recommendations: ScoreCandidate[];
  contextStations: Station[];
};
