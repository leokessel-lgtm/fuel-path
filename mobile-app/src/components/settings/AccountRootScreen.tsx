import { Pressable, ScrollView, Text, View } from "react-native";

import { AppPreferences, NotificationPermissionState, SavedCommute } from "../../types";
import { styles } from "./settingsStyles";
import {
  activeDiscountSummary,
  alertSettingsSummary,
  placesSettingsSummary,
  SettingsSection,
  vehicleSettingsSummary,
} from "./settingsSections";

export function AccountRootScreen({
  notificationPermission,
  onSelectSection,
  preferences,
  savedCommutes,
}: {
  notificationPermission: NotificationPermissionState;
  onSelectSection: (section: SettingsSection) => void;
  preferences: AppPreferences;
  savedCommutes: SavedCommute[];
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.rootHeader}>
        <Text style={styles.rootTitle}>Settings</Text>
        <Text style={styles.rootSubtitle}>Fuel, savings, places and alerts.</Text>
      </View>
      <View style={styles.card}>
        <SettingsRow
          label="Vehicle & fuel"
          onPress={() => onSelectSection("vehicle")}
          summary={vehicleSettingsSummary(preferences)}
          title={preferences.vehicleName || preferences.vehicleRego || "Active vehicle"}
        />
        <SettingsRow
          label="Savings"
          onPress={() => onSelectSection("savings")}
          summary={activeDiscountSummary(preferences)}
          title="Discounts & eligibility"
        />
        <SettingsRow
          label="Places"
          onPress={() => onSelectSection("places")}
          summary={placesSettingsSummary(preferences, savedCommutes)}
          title="Home, work & saved routes"
        />
        <SettingsRow
          label="Alerts"
          onPress={() => onSelectSection("alerts")}
          summary={alertSettingsSummary(notificationPermission, savedCommutes)}
          title="Route notifications"
        />
        <SettingsRow
          label="Support"
          onPress={() => onSelectSection("privacy")}
          summary="Privacy, data and support notes"
          title="Privacy & support"
        />
      </View>
    </ScrollView>
  );
}

function SettingsRow({
  label,
  onPress,
  summary,
  title,
}: {
  label: string;
  onPress: () => void;
  summary: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${summary}`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.settingsRow}
    >
      <View style={styles.settingsRowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.rowSummary}>{summary}</Text>
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}
