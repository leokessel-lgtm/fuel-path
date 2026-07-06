import { useCallback, useMemo, useState } from "react";
import { LayoutChangeEvent, useWindowDimensions } from "react-native";

import { spacing } from "../theme";

const defaultTopControlsBottom = 164;
const minExpandedSheetTop = 128;
const maxExpandedSheetTopRatio = 0.42;

export function useMeasuredControlBoundary() {
  const { height } = useWindowDimensions();
  const [topControlsHeight, setTopControlsHeight] = useState(0);
  const topControlsBottom = topControlsHeight
    ? spacing.md + topControlsHeight
    : defaultTopControlsBottom;
  const expandedSheetTop = clamp(
    topControlsBottom + spacing.lg,
    minExpandedSheetTop,
    Math.max(minExpandedSheetTop, Math.round(height * maxExpandedSheetTopRatio)),
  );
  const nearbyCameraInsets = useMemo(
    () => ({
      top: Math.max(120, Math.round(topControlsBottom + spacing.xl)),
      right: 18,
      bottom: 330,
      left: 18,
    }),
    [topControlsBottom],
  );
  const onTopControlsLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setTopControlsHeight((current) => Math.abs(current - nextHeight) > 1 ? nextHeight : current);
  }, []);
  return { expandedSheetTop, nearbyCameraInsets, onTopControlsLayout };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
