import ResetDay from "@features/schedule/components/ResetDay";
import PageTitle from "@ui/PageTitle";
import NotificationSettings from "@features/notifications/components/NotificationSettings";
import ResetMode from "@features/tools/components/ResetMode";
import MoneyCategorySettings from "@features/money/components/MoneyCategorySettings";
import DesktopSettings from "@/desktop/DesktopSettings";
import { isDesktop } from "@/desktop/environment";

export default function Settings() {
  return (
    <div className="page settings-page">
      <PageTitle
        label="CONTROL"
        title="Settings"
        description="Adjust your system."
      />

      <NotificationSettings />
      {isDesktop() ? <DesktopSettings /> : null}

      <details className="settings-tool">
        <summary><strong>Money categories</strong><span>Manage custom ledger categories</span></summary>
        <MoneyCategorySettings />
      </details>

      <details className="settings-tool">
        <summary><strong>Quick reset</strong><span>Open the temporary reset checklist</span></summary>
        <ResetMode />
      </details>

      <ResetDay />
    </div>
  );
}
