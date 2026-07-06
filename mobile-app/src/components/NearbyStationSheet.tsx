import { ReactNode, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { NearbyResponse, NearbySheetSnap, StationViewModel } from "../types";
import { stationEvidenceLine } from "../utils/decisionEvidence";
import { fuelMismatchContextLine, fuelMismatchLine } from "../utils/fuelMismatch";
import { BrandBadge } from "./BrandBadge";
import { StationRow } from "./StationRow";

export type NearbySortMode = "distance" | "price" | "value";

export const defaultNearbySortMode: NearbySortMode = "value";
const nearbySheetBottomOffset = 8;
const sheetDragActivatePx = 8;
const sheetExpandDragPx = -60;
const sheetCollapseDragPx = 70;
const sheetDismissDragPx = 170;

export const nearbySortOptions: Array<{
  key: NearbySortMode;
  label: string;
  accessibilityLabel: string;
}> = [
  { key: "distance", label: "Closest", accessibilityLabel: "Sort by closest station" },
  { key: "price", label: "Cheapest", accessibilityLabel: "Sort by cheapest station in map view" },
  { key: "value", label: "Best value", accessibilityLabel: "Sort by best balance of price and distance" },
];

export function NearbyStationSheet({
  error,
  loading,
  onCloseSelectedStation,
  onNavigateToStation,
  onSelectStation,
  onSortPress,
  onSnapChange,
  onToggleExpanded,
  selected,
  selectedCode,
  sheetSnap,
  sheetExpanded,
  expandedSheetTop,
  sortedStations,
  sortMode,
  stationContext,
  stationNotice,
  stations,
  topControls,
}: {
  error: string;
  loading: boolean;
  onCloseSelectedStation: () => void;
  onNavigateToStation: (station: StationViewModel) => void;
  onSelectStation: (stationCode: string) => void;
  onSortPress: (sortMode: NearbySortMode) => void;
  onSnapChange?: (snap: NearbySheetSnap) => void;
  onToggleExpanded: (expanded: boolean) => void;
  selected?: StationViewModel;
  selectedCode?: string;
  sheetSnap?: NearbySheetSnap;
  sheetExpanded: boolean;
  expandedSheetTop: number;
  sortedStations: StationViewModel[];
  sortMode?: NearbySortMode;
  stationContext?: NearbyResponse["context"];
  stationNotice: string;
  stations: StationViewModel[];
  topControls?: ReactNode;
}) {
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartYRef = useRef(0);
  const dragMovedRef = useRef(false);
  const suppressNextPressRef = useRef(false);
  const activeSnap = sheetSnap || (sheetExpanded ? "full" : "browse");
  const isPeek = activeSnap === "peek";
  const isFull = activeSnap === "full";
  const visibleStationNotice = fuelMismatchContextLine(stationContext);

  const requestSnap = (snap: NearbySheetSnap) => {
    if (onSnapChange) {
      onSnapChange(snap);
      return;
    }
    onToggleExpanded(snap === "full");
  };
  const requestMap = () => {
    requestSnap("browse");
  };

  const settleSheetDrag = (dy: number, toggleOnTap = true) => {
    setDragOffsetY(0);
    if (toggleOnTap && !dragMovedRef.current && Math.abs(dy) < sheetDragActivatePx) {
      requestSnap(nextSnap(activeSnap));
      return;
    }
    if (dy > sheetDismissDragPx) {
      if (selected && !sheetExpanded) onCloseSelectedStation();
      requestSnap("browse");
      return;
    }
    if (dy > sheetCollapseDragPx) {
      requestSnap(isFull ? "browse" : "peek");
      return;
    }
    if (dy < sheetExpandDragPx) {
      requestSnap(isPeek ? "browse" : "full");
    }
  };
  const updateDragOffset = (pageY: number) => {
    const dy = pageY - dragStartYRef.current;
    dragMovedRef.current = dragMovedRef.current || Math.abs(dy) > sheetDragActivatePx;
    setDragOffsetY(clampSheetDrag(dy, isFull));
    return dy;
  };
  const finishWebDrag = (pageY: number) => {
    const dy = pageY - dragStartYRef.current;
    if (dragMovedRef.current) {
      suppressNextPressRef.current = true;
      settleSheetDrag(dy, false);
      return;
    }
    setDragOffsetY(0);
  };
  const webDragProps =
    Platform.OS === "web"
      ? ({
          onMouseDown: (event: { nativeEvent?: { pageY?: number } }) => {
            dragStartYRef.current = Number(event.nativeEvent?.pageY || 0);
            dragMovedRef.current = false;
            const handleMove = (moveEvent: MouseEvent) => updateDragOffset(moveEvent.pageY);
            const handleUp = (upEvent: MouseEvent) => {
              window.removeEventListener("mousemove", handleMove);
              finishWebDrag(upEvent.pageY);
            };
            window.addEventListener("mousemove", handleMove);
            window.addEventListener("mouseup", handleUp, { once: true });
          },
          onTouchStart: (event: { nativeEvent?: { touches?: Array<{ pageY?: number }> } }) => {
            const firstTouch = event.nativeEvent?.touches?.[0];
            dragStartYRef.current = Number(firstTouch?.pageY || 0);
            dragMovedRef.current = false;
            const handleMove = (moveEvent: TouchEvent) => {
              const touch = moveEvent.touches[0];
              if (touch) updateDragOffset(touch.pageY);
            };
            const handleEnd = (endEvent: TouchEvent) => {
              window.removeEventListener("touchmove", handleMove);
              const touch = endEvent.changedTouches[0];
              finishWebDrag(touch?.pageY || dragStartYRef.current);
            };
            window.addEventListener("touchmove", handleMove, { passive: true });
            window.addEventListener("touchend", handleEnd, { once: true });
          },
        } as Record<string, unknown>)
      : {};

  return (
    <View
      style={[
        styles.sheet,
        isFull ? [styles.sheetExpanded, { top: expandedSheetTop }] : isPeek ? styles.sheetPeek : styles.sheetCollapsed,
        selected && !isFull && !isPeek ? styles.sheetCollapsedWithSelection : null,
        dragOffsetY !== 0 && { transform: [{ translateY: dragOffsetY }] },
      ]}
    >
      <View style={styles.sheetHeader}>
        <Pressable
          accessibilityLabel={sheetExpanded ? "Collapse station list" : "Expand station list"}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => {
            if (suppressNextPressRef.current) {
              suppressNextPressRef.current = false;
              return;
            }
            requestSnap(nextSnap(activeSnap));
          }}
          onResponderGrant={(event) => {
            dragStartYRef.current = responderPageY(event);
            dragMovedRef.current = false;
          }}
          onResponderMove={(event) => {
            updateDragOffset(responderPageY(event));
          }}
          onResponderRelease={(event) => {
            suppressNextPressRef.current = true;
            settleSheetDrag(responderPageY(event) - dragStartYRef.current);
          }}
          onResponderTerminate={() => setDragOffsetY(0)}
          onStartShouldSetResponder={() => true}
          {...webDragProps}
          style={styles.grabberTouch}
        >
          <View style={styles.grabber} />
        </Pressable>
        <View style={styles.headerActions}>
          {isFull ? (
            <Pressable
              accessibilityLabel="Show map"
              accessibilityRole="button"
              hitSlop={10}
              onPress={requestMap}
              style={styles.mapButton}
            >
              <Text style={styles.mapButtonText}>Map</Text>
            </Pressable>
          ) : null}
          {!isFull && selected ? (
            <Pressable
              accessibilityLabel="Close selected station"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onCloseSelectedStation}
              style={styles.mapButton}
            >
              <Text style={styles.mapButtonText}>Close</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.muted}>Loading live FuelCheck stations...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Could not load stations</Text>
          <Text style={styles.muted}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error && stationNotice && !stations.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No priced stations found</Text>
          <Text style={styles.muted}>{stationNotice}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
        <>
          {topControls && !isPeek ? <View style={styles.topControls}>{topControls}</View> : null}
          {selected && !sheetExpanded ? (
            <>
              <SelectedStationCard
                onNavigate={() => onNavigateToStation(selected)}
                selected={selected}
              />
            </>
          ) : null}
          {!isPeek && stations.length && visibleStationNotice ? (
            <View style={styles.noticeState}>
              <Text style={styles.noticeTitle}>Fuel match</Text>
              <Text style={styles.muted}>{visibleStationNotice}</Text>
            </View>
          ) : null}
          {(isFull || !selected || selected) ? <View style={styles.sortRow}>
            {nearbySortOptions.map((option) => {
              const selectedSort = !selected && sortMode === option.key;
              return (
                <Pressable
                  accessibilityLabel={option.accessibilityLabel}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedSort }}
                  key={option.key}
                  onPress={() => onSortPress(option.key)}
                  style={[styles.sortButton, selectedSort && styles.sortButtonSelected]}
                >
                  <Text style={[styles.sortText, selectedSort && styles.sortTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View> : null}
          {sheetExpanded ? (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator
            >
              {sortedStations.map((item) => (
                <StationRow
                  item={item}
                  key={item.station.stationCode}
                  selected={item.station.stationCode === selectedCode}
                  onPress={() => onSelectStation(item.station.stationCode)}
                />
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function responderPageY(event: GestureResponderEvent) {
  return Number(event.nativeEvent.pageY || 0);
}

function clampSheetDrag(value: number, sheetExpanded: boolean) {
  const min = sheetExpanded ? -24 : -190;
  const max = sheetExpanded ? 220 : 180;
  return Math.max(min, Math.min(max, value));
}

function nextSnap(activeSnap: NearbySheetSnap): NearbySheetSnap {
  if (activeSnap === "peek") return "browse";
  if (activeSnap === "browse") return "full";
  return "browse";
}

function SelectedStationCard({
  onNavigate,
  selected,
}: {
  onNavigate: () => void;
  selected: StationViewModel;
}) {
  const selectedFuelLabel = selected.fuel || "fuel";
  const mismatchLine = fuelMismatchLine(selected);

  return (
    <View style={styles.selectedCardShell}>
      <View style={[styles.selectedCard, styles.selectedCardCollapsed]}>
        <View style={styles.selectedRow}>
          <View style={styles.selectedPriceTile}>
            <Text style={styles.selectedPriceValue}>{selected.adjustedCpl.toFixed(1)}</Text>
            <Text style={styles.selectedFuelLabel}>{selectedFuelLabel}</Text>
          </View>
          <View style={styles.selectedMain}>
            <View style={styles.selectedTitleRow}>
              <BrandBadge station={selected.station} size={28} />
              <Text numberOfLines={1} style={styles.selectedTitle}>
                {selected.station.name}
              </Text>
            </View>
            {selected.station.address ? (
              <Text numberOfLines={1} style={styles.selectedDetail}>
                {selected.station.address}
              </Text>
            ) : null}
            <Text numberOfLines={1} style={styles.selectedStatusLine}>
              {stationOpenLabel(selected.station.openNow)}
            </Text>
            {mismatchLine ? (
              <Text numberOfLines={2} style={styles.selectedMismatch}>
                {mismatchLine}
              </Text>
            ) : null}
            {selected.discountCpl ? (
              <Text numberOfLines={1} style={styles.selectedDiscount}>
                Confirmed: {selected.discountLabel}
              </Text>
            ) : null}
          </View>
          <View style={styles.selectedActionColumn}>
            <Pressable
              accessibilityLabel={`Navigate to ${selected.station.name}`}
              onPress={onNavigate}
              style={styles.navigateButton}
            >
              <Text style={styles.navigateButtonIcon}>↗</Text>
            </Pressable>
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceBadgeText}>{selected.distanceKm.toFixed(1)} km</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function stationOpenLabel(openNow?: boolean) {
  if (openNow === false) return "Closed";
  if (openNow === true) return "Open now";
  return "Hours unknown";
}

const styles = StyleSheet.create({
  sheet: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.sm,
    bottom: nearbySheetBottomOffset,
    left: spacing.md,
    padding: spacing.md,
    position: "absolute",
    right: spacing.md,
    zIndex: 6,
  },
  sheetCollapsed: {
    maxHeight: 275,
    overflow: "hidden",
  },
  sheetCollapsedWithSelection: {
    maxHeight: 340,
  },
  sheetPeek: {
    bottom: 18,
    maxHeight: 205,
    overflow: "hidden",
  },
  sheetExpanded: {
    bottom: 8,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 20,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.xs,
    position: "absolute",
    right: 0,
  },
  grabberTouch: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  mapButton: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  listButton: {
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    left: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: "absolute",
  },
  mapButtonText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "600",
  },
  listButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    width: 44,
  },
  sortRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  topControls: {
    marginBottom: spacing.xs,
  },
  peekHint: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    lineHeight: 18,
  },
  sortButton: {
    alignItems: "center",
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  sortButtonSelected: {
    borderColor: colors.black,
    backgroundColor: colors.black,
  },
  sortText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  sortTextSelected: {
    color: colors.white,
    fontWeight: "700",
  },
  loadingState: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyState: {
    ...surfaces.softPanel,
    borderRadius: radii.xl,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeState: {
    backgroundColor: colors.amberSoft,
    borderColor: "rgba(152, 99, 26, 0.26)",
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.ink,
    fontWeight: "700",
  },
  noticeTitle: {
    color: colors.amber,
    fontSize: typeScale.caption,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 17,
  },
  selectedCardShell: {
    gap: spacing.xs,
  },
  selectedCard: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.black,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.sm,
  },
  selectedCardCollapsed: {
    paddingVertical: spacing.sm,
  },
  selectedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  selectedPriceTile: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radii.md,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 66,
    width: 76,
  },
  selectedPriceValue: {
    color: colors.greenDark,
    fontSize: typeScale.title,
    fontWeight: "900",
    lineHeight: 26,
  },
  selectedFuelLabel: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    lineHeight: 16,
    textTransform: "uppercase",
  },
  selectedMain: {
    flex: 1,
    minWidth: 0,
  },
  selectedTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    minWidth: 0,
  },
  selectedTitle: {
    ...typography.bodyStrong,
    flex: 1,
    minWidth: 0,
  },
  selectedDetail: {
    color: colors.inkSoft,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 17,
  },
  selectedStatusLine: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    marginTop: 2,
  },

  selectedMismatch: {
    color: colors.amber,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
    marginTop: 2,
  },
  selectedDiscount: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "500",
    marginTop: 2,
  },
  evidenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  evidenceChip: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 9,
    fontWeight: "600",
    maxWidth: 150,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  selectedActionColumn: {
    alignItems: "center",
    flexShrink: 0,
    gap: 2,
    minWidth: 58,
  },
  tomorrowPriceDown: {
    color: colors.greenDark,
  },
  tomorrowPriceUp: {
    color: colors.amber,
  },
  distanceBadge: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 3,
    minHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  distanceBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  navigateButton: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  navigateButtonIcon: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
});
