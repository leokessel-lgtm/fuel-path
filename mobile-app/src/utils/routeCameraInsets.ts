import { spacing } from "../theme";

export type RouteCameraInsetsState = {
  routeControlsCollapsed: boolean;
  routeSheetMinimised: boolean;
  stationPanelOpen: boolean;
};

const routeMapGap = 18;
const routeStationMarkerHeight = 64;
const routeSummaryOverlayHeight = spacing.sm + 82;
const routeResultsSheetInset = 320;
const routeStationSheetInset = 300;
const routeMinimisedSheetInset = 116;

export function routeCameraInsets({
  routeControlsCollapsed,
  routeSheetMinimised,
  stationPanelOpen,
}: RouteCameraInsetsState) {
  return {
    top: routeControlsCollapsed
      ? routeSummaryOverlayHeight + routeStationMarkerHeight + routeMapGap
      : 230,
    right: 18,
    bottom: routeSheetMinimised
      ? routeMinimisedSheetInset
      : stationPanelOpen
        ? routeStationSheetInset
        : routeResultsSheetInset,
    left: 18,
  };
}
