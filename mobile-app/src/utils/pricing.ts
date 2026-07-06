import { AppPreferences, Station, StationViewModel } from "../types";
import { eligibleDiscountIds, isDiscountRedeemedToday } from "./discountRedemptions";

const VALUE_DISTANCE_PENALTY_CPL_PER_KM = 0.85;
const updatedAtFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function stationPriceView(
  station: Station,
  fuel: string,
  preferences: AppPreferences,
): StationViewModel | null {
  const matchedFuel = station.matchedFuel || fuel;
  const pumpCpl = Number(station.pumpCpl ?? station.prices?.[matchedFuel]);
  if (!Number.isFinite(pumpCpl)) return null;

  let discountCpl = 0;
  let discountLabel = "";
  const eligibleDiscounts = new Set(eligibleDiscountIds(preferences));
  for (const discount of station.discounts || []) {
    const effectiveDiscountCpl = effectiveDiscountCentsPerLitre(discount, {
      fillLitres: preferences.fuelTankLitres,
      fuel: matchedFuel,
      station,
    });
    if (
      eligibleDiscounts.has(discount.id) &&
      effectiveDiscountCpl > discountCpl
    ) {
      discountCpl = effectiveDiscountCpl;
      discountLabel = discount.label;
    }
  }
  const possibleDiscount = bestPossibleDiscount(station, preferences);
  const possibleDiscountCpl = Number(possibleDiscount?.centsPerLitre || 0);
  const possibleLowerCpl =
    possibleDiscount && possibleDiscountCpl > discountCpl
      ? Math.max(0, pumpCpl - possibleDiscountCpl)
      : undefined;

  return {
    station,
    pumpCpl,
    adjustedCpl: Math.max(0, pumpCpl - discountCpl),
    discountCpl,
    discountLabel,
    possibleLowerCpl,
    possibleLowerLabel:
      possibleLowerCpl !== undefined
        ? possibleDiscountLabel(possibleDiscount, preferences)
        : undefined,
    possibleLowerDisclosure:
      possibleLowerCpl !== undefined
        ? "Possible lower price, not guaranteed."
        : undefined,
    possibleDiscountCpl: possibleLowerCpl !== undefined ? possibleDiscountCpl : undefined,
    distanceKm: Number(station.distanceKm || 0),
    fuel: matchedFuel,
    requestedFuel: station.requestedFuel || fuel,
    exactFuelMatch: station.exactFuelMatch !== false && matchedFuel === fuel,
  };
}

function bestPossibleDiscount(station: Station, preferences: AppPreferences) {
  if (preferences.selectedDiscounts.length === 0) return undefined;
  return [...(station.discounts || [])]
    .filter((discount) => effectiveDiscountCentsPerLitre(discount, {
      fillLitres: preferences.fuelTankLitres,
      fuel: station.requestedFuel || "",
      station,
    }) > 0)
    .sort((left, right) =>
      effectiveDiscountCentsPerLitre(right, {
        fillLitres: preferences.fuelTankLitres,
        fuel: station.requestedFuel || "",
        station,
      }) - effectiveDiscountCentsPerLitre(left, {
        fillLitres: preferences.fuelTankLitres,
        fuel: station.requestedFuel || "",
        station,
      }),
    )
    .find((discount) => {
      const selected = preferences.selectedDiscounts.includes(discount.id);
      return !selected || isDiscountRedeemedToday(preferences, discount.id);
    });
}

function effectiveDiscountCentsPerLitre(
  discount: NonNullable<Station["discounts"]>[number],
  {
    fillLitres,
    fuel,
    station,
  }: {
    fillLitres?: number;
    fuel?: string;
    station: Station;
  },
) {
  if (!discountAppliesToStation(discount, station)) return 0;
  const rawCpl = discountCentsForFuel(discount, fuel);
  const litres = Number(fillLitres || 0);
  const maxLitres = Number(discount.maxLitresPerTransaction || litres);
  if (litres <= 0 || !Number.isFinite(maxLitres)) return rawCpl;
  return rawCpl * (Math.max(0, Math.min(litres, maxLitres)) / litres);
}

function discountCentsForFuel(
  discount: NonNullable<Station["discounts"]>[number],
  fuel?: string,
) {
  const fuelSpecific = fuel ? discount.fuelTypeCentsPerLitre?.[fuel as keyof typeof discount.fuelTypeCentsPerLitre] : undefined;
  if (Number.isFinite(Number(fuelSpecific))) return Number(fuelSpecific);
  return Number(discount.centsPerLitre || 0);
}

function discountAppliesToStation(
  discount: NonNullable<Station["discounts"]>[number],
  station: Station,
) {
  const state = stationState(station);
  if (state && discount.includedStates?.length && !discount.includedStates.includes(state)) return false;
  if (state && discount.excludedStates?.includes(state)) return false;
  return true;
}

function stationState(station: Station) {
  const source = String(station.source || "");
  if (source.includes("_sa_")) return "SA";
  if (source.includes("_tas_")) return "TAS";
  if (source.includes("_wa_")) return "WA";
  if (source.includes("_nt_")) return "NT";
  if (source.includes("_qld_")) return "QLD";
  if (source.includes("_vic_")) return "VIC";
  if (source.includes("_nsw_")) return "NSW";
  const text = ` ${station.address || ""} ${station.suburb || ""} ${station.name || ""} `.toUpperCase();
  return text.match(/\b(NSW|ACT|VIC|QLD|SA|WA|TAS|NT)\b/)?.[1] || "";
}

function possibleDiscountLabel(
  discount: NonNullable<Station["discounts"]>[number] | undefined,
  preferences: AppPreferences,
) {
  if (!discount) return "";
  if (preferences.selectedDiscounts.includes(discount.id)) {
    return `${discount.label} possible if unused, not guaranteed`;
  }
  return `${discount.label} possible if configured, not guaranteed`;
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

function formatUpdatedAt(value?: string) {
  if (!value) return "No timestamp";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Timestamp unknown";
  return updatedAtFormatter.format(parsed);
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
