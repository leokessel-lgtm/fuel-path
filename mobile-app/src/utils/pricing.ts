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
