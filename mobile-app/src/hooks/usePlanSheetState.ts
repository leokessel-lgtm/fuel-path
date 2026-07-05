import { useState } from "react";

export function usePlanSheetState() {
  const [stationPanelOpen, setStationPanelOpen] = useState(false);
  const [routeSheetMinimised, setRouteSheetMinimised] = useState(false);

  const closePanels = () => {
    setStationPanelOpen(false);
    setRouteSheetMinimised(false);
  };

  const openStationPanel = () => {
    setStationPanelOpen(true);
    setRouteSheetMinimised(false);
  };

  const restoreRouteSheet = () => {
    setRouteSheetMinimised(false);
  };

  return {
    closePanels,
    openStationPanel,
    restoreRouteSheet,
    routeSheetMinimised,
    setRouteSheetMinimised,
    setStationPanelOpen,
    stationPanelOpen,
  };
}
