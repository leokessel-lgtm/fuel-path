import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import {
  AppPreferences,
  NotificationPermissionState,
  SavedCommute,
  VehicleProfile,
  Weekday,
} from "../types";
import { alertGateSummary, commuteAlertRuleLine } from "../utils/decisionEvidence";

const weekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const weekdayLabels: Record<Weekday, string> = {
  mon: "M",
  tue: "T",
  wed: "W",
  thu: "T",
  fri: "F",
  sat: "S",
  sun: "S",
};
const alertTimeOptions = ["06:30", "07:30", "08:30", "16:30", "17:30"];

export function SavedRouteAlertsCard({
  alertSyncingCommuteId,
  notificationMessage,
  notificationPermission,
  preferences,
  savedCommutes,
  onRemoveCommute,
  onRequestNotifications,
  onToggleCommuteAlert,
  onUpdateCommuteAlertSettings,
}: {
  alertSyncingCommuteId: string | null;
  notificationMessage: string;
  notificationPermission: NotificationPermissionState;
  preferences: AppPreferences;
  savedCommutes: SavedCommute[];
  onRemoveCommute: (commuteId: string) => void;
  onRequestNotifications: () => void;
  onToggleCommuteAlert: (commuteId: string) => void;
  onUpdateCommuteAlertSettings: (
    commuteId: string,
    updates: Partial<Pick<SavedCommute, "alertDays" | "alertTime" | "minSavingDollars" | "vehicleId">>,
  ) => void;
}) {
  const [editingCommuteId, setEditingCommuteId] = useState<string | null>(null);
  const notificationsReady = notificationPermission === "granted";
  const notificationButtonLabel = notificationsReady
    ? "Permission enabled"
    : notificationPermission === "unavailable"
      ? "Check device support"
      : "Enable notifications";

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Notifications</Text>
      <Text style={styles.title}>Watch saved routes</Text>
      <Text style={styles.muted}>{notificationMessage}</Text>
      <View style={styles.ruleCard}>
        <Text style={styles.ruleTitle}>Only alert when worth it</Text>
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
          {savedCommutes.map((commute) => {
            const syncing = alertSyncingCommuteId === commute.id;
            const vehicle = routeVehicle(commute, preferences);
            const editing = editingCommuteId === commute.id;
            return (
              <View
                key={commute.id}
                style={[
                  styles.alertRow,
                  syncing && styles.alertRowDisabled,
                ]}
              >
                <View style={styles.alertRowTop}>
                  <Pressable
                    accessibilityLabel={`${commute.alertEnabled ? "Disable" : "Watch"} ${commute.name}`}
                    accessibilityRole="switch"
                    accessibilityState={{
                      checked: commute.alertEnabled,
                      disabled: syncing,
                    }}
                    disabled={syncing}
                    onPress={() => onToggleCommuteAlert(commute.id)}
                    style={styles.alertToggleArea}
                  >
                    <View style={styles.alertCopy}>
                      <Text numberOfLines={1} style={styles.alertName}>
                        {commute.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.alertMeta}>
                        {vehicleLabel(vehicle)} | {alertDaysSummary(commute.alertDays)} {commute.alertTime}
                      </Text>
                      <Text numberOfLines={1} style={styles.alertMeta}>
                        Minimum saving {formatMoney(commute.minSavingDollars)}
                      </Text>
                    </View>
                    <Text style={[
                      styles.alertState,
                      commute.alertEnabled && styles.alertStateOn,
                      commute.alertStatus === "needs_permission" && styles.alertStateNeedsPermission,
                    ]}>
                      {syncing
                        ? "Saving"
                        : commute.alertStatus === "needs_permission"
                          ? "Needs permission"
                          : commute.alertEnabled
                            ? "Watching"
                            : "Off"}
                    </Text>
                  </Pressable>
                </View>

                {commute.alertStatusMessage ? (
                  <Text numberOfLines={2} style={styles.alertStatusMessage}>
                    {commute.alertStatusMessage}
                  </Text>
                ) : null}
                <Text numberOfLines={2} style={styles.alertRuleLine}>
                  {commuteAlertRuleLine(commute)}
                </Text>

                <View style={styles.rowActions}>
                  <Pressable
                    accessibilityLabel={`${editing ? "Close" : "Edit"} notification settings for ${commute.name}`}
                    accessibilityRole="button"
                    disabled={syncing}
                    onPress={() => setEditingCommuteId(editing ? null : commute.id)}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>{editing ? "Done" : "Edit"}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Remove saved route ${commute.name}`}
                    accessibilityHint="Cancels route notifications and removes the saved route."
                    accessibilityRole="button"
                    accessibilityState={{ disabled: syncing }}
                    disabled={syncing}
                    onPress={() => onRemoveCommute(commute.id)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </Pressable>
                </View>

                {editing ? (
                  <RouteAlertEditPanel
                    commute={commute}
                    preferences={preferences}
                    onUpdate={(updates) => onUpdateCommuteAlertSettings(commute.id, updates)}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyAlert}>
          <Text style={styles.emptyAlertText}>
            Save a route from Plan to watch it for useful fuel alerts.
          </Text>
        </View>
      )}
    </View>
  );
}

function RouteAlertEditPanel({
  commute,
  preferences,
  onUpdate,
}: {
  commute: SavedCommute;
  preferences: AppPreferences;
  onUpdate: (updates: Partial<Pick<SavedCommute, "alertDays" | "alertTime" | "minSavingDollars" | "vehicleId">>) => void;
}) {
  const selectedDays = commute.alertDays?.length ? commute.alertDays : weekdays;
  return (
    <View style={styles.editPanel}>
      <Text style={styles.editTitle}>Route notification settings</Text>
      <Text style={styles.editLabel}>Vehicle</Text>
      <View style={styles.chipRow}>
        {preferences.vehicles.map((vehicle) => {
          const selected = vehicle.id === (commute.vehicleId || preferences.activeVehicleId);
          return (
            <Pressable
              key={vehicle.id}
              accessibilityLabel={`Use ${vehicleLabel(vehicle)} for this route`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onUpdate({ vehicleId: vehicle.id })}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {vehicleLabel(vehicle)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.editLabel}>Commute days</Text>
      <View style={styles.dayRow}>
        {weekdays.map((day) => {
          const selected = selectedDays.includes(day);
          return (
            <Pressable
              key={day}
              accessibilityLabel={`${selected ? "Remove" : "Add"} ${day} alert day`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onUpdate({ alertDays: toggleAlertDay(selectedDays, day) })}
              style={[styles.dayChip, selected && styles.dayChipSelected]}
            >
              <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                {weekdayLabels[day]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.editLabel}>Time</Text>
      <View style={styles.chipRow}>
        {alertTimeOptions.map((alertTime) => {
          const selected = alertTime === commute.alertTime;
          return (
            <Pressable
              key={alertTime}
              accessibilityLabel={`Set alert time to ${alertTime}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onUpdate({ alertTime })}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {alertTime}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.editLabel}>Minimum saving</Text>
      <View style={styles.stepperRow}>
        <Pressable
          accessibilityLabel="Decrease minimum saving"
          accessibilityRole="button"
          onPress={() => onUpdate({ minSavingDollars: Math.max(1, commute.minSavingDollars - 1) })}
          style={styles.stepperButton}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{formatMoney(commute.minSavingDollars)}</Text>
        <Pressable
          accessibilityLabel="Increase minimum saving"
          accessibilityRole="button"
          onPress={() => onUpdate({ minSavingDollars: Math.min(25, commute.minSavingDollars + 1) })}
          style={styles.stepperButton}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function routeVehicle(commute: SavedCommute, preferences: AppPreferences) {
  return preferences.vehicles.find((vehicle) => vehicle.id === commute.vehicleId)
    || preferences.vehicles.find((vehicle) => vehicle.id === preferences.activeVehicleId)
    || preferences.vehicles[0];
}

function vehicleLabel(vehicle: VehicleProfile | undefined) {
  if (!vehicle) return "Active vehicle";
  if (vehicle.rego) return vehicle.rego;
  if (vehicle.name) return vehicle.name;
  if (vehicle.vehicleEnergyType === "electric") return "Electric vehicle";
  return vehicle.fuel;
}

function alertDaysSummary(days: Weekday[] | undefined) {
  const selected = days?.length ? days : weekdays;
  if (selected.length === 7) return "Every day";
  if (selected.join(",") === "mon,tue,wed,thu,fri") return "Weekdays";
  if (selected.join(",") === "sat,sun") return "Weekends";
  return selected.map((day) => weekdayLabels[day]).join("");
}

function toggleAlertDay(selectedDays: Weekday[], day: Weekday) {
  const selected = new Set(selectedDays);
  if (selected.has(day)) selected.delete(day);
  else selected.add(day);
  const days = weekdays.filter((item) => selected.has(item));
  return days.length ? days : selectedDays;
}

function formatMoney(value: number) {
  return `$${Math.round(value)}`;
}

const styles = StyleSheet.create({
  card: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.md,
    padding: spacing.md,
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
  notificationButton: {
    ...surfaces.darkAction,
    alignItems: "center",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  notificationButtonDisabled: {
    opacity: 0.7,
  },
  notificationButtonText: {
    color: colors.white,
    fontSize: typeScale.body,
    fontWeight: "700",
  },
  ruleCard: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  ruleTitle: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  ruleText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
  alertList: {
    gap: spacing.sm,
  },
  alertRow: {
    alignItems: "stretch",
    ...surfaces.softPanel,
    borderRadius: radii.xl,
    gap: spacing.sm,
    padding: spacing.md,
  },
  alertRowDisabled: {
    opacity: 0.7,
  },
  alertRowTop: {
    flexDirection: "row",
  },
  alertToggleArea: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 54,
    minWidth: 0,
  },
  alertCopy: {
    flex: 1,
    minWidth: 0,
  },
  alertName: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "600",
  },
  alertMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    marginTop: 2,
  },
  alertStatusMessage: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 15,
  },
  alertRuleLine: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 15,
  },
  alertState: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  alertStateOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    color: colors.greenDark,
    fontWeight: "700",
  },
  alertStateNeedsPermission: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
    color: colors.ink,
  },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  removeButtonText: {
    color: colors.red,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  editPanel: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  editTitle: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  editLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  chipText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: colors.greenDark,
  },
  dayRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  dayChip: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  dayChipSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  dayChipText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  dayChipTextSelected: {
    color: colors.greenDark,
  },
  stepperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  stepperButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  stepperButtonText: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "700",
  },
  stepperValue: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "700",
    minWidth: 48,
    textAlign: "center",
  },
  emptyAlert: {
    ...surfaces.softPanel,
    borderRadius: radii.xl,
    padding: spacing.md,
  },
  emptyAlertText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
});
