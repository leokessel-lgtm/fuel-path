import { useEffect, useReducer, useRef, useState } from "react";
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
import { userVisibleErrorMessage } from "../utils/userVisibleErrors";
import { CurrentLocationFieldButton, currentLocationFieldInset } from "./CurrentLocationFieldButton";
import { LocationEvidenceChip } from "./LocationEvidenceChip";
import { StationMap } from "./StationMap";

type SavedPlaceEditorProps = {
  kind: "home" | "work";
  label: string;
  onClear: () => void;
  onSave: (point: MapPoint) => void;
  point?: MapPoint;
};

type EditorState = {
  loading: boolean;
  mapDraft?: MapPoint;
  message: string;
  query: string;
  suggestions: MapPoint[];
};

type EditorAction =
  | { type: "clear"; label: string }
  | { type: "map-draft"; label: string; point: MapPoint }
  | { type: "query"; query: string }
  | { type: "saved"; label: string; point: MapPoint }
  | { type: "search-error"; message: string }
  | { type: "search-clear" }
  | { type: "search-idle" }
  | { type: "search-loading" }
  | { type: "search-results"; suggestions: MapPoint[] };

export function SavedPlaceEditor(props: SavedPlaceEditorProps) {
  return (
    <SavedPlaceEditorFields
      {...props}
      key={`${props.kind}:${props.point?.lat || ""}:${props.point?.lon || ""}:${props.point?.label || ""}`}
    />
  );
}

function SavedPlaceEditorFields({
  kind,
  label,
  onClear,
  onSave,
  point,
}: SavedPlaceEditorProps) {
  const [editor, dispatchEditor] = useReducer(editorReducer, point, initialEditorState);
  const [locating, setLocating] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);

  if (!sessionTokenRef.current) {
    sessionTokenRef.current = makeLocationSessionToken();
  }

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const updateQuery = (value: string) => {
    const trimmed = value.trim();
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    dispatchEditor({ type: "query", query: value });
    if (trimmed.length < 3 || trimmed === point?.label) {
      dispatchEditor({ type: "search-clear" });
      return;
    }
    dispatchEditor({ type: "search-loading" });
    searchTimerRef.current = setTimeout(() => {
      searchLocations(trimmed, 4, sessionTokenRef.current || "")
        .then((results) => {
          if (searchRequestRef.current === requestId) dispatchEditor({ type: "search-results", suggestions: results });
        })
        .catch((err: Error) => {
          if (searchRequestRef.current !== requestId) return;
          dispatchEditor({ type: "search-error", message: userVisibleErrorMessage(err, "address") });
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) dispatchEditor({ type: "search-idle" });
        });
    }, 550);
  };

  const savePoint = (nextPoint: MapPoint) => {
    searchRequestRef.current += 1;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    onSave(nextPoint);
    dispatchEditor({ type: "saved", label, point: nextPoint });
    sessionTokenRef.current = makeLocationSessionToken();
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    dispatchEditor({ type: "search-clear" });
    try {
      const nextPoint = await getCurrentMapPoint(`${label} location`);
      savePoint(nextPoint);
    } catch (err) {
      dispatchEditor({
        type: "search-error",
        message: userVisibleErrorMessage(err, "current_location"),
      });
    } finally {
      setLocating(false);
    }
  };

  const clearPlace = () => {
    searchRequestRef.current += 1;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    onClear();
    dispatchEditor({ type: "clear", label });
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
            updateQuery(value);
          }}
          placeholder={`${label} address or place`}
          returnKeyType="search"
          style={[styles.input, editor.loading && styles.inputWithLoading]}
          value={editor.query}
        />
        {editor.loading ? <ActivityIndicator color={colors.green} style={styles.lookupSpinner} /> : null}
        <CurrentLocationFieldButton
          accessibilityHint={`Requests location permission and saves the current position as ${label.toLowerCase()}.`}
          accessibilityLabel={`Use current location for ${label.toLowerCase()}`}
          disabled={locating}
          onPress={useCurrentLocation}
        />
      </View>

      {editor.suggestions.length ? (
        <View style={styles.suggestionList}>
          {editor.suggestions.map((suggestion) => (
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

      {editor.mapDraft ? (
        <View style={styles.mapBox}>
          <StationMap
            centre={editor.mapDraft}
            onMapSearchAreaChange={({ centre }) => {
              dispatchEditor({
                type: "map-draft",
                label,
                point: {
                  ...centre,
                  label: `${label} map centre`,
                  type: "map_refine",
                },
              });
            }}
            onSelect={() => {}}
            stations={[]}
          />
          <Pressable
            accessibilityLabel={`Save refined ${label.toLowerCase()} map centre`}
            accessibilityHint={`Saves the current map centre as ${label.toLowerCase()}.`}
            accessibilityRole="button"
            onPress={() => {
              if (editor.mapDraft) savePoint(editor.mapDraft);
            }}
            style={styles.mapButton}
          >
            <Text style={styles.mapButtonText}>Save map centre</Text>
          </Pressable>
        </View>
      ) : null}

      {editor.message ? (
        <Text accessibilityLiveRegion="polite" numberOfLines={2} style={styles.message}>
          {editor.message}
        </Text>
      ) : null}
    </View>
  );
}

function initialEditorState(point?: MapPoint): EditorState {
  return {
    loading: false,
    mapDraft: point,
    message: "",
    query: point?.label || "",
    suggestions: [],
  };
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "clear":
      return { loading: false, mapDraft: undefined, message: `${action.label} cleared.`, query: "", suggestions: [] };
    case "map-draft":
      return { ...state, mapDraft: action.point, message: "Move the map, then save the refined centre." };
    case "query":
      return { ...state, message: "", query: action.query };
    case "saved":
      return {
        loading: false,
        mapDraft: action.point,
        message: `${action.label} saved.`,
        query: action.point.label,
        suggestions: [],
      };
    case "search-error":
      return { ...state, loading: false, message: action.message, suggestions: [] };
    case "search-clear":
      return { ...state, loading: false, suggestions: [] };
    case "search-idle":
      return { ...state, loading: false };
    case "search-loading":
      return { ...state, loading: true, message: "" };
    case "search-results":
      return { ...state, suggestions: action.suggestions };
    default:
      return state;
  }
}

function makeLocationSessionToken() {
  return `fp-place-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function shortPlaceTitle(point: MapPoint) {
  return point.label.split(",")[0]?.trim() || point.label;
}

function shortPlaceMeta(point: MapPoint) {
  const parts = point.label.split(",").flatMap((part) => {
    const trimmed = part.trim();
    return trimmed ? [trimmed] : [];
  });
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
    justifyContent: "center",
    position: "relative",
  },
  input: {
    ...surfaces.field,
    borderRadius: radii.lg,
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "500",
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    paddingRight: currentLocationFieldInset,
    paddingVertical: spacing.sm,
  },
  inputWithLoading: {
    paddingRight: currentLocationFieldInset + 28,
  },
  lookupSpinner: {
    position: "absolute",
    right: currentLocationFieldInset,
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
  message: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
});
