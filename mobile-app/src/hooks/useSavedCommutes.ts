import { useCallback, useEffect, useState } from "react";

import {
  loadSavedCommutes,
  persistSavedCommutes,
} from "../services/savedCommutesStore";
import { FuelCode, MapPoint, SavedCommute } from "../types";

type SaveCommuteInput = Pick<SavedCommute, "from" | "fuel" | "name" | "to">;

export function useSavedCommutes() {
  const [savedCommutes, setSavedCommutes] = useState<SavedCommute[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadSavedCommutes().then((commutes) => {
      if (!active) return;
      setSavedCommutes(commutes);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persistSavedCommutes(savedCommutes).catch(() => {});
  }, [loaded, savedCommutes]);

  const saveCommute = useCallback(({ from, fuel, name, to }: SaveCommuteInput) => {
    setSavedCommutes((current) => {
      const existing = current.find((commute) =>
        sameCommute(commute, { from, fuel, to }),
      );
      if (existing) return current;
      const now = new Date().toISOString();
      return [
        {
          id: makeCommuteId(from, to, fuel),
          name,
          from,
          to,
          fuel,
          alertEnabled: false,
          alertTime: "07:30",
          minSavingDollars: 5,
          maxDetourMinutes: 8,
          tankThresholdPercent: 45,
          alertStatus: "off",
          alertStatusMessage: "Route alert is off.",
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ];
    });
  }, []);

  return {
    loaded,
    saveCommute,
    savedCommutes,
    setSavedCommutes,
  };
}

function sameCommute(
  left: SavedCommute,
  right: Pick<SavedCommute, "from" | "fuel" | "to">,
) {
  return (
    left.fuel === right.fuel &&
    closeCoordinate(left.from.lat, right.from.lat) &&
    closeCoordinate(left.from.lon, right.from.lon) &&
    closeCoordinate(left.to.lat, right.to.lat) &&
    closeCoordinate(left.to.lon, right.to.lon)
  );
}

function closeCoordinate(left: number, right: number) {
  return Math.abs(left - right) < 0.0002;
}

function makeCommuteId(from: MapPoint, to: MapPoint, fuel: FuelCode) {
  return [
    "commute",
    fuel,
    from.lat.toFixed(4),
    from.lon.toFixed(4),
    to.lat.toFixed(4),
    to.lon.toFixed(4),
  ].join(":");
}
