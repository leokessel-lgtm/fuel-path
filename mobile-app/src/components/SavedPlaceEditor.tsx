import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { searchLocations } from "../api/fuelPathApi";
import { getCurrentMapPoint } from "../services/currentLocation";
import { colors, radii, spacing, surfaces, typeScale } from "../theme";
import { MapPoint } from "../types";
import { LocationEvidenceChip } from "./LocationEvidenceChip";
import { StationMap } from "./StationMap";

export function SavedPlaceEditor({
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
    <View style={styles.editor}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label.slice(0, 1)}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.label}>{label}</Text>
          <Text numberOfLines={1} style={styles.value}>
            {point ? point.label : "Not set"}
          </Text>
        </View>
        {point ? (
          <Pressable
            accessibilityLabel={`Clear ${label.toLowerCase()} location`}
            accessibilityHint={`Removes the saved ${label.toLowerCase()} shortcut.`}
            accessibilityRole="button"
            onPress={clearPlace}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={`Search ${label.toLowerCase()} address or place`}
          accessibilityHint={`Type a ${label.toLowerCase()} address, suburb or place and choose a suggestion.`}
          onChangeText={(value) => {
            setQuery(value);
            setMessage("");
          }}
          placeholder={`${label} address or place`}
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
        {loading ? <ActivityIndicator color={colors.green} /> : null}
      </View>

      {suggestions.length ? (
        <View style={styles.suggestionList}>
          {suggestions.map((suggestion) => (
            <Pressable
              accessibilityLabel={`Save ${suggestion.label} as ${label.toLowerCase()}`}
              accessibilityHint={`Sets this location as ${label.toLowerCase()}.`}
              accessibilityRole="button"
              key={`${kind}:${suggestion.lat}:${suggestion.lon}:${suggestion.label}`}
              onPress={() => savePoint(suggestion)}
              style={({ pressed }) => [
                styles.suggestion,
                pressed && styles.suggestionPressed,
              ]}
            >
              <Text numberOfLines={1} style={styles.suggestionTitle}>
                {shortPlaceTitle(suggestion)}
              </Text>
              <Text numberOfLines={1} style={styles.suggestionMeta}>
                {shortPlaceMeta(suggestion)}
              </Text>
              <View style={styles.suggestionEvidence}>
                <LocationEvidenceChip
                  point={suggestion}
                  showDetail={suggestionNeedsPrecisionDetail(suggestion)}
                />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {mapDraft ? (
        <View style={styles.mapBox}>
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
            style={styles.mapButton}
          >
            <Text style={styles.mapButtonText}>Save map centre</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable
          accessibilityLabel={`Use current location for ${label.toLowerCase()}`}
          accessibilityHint={`Requests location permission and saves the current position as ${label.toLowerCase()}.`}
          accessibilityRole="button"
          accessibilityState={{ disabled: locating }}
          disabled={locating}
          onPress={useCurrentLocation}
          style={[styles.miniButton, locating && styles.miniButtonDisabled]}
        >
          <Text style={styles.miniButtonText}>
            {locating ? "Locating" : "Current location"}
          </Text>
        </Pressable>
      </View>
      {message ? (
        <Text accessibilityLiveRegion="polite" numberOfLines={2} style={styles.message}>
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

function suggestionNeedsPrecisionDetail(point: MapPoint) {
  return point.sourceLabel === "Needs confirmation" ||
    point.sourceLabel === "Street/road" ||
    point.sourceLabel === "Near address match";
}

const styles = StyleSheet.create({
  editor: {
    ...surfaces.softPanel,
    borderRadius: radii.xl,
    gap: spacing.md,
    padding: spacing.md,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 44,
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  badgeText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "600",
  },
  value: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    marginTop: 2,
  },
  clearButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  clearButtonText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
  },
  inputRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.body,
    fontWeight: "500",
    minHeight: 44,
    minWidth: 0,
  },
  suggestionList: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  suggestion: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionPressed: {
    backgroundColor: colors.greenSoft,
  },
  suggestionTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "600",
  },
  suggestionMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    marginTop: 2,
  },
  suggestionEvidence: {
    marginTop: spacing.xs,
  },
  mapBox: {
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 220,
    overflow: "hidden",
  },
  mapButton: {
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
  mapButtonText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "600",
    lineHeight: 38,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  miniButton: {
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
  miniButtonDisabled: {
    opacity: 0.65,
  },
  miniButtonText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  message: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
});
