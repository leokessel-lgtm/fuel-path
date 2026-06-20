import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { NotificationPermissionState, SavedCommute } from "../types";
import { alertGateSummary, commuteAlertRuleLine } from "../utils/decisionEvidence";

const MIN_SAVING_OPTIONS = [3, 5, 8, 12];
const MAX_DETOUR_OPTIONS = [3, 5, 8, 12];
const TANK_THRESHOLD_OPTIONS = [25, 45, 65, 80];

export function SavedRouteAlertsCard({
  alertSyncingCommuteId,
  notificationMessage,
  notificationPermission,
  savedCommutes,
  onRemoveCommute,
  onRequestNotifications,
  onToggleCommuteAlert,
  onUpdateCommuteAlertRule,
}: {
  alertSyncingCommuteId: string | null;
  notificationMessage: string;
  notificationPermission: NotificationPermissionState;
  savedCommutes: SavedCommute[];
  onRemoveCommute: (commuteId: string) => void;
  onRequestNotifications: () => void;
  onToggleCommuteAlert: (commuteId: string) => void;
  onUpdateCommuteAlertRule: (
    commuteId: string,
    key: "minSavingDollars" | "maxDetourMinutes" | "tankThresholdPercent",
    value: number,
  ) => void;
}) {
  const notificationsReady = notificationPermission === "granted";
  const notificationButtonLabel = notificationsReady
    ? "Permission enabled"
    : notificationPermission === "unavailable"
      ? "Check device support"
      : "Enable route alerts";

  return (
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
            <View
              key={commute.id}
              style={[
                styles.alertRow,
                alertSyncingCommuteId === commute.id && styles.alertRowDisabled,
              ]}
            >
              <Pressable
                accessibilityLabel={`${commute.alertEnabled ? "Disable" : "Enable"} ${commute.name} route alert`}
                accessibilityRole="switch"
                accessibilityState={{
                  checked: commute.alertEnabled,
                  disabled: alertSyncingCommuteId === commute.id,
                }}
                disabled={alertSyncingCommuteId === commute.id}
                onPress={() => onToggleCommuteAlert(commute.id)}
                style={styles.alertToggleArea}
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
                      ? "Watching"
                      : "Off"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Remove saved commute ${commute.name}`}
                accessibilityHint="Cancels local reminders and deletes the backend route alert when sync is configured."
                accessibilityRole="button"
                accessibilityState={{ disabled: alertSyncingCommuteId === commute.id }}
                disabled={alertSyncingCommuteId === commute.id}
                onPress={() => onRemoveCommute(commute.id)}
                style={styles.alertRemoveButton}
              >
                <Text style={styles.alertRemoveButtonText}>Remove</Text>
              </Pressable>
              <View style={styles.routeRulePanel}>
                <RouteAlertRuleSelector
                  commuteId={commute.id}
                  disabled={alertSyncingCommuteId === commute.id}
                  label="Saving"
                  options={MIN_SAVING_OPTIONS}
                  renderValue={(value) => `$${value}`}
                  ruleKey="minSavingDollars"
                  selected={commute.minSavingDollars}
                  onSelect={onUpdateCommuteAlertRule}
                />
                <RouteAlertRuleSelector
                  commuteId={commute.id}
                  disabled={alertSyncingCommuteId === commute.id}
                  label="Detour"
                  options={MAX_DETOUR_OPTIONS}
                  renderValue={(value) => `${value} min`}
                  ruleKey="maxDetourMinutes"
                  selected={commute.maxDetourMinutes}
                  onSelect={onUpdateCommuteAlertRule}
                />
                <RouteAlertRuleSelector
                  commuteId={commute.id}
                  disabled={alertSyncingCommuteId === commute.id}
                  label="Tank"
                  options={TANK_THRESHOLD_OPTIONS}
                  renderValue={(value) => `${value}%`}
                  ruleKey="tankThresholdPercent"
                  selected={commute.tankThresholdPercent}
                  onSelect={onUpdateCommuteAlertRule}
                />
              </View>
            </View>
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
  );
}

function RouteAlertRuleSelector({
  commuteId,
  disabled,
  label,
  onSelect,
  options,
  renderValue,
  ruleKey,
  selected,
}: {
  commuteId: string;
  disabled: boolean;
  label: string;
  onSelect: (
    commuteId: string,
    key: "minSavingDollars" | "maxDetourMinutes" | "tankThresholdPercent",
    value: number,
  ) => void;
  options: number[];
  renderValue: (value: number) => string;
  ruleKey: "minSavingDollars" | "maxDetourMinutes" | "tankThresholdPercent";
  selected: number;
}) {
  return (
    <View style={styles.routeRuleGroup}>
      <Text style={styles.routeRuleLabel}>{label}</Text>
      <View style={styles.routeRuleOptions}>
        {options.map((value) => {
          const active = value === selected;
          return (
            <Pressable
              accessibilityLabel={`${label} alert rule ${renderValue(value)}`}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: active }}
              disabled={disabled}
              key={`${commuteId}:${ruleKey}:${value}`}
              onPress={() => onSelect(commuteId, ruleKey, value)}
              style={[
                styles.routeRuleOption,
                active && styles.routeRuleOptionSelected,
                disabled && styles.routeRuleOptionDisabled,
              ]}
            >
              <Text style={[styles.routeRuleOptionText, active && styles.routeRuleOptionTextSelected]}>
                {renderValue(value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  alertRowDisabled: {
    opacity: 0.7,
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
    marginTop: spacing.xs,
  },
  alertRuleLine: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "400",
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
  alertRemoveButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  alertRemoveButtonText: {
    color: colors.red,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  routeRulePanel: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexBasis: "100%",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  routeRuleGroup: {
    gap: spacing.xs,
  },
  routeRuleLabel: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  routeRuleOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  routeRuleOption: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    minWidth: 58,
    paddingHorizontal: spacing.sm,
  },
  routeRuleOptionSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  routeRuleOptionDisabled: {
    opacity: 0.65,
  },
  routeRuleOptionText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  routeRuleOptionTextSelected: {
    color: colors.greenDark,
    fontWeight: "700",
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
