import { AccountDetailScreen } from "../components/settings/AccountDetailScreen";
import { AccountRootScreen } from "../components/settings/AccountRootScreen";
import { useSettingsSection } from "../hooks/useSettingsSection";
import { AccountScreenProps } from "./AccountScreen.types";

export function AccountScreen(props: AccountScreenProps) {
  const { activeSection, clearActiveSection, setActiveSection } = useSettingsSection();

  if (activeSection) {
    return (
      <AccountDetailScreen
        {...props}
        activeSection={activeSection}
        onBack={clearActiveSection}
      />
    );
  }

  return (
    <AccountRootScreen
      preferences={props.preferences}
      savedCommutes={props.savedCommutes}
      notificationPermission={props.notificationPermission}
      onSelectSection={setActiveSection}
    />
  );
}
