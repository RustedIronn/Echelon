import ScheduleEditor from "@features/schedule/components/ScheduleEditor";
import ResetDay from "@features/schedule/components/ResetDay";
import PageTitle from "@ui/PageTitle";

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
