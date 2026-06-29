import { useCallback, useEffect, useState } from "react";

import {
  loadRecentLocations,
  normaliseRecentLocations,
  persistRecentLocations,
} from "../services/recentLocationsStore";
import { MapPoint } from "../types";

export function useRecentLocations() {
  const [recentLocations, setRecentLocations] = useState<MapPoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadRecentLocations().then((locations) => {
      if (!active) return;
      setRecentLocations(locations);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persistRecentLocations(recentLocations).catch(() => {});
  }, [loaded, recentLocations]);

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
    recentLocations,
    removeRecentLocation,
  };
}

function closeCoordinate(left: number, right: number) {
  return Math.abs(left - right) < 0.0002;
}
