import { useLockIn } from "@store/useLockIn";
import Timeline from "@components/timeline/Timeline";
import { PageTitle } from "@components/ui";

export default function Schedule() {
  const { tasks, toggleTask } = useLockIn();

  return (
    <div className="page">
      <PageTitle
        label="STRUCTURE"
        title="Schedule"
        description="One deliberate day."
      />

      <Timeline tasks={tasks} toggleTask={toggleTask} />
    </div>
  );
}
