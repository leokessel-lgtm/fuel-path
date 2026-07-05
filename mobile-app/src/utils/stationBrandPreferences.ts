import { brandStyleForStation, stationBrandOptions } from "../data/brandAssets";
import { AppPreferences, Station, StationViewModel } from "../types";

export function activePreferredStationBrands(preferences: AppPreferences) {
  const selected = normalisePreferredStationBrands(preferences.preferredStationBrands);
  if (preferences.stationBrandMode !== "preferred_only" || selected.length === 0) return [];
  return selected;
}

export function preferredStationBrandSummary(preferences: AppPreferences) {
  const selected = normalisePreferredStationBrands(preferences.preferredStationBrands);
  if (preferences.stationBrandMode !== "preferred_only" || selected.length === 0) {
    return "All station brands";
  }
  if (selected.length <= 3) return `Only ${selected.join(", ")}`;
  return `${selected.length} preferred brands`;
}

export function stationMatchesPreferredBrands(
  station: Station,
  preferredBrands: string[],
) {
  if (!preferredBrands.length) return true;
  const brand = brandStyleForStation(station).label;
  return new Set(preferredBrands).has(brand);
}

export function filterStationsByPreferredBrands(
  stations: StationViewModel[],
  preferredBrands: string[],
) {
  if (!preferredBrands.length) return stations;
  return stations.filter((item) => stationMatchesPreferredBrands(item.station, preferredBrands));
}

export function normalisePreferredStationBrands(value: unknown) {
  if (!Array.isArray(value)) return [];
  const valid = new Set(stationBrandOptions().map((brand) => brand.label));
  const selected = new Set(
    value
      .map(String)
      .map((brand) => brand.trim())
      .filter((brand) => valid.has(brand)),
  );
  return stationBrandOptions()
    .map((brand) => brand.label)
    .filter((brand) => selected.has(brand));
}

export function stationBrandFilterNotice(preferredBrands: string[], hiddenCount: number) {
  if (!preferredBrands.length) return "";
  const brandText = preferredBrands.length <= 3
    ? preferredBrands.join(", ")
    : `${preferredBrands.length} preferred brands`;
  const hiddenText = hiddenCount > 0
    ? ` ${hiddenCount} other station${hiddenCount === 1 ? "" : "s"} hidden.`
    : "";
  return `Showing ${brandText}.${hiddenText}`;
}
