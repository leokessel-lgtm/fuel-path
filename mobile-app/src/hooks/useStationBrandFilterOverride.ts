import { SetStateAction, useState } from "react";

import { AppPreferences, MapPoint } from "../types";
import { activePreferredStationBrands, preferredStationBrandSummary } from "../utils/stationBrandPreferences";

export function useStationBrandFilterOverride({
  centre,
  preferences,
}: {
  centre: MapPoint;
  preferences: AppPreferences;
}) {
  const overrideKey = [
    centre.lat,
    centre.lon,
    preferences.fuel,
    preferences.preferredStationBrands.join("|"),
    preferences.stationBrandMode,
  ].join("|");
  const [overrideState, setOverrideState] = useState({
    key: overrideKey,
    showAllStationBrandsOnce: false,
  });
  let showAllStationBrandsOnce = overrideState.showAllStationBrandsOnce;
  if (overrideState.key !== overrideKey) {
    showAllStationBrandsOnce = false;
    setOverrideState({
      key: overrideKey,
      showAllStationBrandsOnce: false,
    });
  }
  const preferredBrands = activePreferredStationBrands(preferences);
  const brandFilterActive = preferredBrands.length > 0 && !showAllStationBrandsOnce;
  const stationBrandFilterLabel = showAllStationBrandsOnce
    ? "All brands for this search"
    : preferredStationBrandSummary(preferences);

  return {
    brandFilterActive,
    preferredBrands,
    setShowAllStationBrandsOnce: (value: SetStateAction<boolean>) =>
      setOverrideState((current) => {
        const currentValue = current.key === overrideKey ? current.showAllStationBrandsOnce : false;
        const nextValue = typeof value === "function" ? value(currentValue) : value;
        return {
          key: overrideKey,
          showAllStationBrandsOnce: nextValue,
        };
      }),
    showAllStationBrandsOnce,
    stationBrandFilterLabel,
  };
}
