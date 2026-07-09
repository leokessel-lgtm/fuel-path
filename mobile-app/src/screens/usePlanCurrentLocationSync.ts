import { Dispatch, SetStateAction, useEffect } from "react";

import { MapPoint } from "../types";
import { displayLocationLabel } from "./PlanScreen.utils";

export function usePlanCurrentLocationSync({
  currentLocation,
  from,
  fromPoint,
  resetAddressSessionToken,
  setFrom,
  setFromPoint,
}: {
  currentLocation?: MapPoint;
  from: string;
  fromPoint?: MapPoint;
  resetAddressSessionToken: (field: "from" | "to") => void;
  setFrom: Dispatch<SetStateAction<string>>;
  setFromPoint: Dispatch<SetStateAction<MapPoint | undefined>>;
}) {
  useEffect(() => {
    if (!currentLocation || fromPoint || from.trim()) return;
    setFromPoint(currentLocation);
    setFrom(displayLocationLabel(currentLocation, currentLocation.label));
    resetAddressSessionToken("from");
  }, [currentLocation, from, fromPoint, resetAddressSessionToken, setFrom, setFromPoint]);
}
