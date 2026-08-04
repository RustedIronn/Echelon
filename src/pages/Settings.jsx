import ScheduleEditor from "@components/settings/ScheduleEditor";
import ResetDay from "@components/settings/ResetDay";
import PageTitle from "@components/ui/PageTitle";

export default function Settings() {
  return (
    <div className="page">
      <PageTitle
        label="CONTROL"
        title="Settings"
        description="Adjust your system."
      />

      <ScheduleEditor />

      <ResetDay />
    </div>
  );
}
