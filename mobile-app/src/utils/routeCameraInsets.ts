import { spacing } from "../theme";

export type RouteCameraInsetsState = {
  routeControlsCollapsed: boolean;
  routeSheetHeight?: number;
  routeSheetMinimised: boolean;
  stationPanelOpen: boolean;
  topControlsBottom?: number;
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
  routeSheetHeight = 0,
  routeSheetMinimised,
  stationPanelOpen,
  topControlsBottom = 0,
}: RouteCameraInsetsState) {
  const measuredTop = topControlsBottom
    ? topControlsBottom + (routeControlsCollapsed ? routeStationMarkerHeight + routeMapGap : routeMapGap)
    : 0;
  const measuredBottom = routeSheetHeight || 0;
  return {
    top: measuredTop || (routeControlsCollapsed
      ? routeSummaryOverlayHeight + routeStationMarkerHeight + routeMapGap
      : 230),
    right: routeHorizontalInset,
    bottom: measuredBottom || (routeSheetMinimised
      ? routeMinimisedSheetInset
      : stationPanelOpen
        ? routeStationSheetInset
        : routeResultsSheetInset),
    left: routeHorizontalInset,
  };
}
