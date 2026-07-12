import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type ListRenderItem } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { EvCharger, EvChargerResponse, MapPoint, NavigationAppPreference, ScoreResponse, StationViewModel, VehicleEnergyType } from "../types";
import { stationTimestampLine } from "../utils/decisionEvidence";
import { fuelMismatchContextLine, fuelMismatchLine } from "../utils/fuelMismatch";
import { tomorrowPriceView } from "../utils/pricing";
import {
  routeDetourEvidenceLine,
  routeDetourEvidenceMetricLabel,
  routeDetourMinutes,
} from "../utils/routeEvidenceCopy";
import { BrandBadge } from "./BrandBadge";
import { DecisionEvidencePanel } from "./DecisionEvidencePanel";
import { StationRow } from "./StationRow";
import { openDirections, openRouteDirectionsViaStop } from "../screens/NearbyScreen.utils";

const emptyEvFallbackChargers: EvCharger[] = [];
const stopKeyExtractor = (item: StationViewModel) => item.station.stationCode;

export function PlanRouteSheet({
  best,
  candidates,
  currentRouteSaved,
  decisionSummary,
  error,
  emptyRouteTitle,
  evFallbackChargers,
  evRouteContext,
  evFallbackError,
  evFallbackLoading,
  loading,
  loadingLabel,
  onLayout,
  onMinimise,
  onNavigationOpened,
  navigationApp,
  onSaveCommute,
  onSelectStation,
  onSelectCharger,
  onShowStops,
  onWatchRoute,
  onRestore,
  policyActive,
  policyNotice,
  recommendationCopy,
  routeEndpointsPresent,
  routeEndpoints,
  routeNotice,
  resultContext,
  routeSheetMinimised,
  routeSummary,
  selected,
  selectedChargerId,
  selectedCode,
  showStopsList,
  stationPanelOpen,
  stopsTitle,
  statusCapability,
  watchRouteDisabled,
  watchRouteEnabled,
  vehicleEnergyType,
}: {
  best?: StationViewModel;
  candidates: StationViewModel[];
  currentRouteSaved: boolean;
  decisionSummary?: ScoreResponse["context"]["decisionSummary"];
  error: string;
  emptyRouteTitle?: string;
  evFallbackChargers?: EvCharger[];
  evRouteContext?: EvChargerResponse["context"] | null;
  evFallbackError?: string;
  evFallbackLoading?: boolean;
  loading: boolean;
  loadingLabel?: string;
  navigationApp: NavigationAppPreference;
  onLayout?: (event: LayoutChangeEvent) => void;
  onMinimise: () => void;
  onNavigationOpened?: (station: StationViewModel) => void;
  onRestore: () => void;
  onSaveCommute: () => void;
  onSelectStation: (stationCode: string) => void;
  onSelectCharger?: (chargerId: string) => void;
  onShowStops: () => void;
  onWatchRoute?: () => void;
  policyActive: boolean;
  policyNotice: string;
  recommendationCopy: { title: string; reason: string } | null;
  routeEndpointsPresent: boolean;
  routeEndpoints?: { from: MapPoint; to: MapPoint };
  routeNotice: string;
  resultContext?: ScoreResponse["context"];
  routeSheetMinimised: boolean;
  routeSummary: string;
  selected?: StationViewModel;
  selectedChargerId?: string;
  selectedCode?: string;
  showStopsList?: boolean;
  stationPanelOpen: boolean;
  stopsTitle?: string;
  statusCapability?: string;
  watchRouteDisabled?: boolean;
  watchRouteEnabled?: boolean;
  vehicleEnergyType?: VehicleEnergyType;
}) {
  const bestTomorrow = best ? tomorrowPriceView(best) : null;
  const selectedTomorrow = selected ? tomorrowPriceView(selected) : null;
  const routeSheetRestoreLabel = stationPanelOpen
    ? "Show station detail"
    : routeEndpointsPresent
      ? "Show route panel"
      : "Show route panel";
  const routeSheetRestoreText = stationPanelOpen ? "Detail" : routeEndpointsPresent ? "Recommended" : "Panel";

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.sheet,
        routeSheetMinimised
          ? styles.sheetMinimised
          : stationPanelOpen
            ? styles.stationSheet
            : styles.resultsSheet,
      ]}
    >
      {routeSheetMinimised ? (
        <View style={styles.minimisedSheetRow}>
          <View style={styles.grabber} />
          <Text numberOfLines={1} style={styles.minimisedSheetText}>
            {stationPanelOpen && selected ? selected.station.name : routeEndpointsPresent ? routeSummary : "Route map"}
          </Text>
          <Pressable
            accessibilityLabel={routeSheetRestoreLabel}
            accessibilityRole="button"
            onPress={onRestore}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>{routeSheetRestoreText}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.sheetTopBar}>
            <View style={styles.grabber} />
            <Pressable
              accessibilityLabel="Show more map"
              accessibilityRole="button"
              onPress={onMinimise}
              style={styles.mapButton}
            >
              <Text style={styles.mapButtonText}>Map</Text>
            </Pressable>
          </View>
          {stationPanelOpen && selected ? (
            <StationDetailPanel
              onNavigate={() => {
                onNavigationOpened?.(selected);
                openPlanStationDirections(selected, navigationApp, routeEndpoints);
              }}
              onShowStops={onShowStops}
              selected={selected}
              selectedTomorrow={selectedTomorrow}
            />
          ) : (
            <RouteResultsPanel
              best={best}
              bestTomorrow={bestTomorrow}
              candidates={candidates}
              currentRouteSaved={currentRouteSaved}
              decisionSummary={decisionSummary}
              error={error}
              emptyRouteTitle={emptyRouteTitle}
              evFallbackChargers={evFallbackChargers}
              evRouteContext={evRouteContext}
              evFallbackError={evFallbackError}
              evFallbackLoading={evFallbackLoading}
              loading={loading}
              loadingLabel={loadingLabel}
              navigationApp={navigationApp}
              onSaveCommute={onSaveCommute}
              onNavigationOpened={onNavigationOpened}
              onSelectStation={onSelectStation}
              onSelectCharger={onSelectCharger}
              policyActive={policyActive}
              policyNotice={policyNotice}
              recommendationCopy={recommendationCopy}
              routeEndpointsPresent={routeEndpointsPresent}
              routeEndpoints={routeEndpoints}
              routeNotice={routeNotice}
              resultContext={resultContext}
              selectedCode={selectedCode}
              selectedChargerId={selectedChargerId}
              showStopsList={showStopsList}
              stopsTitle={stopsTitle}
              statusCapability={statusCapability}
              onWatchRoute={onWatchRoute}
              watchRouteDisabled={watchRouteDisabled}
              watchRouteEnabled={watchRouteEnabled}
              vehicleEnergyType={vehicleEnergyType}
            />
          )}
        </>
      )}
    </View>
  );
}

function StationDetailPanel({
  onNavigate,
  onShowStops,
  selected,
  selectedTomorrow,
}: {
  onNavigate: () => void;
  onShowStops: () => void;
  selected: StationViewModel;
  selectedTomorrow: ReturnType<typeof tomorrowPriceView>;
}) {
  const mismatchLine = fuelMismatchLine(selected, { scope: "route" });
  const showDiscountRows = selected.discountCpl > 0 && selected.discountLabel;
  return (
    <View style={styles.stationDetailPanel}>
      <View style={styles.sheetHeaderRow}>
        <View />
        <Pressable
          accessibilityLabel="Show recommended stop"
          accessibilityRole="button"
          onPress={onShowStops}
          style={styles.textButton}
        >
          <Text style={styles.textButtonLabel}>Recommended</Text>
        </Pressable>
      </View>
      <StationRow hideWhyLine item={selected} selected onPress={onNavigate} />
      {mismatchLine ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>{mismatchLine}</Text>
        </View>
      ) : null}
      <View style={styles.stationFacts}>
        {showDiscountRows ? (
          <>
            <View style={styles.factPill}>
              <Text style={styles.factLabel}>Pump</Text>
              <Text style={styles.factValue}>{selected.pumpCpl.toFixed(1)} c/L</Text>
            </View>
            <View style={styles.factPill}>
              <Text style={styles.factLabel}>Your price</Text>
              <Text style={styles.factValue}>{selected.adjustedCpl.toFixed(1)} c/L</Text>
            </View>
            <View style={styles.factPill}>
              <Text style={styles.factLabel}>Saving</Text>
              <Text style={styles.factValue}>{priceSavingCpl(selected).toFixed(1)} c/L</Text>
            </View>
          </>
        ) : (
          <View style={styles.factPill}>
            <Text style={styles.factLabel}>Price</Text>
            <Text style={styles.factValue}>{selected.adjustedCpl.toFixed(1)} c/L</Text>
          </View>
        )}
        <View style={styles.factPill}>
          <Text style={styles.factLabel}>{routeDetourEvidenceMetricLabel(selected)}</Text>
          <Text style={styles.factValue}>{routeDetourMinutes(selected).toFixed(1)} min</Text>
        </View>
        {selectedTomorrow ? (
          <View style={styles.factPill}>
            <Text style={styles.factLabel}>Tomorrow</Text>
            <Text
              numberOfLines={1}
              style={[
                styles.factValue,
                selectedTomorrow.direction === "down" && styles.tomorrowPriceDown,
                selectedTomorrow.direction === "up" && styles.tomorrowPriceUp,
              ]}
            >
              {selectedTomorrow.cpl.toFixed(1)} c/L
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.muted}>{stationTimestampLine(selected.station)}</Text>
    </View>
  );
}

function RouteResultsPanel({
  best,
  bestTomorrow,
  candidates,
  currentRouteSaved,
  decisionSummary,
  error,
  emptyRouteTitle,
  evFallbackChargers = emptyEvFallbackChargers,
  evRouteContext = null,
  evFallbackError = "",
  evFallbackLoading = false,
  loading,
  loadingLabel,
  navigationApp,
  onSaveCommute,
  onNavigationOpened,
  onSelectStation,
  onSelectCharger,
  onWatchRoute,
  policyActive,
  policyNotice,
  recommendationCopy,
  routeEndpointsPresent,
  routeEndpoints,
  routeNotice,
  resultContext,
  selectedCode,
  selectedChargerId,
  showStopsList = true,
  stopsTitle = "Route options",
  statusCapability,
  watchRouteDisabled = false,
  watchRouteEnabled = false,
  vehicleEnergyType = "petrol",
}: {
  best?: StationViewModel;
  bestTomorrow: ReturnType<typeof tomorrowPriceView>;
  candidates: StationViewModel[];
  currentRouteSaved: boolean;
  decisionSummary?: ScoreResponse["context"]["decisionSummary"];
  error: string;
  emptyRouteTitle?: string;
  evFallbackChargers?: EvCharger[];
  evRouteContext?: EvChargerResponse["context"] | null;
  evFallbackError?: string;
  evFallbackLoading?: boolean;
  loading: boolean;
  loadingLabel?: string;
  navigationApp: NavigationAppPreference;
  onSaveCommute: () => void;
  onNavigationOpened?: (station: StationViewModel) => void;
  onSelectStation: (stationCode: string) => void;
  onSelectCharger?: (chargerId: string) => void;
  onWatchRoute?: () => void;
  policyActive: boolean;
  policyNotice: string;
  recommendationCopy: { title: string; reason: string } | null;
  routeEndpointsPresent: boolean;
  routeEndpoints?: { from: MapPoint; to: MapPoint };
  routeNotice: string;
  resultContext?: ScoreResponse["context"];
  selectedCode?: string;
  selectedChargerId?: string;
  showStopsList?: boolean;
  stopsTitle?: string;
  statusCapability?: string;
  watchRouteDisabled?: boolean;
  watchRouteEnabled?: boolean;
  vehicleEnergyType?: VehicleEnergyType;
}) {
  const recommendationSavingCpl = best ? routeSavingCpl(best, decisionSummary) : 0;
  const recommendationFuel = best?.fuel || "fuel";
  const recommendationSummary = best
    ? routeRecommendationSummary(best, recommendationCopy, recommendationSavingCpl, decisionSummary)
    : null;
  const showStatusChip = statusCapability && statusCapability !== "live";
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const eligibility = best ? discountEligibilitySummary(best, policyActive) : null;
  const routeFuelMismatch = fuelMismatchLine(best, { scope: "route" }) || fuelMismatchContextLine(resultContext, { scope: "route" });
  const renderStopItem = useCallback<ListRenderItem<StationViewModel>>(
    ({ item }) => (
      <PlanStopRow
        item={item}
        selected={item.station.stationCode === selectedCode}
        onSelectStation={onSelectStation}
      />
    ),
    [onSelectStation, selectedCode],
  );

  return (
    <>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.muted}>{loadingLabel || "Scoring live route prices..."}</Text>
        </View>
      ) : null}
      {error ? (
        <>
          <Text style={styles.decisionTitle}>Route needs attention</Text>
          <Text style={styles.muted}>{error}</Text>
        </>
      ) : null}
      {!loading && !error && best ? (
        <>
          {policyNotice && evidenceExpanded ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeText}>{policyNotice}</Text>
            </View>
          ) : null}
          <View style={styles.compactRecommendation}>
            {recommendationSummary ? (
              <Pressable
                accessibilityLabel={`Open ${best.station.name} recommendation detail`}
                accessibilityRole="button"
                onPress={() => onSelectStation(best.station.stationCode)}
                style={styles.recommendationSummary}
              >
                <Text numberOfLines={1} style={styles.recommendationSummaryTitle}>
                  {recommendationSummary.title}
                </Text>
                <Text numberOfLines={2} style={styles.recommendationSummaryText}>
                  {recommendationSummary.body}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.recommendationBodyRow}>
              <Pressable
                accessibilityLabel={`Open ${best.station.name} recommendation detail`}
                accessibilityRole="button"
                onPress={() => onSelectStation(best.station.stationCode)}
                style={styles.recommendationMainButton}
              >
                <View style={styles.recommendationPriceTile}>
                  <Text style={styles.recommendationPriceValue}>{best.adjustedCpl.toFixed(1)}</Text>
                  <Text style={styles.recommendationFuelLabel}>{recommendationFuel}</Text>
                </View>
                <View style={styles.recommendationCopy}>
                  <View style={styles.recommendationStationRow}>
                    <BrandBadge station={best.station} size={28} />
                    <Text numberOfLines={1} style={styles.recommendationStationName}>
                      {best.station.name}
                    </Text>
                  </View>
                  <View style={styles.compactChipRow}>
                    {eligibility?.chips.slice(0, 2).map((chip) => (
                      <Text
                        key={chip.label}
                        numberOfLines={1}
                        style={[
                          styles.compactChip,
                          chip.tone === "caution" ? styles.compactChipCaution : null,
                        ]}
                      >
                        {chip.label}
                      </Text>
                    ))}
                    {showStatusChip ? (
                      <Text
                        numberOfLines={1}
                        style={[styles.compactChip, styles.compactChipCaution]}
                      >
                        {capabilityLabelForPlan(statusCapability)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
              <View style={styles.recommendationRouteValue}>
                <Pressable
                  accessibilityLabel={
                    routeEndpoints
                      ? `Navigate via ${best.station.name} to ${routeEndpoints.to.label}`
                      : `Navigate to ${best.station.name}`
                  }
                  accessibilityRole="button"
                  onPress={(event) => {
                    event.stopPropagation();
                    onNavigationOpened?.(best);
                    openPlanStationDirections(best, navigationApp, routeEndpoints);
                  }}
                  style={styles.recommendationNavigateButton}
                >
                  <Text style={styles.recommendationNavigateText}>↗</Text>
                </Pressable>
                {bestTomorrow ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.recommendationTomorrowPrice,
                      bestTomorrow.direction === "down" && styles.tomorrowPriceDown,
                      bestTomorrow.direction === "up" && styles.tomorrowPriceUp,
                    ]}
                  >
                    {bestTomorrow.shortLabel}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
          {routeFuelMismatch ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeText}>{routeFuelMismatch}</Text>
            </View>
          ) : null}
          <View style={styles.compactActionRow}>
            <Pressable
              accessibilityLabel={evidenceExpanded ? "Hide route evidence" : "Show route evidence"}
              accessibilityRole="button"
              onPress={() => setEvidenceExpanded((value) => !value)}
              style={styles.secondaryActionButton}
            >
              <Text style={styles.secondaryActionText}>{evidenceExpanded ? "Less" : "Why?"}</Text>
            </Pressable>
            {routeEndpointsPresent ? (
              <Pressable
                accessibilityLabel={currentRouteSaved ? "Route already saved" : "Save route"}
                accessibilityRole="button"
                disabled={currentRouteSaved}
                onPress={onSaveCommute}
                style={[
                  styles.secondaryActionButton,
                  currentRouteSaved && styles.secondaryActionButtonDisabled,
                ]}
              >
                <Text style={styles.secondaryActionText}>{currentRouteSaved ? "Saved" : "Save"}</Text>
              </Pressable>
            ) : null}
          </View>
          {evidenceExpanded ? (
            <ScrollView
              contentContainerStyle={styles.expandedEvidenceContent}
              showsVerticalScrollIndicator
              style={styles.expandedEvidenceScroll}
            >
              <DiscountEligibilityCard summary={eligibility} />
              <DecisionEvidencePanel
                candidate={best}
                capability={statusCapability}
                decisionSummary={decisionSummary}
                resultContext={resultContext}
              />
              {currentRouteSaved ? (
              <RouteFollowUpPrompt
                currentRouteSaved={currentRouteSaved}
                onSaveCommute={onSaveCommute}
                onWatchRoute={onWatchRoute}
                routeEndpointsPresent={routeEndpointsPresent}
                hideSavePrompt={routeEndpointsPresent && !currentRouteSaved}
                watchRouteDisabled={watchRouteDisabled}
                watchRouteEnabled={watchRouteEnabled}
              />
              ) : null}
              {showStopsList ? (
                <>
                  <View style={styles.sheetHeaderRow}>
                    <Text style={styles.selectedTitle}>{stopsTitle}</Text>
                    <Text style={styles.muted}>Tap for detail</Text>
                  </View>
                  {candidates.map((item) => (
                    <StationRow
                      item={item}
                      key={item.station.stationCode}
                      selected={item.station.stationCode === selectedCode}
                      onPress={() => onSelectStation(item.station.stationCode)}
                    />
                  ))}
                </>
              ) : null}
            </ScrollView>
          ) : null}
        </>
      ) : null}
      {!loading && !error && routeEndpointsPresent && !best ? (
        <View style={styles.emptyRouteState}>
          {vehicleEnergyType !== "electric" ? (
            <>
              <Text style={styles.decisionTitle}>{emptyRouteTitle || "No fuel stops found"}</Text>
              <Text style={styles.muted}>
                {routeNotice ||
                  (policyActive
                    ? "Route found, but no approved brands match this fuel, freshness and open-station settings."
                    : "Route found, but no eligible stations match this fuel, freshness and open-station settings.")}
              </Text>
            </>
          ) : null}
          {!showStopsList ? (
            <EvRoutePlanPanel
              chargers={evFallbackChargers}
              context={evRouteContext}
              error={evFallbackError}
              loading={evFallbackLoading}
              navigationApp={navigationApp}
              onSelectCharger={onSelectCharger}
              selectedChargerId={selectedChargerId}
              vehicleEnergyType={vehicleEnergyType}
            />
          ) : null}
        </View>
      ) : null}
      {!loading && !error && !routeEndpointsPresent ? (
        <View style={styles.emptyRouteState}>
          <Text style={styles.decisionTitle}>Plan a regular drive</Text>
          <Text style={styles.muted}>
            Add a start and destination, or use a saved place, then Fuel Path will compare route value rather than raw cheapest price.
          </Text>
        </View>
      ) : null}

      {showStopsList && !best ? (
        <>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.selectedTitle}>{stopsTitle}</Text>
            {routeEndpointsPresent ? (
              <Pressable
                accessibilityLabel={currentRouteSaved ? "Route already saved" : "Save commute"}
                accessibilityRole="button"
                disabled={currentRouteSaved}
                onPress={onSaveCommute}
                style={[
                  styles.textButton,
                  currentRouteSaved && styles.textButtonDisabled,
                ]}
              >
                <Text style={styles.textButtonLabel}>
                  {currentRouteSaved ? "Saved" : "Save"}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.muted}>Tap for detail</Text>
            )}
          </View>
          <FlatList
            contentContainerStyle={styles.stopsListContent}
            data={candidates}
            keyExtractor={stopKeyExtractor}
            renderItem={renderStopItem}
            showsVerticalScrollIndicator
            style={styles.stopsList}
          />
        </>
      ) : null}
    </>
  );
}

function PlanStopRow({
  item,
  onSelectStation,
  selected,
}: {
  item: StationViewModel;
  onSelectStation: (stationCode: string) => void;
  selected: boolean;
}) {
  const handlePress = useCallback(
    () => onSelectStation(item.station.stationCode),
    [item.station.stationCode, onSelectStation],
  );
  return <StationRow item={item} selected={selected} onPress={handlePress} />;
}

function openPlanStationDirections(
  station: StationViewModel,
  navigationApp: NavigationAppPreference,
  routeEndpoints?: { from: MapPoint; to: MapPoint },
) {
  if (routeEndpoints) {
    return openRouteDirectionsViaStop({
      destination: routeEndpoints.to,
      navigationApp,
      origin: routeEndpoints.from,
      stop: {
        lat: station.station.lat,
        lon: station.station.lon,
        label: station.station.address || station.station.name,
      },
    });
  }
  return openDirections(station.station.lat, station.station.lon, station.station.address || station.station.name, navigationApp);
}

function RouteFollowUpPrompt({
  currentRouteSaved,
  onSaveCommute,
  onWatchRoute,
  routeEndpointsPresent,
  hideSavePrompt = false,
  watchRouteDisabled,
  watchRouteEnabled,
}: {
  currentRouteSaved: boolean;
  onSaveCommute: () => void;
  onWatchRoute?: () => void;
  routeEndpointsPresent: boolean;
  hideSavePrompt?: boolean;
  watchRouteDisabled: boolean;
  watchRouteEnabled: boolean;
}) {
  if (!routeEndpointsPresent) return null;
  if (hideSavePrompt) return null;
  if (!currentRouteSaved) {
    return (
      <View style={styles.followUpCard}>
        <View style={styles.followUpCopy}>
          <Text style={styles.followUpTitle}>Save this commute</Text>
          <Text style={styles.followUpText}>
            Keep this route ready for repeat checks. Saved routes stay on this device and will not move to a new phone or return after deleting the app.
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Save this commute"
          accessibilityRole="button"
          onPress={onSaveCommute}
          style={styles.followUpButton}
        >
          <Text style={styles.followUpButtonText}>Save</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.followUpCard}>
      <View style={styles.followUpCopy}>
        <Text style={styles.followUpTitle}>{watchRouteEnabled ? "Watching this route" : "Watch this route"}</Text>
        <Text style={styles.followUpText}>
          {watchRouteEnabled
            ? "Fuel Path will check this saved route under your alert rules."
            : "Get a route check when the saving is worth attention."}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={watchRouteEnabled ? "Route already being watched" : "Watch this route"}
        accessibilityRole="button"
        accessibilityState={{ disabled: watchRouteDisabled || watchRouteEnabled }}
        disabled={watchRouteDisabled || watchRouteEnabled || !onWatchRoute}
        onPress={onWatchRoute}
        style={[
          styles.followUpButton,
          watchRouteEnabled && styles.followUpButtonDone,
          (watchRouteDisabled || watchRouteEnabled || !onWatchRoute) && styles.followUpButtonDisabled,
        ]}
      >
        <Text style={styles.followUpButtonText}>{watchRouteEnabled ? "Watching" : watchRouteDisabled ? "Saving" : "Watch"}</Text>
      </Pressable>
    </View>
  );
}

function DiscountEligibilityCard({
  summary,
}: {
  summary: ReturnType<typeof discountEligibilitySummary> | null;
}) {
  if (!summary) return null;

  return (
    <View style={styles.eligibilityCard}>
      <Text style={styles.eligibilityTitle}>Eligibility before you go</Text>
      {summary.lines.map((line) => (
        <Text key={line} style={styles.eligibilityLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function discountEligibilitySummary(best: StationViewModel, policyActive: boolean) {
  const lines = [];
  const chips: { label: string; tone?: "caution" }[] = [];
  if (best.discountCpl > 0 && best.discountLabel) {
    lines.push(`Selected discount applied: ${best.discountLabel}.`);
    chips.push({ label: "Selected discount" });
  } else {
    lines.push("Pump price only. No selected discount is applied.");
    chips.push({ label: "Pump price only" });
  }
  if (best.station.membershipRequired) {
    lines.push("Membership or app access may be required at this stop.");
    chips.push({ label: "Membership needed", tone: "caution" });
  }
  if (best.possibleLowerDisclosure || best.possibleLowerLabel || best.possibleLowerCpl) {
    lines.push(
      best.possibleLowerDisclosure ||
        `A lower ${best.possibleLowerLabel || "discount"} price may exist, but it is not applied unless selected and eligible.`,
    );
    chips.push({ label: "Lower price may need app", tone: "caution" });
  }
  if (policyActive) {
    lines.push("Policy mode is limiting recommendations to approved brands.");
    chips.push({ label: "Policy limited", tone: "caution" });
  }
  return { chips, lines };
}

function priceSavingCpl(item: StationViewModel) {
  return Math.max(0, Number(item.pumpCpl || 0) - Number(item.adjustedCpl || 0));
}

function routeSavingCpl(item: StationViewModel, decisionSummary?: ScoreResponse["context"]["decisionSummary"]) {
  const routeComparisonCpl = Number(decisionSummary?.economics?.comparisonCpl);
  if (Number.isFinite(routeComparisonCpl) && routeComparisonCpl > 0) {
    return Math.max(0, routeComparisonCpl - Number(item.adjustedCpl || 0));
  }
  return priceSavingCpl(item);
}

function recommendationTitle(fallback: string | undefined, savingCpl: number) {
  void savingCpl;
  if (fallback && /wait|range|skip/i.test(fallback)) return fallback;
  return "Best stop for this trip";
}

function routeRecommendationSummary(
  item: StationViewModel,
  copy: { title: string; reason: string } | null,
  recommendationSavingCpl: number,
  decisionSummary?: ScoreResponse["context"]["decisionSummary"],
) {
  const title = recommendationTitle(copy?.title, recommendationSavingCpl);
  const detourPhrase = routeDetourSummaryPhrase(
    routeDetourEvidenceLine(item, decisionSummary?.economics?.detourMinutes),
  );
  if (recommendationSavingCpl > 0.05) {
    return {
      title,
      body: `Saves ${recommendationSavingCpl.toFixed(1)} c/L on this trip with a ${detourPhrase}.`,
    };
  }
  return {
    title,
    body: `Best route value found with a ${detourPhrase}.`,
  };
}

function routeDetourSummaryPhrase(detourLine: string) {
  const checked = detourLine.match(/^Detour checked:\s*(.+)$/i);
  if (checked) return `${checked[1].toLowerCase()} checked detour`;
  const estimated = detourLine.match(/^Estimated detour:\s*(.+)$/i);
  if (estimated) return `${estimated[1].toLowerCase()} estimated detour`;
  return `${detourLine.toLowerCase()} detour`;
}

function capabilityLabelForPlan(capability: string) {
  if (capability === "live") return "Live data";
  if (capability === "limited") return "Limited data";
  if (capability === "pending_access") return "Prices not enabled";
  if (capability === "fallback") return "Fallback data";
  if (capability === "unsupported") return "Not covered yet";
  return "Data check";
}

function EvRoutePlanPanel({
  chargers,
  context,
  error,
  loading,
  navigationApp,
  onSelectCharger,
  selectedChargerId,
  vehicleEnergyType,
}: {
  chargers: EvCharger[];
  context?: EvChargerResponse["context"] | null;
  error: string;
  loading: boolean;
  navigationApp: NavigationAppPreference;
  onSelectCharger?: (chargerId: string) => void;
  selectedChargerId?: string;
  vehicleEnergyType: VehicleEnergyType;
}) {
  if (loading) {
    return <Text style={styles.fallbackMeta}>Looking for compatible route chargers...</Text>;
  }
  const routeTitle = evRouteTitle();
  const routeMeta = evRouteMeta(context, vehicleEnergyType);
  const selectedCharger = chargers.find((charger) => charger.id === selectedChargerId);
  const missingConnectorFilters = !Array.isArray(context?.filters?.connectors) ||
    context.filters.connectors.length === 0;
  const visibleLimit = 1;
  const visibleChargers = selectedCharger
    ? [selectedCharger, ...chargers.filter((charger) => charger.id !== selectedCharger.id)].slice(0, visibleLimit + 1)
    : chargers.slice(0, visibleLimit);
  const hiddenChargerCount = Math.max(0, chargers.length - visibleChargers.length);
  if (error) {
    return (
      <View style={styles.evPlanCard}>
        <Text style={styles.evPlanTitle}>{routeTitle}</Text>
        <Text style={styles.fallbackMeta}>{routeMeta}</Text>
        <Text style={styles.fallbackTrust}>Use Nearby EV charging or your network app before driving.</Text>
      </View>
    );
  }
  return (
    <View style={styles.fallbackPanel}>
      <View style={styles.sheetHeaderRow}>
        <Text style={styles.evPlanTitle}>{routeTitle}</Text>
        <View style={styles.fallbackBadgeRow}>
          {chargers.length ? (
            <Text style={styles.fallbackBadge}>{chargers.length} option{chargers.length === 1 ? "" : "s"}</Text>
          ) : (
            <Text style={styles.fallbackBadge}>None found</Text>
          )}
        </View>
      </View>
      <Text style={styles.fallbackMeta}>{routeMeta}</Text>
      {missingConnectorFilters ? (
        <Text style={styles.fallbackConnectorWarning}>Set your EV connectors in Settings for better matching.</Text>
      ) : null}
      {!chargers.length ? (
        <Text style={styles.fallbackMeta}>No charger rows came back for this route. Try Nearby EV charging or clear connector filters.</Text>
      ) : null}
      {visibleChargers.map((charger) => {
        const selected = charger.id === selectedChargerId;
        return (
        <Pressable
          accessibilityLabel={`Select ${charger.name}`}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          key={charger.id}
          onPress={() => onSelectCharger?.(charger.id)}
          style={[styles.fallbackRow, selected && styles.fallbackRowSelected]}
        >
          <View style={styles.fallbackPowerTile}>
            {charger.maxPowerKw ? (
              <>
                <Text style={styles.fallbackPowerValue}>{Math.round(charger.maxPowerKw)}</Text>
                <Text style={styles.fallbackPowerUnit}>kW</Text>
              </>
            ) : (
              <>
                <Text style={styles.fallbackPowerUnknown}>Power</Text>
                <Text style={styles.fallbackPowerUnit}>unknown</Text>
              </>
            )}
          </View>
          <View style={styles.fallbackMain}>
            <Text numberOfLines={1} style={styles.fallbackName}>{charger.name}</Text>
            <Text numberOfLines={1} style={styles.fallbackMeta}>
              {chargerLocationLabel(charger)}
            </Text>
            <Text numberOfLines={1} style={styles.fallbackConnectorLine}>
              {chargerConnectorSummary(charger)}
            </Text>
            <Text numberOfLines={1} style={styles.fallbackDistanceLine}>
              {chargerRouteDistanceLabel(charger)}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={`Navigate to ${charger.name}`}
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation();
              openDirections(charger.lat, charger.lon, charger.address || charger.name, navigationApp);
            }}
            style={styles.fallbackNavigateButton}
          >
            <Text style={styles.fallbackNavigateText}>↗</Text>
          </Pressable>
        </Pressable>
        );
      })}
      {hiddenChargerCount ? (
        <Text style={styles.fallbackMeta}>+{hiddenChargerCount} more shown on the map.</Text>
      ) : null}
    </View>
  );
}

function evRouteTitle() {
  return "Route charger options";
}

function evRouteMeta(context?: EvChargerResponse["context"] | null, vehicleEnergyType?: VehicleEnergyType) {
  const routeKm = Number(context?.routeDistanceKm || 0);
  const rangeKm = Number(context?.selectedRangeKm || 0);
  const count = Number(context?.chargerCount || 0);
  const parts = [];
  if (routeKm) parts.push(`${Math.round(routeKm)} km route`);
  if (rangeKm) parts.push(`${Math.round(rangeKm)} km selected range`);
  if (!parts.length) return count ? `${count} charger option${count === 1 ? "" : "s"}` : "No charger options returned";
  return parts.join(". ");
}

function chargerConnectorSummary(charger: EvCharger) {
  if (charger.connectors.length) return charger.connectors.join(" | ");
  const labels = charger.connections
    .flatMap((connection) => connection.connectorLabel ? [connection.connectorLabel] : [])
    .slice(0, 2);
  return labels.length ? labels.join(" | ") : "Connector unknown";
}

function chargerLocationLabel(charger: EvCharger) {
  return charger.address || charger.operator || "Location details unknown";
}

function chargerRouteDistanceLabel(charger: EvCharger) {
  const routeDistance = charger.routeDistanceKm;
  const detourDistance = charger.routeDetourDistanceKm;
  if (typeof routeDistance === "number" && Number.isFinite(routeDistance)) {
    const minutes = charger.routeDetourMinutes;
    const timeLabel = typeof minutes === "number" && Number.isFinite(minutes)
      ? charger.routeDetourSource === "route_engine"
        ? `, est ${minutes} min return`
        : `, rough ${minutes} min return`
      : "";
    const distanceLabel = typeof detourDistance === "number" && Number.isFinite(detourDistance)
      ? `est ${detourDistance.toFixed(1)} km detour`
      : `approx ${routeDistance.toFixed(1)} km off route`;
    if (Number(detourDistance || routeDistance) < 0.05) return "At route point";
    return `${distanceLabel}${timeLabel}`;
  }
  if (Number(charger.distanceKm) < 0.05) return "Here";
  return `${charger.distanceKm.toFixed(1)} km from sampled route point`;
}

const styles = StyleSheet.create({
  sheet: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.control,
    bottom: spacing.sm,
    gap: spacing.sm,
    left: spacing.md,
    padding: spacing.md,
    position: "absolute",
    right: spacing.md,
    zIndex: 6,
  },
  resultsSheet: {
    maxHeight: 430,
  },
  stationSheet: {
    maxHeight: 430,
  },
  sheetMinimised: {
    gap: 0,
    height: 62,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  sheetTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 24,
  },
  minimisedSheetRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 42,
  },
  minimisedSheetText: {
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    width: 44,
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
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  compactRecommendation: {
    alignItems: "stretch",
    ...surfaces.softPanel,
    borderRadius: radii.lg,
    gap: spacing.sm,
    minHeight: 132,
    padding: spacing.sm,
  },
  recommendationSummary: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: 2,
    paddingBottom: spacing.xs,
  },
  recommendationSummaryTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "800",
    lineHeight: 20,
  },
  recommendationSummaryText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "600",
    lineHeight: 17,
  },
  recommendationBodyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  recommendationMainButton: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minWidth: 0,
  },
  noticeCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeText: {
    color: colors.amber,
    fontSize: typeScale.caption,
    fontWeight: "500",
  },
  eligibilityCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  eligibilityTitle: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  eligibilityLine: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
  },
  recommendationCopy: {
    flex: 1,
    minWidth: 0,
  },
  recommendationPriceTile: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radii.md,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 74,
    width: 80,
  },
  recommendationPriceValue: {
    color: colors.greenDark,
    fontSize: typeScale.title,
    fontWeight: "900",
    lineHeight: 28,
  },
  recommendationFuelLabel: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    lineHeight: 16,
    textTransform: "uppercase",
  },
  recommendationStationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: 2,
    minWidth: 0,
  },
  recommendationStationName: {
    ...typography.bodyStrong,
    flex: 1,
    minWidth: 0,
  },
  compactDecisionTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "700",
    marginTop: 2,
  },
  compactSavingLine: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "700",
    marginTop: 2,
  },
  compactDetourLine: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1,
  },
  compactChipRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: spacing.xs,
  },
  compactChip: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  compactChipCaution: {
    backgroundColor: colors.amberSoft,
    color: colors.amber,
  },
  compactActionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 30,
  },
  expandedEvidenceScroll: {
    maxHeight: 220,
  },
  expandedEvidenceContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  secondaryActionButton: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    minHeight: 0,
    minWidth: 74,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
  secondaryActionButtonDisabled: {
    opacity: 0.7,
  },
  secondaryActionText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  emptyRouteState: {
    ...surfaces.softPanel,
    borderRadius: radii.xl,
    gap: spacing.xs,
    padding: spacing.md,
  },
  fallbackPanel: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  evPlanCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  evPlanTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  fallbackTitle: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  fallbackBadge: {
    backgroundColor: colors.blueSoft,
    borderRadius: radii.pill,
    color: colors.blue,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  fallbackBadgeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  fallbackCautionBadge: {
    backgroundColor: colors.amberSoft,
    borderRadius: radii.pill,
    color: colors.amber,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  fallbackRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.xs,
  },
  fallbackRowSelected: {
    borderColor: colors.green,
    borderWidth: 2,
  },
  fallbackPowerTile: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.sm,
    justifyContent: "center",
    minHeight: 44,
    width: 52,
  },
  fallbackPowerValue: {
    color: colors.blue,
    fontSize: typeScale.body,
    fontWeight: "900",
    lineHeight: 18,
  },
  fallbackPowerUnknown: {
    color: colors.blue,
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 12,
    textTransform: "uppercase",
  },
  fallbackPowerUnit: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
  },
  fallbackMain: {
    flex: 1,
    minWidth: 0,
  },
  fallbackName: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  fallbackMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
    lineHeight: 17,
  },
  fallbackConnectorLine: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1,
  },
  fallbackDistanceLine: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1,
  },
  fallbackConnectorWarning: {
    backgroundColor: colors.amberSoft,
    borderRadius: radii.md,
    color: colors.amber,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  fallbackNavigateButton: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  fallbackNavigateText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },
  fallbackTrust: {
    color: colors.amber,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },
  recommendationRouteValue: {
    alignItems: "center",
    flexShrink: 0,
    gap: 3,
    minWidth: 48,
  },
  recommendationMetricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    textTransform: "uppercase",
  },
  recommendationMetricValue: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 16,
  },
  recommendationSavingSource: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
    maxWidth: 76,
    textAlign: "center",
  },
  recommendationDetourPill: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  recommendationDetourText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
  recommendationNavigateButton: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  recommendationNavigateText: {
    color: colors.white,
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 22,
  },
  sheetHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  textButton: {
    backgroundColor: colors.panel,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  textButtonDisabled: {
    opacity: 0.58,
  },
  textButtonLabel: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  stopsList: {
    flex: 1,
  },
  stopsListContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  stationDetailPanel: {
    gap: spacing.sm,
  },
  stationFacts: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  factPill: {
    backgroundColor: colors.panelStrong,
    borderRadius: radii.lg,
    flex: 1,
    padding: spacing.sm,
  },
  factLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  factValue: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "600",
    marginTop: 2,
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  decisionTitle: {
    ...typography.title,
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
  },
  selectedTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "600",
  },
  recommendationTomorrowPrice: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
    maxWidth: 96,
  },
  followUpCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  followUpCopy: {
    flex: 1,
    minWidth: 0,
  },
  followUpTitle: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  followUpText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
    marginTop: 2,
  },
  followUpButton: {
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    minWidth: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  followUpButtonDone: {
    backgroundColor: colors.greenDark,
  },
  followUpButtonDisabled: {
    opacity: 0.72,
  },
  followUpButtonText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "800",
    textAlign: "center",
  },
  tomorrowPriceDown: { color: colors.greenDark },
  tomorrowPriceUp: { color: colors.amber },
  eyebrow: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
});
