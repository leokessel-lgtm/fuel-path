import { useRef, useState } from "react";
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
import { StationViewModel } from "../types";
import {
  predictionDisciplineCue,
  stationAttentionCue,
  stationEvidenceLine,
  stationTimestampLine,
} from "../utils/decisionEvidence";
import { tomorrowPriceView } from "../utils/pricing";
import { BrandBadge } from "./BrandBadge";
import { StationRow } from "./StationRow";

export type NearbySortMode = "distance" | "price" | "value";

export const defaultNearbySortMode: NearbySortMode = "value";
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
  onToggleExpanded,
  selected,
  selectedCode,
  sheetExpanded,
  sortedStations,
  sortMode,
  stationNotice,
  stations,
}: {
  error: string;
  loading: boolean;
  onCloseSelectedStation: () => void;
  onNavigateToStation: (station: StationViewModel) => void;
  onSelectStation: (stationCode: string) => void;
  onSortPress: (sortMode: NearbySortMode) => void;
  onToggleExpanded: (expanded: boolean) => void;
  selected?: StationViewModel;
  selectedCode?: string;
  sheetExpanded: boolean;
  sortedStations: StationViewModel[];
  sortMode?: NearbySortMode;
  stationNotice: string;
  stations: StationViewModel[];
}) {
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartYRef = useRef(0);
  const dragMovedRef = useRef(false);
  const suppressNextPressRef = useRef(false);

  const settleSheetDrag = (dy: number, toggleOnTap = true) => {
    setDragOffsetY(0);
    if (toggleOnTap && !dragMovedRef.current && Math.abs(dy) < sheetDragActivatePx) {
      onToggleExpanded(!sheetExpanded);
      return;
    }
    if (dy > sheetDismissDragPx) {
      if (selected && !sheetExpanded) onCloseSelectedStation();
      onToggleExpanded(false);
      return;
    }
    if (dy > sheetCollapseDragPx) {
      onToggleExpanded(false);
      return;
    }
    if (dy < sheetExpandDragPx) {
      onToggleExpanded(true);
    }
  };
  const updateDragOffset = (pageY: number) => {
    const dy = pageY - dragStartYRef.current;
    dragMovedRef.current = dragMovedRef.current || Math.abs(dy) > sheetDragActivatePx;
    setDragOffsetY(clampSheetDrag(dy, sheetExpanded));
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
        sheetExpanded ? styles.sheetExpanded : styles.sheetCollapsed,
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
            onToggleExpanded(!sheetExpanded);
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
        {sheetExpanded ? (
          <Pressable
            accessibilityLabel="Show map"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => onToggleExpanded(false)}
            style={styles.mapButton}
          >
            <Text style={styles.mapButtonText}>Map</Text>
          </Pressable>
        ) : null}
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
          {sheetExpanded && stationNotice && stations.length ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeText}>{stationNotice}</Text>
            </View>
          ) : null}
          {selected && !sheetExpanded ? (
            <SelectedStationCard
              onClose={onCloseSelectedStation}
              onNavigate={() => onNavigateToStation(selected)}
              selected={selected}
            />
          ) : null}
          <View style={styles.sortRow}>
            {nearbySortOptions.map((option) => {
              const selectedSort = sortMode === option.key;
              return (
                <Pressable
                  accessibilityLabel={option.accessibilityLabel}
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
          </View>
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

function SelectedStationCard({
  onClose,
  onNavigate,
  selected,
}: {
  onClose: () => void;
  onNavigate: () => void;
  selected: StationViewModel;
}) {
  const selectedTomorrow = tomorrowPriceView(selected);
  const selectedAttentionCue = stationAttentionCue(selected);
  const selectedPredictionCue = predictionDisciplineCue(selected);
  const selectedFuelLabel = selected.fuel || "fuel";
  const selectedMetaLine = [stationTimestampLine(selected.station)]
    .filter(Boolean)
    .join(" | ");

  return (
    <View style={[styles.selectedCard, styles.selectedCardCollapsed]}>
      <Pressable
        accessibilityLabel="Close selected station"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onClose}
        style={styles.closeButton}
      >
        <Text style={styles.closeButtonText}>X</Text>
      </Pressable>
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
          <Text numberOfLines={1} style={styles.selectedMetaRest}>
            {selectedMetaLine || stationEvidenceLine(selected)}
          </Text>
          {selected.discountCpl ? (
            <Text numberOfLines={1} style={styles.selectedDiscount}>
              Confirmed: {selected.discountLabel}
            </Text>
          ) : null}
          {selectedAttentionCue || selectedPredictionCue ? (
            <View style={styles.evidenceRow}>
              {selectedAttentionCue ? (
                <Text numberOfLines={1} style={styles.evidenceChip}>
                  {selectedAttentionCue.label}
                </Text>
              ) : null}
              {selectedPredictionCue ? (
                <Text numberOfLines={1} style={styles.evidenceChip}>
                  {selectedPredictionCue}
                </Text>
              ) : null}
            </View>
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
          {selectedTomorrow ? (
            <Text
              numberOfLines={1}
              style={[
                styles.selectedTomorrowPrice,
                selectedTomorrow.direction === "down" && styles.tomorrowPriceDown,
                selectedTomorrow.direction === "up" && styles.tomorrowPriceUp,
              ]}
            >
              {selectedTomorrow.detailLabel}
            </Text>
          ) : null}
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
    gap: spacing.md,
    bottom: spacing.sm,
    left: spacing.md,
    padding: spacing.md,
    position: "absolute",
    right: spacing.md,
    zIndex: 6,
  },
  sheetCollapsed: {
    maxHeight: 305,
    overflow: "hidden",
  },
  sheetExpanded: {
    height: "78%",
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 20,
  },
  grabberTouch: {
    alignItems: "center",
    flex: 1,
    paddingVertical: spacing.xs,
  },
  mapButton: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: "absolute",
    right: 0,
  },
  mapButtonText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "600",
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
  noticeCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeText: {
    color: colors.amber,
    fontSize: typeScale.caption,
    fontWeight: "500",
  },
  sortButton: {
    alignItems: "center",
    backgroundColor: colors.panelStrong,
    borderRadius: radii.pill,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  sortButtonSelected: {
    backgroundColor: colors.black,
  },
  sortText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "500",
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
  emptyTitle: {
    color: colors.ink,
    fontWeight: "700",
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 17,
  },
  selectedCard: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.black,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.sm,
    position: "relative",
  },
  selectedCardCollapsed: {
    paddingVertical: spacing.sm,
  },
  selectedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingRight: 30,
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
  selectedMetaRest: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "400",
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
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    height: 30,
    justifyContent: "center",
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm,
    zIndex: 2,
    width: 30,
  },
  closeButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  selectedActionColumn: {
    alignItems: "center",
    flexShrink: 0,
    gap: 4,
    minWidth: 58,
  },
  selectedTomorrowPrice: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    maxWidth: 76,
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
