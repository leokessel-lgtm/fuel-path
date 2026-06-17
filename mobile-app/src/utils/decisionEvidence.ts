import {
  NotificationPermissionState,
  SavedCommute,
  Station,
  StationViewModel,
} from "../types";
import { formatRelativeUpdatedAt, formatUpdatedAt } from "./pricing";

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
  if (confidence.label === "Live price" || confidence.label === "Updated recently") {
    return timestamp;
  }
  return `${timestamp} | ${confidence.label}`;
}

export function stationTimestampLine(station: Station) {
  if (!station.updatedAt) return "Price timestamp unknown";
  if (isOfficialLivePriceSource(station.source)) {
    return `Price unchanged since ${formatUpdatedAt(station.updatedAt)}`;
  }
  const freshness = stationFreshness(station);
  return freshness.label;
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
    return `Net ${formatMoney(saving)} after ${detour.toFixed(1)} min detour.`;
  }
  return `Not worth detour: net ${formatMoney(saving)} after ${detour.toFixed(1)} min.`;
}

export function routeOutcomeLabel(item: StationViewModel) {
  if ((item.netSaving || 0) >= 4) return "Best value";
  if ((item.netSaving || 0) >= 1) return "Worth checking";
  return "Not worth detour";
}

export function priceBasisLine(item: StationViewModel) {
  if (item.discountCpl > 0) {
    return `Pump ${item.pumpCpl.toFixed(1)} c/L`;
  }
  return "Pump price";
}

export function predictionDisciplineCue(item: StationViewModel) {
  const fuel = item.fuel || "";
  const tomorrow = fuel ? item.station.futurePrices?.tomorrow?.prices?.[fuel] : undefined;
  if (Number.isFinite(Number(tomorrow))) return "Tomorrow price is locked by source.";
  return "";
}

export function alertGateSummary(notificationPermission: NotificationPermissionState) {
  if (notificationPermission === "granted") {
    return "Alerts can send only when route value, freshness, region access and duplicate checks pass.";
  }
  if (notificationPermission === "unavailable") {
    return "Backend checks route value, freshness, region access and duplicates, but push delivery needs a supported native build.";
  }
  return "Push delivery is blocked until notification permission and native token checks pass.";
}

export function commuteAlertRuleLine(commute: SavedCommute) {
  if (!commute.alertEnabled) return "No alert checks while this route is off.";
  if (commute.alertStatus === "backend_synced") {
    return "Backend checks saving, detour, freshness and duplicate cooldown.";
  }
  if (commute.alertStatus === "scheduled") {
    return "Local reminder only until backend push sync is ready.";
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

function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}
