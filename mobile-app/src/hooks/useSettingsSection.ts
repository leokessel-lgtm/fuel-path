import { useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";

import { SettingsSection } from "../components/settings/settingsSections";

export function useSettingsSection(initialSection: SettingsSection | null = null) {
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(initialSection);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    if (Platform.OS === "web" || !activeSection) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setActiveSection(null);
      return true;
    });
    return () => subscription.remove();
  }, [activeSection]);

  return {
    activeSection,
    clearActiveSection: () => setActiveSection(null),
    setActiveSection,
  };
}
