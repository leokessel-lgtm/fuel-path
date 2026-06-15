import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FuelSelector } from "../components/FuelSelector";
import { discountPrograms } from "../data/discountPrograms";
import { colors, radii, shadow, spacing, typeScale } from "../theme";
import {
  AppPreferences,
  FuelCode,
  NotificationPermissionState,
  SavedCommute,
} from "../types";

export function AccountScreen({
  alertSyncingCommuteId,
  notificationMessage,
  notificationPermission,
  savedCommutes,
  preferences,
  onFuelChange,
  onRequestNotifications,
  onToggleCommuteAlert,
  onToggleDiscount,
}: {
  alertSyncingCommuteId: string | null;
  notificationMessage: string;
  notificationPermission: NotificationPermissionState;
  savedCommutes: SavedCommute[];
  preferences: AppPreferences;
  onFuelChange: (fuel: FuelCode) => void;
  onRequestNotifications: () => void;
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
