import { useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";

import { SettingsSection } from "../components/settings/settingsSections";

export function useSettingsSection() {
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);

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
