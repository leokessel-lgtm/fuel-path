import { useCallback } from "react";

import {
  loadRecentLocationsWithStatus,
  normaliseRecentLocations,
  persistRecentLocations,
} from "../services/recentLocationsStore";
import { MapPoint } from "../types";
import { useRecoverableLocalState } from "./useRecoverableLocalState";

export function useRecentLocations() {
  const {
    value: recentLocations,
    setValue: setRecentLocations,
    loaded,
    persistence,
    retryPersistence,
  } = useRecoverableLocalState<MapPoint[]>({
    fallback: [],
    label: "Recent locations",
    load: loadRecentLocationsWithStatus,
    persist: persistRecentLocations,
  });

  const addRecentLocation = useCallback((point: MapPoint) => {
    setRecentLocations((current) => normaliseRecentLocations([point, ...current]));
  }, []);

  const removeRecentLocation = useCallback((point: MapPoint) => {
    setRecentLocations((current) =>
      current.filter(
        (item) =>
          !closeCoordinate(item.lat, point.lat) || !closeCoordinate(item.lon, point.lon),
      ),
    );
  }, []);

  const clearRecentLocations = useCallback(() => {
    setRecentLocations([]);
  }, []);

  return {
    addRecentLocation,
    clearRecentLocations,
    loaded,
    persistence,
    recentLocations,
    removeRecentLocation,
    retryPersistence,
  };
}

function closeCoordinate(left: number, right: number) {
  return Math.abs(left - right) < 0.0002;
}
