import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FuelSelector } from "../components/FuelSelector";
import { StationMap } from "../components/StationMap";
import { searchLocations } from "../api/fuelPathApi";
import { discountPrograms } from "../data/discountPrograms";
import { getCurrentMapPoint } from "../services/currentLocation";
import { colors, radii, shadow, spacing, typeScale } from "../theme";
import {
  AppPreferences,
  FuelCode,
  MapPoint,
  NotificationPermissionState,
  SavedCommute,
} from "../types";
import { alertGateSummary, commuteAlertRuleLine } from "../utils/decisionEvidence";

export function AccountScreen({
  alertSyncingCommuteId,
  notificationMessage,
  notificationPermission,
  savedCommutes,
  preferences,
  onFuelChange,
  onClearNamedPlace,
  onRequestNotifications,
  onSaveNamedPlace,
  onToggleCommuteAlert,
  onToggleDiscount,
}: {
  alertSyncingCommuteId: string | null;
  notificationMessage: string;
  notificationPermission: NotificationPermissionState;
  savedCommutes: SavedCommute[];
  preferences: AppPreferences;
  onFuelChange: (fuel: FuelCode) => void;
  onClearNamedPlace: (kind: "home" | "work") => void;
  onRequestNotifications: () => void;
  onSaveNamedPlace: (kind: "home" | "work", point: MapPoint) => void;
  onToggleCommuteAlert: (commuteId: string) => void;
  onToggleDiscount: (discountId: string) => void;
}) {
  const notificationsReady = notificationPermission === "granted";
  const notificationButtonLabel = notificationsReady
    ? "Alerts enabled"
    : notificationPermission === "unavailable"
      ? "Check device support"
      : "Enable route alerts";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Vehicle</Text>
        <Text style={styles.title}>{preferences.vehicleName}</Text>
        <Text style={styles.muted}>Registration {preferences.vehicleRego} | Demo profile</Text>
        <FuelSelector value={preferences.fuel} onChange={onFuelChange} />
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Saved places</Text>
        <Text style={styles.title}>Home and work</Text>
        <Text style={styles.muted}>
          Set these once, then use them as shortcuts in Plan Trip.
        </Text>
        <SavedPlaceEditor
          kind="home"
          label="Home"
          onClear={() => onClearNamedPlace("home")}
          onSave={(point) => onSaveNamedPlace("home", point)}
          point={preferences.homeLocation}
        />
        <SavedPlaceEditor
          kind="work"
          label="Work"
          onClear={() => onClearNamedPlace("work")}
          onSave={(point) => onSaveNamedPlace("work", point)}
          point={preferences.workLocation}
        />
        {savedCommutes.length ? (
          <View style={styles.savedPlaceActions}>
            {savedCommutes.slice(0, 3).map((commute) => (
              <View key={commute.id} style={styles.savedPlaceCommute}>
                <Text numberOfLines={1} style={styles.savedPlaceCommuteTitle}>
                  {commute.name}
                </Text>
                <View style={styles.savedPlaceButtonRow}>
                  <Pressable
                    accessibilityLabel={`Save ${commute.from.label} as home`}
                    accessibilityRole="button"
                    onPress={() => onSaveNamedPlace("home", commute.from)}
                    style={styles.savedPlaceMiniButton}
                  >
                    <Text style={styles.savedPlaceMiniButtonText}>Home</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Save ${commute.to.label} as work`}
                    accessibilityRole="button"
                    onPress={() => onSaveNamedPlace("work", commute.to)}
                    style={styles.savedPlaceMiniButton}
                  >
                    <Text style={styles.savedPlaceMiniButtonText}>Work</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Discount wallet</Text>
        <Text style={styles.title}>Your real price</Text>
        <Text style={styles.muted}>
          Select the programs you actually use. The app keeps pump price visible beside
          adjusted price.
        </Text>
        <View style={styles.discountList}>
          {discountPrograms.map((program) => {
            const selected = preferences.selectedDiscounts.includes(program.id);
            return (
              <Pressable
                key={program.id}
                onPress={() => onToggleDiscount(program.id)}
                style={[styles.discountRow, selected && styles.discountRowSelected]}
              >
                <View>
                  <Text style={styles.discountName}>{program.shortLabel}</Text>
                  <Text style={styles.muted}>{program.centsPerLitre.toFixed(0)} c/L guide</Text>
                </View>
                <Text style={[styles.discountState, selected && styles.discountStateSelected]}>
                  {selected ? "On" : "Off"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Notifications</Text>
        <Text style={styles.title}>Saved route alerts</Text>
        <Text style={styles.muted}>{notificationMessage}</Text>
        <View style={styles.ruleCard}>
          <Text style={styles.ruleTitle}>Alert rule</Text>
          <Text style={styles.ruleText}>{alertGateSummary(notificationPermission)}</Text>
        </View>
        <Pressable
          accessibilityLabel={notificationButtonLabel}
          accessibilityRole="button"
          disabled={notificationsReady}
          onPress={onRequestNotifications}
          style={[styles.notificationButton, notificationsReady && styles.notificationButtonDisabled]}
        >
          <Text style={styles.notificationButtonText}>{notificationButtonLabel}</Text>
        </Pressable>

        {savedCommutes.length ? (
          <View style={styles.alertList}>
            {savedCommutes.map((commute) => (
              <Pressable
                accessibilityLabel={`${commute.alertEnabled ? "Disable" : "Enable"} ${commute.name} route alert`}
                accessibilityRole="switch"
                accessibilityState={{ checked: commute.alertEnabled }}
                disabled={alertSyncingCommuteId === commute.id}
                key={commute.id}
                onPress={() => onToggleCommuteAlert(commute.id)}
                style={[
                  styles.alertRow,
                  alertSyncingCommuteId === commute.id && styles.alertRowDisabled,
                ]}
              >
                <View style={styles.alertCopy}>
                  <Text numberOfLines={1} style={styles.alertName}>
                    {commute.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.alertMeta}>
                    {commute.fuel} | Daily check {commute.alertTime}
                  </Text>
                  {commute.alertStatusMessage ? (
                    <Text numberOfLines={2} style={styles.alertStatusMessage}>
                      {commute.alertStatusMessage}
                    </Text>
                  ) : null}
                  <Text numberOfLines={2} style={styles.alertRuleLine}>
                    {commuteAlertRuleLine(commute)}
                  </Text>
                  {commute.backendSyncedAt ? (
                    <Text numberOfLines={1} style={styles.alertMeta}>
                      Synced {formatAlertTimestamp(commute.backendSyncedAt)}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.alertState, commute.alertEnabled && styles.alertStateOn]}>
                  {alertSyncingCommuteId === commute.id
                    ? "Saving"
                    : commute.alertEnabled
                      ? "On"
                      : "Off"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyAlert}>
            <Text style={styles.emptyAlertText}>
              Save a route from Plan Trip to create commute alerts.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SavedPlaceEditor({
  kind,
  label,
  onClear,
  onSave,
  point,
}: {
  kind: "home" | "work";
  label: string;
  onClear: () => void;
  onSave: (point: MapPoint) => void;
  point?: MapPoint;
}) {
  const [query, setQuery] = useState(point?.label || "");
  const [suggestions, setSuggestions] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapDraft, setMapDraft] = useState<MapPoint | undefined>(point);
  const [message, setMessage] = useState("");
  const sessionTokenRef = useRef(makeLocationSessionToken());

  useEffect(() => {
    setQuery(point?.label || "");
    setMapDraft(point);
  }, [point]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3 || trimmed === point?.label) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setMessage("");
    const timer = setTimeout(() => {
      searchLocations(trimmed, 4, sessionTokenRef.current)
        .then((results) => {
          if (!active) return;
          setSuggestions(results);
        })
        .catch((err: Error) => {
          if (!active) return;
          setSuggestions([]);
          setMessage(err.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 550);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [point?.label, query]);

  const savePoint = (nextPoint: MapPoint) => {
    onSave(nextPoint);
    setQuery(nextPoint.label);
    setMapDraft(nextPoint);
    setSuggestions([]);
    setMessage(`${label} saved.`);
    sessionTokenRef.current = makeLocationSessionToken();
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setMessage("");
    try {
      const nextPoint = await getCurrentMapPoint(`${label} location`);
      savePoint(nextPoint);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Current location is not available.");
    } finally {
      setLocating(false);
    }
  };

  const clearPlace = () => {
    onClear();
    setQuery("");
    setSuggestions([]);
    setMapDraft(undefined);
    setMessage(`${label} cleared.`);
    sessionTokenRef.current = makeLocationSessionToken();
  };

  return (
    <View style={styles.savedPlaceEditor}>
      <View style={styles.savedPlaceHeader}>
        <View style={styles.savedPlaceBadge}>
          <Text style={styles.savedPlaceBadgeText}>{label.slice(0, 1)}</Text>
        </View>
        <View style={styles.savedPlaceCopy}>
          <Text style={styles.savedPlaceLabel}>{label}</Text>
          <Text numberOfLines={1} style={styles.savedPlaceValue}>
            {point ? point.label : "Not set"}
          </Text>
        </View>
        {point ? (
          <Pressable
            accessibilityLabel={`Clear ${label.toLowerCase()} location`}
            accessibilityHint={`Removes the saved ${label.toLowerCase()} shortcut.`}
            accessibilityRole="button"
            onPress={clearPlace}
            style={styles.savedPlaceClearButton}
          >
            <Text style={styles.savedPlaceClearButtonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.savedPlaceInputRow}>
        <TextInput
          accessibilityLabel={`Search ${label.toLowerCase()} address or place`}
          accessibilityHint={`Type a ${label.toLowerCase()} address, suburb or place and choose a suggestion.`}
          onChangeText={(value) => {
            setQuery(value);
            setMessage("");
          }}
          placeholder={`${label} address or place`}
          returnKeyType="search"
          style={styles.savedPlaceInput}
          value={query}
        />
        {loading ? <ActivityIndicator color={colors.green} /> : null}
      </View>

      {suggestions.length ? (
        <View style={styles.savedPlaceSuggestionList}>
          {suggestions.map((suggestion) => (
            <Pressable
              accessibilityLabel={`Save ${suggestion.label} as ${label.toLowerCase()}`}
              accessibilityHint={`Sets this location as ${label.toLowerCase()}.`}
              accessibilityRole="button"
              key={`${kind}:${suggestion.lat}:${suggestion.lon}:${suggestion.label}`}
              onPress={() => savePoint(suggestion)}
              style={({ pressed }) => [
                styles.savedPlaceSuggestion,
                pressed && styles.savedPlaceSuggestionPressed,
              ]}
            >
              <Text numberOfLines={1} style={styles.savedPlaceSuggestionTitle}>
                {shortPlaceTitle(suggestion)}
              </Text>
              <Text numberOfLines={1} style={styles.savedPlaceSuggestionMeta}>
                {shortPlaceMeta(suggestion)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {mapDraft ? (
        <View style={styles.savedPlaceMapBox}>
          <StationMap
            centre={mapDraft}
            onMapSearchAreaChange={({ centre }) => {
              setMapDraft({
                ...centre,
                label: `${label} map centre`,
                type: "map_refine",
              });
              setMessage("Move the map, then save the refined centre.");
            }}
            onSelect={() => {}}
            stations={[]}
          />
          <Pressable
            accessibilityLabel={`Save refined ${label.toLowerCase()} map centre`}
            accessibilityHint={`Saves the current map centre as ${label.toLowerCase()}.`}
            accessibilityRole="button"
            onPress={() => savePoint(mapDraft)}
            style={styles.savedPlaceMapButton}
          >
            <Text style={styles.savedPlaceMapButtonText}>Save map centre</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.savedPlaceButtonRow}>
        <Pressable
          accessibilityLabel={`Use current location for ${label.toLowerCase()}`}
          accessibilityHint={`Requests location permission and saves the current position as ${label.toLowerCase()}.`}
          accessibilityRole="button"
          accessibilityState={{ disabled: locating }}
          disabled={locating}
          onPress={useCurrentLocation}
          style={[styles.savedPlaceMiniButton, locating && styles.savedPlaceMiniButtonDisabled]}
        >
          <Text style={styles.savedPlaceMiniButtonText}>
            {locating ? "Locating" : "Current location"}
          </Text>
        </Pressable>
      </View>
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          numberOfLines={2}
          style={styles.savedPlaceMessage}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function makeLocationSessionToken() {
  return `fp-place-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function shortPlaceTitle(point: MapPoint) {
  return point.label.split(",")[0]?.trim() || point.label;
}

function shortPlaceMeta(point: MapPoint) {
  const parts = point.label.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(1, 4).join(", ") || "Australia";
}

function formatAlertTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "time unknown";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    ...shadow.soft,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    gap: spacing.md,
    padding: spacing.md,
  },
  eyebrow: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    lineHeight: 18,
  },
  discountList: {
    gap: spacing.sm,
  },
  savedPlaceList: {
    gap: spacing.sm,
  },
  savedPlaceEditor: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  savedPlaceHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 44,
  },
  savedPlaceBadge: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  savedPlaceBadgeText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  savedPlaceCopy: {
    flex: 1,
    minWidth: 0,
  },
  savedPlaceLabel: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  savedPlaceValue: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    marginTop: 2,
  },
  savedPlaceClearButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  savedPlaceClearButtonText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  savedPlaceInputRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  savedPlaceInput: {
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.body,
    fontWeight: "800",
    minHeight: 44,
    minWidth: 0,
  },
  savedPlaceSuggestionList: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  savedPlaceSuggestion: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  savedPlaceSuggestionPressed: {
    backgroundColor: colors.greenSoft,
  },
  savedPlaceSuggestionTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  savedPlaceSuggestionMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    marginTop: 2,
  },
  savedPlaceMapBox: {
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 220,
    overflow: "hidden",
  },
  savedPlaceMapButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.white,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    bottom: spacing.md,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    position: "absolute",
  },
  savedPlaceMapButtonText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
    lineHeight: 38,
  },
  savedPlaceActions: {
    gap: spacing.sm,
  },
  savedPlaceCommute: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  savedPlaceCommuteTitle: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  savedPlaceButtonRow: {
    flexWrap: "wrap",
    flexDirection: "row",
    gap: spacing.sm,
  },
  savedPlaceMiniButton: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  savedPlaceMiniButtonDisabled: {
    opacity: 0.65,
  },
  savedPlaceMiniButtonText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  savedPlaceMessage: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "800",
    lineHeight: 18,
  },
  discountRow: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  discountRowSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  discountName: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  discountState: {
    color: colors.muted,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  discountStateSelected: {
    color: colors.greenDark,
  },
  notificationButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
  },
  notificationButtonDisabled: {
    opacity: 0.7,
  },
  notificationButtonText: {
    color: colors.white,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  ruleCard: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  ruleTitle: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  ruleText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "800",
    lineHeight: 18,
  },
  alertList: {
    gap: spacing.sm,
  },
  alertRow: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  alertRowDisabled: {
    opacity: 0.7,
  },
  alertCopy: {
    flex: 1,
    minWidth: 0,
  },
  alertName: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  alertMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    marginTop: 2,
  },
  alertStatusMessage: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    marginTop: spacing.xs,
  },
  alertRuleLine: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    marginTop: spacing.xs,
  },
  alertState: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  alertStateOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    color: colors.greenDark,
  },
  emptyAlert: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  emptyAlertText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    lineHeight: 18,
  },
});
