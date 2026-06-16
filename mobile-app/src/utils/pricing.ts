import { AppPreferences, Station, StationViewModel } from "../types";

const VALUE_DISTANCE_PENALTY_CPL_PER_KM = 0.85;

export function stationPriceView(
  station: Station,
  fuel: string,
  preferences: AppPreferences,
): StationViewModel | null {
  const pumpCpl = Number(station.pumpCpl ?? station.prices?.[fuel]);
  if (!Number.isFinite(pumpCpl)) return null;

  let discountCpl = 0;
  let discountLabel = "";
  for (const discount of station.discounts || []) {
    if (
      preferences.selectedDiscounts.includes(discount.id) &&
      Number(discount.centsPerLitre || 0) > discountCpl
    ) {
      discountCpl = Number(discount.centsPerLitre || 0);
      discountLabel = discount.label;
    }
  }

  return {
    station,
    pumpCpl,
    adjustedCpl: Math.max(0, pumpCpl - discountCpl),
    discountCpl,
    discountLabel,
    distanceKm: Number(station.distanceKm || 0),
    fuel,
  };
}

export type TomorrowPriceView = {
  fuel: string;
  cpl: number;
  deltaCpl: number;
  direction: "up" | "down" | "flat";
  effectiveFrom?: string;
  shortLabel: string;
  detailLabel: string;
};

export function tomorrowPriceView(item: StationViewModel): TomorrowPriceView | null {
  const fuel = item.fuel || inferFuelForPumpPrice(item.station, item.pumpCpl);
  if (!fuel) return null;
  const cpl = Number(item.station.futurePrices?.tomorrow?.prices?.[fuel]);
  if (!Number.isFinite(cpl)) return null;
  const deltaCpl = cpl - Number(item.pumpCpl);
  const roundedDelta = Math.round(deltaCpl * 10) / 10;
  const direction = Math.abs(roundedDelta) < 0.05 ? "flat" : roundedDelta > 0 ? "up" : "down";
  const deltaLabel =
    direction === "flat"
      ? "same"
      : `${roundedDelta > 0 ? "+" : ""}${roundedDelta.toFixed(1)} c/L`;
  return {
    fuel,
    cpl,
    deltaCpl: roundedDelta,
    direction,
    effectiveFrom: item.station.futurePrices?.tomorrow?.effectiveFrom,
    shortLabel: `Tomorrow ${cpl.toFixed(1)}`,
    detailLabel: `Tomorrow locked ${cpl.toFixed(1)} c/L (${deltaLabel})`,
  };
}

export function sortStations(
  stations: StationViewModel[],
  sortMode: "distance" | "price" | "value",
) {
  return [...stations].sort((a, b) => {
    if (sortMode === "distance") {
      return a.distanceKm - b.distanceKm || a.adjustedCpl - b.adjustedCpl;
    }
    if (sortMode === "price") {
      return a.adjustedCpl - b.adjustedCpl || a.distanceKm - b.distanceKm;
    }
    return stationValueScore(a) - stationValueScore(b);
  });
}

function stationValueScore(station: StationViewModel) {
  return station.adjustedCpl + station.distanceKm * VALUE_DISTANCE_PENALTY_CPL_PER_KM;
}

function inferFuelForPumpPrice(station: Station, pumpCpl?: number) {
  const target = Number(pumpCpl);
  if (!Number.isFinite(target)) return "";
  const match = Object.entries(station.prices || {}).find(([, value]) => Math.abs(Number(value) - target) < 0.05);
  return match?.[0] || "";
}

export function formatUpdatedAt(value?: string) {
  if (!value) return "No timestamp";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Timestamp unknown";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function formatRelativeUpdatedAt(value?: string, now = new Date()) {
  if (!value) return "Updated unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Updated unknown";

  const diffMs = Math.max(0, now.getTime() - parsed.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}
