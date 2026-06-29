import {
  AppPreferences,
  NotificationPermissionState,
  SavedCommute,
  Station,
  StationViewModel,
} from "../types";
import { formatRelativeUpdatedAt } from "./pricing";

export type EvidenceLevel = "high" | "medium" | "low";

export type StationConfidence = {
  label:
    | "Live price"
    | "Updated recently"
    | "Hours unknown"
    | "Closed"
    | "Member price"
    | "Old price"
    | "Fallback data"
    | "Source unknown";
  level: EvidenceLevel;
  reason: string;
};

export function isOfficialLivePriceSource(source?: string) {
  return new Set([
    "api_nsw_fuelcheck",
    "api_nsw",
    "api_qld_fuelprices",
    "api_qld",
    "api_wa_fuelwatch",
    "api_wa",
    "api_vic_servo_saver",
    "api_vic",
    "api_sa_fuel_price_reporting",
    "api_sa",
    "api_tas_fuelcheck",
    "api_tas",
  ]).has(String(source || "").toLowerCase());
}

export function stationSourceLabel(source?: string) {
  const value = String(source || "").toLowerCase();
  if (isOfficialLivePriceSource(value) || value.includes("vic")) {
    return "Live price";
  }
  if (value.includes("sample") || value.includes("fallback")) return "Fallback data";
  if (value.includes("public_demo")) return "Demo snapshot";
  if (value) return "Live price";
  return "Source unknown";
}

export function stationProviderLabel(source?: string) {
  const value = String(source || "").toLowerCase();
  if (value.includes("vic")) return "Servo Saver";
  if (value.includes("fuelcheck") || value.includes("nsw") || value.includes("tas")) return "FuelCheck";
  if (value.includes("qld")) return "Queensland Fuel Prices";
  if (value.includes("wa")) return "FuelWatch";
  if (value.includes("sa")) return "SA Fuel Pricing";
  return "";
}

export function stationFreshness(station: Station, now = new Date()) {
  if (!station.updatedAt) {
    return {
      label: "Freshness unknown",
      level: "low" as EvidenceLevel,
      ageHours: Number.POSITIVE_INFINITY,
    };
  }

  const parsed = new Date(station.updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return {
      label: "Freshness unknown",
      level: "low" as EvidenceLevel,
      ageHours: Number.POSITIVE_INFINITY,
    };
  }

  const ageHours = Math.max(0, (now.getTime() - parsed.getTime()) / 3600000);
  const level: EvidenceLevel = ageHours <= 6 ? "high" : ageHours <= 48 ? "medium" : "low";
  const prefix = ageHours <= 48 ? "Updated" : "Stale";
  return {
    label: `${prefix} ${formatRelativeUpdatedAt(station.updatedAt, now)}`,
    level,
    ageHours,
  };
}

export function stationConfidence(item: StationViewModel): StationConfidence {
  const freshness = stationFreshness(item.station);
  const source = stationSourceLabel(item.station.source);
  const officialLivePrice = isOfficialLivePriceSource(item.station.source);
  if (item.station.openNow === false) {
    return { label: "Closed", level: "low", reason: "Station is marked closed." };
  }
  if (item.station.membershipRequired) {
    return { label: "Member price", level: "low", reason: "Confirm you are eligible before driving." };
  }
  if (source === "Fallback data" || source === "Demo snapshot" || source === "Source unknown") {
    return {
      label: source === "Source unknown" ? "Source unknown" : "Fallback data",
      level: "low",
      reason: "Do not treat this as a live price.",
    };
  }
  if (!officialLivePrice && freshness.level === "low") {
    return { label: "Old price", level: "low", reason: "Price may be out of date." };
  }
  if (item.station.openNow === undefined) {
    return { label: "Hours unknown", level: "medium", reason: "Confirm hours before driving." };
  }
  if (freshness.level === "medium") {
    return { label: "Updated recently", level: "medium", reason: "Price was updated recently." };
  }
  return { label: "Live price", level: "high", reason: "Live price." };
}

export function stationAttentionCue(item: StationViewModel): StationConfidence | null {
  const confidence = stationConfidence(item);
  if (confidence.label === "Live price" || confidence.label === "Updated recently") return null;
  return confidence;
}

export function stationEvidenceLine(item: StationViewModel) {
  const timestamp = stationTimestampLine(item.station);
  const confidence = stationConfidence(item);
  const provider = stationProviderLabel(item.station.source);
  const sourceLine = provider ? `${provider} | ${timestamp}` : timestamp;
  if (confidence.label === "Live price" || confidence.label === "Updated recently") {
    return sourceLine;
  }
  return `${sourceLine} | ${confidence.label}`;
}

export function stationTimestampLine(station: Station, now = new Date()) {
  if (!station.updatedAt) return "Price timestamp unknown";
  if (isOfficialLivePriceSource(station.source)) {
    return priceUnchangedLine(station.updatedAt, now);
  }
  const freshness = stationFreshness(station);
  return freshness.label;
}

function priceUnchangedLine(value: string, now = new Date()) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Price timestamp unknown";

  const ageMs = Math.max(0, now.getTime() - parsed.getTime());
  const ageHours = Math.floor(ageMs / 3600000);
  if (ageHours < 24) {
    return `Price unchanged since ${formatTimeOfDay(parsed)}`;
  }

  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 7) {
    return `Price unchanged for ${ageDays} ${ageDays === 1 ? "day" : "days"}`;
  }

  return `Price unchanged for ${formatLongAge(ageDays)}`;
}

function formatTimeOfDay(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(value)
    .replace(/\s/g, "")
    .toLowerCase();
}

function formatLongAge(days: number) {
  if (days < 30) {
    const weeks = Math.max(1, Math.floor(days / 7));
    return weeks === 1 ? "a week" : `${weeks} weeks`;
  }
  if (days < 365) {
    const months = Math.max(1, Math.floor(days / 30));
    return months === 1 ? "a month" : `${months} months`;
  }
  const years = Math.max(1, Math.floor(days / 365));
  return years === 1 ? "a year" : `${years} years`;
}

export function stationOpenLabel(openNow?: boolean) {
  if (openNow === false) return "Closed";
  if (openNow === true) return "Open now";
  return "Hours unknown";
}

export function routeValueCue(item: StationViewModel) {
  const saving = Number(item.netSaving || 0);
  const detour = Number(item.detourMinutes || 0);
  if (saving >= 1) {
    return `Saves ${formatMoney(saving)} after ${detour.toFixed(1)} min detour.`;
  }
  return `Probably not worth it: saves ${formatMoney(saving)} after ${detour.toFixed(1)} min.`;
}

export function routeOutcomeLabel(item: StationViewModel) {
  const saving = Number(item.netSaving || 0);
  if (saving < 2) return "Small savings detour";
  if (saving < 5) return "Medium savings detour";
  if (saving < 10) return "Good savings detour";
  if (saving < 20) return "Great savings detour";
  return "Strong savings detour";
}

export function predictionDisciplineCue(item: StationViewModel) {
  const fuel = item.fuel || "";
  const tomorrow = fuel ? item.station.futurePrices?.tomorrow?.prices?.[fuel] : undefined;
  if (Number.isFinite(Number(tomorrow))) return "Tomorrow price is locked by source.";
  return "";
}

export function alertGateSummary(notificationPermission: NotificationPermissionState) {
  if (notificationPermission === "granted") {
    return "Route watches are on this device; delivery still needs native push and backend evidence before beta.";
  }
  if (notificationPermission === "unavailable") {
    return "Backend checks route value, freshness, region access and duplicates, but push delivery needs a supported native build.";
  }
  return "Push delivery is blocked until notification permission and native token checks pass.";
}

export function commuteAlertRuleLine(commute: SavedCommute) {
  if (!commute.alertEnabled) return "No alert checks while this route is off.";
  const routeRule = "Checks route value with smart detour rules and fresh price data.";
  if (commute.alertStatus === "backend_synced") {
    return `${routeRule} Backend also checks freshness, duplicate cooldown and one alert per run.`;
  }
  if (commute.alertStatus === "scheduled") {
    return `${routeRule} Local reminder only until backend push sync is ready.`;
  }
  if (commute.alertStatus === "needs_permission") {
    return "Blocked until notification permission is granted.";
  }
  if (commute.alertStatus === "unavailable") {
    return "Blocked on this device or build.";
  }
  if (commute.alertStatus === "failed") {
    return "Sync failed. Route kept locally.";
  }
  return "Waiting for route alert checks.";
}

export function weeklyFleetLiteReportSummary({
  preferences,
  savedCommutes,
}: {
  preferences: AppPreferences;
  savedCommutes: SavedCommute[];
}) {
  const activeRoutes = savedCommutes.filter((commute) => commute.alertEnabled);
  const backendSyncedRoutes = activeRoutes.filter((commute) => commute.alertStatus === "backend_synced");
  const localOnlyRoutes = activeRoutes.filter((commute) => commute.alertStatus === "scheduled");
  const blockedRoutes = savedCommutes.filter((commute) =>
    ["needs_permission", "unavailable", "failed"].includes(String(commute.alertStatus || "")),
  );
  const minSaving = activeRoutes.length
    ? Math.min(...activeRoutes.map((commute) => commute.minSavingDollars))
    : preferences.minSavingDollars;
  const maxDetour = activeRoutes.length
    ? Math.max(...activeRoutes.map((commute) => commute.maxDetourMinutes))
    : preferences.maxDetourMinutes;
  const policyBrands = preferences.fuelPolicyEnabled
    ? preferences.approvedPolicyBrands.join(", ")
    : "Any brand";
  const reportReady = activeRoutes.length > 0 && blockedRoutes.length === 0;

  return {
    activeRouteCount: activeRoutes.length,
    backendSyncedRouteCount: backendSyncedRoutes.length,
    blockedRouteCount: blockedRoutes.length,
    localOnlyRouteCount: localOnlyRoutes.length,
    maxDetourMinutes: maxDetour,
    minSavingDollars: minSaving,
    outcomeLine: "Buckets: send alert, watch only, skip alert, quiet today, range first.",
    policyBrands,
    reportLine: reportReady
      ? "Weekly report can summarise watched routes and alert outcomes."
      : activeRoutes.length
        ? "Weekly report is waiting on native push/backend proof before claiming delivery."
        : "Save and enable a route before weekly reporting has real signal.",
  };
}

function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}
