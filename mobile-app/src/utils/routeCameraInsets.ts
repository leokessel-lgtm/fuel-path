import { spacing } from "../theme";

export type RouteCameraInsetsState = {
  routeControlsCollapsed: boolean;
  routeSheetMinimised: boolean;
  stationPanelOpen: boolean;
};

const routeHorizontalInset = 26;
const routeMapGap = 12;
const routeStationMarkerHeight = 64;
const routeSummaryOverlayHeight = spacing.sm + 82;
const routeResultsSheetInset = 302;
const routeStationSheetInset = 286;
const routeMinimisedSheetInset = 104;

export function routeCameraInsets({
  routeControlsCollapsed,
  routeSheetMinimised,
  stationPanelOpen,
}: RouteCameraInsetsState) {
  return {
    top: routeControlsCollapsed
      ? routeSummaryOverlayHeight + routeStationMarkerHeight + routeMapGap
      : 230,
    right: routeHorizontalInset,
    bottom: routeSheetMinimised
      ? routeMinimisedSheetInset
      : stationPanelOpen
        ? routeStationSheetInset
        : routeResultsSheetInset,
    left: routeHorizontalInset,
  };
}
