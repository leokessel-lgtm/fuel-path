import { useCallback } from "react";

import {
  defaultCommuteAlertDays,
  loadSavedCommutesWithStatus,
  persistSavedCommutes,
} from "../services/savedCommutesStore";
import { FuelCode, MapPoint, SavedCommute } from "../types";
import { useRecoverableLocalState } from "./useRecoverableLocalState";

type SaveCommuteInput = Pick<SavedCommute, "from" | "fuel" | "name" | "to"> & {
  vehicleId?: string;
};

export function useSavedCommutes() {
  const {
    value: savedCommutes,
    setValue: setSavedCommutes,
    loaded,
    persistence,
    retryPersistence,
  } = useRecoverableLocalState<SavedCommute[]>({
    fallback: [],
    label: "Saved routes",
    load: loadSavedCommutesWithStatus,
    persist: persistSavedCommutes,
  });

  const saveCommute = useCallback(({ from, fuel, name, to, vehicleId }: SaveCommuteInput) => {
    setSavedCommutes((current) => {
      const existing = current.find((commute) =>
        sameCommute(commute, { from, fuel, to, vehicleId }),
      );
      if (existing) return current;
      const now = new Date().toISOString();
      return [
        {
          id: makeCommuteId(from, to, fuel, vehicleId),
          name,
          from,
          to,
          fuel,
          vehicleId,
          alertEnabled: false,
          alertTime: "07:30",
          alertDays: defaultCommuteAlertDays,
          localReminderEnabled: false,
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

  const renameCommute = useCallback((commuteId: string, name: string) => {
    const safeName = name.trim();
    setSavedCommutes((current) =>
      current.map((commute) =>
        commute.id === commuteId
          ? {
            ...commute,
            name: safeName || commuteName(commute.from, commute.to),
            updatedAt: new Date().toISOString(),
          }
          : commute,
      ),
    );
  }, []);

  return {
    loaded,
    persistence,
    renameCommute,
    retryPersistence,
    saveCommute,
    savedCommutes,
    setSavedCommutes,
  };
}

function commuteName(from: MapPoint, to: MapPoint) {
  return `${shortPointName(from)} to ${shortPointName(to)}`;
}

function shortPointName(point: MapPoint) {
  return point.displayTitle || point.label.split(",")[0] || "Saved place";
}

function sameCommute(
  left: SavedCommute,
  right: Pick<SavedCommute, "from" | "fuel" | "to"> & { vehicleId?: string },
) {
  return (
    left.fuel === right.fuel &&
    sameCommuteVehicle(left.vehicleId, right.vehicleId) &&
    closeCoordinate(left.from.lat, right.from.lat) &&
    closeCoordinate(left.from.lon, right.from.lon) &&
    closeCoordinate(left.to.lat, right.to.lat) &&
    closeCoordinate(left.to.lon, right.to.lon)
  );
}

function sameCommuteVehicle(leftVehicleId?: string, rightVehicleId?: string) {
  if (!leftVehicleId || !rightVehicleId) return true;
  return leftVehicleId === rightVehicleId;
}

function closeCoordinate(left: number, right: number) {
  return Math.abs(left - right) < 0.0002;
}

function makeCommuteId(from: MapPoint, to: MapPoint, fuel: FuelCode, vehicleId?: string) {
  const parts = [
    "commute",
    fuel,
    safeCommuteIdPart(vehicleId),
    from.lat.toFixed(4),
    from.lon.toFixed(4),
    to.lat.toFixed(4),
    to.lon.toFixed(4),
  ].filter(Boolean);
  return parts.join(":");
}

function safeCommuteIdPart(value?: string) {
  return value?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "";
}
