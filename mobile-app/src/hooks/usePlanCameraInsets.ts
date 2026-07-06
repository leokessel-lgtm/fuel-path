import { useMemo, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

import { spacing } from "../theme";
import { routeCameraInsets } from "../utils/routeCameraInsets";

export function usePlanCameraInsets({
  routeControlsCollapsed,
  routeSheetMinimised,
  stationPanelOpen,
}: {
  routeControlsCollapsed: boolean;
  routeSheetMinimised: boolean;
  stationPanelOpen: boolean;
}) {
  const [topControlsBottom, setTopControlsBottom] = useState(0);
  const [routeSheetHeight, setRouteSheetHeight] = useState(0);

  const onTopControlsLayout = (event: LayoutChangeEvent) => {
    const { height, y } = event.nativeEvent.layout;
    setTopControlsBottom(Math.ceil(y + height + spacing.sm));
  };

  const onRouteSheetLayout = (event: LayoutChangeEvent) => {
    setRouteSheetHeight(Math.ceil(event.nativeEvent.layout.height + spacing.lg));
  };

  const cameraInsets = useMemo(
    () =>
      routeCameraInsets({
        routeControlsCollapsed,
        routeSheetHeight,
        routeSheetMinimised,
        stationPanelOpen,
        topControlsBottom,
      }),
    [routeControlsCollapsed, routeSheetHeight, routeSheetMinimised, stationPanelOpen, topControlsBottom],
  );

  return { cameraInsets, onRouteSheetLayout, onTopControlsLayout };
}
