import { useEffect, useState } from "react";

import { AppPreferences, MapPoint } from "../types";
import { activePreferredStationBrands, preferredStationBrandSummary } from "../utils/stationBrandPreferences";

export function useStationBrandFilterOverride({
  centre,
  preferences,
}: {
  centre: MapPoint;
  preferences: AppPreferences;
}) {
  const [showAllStationBrandsOnce, setShowAllStationBrandsOnce] = useState(false);
  const preferredBrands = activePreferredStationBrands(preferences);
  const brandFilterActive = preferredBrands.length > 0 && !showAllStationBrandsOnce;
  const stationBrandFilterLabel = showAllStationBrandsOnce
    ? "All brands for this search"
    : preferredStationBrandSummary(preferences);

  useEffect(() => {
    setShowAllStationBrandsOnce(false);
  }, [
    centre.lat,
    centre.lon,
    preferences.fuel,
    preferences.preferredStationBrands.join("|"),
    preferences.stationBrandMode,
  ]);

  return {
    brandFilterActive,
    preferredBrands,
    setShowAllStationBrandsOnce,
    showAllStationBrandsOnce,
    stationBrandFilterLabel,
  };
}
