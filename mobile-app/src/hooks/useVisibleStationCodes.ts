import { useCallback, useState } from "react";

import { sameStationCodes } from "../screens/NearbyScreen.utils";

export function useVisibleStationCodes() {
  const [visibleStationCodes, setVisibleStationCodes] = useState<string[]>([]);
  const handleViewportStationsChange = useCallback((stationCodes: string[]) => {
    setVisibleStationCodes((current) =>
      sameStationCodes(current, stationCodes) ? current : stationCodes,
    );
  }, []);

  return {
    handleViewportStationsChange,
    visibleStationCodes,
  };
}
