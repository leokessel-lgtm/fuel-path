import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { MapPoint, SavedCommute } from "../types";
import { SavedPlaceEditor } from "./SavedPlaceEditor";

type PlaceKind = "home" | "work";

export function SavedPlacesCard({
  homeLocation,
  savedCommutes,
  workLocation,
  onClearNamedPlace,
  onRemoveCommute,
  onRenameCommute,
  onSaveNamedPlace,
}: {
  homeLocation?: MapPoint;
  savedCommutes: SavedCommute[];
  workLocation?: MapPoint;
  onClearNamedPlace: (kind: PlaceKind) => void;
  onRemoveCommute: (commuteId: string) => void;
  onRenameCommute: (commuteId: string, name: string) => void;
  onSaveNamedPlace: (kind: PlaceKind, point: MapPoint) => void;
}) {
  const [editingPlace, setEditingPlace] = useState<PlaceKind | null>(null);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Places & routes</Text>
        <Text style={styles.title}>Saved shortcuts</Text>
        <Text style={styles.muted}>
          Home and Work stay as quick Plan shortcuts. Favourite routes are saved from Plan and managed here.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Key places</Text>
        <PlaceRow
          label="Home"
          point={homeLocation}
          selected={editingPlace === "home"}
          onClear={() => onClearNamedPlace("home")}
          onEdit={() => setEditingPlace((current) => current === "home" ? null : "home")}
        />
        {editingPlace === "home" ? (
          <SavedPlaceEditor
            kind="home"
            label="Home"
            onClear={() => onClearNamedPlace("home")}
            onSave={(point) => onSaveNamedPlace("home", point)}
            point={homeLocation}
          />
        ) : null}
        <PlaceRow
          label="Work"
          point={workLocation}
          selected={editingPlace === "work"}
          onClear={() => onClearNamedPlace("work")}
          onEdit={() => setEditingPlace((current) => current === "work" ? null : "work")}
        />
        {editingPlace === "work" ? (
          <SavedPlaceEditor
            kind="work"
            label="Work"
            onClear={() => onClearNamedPlace("work")}
            onSave={(point) => onSaveNamedPlace("work", point)}
            point={workLocation}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionLabel}>Favourite routes</Text>
          <Text style={styles.sectionHint}>{savedCommutes.length}/20 saved</Text>
        </View>
        {savedCommutes.length ? (
          <View style={styles.routeList}>
            {savedCommutes.map((commute) => (
              <SavedRouteRow
                key={commute.id}
                commute={commute}
                onRemove={() => onRemoveCommute(commute.id)}
                onRename={(name) => onRenameCommute(commute.id, name)}
                onSaveHome={() => onSaveNamedPlace("home", commute.from)}
                onSaveWork={() => onSaveNamedPlace("work", commute.to)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyRoutes}>
            <Text style={styles.emptyRoutesTitle}>No favourite routes yet</Text>
            <Text style={styles.emptyRoutesText}>Plan a route, then use Save route to keep it here.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function PlaceRow({
  label,
  onClear,
  onEdit,
  point,
  selected,
}: {
  label: string;
  onClear: () => void;
  onEdit: () => void;
  point?: MapPoint;
  selected: boolean;
}) {
  return (
    <View style={[styles.placeRow, selected && styles.placeRowSelected]}>
      <View style={styles.placeBadge}>
        <Text style={styles.placeBadgeText}>{label.slice(0, 1)}</Text>
      </View>
      <View style={styles.placeCopy}>
        <Text style={styles.placeTitle}>{label}</Text>
        <Text numberOfLines={1} style={styles.placeMeta}>{point ? point.label : "Not set"}</Text>
      </View>
      <View style={styles.placeActions}>
        {point ? (
          <Pressable accessibilityRole="button" onPress={onClear} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>Clear</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.primarySmallButton}>
          <Text style={styles.primarySmallButtonText}>{selected ? "Done" : point ? "Edit" : "Set"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SavedRouteRow({
  commute,
  onRemove,
  onRename,
  onSaveHome,
  onSaveWork,
}: {
  commute: SavedCommute;
  onRemove: () => void;
  onRename: (name: string) => void;
  onSaveHome: () => void;
  onSaveWork: () => void;
}) {
  const [draftName, setDraftName] = useState(commute.name);
  const nameChanged = draftName.trim() !== commute.name;

  useEffect(() => {
    setDraftName(commute.name);
  }, [commute.name]);

  return (
    <View style={styles.routeRow}>
      <View style={styles.routeHeader}>
        <View style={styles.routeBadge}>
          <Text style={styles.routeBadgeText}>{commute.fuel}</Text>
        </View>
        <View style={styles.routeCopy}>
          <View style={styles.routeNameRow}>
            <TextInput
              accessibilityLabel={`Favourite route name ${commute.name}`}
              onChangeText={setDraftName}
              onSubmitEditing={() => onRename(draftName)}
              returnKeyType="done"
              style={styles.routeNameInput}
              value={draftName}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!nameChanged}
              onPress={() => onRename(draftName)}
              style={[styles.renameButton, !nameChanged && styles.renameButtonDisabled]}
            >
              <Text style={[styles.renameButtonText, !nameChanged && styles.renameButtonTextDisabled]}>Save</Text>
            </Pressable>
          </View>
          <Text numberOfLines={1} style={styles.routeMeta}>{shortPointName(commute.from)} to {shortPointName(commute.to)}</Text>
        </View>
        <View style={[styles.routeState, commute.alertEnabled && styles.routeStateOn]}>
          <Text style={[styles.routeStateText, commute.alertEnabled && styles.routeStateTextOn]}>
            {commute.alertEnabled ? "Watching" : "Saved"}
          </Text>
        </View>
      </View>

      <View style={styles.routeDetailRow}>
        <Text numberOfLines={1} style={styles.routeDetailText}>From: {commute.from.label}</Text>
        <Text numberOfLines={1} style={styles.routeDetailText}>To: {commute.to.label}</Text>
      </View>

      <View style={styles.routeActions}>
        <Pressable accessibilityRole="button" onPress={onSaveHome} style={styles.routeActionButton}>
          <Text style={styles.routeActionText}>Start to Home</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSaveWork} style={styles.routeActionButton}>
          <Text style={styles.routeActionText}>Destination to Work</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onRemove} style={styles.removeButton}>
          <Text style={styles.removeButtonText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

function shortPointName(point: MapPoint) {
  return point.displayTitle || point.label.split(",")[0] || "Saved place";
}

const styles = StyleSheet.create({
  card: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.lg,
    padding: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
  title: {
    ...typography.title,
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: colors.greenDark,
    fontSize: typeScale.micro,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sectionHint: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  placeRow: {
    ...surfaces.softPanel,
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 58,
    padding: spacing.sm,
  },
  placeRowSelected: {
    borderColor: colors.green,
  },
  placeBadge: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  placeBadgeText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  placeCopy: {
    flex: 1,
    minWidth: 0,
  },
  placeTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  placeMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
    marginTop: 2,
  },
  placeActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  primarySmallButton: {
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  primarySmallButtonText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  textButton: {
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.xs,
  },
  textButtonLabel: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  routeList: {
    gap: spacing.sm,
  },
  routeRow: {
    ...surfaces.softPanel,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.md,
  },
  routeHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  routeBadge: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    minWidth: 46,
    paddingHorizontal: spacing.sm,
  },
  routeBadgeText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  routeCopy: {
    flex: 1,
    minWidth: 0,
  },
  routeNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  routeNameInput: {
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.body,
    fontWeight: "900",
    minHeight: 30,
    minWidth: 0,
    padding: 0,
  },
  renameButton: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 30,
    minWidth: 54,
    paddingHorizontal: spacing.sm,
  },
  renameButtonDisabled: {
    backgroundColor: colors.line,
  },
  renameButtonText: {
    color: colors.white,
    fontSize: typeScale.micro,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  renameButtonTextDisabled: {
    color: colors.muted,
  },
  routeMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
  },
  routeState: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  routeStateOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  routeStateText: {
    color: colors.muted,
    fontSize: typeScale.micro,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeStateTextOn: {
    color: colors.greenDark,
  },
  routeDetailRow: {
    gap: 2,
  },
  routeDetailText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
  },
  routeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  routeActionButton: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  routeActionText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  removeButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  removeButtonText: {
    color: colors.red,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  emptyRoutes: {
    ...surfaces.softPanel,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyRoutesTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  emptyRoutesText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
    lineHeight: 18,
  },
});
